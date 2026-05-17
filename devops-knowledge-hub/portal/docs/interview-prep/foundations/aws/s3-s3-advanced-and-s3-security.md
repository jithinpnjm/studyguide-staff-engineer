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
