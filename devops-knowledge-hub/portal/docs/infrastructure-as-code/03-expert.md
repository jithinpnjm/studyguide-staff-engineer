---
title: "Expert"
sidebar_position: 3
---

# Infrastructure as Code — Expert

Expert IaC is not about knowing every Terraform function. It is about operating infrastructure change safely at scale: state boundaries, module contracts, drift control, policy enforcement, incident rollback, and team ownership.

---

## IaC As A Change-Control System

At staff level, IaC is the infrastructure change-control plane.

```text
proposal -> plan -> policy -> review -> controlled apply -> audit -> drift detection
```

The important question is not “can Terraform create this?” The question is: can this change be reviewed, applied, rolled back, audited, and owned safely?

---

## State Boundary Design

State boundaries define blast radius.

Bad pattern:

```text
one giant state containing networking, clusters, databases, apps, IAM, DNS
```

Better pattern:

```text
network/prod
security/prod
platform-cluster/prod
shared-databases/prod
app-team-a/prod
```

State boundary questions:

1. Who owns these resources?
2. How often do they change?
3. What is the blast radius of a bad apply?
4. Who needs read access to state?
5. What depends on this state output?
6. Can this stack be recovered independently?

A network stack and an application stack should usually not share the same state lifecycle.

---

## Module Contract Design

A module is a product. Treat it like one.

A good module provides:

- Stable inputs
- Safe defaults
- Minimal required arguments
- Clear outputs
- Versioned releases
- Upgrade notes
- Examples
- Tests or validation
- Observability defaults
- Security controls by default

Example module contract:

```hcl
module "service_bucket" {
  source = "git::https://github.com/company/terraform-modules.git//s3-private-bucket?ref=v2.1.0"

  name        = "orders-export-prod"
  environment = "prod"
  owner       = "orders-team"
  versioning  = true
}
```

A platform module should make the secure path easy and the unsafe path difficult.

---

## Terraform At Scale

Scaling Terraform means managing concurrency, dependencies, and ownership.

Common patterns:

| Pattern | Purpose |
|---|---|
| Separate states | Reduce blast radius |
| Remote state outputs | Share stable values between stacks |
| Module registry | Standardize reusable components |
| CI-generated plans | Make changes reviewable |
| Controlled apply | Avoid laptop-only production changes |
| Policy-as-code | Enforce guardrails before apply |
| Drift detection | Detect manual or external changes |

Avoid using `terraform_remote_state` as a dumping ground for every output. Publish only stable, intentional outputs.

---

## Plan Review Discipline

A Terraform plan is a change document.

Review for:

- Resource replacements
- Destroy actions
- IAM policy expansion
- Public exposure
- Database changes
- Security group changes
- DNS changes
- Cost-impacting instance sizes
- Lifecycle rule changes
- Provider upgrades

Danger signs:

```text
-/+ replacement of database
large number of resources to destroy
security group widened to 0.0.0.0/0
IAM policy gains wildcard action
state address changed unexpectedly
```

If the plan is too large to review, split the change.

---

## Drift Management

Drift occurs when real infrastructure differs from code and state.

Causes:

- Manual console edits
- Emergency hotfixes
- External controllers
- Provider defaults changed
- Resources imported incompletely
- Module version changed behavior

Drift response:

```text
detect -> classify -> reconcile code or infrastructure -> prevent recurrence
```

Do not blindly apply to “fix drift.” First understand whether the real system or the code is correct.

---

## Safe Refactoring

Terraform refactors should not recreate infrastructure accidentally.

Use `moved` blocks for safe address changes:

```hcl
moved {
  from = aws_s3_bucket.logs
  to   = module.logging.aws_s3_bucket.logs
}
```

Older approach:

```bash
terraform state mv aws_s3_bucket.logs module.logging.aws_s3_bucket.logs
```

Safe refactor process:

1. Add moved block or state move.
2. Run plan.
3. Confirm no resource replacement.
4. Commit code with explanation.
5. Apply from controlled runner.

