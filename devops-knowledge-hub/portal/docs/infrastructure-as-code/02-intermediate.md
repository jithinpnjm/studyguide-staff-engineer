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

## Terraform Workspaces vs Directory-Per-Environment

| Aspect | Workspaces | Directory per environment |
|---|---|---|
| State isolation | Yes — separate state per workspace | Yes — separate directory, separate state |
| Code reuse | High — same code with `terraform.workspace` | Moderate — modules called with different vars |
| Prod blast radius | Higher — same backend, easy to select wrong workspace | Lower — completely separate apply paths |
| Access control | Hard to restrict per workspace | Easy — separate buckets/paths per env |
| Recommended for | Feature branch environments | Production/staging/dev separation |

Directory layout (recommended for prod):

```text
infra/
  modules/
    vpc/
    rds/
    eks/
  envs/
    dev/
      main.tf              # calls modules with dev-specific vars
      backend.tf           # points to dev state path
      terraform.tfvars
    staging/
      main.tf
      backend.tf
      terraform.tfvars
    prod/
      main.tf
      backend.tf
      terraform.tfvars
```

---

## Remote State: S3 + DynamoDB Full Configuration

**Step 1: Create the backend resources (bootstrap)**

```hcl
# bootstrap/main.tf — run this once manually or via a script
resource "aws_s3_bucket" "state" {
  bucket = "company-terraform-state-prod"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
```

**Step 2: Configure backend in each environment**

```hcl
# envs/prod/backend.tf
terraform {
  backend "s3" {
    bucket         = "company-terraform-state-prod"
    key            = "prod/network/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    kms_key_id     = "arn:aws:kms:eu-central-1:123456789:key/abc123"
    dynamodb_table = "terraform-locks"
  }
}
```

**How state locking works:**

1. When `terraform apply` or `plan` starts, Terraform writes a lock record to DynamoDB
2. The lock record contains: lock ID, who locked it, when, operation type
3. If another apply runs concurrently, it reads the lock record and fails with: `Error acquiring the state lock`
4. After a successful apply, the lock is released (DynamoDB record deleted)
5. If apply crashes, the lock stays; use `terraform force-unlock <lock-id>` after verifying no apply is active

---

## Terraform Module Structure — Real VPC Module

A complete reusable VPC module:

```text
modules/vpc/
  main.tf        # resources
  variables.tf   # inputs
  outputs.tf     # exports
  versions.tf    # provider requirements
  README.md
```

**modules/vpc/versions.tf**

```hcl
terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}
```

**modules/vpc/variables.tf**

```hcl
variable "name" {
  description = "VPC name prefix"
  type        = string
}

variable "cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  description = "List of public subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnets" {
  description = "List of private subnet CIDRs"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "environment" {
  description = "Environment tag"
  type        = string
}
```

**modules/vpc/main.tf**

```hcl
resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = var.name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags = { Name = "${var.name}-igw" }
}

resource "aws_subnet" "public" {
  count             = length(var.public_subnets)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.public_subnets[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.name}-public-${count.index + 1}"
    Environment = var.environment
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnets)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "${var.name}-private-${count.index + 1}"
    Environment = var.environment
    Tier        = "private"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
```

**modules/vpc/outputs.tf**

```hcl
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}
```

**Calling the module from a root module:**

```hcl
module "vpc" {
  source = "git::https://github.com/company/terraform-modules.git//vpc?ref=v2.0.0"

  name            = "prod-main"
  cidr            = "10.0.0.0/16"
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  environment     = "prod"
}
```

---

## count vs for_each

`count` creates indexed resources. `for_each` creates named resources.

**`count` example — creates N identical security groups:**

```hcl
resource "aws_security_group" "app" {
  count  = 3
  name   = "app-sg-${count.index}"
  vpc_id = aws_vpc.main.id
}
# Addresses: aws_security_group.app[0], aws_security_group.app[1], aws_security_group.app[2]
```

Problem with `count`: if you remove index 1 from the middle, Terraform renumbers and recreates resources 1 and 2.

