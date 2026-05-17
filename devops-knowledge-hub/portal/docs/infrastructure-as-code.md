---
title: "🏗️ Infrastructure as Code"
sidebar_position: 5
description: "Zero to hero study guide for Infrastructure as Code — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

Infrastructure as Code is the discipline of managing infrastructure through version-controlled, human-readable configuration files. For a Staff/Principal engineer, IaC is not just a tool choice — it is the foundation of reproducibility, auditability, and scalable operations. Without IaC, every environment is a unique snowflake, every incident involves "what changed?", and scaling the team means scaling toil.

Business outcomes:
- **Reproducibility** — spin up an identical environment in minutes, not weeks
- **Audit trail** — every infrastructure change is a reviewed Git commit
- **Disaster recovery** — rebuild infrastructure from code if needed
- **Cost reduction** — ephemeral environments, automated cleanup, right-sizing at provisioning time

---

## 📋 Prerequisites & Mental Models

**Desired state declarative model** — you describe WHAT you want, not HOW to get there. Terraform figures out the diff between current state and desired state and executes the minimal set of changes. This is the opposite of imperative scripting.

**State is the source of truth** — the Terraform state file maps your declared resources to real infrastructure. State drift (real infrastructure diverges from state) is the primary operational hazard. Treat state files as critical data.

**Idempotency** — running `terraform apply` twice with no changes to configuration should result in no changes to infrastructure. All good IaC is idempotent.

**Modules as APIs** — a Terraform module is an API contract. The inputs are parameters, the outputs are return values. Good module design hides implementation details and exposes only what callers need.

---

## 🔷 Core Concepts

### Terraform Fundamentals

**Providers** — plugins that interact with APIs (AWS, GCP, Azure, Kubernetes, GitHub). Configured in `required_providers` block.

**Resources** — the fundamental unit. Each resource represents one infrastructure object:
```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.medium"
  tags = { Name = "web-server", Environment = "production" }
}
```

**Data Sources** — read-only queries to existing infrastructure or external data:
```hcl
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-*-22.04-amd64-server-*"]
  }
}
```

**Variables** — parameterize configurations:
```hcl
variable "instance_count" {
  type        = number
  description = "Number of web instances"
  default     = 2
  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 10
    error_message = "Must be between 1 and 10."
  }
}
```

**Outputs** — expose values from a module or root configuration:
```hcl
output "load_balancer_dns" {
  value       = aws_lb.main.dns_name
  description = "DNS name of the load balancer"
}
```

**Locals** — intermediate computations:
```hcl
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
  name_prefix = "${var.project_name}-${var.environment}"
}
```

### Terraform State

The state file (`terraform.tfstate`) is the mapping from your configuration to real infrastructure resource IDs. Critical properties:
- Contains sensitive data (database passwords, private keys) — never commit to Git
- Must be shared across the team — use remote backends (S3+DynamoDB, Terraform Cloud, GCS)
- Locking prevents concurrent applies — DynamoDB table for S3 backend, built-in for Terraform Cloud

**Remote state backend:**
```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "production/networking/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

**State operations:**
- `terraform state list` — list resources in state
- `terraform state show aws_instance.web` — show resource details
- `terraform state mv` — rename resources without destroying (after refactoring)
- `terraform state rm` — remove from state without destroying (for resources managed elsewhere)
- `terraform import` — bring existing resource under Terraform management

### Terraform Modules

Modules are reusable, composable infrastructure components. Structure:
```
modules/
  vpc/
    main.tf      # resource definitions
    variables.tf # input parameters
    outputs.tf   # return values
    versions.tf  # provider constraints
    README.md
```

Calling a module:
```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "production-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false  # HA: one per AZ
}
```

**Module registry:** Terraform Registry hosts community modules (terraform-aws-modules is the gold standard for AWS). Always pin to a specific version.

### Workspaces

Workspaces provide isolated state for the same configuration. Useful for ephemeral environments:
```bash
terraform workspace new feature-branch-123
terraform workspace select production
terraform workspace list
```

Limitation: workspaces share the same backend, variables, and code. For true environment isolation with different variables and providers, use separate state keys (directories) instead.

### Terraform Workflow

```bash
terraform init          # download providers, modules, init backend
terraform validate      # syntax + basic validation
terraform plan          # show what will change (always review before apply)
terraform apply         # apply with confirmation prompt
terraform apply -auto-approve  # skip prompt (CI only)
terraform destroy       # destroy all resources (dangerous)
```

### Ansible

Configuration management and orchestration tool. Agentless (uses SSH/WinRM). YAML-based playbooks.

**When to use Ansible vs Terraform:**
- Terraform: provisioning infrastructure (VMs, networks, databases)
- Ansible: configuring software on provisioned infrastructure (install packages, configure services, deploy apps)
- Use both together: Terraform provisions, Ansible configures

**Playbook structure:**
```yaml
---
- name: Configure web servers
  hosts: webservers
  become: yes
  vars:
    nginx_port: 8080

  tasks:
  - name: Install Nginx
    package:
      name: nginx
      state: present

  - name: Copy config
    template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
    notify: Restart Nginx

  handlers:
  - name: Restart Nginx
    service:
      name: nginx
      state: restarted
