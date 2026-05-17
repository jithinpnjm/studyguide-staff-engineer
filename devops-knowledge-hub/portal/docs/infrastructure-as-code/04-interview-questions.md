---
title: "Interview Questions"
sidebar_position: 4
---

# Infrastructure as Code — Interview Questions

Strong IaC answers explain state, blast radius, module design, plan review, import, drift, and safe automation. Weak answers only list Terraform commands.

---

## Core Concept Questions with Full Answers

### What is the difference between Terraform and Ansible? When do you use each?

Terraform provisions and manages the lifecycle of cloud infrastructure: it creates VMs, VPCs, databases, load balancers, and manages those objects over time. It is declarative and maintains state.

Ansible configures the systems Terraform creates: it installs packages, writes configuration files, manages users and services, and orchestrates multi-host deployments. It is agentless and connects over SSH.

They are complementary, not competing:
- Terraform creates an EC2 instance → Ansible configures it with nginx, app code, and monitoring agent
- Terraform creates an RDS cluster → application reads the connection string from Secrets Manager at runtime
- For a Kubernetes cluster: Terraform provisions EKS → Ansible configures bare-metal node prerequisites → Kubernetes runs workloads

Never use Ansible to create AWS VPCs or RDS clusters — the lifecycle management, state tracking, and dependency graph are Terraform's strengths. Never use Terraform to install packages on Linux hosts — OS-level idempotent configuration is Ansible's strength.

The rule: **Terraform for what exists, Ansible for how it behaves.**

---

### How does Terraform state work and what are the risks?

Terraform state is a JSON file that maps every resource block in `.tf` code to a real cloud resource identifier. When you run `terraform plan`, Terraform compares three things: what the code declares, what state says exists, and what the cloud API actually returns.

Without state, Terraform has no memory. It cannot know that `aws_vpc.main` corresponds to `vpc-0a1234567` in AWS. If you delete the state file, Terraform treats all existing resources as if they don't exist and would try to recreate them — potentially causing duplicates or conflicts.

**Risks:**
- State contains all resource attributes, including plaintext secrets from `random_password` resources, database credentials passed as variables, and TLS private keys from `tls_private_key` resources
- If multiple engineers apply simultaneously without locking, state can become corrupted — one apply overwrites another's changes
- Storing state in Git means secrets are exposed in version history
- Losing state for production infrastructure means manual reconciliation or import of every resource

**Production mitigations:**
- Remote backend (S3 + DynamoDB) for locking and shared access
- S3 versioning so state can be rolled back
- SSE-KMS encryption on the state bucket
- IAM access restricted to only those who need it
- Never commit `terraform.tfstate` to Git
- Back up state before any manual state surgery

---

### Walk me through a `terraform plan` that showed an unexpected destroy. What do you do?

First: do not apply. A `plan` showing unexpected destruction is an emergency stop, not a prompt.

Investigation steps:

```bash
# 1. Look at what exactly is being destroyed
terraform plan 2>&1 | grep -E "^  -|will be destroyed|must be replaced"

# 2. Check recent code changes
git diff HEAD~1..HEAD -- '*.tf'

# 3. Look at the resource in state to understand current recorded state
terraform state show aws_db_instance.orders

# 4. Check if the address changed (common cause of unexpected destroy)
terraform state list | grep orders
```

Common causes of unexpected destroy:
- **Address renamed**: resource `aws_s3_bucket.logs` renamed to `aws_s3_bucket.app_logs` — Terraform destroys old, creates new. Fix: `moved` block or `terraform state mv`
- **Module source changed**: upgrading a module version that renames internal resources. Fix: `moved` blocks in module or `terraform state mv`
- **Variable changed**: a variable like `environment` that's embedded in `bucket = "company-${var.environment}-logs"` changed from `prod` to `production` — bucket name changes, which is immutable. Fix: revert variable or add `lifecycle { create_before_destroy = true }`
- **Provider behavior change**: provider upgrade changed whether an attribute forces replacement. Fix: read provider changelog, use lifecycle `ignore_changes` if needed
- **Resource removed from code**: someone deleted a resource block. Fix: add back the block or use `terraform state rm` if intentional deletion

