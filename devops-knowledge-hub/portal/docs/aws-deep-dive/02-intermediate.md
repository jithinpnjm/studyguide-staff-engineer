---
title: "Intermediate"
sidebar_position: 2
---

# AWS Intermediate — Production Building Blocks

This file covers the core production services every SRE must understand deeply: load balancing, autoscaling, managed databases, container orchestration, messaging, DNS, and observability. These are the services you interact with during incidents and design reviews.

---

## Auto Scaling Groups

An Auto Scaling group manages a fleet of EC2 instances. It maintains desired capacity, replaces unhealthy instances, and scales dynamically using policies.

| Term | Meaning |
|---|---|
| Launch template | How to create instances (AMI, type, SGs, role, user data) |
| Desired capacity | Current intended number of instances |
| Minimum capacity | Lower bound — never go below this |
| Maximum capacity | Upper bound — never exceed this |
| Health check | How ASG decides whether to replace an instance |
| Scaling policy | When to add or remove instances |
| Cooldown/warmup | Avoid overreacting during scaling events |

### Scaling Policies

- **Target tracking**: maintain a metric at a target value (e.g., CPU at 60%)
- **Step scaling**: add/remove capacity in steps based on alarm thresholds
- **Scheduled scaling**: scale at known times (e.g., morning traffic ramp)
- **Predictive scaling**: ML-based prediction of future load

Good scaling metrics:
- ALB request count per target (for web services)
- CPU for CPU-bound services
- Queue depth per worker (for worker pools)
- Custom business throughput metrics

Poor scaling metrics:
- Total request count without dividing by current capacity
- CPU for an I/O-bound service
- Memory if not published as a custom metric

SRE failure mode: ASG launches new instances, but they never become healthy because user data fails, AMI is broken, subnets have no available IPs, or the target group health check path is wrong. The result is a replacement loop that collapses capacity.

### Instance Refresh and Rolling Updates

Instance refresh replaces instances in the ASG using a controlled rollout. Use it to deploy new AMIs without downtime. Configure minimum healthy percentage and warmup to control rollout pace.

---

## Elastic Load Balancing

| Load Balancer | Layer | Use Case |
|---|---|---|
| ALB | Layer 7 HTTP/HTTPS | path routing, host routing, web apps, APIs |
| NLB | Layer 4 TCP/UDP/TLS | very high performance, static IP, non-HTTP |
| Gateway Load Balancer | Layer 3/4 | firewalls and inspection appliances |

### ALB Deep Dive

ALB is the right choice for HTTP/HTTPS APIs. It understands:
- **Listener rules**: route by host, path, headers, query strings, source IP
- **Target groups**: groups of EC2, ECS, EKS, Lambda, or IP targets
- **Health checks**: periodic HTTP/HTTPS checks to determine target readiness
- **Sticky sessions**: send a client to the same target (avoid for stateless apps)
- **WAF integration**: attach Web ACL at the ALB level

Health check design matters:
- `/healthz` should check whether the instance can serve traffic
- `/readyz` should fail if required dependencies are unavailable
- Do not make health checks so deep that one dependency blip removes every target
- Watch for the ALB fail-open behavior: when all targets are unhealthy, ALB returns 503

ALB vs NLB decision:
- HTTP/HTTPS API — use ALB
- Need static IPs — use NLB (or put NLB in front of ALB)
- WebSockets — ALB supports them
- High-performance TCP gaming, custom protocols — use NLB
- Need to preserve client source IP to the target — NLB passes it through; ALB requires X-Forwarded-For

### Target Group Health Reasons

When debugging unhealthy targets, read the health check reason codes:
- `Target.ResponseCodeMismatch` — app returned wrong HTTP status
- `Target.Timeout` — health check timed out
- `Target.FailedHealthChecks` — repeated failures
- `Elb.InternalError` — ELB cannot reach the target at all (check SGs and routes)

---

## RDS Multi-AZ and Read Replicas

### Multi-AZ DB Instance

A Multi-AZ deployment has a synchronous standby replica in a second AZ. On failure:
1. AWS detects primary failure
2. DNS CNAME (`mydb.abcdef.us-east-1.rds.amazonaws.com`) is updated to point to the standby
3. Standby becomes primary
4. Total failover time: typically 1–2 minutes

Critical SRE point: applications must honor DNS TTL and reconnect after failover. A connection pool that does not reconnect will keep returning errors even after the database is healthy again.

What Multi-AZ provides:
- Automatic failover for AZ, instance, or storage failure
- No manual intervention required
- Standby does NOT serve read traffic

What Multi-AZ does NOT provide:
- Read scaling (use read replicas for that)
- Zero-downtime failover (1–2 minute window)
- Protection from data corruption (synchronous replication copies corruption too)

