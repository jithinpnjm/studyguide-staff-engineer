---
title: "☁️ Cloud Platforms"
sidebar_position: 4
description: "Zero to hero study guide for Cloud Platforms — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

Cloud platforms (AWS, GCP, Azure) are the infrastructure substrate for nearly all modern systems. As a Staff/Principal SRE, you don't just use cloud services — you make architectural decisions that determine reliability, cost, security, and scalability for the entire organization. A wrong choice in cloud architecture compounds for years.

Business outcomes:
- **Cost** — cloud bills are often the largest infrastructure expense; Staff engineers can reduce them 30-60% through right architecture choices
- **Reliability** — multi-AZ/region design, managed service selection, and proper IAM are the difference between 99.9% and 99.99% uptime
- **Security** — misconfigured S3 buckets and IAM policies are the leading causes of cloud breaches
- **Speed** — managed services dramatically reduce time-to-market vs self-managed equivalents

---

## 📋 Prerequisites & Mental Models

**Shared responsibility model** — cloud provider is responsible for security OF the cloud (hardware, facilities, hypervisor). You are responsible for security IN the cloud (OS patches, IAM, data encryption, network config).

**Think in failure domains** — AZ, region, and global. Design so a single AZ failure (happens monthly) doesn't cause an outage. Design so a region failure (rare) is survivable. Consider RTO/RPO requirements carefully before adding global complexity.

**Managed services cost more per unit, save more in operations** — RDS costs 3x a self-managed Postgres on the same hardware but eliminates your DBA toil. Right trade-off for most teams.

**IAM is your security perimeter** — network boundaries matter less when everything is a managed API. IAM policies are the primary access control mechanism in the cloud.

---

## 🔷 Core Concepts

### AWS Core Services

**Compute:**
- **EC2** — virtual machines. Choose instance family by workload: general (m-series), compute (c-series), memory (r-series), GPU (p/g-series). Spot instances: 70-90% discount, can be interrupted 2 minutes notice. Reserved Instances / Savings Plans: 30-60% discount for committed usage.
- **Lambda** — serverless functions. Event-driven, auto-scales to zero. Max 15 min runtime, 10GB memory. Cold start is real (50ms-5s depending on runtime+package size). Use Provisioned Concurrency for latency-sensitive functions.
- **ECS Fargate** — serverless containers. Pay per vCPU/memory per second. No node management. Limited networking control vs EKS.
- **EKS** — managed Kubernetes control plane. You still manage node groups. Use managed node groups + Karpenter for operational simplicity.

**Storage:**
- **S3** — object storage. 11 nines durability. Fundamentally a key-value store with HTTP API. Storage classes: Standard, Standard-IA (infrequent access, 30-day minimum), One Zone-IA, Glacier Instant/Flexible/Deep Archive. S3 Intelligent-Tiering auto-moves objects between tiers based on access patterns.
- **EBS** — block storage for EC2. Attached to one instance (except Multi-Attach io2). Types: gp3 (general, configurable IOPS independently of size), io2 (high IOPS, critical databases), st1 (throughput-optimized HDD for sequential workloads), sc1 (cold HDD, lowest cost).
- **EFS** — managed NFS. Multi-AZ, shared across multiple EC2/containers. 3x more expensive than S3 for same data, but provides POSIX filesystem semantics.

**Database:**
- **RDS** — managed relational databases (PostgreSQL, MySQL, MariaDB, Oracle, SQL Server). Multi-AZ: synchronous standby, auto-failover in <60s. Read replicas: async replication for read scaling.
- **Aurora** — AWS-reimplemented MySQL/PostgreSQL. Storage auto-scales. Aurora Serverless v2: scales capacity in fine-grained increments. ~5x faster than MySQL, 3x faster than PostgreSQL for many workloads. Aurora Global Database: sub-second replication across regions.
- **DynamoDB** — managed NoSQL (key-value + document). Single-digit millisecond latency. Scales automatically. On-demand or provisioned capacity. Global Tables for multi-region active-active. DynamoDB Streams for change data capture.
- **ElastiCache** — managed Redis (recommended) or Memcached. Redis: persistence, replication, Lua scripting, pub/sub, sorted sets. Use for session store, leaderboards, rate limiting, caching.

**Networking:**
- **VPC** — virtual private network. Isolated network with your own IP address range. Subnets: public (internet-facing, has IGW route), private (no direct internet access, uses NAT Gateway for egress).
- **Security Groups** — stateful firewalls at the instance/ENI level. Default deny. Allow inbound/outbound rules.
- **NACLs** — stateless firewalls at the subnet level. Rules evaluated in order, explicit allow and deny. Use sparingly — SGs are usually sufficient.
- **ALB (Application Load Balancer)** — L7, HTTP/HTTPS routing, path-based and host-based rules, WebSocket support, HTTP/2, connection draining. Use for microservices.
- **NLB (Network Load Balancer)** — L4, ultra-low latency, static IPs, TCP/UDP/TLS. Use for high-throughput non-HTTP traffic, or when you need static IPs for whitelisting.
- **Route 53** — DNS + health checks + routing policies (latency-based, failover, geolocation, weighted).
- **CloudFront** — CDN. Cache static assets at 400+ edge locations. Lambda@Edge for dynamic content manipulation at edge. Use with S3 origin for static site hosting.
- **Transit Gateway** — hub-and-spoke network routing. Connect multiple VPCs and on-premise. Replaces complex VPC peering meshes.

**IAM:**
- **Users** — human identities. Use only with MFA. Prefer SSO (AWS SSO / Identity Center) over IAM Users in organizations.
- **Roles** — assumed by services, EC2 instances, Lambda, cross-account. No long-lived credentials. Core mechanism for service-to-service auth.
- **Policies** — JSON documents defining allowed/denied actions on resources. Evaluation logic: explicit deny > explicit allow > implicit deny.
- **IAM best practices:** root account with MFA + no access keys, every service gets its own role with minimum permissions, use `aws:RequestedRegion` and `aws:SourceVpc` conditions to restrict scope, rotate access keys if you must have them.

### GCP Core Services

- **Compute Engine** — VMs, similar to EC2. Sustained use discounts automatic (no commitment needed).
- **GKE** — managed Kubernetes, considered the gold standard. Autopilot mode: fully managed nodes.
- **Cloud Run** — serverless containers, scales to zero, HTTP-triggered. Superior to Lambda for containerized workloads.
- **Cloud Storage** — GCS, object storage equivalent to S3.
- **Cloud SQL** — managed PostgreSQL/MySQL/SQL Server.
- **BigQuery** — serverless data warehouse, columnar storage, SQL interface, scales to petabytes. Key differentiator vs AWS (Redshift is more complex).
- **Cloud Spanner** — globally distributed relational database with external consistency. Expensive but unique capability.
- **Cloud IAM** — resource-based IAM with Workload Identity Federation for CI/CD.
- **VPC** — global (spans regions, unlike AWS where VPC is regional).

### Azure Core Services

- **Virtual Machines** — Azure VMs. B-series for burstable workloads.
- **AKS** — managed Kubernetes. Integrated with Azure AD for RBAC.
- **Azure Container Apps** — serverless containers, competitive with Cloud Run.
- **Azure Storage** — Blob (object), File (NFS/SMB), Queue, Table.
- **Azure SQL Database / PostgreSQL Flexible Server** — managed relational databases.
- **Cosmos DB** — globally distributed NoSQL, multiple consistency models (strong to eventual).
- **Azure AD / Entra ID** — identity platform. Deeply integrated with AKS, Azure DevOps. OIDC federation for CI/CD.
- **Azure Firewall / NSG** — network security at subnet and resource level.

---

## 🛠️ Tools & Ecosystem

| Tool | Purpose |
|------|---------|
| AWS CLI / Cloud SDK | Command-line access |
| Terraform / Pulumi | Infrastructure as Code across clouds |
| AWS CDK / Pulumi | Programmatic IaC |
| AWS Config | Resource inventory + compliance rules |
| CloudTrail | API audit log — who did what, when |
| GuardDuty | Threat detection (anomalous IAM, network) |
| Security Hub | Aggregated security findings |
| Cost Explorer | Spend analysis and forecasting |
| AWS Compute Optimizer | Right-sizing recommendations |
| Prowler / ScoutSuite | Cloud security posture assessment |
| Steampipe | SQL queries on cloud resources |

---

## 🏗️ Architecture Patterns

### Multi-AZ High Availability

Minimum for production: deploy across 2 AZs (3 preferred). Checklist:
- EC2 / EKS: nodes spread across AZs, topology spread constraints
- RDS: Multi-AZ enabled (synchronous standby)
- ElastiCache: Multi-AZ with automatic failover
- ALB: spans AZs automatically
- EFS/EBS: EFS is multi-AZ; EBS is single-AZ (replicate critical data with application-level replication or use EFS)

### Multi-Region Active-Passive

Primary region serves traffic. Secondary region has warm standby (data replicated, infrastructure provisioned but idle). Failover: Route 53 health check detects primary failure, switches DNS to secondary.

Use for: RTO <1 hour, RPO <15 minutes requirements.

### Multi-Region Active-Active

Both regions serve traffic simultaneously. Traffic split by geography (Route 53 latency routing) or application logic. Data: DynamoDB Global Tables, Aurora Global Database, or Kafka cross-region replication.

Use for: global user base, RTO near-zero, highest cost and complexity.

### Landing Zone Design

Enterprise AWS account structure:
```
Management Account (billing, Organizations)
├── Security OU
│   ├── Log Archive Account (CloudTrail, Config, VPC Flow Logs centralized)
│   └── Security Tooling Account (GuardDuty master, SecurityHub aggregator)
├── Infrastructure OU
│   ├── Network Account (Transit Gateway, shared VPCs)
│   └── Shared Services Account (ECR, Route 53 private zones)
├── Workloads OU
│   ├── Production Account
│   ├── Staging Account
│   └── Development Account
└── Sandbox OU (individual developer accounts)
```

Use AWS Control Tower or Terraform Landingzone to automate account provisioning with baseline guardrails.

### Cost Optimization Architecture

- **Compute:** Spot for stateless/batch (70-90% savings), Reserved/Savings Plan for baseline load (30-60%), On-demand for burst
- **Storage:** S3 Intelligent-Tiering for unknown access patterns, Lifecycle policies to move to Glacier after N days
- **Data transfer:** CloudFront eliminates outbound transfer costs for static/cacheable content; VPC endpoints eliminate NAT Gateway charges for AWS services
- **RDS:** Aurora Serverless for variable/dev workloads, Reserved for stable production

---

## ⚙️ Production Operations

### IAM Hardening at Scale

- Use AWS Organizations SCPs (Service Control Policies) to deny dangerous actions across all accounts: `ec2:DeleteVpc`, `cloudtrail:DeleteTrail`, `s3:DeleteBucketPolicy`
- Permission boundaries on user-created roles — limits what they can escalate to
- AWS IAM Identity Center (SSO) for human access — no IAM users, no access keys for humans
- IRSA (IAM Roles for Service Accounts) for EKS pods — Pod-level IAM, not node-level
- Resource-based policies (S3 bucket policies) + identity-based policies — both must allow

### Cost Management

Track these metrics weekly:
- Spend per service (Cost Explorer by service)
- Spend per team (tag-based allocation — enforce tags via Config rules)
- EC2 coverage by Savings Plan (target >70%)
- Data transfer costs (often hidden and large)

Act on:
- Idle resources: Compute Optimizer flags underutilized EC2, RDS
- Orphaned volumes: EBS volumes not attached to instances
- Old snapshots: automate cleanup with Lifecycle Manager
- NAT Gateway: consider VPC endpoints for S3/DynamoDB (free alternative)

### Networking Operations

VPC design decisions that matter:
- IP address planning: use large CIDR blocks (/16) per VPC — IP exhaustion is painful to fix
- VPC peering vs Transit Gateway: peering for few VPCs, TGW for 5+ (peering is non-transitive)
- Private subnets for all compute, public subnets only for load balancers and NAT Gateways
- VPC Flow Logs: enable in all VPCs, ship to S3 or CloudWatch Logs for security analysis

---

## 📊 Observability & Debugging

### Key Cloud Metrics