Response after identifying cause:
1. If it should not be destroyed: fix code to avoid it
2. If deletion is intentional but timing is wrong: add `prevent_destroy` until a maintenance window
3. If deletion is correct: confirm backup/recovery path exists before approving

---

### How do you structure Terraform for 10 teams across 3 AWS accounts?

This is a staff-level design question. The answer covers accounts, state boundaries, module governance, and CI.

**Account structure:**

```text
AWS Organization
  Management account (billing, SCPs, org-level controls)
  Platform-prod account (shared infrastructure: EKS, networking)
  App-prod account (application teams' resources)
  Data-prod account (data infrastructure: RDS, Kafka, Redshift)
  (staging and dev mirror the same structure)
```

**State boundaries per account (blast radius control):**

```text
platform-prod/
  networking/         # VPC, subnets, TGW — networking team
  security/           # KMS, security groups, IAM roles — security team
  kubernetes/         # EKS cluster — platform team
  shared-databases/   # shared PostgreSQL — platform team

app-prod/
  orders-service/     # orders team
  payments-service/   # payments team
  notifications/      # notifications team
```

**Module governance:**
- Platform team maintains a module registry (`github.com/company/terraform-modules`)
- Modules are versioned with semantic versioning
- Teams reference specific versions (`?ref=v2.0.0`), not `main`
- Breaking changes go through a deprecation process

**CI/CD:**
- Atlantis or a GitHub Actions workflow runs `terraform plan` on every PR
- `apply` requires PR approval from the infrastructure owner
- Apply identity uses least-privilege IAM roles per account (assume-role from CI)
- Each account has a dedicated apply role with only the permissions needed for that account's resources

**Cross-account access:**
- Platform account publishes VPC IDs, subnet IDs to SSM Parameter Store
- App account reads those parameters at plan time via `data "aws_ssm_parameter"`
- This avoids `terraform_remote_state` cross-account references which require complex IAM

**Who can touch what:**
- Platform team: networking, security, kubernetes, shared databases
- App teams: their own service directory in app-prod
- No team can modify another team's state
- No team can directly edit production — all changes via PR + Atlantis

---

### What is the difference between `count` and `for_each`?

Both create multiple instances of a resource, but they index them differently.

`count` uses integer indices:

```hcl
resource "aws_security_group" "app" {
  count  = 3
  name   = "app-${count.index}"
  vpc_id = aws_vpc.main.id
}
# Addresses: aws_security_group.app[0], app[1], app[2]
```

Problem: if you remove the middle element from a list, all subsequent elements renumber. Terraform sees the renamed addresses and destroys/recreates them.

`for_each` uses string keys:

```hcl
variable "environments" {
  default = {
    dev     = "10.0.1.0/24"
    staging = "10.0.2.0/24"
    prod    = "10.0.3.0/24"
  }
}

resource "aws_subnet" "env" {
  for_each = var.environments

  vpc_id     = aws_vpc.main.id
  cidr_block = each.value
  tags       = { Name = each.key }
}
# Addresses: aws_subnet.env["dev"], aws_subnet.env["staging"], aws_subnet.env["prod"]
```

Removing `"staging"` from the map only destroys `aws_subnet.env["staging"]`. `dev` and `prod` are unaffected.

**Rule:** use `count` only when creating N identical things where position doesn't matter. Use `for_each` whenever instances have distinct identities — which is almost always.

---

### How do you handle secrets in Terraform?

**What NOT to do:**

```hcl
# WRONG — hardcoded secret in code
resource "aws_db_instance" "main" {
  password = "supersecret123"   # committed to Git, appears in state
}

# WRONG — secret in tfvars file committed to Git
# terraform.tfvars:
# db_password = "supersecret123"
```

**What to do:**

Pattern 1 — create the secret container in Terraform, populate value outside:

```hcl
resource "aws_secretsmanager_secret" "db" {
  name = "prod/orders/database"
}
# Then populate via AWS CLI, SDK, or a separate process — not Terraform
# The secret value never enters Terraform state
```

Pattern 2 — use `sensitive = true` and accept state risk (manage the state bucket security):

