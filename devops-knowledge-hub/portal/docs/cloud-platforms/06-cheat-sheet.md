---
title: "Cheat Sheet"
sidebar_position: 6
---

# Cloud Platforms — Cheat Sheet

Fast recall for AWS/GCP/Azure concepts, CLI checks, architecture patterns, and interview-ready comparisons.

---

## Core Cloud Layers

```text
identity -> network -> compute -> storage -> database -> traffic management -> observability -> cost
```

| Layer | AWS | GCP | Azure |
|---|---|---|---|
| Identity | IAM | Cloud IAM | Entra ID / RBAC |
| Network | VPC | VPC | VNet |
| VM | EC2 | Compute Engine | Virtual Machines |
| Object storage | S3 | Cloud Storage | Blob Storage |
| Relational DB | RDS / Aurora | Cloud SQL / AlloyDB | Azure SQL |
| Kubernetes | EKS | GKE | AKS |
| Functions | Lambda | Cloud Functions | Azure Functions |
| DNS | Route 53 | Cloud DNS | Azure DNS |
| CDN | CloudFront | Cloud CDN | Azure CDN / Front Door |
| Monitoring | CloudWatch | Cloud Monitoring | Azure Monitor |
| Audit | CloudTrail | Cloud Audit Logs | Activity Logs |

---

## Shared Responsibility

```text
provider: facilities, hardware, managed platform
customer: identity, data, policies, app, config, exposure
```

Quick rule:

```text
The more managed the service, the less OS/platform work you own, but you still own data and access.
```

---

## AWS IAM Quick Recall

```text
principal -> action -> resource -> policy evaluation -> allow/deny
```

Evaluation rules:

```text
explicit deny wins
allow required
implicit deny by default
```

Best practices:

- Use SSO for humans.
- Use roles for workloads.
- Avoid long-lived keys.
- Enable MFA for privileged humans.
- Separate dev/staging/prod accounts.
- Review unused permissions.

---

## VPC Components

| Component | Purpose |
|---|---|
| VPC | Isolated virtual network |
| Subnet | IP range in one AZ |
| Route table | Controls packet path |
| Internet Gateway | Public internet route |
| NAT Gateway | Private subnet outbound internet |
| Security Group | Stateful workload firewall |
| NACL | Stateless subnet firewall |
| VPC Endpoint | Private cloud-service access |
| Transit Gateway | Hub-and-spoke routing |
| VPC Flow Logs | Network traffic records |

---

## Public vs Private Subnet

```text
public subnet: route to Internet Gateway
private subnet: no direct inbound internet path
```

Recommended layout:

```text
public: load balancer, NAT gateway
private: application compute
database: database only, no public route
```

---

## Security Group vs NACL

| Feature | Security Group | NACL |
|---|---|---|
| Scope | ENI/workload | Subnet |
| Stateful | Yes | No |
| Rules | Allow rules | Allow and deny rules |
| Common use | App access control | Coarse subnet guardrail |

---

## EC2 Pricing

| Model | Use case |
|---|---|
| On-demand | Unknown or short-lived workload |
| Reserved Instance | Stable instance pattern |
| Savings Plan | Stable compute spend |
| Spot | Interruptible stateless/batch jobs |
| Dedicated Host | Licensing or compliance |

---

## Auto Scaling Terms

```text
scale out: add capacity
scale in: remove capacity
scalability: can grow
elasticity: grows and shrinks automatically
```

Important knobs:

- Minimum capacity
- Desired capacity
- Maximum capacity
- Cooldown/warmup
- Target tracking metric
- Health check type

---

## S3 Storage Classes

| Class | Use case |
|---|---|
| Standard | Frequent access |
| Standard-IA | Infrequent access |
| One Zone-IA | Lower cost, single-AZ durability tradeoff |
| Intelligent-Tiering | Unknown access patterns |
| Glacier Instant | Archive with fast retrieval |
| Glacier Flexible | Archive with slower retrieval |
| Deep Archive | Long-term low-cost archive |

S3 safety checklist:

```text
block public access
versioning for critical data
lifecycle policies
replication only when RPO requires it
encryption
access logs or audit events when needed
```

---

## RDS And Aurora

| Feature | Purpose |
|---|---|
| Multi-AZ | High availability |
| Read replica | Read scaling |
| Automated backup | Point-in-time restore |
| Storage autoscaling | Avoid storage-full incidents |
| RDS Proxy | Connection pooling and faster recovery behavior |
| Aurora Global Database | Cross-region replication pattern |

Common metrics:

```text
CPUUtilization
DatabaseConnections
FreeStorageSpace
ReadLatency
WriteLatency
ReplicaLag
```

---

## DynamoDB Quick Recall

```text
single-table design starts from access patterns
query is preferred
scan is expensive
partition key distribution matters
```

Capacity modes:

| Mode | Use case |
|---|---|
| On-demand | Unpredictable traffic |
| Provisioned | Stable predictable traffic |

---

## Lambda Limits To Remember

```text
max duration: 15 minutes
memory affects CPU
cold starts depend on runtime/package/VPC/init work
concurrency protects or harms downstream dependencies
```

Common patterns:

```text
API Gateway -> Lambda -> DynamoDB
S3 event -> Lambda -> processing
EventBridge -> Lambda -> scheduled task
SQS -> Lambda -> async worker
```

---

## Load Balancer Selection

| Need | Use |
|---|---|
| HTTP path routing | ALB |
| Hostname routing | ALB |
| TCP/UDP | NLB |
| Very low latency L4 | NLB |
| Legacy basic balancing | Avoid CLB for new systems |
| Global caching | CloudFront |

---

## Route 53 Routing Policies

| Policy | Use |
|---|---|
| Simple | One target |
| Weighted | Percentage split |
| Latency | Route to lowest-latency region |
| Failover | Primary/secondary |
| Geolocation | Route by user geography |
| Multi-value | Return multiple healthy records |

---

## High Availability Pattern

```text
Route 53
  -> CloudFront/WAF
  -> ALB across public subnets
  -> app compute across private subnets
  -> RDS/Aurora Multi-AZ in database subnets
  -> S3 for static assets/backups
```

---

## Cost Quick Checks

```text
idle databases
unattached disks
old snapshots
NAT data processing
cross-AZ traffic
cross-region traffic
log retention
underused EC2
missing lifecycle policy
```

Cost tools:

```text
Cost Explorer
Compute Optimizer
Trusted Advisor
Cost and Usage Report
Budgets
```

---

## Incident Trace Path

```text
DNS -> CDN -> WAF -> load balancer -> target -> app -> dependency -> database
```

At each layer ask:

```text
is it reachable?
is it healthy?
is it allowed?
is it saturated?
what changed?
```