**`for_each` example — creates named subnets from a map:**

```hcl
variable "subnets" {
  default = {
    "public-a"  = "10.0.1.0/24"
    "public-b"  = "10.0.2.0/24"
    "private-a" = "10.0.10.0/24"
  }
}

resource "aws_subnet" "this" {
  for_each = var.subnets

  vpc_id     = aws_vpc.main.id
  cidr_block = each.value

  tags = {
    Name = each.key
  }
}
# Addresses: aws_subnet.this["public-a"], aws_subnet.this["public-b"], aws_subnet.this["private-a"]
```

With `for_each`, removing `"public-a"` from the map only destroys that one subnet. The others are unaffected.

Use `count` only when all instances are truly identical. Use `for_each` whenever instances have distinct identities.

---

## Data Sources

Data sources read existing infrastructure without managing it:

```hcl
# Look up an existing VPC by tag
data "aws_vpc" "shared" {
  tags = {
    Name = "shared-services-vpc"
  }
}

# Look up the most recent Ubuntu 22.04 AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# Get the current caller's AWS account ID
data "aws_caller_identity" "current" {}

# Use it in a resource
resource "aws_s3_bucket" "app" {
  bucket = "myapp-data-${data.aws_caller_identity.current.account_id}"
}

# Reference the shared VPC in a new resource
resource "aws_security_group" "app" {
  vpc_id = data.aws_vpc.shared.id
  name   = "app-sg"
}
```

Data sources are read during plan, not apply. They represent resources owned by other stacks or created outside Terraform.

---

## Lifecycle Meta-Arguments

**`create_before_destroy`** — create the new resource before destroying the old one:

```hcl
# Useful for security groups, TLS certificates, or any resource that
# other resources depend on (can't destroy first or dependents break)
resource "aws_security_group" "app" {
  name   = "app-sg-${var.version_tag}"
  vpc_id = aws_vpc.main.id

  lifecycle {
    create_before_destroy = true
  }
}
```

**`prevent_destroy`** — block any plan that would destroy this resource:

```hcl
resource "aws_db_instance" "main" {
  identifier = "orders-prod"
  # ...

  lifecycle {
    prevent_destroy = true
  }
}
# Running terraform destroy or removing this block will error:
# Error: Instance cannot be destroyed
```

**`ignore_changes`** — ignore diffs on specific attributes:

```hcl
resource "aws_eks_node_group" "main" {
  # ...
  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 3
  }

  lifecycle {
    # Let the cluster autoscaler manage desired_size
    # Without this, Terraform would reset desired_size to 3 on every apply
    ignore_changes = [scaling_config[0].desired_size]
  }
}
```

---

## `terraform import` Workflow

Import brings an existing manually-created resource under Terraform state.

Example: import an existing S3 bucket named `legacy-app-data-prod`:

**Step 1: Write a matching resource block**

```hcl
resource "aws_s3_bucket" "legacy" {
  bucket = "legacy-app-data-prod"
}
```

**Step 2: Import using the CLI**

```bash
terraform import aws_s3_bucket.legacy legacy-app-data-prod
```

Output:
```text
aws_s3_bucket.legacy: Importing from ID "legacy-app-data-prod"...
aws_s3_bucket.legacy: Import prepared!
  Prepared aws_s3_bucket for import
aws_s3_bucket.legacy: Refreshing state... [id=legacy-app-data-prod]

Import successful!
```

**Step 3: Run plan and fix discrepancies**

```bash
terraform plan
```

The plan will show all the settings on the real bucket that your HCL doesn't declare yet. Add them one by one until the plan is clean.

**Terraform 1.5+ import block (declarative):**

```hcl
import {
  to = aws_s3_bucket.legacy
  id = "legacy-app-data-prod"
}

resource "aws_s3_bucket" "legacy" {
  bucket = "legacy-app-data-prod"

  tags = {
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}
```

---

## `terraform state` Commands Reference

