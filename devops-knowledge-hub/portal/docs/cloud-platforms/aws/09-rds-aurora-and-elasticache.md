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

---

## RDS Key Concepts

| Concept | What AWS Manages | What You Still Own |
|---|---|---|
| Multi-AZ DB Instance | standby failover, DNS endpoint switch | app retry behavior, connection pool recovery |
| Multi-AZ DB Cluster | writer + readable standbys in separate AZs | query routing to correct endpoint |
| Read Replica | async replication, promotion | replica lag tolerance, read routing logic |
| Automated Backups | daily snapshot + transaction logs | retention period choice, restore testing |
| Parameter Group | OS-level and engine config tuning | choosing appropriate values for workload |
| RDS Proxy | connection pooling, failover endpoint | pool sizing, auth config (Secrets Manager) |

## Multi-AZ vs Read Replica: Decision Rule

| Need | Correct Feature |
|---|---|
| Survive AZ failure with minimal downtime | Multi-AZ (failover ~60 seconds, DNS switches automatically) |
| Scale reads for reporting/analytics | Read Replica |
| Protect primary DB from reporting queries | Read Replica or separate read replica endpoint |
| Zero-data-loss failover guarantee | Multi-AZ DB Cluster (some engines) — replicas are synchronous-ish |
| Cross-Region DR with reads | Cross-Region Read Replica |

**Multi-AZ is HA, not read scaling.** The standby does not serve traffic until failover.

## Aurora Specifics

Aurora separates compute from distributed storage. Storage is automatically replicated 6 ways across 3 AZs.

| Feature | Benefit |
|---|---|
| Aurora Replicas | up to 15 read replicas, can auto-promote on failure |
| Custom Endpoints | route different workloads to different replica sets |
| Aurora Serverless v2 | auto-scale compute capacity in fractions of an ACU |
| Global Database | cross-Region with <1 second replication lag for reads |
| Fast Failover | typically <30 seconds vs ~60 for standard RDS Multi-AZ |

Use Aurora when: you want managed relational with better cloud-native scaling, read-heavy traffic, and automated storage growth.

## ElastiCache Cache Patterns

| Pattern | How It Works | Risk |
|---|---|---|
| Lazy loading | Read from cache; on miss, read DB and write cache | Stale data until TTL expiry; cold start penalty |
| Write-through | Write to DB and cache together on every write | Double write cost; cache may grow large |
| TTL-based eviction | Set expiry on cache entries | Data staleness up to TTL; choose TTL carefully |
| Session store | Store user sessions in Redis vs app memory | Session loss if Redis is unavailable without graceful fallback |

**Redis vs Memcached decision:**
- Redis: persistence, replication, pub/sub, sorted sets, TTL, cluster mode → most production use cases
- Memcached: simplest possible ephemeral cache, multi-threaded → when Redis features are not needed

## CLI: Common Operations

```bash
# List RDS instances
aws rds describe-db-instances \
  --query "DBInstances[*].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine,AZ:AvailabilityZone}"

# Check recent RDS events (useful during incidents)
aws rds describe-events \
  --source-identifier my-db \
  --source-type db-instance \
  --duration 60

# Manually trigger RDS failover (for testing)
aws rds reboot-db-instance \
  --db-instance-identifier my-db \
  --force-failover

# Describe ElastiCache clusters
aws elasticache describe-cache-clusters --show-cache-node-info

# Create RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier my-db \
  --db-snapshot-identifier my-db-snapshot-$(date +%Y%m%d)
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| Errors persist after RDS failover | App connection pool holds stale connections | Configure pool with `testOnBorrow`, short `connectionTimeout`, reconnect after failover |
| Connection storm after Lambda scale-out | Lambda creates DB connection per invocation | Add RDS Proxy to pool and reuse connections |
| High DB CPU despite adding read replicas | Writes are the bottleneck, not reads | Scale instance vertically or shard writes; replicas only help reads |
| Slow queries after schema migration | Missing index, statistics stale | Run `EXPLAIN ANALYZE`, add index, run `ANALYZE` |
| Cache outage causes full service outage | App code has no DB fallback on cache miss | Wrap cache calls with try/except; fall back to DB if Redis unavailable |
| Replica lag rising | Heavy write load or long-running transactions | Reduce write contention, monitor `ReplicaLag` metric, consider Aurora |

## Interview Q&A

**Q: What is the difference between RDS Multi-AZ and a Read Replica?**
A: Multi-AZ has a synchronous standby for automatic failover — it improves availability but the standby does not serve reads. A Read Replica is an asynchronous copy that serves reads and can also be promoted to a standalone DB, but replica lag means it is not a zero-data-loss failover mechanism.

**Q: An application keeps throwing connection errors 30 seconds after an RDS failover completes. Why?**
A: The application connection pool is likely holding stale connections to the old primary IP. RDS switches the DNS endpoint, but if the pool does not close and reconnect, old connections go to a dead host. Fix by configuring the pool with reconnect-on-failure settings and testing failover behavior explicitly.

**Q: When would you use RDS Proxy?**
A: When a bursty workload (Lambda, auto-scaling app tier) creates many short-lived DB connections and risks exhausting the max_connections limit. RDS Proxy pools and reuses connections, reducing connection overhead and improving failover handling by maintaining a pool while the DB recovers.
