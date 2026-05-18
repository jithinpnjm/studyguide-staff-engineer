---
title: "Intermediate"
sidebar_position: 2
---

# AWS Deep Dive — Intermediate: Production Building Blocks

This level covers the services and patterns that define production AWS architectures. Every topic is explained through operational consequence — not just what the service is, but why it exists and what breaks without it.

---

## EC2 Advanced

### Placement Groups

Placement groups exist because physical placement affects latency and failure domains.

| Type | Purpose | Use Case |
|---|---|---|
| Cluster | Pack instances close on same hardware | HPC, low-latency distributed systems, ML training |
| Spread | Separate each instance to distinct hardware | Critical workloads needing hardware failure isolation (max 7 per AZ) |
| Partition | Logical partitions on separate hardware sets | Kafka, Cassandra, HDFS — large distributed systems |

**Cluster placement** improves throughput but increases correlated failure risk. **Spread placement** reduces correlated failure but limits group size. **Partition placement** balances both for distributed systems that need to avoid correlated failure within a rack.

### EC2 Purchasing Options

| Option | Description | Use Case | Risk |
|---|---|---|---|
| On-Demand | Pay by the second, no commitment | Unpredictable or short-lived | Highest cost |
| Reserved Instances (RI) | 1 or 3 year commitment, specific instance type | Steady known usage | Commitment; unused RI wastes money |
| Savings Plans | Flexible compute spend commitment ($/hr) | Mixed instance types, Fargate, Lambda | Commitment |
| Spot | Spare capacity up to 90% cheaper | Fault-tolerant batch, CI, stateless workers | 2-minute interruption notice |
| Dedicated Hosts | Physical server exclusive use | License compliance, regulatory | High cost |
| Dedicated Instances | EC2 on hardware dedicated to your account | Compliance, not full host control | Higher cost |
| Capacity Reservations | Reserved capacity in specific AZ | Guaranteed availability for launches | Pay even when unused |

**Senior framing:** Split into baseline (On-Demand or committed) and elastic layers (Spot for interruptible). For disaster scenarios or launch windows, Capacity Reservations guarantee availability.

**Spot interruption handling:** Spot instances receive a 2-minute notice via instance metadata and EventBridge. Design Spot workloads to checkpoint work, use mixed instance types with Spot Fleet, and never run singleton Spot instances for stateful services.

### Hibernation

EC2 Hibernate preserves instance RAM to encrypted EBS and resumes later. Useful for long warmup workloads, not a general HA mechanism. For resilience, design stateless replacement or application-level checkpointing.

### ENI — Elastic Network Interface

An ENI is the network identity of a workload. Security groups attach to ENIs, not instances. Every resource that uses VPC networking creates ENIs in your subnets: EC2 instances, Lambda in VPC, RDS endpoints, ECS tasks in `awsvpc` mode, EKS pod IPs via VPC CNI.

**Elastic IP:** static public IPv4 address assignable to an ENI. A design smell when used to preserve pet server identity — prefer load balancers and DNS. Charges when not associated with a running instance.

---

## EBS Volume Types

EBS is persistent block storage. Volumes are AZ-scoped — a volume in `us-east-1a` cannot attach to an instance in `us-east-1b`. Snapshots are the backup primitive and can be copied across Regions.

| Type | Category | Best For | Max IOPS | Max Throughput |
|---|---|---|---|---|
| gp3 | General purpose SSD | Most workloads, boot volumes | 16,000 | 1,000 MiB/s |
| gp2 | General purpose SSD | Legacy; IOPS tied to size (3/GB) | 16,000 | 250 MiB/s |
| io1 | Provisioned IOPS SSD | I/O-intensive databases | 64,000 | 1,000 MiB/s |
| io2 Block Express | Provisioned IOPS SSD | SAP HANA, large critical databases | 256,000 | 4,000 MiB/s |
| st1 | Throughput HDD | Big data, log processing, sequential reads | 500 | 500 MiB/s |
| sc1 | Cold HDD | Infrequent access, lowest cost | 250 | 250 MiB/s |

**SRE habit:** Use `gp3` by default — it decouples IOPS and throughput from volume size, so you don't over-provision storage for performance. `gp2` ties IOPS to size (3 IOPS/GB).

