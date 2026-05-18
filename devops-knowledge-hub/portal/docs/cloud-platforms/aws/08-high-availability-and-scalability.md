---
title: "High Availability And Scalability"
sidebar_position: 8
---

# High Availability And Scalability

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Scalability means handling more load. Availability means continuing to serve through failure. A system can scale and still be fragile, or be available at normal load but fail under spikes. AWS designs usually combine load balancing, autoscaling, multiple AZs, health checks, managed databases, queues, and observability.

Vertical scaling makes a node bigger. Horizontal scaling adds more nodes. Stateless services are easier to scale horizontally because any instance can serve any request. Stateful services require externalizing state: sessions to ElastiCache/DynamoDB, files to S3/EFS, relational data to RDS/Aurora, logs to CloudWatch/S3/OpenSearch.

The core request path:

```text
Route 53 -> CloudFront/WAF -> ALB -> target group -> app tasks/instances
         -> cache/database/queue/object storage
```

Failure modes:

- ALB healthy but all targets unhealthy
- app scales out but database connection limit is exhausted
- health check endpoint does not represent readiness
- one AZ has targets but no NAT or broken dependency
- autoscaling reacts too slowly because warmup is long

Senior answer:

```text
I design stateless compute across at least two AZs behind an ALB, use ASG/ECS/EKS
scaling with meaningful metrics, keep state in managed durable services, and verify
the architecture by testing AZ loss and dependency failure.
```

AWS docs:

- ELB target health checks: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
- EC2 Auto Scaling groups: https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scaling-groups.html

---

## Load Balancer Decision Table

| Load Balancer | Layer | Features | Best For |
|---|---|---|---|
| ALB (Application) | Layer 7 HTTP/HTTPS | Path routing, host routing, headers, gRPC, WebSocket, WAF, Lambda target | Web apps, APIs, microservices with HTTP routing |
| NLB (Network) | Layer 4 TCP/UDP/TLS | Static IPs, ultra-low latency, TLS passthrough, PrivateLink | Non-HTTP protocols, very high throughput, static IP requirement |
| Gateway LB | Layer 3/4 | Flow routing to appliances via GENEVE | Firewall/IDS/IPS insertion in traffic path |

## ALB Health Check Design

```text
/health -> too shallow (returns 200 if process is alive but not ready)
/readyz -> better (returns 200 only when app can serve requests)
         -> should check: DB connection, required config loaded
         -> should NOT check: optional dependencies (don't fail ready if cache is flaky)
```

**ALB fail-open behavior:** when ALL targets in a target group are unhealthy, ALB routes requests to all targets anyway (fail-open). This prevents total lock-out but can mean bad requests reach unhealthy targets. Design health checks to avoid transient blips that unhealthy all targets simultaneously.

## Auto Scaling Group: Key Settings

| Setting | Meaning | Operational Guidance |
|---|---|---|
| Launch template | How instances are created | Always use launch templates, not launch configurations (deprecated) |
| Min/Desired/Max | Capacity bounds | Min ≥ 2 for HA; desired starts at min for predictable launches |
| Health check type | EC2 (default) or ELB | Use ELB health checks so ASG replaces targets that fail ALB health checks |
| Health check grace period | Time before ASG checks health after launch | Set to startup time + application warmup; too short = churn loop |
| Cooldown / warmup | Time to avoid overreaction | Instance warmup prevents new instances from skewing scaling metrics |
| Termination policy | Which instance to terminate on scale-in | Default: oldest launch template; `OldestInstance` for canary |

## Scaling Policy Types

| Type | How It Works | Best Metric |
|---|---|---|
| Target tracking | Maintain target metric value (auto-adds/removes) | ALB request count per target, CPU |
| Step scaling | Scale by steps based on alarm thresholds | CPU, custom metric |
| Scheduled scaling | Pre-scale for known load patterns | Business hours, batch windows |
| Predictive scaling | ML-based forecast + pre-scale | Periodic load patterns |

**Best scaling metrics by workload type:**

```text
HTTP/API services:    ALB RequestCountPerTarget
CPU-bound compute:    CPUUtilization
Queue workers:        SQS ApproximateNumberOfMessagesVisible / running tasks
Database-limited:     Custom metric: DB connections per instance
Memory-constrained:   Custom metric (memory not published by default)
```

## CLI: ALB and ASG Operations

```bash
# Check ALB target group health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123:targetgroup/my-tg/abc

# Describe load balancer listeners
aws elbv2 describe-listeners \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-alb/abc

# Describe ASG configuration
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names my-asg \
  --query "AutoScalingGroups[0].{Min:MinSize,Max:MaxSize,Desired:DesiredCapacity,HealthCheck:HealthCheckType}"

# Trigger immediate instance refresh (rolling deploy)
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name my-asg \
  --preferences "MinHealthyPercentage=80,InstanceWarmup=300"

# Manually detach an unhealthy instance for debugging
aws autoscaling detach-instances \
  --instance-ids i-0abcdef1234567890 \
  --auto-scaling-group-name my-asg \
  --no-should-decrement-desired-capacity
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| All targets unhealthy, ALB serving errors | Health check path wrong, app startup incomplete, DB connection pool exhausted | Fix health check endpoint; increase grace period; check app logs |
| ASG launches instances, they immediately terminate | Health check grace period too short; bootstrap failing; wrong SG | Extend grace period; check cloud-init logs; test manually |
| Scale-out doesn't help, latency stays high | DB is the bottleneck, not CPU | Add connection pooling (RDS Proxy); scale DB; add read replicas |
| Scale-in terminates instances during peak | Cooldown too short; scaling metric misleads | Tune cooldown; use step scaling with proper thresholds |
| New AMI deploy causes capacity collapse | All instances replaced simultaneously, bad AMI | Use instance refresh with `MinHealthyPercentage=80`; test AMI before roll-out |

## Interview Q&A

**Q: What is the difference between ALB and NLB?**
A: ALB is Layer 7 and understands HTTP/HTTPS — it routes based on host headers, URL paths, query strings, and HTTP methods. It integrates with WAF, supports gRPC, and can target Lambda. NLB is Layer 4 and forwards raw TCP/UDP packets — it is faster, has ultra-low latency, supports static Elastic IPs, and is required for non-HTTP protocols or PrivateLink service exposure.

**Q: How do health checks affect Auto Scaling Group behavior?**
A: If ASG health check type is `EC2` (default), the ASG only replaces instances that fail EC2 status checks (hardware failure). If set to `ELB`, the ASG also replaces instances that fail the ALB target group health check (application-level failure). Always use `ELB` health check type so unhealthy application instances are automatically replaced.

**Q: What scaling metric should you use for a queue-based worker fleet?**
A: Scale on `ApproximateAgeOfOldestMessage` or on queue depth divided by running worker count. `ApproximateAgeOfOldestMessage` directly reflects processing delay experienced by the system. Total queue depth alone is a bad metric because a large queue with many fast workers may not need more capacity.