```hcl
variable "db_password" {
  type      = string
  sensitive = true  # hides from terminal output but NOT from state
}
```

Pass via environment variable (never in tfvars committed to git):

```bash
export TF_VAR_db_password="$(aws secretsmanager get-secret-value \
  --secret-id prod/orders/db --query SecretString --output text)"
terraform apply
```

Pattern 3 — Vault provider:

```hcl
data "vault_generic_secret" "db" {
  path = "secret/prod/orders/database"
}

resource "aws_db_instance" "main" {
  password = data.vault_generic_secret.db.data["password"]
  # Still ends up in state — mitigate by encrypting state bucket with KMS
}
```

Summary: prefer creating secret containers in Terraform and populating values through AWS Secrets Manager directly. Encrypt state at rest with KMS. Restrict state bucket IAM access to a minimal set of principals.

---

### How do you test infrastructure code?

Multiple layers:

**Static analysis (fastest — run on every commit):**

```bash
terraform fmt -check -recursive     # formatting
terraform validate                   # syntax and type checking
tflint                               # best practices linting
checkov -d .                         # security policy checks
tfsec .                              # Terraform security scanner
```

**Plan-based tests (run on PR):**

```bash
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary > tfplan.json
# Then run conftest or OPA policies against tfplan.json
conftest test tfplan.json --policy policies/
```

**Integration tests with Terratest (Go):**

```go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestVPCModule(t *testing.T) {
    opts := &terraform.Options{
        TerraformDir: "../modules/vpc",
        Vars: map[string]interface{}{
            "name":        "test-vpc",
            "environment": "test",
        },
    }
    defer terraform.Destroy(t, opts)
    terraform.InitAndApply(t, opts)

    vpcID := terraform.Output(t, opts, "vpc_id")
    assert.NotEmpty(t, vpcID)
}
```

**Ansible role tests (molecule):**

```bash
cd roles/nginx
molecule test
# runs: lint -> create -> converge -> idempotency -> verify -> destroy
```

**Cost estimation (optional but powerful):**

```bash
infracost breakdown --path .
# Shows estimated monthly cost change from the plan
# Can fail CI if cost increase exceeds a threshold
infracost comment github --path . --repo $GITHUB_REPO --pull-request $PR_NUMBER
```

---

### Ansible playbook is not idempotent — how do you fix it?

Idempotency means running the same playbook twice produces the same result. Non-idempotent playbooks report changes on every run even when nothing needs to change.

**Find the offending task:**

```bash
# Run in check mode with diff to see what changes every run
ansible-playbook site.yml --check --diff

# Look for tasks that always show "changed"
```

**Common causes and fixes:**

`shell:` or `command:` without state awareness:

```yaml
# Non-idempotent — runs on every execution
- name: Create user
  ansible.builtin.shell: useradd appuser

# Idempotent — uses module that checks state
- name: Create user
  ansible.builtin.user:
    name: appuser
    state: present
```

`shell:` with `creates:`:

```yaml
# Runs only if the file doesn't exist
- name: Extract archive
  ansible.builtin.shell: tar xzf /tmp/app.tar.gz -C /opt/app
  args:
    creates: /opt/app/bin/app
```

`command:` with `changed_when: false`:

```yaml
# Always runs but never reports changed (for read-only commands)
- name: Get current status
  ansible.builtin.command: systemctl is-active myapp
  register: service_status
  changed_when: false
  failed_when: false
```

Custom `changed_when` for a command that modifies state:

```yaml
- name: Run database migration
  ansible.builtin.command: /usr/local/bin/migrate --db prod
  register: migration_result
  changed_when: "'Applied' in migration_result.stdout"
  failed_when: migration_result.rc != 0
```

Template with timestamp (breaks idempotency):

```yaml
# Template includes {{ ansible_date_time.iso8601 }} — changes every run
# Fix: remove timestamp from template, or use a content hash
```

---

### What is Ansible Vault and when do you use it?

Ansible Vault encrypts sensitive data (passwords, API keys, certificates) stored in YAML files that are committed to Git. Without Vault, committing secrets to Git exposes them permanently in history.

