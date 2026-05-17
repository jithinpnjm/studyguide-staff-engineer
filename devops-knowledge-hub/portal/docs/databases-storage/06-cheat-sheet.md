---
title: "Cheat Sheet"
sidebar_position: 6
---

# Databases & Storage — Cheat Sheet

Fast recall for SQL, PostgreSQL operations, indexing, transactions, backups, replication, connection pooling, Kafka, Redis, and storage.

---

## SQL Basics

```sql
SELECT id, email FROM users WHERE id = 1;

INSERT INTO users(email) VALUES ('user@example.com');

UPDATE orders SET status = 'paid' WHERE id = 1001;
```

NULL handling:

```sql
SELECT * FROM orders WHERE completed_at IS NULL;
-- Never use: WHERE completed_at = NULL
```

Production habit:

```text
inspect target rows
use transaction when appropriate
review affected row count
avoid broad changes without approval
```

---

## Joins

```sql
SELECT users.email, orders.total
FROM users
INNER JOIN orders ON users.id = orders.user_id;
```

```sql
SELECT users.email, orders.total
FROM users
LEFT JOIN orders ON users.id = orders.user_id;
```

| Join | Meaning |
|---|---|
| INNER JOIN | Matching rows only |
| LEFT JOIN | All left rows plus matches |
| FULL JOIN | All rows from both sides |

---

## Aggregation

```sql
SELECT region, COUNT(*), SUM(total)
FROM orders
WHERE status = 'paid'
GROUP BY region
HAVING SUM(total) > 100000;
```

```text
WHERE filters before grouping
HAVING filters after grouping
```

Window functions:

```sql
SELECT
    user_id,
    region,
    total_spent,
    RANK() OVER (PARTITION BY region ORDER BY total_spent DESC) AS rank,
    SUM(amount) OVER (ORDER BY created_at) AS running_total
FROM user_spending;
```

---

## Indexes

```sql
-- Composite (column order matters — leftmost prefix rule)
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);

-- Partial
CREATE INDEX idx_active_users_email
ON users(email)
WHERE deleted_at IS NULL;

-- Functional
CREATE INDEX idx_users_lower_email
ON users(lower(email));

-- Covering (INCLUDE prevents table heap access)
CREATE INDEX idx_orders_user_covering
ON orders(user_id)
INCLUDE (total, status, created_at);

-- Concurrent (safe on live tables)
CREATE INDEX CONCURRENTLY idx_orders_amount ON orders(amount);
```

Index rules:

```text
match predicates
match ordering
avoid over-indexing
watch write overhead
watch storage growth
leftmost column must appear in query predicate
```

---

## Query Plans

```sql
EXPLAIN
SELECT * FROM orders WHERE user_id = 123;
```

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

Red flags:

```text
sequential scan on large table
rows removed by filter is huge
bad estimate vs actual rows (stale stats — run ANALYZE)
large sort
large nested loop
high shared read blocks
high loops on Index Scan (N+1 pattern)
```

---

## Transactions

```sql
BEGIN;
UPDATE inventory SET reserved = reserved + 1 WHERE product_id = 42;
INSERT INTO reservations(product_id, user_id) VALUES (42, 1001);
COMMIT;
```

Rollback shape:

```sql
BEGIN;
-- test change
ROLLBACK;
```

ACID:

```text
Atomicity    — all or nothing
Consistency  — constraints remain valid
Isolation    — concurrent transactions don't interfere
Durability   — committed data survives crashes (WAL)
```

Job queue pattern:

```sql
SELECT * FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

---

## Locks And Activity

```sql
SELECT pid, state, wait_event_type, wait_event, query
FROM pg_stat_activity
WHERE state <> 'idle';
```

Long queries:

```sql
SELECT pid, now() - query_start AS age, state, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY age DESC;
```

Waiting on locks:

```sql
SELECT pid, wait_event_type, wait_event, now() - query_start AS age, query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
ORDER BY age DESC;
```

Lock-oriented signals:

```text
wait_event_type = Lock
long open transaction
migration waiting
many blocked sessions
```

---

## PostgreSQL Operational Views

```sql
SELECT * FROM pg_stat_database;
SELECT * FROM pg_stat_replication;
SELECT * FROM pg_stat_activity;
SELECT * FROM pg_locks;
SELECT * FROM pg_stat_user_tables;
SELECT * FROM pg_stat_user_indexes;
```

Database size:

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

Table size:

```sql
SELECT pg_size_pretty(pg_total_relation_size('orders'));
```

Cache hit ratio:

```sql
SELECT
    datname,
    round(blks_hit * 100.0 / NULLIF(blks_read + blks_hit, 0), 2) AS cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();
```

Unused indexes:

```sql
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY relname;
```

---

## VACUUM And Dead Tuples

```sql
-- Check dead tuple accumulation
SELECT
    relname,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- Manual vacuum (non-blocking)
VACUUM orders;

-- Vacuum + update statistics
VACUUM ANALYZE orders;

