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

---

## KMS: Key Types and Decision Table

| Key Type | Control Level | When to Use |
|---|---|---|
| AWS owned keys | AWS manages everything; not visible | Default for many services; simplest |
| AWS managed keys | Per-service keys in your account; visible in KMS | When you need CloudTrail visibility for key use |
| Customer managed keys (CMK) | You control policy, rotation, grants, deletion | Compliance, cross-account access, fine-grained audit, key disable/delete |
| Multi-Region keys | Related keys across Regions; same key material | Client-side encryption + cross-Region decryption; global DynamoDB |

**KMS access requires BOTH:** the IAM identity policy must allow the KMS action AND the KMS key policy must allow the principal. If either is missing, access is denied.

```bash
# Common KMS permissions for S3 SSE-KMS:
# Write:
kms:GenerateDataKey
# Read:
kms:Decrypt
# Both covered by:
kms:GenerateDataKey*
kms:Decrypt
```

## Secrets Manager vs SSM Parameter Store

| Feature | Secrets Manager | SSM Parameter Store |
|---|---|---|
| Automatic rotation | Yes (built-in for RDS, Redshift, custom Lambda) | No (manual or custom) |
| Cost | Per secret per month + API calls | Free tier for standard; $0.05/param/month for advanced |
| Cross-account access | Native via resource policy | More complex |
| Secret versions | Yes | Yes (history) |
| Best for | DB credentials, API keys needing rotation | Config values, feature flags, simpler secrets |

**Production pattern:** Secrets Manager for database credentials with automatic rotation. Parameter Store for non-secret config (DB host, queue URL, feature flags) and simple secrets that don't need rotation.

```bash
# Read a secret from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id prod/app/db-credentials \
  --query SecretString --output text

# Read a parameter from SSM Parameter Store (with decryption for SecureString)
aws ssm get-parameter \
  --name /prod/app/db-password \
  --with-decryption \
  --query Parameter.Value --output text

# Rotate a secret immediately
aws secretsmanager rotate-secret --secret-id prod/app/db-credentials
```

## Threat Detection Services

| Service | What It Detects | How to Act |
|---|---|---|
| GuardDuty | Suspicious API calls, unusual traffic, compromised credentials, crypto mining | Route findings to EventBridge -> Lambda or Security Hub |
| Inspector | Software vulnerabilities in EC2 / container images / Lambda functions | Prioritize by severity; integrate with ECR scan on push |
| Macie | Sensitive data (PII, credentials) in S3 buckets | Identify over-exposed buckets; clean up or restrict access |
| Security Hub | Aggregates findings from GuardDuty, Inspector, Config, Macie, partner tools | Central security posture dashboard; automated remediation |

**SRE habit:** Enable GuardDuty in all accounts and all Regions. Route HIGH/CRITICAL findings to PagerDuty or Slack. Don't let findings sit in a console nobody checks.

## WAF, Shield, Firewall Manager

| Service | Layer | Use Case |
|---|---|---|
| WAF | HTTP(S) layer 7 | SQL injection, XSS, rate limiting, IP block/allow lists, bot control |
| Shield Standard | Network layer | Always-on DDoS protection for all AWS customers at no extra cost |
| Shield Advanced | Network + application layer | Enhanced DDoS, cost protection, 24/7 DDoS response team, Route 53, CloudFront |
| Firewall Manager | Multi-account policy management | Centrally deploy WAF rules and Shield Advanced policies across AWS Organization |

**WAF integration points:** CloudFront, ALB, API Gateway, App Runner, Cognito. Attach WAF at the CloudFront layer to protect globally; at ALB layer for regional protection.

## ACM: Certificate Management

```bash
# Request a public certificate (DNS validation recommended)
aws acm request-certificate \
  --domain-name api.example.com \
  --validation-method DNS \
  --subject-alternative-names www.example.com

# List certificates and their status
aws acm list-certificates --query "CertificateSummaryList[*].{Domain:DomainName,Status:Status}"

# Describe certificate (get DNS validation CNAME records)
aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/abc123
```

ACM certificates are free and auto-renew for use with ALB, CloudFront, and API Gateway. CloudHSM is for strict compliance requirements where you need dedicated hardware for cryptographic operations.

## Encryption at Rest: Service Quick Reference

| Service | SSE Options |
|---|---|
| S3 | SSE-S3 (default), SSE-KMS (CMK or AWS managed), SSE-C, client-side |
| EBS | AES-256 via KMS (enabled per volume or account-wide default) |
| RDS / Aurora | Encrypted at creation via KMS; cannot add later without snapshot restore |
| DynamoDB | Always encrypted (AWS owned or CMK) |
| Secrets Manager | Always encrypted via KMS |
| CloudWatch Logs | Optional KMS encryption for log groups |

**Enable EBS encryption by default** in all accounts: `aws ec2 enable-ebs-encryption-by-default`.

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| App fails after SSE-KMS migration | Role missing `kms:GenerateDataKey` or `kms:Decrypt` | Add KMS permissions to role; check key policy trusts the role |
| Secret rotation breaks app | App caches old credentials; new secret version not picked up | Implement retry logic; use Secrets Manager SDK with caching and rotation support |
| KMS key deleted causing data loss | Customer deleted CMK used for RDS/S3 | Enable key deletion protection (7–30 day waiting period); use key grants carefully |
| GuardDuty finding ignored | No alert routing configured | Route findings to EventBridge -> SNS -> PagerDuty |
| Public S3 bucket exposing sensitive data | Block Public Access not enabled | Enable Block Public Access at organization level via SCP; use Macie to detect |

## Interview Q&A

**Q: What is the difference between KMS AWS managed keys and customer managed keys?**
A: AWS managed keys are created and managed by AWS for a specific service in your account. You can see them and their usage in CloudTrail, but you cannot modify the key policy or disable them. Customer managed keys (CMK) give you full control: custom key policy, rotation schedule, grants, aliases, and the ability to disable or schedule deletion. Use CMKs when you need cross-account access, fine-grained audit, or the ability to revoke access by disabling the key.

**Q: How would you debug a `kms:Decrypt` AccessDenied?**
A: First, use `aws sts get-caller-identity` to confirm the runtime principal. Check CloudTrail for the exact KMS API call and which key ARN was targeted. Then verify: 1) does the role's IAM policy allow `kms:Decrypt` for this key ARN? 2) does the KMS key policy allow this principal? Both must allow for access to succeed. A common mistake is fixing the IAM policy but missing the key policy update.

**Q: Why enable GuardDuty in every Region and account?**
A: Threats don't announce which Region they'll use. An attacker who assumes a compromised role might spin up resources in `ap-southeast-1` if that's less monitored. GuardDuty in every Region with findings routed through Security Hub gives centralized visibility. SCPs can prevent launching resources outside approved Regions, but detection coverage should still be global.
