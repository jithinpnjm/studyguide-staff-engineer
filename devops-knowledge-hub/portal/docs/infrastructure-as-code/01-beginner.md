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

## IaC Principles

| Principle | Meaning | Real Example |
|---|---|---|
| Idempotency | Running the same code twice produces the same result | `terraform apply` twice should show no changes on second run |
| Declarative | You state what should exist, not each API step | `resource "aws_s3_bucket"` — not a list of API calls |
| Imperative | You describe each step in sequence | Shell scripts, Ansible `shell:` tasks without state checking |
| Immutable infrastructure | Replace, never modify | New EC2 AMI = terminate old, launch new |
| Mutable infrastructure | Modify in-place | Ansible installs packages on running host |

The declarative model (Terraform) and configuration management model (Ansible) complement each other: Terraform provisions what exists, Ansible configures how it behaves.

---

## Tool Landscape

| Tool | Type | Best For |
|---|---|---|
| Terraform | Declarative IaC | Cloud resource provisioning (AWS, GCP, Azure, K8s) |
| OpenTofu | Declarative IaC | Open-source Terraform drop-in replacement |
| Pulumi | Imperative IaC | Teams preferring TypeScript/Python over HCL |
| AWS CDK | Imperative IaC | AWS-native teams already in TypeScript/Python |
| Ansible | Configuration management | OS-level config, package install, service management |
| Chef | Configuration management | Ruby-based CM for enterprises; largely replaced by Ansible |
| Puppet | Configuration management | Declarative Ruby DSL; older enterprise fleets |

Rule of thumb: Terraform/OpenTofu to provision, Ansible to configure. Never use Ansible to create AWS VPCs (use Terraform). Never use Terraform to install packages on Linux hosts (use Ansible).

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

## Terraform Three-Reality Mental Model

Terraform manages three realities simultaneously:

| Reality | Meaning |
|---|---|
| Desired state | What your `.tf` code declares should exist |
| Recorded state | What `terraform.tfstate` believes currently exists |
| Actual reality | What the cloud provider APIs actually report |

`terraform plan` compares all three. If recorded state diverges from actual reality (drift), Terraform will detect it and show what changed.

---

## Full Working Terraform Example: VPC + EC2

This is a complete, runnable Terraform project that creates a VPC, public subnet, security group, and EC2 instance on AWS.

**File layout:**

```text
terraform-vpc-ec2/
  providers.tf
  variables.tf
  main.tf
  outputs.tf
  terraform.tfvars
```

**providers.tf**

```hcl
terraform {
  required_version = ">= 1.5.0"
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

**variables.tf**

```hcl
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-central-1"
}

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

**main.tf**

```hcl
# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "main-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "igw-${var.environment}"
    Environment = var.environment
  }
}

# Public Subnet
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name        = "public-${var.environment}"
    Environment = var.environment
  }
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "rtb-public-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security Group — SSH access
resource "aws_security_group" "web" {
  name        = "web-${var.environment}"
  description = "Allow SSH inbound"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]   # restrict to internal range, never 0.0.0.0/0 in prod
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "sg-web-${var.environment}"
    Environment = var.environment
  }
}

# Data source: look up latest Ubuntu 22.04 AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]   # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 Instance
resource "aws_instance" "web" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]

  tags = {
    Name        = "web-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

**outputs.tf**

```hcl
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.web.id
}

output "instance_public_ip" {
  description = "EC2 public IP"
  value       = aws_instance.web.public_ip
}
```

**terraform.tfvars**

```hcl
environment   = "dev"
aws_region    = "eu-central-1"
instance_type = "t3.micro"
```

---

## Terraform Init / Plan / Apply / Destroy Walkthrough

**Step 1: `terraform init`**

```bash
terraform init
```

What happens:
- Downloads providers listed in `required_providers`
- Initializes the backend (local by default)
- Creates `.terraform/` directory with provider binaries
- Creates `.terraform.lock.hcl` with pinned provider checksums

Output you will see:
```text
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.31.0...
- Installed hashicorp/aws v5.31.0

Terraform has been successfully initialized!
```

**Step 2: `terraform plan`**

```bash
terraform plan
```

What happens:
- Reads current state
- Queries the real provider APIs (refresh)
- Computes diff between desired and recorded state
- Prints a detailed change plan

Reading the output:
```text
+ resource will be created
~ resource will be updated in-place
- resource will be destroyed
-/+ resource will be destroyed and re-created (replacement)
<= data source will be read
```

The summary line shows: `Plan: 7 to add, 0 to change, 0 to destroy.`

**Step 3: `terraform apply`**

```bash
terraform apply
```

Terraform prints the plan again and asks for confirmation:
```text
Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: yes
```

After `yes`:
- Each resource is created in dependency order
- State is updated after each resource
- Outputs are printed at the end

```text
Apply complete! Resources: 7 added, 0 changed, 0 destroyed.

