---
title: "🗄️ Databases & Storage"
sidebar_position: 10
description: "Zero to hero study guide for Databases & Storage — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

Every application is ultimately a system for transforming and persisting data. Database failures are among the most severe incidents — data loss or corruption can be irreversible, and slow queries cascade into full system outages. For a Staff/Principal SRE, this domain covers both theory (SQL, transactions, replication) and operational reality (backup/restore, schema migrations, connection pooling at scale).

Business outcomes:
- **Correctness** — ACID transactions prevent financial inconsistencies, duplicate orders, and inventory errors
- **Performance** — poorly indexed queries cause full table scans on million-row tables; one bad query can take down an entire service
- **Reliability** — replication topology and backup strategy determine your RPO and RTO
- **Scale** — connection pooling, read replicas, and caching are the primary levers for scaling beyond one database

---

## 📋 Prerequisites & Mental Models

**ACID vs BASE trade-off** — ACID (Atomicity, Consistency, Isolation, Durability) gives strong guarantees at the cost of scalability. BASE (Basically Available, Soft state, Eventually consistent) gives scalability at the cost of consistency. Transactional e-commerce needs ACID; social media feeds can use BASE.

**CAP theorem** — a distributed system can guarantee at most 2 of: Consistency, Availability, Partition tolerance. Since network partitions are inevitable, the real choice is CP (consistent, may be unavailable during partition) vs AP (available, may return stale data).

**Read-heavy vs write-heavy** — most web applications are 80-95% reads. Read optimization (caching, read replicas, denormalization) differs fundamentally from write optimization (batching, partitioning, write-ahead log tuning).

---

## 🔷 Core Concepts

### SQL & Query Optimization

```sql
-- Window functions (staff-level must-know)
SELECT
  user_id,
  order_total,
  SUM(order_total) OVER (PARTITION BY user_id ORDER BY created_at) AS running_total,
  RANK() OVER (PARTITION BY region ORDER BY revenue DESC) AS rank_in_region,
  LAG(order_total, 1) OVER (PARTITION BY user_id ORDER BY created_at) AS prev_order
FROM orders;

-- CTEs for readable complex queries
WITH monthly_revenue AS (
  SELECT DATE_TRUNC('month', created_at) AS month, SUM(total) AS revenue
  FROM orders WHERE created_at > NOW() - INTERVAL '12 months'
  GROUP BY 1
),
growth AS (
  SELECT month, revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_revenue
  FROM monthly_revenue
)
SELECT month, revenue,
  ROUND((revenue - prev_revenue) / NULLIF(prev_revenue, 0) * 100, 2) AS growth_pct
FROM growth;

-- Safe concurrent index creation (no table lock)
CREATE INDEX CONCURRENTLY idx_orders_user_created
  ON orders(user_id, created_at DESC);

-- Partial index: smaller, faster, only indexes relevant rows
CREATE INDEX idx_active_users ON users(email)
  WHERE deleted_at IS NULL;

-- Covering index: satisfies query from index alone (no heap access)
CREATE INDEX idx_orders_covering ON orders(user_id)
  INCLUDE (total, status, created_at);

-- EXPLAIN ANALYZE to see actual query plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 10;
```

**Index types:**
- **B-tree** (default): equality, range, ORDER BY — use for most cases
- **Hash**: equality-only, slightly faster, can't do range queries
- **GIN**: full-text search, JSONB contains, array overlap
- **BRIN**: block range, for naturally time-ordered huge tables (log tables, events)
- **Partial**: index only rows matching a WHERE clause — smaller, faster
- **Covering**: INCLUDE non-key columns — satisfy queries from index alone

**Common query performance mistakes:**
- `LIKE '%prefix%'` — wildcard on both ends defeats indexes; use full-text search (GIN + tsvector)
- `WHERE LOWER(email) = $1` — function on column defeats index; create functional index or store lowercased
- `SELECT *` — pulls unnecessary columns, prevents index-only scans
- `ORDER BY` on non-indexed column with large result set — full sort in memory
- N+1 queries — fetching 100 users then making 100 separate queries for their orders; use JOIN

### Transactions & Isolation Levels

**ACID:**
- **Atomicity** — all operations in a transaction commit together or all roll back
- **Consistency** — transaction moves DB between valid states (constraints enforced)
- **Isolation** — concurrent transactions appear to execute serially (degree varies by level)
- **Durability** — committed data survives crashes (ensured by WAL — write-ahead log)

**Isolation levels (weakest to strongest):**

| Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|-------|-----------|---------------------|--------------|
| Read Uncommitted | Possible | Possible | Possible |
| Read Committed (PG default) | Prevented | Possible | Possible |
| Repeatable Read (MySQL default) | Prevented | Prevented | Possible |
| Serializable | Prevented | Prevented | Prevented |

**FOR UPDATE (pessimistic locking):**
```sql
-- Lock rows at read time, prevent concurrent updates
BEGIN;
SELECT qty FROM inventory WHERE product_id = 42 FOR UPDATE;
UPDATE inventory SET qty = qty - 1 WHERE product_id = 42;
COMMIT;
```

Use for: inventory decrement, seat reservation, financial transfers — any "read-then-write-same-row" pattern.

**Optimistic concurrency (version check):**
```sql
-- No lock at read; fail on write if version changed
UPDATE orders SET status='shipped', version=version+1
WHERE id = 99 AND version = 5;
-- If 0 rows updated: someone else modified it; retry
```

### Replication

**Synchronous replication:** primary waits for replica to confirm write before returning to client.
- Guarantee: zero data loss on primary failure
- Cost: write latency increases by one network RTT to replica
- Use for: financial data, audit logs, anything where data loss is unacceptable

