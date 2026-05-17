---
title: "Troubleshooting"
sidebar_position: 8
---

# Infrastructure as Code — Troubleshooting

IaC troubleshooting is about separating code problems, state problems, provider problems, real infrastructure drift, and automation-runner problems.

```text
code -> provider -> plan -> state -> API -> real infrastructure
```

---

## Universal Triage

Ask first:

1. Did the code change?
2. Did the provider version change?
3. Did the backend or state change?
4. Did someone change the real resource manually?
5. Is the plan small enough to review?
6. Is this create, update, replace, or destroy?
7. Is the resource critical?
8. What is the rollback path?

---

## Terraform Init Fails

Common causes:

- Backend configuration is wrong.
- Provider registry is unreachable.
- Provider version constraint cannot be resolved.
- Lock file conflicts with version constraints.
- Credentials for backend access are missing.

Useful commands:

```bash
terraform init
terraform init -upgrade
terraform providers
terraform version
```

Fix approach:

```text
check backend config
check provider constraints
check .terraform.lock.hcl
check network access
check cloud identity used by the runner
```

---

## Terraform Validate Fails

Common causes:

- HCL syntax error
- Wrong type passed to variable
- Missing required variable
- Invalid reference
- Unsupported argument for provider version

Commands:

```bash
terraform fmt -recursive
terraform validate
terraform console
```

Use `terraform console` to test expressions such as `merge`, `lookup`, `try`, and `for` expressions.

---

## Plan Shows Unexpected Destroy

Stop and investigate before apply.

Check:

```bash
terraform plan
terraform state list
terraform state show <address>
git diff HEAD~1..HEAD
```

Possible causes:

- Resource removed from code
- Module source changed
- Environment variable or tfvars changed
- Resource address changed without moved block
- Provider changed replacement behavior
- State does not match reality

Mitigation:

- Add `prevent_destroy` for critical resources.
- Use `moved` blocks for refactors.
- Split risky changes into a separate PR.
- Back up state before state operations.

---

## Plan Shows Replacement

Replacement appears as `-/+` in the plan.

Common causes:

- Immutable field changed
- Name changed
- Subnet or VPC changed
- Engine version changed
- Resource address changed
- Force-new provider attribute changed

Response pattern:

```text
identify replacement attribute
check whether downtime is acceptable
check backup and rollback path
use create_before_destroy only when safe
avoid replacing stateful resources casually
```

---

## State Lock Is Stuck

Symptoms:

- Terraform says state is locked.
- A previous run failed or was interrupted.

Checks:

```bash
terraform force-unlock <lock-id>
```

Use force-unlock only after confirming no active apply is running. A real concurrent apply is more dangerous than a stuck lock.

---

## Drift Detected

Use:

```bash
terraform plan -refresh-only
```

Classify drift:

| Drift type | Response |
|---|---|
| Emergency manual fix | Commit intended value to code |
| Accidental console change | Revert to code-defined value |
| External controller owns field | Consider narrow ignore rule |
| Resource imported incompletely | Correct HCL and state |

Do not blindly apply. First decide whether code or reality is correct.

---

## Import Does Not Produce Clean Plan

Common causes:

- HCL does not match real resource
- Missing nested blocks
- Provider defaults differ from real settings
- Tags differ
- Lifecycle settings missing

Process:

```text
write resource block
import
plan
adjust config
plan again
repeat until expected
```

Import is complete only when state, code, and real infrastructure agree.

---

## Module Upgrade Breaks Plan

Symptoms:

- Many resources change after only a module version bump.
- Defaults changed.
- Resources renamed inside module.
- Outputs changed.

Response:

```text
read module changelog
review changed inputs and defaults
apply in lower environment first
use moved blocks if resource addresses changed
split module upgrade from unrelated changes
```

Do not mix provider upgrades, module upgrades, and functional changes in one PR if the plan becomes hard to review.

---

## Provider Upgrade Changes Behavior

Checks:

```bash
terraform providers
terraform init -upgrade
git diff .terraform.lock.hcl
```

Safe practice:

