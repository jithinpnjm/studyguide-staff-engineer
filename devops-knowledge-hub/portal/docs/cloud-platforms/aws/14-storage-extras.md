---
title: "Storage Extras"
sidebar_position: 14
---

# Storage Extras

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF covers Snowball, FSx, Storage Gateway, Transfer Family, and DataSync. These services exist mostly for migration, hybrid, and specialized filesystem needs.

Snowball solves physical data transfer when network movement is too slow or expensive. FSx solves managed filesystem needs beyond EFS: Windows File Server for SMB/Windows workloads, Lustre for high-performance compute, NetApp ONTAP and OpenZFS for enterprise filesystem compatibility. Storage Gateway connects on-premises environments to AWS storage through file, volume, or tape patterns. Transfer Family gives managed SFTP/FTPS/FTP endpoints backed by S3 or EFS. DataSync moves data between on-premises and AWS storage or between AWS storage services.

Senior explanation: these are not first-choice services for every app. They are integration tools when real enterprises have existing data, protocols, appliances, and migration constraints.

---

## Service Quick Reference

| Service | Purpose | When to Use |
|---|---|---|
| AWS Snow Family | Physical data transfer to AWS | Network transfer too slow or expensive (>10 TB to PB scale) |
| FSx for Windows File Server | Managed Windows SMB filesystem | Windows workloads needing NTFS, Active Directory, DFS |
| FSx for Lustre | High-performance parallel filesystem | HPC, ML training, big data — needs high throughput to S3 |
| FSx for NetApp ONTAP | Managed NetApp filesystem | Enterprise apps needing NetApp APIs, NFS/SMB/iSCSI |
| FSx for OpenZFS | OpenZFS-compatible filesystem | ZFS-based workloads, snapshot-heavy NAS replacement |
| Storage Gateway | Hybrid cloud storage bridge | On-premises apps accessing S3/EBS/Tape over file/volume/tape interface |
| Transfer Family | Managed SFTP/FTPS/FTP endpoint | Partners or customers who must use SFTP; backed by S3 or EFS |
| DataSync | Managed data transfer (online) | Migrate data from on-premises to S3/EFS/FSx; scheduled sync |

## Snow Family: When Network Transfer Won't Work

```text
Snowcone:  8 TB (HDD) / 14 TB (SSD) — small portable; can use DataSync online
Snowball Edge Storage Optimized:  80 TB per device — common choice for TB migrations
Snowball Edge Compute Optimized:  39.5 TB + EC2 compute at edge
Snowmobile: up to 100 PB — truck-scale migrations
```

**Rule of thumb:** if transferring your data over the internet would take more than a week, Snow Family is worth considering. At 1 Gbps line speed, 100 TB takes ~10 days to transfer.

## FSx for Lustre: HPC Integration Pattern

```text
S3 bucket (source data)
  -> FSx for Lustre (scratch/persistent filesystem)
  -> HPC cluster (EC2, EKS, Batch jobs)
  -> Results written back to S3
```

FSx for Lustre can be linked to an S3 bucket. Data is lazily loaded from S3 on first access and results can be exported back to S3. This gives HPC jobs fast local POSIX I/O without pre-copying all data.

## Storage Gateway Modes

| Mode | What It Emulates | Backed By |
|---|---|---|
| File Gateway | NFS/SMB file share | S3 (files become S3 objects) |
| Volume Gateway (cached) | iSCSI block volumes; primary in S3, cache local | S3 + EBS snapshots |
| Volume Gateway (stored) | iSCSI block volumes; primary local, async S3 backup | S3 |
| Tape Gateway | Virtual tape library (VTL) | S3 Glacier |

Use Storage Gateway when: on-premises apps cannot be changed to use S3 APIs directly, or when migration requires a period of hybrid access before cutover.

## DataSync vs Storage Gateway vs Transfer Family

| Need | Service |
|---|---|
| Migrate large amounts of data from on-prem to S3/EFS/FSx (one-time or recurring) | DataSync |
| On-premises app needs to read/write AWS storage using NFS/SMB/iSCSI | Storage Gateway |
| Partners/customers must upload/download files using SFTP protocol | Transfer Family |
| Replicate data between AWS services (S3 to EFS, etc.) | DataSync |

## Interview Q&A

**Q: When would you use Snowball instead of DataSync for a migration?**
A: When network bandwidth makes online transfer impractical. DataSync works well for ongoing sync and for transfers where the available bandwidth can complete the job in a reasonable time. For very large datasets (tens of TB and above) where transfer time over existing WAN links exceeds days or weeks, Snowball moves data physically and is often faster end-to-end.

**Q: What is the difference between FSx for Lustre and EFS?**
A: EFS is general-purpose NFS shared storage across instances, suitable for typical app filesystems, container volumes, and web content. FSx for Lustre is a high-performance parallel filesystem designed for HPC, ML training, and big data workloads that need very high throughput and low latency. Lustre can be linked to S3 for lazy data loading. EFS is easier to use but has lower raw throughput than Lustre.

**Q: How does Transfer Family work and what problem does it solve?**
A: Transfer Family provides managed SFTP, FTPS, or FTP endpoints backed by S3 or EFS. It solves the problem of migrating file-transfer workflows where partners or customers use SFTP clients and you cannot change their behavior. Instead of running an SFTP server on EC2, Transfer Family manages the protocol, authentication (IAM, custom Lambda, Active Directory), and storage backend.