**Asynchronous replication:** primary returns immediately; replica catches up in background.
- Replication lag: replica may be seconds or minutes behind
- Risk: failover during lag = data loss proportional to lag × write rate
- Use for: read replicas for scaling reads, analytics, reporting

**Read replicas:** offload read traffic from primary.
- Always eventually consistent (by replication lag)
- Never use for: reads that must see their own writes, critical inventory checks, anything requiring strong consistency
- Good for: reports, dashboards, search, recommendations

**PostgreSQL replication setup:**
```
# postgresql.conf on primary
wal_level = replica
max_wal_senders = 5

# pg_hba.conf on primary
host replication replicator 10.0.0.0/8 md5

# On replica: pg_basebackup -h primary -U replicator -D /var/lib/postgresql/data -P -Xs
```

### Connection Pooling

At scale, each app instance holding DB connections is unsustainable. PostgreSQL max_connections ≈ RAM(MB)/12.5 — defaults to 100. 100 app instances × 10 connections each = 1000 connections, exhausting the pool.

**PgBouncer (PostgreSQL):**
```ini
[databases]
mydb = host=primary.rds.amazonaws.com port=5432 dbname=mydb

[pgbouncer]
pool_mode = transaction        # highest efficiency — connection per transaction
max_client_conn = 5000         # clients PgBouncer accepts
default_pool_size = 25         # server connections to DB per user/db pair
min_pool_size = 5              # keep warm connections ready
server_idle_timeout = 600
```

Transaction mode is the sweet spot: connection only held during a transaction, returned to pool immediately after COMMIT/ROLLBACK. Connection count to DB stays tiny regardless of app instance count.

### Kafka — Event Streaming Platform

Apache Kafka is a distributed, partitioned, replicated log. Key difference from message queues: messages are retained (configurable time/size) and can be re-read from any offset.

**Core concepts:**
- **Topic**: named log of records, divided into partitions
- **Partition**: ordered, immutable sequence of records. Only unit of parallelism. Messages within a partition are totally ordered; no ordering across partitions.
- **Offset**: sequential message position within a partition. Consumer tracks its own offset (stored in `__consumer_offsets` topic).
- **Consumer group**: multiple consumers sharing topic consumption. Each partition assigned to exactly one consumer in a group. Scale: add partitions + consumers (up to partition count).
- **Retention**: messages kept by time (7 days default) or size. Old messages deleted via log compaction or rolling deletion.

**Producer keys and ordering:**
```python
# Same key → same partition → ordered per key
producer.send('orders', key=b'user-123', value=order_data)
# All events for user-123 go to the same partition, in order
```

**Consumer patterns:**
```python
from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    'order-events',
    bootstrap_servers=['kafka:9092'],
    group_id='order-processor',
    auto_offset_reset='earliest',
    enable_auto_commit=False,   # manual commit for at-least-once
    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
)

for message in consumer:
    try:
        process_order(message.value)
        consumer.commit()          # commit only after successful processing
    except Exception as e:
        # send to DLQ, do NOT commit — message will be redelivered
        send_to_dlq(message)
```

**Delivery semantics:**
- At-most-once: fire and forget, no retry. Messages may be lost.
- At-least-once: retry until ack. Messages may be processed multiple times — consumers must be idempotent.
- Exactly-once: Kafka transactions (producers) + idempotent consumers. Highest overhead.

**Common Kafka patterns:**
- **Event sourcing**: store all events as the system of record; derive state by replaying
- **CQRS**: write model (commands) → Kafka → read model (projections) rebuilt from events
- **CDC (Change Data Capture)**: Debezium reads PostgreSQL WAL → publishes row changes to Kafka → downstream services react
- **Dead Letter Queue (DLQ)**: failed messages routed to separate topic for analysis and retry

---

## 🛠️ Tools & Ecosystem

| Tool | Purpose |
|------|---------|
| PostgreSQL | Gold standard OLTP relational DB |
| MySQL / MariaDB | OLTP relational, MySQL ecosystem |
| Redis | In-memory: cache, pub/sub, rate limiting, leaderboards |
| DynamoDB | AWS managed NoSQL, auto-scaling, serverless |
| Apache Kafka | Distributed event streaming |
| Debezium | CDC connector (DB WAL → Kafka) |
| PgBouncer | PostgreSQL connection pooler |
| ProxySQL | MySQL connection pooler + query router |
| pgBackRest | PostgreSQL backup and restore |
| Velero | Kubernetes backup including PVCs |
| Flyway / Liquibase | Database migration version control |
| CloudNativePG | Kubernetes operator for PostgreSQL |

---

## 🏗️ Architecture Patterns

### Read Scaling with Replicas + Redis Cache

```
Write → Primary PostgreSQL (Multi-AZ)
Read (cache hit, TTL-based) → Redis (sub-millisecond)
Read (cache miss, non-critical) → Read Replica (async, eventually consistent)
Read (write-your-own-reads) → Primary
```

Cache invalidation strategies:
- **TTL (time-to-live)**: accept staleness window, simplest operationally
- **Cache-aside (lazy loading)**: populate on cache miss
- **Write-through**: update cache on every write — fresh but higher write cost
- **Event-driven invalidation**: Kafka event on DB change → consumer invalidates cache key

### Expand-Contract Schema Migrations

Safe schema changes in production without downtime:

```
Step 1: Expand — add new column (nullable, backwards-compatible)
  ALTER TABLE orders ADD COLUMN new_status VARCHAR(50);

Step 2: Deploy new code — writes to both old AND new columns
  -- application writes both columns simultaneously

Step 3: Backfill — populate new column for existing rows
  UPDATE orders SET new_status = old_status WHERE new_status IS NULL;

Step 4: Switch reads — deploy code that reads from new column only

Step 5: Contract — remove old column (after old code is gone from all instances)
  ALTER TABLE orders DROP COLUMN old_status;
```

NEVER: add NOT NULL without a default or backfill. Never rename columns (add new, migrate, drop old). Never add a foreign key without first ensuring data consistency.

### Stateful Workloads on Kubernetes

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgresql
spec:
  serviceName: postgresql-headless
  replicas: 1
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ReadWriteOnce]
      storageClassName: gp3-encrypted
      resources:
        requests:
          storage: 200Gi
  template:
    spec:
      containers:
      - name: postgresql
        image: postgres:16
        resources:
          requests: {cpu: "2", memory: "8Gi"}
          limits: {memory: "8Gi"}  # no CPU limit — prefer throttle over OOMKill
        env:
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
```

Use operators for production databases on K8s: **CloudNativePG**, **Zalando Postgres Operator**, **CrunchyData PGO**. Operators handle: failover, backup scheduling, connection pooling, monitoring.

---

## ⚙️ Production Operations

### Backup Strategy

```bash
# pgBackRest — PostgreSQL enterprise backup
pgbackrest --stanza=prod --type=full backup      # weekly full
pgbackrest --stanza=prod --type=diff backup      # daily differential
pgbackrest --stanza=prod --type=incr backup      # hourly incremental (WAL archiving)

# Point-in-time recovery
pgbackrest --stanza=prod   --target="2024-01-15 14:30:00"   --target-action=promote restore

# Verify backup integrity (DO THIS MONTHLY)
pgbackrest --stanza=prod check
```

**Recovery objectives:**
- **RPO** (Recovery Point Objective): max acceptable data loss. WAL archiving every 5 min → RPO ≤ 5 min.
- **RTO** (Recovery Time Objective): max acceptable downtime. Automated failover → RTO <60s. Full restore from backup → RTO hours.

**Test your backups monthly** — backup that has never been restored is theoretical, not actual.

### Query Performance Investigation

```sql
-- Find slowest queries (requires pg_stat_statements extension)
SELECT query, calls,
  round(total_exec_time::numeric / calls, 2) AS avg_ms,
  round(rows::numeric / calls, 2) AS avg_rows
FROM pg_stat_statements
ORDER BY avg_ms DESC
LIMIT 20;

-- Find tables with excessive sequential scans (missing indexes)
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100 AND n_live_tup > 10000
ORDER BY seq_tup_read DESC;

