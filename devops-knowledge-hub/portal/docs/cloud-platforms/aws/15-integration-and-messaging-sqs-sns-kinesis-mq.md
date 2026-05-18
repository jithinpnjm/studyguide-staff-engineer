---
title: "Integration And Messaging: SQS, SNS, Kinesis, MQ"
sidebar_position: 15
---

# Integration And Messaging: SQS, SNS, Kinesis, MQ

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

SQS is a queue for work buffering. SNS is pub/sub fanout. Kinesis Data Streams is ordered streaming for real-time processing. Firehose is managed delivery into destinations. Amazon MQ is managed ActiveMQ/RabbitMQ for compatibility.

The operational reason to use messaging is failure isolation. Without a queue, a slow downstream service blocks the user path. With a queue, the app accepts work and workers process at sustainable speed. This changes the reliability model from synchronous success to durable acceptance plus asynchronous completion.

Failure modes:

- visibility timeout too short causes duplicate processing
- no DLQ means poison messages loop forever
- queue depth grows because downstream database is slow
- FIFO message group creates unexpected bottleneck
- Kinesis shard count limits throughput
- consumer retries overwhelm downstream

AWS docs:

- SQS visibility timeout: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html

---

## Service Comparison: When to Use What

| Service | Model | Best For | Not For |
|---|---|---|---|
| SQS Standard | Pull queue, at-least-once | Work buffering, burst absorption, decoupling | Strict ordering or exactly-once semantics |
| SQS FIFO | Pull queue, exactly-once within group | Ordered processing, deduplication | Very high throughput (max 3,000 msg/s with batching) |
| SNS | Push pub/sub | Fan-out to multiple consumers | Persistent queuing or consumer-paced processing |
| EventBridge | Event routing with rules | AWS/SaaS event routing, scheduled events, filtering | Simple queue buffering |
| Kinesis Data Streams | Ordered stream per shard | Real-time analytics, ordered event processing | Simple task queuing |
| Kinesis Firehose | Managed delivery | Load into S3/Redshift/OpenSearch without writing consumer code | Real-time processing |
| Amazon MQ | ActiveMQ / RabbitMQ | Migrating on-premises apps using AMQP/STOMP/OpenWire | Greenfield AWS-native apps |

## SQS Key Concepts

| Concept | Meaning | Operational Impact |
|---|---|---|
| Visibility timeout | Message hidden from other consumers while being processed | Too short = duplicate processing; too long = slow retry on failure |
| Dead-letter queue | Queue for messages that exceeded `maxReceiveCount` | Without DLQ, poison messages loop forever and block queue progress |
| Long polling | Consumer waits up to 20s for messages | Reduces empty API calls and cost; always prefer over short polling |
| Message deduplication (FIFO) | Prevents duplicate sends within 5-minute window | Important for idempotency guarantees |
| Message group ID (FIFO) | Ordering and parallelism grouping | Wrong grouping turns FIFO into a serial bottleneck |
| Approximate number of messages | CloudWatch metric for queue depth | Use for scaling trigger: workers = queue depth / target depth per worker |

**Critical SRE rule: SQS consumers must be idempotent.** At-least-once delivery means the same message can arrive more than once, especially if the visibility timeout expires before the consumer finishes.

## SNS Fan-out Pattern

```text
S3 event / API call
  -> SNS Topic
    -> SQS Queue (Team A — retry-safe processing)
    -> SQS Queue (Team B — independent failure domain)
    -> Lambda (real-time processing)
    -> HTTP endpoint (webhook)
```

Each SQS queue has its own DLQ and retry policy. One team's consumer failure does not block others.

## EventBridge vs SNS vs SQS Decision

```text
Need fan-out to many consumers?             -> SNS
Need to filter/route events by content?    -> EventBridge
Need to buffer work and process at rate?   -> SQS
Need strict ordering with deduplication?   -> SQS FIFO
Need to schedule recurring jobs?           -> EventBridge Scheduler
Need to respond to AWS service events?     -> EventBridge
```

## Kinesis Data Streams

Each shard supports 1 MB/s write and 2 MB/s read. Shard count determines throughput capacity.

```text
Producers -> Kinesis Data Stream (N shards)
  -> Consumer 1: Lambda (event-driven, per-shard)
  -> Consumer 2: KCL application (checkpointing)
  -> Kinesis Firehose (delivery to S3/Redshift)
```

**Ordering is per-shard.** To preserve order for a logical entity (e.g., user events), use the same partition key so all events land on the same shard.

## CLI: Common Operations

```bash
# Send a message to SQS
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/my-queue \
  --message-body '{"event":"order_created","order_id":"123"}'

# Get queue depth metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name ApproximateNumberOfMessagesVisible \
  --dimensions Name=QueueName,Value=my-queue \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 --statistics Average

# Inspect DLQ messages (read without delete)
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/my-dlq \
  --visibility-timeout 300

# Publish to SNS topic
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789012:my-topic \
  --message '{"default":"test message"}' \
  --message-structure json

# List Kinesis shards
aws kinesis describe-stream-summary \
  --stream-name my-stream
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| Queue age rising but worker count is high | Workers are slow (DB blocked, downstream rate limit) or stuck on a poison message | Check DLQ messages; tune visibility timeout to match max processing time |
| Same message processed multiple times | Visibility timeout shorter than processing time | Extend visibility timeout during processing; design handlers to be idempotent |
| No DLQ configured, worker fails on bad message | Message loops until max age, blocking normal messages | Always configure DLQ with `maxReceiveCount` |
| FIFO queue becomes serial bottleneck | All messages using same message group ID | Use per-entity group IDs to allow parallel processing across groups |
| Kinesis consumer falling behind | Shard count too low or consumer processing too slow | Increase shard count; use Enhanced Fan-Out for parallel consumers |
| SNS delivery to Lambda fails silently | Lambda concurrency limit hit | Check Lambda throttle metrics; add SQS as buffer between SNS and Lambda |

## Interview Q&A

**Q: What is the SQS visibility timeout and why must consumers be idempotent?**
A: When a consumer receives a message, SQS hides it for the visibility timeout period. If the consumer crashes or takes too long, the timeout expires and the message becomes visible again. Another consumer (or the same one) picks it up. This at-least-once delivery means processing the same message twice is possible — so handlers must produce the same result if the same message is processed more than once.

**Q: When would you choose SQS over Kinesis?**
A: SQS for task queuing where order is not critical, messages are independent, and you want simple consumer scaling with DLQ and retry built in. Kinesis when you need ordered streaming per shard, multiple independent consumers reading the same stream, replay capability, or real-time analytics. Kinesis also has a retention window (default 24h, up to 365 days) so consumers can re-read data.

**Q: How do you scale workers consuming from an SQS queue?**
A: Scale on `ApproximateAgeOfOldestMessage` or on queue depth per worker. Not on total queue depth alone. If target processing time is 1 minute and oldest message is 5 minutes old, you need more workers. ASG scaling policy or KEDA (for Kubernetes) can trigger on this metric.