---

## Importing Existing Infrastructure

Import projects are common in real companies.

Mature import workflow:

```text
inventory existing resources
write matching HCL
import resource
run plan
adjust HCL until no unexpected changes
commit code
apply only after review
```

Terraform 1.5+ import block pattern:

```hcl
import {
  to = aws_s3_bucket.logs
  id = "company-prod-logs"
}
```

Resource block:

```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "company-prod-logs"
}
```

Import is not complete until the plan is clean and ownership is documented.

---

## Secrets And State Risk

Terraform state can contain sensitive values even when outputs are marked sensitive. Expert practice is to avoid placing secret values in Terraform when possible.

Better patterns:

- Create secret containers in Terraform, populate values outside Terraform.
- Reference secret ARNs or names rather than values.
- Use Vault, SOPS, or cloud secret managers.
- Keep state access restricted and audited.
- Avoid exposing sensitive outputs.

Example safer pattern:

```hcl
resource "aws_secretsmanager_secret" "db" {
  name = "prod/orders/db"
}
```

The application retrieves the secret value at runtime through workload identity.

---

## Terraform And CI/CD

Production IaC pipeline design:

```text
PR opened
  -> fmt/validate/tflint/checkov
  -> plan with read-only or planning identity
  -> comment plan summary on PR
  -> approval
  -> apply from protected branch/environment
```

Apply identity should be narrower than full administrator access. Split plans by stack and environment.

---

## Ansible At Scale

Ansible at scale requires inventory discipline, idempotency, batching, and safe failure handling.

Useful controls:

```yaml
- name: Rolling host update
  hosts: web
  serial: 10%
  become: true
  tasks:
    - name: Ensure package is installed
      ansible.builtin.package:
        name: nginx
        state: present
```

Key practices:

- Use dynamic inventory for cloud fleets.
- Use roles for reusable host configuration.
- Use handlers for restarts.
- Use `serial` for rolling changes.
- Avoid raw shell unless no module exists.
- Use `check_mode` before risky changes.

---

## Terraform at Scale: Monorepo, Terragrunt, and Atlantis

### Monorepo vs Polyrepo State

**Monorepo pattern:** all Terraform code in one repository:

```text
infra-monorepo/
  terraform/
    00-bootstrap/
    10-networking/
    20-security/
    30-kubernetes/
    40-databases/
    50-applications/
  .github/workflows/
    terraform-plan.yml
    terraform-apply.yml
```

Pros: unified code review, shared modules easy to reference, single PR touches related changes.
Cons: large repo blast radius, anyone can see all infrastructure code.

**Polyrepo pattern:** separate repos per team or domain.

```text
infra-networking/      # networking team owns
infra-platform/        # platform team owns
app-team-orders/       # orders team owns their service infra
```

Pros: clear ownership, smaller blast radius per repo, independent CI.
Cons: harder to make cross-cutting changes, module sharing requires a registry.

### Terragrunt DRY Pattern

Terragrunt is a thin wrapper around Terraform that eliminates repeated backend and provider configuration across many directories:

```text
terragrunt-layout/
  terragrunt.hcl          # root: defines backend template
  prod/
    networking/
      terragrunt.hcl      # inherits root, adds local config
    kubernetes/
      terragrunt.hcl
    databases/
      terragrunt.hcl
  staging/
    networking/
      terragrunt.hcl
```

**Root `terragrunt.hcl`:**

```hcl
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket         = "company-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents  = <<EOF
provider "aws" {
  region = "eu-central-1"
}
EOF
}
```

**Child `prod/networking/terragrunt.hcl`:**

```hcl
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "git::https://github.com/company/modules.git//vpc?ref=v2.0.0"
}

inputs = {
  name            = "prod-main"
  cidr            = "10.0.0.0/16"
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  environment     = "prod"
}
```

Commands with Terragrunt:

```bash
# Plan all stacks in prod
terragrunt run-all plan --terragrunt-working-dir prod/

# Apply a specific stack
cd prod/networking
terragrunt apply

# Destroy all (careful — dangerous)
terragrunt run-all destroy --terragrunt-working-dir prod/
```

### Atlantis for PR-Based Plans

Atlantis is a self-hosted server that runs Terraform plans and applies triggered by GitHub/GitLab PR comments.

Workflow:
1. Engineer opens PR with Terraform changes
2. Atlantis auto-runs `terraform plan` and posts output as PR comment
3. Reviewer reads the plan, approves PR
4. Engineer comments `atlantis apply` — Atlantis runs apply, posts result
5. PR is merged only after successful apply

```yaml
# atlantis.yaml — project configuration
version: 3
projects:
  - name: prod-networking
    dir: envs/prod/networking
    workspace: default
    autoplan:
      when_modified: ["**/*.tf", "**/*.tfvars"]
      enabled: true
    apply_requirements:
      - approved
      - mergeable
```

Atlantis benefits:
- Plans are visible in PR review — reviewers see exact infrastructure changes
- No local apply from developer machines
- Full audit trail in PR comments
- Apply is gated behind PR approval

---

## State Boundary Design for 10 Teams, 3 AWS Accounts

Production state layout for a multi-team, multi-account organization:

```text
Account: platform-prod
  state: platform-prod/bootstrap/terraform.tfstate
  state: platform-prod/networking/terraform.tfstate
  state: platform-prod/security/terraform.tfstate
  state: platform-prod/eks-cluster/terraform.tfstate

Account: data-prod
  state: data-prod/networking/terraform.tfstate
  state: data-prod/databases/terraform.tfstate
  state: data-prod/kafka/terraform.tfstate

Account: app-prod
  state: app-prod/networking/terraform.tfstate
  state: app-prod/orders-service/terraform.tfstate
  state: app-prod/payments-service/terraform.tfstate
  state: app-prod/notifications-service/terraform.tfstate
```

Values cross-stack communication: lower layers export values to SSM Parameter Store; upper layers read from SSM rather than using `terraform_remote_state`:

```hcl
# networking stack: publish VPC ID to SSM
resource "aws_ssm_parameter" "vpc_id" {
  name  = "/platform/prod/networking/vpc_id"
  type  = "String"
  value = aws_vpc.main.id
}

# kubernetes stack: read VPC ID from SSM
data "aws_ssm_parameter" "vpc_id" {
  name = "/platform/prod/networking/vpc_id"
}

resource "aws_eks_cluster" "main" {
  vpc_config {
    subnet_ids = jsondecode(data.aws_ssm_parameter.private_subnet_ids.value)
  }
}
```

This pattern means destroying the networking state does not corrupt the kubernetes state, because the reference is through SSM, not a direct state data source.

---

## Module Versioning and Breaking Change Management

Semantic versioning for Terraform modules:

```text
v1.0.0  — first stable release
v1.1.0  — backward-compatible new feature (new optional input)
v1.2.0  — backward-compatible improvement
v2.0.0  — breaking change (renamed input, removed output, different resource)
```

Pin module versions in all environments:

```hcl
# Good — pinned to a specific version
module "vpc" {
  source = "git::https://github.com/company/modules.git//vpc?ref=v2.0.0"
}

# Bad — unpinned, picks up any change merged to main
module "vpc" {
  source = "git::https://github.com/company/modules.git//vpc?ref=main"
}
```

Breaking change process:
1. Publish `v2.0.0` with migration notes in CHANGELOG
2. Canary: upgrade one non-prod environment, verify plan is clean
3. Communicate to all consuming teams with migration instructions
4. Teams adopt on their own schedule but must before EOL of v1.x
5. Keep v1.x available for 1 full sprint minimum

---

## Plan Review Discipline

What to look for in a `terraform plan`:

**High risk — stop and investigate:**
```text
-/+  aws_db_instance.orders must be replaced    # data loss risk
-    aws_vpc.main will be destroyed              # network tear-down
-/+  aws_eks_cluster.main must be replaced      # cluster tear-down
     aws_security_group.web ingress 0.0.0.0/0   # public exposure
```

**Medium risk — review carefully:**
```text
~    aws_iam_policy.app will be updated in-place  # privilege change
~    aws_rds_parameter_group.main                 # DB behavior change
~    aws_eks_node_group.main scaling_config       # capacity change
```

**Low risk — verify intent:**
```text
+    aws_s3_bucket.logs                           # new resource
~    aws_s3_bucket_tagging.logs                   # tag change
<=   data.aws_ami.ubuntu                          # read-only
```

Attributes that force replacement (know these for common resources):
- `aws_instance`: `ami`, `availability_zone`, `subnet_id`, `key_name`, `user_data`
- `aws_db_instance`: `engine`, `engine_version`, `identifier`, `allocated_storage` (in some cases)
- `aws_eks_cluster`: `name`, `vpc_config.endpoint_private_access` changes
- `aws_security_group`: `name`, `vpc_id`

---

## Drift Management and Scheduled Drift Detection

Drift occurs when real infrastructure changes outside Terraform code and state.

**Detect drift:**

```bash
# Show what would change to match code to reality
terraform plan -refresh-only

# Exit code: 0=no diff, 1=error, 2=diff detected
terraform plan -detailed-exitcode
echo "Exit code: $?"
```

**Scheduled drift detection in CI (GitHub Actions):**

```yaml
name: Drift Detection
on:
  schedule:
    - cron: '0 6 * * *'   # daily at 06:00 UTC

jobs:
  drift-check:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [prod]
        stack: [networking, security, kubernetes, databases]

    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/terraform-drift-detector
          aws-region: eu-central-1

      - name: Terraform Init
        run: terraform init
        working-directory: envs/${{ matrix.environment }}/${{ matrix.stack }}

      - name: Check for drift
        run: |
          terraform plan -refresh-only -detailed-exitcode 2>&1 | tee drift-output.txt
          EXIT_CODE=${PIPESTATUS[0]}
          if [ $EXIT_CODE -eq 2 ]; then
            echo "DRIFT DETECTED in ${{ matrix.environment }}/${{ matrix.stack }}"
            cat drift-output.txt
            exit 1
          fi
        working-directory: envs/${{ matrix.environment }}/${{ matrix.stack }}
```

**Drift response workflow:**

```text
1. Drift detected in scheduled job
2. Classify: is the real infrastructure correct, or is the code correct?
   a. If code is wrong (someone made an intentional improvement):
      -> Update code to match real infra
      -> PR review -> apply (no-op should confirm convergence)
   b. If real infra is wrong (unauthorized or accidental change):
      -> Apply code to revert the change
      -> Investigate how the change happened
      -> Restrict console access if needed
3. Prevent: reduce IAM permissions for direct console changes in prod
```

---

## Terraform Security Scanning

**tfsec** — static analysis for Terraform:

```bash
# Scan current directory
tfsec .

# Scan with specific severity threshold (fail on HIGH+)
tfsec . --minimum-severity HIGH

# Output as JSON for CI
tfsec . --format json > tfsec-results.json

# Skip a specific check with comment in code
resource "aws_s3_bucket" "public_website" {
  bucket = "company-public-website"
  # tfsec:ignore:aws-s3-no-public-access-block
}
```

**Checkov** — policy-as-code scanner:

```bash
# Scan Terraform directory
checkov -d .

# Scan with Terraform plan JSON output
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary > tfplan.json
checkov -f tfplan.json --framework terraform_plan

# Skip a specific check
resource "aws_s3_bucket" "public_website" {
  bucket = "company-public-website"
  #checkov:skip=CKV_AWS_18:Public website bucket
  #checkov:skip=CKV_AWS_52:Public website bucket
}

# Fail build on HIGH severity
checkov -d . --check HIGH --hard-fail-on HIGH
```

