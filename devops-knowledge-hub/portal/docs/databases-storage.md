---
title: "🗄️ Databases & Storage"
sidebar_position: 10
description: "Zero to hero study guide for Databases & Storage — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

Every application is ultimately a system for transforming and persisting data. Database failures are among the most severe incidents — data loss or corruption can be irreversible, and slow queries cascade into full system outages.

Business outcomes:
- **Correctness** — ACID transactions prevent financial inconsistencies, duplicate orders, and inventory errors
- **Performance** — poorly indexed queries cause full table scans; one bad query can take down an entire service
- **Reliability** — replication topology and backup strategy determine your RPO and RTO
- **Scale** — connection pooling, read replicas, and caching are the primary levers for scaling beyond one database

---

## SQL Fundamentals (From Interview Q&A)

### Core SQL Concepts

**Q: What is SQL?**
SQL stands for Structured Query Language. It is a programming language used for managing and manipulating relational databases.

**Q: What is a database?**
A database is an organized collection of data stored and accessed electronically. It provides a way to store, organize, and retrieve large amounts of data efficiently.

**Q: What is a primary key?**
A primary key is a column or combination of columns that uniquely identifies each row in a table. It enforces the entity integrity rule in a relational database.

**Q: What is a foreign key?**
A foreign key is a column or combination of columns that establishes a link between data in two tables. It ensures referential integrity by enforcing relationships between tables.

**Q: What is the difference between a primary key and a unique key?**
A primary key uniquely identifies a row and must have a unique value. A unique key ensures that a column or combination of columns has a unique value but does not necessarily identify the row.

### Joins

**Q: What is a join in SQL?**
A join is an operation used to combine rows from two or more tables based on related columns. It allows you to retrieve data from multiple tables simultaneously.

```sql
-- INNER JOIN: returns rows where there is a match in both tables
SELECT orders.id, users.name
FROM orders
INNER JOIN users ON orders.user_id = users.id;

-- LEFT JOIN: returns all rows from the left table plus matching rows from the right
SELECT users.name, orders.id
FROM users
LEFT JOIN orders ON users.id = orders.user_id;
```

### DELETE vs TRUNCATE

**Q: What is the difference between DELETE and TRUNCATE?**
- `DELETE` removes specific rows based on a condition. It can be rolled back and generates individual delete operations for each row.
- `TRUNCATE` removes all rows from a table. It cannot be rolled back, and it is faster because it deallocates the data pages instead of logging individual row deletions.

```sql
DELETE FROM orders WHERE status = 'cancelled';   -- conditional, rollback-able
TRUNCATE TABLE temp_staging;                     -- all rows, fast, no rollback
```

### UNION vs UNION ALL

**Q: What is the difference between UNION and UNION ALL?**
- `UNION` combines result sets of two or more SELECT statements and removes duplicate rows.
- `UNION ALL` includes all rows, including duplicates.

```sql
SELECT name FROM customers_us
UNION
SELECT name FROM customers_eu;      -- deduplicates

SELECT name FROM customers_us
UNION ALL
SELECT name FROM customers_eu;      -- keeps duplicates, faster
```

### WHERE vs HAVING

**Q: What is the difference between HAVING and WHERE?**
- `WHERE` filters rows based on a condition before grouping or aggregation. It operates on individual rows.
- `HAVING` filters grouped rows based on a condition after the data is grouped using `GROUP BY`.

```sql
-- WHERE filters rows before grouping
SELECT region, SUM(revenue)
FROM orders
WHERE status = 'completed'
GROUP BY region;

-- HAVING filters after grouping
SELECT region, SUM(revenue) AS total
FROM orders
GROUP BY region
HAVING SUM(revenue) > 100000;
```

### Transactions

**Q: What is a transaction in SQL?**
A transaction is a sequence of SQL statements that are executed as a single logical unit. Transactions ensure that either all the statements succeed or all are rolled back.

### Normalization

**Q: What is normalization?**
Normalization is the process of organizing data in a database to minimize redundancy and dependency. It involves breaking down a table into smaller tables and establishing relationships between them.

**Types of normalization:**
- First Normal Form (1NF)
- Second Normal Form (2NF)
- Third Normal Form (3NF)
- Boyce-Codd Normal Form (BCNF)
- Fourth Normal Form (4NF)
- Fifth Normal Form (5NF) / Project-Join Normal Form (PJNF)

---

## SQL Query Optimization

