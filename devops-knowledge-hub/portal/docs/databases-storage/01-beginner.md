---
title: "Beginner"
sidebar_position: 1
---

# Databases & Storage — Beginner

Databases are where application correctness becomes permanent. A bad deploy can often be rolled back, but corrupted or lost data can be extremely difficult to recover. For SREs, databases are reliability-critical systems with strict correctness, performance, backup, replication, and recovery requirements.

Beginner mental model:

```text
application -> connection pool -> database engine -> memory/cache -> storage -> replication/backups
```

---

## Why This Domain Matters

| Concern | Production meaning |
|---|---|
| Correctness | Orders, accounts, identities, and audit records must stay accurate |
| Performance | One bad query can saturate CPU, I/O, locks, or connections |
| Reliability | Replication and failover determine outage behavior |
| Recovery | Backups and restore workflows determine RPO and RTO |
| Scale | Indexes, pooling, replicas, caching, and partitioning define growth limits |

SREs do not need to be full-time DBAs, but they must understand the failure modes well enough to debug incidents and challenge unsafe designs.

---

## Relational Database Basics

A relational database stores data in tables with rows and columns.

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

Core terms:

| Term | Meaning |
|---|---|
| Table | Collection of rows with a schema |
| Row | One record |
| Column | One field on the record |
| Primary key | Unique row identifier |
| Foreign key | Relationship to another table |
| Index | Data structure that speeds lookups |
| Transaction | Unit of work that commits or rolls back together |

---

## SQL Basics

Read data:

```sql
SELECT id, email, created_at
FROM users
WHERE email = 'user@example.com';
```

Pattern matching (ILIKE is case-insensitive in PostgreSQL):

```sql
SELECT * FROM users WHERE email ILIKE '%@example.com';
```

NULL handling — always use IS NULL, never `= NULL`:

```sql
SELECT * FROM orders WHERE completed_at IS NULL;
```

IN clause and ranges:

```sql
SELECT * FROM products WHERE category_id IN (1, 5, 9);

SELECT * FROM events
WHERE occurred_at BETWEEN '2024-01-01' AND '2024-01-31';
```

Add data:

```sql
INSERT INTO users (email)
VALUES ('user@example.com');
```

Change data:

```sql
UPDATE orders
SET status = 'paid'
WHERE id = 1001;
```

SRE habit: in production, inspect the target rows first, then run the change inside an approved process.

---

## Joins

Joins combine data from multiple tables.

```sql
SELECT orders.id, users.email, orders.total
FROM orders
INNER JOIN users ON orders.user_id = users.id;
```

Common joins:

| Join | Meaning |
|---|---|
| INNER JOIN | Only matching rows from both tables |
| LEFT JOIN | All rows from left table plus matches from right |
| FULL JOIN | All rows from both sides |

Example LEFT JOIN — all users including those without orders:

```sql
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;
```

Performance note: joining two large tables without indexes on the join columns causes a full table scan or a hash join with huge memory usage. Always ensure join columns are indexed.

---

## WHERE vs HAVING

`WHERE` filters rows before grouping.

```sql
SELECT region, SUM(total)
FROM orders
WHERE status = 'paid'
GROUP BY region;
```

`HAVING` filters groups after aggregation.

```sql
SELECT region, SUM(total) AS revenue
FROM orders
GROUP BY region
HAVING SUM(total) > 100000;
```

---

## Aggregation

```sql
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
```

`HAVING` to filter aggregated groups:

```sql
SELECT user_id, COUNT(*) as order_count
FROM orders
GROUP BY user_id
HAVING COUNT(*) > 10;
```

---

## UNION vs UNION ALL

`UNION` removes duplicates.

```sql
SELECT email FROM customers_us
UNION
SELECT email FROM customers_eu;
```

`UNION ALL` keeps duplicates and is usually faster.

```sql
SELECT email FROM customers_us
UNION ALL
SELECT email FROM customers_eu;
```

Use `UNION ALL` unless deduplication is required.

---

## ACID Transactions

ACID describes correctness guarantees.

| Property | Meaning |
|---|---|
| Atomicity | All operations commit together or roll back together |
| Consistency | Constraints keep the database valid |
| Isolation | Concurrent transactions do not corrupt each other |
| Durability | Committed data survives crashes |

Example transaction shape:

```sql
BEGIN;
UPDATE inventory SET reserved = reserved + 1 WHERE product_id = 42;
INSERT INTO reservations(product_id, user_id) VALUES (42, 1001);
COMMIT;
```

If one operation fails, the transaction should roll back as one unit.

---

## Index Basics

An index helps the database find rows without scanning the whole table. PostgreSQL's default index is a B-tree (balanced tree). It stores column values in sorted order with pointers to the actual rows.

