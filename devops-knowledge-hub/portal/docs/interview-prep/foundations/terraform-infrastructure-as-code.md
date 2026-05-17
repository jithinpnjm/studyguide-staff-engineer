---
title: "Foundations: Terraform Premium Teaching Guide For SRE And Platform Engineers"
sidebar_position: 15
---

# Foundations: Terraform Premium Teaching Guide For SRE And Platform Engineers

Terraform is infrastructure as code. It lets you define cloud and platform resources in version-controlled configuration instead of clicking through consoles.

For SRE and platform teams, Terraform is not just automation. It is a safety system for reviewability, repeatability, auditability, and disaster recovery.

This guide teaches Terraform from first principles to production-grade operating patterns.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — providers, resources, variables, plan/apply.
2. **Intermediate Layer** — modules, state, environments, imports.
3. **Advanced Layer** — lifecycle rules, drift, CI/CD, policy, scaling teams.
4. **Production SRE Layer** — safe change management and recovery.
5. **Interview Layer** — explain Terraform tradeoffs clearly.

---

# Memory Palace: Terraform Is A City Planner

| Terraform Concept | Analogy | Real Meaning |
|---|---|---|
| `.tf` files | Blueprints | Desired infrastructure |
| Provider | Contractor | API translator |
| Resource | Building | Real cloud object |
| Module | Reusable building design | Standard component |
| Variable | Permit parameter | Input |
| Output | Utility map | Exported value |
| State | City ledger | Resource mapping |
| Plan | Construction proposal | Preview changes |
| Apply | Build order | Execute changes |
| Destroy | Demolition permit | Remove resources |
| Drift | Unauthorized construction | Manual change outside code |
| Locking | Single permit desk | Prevent concurrent apply |

---

# Beginner Layer: Terraform Mental Model

Terraform manages three realities:

| Reality | Meaning |
|---|---|
| Desired State | What code says should exist |
| Recorded State | What Terraform believes exists |
| Actual Reality | What provider APIs report |

`terraform plan` compares these worlds.

```text
Configuration -> Plan -> Provider API calls -> Infrastructure
             -> State records mapping
```

Terraform is declarative. You say what should exist, not each API step.

---

# Beginner Layer: First Workflow

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
terraform destroy
```

Use this order:

```text
write config -> init -> fmt -> validate -> plan -> review -> apply -> verify
```

Never treat `apply` as the next button after `plan`. Read the plan.

---

# Beginner Layer: Providers And Resources

## Provider

Talks to an API.

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
```

Pin versions. Provider upgrades can change behavior.

## Resource

Defines real infrastructure.

```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "company-prod-logs"
}
```

Terraform address:

```text
aws_s3_bucket.logs
```

Renaming addresses without migration can cause recreate plans.

---

# Beginner Layer: Variables, Locals, Outputs

## Variables

Inputs to configuration.

## Locals

Computed reusable values.

## Outputs

Export values to humans or other layers.

```hcl
output "bucket_name" {
  value = aws_s3_bucket.logs.bucket
}
```

Outputs are contracts between modules and layers.

---

# Intermediate Layer: State Explained Properly

State maps Terraform resources to real infrastructure IDs.

It often contains sensitive data.

Production state should use:

- remote backend
- encryption
- versioning
- locking
- restricted access

Example backend:

```hcl
terraform {
  backend "s3" {
    bucket         = "terraform-state"
    key            = "prod/network.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

Never keep important production state only on a laptop.

---

# Intermediate Layer: Reading Plans Safely

Plan symbols:

| Symbol | Meaning | Typical Risk |
|---|---|---|
| `+` | create | low |
| `~` | update in place | medium |
| `-` | destroy | high |
| `-/+` | replace | very high |
| `<=` | read data source | low |

Most dangerous line in many environments:

```text
-/+
```

Replacement can mean downtime, IP change, data loss, or service interruption.

Always scrutinize:

- databases
n- clusters
- load balancers
- IAM policies
- DNS records
- security groups
- subnets

---

# Intermediate Layer: Modules

Modules package reusable infrastructure.

```text
modules/vpc/
modules/eks/
modules/rds/

