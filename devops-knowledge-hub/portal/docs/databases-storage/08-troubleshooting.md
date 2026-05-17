---
title: "Troubleshooting"
sidebar_position: 8
---

# Databases & Storage — Troubleshooting

Database troubleshooting must protect correctness while restoring service. Do not randomly restart or terminate sessions before understanding whether the issue is query load, lock contention, connection exhaustion, storage pressure, replication lag, table bloat, or application behavior.

```text
symptom -> scope -> database signal -> query/session evidence -> safe mitigation -> root cause
```

---

## First 5 Minutes

Ask:

1. What is user impact?
2. Is this read, write, or both?
3. Did a deploy or migration happen recently?
4. Are connections exhausted?
5. Is CPU, memory, I/O, or storage saturated?
6. Are locks blocking traffic?
7. Is replication lag growing?
8. Is this primary, replica, cache, queue, or object storage?

Quick PostgreSQL checks:

```sql
-- Active sessions ordered by age
SELECT pid, state, wait_event_type, wait_event, now() - query_start AS age, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY age DESC;
```

```sql
-- Replication state
SELECT application_name, state, write_lag, flush_lag, replay_lag, sync_state
FROM pg_stat_replication;
```

```sql
-- Connection count by state
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;
```

---

## High Database CPU

Possible causes:

- Bad query plan (sequential scan on large table)
- Missing index
- Traffic spike
- N+1 query pattern
- Too many active queries
- Autovacuum or maintenance workload
- Sorting or hashing large data sets

Investigate:

```sql
SELECT pid, state, now() - query_start AS age, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY age DESC;
```

For suspected queries:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

Check for sequential scans on large tables:

```sql
SELECT schemaname, relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 10;
```

Mitigation options:

- Roll back recent app change.
- Add a targeted index after review.
- Disable or reduce expensive feature traffic.
- Increase capacity only after understanding query pattern.

---

## Too Many Connections

Symptoms:

```text
too many connections
connection timeout
application pool errors
database CPU not necessarily high
```

Investigate:

```sql
SELECT application_name, client_addr, state, count(*)
FROM pg_stat_activity
GROUP BY application_name, client_addr, state
ORDER BY count(*) DESC;
```

Check max_connections setting:

```sql
SHOW max_connections;
SELECT count(*) FROM pg_stat_activity;
```

Find idle connections consuming slots:

```sql
SELECT pid, usename, application_name, client_addr, state, query_start
FROM pg_stat_activity
WHERE state = 'idle'
ORDER BY query_start;
```

Likely causes:

- App pool too large
- Autoscaling event
- Deployment restart storm
- Connection leak
- Failover reconnect storm
- Missing PgBouncer/RDS Proxy

Mitigation:

- Reduce app pool size.
- Scale app gradually.
- Add or tune PgBouncer in transaction mode.
- Terminate only clearly safe idle sessions when necessary:

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';
```

---

## Lock Contention

Symptoms:

- Queries hang.
- Migration appears stuck.
- Application latency spikes but CPU is not high.
- Sessions wait on locks.

Check waiting sessions:

```sql
SELECT pid, wait_event_type, wait_event, now() - query_start AS age, query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
ORDER BY age DESC;
```

Find blocker and blocked:

```sql
SELECT
  blocked.pid AS blocked_pid,
  blocking.pid AS blocking_pid,
  blocked.query AS blocked_query,
  blocking.query AS blocking_query,
  now() - blocked.query_start AS wait_duration
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

Response:

```text
identify blocker
understand blocker query
check if it is migration, transaction, or application request
stop unsafe migration if appropriate
avoid terminating sessions blindly
```

Prevention:

- Use online migration patterns.
- Create indexes concurrently where supported.
- Backfill in small batches.
- Avoid long idle transactions.

---

## Slow Query

Checklist:

```text
query text changed?
index missing?
stats stale?
rows scanned too high?
sort too large?
join order bad?
parameter changed?
lock wait included in latency?
function wrapping preventing index use?
```

Commands:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

If statistics are stale (estimate vs actual row count mismatch in EXPLAIN):

```sql
ANALYZE orders;
```

Check for unused indexes that may indicate query changed:

```sql
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY relname;
```

Avoid adding indexes blindly. Match index design to query predicates and ordering.

---

## PostgreSQL WAL Accumulation Runbook

### Symptoms

- Disk usage growing on the PostgreSQL data volume.
- `pg_wal` directory size growing faster than expected.
- Backup archiving lag (`pg_stat_archiver.failed_count` increasing).
- Replica alert on replication lag.

### Investigation Steps

Step 1: Check disk usage:

```bash
df -h
du -sh /var/lib/postgresql/*/pg_wal
```

Step 2: Check replication slots (common culprit):