### Read Replicas

Read replicas scale reads and can support reporting workloads. Key properties:
- Asynchronous replication — replicas can lag
- Can be in the same Region, different Region, or promoted to standalone
- Cross-Region replicas useful for disaster recovery and read locality
- Aurora replicas offer faster failover and lower lag

Use read replicas when:
- Reads dominate writes
- Reporting queries should not hurt the primary
- Cross-Region read locality is needed

Do not use read replicas as your only DR story — lag means potential data loss.

### RDS Proxy

RDS Proxy pools and reuses database connections. Critical for:
- Lambda functions that create burst connections on every invocation
- EKS pods that scale rapidly
- Any workload that can exhaust DB `max_connections`

RDS Proxy maintains a persistent pool to the database and multiplexes application connections. It also supports IAM authentication, which eliminates static DB passwords.

---

## ElastiCache — Redis and Memcached

ElastiCache provides managed Redis or Memcached-compatible caching.

Use it for:
- Database query cache
- Session store
- Rate limiting counters
- Distributed locks (with care — use RedLock pattern)
- Leaderboards and sorted sets

### Cache Patterns

- **Lazy loading**: app reads cache → on miss, reads DB → writes cache → serves
- **Write-through**: app writes cache and DB together on every write
- **TTL-based**: stale data expires automatically

SRE warning: a cache outage should not become a total outage. Design apps to fall back to the database when Redis is unavailable, or explicitly accept the cache-as-hard-dependency trade-off with documented RTO/RPO.

### Redis vs Memcached

| Feature | Redis | Memcached |
|---|---|---|
| Data structures | Strings, hashes, lists, sets, sorted sets | Strings only |
| Persistence | Optional AOF/RDB | None |
| Clustering | Redis Cluster | Multi-threaded, simple sharding |
| Pub/Sub | Yes | No |
| Replication | Yes (primary + replicas) | No |

For most SRE use cases, choose Redis.

---

## SQS and SNS

### SQS — Managed Queue

SQS is a queue. Producers send messages, consumers poll and process them. The visibility timeout is the key mechanism: when a worker receives a message, SQS hides it temporarily. If the worker finishes, it deletes the message. If the worker crashes or times out, the message becomes visible again and is reprocessed.

This is why handlers must be idempotent — the same message can be processed more than once.

| Concept | Meaning |
|---|---|
| Visibility timeout | Time message is hidden after a consumer receives it |
| Dead-letter queue | Messages that fail after `maxReceiveCount` retries land here |
| Long polling | Wait for messages instead of tight polling (reduces empty receives) |
| FIFO queue | Ordered delivery, exactly-once within message groups |
| Message retention | 1 minute to 14 days (default 4 days) |

SRE pattern:
```text
API -> SQS queue -> Worker ASG/ECS -> Database
```

Scale workers on queue depth per worker, not total queue depth.

Monitoring critical metrics:
- `ApproximateAgeOfOldestMessage` — user-visible processing delay
- `ApproximateNumberOfMessagesNotVisible` — messages in-flight
- `NumberOfMessagesSent` vs `NumberOfMessagesDeleted` — production/consumption balance
- DLQ depth — indicates stuck or failing messages

### SNS — Pub/Sub Fanout

SNS distributes one published event to many subscribers: SQS, Lambda, HTTP endpoints, email, SMS, and more.

Pattern:
```text
S3 event -> SNS topic -> multiple SQS queues -> independent consumers
```

This gives each consumer team independent retry behavior and failure isolation.

### EventBridge

EventBridge routes events using rules. Use it for:
- SaaS integration (Datadog, PagerDuty, Stripe events)
- AWS service events (EC2 state changes, ECS task failures, CodePipeline events)
- Scheduled jobs (cron replacement)
- Custom event buses for domain events

Use EventBridge when you need event filtering/routing rather than simple queue buffering.

---

## EKS — Elastic Kubernetes Service

EKS provides a managed Kubernetes control plane. You still operate worker nodes, add-ons, networking, policies, upgrades, and workload design.

### Node Options

| Option | When to Use |
|---|---|
| Managed node groups | Standard workloads; AWS handles node lifecycle |
| Self-managed nodes | Custom AMIs or launch behaviors required |
| Fargate profiles | Serverless pods; no node management |
| Karpenter | Just-in-time node provisioning with bin-packing |

### EKS Networking — VPC CNI

EKS uses the AWS VPC CNI plugin. Each pod gets an IP address from the VPC subnet. This means:
- Pod IPs are routable within the VPC without an overlay network
- Subnet CIDR sizing is critical — pods consume IP addresses from your subnets
- `max-pods` per node is limited by ENI and IP limits of the instance type
- For large clusters, use IPv6 or VPC CNI prefix delegation to avoid IP exhaustion