- Upgrade provider in a dedicated PR.
- Read release notes.
- Run plans for all environments.
- Apply dev/staging first.
- Keep `.terraform.lock.hcl` committed.

---

## Remote State Output Missing

Symptoms:

- Terraform cannot read expected output from another state.
- App stack cannot find VPC ID or subnet IDs.

Check:

```bash
terraform output
terraform output -json
```

Common causes:

- Output renamed
- Wrong backend key
- Wrong workspace
- Wrong environment selected
- State access denied
- Producer stack not applied yet

Use stable, documented outputs between stacks. Do not expose every internal value.

---

## Ansible Cannot Reach Hosts

Common causes:

- Wrong inventory host
- DNS failure
- SSH user mismatch
- SSH key missing
- Firewall or route issue
- Python missing on managed host
- Sudo/become misconfigured

Commands:

```bash
ansible-inventory -i hosts.ini --list
ansible all -i hosts.ini -m ping
ansible web -i hosts.ini -m command -a "whoami"
```

Add verbosity when needed:

```bash
ansible all -i hosts.ini -m ping -vvv
```

---

## Ansible Playbook Is Not Idempotent

Symptoms:

- Same playbook reports changes every run.
- Services restart every run.
- Config files keep changing.

Common causes:

- Raw shell command used instead of module
- Template includes timestamps or random values
- File permissions differ each run
- Handler notified unnecessarily

Fix:

- Use modules like `package`, `service`, `template`, `lineinfile`.
- Avoid timestamps in rendered config.
- Use handlers for restarts.
- Run playbooks twice in test environments.

---

## Ansible Change Takes Down All Hosts

Cause:

- Playbook changed all hosts at once.
- No batching or health check.
- Handler restarted all services simultaneously.

Safer pattern:

```yaml
- name: Rolling update
  hosts: web
  serial: 10%
  become: true
  tasks:
    - name: Ensure package is present
      ansible.builtin.package:
        name: nginx
        state: present
```

Use `serial`, health checks, and load balancer draining for production fleets.

---

## CI Terraform Plan Fails But Local Works

Likely causes:

- Different Terraform version
- Different provider lock file
- Missing environment variable
- CI identity lacks access
- Working directory differs
- Backend config differs

Fix:

```text
pin Terraform version
commit lock file
print terraform version in CI
standardize working directory
use explicit backend config
separate plan and apply identities
```

---

## Terraform State Lock Stuck — Full Recovery

Symptoms:

```text
Error: Error acquiring the state lock

Error message: ConditionalCheckFailedException
Lock Info:
  ID:        3a2b1c4d-e5f6-7890-abcd-ef1234567890
  Path:      prod/networking/terraform.tfstate
  Operation: OperationTypeApply
  Who:       engineer@machine.local
  Created:   2024-01-15 14:30:00.000000000 +0000 UTC
  Info:
```

**Step 1: Verify no apply is actually running**

```bash
# Check CI for any active jobs on this stack
# Check other engineers' terminals
# Look at the "Who" field in the lock info — is that machine active?
# Check the "Created" time — if it's hours ago and no apply is running, it's safe to unlock
```

**Step 2: Inspect the DynamoDB lock record**

```bash
aws dynamodb get-item \
  --table-name terraform-locks \
  --key '{"LockID": {"S": "company-terraform-state/prod/networking/terraform.tfstate"}}' \
  --output json
```

**Step 3: Force-unlock (only after confirming no active apply)**

```bash
# Get the lock ID from the error message
terraform force-unlock 3a2b1c4d-e5f6-7890-abcd-ef1234567890
```

Output:
```text
Do you really want to force-unlock?
  Terraform will remove the lock on the remote state.
  This will allow local Terraform commands to modify this state, even though it
  may be still be in use. Only 'yes' will be accepted to confirm.

  Enter a value: yes

Terraform state has been successfully unlocked!
```

**Step 4: What if there's no lock ID in the error?**

```bash
# Delete the DynamoDB record manually
aws dynamodb delete-item \
  --table-name terraform-locks \
  --key '{"LockID": {"S": "company-terraform-state/prod/networking/terraform.tfstate"}}'
```

