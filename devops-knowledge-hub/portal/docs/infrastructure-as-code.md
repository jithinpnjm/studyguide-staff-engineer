---
title: "🏗️ Infrastructure as Code"
sidebar_position: 5
description: "Zero to hero study guide for Infrastructure as Code — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

Infrastructure as Code is the discipline of managing infrastructure through version-controlled, human-readable configuration files. For a Staff/Principal engineer, IaC is not just a tool choice — it is the foundation of reproducibility, auditability, and scalable operations.

**Benefits of IaC (from PDFs):**
- **Speed** — IaC uses automation to substantially increase provisioning speed for development, testing, and production environments
- **Consistency** — generates the same result every time; same environment every run
- **Cost** — lowering costs of infrastructure management; engineers save time invested in higher-value work
- **Minimum Risk** — configurations can be documented, logged, and tracked; reviewed by policy-as-code (Sentinel) for security leakages
- **Version Controlled** — infrastructure configs checked into GitHub; track what, who, when, and why anything changed
- **Reproducibility** — spin up an identical environment in minutes, not weeks
- **Audit Trail** — every infrastructure change is a reviewed Git commit
- **Disaster Recovery** — rebuild infrastructure from code if needed

Historically, managing IT infrastructure was a manual process: physical servers, manual configuration, deploy-after-configure. Businesses transitioning to the public cloud need a fundamentally different approach — one where resources may only live for hours, and traditional ticket-based provisioning is no longer viable.

---

## Terraform

### What is Terraform?

Terraform, developed by HashiCorp, is an open-source Infrastructure as Code tool that allows users to define, provision, and manage infrastructure resources through configuration files. Resources can be physical or virtual: servers, databases, networking, storage, or Kubernetes clusters. Configurations are written in HashiCorp Configuration Language (HCL), which is both easy to learn and highly expressive.

The beauty of Terraform lies in its ability to abstract infrastructure management into a simplified, declarative model. Instead of manually provisioning resources through cloud dashboards or writing scripts, you describe what your infrastructure should look like — Terraform handles the rest.

Every cloud provider has their own IaC tool (AWS has CloudFormation) but Terraform is open-source and can interact with different cloud providers: AWS, Azure, Google Cloud, and even on-premises environments using providers like VMware and OpenStack.

### How Terraform Works (the Workflow)

From the PDFs, Terraform follows a three-step workflow:

1. **Write** — Define infrastructure in HCL, specifying cloud resources like VMs, networks, and databases
2. **Plan** — Terraform generates an execution plan (`terraform plan`) to show changes before applying
3. **Apply** — Terraform provisions and manages resources (`terraform apply`); maintains a state file to track infrastructure changes

The state file (`terraform.tfstate`) acts as a record of what Terraform has done, allowing it to manage future changes incrementally.

---

## Terraform Commands Reference

### Basic Commands

| Command | Description |
|---------|-------------|
| `terraform init` | Initializes a new or existing Terraform configuration |
| `terraform plan` | Creates an execution plan to preview changes |
| `terraform apply` | Applies the desired infrastructure changes |
| `terraform destroy` | Destroys all resources managed by Terraform |
| `terraform show` | Displays details about Terraform's state or execution plan |
| `terraform output` | Shows values of defined output variables |

### Intermediate Commands

| Command | Description |
|---------|-------------|
| `terraform state list` | Lists all resources managed in Terraform state |
| `terraform state show <resource>` | Shows details of a specific resource |
| `terraform state mv <old> <new>` | Moves a resource within the state file |
| `terraform state rm <resource>` | Removes a resource from Terraform state |
| `terraform import <resource> <id>` | Imports an existing resource into Terraform |
| `terraform taint <resource>` | Marks a resource for replacement on next apply |
| `terraform untaint <resource>` | Removes the taint from a resource |

### Advanced Commands

| Command | Description |
|---------|-------------|
| `terraform fmt` | Formats Terraform files to follow best practices |
| `terraform validate` | Validates the syntax and configuration |
| `terraform graph` | Generates a graph of the Terraform dependency structure |
| `terraform workspace new <name>` | Creates a new Terraform workspace |
| `terraform workspace list` | Lists available workspaces |
| `terraform workspace select <name>` | Switches to a different workspace |
| `terraform refresh` | Updates Terraform state with real infrastructure status |
| `terraform force-unlock <lock-id>` | Forces Terraform to unlock the state |
| `terraform apply -target=<resource>` | Applies changes to a specific resource only |
| `terraform plan -destroy` | Shows a destruction plan without applying it |
| `terraform apply -var="name=value"` | Overrides variable values during execution |
| `terraform apply -parallelism=N` | Limits concurrent resource operations |
| `terraform console` | Opens an interactive Terraform console |
| `terraform test` | Runs Terraform test cases (Terraform 1.6+) |

### Less Common Commands

