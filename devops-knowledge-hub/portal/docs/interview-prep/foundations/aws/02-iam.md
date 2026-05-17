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