**Warning:** Force-unlocking a state that has an active apply running causes state corruption. The safest check: look at your CI system for any running jobs and ask all engineers to confirm they're not applying.

---

## Inconsistent Dependency Lock File

Error:

```text
Error: Inconsistent dependency lock file

The following dependency selections recorded in the lock file are inconsistent
with the current configuration:
  - provider registry.terraform.io/hashicorp/aws: locked version
    selection 4.67.0 doesn't match the requirements of this configuration
    which require newer than 5.0.0

To make the initial lock file consistent, run:
  terraform init -upgrade
```

**Cause:** `.terraform.lock.hcl` pins an older provider version that no longer satisfies the `required_providers` version constraints in the code.

**Fix:**

```bash
# Re-initialize and update the lock file
terraform init -upgrade

# Review which providers were upgraded
git diff .terraform.lock.hcl

# Commit the updated lock file
git add .terraform.lock.hcl
git commit -m "chore: upgrade terraform lock file after provider constraint update"
```

**Prevention:** Always commit `.terraform.lock.hcl` to Git. This ensures CI and all engineers use the same provider versions. Do not add `.terraform.lock.hcl` to `.gitignore`.

When upgrading providers intentionally:

```bash
# Upgrade all providers to latest matching constraints
terraform init -upgrade

# Or upgrade a specific provider
terraform providers lock -platform linux_amd64 -platform darwin_arm64 hashicorp/aws
```

---

## Provider Version Conflict Between Modules

Error:

```text
Error: Incompatible provider version

Module module.vpc requires provider hashicorp/aws ~> 4.0
Root module requires provider hashicorp/aws ~> 5.0
```

**Cause:** A child module pins an older provider version that is incompatible with the root module's constraint.

**Diagnosis:**

```bash
terraform providers
# Shows the dependency tree and version constraints per module
```

**Fix 1: Update the module to support the newer provider**

If you own the module, update `versions.tf` to accept `>= 4.0, < 6.0`:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"   # not ~> 4.0 which means >= 4.0, < 5.0
    }
  }
}
```

**Fix 2: Pin root to an older provider**

If you don't control the module immediately:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.67"   # match what the module requires
    }
  }
}
```

**Fix 3: Use explicit provider configuration in the module call**

For AWS multi-region or multi-account, use `providers` argument to pass a specific provider alias:

```hcl
provider "aws" {
  alias  = "v4"
  region = "eu-central-1"
  # version constraints handled in required_providers
}

module "vpc" {
  source    = "./modules/vpc"
  providers = { aws = aws.v4 }
}
```

---

## Plan Shows Replacement But You Expected In-Place Update

**Common attributes that force replacement for AWS resources:**

| Resource | Attributes that force replacement |
|---|---|
| `aws_instance` | `ami`, `availability_zone`, `subnet_id`, `key_name`, `user_data` (on most distros), `instance_type` (some cases) |
| `aws_db_instance` | `engine`, `engine_version` (major upgrades), `identifier`, `storage_type`, `multi_az` (when switching) |
| `aws_security_group` | `name`, `vpc_id` |
| `aws_eks_cluster` | `name`, `vpc_config.endpoint_*` changes, `kubernetes_network_config` |
| `aws_subnet` | `vpc_id`, `cidr_block`, `availability_zone` |
| `aws_s3_bucket` | `bucket` (name) |
| `aws_cloudfront_distribution` | `origin.origin_id` |
| `aws_elasticache_cluster` | `engine`, `node_type`, `num_cache_nodes` |

**Investigation:**

```bash
# Run plan with JSON output to get full detail
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary | jq '.resource_changes[] | select(.change.actions | contains(["delete","create"])) | {address, reason: .change.action_reason}'
```

**Response patterns:**

If replacement is unintentional (code refactor caused renaming):

```hcl
# Use moved block to tell Terraform about the rename
moved {
  from = aws_instance.web
  to   = aws_instance.web_server
}
```

If replacement is from an `ignore_changes` being removed:

```hcl
# Add it back temporarily, plan, verify no replacement, then carefully remove
lifecycle {
  ignore_changes = [user_data]
}
```

If replacement is unavoidable (e.g., must change AMI):

