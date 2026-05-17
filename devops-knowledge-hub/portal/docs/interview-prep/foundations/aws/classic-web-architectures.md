---
title: "Classic Web Architectures"
sidebar_position: 11
---

# Classic Web Architectures

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF teaches stateless and stateful web apps because they reveal how AWS services fit together. Start with one EC2 instance and every problem is hidden: compute, state, files, database, logs, TLS, and deployment are all on one box. Scaling forces separation.

For a stateless app, move traffic behind an ALB, run multiple instances across AZs, use ASG for replacement, and store state elsewhere. For a stateful app, identify every kind of state. User sessions move to Redis/DynamoDB. Uploaded files move to S3/EFS. Relational data moves to RDS/Aurora. Logs move off-host. Once state is externalized, compute can be replaced safely.

Teaching example:

```text
Single EC2 WordPress:
  simple, fragile, hard to scale

Better:
  ALB -> EC2/ECS app tier across AZs
      -> RDS/Aurora Multi-AZ for DB
      -> EFS or S3 for uploads
      -> CloudFront for static content
      -> CloudWatch for logs/metrics
```
