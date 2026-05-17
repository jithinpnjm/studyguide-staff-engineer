---
title: "Expert"
sidebar_position: 3
---

# Databases & Storage — Expert

Expert database reliability is about correctness under concurrency, recovery under failure, and predictable performance under growth. At staff level, database design is not only schema design; it is production risk management.

---

## Staff-Level Database Questions

Before choosing a database pattern, ask:

1. What is the source of truth?
2. What data loss is acceptable?
3. What recovery time is acceptable?
4. What consistency does the business require?
5. What read/write traffic shape exists?
6. What is the largest expected table or topic?
7. Who owns schema changes?
8. How are backups restored and tested?
9. What happens if the cache disappears?
10. What happens if a replica lags?

A database architecture without RPO, RTO, and ownership is incomplete.

---

## PostgreSQL Internals: MVCC

PostgreSQL uses Multi-Version Concurrency Control (MVCC) for isolation without reader-writer contention. Instead of locking rows for reads, PostgreSQL keeps multiple versions of each row. Each transaction sees a snapshot of the database as of when its snapshot was taken.

How it works:

```text
Transaction T1 (snapshot at t=100):
  - Reads row X → sees version from t=100

Transaction T2 (snapshot at t=105, after T1):
  - Writes row X → creates a new version, does not overwrite T1's view
  - T1 still sees old version
```

Consequences for SRE:

- Old row versions (dead tuples) accumulate until VACUUM reclaims them.
- Long-running transactions prevent VACUUM from reclaiming dead tuples for rows they can still see.
- `n_dead_tup` in `pg_stat_user_tables` shows dead tuple accumulation.
- Table bloat grows as dead tuples accumulate — query performance degrades.

---

## WAL: Write-Ahead Log

WAL (Write-Ahead Log) is PostgreSQL's durability mechanism. Every write is first recorded to the WAL before the actual data pages are modified. On crash recovery, PostgreSQL replays the WAL from the last checkpoint.

Simplified write path:

```text
client commit -> WAL fsync -> data pages updated later -> checkpoint flushes pages to disk
```

WAL also powers:

- **Streaming replication**: standbys replay primary's WAL in real time.
- **Point-in-time recovery (PITR)**: replay WAL to any point in time.
- **Logical replication**: stream individual row changes (not raw WAL blocks).

SRE implications:

- Slow disk can slow commits — WAL fsync latency is on the critical path.
- WAL directory size must be monitored; it grows with write volume and unarchived WAL.
- `wal_level` must be `replica` or `logical` for streaming replication.
- Replication slot retaining WAL for a lagging replica can exhaust disk.
- `pg_basebackup` and WAL archiving together enable PITR.

Check WAL-related settings:

```sql
SHOW wal_level;
SHOW archive_mode;
SHOW archive_command;
SHOW checkpoint_timeout;
SHOW max_wal_size;
```

---

## VACUUM and Autovacuum Tuning

VACUUM reclaims space from dead tuples created by MVCC. Without it, tables bloat and performance degrades.

```sql
-- Manual VACUUM (non-blocking)
VACUUM orders;

-- VACUUM FULL (rewrites the table, blocks access — use only when necessary)
VACUUM FULL orders;

-- VACUUM ANALYZE (reclaim + update statistics)
VACUUM ANALYZE orders;
```

Check dead tuple accumulation:

```sql
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

Autovacuum is triggered per-table when:

```text
n_dead_tup > autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor * n_live_tup
Default: 50 + 0.2 * table_rows
```

For large tables with high write volume, the default scale factor means autovacuum triggers too late. Tune per table:

```sql
-- Tune autovacuum for a heavily-written table
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.01,   -- trigger at 1% dead tuples (not 20%)
    autovacuum_vacuum_threshold = 100,
    autovacuum_analyze_scale_factor = 0.005,
    autovacuum_vacuum_cost_delay = 2         -- milliseconds (lower = faster vacuum, more I/O)
);
```

Autovacuum monitoring:

```sql
-- Check if autovacuum is running
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE query LIKE 'autovacuum%';

-- Tables with bloat risk
SELECT relname, n_dead_tup, n_live_tup,
       round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY dead_pct DESC;
```

---

## PostgreSQL pg_stat_* Views Reference

These views are the operational dashboard for PostgreSQL:

```sql
-- Active queries and sessions
SELECT pid, state, wait_event_type, wait_event,
       now() - query_start AS age, left(query, 80) AS query_snippet
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY age DESC;

-- Per-table I/O and usage statistics
SELECT relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch,
       n_tup_ins, n_tup_upd, n_tup_del, n_dead_tup
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;

-- Index usage — find unused indexes
SELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Replication state
SELECT application_name, state, write_lag, flush_lag, replay_lag, sync_state
FROM pg_stat_replication;

-- Table sizes including toast and indexes
SELECT
    nspname AS schema,
    relname AS table,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
    pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 20;

-- Database-level statistics
SELECT datname, numbackends, xact_commit, xact_rollback,
       blks_read, blks_hit,
       round(blks_hit * 100.0 / NULLIF(blks_read + blks_hit, 0), 2) AS cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();
