---
title: "Cheat Sheet"
sidebar_position: 6
---

# Infrastructure as Code — Cheat Sheet

Fast recall for Terraform, Ansible, state, modules, policy checks, and production IaC workflows.

---

## Terraform Core Workflow

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
terraform output
terraform destroy
```

Safe PR workflow:

```text
fmt -> validate -> lint -> security/policy scan -> plan -> review -> apply
```

---

## Terraform State Commands

```bash
terraform state list
terraform state show <address>
terraform state mv <old-address> <new-address>
terraform state rm <address>
terraform state pull
terraform state push <statefile>
```

Use manual state commands carefully. Back up state first.

---

## Terraform Workspace Commands

```bash
terraform workspace list
terraform workspace new dev
terraform workspace select prod
terraform workspace show
terraform workspace delete old-env
```

Rule of thumb: workspaces are fine for similar environments. Separate folders and separate state are often clearer for production.

---

## Terraform Provider Block

```hcl
terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
}
```

Provider alias:

```hcl
provider "aws" {
  alias  = "secondary"
  region = "eu-west-1"
}
```

---

## Variables

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}
```

Use variable:

```hcl
name = "app-${var.environment}"
```

Set variable:

```bash
terraform apply -var="environment=prod"
terraform apply -var-file="prod.tfvars"
export TF_VAR_environment=prod
```

---

## Outputs

```hcl
output "vpc_id" {
  value = aws_vpc.main.id
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}
```

Show outputs:

```bash
terraform output
terraform output -json
```

---

## Remote Backend Example

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

State checklist:

```text
remote backend
locking
encryption
versioning
restricted access
backup/restore process
```

---

## Module Structure

```text
modules/
  vpc/
    main.tf
    variables.tf
    outputs.tf
    README.md

envs/
  dev/
  staging/
  prod/
```

Module call:

```hcl
module "vpc" {
  source = "git::https://github.com/company/modules.git//vpc?ref=v1.2.0"

  name = "prod"
  cidr = "10.0.0.0/16"
}
```

Use version tags, not `main`, for production modules.

---

## Lifecycle Controls

```hcl
lifecycle {
  prevent_destroy = true
}
```

```hcl
lifecycle {
  create_before_destroy = true
}
```

```hcl
lifecycle {
  ignore_changes = [desired_capacity]
}
```

Use `ignore_changes` sparingly because it can hide drift.

---

## Moved Block

```hcl
moved {
  from = aws_s3_bucket.logs
  to   = module.logging.aws_s3_bucket.logs
}
```

Use for safe resource address refactors.

---

## Import Block

```hcl
import {
  to = aws_s3_bucket.logs
  id = "company-prod-logs"
}

resource "aws_s3_bucket" "logs" {
  bucket = "company-prod-logs"
}
```

Import checklist:

```text
write HCL
import object
run plan
adjust config until plan is clean
commit code and ownership notes
```

---

## Common Terraform Functions

```hcl
locals {
  name = lower("${var.service}-${var.environment}")
  tags = merge(var.common_tags, {
    Service = var.service
  })
}
```

Useful functions:

```text
merge
concat
lookup
coalesce
try
can
jsonencode
yamldecode
format
lower
replace
```

---

## Policy And Static Checks

```bash
terraform fmt -check -recursive
terraform validate
tflint
checkov -d .
tfsec .
conftest test .
```

Common policies:

```text
no public buckets
no public databases
required tags
encryption enabled
backups enabled
approved regions
approved instance families
```

---

## Ansible Commands

```bash
ansible --version
ansible-inventory -i hosts.ini --list
ansible all -i hosts.ini -m ping
ansible web -i hosts.ini -m command -a "uptime"
ansible-playbook -i hosts.ini site.yml
ansible-playbook -i hosts.ini site.yml --check
ansible-playbook -i hosts.ini site.yml --syntax-check
```

Limit hosts:

```bash
ansible-playbook -i hosts.ini site.yml --limit web1.example.com
```

Pass extra vars:

```bash
ansible-playbook -i hosts.ini site.yml -e "environment=prod"
```

---

## Ansible Playbook Skeleton

```yaml
---
- name: Configure web servers
  hosts: web
  become: true
  gather_facts: true

  vars:
    nginx_port: 80

  tasks:
    - name: Ensure nginx is installed
      ansible.builtin.package:
        name: nginx
        state: present

    - name: Ensure nginx is running
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

---

## Ansible Handler Pattern

```yaml
 tasks:
   - name: Render config
     ansible.builtin.template:
       src: app.conf.j2
       dest: /etc/app/app.conf
     notify: Restart app

 handlers:
   - name: Restart app
     ansible.builtin.service:
       name: app
       state: restarted
