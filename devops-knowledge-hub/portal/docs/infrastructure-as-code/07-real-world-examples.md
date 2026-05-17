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

## Staff-Level Summary

IaC incidents rarely come from Terraform syntax. They come from unclear ownership, bad state boundaries, unreviewable plans, unversioned modules, manual drift, and unsafe automation patterns. Good IaC platforms make the safe path easy and the dangerous path visible before production changes happen.
