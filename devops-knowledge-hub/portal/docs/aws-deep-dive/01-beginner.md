---
title: "Beginner"
sidebar_position: 1
---

# AWS Deep Dive — Beginner: Core Concepts and Primitives

This guide builds AWS intuition from first principles. The goal is not to memorize service names but to understand the operational problem each service solves, so every AWS decision traces back to a real engineering need.

---

## The AWS Mental Model

AWS is not one giant computer. It is a programmable set of failure domains, trust boundaries, network paths, and managed control planes. You are not only launching servers — you are deciding where failure is allowed to stop, who is allowed to act, and how packets and API calls move through the system.

The SRE mental model maps every design decision to five boundaries:

| Boundary | AWS Concept | SRE Question |
|---|---|---|
| Ownership | Account, Organization, OU | Who owns this workload and what is the blast radius? |
| Geography | Region | Where does data live and where are users? |
| Failure | Availability Zone | What happens if one AZ fails? |
| Network | VPC, subnet, route table, SG, NACL | What path does traffic take? |
| Trust | IAM, KMS, resource policies | Who can do what, to what, from where? |

Scope determines blast radius. Misunderstanding scope is a common root cause of outages because engineers assume redundancy exists where it does not:

```text
Global:   IAM users, Route 53 public hosted zones, CloudFront
Regional: VPC, ALB, RDS, Lambda, DynamoDB table, S3 bucket location
Zonal:    EC2 instance, EBS volume, subnet, NAT Gateway
```

A single-AZ issue should not bring down a multi-AZ app. A global identity or DNS mistake can have a much wider blast radius.

---

## Global Infrastructure

### Regions

A Region is AWS's unit for placing workloads in a broad physical part of the world — `us-east-1`, `eu-west-1`, `ap-south-1`. Each Region is designed to be isolated from other Regions. Most services create resources inside one Region and resources are not automatically replicated across Regions unless you explicitly design for that.

Choosing a Region is not cosmetic. It affects:

- user latency
- legal exposure and data residency compliance
- AWS feature availability (not all services launch in all Regions simultaneously)
- cost (pricing varies by Region)
- DR architecture options

**Rule:** If most customers are in Germany and data residency matters, `eu-central-1` may be better than `us-east-1`, even if tutorials use `us-east-1`.

### Availability Zones

An Availability Zone is one or more data centers with independent power, networking, and cooling. AZs in the same Region are connected by low-latency private networking. They exist because hardware, power, and cooling failures are inevitable. AWS exposes AZs so you can spread workloads across independent failure domains.

**Critical principle:** "Deployed in AWS" does not automatically mean highly available. If every EC2 instance, EBS volume, NAT Gateway, and database dependency lives in one AZ, the application is still a single-site system with cloud branding.

Production principle:
- One AZ is a failure domain
- Two AZs are the minimum for common HA
- Three AZs are better when cost allows

Bad design example:
```text
ALB in 2 AZs
App instances in 2 AZs
Database accidentally in 1 AZ     <-- single point of failure
```

### Edge Locations

Edge locations exist because user experience is limited by the speed of light. Services like CloudFront, Route 53, AWS WAF, and Global Accelerator move caching, TLS termination, DNS responses, and routing decisions closer to users.

Use edge services when you need:
- lower global latency
- static content caching
- TLS termination near users
- DDoS absorption at the edge
- global traffic entry points

### Shared Responsibility Model

AWS operates under a shared responsibility model. AWS manages security **of** the cloud; you manage security **in** the cloud.

| AWS Responsibility | Your Responsibility |
|---|---|
| Physical data center security | IAM policies and user access |
| Hypervisor and network hardware | OS patching on EC2 instances |
| Managed service infrastructure | Application code and configuration |
| Global network backbone | Data classification and encryption choices |
| Hardware replacement | Backup verification and DR testing |

Understanding this boundary prevents assuming AWS handles something you actually own.

---

## IAM — Identity and Access Management

### Why IAM Exists

In a traditional Linux server, authorization means file permissions, sudoers, SSH keys, and process ownership. In AWS, nearly every meaningful action is an API call: create an instance, read an object, decrypt a secret, change a route table, assume a role. IAM is the authorization system for those API calls.

IAM answers: **Who can do what to which resource under what conditions?**