```bash
# List all resources in state
terraform state list

# Show detailed attributes of one resource
terraform state show aws_s3_bucket.logs

# Rename a resource address (safe refactoring without destroying)
terraform state mv aws_s3_bucket.logs aws_s3_bucket.app_logs

# Remove from state (stop managing, don't destroy)
terraform state rm aws_s3_bucket.unmanaged

# Download remote state to local file (for inspection)
terraform state pull > state-backup.json

# Push local state back to remote (emergency recovery)
terraform state push state-backup.json
```

When to use each:
- `list` / `show`: inspect what Terraform knows about a resource
- `mv`: after renaming a resource in code to avoid destroy/recreate
- `rm`: when handing off a resource to another tool or abandoning management
- `pull`: back up state before risky operations
- `push`: recover from state corruption (use with extreme care)

---

## `moved` Block for Safe Refactoring

The `moved` block was introduced in Terraform 1.1 and is safer than `terraform state mv` for recorded refactors:

```hcl
# Before: resource was at top level
# resource "aws_s3_bucket" "logs" { ... }

# After: moved into a module
# module "logging" { source = "./modules/logging" }
# which contains: resource "aws_s3_bucket" "logs" { ... }

moved {
  from = aws_s3_bucket.logs
  to   = module.logging.aws_s3_bucket.logs
}
```

With this block in the code, Terraform detects the address change and updates state without destroy/recreate. After one successful apply, the `moved` block can be removed.

---

## Ansible Roles Directory Structure

A role is the standard unit of reuse in Ansible. Full structure:

```text
roles/nginx/
  tasks/
    main.yml          # entry point for task list
    install.yml       # included task file
  handlers/
    main.yml          # handlers triggered by notify
  defaults/
    main.yml          # default variable values (lowest precedence)
  vars/
    main.yml          # role variables (overrides defaults)
  templates/
    nginx.conf.j2     # Jinja2 templates
  files/
    favicon.ico       # static files copied to hosts
  meta/
    main.yml          # role metadata, dependencies
  README.md
```

**roles/nginx/defaults/main.yml:**

```yaml
---
nginx_port: 80
nginx_worker_processes: auto
nginx_worker_connections: 1024
nginx_server_name: "_"
```

**roles/nginx/tasks/main.yml:**

```yaml
---
- name: Install nginx
  ansible.builtin.apt:
    name: nginx
    state: present
    update_cache: true

- name: Deploy nginx configuration
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    owner: root
    group: root
    mode: '0644'
  notify: Reload nginx

- name: Ensure nginx is enabled and started
  ansible.builtin.systemd:
    name: nginx
    state: started
    enabled: true
```

**roles/nginx/handlers/main.yml:**

```yaml
---
- name: Reload nginx
  ansible.builtin.systemd:
    name: nginx
    state: reloaded

- name: Restart nginx
  ansible.builtin.systemd:
    name: nginx
    state: restarted
```

**roles/nginx/templates/nginx.conf.j2:**

```nginx
# Managed by Ansible — do not edit manually
worker_processes {{ nginx_worker_processes }};

events {
    worker_connections {{ nginx_worker_connections }};
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;

    server {
        listen      {{ nginx_port }};
        server_name {{ nginx_server_name }};

        location / {
            root   /var/www/html;
            index  index.html;
        }
    }
}
```

**Using the role in a playbook:**

```yaml
---
- hosts: web
  become: true
  vars:
    nginx_port: 8080
    nginx_worker_processes: 4
  roles:
    - common
    - nginx
    - { role: monitoring, when: install_monitoring | default(true) }
```

---

## Ansible Conditionals, Loops, and Register

**`when` conditional:**

```yaml
- name: Install nginx on Debian-based systems
  ansible.builtin.apt:
    name: nginx
    state: present
  when: ansible_os_family == "Debian"

- name: Install nginx on Red Hat-based systems
  ansible.builtin.dnf:
    name: nginx
    state: present
  when: ansible_os_family == "RedHat"
```

**`loop` with list:**

