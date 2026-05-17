---
title: "Hands-On Labs"
sidebar_position: 5
---

# Infrastructure as Code — Hands-On Labs

These labs build practical Terraform and Ansible skill for SRE/platform interviews and real production work.

---

## Lab 1: Create A Minimal Terraform Project

**Goal:** Learn the Terraform lifecycle: init, format, validate, plan, apply, output.

```bash
mkdir terraform-basic-lab
cd terraform-basic-lab
```

Create `main.tf`:

```hcl
terraform {
  required_version = ">= 1.3.0"
}

resource "local_file" "hello" {
  filename = "hello.txt"
  content  = "hello from terraform"
}

output "file_path" {
  value = local_file.hello.filename
}
```

Run:

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
terraform output
cat hello.txt
```

Destroy:

```bash
terraform destroy
```

**Review question:** what changed between plan and apply?

---

## Lab 2: Variables, tfvars, And Outputs

**Goal:** Parameterize Terraform so the same configuration can work for multiple environments.

Create `variables.tf`:

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "message" {
  description = "Message to write"
  type        = string
}
```

Create `main.tf`:

```hcl
resource "local_file" "message" {
  filename = "${var.environment}-message.txt"
  content  = var.message
}

output "message_file" {
  value = local_file.message.filename
}
```

Create `dev.tfvars`:

```hcl
environment = "dev"
message     = "hello dev"
```

Run:

```bash
terraform init
terraform plan -var-file="dev.tfvars"
terraform apply -var-file="dev.tfvars"
terraform output
```

---

## Lab 3: Remote State Design Review

**Goal:** Design a production-ready remote state backend.

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

Design checklist:

```text
state bucket versioning enabled
state bucket access restricted
state encrypted
lock table exists
one state per environment or stack
state access audited
state backup and recovery documented
```

**Interview drill:** explain why one global state file for all infrastructure is dangerous.

---

## Lab 4: Build A Reusable Terraform Module

**Goal:** Learn how modules encode platform standards.

Structure:

```text
terraform-modules-lab/
  main.tf
  modules/
    private-bucket/
      main.tf
      variables.tf
      outputs.tf
```

`modules/private-bucket/variables.tf`:

```hcl
variable "name" {
  type = string
}

variable "environment" {
  type = string
}
```

`modules/private-bucket/main.tf`:

```hcl
resource "aws_s3_bucket" "this" {
  bucket = var.name

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

`modules/private-bucket/outputs.tf`:

```hcl
output "bucket_name" {
  value = aws_s3_bucket.this.bucket
}
```

Root `main.tf`:

```hcl
module "logs" {
  source = "./modules/private-bucket"

  name        = "example-company-logs-dev"
  environment = "dev"
}
```

**Review question:** what standards did this module enforce by default?

---

## Lab 5: Terraform Plan Review Exercise

**Goal:** Practice reading Terraform plans like change-control documents.

Create a checklist:

```text
destroy actions
-/+ replacements
security group widening
public exposure
IAM expansion
database replacement
DNS changes
provider upgrade
state address change
cost-impacting changes
```

When reviewing a plan, classify each change:

| Change | Risk | Safe to approve? | Notes |
|---|---|---|---|
| Add private subnet | Low | Yes | Expected for new AZ |
| Replace database | Critical | No | Needs migration plan |
| Open port to world | High | No | Needs justification |

**SRE habit:** if a plan is too large to review, split the change.

---

## Lab 6: Import Existing Infrastructure

**Goal:** Practice the safe import workflow.

Example import block:

```hcl
import {
  to = aws_s3_bucket.logs
  id = "company-prod-logs"
}

resource "aws_s3_bucket" "logs" {
  bucket = "company-prod-logs"
}
```

Run:

```bash
terraform init
terraform plan
terraform apply
terraform plan
```

Expected process:

```text
write resource block
import object
run plan
adjust configuration
repeat until plan has no unexpected changes
commit code
```

**Review question:** why is import not finished immediately after the import command succeeds?

---

## Lab 7: Ansible Inventory And Ping

**Goal:** Understand inventory and host connectivity.

Create `hosts.ini`:

```ini
[web]
web1.example.com
web2.example.com

[all:vars]
ansible_user=ubuntu
```

Check inventory:

```bash
ansible-inventory -i hosts.ini --list
```

Ping hosts:

```bash
ansible all -i hosts.ini -m ping
```

Run a simple command:

```bash
ansible web -i hosts.ini -m command -a "uptime"
```

**Troubleshooting checklist:** DNS, SSH user, key, network route, sudo privileges, Python availability.

---

## Lab 8: Idempotent Ansible Playbook

**Goal:** Write a playbook that is safe to run repeatedly.

Create `nginx.yml`:

```yaml
---
- name: Configure nginx
  hosts: web
  become: true
  tasks:
    - name: Ensure nginx is installed
      ansible.builtin.package:
        name: nginx
        state: present

    - name: Ensure nginx is enabled and running
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

Run twice:

```bash
ansible-playbook -i hosts.ini nginx.yml
ansible-playbook -i hosts.ini nginx.yml
```

Expected result: the second run should report few or no changes.

---

## Lab 9: Ansible Template And Handler

**Goal:** Use templates and handlers for controlled service reloads.

Playbook:

```yaml
---
- name: Configure nginx from template
  hosts: web
  become: true
  vars:
    nginx_port: 80
  tasks:
    - name: Render nginx config
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
        mode: '0644'
      notify: Reload nginx

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

Template `nginx.conf.j2`:

```nginx
worker_processes auto;
events { worker_connections 1024; }
http {
  server {
    listen {{ nginx_port }};
    location / { return 200 "ok\n"; }
  }
}
```

**Review question:** why is a handler safer than restarting the service after every task?

---

## Lab 10: IaC CI Pipeline Shape

**Goal:** Design a pull-request workflow for Terraform.

```yaml
name: Terraform PR

on:
  pull_request:
    paths:
      - 'infra/**'

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform fmt -check -recursive
        working-directory: infra
      - run: terraform init
        working-directory: infra
      - run: terraform validate
        working-directory: infra
      - run: terraform plan
        working-directory: infra
```

Production upgrades:

- Add TFLint, Checkov, tfsec, or Conftest.
- Comment plan summary on PR.
- Apply only after approval from protected branch.
- Use separate identities for plan and apply.

---

## Lab 11: Drift Detection Drill

**Goal:** Practice detecting manual changes.

```bash
terraform plan -refresh-only
```

If drift appears:

```text
classify drift
  -> manual hotfix that should become code
  -> accidental console edit that should be reverted
  -> provider/default change that needs config update
```

Do not blindly apply. Understand which source of truth is correct.
