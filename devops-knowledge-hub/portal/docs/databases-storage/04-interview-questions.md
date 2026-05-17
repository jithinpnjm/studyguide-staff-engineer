---
title: "Interview Questions"
sidebar_position: 4
---

# Databases & Storage — Interview Questions

Strong database interview answers explain correctness, performance, recovery, and operational safety. Do not only define SQL terms; connect them to production behavior.

---

## SQL Fundamentals

### What is SQL?

SQL is Structured Query Language. It is used to define, query, and modify data in relational databases.

### What is a primary key?

A primary key uniquely identifies each row in a table. It enforces entity identity and is commonly referenced by foreign keys.

### What is a foreign key?

A foreign key links one table to another and enforces referential integrity.

### Primary key vs unique key?

Both enforce uniqueness. A primary key identifies the row and normally cannot be null. A unique key enforces uniqueness for a column or column set and may allow nulls depending on database behavior.

### What is normalization?

Normalization organizes data to reduce duplication and dependency. It usually means splitting data into related tables and enforcing relationships.

---

## Query Questions

### INNER JOIN vs LEFT JOIN?

INNER JOIN returns rows that match on both sides. LEFT JOIN returns all rows from the left table and matching rows from the right table.

```sql
SELECT users.email, orders.id
FROM users
LEFT JOIN orders ON users.id = orders.user_id;
```

### WHERE vs HAVING?

`WHERE` filters rows before grouping. `HAVING` filters groups after aggregation.

### UNION vs UNION ALL?

`UNION` removes duplicates. `UNION ALL` keeps duplicates and is faster when deduplication is unnecessary.

### Why avoid `SELECT *` in production queries?

It pulls unnecessary columns, increases I/O, can prevent index-only scans, and makes application behavior fragile when schema changes.

### What is the N+1 query problem?

The application first loads parent rows and then runs one additional query per parent. This creates many small database round trips. Use joins, batching, or prefetching. Symptom: slow page load, database shows many identical queries with different parameters. The number of database queries for loading 100 orders plus their users becomes 101 instead of 1.

### What are window functions?

Window functions compute across a set of related rows without collapsing them into a single aggregate.

```sql
-- Rank users by revenue within their region
SELECT
    user_id,
    region,
    total_spent,
    RANK() OVER (PARTITION BY region ORDER BY total_spent DESC) AS rank_in_region,
    SUM(total_spent) OVER (PARTITION BY region) AS region_total
FROM user_spending;

-- Running total
SELECT
    created_at,
    amount,
    SUM(amount) OVER (ORDER BY created_at) AS running_total
FROM transactions;
```

### What are CTEs?

Common Table Expressions (CTEs) name intermediate query results for readability:

```sql
WITH active_users AS (
    SELECT DISTINCT user_id
    FROM events
    WHERE occurred_at >= NOW() - INTERVAL '30 days'
),
user_orders AS (
    SELECT user_id, COUNT(*) AS order_count, SUM(amount) AS total_spent
    FROM orders
    WHERE user_id IN (SELECT user_id FROM active_users)
    GROUP BY user_id
)
SELECT segment, COUNT(*) AS user_count
FROM (
    SELECT user_id,
           CASE WHEN total_spent >= 1000 THEN 'high_value' ELSE 'low_value' END AS segment
    FROM user_orders
) s
GROUP BY segment;
```

---

## Index Questions

### What is an index?

An index is a data structure that helps the database find rows faster. It improves reads but adds write and storage overhead.

### How does a B-tree index work?

A B-tree (balanced tree) stores column values in sorted order with pointers to the actual rows. Lookup is O(log n) instead of O(n) full scan. Add an index when a column is frequently used in WHERE clauses with equality or range conditions, in ORDER BY or GROUP BY on large result sets, or in JOIN conditions.

### What is a composite index?

