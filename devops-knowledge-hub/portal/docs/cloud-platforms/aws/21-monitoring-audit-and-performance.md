---
title: "Monitoring, Audit, And Performance"
sidebar_position: 21
---

# Monitoring, Audit, And Performance

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF covers CloudWatch, CloudTrail, EventBridge, Config, Insights tools, alarms, logs, and container/Lambda visibility. The senior model is to separate telemetry questions:

```text
CloudWatch metrics/logs: what is happening operationally?
CloudTrail: who called which AWS API?
Config: how did resource configuration change?
VPC Flow Logs: what network flows happened?
EventBridge: how do we react to events?
```

Failure mode: a production route table changes and the app loses connectivity. CloudWatch shows errors, but CloudTrail tells who changed the route table. Config shows before/after configuration. VPC Flow Logs show rejected or missing traffic patterns. You need all layers.

---

## Observability Tool Decision

| Question | Right Tool |
|---|---|
| Is the system healthy right now? | CloudWatch Metrics + Alarms |
| What did the application log? | CloudWatch Logs |
| Where did this request spend time? | AWS X-Ray (distributed tracing) |
| Who called which AWS API? | CloudTrail |
| What did this resource config look like at time T? | AWS Config |
| What network traffic was accepted/rejected? | VPC Flow Logs |
| What triggered this infrastructure change? | CloudTrail + EventBridge |
| Which resources are non-compliant with policy? | AWS Config Rules |

## CloudWatch: Key Metrics by Service

| Service | Key Metrics to Alarm On |
|---|---|
| ALB | `TargetResponseTime` (p95/p99), `HTTPCode_ELB_5XX_Count`, `HealthyHostCount` |
| EC2 | `CPUUtilization`, `StatusCheckFailed`, `DiskReadOps`, `NetworkPacketsIn` |
| RDS/Aurora | `CPUUtilization`, `FreeableMemory`, `FreeStorageSpace`, `DatabaseConnections`, `ReplicaLag` |
| Lambda | `Errors`, `Throttles`, `Duration` (p99), `ConcurrentExecutions`, `IteratorAge` (for streams) |
| SQS | `ApproximateAgeOfOldestMessage`, `NumberOfMessagesSent`, `NumberOfMessagesDeleted` |
| ECS/EKS | `MemoryUtilization`, `CPUUtilization` (per service), `RunningTaskCount` |
| DynamoDB | `ConsumedReadCapacityUnits`, `ConsumedWriteCapacityUnits`, `ThrottledRequests`, `SystemErrors` |
| Kinesis | `GetRecords.IteratorAgeMilliseconds`, `PutRecord.Success`, `ReadProvisionedThroughputExceeded` |

## CloudWatch Alarms: Alarm Design Principles

```text
Good alarms fire on user impact:
  - High 5xx error rate (user-visible)
  - p95 latency above SLO (user-visible)
  - Oldest message age rising (processing delay)
  - RDS storage below 10% (imminent failure)

Poor alarms create noise:
  - CPU > 80% (not always user-impacting)
  - Memory warning at 70% (depends on workload)
  - Every Lambda error (some errors are expected)
```

**Composite alarms:** combine multiple alarms with AND/OR logic to reduce noise. Alert when: high error rate AND elevated latency (not just elevated latency alone).

## CloudTrail: Usage in Incidents

```bash
# Look up API calls by event name
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteBucket \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z

# Look up all events by a specific user/role
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=jane.doe

# Look up events by resource ARN
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=my-production-bucket

# Find who changed a security group
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AuthorizeSecurityGroupIngress
```

CloudTrail stores management events by default. **Enable data events** (S3 object-level, Lambda invocations, DynamoDB operations) for detailed audit of data access. Enable **CloudTrail Insights** to detect unusual API call patterns automatically.

## AWS Config: Compliance and Drift

AWS Config records every configuration change to supported resources and evaluates rules.

```bash
# Get configuration history for a resource
aws configservice get-resource-config-history \
  --resource-type AWS::EC2::SecurityGroup \
  --resource-id sg-0abcdef1234567890

# List non-compliant resources for a rule
aws configservice get-compliance-details-by-config-rule \
  --config-rule-name s3-bucket-public-read-prohibited \
  --compliance-types NON_COMPLIANT
```

**Common Config rules:**
- `s3-bucket-public-read-prohibited` — detect public S3 buckets
- `ec2-security-group-attached-to-eni` — detect unused SGs
- `rds-instance-public-access-check` — detect public RDS
- `iam-root-access-key-check` — detect root access keys
- `encrypted-volumes` — detect unencrypted EBS volumes

## X-Ray: Distributed Tracing

X-Ray traces requests across services (Lambda, API Gateway, ECS, EC2, RDS, DynamoDB, SQS).

```text
Request enters API Gateway
  -> Lambda function (traced)
    -> DynamoDB GetItem (traced, shows latency)
    -> S3 GetObject (traced)
    -> External HTTP call (traced)

X-Ray service map shows: end-to-end latency, error rates per segment,
which downstream call is the latency bottleneck.
```

Enable in Lambda: set `TracingConfig.Mode = Active` in function configuration.

## Incident Debugging Flow

```text
User reports slow responses:
  1. CloudWatch: ALB TargetResponseTime p95 elevated? Check HTTPCode breakdown.
  2. CloudWatch: Which target group? Which AZ? Are some targets unhealthy?
  3. X-Ray: Service map shows which service segment has the latency spike.
  4. CloudWatch Logs: App logs show DB timeout? Downstream error? GC pause?
  5. RDS metrics: CPU, connections, replica lag, slow query log.
  6. CloudTrail: Any recent config changes (deployment, IAM, SG change)?
```

## Interview Q&A

**Q: What is the difference between CloudWatch, CloudTrail, and AWS Config?**
A: CloudWatch answers "what is happening operationally" — metrics, logs, alarms for runtime behavior. CloudTrail answers "who called which AWS API" — it records management and optionally data plane API calls for audit and investigation. AWS Config answers "how did this resource configuration change over time" — it takes configuration snapshots and evaluates compliance rules.

**Q: Why should you enable CloudTrail data events for S3?**
A: Management events capture bucket creation/deletion and policy changes. Data events capture `GetObject`, `PutObject`, and `DeleteObject` on S3 objects. Without data events, you cannot determine who accessed or modified specific S3 objects during a security incident. Enable data events for sensitive buckets (secrets, backups, user data).

**Q: What metric should you alert on for SQS-based workers?**
A: `ApproximateAgeOfOldestMessage`. This directly measures how long the oldest unprocessed message has been waiting — it reflects user-visible processing delay. A rising age means workers are falling behind. Total queue depth alone is misleading because a large queue with fast workers may not be a problem, but even a small queue with old messages indicates a backlog.