```bash
# Use create_before_destroy to reduce downtime window
lifecycle {
  create_before_destroy = true
}
# New instance created first, old one destroyed after
# But: you still need to handle traffic cutover
```

---

## State File Diverged Between Teammates (Concurrent Applies)

If two applies completed without locking (e.g., local state, or lock bug):

**Symptoms:**

```text
# Engineer A's state has resource X with attributes A
# Engineer B's state has resource X with attributes B
# Real infrastructure has attributes from B (most recent apply)
# Engineer A's next plan shows phantom diffs
```

**Recovery:**

```bash
# Step 1: Back up both states
cp terraform.tfstate terraform.tfstate.engineer-a-backup
# Get engineer B's state
cp <their-state-file> terraform.tfstate.engineer-b-backup

# Step 2: Get the real current state from AWS
terraform refresh
# This queries AWS and updates state to match reality

# Step 3: Run plan to see what still differs
terraform plan

# Step 4: Apply any legitimate code → reality diffs
# Step 5: Ensure everyone switches to remote state with locking
```

**Prevention:**

```bash
# Remote state with DynamoDB locking prevents this entirely
# Make local state impossible by enforcing backend config in CI
# Add a pre-commit hook that fails if backend "local" is detected
grep -r 'backend "local"' . && echo "Local backend not allowed" && exit 1
```

---

## Secrets Appear in Plan Output

Terraform normally hides `sensitive = true` variables from plan output. But some resources and providers log secrets anyway.

**Resources that commonly expose secrets in plan output:**
- `kubernetes_secret` — `data` values appear in plan unless marked sensitive
- `vault_generic_secret` — data fields
- Any resource where a computed attribute contains a secret

**Fix:**

```hcl
variable "db_password" {
  type      = string
  sensitive = true   # hides from plan output
}

output "connection_string" {
  value     = "postgresql://app:${var.db_password}@${aws_db_instance.main.endpoint}/app"
  sensitive = true   # must also mark output as sensitive
}
```

**Note:** `sensitive = true` hides from terminal output but the value is still in the state file in plaintext. Treat state as sensitive regardless.

**For resources that ignore sensitive marking:**

```bash
# Review plan output and pipe to file before sharing
terraform plan -out=tfplan.binary
# Never share raw plan output in tickets if it may contain secrets
# Use terraform show -json tfplan.binary | jq 'del(.configuration)' to strip config
```

---

## Ansible SSH Key Fingerprint Changed (MITM Warning)

Symptom:

```text
UNREACHABLE: web1.example.com
ERROR: Host key verification failed.
Fatal error: [Errno 111] Connection refused

WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
```

**Cause:** The remote host's SSH key changed. This happens legitimately when:
- Instance was replaced (new AMI, new instance)
- OS was reinstalled
- Cloud instance ephemeral key was regenerated

**Fix (only after confirming host identity is legitimate):**

```bash
# Remove the old fingerprint for this specific host
ssh-keygen -R web1.example.com

# Or remove and re-add from the known_hosts file
ssh-keyscan -H web1.example.com >> ~/.ssh/known_hosts
```

**For automation (CI environments where known_hosts management is impractical):**

```ini
# ansible.cfg
[defaults]
host_key_checking = False
```

Or per-playbook:

```yaml
- hosts: web
  vars:
    ansible_ssh_extra_args: '-o StrictHostKeyChecking=no'
```

**Warning:** Disabling host key checking removes protection against MITM attacks. Only acceptable in controlled environments where you can verify instance identity through other means (cloud metadata, VPC-internal IPs only).

**For ephemeral infrastructure (EC2 instances that are frequently replaced):**

```bash
# Use AWS SSM Session Manager instead of SSH — no SSH keys, no host key issues
ansible_connection: aws_ssm
ansible_aws_ssm_bucket_name: my-ssm-output-bucket
ansible_aws_ssm_region: eu-central-1
```

---

## Ansible "Gathering Facts" Hangs

Symptom: Playbook appears to start but never progresses past `TASK [Gathering Facts]`.

**Causes and fixes:**

**Cause 1: Firewall blocking SSH connection back from managed node**

