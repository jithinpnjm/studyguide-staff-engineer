---
title: "Real-World Examples"
sidebar_position: 7
---

# Infrastructure as Code — Real-World Examples

These examples show how Terraform and Ansible fail in real production environments and how a senior SRE should reason about blast radius, state, reviewability, and recovery.

---

## Example 1: Terraform Plan Wants To Replace Production RDS

### Scenario

A small Terraform change unexpectedly shows:

```text
-/+ aws_db_instance.orders must be replaced
```

### What Might Have Happened

- A field that forces replacement changed.
- A module changed a default value.
- Provider version behavior changed.
- Resource address changed without a moved block.
- State does not match the real resource.

### Strong Response

```text
stop the apply
identify the attribute causing replacement
check module and provider changes
check whether state address changed
add prevent_destroy for critical resources
split the change into a reviewable plan
```

### Lesson

A plan is not a formality. It is the infrastructure change document.

---

## Example 2: One Giant Terraform State Blocks Everyone

### Scenario

Networking, EKS, databases, IAM, DNS, and app resources all live in one state file. A small app change locks the whole state and blocks platform changes.

### Root Cause

State boundary was not aligned with ownership or blast radius.

### Better Design

```text
network/prod
security/prod
eks/prod
databases/prod
apps/orders/prod
apps/payments/prod
```

### Lesson

State is an operational boundary. Design it like a production dependency.

---

## Example 3: Module Change Breaks Many Teams

### Scenario

A shared VPC module changes a default NAT Gateway setting. Several teams upgrade the module and lose expected egress behavior.

### What Went Wrong

The module was treated like a script, not a versioned product.

### Better Practice

- Version module releases.
- Publish changelogs.
- Add examples.
- Test common upgrade paths.
- Canary module upgrades in one environment.
- Avoid breaking defaults without a major version.

### Lesson

Platform modules are products. Consumers need stable contracts.

---

## Example 4: Manual Console Change Causes Drift

### Scenario

During an incident, someone increases an Auto Scaling Group size in the console. Later, Terraform changes it back during an unrelated apply.

### Root Cause

The real infrastructure diverged from code. Terraform reconciled to the declared value.

### Correct Process

```text
if the manual change is still needed -> commit it to code
if it was temporary -> revert it intentionally
if another controller owns it -> use a narrow ignore rule
```

### Lesson

Emergency changes must be reconciled into the source of truth after the incident.

---

## Example 5: Terraform State Exposed Sensitive Data

### Scenario

A team marks an output as sensitive but stores generated credentials in Terraform state. A broad group has read access to the backend bucket.

### Root Cause

Sensitive output hides terminal display but does not remove sensitive value from state.

### Better Design

- Store secret values in a secret manager.
- Use Terraform to create the secret container, not necessarily the value.
- Restrict state read access.
- Avoid outputting sensitive values.
- Audit backend access.

### Lesson

Terraform state is sensitive even if all visible outputs look clean.

---

## Example 6: Import Project Creates Unintended Changes

### Scenario

A team imports existing S3 buckets into Terraform. The next plan wants to modify lifecycle rules, tags, encryption settings, and public access blocks.

### Root Cause

Import only connects the real object to state. It does not magically create complete matching code.

### Safe Import Flow

```text
inventory resource
write HCL
import
plan
adjust code
repeat until plan is expected
commit ownership
```

### Lesson

Import is a migration project, not a single command.

---

## Example 7: Ansible Playbook Restarts All Hosts

### Scenario

A playbook updates configuration and restarts all web servers simultaneously. The load balancer loses all healthy targets.

### What Went Wrong

The playbook had no rolling strategy and no health-aware batching.

### Better Pattern

```yaml
- name: Rolling update
  hosts: web
  serial: 10%
  become: true
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

### Lesson

Host automation must respect service availability, not just host state.

---

## Example 8: Shell Commands Break Idempotency

### Scenario

An Ansible playbook uses shell commands for package installation and file edits. Every run reports changes, and repeated runs sometimes corrupt config.

### Root Cause

The playbook behaves like a script, not desired-state automation.

### Better Pattern

Use Ansible modules:

```yaml
- name: Ensure package is installed
  ansible.builtin.package:
    name: nginx
    state: present