```

**Key Ansible concepts:**
- **Inventory** — defines what hosts to manage (static file or dynamic inventory from AWS/GCP)
- **Roles** — reusable, composable units of configuration (like Terraform modules)
- **Idempotency** — Ansible modules check current state before making changes
- **Handlers** — triggered by `notify`, run at the end of the play, deduplicated
- **Vault** — encrypt sensitive variables in YAML files

---

## 🛠️ Tools & Ecosystem

| Tool | Purpose |
|------|---------|
| Terraform | Multi-cloud IaC, declarative |
| OpenTofu | Open-source Terraform fork (post-BSL change) |
| Pulumi | IaC with real programming languages (Python, Go, TypeScript) |
| AWS CDK | IaC for AWS using TypeScript/Python/Java |
| Ansible | Configuration management, agentless |
| Terragrunt | Terraform wrapper for DRY configurations across environments |
| tfsec / Checkov | IaC security scanning |
| Infracost | Cost estimation before applying |
| Atlantis | GitOps for Terraform (PR-triggered plans, auto-applies) |
| Terratest | Infrastructure testing in Go |
| pre-commit-terraform | Pre-commit hooks for formatting, validation, security |

---

## 🏗️ Architecture Patterns

### DRY Multi-Environment Structure

```
infrastructure/
  modules/
    vpc/          # reusable VPC module
    eks-cluster/  # reusable EKS module
    rds/          # reusable RDS module
  environments/
    production/
      main.tf     # calls modules with prod vars
      terraform.tfvars
    staging/
      main.tf     # same modules, different vars
      terraform.tfvars
    development/
      main.tf
```

Or with Terragrunt:
```
infrastructure/
  terragrunt.hcl          # root config: backend, providers
  production/
    vpc/terragrunt.hcl    # calls module, sets prod vars
    eks/terragrunt.hcl
  staging/
    vpc/terragrunt.hcl
```

### Module Design Principles

1. **Single responsibility** — a module does one thing (not "entire production stack")
2. **Stable API** — inputs/outputs rarely change; breaking changes require major version bump
3. **Sensible defaults** — most parameters should have safe defaults; callers override only what they need
4. **No hardcoded values** — every environment-specific value is a variable
5. **Document every variable** — description and type constraints are required

### GitOps for Terraform (Atlantis)

```
Developer:
  git push → opens PR → Atlantis runs `terraform plan` → posts plan as PR comment
  Team reviews plan output
  Approve PR → Atlantis runs `terraform apply`
  Merge PR (after apply succeeds)
```

Benefits: no local state, no manual applies, audit trail, least-privilege (only Atlantis needs cloud credentials).

---

## ⚙️ Production Operations

### Terraform at Scale

**State organization:** one state per logical unit (VPC, EKS cluster, application). Never one state for all infrastructure — state lock contention, blast radius, and planning time all scale badly.

**Plan review checklist:**
- `destroy` operations: expected? irreversible?
- Resource count changes: adding 100 VMs unexpectedly?
- Sensitive value changes: database passwords rotating?
- Provider version bumps: breaking changes?

**Drift detection:** run `terraform plan` in CI on a schedule (daily). Alert if plan shows changes (someone applied outside Terraform). Use `terraform refresh` carefully — it updates state from reality, which can mask problems.

### Terraform Upgrades

1. Test provider version bumps in dev first
2. Run `terraform init -upgrade` to pull new provider
3. Review breaking changes in provider changelog
4. Run plan and review carefully — resource re-creation is common on provider upgrades
5. Consider `lifecycle { prevent_destroy = true }` on critical resources

### Secrets in Terraform

Never store secrets in .tfvars files committed to Git. Options:
- **Vault provider** — read secrets from Vault at apply time
- **AWS SSM/Secrets Manager data source** — read from AWS at apply time
- **Environment variables** — `TF_VAR_db_password=$SECRET` in CI
- **Encrypted backend** — at minimum, S3 backend with encryption for state (contains secrets)

---

## 📊 Observability & Debugging

**Plan output interpretation:**
- `+` resource will be created
- `-` resource will be destroyed
- `~` resource will be updated in-place
- `-/+` resource will be destroyed and recreated (causes downtime!)

**Common errors:**
- `Error: Invalid provider configuration` → wrong region or missing credentials
- `Error acquiring the state lock` → another apply running or crashed; check DynamoDB lock table
- `ResourceNotFoundException` → resource in state but deleted outside Terraform; use `terraform state rm`
- `quota exceeded` → cloud service limit hit; request quota increase

**Debugging:** `TF_LOG=DEBUG terraform plan` — verbose logging shows API calls.

---

## 🔐 Security Considerations

### IaC Security Scanning

Run **tfsec** or **Checkov** in CI to catch:
- Security group allowing 0.0.0.0/0 on port 22
- S3 bucket without encryption
- RDS without Multi-AZ
- EC2 without IMDSv2 enforcement
- IAM policy with `*` actions

```yaml
# In GitHub Actions:
- name: Run tfsec
  uses: aquasecurity/tfsec-action@v1.0.0
  with:
    soft_fail: false  # fail the build on critical findings
