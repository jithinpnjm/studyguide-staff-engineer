---
title: "IAM"
sidebar_position: 2
---

# IAM

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

IAM is the control plane for trust. The PDF covers users, groups, policies, MFA, CLI, SDK, roles, and best practices. The deeper lesson is that AWS authorization happens on every API request. A Linux engineer might think in users, groups, sudo, file modes, and SSH keys. In AWS, the equivalent question is: which principal is calling which API action against which resource, under which conditions?

An IAM policy is not just permission text. It is part of an authorization graph. A role has a permissions policy that says what the role can do, and a trust policy that says who can assume it. An S3 bucket can have a resource policy. A KMS key has its own key policy. An organization can have SCPs. A VPC endpoint can have an endpoint policy. A session can have session policies. Any explicit deny in that path wins.

For teaching, use this example. An ECS task uploads files to S3. The app gets `AccessDenied`. A junior engineer adds `s3:*` to the task role. A senior engineer asks: is the app using the task role or execution role? Is the bucket policy allowing the principal? Is Block Public Access relevant? Is the object encrypted with KMS? Does the task role have `kms:GenerateDataKey`? Is there an SCP denying writes outside a Region? Is access required through a specific VPC endpoint?

Operational failure modes:

- long-lived access keys leaked from laptops or CI
- runtime role missing permissions after deployment
- role trust policy prevents `AssumeRole`
- KMS key policy blocks otherwise valid S3 or Secrets Manager access
- SCP denies an action that identity policy allows
- EKS service account trust condition does not match the pod identity

Debugging method:

```text
1. Find exact error and AWS API action.
2. Identify runtime principal with sts:GetCallerIdentity.
3. Check CloudTrail for the failed call.
4. Evaluate identity policy, resource policy, key policy, endpoint policy, SCP, and conditions.
5. Add the narrowest permission or fix the trust boundary.
```

AWS docs to anchor this topic:

- IAM policy evaluation logic: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html

---

## Key Concepts

| IAM Concept | Meaning |
|---|---|
| Principal | The actor: user, role, AWS service, federated identity |
| Action | API operation, e.g. `s3:GetObject`, `kms:Decrypt` |
| Resource | Target ARN, e.g. a bucket ARN or role ARN |
| Condition | Extra rule: source IP, MFA, tag, VPC endpoint, org ID |
| Policy | JSON document that allows or denies actions |
| Role | Assumable identity that issues temporary credentials |
| Trust policy | Who (which principal) is allowed to assume the role |
| Permissions boundary | Maximum allowed scope for a role or user |
| SCP | Organization-level guardrail — defines max permissions for accounts |

## IAM Users vs Roles: Decision Rule

| Use Case | Correct Choice |
|---|---|
| Human engineer access | Federation via IAM Identity Center, not IAM users |
| EC2 instance calling AWS APIs | EC2 instance profile (role) |
| Lambda reading Secrets Manager | Lambda execution role |
| ECS task writing to S3 | ECS task role (not execution role) |
| EKS pod accessing DynamoDB | IRSA or EKS Pod Identity |
| CI/CD pipeline deploying infra | OIDC-federated role, not long-lived access keys |
| Break-glass emergency access | Separate restricted role with MFA condition |

**Never use long-lived IAM access keys for workloads.** Roles issue temporary credentials that rotate automatically.

## Explicit Deny: How AWS Policy Evaluation Works

AWS evaluates every request through this chain. Explicit deny at any layer wins:

```text
Effective permission =
  identity policy
  + resource policy
  + session policy
  + permissions boundary
  within SCP limits
  with explicit deny always winning
```

Example: a role has `s3:PutObject` in its identity policy. An SCP denies S3 writes outside `us-east-1`. The result is `AccessDenied` even though the role policy allows it.

## CLI: Debugging Access Denied

```bash
# Identify the runtime principal
aws sts get-caller-identity

# Look up the denied API call in CloudTrail
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=PutObject \
  --start-time 2024-01-01T00:00:00Z

# Simulate whether a policy allows an action (IAM policy simulator)
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/my-role \
  --action-names s3:PutObject \
  --resource-arns arn:aws:s3:::my-bucket/*

# Check all policies attached to a role
aws iam list-attached-role-policies --role-name my-role
aws iam list-role-policies --role-name my-role
```

## Common Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| `AccessDenied` on S3 after switching to SSE-KMS | Role has `s3:PutObject` but lacks `kms:GenerateDataKey` / `kms:Decrypt` | Add KMS permissions to the role; verify key policy trusts the role |
| Lambda can't read Secrets Manager | Execution role used instead of function role, or missing resource permission | Separate execution role (ECS/logs) from function role (app APIs) |
| Pod in EKS can't access AWS services | Service account not annotated or OIDC trust condition mismatch | Configure IRSA or Pod Identity; check trust policy OIDC subject |
| `AssumeRole` fails | Trust policy does not include the calling principal | Edit trust policy to add correct principal ARN |
| Policy allows action but still denied | SCP or permissions boundary blocking | Evaluate full permission chain with IAM simulator |
| Long-lived key leaked from CI | Using access keys in CI/CD pipeline | Replace with OIDC federated role assumption |

## Interview Q&A

**Q: What is the difference between an IAM role and an IAM user?**
A: A user has long-lived credentials (password, access keys). A role issues temporary credentials via STS and can be assumed by AWS services, workloads, or federated identities. Roles are the correct choice for workloads because credentials rotate automatically and never appear in config files.

**Q: How do you debug an `AccessDenied` error in production?**
A: First, identify the exact failing API call and the runtime principal with `sts:GetCallerIdentity`. Check CloudTrail for the denied event. Then evaluate the full permission chain: identity policy, resource policy (bucket/KMS/secret), permissions boundary, session policy, SCP, and any condition keys. The error is rarely in just one place.

**Q: What is an SCP and why does it matter?**
A: A Service Control Policy is an AWS Organizations guardrail that sets the maximum allowed permissions for all principals in an account or OU. An SCP cannot grant permissions by itself — it only restricts them. A common trap: a team writes a valid IAM policy but still gets `AccessDenied` because an SCP at the OU level denies the action.

**Q: Why is explicit deny the most important IAM concept?**
A: Explicit deny overrides any allow anywhere in the permission chain. This is the mechanism that makes SCPs, KMS key policies, and VPC endpoint policies effective as guardrails. Any explicit deny wins regardless of what identity policies allow.