```
AWS:
- EC2: CPUUtilization, NetworkPacketsIn, StatusCheckFailed
- RDS: DatabaseConnections, ReadLatency, WriteLatency, FreeStorageSpace
- ALB: HTTPCode_Target_5XX_Count, TargetResponseTime, HealthyHostCount
- Lambda: Errors, Duration, Throttles, ConcurrentExecutions
- DynamoDB: ConsumedReadCapacityUnits, SystemErrors, SuccessfulRequestLatency

GCP:
- GCE: instance/cpu/utilization, instance/disk/read_bytes_count
- Cloud Run: request_count, request_latencies, container/cpu/utilization

Azure:
- VM: Percentage CPU, Network In/Out, Disk Operations/Sec
- AKS: node_cpu_usage_percentage, kube_pod_status_ready
```

### Debugging Production Issues

**EC2 unreachable:**
1. Check Security Group — is SSH/SSM port open?
2. Check NACL — stateless, both inbound and outbound rules needed
3. Check route table — public subnet has route to IGW?
4. Check instance state in EC2 console — system status check vs instance status check

**RDS connection timeout:**
1. Security Group: RDS SG must allow inbound from EC2/Lambda SG
2. VPC: is the connecting resource in the same VPC (or peered)?
3. Subnet group: RDS in private subnet, Lambda in same VPC with private subnet config
4. Parameter group: `max_connections` limit reached?

**Lambda timeout / cold start:**
1. Package size matters: <50MB zip for fast cold start
2. Provisioned Concurrency for P99 latency requirements
3. Lambda in VPC adds cold start (ENI attachment); avoid VPC if not needed
4. Memory also increases CPU: doubling memory often halves execution time

---

## 🔐 Security Considerations

### The AWS Security Baseline

Every account, day one:
- [ ] Root account MFA enabled, access keys deleted
- [ ] CloudTrail enabled in all regions, centralized to Log Archive account
- [ ] GuardDuty enabled in all regions
- [ ] Config enabled with core rules (required-tags, restricted-ssh, mfa-enabled-for-iam-users)
- [ ] S3 Block Public Access enabled account-wide
- [ ] Password policy: 14+ chars, MFA required for console

### IAM Least Privilege in Practice

Start with `ReadOnlyAccess`, add permissions when access denied, document why each permission exists. Use `aws:CalledVia` condition to restrict which services can be called through (e.g., CloudFormation can assume role but humans cannot directly).

```json
{
  "Effect": "Allow",
  "Action": "iam:PassRole",
  "Resource": "arn:aws:iam::*:role/AppRole-*",
  "Condition": {
    "StringEquals": {
      "iam:PassedToService": "ec2.amazonaws.com"
    }
  }
}
```

### Data Protection

- S3: SSE-S3 (free), SSE-KMS (audit trail per key access), SSE-C (you manage keys)
- RDS: encryption at rest enabled at creation (cannot enable after)
- EBS: encrypted by default via account setting
- In-transit: TLS everywhere, ACM certificates, enforce HTTPS with S3 bucket policy

---

## 🎓 Staff/Principal Engineer Perspective

### Cloud Architecture Decision Framework

When evaluating managed vs self-managed:
1. What is the operational burden of managing this myself at scale?
2. What features does the managed service lack that I need?
3. What is the vendor lock-in risk and exit cost?
4. What is the total cost of ownership including engineering time?

Managed services win 80% of the time. The 20% exceptions: specific performance requirements, data residency constraints, deep customization needs.

### Multi-Cloud vs Single Cloud

Multi-cloud sounds good, delivers limited benefits:
- Same workload on two clouds = 2x operational complexity, not 2x resilience
- Managed services are not portable (DynamoDB ≠ Firestore ≠ Cosmos DB)
- Reserved/Savings Plan discounts require commitment to one cloud

Legitimate multi-cloud: different teams using the cloud that best fits their workflow (GCP for ML/BigQuery, AWS for everything else). Avoid: running the same workload across clouds for "resilience."

### FinOps Culture

Cost visibility → cost accountability → cost optimization. Without visibility, nobody optimizes. Tag enforcement via Config or landing zone → showback dashboards per team → chargeback if needed.

Top 5 cost reduction levers (in order of impact):
1. Savings Plans / Reserved Instances for baseline compute
2. Spot instances for stateless/batch workloads
3. Rightsize overprovisioned EC2/RDS (Compute Optimizer)
4. S3 lifecycle policies to Glacier
5. Eliminate idle resources (weekly review)

---

## 💥 Failure Modes & Incident Patterns

**AZ outage (happens multiple times per year):**
Single-AZ deployment = full outage. Multi-AZ deployment = seamless failover (RDS <60s, EC2 behind ALB automatic). Design for AZ failure as the normal case, not the edge case.

**IAM permission escalation:**
A developer with `iam:CreateRole` and `iam:AttachRolePolicy` can give themselves any permissions. Use permission boundaries and SCPs to constrain what can be created. Audit with IAM Access Analyzer.

**S3 bucket data leak:**
Bucket policy allows `"Principal": "*"` or public access not blocked. Remediation: enable Block Public Access account-wide (S3 console). Detection: Macie for sensitive data, Config rule `s3-bucket-public-read-prohibited`.

**EC2 Spot interruption:**
Two-minute warning notification via EC2 metadata + EventBridge. Drain gracefully. For Kubernetes: AWS Node Termination Handler watches for interruptions and cordons/drains the node before it's reclaimed.

**DynamoDB hot partition:**
All requests hitting the same partition key. Symptoms: `ProvisionedThroughputExceededException` on one key pattern while overall capacity appears fine. Fix: distribute writes across partition keys, use write sharding (append random suffix to key).

---

## 💼 Interview & Design Review Prep

**"Design a highly available web application on AWS"**
VPC with 3 AZs, public subnets (ALB), private subnets (ECS/EKS, RDS Multi-AZ, ElastiCache), Route 53 + CloudFront, WAF, Aurora with read replicas, S3 for static assets, CloudWatch + X-Ray, IAM roles with IRSA.

**"How do you reduce AWS costs by 40%?"**
Audit spend by service and team, Savings Plans for 70% of baseline compute, Spot for batch/stateless, rightsize with Compute Optimizer, S3 Intelligent-Tiering, eliminate idle EBS volumes, CloudFront to reduce data transfer, reserved capacity for RDS.

**"Walk through IAM evaluation logic"**
Explicit deny (SCP, resource policy, identity policy) → explicit allow (all three must allow for cross-account) → implicit deny. SCPs cannot grant permissions, only restrict. Resource-based policies can grant cross-account without assuming a role.

**"How does S3 achieve 11 nines durability?"**
Data stored redundantly across multiple devices in multiple facilities. Reed-Solomon erasure coding. 99.999999999% durability is a mathematical probability claim based on the redundancy model.

---

## 📚 Key Takeaways

1. **Design for AZ failure** — it's not if, it's when; single-AZ production is technical debt
2. **IAM is your security perimeter** — in the cloud, network boundaries matter less than IAM policies
3. **Managed services win 80% of the time** — operational burden of self-managed compounds over years
4. **Tag everything from day one** — untagged resources cannot be attributed to teams or cost centers
5. **Root account: MFA + no access keys** — root account compromise = game over
6. **CloudTrail is your audit log** — enable in all regions, centralize, never disable
7. **S3 Block Public Access account-wide** — data leaks from public buckets are the leading cloud breach pattern
8. **Savings Plans before optimization** — commit to 70% of baseline before optimizing the rest
9. **VPC design is permanent** — IP exhaustion and poor subnetting cannot be easily fixed later; plan CIDR blocks for 5 years
10. **GuardDuty in every account** — threat detection at the API level catches what network tools miss
11. **IRSA for pod-level IAM** — never give node-level IAM access to sensitive resources; pods should have their own roles
12. **Data transfer costs are hidden** — measure before building; cross-AZ and egress charges are often larger than compute
13. **Multi-cloud = 2x complexity** — legitimately useful when different teams have different best-fit clouds, not for "resilience"
14. **Permission boundaries constrain privilege escalation** — every team that creates IAM roles needs permission boundaries
15. **Cost visibility drives culture** — showback dashboards make teams accountable without policy enforcement



---

## 📁 Source Documents

