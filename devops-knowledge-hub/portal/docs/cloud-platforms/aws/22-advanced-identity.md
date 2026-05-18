---
title: "Advanced Identity"
sidebar_position: 22
---

# Advanced Identity

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Advanced identity in the PDF includes Organizations, SCPs, IAM conditions, resource policies, permission boundaries, Identity Center, Directory Service, and Control Tower. These exist because single-account IAM does not scale for enterprises.

Use Organizations and OUs to group accounts. Use SCPs as maximum-permission guardrails. Use IAM Identity Center for workforce federation. Use permission boundaries to constrain what delegated admins or automation can create. Use resource policies for cross-account access. Use `aws:PrincipalOrgID` to restrict resource access to principals from your AWS Organization.

Failure mode: cross-account role assumption works in dev but not prod because prod OU has stricter SCPs or trust policies require external ID/session tags.

---

## IAM Identity Center (SSO)

IAM Identity Center is the recommended approach for workforce access to multiple AWS accounts. It replaces direct IAM users for humans.

```text
Corporate IdP (Okta, Azure AD, Google Workspace)
  -> IAM Identity Center (SAML/SCIM federation)
    -> Permission sets assigned to accounts/OUs
      -> Users assume roles in specific accounts
      -> Temporary credentials; no long-lived keys
```

**Benefits:** single sign-on across all accounts, centralized audit, no per-account IAM user management, session duration controls, MFA enforcement.

## Permission Boundaries

A permission boundary sets the maximum permissions a role or user can be granted. It does not grant permissions itself.

```text
Use case: a developer can create IAM roles for their CI pipeline,
but they cannot create roles with more permissions than they have.

Boundary policy: allows only s3:*, dynamodb:*, cloudwatch:*
Developer's identity policy: allows iam:CreateRole, iam:AttachRolePolicy

Result: developer can create roles, but only roles that fit within the boundary.
Any role with ec2:* or iam:* will be denied even if the developer tries to attach it.
```

This prevents privilege escalation through delegated IAM management.

## Cross-Account Access Patterns

| Pattern | Mechanism | When to Use |
|---|---|---|
| Role assumption | Trust policy + `sts:AssumeRole` | One account accesses resources in another |
| Resource policy | Allow specific account or `aws:PrincipalOrgID` | S3 bucket, KMS key, SNS topic used cross-account |
| AWS RAM (Resource Access Manager) | Share specific resources across accounts | VPC subnets, Route 53 resolver rules, License Manager |

**`aws:PrincipalOrgID` condition:** instead of trusting specific account IDs in resource policies, use this condition to allow any principal from your AWS Organization. Useful for S3 bucket policies, KMS key policies, and SNS topics that should be accessible org-wide but not publicly.

```json
{
  "Condition": {
    "StringEquals": {
      "aws:PrincipalOrgID": "o-exampleorgid"
    }
  }
}
```

## AWS Organizations and OUs: Structure and SCPs

```text
Organization root
  Management OU
    Management account (billing, org admin only)
  Security OU
    Security account (GuardDuty master, Security Hub, CloudTrail org trail)
    Log Archive account (immutable S3 buckets)
  Infrastructure OU
    Shared services (Transit Gateway, DNS)
  Workloads OU
    Dev OU -> dev accounts
    Staging OU -> staging accounts
    Prod OU -> production accounts (strictest SCPs)
```

**SCP inheritance:** SCPs are inherited down the OU tree. An SCP at the root applies to all accounts. An SCP on the Prod OU applies only to production accounts. More restrictive SCPs at lower levels add guardrails on top of inherited ones.

## Control Tower

AWS Control Tower orchestrates multi-account setup using Organizations, IAM Identity Center, Service Catalog, and predefined guardrails.

```text
Landing Zone: managed multi-account environment
  Preventive guardrails: SCPs that prevent specific actions
  Detective guardrails: Config rules that detect violations
  Account Factory: self-service vending of new accounts with baseline config
```

Use Control Tower when: setting up a new AWS organization and you want a validated baseline with best-practice guardrails without building it manually.

## CLI: Cross-Account Role Assumption

```bash
# Assume a role in another account
aws sts assume-role \
  --role-arn arn:aws:iam::987654321098:role/CrossAccountReadRole \
  --role-session-name "my-session-$(date +%s)"

# Export temporary credentials
export AWS_ACCESS_KEY_ID=$(...)
export AWS_SECRET_ACCESS_KEY=$(...)
export AWS_SESSION_TOKEN=$(...)

# Use AWS CLI profile for cross-account role
# In ~/.aws/config:
# [profile prod-readonly]
# role_arn = arn:aws:iam::987654321098:role/CrossAccountReadRole
# source_profile = default
aws s3 ls s3://prod-bucket --profile prod-readonly

# Check effective permissions for a specific action
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/my-role \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::my-bucket/*
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| Cross-account role assumption fails in prod not dev | Prod OU SCP denies `sts:AssumeRole` from certain principals | Check SCP on Prod OU; compare with Dev OU SCPs |
| `AccessDenied` even with correct role | Trust policy requires external ID or session tag not passed | Check trust policy conditions; pass required `ExternalId` or session tags |
| Identity Center users can't access an account | Permission set not assigned to the user/group for that account | Assign permission set in IAM Identity Center console |
| Developers escalate privileges via IAM | No permissions boundary on delegated IAM management | Attach permission boundary to all roles developers create |

## Interview Q&A

**Q: What is the difference between IAM Identity Center and direct IAM users for workforce access?**
A: IAM users have long-lived credentials (password, access keys) that expire only when manually rotated or deleted. IAM Identity Center federates from an existing corporate IdP and issues short-lived temporary credentials via SAML/OIDC. Identity Center provides SSO across all accounts, centralized access management, MFA enforcement, and audit trails without creating per-account users.

**Q: What is a permission boundary and why is it useful?**
A: A permission boundary is an IAM managed policy attached to a role or user that sets the maximum permissions it can have, even if its identity policies grant broader permissions. It is used to enable safe delegation: you can let developers create IAM roles for their services, but the permission boundary ensures those roles cannot have admin or cross-service permissions beyond what's appropriate for that team's scope.

**Q: How does `aws:PrincipalOrgID` improve cross-account security?**
A: Instead of listing specific account IDs in bucket policies or KMS key policies (which must be updated when accounts are added), `aws:PrincipalOrgID` allows any authenticated principal from your AWS Organization. This is safer than `Principal: "*"` (which would be public), more maintainable than hardcoded account IDs, and still enforces the organizational boundary.