```sql
SELECT
    slot_name,
    active,
    restart_lsn,
    confirmed_flush_lsn,
    pg_size_pretty(
        pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)
    ) AS retained_wal,
    database
FROM pg_replication_slots;
```

A slot with `active = false` and large `retained_wal` is accumulating WAL without a consumer.

Step 3: Check archive status:

```sql
SELECT
    archived_count,
    last_archived_wal,
    last_archived_time,
    failed_count,
    last_failed_wal,
    last_failed_time
FROM pg_stat_archiver;
```

Step 4: Check WAL settings:

```sql
SHOW max_wal_size;
SHOW checkpoint_timeout;
SHOW archive_mode;
SHOW archive_command;
```

Step 5: Check active replication:

```sql
SELECT application_name, state, write_lag, flush_lag, replay_lag
FROM pg_stat_replication;
```

### Mitigation

If an abandoned replication slot is the cause:

```sql
-- Drop the slot only after confirming it has no consumer
SELECT pg_drop_replication_slot('slot_name');
```

If archive_command is failing, fix the archiving target (check S3 credentials, network, permissions) and verify with:

```sql
-- Reset archiver stats after fixing
SELECT pg_stat_reset_shared('archiver');
```

If WAL is generated faster than checkpoints clean it up, tune:

```sql
-- Increase checkpoint frequency (reduce between max and min WAL)
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET max_wal_size = '4GB';
SELECT pg_reload_conf();
```

---

## Table Bloat And MVCC Runbook

### Symptoms

- Query performance gradually degrading without index changes.
- `n_dead_tup` growing in `pg_stat_user_tables`.
- Table size larger than expected for live row count.
- Autovacuum running frequently but not keeping up.

### Investigation

```sql
-- Find bloated tables
SELECT
    relname AS table_name,
    n_live_tup,
    n_dead_tup,
    round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
    last_vacuum,
    last_autovacuum,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY dead_pct DESC;
```

```sql
-- Check if a long-running transaction is blocking vacuum
SELECT pid, now() - xact_start AS xact_age, state, left(query, 100) AS query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_age DESC;
```

A long-running transaction prevents VACUUM from removing dead tuples that are still visible to that transaction.

### Mitigation

```sql
-- Manual vacuum for immediate relief (non-blocking)
VACUUM ANALYZE orders;

-- If table is severely bloated, VACUUM FULL reclaims all space
-- WARNING: VACUUM FULL holds an exclusive lock and rewrites the table
VACUUM FULL orders;

-- Tune autovacuum to prevent recurrence
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 100,
    autovacuum_vacuum_cost_delay = 2
);
```

If a specific long-running transaction is blocking vacuum:

```sql
-- Terminate the offending transaction (verify first)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE xact_start < NOW() - INTERVAL '1 hour'
  AND state = 'idle in transaction';
```

---

## Replication Lag Runbook

### Symptoms

- Replica reads stale data (read-after-write failures).
- `pg_stat_replication` shows growing `replay_lag`.
- Failover risk increases.
- WAL grows on primary.
- Reporting or downstream jobs fall behind.

### Investigation

On primary:

```sql
SELECT
    application_name,
    state,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state,
    pg_size_pretty(
        pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)
    ) AS bytes_behind
FROM pg_stat_replication;
```

On standby:

```sql
SELECT NOW() - pg_last_xact_replay_timestamp() AS replication_lag;
SELECT pg_is_in_recovery();
```

Check for long-running queries on replica (block WAL replay):

```sql
-- On the standby
SELECT pid, now() - query_start AS age, state, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY age DESC;
```

### Common Causes and Fixes

| Cause | Fix |
|---|---|
| Heavy write burst | Batch operations, spread writes over time |
| Slow replica storage | Upgrade replica disk I/O (IOPS) |
| Long query on replica | `max_standby_streaming_delay` config, or kill the query |
| Network saturation | Check bandwidth between primary and replica |
| Underpowered replica | Scale replica CPU/RAM |
| WAL replay bottleneck | Check replica I/O, consider parallel recovery (PG 16+) |

```sql
-- On primary: temporarily route critical reads away from lagging replicas
-- In application: implement read-your-writes routing to primary for recent writes
```

Mitigation:

- Route critical reads to primary temporarily.
- Stop heavy reporting queries on replica.
- Scale replica if needed.
- Investigate WAL and storage pressure.

---

## Index Bloat Runbook

### Symptoms

- Indexes are larger than expected.
- Query performance degraded despite index use.
- `pg_stat_user_indexes` shows high index size relative to table.

### Investigation

```sql
-- Check index sizes
SELECT
    relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
    idx_scan
FROM pg_stat_user_indexes i
JOIN pg_index ON i.indexrelid = pg_index.indexrelid
WHERE NOT indisprimary
ORDER BY pg_relation_size(i.indexrelid) DESC;
```

