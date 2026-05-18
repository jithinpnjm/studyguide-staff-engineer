---
title: "Beginner"
sidebar_position: 1
---

# AWS Beginner — Core Concepts and Primitives

This file covers the foundational AWS concepts every engineer must internalize before tackling production design. The goal is not to memorize service names but to build the mental model that makes every AWS decision traceable to a real operational problem.

---

## The AWS Mental Model

AWS is not one giant computer. It is a collection of separately scoped systems with explicit failure domains, trust boundaries, network paths, and managed control planes. The SRE way to understand AWS is to map every design decision to five boundaries:

| Boundary | AWS Concept | SRE Question |
|---|---|---|
| Ownership | Account, Organization, OU | Who owns this workload and what is the blast radius? |
| Geography | Region | Where does data live and where are users? |
| Failure | Availability Zone | What happens if one AZ fails? |
| Network | VPC, subnet, route table, SG, NACL | What path does traffic take? |
| Trust | IAM, KMS, resource policies | Who can do what, to what, from where? |

Scope matters enormously:

```text
Global: IAM users, Route 53 public hosted zones, CloudFront
Regional: VPC, ALB, RDS, Lambda, DynamoDB table, S3 bucket location
Zonal: EC2 instance, EBS volume, subnet, NAT Gateway
```

During debugging, the first useful question is not "which AWS service is broken?" but "which boundary did the failure cross?"

---

## Regions and Availability Zones

### Region

A Region is AWS's unit for placing workloads in a broad physical part of the world — for example `us-east-1`, `eu-west-1`, or `ap-south-1`. Each Region is designed to be isolated from other Regions. Most services create resources inside one Region and do not automatically replicate across Regions unless explicitly designed to do so.

Choose a Region based on:
- compliance and data residency
- latency to users
- service availability
- pricing
- disaster recovery requirements

Example: if most customers are in Germany and data residency matters, `eu-central-1` may be a better default than `us-east-1`, even if tutorials use `us-east-1`.

### Availability Zone

An AZ is made of one or more data centers with independent power, networking, and connectivity. AZs in the same Region are connected by low-latency private networking. The operational consequence: "deployed in AWS" does not automatically mean highly available. If every EC2 instance, EBS volume, NAT Gateway, and database lives in one AZ, the application is still a single-site system.

Production principle:
- one AZ is a failure domain
- two AZs are the minimum for common HA
- three AZs are better when the service supports it and cost allows

Bad design:
```text
ALB in 2 AZs
App instances in 2 AZs
Database accidentally in 1 AZ   ← single-AZ dependency kills HA guarantee
```

### Edge Locations

Edge locations exist because user experience is often limited by distance. Edge services like CloudFront, Route 53, AWS WAF, and Global Accelerator move caching, TLS termination, DNS responses, and security controls closer to users.

Use edge services when you need:
- lower global latency
- static content caching
- TLS termination near users
- DDoS absorption at the edge

---

## IAM Basics — Shared Responsibility and Access Control

IAM is the control plane for trust. AWS is API-driven infrastructure. Nearly every meaningful action is an API call: create an instance, read an object, decrypt a secret, change a route table, assume a role, delete a snapshot. IAM is the authorization system for those API calls.

IAM answers: **Who can do what to which resource under what conditions?**

| IAM Concept | Meaning |
|---|---|
| Principal | The actor: user, role, AWS service, federated identity |
| Action | API operation, such as `s3:GetObject` |
| Resource | Target ARN, such as a bucket or role |
| Condition | Extra rule, such as source IP, MFA, tag, VPC endpoint |
| Policy | JSON document that allows or denies |
| Role | Assumable identity with temporary credentials |
| Trust policy | Who is allowed to assume the role |

### IAM Users vs Roles

Use IAM users rarely — long-lived human credentials age badly. They get copied into laptops, scripts, and CI systems. Prefer federation through IAM Identity Center or an external identity provider. For workloads, use roles because roles issue temporary credentials.

Examples:
- EC2 instance role lets an instance call AWS APIs without static keys
- Lambda execution role lets a function write logs and access dependencies
- ECS task role gives each task its own scoped permissions
- EKS IRSA or Pod Identity gives Kubernetes workloads AWS permissions without long-lived keys

