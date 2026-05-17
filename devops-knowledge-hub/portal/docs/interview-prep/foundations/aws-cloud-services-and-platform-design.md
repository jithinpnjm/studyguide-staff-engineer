---
title: "Foundations: AWS Zero-To-Hero SRE Conceptual Guide"
sidebar_position: 14
---

# Foundations: AWS Zero-To-Hero SRE Conceptual Guide

This guide turns the AWS Solutions Architect slide topics into SRE learning material. It is deliberately not written as certification notes, a service encyclopedia, or a shallow list of AWS features. The goal is to rebuild AWS intuition from the perspective of a Linux/Kubernetes-aware engineer who understands systems but has forgotten the AWS-specific shapes.

The teaching rule for this guide is simple: always learn the operational problem before memorizing the AWS service name. A service exists because some recurring infrastructure pain exists: identity sprawl, packet routing, database failover, burst absorption, global latency, deployment safety, auditability, or cost control. If you remember the pain, the service becomes easier to remember.

Use it in this order:

1. Learn the AWS primitives: accounts, Regions, AZs, IAM, VPC, EC2, S3.
2. Learn production building blocks: load balancing, autoscaling, managed databases, DNS, CDN, queues, containers, serverless.
3. Learn SRE operation: observability, audit, security, cost, disaster recovery, incident debugging.
4. Practice explaining tradeoffs: when to use which service, what can fail, how you recover, and what it costs.

Every major topic should be read through this production lens:

```text
Problem -> Mental model -> Request/packet flow -> Failure modes
        -> Debugging method -> Scaling impact -> Cost impact -> Security impact
```

For interviews, avoid junior answers that only name a feature. A senior answer explains the mechanism and the operational consequence.

Example:

```text
Junior: "NAT Gateway gives private subnets internet."

Senior: "Private workloads often need outbound access for patches, package downloads,
container pulls, or third-party APIs without becoming publicly reachable. NAT Gateway
solves that by translating outbound connections from private IPs to a public egress
address and tracking return traffic. Operationally, this means inbound internet still
cannot directly reach the instance, but outbound-heavy workloads can create a large
NAT bill or a zonal dependency if routing is designed poorly."
```

Core AWS documentation cross-checks:

- AWS Regions and Availability Zones: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html
- AWS IAM policy evaluation: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html
- Amazon EC2 Auto Scaling groups: https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scaling-groups.html
- Elastic Load Balancing health checks: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
- Amazon S3 Versioning: https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html
- Amazon S3 Lifecycle transitions: https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html
- Amazon RDS Multi-AZ: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html
- Amazon VPC route tables: https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html
- AWS Well-Architected Framework: https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
- Amazon ECS task role: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
- Amazon ECS task execution role: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html

---

# 1. AWS Mental Model

AWS is a global cloud platform, but that phrase is too abstract to be useful during an incident. A better mental model is this: AWS is a programmable set of failure domains, trust boundaries, network paths, and managed control planes. You are not only launching servers; you are deciding where failure is allowed to stop, who is allowed to act, and how packets and API calls move through the system.

The SRE way to understand AWS is to map every design decision to five boundaries:

| Boundary | AWS Concept | SRE Question |
|---|---|---|
| Ownership | Account, Organization, OU | Who owns this workload and blast radius? |
| Geography | Region | Where does data live and where are users? |
| Failure | Availability Zone | What happens if one AZ fails? |
| Network | VPC, subnet, route table, SG, NACL | What path does traffic take? |
| Trust | IAM, KMS, resource policies | Who can do what, to what, from where? |

AWS is not one giant computer. It is a collection of separately scoped systems. Some resources are global, many are regional, and some are zonal. Misunderstanding that scope is a common root cause of outages because engineers assume redundancy exists where it does not.

Example:

```text
Global: IAM users, Route 53 public hosted zones, CloudFront
Regional: VPC, ALB, RDS, Lambda, DynamoDB table, S3 bucket location
Zonal: EC2 instance, EBS volume, subnet, NAT Gateway
```

During debugging, the first useful question is not "which AWS service is broken?" It is "which boundary did the failure cross?" If one AZ is unhealthy, the blast radius should stop at that AZ. If one IAM role is misconfigured, the blast radius should stop at that workload. If one service deploy is bad, the blast radius should not become a Region-wide outage.

Junior explanation: AWS gives you services like EC2, S3, RDS, and VPC.

Senior explanation: AWS gives you isolated scopes and managed primitives. Good architecture composes them so identity, network, data, and failure boundaries stay understandable during normal operations and under pressure.

---

# 2. Global Infrastructure: Regions, AZs, Edge

## Region

A Region exists because applications need geographic placement. Latency, compliance, service availability, and disaster recovery are all geographic problems. A Region such as `us-east-1`, `eu-west-1`, or `ap-south-1` is AWS's unit for placing workloads in a broad physical part of the world. AWS documentation states that each Region is designed to be isolated from other Regions. Most services create resources inside one Region, and resources are not automatically replicated across Regions unless the service or your design explicitly does that.

Choosing a Region is therefore not a cosmetic decision. It affects user latency, legal exposure, AWS feature availability, cost, and DR architecture. A team that picks `us-east-1` just because tutorials use it may later discover that European users have poor latency or that data residency requirements were violated.

Choose a Region based on:

- compliance and data residency
- latency to users
- service availability
- pricing
- disaster recovery requirements

Example: if most customers are in Germany and data residency matters, `eu-central-1` may be a better default than `us-east-1`, even if some examples online use `us-east-1`.

## Availability Zone

An Availability Zone exists because hardware, power, cooling, and network failures are inevitable. Instead of pretending a data center never fails, AWS exposes AZs so you can spread a workload across independent failure domains. An AZ is made of one or more data centers with independent power, networking, and connectivity. AZs in the same Region are connected by low-latency private networking.

The operational consequence is important: "deployed in AWS" does not automatically mean highly available. If every EC2 instance, EBS volume, NAT Gateway, and database dependency lives in one AZ, the application is still a single-site system with cloud branding.

Production principle:

- one AZ is a failure domain
- two AZs are the minimum for common HA
- three AZs are better when the service supports it and cost allows it

Bad design:

```text
ALB in 2 AZs
App instances in 2 AZs
Database accidentally in 1 AZ
```

This looks multi-AZ, but the database is still a single-AZ dependency.

Common failure: one AZ has impaired networking. The ALB still exists, Route 53 still resolves, and some application instances still look healthy, but requests fail whenever they land on targets that depend on the impaired AZ. Junior engineers often chase application logs first. Senior engineers split metrics by AZ, inspect target health by AZ, check database failover state, and verify whether any supposedly shared dependency is actually zonal.

## Edge Locations

Edge locations exist because user experience is often limited by distance. A packet from Sydney to Virginia and back cannot beat physics. Edge services like CloudFront, Route 53, AWS WAF, and Global Accelerator move caching, TLS termination, DNS responses, routing decisions, and some security controls closer to users.

The mental model is "front door near the user, origin deeper in AWS." The edge may absorb DDoS traffic, serve cached assets, or choose a healthier Region before the request reaches your application stack.

Use edge services when you need:

- lower global latency
- static content caching
- TLS termination near users
- DDoS absorption at the edge
- global traffic entry points

---

# 3. Accounts, Organizations, And Landing Zone

An AWS account exists to create a hard administrative boundary. Treating accounts as folders is one of the fastest ways to create production risk. A folder organizes things; an AWS account isolates permissions, billing, quotas, audit trails, and blast radius.

In Linux terms, an account is closer to a separate machine or security domain than a directory. In Kubernetes terms, it is much stronger than a namespace. A namespace can help organize workloads, but the Kubernetes control plane is still shared. An AWS account gives you a separate IAM boundary, separate service quotas, and a separate billing surface.

Recommended structure:

```text
AWS Organization
  Management account
  Security / Audit account
  Log archive account
  Shared network account
  Dev workload accounts
  Staging workload accounts
  Production workload accounts
```

Why multiple accounts matter:

- production mistakes do not damage experiments
- billing and cost allocation are clearer
- service quotas are separated
- IAM policies are easier to reason about
- CloudTrail and security logs can be centralized
- Service Control Policies can enforce guardrails

## Service Control Policies

SCPs solve the problem of account-level freedom becoming organization-level danger. They are organization-level guardrails. They do not grant permissions by themselves. They define the maximum permissions an account can use.