| Command | Description |
|---------|-------------|
| `terraform providers` | Lists required providers |
| `terraform providers lock` | Locks provider versions in `.terraform.lock.hcl` |
| `terraform providers mirror <dir>` | Mirrors provider binaries to a directory |
| `terraform workspace delete <name>` | Deletes a Terraform workspace |
| `terraform show -json` | Outputs Terraform state in JSON format |
| `terraform output -json` | Shows Terraform output in JSON format |
| `terraform state pull` | Retrieves the current state as a JSON file |
| `terraform state push <statefile>` | Overwrites the current Terraform state |
| `terraform init -upgrade` | Upgrades provider versions based on constraints |
| `terraform fmt -check` | Checks formatting without modifying files |
| `terraform fmt -recursive` | Formats files in subdirectories |

**Quick workflow with comments:**
```bash
touch main.tf           # Create a new Terraform file
terraform init          # Initialize Terraform in the directory
terraform fmt           # Reformats all Terraform files
terraform validate      # Checks for syntax errors
terraform plan          # Shows what Terraform will do
terraform apply         # Creates the infrastructure
terraform state list    # Lists all managed resources
terraform destroy       # Tears down all resources
```

---

## Terraform Configuration Building Blocks

### Provider Block

A provider is a plugin responsible for understanding API interactions and exposing resources. Most providers correspond to one cloud or on-premises infrastructure platform.

```hcl
provider "aws" {
  region = "us-west-2"
}

provider "azurerm" {
  features {}
}

provider "google" {
  credentials = file("file-path.json")
  project     = "my-project-id"
  region      = "us-central1"
}
```

**Important: do not store credentials inside the provider block.** Use environment variables or external authentication mechanisms instead. The provider block is not mandatory if empty — Terraform can infer the required provider through `required_providers`.

**Provider aliases — multiple configurations of the same provider:**
```hcl
provider "aws" {
  region = "ap-southeast-1"
}

provider "aws" {
  alias  = "mumbai"
  region = "ap-south-1"
}

resource "aws_instance" "example" {
  provider = aws.mumbai
  # ...
}
```

**Required providers with version constraints:**
```hcl
terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92.0"
    }
  }
}
```

Version constraint operators: `>=`, `<=`, `~>` (pessimistic constraint — allows patch updates).

Provider tiers:
- **Official** — maintained by HashiCorp (AWS, Azure, GCP)
- **Partner** — verified by third-party vendors
- **Community** — custom providers

### Resource Block

A resource block defines one infrastructure object. It is the fundamental unit of Terraform.

```hcl
resource "aws_instance" "existing_instance" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "web-server"
    Environment = "production"
  }
}

resource "aws_security_group" "example" {
  name = "example"
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Variables

Variables allow parameterizing configurations so the same code can be reused across environments.

```hcl
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}
```

**Using variables:**
```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = var.instance_type
}
```

**Overriding at runtime:**
```bash
terraform apply -var="instance_type=t3.medium"
```

**Using .tfvars files:**
```hcl
# production.tfvars
instance_type = "t3.large"
region        = "us-west-2"
```
```bash
terraform apply -var-file="production.tfvars"
```

**Environment variable override (prefix TF_VAR_):**
```bash
export TF_VAR_instance_type="t3.medium"
terraform apply
```

### Outputs

Outputs expose values after apply — used for passing data between modules or displaying useful information.

```hcl
output "instance_public_ip" {
  description = "Public IP of the EC2 instance"
  value       = aws_instance.web.public_ip
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}
```

```bash
terraform output                    # Show all outputs
terraform output instance_public_ip # Show specific output
terraform output -json              # JSON format
```

### Data Sources

Data sources read from existing infrastructure or external data — read-only queries.

```hcl
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-*-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.medium"
}
```

---

## Terraform State Management

### The State File

The default Terraform state file is `terraform.tfstate`. Terraform tracks the resources it manages through this file, mapping declared resources to real infrastructure.

Key facts:
- `terraform plan` does NOT modify the state file
- `terraform apply` modifies the state file after applying changes
- `terraform destroy` modifies the state file after destroying resources
- Resources can be destroyed via `terraform destroy` OR by removing from .tf files and running `terraform apply`

### Remote State (Secure and Reliable)

**Why remote state?**
- Multiple engineers can't share a local state file
- Local state files can be accidentally deleted or corrupted
- Remote state enables state locking to prevent concurrent operations

**S3 backend with DynamoDB locking:**
```hcl
terraform {
  backend "s3" {
    bucket         = "terraform-state-bucket"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
    kms_key_id     = "arn:aws:kms:us-east-1:123456789:key/your-key-id"
  }
}
```

**Best practices for state security (from interview guide PDF):**
- Store state remotely using a backend (S3, Azure Blob)
- Enable state locking with DynamoDB
- Encrypt state at rest using KMS
- Restrict access via IAM; never commit state to Git
- Use IAM policies to prevent concurrent runs

Scenario from PDF: *State stored in S3, encrypted with KMS, locked using DynamoDB. Access controlled via IAM policies to prevent concurrent runs.*

### State Commands in Practice

```bash
# List all managed resources
terraform state list

# Inspect a specific resource's state
terraform state show aws_instance.web

# Move a resource in state (rename without destroying)
terraform state mv aws_instance.old aws_instance.new