### Core Concepts

| IAM Concept | Meaning |
|---|---|
| Principal | The actor: user, role, AWS service, federated identity |
| Action | API operation, such as `s3:GetObject` or `ec2:RunInstances` |
| Resource | Target ARN, such as a specific bucket or role |
| Condition | Extra rule: source IP, MFA, tag, VPC endpoint, time |
| Policy | JSON document that allows or denies actions |
| Role | Assumable identity that issues temporary credentials |
| Trust policy | JSON document defining who can assume a role |

### IAM Users

An IAM user is a long-lived identity with a username and password or access keys. Users are for humans who have not federated through an identity provider. Limits:
- 5,000 IAM users per account
- Long-lived access keys age badly — they get copied into laptops, CI systems, and forgotten terminals
- Use MFA for any human account

### IAM Groups

Groups let you attach policies to multiple users at once. A user can belong to multiple groups. Groups cannot be nested.

### IAM Roles

Roles are the preferred identity for workloads. Unlike users, roles issue **temporary credentials** through STS. They are assumable by principals defined in the trust policy.

Roles for workloads:
- **EC2 instance role:** lets an instance call AWS APIs without static keys
- **Lambda execution role:** lets a function write logs and access dependencies
- **ECS task role:** gives each task its own scoped permissions
- **EKS IRSA or Pod Identity:** gives Kubernetes workloads AWS permissions

### IAM Policies

Policies are JSON documents. A statement has Effect (Allow/Deny), Action, Resource, and optional Condition.

Minimal example — allow reading from a specific S3 bucket:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}
```

**Explicit deny always wins.** If one policy allows `s3:PutObject` but another explicitly denies it, the result is deny. This is the core safety mechanism that lets guardrails override local mistakes.

### MFA

Multi-factor authentication adds a second verification layer. Require MFA for all human accounts, especially those with console access. You can enforce MFA with IAM policy conditions using `aws:MultiFactorAuthPresent`.

### Access Keys vs Roles

| | Access Keys | IAM Roles |
|---|---|---|
| Lifetime | Long-lived until rotated or deleted | Short-lived, auto-rotated STS tokens |
| Risk | Leak or theft is a persistent threat | Leaked token expires within hours |
| Use case | Legacy scripts, some CI systems | EC2, Lambda, ECS, EKS, federation |
| Best practice | Minimize usage; rotate often | Preferred for all workloads |

### IAM Best Practices

1. Use least privilege — start narrow and expand based on actual need
2. Use roles and temporary credentials for workloads
3. Avoid long-lived access keys; prefer federation for humans
4. Require MFA for console users
5. Separate deploy, runtime, and break-glass roles
6. Use `aws:PrincipalOrgID` to restrict cross-account access to your organization
7. Never embed credentials in application code or container images

### Debugging AccessDenied

```text
1. Find exact error and AWS API action
2. Identify runtime principal: aws sts get-caller-identity
3. Check CloudTrail for the failed API call
4. Evaluate identity policy, resource policy, KMS key policy, SCP, conditions
5. Add the narrowest missing permission or fix the trust boundary
```

---

## EC2 — Elastic Compute Cloud

### Why EC2

EC2 is the familiar VM model in AWS. It still matters because of control. When you need OS-level tuning, custom agents, legacy software, special networking, GPUs, or predictable long-running compute, EC2 is a core primitive.

An EC2 instance is not just "a server." It is a bundle of choices:

| Choice | Why It Matters |
|---|---|
| AMI | Base machine image, OS, patch level |
| Instance type | CPU, memory, network, EBS bandwidth, local storage |
| Subnet | AZ and routing |
| Security group | Allowed network paths |
| IAM instance profile | AWS API power from inside the instance |
| User data | Bootstrap script run at launch |
| EBS volumes | Persistent block storage |
| Placement group | Low latency, partitioning, or spreading |

### Instance Families

| Family | Use Case |
|---|---|
| General purpose (t, m) | Balanced compute, memory, networking |
| Compute optimized (c) | CPU-intensive services, batch |
| Memory optimized (r, x) | Caches, in-memory databases, analytics |
| Storage optimized (i, d) | High IOPS workloads, data warehousing |
| Accelerated computing (p, g, inf) | ML training/inference, GPU rendering |

**SRE lesson:** Choose instance types by metrics — CPU, memory, disk IOPS, network throughput, p95 latency — not by guessing.

### AMI — Amazon Machine Image

An AMI is a template for launching EC2 instances. It includes the OS, pre-installed packages, configuration, and an EBS snapshot for the root volume.

Production AMI pattern:
```text
base AMI -> hardened and scanned AMI -> app AMI -> launch template -> Auto Scaling group
```

Manual snowflake AMIs are hard to audit and reproduce. Use automated image pipelines.

### Key Pairs

Key pairs provide SSH access to EC2 instances. AWS stores the public key; you keep the private key. For production, prefer AWS Systems Manager Session Manager over SSH where possible — it eliminates the need for open port 22 and public bastion hosts.

### Security Groups

Security groups are stateful, resource-level firewalls attached to ENIs. They are **allow-only** — there are no deny rules in a security group. If inbound traffic is allowed, response traffic is automatically allowed.

Three-tier security group pattern:
```text
Internet -> ALB SG: allow 443 from 0.0.0.0/0
ALB -> App SG: allow app port from ALB SG reference
App -> DB SG: allow DB port from App SG reference
```

Use security group references instead of broad CIDR ranges when possible.

### User Data

User data is a bootstrap script that runs once at first launch. It is useful for installing agents, fetching config, and joining clusters — not for building applications on first boot.

Good use:
```bash
#!/bin/bash
yum install -y amazon-cloudwatch-agent
aws s3 cp s3://my-config-bucket/cloudwatch-config.json /etc/cw-config.json
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -c file:/etc/cw-config.json -s
```

Poor use: cloning random branches, building app on first boot, silently ignoring failures.

### Instance Metadata

The EC2 instance metadata service is available from inside an instance at `http://169.254.169.254/latest/meta-data/`. Applications can retrieve instance ID, AZ, IAM credentials, and other instance properties. IMDSv2 (token-based) is more secure than IMDSv1 and should be required on all instances.

