---
title: "Intermediate"
sidebar_position: 2
---

# Databases & Storage — Intermediate

Intermediate database work is about performance, concurrency, connection management, replication, caching, and operational safety. At this level, you should understand why a database becomes slow, how queries consume resources, and how data systems fail under production traffic.

---

## Query Optimization Mental Model

A query consumes database resources:

```text
parse -> plan -> execute -> read buffers/pages -> join/filter/sort -> return rows
```

Optimization questions:

1. How many rows are scanned?
2. How many rows are returned?
3. Is the right index used?
4. Is the query sorting or joining too much data?
5. Is the query waiting on locks?
6. Is it CPU-bound, memory-bound, or I/O-bound?

---

## EXPLAIN ANALYZE

Use `EXPLAIN ANALYZE` to compare planner estimates with real execution.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, total, status
FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 20;
```

Example output interpretation:

```
Gather  (cost=1000.00..52000.00 rows=50000 width=36) (actual time=15.3..1234.5 rows=49823)
  ->  Hash Aggregate  (cost=50000.00..50500.00 rows=50000 width=36) (actual time=800.2..900.3 rows=49823)
        ->  Hash Left Join  (cost=10000.00..40000.00 rows=2000000 width=12) (actual time=200.1..700.4)
              ->  Seq Scan on orders o  (cost=0.00..20000.00 rows=2000000 width=8)
              ->  Hash  (cost=8000.00..8000.00 rows=50000 width=12)
                    ->  Index Scan using idx_users_created on users u ...
```

Look for:

| Signal | Meaning |
|---|---|
| Sequential scan on large table | Missing or unusable index |
| Rows removed by filter | Index may not match predicate |
| Sort node with many rows | Missing index order or too much data |
| Nested loop with large row count | Join strategy problem |
| High shared read blocks | Disk reads, cache miss, or large scan |
| Estimate far from actual | Statistics may be stale — run `ANALYZE` |
| High `loops` on Index Scan | N+1 query pattern |

---

## Indexing Patterns

Composite index — column order matters, most selective first:

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
-- Helps: WHERE user_id = 123 AND status = 'pending'
-- Helps: WHERE user_id = 123 (leftmost prefix)
-- Does NOT help: WHERE status = 'pending' (no leftmost column)
```

Partial index — only index a subset of rows:

```sql
CREATE INDEX idx_active_users_email
ON users(email)
WHERE deleted_at IS NULL;
```

Covering index — answer query entirely from the index:

```sql
CREATE INDEX idx_orders_user_covering
ON orders(user_id)
INCLUDE (total, status, created_at);
```

Functional index — index the result of an expression:

```sql
CREATE INDEX idx_users_lower_email
ON users(lower(email));
-- Helps: WHERE LOWER(email) = 'alice@example.com'
```

Unique index:

```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

For zero-downtime index creation on live tables:

```sql
CREATE INDEX CONCURRENTLY idx_orders_amount ON orders(amount);
-- Takes longer but does not block reads or writes
```

Index design rule: match common query predicates, sort order, and cardinality. Do not add every possible index; writes become slower and storage grows.

---

## Common Query Mistakes

| Mistake | Why it hurts | Better option |
|---|---|---|
| `SELECT *` | Reads unnecessary data, prevents index-only scans | Select only needed columns |
| Function on indexed column | Index may not be usable | Functional index or normalized value |
| Leading wildcard search | Normal B-tree index unusable | Full-text search or trigram index |
| N+1 queries | Many small repeated queries | Join, batch, or prefetch |
| Missing pagination | Large result set | Limit, cursor, or keyset pagination |
| Large offset pagination | Scans skipped rows | Keyset pagination |

Example keyset pagination:

```sql
SELECT id, created_at
FROM orders
WHERE created_at < '2026-05-17T10:00:00Z'
ORDER BY created_at DESC
LIMIT 50;
```

N+1 pattern — application loads 100 orders then queries user for each:

```sql
-- BAD: 100 separate queries
SELECT * FROM orders LIMIT 100;
-- then for each order: SELECT * FROM users WHERE id = ?