Ansible SSH-proxies to the managed node and runs a Python script. If the managed node can't establish a connection for the response channel:

```bash
# Test basic SSH connectivity
ssh -v ubuntu@web1.example.com

# Test that Ansible can gather facts manually
ansible web1.example.com -i hosts.ini -m setup --timeout=10 -vvvv
```

Fix: ensure port 22 outbound is open from the managed node to the control node (for some connection modes), or use `pipelining = True` in `ansible.cfg`.

**Cause 2: SSH connection timeout — managed node is slow to respond**

```ini
# ansible.cfg
[defaults]
timeout = 30          # connection timeout in seconds

[ssh_connection]
connect_timeout = 30
```

**Cause 3: Slow fact gathering (many disks, many interfaces, slow DNS)**

```yaml
# Disable fact gathering if not needed
- hosts: web
  gather_facts: false
  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present
```

Or use fact caching:

```ini
# ansible.cfg
[defaults]
gathering = smart          # only gather if facts not cached
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible-facts
fact_caching_timeout = 86400   # cache for 24 hours
```

**Cause 4: Python not installed on managed node**

```text
FAILED: module_utils/basic.py: to use the "copy" or "file" module with remote_src=True requires Python >=2.6
```

Fix:

```yaml
- hosts: web
  gather_facts: false
  tasks:
    - name: Install Python (bootstrap task)
      ansible.builtin.raw: apt-get install -y python3
      changed_when: true

# Then re-enable gather_facts in subsequent plays
```

---

## Ansible Task Changed Every Run (Not Idempotent)

**Diagnostic approach:**

```bash
# Run with check and diff to see what changes every run
ansible-playbook site.yml --check --diff

# Look for tasks marked as "changed" — those are the non-idempotent ones
ansible-playbook site.yml 2>&1 | grep "changed="
```

**Common causes:**

`shell:` or `command:` without state tracking:

```yaml
# Non-idempotent: creates directory even if it exists
- name: Create app directory
  ansible.builtin.shell: mkdir -p /opt/myapp

# Idempotent: module checks state
- name: Create app directory
  ansible.builtin.file:
    path: /opt/myapp
    state: directory
    mode: '0755'
```

`shell:` with `creates:` for commands that can't use a module:

```yaml
- name: Extract tarball
  ansible.builtin.shell: tar xzf /tmp/app.tar.gz -C /opt/app
  args:
    creates: /opt/app/bin/myapp   # only runs if this file doesn't exist
```

Command with custom `changed_when`:

```yaml
- name: Run database migration
  ansible.builtin.command: /usr/local/bin/migrate
  register: migration_output
  changed_when: "'Applied 0 migrations' not in migration_output.stdout"
```

Template includes dynamic content (timestamp, random value):

```bash
# Check if template generates different content each time
ansible web1 -i hosts.ini -m template -a "src=app.conf.j2 dest=/tmp/test.conf" --diff
# If it shows diff on every run, check the template for {{ ansible_date_time }} or similar
```

`lineinfile` with overly broad `regexp`:

```yaml
# Risky: if the line format is flexible, this may keep changing
- name: Set max connections
  ansible.builtin.lineinfile:
    path: /etc/myapp/config.ini
    regexp: '^max_connections'
    line: 'max_connections=100'

# Safer: use replace module or template for whole-file management
```

---

## Ansible Tower / AWX Job Fails with Permission Denied

Symptom:

```text
TASK [Deploy configuration] FAILED
fatal: [web1.example.com]: FAILED! => {"changed": false, "msg": "Permission denied: '/etc/myapp/config.conf'"}
```

**Cause 1: Execution environment lacks `become` credential**

In AWX/Tower, `become` (sudo) is configured separately from the SSH credential:

```text
Job Template settings:
  Credential: Machine (SSH) → your-ssh-credential
  Privilege Escalation: check "Enable Privilege Escalation"
  Credential: Vault → your-vault-credential (if using vault)
```

Or add the become password to the Machine credential:
- Edit the Machine credential
- Add "Privilege Escalation Password"

**Cause 2: Execution environment container lacks required collections**

