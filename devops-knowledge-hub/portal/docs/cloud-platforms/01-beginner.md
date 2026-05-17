---
title: "Beginner"
sidebar_position: 1
---

# Cloud Platforms — Beginner

Cloud platforms are the infrastructure substrate for modern systems. As an SRE or platform engineer, you do not only “use AWS” or “deploy to GCP.” You make decisions that affect reliability, cost, security, scaling, operability, and incident response for years.

The beginner goal is to build a strong mental model of the cloud:

```text
identity -> network -> compute -> storage -> database -> load balancing -> observability -> cost controls
```

If you understand those layers, individual services become easier to reason about.

---

## Why Cloud Matters For SREs

Cloud platforms give teams managed infrastructure primitives:

- Virtual machines
- Private networks
- Object storage
- Managed databases
- Load balancers
- Serverless compute
- Container platforms
- Monitoring and audit logs
- IAM and policy systems

The SRE value is not just knowing service names. It is knowing the operational tradeoff behind each service.

| Decision | Reliability impact | Cost impact | Security impact |
|---|---|---|---|
| Multi-AZ database | Survives AZ failure | Higher cost | Better resilience |
| Public subnet instance | Easy access | May be cheaper short-term | Larger attack surface |
| Managed database | Less ops burden | Premium price | Provider handles patching layer |
| Spot compute | Cheap capacity | Interruptions possible | Good for stateless jobs |
| Serverless | Auto-scales fast | Can surprise on high volume | Less OS control |

---

## Shared Responsibility Model

Cloud providers are responsible for security **of** the cloud: facilities, hardware, physical networking, and managed service infrastructure.

You are responsible for security **in** the cloud: IAM, data access, application code, network exposure, encryption settings, operating-system patching where applicable, and runtime configuration.

| Service model | Provider manages | You manage |
|---|---|---|
| IaaS | Data center, hardware, hypervisor | OS, app, data, network rules |
| PaaS | Runtime platform, patching layer | App config, data, access policy |
| SaaS/managed service | Most infrastructure | Data, identity, usage, policy |

Example:

- EC2: you patch the OS.
- RDS: provider patches the database platform, but you manage schema, queries, and access.
- S3: provider runs storage, but you own bucket policies and object access.

---

## Account And Project Structure

A beginner mistake is putting everything into one cloud account or project. A production organization usually separates environments.

```text
organization
  -> dev account/project
  -> staging account/project
  -> production account/project
  -> security/logging account/project
  -> shared networking account/project
```

Benefits:

- Smaller blast radius
- Cleaner billing
- Better access control
- Easier audit
- Safer experimentation in dev

For AWS, this is commonly done with AWS Organizations and Service Control Policies. For GCP, folders and projects provide a similar isolation structure. For Azure, management groups, subscriptions, and resource groups form the hierarchy.

---

## IAM Basics

IAM is the cloud security perimeter. Everything in cloud is an API call, and IAM decides which calls are allowed.

Core concepts:

| Concept | Meaning |
|---|---|
| Principal | User, service account, role, or workload identity making a request |
| Policy | Rule document defining allowed or denied actions |
| Role | Assumable identity with temporary permissions |
| Group | Collection of users for easier permission management |
| Permission boundary | Maximum permissions an identity may receive |
| Organization policy | Higher-level guardrail across accounts/projects |

Authorization model:

```text
principal authenticates
  -> principal requests action on resource
  -> policies are evaluated
  -> explicit deny wins
  -> allow is required
  -> otherwise deny by default
```

Beginner rules:

- Do not use root/admin identities for daily work.
- Prefer roles or workload identity over long-lived keys.
- Enable MFA for human access.
- Grant least privilege.
- Review unused permissions.

---

## Networking Basics

A cloud network is the boundary where most architecture decisions start.

AWS terminology:

| Component | Purpose |
|---|---|
| VPC | Isolated virtual network |
| Subnet | IP range inside one Availability Zone |
| Route table | Decides where traffic goes |
| Internet Gateway | Public internet path for public subnets |
| NAT Gateway | Outbound internet path for private subnets |
| Security Group | Stateful firewall near instance or ENI |
| NACL | Stateless subnet-level firewall |
| VPC Endpoint | Private access to cloud services |
| Transit Gateway | Hub for many VPCs and networks |

