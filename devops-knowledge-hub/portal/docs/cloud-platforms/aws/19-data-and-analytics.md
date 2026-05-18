---
title: "Data And Analytics"
sidebar_position: 19
---

# Data And Analytics

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Athena queries S3 directly and is excellent for ad hoc analysis over logs/data lakes. Redshift is a data warehouse for structured analytics. OpenSearch supports search and log analytics. EMR runs big data frameworks such as Spark. Glue provides ETL and cataloging. Lake Formation centralizes data lake governance. MSK provides managed Kafka. Kinesis provides AWS-native streaming.

Operational teaching point: analytics systems can quietly become production dependencies. If fraud detection, dashboards, search, or alert enrichment depends on these pipelines, then ingestion lag, schema drift, partition mistakes, and retention failures become reliability incidents.

---

## Service Quick Reference

| Service | Purpose | Best For |
|---|---|---|
| Athena | SQL queries directly on S3 | Ad hoc log analysis, data lake exploration, one-off queries |
| Redshift | Data warehouse | Large-scale structured BI analytics, petabyte-scale |
| OpenSearch Service | Search + log analytics | Full-text search, Kibana dashboards, log aggregation |
| EMR | Managed Spark/Hadoop/Hive | Big data batch processing, ML feature engineering |
| Glue | Serverless ETL + Data Catalog | ETL jobs, schema catalog, data lake management |
| Lake Formation | Data lake governance | Access control for data lake, column/row-level security |
| Kinesis Data Streams | Real-time stream | Ordered event streaming, real-time analytics |
| Kinesis Firehose | Managed delivery | Load streams into S3/Redshift/OpenSearch without consumer code |
| MSK (Managed Kafka) | Kafka-compatible streams | Existing Kafka workloads; Kafka ecosystem integration |
| QuickSight | BI dashboards | Business intelligence on top of Redshift/Athena/RDS |

## Athena: Best Practices

Athena bills by data scanned. Poor data organization = slow + expensive queries.

```text
Performance habits:
  1. Use columnar formats: Parquet or ORC (not CSV or JSON)
  2. Compress data: Snappy or GZIP
  3. Partition data: partition by date/region (s3://bucket/logs/year=2024/month=01/)
  4. Use partition pruning: WHERE clause matches partition columns
  5. Avoid SELECT *: project only needed columns

Cost reduction example:
  CSV 1 TB table scanned = $5.00
  Same data in Parquet + partitioned = scan 20 GB = $0.10
```

## Kinesis Data Streams vs Firehose vs MSK

| Need | Service |
|---|---|
| Real-time processing with custom consumer code | Kinesis Data Streams |
| Deliver stream to S3/Redshift/OpenSearch without writing consumer | Kinesis Firehose |
| Kafka-compatible protocol; existing Kafka consumers | MSK |
| AWS-native; simple setup; no Kafka expertise needed | Kinesis Data Streams |
| Long message retention (days); replay; Kafka ecosystem | MSK |

**Kinesis Data Streams:** ordering per shard, 1 MB/s write per shard, up to 365-day retention. Consumer checkpoints manage read position.

**Kinesis Firehose:** fully managed delivery with buffering, compression, and transformation. No consumer code needed. Latency is 60–900 seconds (buffered delivery, not real-time row-level).

## Data Lake Architecture Pattern

```text
Ingest:
  S3 (raw zone / landing) <- Kinesis Firehose / DataSync / DMS / custom producers

Catalog:
  AWS Glue Data Catalog (schema registry for S3 data)
  Glue Crawlers (auto-discover schema from S3)

Transform:
  Glue ETL jobs (Spark-based, serverless)
  EMR (heavy transformation)

Serve:
  Athena (ad hoc SQL queries)
  Redshift Spectrum (query S3 from Redshift)
  QuickSight (dashboards)

Access Control:
  Lake Formation (table/column/row permissions on top of Glue Catalog)
```

## Failure Modes in Analytics Systems

| Failure | Root Cause | Fix |
|---|---|---|
| Athena queries scan too much data | No partitioning; CSV format; no pruning | Add partitions; convert to Parquet; add partition pruning conditions |
| Firehose delivery lag | Buffer window not tuned; destination throttled | Tune buffer size/interval; check destination capacity |
| Kinesis consumer falling behind | Shard count too low; consumer slow | Scale shards; optimize consumer; use enhanced fan-out for parallel consumers |
| Glue crawler schema mismatch | Source schema changed without notice | Version schemas; use schema registry; alert on crawler failures |
| OpenSearch shard imbalance | Too many small shards or few large shards | Plan shard count at index design time (target 20–40 GB per shard) |
| Analytics query affects production DB | Reporting runs against primary RDS | Use read replicas or a separate analytics DB for reporting |

## Interview Q&A

**Q: Why is Parquet preferred over CSV for data in S3 when querying with Athena?**
A: Parquet is columnar storage — queries that access only a subset of columns read only those columns from disk. Athena bills per data scanned. A CSV file stores all columns in rows, so even a single-column query reads every column. Parquet with compression and partitioning can reduce costs 10–100x for typical analytics workloads.

**Q: What is the difference between Kinesis Data Streams and Kinesis Firehose?**
A: Data Streams is a real-time streaming service where you write consumer code to process records as they arrive. You manage checkpoints, shard count, and consumer scaling. Firehose is a fully managed delivery service that buffers data and loads it into destinations (S3, Redshift, OpenSearch) without writing consumer code. Firehose has 60-second or larger minimum latency (buffered), while Data Streams can deliver records in milliseconds.

**Q: When would you use MSK (Managed Kafka) instead of Kinesis?**
A: MSK when: you have existing Kafka consumers or producers you cannot change, you need Kafka-specific features (topic compaction, consumer groups with standard protocol, Kafka Streams), you need very long retention with low cost, or your organization has Kafka expertise. Kinesis when: you want AWS-native integration with less operational overhead and do not need Kafka API compatibility.
