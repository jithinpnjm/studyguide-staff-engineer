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