# Remove a resource from state (without destroying the actual resource)
terraform state rm aws_instance.web

# Pull current remote state locally
terraform state pull

# Push local state to remote backend (use with caution)
terraform state push terraform.tfstate
```

### Drift Detection and Handling Manual Changes

If someone manually changed AWS resources that are managed by Terraform, you must carefully handle this to avoid accidental deletions or inconsistencies.

**Step 1: Identify what changed**
```bash
terraform plan -refresh=true
```

Example output showing drift:
```
# aws_security_group.example
~ inbound_rule {
    from_port = 22 → 80
    to_port   = 22 → 80
  }
```
This means someone changed the security group rule from port 22 to port 80 manually.

**Step 2a: The manual changes are wrong — revert them**
```bash
terraform apply
```
Terraform will override the manual changes and revert AWS back to match the configuration. If someone opened SSH (port 22) to the world, `terraform apply` restores the correct security rules.

Or, sync state first then apply:
```bash
terraform refresh   # Updates local state file to match AWS (no infrastructure change)
terraform apply     # Then reverts AWS to match Terraform config
```

**Step 2b: The manual changes are valid — keep them**

Option 1: Import the changed resource into Terraform state:
```bash
terraform import aws_instance.example i-0abcd1234efgh5678
```

Option 2: Update the Terraform `.tf` files to match the manual changes, then apply:
```hcl
resource "aws_security_group" "example" {
  name = "example"
  ingress {
    from_port   = 80  # Updated from 22
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```
```bash
terraform apply
```

**Step 3: Prevent future manual changes**
- Enable AWS IAM restrictions (least privilege) so engineers cannot bypass Terraform
- Use AWS Config rules to detect manual changes
- Set up CloudTrail alerts for changes to Terraform-managed resources

---

## Importing Existing Infrastructure

When a DevOps engineer manually created infrastructure on AWS and you need Terraform to manage it without recreating resources, use `terraform import`.

**Step-by-step import process (from interview mastery PDF):**

**Step 1: Initialize Terraform**
```hcl
# main.tf
provider "aws" {
  region = "us-east-1"
}
```
```bash
terraform init
```

**Step 2: Identify the existing AWS resource**
```bash
aws ec2 describe-instances --query "Reservations[*].Instances[*].InstanceId"
```

**Step 3: Define a matching Terraform resource**
```hcl
resource "aws_instance" "existing_instance" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}
```

**Step 4: Import the resource into Terraform state**
```bash
terraform import aws_instance.existing_instance i-0abcdef1234567890
```
This does NOT modify the resource — it only allows Terraform to track it.

**Step 5: Verify the import**
```bash
terraform show > temp.tf   # See the current state
```

**Step 6: Plan and apply**
```bash
terraform plan   # Verify no unexpected changes
terraform apply  # Apply if everything looks correct
```

---

## Multi-Environment Management

### Approach 1: Terraform Workspaces

Workspaces allow you to use the same code for dev, stage, and prod.

```bash
# Create workspaces
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# List workspaces
terraform workspace list

# Switch to a workspace
terraform workspace select prod

# Check current workspace in config
variable "env" {
  default = terraform.workspace
}
```

**Scenario from PDF:** *We managed dev, stage, and prod using workspaces. Modules were reused with environment-specific variables. The `terraform workspace` command ensured the correct backend and state were used per environment, avoiding resource conflicts.*

### Approach 2: Separate .tfvars Files per Environment

```
envs/
├── dev.tfvars
├── staging.tfvars
└── prod.tfvars
```

```bash
terraform apply -var-file="envs/prod.tfvars"
```

### Approach 3: Separate State Files per Environment (Recommended for Large Teams)

```
envs/
├── dev/
│   ├── main.tf
│   └── backend.tf    # S3 key: "dev/terraform.tfstate"
├── staging/
│   ├── main.tf
│   └── backend.tf    # S3 key: "staging/terraform.tfstate"
└── prod/
    ├── main.tf
    └── backend.tf    # S3 key: "prod/terraform.tfstate"
```

Each environment has its own state file in S3, eliminating cross-environment blast radius.

---

## Terraform Modules

### What is a Module?

A Terraform module is a container for multiple resources used together. Modules are reusable, testable, and composable — they function as an API: inputs are variables, outputs are return values.

**Large-scale project structure (from PDF interview guide):**
```
├── modules/
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── ec2/
│   ├── rds/
│   └── eks/
├── envs/
│   ├── dev/
│   ├── staging/
│   └── prod/
└── README.md
```

**Calling a module:**
```hcl
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "${var.name}-vpc"
  cidr = var.vpc_cidr

  azs             = var.azs
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
  intra_subnets   = var.intra_subnets

  enable_nat_gateway = true
  enable_vpn_gateway = true

  tags = {
    Terraform   = "true"
    Environment = var.env
  }
}
```

**Scenario from PDF:** *For a large-scale migration, we used a mono-repo with shared modules. Teams deployed via `terraform apply` using S3 backend and DynamoDB for state locking.*

### Why Modularize?

- **Avoid Redundancy** — Prevent repetitive code and improve efficiency
- **Enhance Reusability** — Allow easy reuse of infrastructure components
- **Improve Maintainability** — Smaller, focused modules are easier to test and update
- **Team Autonomy** — Different teams can own different modules

---

## Secrets Management in Terraform

**Never hardcode secrets in .tf or .tfvars files.** Three safe approaches:

**Option 1: Environment variables**
```bash
export TF_VAR_db_password="supersecret"
terraform apply
```

**Option 2: AWS Secrets Manager data source**
```hcl
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/myapp/db_password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