```sql
-- Window functions (must-know for staff level)
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

**Common query performance mistakes:**
- `LIKE '%prefix%'` — wildcard on both ends defeats indexes; use full-text search (GIN + tsvector)
- `WHERE LOWER(email) = $1` — function on column defeats index; create functional index or store lowercased
- `SELECT *` — pulls unnecessary columns, prevents index-only scans
- N+1 queries — fetching users then making separate queries per user for their orders; use JOIN

---

## Transactions and Isolation Levels

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

---

## Replication

**Synchronous replication:** primary waits for replica to confirm write before returning to client.
- Guarantee: zero data loss on primary failure
- Cost: write latency increases by one network RTT
- Use for: financial data, audit logs

**Asynchronous replication:** primary returns immediately; replica catches up in background.
- Risk: failover during lag = data loss proportional to lag × write rate
- Use for: read replicas for scaling reads, analytics, reporting

**PostgreSQL replication setup:**
```
# postgresql.conf on primary
wal_level = replica
max_wal_senders = 5

# pg_hba.conf on primary
host replication replicator 10.0.0.0/8 md5

# On replica:
pg_basebackup -h primary -U replicator -D /var/lib/postgresql/data -P -Xs
```

---

## Connection Pooling

At scale, each app instance holding DB connections is unsustainable. PostgreSQL `max_connections` ≈ RAM(MB)/12.5 — defaults to 100. 100 app instances × 10 connections each = 1000 connections, exhausting the pool.

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

Transaction mode is the sweet spot: connection only held during a transaction, returned to pool immediately after COMMIT/ROLLBACK.

---

## Apache Kafka — Event Streaming

Apache Kafka is a distributed, partitioned, replicated log designed for real-time data pipelines and event streaming. Key difference from message queues: messages are retained (configurable time/size) and can be re-read from any offset.

### Core Concepts

- **Topic** — named log of records, divided into partitions. Topics and data streams are the central concept in Kafka.
- **Partition** — ordered, immutable sequence of records. Only unit of parallelism. Messages within a partition are totally ordered; no ordering across partitions.
- **Offset** — sequential message position within a partition. Consumer tracks its own offset (stored in `__consumer_offsets` topic).
- **Consumer group** — multiple consumers sharing topic consumption. Each partition assigned to exactly one consumer in a group.
- **Replication** — Kafka replicates partitions across brokers (the power of copying and reproducing). One broker acts as the "leader" for each partition — all reads and writes go through the leader.
- **Retention** — messages kept by time (7 days default) or size.

### Leaders and Elections

Each partition has one leader and zero or more followers. All reads and writes happen through the leader. If a leader fails, Kafka elects a new leader from the in-sync replicas (ISR).

**What is ISR?** The ISR (In-Sync Replicas) is the set of replicas that are fully caught up with the leader. Only replicas in the ISR are eligible to become leaders. Minimum in-sync replicas (`min.insync.replicas`) controls how many replicas must acknowledge a write.

### Producer Performance: Ack Value

The `acks` setting controls producer durability:

- `acks=0` — fire and forget, no acknowledgement. Highest throughput, data loss possible.
- `acks=1` — leader acknowledges. Data loss if leader fails before replicas replicate.
- `acks=all` (or `acks=-1`) — all in-sync replicas must acknowledge. Safest, lower throughput.

### Batch Messages and Compression

For high throughput, batch messages and compress large records:

- `linger.ms` — how long the producer waits to batch messages
- `batch.size` — maximum batch size in bytes
- Compression: `snappy`, `gzip`, `lz4`, `zstd` — reduce network usage for large records

### Consumer Patterns

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

### Consumers and Consumer Groups

Consumers and consumer groups allow parallelism. The balance between cores and consumers matters: having more consumers than partitions is wasteful — excess consumers sit idle. The rule: one consumer maximum per partition in a consumer group.

### Delivery Semantics

- **At-most-once** — fire and forget, no retry. Messages may be lost.
- **At-least-once** — retry until ack. Messages may be processed multiple times — consumers must be idempotent.
- **Exactly-once** — Kafka transactions (producers) + idempotent consumers. Highest overhead.

### Kafka Use Cases

**Website activity tracking** — track page views, searches, and user events in real time as a high-throughput event stream.

**Message service** — decouple producers and consumers; producers send messages to topics, consumers read at their own pace.

**Real-time event stream processing** — process events as they arrive, compute aggregations, trigger alerts.

**Log aggregation** — collect logs from multiple services and aggregate them into a central topic for analysis.

**Data ingestion** — ingest data into data warehouses, search indexes, or caching systems.

**Commit log service** — use Kafka as a distributed commit log; replay events to reconstruct state.

**Event sourcing** — store all events as the system of record; derive state by replaying.

### Partition Performance

More partitions = higher throughput, but there are trade-offs:
- Too many partitions can cause leader election overhead and increase end-to-end latency.
- Do not set up too many partitions — Kafka's recommendation is to keep partitions per broker under a few thousand.
- Do not hardcode partition numbers in application code — let Kafka handle assignment.

**Default retention period:** 7 days (168 hours). Record order within a partition is guaranteed; record order across partitions is not.

**Number of Zookeepers:** For a production cluster, use an odd number (3 or 5) for quorum-based leader election.

### Getting Started with Kafka

Hosted options like CloudKarafka provide:

- **Secure connection via certificates** — mTLS authentication between clients and brokers
- **Secure connection via SASL/SCRAM** — username/password-based authentication
- **Secure connection via VPC** — network-level isolation for private clusters

Create a topic, then publish and subscribe:

```bash
# Create a topic
kafka-topics.sh --create --topic order-events --partitions 6 --replication-factor 3 --bootstrap-server kafka:9092

