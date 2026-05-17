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
