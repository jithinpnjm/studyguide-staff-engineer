---
title: "Disaster Recovery And Migrations"
sidebar_position: 25
---

# Disaster Recovery And Migrations

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF covers RPO/RTO, backup/restore, pilot light, warm standby, active-active, Elastic Disaster Recovery, DMS, SCT, AWS Backup, MGN, Application Discovery, VMware Cloud, and large data transfer.

DR starts with business requirements. RPO is acceptable data loss. RTO is acceptable downtime. Backup/restore is cheaper but slower. Pilot light keeps core pieces ready. Warm standby runs a scaled-down environment. Multi-site active-active is fastest and most expensive.

The operational truth: a backup that has never been restored is only a hope. A DR design that has never been exercised is a diagram, not a capability.

---

## RPO and RTO: Design Targets

| Term | Definition | How to Reduce |
|---|---|---|
| RPO (Recovery Point Objective) | Maximum acceptable data loss (time) | More frequent backups; synchronous replication; multi-Region writes |
| RTO (Recovery Time Objective) | Maximum acceptable downtime | Faster failover (warm standby vs restore); automation; pre-provisioned capacity |

```text
Example targets:
  Critical financial system:  RPO 0 seconds, RTO 5 minutes  -> active-active multi-Region
  Internal tooling:           RPO 24 hours, RTO 8 hours     -> backup/restore
  E-commerce platform:        RPO 1 minute, RTO 30 minutes  -> warm standby
```

## DR Strategies Comparison

| Strategy | Description | RPO | RTO | Cost |
|---|---|---|---|---|
| Backup and Restore | Regular backups to S3; restore on failure | Hours | Hours | Lowest |
| Pilot Light | Core infra (DB, data) running in DR Region at minimum scale | Minutes | 10s of minutes | Low |
| Warm Standby | Scaled-down but running replica in DR Region; scale up on failover | Seconds-minutes | Minutes | Medium |
| Multi-Site Active-Active | Full production capacity in 2+ Regions, serving real traffic | Near-zero | Near-zero | Highest |

## DR Failover Patterns

### RDS Failover
```text
RDS Multi-AZ (same Region):
  Primary -> Standby failover: ~60 seconds
  DNS endpoint switches automatically
  App must reconnect (check connection pool settings)

Aurora Global Database (cross-Region):
  Primary Region -> Secondary Region promotion
  RPO typically <1 second (replication lag)
  RTO: 1-3 minutes (managed failover)
  Requires application DNS update to point to new Region
```

### Route 53 DNS Failover
```text
Primary record: ALB in us-east-1 (health check attached)
Secondary record: ALB in eu-west-1 (failover type)

Health check fails primary:
  -> Route 53 removes primary record from responses
  -> DNS TTL determines how quickly clients switch (keep TTL low: 60s)
  -> Secondary becomes authoritative answer
```

## AWS Backup

AWS Backup centralizes backup policies across RDS, DynamoDB, EBS, EFS, FSx, S3, and more.

```bash
# Create a backup plan
aws backup create-backup-plan \
  --backup-plan '{
    "BackupPlanName": "daily-backup",
    "Rules": [{
      "RuleName": "daily",
      "TargetBackupVaultName": "Default",
      "ScheduleExpression": "cron(0 2 * * ? *)",
      "DeleteAfterDays": 30,
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 180
    }]
  }'

# List backup jobs
aws backup list-backup-jobs --by-state COMPLETED

# Restore an RDS DB from backup
aws backup start-restore-job \
  --recovery-point-arn arn:aws:backup:us-east-1:123:recovery-point:abc123 \
  --metadata '{"DBInstanceIdentifier":"restored-db","DBSubnetGroupName":"my-subnet-group"}' \
  --iam-role-arn arn:aws:iam::123456789012:role/AWSBackupDefaultServiceRole \
  --resource-type RDS
```

**Backup vault lock:** enable vault lock (compliance mode) to prevent backup deletion for the locked retention period. Protects against accidental deletion and ransomware scenarios.

## Database Migration Service (DMS)

DMS migrates databases with minimal downtime.

```text
Source DB (on-prem, EC2, RDS)
  -> DMS replication instance
    -> Target DB (RDS, Aurora, DynamoDB, S3, Redshift)

Full load + CDC (Change Data Capture):
  1. Full load copies existing data to target
  2. CDC captures ongoing changes during migration
  3. Cutover: point app to target DB when lag is near-zero

Schema Conversion Tool (SCT): convert schema from one engine to another
  Example: Oracle -> Aurora PostgreSQL
```

**DMS is useful for:** homogeneous migration (MySQL to Aurora MySQL), heterogeneous migration (Oracle to PostgreSQL with SCT), continuous replication for reporting, and cloud migration with minimal downtime.

## Application Migration Service (MGN)

MGN (formerly CloudEndure) replicates servers from on-premises or other clouds to AWS.

```text
Workflow:
  1. Install AWS Replication Agent on source server
  2. Continuous block-level replication to staging area
  3. Launch test instance in AWS (non-disruptive)
  4. Cutover: final sync + launch production instance in AWS
  5. Decommission source
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| RDS failover completes but app errors persist | App connection pool holds stale connections | Configure pool with reconnect; test failover in staging |
| Route 53 failover doesn't happen fast enough | TTL too long; health check interval too slow | Set TTL to 60s before test; use 10s health check interval |
| Backup exists but restore takes too long | No automated restore process; restore never tested | Automate restore runbook; test quarterly; measure actual RTO |
| DMS replication falling behind | Source DB write rate exceeds DMS instance capacity | Scale DMS replication instance; reduce LOB column settings |
| Pilot light takes too long to scale up | Manual scaling; automation not tested | Automate scale-up via CloudFormation; test scale-up time regularly |

## Interview Q&A

**Q: What is the difference between HA and DR?**
A: High Availability (HA) keeps the system available through common failures within a Region — multiple AZs, Multi-AZ databases, auto-healing ASGs. Disaster Recovery (DR) addresses catastrophic events that take out an entire Region — it involves a separate environment (often another Region) with processes to failover to it. HA is operational (always running); DR is contingency (activated during a disaster).

**Q: Walk me through RPO and RTO and how you would achieve RPO=1 minute, RTO=15 minutes.**
A: RPO=1 minute means you can lose at most 1 minute of data. You'd need continuous or near-continuous replication — Aurora Global Database with <1s replication lag, or DMS with CDC streaming changes. RTO=15 minutes means the service must recover within 15 minutes. You need a warm standby already running in the DR Region (scaled down), Route 53 failover automation to switch DNS, and a tested runbook to scale up the standby and reconnect applications. Manual steps take too long — automate with Lambda + EventBridge triggered by health check failure.

**Q: Why is it important to regularly restore from backups rather than just create them?**
A: Creating backups is not the same as having recovery capability. Backups can be incomplete, corrupted, or stored in an incompatible format. The restore procedure may be undocumented or have dependencies that fail. Restore time may exceed your RTO. Regular restore tests prove that the backup data is valid, the process works, and the actual RTO is within acceptable bounds. A backup that has never been restored is a hope, not a DR capability.
