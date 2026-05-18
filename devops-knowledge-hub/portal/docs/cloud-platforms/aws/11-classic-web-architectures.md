---
title: "Classic Web Architectures"
sidebar_position: 11
---

# Classic Web Architectures

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF teaches stateless and stateful web apps because they reveal how AWS services fit together. Start with one EC2 instance and every problem is hidden: compute, state, files, database, logs, TLS, and deployment are all on one box. Scaling forces separation.

For a stateless app, move traffic behind an ALB, run multiple instances across AZs, use ASG for replacement, and store state elsewhere. For a stateful app, identify every kind of state. User sessions move to Redis/DynamoDB. Uploaded files move to S3/EFS. Relational data moves to RDS/Aurora. Logs move off-host. Once state is externalized, compute can be replaced safely.

Teaching example:

```text
Single EC2 WordPress:
  simple, fragile, hard to scale

Better:
  ALB -> EC2/ECS app tier across AZs
      -> RDS/Aurora Multi-AZ for DB
      -> EFS or S3 for uploads
      -> CloudFront for static content
      -> CloudWatch for logs/metrics
```

---

## Evolution of a Web Architecture

### Level 1: Single Instance (Fragile)

```text
Route 53 -> EC2 (web + app + DB on one instance)
```
Single point of failure. Cannot scale. No separation of concerns.

### Level 2: Stateless Web App (HA)

```text
Route 53
  -> CloudFront + WAF
  -> ALB (across 2+ AZs)
  -> ASG: EC2/ECS/EKS app instances (private subnets, 2+ AZs)
  -> RDS/Aurora Multi-AZ (private data subnet)
  -> S3 (user uploads, static assets)
  -> ElastiCache (session store, hot reads)
  -> CloudWatch (metrics, logs, alarms)
```

State rules:
- Session: ElastiCache (Redis) or DynamoDB
- User uploads: S3 or EFS
- Relational data: RDS/Aurora Multi-AZ
- Logs: CloudWatch Logs (stream) + S3 (archive)

### Level 3: Serverless Architecture

```text
CloudFront (CDN + WAF)
  -> S3 (static frontend: HTML/CSS/JS)
  -> API Gateway (managed API front door)
    -> Lambda (business logic, stateless)
      -> DynamoDB (key-value, auto-scaling)
      -> SQS + Lambda workers (async processing)
      -> EventBridge (scheduled triggers, event routing)
```

Serverless scales to zero at idle. No instances to manage. Design around concurrency limits, cold starts, and downstream connection constraints.

### Level 4: Microservices

```text
Route 53
  -> API Gateway or ALB
  -> Service A (ECS/EKS) -> own DB
  -> Service B (ECS/EKS) -> own DB
  -> Service C (Lambda) -> DynamoDB

Inter-service:
  Sync: HTTP/gRPC (direct call with timeout + circuit breaker)
  Async: SQS/SNS/EventBridge (decoupled, retry-safe)
```

Microservices require: clear ownership, independent deployments, per-service observability, retry/timeout/circuit breaker at every boundary, and async messaging for non-critical paths.

## State Externalization Cheat Sheet

| State Type | Where to Move It |
|---|---|
| HTTP session | ElastiCache (Redis) or DynamoDB |
| User-uploaded files | S3 (primary), EFS (if app expects NFS) |
| Application config | SSM Parameter Store or Secrets Manager |
| Relational data | RDS/Aurora Multi-AZ |
| Logs | CloudWatch Logs Agents or AWS Distro for OpenTelemetry |
| Queued jobs | SQS (standard or FIFO) |
| Events | EventBridge or SNS |
| Cache | ElastiCache (Redis/Memcached) |

## Cost Patterns for Each Architecture Level

| Pattern | Main Cost Drivers |
|---|---|
| Single EC2 | EC2, EBS, data egress |
| Stateless web HA | ALB (per LCU), EC2 (ASG), RDS Multi-AZ, NAT Gateway, CloudWatch Logs |
| Serverless | Lambda (per request), API Gateway, DynamoDB (capacity units), S3 |
| Microservices | Multiple ALBs, many ECR images, cross-service data transfer, observability at scale |

## Interview Q&A

**Q: How do you make a stateful web application stateless so it can scale horizontally?**
A: Identify every piece of state the app holds locally: sessions, uploaded files, database connections, queued work, and in-memory cache. Move each to a managed service: sessions to ElastiCache or DynamoDB, files to S3 or EFS, relational data to RDS/Aurora, queue work to SQS, cache to ElastiCache. Once no instance holds state that another instance needs, you can terminate and replace any instance without user impact.

**Q: What is the difference between a stateless and stateful architecture in AWS terms?**
A: A stateless architecture stores no instance-local data that matters for serving requests. Any instance can serve any user. Instances can be added, removed, or replaced without coordination. A stateful architecture has data on the instance itself (local files, in-memory session, local DB) that would be lost if the instance is replaced. Cloud-native design moves state to durable, distributed services so compute becomes interchangeable.

**Q: When would you choose serverless architecture over EC2-based?**
A: Serverless (Lambda + API Gateway + DynamoDB) works best for: event-driven workloads with unpredictable or spiky traffic, low-ops environments where teams don't want to manage servers, and workflows where cost at near-zero traffic matters (scale-to-zero). Avoid serverless when: workloads need long-running processes (>15 min), require custom networking or OS access, have very high sustained throughput where Lambda concurrency costs exceed EC2, or need stateful daemons.