- name: Ensure config line exists
  ansible.builtin.lineinfile:
    path: /etc/app/app.conf
    regexp: '^workers='
    line: 'workers=4'
```

### Lesson

Idempotency is the difference between automation and a remote shell loop.

---

## Example 9: Policy Check Blocks Public Bucket

### Scenario

A team tries to create a public bucket for exports. CI blocks the plan before apply.

### What Happened

Policy-as-code detected a platform standard violation.

### Good Platform Behavior

The failure message should explain:

- Which resource violated the policy
- Why it is unsafe
- What approved alternative exists
- How to request an exception

### Lesson

Policy-as-code should teach teams the golden path, not only say no.

---

## Example 10: Terraform Provider Upgrade Changes Plan

### Scenario

A routine provider upgrade causes many resources to show diffs due to changed defaults or computed fields.

### Root Cause

Provider upgrades are infrastructure changes. They should not be mixed with unrelated resource changes.

### Better Practice

- Upgrade providers in a dedicated PR.
- Review changelog.
- Run plan for every environment.
- Apply lower environments first.
- Keep `.terraform.lock.hcl` committed.

### Lesson

Provider versions are part of the infrastructure release surface.

---

## Example 11: Migration of 200 Manually-Created AWS Resources into Terraform

### Scenario

A platform team inherited an AWS account with 200 manually-created resources: VPCs, EC2 instances, RDS instances, S3 buckets, IAM roles, and security groups. Nothing is managed by Terraform. The team needs to bring everything under IaC control without causing downtime.

### Strategy

**Phase 1: Inventory (1-2 weeks)**

```bash
# Use AWS Config or tagging reports to list all resources
aws resourcegroupstaggingapi get-resources \
  --region eu-central-1 \
  --output json | jq '.ResourceTagMappingList[].ResourceARN'

# For each resource type, list with CLI
aws ec2 describe-vpcs --query 'Vpcs[].VpcId' --output text
aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId' --output text
aws rds describe-db-instances --query 'DBInstances[].DBInstanceIdentifier' --output text
```

Build a spreadsheet: resource type, ID, name/tag, owner team, "critical" flag.

**Phase 2: Write HCL for non-critical resources first**

Start with stateless or easily recreatable resources:
- S3 buckets (recreatable, low risk)
- Security groups (in-place updates, no downtime)
- IAM roles (no traffic impact)

Then move to stateful resources:
- RDS instances (careful — import, verify plan, never let Terraform touch `engine_version` or `allocated_storage` without review)
- EKS clusters (very high risk — do in a maintenance window)

**Phase 3: Import workflow per resource**

```bash
# Example: import an S3 bucket
cat >> main.tf << 'EOF'
resource "aws_s3_bucket" "app_data" {
  bucket = "company-app-data-prod"
}
EOF

terraform import aws_s3_bucket.app_data company-app-data-prod

# Run plan — it will show all attributes not yet in HCL
terraform plan 2>&1 | grep "^  +\|^  ~\|will be changed"

# Add missing attributes one by one until plan is clean
# Common missing attributes:
# - aws_s3_bucket_versioning
# - aws_s3_bucket_server_side_encryption_configuration
# - aws_s3_bucket_public_access_block
# - aws_s3_bucket_lifecycle_configuration
```

**Phase 4: Risks and mitigations**

| Risk | Mitigation |
|---|---|
| Import fails — resource ID format wrong | Check provider docs for exact import ID format |
| Plan shows unexpected modification after import | Add `ignore_changes` for fields managed externally |
| Plan shows replacement of production resource | Stop immediately, identify the attribute, never apply |
| Team applies change to wrong environment | Separate state backends, Atlantis with per-project access |
| State corruption during import | Take `terraform state pull` backup before every import session |

**Phase 5: Governance post-migration**

- Add `prevent_destroy = true` to all production resources
- Remove direct console access via IAM once IaC is the only change path
- Schedule drift detection to catch any residual manual changes

### Lesson

Import is a migration project, not a command. Expect 2-4 weeks of iteration for 200 resources. The plan must be clean before trusting Terraform with production changes.

---

## Example 12: Terragrunt Monorepo for 8 AWS Accounts

### Scenario

A platform team manages 8 AWS accounts: production, staging, development, shared-services, security-tooling, backup, sandbox-a, sandbox-b. Each account needs the same set of infrastructure layers (networking, security, kubernetes, databases) with different sizes.

### Folder Structure

```text
terragrunt-monorepo/
  terragrunt.hcl                  # root — backend template + provider
  prod/
    account.hcl                   # account-specific variables
    networking/
      terragrunt.hcl              # inherits root + account
    security/
      terragrunt.hcl
    kubernetes/
      terragrunt.hcl
    databases/
      terragrunt.hcl
  staging/
    account.hcl
    networking/
      terragrunt.hcl
    ...
  shared-services/
    account.hcl
    ...