```yaml
- name: Install required packages
  ansible.builtin.package:
    name: "{{ item }}"
    state: present
  loop:
    - nginx
    - curl
    - python3-pip
    - git
```

**`register` + `when` pattern:**

```yaml
- name: Check if config file exists
  ansible.builtin.stat:
    path: /etc/myapp/config.yml
  register: config_file

- name: Deploy config only if it does not exist
  ansible.builtin.template:
    src: config.yml.j2
    dest: /etc/myapp/config.yml
  when: not config_file.stat.exists

- name: Run migration if config was just created
  ansible.builtin.command: /usr/local/bin/myapp migrate
  when: not config_file.stat.exists
  changed_when: true
```

---

## Ansible Vault for Secrets

Vault encrypts sensitive variables stored in files:

```bash
# Create an encrypted file
ansible-vault create group_vars/all/secrets.yml

# Edit an existing encrypted file
ansible-vault edit group_vars/all/secrets.yml

# Encrypt a single string value (inline in a variable file)
ansible-vault encrypt_string 'supersecretpassword' --name 'vault_db_password'
# Output to paste into a vars file:
# vault_db_password: !vault |
#   $ANSIBLE_VAULT;1.1;AES256
#   61386563...

# Encrypt an entire file
ansible-vault encrypt group_vars/prod/secrets.yml

# Run playbook with vault password prompt
ansible-playbook site.yml --ask-vault-pass

# Run playbook with vault password file (for CI)
ansible-playbook site.yml --vault-password-file ~/.vault-pass

# Or via environment variable
ANSIBLE_VAULT_PASSWORD_FILE=~/.vault-pass ansible-playbook site.yml
```

Convention — two-variable pattern keeps the structure visible:

```yaml
# group_vars/all/vars.yml (not encrypted — just references)
db_password: "{{ vault_db_password }}"

# group_vars/all/secrets.yml (encrypted with vault)
vault_db_password: "supersecretpassword"
```

This way, teams can see `db_password` exists in unencrypted files without seeing its value.

---

## Ansible Dynamic Inventory with AWS EC2

```yaml
# inventory/aws_ec2.yml
plugin: amazon.aws.aws_ec2
regions:
  - eu-central-1
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
  - private-ip-address

compose:
  ansible_host: private_ip_address
```

```bash
# Verify the inventory resolves correctly
ansible-inventory -i inventory/aws_ec2.yml --graph

# Run a playbook against dynamically discovered hosts
ansible-playbook -i inventory/aws_ec2.yml site.yml

# Target a specific dynamic group
ansible role_web -i inventory/aws_ec2.yml -m ping
```

---

## Pulumi Basics: Why Some Teams Choose It

Pulumi lets you write IaC in TypeScript, Python, Go, or C# instead of HCL.

```python
# Python example: create an S3 bucket with Pulumi
import pulumi
import pulumi_aws as aws

bucket = aws.s3.BucketV2(
    "app-data",
    tags={
        "Environment": "prod",
        "ManagedBy": "pulumi",
    }
)

public_access_block = aws.s3.BucketPublicAccessBlock(
    "app-data-pab",
    bucket=bucket.id,
    block_public_acls=True,
    block_public_policy=True,
    ignore_public_acls=True,
    restrict_public_buckets=True,
)

pulumi.export("bucket_name", bucket.id)
```

When Pulumi makes sense over Terraform:
- The team is already fluent in TypeScript/Python and finds HCL foreign
- You need real conditionals, loops, and abstractions that HCL doesn't handle well
- You want to unit-test infrastructure code with standard test frameworks
- Your company already uses a language runtime in CI that makes Pulumi natural

Tradeoffs: Pulumi has a smaller ecosystem than Terraform/OpenTofu, and its state backend is a service (Pulumi Cloud) though self-hosted is possible.

---

## Terraform Three-Reality Model

Terraform manages three versions of reality simultaneously. Misunderstanding this causes the most common Terraform errors.