### Explicit Deny Wins

AWS policy evaluation gives priority to explicit deny. This is the core safety mechanism. If one policy allows `s3:PutObject` but another policy explicitly denies it, the result is deny.

SRE debugging flow for `AccessDenied`:
1. Confirm caller identity: `aws sts get-caller-identity`
2. Identify the API action and resource ARN
3. Check identity policy
4. Check resource policy
5. Check trust policy if role assumption failed
6. Check SCP, permissions boundary, session policy, and condition keys
7. Use CloudTrail to confirm the exact denied API call

### Shared Responsibility Model

AWS operates the cloud infrastructure. You operate what you put in the cloud.

| AWS Manages | You Manage |
|---|---|
| Physical hardware, data centers | OS, patching, runtimes |
| Hypervisor layer | Application code and configuration |
| Managed service infrastructure | IAM policies and access control |
| Network infrastructure | Data encryption choices |
| Global network backbone | Firewall rules (security groups, NACLs) |

---

## EC2 Fundamentals

EC2 gives you virtual machines. You control the OS, packages, runtime, agent configuration, and patching. Key configuration choices:

| Option | Why It Matters |
|---|---|
| AMI | Base machine image and patch level |
| Instance type | CPU, memory, network, storage profile |
| User data | Bootstrap script run at launch |
| Security group | Network access to the instance |
| IAM role | AWS API permissions from the instance |
| EBS volumes | Persistent block storage |
| Placement group | Low latency, partitioning, or spreading |

### Instance Families

- General purpose: balanced workloads (t3, m6i)
- Compute optimized: CPU-heavy services (c6i)
- Memory optimized: caches, in-memory databases, analytics (r6i)
- Storage optimized: high local disk throughput (i3)
- Accelerated computing: GPU or specialized hardware (p4, g4)

SRE lesson: do not choose instance types by guessing. Use metrics: CPU, memory, disk IOPS, network, p95 latency, and saturation during peak.

### EC2 Purchasing Options

| Option | Use Case | Risk |
|---|---|---|
| On-Demand | unpredictable or short-lived workloads | higher cost |
| Reserved Instances | steady known usage | commitment |
| Savings Plans | flexible compute commitment | commitment |
| Spot | fault-tolerant batch or stateless workloads | interruption |
| Dedicated Hosts | licensing/compliance | cost and capacity planning |
| Capacity Reservations | guaranteed capacity | pay for reserved capacity |

Production pattern: use On-Demand for baseline critical capacity, Spot for interruptible overflow, and Savings Plans for predictable usage.

---

## S3 — Object Storage Fundamentals

S3 stores objects in buckets. It is not a filesystem and not a block device. Think: key-value object store with HTTP APIs.

Use S3 for:
- backups and logs
- data lakes and analytics
- static websites and assets
- Terraform state
- ML datasets
- event-driven ingestion

### Buckets and Objects

Bucket names are globally unique. Objects have keys, metadata, content, and optional version IDs when versioning is enabled.

### S3 Security Basics

Control access with:
- IAM identity policies
- Bucket policies
- Block Public Access (keep this ON by default)
- Encryption
- VPC endpoint policies

Default habit: keep Block Public Access enabled unless there is a deliberate, reviewed reason to disable it.

### Versioning

S3 Versioning keeps multiple variants of an object. Deletes create delete markers instead of immediately removing prior versions — accidental deletion is recoverable. Remember: versions cost money because each version is stored.

### Storage Classes

| Class | Use Case |
|---|---|
| Standard | frequently accessed data |
| Intelligent-Tiering | unknown/changing access patterns |
| Standard-IA | infrequent access, multi-AZ resilience |
| One Zone-IA | infrequent, recreatable data |
| Glacier Instant Retrieval | archive with instant access |
| Glacier Flexible Retrieval | archive with minutes/hours retrieval |
| Glacier Deep Archive | lowest-cost long-term archive |

---

## RDS Fundamentals

RDS is managed relational database hosting for engines such as PostgreSQL, MySQL, MariaDB, Oracle, and SQL Server.

AWS manages:
- provisioning and hardware
- backups and patching options
- monitoring integrations
- failover automation when Multi-AZ is enabled

You still own:
- schema design and indexes
- query performance
- connection management
- application retry behavior
- backup retention choices