```

### Least Privilege for Terraform

Terraform's IAM role needs broad permissions by nature (it creates infrastructure). Mitigate:
- Separate CI role per environment (prod Terraform role can't touch dev)
- SCPs limit what even Terraform can do (no `cloudtrail:DeleteTrail`)
- State backend access separate from apply permissions
- Use `plan` in PRs with a read-only role; `apply` in main branch with write role

---

## 🎓 Staff/Principal Engineer Perspective

**Module vs root configuration** — modules should be pure functions: given inputs, produce outputs, no side effects. Root configurations (environments) are the point of integration and should be thin wrappers.

**When to use Pulumi/CDK instead of Terraform:** when your infrastructure logic requires conditionals, loops, or abstractions that HCL makes awkward. TypeScript or Python gives you full language capabilities. Trade-off: more testing required, steeper learning curve.

**Terraform vs Ansible** — complementary, not competing. Terraform provisions, Ansible configures. The mistake is using Terraform for configuration management (provisioners are a code smell) or Ansible for infrastructure provisioning (not declarative).

**Dealing with legacy:** import existing infrastructure into Terraform state before starting to manage it (`terraform import`). Avoid the "manage in Terraform going forward" trap — you now have two sources of truth.

---

## 💥 Failure Modes & Incident Patterns

**State file corruption:** binary state corruption from abrupt process termination. Recover from S3 versioning (enable versioning on state bucket — mandatory). Never manually edit state files.

**Destroy on rename:** renaming a resource in Terraform (without `terraform state mv`) causes destroy + create. For databases, this is catastrophic. Always `state mv` before renaming. Add `lifecycle { prevent_destroy = true }` to critical resources.

**Provider API throttling:** Terraform makes many API calls during plan/apply. AWS rate limits can cause spurious failures. Solutions: provider `max_retries`, `sleep` calls via `time_sleep` resource, or parallelize across state files.

**Circular dependencies:** resource A depends on B, B depends on A. Terraform cannot resolve. Extract the circular dependency into a separate resource or use `depends_on` to break the cycle explicitly.

---

## 💼 Interview & Design Review Prep

**"How do you structure Terraform for 10 teams, 3 environments?"**
Separate state per team per environment. Shared modules in a registry. GitOps with Atlantis. Each team has its own IAM role. SCPs limit what any role can do. Module versioning with semantic versioning.

**"What is Terraform state and why does it matter?"**
State maps configuration to real resource IDs. Without state, Terraform cannot know what already exists. State can contain sensitive data — encrypt, back up, version. Corruption = manual recovery from AWS console.

**"How do you handle a Terraform destroy on a production database?"**
`lifecycle { prevent_destroy = true }` on the resource. Test with `terraform plan` — Terraform will error rather than show a destroy. Also: daily backups independent of Terraform, separate state for databases (reduces blast radius of apply mistakes).

---

## 📚 Key Takeaways

1. **Remote state is mandatory for teams** — local state causes conflicts and lost changes
2. **Always review plan output** — destroy operations and unexpected re-creations are easy to miss
3. **Modules have APIs** — treat them as such; version them, document them, test them
4. **`prevent_destroy` on critical resources** — databases, state buckets, production VPCs
5. **Never commit secrets** — use environment variables or Vault provider for sensitive values
6. **IaC security scanning in CI** — tfsec/Checkov catches misconfigurations before they reach cloud
7. **Separate state per logical unit** — one state for all prod = single point of failure + slow plans
8. **Terraform provisions, Ansible configures** — right tool for right job; don't mix roles
9. **Import before managing** — bring existing resources into state before touching them
10. **State bucket needs versioning** — your recovery path when state is corrupted
11. **Plan in PR, apply on merge** — GitOps pattern with Atlantis; no manual applies
12. **`terraform state mv` before renaming** — save yourself from destroying production databases
13. **Drift detection via scheduled plan** — catch out-of-band changes before they cause incidents
14. **Environments should be code-identical** — only variables differ between prod and staging
15. **Provider version pinning is mandatory** — unexpected provider upgrades break plans



---

## 📁 Source Documents

> 33 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [Ever tried creating 40+ resources in Terraform… manually?I did. And trust me — it wasn’t pretty.It started with a simple task:“Create multiple resourc](http://localhost:8765/api/documents/278c7c8d-27a5-4d0e-a207-13224c964e78/view) | PDF | intermediate |
| [🔷 Terraform Commands every Cloud & DevOps Engineer must know.I spent weeks figuring these out the hard way.So you don't have to. 👇Here's what's insi](http://localhost:8765/api/documents/a027f48c-1d68-48be-84ca-3e6dba73321e/view) | PDF | beginner |
| [[Terraform] 1717830360443](http://localhost:8765/api/documents/4c8ba86b-77d0-4a92-83d1-93f84fb633ec/view) | PDF | intermediate |
| [[Terraform] 1736593028339](http://localhost:8765/api/documents/70c9b615-363d-4508-b30c-48b59160aea8/view) | PDF | intermediate |
| [[Terraform] 1739757834489](http://localhost:8765/api/documents/a57a3d19-45c2-42fd-b637-893080fae455/view) | PDF | beginner |
| [[Terraform] 1740494163216](http://localhost:8765/api/documents/4a05c405-8b3d-4637-a0b1-fae7b8e18611/view) | PDF | intermediate |
| [[Terraform] 1740568379524](http://localhost:8765/api/documents/7194c138-4199-4e41-8d8f-6bdf558c4225/view) | JPG | intermediate |
| [[Terraform] 1740933815319](http://localhost:8765/api/documents/cb85e86e-ac47-47cc-be29-d1b22987866a/view) | GIF | intermediate |
| [[Terraform] 1740988836293](http://localhost:8765/api/documents/897459b7-00ed-41d7-ae55-038afc3697b0/view) | JPG | beginner |
| [[Terraform] 1741005142596](http://localhost:8765/api/documents/d07da1a2-1dfb-4d79-8acc-eb2a146729dd/view) | PDF | intermediate |
| [[Terraform] 1741083320866](http://localhost:8765/api/documents/54f73e2a-fc5b-45ab-baf2-95efa4e42c9a/view) | PDF | intermediate |
| [[Terraform] 1741199449054](http://localhost:8765/api/documents/9d3fcbd0-dbd9-41f7-9da3-226049e1e3a8/view) | PDF | beginner |
| [[Terraform] 1742329415810](http://localhost:8765/api/documents/fb705b97-997e-4f4a-b068-605ee311df36/view) | PDF | advanced |
| [[Terraform] 1742554001206](http://localhost:8765/api/documents/3ced7657-d5ad-4eb4-9c92-2f006511cbcb/view) | PDF | intermediate |
| [[Interview Ouestions > Terraform] 1742118855439](http://localhost:8765/api/documents/836b9728-8a3e-4402-99e5-fcbd253a1667/view) | PDF | intermediate |
| [[Interview Ouestions > Terraform] 1743042112556](http://localhost:8765/api/documents/9d7b5e4b-a689-4a6b-84c9-411b0964ddca/view) | PDF | intermediate |
| [[Interview Ouestions > Terraform] 1743698850584](http://localhost:8765/api/documents/a9d6f0b6-12c1-46da-a9e8-281e741f90d4/view) | PDF | intermediate |
| [[Ansible] 1742841059776](http://localhost:8765/api/documents/79568eb5-efed-482e-ad51-a82aa8fe71d6/view) | PDF | intermediate |
| [[Ansible] 1742962506665](http://localhost:8765/api/documents/95d3118e-fc5d-4d87-89b4-e3eaa6b1e292/view) | PDF | intermediate |
| [[Ansible] 1743103114439](http://localhost:8765/api/documents/00b9b043-d500-45bc-b905-f3710ad00a41/view) | PDF | intermediate |
| [[Ansible] 1745639523662](http://localhost:8765/api/documents/198bb52d-e2f2-4650-9e21-147b47ed95da/view) | PDF | intermediate |
| [[Ansible Project] 1742935190645](http://localhost:8765/api/documents/ab1ba151-1f1a-45f7-8e96-82f4ad64a1c3/view) | PDF | intermediate |
| [[Ansible] 1716535623125](http://localhost:8765/api/documents/ec4ca2a3-45a1-44bd-9758-f3c0ba9bfa59/view) | PDF | intermediate |
| [[Ansible] 1716550574444](http://localhost:8765/api/documents/42d94b8d-a7cb-453a-9d97-001555a909f4/view) | PDF | intermediate |
| [[Ansible] 1716969662087](http://localhost:8765/api/documents/c4912e44-5c0c-4a1e-96d6-431f0eab8697/view) | PDF | intermediate |
| [[Ansible] 1737026027284](http://localhost:8765/api/documents/df98f6fa-ac3b-4f32-a7f1-1dff55096827/view) | PDF | intermediate |
| [[Ansible] 1737034905202](http://localhost:8765/api/documents/f2112e8a-d135-4c22-9699-a1f50565cef8/view) | PDF | intermediate |
| [[Ansible] 1737467766708](http://localhost:8765/api/documents/12132481-2c93-4809-97fe-efe4634b10c4/view) | PDF | intermediate |
| [[Ansible] 1738957091302](http://localhost:8765/api/documents/168a1e97-5260-4b70-96b6-f2bf3cc691b9/view) | PDF | intermediate |
| [[Ansible] 1739454856220](http://localhost:8765/api/documents/1fb4de22-074b-4266-8eda-0ab8fa9eeb8c/view) | PDF | intermediate |
| [[Ansible] 1741161475316](http://localhost:8765/api/documents/64d4ab9f-9bce-4fd7-aab4-99c799a3c9ae/view) | PDF | intermediate |
| [[Ansible] 1742555646606](http://localhost:8765/api/documents/47c44c27-3129-48cf-8cc8-cdba0ade36c0/view) | JPG | intermediate |
| [[Ansible] 1742747990462](http://localhost:8765/api/documents/944b1f96-7071-414e-84e2-864ac11a1a72/view) | PDF | intermediate |


<AIChatWidget domain="infrastructure-as-code" title="Ask AI about Infrastructure as Code" />

---

## [SRE] Foundations: Terraform Premium Teaching Guide For SRE And Platform Engineers

## Foundations: Terraform Premium Teaching Guide For SRE And Platform Engineers

Terraform is infrastructure as code. It lets you define cloud and platform resources in version-controlled configuration instead of clicking through consoles.

For SRE and platform teams, Terraform is not just automation. It is a safety system for reviewability, repeatability, auditability, and disaster recovery.

This guide teaches Terraform from first principles to production-grade operating patterns.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — providers, resources, variables, plan/apply.
2. **Intermediate Layer** — modules, state, environments, imports.
3. **Advanced Layer** — lifecycle rules, drift, CI/CD, policy, scaling teams.
4. **Production SRE Layer** — safe change management and recovery.
5. **Interview Layer** — explain Terraform tradeoffs clearly.

---

## Memory Palace: Terraform Is A City Planner

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

## Beginner Layer: Terraform Mental Model

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

## Beginner Layer: First Workflow

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

## Beginner Layer: Providers And Resources

### Provider

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

### Resource

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

## Beginner Layer: Variables, Locals, Outputs

### Variables

Inputs to configuration.

### Locals

Computed reusable values.

### Outputs

Export values to humans or other layers.

```hcl
output "bucket_name" {
  value = aws_s3_bucket.logs.bucket
}
```

Outputs are contracts between modules and layers.

---

## Intermediate Layer: State Explained Properly

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

## Intermediate Layer: Reading Plans Safely

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

## Intermediate Layer: Modules

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

## Intermediate Layer: for_each vs count

Use `for_each` for named resources.

```hcl
for_each = var.subnets
```

Use `count` only when instances are identical.

Why?

Changing list order with `count` can recreate resources unexpectedly.

---

## Intermediate Layer: Data Sources

Read existing infrastructure without managing it.

```hcl
data "aws_vpc" "shared" {
  tags = { Name = "shared-vpc" }
}
```

Use when another team owns the resource.

---

## Advanced Layer: Imports And State Surgery

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

## Advanced Layer: Lifecycle Rules

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

## Advanced Layer: Drift

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

## Advanced Layer: Environment Strategy

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

## Advanced Layer: CI/CD For Terraform

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

## Advanced Layer: Policy And Guardrails

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

## Production SRE Layer: Incident Stories

### Plan Wants To Replace Database

Do not click apply.

Check:

- which attribute forces replacement
- migration path
- maintenance window
- lifecycle protection missing?

### State Lock Stuck

Likely interrupted apply.

Action:

- verify no active run
- inspect lock holder
- unlock carefully

### Console Hotfix Disappeared

Terraform reverted drift on next apply.

Fix:

- codify hotfix
- improve change process

### Giant Monolithic State Causes Fear

Fix:

- split by environment/layer/team

---

## Production SRE Layer: Troubleshooting By Symptom

### init fails

Check:

- credentials
- backend access
- provider registry reachability
- Terraform version

### plan shows unexpected destroy

Check:

- rename without moved block/state mv
- provider change
- state mismatch
- lifecycle removed

### apply fails midway

Check:

- partial real changes
- rerun plan before retry
- provider quota/rate limit
- dependency ordering

### access denied

Check:

- assumed role
- OIDC trust
- SCP/org policy
- provider config

---

## Interview Layer: Strong Answers

### Why Terraform over console clicks?

> Terraform makes infrastructure reviewable, reproducible, auditable, and recoverable through version-controlled code.

### Why remote state?

> Shared state enables collaboration, locking, backups, and consistent truth across engineers and CI systems.

### Why is `-/+` risky?

> It means replacement. Stateful or network resources may incur downtime, data migration risk, or identity changes.

### How would you run Terraform in production?

> PR-based plans, reviewed changes, CI-only applies, remote locked state, short-lived credentials, and guarded production approvals.

---

## Labs

### Beginner

1. Create a bucket or local_file resource.
2. Use variables and outputs.
3. Run full init/plan/apply/destroy cycle.

### Intermediate

1. Create reusable VPC module.
2. Split dev/prod states.
3. Import existing resource.
4. Use data sources.

### Advanced

1. Add CI plan workflow.
2. Add policy scan.
3. Simulate drift.
4. Recover renamed resource with state mv.
5. Protect DB with lifecycle rule.

---

## Memory Review

### Beginner Recall

- What three realities does Terraform compare?
- Why read the plan before apply?

### Intermediate Recall

- Why is state sensitive?
- Why prefer for_each for named resources?

### Advanced Recall

- What is drift?
- Why separate prod state?
- Why CI-only apply?

### Production Recall

- How do you respond to unexpected database replacement?
- How do you handle stuck state lock safely?

---

## Senior Summary

> I treat Terraform as the source of truth for infrastructure, backed by remote locked state, PR-reviewed plans, CI-controlled applies, environment separation, and guardrails around destructive change. My focus is minimizing blast radius while keeping infrastructure reproducible and evolvable.

---

## [SRE] Ansible and Host Automation

## Ansible and Host Automation

### What It Is and Why It Matters

Ansible is an agentless IT automation tool for configuration management, application deployment, and task orchestration. It connects to hosts via SSH, pushes configuration, and ensures state — no agent required on managed nodes.

Even in a Kubernetes-heavy environment, Ansible remains relevant: bare-metal nodes need configuration before Kubernetes can run on them, GPU drivers must be installed and maintained on hosts, Kafka and database clusters on VMs still need management, and there are always legacy systems that haven't been containerized.

Understanding Ansible — how it models state, how inventory works, how to write idempotent playbooks, and how to use it safely at scale — is a core platform engineering skill.

---

### Mental Model

Ansible operates on a **push model**: the control node (your machine or CI) runs playbooks that SSH into managed nodes and execute tasks. The key design principle is **idempotency**: running the same playbook twice produces the same result. Good Ansible is not a script — it's a declarative state description.

```
Ansible Control Node (laptop, CI runner, AWX)
    → SSH
    → Managed Node 1 (runs tasks, Python required)
    → Managed Node 2
    → Managed Node 3
