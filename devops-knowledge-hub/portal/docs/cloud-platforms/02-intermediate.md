---
title: "Intermediate"
sidebar_position: 2
---

# Cloud Platforms — Intermediate

Intermediate cloud engineering is about connecting services into reliable systems. You move from knowing EC2, S3, IAM, and RDS individually to understanding their contracts, failure modes, and cost/security tradeoffs.

---

## Production AWS Building Blocks

A common production AWS stack looks like this:

```text
Route 53 -> CloudFront/WAF -> ALB -> private compute -> managed database -> object storage
```

Supporting layers:

```text
IAM -> VPC -> logging -> monitoring -> backups -> cost controls -> incident response
```

The architecture is only production-ready when the supporting layers are designed, not bolted on later.

---

## VPC Design For Applications

A VPC should support isolation, routing clarity, and growth.

### Typical Multi-AZ Layout

```text
VPC: 10.0.0.0/16

AZ-a:
  public:   10.0.101.0/24
  private:  10.0.1.0/24
  database: 10.0.11.0/24

AZ-b:
  public:   10.0.102.0/24
  private:  10.0.2.0/24
  database: 10.0.12.0/24
```

### Routing Pattern

| Subnet | Route to internet | Common resources |
|---|---|---|
| Public | Internet Gateway | ALB, NAT Gateway, bastion if required |
| Private | NAT Gateway for outbound | App servers, EKS nodes, ECS tasks |
| Database | No direct internet | RDS, Aurora, internal data services |

### Security Groups vs NACLs

| Feature | Security Group | NACL |
|---|---|---|
| Scope | ENI / instance / load balancer | Subnet |
| Stateful | Yes | No |
| Rule type | Allow only | Allow and deny |
| Common use | App-level traffic policy | Coarse subnet guardrail |

Security groups are usually your primary control. NACLs are useful as a broad subnet-level boundary, but they are harder to operate because they are stateless.

---

## IAM In Real Systems

IAM should be designed around identities and workloads, not individual people clicking around.

### Good IAM Patterns

- Human users authenticate through SSO.
- Workloads use roles or workload identity.
- Production access is time-bound and audited.
- CI/CD has separate build and deployment permissions.
- Accounts/projects are separated by environment.
- Organization-level policies prevent dangerous actions globally.

### Policy Evaluation Mental Model

```text
explicit deny -> deny
no allow -> deny
explicit allow with no deny -> allow
```

Policy sources may include identity policies, resource policies, permission boundaries, session policies, and organization guardrails.

### Common IAM Mistakes

- Giving administrator access to CI jobs
- Long-lived access keys in laptops or repositories
- Wildcard actions on wildcard resources
- No MFA for privileged humans
- Shared credentials with no owner
- Missing CloudTrail review

---

## EC2 And Auto Scaling

EC2 is flexible but operationally heavier than serverless or managed platforms.

### Instance Family Decision

| Workload | Instance family direction |
|---|---|
| General web/API | General purpose |
| CPU-heavy batch | Compute optimized |
| In-memory analytics | Memory optimized |
| Local high IOPS | Storage optimized |
| ML or graphics | Accelerated computing |

### Pricing Decision

| Pricing model | Use when |
|---|---|
| On-demand | Unknown or temporary workloads |
| Savings Plans | Predictable compute baseline |
| Reserved Instances | Stable long-term instance usage |
| Spot | Stateless, restartable, fault-tolerant jobs |
| Dedicated Host | Licensing or compliance requirement |

### Auto Scaling

Auto Scaling has two dimensions:

- **Scale out**: add more instances.
- **Scale in**: remove instances.

Important production details:

- Health checks should reflect application readiness.
- Scale-in protection may be needed for stateful or long-running tasks.
- Warmup time prevents thrashing.
- Target tracking works well for simple CPU or request-per-target goals.

---

## S3 Operational Design

S3 is object storage with extremely high durability. Use it for static assets, backups, logs, data lakes, and artifacts.

### Storage Classes

| Class | Use case |
|---|---|
| Standard | Frequently accessed data |
| Standard-IA | Infrequent but rapid retrieval |
| One Zone-IA | Cheaper data with AZ-loss tolerance |
| Glacier Instant Retrieval | Archive with millisecond retrieval |
| Glacier Flexible Retrieval | Archive with slower retrieval |
| Deep Archive | Long-term compliance archive |
| Intelligent-Tiering | Unknown or changing access patterns |

### Production Controls

- Block public access by default.
- Use bucket policies intentionally.
- Enable versioning for critical buckets.
- Use lifecycle policies for cost control.
- Enable replication for cross-region recovery needs.
- Use access logs or CloudTrail data events where required.

---

## RDS, Aurora, And RDS Proxy

RDS reduces operational work for relational databases, but it does not remove database engineering.

### RDS Features

- Automated backups
- Point-in-time restore
- Multi-AZ failover
- Read replicas
- Patch management
- Storage autoscaling

### Multi-AZ vs Read Replica

| Feature | Multi-AZ | Read replica |
|---|---|---|
| Purpose | High availability | Read scaling |
| Replication | Synchronous or managed HA | Asynchronous |
| Used by app for reads | Usually no | Yes |
| Failover | Automatic | Manual or promoted depending setup |

### RDS Proxy

RDS Proxy pools and reuses database connections. It is especially useful for Lambda or bursty application workloads that would otherwise open too many database connections.

Use it when:

- Apps frequently open and close connections.
- Lambda functions connect to RDS.
- Failover time matters.
- Database connection exhaustion is a recurring issue.

---

## Lambda And Event-Driven Design

Lambda is good for event-driven workloads, scheduled tasks, light APIs, and asynchronous processing.

Common patterns:

```text
API Gateway -> Lambda -> DynamoDB
S3 object upload -> Lambda -> image or data processing
EventBridge schedule -> Lambda -> automation
SQS queue -> Lambda -> async worker
```

Important limits:

- Maximum execution duration: 15 minutes.
- Memory allocation also affects CPU allocation.
- Cold starts depend on runtime, package size, VPC use, and initialization work.
- Concurrency can protect downstream services or throttle them accidentally.

---

## DynamoDB Design Basics

DynamoDB is not a relational database. It is designed around access patterns.

Key ideas:

- Partition key decides data distribution.
- Sort key enables ordered access within a partition.
- GSI supports alternate query patterns.
- Query is preferred; Scan is expensive on large tables.
- On-demand mode is easier for unpredictable workloads.
- Provisioned mode is cost-effective for stable traffic.

Troubleshooting signs:

- Throttling: capacity or hot partition issue.
- Slow query: missing key design or GSI.
- Expensive workload: scans or poor access pattern modeling.

---

## Load Balancing And CDN

### ALB

Use Application Load Balancer for HTTP/HTTPS microservices, path routing, host routing, headers, and WebSockets.

### NLB

Use Network Load Balancer for TCP/UDP, ultra-low latency, static IP needs, and source IP preservation.

### CloudFront

Use CloudFront for caching static or dynamic content near users, reducing origin load and latency.

Common edge pattern:

```text
Route 53 -> CloudFront -> WAF -> ALB -> app
```

---

## Intermediate Takeaways

1. Network layout determines security and blast radius.
2. IAM design should use roles and environment isolation.
3. EC2 is powerful but operationally heavier.
4. S3 needs policy, lifecycle, and versioning decisions.
5. RDS Multi-AZ is for availability; replicas are for scaling reads.
6. Lambda is excellent for event-driven work but has runtime limits.
7. DynamoDB requires access-pattern-first design.
8. Load balancer health checks must match real app readiness.