Typical VPC shape:

```text
VPC 10.0.0.0/16
  public subnet a:   10.0.101.0/24
  public subnet b:   10.0.102.0/24
  private subnet a:  10.0.1.0/24
  private subnet b:  10.0.2.0/24
  database subnet a: 10.0.11.0/24
  database subnet b: 10.0.12.0/24
```

Public subnets host internet-facing load balancers or NAT gateways. Application and database workloads should usually live in private subnets.

---

## Compute Options

Cloud compute comes in several models.

| Model | AWS example | Good for | Tradeoff |
|---|---|---|---|
| Virtual machine | EC2 | Full control, legacy apps | You manage OS lifecycle |
| Containers | ECS, EKS, Fargate | Microservices | Platform complexity |
| Serverless function | Lambda | Event-driven tasks | Runtime limits, cold starts |
| Managed app platform | Elastic Beanstalk, App Runner | Fast deployment | Less control |

EC2 pricing models:

- On-demand: flexible, highest cost.
- Reserved Instances or Savings Plans: cheaper for predictable use.
- Spot Instances: large discount, can be interrupted.
- Dedicated hosts: compliance or licensing needs.

---

## Storage And Databases

Object storage and databases solve different problems.

| Need | Service family |
|---|---|
| Static files, backups, logs, data lake | Object storage such as S3 |
| Transactional relational workload | RDS, Aurora, Cloud SQL, Azure SQL |
| Key-value or document workload | DynamoDB, Firestore, Cosmos DB |
| Cache | ElastiCache, Memorystore, Azure Cache |
| Block storage for VM | EBS, Persistent Disk, Managed Disk |

S3 mental model:

```text
bucket -> object key -> object bytes + metadata
```

S3 is not a POSIX filesystem. It is an object store with HTTP API semantics.

RDS mental model:

```text
application -> connection pool/proxy -> database endpoint -> storage and replicas
```

Managed databases reduce operational burden, but they do not remove schema design, query tuning, connection management, or backup testing.

---

## Load Balancing And DNS

Load balancers distribute traffic. DNS decides where clients start.

AWS examples:

| Service | Purpose |
|---|---|
| Route 53 | DNS and traffic policy |
| ALB | Layer 7 HTTP/HTTPS routing |
| NLB | Layer 4 TCP/UDP routing |
| CloudFront | CDN and edge caching |
| WAF | Web application filtering |

A basic web request path:

```text
user -> DNS -> CDN -> load balancer -> service -> pod/instance -> database
```

SREs should be able to trace failures across this path.

---

## Observability And Audit

Minimum cloud observability baseline:

- Metrics for compute, database, storage, and load balancer
- Logs for application and platform components
- Audit logs for API calls
- Flow logs for network traffic
- Alerts for availability, saturation, error rate, and security events

AWS examples:

| Need | Service |
|---|---|
| Metrics and logs | CloudWatch |
| API audit | CloudTrail |
| Network flow logs | VPC Flow Logs |
| Security findings | GuardDuty, Security Hub |
| Config drift | AWS Config |

---

## Beginner Architecture: Three-Tier App

Classic AWS pattern:

```text
Route 53
  -> CloudFront
  -> ALB in public subnets
  -> EC2/EKS/ECS app in private subnets
  -> RDS in isolated database subnets
```

Key rules:

- Keep databases private.
- Put load balancers, not app nodes, on the public edge.
- Use multiple Availability Zones.
- Use Auto Scaling for stateless compute.
- Use managed database backups and failover.
- Use IAM roles for workloads.

---

## Beginner Takeaways

1. IAM controls cloud API access.
2. Network design defines blast radius.
3. Multi-AZ is the default for production reliability.
4. Public subnets should be used intentionally and sparingly.
5. Managed services reduce undifferentiated operations work.
6. Serverless reduces infrastructure management but adds runtime limits.
7. Cost is an architecture concern, not only a finance concern.
8. Audit logs and flow logs are essential for incident response.