**Option 3: AWS SSM Parameter Store**
```hcl
data "aws_ssm_parameter" "db_password" {
  name = "/prod/myapp/db_password"
}
```

**Option 4: SOPS (Secrets OPerationS)**
Encrypt secrets files in git using GPG or AWS KMS. Decrypt at runtime during `terraform apply`.

**Scenario from PDF:** *Used AWS Secrets Manager + `data "aws_secretsmanager_secret_version"`. Secrets never appear in .tf files or state in plaintext.*

---

## Terraform depends_on

`depends_on` forces an explicit dependency between resources. Use it when implicit dependencies are not detected — for example, with `null_resource`, provisioners, or external scripts.

```hcl
resource "null_resource" "setup" {
  provisioner "local-exec" {
    command = "bash setup.sh"
  }
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  depends_on = [null_resource.setup]
}
```

**When to use it:**
- Resource A depends on a side effect from resource B that Terraform can't infer from resource references
- Prevents race conditions during `terraform apply`

**Scenario from PDF:** *`aws_instance` depended on a `null_resource` for setup script. We used `depends_on = [null_resource.setup]` to control execution order.*

---

## Blue/Green Deployments with Terraform

**Approach (from interview guide PDF):**
- Use separate modules or configs for blue and green stacks
- Switch traffic via ALB Target Group or Route 53 weighted routing
- Use `terraform workspace` or parallel stacks for management
- Decommission old stack after validation

**Scenario from PDF:** *Deployed v1 and v2 ECS using separate modules. Route 53 updated to green, and `terraform destroy` old version post validation.*

```hcl
# blue/main.tf
module "ecs_blue" {
  source = "../../modules/ecs"
  name   = "app-blue"
  image  = "myapp:v1.0"
}

# green/main.tf
module "ecs_green" {
  source = "../../modules/ecs"
  name   = "app-green"
  image  = "myapp:v2.0"
}
```

---

## Full EKS Cluster with Terraform

Complete working project from PDFs (Omar Frikha + DevOps Shack):

**main.tf:**
```hcl
terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92.0"
    }
  }
}
```

**variables.tf:**
```hcl
variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-north-1"
}

variable "name" {
  description = "EKS cluster name"
  type        = string
  default     = "tes-dev-eks-cluster"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["eu-north-1a", "eu-north-1b"]
}

variable "private_subnets" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "public_subnets" {
  type    = list(string)
  default = ["10.0.101.0/24", "10.0.102.0/24"]
}

variable "intra_subnets" {
  type    = list(string)
  default = ["10.0.5.0/24", "10.0.6.0/24"]
}

variable "env" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "eks_cluster_version" {
  default = "1.31"
}

variable "vpc_cni_version" {
  default = "v1.14.1-eksbuild.1"
}

variable "coredns_version" {
  default = "v1.10.1-eksbuild.1"
}
```

**vpc.tf:**
```hcl
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "${var.name}-vpc"
  cidr = var.vpc_cidr

  azs             = var.azs
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
  intra_subnets   = var.intra_subnets

  enable_nat_gateway = true
  enable_vpn_gateway = true

  tags = {
    Terraform   = "true"
    Environment = var.env
  }
}
```

**eks.tf:**
```hcl
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = var.name
  cluster_version = var.eks_cluster_version

  cluster_endpoint_public_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_addons = {
    vpc-cni = {
      most_recent   = true
      addon_version = var.vpc_cni_version
    }
    kube-proxy = {
      most_recent = true
    }
    coredns = {
      most_recent   = true
      addon_version = var.coredns_version
    }
  }

  eks_managed_node_groups = {
    default = {
      min_size       = 1
      max_size       = 3
      desired_size   = 2
      instance_types = ["t3.medium"]
      capacity_type  = "SPOT"
    }
  }
}
```

**Objective breakdown from PDF:**
1. Setup AWS credentials
2. Create EKS with Terraform
3. Create Remote backend (S3 + DynamoDB)
4. Modularize Terraform code
5. Create State Locking using DynamoDB
6. Clean up with `terraform destroy`

---

## Terraform Exam / Interview Q&A

**Q1: What does `terraform init` do?**
> Initializes a Terraform working directory. It performs:
> - Downloads Provider Plugins (e.g., AWS, Azure, GCP)
> - Initializes Backend (connects to remote state backend if configured)
> - Installs Modules (downloads required modules)
> - Prepares the Environment for subsequent Terraform commands