Use Vault for:
- Database passwords in `group_vars/`
- API keys for monitoring or notification services
- TLS private keys in role `files/`
- Any value that should not be visible to everyone with Git access

How it works:
- The file is encrypted with AES256 using a symmetric vault password
- The vault password itself is stored outside Git (CI secret, AWS Secrets Manager, a password file on disk not committed)
- When running a playbook, Ansible decrypts the file in memory using the vault password

Two-variable convention:

```yaml
# group_vars/all/vars.yml (unencrypted — visible to all)
db_password: "{{ vault_db_password }}"

# group_vars/all/secrets.yml (encrypted with vault)
vault_db_password: "the-actual-password"
```

This way, reviewing `vars.yml` shows what variables exist without revealing values. The `vault_` prefix signals "this value lives in vault."

For CI: store the vault password in the CI secrets manager (GitHub Actions secret, HashiCorp Vault, AWS Secrets Manager), write it to a temp file, and pass `--vault-password-file /tmp/vault-pass` to `ansible-playbook`.

---

### How do you roll back a bad Terraform apply?

Rollback options depend on what was changed and whether resources are stateful.

**Option 1: Revert the code and apply the previous state**

```bash
# 1. Revert the bad code change
git revert HEAD
# 2. Apply the reverted code — this returns infrastructure to previous config
terraform apply
```

This works for attribute changes (scaling, security group rules, tags) but not for resource deletions.

**Option 2: Restore from state backup**

```bash
# 1. Download the previous state version from S3
aws s3api get-object \
  --bucket company-terraform-state \
  --key prod/network/terraform.tfstate \
  --version-id <previous-version-id> \
  state-backup.json

# 2. Review the backup state to understand what it contains
cat state-backup.json | python3 -m json.tool | head -100

# 3. Push the previous state back (dangerous — confirm no concurrent activity)
terraform state push state-backup.json

# 4. Apply with the reverted code to reconcile
terraform apply
```

**Option 3: Targeted destroy + recreate**

```bash
# If only specific resources are wrong, target them
terraform destroy -target=aws_security_group.app
terraform apply -target=aws_security_group.app
```

**Option 4: Import the pre-existing resource**

If you accidentally created a duplicate or the wrong version of a resource and the original still exists:

```bash
# Remove the wrong one from state
terraform state rm aws_db_instance.orders

# Import the correct one
terraform import aws_db_instance.orders correct-db-identifier

# Verify plan is clean
terraform plan
```

**What you cannot roll back automatically:**
- Deleted data (RDS snapshots are your only option — take one before any plan that touches databases)
- Consumed Kafka offsets
- Written S3 objects

The lesson: take a manual snapshot of stateful resources before any destructive plan, even if `prevent_destroy` is set.

---

### What is Terragrunt and why would you use it?

Terragrunt is a thin Terraform wrapper that solves two specific problems: DRY backend/provider configuration and running multiple stacks together.

Without Terragrunt, every environment directory repeats the same backend config:

```hcl
# envs/prod/networking/backend.tf
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "prod/networking/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# envs/prod/kubernetes/backend.tf — same except key
# envs/staging/networking/backend.tf — same except key
# etc. — repeated across 20+ directories
```

With Terragrunt, one root `terragrunt.hcl` defines the backend template:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket         = "company-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

Each child directory has just:

```hcl
include "root" {
  path = find_in_parent_folders()
}
```

Additionally, `terragrunt run-all plan` plans all stacks in a directory tree in the correct dependency order, which is useful for seeing the full blast radius of a change.

Use Terragrunt when you have many environments (5+) with repeated backend configuration, or when you need to orchestrate applies across many stacks.

---

### How do you prevent Terraform from destroying production resources?

**Layer 1: `lifecycle.prevent_destroy`**

```hcl
resource "aws_db_instance" "orders" {
  identifier = "orders-prod"

  lifecycle {
    prevent_destroy = true
  }
}
# Running terraform destroy or removing this resource block will error
```

**Layer 2: State separation**

Put critical resources in their own state with narrow IAM access. If the apply role for the application stack doesn't have permission to modify the networking stack's state, it physically cannot destroy VPCs.

