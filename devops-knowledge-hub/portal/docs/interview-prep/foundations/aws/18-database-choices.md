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