-- Dead tuples (bloat from MVCC) — trigger VACUUM
SELECT relname, n_dead_tup, n_live_tup,
  round(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

**MVCC and VACUUM:** PostgreSQL never overwrites rows — it marks old versions as dead. VACUUM reclaims dead row space. Long-running transactions block VACUUM from cleaning up → table bloat → write slowdowns.

Fix: `SET idle_in_transaction_session_timeout = '30s'` in postgresql.conf. This kills sessions sitting in a transaction doing nothing — the primary bloat source.

---

## 📊 Key Metrics

```promql
# PostgreSQL (via postgres_exporter)
pg_stat_activity_count{state="idle in transaction"}   # connection leak indicator
pg_replication_lag_bytes                               # replica lag
pg_stat_bgwriter_buffers_checkpoint                    # I/O pressure
pg_database_size_bytes                                 # database growth

# Redis
redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total)  # hit rate
redis_memory_used_bytes / redis_memory_max_bytes       # memory pressure
redis_connected_clients                                # connection count

# Kafka
kafka_consumer_group_lag                               # consumer falling behind = scale needed
kafka_log_log_end_offset - kafka_log_log_start_offset # partition size (retention)
```

**Alert thresholds:**
- Replication lag > 30s → P2 (data loss risk on failover)
- Connection pool exhaustion → P1 (all new requests fail)
- Disk > 80% → P2 (writes stop at 100%)
- `idle in transaction` connections accumulating → P2 (VACUUM blocked, locks held)
- Kafka consumer lag growing (not steady) → P2

---

## 🔐 Security

```sql
-- Per-service minimal privileges
CREATE ROLE api_service LOGIN PASSWORD 'changeme';
GRANT CONNECT ON DATABASE mydb TO api_service;
GRANT USAGE ON SCHEMA public TO api_service;
GRANT SELECT, INSERT, UPDATE ON orders, users TO api_service;
-- NOT: GRANT ALL PRIVILEGES

-- Row-level security (Postgres 9.5+)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::int);
```

**Database security baseline:**
- Encrypt at rest (RDS: enabled by default; self-hosted: filesystem encryption + pgcrypto for sensitive columns)
- TLS for all connections (`ssl=on` in postgresql.conf, verify certificates in client connection string)
- Private subnet — no public IP or public endpoint for database
- Audit logging via `pgaudit` extension — logs all DDL and DML for compliance
- Rotate credentials regularly; use Vault dynamic secrets for zero-standing-credentials

---

## 💥 Failure Modes

**Connection pool exhaustion:** all PgBouncer server connections taken, clients queue and time out.
Check: `SELECT count(*), state FROM pg_stat_activity GROUP BY state`. `idle in transaction` is the culprit — set `idle_in_transaction_session_timeout`.

**Replication lag spike:** write-heavy workload outpaces replica's ability to apply changes. If primary fails during lag, data loss = lag × write rate.
Prevention: synchronous replication for critical data, monitor `pg_replication_lag_bytes` continuously.

**Long-running transaction blocks VACUUM:** table bloat accumulates, writes slow, eventually table reaches maximum tuple count.
Fix: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '5 minutes'`.

**Kafka consumer lag accumulates:** consumers can't keep up with producers. Partitions fill up to retention limit, old messages deleted before processing.
Fix: add consumers (up to partition count), optimize consumer processing (batch, async), add partitions and scale consumers together.

**DynamoDB hot partition:** all requests hitting one partition key. Single-digit microsecond latency degrades to seconds for that key.
Fix: distribute writes — add random suffix to hot keys (write sharding), use DAX caching for reads.

---

## 💼 Interview Prep

**"How does MVCC work in PostgreSQL?"**
Each row has `xmin` (transaction that created it) and `xmax` (transaction that deleted/updated it). A query sees rows where `xmin` committed before the query's snapshot and `xmax` either hasn't committed or committed after the snapshot. Dead rows (old versions) accumulate until VACUUM reclaims them. This allows readers to never block writers and vice versa.

**"Design a schema for a multi-tenant SaaS with 10,000 tenants"**
Options: (1) shared schema with tenant_id + row-level security — simplest, one migration, harder isolation; (2) schema per tenant — good isolation, PostgreSQL supports thousands of schemas; (3) database per tenant — maximum isolation, complex connection pooling. For 10,000 tenants: shared schema + RLS + connection pooler. For regulated workloads: schema per tenant.

**"How do you migrate a live production database table with 500M rows?"**
Expand-contract: add new column nullable, deploy dual-write code, background backfill in batches (UPDATE ... WHERE id BETWEEN x AND y, with sleep between batches to avoid lock contention), switch reads, drop old column. Never a single `ALTER TABLE` on the full table — it locks.

---

## 📚 Key Takeaways

1. **Connection pooling is mandatory at scale** — direct connections per app instance do not scale beyond ~50 instances
2. **EXPLAIN ANALYZE before tuning** — understand the query plan before adding indexes
3. **Expand-contract for all schema changes** — never break running code with a migration
4. **Test backup restore monthly** — backup never restored is hypothetical, not operational
5. **Replication lag × write rate = potential data loss** — monitor continuously, alert on 30s+
6. **`idle in transaction` blocks VACUUM** — set session timeout, kill long-idle transactions
7. **Index selectively** — every index adds write overhead; add only what queries actually need
8. **Redis cache invalidation: TTL wins for simplicity** — event-driven for freshness-critical data
9. **Kafka: one consumer max per partition** — scale partitions and consumers together
10. **Private subnet, no public endpoint** — databases should never be directly internet-accessible
11. **Per-service database users with minimum grants** — not shared admin credentials
12. **MVCC means reads never block writes** — PostgreSQL's key scalability feature, enabled by VACUUM
13. **DynamoDB: model access patterns first, schema second** — opposite of relational design
14. **Synchronous replication for financial data** — async = potential data loss on failover
15. **Operators for databases on Kubernetes** — CloudNativePG encodes DBA expertise into automation



---

## 📁 Source Documents

> 6 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[SQL] 1742608741345](http://localhost:8765/api/documents/ad51fafd-90b9-4ce4-95ec-69a316fff1c8/view) | PDF | beginner |
| [[SQL] 1742842635695](http://localhost:8765/api/documents/25dea5fd-094c-4fd1-b628-159884081ec2/view) | PDF | intermediate |
| [[SQL] 1741579681964](http://localhost:8765/api/documents/4cb3fbc7-45d0-4087-9d32-081729076a96/view) | JPG | intermediate |
| [[Kafka] 1717051812367](http://localhost:8765/api/documents/6e4e7104-59c1-4fa7-8de4-edf55677eeb2/view) | PDF | intermediate |
| [[Kafka] 1743221022913](http://localhost:8765/api/documents/d4daec79-7975-4a6d-8336-d7d271f90f03/view) | GIF | intermediate |
| [[Kafka] 1743868191016](http://localhost:8765/api/documents/7ea6cce5-8e6f-4c8d-a456-a0401af609e6/view) | GIF | intermediate |


<AIChatWidget domain="databases-storage" title="Ask AI about Databases & Storage" />

---

## [SRE] Kafka and Event Streaming

## Kafka and Event Streaming

### What It Is and Why It Matters

Apache Kafka is a distributed event streaming platform: a fault-tolerant, high-throughput log that producers write to and consumers read from. It decouples services, enables asynchronous processing, provides durable event history, and supports replay.

Unlike traditional message queues (RabbitMQ, SQS), Kafka retains messages for a configurable period regardless of whether they've been consumed. Multiple independent consumer groups can read the same topic at their own pace. This enables patterns impossible with queues: replaying events to rebuild state, adding new consumers without affecting existing ones, and event sourcing.

Understanding Kafka's architecture — partitions, replication, consumer groups, offsets — and its operational characteristics — throughput, latency, ordering guarantees, consumer lag — is essential for any platform role working with high-volume data pipelines.

---

### Mental Model

**Kafka is a distributed commit log.** Producers append records to topics. Consumers read from topics at their own offset. Kafka stores records durably on disk for a configurable retention period. The key insight: consumers don't "consume" messages in the queue sense (removing them). They read from a position (offset) and maintain that position independently.

```
Producers → [ Topic: orders (3 partitions) ] → Consumer Group A
                                               → Consumer Group B
                                               → Consumer Group C

Each group reads independently at its own offset.
All groups see all messages.
```

---

### Core Concepts

#### Topics, Partitions, and Offsets

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

#### Replication

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

#### Consumer Groups

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

#### Consumer Lag

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

### Producer Deep Dive

#### Batching and Throughput

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

#### Idempotent and Transactional Producers

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

### Kafka Architecture and Operations

#### Broker Configuration

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

#### Topic Creation and Management

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

#### Log Compaction

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

#### ZooKeeper vs KRaft

Originally, Kafka used ZooKeeper for cluster metadata (broker registration, leader election, ACLs). Since Kafka 3.3, the default is **KRaft** (Kafka Raft Metadata) — Kafka manages its own consensus internally, no ZooKeeper required. KRaft is simpler (fewer components) and faster for metadata operations.

In KRaft mode, some brokers are designated as controllers (handle metadata). Others are brokers only.

#### Monitoring

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

### Delivery Semantics

| Semantic | Meaning | How to achieve |
|----------|---------|---------------|
| At-most-once | Messages may be lost, never duplicated | `acks=0`, no retry, auto-commit before processing |
| At-least-once | Messages never lost, may be duplicated | `acks=all`, retry on failure, commit after processing |
| Exactly-once | Each message processed exactly once | Idempotent consumer + transactional producer, or Kafka Streams EOS |

In practice, **at-least-once is the default for most systems** — handle duplicates in the consumer (idempotent processing). Exactly-once is complex and used mainly with Kafka Streams or when duplicates are catastrophic (financial transactions).

---

### Consumer Patterns

#### Dead Letter Queue (DLQ)

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

#### Partition Assignment Strategy

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

### Common Failure Modes

**Consumer lag growing:** Consumer is slower than producer. Diagnose: is processing time increasing? Is the consumer CPU-bound? Can you scale out consumers (add more in the group, up to the partition count)? Can you increase batch size for processing efficiency?

**Rebalance storm:** Frequent consumer group rebalances cause constant partition reassignment — consumers stop processing during rebalance. Causes: consumer heartbeat timeouts (increase `session.timeout.ms`), slow polling (consumer does too much work between `poll()` calls — move to async processing), frequent consumer restarts. Fix: tune `session.timeout.ms`, `heartbeat.interval.ms`, `max.poll.interval.ms`.

**Under-replicated partitions:** A broker is slow or down, causing replicas to fall behind. The partition is still serving reads/writes but with reduced durability. Alert immediately. If `min.insync.replicas=2` and only 1 ISR remains, new writes will fail with `NotEnoughReplicasException`.

**Disk full on broker:** Kafka writes append-only. If disk fills, broker crashes. Monitor disk usage and retention settings. Set `log.retention.bytes` as a safety bound. Use `log.dirs` on dedicated disks, not the OS disk.

**Messages stuck in DLQ with no monitoring:** Poison messages accumulate in DLQ silently. Operators don't notice for days, business logic failures go unreported. Fix: monitor DLQ topic growth rate, alert when DLQ lag is non-zero.

---

### Key Questions and Answers

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

### Points to Remember

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

### What to Study Next

- [Observability, SLOs, and Incident Response](./observability-slos-and-incident-response) — monitoring consumer lag in production
- [Python for SRE](./python-for-sre) — writing Kafka producers and consumers in Python
- [System Design and Cloud Architecture](./system-design-cloud-architecture) — event-driven architecture patterns

---

## [SRE] SQL and Relational Data for SRE

## SQL and Relational Data for SRE

### What It Is and Why It Matters

Relational databases (PostgreSQL, MySQL, SQLite) underpin most production systems. As an SRE or platform engineer, you don't need to be a DBA, but you do need to understand how databases fail, how to read a slow query, how indexes work, how migrations can cause outages, and how replication and failover behave.

Many production incidents have a database at their root: a missing index on a new query, a migration that holds a lock while running, a connection pool exhaustion, a replication lag that causes stale reads. Understanding these patterns lets you diagnose them quickly and design systems that avoid them.

---

### Mental Model

A relational database stores data in tables (rows and columns). Queries describe what data you want; the database's query planner decides how to get it. The performance difference between a query that uses an index and one that does a full table scan can be 1,000x for large tables.

```
Query: SELECT * FROM orders WHERE user_id = 123

Without index on user_id:
    → Sequential scan: read every row, check if user_id == 123
    → O(n) — scales with table size

With index on user_id:
    → Index lookup: B-tree traversal to find rows with user_id == 123
    → O(log n) — scales logarithmically
```

The database's query planner (visible via `EXPLAIN`) decides whether to use an index based on cost estimates. Understanding the planner output is the core diagnostic skill.

---

### Core SQL Concepts

#### SELECT, Filtering, and Ordering

```sql
-- Basic select
SELECT id, name, email, created_at
FROM users
WHERE created_at > '2024-01-01'
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 100;

-- Pattern matching (ILIKE is case-insensitive in PostgreSQL)
SELECT * FROM users WHERE email ILIKE '%@example.com';

-- NULL handling (IS NULL, IS NOT NULL — = NULL never works)
SELECT * FROM orders WHERE completed_at IS NULL;

-- IN clause
SELECT * FROM products WHERE category_id IN (1, 5, 9);

-- BETWEEN (inclusive on both ends)
SELECT * FROM events WHERE occurred_at BETWEEN '2024-01-01' AND '2024-01-31';
```

#### JOINs

```sql
-- INNER JOIN: only rows that match in both tables
SELECT u.name, o.total_amount, o.created_at
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed';

-- LEFT JOIN: all rows from left table, NULLs for non-matching right rows
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;

-- The performance problem with JOINs:
-- Joining two 10M-row tables without indexes on the join columns
-- causes a full table scan or a hash join with huge memory usage
-- Always ensure join columns are indexed
```

#### Aggregation and GROUP BY

```sql
-- Count, sum, avg
SELECT
    date_trunc('day', created_at) AS day,
    COUNT(*) AS order_count,
    SUM(total_amount) AS daily_revenue,
    AVG(total_amount) AS avg_order_value,
    MAX(total_amount) AS max_order
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY date_trunc('day', created_at)
ORDER BY day;

-- HAVING filters on aggregated values (WHERE filters before aggregation)
SELECT user_id, COUNT(*) as order_count
FROM orders
GROUP BY user_id
HAVING COUNT(*) > 10;   -- only users with more than 10 orders
```

#### Window Functions

Window functions compute across a set of related rows without collapsing them:

```sql
-- Rank users by revenue within their region
SELECT
    user_id,
    region,
    total_spent,
    RANK() OVER (PARTITION BY region ORDER BY total_spent DESC) AS rank_in_region,
    SUM(total_spent) OVER (PARTITION BY region) AS region_total,
    total_spent / SUM(total_spent) OVER (PARTITION BY region) AS pct_of_region
FROM user_spending;

-- Running total
SELECT
    created_at,
    amount,
    SUM(amount) OVER (ORDER BY created_at) AS running_total
FROM transactions;

-- Lead/lag: compare current row to next/previous
SELECT
    date,
    revenue,
    LAG(revenue) OVER (ORDER BY date) AS prev_day_revenue,
    revenue - LAG(revenue) OVER (ORDER BY date) AS day_over_day_change
FROM daily_revenue;
```

#### Common Table Expressions (CTEs)

CTEs make complex queries readable by naming intermediate results:

```sql
WITH
-- Step 1: active users in the last 30 days
active_users AS (
    SELECT DISTINCT user_id
    FROM events
    WHERE occurred_at >= NOW() - INTERVAL '30 days'
),
-- Step 2: their total orders
user_orders AS (
    SELECT user_id, COUNT(*) AS order_count, SUM(amount) AS total_spent
    FROM orders
    WHERE user_id IN (SELECT user_id FROM active_users)
    GROUP BY user_id
),
-- Step 3: segment by spend tier
user_segments AS (
    SELECT
        user_id,
        order_count,
        total_spent,
        CASE
            WHEN total_spent >= 1000 THEN 'high_value'
            WHEN total_spent >= 100  THEN 'medium_value'
            ELSE 'low_value'
        END AS segment
    FROM user_orders
)
SELECT segment, COUNT(*) AS user_count, AVG(total_spent) AS avg_spent
FROM user_segments
GROUP BY segment
ORDER BY avg_spent DESC;
```

---

### Indexes Deep Dive

#### How B-Tree Indexes Work

PostgreSQL's default index is a B-tree (balanced tree). It stores column values in sorted order with pointers to the heap (actual rows). Lookups are O(log n).

```sql
-- Create an index
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Composite index (order matters — most selective first)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
-- This index helps: WHERE user_id = 123 AND status = 'pending'
-- This index helps: WHERE user_id = 123 (leftmost prefix)
-- This index does NOT help: WHERE status = 'pending' (no leftmost column)

-- Partial index (only index a subset of rows — smaller, faster)
CREATE INDEX idx_active_users ON users(email) WHERE status = 'active';
-- Only useful if your queries also include: WHERE status = 'active'

-- Unique index (also enforces uniqueness constraint)
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Index on expression
CREATE INDEX idx_users_lower_email ON users(LOWER(email));
-- Helps: WHERE LOWER(email) = 'alice@example.com'
```

#### When Indexes Don't Help (or Hurt)

**Table too small:** For small tables (< 1,000 rows), PostgreSQL's planner may choose sequential scan even with an index — seq scan is faster for small tables.

**Low selectivity column:** Indexing a boolean column (`is_active`) where 90% of rows are `true` has poor selectivity. The planner may skip the index because reading 90% of rows via index is slower than a seq scan.

**Function wrapping prevents index use:**
```sql
-- Index on email is NOT used:
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';
-- Use function index instead, or store emails as lowercase
```

**Index bloat:** Deleted/updated rows leave dead tuples in the index. After heavy write workload, `REINDEX` or `VACUUM` is needed.

#### EXPLAIN ANALYZE

The essential tool for query performance:

```sql
EXPLAIN ANALYZE
SELECT u.name, COUNT(o.id)
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name;
```

Output interpretation:
```
Gather  (cost=1000.00..52000.00 rows=50000 width=36) (actual time=15.3..1234.5 rows=49823)
  ->  Hash Aggregate  (cost=50000.00..50500.00 rows=50000 width=36) (actual time=800.2..900.3 rows=49823)
        ->  Hash Left Join  (cost=10000.00..40000.00 rows=2000000 width=12) (actual time=200.1..700.4 rows=2000000)
              Hash Cond: (o.user_id = u.id)
              ->  Seq Scan on orders o  (cost=0.00..20000.00 rows=2000000 width=8) (actual time=0.1..200.5 rows=2000000)
              ->  Hash  (cost=8000.00..8000.00 rows=50000 width=12) (actual time=150.3..150.3 rows=50000)
                    ->  Index Scan using idx_users_created on users u  ...
```

Key things to read:
- `Seq Scan` vs `Index Scan` vs `Index Only Scan`: seq scan on large table = missing index
- `actual time`: how long each node actually took
- `rows`: estimated vs actual (large discrepancy = stale statistics, run `ANALYZE`)
- `loops`: how many times a node was executed (high loops on Index Scan = N+1 query pattern)

---

### Transactions and ACID

#### ACID Properties

- **Atomicity**: transaction either fully commits or fully rolls back
- **Consistency**: database moves from one valid state to another
- **Isolation**: concurrent transactions don't interfere
- **Durability**: committed transactions survive crashes (WAL)

#### Isolation Levels

```sql
-- Read Committed (PostgreSQL default):
-- Reads only see committed data. May see different data on each read within a transaction.
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Repeatable Read:
-- Sees the same data for the entire transaction, even if others commit changes.
-- Prevents non-repeatable reads but not phantom reads.
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Serializable:
-- Transactions appear to execute serially. Highest consistency, lower performance.
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

#### Locking

```sql
-- Table-level lock (SHARE ROW EXCLUSIVE blocks writes, not reads)
LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE;

-- Row-level lock (SELECT ... FOR UPDATE)
-- Lock the row for update, prevent other transactions from updating it
BEGIN;
SELECT * FROM orders WHERE id = 123 FOR UPDATE;
-- row is now locked
UPDATE orders SET status = 'processing' WHERE id = 123;
COMMIT;

-- SKIP LOCKED: skip already-locked rows (job queue pattern)
SELECT * FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

---

### Schema Migrations Without Downtime

Schema migrations on large tables can cause outages if done carelessly. PostgreSQL's DDL operations hold locks.

#### Safe Migration Patterns

**Adding a nullable column (safe):**
```sql
-- Fast, non-blocking
ALTER TABLE orders ADD COLUMN notes TEXT;
-- Nullable columns are metadata-only changes, no rewrite needed
```

**Adding a NOT NULL column (dangerous on large tables):**
```sql
-- BAD: rewrites the entire table, holds lock for minutes/hours
ALTER TABLE orders ADD COLUMN is_fraud BOOLEAN NOT NULL DEFAULT false;

-- GOOD: three-step approach
-- Step 1: Add nullable column (fast)
ALTER TABLE orders ADD COLUMN is_fraud BOOLEAN;

-- Step 2: Backfill in batches (no table lock)
UPDATE orders SET is_fraud = false WHERE is_fraud IS NULL AND id BETWEEN 1 AND 100000;
-- Repeat in batches...

-- Step 3: Set NOT NULL (fast in modern PostgreSQL if no NULLs exist)
ALTER TABLE orders ALTER COLUMN is_fraud SET NOT NULL;
```

**Adding an index (dangerous, blocks writes):**
```sql
-- BAD: blocks writes while building index
CREATE INDEX idx_orders_amount ON orders(amount);

-- GOOD: concurrent index build (safe, slower)
CREATE INDEX CONCURRENTLY idx_orders_amount ON orders(amount);
-- Takes longer but doesn't block reads or writes
```

**Renaming a column (requires coordinated deploy):**
```sql
-- Can't rename without affecting running queries.
-- Three-step: add new column, backfill, deploy code to use new column, drop old column.
-- Requires backward-compatible code deployed first.
```

**Dropping a column:**
```sql
-- Step 1: Deploy code that no longer references this column
-- Step 2: Then drop the column
ALTER TABLE orders DROP COLUMN legacy_field;
```

---

### Connection Pooling

Databases have a maximum connection limit (`max_connections` in PostgreSQL, typically 100-200 for standard instances). Each connection uses ~5-10MB of RAM. Application servers opening too many connections can exhaust the limit.

#### PgBouncer

PgBouncer is a connection pooler that maintains a smaller pool to PostgreSQL, multiplexing many application connections:

```ini
# pgbouncer.ini
[databases]
myapp = host=db.internal port=5432 dbname=myapp

[pgbouncer]
listen_port = 5432
listen_addr = 0.0.0.0
auth_type = md5
pool_mode = transaction      # return connection to pool after each transaction
max_client_conn = 1000       # maximum application connections to PgBouncer
default_pool_size = 20       # maximum connections PgBouncer opens to PostgreSQL
```

Pooling modes:
- `session`: connection held for entire client session (like no pooler)
- `transaction`: connection held only during a transaction (most efficient, works for most apps)
- `statement`: connection per statement (breaks multi-statement transactions, rarely used)

#### Diagnosing Connection Exhaustion

```sql
-- Check current connections in PostgreSQL
SELECT count(*), state, wait_event_type, wait_event
FROM pg_stat_activity
GROUP BY state, wait_event_type, wait_event
ORDER BY count DESC;

-- Find idle connections (holding but not using)
SELECT pid, usename, application_name, client_addr, state, query_start
FROM pg_stat_activity
WHERE state = 'idle'
ORDER BY query_start;

-- Terminate idle connections older than 5 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';
```

---

### Replication and Failover

#### PostgreSQL Streaming Replication

```
Primary (read/write)
    → WAL (Write-Ahead Log) stream
    → Standby 1 (read-only)
    → Standby 2 (read-only)
```

Standbys replay the primary's WAL in real time. Replication lag = how far behind the standby is.

```sql
-- Check replication lag on primary
SELECT
    application_name,
    state,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state
FROM pg_stat_replication;

-- Check lag on standby
SELECT
    NOW() - pg_last_xact_replay_timestamp() AS replication_lag;
```

#### Failover with Patroni

Patroni is a high-availability solution for PostgreSQL that automates leader election and failover:

```yaml
# patroni.yml
scope: postgres
name: node1

etcd3:
  hosts: etcd1:2379,etcd2:2379,etcd3:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576   # 1MB — don't promote if too far behind

postgresql:
  listen: 0.0.0.0:5432
  data_dir: /var/lib/postgresql/14/main
  pg_hba:
    - host replication replicator 0.0.0.0/0 md5
  parameters:
    wal_level: replica
    hot_standby: on
    max_wal_senders: 3
```

On primary failure: Patroni detects via etcd TTL expiry, elects the standby with the least lag, promotes it to primary, updates the cluster configuration. Failover takes roughly 30 seconds.

---

### Common Failure Modes

**Missing index on foreign key:** When a parent row is deleted, PostgreSQL must check if any child rows reference it. Without an index on the foreign key column in the child table, this is a full table scan. Symptom: deletes from the parent table are very slow. Fix: always create an index on foreign key columns.

**N+1 query problem:** Application loads a list of 100 orders, then queries the user for each order separately (100 separate queries). Symptom: slow page load, database shows many identical queries with different parameters. Fix: use a JOIN in the initial query, or batch load users with `WHERE id IN (...)`.

**Long-running transaction holding lock:** A transaction starts, runs a slow query or waits for application logic, while holding a row lock. Other transactions waiting on that lock pile up. Symptom: `pg_stat_activity` shows many "lock wait" states. Fix: keep transactions short, avoid application logic inside transactions, monitor long-running transactions.

**Autovacuum not keeping up:** After heavy writes (inserts, updates, deletes), dead tuples accumulate. Autovacuum reclaims space but may not keep up. Symptom: table bloat, decreasing query performance. Check `pg_stat_user_tables` for `n_dead_tup`. Fix: tune autovacuum parameters for heavily written tables, manually VACUUM if needed.

**Replication lag spikes during bulk operations:** A bulk insert or update generates a large WAL burst. Standbys lag behind. If you have synchronous replication, this blocks commits on the primary. Fix: for bulk loads, use asynchronous replication with lag alerting; batch operations to reduce WAL burst.

---

### Key Questions and Answers

**Q: How does a B-tree index work and when should you add one?**

A B-tree index is a balanced tree structure that stores column values in sorted order with pointers to the actual rows. Lookup is O(log n) instead of O(n) full scan. Add an index when: a column is frequently used in WHERE clauses with equality or range conditions, a column is used for ORDER BY or GROUP BY on large result sets, a column is a JOIN condition. Don't add indexes blindly — each index slows down INSERT/UPDATE/DELETE (index must be maintained). Rule: for OLTP workloads, check EXPLAIN ANALYZE for "Seq Scan" on large tables — those are candidates for indexing.

**Q: How do you add a column to a million-row table without downtime?**

Add it as nullable first (no table rewrite needed, near-instant). Backfill existing rows in batches during off-peak hours (small transactions to avoid long lock holds). Once all rows are populated, add the NOT NULL constraint (fast if no NULLs exist in PostgreSQL 12+). For indexes, always use `CREATE INDEX CONCURRENTLY` — this builds the index without blocking writes (takes longer but is safe). For columns requiring renaming, coordinate a three-step deploy: add new column, backfill, deploy code using new column, then drop old column.

**Q: What is connection pool exhaustion and how do you diagnose it?**

Each PostgreSQL connection uses 5-10MB RAM. With `max_connections=100` and 20 application pods each opening 10 connections, you're at 200 connections — 100 over the limit. New connections get "FATAL: remaining connection slots are reserved." Diagnose: `SELECT count(*), state FROM pg_stat_activity GROUP BY state` — lots of idle connections means pool sizing problem. Fix: use PgBouncer in transaction-mode pooling; each application request gets a connection only during the transaction, then returns it to the pool. One PostgreSQL backend can serve many application sessions.

**Q: What is WAL and why does it matter for SRE?**

WAL (Write-Ahead Log) is PostgreSQL's durability mechanism: every write is first recorded to the WAL before the actual data pages are modified. On crash recovery, PostgreSQL replays the WAL from the last checkpoint. WAL also powers streaming replication (standbys replay primary's WAL). SRE implications: (1) WAL takes disk space — monitor WAL directory size; (2) WAL replay on the standby creates replication lag — monitor `replay_lag`; (3) `wal_level` setting must be `replica` or `logical` for replication; (4) pg_basebackup and WAL shipping are the basis for point-in-time recovery.

---

### Points to Remember

- `EXPLAIN ANALYZE` is the primary diagnostic tool for slow queries
- B-tree indexes: O(log n) lookup; seq scan: O(n) — add index when seq scan on large table
- Composite index: column order matters — most selective first, queries must use leftmost columns
- `CREATE INDEX CONCURRENTLY` for zero-downtime index creation on live tables
- NOT NULL column addition: add nullable → backfill in batches → add constraint
- ACID: Atomicity, Consistency, Isolation, Durability
- `SELECT FOR UPDATE SKIP LOCKED` is the correct job queue pattern
- Connection pooling (PgBouncer) is mandatory at scale — max 20-50 connections to PostgreSQL
- Replication lag monitored via `pg_stat_replication` (primary) or `pg_last_xact_replay_timestamp()` (standby)
- Long-running transactions block schema changes and cause lock pile-ups
- Check `pg_stat_activity` for idle connections and lock waits during incidents

### What to Study Next

- [System Design and Cloud Architecture](./system-design-cloud-architecture) — database selection in system design
- [AWS Cloud Services and Platform Design](./aws-cloud-services-and-platform-design) — RDS and DynamoDB in AWS
- [Observability, SLOs, and Incident Response](./observability-slos-and-incident-response) — database metrics and SLOs
