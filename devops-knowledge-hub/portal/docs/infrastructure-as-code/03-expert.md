---
title: "Expert"
sidebar_position: 3
---

# Infrastructure as Code — Expert

Expert IaC is not about knowing every Terraform function. It is about operating infrastructure change safely at scale: state boundaries, module contracts, drift control, policy enforcement, incident rollback, and team ownership.

---

## IaC As A Change-Control System

At staff level, IaC is the infrastructure change-control plane.

```text
proposal -> plan -> policy -> review -> controlled apply -> audit -> drift detection
```

The important question is not “can Terraform create this?” The question is: can this change be reviewed, applied, rolled back, audited, and owned safely?

---

## State Boundary Design

State boundaries define blast radius.

Bad pattern:

```text
one giant state containing networking, clusters, databases, apps, IAM, DNS
```

Better pattern:

```text
network/prod
security/prod
platform-cluster/prod
shared-databases/prod
app-team-a/prod
```

State boundary questions:

1. Who owns these resources?
2. How often do they change?
3. What is the blast radius of a bad apply?
4. Who needs read access to state?
5. What depends on this state output?
6. Can this stack be recovered independently?

A network stack and an application stack should usually not share the same state lifecycle.

---

## Module Contract Design

A module is a product. Treat it like one.

A good module provides:

- Stable inputs
- Safe defaults
- Minimal required arguments
- Clear outputs
- Versioned releases
- Upgrade notes
- Examples
- Tests or validation
- Observability defaults
- Security controls by default

Example module contract:

```hcl
module "service_bucket" {
  source = "git::https://github.com/company/terraform-modules.git//s3-private-bucket?ref=v2.1.0"

  name        = "orders-export-prod"
  environment = "prod"
  owner       = "orders-team"
  versioning  = true
}
```

A platform module should make the secure path easy and the unsafe path difficult.

---

## Terraform At Scale

Scaling Terraform means managing concurrency, dependencies, and ownership.

Common patterns:

| Pattern | Purpose |
|---|---|
| Separate states | Reduce blast radius |
| Remote state outputs | Share stable values between stacks |
| Module registry | Standardize reusable components |
| CI-generated plans | Make changes reviewable |
| Controlled apply | Avoid laptop-only production changes |
| Policy-as-code | Enforce guardrails before apply |
| Drift detection | Detect manual or external changes |

Avoid using `terraform_remote_state` as a dumping ground for every output. Publish only stable, intentional outputs.

---

## Plan Review Discipline

A Terraform plan is a change document.

Review for:

- Resource replacements
- Destroy actions
- IAM policy expansion
- Public exposure
- Database changes
- Security group changes
- DNS changes
- Cost-impacting instance sizes
- Lifecycle rule changes
- Provider upgrades

Danger signs:

```text
-/+ replacement of database
large number of resources to destroy
security group widened to 0.0.0.0/0
IAM policy gains wildcard action
state address changed unexpectedly
```

If the plan is too large to review, split the change.

---

## Drift Management

Drift occurs when real infrastructure differs from code and state.

Causes:

- Manual console edits
- Emergency hotfixes
- External controllers
- Provider defaults changed
- Resources imported incompletely
- Module version changed behavior

Drift response:

```text
detect -> classify -> reconcile code or infrastructure -> prevent recurrence
```

Do not blindly apply to “fix drift.” First understand whether the real system or the code is correct.

---

## Safe Refactoring

Terraform refactors should not recreate infrastructure accidentally.

Use `moved` blocks for safe address changes:

```hcl
moved {
  from = aws_s3_bucket.logs
  to   = module.logging.aws_s3_bucket.logs
}
```

Older approach:

```bash
terraform state mv aws_s3_bucket.logs module.logging.aws_s3_bucket.logs
```

Safe refactor process:

1. Add moved block or state move.
2. Run plan.
3. Confirm no resource replacement.
4. Commit code with explanation.
5. Apply from controlled runner.

---

## Importing Existing Infrastructure

Import projects are common in real companies.

Mature import workflow:

```text
inventory existing resources
write matching HCL
import resource
run plan
adjust HCL until no unexpected changes
commit code
apply only after review
```

Terraform 1.5+ import block pattern:

```hcl
import {
  to = aws_s3_bucket.logs
  id = "company-prod-logs"
}
```

Resource block:

```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "company-prod-logs"
}
```

Import is not complete until the plan is clean and ownership is documented.

---

## Secrets And State Risk

Terraform state can contain sensitive values even when outputs are marked sensitive. Expert practice is to avoid placing secret values in Terraform when possible.

Better patterns:

- Create secret containers in Terraform, populate values outside Terraform.
- Reference secret ARNs or names rather than values.
- Use Vault, SOPS, or cloud secret managers.
- Keep state access restricted and audited.
- Avoid exposing sensitive outputs.

Example safer pattern:

```hcl
resource "aws_secretsmanager_secret" "db" {
  name = "prod/orders/db"
}
```

The application retrieves the secret value at runtime through workload identity.

---

## Terraform And CI/CD

Production IaC pipeline design:

```text
PR opened
  -> fmt/validate/tflint/checkov
  -> plan with read-only or planning identity
  -> comment plan summary on PR
  -> approval
  -> apply from protected branch/environment
```

Apply identity should be narrower than full administrator access. Split plans by stack and environment.

---

## Ansible At Scale

Ansible at scale requires inventory discipline, idempotency, batching, and safe failure handling.

Useful controls:

```yaml
- name: Rolling host update
  hosts: web
  serial: 10%
  become: true
  tasks:
    - name: Ensure package is installed
      ansible.builtin.package:
        name: nginx
        state: present
```

Key practices:

- Use dynamic inventory for cloud fleets.
- Use roles for reusable host configuration.
- Use handlers for restarts.
- Use `serial` for rolling changes.
- Avoid raw shell unless no module exists.
- Use `check_mode` before risky changes.

---

## Expert Takeaways

1. State boundary is blast-radius boundary.
2. Modules are platform products and need versioning.
3. A plan must be small enough to review.
4. Drift must be classified before reconciliation.
5. Import is complete only when code and state match reality.
6. Sensitive state must be protected.
7. Production applies should run from controlled environments.
8. Ansible at scale requires idempotency and rollout controls.
