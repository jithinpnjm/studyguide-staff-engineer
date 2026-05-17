---
title: "RDS, Aurora, And ElastiCache"
sidebar_position: 9
---

# RDS, Aurora, And ElastiCache

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

RDS exists to remove undifferentiated database infrastructure work, not database thinking. AWS can manage backups, patch windows, replication plumbing, monitoring hooks, and failover mechanics. You still own schema, queries, indexes, pooling, migrations, and application behavior during failover.

Aurora exists because AWS wanted a cloud-native relational database with distributed storage and faster replication/failover patterns than traditional single-node database storage. Aurora can scale reads with replicas and supports serverless modes, but it still requires relational design discipline.

ElastiCache exists because repeatedly hitting a database for hot reads, sessions, counters, or rate-limit checks creates avoidable latency and load. Redis/Memcached can absorb that, but a cache introduces consistency and failure questions. What happens if the cache is empty? What happens if the cache is wrong? What happens if Redis is down?

Failure modes:

- RDS failover succeeds but app connection pool stays broken
- read replica lag causes stale reads
- database CPU is high due to missing index, not instance size
- connection storm from Lambda or autoscaling app tier
- cache outage becomes full outage because app cannot fall back

Debugging method:

```text
Check RDS events, CPU, memory, storage, IOPS, latency, connections, locks, slow queries,
replica lag, failover timeline, and application retry/pool behavior.
```

AWS docs:

- RDS Multi-AZ: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html