Example guardrails:

- deny disabling CloudTrail
- deny public S3 bucket changes except from security automation
- deny launching resources outside approved Regions
- deny deleting backup vaults

SRE mental model:

```text
Effective permission =
identity policy
+ resource policy
+ session policy
+ permissions boundary
within SCP limits
with explicit deny always winning
```

Production failure mode: a team deploys a valid IAM policy but still gets `AccessDenied`. The policy may be correct inside the account, but an SCP at the OU level denies the action. Junior debugging stops at the role policy. Senior debugging evaluates the whole permission chain: identity policy, resource policy, session policy, permissions boundary, SCP, KMS key policy, and condition keys.

---

# 4. IAM From First Principles

IAM exists because cloud infrastructure is controlled by APIs. In a traditional Linux server, authorization might mean file permissions, sudoers, SSH keys, and process ownership. In AWS, nearly every meaningful action is an API call: create an instance, read an object, decrypt a secret, change a route table, assume a role, delete a snapshot. IAM is the authorization system for those API calls.

IAM answers:

```text
Who can do what to which resource under what conditions?
```

Core parts:

| IAM Concept | Meaning |
|---|---|
| Principal | The actor: user, role, AWS service, federated identity |
| Action | API operation, such as `s3:GetObject` |
| Resource | Target ARN, such as a bucket or role |
| Condition | Extra rule, such as source IP, MFA, tag, VPC endpoint |
| Policy | JSON document that allows or denies |
| Role | Assumable identity with temporary credentials |
| Trust policy | Who is allowed to assume the role |

## IAM Users vs Roles

Use IAM users rarely because long-lived human credentials age badly. They get copied into laptops, scripts, CI systems, and forgotten terminals. Prefer federation through IAM Identity Center or an external identity provider. For workloads, use roles because roles issue temporary credentials and can be scoped to the runtime identity.

Examples:

- EC2 instance role lets an instance call AWS APIs without static keys.
- Lambda execution role lets a function write logs and access dependencies.
- ECS task role gives each task its own scoped permissions.
- EKS IRSA or Pod Identity gives Kubernetes workloads AWS permissions without long-lived keys.

## Explicit Deny Wins

AWS policy evaluation gives priority to explicit deny. This is not trivia; it is the core safety mechanism that allows broad guardrails to override local mistakes. If one policy allows `s3:PutObject` but another policy explicitly denies it, the result is deny.

SRE debugging flow for `AccessDenied`:

1. Confirm caller identity: `aws sts get-caller-identity`.
2. Identify the API action and resource ARN.
3. Check identity policy.
4. Check resource policy.
5. Check trust policy if role assumption failed.
6. Check SCP, permissions boundary, session policy, and condition keys.
7. Use CloudTrail to confirm the exact denied API call.

The operational symptom is often misleading. An app may log "S3 upload failed" or "database password cannot be decrypted," but the real issue may be an STS assume-role failure, a KMS key policy mismatch, an SCP deny, or a missing VPC endpoint condition. The fastest path is to identify the exact AWS API call that failed, the principal that made it, and the resource ARN it targeted.

Good IAM habits:

- use least privilege
- use roles and temporary credentials
- avoid long-lived access keys
- require MFA for humans
- separate deploy, runtime, and break-glass roles
- use conditions like `aws:PrincipalOrgID`, `aws:SourceVpce`, and resource tags where useful

Junior explanation: IAM is users, groups, roles, and policies.

Senior explanation: IAM is distributed authorization for AWS API calls. You debug it by reconstructing the request context: principal, action, resource, conditions, trust path, organization guardrails, and explicit denies.

---

# 5. EC2: Virtual Machines In AWS

Amazon EC2 gives you virtual machines. You control the OS, packages, runtime, agent configuration, patching, and much of the operational burden.

Key configuration choices:

| Option | Why It Matters |
|---|---|
| AMI | Base machine image and patch level |
| Instance type | CPU, memory, network, storage profile |
| User data | Bootstrap script run at launch |
| Security group | Network access to the instance |
| IAM role | AWS API permissions from the instance |
| EBS volumes | Persistent block storage |
| Placement group | Low latency, partitioning, or spreading |

## Instance Families

- General purpose: balanced workloads.
- Compute optimized: CPU-heavy services.
- Memory optimized: caches, in-memory databases, analytics.
- Storage optimized: high local disk throughput.
- Accelerated computing: GPU or specialized hardware.

SRE lesson: do not choose instance types by guessing. Use metrics: CPU, memory, disk IOPS, network, p95 latency, and saturation during peak.

## User Data

User data is useful for bootstrapping, but it should not become a fragile deployment system.

Good use:

```text
install agent
fetch configuration
join cluster
start service
```

Poor use:

```text
clone random branch
build production app on first boot
silently ignore bootstrap failure
```

## Purchasing Options

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

# 6. EC2 Networking And Security Groups

Every EC2 instance has network interfaces. Traffic is controlled mainly by security groups and route tables.

## Security Groups

Security groups are stateful, resource-level firewalls. They allow traffic; they do not create deny rules. If inbound traffic is allowed, response traffic is automatically allowed back.

Classic three-tier setup:

```text
Internet -> ALB security group: allow 443 from 0.0.0.0/0
ALB -> App security group: allow app port from ALB SG
App -> DB security group: allow DB port from App SG
```

Use security group references instead of broad CIDR ranges when possible.

## Important Ports

| Port | Service |
|---|---|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL / Aurora MySQL |
| 5432 | PostgreSQL / Aurora PostgreSQL |
| 6379 | Redis |
| 2049 | NFS / EFS |

SRE debugging question: "Is the traffic allowed at every hop: source SG, destination SG, NACL, route table, target health, app listener?"

---

# 7. EC2 Storage: EBS, Instance Store, EFS, AMI

## EBS

Elastic Block Store is persistent block storage for EC2. EBS volumes are AZ-scoped. An instance in `us-east-1a` cannot directly attach an EBS volume from `us-east-1b`.

Use EBS for:

- OS root volumes
- databases on EC2
- durable single-instance data
- boot disks

EBS snapshots are stored in S3-managed infrastructure and can be copied across Regions.

## EBS Volume Types

| Type | Best For |
|---|---|
| gp3 | general-purpose SSD, default for many workloads |
| io1/io2 | high IOPS and latency-sensitive databases |
| st1 | throughput-optimized HDD |
| sc1 | cold HDD |

SRE habit: use `gp3` intentionally because it decouples size from IOPS/throughput better than older defaults.

## Instance Store

Instance store is physically attached temporary storage. It is fast but ephemeral. Data disappears when the instance is stopped, terminated, or fails depending on instance behavior.

Use it for caches, scratch space, and replicated systems. Do not use it as the only copy of important data.

## EFS

Elastic File System is managed NFS shared storage. It can be mounted by multiple compute resources across AZs.

Use EFS for:

- shared application files
- content directories
- lift-and-shift apps that expect a filesystem
- ECS/EKS shared volumes

Tradeoff: EFS is convenient, but performance mode, throughput mode, and cost need testing.

## AMI

An Amazon Machine Image is a template for launching EC2 instances. For production, prefer repeatable image pipelines.

Good pattern:

```text
base AMI -> hardened AMI -> app AMI -> launch template -> Auto Scaling group
```

---

# 8. Load Balancing And High Availability

High availability means the system keeps serving when common components fail. Scalability means the system can handle more load. They are related but not the same.

## Vertical vs Horizontal Scaling

- Vertical scaling: use a bigger machine.
- Horizontal scaling: use more machines.

Cloud-native designs usually prefer horizontal scaling for stateless services.

## Elastic Load Balancing

| Load Balancer | Layer | Use Case |
|---|---|---|
| ALB | Layer 7 HTTP/HTTPS | path routing, host routing, web apps, APIs |
| NLB | Layer 4 TCP/UDP/TLS | very high performance, static IP, non-HTTP |
| Gateway Load Balancer | Layer 3/4 appliance flow | firewalls, inspection appliances |

## Health Checks

Load balancers route to healthy targets. AWS documentation notes that ALB target groups periodically send health check requests and route to healthy targets in enabled AZs.

Design health checks carefully:

- `/healthz` should check whether the instance can serve traffic.
- `/readyz` should fail if dependencies needed for serving are unavailable.
- Do not make health checks so deep that one dependency blip removes every target.
- Watch for the ALB fail-open behavior when every target is unhealthy.

## Sticky Sessions

Sticky sessions keep a user on the same target. They can help legacy stateful apps but reduce flexibility.

Better pattern:

```text
stateless app
session state in ElastiCache or DynamoDB
files in S3 or EFS
database in RDS/Aurora
```

---

# 9. Auto Scaling Groups

An Auto Scaling group manages a fleet of EC2 instances. AWS documentation describes two core behaviors: maintain desired capacity and scale dynamically using policies.

Important terms:

| Term | Meaning |
|---|---|
| Launch template | how to create instances |
| Desired capacity | current intended number of instances |
| Minimum capacity | lower bound |
| Maximum capacity | upper bound |
| Health check | how ASG decides replacement |
| Scaling policy | when to add/remove instances |
| Cooldown/warmup | avoid overreacting during scaling |

Good scaling metrics:

- ALB request count per target
- CPU for CPU-bound services
- queue depth per worker
- custom business throughput metrics

Poor scaling metrics:

- total request count without dividing by capacity
- memory if not published
- CPU for an I/O-bound service

SRE failure mode: ASG launches new instances, but they never become healthy because user data fails, AMI is broken, subnets have no IPs, or target group health check path is wrong.

---

# 10. VPC: AWS Networking Core

A VPC is your private network boundary in a Region.

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

## Public vs Private Subnet

A subnet is public if its route table has a route to an Internet Gateway and instances have public addressing. A subnet is private when it has no direct inbound internet path.

Common design:

```text
Public subnet: ALB, NAT Gateway, bastion only if required
Private app subnet: EC2, ECS, EKS nodes, Lambda ENIs
Private data subnet: RDS, ElastiCache, internal services
```

## Route Tables

Route tables decide the next hop.

Examples:

```text
Public subnet:
0.0.0.0/0 -> Internet Gateway

Private subnet:
0.0.0.0/0 -> NAT Gateway

S3 private access:
pl-xxxx -> Gateway VPC Endpoint
```

## NAT Gateway

NAT Gateway allows private subnet workloads to initiate outbound IPv4 internet connections. It does not allow inbound internet connections to private instances.

Important cost warning: NAT Gateway charges for hours and data processing. Heavy traffic to S3, ECR, CloudWatch, or other AWS services through NAT can become expensive. Prefer VPC endpoints where appropriate.

## NACLs

Network ACLs are stateless subnet-level controls. They support allow and deny rules. Because they are stateless, return traffic must be explicitly allowed, including ephemeral ports.

Use NACLs as coarse guardrails, not as the primary application firewall.

## VPC Endpoints And PrivateLink

VPC endpoints keep traffic private between your VPC and supported AWS services.

| Endpoint Type | Common Use |
|---|---|
| Gateway endpoint | S3, DynamoDB |
| Interface endpoint | most AWS service APIs through PrivateLink |

Use endpoints to:

- reduce NAT usage
- keep traffic on private AWS network paths
- restrict access with endpoint policies
- support private subnets without broad internet egress

## VPC Flow Logs

VPC Flow Logs record metadata about IP traffic. They do not capture packet payloads.

Use them for:

- security group/NACL troubleshooting
- unexpected egress detection
- NAT cost investigation
- incident timelines

---

# 11. Route 53 And DNS

DNS maps names to answers. Route 53 is AWS's DNS and domain registration service.

Core terms:

| Term | Meaning |
|---|---|
| Hosted zone | DNS zone container |
| Record | DNS entry, such as A, AAAA, CNAME, TXT |
| TTL | how long clients/resolvers cache an answer |
| Alias | AWS-specific record pointing to AWS resources |
| Health check | DNS failover signal |

## Public vs Private Hosted Zones

- Public hosted zone: resolvable from the internet.
- Private hosted zone: resolvable only inside associated VPCs.

## Routing Policies

| Policy | Use Case |
|---|---|
| Simple | one answer |
| Weighted | traffic split, canary, migration |
| Latency | route to low-latency Region |
| Failover | active-passive DR |
| Geolocation | route by user location |
| Geoproximity | location plus bias |
| Multi-value answer | simple health-aware multiple records |
| IP-based | route based on client CIDR |

SRE caution: DNS failover is limited by TTL, resolver behavior, and health-check design. It is not instant failover.

---

# 12. S3: Object Storage Backbone

S3 stores objects in buckets. It is not a filesystem and not a block device. Think "key-value object store with HTTP APIs."

Use S3 for:

- backups
- logs
- data lakes
- static websites
- artifacts
- Terraform state
- ML datasets
- event-driven ingestion

## Buckets And Objects

Bucket names are globally unique. Objects have keys, metadata, content, version IDs when versioning is enabled, and optional tags.

## S3 Security

Control access with:

- IAM identity policies
- bucket policies
- access points
- ACLs only for legacy cases
- Block Public Access
- encryption
- VPC endpoint policies

Default habit: keep Block Public Access on unless there is a deliberate, reviewed reason.

## Versioning

AWS documentation states that S3 Versioning keeps multiple variants of an object and helps recover from accidental deletion or overwrite. Deletes create delete markers instead of immediately removing prior versions.

Use versioning for:

- Terraform state
- critical configuration
- user-uploaded content
- backup protection

Remember: versions cost money because each version is stored.

## Replication

- Same-Region Replication: replicate inside a Region.
- Cross-Region Replication: replicate to another Region.

Replication needs versioning. It is useful for compliance, latency, account separation, and DR. It is not a substitute for understanding consistency, delete behavior, and KMS permissions.

## Storage Classes

| Class | Use Case |
|---|---|
| Standard | frequently accessed data |
| Intelligent-Tiering | unknown/changing access patterns |
| Standard-IA | infrequent access, multi-AZ resilience |
| One Zone-IA | infrequent, recreatable data |
| Glacier Instant Retrieval | archive with instant access |
| Glacier Flexible Retrieval | archive with minutes/hours retrieval |
| Glacier Deep Archive | lowest-cost long-term archive |
| Express One Zone | high-performance single-AZ object access |

## Lifecycle Rules

Lifecycle rules transition or expire objects. Use them for logs, backups, and old versions.

Example:

```text
Application logs:
0-30 days: S3 Standard
31-180 days: Standard-IA or Intelligent-Tiering
181+ days: Glacier
365+ days: expire if policy allows
```

## S3 Events

S3 can send event notifications to Lambda, SQS, SNS, or EventBridge.

Use cases:

- image processing
- data ingestion
- malware scanning
- indexing
- notification workflows

---

# 13. CloudFront, WAF, And Global Accelerator

## CloudFront

CloudFront is a CDN. It caches content at edge locations and forwards cache misses to origins such as S3, ALB, API Gateway, or custom HTTP servers.

Use CloudFront for:

- static websites
- global APIs
- TLS at edge
- origin shielding
- WAF integration
- signed URLs/cookies

CloudFront vs S3 replication:

- CloudFront improves read latency through caching.
- S3 replication creates another copy of the object.

## Cache Invalidation

Invalidations remove cached objects before TTL expiry. They are useful but should not be your only deployment strategy. Prefer versioned asset names for static files.

## WAF

AWS WAF protects HTTP(S) workloads with rules. It integrates with CloudFront, ALB, API Gateway, and other supported services.

Use WAF for:

- IP block/allow lists
- managed rule groups
- SQL injection/XSS filters
- rate limiting
- bot controls

## Global Accelerator

Global Accelerator provides static anycast IPs and routes users over the AWS global network to healthy regional endpoints.

Choose:

- CloudFront for HTTP caching and edge content.
- Global Accelerator for static IPs, fast regional failover, and non-cacheable TCP/UDP use cases.

---

# 14. Databases: RDS, Aurora, DynamoDB, ElastiCache

## RDS

RDS is managed relational database hosting for engines such as PostgreSQL, MySQL, MariaDB, Oracle, and SQL Server.

AWS manages:

- provisioning
- backups
- patching options
- monitoring integrations
- failover automation when Multi-AZ is enabled

You still own:

- schema design
- indexes
- query performance
- connection management
- parameter choices
- backup retention choices
- application retry behavior

## RDS Multi-AZ