-- GOOD: one JOIN
SELECT o.id, o.total, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
LIMIT 100;
```

---

## Transactions And Isolation

Isolation levels define what concurrent transactions can see.

| Level | Behavior |
|---|---|
| Read Committed | Each statement sees committed data at statement start (PostgreSQL default) |
| Repeatable Read | Transaction sees stable snapshot; prevents non-repeatable reads |
| Serializable | Database prevents non-serializable outcomes; highest consistency |

```sql
-- Set isolation level for a transaction
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

Use pessimistic locking for read-then-write patterns:

```sql
BEGIN;
SELECT qty FROM inventory WHERE product_id = 42 FOR UPDATE;
UPDATE inventory SET qty = qty - 1 WHERE product_id = 42;
COMMIT;
```

`SKIP LOCKED` — job queue pattern that skips already-locked rows:

```sql
SELECT * FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

Use optimistic concurrency when conflicts are expected but usually rare:

```sql
UPDATE orders
SET status = 'shipped', version = version + 1
WHERE id = 99 AND version = 5;
```

If zero rows are affected, another transaction changed the row first.

---

## Lock Troubleshooting

Database locks are normal. Lock waits become incidents when they block user traffic or migrations.

PostgreSQL lock view:

```sql
SELECT
  blocked.pid AS blocked_pid,
  blocking.pid AS blocking_pid,
  blocked.query AS blocked_query,
  blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks blocked_locks ON blocked.pid = blocked_locks.pid
JOIN pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
 AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
 AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
 AND blocking_locks.granted
JOIN pg_stat_activity blocking ON blocking.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

Operational habit: know which session is blocking and what it is doing before terminating anything.

---

## Connection Pooling

Databases have finite connection capacity. Too many application instances can overwhelm the database even when queries are simple. Each PostgreSQL connection uses 5-10 MB of RAM.

Problem pattern:

```text
100 app pods x 20 connections = 2000 database connections
```

PostgreSQL connection pooling options:

| Mode | Meaning |
|---|---|
| Session pooling | Connection held for client session |
| Transaction pooling | Connection held only during transaction |
| Statement pooling | Connection held only during statement |

PgBouncer transaction mode is often efficient for stateless web workloads.

Example PgBouncer configuration:

```ini
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

Diagnosing connection exhaustion:

```sql
-- Check current connections grouped by state
SELECT count(*), state, wait_event_type, wait_event
FROM pg_stat_activity
GROUP BY state, wait_event_type, wait_event
ORDER BY count DESC;

-- Find idle connections
SELECT pid, usename, application_name, client_addr, state, query_start
FROM pg_stat_activity
WHERE state = 'idle'
ORDER BY query_start;

-- Terminate idle connections older than 5 minutes (with caution)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';
```

---

## Replication

Replication copies data from primary to replicas.

| Type | Strength | Tradeoff |
|---|---|---|
| Synchronous | Stronger durability | Higher write latency |
| Asynchronous | Lower write latency | Possible data loss during failover |

PostgreSQL streaming replication:

```text
Primary (read/write)
    → WAL (Write-Ahead Log) stream
    → Standby 1 (read-only)
    → Standby 2 (read-only)
```

Standbys replay the primary's WAL in real time. Replication lag = how far behind the standby is.

Check replication lag on the primary:

```sql
SELECT
    application_name,
    state,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state
FROM pg_stat_replication;
```

Check lag on the standby:

```sql
SELECT
    NOW() - pg_last_xact_replay_timestamp() AS replication_lag;
```

Read replicas help with read scaling, reporting queries, analytics offload, and some disaster recovery patterns. But read replicas can lag — applications must tolerate stale reads if they read from replicas.

---

## Schema Migrations Without Downtime

Schema migrations on large tables can cause outages if done carelessly. PostgreSQL's DDL operations hold locks.

**Adding a nullable column (safe):**

```sql
-- Fast, non-blocking — nullable columns are metadata-only changes
ALTER TABLE orders ADD COLUMN notes TEXT;
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

**Renaming a column:**

```text
Can't rename without affecting running queries.
Three-step: add new column, backfill, deploy code to use new column, drop old column.
Requires backward-compatible code deployed first.
```

**Dropping a column:**

```sql
-- Step 1: Deploy code that no longer references this column
-- Step 2: Then drop the column
ALTER TABLE orders DROP COLUMN legacy_field;
```

