---
title: "Beginner"
sidebar_position: 1
---

# Infrastructure as Code — Beginner

Infrastructure as Code is the practice of managing infrastructure using version-controlled configuration files instead of manual console clicks. For an SRE or platform engineer, IaC is the foundation of reproducibility, reviewability, disaster recovery, and scalable operations.

The beginner mental model is simple:

```text
human intent -> code -> plan -> review -> apply -> state -> real infrastructure
```

IaC does not remove the need to understand cloud infrastructure. It makes infrastructure changes explicit, repeatable, and reviewable.

---

## Why IaC Matters

Manual infrastructure does not scale well.

Without IaC:

- Environments drift over time.
- Nobody knows exactly who changed what.
- Rebuilding after an incident is slow.
- Security review happens after the fact.
- Production and staging become different.
- Knowledge is trapped in individual engineers.

With IaC:

- Infrastructure is version controlled.
- Changes go through pull requests.
- Plans can be reviewed before apply.
- Environments can be reproduced.
- Modules encode platform standards.
- Audit trails become natural.

---

## Core IaC Benefits

| Benefit | What it means in practice |
|---|---|
| Speed | Create dev, staging, and production environments faster |
| Consistency | Same code produces the same shape of infrastructure |
| Version control | Git shows what changed, who changed it, and why |
| Reviewability | Pull requests expose infra changes before execution |
| Reproducibility | Rebuild an environment from code |
| Disaster recovery | Restore infrastructure faster after failure |
| Cost control | Review instance size, retention, and scaling settings in code |
| Security | Enforce standards using policy-as-code |

---

## Terraform Basics

Terraform is an Infrastructure as Code tool from HashiCorp. It lets you describe infrastructure in HCL and manage resources across AWS, Azure, GCP, Kubernetes, GitHub, and many other providers.

Terraform workflow:

```text
write -> init -> validate -> plan -> apply -> observe
```

Commands:

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
terraform output
terraform state list
```

Terraform is declarative. You describe the desired state; Terraform calculates the actions required to reach it.

---

## Terraform Files

A small Terraform project often looks like this:

```text
terraform/
  main.tf
  providers.tf
  variables.tf
  outputs.tf
  terraform.tfvars
```

Common file responsibilities:

| File | Purpose |
|---|---|
| `providers.tf` | Provider requirements and provider configuration |
| `main.tf` | Main resources and modules |
| `variables.tf` | Input variable definitions |
| `outputs.tf` | Values exported after apply |
| `terraform.tfvars` | Environment-specific values |

Terraform does not require these exact filenames, but this structure is easier to maintain.

---

## Provider Block

A provider is a plugin that lets Terraform talk to an API.

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

Avoid hardcoding credentials in provider blocks. Use environment credentials, cloud workload identity, CI identity, or local authenticated profiles.

---

## Resource Block

A resource block defines one managed object.

```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "example-platform-logs"

  tags = {
    Environment = "prod"
    Owner       = "platform"
  }
}
```

Terraform address:

```text
aws_s3_bucket.logs
```

That address is how Terraform tracks the resource in state.

---

## Variables

Variables make configuration reusable.

```hcl
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}
```

Use variables:

```hcl
resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = var.instance_type

  tags = {
    Environment = var.environment
  }
}
```

Set values:

```bash
terraform apply -var="environment=staging"
terraform apply -var-file="production.tfvars"
```

---

## Outputs

Outputs expose useful values after apply.

```hcl
output "bucket_name" {
  value = aws_s3_bucket.logs.bucket
}
```

Show outputs:

```bash
terraform output
terraform output -json
```

Outputs are commonly used by humans, CI/CD systems, or other Terraform states.

---

## State

Terraform state is the mapping between code and real infrastructure.

```text
Terraform state says: this resource block controls that real cloud object.
```

State is critical. If state is lost, Terraform no longer knows what it manages.

Beginner rules:

- Do not commit `terraform.tfstate` to Git.
- Use remote state for teams.
- Enable state locking.
- Restrict state access because it may contain sensitive values.
- Back up state.

---

## Remote State

For AWS, a common remote backend is S3 plus DynamoDB locking.

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

Why remote state matters:

- Team collaboration
- Locking to prevent concurrent applies
- Central backup
- Audit and access control

---

## Modules

A module is a reusable Terraform package.

```text
root module -> calls child modules -> creates resources
```

Example:

```hcl
module "vpc" {
  source = "./modules/vpc"

  name = "prod"
  cidr = "10.0.0.0/16"
}
```

Modules help platform teams encode standards: tags, encryption, logging, backup defaults, networking patterns, and naming conventions.

---

## Ansible Basics

Ansible is an agentless automation tool for configuration management and host automation. It connects to managed hosts over SSH and runs tasks described in YAML playbooks.

Mental model:

```text
control node -> SSH -> managed nodes -> desired host configuration
```

Ansible is useful for:

- Installing packages
- Managing files and templates
- Configuring services
- Bootstrapping hosts
- Managing legacy VM fleets
- Preparing nodes before Kubernetes

---

## Inventory And Playbooks

Inventory defines hosts:

```ini
[web]
web1.example.com
web2.example.com

[all:vars]
ansible_user=ubuntu
```

Playbook defines tasks:

```yaml
---
- name: Configure web servers
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present

    - name: Ensure nginx is running
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

Run it:

```bash
ansible-playbook -i hosts.ini site.yml
```

---

## Beginner Takeaways

1. IaC makes infrastructure reproducible and reviewable.
2. Terraform manages infrastructure through desired state and state files.
3. `plan` is the safety checkpoint before `apply`.
4. State must be protected like production metadata.
5. Modules encode platform standards.
6. Ansible automates host configuration through SSH.
7. Good automation is idempotent: running it twice should be safe.
8. IaC does not replace infrastructure knowledge; it exposes it as code.
