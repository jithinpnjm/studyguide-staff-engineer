---
title: "Cheat Sheet"
sidebar_position: 6
---

# Databases & Storage — Cheat Sheet

Fast recall for SQL, PostgreSQL operations, indexing, transactions, backups, replication, connection pooling, Kafka, and storage.

---

## SQL Basics

```sql
SELECT id, email FROM users WHERE id = 1;

INSERT INTO users(email) VALUES ('user@example.com');

UPDATE orders SET status = 'paid' WHERE id = 1001;
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

---

## Indexes

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
```

```sql
CREATE INDEX idx_active_users_email
ON users(email)
WHERE deleted_at IS NULL;
```

```sql
CREATE INDEX idx_users_lower_email
ON users(lower(email));
```

Index rules:

```text
match predicates
match ordering
avoid over-indexing
watch write overhead
watch storage growth
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
bad estimate vs actual rows
large sort
large nested loop
high shared read blocks
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
Atomicity
Consistency
Isolation
Durability
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
```

Database size:

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

Table size:

```sql
SELECT pg_size_pretty(pg_total_relation_size('orders'));
```

---

## Connection Pooling

Problem pattern:

```text
pods x app_pool_size > database max_connections
```

PgBouncer shape:

```ini
[pgbouncer]
pool_mode = transaction
max_client_conn = 5000
default_pool_size = 25
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

Check lag concept:

```sql
SELECT application_name, state, sync_state, replay_lag
FROM pg_stat_replication;
```

Replication concerns:

```text
replica lag
stale reads
failover behavior
WAL retention
read query pressure on replicas
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
```

Reliability settings:

```text
acks=all
replication.factor=3
min.insync.replicas=2
retention.ms
cleanup.policy
```

Ordering rule:

```text
Kafka preserves order within a partition, not across all partitions.
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
storage nearly full
backups stored in same failure domain only
```