An index over multiple columns. Column order matters — most selective column first, and queries must use the leftmost prefix.

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
-- Helps: WHERE user_id = 123
-- Helps: WHERE user_id = 123 ORDER BY created_at DESC
-- Does NOT help: WHERE created_at > '2024-01-01' (no leftmost column)
```

### What is a partial index?

An index over only rows that match a predicate. Smaller and faster.

```sql
CREATE INDEX idx_active_users_email
ON users(email)
WHERE deleted_at IS NULL;
```

### What is a covering index?

An index that contains all columns needed by a query, allowing the database to answer from the index without reading table pages (index-only scan).

### How do you know whether an index is used?

Use `EXPLAIN` or `EXPLAIN ANALYZE`.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

Look for `Index Scan` vs `Seq Scan`. A sequential scan on a large table usually means a missing or unusable index.

### When does an index not help?

- Table too small (seq scan is faster than index for small tables)
- Low selectivity (indexing a boolean where 90% are `true`)
- Function wrapping (`WHERE LOWER(email) = ...` does not use index on `email`)
- Index bloat from heavy writes (need VACUUM or REINDEX)

---

## Transaction Questions

### What is ACID?

Atomicity, Consistency, Isolation, and Durability. These properties define transactional correctness.

- **Atomicity**: transaction either fully commits or fully rolls back
- **Consistency**: database moves from one valid state to another
- **Isolation**: concurrent transactions don't interfere
- **Durability**: committed transactions survive crashes (WAL)

### What is isolation level?

Isolation level controls how transactions see each other's changes. Stronger isolation improves correctness but may increase blocking, retries, or reduced concurrency. PostgreSQL default is Read Committed.

### What is pessimistic locking?

Locking rows before modifying them.

```sql
BEGIN;
SELECT qty FROM inventory WHERE product_id = 42 FOR UPDATE;
UPDATE inventory SET qty = qty - 1 WHERE product_id = 42;
COMMIT;
```

### What is optimistic concurrency?

Allow concurrent work but check whether data changed before writing. A version column is a common pattern.

```sql
UPDATE orders
SET status = 'shipped', version = version + 1
WHERE id = 99 AND version = 5;
```

If no row is updated, retry or return a conflict.

### What is `SELECT FOR UPDATE SKIP LOCKED`?

The correct job queue pattern. Skips rows already locked by another transaction, preventing duplicate processing:

```sql
SELECT * FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

---

## PostgreSQL / Operations Questions

### How do you troubleshoot a slow query?

Check query text, execution plan, indexes, row counts, locks, table statistics, buffer reads, and whether the query changed recently.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

Look for: Seq Scan on large table, large row counts, stale statistics (estimate vs actual discrepancy), high buffer reads.

### How do you check active sessions?

```sql
SELECT pid, state, wait_event_type, wait_event, query
FROM pg_stat_activity
WHERE state <> 'idle';
```

### What is VACUUM?

PostgreSQL uses MVCC, so old row versions (dead tuples) remain until VACUUM cleans them. Without VACUUM, table bloat grows and performance suffers.

```sql
VACUUM orders;        -- reclaim space (non-blocking)
VACUUM ANALYZE orders; -- reclaim + update statistics
```

### What is autovacuum tuning?

Autovacuum triggers per table based on dead tuple threshold. For high-write tables, reduce the scale factor so autovacuum runs more often:

```sql
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.01,  -- 1% instead of 20%
    autovacuum_vacuum_threshold = 100
);
```

### What is WAL?

Write-Ahead Log. It records changes before data pages are flushed and is used for crash recovery, replication, and point-in-time recovery. SRE implications: slow disk slows commits, WAL accumulation can fill disk, replication slots retaining WAL are a common disk exhaustion cause.

### What causes replication lag?

Heavy writes, slow replica I/O, long queries on replica, network issues, underprovisioned replica, or WAL replay bottleneck. Measured via `pg_stat_replication` on primary (`write_lag`, `flush_lag`, `replay_lag`) or `pg_last_xact_replay_timestamp()` on standby.

### What are the key pg_stat_* views?

| View | Purpose |
|---|---|
| `pg_stat_activity` | Active sessions, queries, wait events |
| `pg_stat_replication` | Replication lag and state |
| `pg_stat_user_tables` | Per-table I/O, dead tuples, vacuum/analyze times |
| `pg_stat_user_indexes` | Index usage — find unused indexes |
| `pg_stat_database` | Database-level cache hit ratio, commits, rollbacks |
| `pg_locks` | Current lock state |

---

## Connection Pooling Questions

### Why do databases need connection pooling?

Database connections are expensive and finite. Too many app instances can exhaust database connections even when queries are simple. Each PostgreSQL connection uses 5-10 MB of RAM.

### What is PgBouncer?

A lightweight PostgreSQL connection pooler. Transaction pooling is often useful for web workloads because server connections are returned after each transaction. One PostgreSQL backend can serve many application sessions.

### What is a connection storm?