### Important Ports to Know

| Port | Service |
|---|---|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL / Aurora MySQL |
| 5432 | PostgreSQL / Aurora PostgreSQL |
| 6379 | Redis |
| 2049 | NFS / EFS |

### EC2 Failure Modes

- Instance launches but application never starts
- App starts but target group health check fails
- Instance has no IAM role or the wrong role
- User data fails because private subnet lacks NAT or VPC endpoints
- Instance type is wrong for the actual bottleneck
- Burstable instance runs out of CPU credits

---

## S3 — Simple Storage Service

### Why S3

S3 is object storage. It is not a filesystem and not a block device. Think "key-value object store with HTTP APIs." You put and get objects by key. It does not support POSIX operations like rename, append, locking, or directory semantics.

Use S3 for:
- backups and snapshots
- logs and audit trails
- data lakes and ML datasets
- static website hosting
- build artifacts and Terraform state
- durable user uploads
- event-driven data ingestion

### Buckets and Objects

- **Bucket names are globally unique** across all AWS accounts
- **Buckets are regional** — they live in the Region you select
- Objects have: key (path-like name), content, metadata, version ID (when versioning is on), optional tags
- Maximum object size: 5 TB; use multipart upload for objects over 100 MB

### Storage Classes

| Class | Use Case | Availability |
|---|---|---|
| Standard | Frequently accessed data | Multi-AZ |
| Intelligent-Tiering | Unknown or changing access patterns | Multi-AZ |
| Standard-IA | Infrequent access, must be durable | Multi-AZ |
| One Zone-IA | Infrequent access, recreatable data | Single AZ |
| Glacier Instant Retrieval | Archives needing millisecond access | Multi-AZ |
| Glacier Flexible Retrieval | Archive with minutes to hours retrieval | Multi-AZ |
| Glacier Deep Archive | Lowest cost, 12h retrieval | Multi-AZ |
| Express One Zone | High-performance, low-latency | Single AZ |

### Versioning

S3 Versioning keeps multiple variants of an object in a bucket. When versioning is enabled, deletes create a delete marker instead of immediately removing prior versions — accidental deletions are recoverable.

Use versioning for:
- Terraform state files
- critical configuration objects
- user-uploaded content
- backup protection

**Remember:** versions cost storage. Enable lifecycle rules to expire noncurrent versions or you will accumulate unexpected storage costs.