```

### Root terragrunt.hcl

```hcl
locals {
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  account_id   = local.account_vars.locals.account_id
  account_name = local.account_vars.locals.account_name
  aws_region   = "eu-central-1"
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket         = "company-terraform-state-${local.account_id}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.aws_region
    encrypt        = true
    dynamodb_table = "terraform-locks"
    role_arn       = "arn:aws:iam::${local.account_id}:role/TerraformStateAccess"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents = <<EOF
provider "aws" {
  region = "${local.aws_region}"
  assume_role {
    role_arn = "arn:aws:iam::${local.account_id}:role/TerraformApply"
  }
}
EOF
}
```

### Account-specific account.hcl

```hcl
# prod/account.hcl
locals {
  account_id   = "111122223333"
  account_name = "prod"
  vpc_cidr     = "10.0.0.0/16"
  eks_size     = "m5.xlarge"
}
```

### Dependency chain

```hcl
# prod/kubernetes/terragrunt.hcl
include "root" {
  path = find_in_parent_folders()
}

dependency "networking" {
  config_path = "../networking"
  mock_outputs = {
    vpc_id             = "vpc-00000000"
    private_subnet_ids = ["subnet-00000000", "subnet-11111111"]
  }
}

inputs = {
  vpc_id             = dependency.networking.outputs.vpc_id
  private_subnet_ids = dependency.networking.outputs.private_subnet_ids
}
```

### How plan/apply works per account

```bash
# Plan everything in prod
terragrunt run-all plan \
  --terragrunt-working-dir prod/ \
  --terragrunt-parallelism 4

# Apply only networking in prod
cd prod/networking
terragrunt apply

# Apply all of staging
terragrunt run-all apply \
  --terragrunt-working-dir staging/

# Diff between prod and staging (manual inspection)
diff \
  <(cd prod/networking && terragrunt output -json) \
  <(cd staging/networking && terragrunt output -json)
```

---

## Example 13: Terraform State Corruption Incident

### What Happened

An engineer ran `terraform apply` on production from their laptop while another apply was running in CI. The S3 backend locking was present, but the engineer was using a version of Terraform that had a bug where it skipped the lock check on a retry after a transient S3 error. Both applies completed, writing different state files to S3 in rapid succession. The final state reflected a mix of both applies.

The symptom: Terraform started showing phantom resources (resources listed in state but not in AWS) and missing resources (resources in AWS but not in state).

### Recovery Steps

**Step 1: Immediately stop all applies**

```bash
# Alert all engineers to stop any running terraform operations
# Add a manual lock via DynamoDB to prevent new applies
aws dynamodb put-item \
  --table-name terraform-locks \
  --item '{"LockID": {"S": "prod/main/terraform.tfstate"}, "Info": {"S": "{\"Operation\":\"ManualEmergencyLock\"}"}}'
```

**Step 2: Assess damage scope**

```bash
# Download the corrupted state
terraform state pull > corrupted-state.json

# List all resources in state
terraform state list > state-resources.txt

# Compare state to actual AWS resources
aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId' > aws-instances.txt
diff state-resources.txt aws-instances.txt
```

**Step 3: Find the last good state from S3 versioning**

```bash
# List all state versions
aws s3api list-object-versions \
  --bucket company-terraform-state \
  --prefix prod/main/terraform.tfstate \
  --query 'Versions[*].{VersionId:VersionId,LastModified:LastModified}' \
  --output table

# Download the pre-incident version
aws s3api get-object \
  --bucket company-terraform-state \
  --key prod/main/terraform.tfstate \
  --version-id <pre-incident-version-id> \
  good-state.json