> 38 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[Interview Ouestions > AWS] 1740481218475](http://localhost:8765/api/documents/6763812a-0c43-459c-9ffb-fd718547d150/view) | PDF | intermediate |
| [[Interview Ouestions > AWS] 1742299190477](http://localhost:8765/api/documents/57f1e37d-b908-4c72-a7f2-b0fdb28e1d6c/view) | PDF | intermediate |
| [[Interview Ouestions > AWS] 1742594468346](http://localhost:8765/api/documents/f3a36d99-543e-4b51-9ecf-15a532e8d884/view) | PDF | intermediate |
| [[Interview Ouestions > AWS] 1742907702778](http://localhost:8765/api/documents/6b4204c9-fdb6-4a16-82ac-1ba7798cbe51/view) | PDF | intermediate |
| [[Interview Ouestions > AWS] 1743213934595](http://localhost:8765/api/documents/259d170c-e42d-4640-a1c9-df3f8a01ec47/view) | PDF | intermediate |
| [[Interview Ouestions > AWS] 1744341582188](http://localhost:8765/api/documents/21b2d4ee-05a0-499e-94d7-6bdec9572199/view) | PDF | beginner |
| [[Interview Ouestions > AWS] 1744528152341](http://localhost:8765/api/documents/12d1ea60-7e79-4170-a97a-5e16d1eaecab/view) | PDF | intermediate |
| [[Cloud] 1741014066651](http://localhost:8765/api/documents/28e3745f-f33d-4adf-9bfd-0dfee031da73/view) | GIF | intermediate |
| [[Cloud] 1742486017920](http://localhost:8765/api/documents/b839cd4d-a1dd-4427-8be1-7a5f5530284f/view) | JPEG | intermediate |
| [[AWS] 1715766666676](http://localhost:8765/api/documents/365845b0-ea5a-40b2-8e47-43fb47107b92/view) | PDF | intermediate |
| [[AWS] 1715777988770](http://localhost:8765/api/documents/1b6aef68-09a4-4b62-b44e-0f572bc42f88/view) | PDF | intermediate |
| [[AWS] 1715841621629](http://localhost:8765/api/documents/4bec8eaa-275c-4691-a2aa-f4c44951eeae/view) | PDF | intermediate |
| [[AWS] 1715853766265](http://localhost:8765/api/documents/c43eab7e-20a3-42f5-a7b5-58218b2cd159/view) | PDF | intermediate |
| [[AWS] 1715931207787](http://localhost:8765/api/documents/20e2f452-4dab-40d1-995b-503dec48b067/view) | PDF | intermediate |
| [[AWS] 1715947755978](http://localhost:8765/api/documents/c6117c5f-a7a3-4dee-acb8-6e11568c2858/view) | PDF | intermediate |
| [[AWS] 1717401305606](http://localhost:8765/api/documents/7aa95fa4-89fe-47ef-9270-9e8aeee45bc5/view) | PDF | intermediate |
| [[AWS] 1739433738237](http://localhost:8765/api/documents/c77c520e-274d-4200-a885-930eb485b020/view) | PDF | intermediate |
| [[AWS] 1740139007494](http://localhost:8765/api/documents/fbeea5e0-2f32-46dd-a693-b964d2df29a2/view) | PDF | intermediate |
| [[AWS] 1741041066379](http://localhost:8765/api/documents/ed112916-cc3a-47bd-a506-2de47ab6be15/view) | PDF | intermediate |
| [[AWS] 1741582799827](http://localhost:8765/api/documents/4e449e98-b5cc-4cae-8b00-ea6e25b6b5a6/view) | PDF | intermediate |
| [[AWS] 1742022228916](http://localhost:8765/api/documents/087c035d-4fc4-44ba-99f7-5d78f26b0d73/view) | PDF | intermediate |
| [[AWS] 1742196859172](http://localhost:8765/api/documents/b2d73887-8bbd-45c2-8405-21d048be8d2c/view) | PDF | intermediate |
| [[AWS] 1742219693416](http://localhost:8765/api/documents/fc7910d9-20fd-401f-9103-e53b0e9a6bee/view) | PDF | intermediate |
| [[AWS] 1742799371457](http://localhost:8765/api/documents/0fa148ba-d7a5-45af-b3a6-0f60bbdf31b4/view) | PDF | intermediate |
| [[AWS] 1743125089007](http://localhost:8765/api/documents/c0deb12f-7197-4344-8052-76810329588a/view) | PDF | intermediate |
| [[AWS] 1743199677628](http://localhost:8765/api/documents/7eee4257-b691-49b4-b764-325ae92df4bc/view) | PDF | intermediate |
| [[AWS] 1743235509575](http://localhost:8765/api/documents/8e57491b-dd67-4ca8-a708-3f11bcc84d47/view) | PDF | intermediate |
| [[AWS] 1743308568084](http://localhost:8765/api/documents/c98a23b4-1e43-45fc-aeae-0ff9d55b14c3/view) | PDF | intermediate |
| [[AWS] 1743432961400](http://localhost:8765/api/documents/c17ec038-1187-4f45-a9d6-b63f3d3e7e65/view) | PDF | intermediate |
| [[AWS] 1743610196964](http://localhost:8765/api/documents/e2652f4f-5fa1-4f76-8806-38ea38e1916f/view) | PDF | intermediate |
| [[AWS] 1743864144477](http://localhost:8765/api/documents/e5133540-df51-499d-91aa-04159a789ab5/view) | PDF | intermediate |
| [[AWS] 1744019595388](http://localhost:8765/api/documents/9c6b828b-0599-4d6a-9793-2d6800aca66d/view) | PDF | intermediate |
| [[AWS] 1744070473484](http://localhost:8765/api/documents/970276c7-9102-439d-a332-780823ef6da7/view) | PDF | intermediate |
| [[AWS] 1745155962198](http://localhost:8765/api/documents/c6ed091c-0f6c-41bf-9f02-8d1783bed142/view) | PDF | intermediate |
| [[AWS Project] 1740891716593](http://localhost:8765/api/documents/ff2dbab1-e2c6-438c-8224-08e4e5343da2/view) | PDF | intermediate |
| [[AWS Project] 1741852152845](http://localhost:8765/api/documents/375178c2-c7e7-4a60-9792-51e286762935/view) | PDF | intermediate |
| [[AWS Project] 1742325702393](http://localhost:8765/api/documents/09615c9f-bbf4-41ac-82c1-034f262f0733/view) | PDF | intermediate |
| [[AWS Project] 1742532545292](http://localhost:8765/api/documents/e71e8051-5618-4b54-b28b-21e057317c3a/view) | PDF | intermediate |


<AIChatWidget domain="cloud-platforms" title="Ask AI about Cloud Platforms" />

---

## [SRE] Foundations: System Design And Cloud Architecture Premium Teaching Guide

## Foundations: System Design And Cloud Architecture Premium Teaching Guide

System design is not a product-name quiz. It is a structured way to turn vague requirements into reliable, secure, scalable, observable, and operable systems.

For SRE and platform engineers, good architecture means the system can survive failure, explain behavior, recover safely, and evolve without heroics.

This guide teaches system design from first principles to senior-level tradeoff thinking.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — requirements, traffic flow, compute, storage, cache, queues.
2. **Intermediate Layer** — load balancing, databases, scaling, async design, observability.
3. **Advanced Layer** — HA, DR, consistency, multi-region, capacity planning, rollout safety.
4. **Production SRE Layer** — slow systems, outages, cost spikes, data failures.
5. **Interview Layer** — explain design tradeoffs clearly.

---

## Memory Palace: Airport And City Grid

| Concept | Analogy | Meaning |
|---|---|---|
| Region | Country hub | Geographic deployment area |
| AZ | Separate terminal | Failure domain |
| VPC | Private campus | Network boundary |
| Subnet | Terminal wing | Segmented network area |
| Load Balancer | Traffic controller | Distributes requests |
| CDN | Local kiosk | Content close to users |
| WAF | Security checkpoint | Edge protection |
| App Fleet | Buses and aircraft | Request-serving capacity |
| Database | Records office | Source of truth |
| Cache | Fast desk | Hot reads |
| Queue | Conveyor belt | Async decoupling |
| Observability | Control tower | Metrics, logs, traces |
| DR Site | Alternate airport | Recovery location |

---

## Beginner Layer: The Senior Design Order

Use this order before naming products:

1. Clarify users and critical journeys.
2. Clarify scale and growth.
3. Clarify latency expectations.
4. Identify the stateful core.
5. Define trust boundaries.
6. Choose compute model.
7. Choose data/cache/queue patterns.
8. Define observability.
9. Define rollout safety.
10. Define HA and DR.
11. Then map to provider services.

Starting with product names creates shallow answers.

---

## Beginner Layer: Requirements Gathering

### Functional

- What does the system do?
- Who are the users?
- What are critical user journeys?
- What data is created/read/updated/deleted?

### Scale

- requests per second?
- read/write ratio?
- geographic distribution?
- peak vs average traffic?

### Reliability

- uptime target?
- degraded mode allowed?
- RTO and RPO?

### Security

- public or private?
- auth model?
- tenant isolation?
- compliance needs?

---

## Beginner Layer: Think In Traffic Paths

```text
DNS -> CDN/WAF -> Load Balancer -> App Fleet -> Cache -> Database
                                      -> Queue -> Workers
Telemetry -> Metrics / Logs / Traces
```

Explain one request from user to data and back.

---

## Beginner Layer: Stateless Edge And Stateful Core

### Stateless Edge

- web/API servers
- workers
- gateways
- containers

Easy to scale and replace.

### Stateful Core

- databases
- object stores
- queues with durable state
- identity stores

Hardest to migrate and fail over.

Senior rule:

> Identify the stateful core early.

---

## Intermediate Layer: Compute Choices

| Model | Good For | Tradeoff |
|---|---|---|
| VM | OS control, legacy apps | More ops burden |
| Containers | Many services, portability | Platform complexity |
| Serverless | Bursty/event workloads | Runtime limits |
| Managed PaaS | Common app patterns | Less deep control |
| Batch | Offline jobs | Queue/failure design |

Choose the smallest platform that meets constraints.

---

## Intermediate Layer: Data Layer Choices

| Need | Typical Choice |
|---|---|
| Transactions | Relational DB |
| Key-value low latency | NoSQL |
| Hot reads | Cache |
| Search | Search index |
| Files | Object storage |
| Async events | Queue or stream |

Ask about consistency, query patterns, backup model, and failover expectations.

---

## Intermediate Layer: Cache Design

Caching improves latency and reduces backend load.

Patterns:

- cache-aside
- read-through
- write-through
- TTL cache
- CDN edge cache

Risks:

- stale data
- hot keys
- stampedes
- invalidation complexity

---

## Intermediate Layer: Queues And Async Design

Use queues for:

- email sending
- image processing
- payment follow-up steps
- workload smoothing
- retries and decoupling

Monitor:

- queue depth
- age of oldest message
- consumer errors
- dead-letter queue count

Async improves resilience but introduces eventual consistency.

---

## Advanced Layer: Scaling Patterns

### Horizontal Scaling

Add more instances. Best for stateless systems.

### Vertical Scaling

Use larger machines. Simpler but limited.

### Read Replicas

Good for read-heavy systems. Watch lag.

### Partitioning / Sharding

Powerful but complex. Use when simpler paths fail.

### Backpressure

Protect systems with queues, rate limits, circuit breakers, graceful degradation.

---

## Advanced Layer: Consistency Thinking

Common choices:

- strong consistency
- eventual consistency
- read-your-writes
- monotonic reads

Question to ask:

> What happens if users see stale data for 30 seconds?

Payments and identity usually need stronger guarantees than analytics feeds.

---

## Advanced Layer: High Availability

HA survives common failures.

Examples:

- app replicas across AZs
- LB health checks
- multi-AZ database
- redundant gateways
- queue decoupling

Do not claim HA if one hidden dependency is single-AZ.

---

## Advanced Layer: Disaster Recovery

DR handles larger failures.

Ask:

- RTO?
- RPO?
- backups tested?
- failover manual or automatic?
- failback plan?

DR without restore testing is hope, not design.

---

## Advanced Layer: Observability And Rollout Safety

Design observability upfront:

- request rate
- error rate
- p95/p99 latency
- saturation
- dependency latency
- queue depth
- deploy markers
- traces

Design change safety too:

- canary
- blue-green
- feature flags
- backward-compatible migrations
- fast rollback path

Architecture is incomplete without the delivery story.

---

## Production SRE Layer: Real Incidents

### API Slow Worldwide

Do not blindly add app servers.

Check:

- p99 latency
- DB latency
- cache hit rate
- dependency latency
- routing issues

### One Region Down

- shift critical traffic
- understand data consistency impact
- preserve core journeys first
- communicate degraded mode

### Cost Explosion

Likely causes:

- data transfer
- idle compute
- oversized databases
- logs ingestion

### Database Bottleneck

Options:

- optimize queries
- indexes
- cache reads
- read replicas
- partition only if needed

---

## Common Anti-Patterns

Avoid:

- choosing Kubernetes for everything
- public databases
- no rollback path
- no queue for bursty async work
- single-AZ hidden dependency
- average-only latency dashboards
- no restore testing
- product names before requirements

---

## Interview Layer: Strong Answers

### How do you start a design?

> I clarify user journeys, scale, latency, availability, data consistency, and trust boundaries before selecting services.

### SQL vs NoSQL?

> I choose based on transaction guarantees, query patterns, scale profile, and operational constraints.

### HA vs DR?

> HA survives common component failures. DR restores service after larger outages or data loss.

### Why include rollback in design?

> Because systems change constantly. A design that cannot change safely is incomplete.

---

## Labs

### Beginner

1. Draw request path for a web app.
2. Identify stateful core.
3. Choose compute model.

### Intermediate

1. Add cache layer with invalidation strategy.
2. Add queue for async emails.
3. Design dashboard metrics.

### Advanced

1. Multi-region failover plan.
2. RTO/RPO worksheet.
3. Canary rollout design.
4. Cost optimization review.

---

## Memory Review

- Why identify the stateful core early?
- Why does adding app servers not fix every latency issue?
- Why can queues improve resilience?
- Why is RTO different from RPO?
- Why should design answers include rollback?

---

## Senior Summary

> I start with requirements and traffic paths, identify the stateful core early, scale stateless layers horizontally, use cache and queues where they reduce risk, and include observability, rollout safety, HA, DR, and cost controls before mapping the design to specific cloud services.

---

## [SRE] Cloud Design Lab 1: GCP Public Platform

## Cloud Design Lab 1: GCP Public Platform

### Scenario

Design a public production platform on GCP for a customer-facing API product with global users.

Requirements:
- global users, read-heavy traffic with some write APIs
- public DNS with low-latency resolution
- CDN for cacheable content
- WAF and DDoS protection at the edge
- L7 load balancing
- stateless API tier on GKE or Cloud Run (your choice, justify it)
- private relational database with no public exposure
- Pub/Sub for async work
- centralized logs, metrics, traces, and alerting
- high availability with zonal failure tolerance
- secure CI/CD and rollout controls

---

### Prerequisites

Before attempting this lab, review:
- GCP networking: VPC, subnets, firewall rules, private service access
- Cloud Load Balancing (external HTTPS), Cloud CDN, Cloud Armor
- GKE cluster architecture (node pools, zones, workload identity)
- Cloud Run (regional, private vs public ingress)
- Cloud SQL (private IP, failover replicas, connection pooling via Cloud SQL Auth Proxy)
- Pub/Sub (topics, subscriptions, dead-letter topics)
- Cloud Monitoring, Cloud Logging, Cloud Trace
- Binary Authorization and Cloud Deploy

Estimated time: 90-120 minutes for a first attempt. 45 minutes if you have designed cloud platforms before.

---

### How to Think About This

Do not start by drawing boxes. Start by answering these questions in order. Each layer depends on the one before it.

**Step 1 — Clarify what is public and what is private.**
The scenario says "public platform." That does not mean everything is public. Only the edge should be public. Ask yourself: which IP addresses should be reachable from the internet? The answer should be very short: the external load balancer IP, and optionally a CDN/WAF IP. Everything else should be private.

**Step 2 — Trace the request path from a user's device to the database.**
Walk through every hop: DNS resolution, CDN cache hit or miss, WAF rule check, load balancer, ingress or API gateway, application pod, cache lookup, database query. Write this as a numbered list before you draw anything. This reveals where latency comes from and where you can insert controls.

**Step 3 — Separate stateless from stateful.**
Mark every component as stateless (can be restarted or scaled horizontally without losing data) or stateful (holds durable data that must survive failure). Stateless components are cheap to run in multiple zones. Stateful components are where HA gets hard.

**Step 4 — Define your failure domains.**
A zone failure means one GCP zone goes down. A region failure means all zones in a region go down. A shared dependency failure means something like Cloud SQL or Pub/Sub has a service-level problem. For each failure type, answer: what degrades, what stays up, what data is at risk?

**Step 5 — Layer in security from the outside in.**
At the edge: what stops bad traffic before it hits compute? In the application layer: how do services identify each other? At the data layer: how do workloads connect to the database without static credentials?

**Step 6 — Add the delivery and observability glue.**
How does a new version get deployed safely? What signals tell you something is wrong before users notice? What does the on-call engineer look at first when they get paged?

---

### Building Blocks Available

| Component | What it does |
|---|---|
| Cloud DNS | Authoritative DNS with anycast routing; can respond differently by location |
| Cloud CDN | Caches responses at Google's edge PoPs; reduces origin load and latency for cacheable paths |
| Cloud Armor | Layer 7 WAF and DDoS protection; evaluates rules before requests hit your compute |
| External HTTPS Load Balancer | Global Anycast L7 LB; terminates TLS; routes to backends by path/header |
| GKE (Google Kubernetes Engine) | Managed Kubernetes; multi-zone node pools; works with Workload Identity |
| Cloud Run | Serverless containers; auto-scales to zero; per-request billing; simpler operational model |
| Cloud SQL | Managed PostgreSQL/MySQL; supports private IP; failover replicas; read replicas |
| Cloud Memorystore | Managed Redis or Memcached; private networking only |
| Pub/Sub | Managed message queue; durable; push or pull delivery; dead-letter topic support |
| Workload Identity | Binds a Kubernetes service account to a GCP IAM service account; eliminates static keys |
| Cloud SQL Auth Proxy | Sidecar that handles encrypted, IAM-authenticated connections to Cloud SQL |
| Artifact Registry | Stores and signs container images; integrates with Binary Authorization |
| Binary Authorization | Policy that blocks deployments unless images have attestations from trusted builders |
| Cloud Deploy | Managed progressive delivery; supports canary and blue/green rollout pipelines |
| Cloud Monitoring | Metrics, SLOs, alerting; integrates with GKE and Cloud Run natively |
| Cloud Logging | Structured log ingestion; query with Log Explorer; export to BigQuery for analysis |
| Cloud Trace | Distributed tracing; auto-instrumented with Cloud Run; manual SDK for GKE |
| Secret Manager | Stores API keys, DB passwords; access controlled by IAM; audit-logged |

---

### Beginner Starter Skeleton

This is roughly 30-40% of a complete answer. Use it to get started, then expand each section.

#### Assumptions I Would Clarify First

- Traffic is globally distributed, mostly read-heavy
- p99 latency matters for API responses
- Zonal loss should cause no more than brief degradation, not full outage
- All database writes must be consistent; I will not attempt active-active multi-region writes initially
- The team has the operational capacity to run GKE (if not, Cloud Run would be the starting point)

#### High-Level Request Path

```
User
  -> Cloud DNS (resolves api.example.com)
  -> Cloud CDN (cache hit: return immediately; cache miss: continue)
  -> Cloud Armor (WAF rules, rate limiting, DDoS mitigation)
  -> External HTTPS Load Balancer (TLS termination, L7 routing)
  -> GKE Ingress / Cloud Run (stateless API pods, multi-zone)
  -> [Cache lookup via Memorystore for read-heavy paths]
  -> Cloud SQL (private IP, primary in region, failover replica in another zone)
  -> Pub/Sub (for async side effects, e.g., notifications, audit events)
  -> Worker pods/Cloud Run services (consume from Pub/Sub)
```

#### Network Boundaries

- Public: only the external load balancer IP
- Private application tier: GKE nodes in private subnet, no external IPs
- Private data tier: Cloud SQL on private IP, Memorystore on private IP
- All subnets within a single VPC; use VPC firewall rules to restrict east-west traffic

#### Stateless vs Stateful

Stateless (easy to scale and replace):
- API pods on GKE
- Pub/Sub consumer workers
- Ingress/gateway layer

Stateful (where HA gets hard):
- Cloud SQL — primary + failover replica across zones
- Memorystore — if used for warm cache, treat as soft state, design for cold start
- Pub/Sub backlogs — messages are durable, but unprocessed backlog is a stateful risk

#### What I Have Not Designed Yet (expand these)

- Exact IAM policy for each service account
- Rollout pipeline stages (canary %, promotion gates)
- Observability dashboard layout and SLO definitions
- CDN cache key design and invalidation strategy
- Regional failover decision tree

---

### Tasks

Complete all of the following. Write prose or annotated lists, not just bullet points. Explain your reasoning for each choice.

1. **Requirements and assumptions** — State your traffic, latency, HA, and security assumptions explicitly. If you assume read-heavy traffic or a specific SLA, say so here.

2. **Edge and traffic path** — Describe every hop from DNS to database. Explain why each layer exists and what happens if it is removed.

3. **Network layout** — Define your VPCs, subnets, and firewall rules. Which resources get public IPs? Which are strictly private? Where do you use Private Service Access?

4. **Stateless versus stateful split** — List every component and classify it. For stateful components, describe your HA mechanism (replica, failover, backup).

5. **Database and async design** — How is Cloud SQL configured for zonal HA? How do you handle connection pooling? What goes to Pub/Sub versus staying in the synchronous path?

6. **Observability architecture** — What metrics, logs, and traces do you collect? What are your SLO definitions? What does the on-call dashboard look like?

7. **Security controls** — Describe your approach at each layer: edge (Cloud Armor), workload identity (Workload Identity + IAM), secrets (Secret Manager), image trust (Binary Authorization).

8. **Rollout and rollback model** — How is a new image built, scanned, attested, and deployed? What is the rollback procedure if a canary shows elevated errors?

9. **Zonal failure behavior** — Walk through what happens, technically and operationally, if zone `us-central1-b` goes down at 2am. What degrades, what is automatic, what requires manual action?

10. **What you would deliberately keep simple** — Name at least two things you chose not to do in this design and explain why.

---

### What a Beginner Answer Looks Like

- Names the key GCP services correctly (GKE, Cloud SQL, Cloud Armor, Pub/Sub)
- Describes a basic request path from user to database
- Understands that the database should be private
- Can explain what Cloud Armor does at a high level
- May not distinguish between zonal and regional failure
- May not address workload identity or delivery pipeline
- Missing: consistency model, CDN cache key design, stateful failover mechanics

### What an Intermediate Answer Looks Like

- Clear public/private boundary; only the LB IP is public
- Correct zonal HA: Cloud SQL failover replica, GKE pods spread across zones
- Understands Workload Identity and why static keys are a risk
- Addresses CDN caching including cache invalidation and what should not be cached
- Includes SLOs with concrete latency and availability targets
- Can explain a basic rollout with progressive delivery and rollback
- Missing: p99 latency budget breakdown, shallow health signal problem, regional failover tradeoffs

### What a Strong Answer Looks Like

- Opens by naming the stateful core and why it defines most HA complexity
- Explicit latency budget: DNS + TLS + CDN + LB + app + DB, with target numbers
- Addresses the shallow health signal problem: a zone can pass platform health checks while degrading real traffic
- CDN cache key design and invalidation are thought through
- Clearly states when regional failover is automatic vs manual, and what data risk exists
- Justifies GKE vs Cloud Run with specific tradeoffs relevant to this scenario
- Delivery pipeline: immutable images, digest-pinned, attested, binary authorization enforced
- Incident example walks through concrete actions, not generic steps
- Names two or three things deliberately not built, with reasoning

---

### Interviewer Pressure Questions

Be ready for these follow-ups. They are designed to test depth beyond the happy path.

- Why GKE over Cloud Run here? What changes in your answer if you choose Cloud Run instead?
- What is exactly public and exactly private in your design? Point to each component.
- Where does TLS terminate? What happens to encryption between the LB and your pods?
- How do you avoid Cloud SQL becoming the real single point of failure even with a failover replica?
- What if Cloud CDN caches a response that is stale or contains private data?
- What if one zone looks healthy to platform health checks but is actually degraded for real user traffic? How do you detect and respond to that?
- Your API pods scaled up fast during a traffic spike. How does Cloud SQL handle the connection surge?
- Walk me through your rollback procedure assuming a bad deploy is caught at 5% canary traffic.
- How does a new engineer get credentials to access Cloud SQL in production right now, at 2am during an incident?

---

### Deliverable Guidance

Your final answer should contain:

**Architecture diagram** (hand-drawn or diagramming tool):
- Show: DNS -> CDN -> Cloud Armor -> LB -> GKE/Cloud Run -> Cloud SQL + Pub/Sub
- Mark which resources are public (external IP) and which are private (no external IP)
- Show zone distribution for GKE node pools and Cloud SQL

**One-page reasoning document** covering:
- Your assumptions
- Why you chose GKE or Cloud Run
- How zonal HA works for each stateful component
- Your edge security model
- Your delivery pipeline in 4-5 steps

**Incident note for zonal degradation** covering:
- What you observe (signals, metrics, alerts)
- What is automatic (LB health checks routing around the zone)
- What you validate (other zones have enough capacity, DB is healthy)
- What you communicate (user impact, mitigation, next update)

---

### What to Study Next

After completing this lab:
- Lab 2: same platform, no public exposure — how does the design change?
- Lab 3: rebuild this for AWS — which choices translate, which do not?
- Reference answer is at `reference-answer-gcp-public-platform.md` — compare after your own attempt
- Deep dives: Cloud SQL connection pooling with PgBouncer or Alloy DB, Binary Authorization policy design, CDN cache key strategies

---

## [SRE] Cloud Design Lab 2: Private Internal Platform

## Cloud Design Lab 2: Private Internal Platform

### Scenario

Design an internal developer platform for private services, internal dashboards, and event-driven workers. There is no public-facing product here — this is the platform that internal engineering teams use to build and run their own services.

Requirements:
- no public internet exposure for core services
- private DNS and internal service discovery
- internal load balancing only
- GKE and Cloud Run both available — justify where you use each
- Cloud SQL or equivalent relational store
- Pub/Sub or queue-based async processing
- strong identity and least privilege for both humans and workloads
- centralized observability
- safe multi-team platform guardrails without the platform team becoming a blocker

---

### Prerequisites

Before attempting this lab, review:
- GCP VPC fundamentals: private subnets, Cloud NAT, Private Google Access, Private Service Access
- Cloud DNS with private zones and internal DNS forwarding
- Internal load balancing (Internal HTTP(S) LB vs Internal TCP/UDP LB)
- GKE: private clusters (no public node IPs), node pool design, Workload Identity
- Cloud Run: private ingress (no public traffic), VPC connector or Direct VPC egress
- Cloud SQL private IP and IAM authentication
- Cloud IAP (Identity-Aware Proxy) for BeyondCorp-style internal access
- GCP IAM: service accounts, IAM conditions, resource hierarchy (org -> folder -> project)
- Cloud Monitoring and Cloud Logging

Estimated time: 90 minutes for a first attempt. Less if you have operated GKE private clusters before.

---

### How to Think About This

This lab looks simpler than Lab 1 because there is no public internet. It is not simpler. The access model is harder because you must define who can reach what, and how, without defaulting to "put it on the internet." Work through these questions before designing anything.

**Step 1 — Define what "no public exposure" actually means.**
It is easy to say "private." It is harder to enforce it. Where do engineer laptops connect from? What about CI/CD pipelines? Does "no public exposure" mean no external IPs on any resource, or does it mean no resources reachable from the internet without authentication? These are different requirements with different designs.

**Step 2 — Solve the human access problem first.**
Engineers need to reach internal dashboards, run kubectl commands, query databases during incidents, and view logs. If your platform is fully private, how do they do any of that safely? The answer shapes your entire identity model. Common patterns: Cloud IAP + Identity-Aware Proxy, a corporate VPN with tunnel to GCP, or a bastion host. Each has tradeoffs you should be able to articulate.

**Step 3 — Separate the control plane from the data plane.**
The control plane is how the platform is managed (GKE API server, CI/CD pipelines, IAM changes, deployment approvals). The data plane is the runtime traffic between services. These have very different access patterns, risk profiles, and audit requirements. Design them explicitly and separately.

**Step 4 — Define the identity model for workloads.**
In a private platform, workload-to-workload trust matters as much as human access. Which services can talk to which other services? What credential proves that a GKE pod is the legitimate order-processing service and not a compromised container that found a credential? Workload Identity + IAM bindings answer this — but only if you design the policy carefully.

**Step 5 — Decide where GKE vs Cloud Run fits.**
In a private platform you have both available. Long-running stateful workers, services needing cluster-level configuration, or platform-operator workloads belong in GKE. Stateless internal APIs and event-driven functions that run per-request work well in Cloud Run with private ingress. Be explicit about why you put each workload where.

**Step 6 — Design your egress strategy.**
Even a fully private platform needs outbound internet access for some things: pulling OS patches, calling external APIs, accessing external services. How do you allow that without creating open egress paths? Cloud NAT plus strict firewall rules is the common answer — but you should know its limits (it does not filter by destination by default).

**Step 7 — Define your blast radius per team boundary.**
If one team's workload is compromised, what does an attacker have access to? Shared VPCs, shared GKE clusters, and shared Cloud SQL instances all expand blast radius. Separate projects, workload-specific service accounts, and narrow IAM policies shrink it. The tradeoff is operational complexity for the platform team.

---

### Building Blocks Available

| Component | What it does |
|---|---|
| Private GKE Cluster | GKE cluster where nodes have no public IPs; API server can be private or limited-public |
| Cloud Run (private ingress) | Cloud Run service where only internal traffic can invoke it; no external URL served |
| Internal HTTP(S) LB | L7 load balancer with internal IP only; routes traffic between services inside the VPC |
| Internal TCP/UDP LB | L4 internal load balancer; useful for services that need non-HTTP protocols |
| Cloud DNS (private zones) | Internal-only DNS zones visible only inside your VPC; service discovery for internal names |
| Cloud IAP | Identity-Aware Proxy; enforces user identity before proxying to internal apps; enables zero-trust access without a VPN |
| Cloud NAT | Outbound-only internet access for resources without public IPs; no inbound allowed |
| VPC Service Controls | Perimeter-based access control to prevent data exfiltration from GCP managed services |
| Private Service Access | Private connectivity to Google managed services (Cloud SQL, Memorystore) without public IPs |
| Cloud SQL (private IP) | Managed database reachable only via internal IP; workloads use Cloud SQL Auth Proxy |
| Workload Identity | Binds Kubernetes service account to GCP IAM service account; workloads get GCP credentials without static keys |
| Cloud SQL Auth Proxy | Sidecar that handles IAM-authenticated, encrypted Cloud SQL connections from pods |
| Shared VPC | One VPC network shared across multiple GCP projects; centralizes network policy |
| Cloud Armor (internal) | Can be attached to Internal HTTP(S) LB to apply WAF rules for internal traffic if needed |
| Cloud Monitoring | Metrics, alerting, SLOs; platform teams can create shared dashboards per team |
| Cloud Audit Logs | Logs who did what to GCP resources; required for compliance; includes data access logs |
| Secret Manager | Centralized secrets storage; IAM-controlled; audit-logged; no secrets in environment variables |
| Binary Authorization | Deploy-time policy enforcement; works for internal delivery pipelines too |

---

### Beginner Starter Skeleton

This is roughly 30-40% of a complete answer. Expand every section.

#### Assumptions I Would Clarify First

- "Private" means no external IPs on application resources and no routes from the public internet to internal services
- Engineers access internal dashboards from corporate laptops via IAP or VPN
- Multiple teams share the platform; each team has its own namespace in GKE and its own Cloud Run service identity
- The platform team provides shared infrastructure (GKE cluster, Cloud SQL, Pub/Sub) but teams manage their own application configs
- Egress to the internet is allowed for patching and approved external APIs, but is controlled via Cloud NAT

#### Internal Access Model for Humans

```
Engineer laptop (corporate network or BeyondCorp endpoint)
  -> Cloud IAP (validates Google identity, device policy if configured)
  -> Internal HTTPS LB (internal IP only)
  -> GKE Ingress / internal dashboard service
  -> Application
```

For kubectl access:
```
Engineer
  -> gcloud container clusters get-credentials (GCP IAM authenticated)
  -> GKE control plane (private API server endpoint, only reachable via authorized networks or via IAP tunnel)
```

#### Internal Request Path for Service-to-Service Traffic

```
Service A (GKE pod or Cloud Run)
  -> Cloud DNS private zone resolves internal service name
  -> Internal HTTP(S) LB (internal IP)
  -> Service B (GKE pod or Cloud Run)
```

#### Workload Identity and Database Access

```
GKE Pod (runs as K8s service account: team-a/order-processor)
  -> Workload Identity binding maps to GCP SA: order-processor@project.iam.gserviceaccount.com
  -> GCP SA has Cloud SQL Client role
  -> Cloud SQL Auth Proxy sidecar uses GCP SA identity
  -> Connects to Cloud SQL via private IP, IAM-authenticated, encrypted
```

#### What I Have Not Designed Yet (expand these)

- Exact project structure (one project per team vs shared project)
- VPC Service Controls perimeter configuration
- Pub/Sub IAM policy per topic
- Blast radius analysis if the GKE node pool is compromised
- Incident response runbook for loss of access to internal IAP

---

### Tasks

Complete all of the following. Justify each design choice — "because it's best practice" is not a justification.

1. **Private network and service boundaries** — Define your VPC topology. Do you use a Shared VPC or separate VPCs per team? How do services in different projects communicate? Where do you use Private Service Access?

2. **Internal traffic path** — Trace a request from an engineer's laptop to an internal dashboard. Trace a service-to-service request. Trace a database query from an application pod. Describe the DNS, auth, and network path for each.

3. **Identity model for humans and workloads** — How do engineers authenticate to internal services? How do workloads prove identity to each other and to managed services (Cloud SQL, Pub/Sub)? What happens to static service account keys?

4. **Where you use GKE, Cloud Run, or VMs** — For a long-running stateful worker, a stateless internal API, an event-driven transformer, and a periodic batch job: which platform do you use for each and why?

5. **Private database connectivity** — Describe exactly how an application pod connects to Cloud SQL. Does it use the Auth Proxy? Does it use native IAM auth? What is the connection pool size and why? What happens if Cloud SQL has a failover?

6. **Platform protection and shared component safety** — The GKE cluster is shared. What stops Team A from accessing Team B's secrets or database? What stops a compromised pod from exfiltrating data to the internet?

7. **Mandatory vs optional guardrails** — List at least four things the platform team enforces by policy (mandatory) and at least three things teams can configure themselves (optional). Explain the line.

8. **Incident response path** — An on-call engineer gets paged at 2am that an internal service is down. Walk through: how they authenticate, what tools they use, what access they have, and what could go wrong with the access model during an incident.

---

### What a Beginner Answer Looks Like

- Understands that the core services should not have public IPs
- Knows GKE supports private clusters
- Mentions service accounts for workload access
- Can describe a basic internal load balancer path
- May not distinguish between human and workload identity
- Likely missing: IAP, VPC Service Controls, project-level isolation, blast radius thinking
- May assume "private VPC = secure" without thinking about lateral movement

### What an Intermediate Answer Looks Like

- Explicit human access via Cloud IAP or VPN, not just "use a bastion"
- Workload Identity is the answer for pod-to-Cloud SQL auth, and explains why static keys are banned
- Understands GKE private cluster and what "private API server" means operationally
- Can distinguish between Shared VPC and per-team VPCs and articulate when each is appropriate
- Addresses egress: Cloud NAT is present, but may not think through what happens without destination filtering
- Mentions namespaces, RBAC, and network policies for GKE multi-tenancy
- Missing: blast radius quantification, VPC Service Controls, detailed incident access path

### What a Strong Answer Looks Like

- Opens by separating control plane from data plane identity and access requirements
- Explicit blast radius analysis: if Team A's pod is compromised, what can it reach?
- Addresses the tension between platform team control and team autonomy — guardrails that do not require approval tickets
- IAP + BeyondCorp context: why device trust matters, not just user identity
- VPC Service Controls: prevents a compromised workload from exfiltrating Cloud SQL data out of the perimeter even with valid credentials
- Egress with destination filtering via an egress firewall or proxy (Cloud NAT alone is not enough for security-sensitive environments)
- Incident access model: what if IAP is down? What is the break-glass procedure? How is emergency access audited?
- Guardrails described as policy-as-code (OPA/Gatekeeper for GKE, org policy constraints for GCP), not manual enforcement

---

### Interviewer Pressure Questions

- How do engineers reach internal dashboards safely from home? What if your IAP is down?
- What is your egress strategy? Can a compromised pod call any IP on the internet?
- What is your blast radius if one team's workload is compromised? Can it reach another team's Cloud SQL?
- You use a shared GKE cluster. Team A's pod has a memory exploit. What does it have access to on the node?
- How do you avoid the platform team becoming a blocking team? What can a service team do without filing a ticket?
- An engineer needs database read access for an incident at 2am. How do they get it, and is that access audited?
- What is different between a Shared VPC and peered VPCs? Which would you use here and why?
- How does Cloud Run with private ingress get invoked? What network path does the request take?

---

### Deliverable Guidance

Your final answer should contain:

**Architecture diagram** covering:
- Human access path (laptop -> IAP -> internal LB -> app)
- Service-to-service path (DNS resolution, internal LB, target service)
- Data access path (pod -> Workload Identity -> Cloud SQL Auth Proxy -> Cloud SQL private IP)
- Egress path (pod -> Cloud NAT -> internet)
- Mark clearly which resources have external IPs (answer: almost none)

**Control-plane and data-plane explanation** covering:
- Control plane: GKE API server access, CI/CD pipeline identity, IAM change management
- Data plane: service-to-service runtime traffic, DB queries, Pub/Sub publish/consume

**Security boundary explanation** covering:
- What defines a security boundary in your design (project? VPC? namespace? IAM policy?)
- What the blast radius is for a compromised pod
- How you detect and respond to a workload calling unexpected destinations

---

### What to Study Next

After completing this lab:
- Lab 1: the public-facing counterpart — compare how the access model changes when users are external
- Lab 3: same concepts but on AWS — how does IAM Roles for Service Accounts compare to Workload Identity?
- Deep dives: VPC Service Controls perimeter design, GKE network policy (Cilium vs Calico), Cloud IAP context-aware access, OPA/Gatekeeper for platform guardrails
- Incident management: break-glass access patterns and how to audit emergency credential use

---

## [SRE] Cloud Design Lab 3: AWS Crossover Rebuild

## Cloud Design Lab 3: AWS Crossover Rebuild

### Scenario

Take the GCP-first public platform from Lab 1 and rebuild it for AWS-first operation. This is not a migration exercise — it is a redesign exercise. The goal is to understand where the architectures are genuinely equivalent, where the cloud-native differences force different decisions, and where copying a GCP mental model into AWS creates hidden risk.

Requirements:
- Route 53 for DNS (justify routing policy)
- CloudFront for CDN and edge (justify whether you use it, and where it sits relative to WAF)
- AWS WAF for DDoS and L7 protection
- ALB or NLB — justify which you use and where
- EKS or an alternative compute platform — justify your choice
- Private RDS database (PostgreSQL or MySQL)
- SQS or SNS for async messaging
- CloudWatch and centralized observability
- Security Groups and NACLs — explain the difference and when each matters

---

### Prerequisites

Before attempting this lab, review:
- AWS VPC: subnets (public vs private), route tables, internet gateways, NAT gateways
- Security Groups (stateful, instance-level) vs NACLs (stateless, subnet-level)
- Route 53: record types, routing policies (latency, geolocation, weighted, failover)
- CloudFront: distributions, origins, cache behaviors, WAF integration
- AWS WAF: Web ACLs, rule groups, managed rule sets, attachment to CloudFront or ALB
- ALB vs NLB: OSI layer, protocol support, target groups, health check behavior
- EKS: managed node groups, Fargate profiles, VPC CNI, IAM Roles for Service Accounts (IRSA)
- RDS: Multi-AZ deployment, read replicas, Secrets Manager integration, RDS Proxy
- SQS vs SNS: fan-out patterns, dead-letter queues, visibility timeout
- CloudWatch: metrics, Logs Insights, alarms, Container Insights for EKS

Estimated time: 90-120 minutes. If you have completed Lab 1, focus on the difference mapping tasks rather than starting from scratch.

---

### How to Think About This

The temptation in a crossover lab is to produce a GCP-to-AWS dictionary ("Cloud Armor = WAF, Cloud CDN = CloudFront, GKE = EKS") and call it done. That is not architecture — it is shortcut thinking. The two clouds have genuinely different defaults, different trust models, and different failure modes. Work through these questions.

**Step 1 — Identify what maps cleanly and what does not.**
Some services are genuinely equivalent in behavior and operational model. Others share a name category (both are "load balancers") but behave differently enough to change your design. Before drawing anything, write a mapping table that marks each GCP service as: "direct equivalent," "rough equivalent with important differences," or "no equivalent — must rethink."

**Step 2 — Understand the AWS networking model differences.**
GCP firewalls are instance-level and stateful, applied via tags or service accounts. AWS uses Security Groups (stateful, attached to ENIs/instances) and NACLs (stateless, subnet-level, evaluated in order). This is a fundamental difference. In GCP, you can block traffic from a single pod without changing subnet-level rules. In AWS, you need to combine SGs and NACLs carefully, and NACL rules are stateless — you must allow return traffic explicitly.

**Step 3 — Rethink the edge stack.**
In GCP, the edge is: Cloud DNS -> Cloud CDN -> Cloud Armor -> External HTTPS LB. In AWS, the equivalent is: Route 53 -> CloudFront -> WAF (attached to CloudFront) -> ALB. The difference is that CloudFront is a true CDN and regional-level edge, while the ALB is the regional L7 entrypoint. WAF can attach to either — but attaching it to CloudFront means rules fire at the global edge before requests reach your VPC. Attaching it to the ALB means rules fire inside your region. The right answer depends on where you want to absorb attack traffic.

**Step 4 — Understand what ALB vs NLB means operationally.**
ALB is an L7 load balancer that understands HTTP/HTTPS, routes by path and header, terminates TLS, and has rich health check options. NLB is an L4 load balancer that passes TCP/UDP connections through, preserves source IP, and can handle millions of connections per second. For an HTTP API, ALB is almost always the right choice. NLB matters when you need static IPs, ultra-low latency, or protocols that ALB does not support.

**Step 5 — Understand IAM and workload identity on AWS.**
GCP Workload Identity binds a Kubernetes service account to a GCP service account, and GCP resources check IAM policies. AWS uses IRSA (IAM Roles for Service Accounts) for EKS: the pod assumes an IAM role via a projected token. The concepts are similar, but the implementation differs. IRSA requires OIDC federation configuration in the EKS cluster. Static IAM user credentials in environment variables are the AWS equivalent of static service account keys — equally dangerous.

**Step 6 — Think about what cloud-specific behavior is worth keeping.**
Some design decisions should stay cloud-native rather than being forced to look like the other cloud. RDS Multi-AZ behavior, CloudFront cache behavior configuration, and EKS managed node group update behavior are all worth understanding on their own terms rather than through a GCP lens.

---

### Building Blocks Available

| Component | What it does | GCP Equivalent | Key Difference |
|---|---|---|---|
| Route 53 | Authoritative DNS; supports latency routing, geolocation, weighted, failover policies | Cloud DNS | Route 53 has richer routing policies (latency-based, failover with health checks) |
| CloudFront | Global CDN; terminates TLS at edge PoPs; can attach WAF; caches static and dynamic content | Cloud CDN | CloudFront is a full distribution product; GCP CDN is more tightly coupled to LB |
| AWS WAF | Web ACL with rule groups; attaches to CloudFront, ALB, or API Gateway; managed rule sets available | Cloud Armor | AWS WAF is separate from the LB; Cloud Armor is integrated into LB config |
| ALB (Application Load Balancer) | L7 load balancer; HTTP/HTTPS routing; path and header rules; sticky sessions; WAF integration | External HTTPS LB | ALB is regional; GCP external HTTPS LB is global anycast |
| NLB (Network Load Balancer) | L4 load balancer; TCP/UDP; preserves source IP; static IPs; high connection volume | No direct equivalent | Use when static IP or non-HTTP protocols are required |
| EKS (Elastic Kubernetes Service) | Managed Kubernetes; managed or self-managed node groups; Fargate profiles for serverless pods | GKE | GKE has more opinionated defaults; EKS requires more VPC/IAM configuration |
| ECS (Elastic Container Service) | AWS-native container orchestration; Fargate for serverless; simpler than EKS for stateless workloads | Cloud Run | ECS is more operationally involved than Cloud Run; Fargate reduces node management |
| RDS (Multi-AZ) | Managed relational DB; Multi-AZ = synchronous standby in second AZ with automatic failover | Cloud SQL | RDS Multi-AZ failover takes 1-2 minutes; Cloud SQL similar |
| RDS Proxy | Connection pooler managed by AWS; reduces connection surge to RDS; IAM auth support | Cloud SQL Auth Proxy | Both solve connection pooling; RDS Proxy is more fully managed |
| SQS | Managed queue; at-least-once or exactly-once delivery; dead-letter queue support | Pub/Sub (pull subscriptions) | SQS is point-to-point; SNS is fan-out; Pub/Sub combines both |
| SNS | Managed pub-sub fan-out; delivers to SQS, Lambda, HTTP endpoints | Pub/Sub (push subscriptions) | For fan-out patterns, use SNS -> SQS rather than SQS alone |
| Security Groups | Stateful firewall attached to ENI/instance; allow rules only; evaluated against all attached SGs | GCP firewall rules (instance-level) | AWS SGs are ENI-attached; GCP rules are tag/SA-based |
| NACLs | Stateless firewall at subnet level; allow and deny rules; numbered priority; both inbound and outbound | GCP firewall rules (subnet-level) | NACLs are stateless — return traffic must be explicitly allowed |
| IAM Roles for Service Accounts (IRSA) | EKS pods assume IAM roles via OIDC projected tokens; eliminates static credentials | GKE Workload Identity | IRSA requires OIDC federation setup; conceptually similar |
| AWS Secrets Manager | Managed secrets storage; automatic rotation; IAM-controlled | Secret Manager | Both are functionally equivalent; rotation support is strong in both |
| CloudWatch | Metrics, logs, alarms, Container Insights, dashboards | Cloud Monitoring + Cloud Logging | CloudWatch Logs Insights is a query layer; fewer built-in SLO features than GCP |
| AWS X-Ray | Distributed tracing; auto-instruments some SDKs | Cloud Trace | X-Ray has good Lambda integration; Cloud Trace has better GKE auto-instrumentation |
| VPC (AWS) | Private network; public and private subnets; controlled by route tables | VPC (GCP) | AWS VPC is regional; GCP VPC is global; AWS subnets are AZ-bound |

---

### Beginner Starter Skeleton

This is roughly 30-40% of a complete answer. Use it as a starting point, not a final answer.

#### GCP to AWS Service Mapping (Starter)

| GCP Service | AWS Equivalent | Parity Level |
|---|---|---|
| Cloud DNS | Route 53 | Rough equivalent — Route 53 has richer routing policies |
| Cloud CDN | CloudFront | Rough equivalent — CloudFront is a full distribution product |
| Cloud Armor | AWS WAF | Rough equivalent — WAF attachment point differs |
| External HTTPS LB | ALB | Rough equivalent — GCP LB is global; ALB is regional |
| GKE | EKS | Rough equivalent — IAM/networking setup differs significantly |
| Cloud Run | ECS Fargate | Rough equivalent — more operational overhead on AWS side |
| Cloud SQL (HA) | RDS Multi-AZ | Direct equivalent for HA behavior |
| Pub/Sub | SNS + SQS | Partial — need SNS for fan-out, SQS for queuing |
| Workload Identity | IRSA | Conceptual equivalent — different implementation |
| Cloud Monitoring | CloudWatch | Rough equivalent — SLO tooling less mature in CloudWatch |
| Secret Manager | AWS Secrets Manager | Direct equivalent |

#### Request Path (AWS Version)

```
User
  -> Route 53 (latency-based routing to nearest region)
  -> CloudFront (CDN; cache hit: return immediately; cache miss: continue)
  -> AWS WAF (Web ACL attached to CloudFront; fires at edge)
  -> ALB (in private subnet with public-facing listener; TLS termination)
  -> EKS pods (in private subnets across 3 AZs)
  -> RDS Proxy (connection pooling)
  -> RDS Multi-AZ (primary in one AZ; standby in another)
  -> SQS (async work published by API pods)
  -> ECS Fargate workers or Lambda (consume from SQS)
```

#### What I Have Not Designed Yet (expand these)

- NACL rules for the public and private subnets and why stateless matters
- IRSA setup for EKS pods that need to write to SQS or read from Secrets Manager
- Difference in ALB health check behavior vs GCP HTTPS LB health checks
- CloudFront cache behavior configuration per path pattern
- Route 53 health checks and failover routing for regional DR

---

### Tasks

Complete all of the following. For each task, explain both what you decided AND how it differs from the GCP version.

1. **GCP to AWS mapping** — Produce a complete mapping table. For each service, mark it as direct equivalent, rough equivalent, or no equivalent. Explain the important differences in the "rough equivalent" cases.

2. **What maps directly** — Identify at least three services or concepts that translate without significant behavioral difference. Explain why.

3. **What does not map directly** — Identify at least four places where copying GCP design habits into AWS creates a wrong or risky design. Be specific about what breaks.

4. **VPC, SG, and NACL design** — Design your VPC structure: how many VPCs, how many subnets (public vs private), which AZs, and what CIDR ranges. Then explain your Security Group rules for each tier (edge, app, data). Explain whether NACLs add value here or just add noise.

5. **Load balancer and edge behavior changes** — How does the edge stack differ from GCP? Where does WAF fire? What is the relationship between CloudFront, WAF, and ALB? What changes in how health checks work?

6. **What remains architecturally identical** — Identify at least three things that are the same design decision regardless of cloud: stateless vs stateful split, private database placement, async decoupling rationale, etc.

---

### What a Beginner Answer Looks Like

- Produces a mapping table but treats all equivalents as direct (does not flag important differences)
- Knows ALB is the right choice for HTTP APIs
- Understands that RDS should be in a private subnet
- May not distinguish between Security Groups and NACLs
- Likely missing: IRSA setup, NACL statelessness implications, WAF attachment point strategy, CloudFront vs direct-to-ALB tradeoffs

### What an Intermediate Answer Looks Like

- Mapping table correctly flags rough equivalents and explains key differences
- Explains Security Group rules per tier (specific ports, source SG references rather than CIDR ranges where possible)
- Understands that NACLs are stateless and explains why that matters for inbound + outbound rules
- Can explain where to attach WAF (CloudFront vs ALB) and when each is appropriate
- Uses IRSA for EKS workload identity, not IAM user credentials
- Explains RDS Proxy and why it matters for EKS-to-RDS connectivity
- Missing: detailed failure mode analysis, Route 53 failover routing mechanics, CloudFront origin group for DR

### What a Strong Answer Looks Like

- Opens with clear architectural principles that do not change between clouds and explicitly contrasts them with cloud-specific decisions
- NACL analysis: explains the stateless/stateful distinction with a concrete example (e.g., ephemeral port range for return traffic)
- WAF placement: explains that CloudFront + WAF absorbs attack traffic before it enters the VPC; ALB + WAF is cheaper for smaller deployments or non-cacheable APIs; names the tradeoff
- Points out that GCP's global anycast LB has no direct AWS equivalent — ALB is regional, so Route 53 with latency routing is necessary for global performance
- Addresses the SNS+SQS fan-out pattern and why Pub/Sub's combined model is simpler
- EKS networking: explains VPC CNI vs other CNIs and what it means for pod IP addresses consuming VPC CIDR space
- Calls out at least one place where direct cloud portability would silently degrade reliability or security
- Includes a "traps for GCP engineers moving to AWS" section

---

### Interviewer Pressure Questions

- Where are Security Groups enough and where do NACLs add real value? Give a concrete example.
- What if you copied GCP firewall habits into AWS — specifically the habit of trusting tag-based rules — and did not understand SG source references?
- ALB health checks are green but user requests are failing. What could cause this in AWS that would not in GCP?
- Where does WAF fire in your design? What gets through before WAF evaluates it?
- GCP's HTTPS load balancer is global anycast. ALB is regional. How does your AWS design handle global users with comparable latency?
- You use SNS + SQS for fan-out. GCP uses Pub/Sub. What does a GCP engineer need to unlearn when they switch to SNS + SQS?
- What is the VPC CNI behavior for EKS and why does it affect your subnet CIDR sizing more than GKE does?
- Route 53 failover routing relies on health checks. What is the blast radius if your health check endpoint is slow but not failed?

---

### Deliverable Guidance

Your final answer should contain:

**Mapping table** with three columns:
- GCP service
- AWS equivalent
- Parity level + most important behavioral difference

**Architecture sketch** showing:
- Route 53 -> CloudFront -> WAF -> ALB -> EKS pods -> RDS
- Public vs private subnet boundaries
- SQS consumers (workers or Lambda)
- AZ distribution for EKS node groups and RDS

**Risk list for naive cloud portability** — at least five specific risks with this format:
```
Risk: [specific thing that breaks]
Why it breaks: [the difference between GCP and AWS that causes it]
How to avoid it: [specific design change]
```

---

### What to Study Next

After completing this lab:
- Lab 4: multi-region control plane across GCP and AWS — this builds on both Lab 1 and Lab 3
- Deep dives: EKS VPC CNI and pod IP address management, CloudFront origin groups for failover, Route 53 resolver and DNS forwarding for hybrid setups, RDS Proxy configuration for EKS connection management
- Certification prep: AWS Solutions Architect Associate networking module covers SG vs NACL in depth
- Compare: deploy the same simple app to both GCP (Cloud Run) and AWS (ECS Fargate) and trace the IAM and networking differences yourself

---

## [SRE] Cloud Design Lab 4: Low-Latency Multi-Region Control Plane

## Cloud Design Lab 4: Low-Latency Multi-Region Control Plane

### Scenario

Design a low-latency control plane used by compute workloads across GCP and AWS. This is not a customer-facing product. It is an internal infrastructure service that other systems depend on to make real-time decisions — for example, a policy enforcement service, a configuration service, or a metadata service that workloads query at startup and periodically during operation.

Requirements:
- p99 latency matters more than raw throughput
- correctness matters more than marketing-grade multi-cloud symmetry
- stateful metadata store is required
- regional and zonal failure tolerance
- no public API; consumers are internal workloads on GCP and AWS
- strong security and auditability
- strict rollout safety — a bad control-plane push can affect all consuming workloads simultaneously

---

### Prerequisites

Before attempting this lab, review:
- Distributed systems basics: consistency models (strong, eventual, linearizable), CAP theorem, and PACELC tradeoffs
- GCP: Spanner (globally consistent), Bigtable (wide-column, low latency reads), Firestore (document, strong consistency per-document), Cloud Memorystore (Redis for caching)
- AWS: DynamoDB (multi-region replication via Global Tables), ElastiCache (Redis), RDS with cross-region read replicas
- Multi-region networking: GCP interconnect vs Dedicated Interconnect, AWS Direct Connect, VPN between clouds
- Read-through and write-through caching patterns, cache invalidation strategies
- gRPC: health checking, deadlines, retry policies, service mesh integration
- Canary deployment for control-plane services (blast radius is much higher than for stateless services)
- SLO budgeting and latency percentile reasoning (p50 vs p99 and why they tell different stories)

Estimated time: 120-150 minutes. This lab requires distributed systems reasoning beyond cloud product knowledge.

---

### How to Think About This

This lab is harder than the others because it requires you to reason about correctness, latency, and failure simultaneously. Do not start with a product list. Start with the fundamental constraints, then select components that satisfy them.

**Step 1 — Separate the control plane from the data plane clearly.**
A control plane decides what should happen. A data plane makes it happen at scale. Your control plane here is the decision and configuration service — it stores metadata and policies that workloads consult. The workloads themselves (doing compute, processing requests) are the data plane. This separation matters because: the control plane must be more correct than the data plane, but it does not need to handle every request the data plane handles. Define control-plane responsibilities precisely before designing anything.

**Step 2 — Define your latency budget before picking components.**
p99 latency is a commitment. Work backwards from the number your consumers need. If a workload needs a control-plane response within 5ms p99, and network alone from AWS us-east-1 to GCP us-central1 is 15ms, then a design that routes every request to a central point fails the requirement before you even add service latency. The latency budget forces you to decide: read from a local replica, use a local cache, or accept a weaker consistency model. You cannot avoid this tradeoff.

**Step 3 — Name the stateful core early.**
Every distributed system has a core where state lives. Name it explicitly. Is it Spanner? A Raft cluster? DynamoDB Global Tables? Redis Cluster? Each has different consistency, latency, and operational properties. Your entire HA and failover design derives from what the stateful core can and cannot do during failures.

**Step 4 — Design your cache strategy around your consistency requirement.**
A cache in front of a strongly consistent store improves read latency but introduces staleness. How stale is acceptable for your use case? If a policy changes, how quickly must all workloads see the new version? Can a workload briefly operate with a slightly stale policy, or does stale data cause security violations or incorrect routing? The answer to this determines whether you need aggressive cache invalidation, short TTLs, or push-based update propagation.

**Step 5 — Place your replicas and caches with the latency budget in mind.**
Cross-cloud network latency between GCP and AWS is typically 20-60ms round-trip depending on the regions. If your p99 budget is 10ms, you cannot round-trip cross-cloud on the hot path. This means: local read replica or local cache in each cloud, with the authoritative write path going to one primary region, and async replication to replicas.

**Step 6 — Define your failure modes and responses.**
For each failure type — single AZ loss, single region loss, inter-cloud network partition, control-plane database unavailability — answer: does the system fail closed (rejects requests), fail open (applies cached/last-known state), or degrade (returns stale data with a warning)? Each choice has safety implications. A policy enforcement system failing open is a security incident. A configuration service failing closed blocks all workload startups.

**Step 7 — Reason about rollout blast radius.**
For a stateless API, a bad deploy affects 5% of traffic during canary. For a control plane that all workloads depend on, a bad deploy can affect all workloads simultaneously even with canary traffic routing — because workloads keep reading from the control plane after the deploy. Define how you gate rollouts and how you detect control-plane-wide impact before it becomes a platform-wide outage.

---

### Building Blocks Available

| Component | What it does | Latency / Consistency Notes |
|---|---|---|
| Cloud Spanner | GCP-managed globally distributed SQL; strongly consistent; horizontal scale | Writes: ~10ms regional, ~100ms+ globally; Reads: ~5-10ms with read staleness allowed |
| Cloud Bigtable | GCP wide-column store; very low latency reads; no SQL joins; good for key-value at scale | Read p99: ~1-3ms in-region; good for hot-path lookups |
| Cloud Firestore | GCP document store; strong consistency per document; good for low-volume config reads | Read p99: ~5-15ms; not suited for high-QPS hot path |
| Cloud Memorystore (Redis) | Managed Redis in GCP; sub-millisecond reads; in-memory; data loss on failure without persistence | Read p99: under 1ms in-region; use as cache layer, not primary store |
| DynamoDB Global Tables | AWS multi-region NoSQL; active-active replication; eventual consistency across regions | Cross-region replication: typically under 1s; reads from local region: ~5ms |
| ElastiCache (Redis) | Managed Redis in AWS; same sub-millisecond properties as Memorystore | Read p99: under 1ms in-region; use as cache layer |
| gRPC | High-performance RPC framework; supports streaming, deadlines, retries, health checking | Adds ~0.5-2ms over TCP in-region; important for deadline propagation |
| Envoy / Service Mesh | Proxy layer for service-to-service traffic; handles retries, circuit breaking, mTLS, observability | Adds ~0.5-1ms per hop; necessary for mutual TLS between clouds |
| Cloud Interconnect / AWS Direct Connect | Dedicated private network links between on-prem or cloud environments | Reduces cross-cloud latency vs public internet; requires setup |
| Cloud VPN / AWS VPN | Encrypted tunnel over internet between VPCs; higher latency than Interconnect | Round-trip latency: typically 30-60ms between GCP and AWS regions |
| Cloud Armor / AWS WAF | Edge protection — less relevant for internal control plane unless you have a public API endpoint | |
| Binary Authorization / OPA | Policy enforcement for deployments; critical for control-plane rollout safety | |
| Cloud Monitoring + AWS CloudWatch | Metrics and alerting; critical for detecting control-plane latency degradation | |
| OpenTelemetry | Vendor-neutral tracing/metrics instrumentation; works across GCP and AWS | |
| Raft / etcd | Distributed consensus algorithm; used internally by Kubernetes and other systems; not a managed service but useful to understand for consistency reasoning | |

---

### Beginner Starter Skeleton

This is roughly 30-40% of a complete answer. Every section needs expansion.

#### Assumptions I Would Clarify First

- Consumers are internal workloads on GCP and AWS that read control-plane metadata periodically (e.g., every 30s) and at startup
- p99 read latency target: 10ms from within either cloud (this forces local caching)
- Write latency is less critical — writes come from operators and automation, not from hot request paths
- Correctness requirement: a policy update must reach all workloads within 60 seconds (eventual consistency with bounded staleness)
- The system must fail closed for security policy reads (prefer rejecting a request over applying stale security policy)
- Rollout must be staged: changes deployed to one region before the other, with automatic rollback gates

#### Control Plane vs Data Plane Separation

Control plane responsibilities (this system):
- Stores and serves metadata, policies, and configuration to consuming workloads
- Authoritative for what workloads are allowed to do
- Low write rate, high read rate
- Must be strongly consistent for writes; can tolerate bounded read staleness

Data plane (consuming workloads, NOT this system):
- Does the actual compute work (serving user traffic, processing jobs)
- Reads from control plane at startup and periodically
- Should cache control-plane responses locally to avoid blocking on control-plane availability

#### Latency Budget Sketch

```
Target: p99 < 10ms from EKS pod in us-east-1

Budget breakdown:
  Network (pod to local cache): ~0.1ms
  Local cache (Redis/ElastiCache) read: ~0.5ms
  Cache hit: total ~1ms [ACCEPTABLE]

  Cache miss path:
  Network (pod to local control-plane replica): ~2ms
  Control-plane service processing: ~2ms
  Local read replica read: ~3ms
  Total ~7ms [ACCEPTABLE if replica is in same region]

  Cache miss with cross-cloud read (fallback only):
  Network (us-east-1 to us-central1): ~25ms
  [NOT on hot path - only for write propagation]
```

#### Stateful Core Choice

Starting recommendation: Cloud Spanner (primary region) + read replicas (secondary GCP region) + DynamoDB Global Tables replication (for AWS-region reads).

Rationale:
- Spanner gives strong consistency for writes
- Read replicas give low-latency reads in the primary cloud
- DynamoDB Global Tables replication (via an async bridge) gives AWS consumers a local read path
- Redis/ElastiCache in each cloud is the hot-path cache layer

#### What I Have Not Designed Yet (expand these)

- The async replication bridge between Spanner and DynamoDB and its consistency guarantees
- Cache invalidation strategy when a policy changes
- Exact failure response per failure type (close vs open vs degrade)
- Rollout gating and automatic rollback mechanism
- Cross-cloud mTLS and identity model

---

### Tasks

Complete all of the following. This lab requires you to make and defend architectural tradeoffs, not just list components.

1. **Control-plane vs data-plane responsibilities** — Define what this control plane does, what it explicitly does NOT do, and what the interface contract is between the control plane and its consumers. If consumers cache responses, how does the control plane signal that a cached value is stale?

2. **Request path and latency budget** — Build a complete latency budget for a read request from a workload in GCP us-central1, and separately for a workload in AWS us-east-1. Show each hop. Identify where the budget gets tight and what design decisions reduce p99.

3. **Consistency model** — What consistency level do your consumers need? Can they tolerate bounded staleness? If so, what is the acceptable staleness window? How does your stateful core's consistency model map to those requirements? What happens if a policy is updated but the consumer reads a stale cached copy?

4. **Cache strategy** — Describe your caching architecture. Where does a cache sit (consumer-side, control-plane-side, or both)? What is the TTL? How do you handle invalidation when the authoritative state changes? How do you handle a cold start (no cached data)?

5. **Regional placement** — Where do you place the write-primary? Where do you place read replicas? Where do you place caches? Draw the data flow for a write (operator changes a policy) and for a read (workload fetches current policy).

6. **Failure mode handling** — For each of the following, describe the system behavior and whether it fails closed, open, or degrades: (a) single AZ loss in GCP primary region, (b) GCP primary region unavailable, (c) inter-cloud network partition (GCP and AWS cannot reach each other), (d) control-plane database (Spanner) write path unavailable.

7. **Observability and alerting** — What metrics do you instrument? What are your SLO definitions for this service? What is the first alert an on-call engineer receives, and what do they look at first?

8. **Delivery and policy controls** — Why is rollout safety harder for a control plane than for a stateless API? What is your canary/staged rollout mechanism? What automatic rollback triggers would you define?

---

### What a Beginner Answer Looks Like

- Understands the control plane vs data plane separation conceptually
- Names an appropriate storage backend (Spanner or DynamoDB)
- Knows that caching is needed for latency
- Can describe a basic multi-region deployment
- May not have a latency budget with actual numbers
- Likely missing: consistency model reasoning, failure-mode analysis, cache invalidation strategy, rollout blast radius for a control plane

### What an Intermediate Answer Looks Like

- Has a concrete latency budget with per-hop numbers
- Names the stateful core early and explains its consistency properties
- Understands that cross-cloud latency forces local read replicas or caches
- Can distinguish between fail-closed and fail-open and knows when each is appropriate for a control plane
- Addresses cache invalidation (TTL vs push-based notification)
- Knows that a control-plane rollout has higher blast radius than a stateless service rollout
- Missing: Spanner vs DynamoDB Global Tables comparison for this use case, bounded staleness configuration, OpenTelemetry cross-cloud tracing, the async replication bridge design

### What a Strong Answer Looks Like

- Opens by naming the stateful core and its consistency guarantees before discussing anything else
- Latency budget is specific and shows where the 10ms p99 breaks if you remove any cache layer
- Consistency model is explicit: strong writes, bounded-staleness reads, with specific staleness window chosen based on the use case (security policy vs non-critical config)
- Fail-closed vs fail-open is reasoned per data type: security policy reads fail closed; non-critical config reads can degrade with stale data
- Cache invalidation strategy: explains why short TTL alone is not enough for security-critical data and why push-based invalidation (control plane notifies consumers via a side channel) is necessary for the tightest cases
- Rollout: explains that control planes need schema-level backwards compatibility gating, not just traffic-level canary, because consumers keep reading from the control plane after deploy
- Cross-cloud identity: mTLS between GCP workloads calling the control plane and AWS workloads calling the control plane; explains how each cloud's workload identity (Workload Identity, IRSA) authenticates to the control-plane service
- Degrade-in-place vs failover: argues that for most control-plane failures, serving stale data from cache is safer than failing over the entire write path to a secondary region, and explains the exception cases

---

### Interviewer Pressure Questions

- What stays cloud-specific on purpose? Why would you not make this design perfectly symmetric across GCP and AWS?
- What happens if one cloud is partially degraded — say, GCP us-central1 has 30% packet loss but is not fully down? How does your system behave?
- When do you fail over versus degrade in place? What is the concrete trigger for each?
- What is the stateful core and how do you protect it from a bad deploy?
- A policy changes. How long until every workload in both clouds has seen the new policy? How do you know?
- Your p99 is 8ms normally. After a deploy, it becomes 35ms. What is your detection and response path?
- Why not just use a single globally distributed store (like Spanner with global reads) and skip the cross-cloud replication complexity?
- An AWS workload is calling your control plane in GCP. It needs to authenticate. How does it prove its identity? What does the control plane verify?
- Describe the difference between bounded staleness and eventual consistency. Which does your design use and why?
- A control-plane bug causes all consumers to receive incorrect policy for 90 seconds before the rollback completes. Write the incident timeline.

---

### Deliverable Guidance

Your final answer should contain:

**Architecture sketch** showing:
- Write path: operator -> control-plane primary (GCP) -> Spanner -> async replication -> DynamoDB (AWS)
- Read path from GCP workload: local Redis cache or Spanner read replica
- Read path from AWS workload: local ElastiCache or DynamoDB local read
- Cache invalidation signal path
- Inter-cloud connection (VPN or Interconnect) and where it sits in the latency budget

**Latency budget table** with columns:
- Consumer location
- Request type (cache hit / cache miss / cross-cloud fallback)
- Per-hop breakdown
- Total p50 and p99 estimate

**Failure-domain table** with columns:
- Failure scenario
- System behavior (fail closed / fail open / degrade)
- Recovery mechanism
- Data risk (potential for stale data, data loss, or incorrect policy)

---

### What to Study Next

After completing this lab:
- Labs 1-3 assumed stateless API serving; this lab is where distributed systems depth matters
- Deep dives: Cloud Spanner read staleness configuration and bounded staleness vs strong reads; DynamoDB Global Tables replication topology; gRPC deadline propagation and how it prevents latency from cascading; Redis cache stampede prevention techniques (probabilistic early expiration, lock-on-miss)
- Distributed systems reading: "Designing Data-Intensive Applications" by Martin Kleppmann — chapters on replication, consistency, and distributed transactions are directly relevant
- Production references: How Kubernetes etcd achieves consistency and why it is the control-plane bottleneck; how Istio/Envoy distribute xDS control-plane config to all proxies at scale
- Interview preparation: Be able to draw the write path and read path separately, name the consistency model at each layer, and explain the failure response for at least three failure scenarios without prompting

---

## [SRE] Reference Answer: GCP Public Platform

## Reference Answer: GCP Public Platform

Use this as a quality bar, not as something to memorize word for word.

It is intentionally opinionated and concise enough to be deliverable in an interview, while still covering senior-level concerns.

### 1. Requirements And Assumptions

I would first clarify these assumptions:

- global customer traffic, mostly read-heavy with some write APIs
- p99 latency matters for the API tier
- availability target is high enough that zonal loss must be tolerated without major user impact
- full regional failover may be required for critical paths, but data correctness matters more than instant global failover for all writes
- security requires internet-facing protection, strong workload identity, private data access, auditability, and safe delivery

I would also split the system into:

- edge and traffic-control layers
- stateless request-serving layers
- stateful persistence layers
- asynchronous processing layers
- observability and delivery-control layers

### 2. High-Level Architecture

I would design the public path roughly like this:

1. public DNS resolves the API hostname
2. traffic hits Cloud CDN only for cacheable paths
3. requests pass through Cloud Armor and external HTTP(S) load balancing
4. traffic routes to a regional stateless API tier running on GKE or Cloud Run
5. the API checks cache first for read-heavy paths
6. write or uncached reads use a private relational database such as Cloud SQL, ideally through private networking
7. non-critical or async follow-up work is published to Pub/Sub
8. worker services consume from Pub/Sub and update downstream systems
9. observability captures metrics, logs, traces, and deployment events

For this scenario, I would probably prefer GKE if:

- there are many services
- I need strong rollout control and platform standardization
- some services are latency-sensitive or need richer runtime tuning

I would prefer Cloud Run if:

- the API is simpler, stateless, and traffic elasticity matters more than cluster-level control

### 3. Network And Security Boundaries

I would explicitly separate:

- public entry: DNS, CDN, external LB, WAF
- private application networking: service-to-service traffic
- private data networking: database and sensitive internal dependencies

Security model:

- only the edge is public
- app and worker tiers use private networking
- database has no public exposure
- workloads use workload identity instead of static credentials
- secrets come from managed secret storage, not CI variables baked into images
- east-west traffic is authenticated and controlled with least privilege

At the edge:

- Cloud Armor enforces WAF, rate limiting, and abuse controls
- TLS terminates at the HTTPS load balancer, with re-encryption internally if required by policy

### 4. Stateless Versus Stateful Split

I would call out the stateful core early, because that defines most HA complexity.

Stateless:

- API serving layer
- gateway or ingress layer
- async workers if they do not own durable state

Stateful:

- relational database
- cache only if persistence or warm state matters operationally
- message backlog in Pub/Sub

This matters because:

- stateless tiers are easy to scale and replace across zones
- stateful tiers dominate failover, backup, consistency, and real recovery time

### 5. Availability And Failure Domains

#### Zonal Failure

I would spread stateless serving capacity across at least three zones in the primary region.

If one zone degrades:

- load balancer and platform health should stop sending new traffic there
- remaining zones absorb traffic
- autoscaling must leave headroom to avoid cascading overload

#### Regional Failure

For critical APIs, I would keep a secondary region with warm or active capability, depending on business need.

The key question is the database:

- if writes require strong correctness, I would avoid pretending multi-region failover is instant and risk-free
- I would define which APIs can fail over read-only, which can queue writes, and which must degrade rather than split-brain

Senior point:

- application failover is easy compared with state failover

### 6. Latency Strategy

I would explicitly budget latency across:

- DNS
- TLS handshake
- CDN or edge processing
- load balancer
- API service processing
- cache lookup
- database or downstream dependency

Ways I would protect p99:

- cache only where correctness allows
- avoid unnecessary cross-zone hops on hot paths
- keep database connectivity private and efficient
- use connection pooling carefully
- move non-critical work off the synchronous path into Pub/Sub
- avoid aggressive retries on already stressed dependencies

### 7. Observability

I would require:

- RED or golden-signal metrics for APIs
- infrastructure and saturation metrics
- structured logs with correlation IDs
- distributed tracing across edge, API, cache, and DB calls
- deployment event markers
- SLOs for availability and latency
- synthetic checks from user-relevant regions

For incident response, dashboards should show:

- request rate
- error rate
- p50, p95, p99 latency
- zone or region breakdown
- dependency latency
- rollout correlation

### 8. Delivery And Operational Safety

I would design delivery so that:

- immutable images are built once
- artifacts are identified by digest
- provenance or attestations are generated
- deploy policy verifies trusted artifacts
- rollout is progressive, not instant fleet-wide
- rollback is fast and well-practiced

For GCP, a strong pattern would be:

- Cloud Build
- Artifact Registry
- Binary Authorization
- Cloud Deploy or equivalent staged rollout

### 9. Incident Example: Zonal Degradation

If one zone is partially degraded but not fully down:

- I would first confirm whether user impact is real or only health-check-visible
- if real, I would reduce or remove traffic to that zone
- I would compare dependency behavior by zone, especially DB and cache latency
- I would watch whether remaining zones have enough capacity to absorb traffic without causing a second failure
- I would communicate user impact, affected geography or traffic slice, mitigation steps, and next update time

The key risk here is shallow health signaling. A zone can look healthy enough for platform checks while still being bad for real request latency.

### 10. Tradeoffs I Would State Explicitly

- GKE gives stronger platform control; Cloud Run gives lower operational overhead
- CDN improves latency and origin protection, but can complicate cache correctness and invalidation
- active-active across regions sounds attractive, but state consistency may make selective degradation safer than naive full failover
- more security layers help, but only if identity, observability, and break-glass paths stay usable

### 11. What I Would Keep Simple

I would avoid:

- over-engineered multi-region writes unless the business truly needs them
- pretending every service needs both GKE and Cloud Run support
- overusing synchronous dependencies in the hot path
- building a huge custom platform contract before service teams can succeed

I would keep the initial design opinionated:

- one primary serving model
- one standard observability stack
- one trusted-delivery path
- clear public/private boundaries

That usually gives better reliability than a highly flexible but weakly governed platform.