# Publish messages
kafka-console-producer.sh --topic order-events --bootstrap-server kafka:9092

# Subscribe and consume
kafka-console-consumer.sh --topic order-events --from-beginning --bootstrap-server kafka:9092
```

---

## Common Kafka Patterns

- **CQRS** — separate read and write responsibilities; write model (commands) → Kafka → read model (projections) rebuilt from events
- **CDC (Change Data Capture)** — Debezium reads PostgreSQL WAL → publishes row changes to Kafka → downstream services react
- **Dead Letter Queue (DLQ)** — failed messages routed to separate topic for analysis and retry
- **Log aggregation** — services write to Kafka; a single consumer aggregates logs to storage

---

## Tools and Ecosystem

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
| CloudKarafka | Hosted managed Apache Kafka |

---

## Architecture Patterns

### Read Scaling with Replicas and Redis Cache

```
Write → Primary PostgreSQL (Multi-AZ)
Read (cache hit, TTL-based) → Redis (sub-millisecond)
Read (cache miss, non-critical) → Read Replica (async, eventually consistent)
Read (write-your-own-reads) → Primary
```

Cache invalidation strategies:
- **TTL (time-to-live)** — accept staleness window, simplest operationally
- **Cache-aside (lazy loading)** — populate on cache miss
- **Write-through** — update cache on every write — fresh but higher write cost
- **Event-driven invalidation** — Kafka event on DB change → consumer invalidates cache key

### Expand-Contract Schema Migrations

Safe schema changes in production without downtime:

```sql
-- Step 1: Expand — add new column (nullable, backwards-compatible)
ALTER TABLE orders ADD COLUMN new_status VARCHAR(50);

-- Step 2: Deploy new code — writes to both old AND new columns simultaneously

-- Step 3: Backfill — populate new column for existing rows
UPDATE orders SET new_status = old_status WHERE new_status IS NULL;

-- Step 4: Switch reads — deploy code that reads from new column only

-- Step 5: Contract — remove old column (after old code is gone)
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
          limits: {memory: "8Gi"}
        env:
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
```

Use operators for production databases on K8s: **CloudNativePG**, **Zalando Postgres Operator**, **CrunchyData PGO**.

---

## Production Operations

### Backup Strategy

```bash
# pgBackRest — PostgreSQL enterprise backup
pgbackrest --stanza=prod --type=full backup      # weekly full
pgbackrest --stanza=prod --type=diff backup      # daily differential
pgbackrest --stanza=prod --type=incr backup      # hourly incremental (WAL archiving)

# Point-in-time recovery
pgbackrest --stanza=prod \
  --target="2024-01-15 14:30:00" \
  --target-action=promote restore

# Verify backup integrity (DO THIS MONTHLY)
pgbackrest --stanza=prod check
```

**Recovery objectives:**
- **RPO** (Recovery Point Objective): max acceptable data loss. WAL archiving every 5 min → RPO ≤ 5 min.
- **RTO** (Recovery Time Objective): max acceptable downtime. Automated failover → RTO < 60s.

Test your backups monthly — backup that has never been restored is theoretical, not actual.

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

Fix: `SET idle_in_transaction_session_timeout = '30s'` in postgresql.conf.

---

## Key Metrics

```promql
# PostgreSQL (via postgres_exporter)
pg_stat_activity_count{state="idle in transaction"}   # connection leak indicator
pg_replication_lag_bytes                               # replica lag
pg_stat_bgwriter_buffers_checkpoint                    # I/O pressure
pg_database_size_bytes                                 # database growth