```

---

## Rolling Ansible Change

```yaml
---
- name: Rolling update
  hosts: web
  serial: 10%
  become: true
  tasks:
    - name: Upgrade package
      ansible.builtin.package:
        name: nginx
        state: latest
```

Use `serial` for production host fleets.

---

## Plan Review Red Flags

```text
-/+ replacement of database
large destroy count
security group widened
public access enabled
IAM wildcard expansion
provider upgrade mixed with resource changes
unknown values on critical resources
state address changed unexpectedly
```

---

## Production IaC Rules

```text
remote state only
state locking required
small reviewable plans
versioned modules
controlled apply runner
policy-as-code checks
backups before destructive changes
clear owner per stack
```

---

## Full Terraform CLI Reference

```bash
# Core workflow
terraform init                          # initialize, download providers
terraform init -upgrade                 # upgrade providers to latest matching constraints
terraform init -migrate-state           # migrate local state to remote backend
terraform fmt                           # format all .tf files
terraform fmt -check -recursive         # check formatting without writing (CI use)
terraform validate                      # syntax and type checking
terraform plan                          # show planned changes
terraform plan -out=tfplan.binary       # save plan to file
terraform plan -target=aws_vpc.main     # plan only specific resource
terraform plan -refresh-only            # show drift without applying
terraform plan -detailed-exitcode       # exit 0=no diff, 1=error, 2=diff (for CI)
terraform apply                         # apply changes with confirmation prompt
terraform apply -auto-approve           # apply without confirmation (CI)
terraform apply tfplan.binary           # apply a saved plan file
terraform apply -target=aws_vpc.main    # apply only specific resource
terraform destroy                       # destroy all resources with confirmation
terraform destroy -auto-approve         # destroy without confirmation (dangerous)

# State commands
terraform state list                    # list all resources in state
terraform state show <address>          # show attributes of one resource
terraform state mv <old> <new>          # rename resource address in state
terraform state rm <address>            # remove resource from state (stop managing)
terraform state pull                    # download remote state to stdout
terraform state push <statefile>        # upload state file to remote backend

# Import commands
terraform import <address> <id>         # import real resource into state
# Terraform 1.5+ alternative: use import {} block in config

# Additional commands
terraform output                        # show all outputs
terraform output -json                  # show outputs as JSON
terraform output <name>                 # show specific output value
terraform output -raw <name>            # show output value without quotes
terraform graph                         # print dependency graph (DOT format)
terraform graph | dot -Tpng > graph.png # visualize as image
terraform providers                     # list providers and their versions
terraform providers lock                # update .terraform.lock.hcl
terraform version                       # show Terraform version
terraform force-unlock <lock-id>        # release stuck state lock (use with caution)
terraform taint <address>               # mark resource for recreation on next apply (deprecated — use -replace)
terraform untaint <address>             # remove taint marking (deprecated)
terraform apply -replace=<address>      # force replace a specific resource
terraform refresh                       # update state to match real infrastructure (deprecated — use plan -refresh-only)
terraform console                       # interactive expression evaluator
```

---

## Full Ansible CLI Reference

```bash
# ansible — run ad-hoc commands
ansible all -i hosts.ini -m ping                        # connectivity check
ansible web -i hosts.ini -m command -a "uptime"         # run command
ansible all -i hosts.ini -m shell -a "df -h" --become   # shell command with sudo
ansible web -i hosts.ini -m apt -a "name=nginx state=present" --become
ansible all -i hosts.ini -m setup                       # gather facts
ansible all -i hosts.ini -m setup -a "filter=ansible_distribution*"
ansible all -i hosts.ini -m debug -a "var=hostvars[inventory_hostname]"