```

**Step 4: Manually reconcile the two states**

If a clean rollback isn't possible (because real infrastructure changed during both applies):

```bash
# For phantom resources (in state but not in AWS): remove from state
terraform state rm <phantom-resource-address>

# For missing resources (in AWS but not in state): re-import
terraform import <resource-address> <real-resource-id>

# Verify plan is clean after reconciliation
terraform plan
```

**Step 5: Push reconciled state**

```bash
# Push the reconciled state
terraform state push reconciled-state.json
```

### Prevention

- Upgrade Terraform to a version where the lock check bug is fixed
- Enforce all applies through CI/CD only — block local applies to production via IAM (require a specific CI identity role)
- Enable S3 versioning (already done — this enabled recovery)
- Add a Slack alert when a force-unlock or state push operation occurs

---

## Example 14: Ansible Rolling Update of 500 Nodes with Zero Downtime

### Scenario

A platform team needs to update the Linux kernel and restart all 500 nodes in a Kubernetes cluster. Nodes are registered with a load balancer. Downtime must be zero — the cluster must maintain capacity throughout.

### Playbook

```yaml
---
- name: Rolling kernel update — 500 nodes, zero downtime
  hosts: k8s_nodes
  serial: 20                      # update 20 nodes at a time (4% of fleet)
  max_fail_percentage: 5          # abort if more than 5% of nodes in a batch fail
  become: true

  pre_tasks:
    - name: Drain Kubernetes node before update
      ansible.builtin.command: >
        kubectl drain {{ inventory_hostname }}
        --ignore-daemonsets
        --delete-emptydir-data
        --timeout=120s
      delegate_to: "{{ groups['k8s_control_plane'][0] }}"
      changed_when: true

    - name: Wait for node to be cordoned
      ansible.builtin.command: >
        kubectl get node {{ inventory_hostname }} -o jsonpath='{.spec.unschedulable}'
      delegate_to: "{{ groups['k8s_control_plane'][0] }}"
      register: cordon_status
      until: cordon_status.stdout == "true"
      retries: 10
      delay: 5
      changed_when: false

  tasks:
    - name: Update apt cache
      ansible.builtin.apt:
        update_cache: true

    - name: Upgrade kernel packages
      ansible.builtin.apt:
        name:
          - linux-image-generic
          - linux-headers-generic
        state: latest
      register: kernel_update

    - name: Reboot if kernel was updated
      ansible.builtin.reboot:
        reboot_timeout: 600
        test_command: "uname -r"
      when: kernel_update.changed

    - name: Verify node is back and kubelet is running
      ansible.builtin.systemd:
        name: kubelet
        state: started
      register: kubelet_status
      until: kubelet_status.status.ActiveState == "active"
      retries: 12
      delay: 10

  post_tasks:
    - name: Uncordon node
      ansible.builtin.command: kubectl uncordon {{ inventory_hostname }}
      delegate_to: "{{ groups['k8s_control_plane'][0] }}"
      changed_when: true

    - name: Wait for node to be ready
      ansible.builtin.command: >
        kubectl get node {{ inventory_hostname }}
        -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
      delegate_to: "{{ groups['k8s_control_plane'][0] }}"
      register: node_ready
      until: node_ready.stdout == "True"
      retries: 20
      delay: 15
      changed_when: false
```

### Key parameters

- `serial: 20` — 20 nodes out of 500 (4%) are updated at once. 480 nodes remain available, maintaining full cluster capacity.
- `max_fail_percentage: 5` — if 2+ nodes in a batch fail to come back, the playbook stops before proceeding to the next batch.
- `pre_tasks` drain before update; `post_tasks` uncordon after. The health check (`until: node_ready.stdout == "True"`) ensures a node is truly ready before the next batch starts.

### Outcome

The update took 6 hours for 500 nodes (25 batches of 20 nodes, ~14 minutes per batch). Zero downtime. Two nodes hit hardware issues and failed to reboot — `max_fail_percentage` stopped the playbook, alerting the operator to investigate before proceeding.

---

## Example 15: IaC CI Pipeline That Blocked a $50K/Month Infrastructure Mistake

### Scenario

An engineer added a new EKS node group to the production cluster. The Terraform code was correct in intent but had a typo: `instance_types = ["m5.24xlarge"]` instead of `m5.2xlarge`. The `m5.24xlarge` instance type costs ~$4.60/hour per instance. The node group had `desired_size = 30`. Monthly cost: 30 × $4.60 × 720 = ~$99,360.

### How CI Blocked It

The pipeline included `infracost`:

```yaml
# .github/workflows/terraform-plan.yml
- name: Run Infracost
  uses: infracost/actions/setup@v2
  with:
    api-key: ${{ secrets.INFRACOST_API_KEY }}

