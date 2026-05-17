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

- Missing index
- N+1 query pattern
- `SELECT *` on large rows
- Bad pagination
- Stale statistics
- Query shape changed after deploy

### Lesson

Application releases can be database incidents. Always correlate query changes with deploy time.

---

## Example 2: Connection Pool Exhaustion

### Scenario

During autoscaling, the application scales from 20 pods to 100 pods. Each pod opens 20 database connections. The database stops accepting new connections.

### Root Cause

Application concurrency exceeded database connection capacity.

```text
100 pods x 20 connections = 2000 possible connections
```

### Mitigation

- Lower app pool size.
- Add PgBouncer or RDS Proxy.
- Stagger deployments.
- Add backpressure.
- Alert on connection usage before exhaustion.

### Lesson

Connection pools are reliability controls. Defaults are often unsafe at scale.

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

### Root Cause

The migration took a lock that blocked production queries.

### Better Pattern

```text
add new nullable column
create indexes concurrently where supported
backfill in small batches
deploy code that handles old and new schema
remove old schema only after old code is gone
```

### Lesson

Schema migration design is release engineering. It must preserve uptime and rollback.

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

A backup is a file. Recovery is a working service.

---

## Example 5: Replica Lag Causes Stale Reads

### Scenario

A user places an order and immediately refreshes the page. The order is missing. Minutes later it appears.

### Root Cause

The write went to the primary, but the read came from a lagging replica.

### Fix Options

- Read from primary for read-after-write flows.
- Route a user to primary briefly after write.
- Monitor replica lag.
- Avoid heavy analytics on user-facing replicas.
- Use stronger replication only where business correctness requires it.

### Lesson

Read replicas improve scale but can weaken consistency expectations.

---

## Example 6: Cache Outage Becomes Database Outage

### Scenario

Redis is unavailable. All requests fall through to PostgreSQL. The database saturates and the application becomes unavailable.

### Root Cause

The database could not handle full cache-miss traffic.

### Better Design

- Timeouts and circuit breakers
- Stale reads where acceptable
- Request coalescing
- Rate limiting
- Cache warmup
- Database query budget

### Lesson

A cache is not only a performance feature. It changes the load model of the database.

---

## Example 7: Kafka Consumer Lag Grows Silently

### Scenario

A Kafka consumer group falls behind for several hours. User-facing systems appear fine, but downstream analytics and notifications are stale.

### Investigation

Check:

```text
consumer lag
consumer group health
partition distribution
broker health
consumer errors
message processing time
```

### Common Causes

- Consumer processing slower than producer rate
- Poison message loop
- Rebalance instability
- Too few partitions
- Underprovisioned consumers
- Downstream dependency slow

### Lesson

Kafka lag is a reliability signal. It represents unprocessed business events.

---

## Example 8: Hot Partition In Kafka

### Scenario

A topic has 24 partitions, but one broker and one consumer are overloaded.

### Root Cause

Most events use the same key, so they route to the same partition.

### Better Design

- Choose a key with enough distribution.
- Preserve ordering only where required.
- Monitor partition-level throughput.
- Avoid hardcoding partition IDs in producers.

### Lesson

Kafka partition keys define both ordering and load distribution.

---

## Example 9: Object Storage Lifecycle Missing

### Scenario

Log archive storage cost grows every month. No service is failing, but the bill is becoming large.

### Root Cause

Objects are retained forever in expensive storage class.

### Fix

- Define retention by data type.
- Move old objects to colder storage.
- Delete expired objects after compliance window.
- Track storage cost by bucket/prefix.

### Lesson

Storage reliability includes cost sustainability. Infinite retention is rarely intentional architecture.

---

## Example 10: WAL Growth Fills Disk

### Scenario

PostgreSQL disk usage grows quickly. The database is not growing much, but WAL files are accumulating.

### Possible Causes

- Replica offline or lagging
- Backup archiving stuck
- Long-running replication slot
- High write burst
- Checkpoint or archive configuration issue

### Investigation

Check replication, archiving, disk usage, and long-lived slots. Do not remove WAL files manually without understanding recovery impact.

### Lesson

WAL is part of durability and recovery. Treat WAL growth as a serious operational signal.

---

## Staff-Level Summary

Database incidents often come from the boundary between application behavior and data-system limits: query shape, connection growth, migration locks, replica lag, cache dependency, Kafka lag, and storage growth. Strong SREs debug from user symptom to data path and always ask what correctness guarantee is at risk.