AWS documentation distinguishes Multi-AZ DB instance deployments and Multi-AZ DB cluster deployments. A classic Multi-AZ DB instance has a standby for failover but does not serve read traffic. Multi-AZ DB clusters can have readable standby instances depending on engine/support.

SRE rule: Multi-AZ is high availability, not read scaling by default.

## Read Replicas

Read replicas scale reads and can support reporting. They are usually asynchronous. They can lag.

Use read replicas when:

- reads dominate writes
- reporting queries should not hurt primary
- cross-Region read locality is needed

Do not assume replicas provide zero-data-loss failover.

## Aurora

Aurora is AWS's cloud-native relational database compatible with MySQL or PostgreSQL. It separates compute from distributed storage and supports replicas, fast failover patterns, custom endpoints, and serverless modes.

Use Aurora when:

- you want managed relational semantics with better cloud-native scaling
- read scaling and failover matter
- you can accept Aurora-specific operational behavior and pricing

## RDS Proxy

RDS Proxy pools and reuses database connections. It is especially useful for Lambda or bursty applications that would otherwise exhaust DB connections.

## DynamoDB

DynamoDB is a managed NoSQL key-value/document database. Design starts with access patterns, not normalized relational modeling.

Core concepts:

| Concept | Meaning |
|---|---|
| Partition key | primary distribution key |
| Sort key | ordered key within partition |
| GSI | alternate query pattern |
| LSI | alternate sort key for same partition key |
| Streams | change events |
| TTL | automatic item expiry |
| Global table | multi-Region replicated table |

Capacity modes:

- On-demand: simple, good for unpredictable traffic.
- Provisioned: controlled capacity, useful for predictable workloads.

Common mistake: creating a table first, then discovering you cannot query it efficiently. In DynamoDB, model queries first.

## ElastiCache

ElastiCache provides managed Redis or Memcached-compatible caching.

Use it for:

- database query cache
- session store
- rate limiting
- distributed locks with care
- leaderboards/counters

Cache patterns:

- Lazy loading: app reads cache, falls back to DB, writes cache.
- Write-through: app writes cache and DB together.
- TTL-based: stale data expires automatically.

SRE warning: a cache outage should not become a total outage unless the business explicitly accepts that dependency.

---

# 15. Messaging And Event-Driven Systems

Messaging decouples producers and consumers. It helps absorb bursts and isolate failures.

## SQS

SQS is a queue. Producers send messages, consumers poll and process them.

Important ideas:

| Concept | Meaning |
|---|---|
| Visibility timeout | time message is hidden after a consumer receives it |
| Dead-letter queue | failed messages after max receives |
| Long polling | wait for messages instead of tight polling |
| FIFO queue | ordered, exactly-once processing semantics within constraints |

SRE pattern:

```text
ALB/API -> app -> SQS -> worker ASG/ECS -> database
```

Scale workers on queue depth per worker.

## SNS

SNS is pub/sub fanout. One message can go to many subscribers: SQS, Lambda, HTTP endpoints, email, SMS, and more.

Pattern:

```text
S3 event -> SNS topic -> multiple SQS queues -> independent consumers
```

## EventBridge

EventBridge routes events using rules. It is useful for SaaS integrations, AWS service events, scheduled jobs, and event buses.

Use EventBridge when you need event filtering/routing rather than simple queue buffering.

## Kinesis Data Streams And Firehose

- Kinesis Data Streams: real-time stream processing with shards and consumers.
- Data Firehose: delivery service into destinations like S3, Redshift, OpenSearch, and third-party endpoints.

Use Kinesis for ordered streaming and real-time processing. Use Firehose when you mainly need managed delivery.

## Amazon MQ

Amazon MQ is managed ActiveMQ/RabbitMQ-compatible messaging. Use it when migrating applications that already depend on those protocols.

---

# 16. Containers: ECS, ECR, EKS, Fargate

## ECR

Elastic Container Registry stores container images. Use lifecycle policies to remove old images and vulnerability scanning where appropriate.

## ECS

Elastic Container Service runs containers with AWS-native orchestration.

Launch options:

- EC2 launch type: you manage cluster capacity.
- Fargate launch type: AWS manages the underlying compute.

ECS concepts:

| Concept | Meaning |
|---|---|
| Cluster | logical grouping |
| Task definition | container spec |
| Task | running copy |
| Service | keeps desired tasks running |
| Task role | AWS permissions for app |
| Execution role | permissions for ECS agent actions |

Use ECS when you want containers without managing Kubernetes.

## EKS

Elastic Kubernetes Service provides a managed Kubernetes control plane. You still operate worker nodes, add-ons, networking, policies, upgrades, and workload design.

Node options:

- managed node groups
- self-managed nodes
- Fargate profiles
- Karpenter-managed capacity

Important SRE topics:

- VPC CNI IP exhaustion
- CoreDNS health
- load balancer controller
- EBS/EFS CSI drivers
- IAM Roles for Service Accounts or Pod Identity
- Kubernetes version upgrades
- node disruption budgets
- cluster autoscaling/Karpenter behavior

Choose EKS when Kubernetes portability/ecosystem matters enough to justify the complexity.

---

# 17. Serverless: Lambda, API Gateway, Step Functions, Cognito

## Lambda

Lambda runs functions without managing servers. You pay per request and execution duration.

Use Lambda for:

- event handlers
- lightweight APIs
- automation
- scheduled tasks
- file processing

Know the limits:

- cold starts
- timeout
- memory/CPU sizing relationship
- concurrency limits
- package size and runtime constraints
- VPC networking effects

Concurrency controls:

- Reserved concurrency: guarantees and caps function concurrency.
- Provisioned concurrency: keeps environments warm to reduce cold starts.

## API Gateway

API Gateway exposes APIs and integrates with Lambda, HTTP services, and AWS services.

Endpoint types:

- Edge-optimized: global edge entry.
- Regional: regional API endpoint.
- Private: accessible through VPC endpoints.

Security options:

- IAM auth
- Lambda authorizers
- Cognito authorizers
- resource policies
- throttling and usage plans

## Step Functions

Step Functions orchestrates workflows. Use it when business logic has multiple steps, retries, waits, branches, and compensating actions.

Good for:

- order workflows
- data pipelines
- human approval flows
- long-running orchestration

## Cognito

Cognito User Pools handle user sign-up/sign-in. Cognito Identity Pools exchange user identity for AWS credentials to access AWS resources directly.

SRE caution: direct client access to AWS resources must be tightly scoped and tested with real authorization boundaries.

---

# 18. Common Architecture Patterns

## Stateless Web App

Start:

```text
EC2 instance with local app
```

Production evolution:

```text
Route 53
  -> CloudFront + WAF
  -> ALB across AZs
  -> Auto Scaling group across private subnets
  -> RDS/Aurora Multi-AZ
  -> S3 for static/user files
  -> CloudWatch logs/metrics/alarms
```

Key idea: stateless app instances can be replaced at any time.

## Stateful Web App

State must move out of the instance:

| State | Better Home |
|---|---|
| Session | ElastiCache or DynamoDB |
| User uploads | S3 or EFS |
| Relational data | RDS/Aurora |
| Logs | CloudWatch Logs/S3/OpenSearch |

Sticky sessions can buy time for legacy apps, but they are not the end state for resilient design.

## Serverless Website

```text
CloudFront
  -> S3 static frontend
  -> API Gateway
  -> Lambda
  -> DynamoDB
  -> EventBridge/SQS/SNS for async work
```

Useful for low-ops apps, unpredictable traffic, and event-driven workflows.

## Microservices

Microservices need more than small services. They require:

- clear service ownership
- independent deployment
- observability per service
- API contracts
- retry/timeouts/circuit breakers
- async messaging for decoupling
- good incident ownership

Without those, microservices become distributed confusion.

---

# 19. Observability, Audit, And Operations

## CloudWatch Metrics

Metrics are numeric time series. Use them for dashboards, alarms, autoscaling, and SLOs.

Important examples:

- ALB `TargetResponseTime`, `HTTPCode_Target_5XX_Count`
- EC2 CPU, disk, network, status checks
- RDS CPU, connections, free storage, replica lag
- Lambda errors, duration, throttles, concurrent executions
- SQS approximate age of oldest message and queue depth

## CloudWatch Logs

Centralize application and system logs. Use structured JSON logs where possible.

CloudWatch Logs Insights can query logs during incidents.

## CloudWatch Alarms

