---
title: "S3, S3 Advanced, And S3 Security"
sidebar_position: 12
---

# S3, S3 Advanced, And S3 Security

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

S3 appears across three PDF sections because it is foundational. Learn it in layers.

At the basic layer, S3 is object storage. Bucket, key, object, metadata, version, storage class, lifecycle, and policy are the vocabulary. Use it for logs, artifacts, backups, data lakes, static content, and durable user uploads.

At the advanced layer, S3 becomes an event and data management platform. Lifecycle transitions control cost. Storage class analysis helps choose transitions. Event notifications trigger Lambda, SQS, SNS, or EventBridge. Batch Operations apply work to many objects. Storage Lens gives visibility. Requester Pays shifts transfer/request cost to the requester.

At the security layer, understand encryption and access. SSE-S3 uses S3-managed keys. SSE-KMS uses KMS keys and therefore adds KMS permissions, audit, and potential throttling/cost considerations. SSE-C means the customer provides keys with requests. Client-side encryption means AWS stores ciphertext it cannot decrypt without client-side keys.

Failure modes:

- public exposure through bad bucket/access point policy
- app fails because KMS permissions missing
- old versions cause unexpected storage cost
- lifecycle transitions break retrieval expectations
- event notification loops create recursive processing
- static website endpoint confused with REST endpoint

AWS docs:

- S3 Versioning: https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html
- S3 Lifecycle: https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html

---

## S3 Storage Classes: Decision Table

| Class | Access Pattern | Retrieval | Notes |
|---|---|---|---|
| Standard | Frequently accessed | Immediate | Default; highest cost per GB |
| Intelligent-Tiering | Unknown / variable | Immediate | Auto-moves between tiers; monitoring fee per object |
| Standard-IA | Infrequent, durability needed | Immediate | Min 30-day storage charge; multi-AZ durability |
| One Zone-IA | Infrequent, recreatable | Immediate | Single AZ; cheaper but data lost if AZ fails |
| Glacier Instant Retrieval | Archive accessed occasionally | Milliseconds | Min 90-day charge |
| Glacier Flexible Retrieval | Archive rarely accessed | Minutes to hours | Min 90-day charge; free bulk retrieval |
| Glacier Deep Archive | Cold long-term archive | Up to 12 hours | Cheapest storage; min 180-day charge |
| Express One Zone | High-performance single-AZ | Sub-10ms | For ML/analytics hot data; single AZ |

**Lifecycle rule example** (cost-optimized log retention):
```text
0–30 days:   Standard
31–180 days: Standard-IA
181+ days:   Glacier Flexible Retrieval
365+ days:   Expire (delete)
```

## S3 Security: Access Control Layers

```text
Request must pass ALL applicable controls:
  1. IAM identity policy (what the principal can do)
  2. Bucket policy (what the bucket allows or denies)
  3. Block Public Access setting (overrides ACLs and policies for public access)
  4. ACLs (legacy; avoid for new buckets)
  5. VPC endpoint policy (if access is through a VPC endpoint)
  6. Encryption: SSE-S3, SSE-KMS, SSE-C, or client-side
```

**Default rule: Block Public Access ON.** Turn it off only with explicit review and a documented reason.

| Encryption Type | Key Control | KMS Permissions Required | When to Use |
|---|---|---|---|
| SSE-S3 (AES-256) | AWS-managed | No | Default encryption, simplest |
| SSE-KMS | Customer managed key | Yes: `kms:GenerateDataKey`, `kms:Decrypt` | Audit, key rotation, cross-account |
| SSE-C | Customer-provided key per request | No KMS, but key in request | Regulatory: you manage keys entirely |
| Client-side | App encrypts before upload | None | AWS stores ciphertext it cannot read |

## Replication Rules

| Type | When to Use |
|---|---|
| Same-Region Replication (SRR) | Log aggregation across accounts, test/prod data copy |
| Cross-Region Replication (CRR) | DR, compliance, latency for global readers |

Requirements: source and destination buckets must have versioning enabled. Replication does not copy existing objects retroactively.

## CLI: Common Operations

```bash
# Copy a file to S3
aws s3 cp myfile.txt s3://my-bucket/prefix/myfile.txt

# Sync a directory to S3 (incremental)
aws s3 sync ./logs/ s3://my-bucket/logs/

# List objects with size and date
aws s3 ls s3://my-bucket/ --recursive --human-readable

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket my-bucket \
  --versioning-configuration Status=Enabled

# List object versions (including delete markers)
aws s3api list-object-versions --bucket my-bucket --prefix myfile.txt

# Restore a deleted object (remove delete marker)
aws s3api delete-object \
  --bucket my-bucket \
  --key myfile.txt \
  --version-id <delete-marker-version-id>

# Create a lifecycle rule (via put-bucket-lifecycle-configuration)
# Add a presigned URL for temporary access (15 min)
aws s3 presign s3://my-bucket/file.txt --expires-in 900

# Check S3 bucket policy
aws s3api get-bucket-policy --bucket my-bucket

# Block public access on a bucket
aws s3api put-public-access-block \
  --bucket my-bucket \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

## S3 Events: Trigger Patterns

```text
Object created/deleted in S3
  -> S3 Event Notification
    -> Lambda (inline processing)
    -> SQS (buffered, retry-safe processing)
    -> SNS (fanout to multiple consumers)
    -> EventBridge (filtering, routing, archive)
```

Common use cases: image thumbnailing, virus scanning, data pipeline ingestion, search indexing, backup notifications.

**Warning:** event notification to Lambda can create recursive loops if the Lambda writes back to the same bucket with the same prefix/suffix that triggers the notification.

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| S3 upload fails after switching to SSE-KMS | Role lacks `kms:GenerateDataKey` | Add KMS permissions to the IAM role; verify key policy trusts the role |
| Unexpected storage bill growth | Versioning enabled, no lifecycle on noncurrent versions | Add lifecycle rule to expire noncurrent versions after N days |
| Public data exposure | Bucket policy or ACL misconfigured | Enable Block Public Access; audit with AWS Config rule `s3-bucket-public-read-prohibited` |
| Event notification loop | Lambda writes to same bucket that triggers it | Use separate prefix/suffix conditions; write outputs to a different bucket |
| Lifecycle transition breaks retrieval | App expects immediate retrieval but object moved to Glacier | Add `s3:RestoreObject` logic; test transition with non-critical data first |
| Static website returns 403 | Website endpoint requires different policy than REST endpoint | Static websites use `s3-website` endpoint; ensure bucket policy allows `s3:GetObject` for `Principal: "*"` (only with Block Public Access adjusted) |

## Interview Q&A

**Q: What is S3 Versioning and why does it matter operationally?**
A: Versioning keeps multiple copies of every object version. A delete creates a delete marker instead of permanently removing prior versions, so accidental deletion is recoverable. Operationally, it means you must also create lifecycle rules to expire old versions, otherwise storage costs grow indefinitely.

**Q: Why can switching to SSE-KMS break an existing S3 application?**
A: SSE-KMS requires the calling IAM principal to have `kms:GenerateDataKey` for writes and `kms:Decrypt` for reads. The S3 permissions (`s3:PutObject`, `s3:GetObject`) may still be valid, but the KMS key policy or the role's KMS permissions may be missing. CloudTrail will show an `AccessDenied` on the KMS API, not on S3.

**Q: When should you use S3 Cross-Region Replication vs CloudFront?**
A: CRR creates a second copy of the object in another Region — useful for DR, compliance, or having data nearby for write access from another Region. CloudFront caches object reads at edge locations but does not replicate data for durability. Use CRR for data resilience and CloudFront for read latency and caching.
