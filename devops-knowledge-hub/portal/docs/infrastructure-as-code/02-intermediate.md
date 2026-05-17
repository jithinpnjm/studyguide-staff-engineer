---
title: "Intermediate"
sidebar_position: 2
---

# Infrastructure as Code — Intermediate

Intermediate IaC is about making infrastructure changes safe for teams: remote state, module structure, environment layout, drift management, CI/CD plans, secrets handling, and operational guardrails.

---

## Production Terraform Workflow

A mature Terraform workflow looks like this:

```text
pull request
  -> terraform fmt
  -> terraform validate
  -> static checks
  -> terraform plan
  -> human review
  -> apply from controlled runner
  -> observe drift and outputs
```

Do not let engineers apply production changes from random laptops. Production applies should happen from a controlled environment with consistent provider versions, credentials, audit logs, and state locking.

---

## Environment Structure

Two common Terraform layouts exist.

### Layout 1: Environment Folders

```text
infra/
  modules/
    vpc/
    rds/
    eks/
  envs/
    dev/
      main.tf
      terraform.tfvars
    staging/
      main.tf
      terraform.tfvars
    prod/
      main.tf
      terraform.tfvars
```

Benefits:

- Clear state separation.
- Easy environment-specific changes.
- Simple access control.
- Production can be protected more strongly.

### Layout 2: Workspaces

```bash
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod
terraform workspace select prod
```

Workspaces can be useful for similar environments, but they can hide environment differences if overused. For production systems, separate folders and separate state are often easier to reason about.

---

## Remote State And Locking

State is a production dependency. It must be remote, encrypted, access-controlled, and locked.

AWS backend example:

```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "prod/network/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

State practices:

- One state per environment or stack.
- Do not share one giant state for everything.
- Restrict who can read production state.
- Enable versioning on the state bucket.
- Lock state to prevent concurrent applies.
- Avoid storing secrets directly in state where possible.

---

## Module Design

Modules are how platform teams encode standards.

A good module has:

```text
clear inputs
safe defaults
useful outputs
versioned releases
examples
documentation
minimal hidden behavior
```

Example module call:

```hcl
module "rds" {
  source = "git::https://github.com/company/terraform-modules.git//rds?ref=v1.4.2"

  name                  = "orders-prod"
  engine                = "postgres"
  instance_class        = "db.t4g.medium"
  multi_az              = true
  backup_retention_days = 7
}
```

Use module versions. Referencing `main` directly makes production changes unpredictable.

---

## Terraform Dependency Graph

Terraform usually infers dependencies from references.

```hcl
resource "aws_subnet" "private" {
  vpc_id = aws_vpc.main.id
}
```

Here, subnet depends on VPC because it references `aws_vpc.main.id`.

Use explicit `depends_on` only when Terraform cannot infer the dependency.

```hcl
resource "aws_instance" "app" {
  ami           = var.ami
  instance_type = "t3.micro"

  depends_on = [null_resource.bootstrap_dependency]
}
```

Overusing `depends_on` can make plans harder to understand.

---

## Lifecycle Controls

Terraform lifecycle rules control replacement behavior.

```hcl
resource "aws_db_instance" "main" {
  identifier = "orders-prod"

  lifecycle {
    prevent_destroy = true
  }
}
```

Common lifecycle settings:

| Setting | Use case |
|---|---|
| `prevent_destroy` | Protect critical resources |
| `ignore_changes` | Ignore fields managed elsewhere |
| `create_before_destroy` | Reduce downtime during replacement |
| `replace_triggered_by` | Replace when a related object changes |

Use `ignore_changes` sparingly. It can hide real drift.

---

## Terraform Import

Import brings existing infrastructure under Terraform state.

```bash
terraform import aws_s3_bucket.logs company-logs-prod
terraform state list
terraform plan
```

Import does not automatically write perfect HCL. After import, you must write configuration that matches the real resource.

Safe import process:

```text
write approximate resource block
terraform import
terraform plan
adjust config until plan is clean
commit code and state change process
```

---

## State Operations

State commands are powerful and dangerous.

```bash
terraform state list
terraform state show aws_s3_bucket.logs
terraform state mv aws_s3_bucket.old aws_s3_bucket.new
terraform state rm aws_s3_bucket.unmanaged
terraform state pull
```

Rules:

- Back up state before manual state edits.
- Never edit state casually.
- Use state operations during refactors and imports.
- Pair state changes with code changes.
- Record why the state operation was needed.

---

## Secrets In IaC

Do not hardcode secrets in `.tf` or `.tfvars` files.

Better patterns:

- Reference existing secret IDs, not secret values.
- Use cloud secret managers.
- Use CI/CD secret injection for runtime variables.
- Use SOPS or Vault where appropriate.
- Mark outputs as sensitive when needed.

Example:

```hcl
output "db_password" {
  value     = random_password.db.result
  sensitive = true
}
```

Sensitive outputs still exist in state. Treat state as sensitive.

---

## Policy-As-Code

Policy-as-code checks infrastructure before apply.

Common checks:

- S3 buckets must not be public.
- Databases must not be public.
- Encryption must be enabled.
- Required tags must exist.
- Instance types must be approved.
- Security groups must not allow broad admin access.

Tools:

```text
OPA/Conftest
Checkov
tfsec
TFLint
Sentinel
Cloud provider policy systems
```

---

## Ansible Intermediate Patterns

Ansible is strongest when playbooks are idempotent.

Good task:

```yaml
- name: Ensure nginx is installed
  ansible.builtin.package:
    name: nginx
    state: present
```

Risky task:

```yaml
- name: Install nginx manually
  ansible.builtin.shell: apt-get install -y nginx
```

Prefer modules over raw shell commands because modules understand state.

---

## Ansible Roles

Roles organize playbooks into reusable units.

```text
roles/
  nginx/
    tasks/main.yml
    handlers/main.yml
    templates/nginx.conf.j2
    defaults/main.yml
    vars/main.yml
```

Use roles for common patterns: users, packages, logging agents, monitoring agents, hardening, nginx, docker, kubelet prerequisites.

---

## Intermediate Takeaways

1. Remote state and locking are mandatory for teams.
2. Environment folders are often clearer than workspaces for production.
3. Modules encode standards but must be versioned.
4. State operations require backups and discipline.
5. `ignore_changes` can hide drift.
6. Policy-as-code catches unsafe infrastructure before apply.
7. Ansible playbooks should be idempotent.
8. Use modules and roles instead of unstructured scripts.