# Redis
redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total)  # hit rate
redis_memory_used_bytes / redis_memory_max_bytes       # memory pressure

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

## Security

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
- Encrypt at rest (RDS: enabled by default; self-hosted: filesystem encryption)
- TLS for all connections (`ssl=on` in postgresql.conf)
- Private subnet — no public IP or public endpoint for database
- Audit logging via `pgaudit` extension
- Rotate credentials regularly; use Vault dynamic secrets for zero-standing-credentials

---

## Failure Modes

**Connection pool exhaustion:** all PgBouncer server connections taken, clients queue and time out.
Check: `SELECT count(*), state FROM pg_stat_activity GROUP BY state`. `idle in transaction` is the culprit — set `idle_in_transaction_session_timeout`.

**Replication lag spike:** write-heavy workload outpaces replica's ability to apply changes. Data loss = lag × write rate if primary fails.
Prevention: synchronous replication for critical data, monitor `pg_replication_lag_bytes`.

**Long-running transaction blocks VACUUM:** table bloat accumulates, writes slow.
Fix: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '5 minutes'`.

**Kafka consumer lag accumulates:** consumers can't keep up with producers. Old messages deleted before processing.
Fix: add consumers (up to partition count), optimize consumer processing (batch, async), add partitions and scale consumers together.

**Partition distribution imbalance (Kafka brokers):** uneven load across brokers. Kafka MGMT tools show partition distribution warnings. Rebalance partitions manually using `kafka-reassign-partitions.sh`.

---

## Interview Prep

**"What is SQL?"**
SQL stands for Structured Query Language, used for managing and manipulating relational databases. It supports querying, inserting, updating, and deleting data, as well as defining schema and controlling access.

**"What is the difference between DELETE and TRUNCATE?"**
DELETE removes specific rows based on a condition and can be rolled back. TRUNCATE removes all rows, cannot be rolled back, and is faster because it deallocates data pages rather than logging individual deletions.

**"What is normalization?"**
Organizing data to minimize redundancy and dependency by breaking tables into smaller related tables. Forms include 1NF, 2NF, 3NF, BCNF, 4NF, and 5NF.

**"How does MVCC work in PostgreSQL?"**
Each row has `xmin` (transaction that created it) and `xmax` (transaction that deleted/updated it). A query sees rows where `xmin` committed before the query's snapshot and `xmax` either hasn't committed or committed after the snapshot. Dead rows accumulate until VACUUM reclaims them. This allows readers to never block writers.

**"How do you migrate a live production database table with 500M rows?"**
Expand-contract: add new column nullable, deploy dual-write code, background backfill in batches (`UPDATE ... WHERE id BETWEEN x AND y` with sleep between batches), switch reads, drop old column.

**"What is Apache Kafka and what is it used for?"**
Kafka is a distributed, partitioned, replicated log for high-throughput event streaming. Key use cases: website activity tracking, log aggregation, data ingestion, real-time stream processing, event sourcing, and CDC (change data capture via Debezium).

**"What is the ISR in Kafka?"**
The In-Sync Replicas set — replicas that are fully caught up with the leader. Only ISR members are eligible for leader election. `min.insync.replicas` controls how many must acknowledge a write when `acks=all`.

**"Design a schema for a multi-tenant SaaS with 10,000 tenants"**
Options: (1) shared schema with tenant_id + row-level security — simplest, one migration; (2) schema per tenant — good isolation; (3) database per tenant — maximum isolation, complex connection pooling. For 10,000 tenants: shared schema + RLS + connection pooler.

---

## Key Takeaways

1. **Connection pooling is mandatory at scale** — direct connections per app instance do not scale beyond ~50 instances
2. **EXPLAIN ANALYZE before tuning** — understand the query plan before adding indexes
3. **Expand-contract for all schema changes** — never break running code with a migration
4. **Test backup restore monthly** — backup never restored is hypothetical, not operational
5. **Replication lag × write rate = potential data loss** — monitor continuously, alert on 30s+
6. **`idle in transaction` blocks VACUUM** — set session timeout, kill long-idle transactions
7. **Kafka: one consumer max per partition** — scale partitions and consumers together
8. **Kafka acks=all + min.insync.replicas** — for durability critical data
9. **Private subnet, no public endpoint** — databases should never be directly internet-accessible
10. **Per-service database users with minimum grants** — not shared admin credentials
11. **MVCC means reads never block writes** — PostgreSQL's key scalability feature, enabled by VACUUM
12. **Synchronous replication for financial data** — async = potential data loss on failover

---