Alarm on user impact and saturation, not only resource usage.

Good alarms:

- high 5xx rate
- p95 latency above SLO
- queue age rising
- RDS storage low
- Lambda throttles
- failed health checks

Noisy alarms destroy trust. Tune thresholds and add runbooks.

## CloudTrail

CloudTrail records AWS API activity. It is the audit trail for "who changed what."

Use CloudTrail for:

- IAM incident investigation
- deletion/change tracking
- unauthorized access investigation
- EventBridge rules triggered by API calls

## AWS Config

AWS Config records resource configuration history and evaluates rules.

Use it for:

- detecting public S3 buckets
- tracking security group drift
- checking encryption
- compliance evidence
- remediation automation

## CloudWatch vs CloudTrail vs Config

| Service | Best Question |
|---|---|
| CloudWatch | What is happening operationally? |
| CloudTrail | Who called which AWS API? |
| Config | What did this resource configuration look like over time? |

---

# 20. Security, Encryption, And Threat Detection

## Encryption

Three common layers:

- in transit: TLS/HTTPS
- at rest: encrypted storage
- client-side: app encrypts before sending to AWS

## KMS

AWS KMS manages encryption keys used by many AWS services.

Key ideas:

- AWS owned keys: managed by AWS, not visible to you.
- AWS managed keys: managed by AWS for a service in your account.
- Customer managed keys: you control policy, rotation, aliases, grants.
- Multi-Region keys: related keys in multiple Regions for some client-side or cross-Region designs.

KMS access requires both key policy and IAM/resource permissions to line up.

## Secrets Manager vs SSM Parameter Store

| Service | Best For |
|---|---|
| Secrets Manager | secrets with rotation, database credentials, multi-Region secrets |
| SSM Parameter Store | configuration values and simpler secrets |

## ACM

AWS Certificate Manager issues and manages TLS certificates for supported AWS services such as ALB, CloudFront, and API Gateway.

## CloudHSM

CloudHSM gives dedicated hardware security modules. Use it for strict compliance or custom cryptographic requirements. Most teams should start with KMS.

## WAF, Shield, Firewall Manager

| Service | Purpose |
|---|---|
| WAF | HTTP layer filtering |
| Shield | DDoS protection |
| Firewall Manager | central policy management across accounts |

## GuardDuty, Inspector, Macie

| Service | Detects |
|---|---|
| GuardDuty | suspicious account, network, DNS, and workload activity |
| Inspector | software vulnerabilities and exposure |
| Macie | sensitive data in S3 |

SRE mindset: detection is only useful if routed to owners with a response process.

---

# 21. Data, Analytics, And Search

## Athena

Athena queries data in S3 using SQL. It is serverless and useful for logs, data lake exploration, and ad hoc analysis.

Performance habits:

- use columnar formats like Parquet
- partition data
- compress data
- avoid scanning unnecessary files

## Redshift

Redshift is a data warehouse for analytical queries. Use it for large-scale BI and structured analytics.

## OpenSearch

OpenSearch supports search, log analytics, and observability use cases. It is not a drop-in replacement for every database. Plan shard count, storage, retention, and query patterns.

## EMR, Glue, Lake Formation

- EMR: managed big data clusters such as Spark/Hadoop.
- Glue: ETL, crawlers, and Data Catalog.
- Lake Formation: permissions and governance for data lakes.

## MSK vs Kinesis

- Kinesis: AWS-native streaming.
- MSK: managed Apache Kafka for Kafka-compatible workloads.

Choose based on ecosystem, operational model, retention, consumer model, and team skill.

---

# 22. Machine Learning Services To Recognize

For SRE interviews, know what these services do, not every API:

| Service | Purpose |
|---|---|
| Rekognition | image/video analysis |
| Transcribe | speech to text |
| Polly | text to speech |
| Translate | translation |
| Lex | conversational bots |
| Connect | contact center |
| Comprehend | natural language processing |
| Textract | extract text/forms/tables from documents |
| Kendra | enterprise search |
| Personalize | recommendations |
| SageMaker AI | build/train/deploy ML models |

SRE angle: ML systems still need IAM, networking, data governance, monitoring, cost controls, and rollback plans.

---

# 23. Hybrid Networking And Migration

## Site-to-Site VPN

Encrypted IPSec tunnels over the internet between on-premises and AWS.

Use for:

- quick hybrid connectivity
- backup path for Direct Connect
- lower-cost connectivity

## Direct Connect

Dedicated network connectivity from on-premises to AWS. It is useful for predictable latency, private connectivity, and high data transfer needs.

Important: Direct Connect is not encrypted by default at the link layer; use VPN over DX or application encryption where required.

## Transit Gateway

Transit Gateway is a hub for connecting many VPCs and networks. It reduces full-mesh peering complexity.

## Storage Gateway, DataSync, Transfer Family

- Storage Gateway: hybrid access to cloud storage through file, volume, or tape patterns.
- DataSync: managed transfer between on-premises and AWS storage.
- Transfer Family: managed SFTP/FTPS/FTP endpoints backed by AWS storage.

## Snow Family

Snowball/Snowcone/Snowmobile move large data sets when network transfer is too slow or expensive.

---

# 24. Disaster Recovery And Backup

DR is about recovering from serious failures. HA is about staying available through common failures.

## RPO And RTO

| Term | Meaning |
|---|---|
| RPO | how much data loss is acceptable |
| RTO | how much downtime is acceptable |

Example:

```text
RPO 5 minutes = can lose up to 5 minutes of data
RTO 30 minutes = service must be restored within 30 minutes
```

## DR Strategies

| Strategy | Cost | Recovery Speed |
|---|---|---|
| Backup and restore | low | slow |
| Pilot light | low/medium | medium |
| Warm standby | medium/high | faster |
| Multi-site active-active | high | fastest |

No tested restore means no real backup.

## AWS Backup

AWS Backup centralizes backup policies across supported AWS services. Use vault lock for stronger protection against deletion or tampering where required.

## DMS And Migration

Database Migration Service helps migrate databases and can support continuous replication for migration windows. Schema Conversion Tool helps convert between database engines.

---

# 25. Cost Engineering For SREs

Cost is a reliability signal. Sudden cost spikes often indicate runaway systems.

Watch:

- NAT Gateway data processing
- cross-AZ data transfer
- CloudWatch Logs ingestion and retention
- idle EC2, EBS, EIP, load balancers
- oversized RDS/Aurora
- unattached EBS volumes
- old snapshots
- S3 versions without lifecycle policies
- high-cardinality custom metrics
- data egress to internet

Tools:

- Cost Explorer
- Budgets
- Cost Anomaly Detection
- CUR reports
- tags and cost allocation
- Compute Optimizer
- Trusted Advisor

SRE practice: every production service should have cost ownership, tags, dashboards, and anomaly alerts.

---

# 26. Infrastructure As Code And Operations Tools

## CloudFormation

CloudFormation defines AWS resources as templates. It gives repeatability, reviewability, and drift detection.

Benefits:

- reproducible environments
- change review
- rollback support
- stack outputs
- dependency handling

Risk: templates can still encode bad architecture. IaC makes mistakes repeatable too.

## Systems Manager

Useful SSM capabilities:

- Session Manager: shell access without opening SSH
- Run Command: execute commands across instances
- Patch Manager: patch orchestration
- Automation: run operational workflows
- Parameter Store: config/secrets storage

Prefer Session Manager over public bastion SSH when possible.

## Elastic Beanstalk

Elastic Beanstalk is a higher-level platform for deploying apps on AWS-managed patterns. It can be useful for simpler app hosting but hides details that SREs still need to understand.

---

# 27. Well-Architected Framework

AWS Well-Architected has six pillars:

| Pillar | SRE Translation |
|---|---|
| Operational Excellence | deploy, observe, respond, improve |
| Security | least privilege, detection, encryption, isolation |
| Reliability | recover from failure and scale |
| Performance Efficiency | use resources efficiently |
| Cost Optimization | avoid waste and match spend to value |
| Sustainability | minimize environmental impact through efficient design |

Use these questions during design reviews:

- What is the blast radius?
- What fails if one AZ fails?
- How do we restore data?
- What alarms page humans?
- What logs prove what happened?
- Which IAM principal can delete production data?
- What is the monthly cost driver?
- What is the rollback plan?

---

# 28. SRE Incident Playbooks