### EFS vs EBS vs Instance Store

| Storage | Type | Scope | Durability | Use Case |
|---|---|---|---|---|
| EBS | Block | Single AZ, single instance | Persistent | OS, databases, single-instance data |
| EFS | NFS | Multi-AZ, multi-instance | Persistent | Shared app files, CMS uploads, ECS/EKS shared volumes |
| Instance store | Block | Zonal, single instance | Ephemeral (lost on stop/terminate) | Caches, temp artifacts, replicated data |

EFS performance modes: General Purpose (latency-sensitive) vs Max I/O (highly parallel). EFS throughput modes: Bursting (scales with storage) vs Provisioned (fixed throughput). EFS mounts require port 2049 (NFS) in security groups.

---

## High Availability: Elastic Load Balancing

### Load Balancer Types

| Load Balancer | Layer | Key Features | Best For |
|---|---|---|---|
| ALB | Layer 7 HTTP/HTTPS | Path/host/header routing, target groups, Lambda targets, sticky sessions | Web apps, microservices, APIs |
| NLB | Layer 4 TCP/UDP/TLS | Static IPs, Elastic IPs, ultra-low latency, millions req/sec | High-performance TCP, static IP requirements |
| CLB | Layer 4/7 | Legacy — avoid for new designs | EC2-Classic workloads |
| GWLB | Layer 3/4 | Routes to virtual appliances | Firewalls, IDS/IPS, inline inspection |

### ALB Deep Dive

Core ALB objects:
- **Listener:** port + protocol ALB listens on (e.g., 443 HTTPS)
- **Listener rule:** conditions (host header, path, headers) + actions (forward, redirect, fixed response)
- **Target group:** collection of targets (EC2, ECS tasks, Lambda, IPs) with its own health check
- **Health check:** periodic probe to path/port; unhealthy targets are removed from rotation

**Health check design:**
- `/healthz` should test whether the instance can serve traffic
- Do not make health checks so deep that one dependency blip removes every target
- ALB **fails open** when all targets are unhealthy — bad health design creates confusing fail-all behavior

**Cross-zone load balancing:**
- ALB: enabled by default, no additional charge
- NLB: disabled by default; enabling it incurs cross-AZ data transfer charges

### Sticky Sessions

Sticky sessions keep a user on the same target via a cookie. Helps legacy stateful apps but reduces resilience. Better pattern: stateless app + sessions in ElastiCache or DynamoDB.

---

## Auto Scaling Groups (ASG)

An ASG maintains a fleet of EC2 instances — replaces unhealthy instances automatically and scales capacity based on policies.

### Key ASG Terms

| Term | Meaning |
|---|---|
| Launch template | How to create instances (AMI, instance type, SG, IAM profile, user data) |
| Desired capacity | Current intended instance count |
| Min/Max | Hard scaling bounds |
| Health check | ALB health check or EC2 status check drives replacement |
| Cooldown | Prevents overreacting: wait before additional scaling |
| Instance warmup | Time for new instance to stabilize before contributing to metrics |
| Lifecycle hooks | Pause instance during launch or termination for custom actions |
| Warm pools | Pre-initialized instances ready to join quickly |

### Scaling Policies

| Policy Type | Mechanism | Use Case |
|---|---|---|
| Target tracking | Maintain a metric at a target value | Recommended — ALB requests per target |
| Step scaling | Scale different amounts at different alarm thresholds | Better proportionality than simple |
| Simple scaling | Add/remove N instances when alarm fires | Basic; can over/under-react |
| Scheduled | Scale at specific times | Predictable load patterns |
| Predictive | ML-based proactive scaling | Variable but predictable patterns |

**Good scaling metrics:** ALB request count per target (web apps), queue depth per worker (async), CPU for truly CPU-bound services.

**Poor metrics:** total request count without dividing by capacity, memory if not published, CPU for I/O-bound services.

### ASG Failure Mode: Replacement Loop

```text
Deploy new AMI -> ASG launches instances -> user data fails silently
               -> target group never becomes healthy
               -> ASG terminates and relaunches (infinite loop)
               -> capacity collapses under load
```