**OPA/Conftest for plan validation:**

```rego
# policies/deny_public_s3.rego
package terraform

deny[msg] {
  resource := input.resource_changes[_]
  resource.type == "aws_s3_bucket_public_access_block"
  resource.change.after.block_public_acls == false
  msg := sprintf("S3 bucket %v must block public ACLs", [resource.address])
}

deny[msg] {
  resource := input.resource_changes[_]
  resource.type == "aws_s3_bucket"
  not resource.change.after.tags.Owner
  msg := sprintf("S3 bucket %v missing required Owner tag", [resource.address])
}
```

```bash
# Run conftest against plan JSON
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary > tfplan.json
conftest test tfplan.json --policy policies/
```

**GitHub Actions CI integration:**

```yaml
name: Terraform Security Scan
on: [pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tfsec
        uses: aquasecurity/tfsec-action@v1.0.0
        with:
          minimum_severity: HIGH

      - name: Run Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: .
          framework: terraform
          soft_fail: false
```

---

## Secrets in Terraform State

The risk: Terraform state stores all resource attributes in plain JSON. Even `sensitive = true` variables prevent terminal output but still appear in state.

Resources that often put secrets in state:
- `random_password` — plaintext password in state
- `aws_db_instance` with `password = var.db_pass` — password in state
- `tls_private_key` — private key in state
- Any provider that returns a secret on creation

**Safer patterns:**

```hcl
# Pattern 1: Create the secret container in Terraform, populate value outside
resource "aws_secretsmanager_secret" "db" {
  name = "prod/orders/database"
}
# Then use AWS CLI or app to set the actual value:
# aws secretsmanager put-secret-value \
#   --secret-id prod/orders/database \
#   --secret-string '{"password":"...","username":"orders"}'

# Pattern 2: Generate password, store in Secrets Manager — value still in state
# but at least state is encrypted at rest
resource "random_password" "db" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    password = random_password.db.result
    username = "orders"
  })
}

# Pattern 3: Use Vault provider — Vault is the source of truth, not state
resource "vault_generic_secret" "db" {
  path = "secret/prod/orders/database"
  data_json = jsonencode({
    password = random_password.db.result
  })
}
```

Encrypt state at rest:

```hcl
terraform {
  backend "s3" {
    bucket     = "company-terraform-state"
    key        = "prod/terraform.tfstate"
    region     = "eu-central-1"
    encrypt    = true
    kms_key_id = "arn:aws:kms:eu-central-1:123456789:key/abc-123"   # KMS CMK
  }
}
```

---

## Ansible at Scale: AWX/Ansible Tower

AWX is the open-source version of Red Hat Ansible Automation Platform. It provides:

- Web UI for running playbooks — operators don't need CLI access
- RBAC: team A can run their playbooks, not team B's
- Job templates: pre-configured playbook runs with approved inventories
- Credentials vault: encrypted credential storage, no one can read after entry
- Scheduled jobs: drift remediation, compliance scans on a schedule
- Callback plugins: every job run is logged — who ran what, when, output
- Execution environments: containerized Ansible environments for reproducible runs

**RBAC model:**

```text
Organizations → Teams → Users
                    ↓
              Job Templates (playbook + inventory + credentials)
                    ↓
              Inventories (what hosts)
                    ↓
              Credentials (how to connect)
```

A team member can launch job templates assigned to their team but cannot see or modify other teams' templates, inventories, or credentials.

---

## Ansible + CI: Molecule for Role Testing

Molecule is the testing framework for Ansible roles:

```bash
# Install molecule
pip install molecule molecule-docker

# Initialize molecule in an existing role
cd roles/nginx
molecule init scenario --driver-name docker

# Run full test cycle
molecule test

# Stages in molecule test:
# lint -> create (container) -> prepare -> converge (run role)
#      -> idempotency (run role again, check no changes)
#      -> verify (run assertions) -> destroy
```

