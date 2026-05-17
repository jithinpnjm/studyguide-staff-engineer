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
