---
title: "Database Choices"
sidebar_position: 18
---

# Database Choices

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF database summary is important because interviewers ask "which database would you choose?" The senior answer starts with access patterns and operational requirements.

Use RDS/Aurora for relational consistency, SQL, joins, transactions, and existing relational apps. Use DynamoDB for high-scale key-value/document access when queries are known upfront. Use ElastiCache for low-latency temporary data and hot reads. Use S3 for objects and data lake storage. Use DocumentDB for MongoDB-compatible document workloads with AWS constraints. Use Neptune for graph relationships. Use Timestream for time-series data. Use Keyspaces for Cassandra-compatible workloads.

Senior framing:

```text
I choose databases by access pattern, consistency, latency, scale, operational model,
backup/restore, multi-Region needs, and team skill. I do not choose based only on
service popularity.
```

---

## Database Decision Table

| Database | Model | Best For | Avoid When |
|---|---|---|---|
| RDS (PostgreSQL, MySQL) | Relational SQL | Transactions, joins, existing SQL apps | Unpredictable massive scale; NoSQL access patterns |
| Aurora (MySQL/PG compatible) | Relational, cloud-native | Better HA/failover than RDS, managed read scaling | Budget-constrained small workloads (Aurora costs more) |
| DynamoDB | NoSQL key-value/document | High-scale, low-latency, known access patterns, serverless | Complex queries, ad hoc analytics, relational joins |
| ElastiCache (Redis) | In-memory cache | Session store, hot reads, rate limiting, pub/sub | Durable storage; not a primary database |
| OpenSearch | Search + analytics | Full-text search, log analytics, faceted search | Primary transactional database |
| Redshift | Columnar data warehouse | BI/analytics queries, petabyte-scale structured data | OLTP workloads, real-time transactional access |
| DocumentDB | MongoDB-compatible document | MongoDB workloads requiring AWS managed infra | Standard MongoDB API compatibility (not 100%) |
| Neptune | Graph | Relationships: fraud, social networks, knowledge graphs | Non-graph access patterns |
| Timestream | Time series | IoT metrics, operational metrics, time-based queries | General-purpose key-value or relational |
| Keyspaces | Cassandra-compatible | Existing Cassandra workloads on managed infra | Greenfield when DynamoDB fits |

## DynamoDB Design Principles

DynamoDB requires designing queries first, tables second. Unlike relational DBs, you cannot add arbitrary indexes or query patterns cheaply after the fact.

| Concept | Meaning |
|---|---|
| Partition key | Determines which shard the item lives on; must be distributed |
| Sort key | Enables range queries within a partition |
| GSI (Global Secondary Index) | Alternate access pattern; separate partition + sort key |
| LSI (Local Secondary Index) | Alternate sort key for the same partition key |
| On-demand capacity | Scales automatically; good for unpredictable traffic |
| Provisioned capacity | Set RCU/WCU; use with autoscaling for predictable workloads |
| TTL | Automatically delete expired items |
| Streams | Change event feed for DynamoDB changes |
| Global Tables | Multi-Region replication; active-active |

**Common DynamoDB mistake:** designing a table schema without knowing access patterns, then discovering you cannot query it efficiently. Design the queries first, then derive the table structure.

**Hot partition problem:** if many requests use the same partition key (e.g., all orders for top user), one shard gets all the traffic. Distribute partition keys: use user ID + timestamp, shard suffix, or composite keys.

## Choosing Between RDS and DynamoDB

```text
Use RDS/Aurora when:
  - You need SQL, transactions (ACID), joins, foreign keys
  - Data model is relational and evolves via schema migrations
  - Team has strong SQL expertise
  - Compliance requires relational audit trails

Use DynamoDB when:
  - Access patterns are key-based reads/writes
  - You need single-digit millisecond latency at any scale
  - Traffic is highly variable (scale-to-zero possible)
  - Global distribution via Global Tables is needed
  - Serverless architecture (no connection pooling issues)
```

## CLI: DynamoDB Quick Operations

```bash
# Get an item
aws dynamodb get-item \
  --table-name Orders \
  --key '{"orderId": {"S": "order-123"}}'

# Put an item
aws dynamodb put-item \
  --table-name Orders \
  --item '{"orderId": {"S": "order-456"}, "status": {"S": "pending"}, "ttl": {"N": "1735689600"}}'

# Query items by partition key (and optional sort key range)
aws dynamodb query \
  --table-name Orders \
  --key-condition-expression "userId = :uid AND createdAt > :ts" \
  --expression-attribute-values '{":uid": {"S": "user-123"}, ":ts": {"N": "1700000000"}}'

# Scan table (use sparingly — expensive for large tables)
aws dynamodb scan \
  --table-name Orders \
  --filter-expression "status = :s" \
  --expression-attribute-values '{":s": {"S": "pending"}}'
```

## Interview Q&A

**Q: When would you choose DynamoDB over RDS?**
A: DynamoDB when you know your access patterns upfront, need single-digit millisecond latency at any scale, have highly variable or unpredictable traffic, or are building serverless architectures where connection pooling to RDS would be problematic. RDS when you need SQL, complex queries with joins, ACID transactions across multiple tables, or when the data model is inherently relational with evolving schema.

**Q: What is the hot partition problem in DynamoDB and how do you fix it?**
A: If many requests hit items with the same partition key, DynamoDB routes them all to the same underlying shard, creating a bottleneck even if the table has high provisioned capacity. Fix by: 1) designing partition keys with high cardinality (user ID, UUID, not status), 2) using a write sharding pattern (append a random suffix to the partition key and aggregate on reads), 3) using DAX (DynamoDB Accelerator) for a read cache.

**Q: What is the difference between a GSI and an LSI in DynamoDB?**
A: A Local Secondary Index (LSI) uses the same partition key as the base table but an alternate sort key. It must be created at table creation time. A Global Secondary Index (GSI) can use completely different partition and sort keys, can be created at any time, and has its own separate read/write capacity. GSIs are more flexible but cost extra capacity.