**molecule/default/molecule.yml:**

```yaml
---
dependency:
  name: galaxy
driver:
  name: docker
platforms:
  - name: ubuntu22
    image: "geerlingguy/docker-ubuntu2204-ansible:latest"
    pre_build_image: true
provisioner:
  name: ansible
verifier:
  name: ansible
```

**molecule/default/verify.yml:**

```yaml
---
- name: Verify nginx role
  hosts: all
  tasks:
    - name: Check nginx is running
      ansible.builtin.service_facts:

    - name: Assert nginx is active
      ansible.builtin.assert:
        that:
          - "'nginx' in ansible_facts.services"
          - "ansible_facts.services['nginx'].state == 'running'"
          - "ansible_facts.services['nginx'].status == 'enabled'"

    - name: Check nginx responds on port 80
      ansible.builtin.uri:
        url: "http://localhost:80"
        status_code: 200
```

**CI pipeline for roles:**

```yaml
name: Ansible Role Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install molecule molecule-docker ansible-lint yamllint

      - name: Run yamllint
        run: yamllint roles/nginx/

      - name: Run ansible-lint
        run: ansible-lint roles/nginx/

      - name: Run molecule tests
        run: molecule test
        working-directory: roles/nginx
```

---

## CDKTF: CDK for Terraform

CDKTF lets you write Terraform configurations in TypeScript, Python, or Go. Under the hood it synthesizes standard Terraform JSON:

```typescript
// TypeScript CDKTF example
import { App, TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new AwsProvider(this, "AWS", { region: "eu-central-1" });

    new S3Bucket(this, "app-data", {
      bucket: "company-app-data-prod",
      tags: {
        Environment: "prod",
        ManagedBy: "cdktf",
      },
    });
  }
}

const app = new App();
new MyStack(app, "my-stack");
app.synth();
```

CDKTF makes sense when:
- Your team is already writing TypeScript/Python for infrastructure tooling
- You want strongly-typed resource definitions with IDE autocomplete
- You need complex logic (loops, conditionals, abstractions) that HCL handles awkwardly

The output is Terraform-compatible JSON, so the same plan/apply workflow applies.

---

## Capstone Production IaC Pattern (from SRE Foundation 27)

A production platform's IaC is organized in layers with separate state per layer:

```text
terraform/
  00-bootstrap/        # S3 backend, DynamoDB, IAM for Terraform runner
  10-networking/       # VPC, subnets, NAT, TGW attachments
  20-security/         # KMS keys, security groups, IAM roles
  30-kubernetes/       # EKS cluster, node groups, IRSA roles
  40-databases/        # RDS, ElastiCache, parameter groups
  50-applications/     # ACM, Route 53, ALB, ECR repos
```

Each layer:
- Has its own `terraform.tfstate` in S3 at a distinct key
- Exports values to SSM Parameter Store for upper layers to consume
- Can be planned and applied independently
- Has its own CI workflow triggered only on changes to that layer
- Has separate apply IAM roles with least privilege for that layer

Lower layers change rarely (network changes monthly). Upper layers change often (application layers change per sprint). This separation means a broken application layer cannot corrupt network state, and network engineers don't need to wait for application engineers to unlock a shared state.

---

## Expert Takeaways

1. State boundary is blast-radius boundary.
2. Modules are platform products and need versioning.
3. A plan must be small enough to review.
4. Drift must be classified before reconciliation.
5. Import is complete only when code and state match reality.
6. Sensitive state must be protected.
7. Production applies should run from controlled environments.
8. Ansible at scale requires idempotency and rollout controls.
9. Terragrunt eliminates repeated backend/provider config across directories.
10. Atlantis makes IaC changes reviewable in PR without local apply.
11. tfsec/checkov/conftest catch security misconfigurations before apply.
12. Molecule provides a full test lifecycle for Ansible roles.
13. State layer separation (00-bootstrap through 50-applications) limits blast radius and enables independent lifecycle.
