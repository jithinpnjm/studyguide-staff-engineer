---
title: "Hands-On Labs"
sidebar_position: 5
---

# Databases & Storage — Hands-On Labs

These labs build practical database debugging and design skill. Use a disposable local PostgreSQL container or non-production database.

---

## Lab 1: Create A Simple Relational Schema

**Goal:** Practice primary keys, foreign keys, and basic inserts.

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

INSERT INTO users(email) VALUES ('alice@example.com');
INSERT INTO orders(user_id, total, status) VALUES (1, 49.99, 'paid');
```

Query:

```sql
SELECT users.email, orders.total, orders.status
FROM users
JOIN orders ON users.id = orders.user_id;
```

Review questions:

- What prevents an order from referencing a missing user?
- What prevents duplicate user emails?
- Which column is the entity identity?

---

## Lab 2: Compare JOIN Types

**Goal:** Understand how join choice affects returned rows.

```sql
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE invoices (
  id INT PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  amount NUMERIC(10,2) NOT NULL
);

INSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob');
INSERT INTO invoices VALUES (101, 1, 100.00);
```

INNER JOIN:

```sql
SELECT customers.name, invoices.amount
FROM customers
INNER JOIN invoices ON customers.id = invoices.customer_id;
```

LEFT JOIN:

```sql
SELECT customers.name, invoices.amount
FROM customers
LEFT JOIN invoices ON customers.id = invoices.customer_id;
```

Expected result: Bob appears only in the LEFT JOIN result.

---

## Lab 3: Read A Query Plan

**Goal:** Use `EXPLAIN ANALYZE` to understand query execution and observe index impact.

Create sample data:

```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO events(user_id, event_type, created_at)
SELECT
  (random() * 1000)::int,
  'click',
  now() - (random() * interval '30 days')
FROM generate_series(1, 100000);
```

Run without index:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM events
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

Note: execution time, node type (Seq Scan), buffer reads.

Add index:

```sql
CREATE INDEX idx_events_user_created
ON events(user_id, created_at DESC);
```

Run the plan again and compare:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM events
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

Observe execution time, scan type (Index Scan), and buffers. The difference between a sequential scan and an index scan on 100,000 rows demonstrates the O(n) vs O(log n) behavior.

---

## Lab 4: Transaction And Locking

**Goal:** Understand row locking with two database sessions.

Session A:

```sql
BEGIN;
SELECT * FROM orders WHERE id = 1 FOR UPDATE;
```

Session B:

```sql
BEGIN;
UPDATE orders SET status = 'refunded' WHERE id = 1;
```

Session B waits because Session A holds the row lock.

Session A:

```sql
COMMIT;
```

Session B can now proceed.

Review questions:

- Which session blocked which?
- Why is row locking useful for inventory or payment workflows?
- What happens if Session A stays open too long?

---

## Lab 5: Find Active Sessions

**Goal:** Inspect database activity during incidents.

```sql
SELECT
  pid,
  state,
  wait_event_type,
  wait_event,
  now() - query_start AS query_age,
  query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY query_age DESC;
```

Find long-running queries:

```sql
SELECT pid, now() - query_start AS age, state, left(query, 100) AS query_snippet
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY age DESC;
```

Find waiting sessions:

```sql
SELECT pid, wait_event_type, wait_event, now() - query_start AS age, query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
ORDER BY age DESC;
```

Use this during incidents to identify long-running queries, waiting sessions, open transactions, and query patterns that changed recently.

Operational rule: understand a session before terminating it.

---

## Lab 6: Connection Pool Sizing Exercise

**Goal:** Reason about connection explosion.

Scenario:

```text
80 application pods
15 database connections per pod
PostgreSQL max_connections = 500
```

Calculate:

```text
80 x 15 = 1200 possible app connections
```

This exceeds database capacity.

Design a safer target:

```text
PgBouncer default_pool_size = 25 per app/database/user pair
app pool size = 3 to 5 per pod
staggered rollout during deploys
alerts on connection usage
```

Review questions:

- What happens during autoscaling?
- What happens during database failover?
- What happens if the cache disappears?

---

## Lab 7: Backup And Restore Drill Plan

**Goal:** Design a restore test, not only a backup setting.

Template:

```text
Source database:
Backup timestamp:
Restore target:
Expected RPO:
Expected RTO:
Validation queries:
Application connection test:
Access validation:
Monitoring validation:
Actual restore duration:
Issues found:
```

Example validation queries:

```sql
SELECT count(*) FROM users;
SELECT count(*) FROM orders;
SELECT max(created_at) FROM orders;
```

SRE lesson: a restore drill is the only proof that backup policy works.

---

## Lab 8: Kafka Topic Design Exercise

**Goal:** Understand partitions, keys, and ordering.

Scenario:

```text
Event: order_status_changed
Ordering requirement: all events for one order must be ordered
Scale requirement: many orders processed in parallel
```

Design:

```text
topic: order_status_changed
key: order_id
partitions: enough for target parallelism
replication_factor: 3
min.insync.replicas: 2
producer acks: all
```

Create the topic:

```bash
kafka-topics.sh --bootstrap-server kafka:9092 \
  --create \
  --topic order-status-changed \
  --partitions 12 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config min.insync.replicas=2
