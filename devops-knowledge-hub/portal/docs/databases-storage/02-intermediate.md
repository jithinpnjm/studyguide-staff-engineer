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

Look for:

| Signal | Meaning |
|---|---|
| Sequential scan on large table | Missing or unusable index |
| Rows removed by filter | Index may not match predicate |
| Sort node with many rows | Missing index order or too much data |
| Nested loop with large row count | Join strategy problem |
| High shared read blocks | Disk reads, cache miss, or large scan |
| Estimate far from actual | Statistics may be stale |

---

## Indexing Patterns

Composite index:

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
```

Partial index:

```sql
CREATE INDEX idx_active_users_email
ON users(email)
WHERE deleted_at IS NULL;
```

Covering index:

```sql
CREATE INDEX idx_orders_user_covering
ON orders(user_id)
INCLUDE (total, status, created_at);
```

Functional index:

```sql
CREATE INDEX idx_users_lower_email
ON users(lower(email));
```

Index design rule: match common query predicates, sort order, and cardinality. Do not add every possible index; writes become slower and storage grows.

---

## Common Query Mistakes

| Mistake | Why it hurts | Better option |
|---|---|---|
| `SELECT *` | Reads unnecessary data | Select only needed columns |
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

---

## Transactions And Isolation

Isolation levels define what concurrent transactions can see.

| Level | Behavior |
|---|---|
| Read Committed | Each statement sees committed data at statement start |
| Repeatable Read | Transaction sees stable snapshot |
| Serializable | Database prevents non-serializable outcomes |

PostgreSQL default is Read Committed. Stronger isolation can improve correctness but may increase retries or contention.

Use pessimistic locking for read-then-write patterns:

```sql
BEGIN;
SELECT qty FROM inventory WHERE product_id = 42 FOR UPDATE;
UPDATE inventory SET qty = qty - 1 WHERE product_id = 42;
COMMIT;
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

Databases have finite connection capacity. Too many application instances can overwhelm the database even when queries are simple.

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

Example PgBouncer concept:

```ini
[pgbouncer]
pool_mode = transaction
max_client_conn = 5000
default_pool_size = 25
```

---

## Replication

Replication copies data from primary to replicas.

| Type | Strength | Tradeoff |
|---|---|---|
| Synchronous | Stronger durability | Higher write latency |
| Asynchronous | Lower write latency | Possible data loss during failover |

Read replicas help with:

- Read scaling
- Reporting queries
- Analytics offload
- Some disaster recovery patterns

But read replicas can lag. Applications must tolerate stale reads if they read from replicas.

Check PostgreSQL replication lag conceptually:

```sql
SELECT application_name, state, sync_state, replay_lag
FROM pg_stat_replication;
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

## Kafka Basics

Kafka is a distributed event streaming platform.

Core terms:

| Term | Meaning |
|---|---|
| Topic | Named stream of records |
| Partition | Ordered shard of a topic |
| Producer | Writes records |
| Consumer | Reads records |
| Consumer group | Set of consumers sharing partitions |
| Broker | Kafka server |
| Replication factor | Number of copies |
| ISR | In-sync replicas |
| Offset | Consumer position in a partition |

Ordering is guaranteed within a partition, not across all partitions.

---

## Kafka Reliability Knobs

Important settings:

| Setting | Meaning |
|---|---|
| `acks=all` | Producer waits for all required replicas |
| `min.insync.replicas` | Minimum replicas required for writes |
| replication factor | Number of broker copies |
| retention | How long data is kept |
| partitions | Parallelism and ordering boundary |

More partitions can improve throughput but add overhead and operational complexity.

---

## Intermediate Takeaways

1. Query plans show where database work happens.
2. Indexes must match query patterns.
3. Locks are normal; long waits are dangerous.
4. Connection pooling protects the database from client explosion.
5. Replication improves availability and read scale but introduces lag.
6. Caching improves latency but creates consistency questions.
7. Kafka partitions define parallelism and ordering.
8. Database reliability is a system design problem, not only a SQL problem.
