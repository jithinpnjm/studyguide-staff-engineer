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