**Q2: What does `terraform plan` do?**
> Creates an execution plan showing what changes Terraform will make. It:
> - Compares desired state (configuration files) with current state (state file)
> - Outputs a detailed list of actions (resources to create, update, or destroy)
> - Does NOT modify infrastructure or state file
> Summary: `terraform plan` shows a preview of changes.

**Q3: What does `terraform apply` do?**
> Applies the changes required to reach the desired state. It:
> - Executes actions proposed in the plan
> - Makes actual changes to infrastructure (create, modify, destroy)
> - Updates the state file to reflect current infrastructure state
> Summary: `terraform apply` actually makes the changes.

**Q4: What is Terraform state and why is it important?**
> Terraform state tracks deployed infrastructure and maps it to real-world resources. It is the source of truth for what Terraform currently manages. Without state, Terraform cannot know what exists and what needs to change. State drift (real infrastructure diverges from state) is the primary operational hazard.

**Q5: Where can Terraform store state files?**
> - Locally: `terraform.tfstate` (default; not suitable for teams)
> - Remotely: S3, Azure Blob, Google Cloud Storage, Terraform Cloud

**Q6: How do you enable remote state with locking?**
```hcl
terraform {
  backend "s3" {
    bucket         = "terraform-state-bucket"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-lock-table"
    encrypt        = true
  }
}
```

**Q7: What happens if multiple users modify the same Terraform state file?**
> Without locking, state file corruption can occur. State locking (using DynamoDB for S3 backend) prevents concurrent modifications. When one user runs `terraform apply`, a lock entry is created in DynamoDB. Other users get an error until the lock is released.

**Q8: What is drift detection in Terraform?**
> Drift occurs when manual changes are made to infrastructure that differ from Terraform's state. Run `terraform plan -refresh=true` to detect drift. Terraform shows the difference between state and actual AWS resources.

**Q9: How do you manually remove a resource from the state file?**
```bash
terraform state rm <resource_name>
```
This does not destroy the actual resource — it just removes Terraform's tracking of it.

**Q10: What is `terraform taint`?**
> Marks a resource for forced recreation on the next `terraform apply`. The resource will be destroyed and recreated even if no configuration changes were made. Useful when a resource is in a broken state but Terraform doesn't know it.

**Q11: What is the difference between Terraform and Ansible?**
> Terraform is declarative and focuses on infrastructure provisioning (creating VMs, networks, databases). Ansible is primarily used for configuration management (installing software, configuring services on existing machines). They are complementary: Terraform provisions the infrastructure; Ansible configures it.

**Q12: How do you manage Terraform across multiple environments?**
> Three approaches:
> 1. Terraform workspaces — same code, separate state per workspace
> 2. Separate .tfvars files — same code, environment-specific variable files
> 3. Separate directories/state files — complete isolation per environment (recommended for production)

**Q13: What is a Terraform provider and is the provider block mandatory?**
> A provider is a plugin that interacts with cloud services like AWS, Azure, or GCP. The provider block is not mandatory if empty — Terraform can infer the required provider through `required_providers`. However, a provider itself is mandatory for creating resources.

**Q14: What are version constraints in Terraform?**
> Version constraints control which versions of Terraform and providers are acceptable:
> - `>= 1.2.0` — any version 1.2.0 or higher
> - `<= 1.5.0` — any version 1.5.0 or lower  
> - `~> 5.92.0` — any version in the 5.92.x range (pessimistic constraint)

---

## Ansible

### What is Ansible?

Ansible is an open-source IT automation tool developed by Red Hat (originally by Michael DeHaan in 2012, acquired by Red Hat in 2015). It enables:
- Configuration Management
- Application Deployment
- Orchestration
- Provisioning
- Continuous Delivery

It uses simple YAML files (called playbooks) and does not require an agent to be installed on target machines.

**Why Ansible? Key features:**
- **Agentless** — no software to install on clients; uses SSH (Linux) or WinRM (Windows) for communication
- **Simple and extensible** — written in Python, uses YAML for playbook language
- **Idempotent** — running the same playbook multiple times does not cause unintended changes; tasks execute only when necessary
- **Declarative** — you define the desired state, not the steps to reach that state
- **Scalable** — manages hundreds or thousands of machines with minimal human intervention
- **Auditing** — tracks changes, making auditing easier
- **Cross-platform** — works on Linux, Windows, and macOS

### Why Ansible Over Manual Configuration?

From PDF: *While managing multiple servers, it's hard to keep their configuration identical. If you have multiple servers which need to configure the same setup, doing them one-to-one there might be chances to miss some configuration steps in some servers. That's why automation tools come into play.*

Ansible, Chef, Puppet, and SaltStack are all based on the same principle: **Describe the Desired State of the System**.

---

## Ansible Architecture

```
Control Node (Ansible installed)
       |
       | SSH / WinRM
       |
  +---------+    +---------+    +---------+
  | Managed |    | Managed |    | Managed |
  |  Node 1 |    |  Node 2 |    |  Node 3 |
  +---------+    +---------+    +---------+
```

