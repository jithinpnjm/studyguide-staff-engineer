---
title: "Real-World Examples"
sidebar_position: 7
---

# Databases & Storage — Real-World Examples

These examples show how database and storage failures appear in production and how an SRE should reason about correctness, performance, recovery, and blast radius.

---

## Example 1: One Query Saturates The Database

### Scenario

A new endpoint is released. Database CPU jumps from 35% to 95%, API latency increases, and connection count grows.

### Investigation

```sql
SELECT pid, state, now() - query_start AS age, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY age DESC;
```

Run the suspected query through:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

### Likely Causes

- Missing index → sequential scan on large table
- N+1 query pattern — 100 orders loading 100 separate user queries
- `SELECT *` on large rows
- Bad pagination (large OFFSET)
- Stale statistics (estimate vs actual row count mismatch in EXPLAIN)
- Query shape changed after deploy

### Lesson

Application releases can be database incidents. Always correlate query changes with deploy time. The first responder action is `EXPLAIN ANALYZE`, not increasing database size.

---

## Example 2: Connection Pool Exhaustion

### Scenario

During autoscaling, the application scales from 20 pods to 100 pods. Each pod opens 20 database connections. The database stops accepting new connections.

### Root Cause

Application concurrency exceeded database connection capacity.

```text
100 pods x 20 connections = 2000 possible connections
PostgreSQL max_connections = 200 (typical default)
2000 >> 200 → FATAL: remaining connection slots are reserved
```

### Diagnosis

```sql
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;

SELECT application_name, client_addr, state, count(*)
FROM pg_stat_activity
GROUP BY application_name, client_addr, state
ORDER BY count(*) DESC;
```

### Mitigation

- Lower app pool size.
- Add PgBouncer or RDS Proxy in transaction mode.
- Stagger deployments.
- Add backpressure.
- Alert on connection usage before exhaustion.

### Lesson

Connection pools are reliability controls. Defaults are often unsafe at scale. One PostgreSQL backend can serve many application sessions through PgBouncer transaction pooling.

---

## Example 3: Migration Blocks Production

### Scenario

A schema migration runs during business hours. Requests start timing out because application queries are waiting behind a database lock.

### Investigation

```sql
SELECT pid, wait_event_type, wait_event, now() - query_start AS age, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY age DESC;
```

Find the blocker:

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
 AND blocking_locks.granted
JOIN pg_stat_activity blocking ON blocking.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### Root Cause

The migration took an ACCESS EXCLUSIVE lock that blocked all reads and writes. Common culprits: `ALTER TABLE ADD COLUMN NOT NULL DEFAULT`, `CREATE INDEX` (not concurrent), `ADD CONSTRAINT`.

### Better Pattern

```text
add new nullable column (near-instant)
create indexes CONCURRENTLY where supported
backfill in small batches
deploy code that handles old and new schema
remove old schema only after old code is gone
```

### Lesson

Schema migration design is release engineering. It must preserve uptime and rollback. Never run `CREATE INDEX` (only `CREATE INDEX CONCURRENTLY`) on a production table under load.

---

## Example 4: Backup Exists But Restore Fails

### Scenario

A team has daily backups. During a recovery test, the restored database is unreachable by the application because networking, credentials, and config were not part of the restore runbook.

### Root Cause

The organization tested backup creation, not service recovery.

### Restore Test Should Validate

- Backup restore completes.
- Schema exists.
- Row counts or checksums match expectations.
- Application can connect.
- Permissions are correct.
- Monitoring works.
- Actual RTO is measured.

### Lesson

A backup is a file. Recovery is a working service. PITR requires both base backup and continuous WAL archiving to be correctly configured and stored in durable, reachable storage.

---

## Example 5: Replica Lag Causes Stale Reads

### Scenario

A user places an order and immediately refreshes the page. The order is missing. Minutes later it appears.

### Root Cause

The write went to the primary, but the read came from a lagging replica.

### Diagnosis

```sql
-- On primary
SELECT application_name, state, write_lag, flush_lag, replay_lag
FROM pg_stat_replication;

-- On standby
SELECT NOW() - pg_last_xact_replay_timestamp() AS replication_lag;
```

### Fix Options

- Read from primary for read-after-write flows.
- Route a user to primary briefly after write.
- Monitor replica lag and alert on sustained lag.
- Avoid heavy analytics on user-facing replicas.
- Use synchronous replication only where business correctness requires it.

### Lesson

Read replicas improve scale but can weaken consistency expectations. `replay_lag` is what the user sees — not `write_lag` or `flush_lag`.

---

## Example 6: Cache Outage Becomes Database Outage

### Scenario

Redis is unavailable. All requests fall through to PostgreSQL. The database saturates and the application becomes unavailable.

### Root Cause

The database could not handle full cache-miss traffic. The database was sized to handle normal load with cache absorbing hot reads — not full cold traffic.

### Better Design

- Timeouts and circuit breakers
- Stale reads where acceptable
- Request coalescing
- Rate limiting
- Cache warmup
- Database query budget

### Lesson

A cache is not only a performance feature. It changes the load model of the database. A cache outage is a database reliability event.

---

## Example 7: Kafka Consumer Lag Grows Silently

### Scenario

