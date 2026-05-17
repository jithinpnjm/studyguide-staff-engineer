---
title: "Kafka and Event Streaming"
sidebar_position: 20
---

# Kafka and Event Streaming

## What It Is and Why It Matters

Apache Kafka is a distributed event streaming platform: a fault-tolerant, high-throughput log that producers write to and consumers read from. It decouples services, enables asynchronous processing, provides durable event history, and supports replay.

Unlike traditional message queues (RabbitMQ, SQS), Kafka retains messages for a configurable period regardless of whether they've been consumed. Multiple independent consumer groups can read the same topic at their own pace. This enables patterns impossible with queues: replaying events to rebuild state, adding new consumers without affecting existing ones, and event sourcing.

Understanding Kafka's architecture — partitions, replication, consumer groups, offsets — and its operational characteristics — throughput, latency, ordering guarantees, consumer lag — is essential for any platform role working with high-volume data pipelines.

---

## Mental Model

**Kafka is a distributed commit log.** Producers append records to topics. Consumers read from topics at their own offset. Kafka stores records durably on disk for a configurable retention period. The key insight: consumers don't "consume" messages in the queue sense (removing them). They read from a position (offset) and maintain that position independently.

```
Producers → [ Topic: orders (3 partitions) ] → Consumer Group A
                                               → Consumer Group B
                                               → Consumer Group C

Each group reads independently at its own offset.
All groups see all messages.
```

---

## Core Concepts

### Topics, Partitions, and Offsets

A **topic** is a named log. A topic is divided into **partitions** — ordered, immutable sequences of records. Each record in a partition has a monotonically increasing **offset**.

```
Topic: user-events
├── Partition 0: [offset 0] [offset 1] [offset 2] ... [offset 1,247,832]
├── Partition 1: [offset 0] [offset 1] [offset 2] ... [offset 1,198,201]
└── Partition 2: [offset 0] [offset 1] [offset 2] ... [offset 1,302,456]
```

Why partitions?
- **Parallelism**: different consumers in a consumer group read different partitions in parallel
- **Throughput**: a single partition is a single append-only file — throughput scales with partition count
- **Ordering**: ordering is guaranteed within a partition, not across partitions

**Partition key**: producers specify a key with each record. Records with the same key always go to the same partition (Kafka hashes the key to determine partition). This ensures ordering for a given entity (e.g., all events for user ID 123 go to the same partition).

```python
from confluent_kafka import Producer

producer = Producer({'bootstrap.servers': 'kafka:9092'})

# Same user's events go to same partition (ordered)
producer.produce(
    topic='user-events',
    key='user-123',          # hash(key) % num_partitions = partition
    value='{"event": "login", "timestamp": "2024-01-15T10:00:00Z"}'
)
```

### Replication

Each partition has a **leader** and N-1 **followers** (ISR: In-Sync Replicas). The leader handles all reads and writes. Followers replicate from the leader.

```
Partition 0 leader: broker-1
Partition 0 replicas: [broker-2, broker-3]  # ISR (in-sync replicas)
```

**Replication factor**: how many copies of each partition. `replication.factor=3` means 3 copies across 3 brokers.

**ISR (In-Sync Replicas)**: replicas that are caught up with the leader. A replica falls out of ISR if it's more than `replica.lag.time.max.ms` behind.

**acks setting (producer)**:
- `acks=0`: fire and forget. No durability guarantee. Highest throughput.
- `acks=1`: leader acknowledges. If leader fails before followers replicate, data is lost.
- `acks=all` (or `-1`): all ISRs acknowledge. Maximum durability. Combined with `min.insync.replicas=2` ensures at least 2 copies before acking.

```python
# Maximum durability configuration
producer = Producer({
    'bootstrap.servers': 'kafka:9092',
    'acks': 'all',
    'retries': 5,
    'retry.backoff.ms': 100,
    'enable.idempotence': True,   # exactly-once producer semantics
})
```

### Consumer Groups

Consumer groups allow multiple consumers to split the work of reading a topic:

```
Topic: orders (6 partitions)
Consumer Group: order-processor (3 consumers)

Consumer 0 → Partitions 0, 1
Consumer 1 → Partitions 2, 3
Consumer 2 → Partitions 4, 5
```

Rules:
- Each partition is consumed by exactly one consumer within a group
- If consumers > partitions, some consumers are idle
- If consumers < partitions, some consumers handle multiple partitions