environments/prod/
```

Use modules for repeated patterns.

Good modules have:

- clear inputs
- sane defaults
- useful outputs
- low surprise behavior
- versioning
- documentation

Bad modules hide dangerous magic.

---

# Intermediate Layer: for_each vs count

Use `for_each` for named resources.

```hcl
for_each = var.subnets
```

Use `count` only when instances are identical.

Why?

Changing list order with `count` can recreate resources unexpectedly.

---

# Intermediate Layer: Data Sources

Read existing infrastructure without managing it.

```hcl
data "aws_vpc" "shared" {
  tags = { Name = "shared-vpc" }
}
```

Use when another team owns the resource.

---

# Advanced Layer: Imports And State Surgery

Import existing resource:

```bash
terraform import aws_s3_bucket.logs company-prod-logs
```

Inspect:

```bash
terraform state list
terraform state show aws_s3_bucket.logs
```

Move address safely:

```bash
terraform state mv old new
```

Remove from management only:

```bash
terraform state rm resource.addr
```

State commands are surgery. Back up first.

---

# Advanced Layer: Lifecycle Rules

Protect critical resources.

```hcl
lifecycle {
  prevent_destroy = true
}
```

Other controls:

```hcl
create_before_destroy = true
ignore_changes = [tags]
```

Use carefully. `ignore_changes` can hide real drift.

---

# Advanced Layer: Drift

Drift means reality changed outside Terraform.

Examples:

- manual console edits
- hotfix security rule
- changed tags
- altered DB config

Detect:

```bash
terraform plan -detailed-exitcode
```

Response options:

- codify intended change
- revert unintended change
- import ownership
- reduce manual access

---

# Advanced Layer: Environment Strategy

Recommended:

```text
environments/
  dev/
  staging/
  prod/
modules/
```

Why separate states?

- smaller blast radius
- clearer ownership
- safer access control
- easier promotion path
- reduced accidental prod impact

Workspaces can help some cases, but separate states are usually clearer for prod.

---

# Advanced Layer: CI/CD For Terraform

Safe flow:

```text
PR -> fmt -> validate -> plan -> review -> approval -> apply
```

Best practices:

- apply only from CI
- no local prod apply
- short-lived credentials (OIDC)
- artifact plan files
- approval gates
- audit logs

---

# Advanced Layer: Policy And Guardrails

Useful controls:

- branch protection
- mandatory reviews
- tfsec / Checkov scanning
- OPA / Conftest policy
- cost estimation
- drift jobs
- protected backends

Example rules:

- no public storage buckets
- prod DB backups required
- SSH tightly scoped
- tags mandatory
- critical resources protected

---

# Production SRE Layer: Incident Stories

## Plan Wants To Replace Database

Do not click apply.

Check:

- which attribute forces replacement
- migration path
- maintenance window
- lifecycle protection missing?

## State Lock Stuck

Likely interrupted apply.

Action:

- verify no active run
- inspect lock holder
- unlock carefully

## Console Hotfix Disappeared

Terraform reverted drift on next apply.

Fix:

- codify hotfix
- improve change process

## Giant Monolithic State Causes Fear

Fix:

- split by environment/layer/team

---

# Production SRE Layer: Troubleshooting By Symptom

## init fails

Check:

- credentials
- backend access
- provider registry reachability
- Terraform version

## plan shows unexpected destroy

Check:

- rename without moved block/state mv
- provider change
- state mismatch
- lifecycle removed

## apply fails midway

Check:

- partial real changes
- rerun plan before retry
- provider quota/rate limit
- dependency ordering

## access denied

Check:

- assumed role
- OIDC trust
- SCP/org policy
- provider config

---

# Interview Layer: Strong Answers

## Why Terraform over console clicks?

> Terraform makes infrastructure reviewable, reproducible, auditable, and recoverable through version-controlled code.

## Why remote state?

> Shared state enables collaboration, locking, backups, and consistent truth across engineers and CI systems.

## Why is `-/+` risky?

> It means replacement. Stateful or network resources may incur downtime, data migration risk, or identity changes.

## How would you run Terraform in production?

> PR-based plans, reviewed changes, CI-only applies, remote locked state, short-lived credentials, and guarded production approvals.

---

# Labs

## Beginner

1. Create a bucket or local_file resource.
2. Use variables and outputs.
3. Run full init/plan/apply/destroy cycle.

## Intermediate

1. Create reusable VPC module.
2. Split dev/prod states.
3. Import existing resource.
4. Use data sources.

## Advanced

1. Add CI plan workflow.
2. Add policy scan.
3. Simulate drift.
4. Recover renamed resource with state mv.
5. Protect DB with lifecycle rule.

---

# Memory Review

## Beginner Recall

- What three realities does Terraform compare?
- Why read the plan before apply?

## Intermediate Recall

- Why is state sensitive?
- Why prefer for_each for named resources?

## Advanced Recall

- What is drift?
- Why separate prod state?
- Why CI-only apply?

## Production Recall

- How do you respond to unexpected database replacement?
- How do you handle stuck state lock safely?

---

# Senior Summary

> I treat Terraform as the source of truth for infrastructure, backed by remote locked state, PR-reviewed plans, CI-controlled applies, environment separation, and guardrails around destructive change. My focus is minimizing blast radius while keeping infrastructure reproducible and evolvable.