### Fix

```sql
-- Rebuild index without blocking reads/writes
REINDEX INDEX CONCURRENTLY idx_orders_user_id;

-- Or rebuild all indexes on a table
REINDEX TABLE CONCURRENTLY orders;
```

---

## Storage Full

Symptoms:

- Writes fail.
- WAL cannot be written.
- Database stops accepting changes.
- Backups or replication fail.

Check:

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

System-level checks if on VM:

```bash
df -h
du -sh /var/lib/postgresql/* 2>/dev/null | sort -rh | head
```

Possible causes:

- Table growth
- Index growth
- WAL accumulation (see WAL runbook above)
- Temporary files from large sorts or joins
- Backups on same disk
- Replica slot retaining WAL

Check temporary file usage:

```sql
SELECT pg_size_pretty(temp_bytes), datname
FROM pg_stat_database
WHERE temp_bytes > 0;
```

Do not manually remove database files. Expand storage or remove safe external artifacts only after understanding the database engine.

---

## Backup Or Restore Failure

Check:

```text
backup age
backup completeness
WAL/binlog availability for PITR
restore target capacity
network access
credentials
application config
schema validation
row count validation
```

Restore validation queries:

```sql
SELECT count(*) FROM users;
SELECT count(*) FROM orders;
SELECT max(created_at) FROM orders;
```

Check pg_basebackup archive integrity:

```bash
# Verify backup can be listed
aws s3 ls s3://your-backup-bucket/postgres/ --recursive | tail -20

# Check WAL archive continuity
# For PITR to work, there must be no gaps in WAL archives from the base backup time
```

SRE rule: if restore has never been tested, the backup strategy is unproven.

---

## Cache Outage

Symptoms:

- Redis/Memcached unavailable.
- Database traffic spikes.
- App latency increases.
- Error rate rises.

Questions:

```text
can app serve stale data?
does app have timeouts?
can database survive cache miss traffic?
is there request coalescing?
is there rate limiting?
```

Mitigation:

- Restore cache if it is the bottleneck.
- Reduce traffic to expensive paths.
- Enable stale response mode if available.
- Protect database with rate limits and circuit breakers.

---

## Kafka Consumer Lag

Symptoms:

- Downstream systems stale.
- Notifications delayed.
- Analytics behind.
- Consumer group lag increasing.

Check consumer lag:

```bash
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe \
  --group order-processor
```

Check all consumer groups:

```bash
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --list | xargs -I{} kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 --describe --group {}
```

Check broker health:

```bash
# List under-replicated partitions
kafka-topics.sh --bootstrap-server kafka:9092 \
  --describe --under-replicated-partitions
```

Common causes:

- Consumers too slow
- Too few partitions (can't add more consumers than partitions)
- Poison message blocking partition
- Downstream dependency slow
- Rebalance loop
- Broker under pressure

Mitigation:

- Scale consumers if partitions allow.
- Pause or isolate poison messages (commit offset to skip, send to DLQ).
- Fix downstream bottleneck.
- Increase partitions only after understanding ordering requirements.

Rebalance tuning:

```text
session.timeout.ms      — increase if consumers timeout under load
heartbeat.interval.ms   — must be < session.timeout.ms / 3
max.poll.interval.ms    — increase if processing is slow between polls
```

---

## Object Storage Issue

Symptoms:

- Access denied
- Object not found
- Lifecycle unexpectedly removed objects
- Storage cost spike
- Replication lag

Check:

```text
bucket policy
object key
IAM role or service account
KMS key policy
lifecycle rule
versioning
replication configuration
request logs
```

SRE habit: distinguish missing object, denied access, wrong key/prefix, and lifecycle deletion.

---

## Safe Mitigation Rules

Before taking action:

```text
Will this risk data loss?
Will this block writes?
Will this break replication?
Will this destroy evidence?
Is there a rollback path?
Who owns the data model?
```

Good mitigations are specific:

- Roll back an app deploy.
- Pause a migration.
- Route reads to primary for critical paths.
- Add temporary capacity.
- Reduce traffic to expensive endpoints.
- Drop an abandoned replication slot after confirming no consumer.
- Run VACUUM ANALYZE on a bloated table.
- Restore from tested backup if corruption is confirmed.

---

## Final Rule

Be precise:

```text
The database is CPU-bound.
The database is connection-bound.
Queries are blocked on locks.
A query plan regressed.
Replica reads are stale (replay_lag = X seconds).
WAL is accumulating due to abandoned replication slot.
Table bloat is degrading performance (n_dead_tup = X).
Autovacuum is not keeping up with write rate.
Storage is full.
Restore is untested.
Kafka consumers are behind (lag = X messages).
Object storage access is denied.
```

Each statement points to a different evidence source, mitigation, and owner.
