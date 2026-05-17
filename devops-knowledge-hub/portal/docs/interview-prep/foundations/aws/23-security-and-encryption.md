---
title: "Security And Encryption"
sidebar_position: 23
---

# Security And Encryption

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF security section covers KMS, SSM Parameter Store, Secrets Manager, ACM, CloudHSM, WAF, Shield, Firewall Manager, GuardDuty, Inspector, and Macie.

KMS is central because many AWS services delegate encryption key use to it. If KMS is misconfigured, S3, EBS, RDS, Lambda environment variables, Secrets Manager, and many other systems can fail. Parameter Store and Secrets Manager solve configuration/secrets storage, with Secrets Manager adding stronger rotation-oriented workflows. ACM solves certificate lifecycle for supported AWS services. WAF and Shield protect edge/application layers. GuardDuty, Inspector, and Macie detect suspicious activity, vulnerabilities, and sensitive S3 data.

Senior security explanation:

```text
I design security as layered prevention, detection, and recovery: least-privilege IAM,
private networking, encryption with controlled KMS keys, managed secrets, edge
protection, vulnerability detection, audit trails, and tested incident response.
```
