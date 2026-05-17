---
title: "SQL and Relational Data for SRE"
sidebar_position: 21
---

# SQL and Relational Data for SRE

## What It Is and Why It Matters

Relational databases (PostgreSQL, MySQL, SQLite) underpin most production systems. As an SRE or platform engineer, you don't need to be a DBA, but you do need to understand how databases fail, how to read a slow query, how indexes work, how migrations can cause outages, and how replication and failover behave.

Many production incidents have a database at their root: a missing index on a new query, a migration that holds a lock while running, a connection pool exhaustion, a replication lag that causes stale reads. Understanding these patterns lets you diagnose them quickly and design systems that avoid them.

---

## Mental Model

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

## Core SQL Concepts

### SELECT, Filtering, and Ordering

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

### JOINs

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

### Aggregation and GROUP BY

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

### Window Functions

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

### Common Table Expressions (CTEs)

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

## Indexes Deep Dive

### How B-Tree Indexes Work

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

### When Indexes Don't Help (or Hurt)

**Table too small:** For small tables (< 1,000 rows), PostgreSQL's planner may choose sequential scan even with an index — seq scan is faster for small tables.

**Low selectivity column:** Indexing a boolean column (`is_active`) where 90% of rows are `true` has poor selectivity. The planner may skip the index because reading 90% of rows via index is slower than a seq scan.

**Function wrapping prevents index use:**
```sql
-- Index on email is NOT used:
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';
-- Use function index instead, or store emails as lowercase
```

**Index bloat:** Deleted/updated rows leave dead tuples in the index. After heavy write workload, `REINDEX` or `VACUUM` is needed.

### EXPLAIN ANALYZE

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

## Transactions and ACID

### ACID Properties

- **Atomicity**: transaction either fully commits or fully rolls back
- **Consistency**: database moves from one valid state to another
- **Isolation**: concurrent transactions don't interfere
- **Durability**: committed transactions survive crashes (WAL)

### Isolation Levels

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

### Locking

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

## Schema Migrations Without Downtime

Schema migrations on large tables can cause outages if done carelessly. PostgreSQL's DDL operations hold locks.

### Safe Migration Patterns

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

## Connection Pooling

Databases have a maximum connection limit (`max_connections` in PostgreSQL, typically 100-200 for standard instances). Each connection uses ~5-10MB of RAM. Application servers opening too many connections can exhaust the limit.

### PgBouncer

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

### Diagnosing Connection Exhaustion

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

## Replication and Failover

### PostgreSQL Streaming Replication

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

### Failover with Patroni

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

## Common Failure Modes

**Missing index on foreign key:** When a parent row is deleted, PostgreSQL must check if any child rows reference it. Without an index on the foreign key column in the child table, this is a full table scan. Symptom: deletes from the parent table are very slow. Fix: always create an index on foreign key columns.

**N+1 query problem:** Application loads a list of 100 orders, then queries the user for each order separately (100 separate queries). Symptom: slow page load, database shows many identical queries with different parameters. Fix: use a JOIN in the initial query, or batch load users with `WHERE id IN (...)`.

**Long-running transaction holding lock:** A transaction starts, runs a slow query or waits for application logic, while holding a row lock. Other transactions waiting on that lock pile up. Symptom: `pg_stat_activity` shows many "lock wait" states. Fix: keep transactions short, avoid application logic inside transactions, monitor long-running transactions.

**Autovacuum not keeping up:** After heavy writes (inserts, updates, deletes), dead tuples accumulate. Autovacuum reclaims space but may not keep up. Symptom: table bloat, decreasing query performance. Check `pg_stat_user_tables` for `n_dead_tup`. Fix: tune autovacuum parameters for heavily written tables, manually VACUUM if needed.

**Replication lag spikes during bulk operations:** A bulk insert or update generates a large WAL burst. Standbys lag behind. If you have synchronous replication, this blocks commits on the primary. Fix: for bulk loads, use asynchronous replication with lag alerting; batch operations to reduce WAL burst.

---

## Key Questions and Answers

**Q: How does a B-tree index work and when should you add one?**

A B-tree index is a balanced tree structure that stores column values in sorted order with pointers to the actual rows. Lookup is O(log n) instead of O(n) full scan. Add an index when: a column is frequently used in WHERE clauses with equality or range conditions, a column is used for ORDER BY or GROUP BY on large result sets, a column is a JOIN condition. Don't add indexes blindly — each index slows down INSERT/UPDATE/DELETE (index must be maintained). Rule: for OLTP workloads, check EXPLAIN ANALYZE for "Seq Scan" on large tables — those are candidates for indexing.

**Q: How do you add a column to a million-row table without downtime?**

Add it as nullable first (no table rewrite needed, near-instant). Backfill existing rows in batches during off-peak hours (small transactions to avoid long lock holds). Once all rows are populated, add the NOT NULL constraint (fast if no NULLs exist in PostgreSQL 12+). For indexes, always use `CREATE INDEX CONCURRENTLY` — this builds the index without blocking writes (takes longer but is safe). For columns requiring renaming, coordinate a three-step deploy: add new column, backfill, deploy code using new column, then drop old column.

**Q: What is connection pool exhaustion and how do you diagnose it?**

Each PostgreSQL connection uses 5-10MB RAM. With `max_connections=100` and 20 application pods each opening 10 connections, you're at 200 connections — 100 over the limit. New connections get "FATAL: remaining connection slots are reserved." Diagnose: `SELECT count(*), state FROM pg_stat_activity GROUP BY state` — lots of idle connections means pool sizing problem. Fix: use PgBouncer in transaction-mode pooling; each application request gets a connection only during the transaction, then returns it to the pool. One PostgreSQL backend can serve many application sessions.

**Q: What is WAL and why does it matter for SRE?**

WAL (Write-Ahead Log) is PostgreSQL's durability mechanism: every write is first recorded to the WAL before the actual data pages are modified. On crash recovery, PostgreSQL replays the WAL from the last checkpoint. WAL also powers streaming replication (standbys replay primary's WAL). SRE implications: (1) WAL takes disk space — monitor WAL directory size; (2) WAL replay on the standby creates replication lag — monitor `replay_lag`; (3) `wal_level` setting must be `replica` or `logical` for replication; (4) pg_basebackup and WAL shipping are the basis for point-in-time recovery.

---

## Points to Remember

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

## What to Study Next

- [System Design and Cloud Architecture](./system-design-cloud-architecture) — database selection in system design
- [AWS Cloud Services and Platform Design](./aws-cloud-services-and-platform-design) — RDS and DynamoDB in AWS
- [Observability, SLOs, and Incident Response](./observability-slos-and-incident-response) — database metrics and SLOs