```

---

## Replication Lag Deep Dive

Replication lag has three components measured in `pg_stat_replication`:

| Metric | Meaning |
|---|---|
| `write_lag` | Time between primary WAL write and replica receiving the WAL |
| `flush_lag` | Time until replica flushes WAL to its own disk |
| `replay_lag` | Time until replica applies WAL to its data pages |

The observable lag for a user read from a standby is `replay_lag`.

Check on the standby:

```sql
SELECT NOW() - pg_last_xact_replay_timestamp() AS replication_lag;
```

Replication lag causes:

- Heavy write burst generating large WAL volumes
- Slow replica I/O (WAL replay is I/O-bound)
- Long-running query on replica holding transaction snapshot (blocks cleanup)
- Network saturation between primary and replica
- Underprovisioned replica CPU or I/O

High Availability with Patroni:

```yaml
# patroni.yml excerpt
bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576   # 1MB — don't promote if too far behind

postgresql:
  parameters:
    wal_level: replica
    hot_standby: on
    max_wal_senders: 3
```

On primary failure, Patroni detects via etcd TTL expiry, elects the standby with the least lag, promotes it, and updates cluster configuration. Failover takes approximately 30 seconds.

---

## Correctness Under Concurrency

Concurrency problems happen when multiple clients modify related data at the same time.

Common risks:

| Problem | Example |
|---|---|
| Lost update | Two writers overwrite each other |
| Double spend | Same balance used twice |
| Oversell | Inventory goes below zero |
| Phantom read | New rows appear during transaction |
| Write skew | Two transactions each see valid state but together violate invariant |

Tools:

- Constraints
- Transactions
- Isolation levels
- Row locks
- Optimistic concurrency
- Idempotency keys
- Unique indexes

Example idempotency table:

```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response_code INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

Table-level lock for exclusive access:

```sql
LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE;
```

---

## Schema Migration Strategy

Dangerous migrations can cause downtime or break rollback.

Safer expand-contract pattern:

```text
1. Add new nullable column or table.
2. Deploy code that writes both old and new shape.
3. Backfill existing data in batches.
4. Deploy code that reads the new shape.
5. Stop writing old shape.
6. Drop old column only after old code is gone.
```

Rules:

- Avoid long table locks during peak traffic.
- Backfill in small batches.
- Monitor replication lag during migration.
- Keep application rollback compatible.
- Use concurrent index creation where supported.

PostgreSQL concurrent index:

```sql
CREATE INDEX CONCURRENTLY idx_orders_created_at
ON orders(created_at);
```

---

## High Availability And Failover

Database HA has two dimensions:

```text
can the service continue?
can the data remain correct?
```

Failover questions:

- Is replication synchronous or asynchronous?
- What is the current replication lag?
- Is failover automatic or manual?
- Can clients reconnect cleanly?
- Are DNS TTLs low enough?
- Does the app handle read-only windows?
- Has failover been tested recently?

Read replicas are not automatically HA. They are often for read scaling and may lag.

---

## Kafka Advanced Operations

### Producer Tuning

For maximum throughput:

```python
producer = Producer({
    'bootstrap.servers': 'kafka:9092',
    'linger.ms': 5,           # wait up to 5ms to accumulate a batch
    'batch.size': 65536,      # batch up to 64KB per partition
    'compression.type': 'snappy',
    'buffer.memory': 33554432,
})
```

For low latency:

```python
producer = Producer({
    'linger.ms': 0,
    'batch.size': 16384,
    'compression.type': 'none',
})
```

### Idempotent and Transactional Producers

**Idempotent producer** — prevents duplicates on network retry:

```python
producer = Producer({
    'acks': 'all',
    'enable.idempotence': True,
})
```

**Transactional producer** — atomic writes across multiple partitions:

```python
producer = Producer({
    'transactional.id': 'order-processor-v1',
    'enable.idempotence': True,
})
producer.init_transactions()
try:
    producer.begin_transaction()
    producer.produce('payments', key='order-123', value='{"status": "charged"}')
    producer.produce('order-status', key='order-123', value='{"status": "confirmed"}')
    producer.commit_transaction()
except Exception as e:
    producer.abort_transaction()
```

### Log Compaction

Log compaction keeps the last value for each key in a topic. Useful for changelog topics and state stores:

```bash
kafka-topics.sh --bootstrap-server kafka:9092 \
  --create --topic user-profiles \
  --partitions 6 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --config min.cleanable.dirty.ratio=0.1 \
  --config segment.ms=3600000
```

### Consumer Partition Assignment Strategy

```python
consumer = Consumer({
    'group.id': 'processor',
    'partition.assignment.strategy': 'cooperative-sticky',
    # cooperative-sticky: incremental rebalance — no stop-the-world
    # sticky: minimize partition movement on rebalance
    # roundrobin: round-robin across consumers
})
```

`cooperative-sticky` is preferred in production — consumers don't all stop processing during a rebalance.

### Kafka Monitoring with Prometheus

Key PromQL queries:

```promql
# Consumer lag per group/topic/partition
kafka_consumer_group_lag{group="order-processor", topic="orders"}

# Broker under-replicated partitions (should be 0)
kafka_server_replicamanager_underreplicatedpartitions

# Producer request latency
rate(kafka_producer_request_latency_avg[5m])

# Messages in per second
rate(kafka_server_brokertopicmetrics_messagesin_total[5m])

# Disk usage per topic
kafka_log_size{topic="user-events"}
```

Alert thresholds:

```text
kafka_consumer_group_lag > 10000         → consumer falling behind
underreplicatedpartitions > 0            → replication degraded
offlinereplicacount > 0                  → data at risk
```

### Dead Letter Queue Pattern

```python
MAX_RETRIES = 3

def process_with_dlq(consumer, dlq_producer):
    msg = consumer.poll(timeout=1.0)
    retry_count = int(msg.headers().get('retry-count', 0))

    try:
        process_order(msg.value())
        consumer.commit(msg)
    except ProcessingError as e:
        if retry_count < MAX_RETRIES:
            dlq_producer.produce(
                topic=f'{msg.topic()}-retry',
                key=msg.key(),
                value=msg.value(),
                headers={
                    'retry-count': str(retry_count + 1),
                    'original-topic': msg.topic(),
                    'error': str(e)
                }
            )
        else:
            dlq_producer.produce(
                topic=f'{msg.topic()}-dlq',
                key=msg.key(),
                value=msg.value(),
                headers={'error': str(e), 'original-offset': str(msg.offset())}
            )
        consumer.commit(msg)  # commit to move past the poison message
```

---

## Backup And Recovery Architecture

Backups are part of production architecture.

A mature backup program defines:

| Area | Requirement |
|---|---|
| Schedule | How often backups run |
| Retention | How long backups are kept |
| Scope | Which databases, tables, buckets, topics |
| Encryption | How backup data is protected |
| Access | Who can restore |
| Test | How often restore is verified |
| RPO/RTO | Business recovery targets |

Recovery drill checklist:

```text
restore backup
connect application or test client
verify schema
verify row counts or checksums
verify permissions
verify monitoring
measure actual restore time
```

A backup is a file. Recovery is a working system.

---

## Connection Storms

Connection storms happen when application scaling exceeds database capacity.

Common triggers:

- Autoscaling event
- Lambda burst
- Deployment restarts all pods
- Database failover
- Cache outage
- Connection leak

Mitigations:

- PgBouncer or RDS Proxy
- App-side pool limits
- Staggered deployment rollouts
- Read replicas for read-heavy paths
- Backpressure and rate limiting
- Circuit breakers

SRE rule: maximum app connections should be designed from database capacity, not from arbitrary per-pod defaults.

---

## Redis Advanced Patterns

### Eviction Policies

When Redis reaches `maxmemory`, it evicts keys based on policy:

| Policy | Behavior |
|---|---|
| `noeviction` | Return error when memory full |
| `allkeys-lru` | Evict least-recently-used key from all keys |
| `volatile-lru` | Evict LRU key only from keys with TTL set |
| `allkeys-lfu` | Evict least-frequently-used from all keys |
| `allkeys-random` | Evict random key |

For a cache use case, `allkeys-lru` or `allkeys-lfu` are common. For a session store where you never want eviction, `noeviction` with alerting on memory pressure.

### Persistence

| Mode | Behavior | Use case |
|---|---|---|
| `RDB` | Periodic snapshots | Fast restarts, acceptable data loss |
| `AOF` | Log every write operation | Low data loss tolerance |
| `RDB + AOF` | Both | Best durability, slower restart |

### Clustering

Redis Cluster shards data across multiple nodes using hash slots (16,384 total). Each master node owns a range of slots. Read/write go to the slot owner. Replicas provide failover.

Key consideration: multi-key operations (`MGET`, pipeline) that span multiple hash slots fail in cluster mode. Use hash tags `{user_id}.session` to co-locate related keys on the same slot.

---

## Data Model Tradeoffs

| Pattern | Strength | Risk |
|---|---|---|
| Relational normalized model | Consistency, integrity | Joins can become expensive |
| Denormalized model | Faster reads | Duplication and update complexity |
| Document model | Flexible records | Harder ad-hoc relational queries |
| Key-value model | High scale simple access | Access patterns must be known upfront |
| Event log | Replay and audit | Consumer complexity and ordering design |

Choose based on access pattern, consistency, scale, and operational ownership.

---

## Expert Takeaways

1. Data correctness is harder to repair than application uptime.
2. MVCC means dead tuples accumulate — autovacuum tuning is a reliability concern.
3. Schema changes must preserve rollback paths.
4. Replication is not a substitute for backup.
5. Read replicas can lag and break read-after-write expectations.
6. Monitor `write_lag`, `flush_lag`, and `replay_lag` separately in `pg_stat_replication`.
7. Long-running transactions block VACUUM and cause table bloat.
8. Connection pools are reliability controls.
9. WAL/binlogs are central to durability and recovery — monitor WAL disk growth.
10. Kafka partition keys define ordering and scale behavior.
11. DLQ pattern prevents poison messages from blocking partitions.
12. Restore testing is the only proof that backups are useful.