### RDS Multi-AZ

A Multi-AZ deployment has a standby in another AZ for failover. The standby does not serve read traffic — it exists purely for availability.

SRE rule: Multi-AZ is high availability, not read scaling by default.

### Read Replicas

Read replicas scale reads and can support reporting. They are usually asynchronous and can lag. Do not assume replicas provide zero-data-loss failover.

---

## VPC Basics

A VPC is your private network boundary in a Region. Every EC2 instance, RDS database, and Lambda function runs inside a VPC.

Typical layout:
```text
VPC: 10.0.0.0/16

Public subnets:
  10.0.1.0/24 in AZ A
  10.0.2.0/24 in AZ B

Private app subnets:
  10.0.11.0/24 in AZ A
  10.0.12.0/24 in AZ B

Private data subnets:
  10.0.21.0/24 in AZ A
  10.0.22.0/24 in AZ B
```

### Public vs Private Subnet

A subnet is public if its route table has a route to an Internet Gateway and instances have public addressing. A subnet is private when it has no direct inbound internet path.

Common design:
```text
Public subnet: ALB, NAT Gateway, bastion only if required
Private app subnet: EC2, ECS, EKS nodes, Lambda ENIs
Private data subnet: RDS, ElastiCache, internal services
```

### Security Groups

Security groups are stateful, resource-level firewalls. They allow traffic and do not create deny rules. If inbound traffic is allowed, response traffic is automatically allowed back.

Classic three-tier setup:
```text
Internet -> ALB security group: allow 443 from 0.0.0.0/0
ALB -> App security group: allow app port from ALB SG
App -> DB security group: allow DB port from App SG
```

Use security group references instead of broad CIDR ranges when possible.

### NAT Gateway

NAT Gateway allows private subnet workloads to initiate outbound IPv4 internet connections. It does not allow inbound connections to private instances.

Cost warning: NAT Gateway charges for hours and data processing. Heavy traffic to S3, ECR, CloudWatch, or other AWS services through NAT can become expensive. Prefer VPC endpoints where appropriate.

### Route Tables

Route tables decide the next hop:
```text
Public subnet:
  0.0.0.0/0 -> Internet Gateway

Private subnet:
  0.0.0.0/0 -> NAT Gateway

Private with S3 endpoint:
  pl-xxxx (S3 prefix list) -> Gateway VPC Endpoint
```

---

## Billing Basics and Cost Awareness

Cost is a reliability signal. Sudden cost spikes often indicate runaway systems.

Key billing concepts:
- **Free Tier**: limited usage of many services free for 12 months (or always free)
- **On-Demand pricing**: pay per second or per hour for what you use
- **Data transfer costs**: egress to internet and cross-AZ data transfers have per-GB charges
- **Request costs**: S3, API Gateway, Lambda all charge per invocation or request

Tools:
- **AWS Cost Explorer**: visualize and analyze spending
- **AWS Budgets**: set spend alerts before you hit limits
- **Cost Anomaly Detection**: ML-powered spend anomaly alerts
- **Trusted Advisor**: checks for cost optimization opportunities
- **Compute Optimizer**: recommends right-sized EC2 instances

Common cost traps for beginners:
- Leaving EC2 instances running when not needed
- NAT Gateway data processing charges
- Unattached EBS volumes (still billed after instance termination)
- CloudWatch Logs ingestion from verbose logging
- S3 request costs at high scale

---

## Summary: Beginner Principles

Strong AWS fundamentals follow these principles:

1. **Multi-AZ by default** — spread all production tiers across at least two AZs
2. **Least privilege IAM** — use roles with minimal permissions, no long-lived keys
3. **Private by default** — workloads in private subnets, public exposure only at the edge
4. **Managed services for undifferentiated work** — let AWS manage backups, patching, failover
5. **Observe everything** — CloudWatch metrics and logs from day one
6. **Cost tagging** — tag every resource with service, environment, and owner

Junior answer: "I deploy EC2 instances in AWS with S3 for storage."

Senior answer: "I design with explicit failure domains, least-privilege identity, private networking with VPC endpoints, multi-AZ data stores, and observable service paths. Every resource is tagged, monitored, and can be replaced without manual intervention."
