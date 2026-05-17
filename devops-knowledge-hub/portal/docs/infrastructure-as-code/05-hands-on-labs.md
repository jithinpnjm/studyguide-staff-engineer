---
title: "Hands-On Labs"
sidebar_position: 5
---

# Infrastructure as Code — Hands-On Labs

These labs build practical Terraform and Ansible skill for SRE/platform interviews and real production work.

**Prerequisites for AWS labs:** AWS account, CLI configured with credentials, Terraform 1.5+, Ansible 8+.

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

---

## Lab 12: Complete Terraform AWS Project — VPC + EC2 + Security Groups

**Goal:** Build a complete multi-resource AWS project from scratch with proper file structure, outputs, and the full lifecycle.

**Setup:**

```bash
mkdir terraform-aws-lab && cd terraform-aws-lab
touch providers.tf variables.tf main.tf outputs.tf terraform.tfvars
```

**providers.tf:**

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

**variables.tf:**

```hcl
variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "environment" {
  type    = string
  default = "lab"
}

variable "vpc_cidr" {
  type    = string
  default = "10.99.0.0/16"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}
```

**main.tf:**

```hcl
# Data source — look up latest Ubuntu 22.04 AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

data "aws_availability_zones" "available" { state = "available" }

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  tags = { Name = "lab-vpc", Environment = var.environment }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "lab-igw" }
}

# Public subnets in 2 AZs
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "public-${count.index + 1}", Environment = var.environment }
}

# Private subnets in 2 AZs
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "private-${count.index + 1}", Environment = var.environment }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "lab-public-rtb" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Security group — SSH from within VPC only
resource "aws_security_group" "web" {
  name   = "lab-web-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "lab-web-sg", Environment = var.environment }
}

# EC2 instance in first public subnet
resource "aws_instance" "web" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.web.id]

  user_data = <<-EOF
    #!/bin/bash
    apt-get update -y
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
  EOF

  tags = { Name = "lab-web", Environment = var.environment, ManagedBy = "terraform" }
}
```

**outputs.tf:**

```hcl
output "vpc_id"          { value = aws_vpc.main.id }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "instance_id"     { value = aws_instance.web.id }
output "instance_public_ip" { value = aws_instance.web.public_ip }
output "web_url"         { value = "http://${aws_instance.web.public_ip}" }
```

**Run:**

```bash
terraform init
terraform fmt
terraform validate
terraform plan          # review the plan — 9 resources to create
terraform apply         # type 'yes' when prompted
terraform output        # show all outputs
curl $(terraform output -raw web_url)   # should return nginx page
terraform destroy       # clean up lab resources
```

**Review questions:**
1. Which resources did Terraform create first, and why?
2. What would happen if you ran `terraform apply` a second time without changes?
3. What would the plan show if you changed `instance_type` from `t3.micro` to `t3.small`?

---

## Lab 13: Remote State with S3 + DynamoDB Locking

**Goal:** Migrate from local state to a remote S3 backend with locking.

**Step 1: Create backend infrastructure (run locally first)**

```bash
mkdir terraform-backend-bootstrap && cd terraform-backend-bootstrap
```

Create `main.tf`:

```hcl
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" { region = "eu-central-1" }

resource "aws_s3_bucket" "state" {
  bucket = "my-terraform-state-${random_id.suffix.hex}"
  lifecycle { prevent_destroy = true }
}

resource "random_id" "suffix" { byte_length = 4 }

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute { name = "LockID", type = "S" }
}

output "state_bucket_name" { value = aws_s3_bucket.state.bucket }
```

```bash
terraform init && terraform apply
BUCKET_NAME=$(terraform output -raw state_bucket_name)
echo "Bucket: $BUCKET_NAME"
```

**Step 2: Add backend config to an existing project**

```hcl
# Add to your project's main.tf or a new backend.tf file
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-XXXX"   # your bucket name
    key            = "lab/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

**Step 3: Migrate local state to remote**

```bash
# This command reads local state and pushes to S3
terraform init -migrate-state
# Confirm with 'yes' when prompted
```

**Step 4: Verify the lock works**

Open two terminals and run `terraform apply` in both simultaneously. The second terminal should show:

```text
Error: Error acquiring the state lock

Error message: ConditionalCheckFailedException: The conditional request failed
Lock Info:
  ID:        abc123-def456
  Path:      lab/terraform.tfstate
  Operation: OperationTypeApply
  Who:       user@machine
  Created:   2024-01-15 10:30:00 +0000 UTC