### Lifecycle Rules

Lifecycle rules transition or expire objects automatically:

```text
Application logs example:
  0-30 days:   S3 Standard
  31-180 days: Standard-IA
  181+ days:   Glacier Flexible Retrieval
  365+ days:   Expire (delete)
```

Apply lifecycle rules to **noncurrent versions** when versioning is enabled, or old versions accumulate silently.

### Access Control

Access is controlled through multiple overlapping layers:

1. **IAM identity policies** — what the calling principal can do
2. **Bucket policies** — resource-level policy attached to the bucket
3. **Block Public Access** — account and bucket-level override to prevent public access
4. **Access Points** — named access endpoints with their own policies
5. **ACLs** — legacy; avoid for new designs

**Default habit:** leave Block Public Access enabled unless there is a deliberate, reviewed reason to disable it.

### Encryption

| Mode | Key Control |
|---|---|
| SSE-S3 | S3 manages keys (AES-256); simplest option |
| SSE-KMS | KMS manages keys; adds key policy, rotation, audit trail, and cost |
| SSE-C | Customer provides keys with every request; AWS stores ciphertext only |
| Client-side | App encrypts before upload; AWS sees only ciphertext |

**Operational note:** switching from SSE-S3 to SSE-KMS requires the IAM role to have `kms:GenerateDataKey` for writes and `kms:Decrypt` for reads. This is a common production failure.

### S3 Event Notifications

S3 can send event notifications to Lambda, SQS, SNS, or EventBridge. Use cases include image processing, data ingestion, malware scanning, and indexing pipelines.

---

## VPC Basics

### Why VPC

A VPC is your private network boundary in a Region. It gives you a software-defined data center network with full control over IP ranges, subnets, route tables, gateways, security rules, and connectivity.

### Typical VPC Layout

```text
VPC: 10.0.0.0/16

Public subnets (ALB, NAT Gateways):
  10.0.1.0/24 in AZ A
  10.0.2.0/24 in AZ B

Private app subnets (EC2, ECS, EKS):
  10.0.11.0/24 in AZ A
  10.0.12.0/24 in AZ B

Private data subnets (RDS, ElastiCache):
  10.0.21.0/24 in AZ A
  10.0.22.0/24 in AZ B
```

### Public vs Private Subnets

A subnet is **public** when its route table has a default route (`0.0.0.0/0`) pointing to an Internet Gateway AND instances have public IPs. It is **private** when workloads have no direct inbound path from the internet.

**Common design:**
```text
Public subnet:       ALB, NAT Gateway
Private app subnet:  EC2, ECS tasks, EKS nodes, Lambda ENIs
Private data subnet: RDS, ElastiCache, internal services
```

### Internet Gateway (IGW)

An Internet Gateway is attached to a VPC and enables bidirectional internet communication for resources in public subnets that have public IPs. One IGW per VPC. Without an IGW, no resources in the VPC can reach the public internet directly.

### Route Tables

Route tables decide the next hop for packets. Each subnet is associated with exactly one route table.

```text
Public subnet route table:
  10.0.0.0/16 -> local
  0.0.0.0/0   -> Internet Gateway

Private subnet route table:
  10.0.0.0/16 -> local
  0.0.0.0/0   -> NAT Gateway (for outbound)
  pl-xxxxxx   -> Gateway VPC Endpoint (S3/DynamoDB)
```

### NAT Gateway

NAT Gateway allows private subnet workloads to initiate outbound IPv4 internet connections (for patches, package downloads, container pulls) without becoming publicly reachable inbound.

**Cost warning:** NAT Gateway charges per hour and per GB processed. Private workloads pulling from S3, ECR, CloudWatch Logs, or other AWS APIs through NAT create avoidable cost. Prefer VPC endpoints for AWS services.

**HA note:** NAT Gateways are zonal. Deploy one per AZ so that an AZ failure does not force cross-AZ NAT traffic.

### Security Groups vs NACLs

| Feature | Security Group | NACL |
|---|---|---|
| Attachment | ENI / resource level | Subnet level |
| State | Stateful (return traffic automatic) | Stateless (return traffic explicit) |
| Rules | Allow only | Allow and Deny |
| Evaluation | All rules evaluated | Rules evaluated in order by number |
| Best for | Primary application access control | Coarse subnet boundary guardrails |

