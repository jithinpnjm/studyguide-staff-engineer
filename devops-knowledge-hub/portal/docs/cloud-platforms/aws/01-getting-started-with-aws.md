---
title: "Getting Started With AWS"
sidebar_position: 1
---

# Getting Started With AWS

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The slide deck starts by introducing AWS as a cloud provider, but for interview learning that definition is too shallow. AWS is an API-driven infrastructure platform. Instead of filing tickets for servers, networks, firewalls, storage, load balancers, and databases, you declare or call APIs to create them. That changes the operational model: infrastructure becomes fast, repeatable, observable, and dangerous. A wrong IAM policy, route table, or autoscaling rule can affect production in seconds.

The first principle is scope. Some AWS services are global, some are regional, and some are zonal. IAM feels global. S3 bucket names are global, but buckets live in a selected Region. VPCs are regional. Subnets are zonal. EC2 instances and EBS volumes are zonal. Route 53 and CloudFront sit closer to the global edge. When a production system fails, scope tells you where to look. A single-AZ issue should not bring down a multi-AZ app. A regional control plane issue should not destroy already-running data plane traffic if the architecture is resilient. A global identity or DNS mistake can have a much wider blast radius.

Interview framing:

```text
AWS is not just rented servers. It is programmable infrastructure with explicit
identity, network, failure, and geographic boundaries. I design by deciding which
boundary should absorb each failure.
```

---

## AWS Scope Cheat Sheet

| Scope | Examples | Implication |
|---|---|---|
| Global | IAM users/roles, Route 53 public hosted zones, CloudFront, S3 bucket names | Mistakes affect all Regions |
| Regional | VPC, ALB, RDS, Lambda, DynamoDB table, S3 bucket location, ECS cluster | Scope to one Region; use multiple for DR |
| Zonal (AZ) | EC2 instance, EBS volume, subnet, NAT Gateway, ElastiCache node | AZ failure directly affects resource |

**Production principle:** if every tier of your app is in one AZ, you have a single-site system with cloud branding. Genuine HA requires spreading each tier — compute, data, NAT, and dependencies — across at least two AZs.

## AWS Mental Model: 5 Boundaries

| Boundary | AWS Concept | SRE Question |
|---|---|---|
| Ownership | Account, Organization, OU | Who owns this workload? What is the blast radius? |
| Geography | Region | Where does data live? Where are users? |
| Failure | Availability Zone | What happens if one AZ fails? |
| Network | VPC, subnet, route table, SG, NACL | What path does traffic take? |
| Trust | IAM, KMS, resource policies | Who can do what, to what, from where? |

## AWS Organizations and Multi-Account Design

```text
AWS Organization
  Management account (billing, SCPs only — no workloads)
  Security / Audit account (centralized CloudTrail, Security Hub)
  Log archive account (immutable log destination)
  Shared network account (Transit Gateway, Direct Connect)
  Dev workload accounts
  Staging workload accounts
  Production workload accounts
```

**Why separate accounts matter:**
- Blast radius: a production mistake stays in the production account
- Billing: clear cost allocation per workload or team
- Service quotas: separate limits per account
- Security: IAM boundaries are account-level
- Audit: CloudTrail per account, aggregated centrally

## Service Control Policies (SCPs)

SCPs define maximum permissions for all principals in an account or OU. They cannot grant permissions — they only restrict them.

**Common guardrails:**
```text
- Deny disabling CloudTrail
- Deny public S3 bucket changes (except security automation)
- Deny launching resources outside approved Regions (us-east-1, eu-west-1)
- Deny deleting backup vaults
- Deny creating IAM users (force federation)
```

Example SCP to restrict Regions:
```json
{
  "Effect": "Deny",
  "Action": "*",
  "Resource": "*",
  "Condition": {
    "StringNotEquals": {
      "aws:RequestedRegion": ["us-east-1", "eu-west-1"]
    }
  }
}
```

## AZ Failure: What Actually Breaks

```text
Single NAT Gateway in AZ-A fails -> private subnets in AZ-B lose outbound internet
RDS in AZ-A only -> database unavailable (no Multi-AZ)
EC2 instances only in AZ-A -> ASG needs instances in both AZs
EBS volume in AZ-A -> cannot attach to EC2 in AZ-B
```

Senior AZ failure checklist: ALB enabled AZs, ASG subnet distribution, target health per AZ, RDS/Aurora failover state, NAT Gateway per AZ, hardcoded zonal dependencies, EBS attachment assumptions.

## Interview Q&A

**Q: What is the difference between an AWS Region and an Availability Zone?**
A: A Region is a geographic cluster of data centers (e.g., `us-east-1` in Northern Virginia). An Availability Zone is an isolated subset within a Region with independent power, cooling, and networking. AZs are connected by low-latency private links. Spreading workloads across AZs provides high availability within a Region. Using multiple Regions is for disaster recovery and global distribution.

**Q: Why use multiple AWS accounts instead of one?**
A: Accounts create hard isolation boundaries for IAM, billing, service quotas, and blast radius. A compromise or misconfiguration in one account cannot directly affect another. Production workloads should live in separate accounts from dev/staging. Security automation, audit logs, and billing governance are easier with the AWS Organizations multi-account model.

**Q: What is an SCP and how does it differ from an IAM policy?**
A: An IAM policy grants or denies specific permissions to a principal in an account. An SCP sets the maximum allowed permissions for the entire account or OU — it cannot grant permissions by itself. Even if a role has `s3:*` in its policy, an SCP that denies writes to S3 will block those writes. The combined effective permission is the intersection.
