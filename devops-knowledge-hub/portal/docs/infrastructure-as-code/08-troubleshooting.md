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