- name: Generate Infracost cost estimate
  run: |
    infracost breakdown \
      --path . \
      --format json \
      --out-file /tmp/infracost.json

- name: Post cost comment on PR
  uses: infracost/actions/comment@v2
  with:
    path: /tmp/infracost.json
    behavior: update

- name: Block if cost exceeds threshold
  run: |
    MONTHLY_COST=$(cat /tmp/infracost.json | jq '.totalMonthlyCost | tonumber')
    THRESHOLD=5000  # block if monthly cost exceeds $5000
    if (( $(echo "$MONTHLY_COST > $THRESHOLD" | bc -l) )); then
      echo "Monthly cost estimate ($MONTHLY_COST) exceeds threshold ($THRESHOLD)"
      echo "Review the Infracost comment on this PR before proceeding"
      exit 1
    fi
```

The PR received a comment showing estimated monthly cost of $99,360 — an obvious anomaly. The engineer caught the typo before apply.

### The checkov scan also flagged the instance size:

```hcl
# Custom checkov policy
# policies/check_instance_types.py
class InstanceTypeCheck(BaseResourceCheck):
    APPROVED_TYPES = ["t3.micro", "t3.small", "m5.large", "m5.xlarge", "m5.2xlarge"]

    def check_resource_configuration(self, conf):
        instance_types = conf.get("instance_types", [[]])[0]
        for t in instance_types:
            if t not in self.APPROVED_TYPES:
                return CheckResult.FAILED
        return CheckResult.PASSED
```

### Lesson

Cost estimation and approved instance type policies in CI are production-grade guardrails. A $50K/month mistake is a two-minute review — not a five-day postmortem.

---

## Example 16: Atlantis for PR-Based IaC Review and Apply Governance

### Setup

```yaml
# atlantis.yaml — full production configuration
version: 3
automerge: false
parallel_plan: true
parallel_apply: false

projects:
  - name: prod-networking
    dir: envs/prod/networking
    workspace: default
    autoplan:
      when_modified:
        - "**/*.tf"
        - "**/*.tfvars"
        - "../../modules/**/*.tf"
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
```

### Who Can Approve What

Atlantis integrates with GitHub branch protection and CODEOWNERS:

```text
# .github/CODEOWNERS
envs/prod/networking/    @company/networking-team @company/platform-leads
envs/prod/databases/     @company/dba-team @company/platform-leads
envs/prod/kubernetes/    @company/platform-team
envs/*/                  @company/platform-team
```

- Network changes require approval from `@company/networking-team` OR `@company/platform-leads`
- Database changes require `@company/dba-team` approval
- Platform leads can approve anything

### What Gets Auto-Applied

Nothing in production. All applies require:
1. PR approval from the CODEOWNERS-specified reviewers
2. All CI checks green (fmt, validate, tfsec, checkov)
3. Atlantis plan comment posted (plan must be readable)
4. Manual `atlantis apply` comment from an authorized user

### Audit trail

Every Atlantis plan and apply is recorded in:
- The PR comments (visible to all team members)
- Atlantis server logs (shipped to centralized log management)
- GitHub PR event timeline

When a production incident occurs, the first question is: "what was the last Atlantis apply?" — the PR comment history provides the exact plan output and timestamps.

---

## Staff-Level Summary

IaC incidents rarely come from Terraform syntax. They come from unclear ownership, bad state boundaries, unreviewable plans, unversioned modules, manual drift, and unsafe automation patterns. Good IaC platforms make the safe path easy and the dangerous path visible before production changes happen.

At staff level, the key contributions are:
- Designing state boundaries that limit blast radius
- Building CI pipelines that make plans reviewable and apply auditable
- Creating module contracts that teams can consume safely
- Implementing cost and policy guardrails that catch mistakes automatically
- Defining drift detection workflows that keep code and reality aligned
