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

## Replication Lag And Read Consistency

Replica lag can break user expectations.

Example:

```text
user writes order -> app reads from replica -> order not visible yet
```

Solutions:

- Read-your-writes from primary for critical flows.
- Route recently written users to primary briefly.
- Use synchronous replication where correctness requires it.
- Expose lag metrics and alert on sustained lag.
- Avoid heavy reporting queries on replicas used for user reads.

Replication lag is both a reliability and correctness signal.

---

## Storage Engine And WAL Concepts

Most production databases use write-ahead logging.

Simplified write path:

```text
client commit -> WAL/binlog fsync -> data pages updated later -> checkpoint flushes pages
```

Why WAL matters:

- Crash recovery
- Replication
- Point-in-time recovery
- Durability

Operational implications:

- Slow disk can slow commits.
- WAL growth can fill disk.
- Replica lag can grow if WAL replay is slow.
- Backup/PITR depends on WAL availability.

---

## Kafka As Storage And Streaming

Kafka stores event logs, not relational rows. It is excellent when event history, stream processing, fan-out, and replay matter.

Design questions:

1. What is the event key?
2. What ordering guarantee is required?
3. How many partitions are needed?
4. What retention is required?
5. What happens to poison messages?
6. Can consumers be rebalanced safely?
7. What is acceptable consumer lag?
8. How are schemas versioned?

Kafka is reliable only when producers, brokers, consumers, schemas, and retention are all designed.

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
2. Schema changes must preserve rollback paths.
3. Replication is not a substitute for backup.
4. Read replicas can lag and break read-after-write expectations.
5. Connection pools are reliability controls.
6. WAL/binlogs are central to durability and recovery.
7. Kafka partition keys define ordering and scale behavior.
8. Restore testing is the only proof that backups are useful.