A sudden surge of new connections, often caused by autoscaling, deployment restart, Lambda burst, failover, or cache outage.

---

## Backup And Recovery Questions

### What is RPO?

Recovery Point Objective: maximum acceptable data loss.

### What is RTO?

Recovery Time Objective: maximum acceptable time to recover service.

### Backup vs restore?

Backup is the stored copy. Restore is the operational process of making the system usable again. Restore testing proves whether backups work.

### Is replication a backup?

No. Replication copies changes, including bad changes. Backup provides recovery to a previous point in time.

---

## Kafka Questions

### What is Kafka?

Kafka is a distributed event streaming platform. Producers write records to topics, and consumers read records from partitions. Unlike queues, Kafka retains messages for a configurable period — multiple independent consumer groups can read the same topic at their own pace.

### What is a partition?

A partition is an ordered shard of a topic. Ordering is guaranteed within a partition, not across the whole topic. Partitions enable parallelism — different consumers in a consumer group read different partitions.

### What is a consumer group?

A group of consumers that share topic partitions. Each partition is consumed by one consumer in the group at a time. If consumers > partitions, some consumers are idle.

### What is consumer lag?

The difference between latest produced offset and the consumer's committed offset. Lag indicates how far behind consumers are. Alert when lag grows.

### What does `acks=all` mean?

The producer waits for all required in-sync replicas before considering the write acknowledged. It improves durability but can increase latency. Combine with `min.insync.replicas=2` to require at least 2 copies before acking.

### How does Kafka guarantee message ordering?

Within a partition. Use the entity ID (e.g., user ID, order ID) as the partition key — all events for that entity go to the same partition and are stored and delivered in write order.

### What is the difference between at-least-once and exactly-once delivery?

- **At-least-once**: `acks=all`, retry on failure, commit offset after processing. May see duplicates — design consumers to be idempotent.
- **Exactly-once**: idempotent producers (`enable.idempotence=true`) and transactional APIs. Complex — use for financial systems where duplicates are catastrophic.

### What is log compaction?

Log compaction keeps the last value for each key in a topic. Useful for changelog topics where you only care about the current state of each entity, not the full history.

### What happens when a Kafka broker fails?

Kafka detects via controller heartbeat timeout. For partitions where the failed broker was the leader, a new leader is elected from the ISR. If the failed broker had partitions with no other ISR copies, those partitions become unavailable until the broker recovers.

---

## Scenario Questions

### Database CPU is high. What do you check?

Top queries by age in `pg_stat_activity`, execution plans via `EXPLAIN ANALYZE`, index usage, recent deployments, connection count, lock waits, and whether traffic volume changed.

### Database connections are exhausted. What do you do?

Identify clients using `pg_stat_activity`, check pool sizes, reduce application concurrency, add PgBouncer, kill only clearly safe idle sessions if necessary, and fix the source of connection growth.

### A migration is blocking production traffic. What went wrong?

It likely took a lock or changed too much data at once. Use online migration patterns: additive schema, concurrent indexes, small backfills, and expand-contract rollout.

### A replica is behind. What can break?

Users may not see their recent writes, analytics may be stale, failover may lose data if async replication is used, and downstream systems may process old state.

### Kafka consumer lag is growing. What do you do?

Check: is processing time increasing? Is the consumer CPU-bound? Scale out consumers (add more in the group up to partition count). Increase batch size for efficiency. Async processing — poll quickly and process in a thread pool. Optimize slow downstream operations.

---

## Staff-Level Questions

### How do you design a database platform for many teams?

Provide standard backup policies, restore drills, connection pooling, migration guidelines, monitoring dashboards, slow-query visibility, access control, and review processes for risky changes.

### What are unhealthy database signals?

Backups never restored, migrations done manually, replicas lag without alerting, app pools unbounded, no slow-query visibility, no ownership of schema, and no RPO/RTO agreement.

### How do you add a column to a million-row table without downtime?

Add it as nullable first (no table rewrite needed, near-instant). Backfill existing rows in batches during off-peak hours (small transactions to avoid long lock holds). Once all rows are populated, add the NOT NULL constraint. For indexes, always use `CREATE INDEX CONCURRENTLY`.

### What would you centralize?

Backup policy, restore testing, monitoring baselines, access standards, migration guardrails, connection pooling defaults, and incident runbooks.

### What would you delegate?

Schema ownership, query design, application-specific caching, and domain-specific data model decisions inside platform guardrails.