Production concern: a cluster that grows to hundreds of pods can exhaust a /24 subnet. Plan CIDR ranges before you deploy.

### IAM Roles for Service Accounts (IRSA)

IRSA allows Kubernetes pods to assume AWS IAM roles without static credentials.

How it works:
1. EKS cluster has an OIDC identity provider URL
2. You create an IAM role with a trust policy that allows the Kubernetes service account
3. The pod's service account is annotated with the IAM role ARN
4. AWS STS issues temporary credentials to the pod via a projected token

This is the correct way to give pods AWS permissions — not instance profiles (too broad) and not static keys (dangerous).

Common IRSA failure: trust policy condition does not match the actual service account namespace or name. The pod gets `AccessDenied` and the error message mentions STS, not the resource it was trying to access.

### EKS Critical Add-ons

| Add-on | Purpose |
|---|---|
| AWS Load Balancer Controller | Creates ALB/NLB for Kubernetes Services and Ingresses |
| EBS CSI Driver | Dynamic provisioning of EBS volumes for PersistentVolumes |
| EFS CSI Driver | Shared EFS volumes across pods |
| CoreDNS | Cluster DNS — must be healthy for pod DNS resolution |
| kube-proxy | Node-level service routing |
| VPC CNI | Pod networking |

---

## ECR — Elastic Container Registry

ECR stores container images. Key operational practices:

- Enable vulnerability scanning (Inspector integration)
- Set lifecycle policies to delete old images and untagged layers
- Use cross-Region replication for multi-Region deployments
- Use ECR pull-through cache for public images to avoid rate limits
- Authenticate ECR before pulling: `aws ecr get-login-password | docker login`

ECR private registry does not have image rate limits like Docker Hub. Migrate base images from Docker Hub to ECR to avoid pull failures during deploys.

---

## CloudWatch — Metrics, Logs, and Alarms

### Metrics

Important examples by service:
- ALB: `TargetResponseTime`, `HTTPCode_Target_5XX_Count`, `HTTPCode_ELB_5XX_Count`
- EC2: `CPUUtilization`, `StatusCheckFailed`, `NetworkIn/Out`
- RDS: `CPUUtilization`, `DatabaseConnections`, `FreeStorageSpace`, `ReplicaLag`
- Lambda: `Errors`, `Duration`, `Throttles`, `ConcurrentExecutions`
- SQS: `ApproximateAgeOfOldestMessage`, `NumberOfMessagesSent`

### CloudWatch Logs

Centralize application and system logs. Use structured JSON logs where possible for Logs Insights queries.

CloudWatch Logs Insights can query logs during incidents:
```sql
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50
```

### Alarms

Alarm on user impact and saturation, not only resource usage.

Good alarms:
- High 5xx rate (user-facing errors)
- p95 latency above SLO threshold
- SQS oldest message age rising
- RDS storage below threshold
- Lambda throttles in production
- ALB target health check failures

Noisy alarms destroy trust. Tune thresholds, add evaluation periods, and attach runbook links to alarm descriptions.

---

## Route 53 — Production DNS

Route 53 is AWS's DNS and domain registration service.

| Routing Policy | Use Case |
|---|---|
| Simple | One answer, no health checking |
| Weighted | Controlled traffic split, canary, migration |
| Latency | Route users to the lowest-latency Region |
| Failover | Active-passive DR between primary and secondary |
| Geolocation | Route by user location (country, continent) |
| Geoproximity | Location plus bias toward a region |
| Multi-value | Simple health-aware multiple records |
| IP-based | Route based on client CIDR block |

SRE caution: DNS failover is limited by TTL, resolver caching behavior, and health-check design. It is not instant failover. Set TTL low (30–60s) for records that need fast failover. High TTLs (3600+) are appropriate for stable records.

### Public vs Private Hosted Zones

- **Public hosted zone**: resolvable from the internet
- **Private hosted zone**: resolvable only inside associated VPCs — use for internal service discovery

Common failure: private hosted zone is not associated with the correct VPC. Pods or instances inside the VPC cannot resolve internal DNS names.

---

## Intermediate Summary

By this level, you can design a complete production web application:

```text
Route 53 (latency routing)
  -> CloudFront + WAF
  -> ALB (multi-AZ listener)
  -> Auto Scaling Group (private subnets, across AZs)
  -> RDS Aurora Multi-AZ (private data subnets)
  -> ElastiCache Redis (session store, hot reads)
  -> SQS (async work decoupling)
  -> Worker ECS/EKS service (scales on queue depth)
  -> CloudWatch (metrics, logs, alarms)
```

Every component is multi-AZ. State is externalized. Traffic is private except at the edge. Scaling is metric-driven. The architecture can survive any single AZ failure without manual intervention.
