---
title: "Troubleshooting"
sidebar_position: 8
---

# Databases & Storage — Troubleshooting

Database troubleshooting must protect correctness while restoring service. Do not randomly restart or terminate sessions before understanding whether the issue is query load, lock contention, connection exhaustion, storage pressure, replication lag, or application behavior.

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
SELECT pid, state, wait_event_type, wait_event, now() - query_start AS age, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY age DESC;
```

```sql
SELECT application_name, state, sync_state, replay_lag
FROM pg_stat_replication;
```

---

## High Database CPU

Possible causes:

- Bad query plan
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
- Add or tune pooler.
- Terminate only clearly safe idle sessions when necessary.

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
```

Commands:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

```sql
ANALYZE orders;
```

Avoid adding indexes blindly. Match index design to query predicates and ordering.

---

## Replication Lag

Symptoms:

- Replica reads stale data.
- Failover risk increases.
- WAL grows.
- Reporting or downstream jobs fall behind.

Check:

```sql
SELECT application_name, state, sync_state, replay_lag
FROM pg_stat_replication;
```

Common causes:

- Heavy write burst
- Slow replica storage
- Long query on replica
- Network issue
- Underpowered replica
- WAL replay bottleneck

Mitigation:

- Route critical reads to primary temporarily.
- Stop heavy reporting queries on replica.
- Scale replica if needed.
- Investigate WAL and storage pressure.

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
- WAL accumulation
- Temporary files
- Backups on same disk
- Replica slot retaining WAL

Do not manually remove database files. Expand storage or remove safe external artifacts only after understanding the database engine.

---

## Backup Or Restore Failure

Check:

```text
backup age
backup completeness
WAL/binlog availability
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

Check:

```text
consumer group lag
partition-level lag
consumer errors
rebalance frequency
broker health
message processing latency
downstream dependency latency
```

Common causes:

- Consumers too slow
- Too few partitions
- Poison message
- Downstream dependency slow
- Rebalance loop
- Broker under pressure

Mitigation:

- Scale consumers if partitions allow.
- Pause or isolate poison messages.
- Fix downstream bottleneck.
- Increase partitions only after understanding ordering requirements.

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
- Restore from tested backup if corruption is confirmed.

---

## Final Rule

Be precise:

```text
The database is CPU-bound.
The database is connection-bound.
Queries are blocked on locks.
A query plan regressed.
Replica reads are stale.
Storage is full.
Restore is untested.
Kafka consumers are behind.
Object storage access is denied.
```

Each statement points to a different evidence source, mitigation, and owner.