## AccessDenied After Deployment

Likely causes:

- wrong runtime role
- missing action in identity policy
- missing resource policy
- bad trust policy
- SCP denies action
- KMS key policy blocks access
- condition key mismatch

Debug:

```bash
aws sts get-caller-identity
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=<ApiName>
```

Then inspect IAM, resource policy, SCP, and KMS policy.

## Service Unreachable

Check in order:

1. DNS record resolves.
2. Client can reach load balancer.
3. Listener and rule match.
4. Target group has healthy targets.
5. Security groups allow the path.
6. NACLs allow request and response.
7. Route tables have correct next hops.
8. App is listening on expected port.
9. App logs show requests.

## One AZ Failure

Check:

- ALB enabled AZs
- ASG subnet distribution
- target health per AZ
- RDS/Aurora failover status
- NAT Gateway per AZ
- hardcoded zonal dependencies
- EBS volume attachment assumptions

Fix:

- spread all tiers across AZs
- remove single-AZ dependencies
- test AZ evacuation
- use zonal dashboards

## NAT Cost Spike

Check:

- top talkers in VPC Flow Logs
- private workloads pulling from S3/ECR through NAT
- logs or backups routed through NAT
- cross-AZ NAT path

Fix:

- add gateway endpoint for S3/DynamoDB
- add interface endpoints for AWS APIs
- deploy NAT per AZ for HA and local routing
- reduce unnecessary egress

## Database Saturation

Check:

- CPU, memory, IOPS, storage, connections
- slow queries
- missing indexes
- connection pool behavior
- replica lag
- lock waits
- failover events

Fix:

- tune queries/indexes
- add/readjust connection pooling
- scale instance/storage
- use read replicas for reads
- cache safe hot reads
- separate reporting workloads

---

# 29. Interview-Ready Explanations

## Public vs Private Subnet

A public subnet has a route to an Internet Gateway and resources can be publicly reachable if they have public IPs and permissive security rules. A private subnet does not expose workloads directly to the internet. Private workloads usually use NAT Gateway for outbound internet or VPC endpoints for private AWS service access.

## Security Group vs NACL

Security groups are stateful resource-level allow rules. NACLs are stateless subnet-level allow/deny rules. Use security groups as the main control and NACLs as coarse subnet guardrails.

## RDS Multi-AZ vs Read Replica

Multi-AZ is mainly for availability and failover. A read replica is mainly for read scaling and can lag because replication is asynchronous. Do not use read replicas as your only DR story unless the RPO/RTO impact is understood.

## ALB vs NLB

ALB is Layer 7 and understands HTTP/HTTPS routing by host, path, headers, and target groups. NLB is Layer 4 and is best for very high performance, TCP/UDP/TLS, static IP needs, and non-HTTP protocols.

## SQS vs SNS vs EventBridge

SQS is a queue for buffering work. SNS is pub/sub fanout. EventBridge is event routing with filtering and event buses.

## ECS vs EKS

ECS is simpler and AWS-native for containers. EKS is Kubernetes and gives ecosystem portability but adds operational complexity. Choose EKS when Kubernetes capabilities or organizational standards justify the cost.

## Lambda vs Containers

Lambda is excellent for event-driven, short-lived, spiky workloads. Containers are better for long-running services, custom runtimes, background daemons, and workloads needing more control.

## CloudFront vs Global Accelerator

CloudFront is a CDN and edge HTTP platform with caching. Global Accelerator provides static anycast IPs and routes to healthy regional endpoints over the AWS global network, including non-cacheable TCP/UDP patterns.

---

# 30. PDF Topic-By-Topic Senior SRE Study Notes

This section has been split into dedicated topic files for easier teaching and review. Start here:

- [AWS Senior SRE Study Guide](./aws/README.md)

Topic files:

- [Getting Started With AWS](./aws/01-getting-started-with-aws.md)
- [IAM](./aws/02-iam.md)
- [EC2 Basics](./aws/03-ec2-basics.md)
- [EC2 Purchasing Options](./aws/04-ec2-purchasing-options.md)
- [EC2 Networking: Public IP, Private IP, ENI, Elastic IP](./aws/05-ec2-networking-public-ip-private-ip-eni-elastic-ip.md)
- [EC2 Placement Groups And Hibernate](./aws/06-ec2-placement-groups-and-hibernate.md)
- [EBS, EFS, Instance Store, AMI](./aws/07-ebs-efs-instance-store-ami.md)
- [High Availability And Scalability](./aws/08-high-availability-and-scalability.md)
- [RDS, Aurora, And ElastiCache](./aws/09-rds-aurora-and-elasticache.md)
- [Route 53](./aws/10-route-53.md)
- [Classic Web Architectures](./aws/11-classic-web-architectures.md)
- [S3, S3 Advanced, And S3 Security](./aws/12-s3-s3-advanced-and-s3-security.md)
- [CloudFront And Global Accelerator](./aws/13-cloudfront-and-global-accelerator.md)
- [Storage Extras](./aws/14-storage-extras.md)
- [Integration And Messaging: SQS, SNS, Kinesis, MQ](./aws/15-integration-and-messaging-sqs-sns-kinesis-mq.md)
- [Containers On AWS](./aws/16-containers-on-aws.md)
- [Serverless](./aws/17-serverless.md)
- [Database Choices](./aws/18-database-choices.md)
- [Data And Analytics](./aws/19-data-and-analytics.md)
- [Machine Learning](./aws/20-machine-learning.md)
- [Monitoring, Audit, And Performance](./aws/21-monitoring-audit-and-performance.md)
- [Advanced Identity](./aws/22-advanced-identity.md)
- [Security And Encryption](./aws/23-security-and-encryption.md)
- [VPC Deep Topic](./aws/24-vpc-deep-topic.md)
- [Disaster Recovery And Migrations](./aws/25-disaster-recovery-and-migrations.md)
- [More Solutions Architecture And Other Services](./aws/26-more-solutions-architecture-and-other-services.md)
- [Well-Architected, Trusted Advisor, And Exam Review](./aws/27-well-architected-trusted-advisor-and-exam-review.md)

---

# 31. Teaching Deep Dives For Interview Week

This section is written as a teaching script. Use it to explain AWS aloud. For each topic, start with the operational pain, then describe the mechanism, then explain what fails in production and how you would debug it.

## VPC Packet Flow: The Most Important AWS Networking Story

A VPC exists because workloads need a private network boundary in the cloud. In Linux, you reason about interfaces, routes, iptables, listening ports, and DNS. In AWS, the same thinking still applies, but the controls are distributed across VPC constructs: subnets, route tables, security groups, NACLs, gateways, endpoints, load balancers, and ENIs.

Think of a VPC as a software-defined data center network. A subnet is not just a label; it is an IP range tied to one Availability Zone. That matters because EC2 instances, EBS volumes, NAT Gateways, and many network interfaces are zonal. When an interviewer asks about public and private subnets, they are usually testing whether you understand routing, not whether you memorized the definition.

A public subnet is public because its route table has a default route to an Internet Gateway. A private subnet is private because it does not have a direct route from the internet to the workload. If the private workload needs outbound internet, the route table usually points `0.0.0.0/0` to a NAT Gateway. The NAT Gateway sits in a public subnet, uses a public IP, and translates outbound connections on behalf of private instances.

Request flow for a public web app:

```text
User browser
  -> DNS resolves app.example.com
  -> Route 53 returns CloudFront or ALB DNS name
  -> client connects to ALB public IP
  -> ALB listener receives HTTPS
  -> listener rule selects target group
  -> target group chooses healthy app target
  -> packet reaches EC2/ECS/EKS workload ENI in private subnet
  -> app connects to database/cache in private data subnet
```

At every hop, something can block traffic. DNS can point to the wrong place. The ALB listener can lack a rule. The target can be unhealthy. The app security group may not allow traffic from the ALB security group. The database security group may allow the wrong source. A route table may send traffic to the wrong next hop. A NACL may block ephemeral return ports. The app may not be listening on the port the target group expects.

Senior debugging method:

```text
Name -> DNS answer -> load balancer listener -> target group health
     -> security group path -> route table path -> NACL return path
     -> process listening port -> application logs
```

Junior engineers often say "the security group is open" and stop there. Senior engineers ask, "open from which source, to which destination, on which port, through which route table, and is the response path allowed?" That difference is what interviewers listen for.