**Components:**
- **Control Node** — the machine where Ansible is installed and commands are executed; the central orchestrator
- **Managed Nodes** — remote machines (servers, VMs) that Ansible manages; no agent required
- **Inventory** — a file (default: `/etc/ansible/hosts`) defining which machines are managed
- **Playbooks** — YAML files defining what needs to be done
- **Plays** — map a group of hosts to tasks
- **Tasks** — individual actions (install package, copy file, restart service)
- **Modules** — tools/plugins that perform specific operations (yum, apt, service, copy, file, etc.)
- **Handlers** — tasks that run only when notified by another task (e.g., restart Apache only if config changed)
- **Roles** — a way to organize playbooks into reusable units with a standard directory structure
- **Collections** — distribution format for Ansible content (roles, modules, plugins)

---

## Ansible Installation and Setup

### Installing Ansible

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ansible -y

# Or via PPA (latest version)
sudo apt update
sudo apt install software-properties-common
sudo apt-add-repository --yes --update ppa:ansible/ansible
sudo apt install ansible

# RedHat/CentOS/Amazon Linux
sudo yum install ansible -y

# Amazon Linux 2 (extras)
sudo amazon-linux-extras install ansible2 -y
yum install python-pip -y

# macOS
brew install ansible
```

### Verify Installation

```bash
ansible --version
# Shows version, config file location, python version, etc.
```

### Master-Slave Setup (from PDF step-by-step)

**Step 1: Launch instances (1 master, 4 slaves)**

**Step 2: Install Ansible on master**
```bash
amazon-linux-extras install ansible2 -y
yum install python-pip -y
```

**Step 3: Add Ansible user on master**
```bash
useradd ansible
passwd ansible
```

**Step 4: Give root permissions to Ansible user**
```bash
visudo
# Add line: ansible ALL=(ALL) NOPASSWD: ALL
```

**Step 5: Enable password authentication (for SSH key copying)**
```bash
vi /etc/ssh/sshd_config
# Change PasswordAuthentication from no to yes
systemctl restart sshd
```

**Note: Repeat Steps 3-5 on all slave servers**

**Step 6: Switch to ansible user on master**
```bash
su - ansible
```

**Step 7: Generate SSH key pair on master**
```bash
ssh-keygen
# Generates public and private key pair
```

**Step 8: Copy public key to all slaves**
```bash
ssh-copy-id ansible@<slave_ip_1>
ssh-copy-id ansible@<slave_ip_2>
ssh-copy-id ansible@<slave_ip_3>
ssh-copy-id ansible@<slave_ip_4>
```

**Step 9: Verify SSH connectivity**
```bash
ssh ansible@<slave_ip>
```

**Step 10: Configure Ansible inventory**
```bash
vi /etc/ansible/hosts
```
```ini
[dev]
192.168.1.10
192.168.1.11

[test]
192.168.1.20
192.168.1.21
```

**Step 11: Edit ansible.cfg if needed**
```bash
sudo nano /etc/ansible/ansible.cfg
# Set: host_key_checking = False
# So you don't have to specify the inventory file each time
```

---

## Ansible Inventory

The inventory file lists all hosts and server groups.

**Static inventory (INI format):**
```ini
[webservers]
192.168.1.10
192.168.1.11
web1.example.com
web2.example.com

[dbservers]
192.168.1.20

