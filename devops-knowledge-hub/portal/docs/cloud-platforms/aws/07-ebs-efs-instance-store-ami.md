---
title: "EBS, EFS, Instance Store, AMI"
sidebar_position: 7
---

# EBS, EFS, Instance Store, AMI

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF separates EC2 instance storage because storage failure behavior is central to AWS operations.

EBS is network-attached block storage for EC2. It behaves like a disk from the OS perspective: filesystems, partitions, databases, and boot volumes can use it. It is AZ-scoped, so an EBS volume in one AZ cannot attach to an instance in another AZ. Snapshots are the backup primitive and can be copied across Regions.

Instance store is local ephemeral storage physically attached to the host. It is fast but disposable. Use it for caches, scratch data, temporary build artifacts, or replicated systems. Never use it as the only copy of important data.

EFS is managed NFS shared storage. It solves the "multiple compute nodes need the same filesystem" problem. It is useful for shared content, legacy apps, container volumes, and WordPress-style uploads, but it brings NFS semantics, performance modes, throughput choices, and cost considerations.

AMI is the machine image. In production, AMIs should be built, scanned, versioned, and rolled out through launch templates and ASGs. Manual snowflake AMIs are hard to audit and reproduce.

Failure modes:

- EBS volume full causes database or app failure
- root volume deleted on termination unexpectedly
- EBS AZ scope breaks recovery plan
- EFS throughput insufficient for workload
- stale AMI contains vulnerable packages

Debugging method:

```text
Check filesystem usage, mount state, EBS volume metrics, burst balance where relevant,
snapshot age, attachment AZ, encryption/KMS permissions, and application IO latency.
```

---

## EBS Volume Types

| Type | Tech | IOPS | Throughput | Best For |
|---|---|---|---|---|
| gp3 | SSD | Up to 16,000 | Up to 1,000 MB/s | General purpose; independently tunable IOPS/throughput |
| gp2 | SSD | Up to 16,000 (3 IOPS/GB baseline) | Up to 250 MB/s | Legacy; prefer gp3 for new workloads |
| io1/io2 | SSD | Up to 64,000 (io2 up to 256,000) | Up to 4,000 MB/s | High IOPS databases (Oracle, SQL Server, large PostgreSQL) |
| st1 | HDD | N/A | Up to 500 MB/s | Big sequential reads: data warehouse, log processing |
| sc1 | HDD | N/A | Up to 250 MB/s | Coldest storage: infrequent access archival |

**gp3 over gp2:** gp3 decouples size from IOPS/throughput. With gp2, to get more IOPS you had to provision a larger volume. With gp3, you tune IOPS and throughput independently — often at lower cost.

## Storage Comparison: EBS vs Instance Store vs EFS vs S3

| Storage | Scope | Persistence | Use Case | Tradeoff |
|---|---|---|---|---|
| EBS | AZ-scoped, one instance | Persists on stop | DB, OS volumes, durable single-instance data | AZ-bound; cannot share across instances |
| Instance store | Instance-local | Ephemeral (lost on stop/terminate) | Cache, scratch, temp build artifacts | Fastest IOPS; data loss on any stop |
| EFS | Multi-AZ, multi-instance | Persists independently | Shared content, container volumes, NFS apps | NFS overhead; performance modes matter |
| S3 | Regional, global namespace | Durable 11 nines | Objects, backups, logs, static assets | Not a filesystem; PUT/GET semantics |

## EBS Snapshots

Snapshots are incremental backups stored in S3-managed infrastructure. They can be copied across Regions for DR.

```bash
# Create a snapshot
aws ec2 create-snapshot \
  --volume-id vol-0abcdef1234567890 \
  --description "pre-migration backup $(date +%Y%m%d)"

# Copy snapshot to another Region
aws ec2 copy-snapshot \
  --source-region us-east-1 \
  --source-snapshot-id snap-0abcdef1234567890 \
  --region eu-west-1 \
  --description "DR copy"

# Create a volume from a snapshot (must be in same AZ as target instance)
aws ec2 create-volume \
  --snapshot-id snap-0abcdef1234567890 \
  --availability-zone us-east-1a \
  --volume-type gp3

# Check EBS volume metrics (IOPS and burst balance)
aws cloudwatch get-metric-statistics \
  --namespace AWS/EBS \
  --metric-name BurstBalance \
  --dimensions Name=VolumeId,Value=vol-0abcdef1234567890 \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 --statistics Average
```

## AMI Build Pipeline (Production Pattern)

```text
Base AMI (AWS provided)
  -> Hardening (CIS benchmarks, SSM agent, monitoring agent)
  -> Baking (install app runtime, language, dependencies)
  -> Versioning (tag with git SHA, build date, app version)
  -> Scanning (Inspector or third-party CVE scan)
  -> Launch template (reference AMI by ID)
  -> Auto Scaling Group (replace instances with new AMI on rolling deploy)
```

**Never use a manual "golden" AMI that is modified in-place.** It becomes unauditable and unreproducible. Treat AMIs as immutable artifacts with a build pipeline.

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| EBS volume full causes DB crash | No alerting on disk space | CloudWatch alarm on `DiskSpaceUtilization` or EBS `VolumeQueueLength`; expand volume |
| EBS throughput throttled | Volume provisioned below workload needs | Switch to gp3; tune IOPS/throughput; check `VolumeWriteOps`/`VolumeReadBytes` metrics |
| Can't attach EBS to instance | Volume and instance in different AZs | Create snapshot; restore in correct AZ |
| EFS performance degraded | Throughput mode insufficient | Switch from Bursting to Elastic or Provisioned throughput mode |
| Instance store data lost on resize | Instance stopped, not just terminated | Understand ephemeral nature; always replicate or checkpoint data on instance store |
| AMI contains vulnerable packages | Stale AMI not rebuilt after CVE disclosure | Implement regular AMI rebuild in CI; scan with Inspector; force ASG refresh |

## Interview Q&A

**Q: Why is gp3 preferred over gp2 for most new EBS volumes?**
A: gp2 scales IOPS as 3 IOPS per GB — to get 3,000 IOPS you need a 1 TB volume even if you only need 100 GB of storage. gp3 provides 3,000 IOPS baseline independently of size and lets you tune IOPS and throughput separately. This typically results in lower cost for the same performance.

**Q: An instance in us-east-1a needs its EBS data in us-east-1b after an AZ failure. What is the process?**
A: EBS volumes are AZ-scoped and cannot be directly attached to instances in a different AZ. The recovery path is: 1) create a snapshot of the volume, 2) create a new volume from the snapshot in the target AZ (`us-east-1b`), 3) attach to the instance in that AZ. This process takes time, which is why critical databases should use RDS Multi-AZ rather than relying on manual EBS snapshot recovery.

**Q: When would you choose EFS over EBS?**
A: EFS when multiple instances or containers need concurrent read/write access to the same files (NFS shared filesystem). EBS when a single instance needs high-performance block storage (OS volumes, databases). EFS works across AZs; EBS is AZ-scoped. EFS has higher latency than EBS for single-instance workloads.