**Layer 3: AWS SCPs (Service Control Policies)**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyDeleteRDS",
    "Effect": "Deny",
    "Action": [
      "rds:DeleteDBInstance",
      "rds:DeleteDBCluster"
    ],
    "Resource": "*",
    "Condition": {
      "StringEquals": {
        "aws:ResourceTag/Environment": "prod"
      }
    }
  }]
}
```

**Layer 4: Atlantis apply requirements**

```yaml
# atlantis.yaml
projects:
  - name: prod-databases
    apply_requirements:
      - approved          # requires PR approval
      - mergeable         # PR must be mergeable
```

Add a rule that plans containing `-` (destroy) require additional approval from a second team.

**Layer 5: Plan review in CI**

```bash
# Fail CI if plan contains any destroy actions for critical resource types
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary | \
  jq '.resource_changes[] | select(.change.actions | contains(["delete"])) | .address' | \
  grep -E "aws_db_instance|aws_vpc|aws_eks_cluster" && \
  echo "CRITICAL RESOURCE DELETION DETECTED — manual review required" && exit 1
```

---

### Mock Interview Q&A from SRE Foundations

**Q: How do you run Terraform safely in production?**

> PR-based plans via Atlantis or GitHub Actions. No local production applies. Short-lived credentials using OIDC — no long-lived AWS keys in CI secrets. Plan artifact stored between plan and apply steps so the exact plan that was reviewed is what gets applied. Apply gated behind PR approval. Separate plan identity (read-only) from apply identity (narrowly scoped write). State in S3 with DynamoDB locking, KMS encryption, versioning enabled. Drift detection job runs nightly and pages if prod drifts from code.

**Q: Why is `-/+` in a plan dangerous?**

> `-/+` means Terraform will destroy the old resource and create a new one. For stateful resources like databases, this means data loss unless you have a migration path. For network resources like security groups or subnets, it means a brief outage while dependents lose their reference. For resources like EC2 instances, IP addresses change. The blast radius depends on what depends on the replaced resource. I always stop at `-/+` on any stateful or network-critical resource and investigate why replacement is happening.

**Q: What is Ansible's idempotency and why does it matter?**

> Idempotency means running the same playbook twice produces the same result and no unnecessary changes. It matters because automated remediation, drift correction, and scheduled runs all depend on it — if a playbook isn't idempotent, running it as a remediation job makes things worse. The core of idempotency in Ansible is using modules instead of shell commands: the `apt` module checks whether a package is already installed before running `apt install`; the `template` module checks whether the rendered file matches the template before writing it. When I must use `shell` or `command`, I always add `creates:` or `changed_when:` to maintain idempotency tracking.

---

## Beginner Questions

### What is Infrastructure as Code?

IaC is managing infrastructure through version-controlled configuration files rather than manual actions. It makes infrastructure reproducible, reviewable, auditable, and easier to recover.

### What is Terraform?

Terraform is a declarative IaC tool that uses providers to manage infrastructure across cloud platforms and other APIs. You write desired state in HCL, run a plan, then apply changes.

### What is the Terraform workflow?

```text
write -> init -> fmt -> validate -> plan -> apply -> output
```

### What is Terraform state?

State maps Terraform resource addresses to real infrastructure objects. Without state, Terraform does not know what it manages.

### Why should state not be committed to Git?

State may contain sensitive values and is constantly changing. Teams should use remote state with access control and locking.

---

## Terraform Core Questions

### Provider vs resource?

A provider is the plugin that talks to an API. A resource is a managed object created or updated through that provider.

### Variable vs output?

A variable is input to a configuration. An output exposes useful values after apply.

### What is a module?

A module is a reusable Terraform package. Root modules call child modules to standardize infrastructure patterns.

### What is `terraform plan`?

A preview of intended changes. It shows creates, updates, replacements, and destroys before apply.

### What does `terraform import` do?

It associates an existing real-world resource with a Terraform address in state. You must still write matching HCL.

---

## State And Environment Questions

### How do you manage multiple environments?

Use separate state per environment, environment-specific variables, and reusable modules. Workspaces can work for similar environments, but folders and separate states are often clearer for production.

### How do you manage state securely?

Use a remote backend, encryption, state locking, access control, versioning, and limited read access. Treat state as sensitive metadata.

### What is state locking?

A mechanism that prevents two Terraform runs from modifying the same state at the same time.

### What is drift?

Drift is when real infrastructure differs from Terraform code and state. It can happen through manual changes, external controllers, provider changes, or emergency fixes.

### How do you handle drift?

Classify whether code or infrastructure is correct. Then update code, revert the manual change, import missing resources, or adjust ignore rules carefully.

---

## Module And Design Questions

### How do you structure Terraform for a large organization?

Use shared modules, environment folders, separate states, controlled apply pipelines, policy-as-code, documentation, and versioned module releases.

### What makes a good Terraform module?

Clear inputs, safe defaults, useful outputs, examples, versioning, minimal hidden behavior, and built-in platform standards.

### Why avoid referencing module `main` directly?

Because module behavior can change without review. Use version tags to make upgrades intentional.

### What are good module defaults?

Encryption enabled, required tags, private networking, backups where applicable, logging enabled, and narrow access by default.

---

## Advanced Terraform Questions

### When use `depends_on`?

Only when Terraform cannot infer a dependency from references, such as side effects from `null_resource`, provisioners, or external systems.

### When use `ignore_changes`?

When another system legitimately owns a field. Use it sparingly because it can hide real drift.

### When use `prevent_destroy`?

For critical resources such as production databases, state buckets, and KMS keys where accidental deletion would be severe.

### How do you refactor resources safely?

Use `moved` blocks or `terraform state mv`, then confirm the plan shows no replacement or destruction.

### What is the risk of `terraform apply -target`?

It applies only part of the graph and can leave dependencies inconsistent. Use it rarely for recovery or controlled exceptional cases.

---

## Ansible Questions

### What is Ansible?

Ansible is an agentless automation tool for host configuration, provisioning, deployment, and orchestration. It usually connects over SSH and runs tasks on managed hosts.

### What is an inventory?

Inventory defines the hosts and groups Ansible manages. It can be static or dynamic from a cloud API.

### What is a playbook?

A YAML file describing tasks to run on selected hosts.

### What is idempotency?

Running the same automation repeatedly should converge to the same result without unnecessary changes or damage.

### Why prefer modules over shell commands?

Modules understand system state and are usually idempotent. Shell commands are harder to reason about and may run every time.

### What are handlers?

Handlers run only when notified, often to restart or reload a service after configuration changes.

---

## Scenario Questions

### Terraform plan wants to replace a production database. What do you do?

Stop. Identify why replacement is proposed. Check schema changes, provider changes, lifecycle settings, renamed resources, and state address changes. Use `prevent_destroy` for critical resources and never approve destructive replacement without a recovery plan.

### A resource was created manually. How do you bring it under Terraform?

Write a matching resource block, import it, run plan, adjust configuration until no unexpected changes remain, then commit the code and document ownership.

### Two engineers ran apply at the same time. What should have prevented this?

Remote state locking. For AWS, S3 backend with DynamoDB locking is a common pattern.

### Ansible playbook restarts all web servers at once. How do you reduce risk?

Use `serial`, health checks, handlers, and rolling batches. Avoid restarting all hosts simultaneously in production.

### A Terraform module change breaks many teams. What went wrong?

The module was treated as an internal script instead of a versioned platform product. Use semantic versioning, release notes, examples, and canary adoption.

---

## Staff-Level Questions

### How do you design an IaC platform for many teams?

Provide golden modules, remote state standards, CI plan/apply workflow, policy-as-code, drift detection, documentation, and clear ownership. Teams consume safe defaults and request exceptions when needed.

### What should be centralized?

State backend patterns, module registry, policy checks, account/project vending, networking baselines, tagging, and production apply controls.

### What should be delegated?

Application-level infrastructure parameters, service-specific scaling, non-production experimentation, and ownership of service modules within platform guardrails.

### What are unhealthy IaC signals?

Manual console changes are common, plans are too large to review, state is shared too broadly, modules have no versions, production applies happen from laptops, and drift is ignored.