**Offset management**: consumers commit their offset to Kafka (stored in `__consumer_offsets` topic). On restart or rebalance, the consumer resumes from the last committed offset.

```python
from confluent_kafka import Consumer

consumer = Consumer({
    'bootstrap.servers': 'kafka:9092',
    'group.id': 'order-processor',
    'auto.offset.reset': 'earliest',     # start from beginning if no committed offset
    'enable.auto.commit': False,         # manual commit for better control
})

consumer.subscribe(['orders'])

while True:
    msg = consumer.poll(timeout=1.0)
    if msg is None:
        continue
    if msg.error():
        handle_error(msg.error())
        continue

    try:
        process_order(msg.value())
        # Commit only after successful processing
        consumer.commit(msg)
    except Exception as e:
        # Don't commit — message will be redelivered
        log.error(f"Failed to process message: {e}")
```

### Consumer Lag

Consumer lag = the difference between the latest offset in the partition (log-end offset) and the consumer's committed offset. It represents unprocessed messages.

```bash
# Check consumer lag
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe \
  --group order-processor

# Output:
# TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# orders  0          1000010         1000050         40
# orders  1          999800          1000000         200
# orders  2          1000200         1000200         0

# Total lag: 40 + 200 + 0 = 240 unprocessed messages
```

Consumer lag is the primary operational metric for Kafka consumers. Alert when lag exceeds your processing time tolerance. Monitor with Prometheus via JMX exporter or Kafka exporter.

---

## Producer Deep Dive

### Batching and Throughput

Kafka producers batch records before sending. Tuning for throughput:

```python
producer = Producer({
    'bootstrap.servers': 'kafka:9092',
    'linger.ms': 5,           # wait up to 5ms to accumulate a batch
    'batch.size': 65536,      # batch up to 64KB per partition
    'compression.type': 'snappy',  # compress batches
    'buffer.memory': 33554432,     # 32MB producer buffer
})
```

Tuning for low latency:
```python
producer = Producer({
    'linger.ms': 0,           # send immediately, no batching delay
    'batch.size': 16384,      # smaller batches
    'compression.type': 'none',
})
```

### Idempotent and Transactional Producers

**Idempotent producer** (`enable.idempotence=True`): assigns a sequence number to each record. Broker deduplicates retries with the same sequence number. Prevents duplicates on network retry.

**Transactional producer**: atomic writes across multiple partitions and topics. Either all succeed or all fail. Used for exactly-once stream processing.

```python
producer = Producer({
    'bootstrap.servers': 'kafka:9092',
    'transactional.id': 'order-processor-v1',  # unique per producer instance
    'enable.idempotence': True,
})

producer.init_transactions()

try:
    producer.begin_transaction()
    producer.produce('payments', key='order-123', value='{"status": "charged"}')
    producer.produce('order-status', key='order-123', value='{"status": "confirmed"}')
    producer.commit_transaction()
except Exception as e:
    producer.abort_transaction()
```

---

## Kafka Architecture and Operations

### Broker Configuration

```properties
# server.properties
broker.id=1
listeners=PLAINTEXT://0.0.0.0:9092
log.dirs=/var/kafka/data

# Replication
default.replication.factor=3
min.insync.replicas=2            # require 2 ISRs for acks=all

# Retention
log.retention.hours=168          # 7 days
log.retention.bytes=107374182400 # 100GB per partition
log.segment.bytes=1073741824     # 1GB segment files
log.cleanup.policy=delete        # delete old segments (vs compact)

# Performance
num.io.threads=8
num.network.threads=3
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
num.partitions=6                 # default partition count for new topics
```

### Topic Creation and Management

```bash
# Create a topic
kafka-topics.sh --bootstrap-server kafka:9092 \
  --create \
  --topic user-events \
  --partitions 12 \
  --replication-factor 3 \
  --config retention.ms=604800000 \  # 7 days
  --config min.insync.replicas=2

# List topics
kafka-topics.sh --bootstrap-server kafka:9092 --list

# Describe topic (show partitions, replication)
kafka-topics.sh --bootstrap-server kafka:9092 --describe --topic user-events

# Increase partition count (can only increase, not decrease)
kafka-topics.sh --bootstrap-server kafka:9092 \
  --alter --topic user-events --partitions 24

# Delete topic
kafka-topics.sh --bootstrap-server kafka:9092 --delete --topic old-topic
```

### Log Compaction

Log compaction keeps the last value for each key in a topic. Useful for changelog topics and state stores:

```bash
# Create a compacted topic
kafka-topics.sh --bootstrap-server kafka:9092 \
  --create --topic user-profiles \
  --partitions 6 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --config min.cleanable.dirty.ratio=0.1 \
  --config segment.ms=3600000
```

With compaction: if you write `{key: "user-123", value: "{name: Alice}"}` then `{key: "user-123", value: "{name: Alice Smith}"}`, the compacted log retains only the latest: `{key: "user-123", value: "{name: Alice Smith}"}`.

### ZooKeeper vs KRaft

Originally, Kafka used ZooKeeper for cluster metadata (broker registration, leader election, ACLs). Since Kafka 3.3, the default is **KRaft** (Kafka Raft Metadata) — Kafka manages its own consensus internally, no ZooKeeper required. KRaft is simpler (fewer components) and faster for metadata operations.

In KRaft mode, some brokers are designated as controllers (handle metadata). Others are brokers only.

### Monitoring

Key metrics:

```promql
# Consumer lag per group/topic/partition
kafka_consumer_group_lag{group="order-processor", topic="orders"}

# Broker under-replicated partitions (should be 0)
kafka_server_replicamanager_underreplicatedpartitions

# Producer request latency
rate(kafka_producer_request_latency_avg[5m])

# Messages in per second
rate(kafka_server_brokertopicmetrics_messagesin_total[5m])

# Disk usage
kafka_log_size{topic="user-events"}
```