[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/id_rsa
```

**Static inventory (YAML format):**
```yaml
all:
  children:
    webservers:
      hosts:
        web1.example.com:
        web2.example.com:
    dbservers:
      hosts:
        db1.example.com:
```

**Verify connectivity with ping:**
```bash
# Ping all hosts in inventory
ansible all -i host -m ping

# Ping specific group
ansible webservers -i inventory.ini -m ping
```

**Run ad-hoc commands:**
```bash
# Create a directory on all hosts
ansible all -i host -m shell -a "mkdir sample"

# Install httpd on all hosts (with become for sudo)
ansible all -m package -a "name=httpd state=installed" -b

# Uninstall httpd
ansible all -i host -m yum -a "name=httpd state=absent autoremove=true" -b
```

---

## Ansible Playbooks

A playbook is a YAML file describing the tasks to be executed on servers. Think of it as a set of "recipes" for Ansible to follow.

**Key concepts:**
1. **YAML file** — human-readable format
2. **Tasks** — specific actions like "install Apache" or "copy a file"
3. **Plays** — each play targets a group of servers and specifies what tasks to perform
4. **Modules** — tools that perform specific operations (yum, apt, service, copy)

### First Playbook: Install Apache

```yaml
---
- name: Install Apache Web Server
  hosts: webservers
  become: true

  tasks:
    - name: Install Apache
      apt:
        name: apache2
        state: present

    - name: Start and Enable Apache
      service:
        name: apache2
        state: started
        enabled: yes
```

**Line-by-line explanation:**
- `name: Install Apache Web Server` — descriptive name for the play; for readability
- `hosts: webservers` — targets the webservers group from the inventory file
- `become: true` — runs tasks with elevated privileges (sudo/root)
- `tasks:` — list of actions to perform
- `apt:` — Ansible module for package management on Debian/Ubuntu systems
- `name: apache2` — the package to install
- `state: present` — ensures the package is installed; if already present, no action taken
- `service:` — Ansible module for managing services
- `state: started` — ensures the service is running; idempotent

**Syntax check before running:**
```bash
ansible-playbook --syntax-check app.yml
```

**Execute the playbook:**
```bash
ansible-playbook -i host app.yml
```

### Install Apache on Red Hat-based systems:

```yaml
---
- name: Install and configure Apache
  hosts: webservers
  become: yes

  tasks:
    - name: Install Apache
      yum:
        name: httpd
        state: present

    - name: Start Apache service
      service:
        name: httpd
        state: started
        enabled: yes
```

- `yum:` — Ansible module for Red Hat/CentOS/Amazon Linux package management
- `name: httpd` — Apache is called `httpd` on Red Hat-based systems
- `state: started` — if not running, Ansible starts it; if already running, no action

---

## Ansible Advanced Features

### Roles

Roles help structure playbooks by separating tasks, variables, handlers, and files. Use roles for scalability.

**Create a role scaffold:**
```bash
ansible-galaxy init my_role
```

**Role directory structure:**
```
my_role/
├── tasks/
│   └── main.yml      # Main list of tasks
├── handlers/
│   └── main.yml      # Handlers (triggered by notify)
├── templates/
│   └── nginx.conf.j2 # Jinja2 templates
├── files/
│   └── index.html    # Static files to copy
├── vars/
│   └── main.yml      # Variables (high precedence)
├── defaults/
│   └── main.yml      # Default variables (low precedence)
└── meta/
    └── main.yml      # Role metadata and dependencies
```

**Using a role in a playbook:**
```yaml
---
- hosts: webservers
  roles:
    - role: apache
    - role: nginx
```

**Install roles from Ansible Galaxy:**
```bash
ansible-galaxy install geerlingguy.apache
```

**Best practice:** Always review and test Galaxy roles before integrating. Break down tasks into logical roles (apache, mysql, security). Use includes and imports to split large playbooks.

### Ansible Vault (Encrypting Sensitive Data)

```bash
# Encrypt a file
ansible-vault encrypt secrets.yml

# Decrypt a file
ansible-vault decrypt secrets.yml

# Create a new encrypted file
ansible-vault create secrets.yml

# Edit an encrypted file
ansible-vault edit secrets.yml

# Run playbook with vault password
ansible-playbook deploy.yml --ask-vault-pass
```

**Using vault in a playbook:**
```yaml
---
- name: Deploy application with sensitive data
  hosts: webservers
  vars_files:
    - secrets.yml    # This file is vault-encrypted

  tasks:
    - name: Use sensitive data
      debug:
        msg: "Password is {{ vault_db_password }}"
```

**Best practice:** Keep encrypted files separate from unencrypted files. Use `.gitignore` carefully — never commit unencrypted secrets.

### Ansible Loops

```yaml
- name: Install multiple packages
  hosts: all
  tasks:
    - name: Install required packages
      apt:
        name: "{{ item }}"
        state: present
      loop:
        - vim
        - curl
        - git
        - htop
```

### Ansible Conditionals

```yaml
- name: Install software based on OS
  hosts: all
  tasks:
    - name: Install Apache on Debian-based systems
      apt:
        name: apache2
        state: present
      when: ansible_os_family == "Debian"

    - name: Install Apache on RedHat-based systems
      yum:
        name: httpd
        state: present
      when: ansible_os_family == "RedHat"
```

### Handlers

Handlers run only when notified — useful for restarting services only when configuration changes.

```yaml
---
- name: Configure Nginx
  hosts: webservers
  become: yes

  tasks:
    - name: Copy Nginx config
      copy:
        src: files/nginx.conf
        dest: /etc/nginx/nginx.conf
      notify: Restart Nginx       # Only triggers if this task changes something

  handlers:
    - name: Restart Nginx
      service:
        name: nginx
        state: restarted
```

---

## Ansible Error Handling

Errors can occur because a server is offline, a file doesn't exist, permissions are missing, or a command fails. Ansible's error handling ensures the playbook doesn't stop completely.

### ignore_errors

```yaml
tasks:
  - name: Try to remove a file (might not exist)
    file:
      path: /tmp/optional-file
      state: absent
    ignore_errors: yes   # Playbook continues even if this fails
```

### failed_when

```yaml
tasks:
  - name: Run a command
    command: /usr/bin/check-status
    register: result
    failed_when: result.rc != 0 and "WARNING" not in result.stdout
```

### block, rescue, and always

Like try/catch/finally — a safety net for groups of tasks:

```yaml
tasks:
  - block:
      - name: Try to deploy
        command: ./deploy.sh

      - name: Run tests
        command: ./test.sh

    rescue:
      - name: Rollback on failure
        command: ./rollback.sh

      - name: Send failure alert
        debug:
          msg: "Deployment failed, rolled back"

    always:
      - name: Cleanup temp files (always runs)
        file:
          path: /tmp/deploy
          state: absent
```

### register and when

```yaml
tasks:
  - name: Check if service is running
    command: systemctl is-active nginx
    register: nginx_status
    ignore_errors: yes

  - name: Start nginx if not running
    service:
      name: nginx
      state: started
    when: nginx_status.rc != 0
```

### Retries with until

```yaml
tasks:
  - name: Wait for service to respond
    uri:
      url: http://localhost:8080/health
      status_code: 200
    register: result
    until: result.status == 200
    retries: 10
    delay: 5
```

---

## Ansible Best Practices

From the PDF "Top 12 Ansible Playbooks Best Practices":

**1. Clear Naming Conventions**
- Use meaningful, descriptive names for playbooks, tasks, variables, and files
- Follow consistent naming patterns (lowercase with underscores)
```yaml
- name: Install and configure Apache
  hosts: webservers
  tasks:
    - name: Install Apache package
      apt:
        name: apache2
        state: present
```

**2. Modular Design (Use Roles and Includes)**
- Organize playbooks into reusable roles for better scalability
- Break large playbooks into smaller manageable pieces
- Use includes and imports to split large playbooks

**3. Avoid Hardcoding (Use Variables and Defaults)**
```yaml
vars:
  apache_version: "2.4.29"

tasks:
  - name: Install Apache
    apt:
      name: "apache2={{ apache_version }}"
      state: present
```
- Use variable files to separate environment-specific variables (`group_vars/`, `host_vars/`)
- Provide default values using `defaults/main.yml` within roles

**4. Reuse Existing Roles**
```bash
ansible-galaxy install geerlingguy.apache
```

**5. Use Vault for Sensitive Data**
```bash
ansible-vault create secrets.yml
```

**6. Use Handlers for Efficient State Management**
- Restart services only when required
- Prevents unnecessary service restarts

**7. Enable Logging for Troubleshooting**
- Configure logs in `ansible.cfg`
- Use `-v`, `-vv`, `-vvv` for increasing verbosity

**8. Use Dynamic Inventory for Cloud Environments**
- Fetch inventory dynamically instead of maintaining static files
- AWS: use `aws_ec2` plugin to pull EC2 instances dynamically

**9. Test in Staging Before Production**
- Always validate changes in a non-production environment first

**10. Use Tags for Selective Execution**
```yaml
tasks:
  - name: Install Apache
    apt:
      name: apache2
      state: present
    tags: [apache, install]
```
```bash
ansible-playbook site.yml --tags "apache"
ansible-playbook site.yml --skip-tags "install"
```

---

## Ansible Project on AWS (From PDF)

Real-world project: Configure Apache and Nginx server groups on AWS.

**Requirements:**
1. Create two Server Groups (Apache and Nginx)
2. Push two HTML files with server information
3. Start services after installation
4. Send post-installation messages

**Step 1: Configure 3 VMs on AWS (1 master, 2 worker nodes)**

**Step 2: Install Ansible on master**
```bash
sudo apt update
sudo apt install software-properties-common
sudo apt-add-repository --yes --update ppa:ansible/ansible
sudo apt install ansible
```

**Step 3: SSH key setup from master to nodes**
```bash
cd ~/.ssh
ssh-keygen
cat id_rsa.pub
# Copy output to each node's ~/.ssh/authorized_keys
```

**Step 4: Verify SSH connectivity**
```bash
ssh ubuntu@<node1_public_ip>
ssh ubuntu@<node2_public_ip>
```

**Step 5: Configure host file**
```bash
cd /etc/ansible
sudo nano hosts
```
```ini
[apache]
<node1_ip>

[nginx]
<node2_ip>
```

**Step 6: Create and run role-based playbook**
```bash
ansible-galaxy init apache_role
ansible-galaxy init nginx_role
```

Site.yml tying it together:
```yaml
---
- hosts: apache
  roles:
    - apache_role

- hosts: nginx
  roles:
    - nginx_role
```

---

## Ansible vs Terraform: When to Use What

| Aspect | Terraform | Ansible |
|--------|-----------|---------|
| Primary purpose | Infrastructure provisioning | Configuration management |
| Approach | Declarative | Mostly declarative, some imperative |
| State management | Maintains state file | Stateless (idempotent but no state file) |
| Cloud support | Multi-cloud via providers | Multi-cloud via modules |
| Agent required | No | No (agentless) |
| Language | HCL | YAML |
| Best for | Creating VMs, networks, databases | Installing software, configuring servers, deploying apps |

**Typical production workflow:**
1. Terraform provisions the EC2 instances, VPC, RDS, IAM roles
2. Ansible connects via SSH and installs/configures software on those instances
3. CI/CD pipeline (Jenkins, GitHub Actions) runs both in sequence

Popular DevOps tools integrated with Ansible:
- **Jenkins** — automate CI/CD workflows with Ansible for deployment and configuration
- **Docker** — provision and manage containers
- **Kubernetes** — deploy and manage Kubernetes clusters
- **Terraform** — combine with Ansible for infrastructure provisioning + configuration management
- **Git** — store playbooks and roles in version control for collaborative development
