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

### What is N+1 query problem?

The application first loads parent rows and then runs one additional query per parent. This creates many small database round trips. Use joins, batching, or prefetching.

---

## Index Questions

### What is an index?

An index is a data structure that helps the database find rows faster. It improves reads but adds write and storage overhead.

### What is a composite index?

An index over multiple columns.

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
```

### What is a partial index?

An index over only rows that match a predicate.

```sql
CREATE INDEX idx_active_users_email
ON users(email)
WHERE deleted_at IS NULL;
```

### What is a covering index?

An index that contains all columns needed by a query, allowing the database to answer from the index without reading table pages.

### How do you know whether an index is used?

Use `EXPLAIN` or `EXPLAIN ANALYZE`.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

---

## Transaction Questions

### What is ACID?

Atomicity, Consistency, Isolation, and Durability. These properties define transactional correctness.

### What is isolation level?

Isolation level controls how transactions see each other’s changes. Stronger isolation improves correctness but may increase blocking, retries, or reduced concurrency.

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

---

## PostgreSQL / Operations Questions

### How do you troubleshoot a slow query?

Check query text, execution plan, indexes, row counts, locks, table statistics, buffer reads, and whether the query changed recently.

### How do you check active sessions?

```sql
SELECT pid, state, wait_event_type, wait_event, query
FROM pg_stat_activity
WHERE state <> 'idle';
```

### What is vacuum?

PostgreSQL uses MVCC, so old row versions remain until vacuum cleans them. Without vacuum, table bloat grows and performance suffers.

### What is WAL?

Write-Ahead Log. It records changes before data pages are flushed and is used for crash recovery, replication, and point-in-time recovery.

### What causes replication lag?

Heavy writes, slow replica I/O, long queries on replica, network issues, underprovisioned replica, or WAL replay bottleneck.

---

## Connection Pooling Questions

### Why do databases need connection pooling?

Database connections are expensive and finite. Too many app instances can exhaust database connections even when queries are simple.

### What is PgBouncer?

A lightweight PostgreSQL connection pooler. Transaction pooling is often useful for web workloads because server connections are returned after each transaction.

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

Kafka is a distributed event streaming platform. Producers write records to topics, and consumers read records from partitions.

### What is a partition?

A partition is an ordered shard of a topic. Ordering is guaranteed within a partition, not across the whole topic.

### What is a consumer group?

A group of consumers that share topic partitions. Each partition is consumed by one consumer in the group at a time.

### What is consumer lag?

The difference between latest produced offset and the consumer’s processed offset. Lag indicates how far behind consumers are.

### What does `acks=all` mean?

The producer waits for all required in-sync replicas before considering the write acknowledged. It improves durability but can increase latency.

---

## Scenario Questions

### Database CPU is high. What do you check?

Top queries, active sessions, query plans, index usage, recent deployments, connection count, lock waits, and whether traffic volume changed.

### Database connections are exhausted. What do you do?

Identify clients, check pool sizes, reduce application concurrency, add pooling, kill only clearly safe idle sessions if necessary, and fix the source of connection growth.

### A migration is blocking production traffic. What went wrong?

It likely took a lock or changed too much data at once. Use online migration patterns: additive schema, concurrent indexes, small backfills, and expand-contract rollout.

### A replica is behind. What can break?

Users may not see their recent writes, analytics may be stale, failover may lose data if async replication is used, and downstream systems may process old state.

---

## Staff-Level Questions

### How do you design a database platform for many teams?

Provide standard backup policies, restore drills, connection pooling, migration guidelines, monitoring dashboards, slow-query visibility, access control, and review processes for risky changes.

### What are unhealthy database signals?

Backups never restored, migrations done manually, replicas lag without alerting, app pools unbounded, no slow-query visibility, no ownership of schema, and no RPO/RTO agreement.

### What would you centralize?

Backup policy, restore testing, monitoring baselines, access standards, migration guardrails, connection pooling defaults, and incident runbooks.

### What would you delegate?

Schema ownership, query design, application-specific caching, and domain-specific data model decisions inside platform guardrails.