A Kafka consumer group falls behind for several hours. User-facing systems appear fine, but downstream analytics and notifications are stale.

### Investigation

```bash
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe \
  --group analytics-processor

# Look for LAG column — growing means consumers falling behind
```

Check:

```text
consumer lag per partition
consumer group health
partition distribution
broker health
consumer errors
message processing time
downstream dependency latency
```

### Common Causes

- Consumer processing slower than producer rate
- Poison message loop
- Rebalance instability (tune session.timeout.ms)
- Too few partitions (can't scale consumers beyond partition count)
- Underprovisioned consumers
- Downstream dependency slow

### Lesson

Kafka lag is a reliability signal. It represents unprocessed business events. Alert when `kafka_consumer_group_lag > threshold` — not only when the consumer restarts.

---

## Example 8: Hot Partition In Kafka

### Scenario

A topic has 24 partitions, but one broker and one consumer are overloaded.

### Root Cause

Most events use the same key, so they route to the same partition (hash(key) % num_partitions = same partition). One consumer handles all the traffic.

### Better Design

- Choose a key with enough distribution.
- Preserve ordering only where required.
- Monitor partition-level throughput.
- Avoid hardcoding partition IDs in producers.

### Lesson

Kafka partition keys define both ordering and load distribution. A poorly chosen key creates hot spots that eliminate the parallelism benefit of partitioning.

---

## Example 9: Object Storage Lifecycle Missing

### Scenario

Log archive storage cost grows every month. No service is failing, but the bill is becoming large.

### Root Cause

Objects are retained forever in expensive storage class.

### Fix

- Define retention by data type.
- Move old objects to colder storage (S3 Glacier, Nearline).
- Delete expired objects after compliance window.
- Track storage cost by bucket/prefix.

### Lesson

Storage reliability includes cost sustainability. Infinite retention is rarely intentional architecture.

---

## Example 10: WAL Growth Fills Disk

### Scenario

PostgreSQL disk usage grows quickly. The database tables are not growing much, but WAL files are accumulating.

### Possible Causes

- Replica offline or lagging — primary retains WAL for the replica
- Backup archiving stuck — `archive_command` failing silently
- Long-running replication slot retaining WAL even without a connected replica
- High write burst exceeding `max_wal_size`
- Checkpoint or archive configuration issue

### Investigation

```sql
-- Check replication slots (a slot with large lag retains WAL)
SELECT slot_name, active, restart_lsn, confirmed_flush_lsn,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots;

-- Check WAL directory size (on the OS)
-- du -sh /var/lib/postgresql/*/pg_wal

-- Check archive status
SELECT * FROM pg_stat_archiver;
```

### Lesson

WAL is part of durability and recovery. Treat WAL growth as a serious operational signal. Do not remove WAL files manually without understanding recovery impact. An abandoned replication slot is a common cause of WAL accumulation — drop unused slots.

---

## Example 11: Table Bloat From Autovacuum Lag

### Scenario

PostgreSQL query performance degrades gradually over weeks. `EXPLAIN ANALYZE` shows no missing index. Table scans are taking longer.

### Root Cause

Heavy update workload (e.g., status column updated on every order) creates dead tuples faster than autovacuum reclaims them. Table bloat means more pages to scan per query.

### Investigation

```sql
SELECT
    relname,
    n_live_tup,
    n_dead_tup,
    round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
    last_autovacuum,
    last_vacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY dead_pct DESC;
```

### Fix

```sql
-- Manual vacuum for immediate relief
VACUUM ANALYZE orders;

-- Tune autovacuum for high-write table
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 100
);
```

### Lesson

Autovacuum tuning is a performance reliability concern. For tables with millions of rows updated frequently, the default 20% scale factor triggers vacuum too late. Tune per-table to 1-5%.

---

## Example 12: Kafka Broker Failure and ISR Degradation

### Scenario

One Kafka broker goes offline. Some partitions are under-replicated. Alert fires for `under_replicated_partitions > 0`.

### What Happens

- Kafka detects broker failure via controller heartbeat timeout.
- For partitions where the failed broker was the leader, a new leader is elected from the ISR.
- While the broker is down, those partitions have reduced ISR.
- If `min.insync.replicas=2` and only 1 ISR remains, producers with `acks=all` receive `NotEnoughReplicasException`.

### Diagnosis

```bash
# Check under-replicated partitions
kafka-topics.sh --bootstrap-server kafka:9092 \
  --describe \
  --under-replicated-partitions

# Check broker list
kafka-broker-api-versions.sh --bootstrap-server kafka:9092
```

### Response

1. Alert immediately — data durability is reduced.
2. Check if the broker can be restarted quickly.
3. If not, evaluate whether to continue with `min.insync.replicas=1` temporarily.
4. Monitor partition reassignment as the broker recovers.

### Lesson

Under-replicated partitions mean your topic has fewer copies than configured. This is not a future risk — it is a current durability gap. Alert and respond immediately.

---

## Staff-Level Summary

Database incidents often come from the boundary between application behavior and data-system limits: query shape, connection growth, migration locks, replica lag, cache dependency, Kafka lag, table bloat, WAL accumulation, and storage growth. Strong SREs debug from user symptom to data path and always ask what correctness guarantee is at risk.