# ansible-playbook — run playbooks
ansible-playbook -i hosts.ini site.yml                  # basic run
ansible-playbook -i hosts.ini site.yml --check          # dry run (no changes)
ansible-playbook -i hosts.ini site.yml --diff           # show file diffs
ansible-playbook -i hosts.ini site.yml --check --diff   # dry run with diffs
ansible-playbook -i hosts.ini site.yml --syntax-check   # YAML syntax check only
ansible-playbook -i hosts.ini site.yml --list-hosts     # show which hosts would run
ansible-playbook -i hosts.ini site.yml --list-tasks     # show which tasks would run
ansible-playbook -i hosts.ini site.yml --list-tags      # show available tags
ansible-playbook -i hosts.ini site.yml --tags nginx     # run only tasks tagged nginx
ansible-playbook -i hosts.ini site.yml --skip-tags debug # skip tasks tagged debug
ansible-playbook -i hosts.ini site.yml --limit web1     # run only on specific host/group
ansible-playbook -i hosts.ini site.yml --become         # run with privilege escalation
ansible-playbook -i hosts.ini site.yml -e "env=prod"    # pass extra variables
ansible-playbook -i hosts.ini site.yml --ask-vault-pass # prompt for vault password
ansible-playbook -i hosts.ini site.yml --vault-password-file ~/.vault-pass
ansible-playbook -i hosts.ini site.yml -v               # verbose output
ansible-playbook -i hosts.ini site.yml -vvv             # very verbose (show SSH)
ansible-playbook -i hosts.ini site.yml --start-at-task "Deploy config"
ansible-playbook -i hosts.ini site.yml --step           # interactive step-by-step

# ansible-vault
ansible-vault create file.yml                           # create encrypted file
ansible-vault edit file.yml                             # edit encrypted file
ansible-vault view file.yml                             # view encrypted file
ansible-vault encrypt file.yml                          # encrypt existing file
ansible-vault decrypt file.yml                          # decrypt file
ansible-vault encrypt_string 'value' --name 'var_name' # encrypt a string inline
ansible-vault rekey file.yml                            # change vault password

# ansible-galaxy — manage roles and collections
ansible-galaxy role install geerlingguy.nginx           # install a role
ansible-galaxy role list                                # list installed roles
ansible-galaxy collection install amazon.aws            # install a collection
ansible-galaxy collection install -r requirements.yml   # install from requirements file
ansible-galaxy init myrole                              # scaffold new role structure

# ansible-inventory — inspect inventory
ansible-inventory -i hosts.ini --list                   # list all hosts as JSON
ansible-inventory -i hosts.ini --graph                  # show group tree
ansible-inventory -i aws_ec2.yml --list                 # list dynamic inventory

# ansible-doc — documentation
ansible-doc ansible.builtin.apt                         # show module docs
ansible-doc -l                                          # list all modules
ansible-doc -s ansible.builtin.template                 # show snippet

# ansible-lint — lint playbooks and roles
ansible-lint site.yml                                   # lint a playbook
ansible-lint roles/nginx/                               # lint a role
```

---

## Terraform HCL Snippets

**Dynamic block:**

```hcl
resource "aws_security_group" "web" {
  vpc_id = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }
}
```

**Local values:**

```hcl
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    CostCenter  = "platform"
  }
  name_prefix = "${var.service}-${var.environment}"
  bucket_name = lower("${local.name_prefix}-${data.aws_caller_identity.current.account_id}")
}

resource "aws_s3_bucket" "app" {
  bucket = local.bucket_name
  tags   = local.common_tags
}
```

**`templatefile()` function:**

```hcl
resource "aws_instance" "web" {
  user_data = templatefile("${path.module}/scripts/init.sh.tftpl", {
    environment = var.environment
    db_host     = aws_db_instance.main.endpoint
    log_level   = var.log_level
  })
}
```

**`jsonencode()` function:**

```hcl
resource "aws_iam_role" "app" {
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}
```

**Data source patterns:**

```hcl
# Current account ID
data "aws_caller_identity" "current" {}
# Use: data.aws_caller_identity.current.account_id

# Available AZs
data "aws_availability_zones" "available" { state = "available" }
# Use: data.aws_availability_zones.available.names[0]

# SSM parameter
data "aws_ssm_parameter" "vpc_id" { name = "/platform/prod/vpc_id" }
# Use: data.aws_ssm_parameter.vpc_id.value

# Secrets Manager secret
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/orders/database"
}
# Use: jsondecode(data.aws_secretsmanager_secret_version.db.secret_string)["password"]
```

---

## Ansible YAML Snippets

**Loop patterns:**

```yaml
# Loop over list
- name: Install packages
  ansible.builtin.package:
    name: "{{ item }}"
    state: present
  loop: [nginx, curl, git, python3]

# Loop over dict
- name: Create users
  ansible.builtin.user:
    name: "{{ item.name }}"
    groups: "{{ item.groups }}"
  loop:
    - { name: alice, groups: sudo }
    - { name: bob,   groups: developers }

# Loop with index
- name: Deploy numbered configs
  ansible.builtin.template:
    src: worker.conf.j2
    dest: "/etc/workers/worker-{{ idx }}.conf"
  loop: "{{ worker_configs }}"
  loop_control:
    index_var: idx
    loop_var: worker