```text
Query: SELECT * FROM orders WHERE user_id = 123

Without index on user_id:
    → Sequential scan: read every row, check if user_id == 123
    → O(n) — scales with table size

With index on user_id:
    → Index lookup: B-tree traversal to find rows with user_id == 123
    → O(log n) — scales logarithmically
```

Create an index:

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
```

Good match for this index:

```sql
SELECT *
FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 10;
```

Indexes speed reads but add write overhead and storage cost. Do not add indexes blindly.

### When indexes do not help (or hurt)

- **Table too small:** For small tables (< 1,000 rows), PostgreSQL may choose sequential scan — seq scan is faster for small tables.
- **Low selectivity:** Indexing a boolean column where 90% of rows are `true` has poor selectivity. The planner may skip the index.
- **Function wrapping prevents index use:** `WHERE LOWER(email) = 'alice@example.com'` does not use an index on `email`. Use a functional index instead.
- **Index bloat:** After heavy writes, deleted/updated rows leave dead tuples in the index. `VACUUM` or `REINDEX` is needed.

---

## EXPLAIN Basics

Use `EXPLAIN` to see how the database plans a query.

```sql
EXPLAIN
SELECT * FROM orders WHERE user_id = 123;
```

Use `EXPLAIN ANALYZE` to measure actual execution.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 123;
```

Key things to read in the output:

| Signal | Meaning |
|---|---|
| `Seq Scan` on large table | Missing or unusable index |
| `Index Scan` | Index is being used |
| `actual time` | How long each node took |
| `rows` estimate vs actual | Large discrepancy means stale statistics — run `ANALYZE` |
| `loops` | How many times a node was executed |

Look for sequential scans on large tables, bad join order, missing indexes, high row counts, and high buffer reads.

---

## Backups And Restore

A backup is only useful if restore works.

| Term | Meaning |
|---|---|
| RPO | How much data loss is acceptable |
| RTO | How long recovery may take |
| Snapshot | Point-in-time copy |
| WAL/binlog | Log used to replay changes |
| PITR | Point-in-time recovery |

SRE rule: "backup exists" is not enough. Restore must be tested.

---

## Kafka Basics

Kafka is a distributed event streaming platform — a fault-tolerant, high-throughput log that producers write to and consumers read from.

Unlike traditional message queues (RabbitMQ, SQS), Kafka retains messages for a configurable period regardless of whether they have been consumed. Multiple independent consumer groups can read the same topic at their own pace.

Core terms:

| Term | Meaning |
|---|---|
| Topic | Named stream of records |
| Partition | Ordered shard of a topic |
| Producer | Writes records |
| Consumer | Reads records |
| Consumer group | Set of consumers sharing partitions |
| Broker | Kafka server |
| Replication factor | Number of copies |
| ISR | In-sync replicas |
| Offset | Consumer position in a partition |

Mental model:

```text
Producers → [ Topic: orders (3 partitions) ] → Consumer Group A
                                               → Consumer Group B
                                               → Consumer Group C

Each group reads independently at its own offset.
All groups see all messages.
```

Ordering is guaranteed within a partition, not across all partitions.

---

## Storage Basics

| Type | Example | Use case |
|---|---|---|
| Block storage | EBS, Persistent Disk | VM disks, database volumes |
| Object storage | S3, GCS, Blob | Backups, logs, static assets, data lake |
| File storage | EFS, Filestore, Azure Files | Shared filesystem |
| Local ephemeral | Instance store, node disk | Temporary high-speed data |

Databases usually need predictable latency and durability, so storage choice matters.

---

## Database Choices at a Glance

The senior answer to "which database would you choose?" starts with access patterns and operational requirements.

| Database | Best for |
|---|---|
| PostgreSQL / RDS / Aurora | Relational consistency, SQL, joins, transactions |
| DynamoDB | High-scale key-value/document access when queries are known upfront |
| ElastiCache (Redis) | Low-latency temporary data and hot reads |
| S3 | Objects and data lake storage |
| DocumentDB | MongoDB-compatible document workloads |
| Neptune | Graph relationships |
| Timestream | Time-series data |
| Keyspaces | Cassandra-compatible workloads |

```text
I choose databases by access pattern, consistency, latency, scale, operational model,
backup/restore, multi-Region needs, and team skill. I do not choose based only on
service popularity.
```

---

## Beginner Takeaways

1. Databases are correctness-critical.
2. SQL joins connect related tables.
3. Transactions protect multi-step changes.
4. Indexes speed reads but cost writes and storage; B-tree gives O(log n) lookups.
5. `EXPLAIN ANALYZE` is essential for query debugging.
6. Backups are not real until restore is tested.
7. RPO and RTO define recovery design.
8. Storage latency can become application latency.
9. Kafka retains messages so multiple consumer groups can read independently.
10. Choose databases by access pattern, not popularity.