```

Check the topic:

```bash
kafka-topics.sh --bootstrap-server kafka:9092 \
  --describe --topic order-status-changed
```

Review questions:

- Why key by order ID?
- What ordering is guaranteed?
- What happens if partitions are too few?
- What happens if consumers fall behind?

---

## Lab 9: Kafka Consumer Group Lag

**Goal:** Observe and interpret consumer lag.

Check consumer group state:

```bash
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe \
  --group order-processor
```

Expected output format:

```text
TOPIC                  PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
order-status-changed   0          1000010         1000050         40
order-status-changed   1          999800          1000000         200
order-status-changed   2          1000200         1000200         0

Total lag: 240 unprocessed messages
```

List all consumer groups:

```bash
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --list
```

Reset consumer offset to earliest (for replay):

```bash
kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --group order-processor \
  --topic order-status-changed \
  --reset-offsets \
  --to-earliest \
  --execute
```

Review questions:

- Which partition has the most lag?
- What does zero lag on partition 2 tell you?
- When should you reset offsets vs scale out consumers?

---

## Lab 10: PostgreSQL Autovacuum And Dead Tuples

**Goal:** Observe MVCC dead tuple accumulation and autovacuum behavior.

Create a table and generate dead tuples:

```sql
CREATE TABLE test_vacuum (
    id BIGSERIAL PRIMARY KEY,
    val INT NOT NULL
);

-- Insert 100,000 rows
INSERT INTO test_vacuum(val)
SELECT i FROM generate_series(1, 100000) i;

-- Update all rows (creates 100,000 dead tuples)
UPDATE test_vacuum SET val = val + 1;

-- Check dead tuples
SELECT
    relname,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE relname = 'test_vacuum';
```

Run manual vacuum and check again:

```sql
VACUUM test_vacuum;

SELECT
    relname,
    n_live_tup,
    n_dead_tup,
    last_vacuum
FROM pg_stat_user_tables
WHERE relname = 'test_vacuum';
```

Check table size before and after:

```sql
SELECT pg_size_pretty(pg_total_relation_size('test_vacuum'));
```

Tune autovacuum for the table:

```sql
ALTER TABLE test_vacuum SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 100
);
```

Review questions:

- Why did dead tuple count jump after the UPDATE?
- How does autovacuum threshold control trigger frequency?
- What happens if you never vacuum a heavily updated table?

---

## Lab 11: Replication Lag Monitoring

**Goal:** Query replication state on primary and standby.

On the primary:

```sql
-- Full replication state
SELECT
    application_name,
    state,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn
FROM pg_stat_replication;
```

On the standby:

```sql
-- Simple lag measurement
SELECT
    NOW() - pg_last_xact_replay_timestamp() AS replication_lag;

-- Check if replica is in recovery
SELECT pg_is_in_recovery();
```

Review questions:

- Which of write_lag, flush_lag, replay_lag is visible to a user reading from the standby?
- What causes replay_lag to grow even when write_lag is low?
- When should you alert on replication lag?

---

## Lab 12: Cache Failure Design Drill

**Goal:** Avoid database collapse when cache is unavailable.

Scenario:

```text
Redis cache stores product catalog responses.
Redis becomes unavailable.
All requests fall back to database.
```

Design defenses:

- Timeouts
- Circuit breaker
- Request coalescing
- Rate limiting
- Stale cache serving where acceptable
- Database query budget
- Cache warmup after recovery

Review question: can the database survive full cache miss traffic?

---

## Lab 13: Database Incident Note

**Goal:** Practice SRE-quality incident writing.

Template:

```text
Symptom:
User impact:
Started at:
Recent change:
Database signals:
- CPU:
- Connections:
- Locks:
- Replication lag:
- Slow queries:
- Storage:
- Dead tuples / vacuum state:
- Kafka consumer lag (if applicable):
Mitigation:
Recovery evidence:
Remaining risk:
Follow-up:
```

Use this template after any database lab or real incident review.