**Debug order:** security group path first, then NACL, then route table.

---

## Getting Started Checklist

When creating a new AWS account or workload, these are the baseline controls:

**Account setup:**
- [ ] Enable MFA on root account — never use root for daily operations
- [ ] Enable CloudTrail for audit logging in all Regions
- [ ] Enable AWS Config for resource configuration tracking
- [ ] Set up billing alerts and Cost Anomaly Detection
- [ ] Create separate IAM admin user; disable root access keys if any exist
- [ ] Enable GuardDuty for threat detection

**IAM baseline:**
- [ ] Never use root for daily work
- [ ] Create admin user with MFA instead
- [ ] Use IAM roles for all workloads (EC2, Lambda, ECS, EKS)
- [ ] Avoid creating long-lived access keys
- [ ] Apply least-privilege policies

**Networking baseline:**
- [ ] Create a VPC with public and private subnets in at least 2 AZs
- [ ] Place load balancers and NAT Gateways in public subnets
- [ ] Place compute and databases in private subnets
- [ ] Add gateway VPC endpoints for S3 and DynamoDB
- [ ] Enable VPC Flow Logs for network visibility

**S3 baseline:**
- [ ] Block Public Access enabled by default
- [ ] Versioning enabled for critical buckets
- [ ] Lifecycle rules for cost management
- [ ] Encryption enabled (SSE-S3 minimum)

---

## Cost Basics and Free Tier

### AWS Free Tier

AWS offers free tier benefits for new accounts (12 months for most services, always free for some):

- EC2: 750 hours/month t2.micro or t3.micro (12 months)
- S3: 5 GB standard storage, 20,000 GET requests (12 months)
- RDS: 750 hours/month db.t2.micro Single-AZ (12 months)
- Lambda: 1 million requests/month (always free)
- DynamoDB: 25 GB storage, 25 WCU/RCU (always free)
- CloudWatch: 10 custom metrics, 5 GB log ingestion (always free)

### Cost Awareness Habits

- NAT Gateway is one of the most common surprise costs — use VPC endpoints for AWS services
- EBS volumes continue billing even when the instance is stopped
- Unattached EBS volumes and unused Elastic IPs are silent cost sources
- CloudWatch Logs ingestion and retention add up quickly
- Cross-AZ data transfer incurs fees — co-locate closely coupled services
- Idle load balancers, unused RDS instances, and forgotten resources accumulate

**Tools:** Cost Explorer, AWS Budgets, Cost Anomaly Detection, Trusted Advisor, Compute Optimizer.

---

## Classic Web Architecture Pattern

Starting with one EC2 instance hides every problem: compute, state, files, database, logs, TLS, and deployment on one box. Scaling forces separation.

**Single EC2 (simple but fragile):**
```text
User -> EC2 (app + DB + files all in one)
```

**Production evolution:**
```text
Route 53
  -> CloudFront + WAF       (edge caching, protection)
  -> ALB across 2+ AZs      (stable entry, health routing)
  -> Auto Scaling group      (replacement and scaling)
  -> Private app subnets     (EC2/ECS tasks)
  -> RDS/Aurora Multi-AZ     (relational DB with HA)
  -> S3                      (objects, static files, uploads)
  -> ElastiCache             (session store, hot reads)
  -> CloudWatch              (metrics, logs, alarms)
```

Key principle: once state is externalized — sessions to ElastiCache, files to S3/EFS, relational data to RDS — compute can be replaced safely.

---

## Summary: Core Beginner Principles

1. **Scope matters:** Global vs Regional vs Zonal determines blast radius
2. **IAM is not optional:** every workload needs a least-privilege role, never embedded credentials
3. **Multi-AZ is intentional:** you must design for AZ failure; AWS does not do it automatically
4. **Shared Responsibility:** AWS secures the infrastructure; you secure the workload on top
5. **Private by default:** compute and databases in private subnets; only load balancers in public subnets
6. **S3 is not a filesystem:** it is key-value object storage; design access patterns accordingly
7. **Explicit deny wins:** understanding IAM evaluation logic prevents debugging hell
8. **Cost is a signal:** sudden cost spikes indicate runaway systems; monitor and alert on cost