---

## Caching

Caching reduces load and latency but introduces consistency tradeoffs.

Common cache locations:

```text
browser/cache headers
CDN
application memory
Redis/Memcached
database buffer cache
```

Cache questions:

1. What is the source of truth?
2. What is acceptable staleness?
3. How is cache invalidated?
4. What happens during cache outage?
5. Can the database survive cache miss storms?

Cache stampede prevention:

- TTL jitter
- Request coalescing
- Soft expiration
- Background refresh
- Rate limiting

---

## Kafka Intermediate Concepts

### Topics, Partitions, and Offsets

A topic is divided into partitions — ordered, immutable sequences of records. Each record has a monotonically increasing offset.

```
Topic: user-events
├── Partition 0: [offset 0] [offset 1] ... [offset 1,247,832]
├── Partition 1: [offset 0] [offset 1] ... [offset 1,198,201]
└── Partition 2: [offset 0] [offset 1] ... [offset 1,302,456]
```

Partition key: producers specify a key with each record. Records with the same key always go to the same partition, ensuring ordering for a given entity.

### Replication and Durability

| Setting | Meaning |
|---|---|
| `acks=all` | Producer waits for all required in-sync replicas |
| `min.insync.replicas` | Minimum replicas required for writes |
| `replication.factor` | Number of broker copies |
| `retention.ms` | How long data is kept |
| `partitions` | Parallelism and ordering boundary |

`replication.factor=3` with `min.insync.replicas=2` is the standard durability configuration.

### Consumer Groups

Consumer groups allow multiple consumers to split the work of reading a topic.

```
Topic: orders (6 partitions)
Consumer Group: order-processor (3 consumers)

Consumer 0 → Partitions 0, 1
Consumer 1 → Partitions 2, 3
Consumer 2 → Partitions 4, 5
```

- Each partition is consumed by exactly one consumer within a group.
- If consumers > partitions, some consumers are idle.
- Offset commits track position. On restart, consumer resumes from the last committed offset.

### Consumer Lag

Consumer lag = the difference between the latest offset in a partition (log-end offset) and the consumer's committed offset. It represents unprocessed messages.

```bash
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe \
  --group order-processor

# TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# orders  0          1000010         1000050         40
# orders  1          999800          1000000         200
# orders  2          1000200         1000200         0
# Total lag: 240 unprocessed messages
```

Consumer lag is the primary operational metric for Kafka consumers. Alert when lag exceeds your processing time tolerance.

### Delivery Semantics

| Semantic | Meaning | How to achieve |
|---|---|---|
| At-most-once | Messages may be lost, never duplicated | `acks=0`, auto-commit before processing |
| At-least-once | Messages never lost, may be duplicated | `acks=all`, commit after processing |
| Exactly-once | Each message processed exactly once | Idempotent consumer + transactional producer |

In practice, at-least-once is the default for most systems — handle duplicates in the consumer (idempotent processing).

### Topic Management

```bash
# Create a topic
kafka-topics.sh --bootstrap-server kafka:9092 \
  --create \
  --topic user-events \
  --partitions 12 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config min.insync.replicas=2

# List topics
kafka-topics.sh --bootstrap-server kafka:9092 --list

# Describe topic
kafka-topics.sh --bootstrap-server kafka:9092 --describe --topic user-events

# Increase partition count (can only increase, not decrease)
kafka-topics.sh --bootstrap-server kafka:9092 \
  --alter --topic user-events --partitions 24
```

---

## Intermediate Takeaways

1. Query plans show where database work happens.
2. Indexes must match query patterns — composite index column order matters.
3. Locks are normal; long waits are dangerous.
4. `CREATE INDEX CONCURRENTLY` avoids blocking writes during index builds.
5. Connection pooling (PgBouncer) protects the database from client explosion.
6. Replication improves availability and read scale but introduces lag.
7. Check `pg_stat_replication` for write/flush/replay lag on the primary.
8. Caching improves latency but creates consistency questions.
9. Kafka partitions define parallelism and ordering.
10. Consumer lag is the Kafka health metric — alert when it grows.
11. Database reliability is a system design problem, not only a SQL problem.