Cost consequence: private subnet egress through NAT Gateway can become expensive. If many instances pull from S3, ECR, CloudWatch Logs, or AWS APIs through NAT, you pay NAT processing charges for traffic that could often stay private through VPC endpoints. For S3 and DynamoDB, gateway endpoints are common. For many other AWS APIs, interface endpoints are common.

Security consequence: a private subnet is not magic protection. If the workload has broad outbound internet, leaked credentials can still exfiltrate data. A stronger design combines private subnets, least-privilege IAM, VPC endpoints, egress control, security groups, logs, and alerting.

Interview answer:

```text
I treat AWS networking like Linux networking distributed across managed objects.
For reachability, I verify DNS, listener, target health, SGs, route tables, NACLs,
and the process listener. For private workloads, I prefer no public IPs, inbound
only from trusted tiers, and VPC endpoints for AWS services to reduce NAT cost
and improve control.
```

## IAM Request Flow: How AWS Decides Yes Or No

IAM exists because AWS is API-driven infrastructure. Every serious action is an API call. Starting an EC2 instance, reading an S3 object, decrypting a secret, updating a route table, registering an ECS task, or assuming a role all pass through authorization.

The request is not simply "does this user have permission?" AWS evaluates a request context:

```text
principal -> action -> resource -> conditions -> policies -> explicit denies
```

The principal might be a human through IAM Identity Center, an EC2 instance profile, an ECS task role, a Lambda execution role, or an EKS service account mapped to AWS credentials. The action might be `s3:GetObject` or `kms:Decrypt`. The resource is an ARN. Conditions may check MFA, source IP, VPC endpoint, tags, organization ID, requested Region, encryption headers, or session attributes.

The operational trap is that permission is not stored in one place. A request can be affected by identity policies, resource policies, permissions boundaries, session policies, SCPs, KMS key policies, endpoint policies, and explicit denies. AWS official IAM evaluation logic emphasizes that explicit deny overrides allows.

Common production failure: a deployment starts failing with `AccessDenied` after a security hardening change. The app team checks the role and says the policy allows S3. Security checks the bucket policy and says the bucket allows the account. The missing piece is often KMS. The object is encrypted with a customer managed KMS key, and the runtime role lacks `kms:Decrypt` or the key policy does not trust the role.

Debugging method:

```text
1. Identify the exact failing API call.
2. Identify the runtime principal with sts:GetCallerIdentity.
3. Identify the resource ARN and encryption key if relevant.
4. Check CloudTrail for the denied event and error context.
5. Evaluate identity policy, resource policy, KMS policy, SCP, boundary, and conditions.
6. Fix the smallest missing permission or trust relationship.
```

Kubernetes connection: in EKS, IAM mistakes often appear as pod errors. A pod may fail to read S3 or Secrets Manager because its Kubernetes service account is not mapped correctly to an AWS role, or because the trust policy condition does not match the OIDC subject. The symptom is inside the container, but the root cause is identity federation between Kubernetes and AWS.

Senior interview framing:

```text
I do not debug IAM by randomly adding permissions. I reconstruct the authorization
request. Who is the principal at runtime, what API was called, what resource ARN,
which conditions applied, and where could an explicit deny be coming from?
```

## ALB, Target Groups, And Auto Scaling: Reliability Is A Feedback Loop

A load balancer exists because individual compute instances are replaceable. You do not want users to know which EC2 instance, ECS task, or pod serves them. The ALB becomes the stable entry point, while target groups represent pools of backend capacity.

An Application Load Balancer operates at HTTP/HTTPS layer 7. It understands listeners, host-based routing, path-based routing, headers, target groups, and health checks. AWS documentation says ALB nodes periodically send health checks to registered targets and route requests to healthy targets in enabled AZs. That sentence carries a lot of operational weight: if health checks are wrong, traffic routing is wrong.

Target health is not the same as process health. A process can be running but unable to serve because it cannot reach the database, cannot load config, has no disk, is stuck in GC, or is returning wrong status codes. On the other hand, a health check can be too deep. If `/health` requires every downstream dependency to be perfect, then one cache blip can make every target unhealthy. AWS ALB can fail open when all targets are unhealthy, which means a bad health design can create confusing behavior under total failure.

Auto Scaling Groups complete the loop. The ALB observes target health. The ASG maintains desired capacity. CloudWatch metrics trigger scaling policies. Launch templates define how replacement instances are created. The architecture only works if new capacity can actually become healthy.

Common production failure:

```text
Deploy new AMI -> ASG launches instances -> instances fail user data
               -> target group remains unhealthy -> ASG replaces instances
               -> replacement loop continues -> capacity collapses
```

Debugging method:

```text
ALB 5xx? Check whether errors are ELB-generated or target-generated.
Targets unhealthy? Read target health reason codes.
One AZ bad? Compare target health and traffic by AZ.
New instances failing? Check user data logs, systemd, app logs, SGs, and port binding.
Scaling not enough? Compare request count per target, CPU, queue depth, and warmup time.
```

Scaling consequence: CPU-based scaling works only when CPU is the bottleneck. For web services behind ALB, request count per target is often better. For workers, queue depth per worker is often better. For JVM or Python services, memory pressure or connection pool saturation may be the real limit, but those metrics need custom publication.

Senior interview framing:

```text
I think of ALB and ASG as a control loop. The load balancer measures target health
and distributes requests. The ASG replaces failed capacity and scales based on
signals. Most outages come from bad health checks, bad bootstrap, wrong security
group paths, insufficient warmup, or scaling on the wrong metric.
```

## S3: Object Storage, Not A Filesystem

S3 exists because applications need durable object storage without managing disks, RAID, filesystems, backup servers, or storage clusters. It is a regional object store. You put and get objects by key. It is not POSIX. You do not mount it like a normal Linux filesystem and expect rename, append, locking, or directory semantics to behave like ext4 or NFS.

This distinction matters for design. S3 is excellent for logs, artifacts, backups, static assets, data lakes, model files, and user uploads. It is a poor fit for workloads that require low-latency random block writes or filesystem locking. For that, think EBS or EFS depending on access pattern.

Versioning is one of the most important operational features. AWS documentation describes S3 Versioning as keeping multiple variants of objects in a bucket. If an object is deleted in a versioned bucket, S3 creates a delete marker rather than immediately deleting every prior version. That means accidental deletion can be recoverable. It also means cost grows because old versions remain stored.

Security is layered. You need to reason about IAM policies, bucket policies, Block Public Access, encryption, object ownership, access points, endpoint policies, and sometimes KMS. S3 public exposure incidents often happen because engineers think "the bucket policy is private" while another access path still exists, or because legacy ACL behavior is misunderstood.

Common production failure: application uploads to S3 begin failing after switching from SSE-S3 to SSE-KMS. The app role has `s3:PutObject`, but it lacks `kms:GenerateDataKey` for writes or `kms:Decrypt` for reads. The visible symptom is an S3 error, but the failing authorization dependency is KMS.

Lifecycle rules solve cost and retention pain. Logs often need fast access for a few weeks, slower access for months, and archival retention for compliance. A lifecycle rule can transition objects between storage classes and expire old versions. The operational mistake is enabling versioning without lifecycle expiration for noncurrent versions. That quietly turns a safe bucket into an expensive bucket.

Senior interview framing:

```text
I use S3 as durable object storage, not as a filesystem. For production, I care
about access path, encryption path, versioning, lifecycle, event notifications,
and recovery behavior. For debugging, I check IAM, bucket policy, Block Public
Access, KMS, endpoint policy, object key, and CloudTrail data events if enabled.
```

## RDS And Aurora: Managed Database Does Not Mean No Database Operations

RDS exists because running databases on raw EC2 is operationally expensive. Someone must handle backups, patching, failover, monitoring, storage growth, parameter changes, and replacement. RDS manages much of that control plane, but it does not remove database engineering.

You still own schema design, indexes, query patterns, connection pools, migration safety, read/write splitting, application retry behavior, and data recovery testing. This is the key senior distinction. Managed database means AWS operates the infrastructure; your team still operates the workload.

Multi-AZ is often misunderstood. AWS official documentation distinguishes Multi-AZ DB instance deployments and Multi-AZ DB cluster deployments. A Multi-AZ DB instance deployment has a standby in another AZ for failover support and the standby does not serve read traffic. A Multi-AZ DB cluster has a writer and readable standbys in separate AZs. Read replicas are a different concept; they scale read traffic and are usually asynchronous.