```

**block/rescue/always:**

```yaml
- block:
    - name: Deploy application
      ansible.builtin.command: /usr/local/bin/deploy.sh

    - name: Run smoke test
      ansible.builtin.uri:
        url: "http://localhost:8080/health"
        status_code: 200

  rescue:
    - name: Roll back deployment
      ansible.builtin.command: /usr/local/bin/rollback.sh

    - name: Alert on failure
      ansible.builtin.slack:
        token: "{{ slack_token }}"
        msg: "Deployment failed on {{ inventory_hostname }} — rolling back"

  always:
    - name: Clean up temp files
      ansible.builtin.file:
        path: /tmp/deploy-artifacts
        state: absent
```

**delegate_to and run_once:**

```yaml
# Run a task on a different host than the current play target
- name: Register in load balancer before update
  ansible.builtin.uri:
    url: "http://loadbalancer.internal/register/{{ inventory_hostname }}"
    method: POST
  delegate_to: localhost   # run this on the control node

# Run a task once regardless of how many hosts are in play
- name: Initialize database schema (run once)
  ansible.builtin.command: python manage.py migrate
  run_once: true
  delegate_to: "{{ groups['web'][0] }}"   # run on first web host
```

---

## tfsec / Checkov / Terrascan One-Liners

```bash
# tfsec
tfsec .                                          # scan with defaults
tfsec . --minimum-severity HIGH                  # only HIGH and CRITICAL
tfsec . --format json > tfsec.json               # JSON output for CI
tfsec . --exclude aws-s3-no-public-access-block  # exclude specific check
tfsec --version

# Checkov
checkov -d .                                     # scan directory
checkov -f main.tf                               # scan single file
checkov -d . --check CKV_AWS_18                  # run specific check only
checkov -d . --skip-check CKV_AWS_52             # skip specific check
checkov -d . --compact                           # compact output
checkov -d . --output json                       # JSON output
checkov -f tfplan.json --framework terraform_plan # scan plan JSON

# Terrascan
terrascan scan -t aws                            # scan for AWS
terrascan scan -t aws -d .                       # scan specific directory
terrascan scan -t aws --output json              # JSON output

# Infracost (cost estimation)
infracost breakdown --path .                     # show cost estimate
infracost diff --path .                          # show cost change vs baseline
```

---

## Terragrunt CLI Reference

```bash
# Single directory commands (same as terraform but with config inheritance)
terragrunt init
terragrunt plan
terragrunt apply
terragrunt destroy
terragrunt output

# Multi-stack commands
terragrunt run-all plan    # plan all stacks in tree
terragrunt run-all apply   # apply all stacks in dependency order
terragrunt run-all destroy # destroy all stacks in reverse order

# Specific directory
terragrunt run-all plan --terragrunt-working-dir prod/

# Show dependency graph
terragrunt graph-dependencies

# Validate all configs
terragrunt run-all validate
```

---

## Atlantis CLI Patterns

```bash
# Atlantis server
atlantis server \
  --atlantis-url="https://atlantis.company.com" \
  --gh-user=atlantis-bot \
  --gh-token=$GITHUB_TOKEN \
  --gh-webhook-secret=$WEBHOOK_SECRET \
  --repo-allowlist="github.com/company/*"

# PR comment commands (typed in GitHub/GitLab PR comments)
# atlantis plan                    — run plan for all projects in the PR
# atlantis plan -p prod-networking — plan specific project
# atlantis apply                   — apply all projects
# atlantis apply -p prod-networking — apply specific project
# atlantis unlock                  — unlock all projects in PR
```

---

## OpenTofu: Terraform Drop-In Replacement Notes

OpenTofu is the open-source fork of Terraform (created after HashiCorp changed Terraform to BSL license in 2023).

```bash
# Installation
brew install opentofu

# Same CLI as Terraform
tofu init
tofu plan
tofu apply
tofu state list
```

Key differences from Terraform:
- Fully open-source (MPL-2.0 license) — no BSL restrictions
- Drop-in replacement for Terraform 1.x — same HCL, same state format, same providers
- `tofu` command instead of `terraform`
- Registry at registry.opentofu.org (compatible with registry.terraform.io)
- Additional security features: provider signing verification improvements
- Provider support: all Hashicorp providers work, community providers work

Migration:
```bash
# If using Terraform, switch by changing the command name
# Most projects switch by renaming the binary or adjusting CI
alias terraform=tofu
```