-- Tune autovacuum for high-write table
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 100
);
```

---

## Connection Pooling

Problem pattern:

```text
pods x app_pool_size > database max_connections
Each PostgreSQL connection uses 5-10 MB RAM
```

PgBouncer shape:

```ini
[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

Pooling modes:

```text
session     — connection held for entire client session
transaction — connection held only during transaction (most efficient)
statement   — connection per statement (breaks multi-statement transactions)
```

Signals:

```text
too many connections
connection timeout
database CPU normal but app failing
failover reconnect storm
```

---

## Replication

| Type | Tradeoff |
|---|---|
| Synchronous | Better durability, higher write latency |
| Asynchronous | Lower write latency, possible lag/data loss on failover |

Check lag on primary:

```sql
SELECT application_name, state, write_lag, flush_lag, replay_lag, sync_state
FROM pg_stat_replication;
```

Check lag on standby:

```sql
SELECT NOW() - pg_last_xact_replay_timestamp() AS replication_lag;
```

Replication concerns:

```text
replica lag
stale reads
failover behavior
WAL retention
replication slot retaining WAL (disk exhaustion risk)
read query pressure on replicas
```

---

## Schema Migration Safety

```text
Safe approach (expand-contract):
1. Add new nullable column (fast, no rewrite)
2. Backfill in small batches
3. Set NOT NULL (fast if no NULLs exist)
4. Deploy code using new shape
5. Drop old column after old code is gone

Use CREATE INDEX CONCURRENTLY — never plain CREATE INDEX on live tables
Avoid long table locks during peak traffic
Monitor replication lag during migration
```

---

## Backup And Recovery

```text
RPO: maximum acceptable data loss
RTO: maximum acceptable recovery time
PITR: point-in-time recovery
WAL/binlog: change log used for replay
```

Restore drill checklist:

```text
restore backup
validate schema
validate row counts
validate application access
validate permissions
measure restore time
record actual RPO/RTO
```

---

## Kafka

```text
topic: named event stream
partition: ordered shard
producer: writes records
consumer: reads records
consumer group: shares partitions
offset: consumer position
ISR: in-sync replicas
log-end-offset: latest produced offset
consumer lag: log-end-offset - current-offset
```

Reliability settings:

```text
acks=all
replication.factor=3
min.insync.replicas=2
retention.ms
cleanup.policy=delete (or compact)
enable.idempotence=true
```

Ordering rule:

```text
Kafka preserves order within a partition, not across all partitions.
Use entity ID as partition key to ensure per-entity ordering.
```

Consumer lag check:

```bash
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe \
  --group <group-id>
```

Key Prometheus metrics:

```promql
kafka_consumer_group_lag{group="...", topic="..."}
kafka_server_replicamanager_underreplicatedpartitions
kafka_log_size{topic="..."}
```

Alert thresholds:

```text
consumer lag growing              → scale consumers or optimize processing
under-replicated partitions > 0   → broker issue, replication degraded
offline replicas > 0              → data at risk, urgent
disk > 80%                        → adjust retention or add storage
```

---

## Redis Reference

Eviction policies:

```text
noeviction       — error when memory full
allkeys-lru      — evict least-recently-used from all keys (cache use case)
volatile-lru     — evict LRU from keys with TTL only
allkeys-lfu      — evict least-frequently-used
allkeys-random   — evict random key
```

Persistence modes:

```text
RDB  — periodic snapshots (fast restart, some data loss)
AOF  — log every write (low data loss, slower restart)
both — best durability
```

Cluster note:

```text
hash tags {user_id}.session co-locate related keys on the same slot
multi-key ops (MGET, pipeline) fail across hash slots in cluster mode
```

---

## Storage Types

| Type | Use case |
|---|---|
| Block | Database volumes, VM disks |
| Object | Backups, logs, data lake, artifacts |
| File | Shared filesystem workloads |
| Ephemeral | Temporary local scratch |

Database storage signals:

```text
latency
IOPS
throughput
queue depth
free space
WAL growth
snapshot/backup duration
```

---

## Database Selection Quick Reference

```text
RDS/Aurora PostgreSQL  → relational, SQL, joins, transactions
DynamoDB               → key-value/document, known access patterns, massive scale
ElastiCache Redis      → low-latency cache, session store, pub-sub
S3                     → objects, backups, data lake
DocumentDB             → MongoDB-compatible documents on AWS
Neptune                → graph relationships
Timestream             → time-series data
Keyspaces              → Cassandra-compatible
```

Senior framing:

```text
Choose by: access pattern, consistency requirement, latency SLO,
           scale, operational model, backup/restore, multi-region,
           team skill. Not by popularity.
```

---

## Production Red Flags

```text
no tested restore
no slow-query visibility
unbounded app connection pools
long migrations during peak traffic
missing indexes on hot paths
read replica used for read-after-write flows
cache unavailable collapses database
Kafka consumer lag ignored
DLQ growing with no alert
storage nearly full
WAL accumulation from retained replication slot
backups stored in same failure domain only
autovacuum not keeping up (high n_dead_tup)
```