Outputs:

instance_id = "i-0a1b2c3d4e5f6"
instance_public_ip = "3.72.100.50"
vpc_id = "vpc-0a1234b5678c9"
```

**Step 4: `terraform destroy`**

```bash
terraform destroy
```

Destroys all resources in reverse dependency order. Safe for dev environments. Use `prevent_destroy` lifecycle rule to protect production resources from accidental destruction.

---

## Terraform State File Explained

After `apply`, Terraform creates `terraform.tfstate`. This is a JSON file that maps every resource block in your code to a real cloud resource ID.

A simplified excerpt:

```json
{
  "version": 4,
  "terraform_version": "1.5.7",
  "resources": [
    {
      "type": "aws_vpc",
      "name": "main",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        {
          "attributes": {
            "id": "vpc-0a1234b5678c",
            "cidr_block": "10.0.0.0/16",
            "enable_dns_hostnames": true
          }
        }
      ]
    }
  ]
}
```

Why it is dangerous to share via Git:
- State contains all resource attributes, including any secrets Terraform generated
- If `random_password` resources exist, the plaintext password is in state
- If RDS credentials were passed as variables, they may appear in state
- Anyone with state read access can see these values

Production rules:
1. Never commit `terraform.tfstate` to Git — add it to `.gitignore`
2. Use a remote backend (S3 + DynamoDB) for teams
3. Enable S3 bucket versioning so state can be rolled back
4. Enable SSE-KMS encryption on the state bucket
5. Restrict IAM access to the state bucket to only those who need it

---

## Ansible Complete Working Example

This is a complete Ansible project that installs and configures nginx on Ubuntu.

**Inventory file `hosts.ini`:**

```ini
[web]
web1.example.com
web2.example.com

[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/id_ed25519
```

**Playbook `nginx.yml`:**

```yaml
---
- name: Install and configure nginx on Ubuntu
  hosts: web
  become: true
  gather_facts: true

  vars:
    nginx_port: 80
    nginx_worker_processes: auto

  tasks:
    - name: Update apt cache
      ansible.builtin.apt:
        update_cache: true
        cache_valid_time: 3600

    - name: Install nginx
      ansible.builtin.apt:
        name: nginx
        state: present

    - name: Render nginx configuration
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

  handlers:
    - name: Reload nginx
      ansible.builtin.systemd:
        name: nginx
        state: reloaded
```

**Template `nginx.conf.j2`:**

```nginx
worker_processes {{ nginx_worker_processes }};

events {
    worker_connections 1024;
}

http {
    server {
        listen {{ nginx_port }};
        server_name _;
        location / {
            return 200 "OK\n";
        }
    }
}
```

**Run the playbook:**

```bash
ansible-playbook -i hosts.ini nginx.yml
```

**Verify it is idempotent (run twice — second run should show no changes):**

```bash
ansible-playbook -i hosts.ini nginx.yml
# PLAY RECAP: web1 ok=4 changed=0 unreachable=0 failed=0
```

---

## Ansible Ad-Hoc Commands

Ad-hoc commands run a single module against inventory without a playbook:

```bash
# Check connectivity to all hosts
ansible all -i hosts.ini -m ping

# Check uptime on all hosts
ansible all -i hosts.ini -m shell -a "uptime"

# Install nginx on the web group
ansible web -i hosts.ini -m apt -a "name=nginx state=present" --become

# Show disk usage
ansible all -i hosts.ini -m shell -a "df -h" --become

# Restart nginx
ansible web -i hosts.ini -m systemd -a "name=nginx state=restarted" --become

# Check OS info
ansible all -i hosts.ini -m setup -a "filter=ansible_distribution*"
```

The `-m` flag specifies the module. The `-a` flag passes arguments to the module.

---

## Beginner Takeaways

1. IaC makes infrastructure reproducible and reviewable.
2. Terraform manages infrastructure through desired state and state files.
3. `plan` is the safety checkpoint before `apply`.
4. State must be protected like production metadata — never commit to Git.
5. Modules encode platform standards.
6. Ansible automates host configuration through SSH.
7. Good automation is idempotent: running it twice should be safe.
8. IaC does not replace infrastructure knowledge; it exposes it as code.
9. Terraform for provisioning cloud resources; Ansible for configuring OS-level state.
10. The tool landscape spans declarative (Terraform), imperative (Pulumi/CDK), and configuration management (Ansible/Chef/Puppet) — choose based on the layer you are managing.