| Reality | Where It Lives | What It Represents |
|---|---|---|
| **Desired** | `.tf` source files | What you want to exist |
| **Recorded** | `terraform.tfstate` | What Terraform last observed |
| **Actual** | Cloud provider API | What actually exists right now |

**What `terraform plan` really does:**
1. Read desired state from `.tf` files
2. Read recorded state from `tfstate`
3. Call cloud APIs to refresh actual state
4. Compute diff between desired and actual
5. Show you the change set (plan output)

**What goes wrong when they diverge:**

```text
Desired  ≠  Recorded  →  Someone edited .tf without applying
Recorded ≠  Actual    →  Manual change in console (drift)
Desired  ≠  Actual    →  Both of the above
```

**Practical rule:** Never change infrastructure through the console in Terraform-managed accounts. Every manual change creates recorded/actual divergence and makes the next plan unreliable.

---

## Terraform Plan Symbol Reference

When reading `terraform plan` output, each symbol tells you the risk level of the change:

| Symbol | Meaning | Risk |
|---|---|---|
| `+` | Create new resource | Low — adds something new |
| `~` | Update in-place | Medium — modifies existing resource |
| `-` | Destroy resource | High — deletes resource |
| `-/+` | Destroy then recreate | High — downtime risk; resource is replaced |
| `<=` | Data source read | None — read-only refresh |

**Force-replace triggers** — attributes that cause `-/+` on common resources:

| Resource | Attribute that forces replacement |
|---|---|
| `aws_instance` | `ami`, `instance_type` (some), `subnet_id` |
| `aws_db_instance` | `engine`, `engine_version` (major), `identifier` |
| `aws_iam_role` | `name` (rename = destroy + recreate) |
| `aws_s3_bucket` | `bucket` (name) |
| `aws_eks_node_group` | `ami_type`, `disk_size`, `instance_types` |

**Reviewing a plan:** Before approving, scan for any `-/+` lines and verify the resource is either stateless (safe to replace) or you have a migration plan for the data.

---

## for_each vs count — When to Use Each

```hcl
# count — use only for homogeneous sets where order doesn't matter
resource "aws_iam_user" "ops" {
  count = length(var.ops_users)
  name  = var.ops_users[count.index]
}
# Problem: if you remove "alice" from the middle of the list,
# Terraform renumbers the list — it may recreate "charlie" as "alice".

# for_each — use for named sets; index is stable
resource "aws_iam_user" "ops" {
  for_each = toset(var.ops_users)
  name     = each.key
}
# Removing "alice" only destroys alice; bob and charlie are untouched.
```