```

No daemon, no agent. Ansible copies and executes a Python script on the target, cleans up after itself.

---

### Inventory

Inventory defines which hosts Ansible manages.

#### Static Inventory

```ini
# hosts.ini
[web]
web1.example.com
web2.example.com

[db]
db1.example.com ansible_user=postgres

[kubernetes:children]  # group of groups
web
db

[web:vars]
nginx_port=80
environment=prod

[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/id_ed25519
```

#### Dynamic Inventory

For cloud environments, use dynamic inventory plugins that query APIs:

```yaml
# aws_ec2.yml — AWS dynamic inventory
plugin: amazon.aws.aws_ec2
regions:
  - us-east-1
  - eu-west-1
filters:
  tag:Environment: prod
  instance-state-name: running
keyed_groups:
  - key: tags.Role
    prefix: role
  - key: placement.availability_zone
    prefix: az
hostnames:
  - private-ip-address   # use private IP for SSH
```

```bash
# Test dynamic inventory
ansible-inventory -i aws_ec2.yml --list

# Use it with a playbook
ansible-playbook -i aws_ec2.yml site.yml
```

---

### Playbooks

A playbook is a YAML file that defines what to do on which hosts.

#### Basic Structure

```yaml
---
- name: Configure web servers
  hosts: web                     # inventory group
  become: true                   # sudo escalation
  gather_facts: true             # collect system info as facts

  vars:
    nginx_worker_processes: 4
    nginx_worker_connections: 4096

  pre_tasks:
    - name: Update apt cache
      ansible.builtin.apt:
        update_cache: true
        cache_valid_time: 3600   # don't update if cache is less than 1h old

  roles:
    - common
    - nginx

  tasks:
    - name: Ensure nginx is running
      ansible.builtin.systemd:
        name: nginx
        state: started
        enabled: true

    - name: Copy nginx config
      ansible.builtin.template:
        src: templates/nginx.conf.j2
        dest: /etc/nginx/nginx.conf
        owner: root
        group: root
        mode: '0644'
      notify: Reload nginx       # triggers handler on change

  handlers:
    - name: Reload nginx
      ansible.builtin.systemd:
        name: nginx
        state: reloaded
```

#### Handlers

Handlers run once at the end of the play, only if notified. Used for service reloads/restarts after configuration changes.

```yaml
# Handler only runs if the template changed, not on every playbook run
tasks:
  - name: Copy nginx config
    ansible.builtin.template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
    notify: Reload nginx

handlers:
  - name: Reload nginx
    ansible.builtin.systemd:
      name: nginx
      state: reloaded
```

If multiple tasks notify the same handler, it still only runs once.

#### Variables and Facts

```yaml
# Variables from many sources (in order of precedence, last wins):
# role defaults < inventory vars < group_vars < host_vars < play vars < extra vars

# group_vars/web.yml
nginx_port: 80
max_connections: 1000

# host_vars/web1.example.com.yml
nginx_port: 8080       # overrides group var for this specific host

# In tasks: use Jinja2 template syntax
- name: Create nginx config
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf

# In template (nginx.conf.j2):
# worker_connections {{ nginx_worker_connections }};
# listen {{ nginx_port }};

# Facts — automatically gathered system information
- name: Show OS info
  debug:
    msg: "{{ ansible_distribution }} {{ ansible_distribution_version }}"

# Custom facts: create files in /etc/ansible/facts.d/*.fact on the managed node
# Ansible reads them automatically as ansible_local.*
```

#### Conditionals and Loops

```yaml
tasks:
  # Conditional execution
  - name: Install specific packages on Ubuntu
    ansible.builtin.apt:
      name: "{{ item }}"
      state: present
    loop:
      - nginx
      - python3-pip
      - curl
    when: ansible_distribution == "Ubuntu"

  - name: Install specific packages on RHEL
    ansible.builtin.dnf:
      name: "{{ item }}"
      state: present
    loop:
      - nginx
      - python3-pip
    when: ansible_distribution in ["RedHat", "CentOS", "Rocky"]

  # Loop over dict
  - name: Create users
    ansible.builtin.user:
      name: "{{ item.name }}"
      groups: "{{ item.groups }}"
      state: present
    loop:
      - { name: alice, groups: sudo }
      - { name: bob, groups: developers }

  # Loop with until (retry)
  - name: Wait for service to start
    ansible.builtin.command: systemctl is-active myservice
    register: service_status
    until: service_status.rc == 0
    retries: 10
    delay: 3
```

#### Error Handling

```yaml
tasks:
  - name: Run database migration
    ansible.builtin.command: python manage.py migrate
    register: migration_result
    failed_when: migration_result.rc != 0 and "already exists" not in migration_result.stderr

  - name: Always backup before proceeding
    ansible.builtin.command: pg_dump mydb > /backup/before-migration.sql
    ignore_errors: false   # fail the play if backup fails

  # Block with rescue/always
  - block:
      - name: Dangerous operation
        ansible.builtin.command: risky-command.sh

    rescue:
      - name: Recover from failure
        ansible.builtin.command: rollback.sh

    always:
      - name: Send notification regardless
        ansible.builtin.uri:
          url: "https://hooks.slack.com/services/..."
          method: POST
          body_format: json
          body: '{"text": "Deploy task completed (success or failure)"}'
```

---

### Roles

Roles are the standard way to organize and reuse Ansible code. A role is a directory with a defined structure:

```
roles/nginx/
├── defaults/main.yml     # default variable values (lowest precedence)
├── vars/main.yml         # role variables (higher precedence)
├── tasks/main.yml        # task list
├── handlers/main.yml     # handlers
├── templates/            # Jinja2 templates
│   └── nginx.conf.j2
├── files/                # static files
│   └── favicon.ico
├── meta/main.yml         # role metadata, dependencies
└── README.md
```

```yaml
# roles/nginx/tasks/main.yml
---
- name: Install nginx
  ansible.builtin.package:
    name: nginx
    state: present

- name: Copy nginx config
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: Reload nginx

- name: Enable and start nginx
  ansible.builtin.systemd:
    name: nginx
    state: started
    enabled: true

# roles/nginx/defaults/main.yml
---
nginx_worker_processes: auto
nginx_worker_connections: 1024
nginx_port: 80
```

Use roles in playbooks:
```yaml
- hosts: web
  roles:
    - common
    - nginx
    - { role: monitoring, when: install_monitoring | default(true) }
```

Ansible Galaxy: community-maintained roles. Install with `ansible-galaxy role install geerlingguy.nginx`.

---

### Ansible for Infrastructure Operations

#### Rolling Updates

```yaml
- name: Rolling update of web servers
  hosts: web
  serial: 1                    # update one host at a time
  max_fail_percentage: 10      # abort if more than 10% of hosts fail

  tasks:
    - name: Remove from load balancer
      ansible.builtin.uri:
        url: "http://lb.internal/backend/{{ inventory_hostname }}/disable"
        method: POST

    - name: Update application
      ansible.builtin.apt:
        name: myapp
        state: latest

    - name: Restart service
      ansible.builtin.systemd:
        name: myapp
        state: restarted

    - name: Wait for service to be healthy
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/health"
        status_code: 200
      register: health_check
      until: health_check.status == 200
      retries: 10
      delay: 5

    - name: Re-add to load balancer
      ansible.builtin.uri:
        url: "http://lb.internal/backend/{{ inventory_hostname }}/enable"
        method: POST
```

#### Kubernetes Node Configuration

```yaml
- name: Configure GPU nodes for Kubernetes
  hosts: gpu_nodes
  become: true

  tasks:
    - name: Install NVIDIA GPU drivers
      ansible.builtin.apt:
        name: nvidia-driver-535
        state: present
      notify: Reboot if needed

    - name: Load NVIDIA kernel modules
      ansible.builtin.modprobe:
        name: "{{ item }}"
        state: present
      loop:
        - nvidia
        - nvidia_uvm
        - nvidia_modeset

    - name: Configure containerd for NVIDIA runtime
      ansible.builtin.template:
        src: containerd-config.toml.j2
        dest: /etc/containerd/config.toml
      notify: Restart containerd

    - name: Set kernel parameters for high-performance networking
      ansible.posix.sysctl:
        name: "{{ item.key }}"
        value: "{{ item.value }}"
        state: present
        sysctl_set: true
      loop:
        - { key: net.core.somaxconn, value: 65535 }
        - { key: net.ipv4.tcp_max_syn_backlog, value: 65535 }
        - { key: vm.nr_hugepages, value: 1024 }

  handlers:
    - name: Restart containerd
      ansible.builtin.systemd:
        name: containerd
        state: restarted

    - name: Reboot if needed
      ansible.builtin.reboot:
        reboot_timeout: 600
```

---

### Ansible Vault

Vault encrypts sensitive data in playbooks and variable files:

```bash
# Create encrypted file
ansible-vault create group_vars/all/secrets.yml

# Edit encrypted file
ansible-vault edit group_vars/all/secrets.yml

# Encrypt existing file
ansible-vault encrypt group_vars/all/existing-secrets.yml

# Encrypt a single value (inline)
ansible-vault encrypt_string 'supersecretpassword' --name 'db_password'
# Output:
# db_password: !vault |
#   $ANSIBLE_VAULT;1.1;AES256
#   61386563...

# Run playbook with vault password
ansible-playbook site.yml --ask-vault-pass
# Or use password file (for CI)
ansible-playbook site.yml --vault-password-file ~/.vault-pass

# Or use environment variable
ANSIBLE_VAULT_PASSWORD_FILE=~/.vault-pass ansible-playbook site.yml
```

In the secrets file:
```yaml
# group_vars/all/secrets.yml (encrypted with vault)
db_password: "{{ vault_db_password }}"   # reference the vault variable
vault_db_password: supersecretpassword   # actual secret
```

---

### Ansible Tower / AWX

AWX is the open-source version of Ansible Automation Platform (formerly Ansible Tower). It provides:
- Web UI for running playbooks
- RBAC (who can run what against which hosts)
- Job scheduling
- Audit logging (who ran what, when, output)
- Credentials management (encrypted, no one can read secrets after entry)
- Dynamic inventory integration

AWX is the right choice when multiple teams need to run automation, and you need audit trails and access control.

---

### Common Failure Modes

**Non-idempotent tasks:** Using `command:` or `shell:` without `creates:` or `changed_when:` causes tasks to report "changed" on every run, even when nothing changed. Fix: use declarative modules (`file:`, `copy:`, `template:`, `service:`) instead of commands where possible. When using `command:`, always set `changed_when` appropriately.

**SSH timeout on large inventory:** Running against 500 hosts sequentially is slow. Fix: increase `forks` in `ansible.cfg` (default is 5 — try 50 for large inventories). Use `serial: 10%` for rolling updates.

**Missing privilege escalation:** Task needs sudo but `become: true` is missing. Fix: add at playbook level for playbooks that need root, or at task level for specific tasks. Check `become_user` when tasks need to run as a non-root user other than root.

**Variable precedence surprises:** A variable set in `host_vars` overrides the same variable in `group_vars`, which overrides `defaults`. When a variable isn't what you expect, add a debug task and print it. Use `--extra-vars` only for CI overrides, never for secrets.

**Vault password not available in CI:** Playbook fails with vault decryption error. Fix: store vault password in CI secrets (GitHub Actions secret, Vault), reference via `--vault-password-file` pointing to a file written from the CI secret.

---

### Key Questions and Answers

**Q: What makes Ansible different from a shell script for configuration management?**

Idempotency. A shell script typically runs commands regardless of current state — if nginx is already installed, `apt install nginx` will run again (harmless but noise). Ansible modules check current state first: the `apt` module checks if the package is installed, the `template` module checks if the file content matches. If state already matches desired state, the task reports "ok" (not changed) and does nothing. This makes playbooks safe to run repeatedly, which is essential for automated remediation and drift correction.

**Q: How do you safely update 100 web servers without downtime?**

Use `serial` with a rolling strategy: remove host from load balancer, update it, verify health, re-add to load balancer. Set `serial: 1` for cautious one-by-one, `serial: 10%` for faster updates. Set `max_fail_percentage: 10` to abort if too many hosts fail. Use `delegate_to` for the load balancer operations. Add a health check loop with `until`/`retries` before re-adding to the load balancer.

**Q: Ansible vs Terraform — when do you use each?**

Terraform provisions infrastructure (creates VMs, VPCs, databases) and manages their lifecycle. Ansible configures the systems Terraform creates (installs packages, writes config files, deploys services). They complement each other: Terraform creates an EC2 instance, Ansible configures it. For purely cloud-managed resources (RDS, S3), Terraform is the better tool. For OS-level configuration, software installation, and service management, Ansible is the right tool. Never use Ansible to create AWS resources (use Terraform); never use Terraform to configure OS-level state (use Ansible).

**Q: What is the Ansible vault and when do you use it?**

Ansible Vault encrypts sensitive data (passwords, API keys, certificates) stored in variable files or playbooks. Without vault, secrets in git are exposed. With vault, the file is encrypted with a symmetric key (the vault password). The vault password itself is stored outside git (CI secrets, secrets manager, password file not committed). Use vault for any variable that's a secret — database passwords, API tokens, TLS private keys. The convention is to use a `vault_` prefix for the actual secret and a plain variable name that references it, so you can see what variables exist without needing vault access.

---

### Points to Remember

- Ansible is agentless: push model via SSH, requires Python on managed nodes
- Idempotency: running the same playbook twice must produce the same result
- Use declarative modules over `command:`/`shell:` for idempotency
- Handlers run once at the end of the play, only when notified
- `serial` controls rolling update batch size; `max_fail_percentage` sets abort threshold
- Variables: host_vars override group_vars override defaults (higher specificity wins)
- Ansible Vault encrypts secrets in git; vault password stored outside git
- Roles are the unit of reuse — directory structure with tasks, handlers, templates, vars
- `forks` in ansible.cfg controls parallelism (default 5, increase for large fleets)
- AWX/Tower provides RBAC, audit logging, and web UI for team use
- Ansible for OS configuration; Terraform for infrastructure provisioning

### What to Study Next

- [Terraform and Infrastructure as Code](./terraform-infrastructure-as-code) — provision the infrastructure Ansible configures
- [CI/CD and Trusted Delivery](./cicd-trusted-delivery-and-platform-security) — integrate Ansible runs into CI/CD pipelines
- [Linux and Network Administration](./linux-and-network-administration) — understanding what Ansible is configuring
