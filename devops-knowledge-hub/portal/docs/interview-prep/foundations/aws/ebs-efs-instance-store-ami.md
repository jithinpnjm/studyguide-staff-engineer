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