Debug: check user data logs, cloud-init logs, systemd service status, listening ports, SGs, and target health reason codes.

---

## RDS — Relational Database Service

### What AWS Manages vs What You Own

**AWS manages:** provisioning, patching, automated backups, Multi-AZ failover automation, storage scaling, monitoring integration.

**You own:** schema design, indexes, query performance, connection pooling, application retry behavior, migration safety, recovery testing.

### RDS Multi-AZ

Multi-AZ is **high availability**, not read scaling.

- **Multi-AZ DB instance:** synchronous standby in another AZ. Standby does NOT serve reads. Failover typically 60-120 seconds; DNS endpoint flips.
- **Multi-AZ DB cluster:** writer + two readable standbys in separate AZs. Faster failover.

Critical failure mode after failover:
```text
Primary DB issue -> RDS failover -> DNS endpoint flips to standby
                -> App connection pool keeps stale connections
                -> Errors continue after DB is healthy
                -> Requires app-side connection refresh and retry logic
```

### Read Replicas

- Asynchronous replication from primary; can lag (monitor `ReplicaLag`)
- Use for read-heavy workloads, reporting, cross-Region reads
- Can be promoted to standalone DB (not zero data loss)
- Supports MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Aurora

**Rule:** Multi-AZ for availability; read replicas for read scaling. Do not confuse them.

### Aurora

AWS cloud-native relational database compatible with MySQL or PostgreSQL.

| Feature | Aurora | Standard RDS |
|---|---|---|
| Storage | Distributed 3 AZs, 6 copies | Single-AZ EBS |
| Failover | ~30 seconds | 60-120 seconds |
| Read scaling | Up to 15 Aurora Replicas | Up to 5 Read Replicas |
| Serverless | Aurora Serverless v2 (fine-grained compute scaling) | Not available |
| Storage growth | Auto-grows in 10 GB increments | Manual |

Aurora Serverless v2 scales compute in fine-grained increments — useful for variable or unpredictable workloads without paying for full provisioned capacity.

### RDS Proxy

RDS Proxy pools and multiplexes database connections. Critical for Lambda (each invocation would otherwise open a new connection) and bursty app tiers that would exhaust DB connection limits. Also enables smoother failover without application-level connection errors.

### Backups

- **Automated backups:** daily snapshot + transaction logs, retained 1-35 days; enables PITR
- **Manual snapshots:** retained until deleted; good for pre-migration snapshots
- **Point-in-Time Recovery (PITR):** restore to any second within retention window

**Operational truth:** a backup that has never been restored is only a hope. Test restores regularly.

---

## ElastiCache — Redis vs Memcached

| Feature | Redis | Memcached |
|---|---|---|
| Data structures | Strings, lists, sets, sorted sets, hashes, streams | Strings only |
| Persistence | Optional (AOF/RDB snapshots) | None |
| Replication | Yes (primary + replicas) | No |
| Multi-AZ | Yes | No |
| Clustering | Yes (cluster mode with sharding) | Yes (simple) |
| Lua scripts | Yes | No |
| Use cases | Sessions, pub/sub, rate limiting, leaderboards, distributed locks | Simple caching |

**Cache patterns:**
- **Lazy loading:** read cache first, fall back to DB on miss, write result to cache
- **Write-through:** write to cache and DB together; no stale reads
- **TTL expiry:** stale data expires; tolerable staleness is acceptable

**Warning:** Cache outage must not cascade to full outage. Applications must handle cache unavailability gracefully.

**ElastiCache clustering (Redis cluster mode):** shards data across multiple node groups, each with primary + replicas. Enables horizontal scaling of both reads and writes. Requires client-side cluster-aware routing.

---

## Route 53

### Record Types

| Record | Purpose |
|---|---|
| A | Maps hostname to IPv4 address |
| AAAA | Maps hostname to IPv6 address |
| CNAME | Alias one hostname to another; cannot be used at zone apex |
| Alias | AWS extension: maps to AWS resource DNS names; works at zone apex; no TTL billing |
| MX | Mail server routing |
| TXT | Text records; used for domain verification, SPF, DKIM |
| NS | Name server records |
| PTR | Reverse DNS |