```yaml
# execution-environment.yml — build custom EE
---
version: 1
dependencies:
  galaxy: requirements.yml
  python: requirements.txt
  system: bindep.txt

build_arg_defaults:
  EE_BASE_IMAGE: 'quay.io/ansible/ansible-runner:latest'
```

```bash
# Build and push EE
ansible-builder build -t company/ansible-ee:1.0 -f execution-environment.yml
podman push company/ansible-ee:1.0 registry.company.com/ansible/ansible-ee:1.0
```

In AWX: create a new Execution Environment pointing to `registry.company.com/ansible/ansible-ee:1.0`.

**Cause 3: Job template runs as wrong user**

AWX job runs with the credential's user. If the credential SSH user is `ubuntu` but the task targets a file owned by `root`, `become: true` must be set in the playbook or job template.

---

## Checkov/tfsec False Positives

When a check fires incorrectly and you've verified the control is met through a different means:

**tfsec inline skip:**

```hcl
resource "aws_s3_bucket" "public_website" {
  bucket = "company-public-website"

  # tfsec:ignore:aws-s3-no-public-access-block
  # Justification: This bucket hosts a public static website. Public access is intentional.
  # See: architecture-decision-record/ADR-0042-public-website-bucket.md
}
```

**Checkov inline skip:**

```hcl
resource "aws_s3_bucket" "public_website" {
  #checkov:skip=CKV_AWS_18:Public website bucket — access logging covered by CloudFront logs (ADR-0042)
  #checkov:skip=CKV_AWS_52:Public website bucket — MFA delete not applicable for static assets
  bucket = "company-public-website"
}
```

**tfsec config file exclusions (project-wide):**

```yaml
# .tfsec/config.yml
exclude:
  - aws-s3-no-public-access-block
  - aws-s3-enable-bucket-logging
```

**Checkov skip in `.checkov.yaml` (project-wide):**

```yaml
# .checkov.yaml
skip-check:
  - CKV_AWS_18   # S3 access logging — covered by CloudFront (see ADR-0042)
```

**Principle:** skip annotations should always include a justification comment that explains why the exception is safe. Pure skips without reason are technical debt — an auditor won't know if it's intentional.

---

## `terraform apply` Partially Completed Before Failure

**Symptom:**

```text
aws_security_group.web: Creating... [done]
aws_instance.web: Creating... [done]
aws_route53_record.web: Creating...
Error: Error creating Route53 record: InvalidChangeBatch: [Invalid Resource Record Set]

Apply incomplete. Some resources were created, some were not.
```

**What happened:**
Terraform applied some resources successfully, wrote them to state, then failed on a later resource. The state now reflects what was created, but the infrastructure is incomplete.

**What NOT to do:**
Do not re-run `terraform apply` blindly. The created resources are already in state; re-running will attempt to create the failed resource again, which may succeed or fail differently.

**What to do:**

```bash
# Step 1: See what was actually created (already in state)
terraform state list

# Step 2: Run plan to see what remains to be created
terraform plan
# This shows only what still needs to be done — already-created resources won't show +

# Step 3: Fix the root cause of the failure
# In the Route53 example: fix the invalid record set configuration

# Step 4: Apply with -target to complete just the remaining resources
terraform apply -target=aws_route53_record.web

# Step 5: Run a full plan to confirm everything is now clean
terraform plan
# Expected: No changes. Infrastructure is up-to-date.
```

**When to use `terraform apply -target` carefully:**
- Only to complete a partially-applied stack
- Only to recover from a known specific failure
- Not as a routine operation — targeted applies can leave the dependency graph inconsistent

**Prevention:** use `create_before_destroy` for resources that depend on others so that failures are less likely to leave partial state. Also: ensure your CI pipeline's apply step has a retry mechanism that re-runs plan before re-applying.

---

## Final Rule

Be precise when describing IaC failures:

```text
Terraform code is invalid.
Terraform state is locked.
Terraform plan is unsafe.
Provider behavior changed.
Real infrastructure drifted.
Ansible cannot reach hosts.
Ansible playbook is not idempotent.
```

Each statement points to a different owner, evidence source, and fix path.