**Rule:** Use `for_each` any time you have named resources. Use `count` only for identical replicas (e.g., `count = 3` EC2 instances behind a load balancer where individual identity doesn't matter).

---

## Ansible Rolling Update with Load Balancer Integration

Rolling updates with Ansible let you update a fleet of servers without downtime by batching the rollout and checking health at each step.

```yaml
# rolling-update.yml
- name: Rolling update with health checks
  hosts: app_servers
  serial: "25%"               # update 25% of hosts per batch
  max_fail_percentage: 10     # abort if >10% of hosts fail
  order: sorted               # deterministic order (not random)

  pre_tasks:
    - name: Remove host from load balancer
      uri:
        url: "{{ lb_api }}/deregister/{{ inventory_hostname }}"
        method: POST
      delegate_to: localhost

    - name: Wait for in-flight requests to drain
      wait_for:
        timeout: 30

  tasks:
    - name: Update application
      apt:
        name: myapp
        state: latest
      notify: Restart application

  handlers:
    - name: Restart application
      systemd:
        name: myapp
        state: restarted
        enabled: yes

  post_tasks:
    - name: Wait for application to be healthy
      uri:
        url: "http://{{ ansible_host }}:8080/healthz"
        status_code: 200
        return_content: yes
      register: health
      retries: 10
      delay: 6
      until: health.status == 200

    - name: Re-register host in load balancer
      uri:
        url: "{{ lb_api }}/register/{{ inventory_hostname }}"
        method: POST
      delegate_to: localhost
```

**Key parameters:**
- `serial: "25%"` — rolls 25% of hosts at a time (can also use integer: `serial: 2`)
- `max_fail_percentage: 10` — Ansible aborts the entire play if more than 10% of hosts fail in any batch
- `pre_tasks` — run before roles/tasks (drain from LB)
- `post_tasks` — run after all tasks (verify health before adding back to LB)
- `delegate_to: localhost` — load balancer API calls run from the control node, not the target host

---

## Ansible: Kubernetes GPU Node Configuration

Configuring GPU nodes for Kubernetes requires specific kernel modules, NVIDIA drivers, containerd runtime configuration, and sysctl settings. Ansible automates this consistently across a fleet.

```yaml
# gpu-node-setup.yml
- name: Configure Kubernetes GPU nodes
  hosts: gpu_nodes
  become: yes

  tasks:
    - name: Install NVIDIA driver prerequisites
      apt:
        name:
          - linux-headers-{{ ansible_kernel }}
          - build-essential
          - dkms
        state: present
        update_cache: yes

    - name: Add NVIDIA CUDA repository
      apt_repository:
        repo: "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64 /"
        state: present
        filename: cuda

    - name: Install NVIDIA driver
      apt:
        name: nvidia-driver-535
        state: present
      notify: reboot if needed

    - name: Load required kernel modules
      modprobe:
        name: "{{ item }}"
        state: present
      loop:
        - nvidia
        - nvidia_uvm
        - nvidia_drm

    - name: Persist kernel modules across reboots
      copy:
        dest: /etc/modules-load.d/nvidia.conf
        content: |
          nvidia
          nvidia_uvm
          nvidia_drm

    - name: Configure containerd for NVIDIA runtime
      blockinfile:
        path: /etc/containerd/config.toml
        marker: "# {mark} ANSIBLE MANAGED — NVIDIA runtime"
        block: |
          [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.nvidia]
            runtime_type = "io.containerd.runc.v2"
            [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.nvidia.options]
              BinaryName = "/usr/bin/nvidia-container-runtime"
      notify: Restart containerd

    - name: Set GPU sysctl parameters
      sysctl:
        name: "{{ item.key }}"
        value: "{{ item.value }}"
        sysctl_file: /etc/sysctl.d/99-gpu-nodes.conf
        reload: yes
      loop:
        - { key: "vm.max_map_count", value: "262144" }
        - { key: "kernel.numa_balancing", value: "0" }

    - name: Verify NVIDIA GPU detected
      command: nvidia-smi --query-gpu=name --format=csv,noheader
      register: gpu_check
      changed_when: false
      failed_when: gpu_check.rc != 0

    - name: Show detected GPUs
      debug:
        msg: "GPUs found: {{ gpu_check.stdout_lines }}"

  handlers:
    - name: Restart containerd
      systemd:
        name: containerd
        state: restarted

    - name: reboot if needed
      reboot:
        reboot_timeout: 300
```

**What this does:**
- Installs NVIDIA driver via CUDA repository (driver version pinned — do not use `latest`)
- Loads `nvidia`, `nvidia_uvm`, `nvidia_drm` kernel modules and persists them in `/etc/modules-load.d/`
- Patches containerd `config.toml` to register the NVIDIA container runtime
- Sets `vm.max_map_count` (required for GPU ML frameworks) and disables NUMA balancing (improves GPU memory locality)
- Runs `nvidia-smi` to verify the GPU is detected before finishing

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
9. Use `for_each` for named resources — `count` causes renumbering surprises.
10. Vault encrypts secrets in Git; the vault password lives outside Git.
11. Dynamic inventory queries the cloud API at runtime — no manual host lists.
12. `moved` blocks record safe refactors without destroy/recreate.
13. The three-reality model (desired/recorded/actual) explains almost every Terraform problem.
14. Plan symbols `+/~/−/−+` map directly to risk — review every `-/+` before approving.
15. Rolling updates with `serial` + `max_fail_percentage` prevent full-fleet outages during Ansible runs.