**Zone apex rule:** you cannot create a CNAME for `example.com` (zone apex). Use Route 53 Alias records to map zone apex to ALB, CloudFront, Elastic Beanstalk, etc.

### Routing Policies

| Policy | Description | Use Case |
|---|---|---|
| Simple | Single answer | Single resource |
| Weighted | Traffic split by % weight | Canary deploys, A/B testing, migration |
| Latency | Route to lowest-latency Region from user | Multi-Region performance |
| Failover | Active-passive DR; routes to secondary when primary fails health check | Active-passive DR |
| Geolocation | Route based on user country/continent | Data residency, localization |
| Geoproximity | Location-based with bias adjustment | Fine-tuned regional routing |
| Multivalue answer | Return up to 8 healthy records | Simple client-side load balancing |
| IP-based | Route by client CIDR | ISP-specific routing |

### Health Checks

Types: endpoint monitoring (HTTP/HTTPS/TCP), calculated (combines multiple), CloudWatch alarm-based.

**SRE caution:** DNS failover is limited by TTL and resolver behavior. It is not instant failover. Low TTL (30-60s) helps but does not eliminate propagation delay. Do not confuse DNS failover with load balancer health checking.

**Route 53 Resolver:** DNS resolution for hybrid environments. Inbound endpoints let on-premises resources query Route 53 private hosted zones. Outbound endpoints let VPC resources query on-premises DNS via forwarding rules.

---

## S3 Advanced

### Pre-signed URLs

Time-limited access tokens to S3 objects, generated with your credentials. The requester does not need AWS credentials. Used for:
- Direct user uploads to S3 bypassing app tier
- Temporary download links for private objects
- Delegating access without exposing AWS credentials

### CORS

S3 CORS allows browser requests from one domain to fetch objects from S3 on a different domain. Required for single-page apps that load assets directly from S3 buckets.

### S3 Replication

| Type | Direction | Use Case |
|---|---|---|
| Cross-Region Replication (CRR) | Different Region | Compliance, latency, multi-Region DR, cross-account |
| Same-Region Replication (SRR) | Same Region | Log aggregation, prod-to-test copy, account separation |

Requirements: versioning enabled on both source and destination. Replication is not retroactive. Delete markers can optionally be replicated.

### S3 Transfer Acceleration

Uploads use CloudFront edge locations to route over the AWS global network instead of the public internet. Useful for uploads from geographically distant clients.

### Object Lock (WORM)

Prevents deletion or overwrite during a retention period:
- **Compliance mode:** nobody can delete, including root — for regulatory WORM compliance
- **Governance mode:** users with `s3:BypassGovernanceRetention` permission can override

### Intelligent-Tiering

Automatically moves objects between access tiers based on actual access patterns with no retrieval fees. Good for unknown or variable access patterns.

---

## CloudFront

### Key Concepts

| Concept | Meaning |
|---|---|
| Distribution | CloudFront resource with origins, behaviors, and settings |
| Origin | Where CloudFront fetches content (S3, ALB, API Gateway, custom HTTP) |
| Behavior | URL path pattern mapped to an origin with cache settings |
| Cache policy | Controls TTL, and which headers/cookies/query strings vary the cache |
| Origin Shield | Additional caching layer to reduce origin load |
| OAC | Origin Access Control — restricts S3 to CloudFront-only access |

**Cache correctness rule:** static assets get long TTLs + versioned filenames. Dynamic APIs need carefully designed cache keys (headers, cookies, query strings).

**Invalidation:** removes cached objects before TTL expiry. Frequent invalidation signals weak versioning strategy — prefer versioned filenames for static assets.

### Lambda@Edge and CloudFront Functions

- **Lambda@Edge:** Node.js/Python Lambda at edge; runs on viewer/origin request/response; A/B testing, auth, URL rewriting
- **CloudFront Functions:** lightweight JavaScript for simple viewer-side transforms; lower latency and cost than Lambda@Edge for simple operations

---

## SQS — Simple Queue Service

### Standard vs FIFO

| Feature | Standard | FIFO |
|---|---|---|
| Ordering | Best-effort | Strict FIFO within message group |
| Throughput | Effectively unlimited | 300 msg/sec (3,000 with batching per group) |
| Deduplication | No | Yes (5-minute window) |
| Use case | High-volume, order-insensitive | Order-sensitive workflows |