Failure mode:

```text
Primary DB issue -> RDS failover -> DNS endpoint moves to standby
                 -> app keeps stale connections
                 -> connection pool does not reconnect cleanly
                 -> errors continue after database is technically healthy
```

This is why production apps need timeouts, retry budgets, connection pool settings, and failover testing. A database failover is not just an AWS event; it is an application behavior test.

Scaling decision:

- If writes are the bottleneck, read replicas do not solve the core problem.
- If reads are the bottleneck, read replicas or Aurora readers may help.
- If connections are the bottleneck, RDS Proxy or better pooling may help.
- If queries are inefficient, larger instances only delay the problem.
- If reporting hurts production, isolate reporting reads.

Debugging method:

```text
Check app error rate and DB connection errors.
Check RDS events for failover, maintenance, storage, or backup activity.
Check CPU, memory, IOPS, latency, locks, connections, replica lag.
Check slow queries and recent migrations.
Check whether clients honor DNS changes and reconnect after failover.
```

Senior interview framing:

```text
I treat RDS as managed infrastructure, not a magic database. Multi-AZ improves
availability, read replicas improve read scaling, backups protect recovery points,
and the app still needs correct pooling, retries, migrations, and failover behavior.
```

## SQS, SNS, EventBridge: Decoupling Is A Reliability Tool

Messaging exists because synchronous systems amplify failure. If the API must write to five downstream services before responding, one slow dependency becomes a user-facing outage. Queues and events let you absorb bursts, retry work, isolate consumers, and recover asynchronously.

SQS is a queue. It is best when you have work to process and you want consumers to pull at their own pace. The visibility timeout is the key mechanism: when a worker receives a message, SQS hides it temporarily. If the worker finishes, it deletes the message. If the worker crashes or times out, the message becomes visible again. This is why handlers must be idempotent. The same message can be processed more than once.

SNS is fanout. One published event can be delivered to multiple subscribers. A common pattern is SNS to multiple SQS queues so each consumer team has its own retry and failure isolation.

EventBridge is event routing. It shines when you want rules, event buses, SaaS/AWS service events, scheduled events, and filtering by event pattern.

Common production failure: workers are healthy, but queue age keeps rising. Junior engineers scale the ASG blindly. Senior engineers ask whether each worker is slow, blocked on a database, failing messages repeatedly, hitting a downstream rate limit, or using too long/too short a visibility timeout.

Senior interview framing:

```text
I use queues to protect synchronous user paths and absorb bursts. I scale workers
on queue age or queue depth per worker, design handlers to be idempotent, configure
DLQs for poison messages, and monitor oldest message age because that reflects
user-visible processing delay.
```

## ECS, EKS, And Lambda: Compute Is An Operational Contract

AWS gives several compute models because teams want different levels of control.

EC2 gives maximum OS control and maximum operational responsibility. ECS gives AWS-native container orchestration. EKS gives Kubernetes compatibility and ecosystem power, with more platform complexity. Lambda gives event-driven execution with minimal server management, but with runtime limits, concurrency behavior, cold starts, and packaging constraints.

The senior question is not "which one is best?" The senior question is "which operational contract fits the workload?"

For ECS, know the distinction between task execution role and task role. AWS documentation states that the execution role is used by the ECS/Fargate agents for actions such as pulling images and sending logs. The task role is for application code inside the container to call AWS services. This distinction is a common interview and production debugging topic.

For EKS, Kubernetes knowledge is necessary but not sufficient. Pods still land on AWS ENIs through the VPC CNI. LoadBalancer services often create AWS load balancers. Persistent volumes map to EBS or EFS through CSI drivers. Workload identity maps Kubernetes service accounts to AWS IAM. Cluster autoscaling must coordinate pods, nodes, subnets, quotas, and disruption budgets.

For Lambda, the core tradeoff is simplicity versus constraints. Lambda is excellent for event handlers, lightweight APIs, and automation. It is weaker for long-running processes, heavy custom networking, large local state, or workloads that need full runtime control. Concurrency is both a scaling feature and a blast-radius risk. A sudden event spike can consume concurrency and throttle other functions unless reserved concurrency is used.

Senior interview framing:

```text
I choose compute by operational contract. EC2 when I need OS control, ECS when I
want simpler AWS-native containers, EKS when Kubernetes ecosystem and APIs matter,
and Lambda when the workload is event-driven and fits the runtime model. Then I
design IAM, networking, logs, scaling, rollout, and failure handling around that choice.
```

## Observability: Metrics Tell You What, Logs Tell You Why, Traces Tell You Where

CloudWatch, CloudTrail, Config, and VPC Flow Logs answer different questions. Mixing them up leads to slow incidents.

CloudWatch metrics answer "is the system healthy?" Logs answer "what did the process say happened?" Traces answer "where did this request spend time?" CloudTrail answers "who called which AWS API?" Config answers "how did this resource configuration change over time?" VPC Flow Logs answer "which network flows were accepted or rejected?"

During an incident, do not start with dashboards as decoration. Start with the user symptom. Is the user seeing errors, latency, stale data, missing emails, delayed jobs, or failed uploads? Then map that symptom to the request path and ask which signal proves or disproves each hop.

Example for upload failures:

```text
User -> CloudFront/ALB/API -> app -> S3 -> KMS
```

Useful evidence:

- ALB 4xx/5xx and target response time
- app logs with request ID
- S3 error code
- KMS `AccessDenied` in CloudTrail
- IAM principal from runtime
- recent deployment or policy change

Senior interview framing:

```text
I build observability around user journeys and dependency paths. Metrics page me,
logs explain local behavior, traces show request movement, CloudTrail proves control
plane changes, Config shows drift, and VPC Flow Logs help with network path evidence.
```

---

# 32. Hands-On Labs

## Beginner

1. Create a VPC with two public and two private subnets.
2. Launch EC2 in a private subnet behind an ALB.
3. Attach an IAM role to EC2 and access S3 without access keys.
4. Enable S3 versioning and recover a deleted object.
5. Create a CloudWatch alarm for EC2 status check failure.

## Intermediate

1. Build a three-tier app path: Route 53 -> ALB -> ASG -> RDS.
2. Convert RDS Single-AZ to Multi-AZ and observe failover behavior.
3. Add SQS between API and worker tier; scale workers on queue depth.
4. Add VPC endpoints for S3 and CloudWatch Logs; compare NAT traffic.
5. Use CloudTrail to investigate a deliberate IAM deny.

## Advanced

1. Deploy ECS or EKS workloads in private subnets.
2. Use task roles or IRSA/Pod Identity for workload permissions.
3. Configure CloudFront + WAF in front of an ALB.
4. Create backup/restore runbook and test restore.
5. Simulate one-AZ app capacity loss and validate service behavior.

---

# 33. Memory Review

Beginner recall:

- What is the difference between Region and AZ?
- Why should production use multiple accounts?
- What makes a subnet public?
- Why are IAM roles safer than access keys?
- What is S3 Versioning for?

Intermediate recall:

- How does an ALB decide whether a target is healthy?
- What happens when an ASG instance becomes unhealthy?
- Why can NAT Gateway become expensive?
- When should you use RDS Multi-AZ?
- How do SQS visibility timeout and DLQ protect processing?

Advanced recall:

- How does explicit deny affect IAM decisions?
- What can break during one-AZ failure?
- What is the difference between HA and DR?
- How would you debug `AccessDenied` involving KMS?
- When would you choose Global Accelerator instead of CloudFront?

Production recall:

- Which metrics show user impact?
- Which logs prove who changed infrastructure?
- How do you know backups work?
- How do you reduce blast radius?
- What is the rollback plan?

---

# 34. Senior SRE Summary

Strong AWS SRE architecture is private by default, multi-AZ for critical paths, least-privilege by design, observable at every layer, and cost-aware. During incidents, classify the failure before changing things: identity, network path, compute health, dependency saturation, AZ/Region scope, data integrity, or deployment regression.

The practical standard is simple:

```text
Can we explain it?
Can we observe it?
Can we restrict it?
Can we scale it?
Can we restore it?
Can we afford it?
Can we operate it at 3 AM?
```

If the answer is no, the architecture is not done.