Alert on:
- `kafka_consumer_group_lag > 10000` (lag growing — consumer can't keep up)
- `kafka_server_replicamanager_underreplicatedpartitions > 0` (replication degraded)
- `kafka_server_replicamanager_offlinereplicacount > 0` (data at risk)

---

## Delivery Semantics

| Semantic | Meaning | How to achieve |
|----------|---------|---------------|
| At-most-once | Messages may be lost, never duplicated | `acks=0`, no retry, auto-commit before processing |
| At-least-once | Messages never lost, may be duplicated | `acks=all`, retry on failure, commit after processing |
| Exactly-once | Each message processed exactly once | Idempotent consumer + transactional producer, or Kafka Streams EOS |

In practice, **at-least-once is the default for most systems** — handle duplicates in the consumer (idempotent processing). Exactly-once is complex and used mainly with Kafka Streams or when duplicates are catastrophic (financial transactions).

---

## Consumer Patterns

### Dead Letter Queue (DLQ)

When a consumer can't process a message, it should not loop-retry indefinitely (blocks the partition). Use a DLQ:

```python
MAX_RETRIES = 3

def process_with_dlq(consumer, dlq_producer):
    msg = consumer.poll(timeout=1.0)
    if msg is None:
        return

    retry_count = int(msg.headers().get('retry-count', 0))

    try:
        process_order(msg.value())
        consumer.commit(msg)
    except ProcessingError as e:
        if retry_count < MAX_RETRIES:
            # Republish with incremented retry count
            dlq_producer.produce(
                topic=f'{msg.topic()}-retry',
                key=msg.key(),
                value=msg.value(),
                headers={
                    'retry-count': str(retry_count + 1),
                    'original-topic': msg.topic(),
                    'error': str(e)
                }
            )
        else:
            # Final DLQ — for manual inspection
            dlq_producer.produce(
                topic=f'{msg.topic()}-dlq',
                key=msg.key(),
                value=msg.value(),
                headers={'error': str(e), 'original-offset': str(msg.offset())}
            )
        consumer.commit(msg)  # commit to move past the poison message
```

### Partition Assignment Strategy

```python
consumer = Consumer({
    'group.id': 'processor',
    'partition.assignment.strategy': 'cooperative-sticky',
    # Options:
    # 'range': assigns consecutive partitions — consumer 0 gets [0,1], consumer 1 gets [2,3]
    # 'roundrobin': round-robin across consumers
    # 'sticky': minimize partition movement on rebalance (reduces rebalance cost)
    # 'cooperative-sticky': incremental rebalance — no stop-the-world
})
```

`cooperative-sticky` is preferred in production — it uses incremental rebalancing, so consumers don't all stop processing during a rebalance.

---

## Common Failure Modes

**Consumer lag growing:** Consumer is slower than producer. Diagnose: is processing time increasing? Is the consumer CPU-bound? Can you scale out consumers (add more in the group, up to the partition count)? Can you increase batch size for processing efficiency?

**Rebalance storm:** Frequent consumer group rebalances cause constant partition reassignment — consumers stop processing during rebalance. Causes: consumer heartbeat timeouts (increase `session.timeout.ms`), slow polling (consumer does too much work between `poll()` calls — move to async processing), frequent consumer restarts. Fix: tune `session.timeout.ms`, `heartbeat.interval.ms`, `max.poll.interval.ms`.

**Under-replicated partitions:** A broker is slow or down, causing replicas to fall behind. The partition is still serving reads/writes but with reduced durability. Alert immediately. If `min.insync.replicas=2` and only 1 ISR remains, new writes will fail with `NotEnoughReplicasException`.

**Disk full on broker:** Kafka writes append-only. If disk fills, broker crashes. Monitor disk usage and retention settings. Set `log.retention.bytes` as a safety bound. Use `log.dirs` on dedicated disks, not the OS disk.

**Messages stuck in DLQ with no monitoring:** Poison messages accumulate in DLQ silently. Operators don't notice for days, business logic failures go unreported. Fix: monitor DLQ topic growth rate, alert when DLQ lag is non-zero.

---

## Key Questions and Answers

**Q: How does Kafka guarantee message ordering?**

Kafka guarantees ordering within a partition. If you need all events for a user to be processed in order, use the user ID as the partition key — all events for that user go to the same partition, where they are stored and delivered in write order. Ordering across partitions is not guaranteed. If you need global ordering across all events, use a single partition — but this kills parallelism.

**Q: What is the difference between at-least-once and exactly-once delivery?**

At-least-once: use `acks=all`, retry on producer failure, commit offset only after successful processing. The consumer may see duplicates if a message is processed and then the consumer crashes before committing the offset — it will re-read and re-process the message on restart. Design consumers to be idempotent (same message processed twice has the same effect as once). Exactly-once: use idempotent producers (`enable.idempotence=true`) and transactional APIs, or Kafka Streams EOS. Much more complex. Use for financial/billing systems where duplicates are catastrophic.

**Q: How do you handle a slow consumer that is falling behind?**

First: measure and characterize the lag. Is it growing? Stable? Check if message processing time increased (code change, slow downstream dependency). Solutions: (1) scale out — add more consumers to the group (up to partition count); (2) increase batch size for efficient bulk processing; (3) async processing — poll quickly and process in a thread pool; (4) optimize the slow operation (cache database lookups, batch DB writes); (5) increase partition count if consumers are maxed out.

**Q: When would you use Kafka vs a traditional message queue (SQS, RabbitMQ)?**

Use Kafka when: you need replay capability (reprocess historical events), multiple independent consumer groups need to read the same messages, you need ordered processing per entity, throughput is high (millions of events/second), or you're building event sourcing. Use a message queue when: you just need task distribution with worker pattern, messages don't need to be retained after consumption, ordering doesn't matter, or you need message-level acknowledgment and individual message TTL.

**Q: What happens when a Kafka broker fails?**

Kafka detects the failure via ZooKeeper (or KRaft controller) heartbeat timeout. For partitions where the failed broker was the leader, a new leader is elected from the ISR. Producers and consumers get updated metadata and reconnect to the new leader. If the failed broker had partitions with no other ISR copies (because `min.insync.replicas` was set too low), those partitions become unavailable until the broker recovers. Recovery time depends on whether the broker's disk is intact — Kafka uses log recovery to replay the WAL.

---

## Points to Remember

- Kafka is a distributed commit log; consumers read at their own offset, messages are not removed
- Partitions enable parallelism; ordering is per-partition, not per-topic
- Use partition keys to route related events to the same partition (ensures ordering)
- Replication factor 3, min.insync.replicas 2 is the standard durability config
- `acks=all` + `enable.idempotence=true` for durable, de-duplicated producer
- Consumer groups: each partition consumed by one consumer per group
- Consumer lag is the primary health metric — alert when it grows
- At-least-once is the default; make consumers idempotent to handle duplicates
- Exactly-once requires transactional APIs — complex, use only when duplicates are catastrophic
- DLQ pattern: after N retries, send to dead letter topic, don't block the partition
- `cooperative-sticky` assignment strategy reduces rebalance impact
- Log compaction retains latest value per key; used for changelog/state topics
- Monitor: lag, under-replicated partitions, disk usage, broker request latency

## What to Study Next

- [Observability, SLOs, and Incident Response](./observability-slos-and-incident-response) — monitoring consumer lag in production
- [Python for SRE](./python-for-sre) — writing Kafka producers and consumers in Python
- [System Design and Cloud Architecture](./system-design-cloud-architecture) — event-driven architecture patterns