```

**Step 5: Simulate stuck lock and force-unlock**

```bash
# Interrupt an apply with Ctrl-C
# Check if lock exists
aws dynamodb get-item \
  --table-name terraform-locks \
  --key '{"LockID": {"S": "my-terraform-state-XXXX/lab/terraform.tfstate"}}'

# Verify no apply is actually running, then unlock
terraform force-unlock <lock-id-from-output>
```

---

## Lab 14: Terraform Reusable EC2 Module

**Goal:** Create a reusable EC2 module with variables and outputs, then call it from a root module.

**Module structure:**

```bash
mkdir -p terraform-module-lab/modules/ec2-instance
mkdir terraform-module-lab/envs/dev
```

**modules/ec2-instance/variables.tf:**

```hcl
variable "name"        { type = string }
variable "environment" { type = string }
variable "subnet_id"   { type = string }
variable "vpc_id"      { type = string }
variable "ami_id"      { type = string }
variable "instance_type" {
  type    = string
  default = "t3.micro"
}
variable "allowed_ssh_cidrs" {
  type    = list(string)
  default = []
}
```

**modules/ec2-instance/main.tf:**

```hcl
resource "aws_security_group" "this" {
  name   = "${var.name}-sg"
  vpc_id = var.vpc_id

  dynamic "ingress" {
    for_each = length(var.allowed_ssh_cidrs) > 0 ? [1] : []
    content {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.allowed_ssh_cidrs
    }
  }

  egress {
    from_port   = 0; to_port = 0; protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-sg", Environment = var.environment }
}

resource "aws_instance" "this" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.this.id]

  tags = {
    Name        = var.name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

**modules/ec2-instance/outputs.tf:**

```hcl
output "instance_id"  { value = aws_instance.this.id }
output "private_ip"   { value = aws_instance.this.private_ip }
output "public_ip"    { value = aws_instance.this.public_ip }
output "sg_id"        { value = aws_security_group.this.id }
```

**envs/dev/main.tf — calling the module twice:**

```hcl
module "web_server" {
  source = "../../modules/ec2-instance"

  name              = "dev-web"
  environment       = "dev"
  subnet_id         = "subnet-xxxx"
  vpc_id            = "vpc-xxxx"
  ami_id            = "ami-xxxx"
  instance_type     = "t3.micro"
  allowed_ssh_cidrs = ["10.0.0.0/8"]
}

module "worker" {
  source = "../../modules/ec2-instance"

  name          = "dev-worker"
  environment   = "dev"
  subnet_id     = "subnet-yyyy"
  vpc_id        = "vpc-xxxx"
  ami_id        = "ami-xxxx"
  instance_type = "t3.small"
  # No SSH — worker has no ingress
}

output "web_server_ip" { value = module.web_server.public_ip }
output "worker_ip"     { value = module.worker.private_ip }
```

```bash
cd envs/dev
terraform init
terraform plan
```

---

## Lab 15: Ansible Role for nginx with Template, Handler, and Defaults

**Goal:** Create a proper Ansible role with defaults, template, and handler. Deploy to an EC2 instance.

**Setup:**

```bash
mkdir -p ansible-role-lab/roles/nginx/{tasks,handlers,defaults,templates}
mkdir ansible-role-lab/inventory
```

**inventory/hosts.ini:**

```ini
[web]
web1 ansible_host=<your-ec2-ip> ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/lab-key.pem
```

**roles/nginx/defaults/main.yml:**

```yaml
---
nginx_port: 80
nginx_worker_processes: auto
nginx_worker_connections: 1024
nginx_root: /var/www/html
```

**roles/nginx/tasks/main.yml:**

```yaml
---
- name: Install nginx
  ansible.builtin.apt:
    name: nginx
    state: present
    update_cache: true

- name: Create web root directory
  ansible.builtin.file:
    path: "{{ nginx_root }}"
    state: directory
    owner: www-data
    group: www-data
    mode: '0755'

- name: Deploy nginx configuration
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    owner: root
    group: root
    mode: '0644'
    validate: nginx -t -c %s
  notify: Reload nginx

- name: Deploy index page
  ansible.builtin.copy:
    content: "<h1>Managed by Ansible on {{ inventory_hostname }}</h1>"
    dest: "{{ nginx_root }}/index.html"
    mode: '0644'

- name: Enable and start nginx
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
error_log /var/log/nginx/error.log warn;

events {
    worker_connections {{ nginx_worker_connections }};
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent"';

    access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    keepalive_timeout  65;

    server {
        listen       {{ nginx_port }};
        server_name  _;
        root         {{ nginx_root }};
        index        index.html;
    }
}
```

**site.yml:**

```yaml
---
- name: Configure web servers
  hosts: web
  become: true
  roles:
    - nginx
```

**Run:**

```bash
# Test connectivity
ansible all -i inventory/hosts.ini -m ping

# Run in check mode first (dry run)
ansible-playbook -i inventory/hosts.ini site.yml --check --diff

# Apply
ansible-playbook -i inventory/hosts.ini site.yml

# Run again — verify idempotency (should show 0 changes)
ansible-playbook -i inventory/hosts.ini site.yml

# Override the port variable
ansible-playbook -i inventory/hosts.ini site.yml -e "nginx_port=8080"
```

---

## Lab 16: Ansible Vault — Encrypt DB Password and Use in Playbook

**Goal:** Encrypt a database password with Ansible Vault and use it in a playbook.

**Step 1: Create vault password file (not committed to Git)**

```bash
echo "my-vault-password-123" > ~/.ansible-vault-pass
chmod 600 ~/.ansible-vault-pass
```

**Step 2: Create an encrypted variable file**

```bash
ansible-vault create \
  --vault-password-file ~/.ansible-vault-pass \
  group_vars/all/secrets.yml
```

In the editor that opens, type:

```yaml
vault_db_password: "supersecretdbpass"
vault_api_key: "abc123xyz789"
```

Save and exit. The file is now encrypted.

**Step 3: Create an unencrypted vars file that references vault variables**

```bash
mkdir -p group_vars/all
```

**group_vars/all/vars.yml** (not encrypted):

```yaml
---
db_password: "{{ vault_db_password }}"
api_key: "{{ vault_api_key }}"
db_host: "rds.eu-central-1.amazonaws.com"
```

**Step 4: Create a playbook that uses the secret**

```yaml
# deploy.yml
---
- name: Deploy application config
  hosts: web
  become: true
  tasks:
    - name: Deploy application config file
      ansible.builtin.template:
        src: app.conf.j2
        dest: /etc/myapp/config.conf
        owner: app
        group: app
        mode: '0600'

    - name: Ensure application is running
      ansible.builtin.systemd:
        name: myapp
        state: started
```

**templates/app.conf.j2:**

```ini
[database]
host={{ db_host }}
password={{ db_password }}

[api]
key={{ api_key }}
```

**Step 5: Run the playbook with vault**

```bash
# With password file
ansible-playbook -i hosts.ini deploy.yml \
  --vault-password-file ~/.ansible-vault-pass

# With prompt
ansible-playbook -i hosts.ini deploy.yml --ask-vault-pass

# Encrypt a single inline string
ansible-vault encrypt_string \
  --vault-password-file ~/.ansible-vault-pass \
  'newsecretvalue' --name 'new_variable'
```

**Step 6: View the encrypted file (for audit)**

```bash
ansible-vault view \
  --vault-password-file ~/.ansible-vault-pass \
  group_vars/all/secrets.yml
```

---

## Lab 17: Atlantis PR Workflow Simulation

**Goal:** Understand how Atlantis works for PR-based IaC governance.

**Step 1: Install Atlantis locally for simulation**

```bash
# Install Atlantis
brew install atlantis   # macOS
# or download from https://github.com/runatlantis/atlantis/releases

# Set up local test
export AWS_DEFAULT_REGION=eu-central-1
atlantis testdrive
```

**Step 2: Create atlantis.yaml in your project**

```yaml
# atlantis.yaml
version: 3
automerge: false
parallel_plan: true
parallel_apply: false
projects:
  - name: prod-networking
    dir: envs/prod/networking
    workspace: default
    autoplan:
      when_modified: ["*.tf", "*.tfvars", "../../modules/**/*.tf"]
      enabled: true
    apply_requirements:
      - approved
      - mergeable
  - name: prod-databases
    dir: envs/prod/databases
    autoplan:
      enabled: true
    apply_requirements:
      - approved
      - mergeable
      - undiverged
```

**Atlantis workflow in a PR:**

```text
1. Push branch: git push origin feature/add-subnet

2. Open PR on GitHub

3. Atlantis automatically runs:
   atlantis plan -d envs/prod/networking
   (Posts plan output as PR comment)

4. Reviewer reads:
   Plan: 1 to add, 0 to change, 0 to destroy.
   + aws_subnet.private["az-c"]

5. Reviewer approves PR

6. Operator comments on PR:
   atlantis apply -p prod-networking

7. Atlantis applies and posts result:
   Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

8. PR is merged
```

**Manual atlantis plan from CLI:**

```bash
# Simulate what Atlantis would run
cd envs/prod/networking
terraform init
terraform plan -out=tfplan
terraform show tfplan
```

---

## Lab 18: tfsec + Checkov in GitHub Actions

**Goal:** Add security scanning to a Terraform project's CI pipeline.

**Create `.github/workflows/terraform-security.yml`:**

```yaml
name: Terraform Security Scan

on:
  pull_request:
    paths:
      - '**.tf'
      - '**.tfvars'

jobs:
  tfsec:
    name: tfsec Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tfsec
        uses: aquasecurity/tfsec-action@v1.0.0
        with:
          minimum_severity: HIGH
          soft_fail: false

  checkov:
    name: Checkov Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Checkov
        id: checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: .
          framework: terraform
          soft_fail: false
          output_format: sarif
          output_file_path: checkov.sarif

      - name: Upload SARIF results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: checkov.sarif
```

**Skip specific checks with inline annotations:**

```hcl
resource "aws_s3_bucket" "public_website" {
  bucket = "company-public-website"

  # tfsec:ignore:aws-s3-no-public-access-block
  # Reason: This is an intentional public website bucket
}
```

```hcl
resource "aws_s3_bucket" "public_website" {
  #checkov:skip=CKV_AWS_18:Public website — access logging not required
  #checkov:skip=CKV_AWS_52:Public website — MFA delete not required
  bucket = "company-public-website"
}
```

**Run locally:**

```bash
# tfsec
tfsec . --minimum-severity HIGH

# Checkov
checkov -d . --framework terraform

# See what checks exist
checkov --list
```

---

## Lab 19: Molecule Test for an Ansible Role

**Goal:** Write and run molecule tests for the nginx role from Lab 15.

**Install molecule:**

```bash
pip install molecule molecule-docker docker
```

**Initialize molecule in the nginx role:**

```bash
cd roles/nginx
molecule init scenario --driver-name docker
```

**molecule/default/molecule.yml:**

```yaml
---
dependency:
  name: galaxy
driver:
  name: docker
platforms:
  - name: ubuntu-test
    image: "geerlingguy/docker-ubuntu2204-ansible:latest"
    pre_build_image: true
    command: /lib/systemd/systemd
    volumes:
      - /sys/fs/cgroup:/sys/fs/cgroup:rw
    cgroupns_mode: host
    privileged: true
provisioner:
  name: ansible
  inventory:
    host_vars:
      ubuntu-test:
        nginx_port: 80
        nginx_worker_connections: 512
verifier:
  name: ansible
lint: |
  set -e
  yamllint .
  ansible-lint
```

**molecule/default/verify.yml:**

```yaml
---
- name: Verify nginx role
  hosts: all
  gather_facts: false
  tasks:
    - name: Check if nginx binary exists
      ansible.builtin.stat:
        path: /usr/sbin/nginx
      register: nginx_binary

    - name: Assert nginx binary exists
      ansible.builtin.assert:
        that: nginx_binary.stat.exists
        fail_msg: "nginx binary not found"

    - name: Gather service facts
      ansible.builtin.service_facts:

    - name: Assert nginx is running
      ansible.builtin.assert:
        that:
          - "'nginx' in ansible_facts.services"
          - "ansible_facts.services['nginx'].state == 'running'"
        fail_msg: "nginx is not running"

    - name: Assert nginx config is valid
      ansible.builtin.command: nginx -t
      changed_when: false

    - name: Check nginx responds on port 80
      ansible.builtin.uri:
        url: "http://localhost:80"
        status_code: 200
      register: health_check

    - name: Assert HTTP 200 response
      ansible.builtin.assert:
        that: health_check.status == 200
```

**Run full molecule test cycle:**

```bash
# Full test (lint → create → converge → idempotency → verify → destroy)
molecule test

# Step-by-step for debugging
molecule create          # start container
molecule converge        # run the role
molecule verify          # run assertions
molecule idempotency     # run role again, check for 0 changes
molecule destroy         # clean up
```

**Idempotency test output (good):**

```text
TASK [Ensure nginx is installed] ****************************
ok: [ubuntu-test]

TASK [Deploy nginx configuration] ***************************
ok: [ubuntu-test]

PLAY RECAP ***************************************************
ubuntu-test: ok=4 changed=0 unreachable=0 failed=0
```

If idempotency fails, look for tasks that always show `changed`. Add `changed_when: false` or switch from `command:` to a declarative module.
