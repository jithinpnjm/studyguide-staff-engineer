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

Example LEFT JOIN:

```sql
SELECT users.email, orders.id
FROM users
LEFT JOIN orders ON users.id = orders.user_id;
```

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

An index helps the database find rows without scanning the whole table.

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
```

Good match:

```sql
SELECT *
FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 10;
```

Indexes speed reads but add write overhead and storage cost. Do not add indexes blindly.

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

SRE rule: “backup exists” is not enough. Restore must be tested.

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

## Beginner Takeaways

1. Databases are correctness-critical.
2. SQL joins connect related tables.
3. Transactions protect multi-step changes.
4. Indexes speed reads but cost writes and storage.
5. `EXPLAIN ANALYZE` is essential for query debugging.
6. Backups are not real until restore is tested.
7. RPO and RTO define recovery design.
8. Storage latency can become application latency.