### Key Concepts

| Concept | Meaning |
|---|---|
| Visibility timeout | Time message is hidden after consumer receives it (default 30s) |
| Dead-letter queue (DLQ) | Receives messages after max receive failures |
| Long polling | Wait up to 20s for messages; reduces empty receives and cost |
| Message retention | 1 minute to 14 days (default 4 days) |
| Max message size | 256 KB |

**Visibility timeout too short:** causes duplicate processing (message reappears while still being processed).
**No DLQ:** poison messages loop forever, blocking queue progress.

**Scaling workers on queue metrics:**
- `ApproximateAgeOfOldestMessage` — reflects processing latency; use for latency-sensitive workloads
- `ApproximateNumberOfMessagesVisible / number of consumers` — use for throughput-sensitive workloads

---

## SNS — Simple Notification Service

SNS is pub/sub fanout. One published message delivers to multiple subscribers: SQS queues, Lambda functions, HTTP/S endpoints, email, SMS, mobile push.

**Fan-out pattern:**
```text
S3 event -> SNS topic -> SQS queue A (consumer team A)
                      -> SQS queue B (consumer team B)
                      -> Lambda (audit/monitoring)
```

Each consumer has independent retry, scaling, and failure isolation.

**SNS FIFO topics:** ordered delivery to SQS FIFO queues; deduplication support; lower throughput than standard SNS.

---

## Kinesis

### Kinesis Data Streams (KDS)

Real-time ordered streaming for high-throughput event data.

| Concept | Meaning |
|---|---|
| Shard | Capacity unit: 1 MB/s write, 2 MB/s read |
| Partition key | Determines which shard receives a record |
| Retention | 24 hours default, up to 365 days |
| Enhanced fan-out | Dedicated 2 MB/s read per consumer; no shared throughput |

Hot partition problem: a concentrated partition key overloads one shard while others sit idle.

### Kinesis Data Firehose (KDF)

Managed delivery to S3, Redshift, OpenSearch, Splunk, HTTP endpoints. No shard management. Can transform with Lambda before delivery. Near-real-time (buffer time 60s-900s).

### Kinesis Data Analytics (KDA)

SQL or Apache Flink streaming analytics over KDS or KDF data in real time.

### SQS vs SNS vs Kinesis — Comparison

| Aspect | SQS | SNS | Kinesis Data Streams |
|---|---|---|---|
| Pattern | Pull (polling) | Push (pub/sub) | Pull (consumer reads) |
| Ordering | No (FIFO optional) | No | Yes, per shard |
| Fan-out | No | Yes | Yes (multiple consumer apps) |
| Retention | Up to 14 days | No retention | 24h to 365 days |
| Replay | No | No | Yes |
| Use case | Work buffering | Event notification | Ordered streaming, replay |
| Throughput | Effectively unlimited | Very high | Shard-limited, predictable |

---

## Amazon MQ

Managed ActiveMQ or RabbitMQ-compatible message broker. Use when migrating apps that depend on AMQP, MQTT, OpenWire, or STOMP. Not preferred for greenfield AWS-native designs — SQS/SNS are simpler and more scalable.

---

## Summary: Intermediate Design Principles

1. **Purchasing strategy:** On-Demand baseline + Savings Plans for committed usage + Spot for interruptible workloads
2. **Storage choice:** `gp3` EBS for most cases; `io2` for demanding databases; instance store for ephemeral; EFS for shared filesystem
3. **Load balancer health checks:** too deep causes false unhealthy cascades; too shallow misses real failures
4. **ASG + ALB = control loop:** health checks drive replacement; scaling metrics drive capacity decisions
5. **RDS Multi-AZ is HA; read replicas are read scaling:** never confuse them
6. **ElastiCache must degrade gracefully:** cache outage cannot cascade to full outage
7. **Route 53 routing policies:** latency routing for multi-Region, failover for active-passive DR, weighted for canary
8. **Scale workers on queue age, not queue depth alone:** age reflects actual user-visible latency
9. **SQS always needs a DLQ:** poison messages must have a landing place
10. **Kinesis for ordered real-time with replay; SQS for work buffering**
