---
title: "Interview Questions"
sidebar_position: 4
---

# Infrastructure as Code — Interview Questions

Strong IaC answers explain state, blast radius, module design, plan review, import, drift, and safe automation. Weak answers only list Terraform commands.

---

## Beginner Questions

### What is Infrastructure as Code?

IaC is managing infrastructure through version-controlled configuration files rather than manual actions. It makes infrastructure reproducible, reviewable, auditable, and easier to recover.

### What is Terraform?

Terraform is a declarative IaC tool that uses providers to manage infrastructure across cloud platforms and other APIs. You write desired state in HCL, run a plan, then apply changes.

### What is the Terraform workflow?

```text
write -> init -> fmt -> validate -> plan -> apply -> output
```

### What is Terraform state?

State maps Terraform resource addresses to real infrastructure objects. Without state, Terraform does not know what it manages.

### Why should state not be committed to Git?

State may contain sensitive values and is constantly changing. Teams should use remote state with access control and locking.

---

## Terraform Core Questions

### Provider vs resource?

A provider is the plugin that talks to an API. A resource is a managed object created or updated through that provider.

### Variable vs output?

A variable is input to a configuration. An output exposes useful values after apply.

### What is a module?

A module is a reusable Terraform package. Root modules call child modules to standardize infrastructure patterns.

### What is `terraform plan`?

A preview of intended changes. It shows creates, updates, replacements, and destroys before apply.

### What does `terraform import` do?

It associates an existing real-world resource with a Terraform address in state. You must still write matching HCL.

---

## State And Environment Questions

### How do you manage multiple environments?

Use separate state per environment, environment-specific variables, and reusable modules. Workspaces can work for similar environments, but folders and separate states are often clearer for production.

### How do you manage state securely?

Use a remote backend, encryption, state locking, access control, versioning, and limited read access. Treat state as sensitive metadata.

### What is state locking?

A mechanism that prevents two Terraform runs from modifying the same state at the same time.

### What is drift?

Drift is when real infrastructure differs from Terraform code and state. It can happen through manual changes, external controllers, provider changes, or emergency fixes.

### How do you handle drift?

Classify whether code or infrastructure is correct. Then update code, revert the manual change, import missing resources, or adjust ignore rules carefully.

---

## Module And Design Questions

### How do you structure Terraform for a large organization?

Use shared modules, environment folders, separate states, controlled apply pipelines, policy-as-code, documentation, and versioned module releases.

### What makes a good Terraform module?

Clear inputs, safe defaults, useful outputs, examples, versioning, minimal hidden behavior, and built-in platform standards.

### Why avoid referencing module `main` directly?

Because module behavior can change without review. Use version tags to make upgrades intentional.

### What are good module defaults?

Encryption enabled, required tags, private networking, backups where applicable, logging enabled, and narrow access by default.

---

## Advanced Terraform Questions

### When use `depends_on`?

Only when Terraform cannot infer a dependency from references, such as side effects from `null_resource`, provisioners, or external systems.

### When use `ignore_changes`?

When another system legitimately owns a field. Use it sparingly because it can hide real drift.

### When use `prevent_destroy`?

For critical resources such as production databases, state buckets, and KMS keys where accidental deletion would be severe.

### How do you refactor resources safely?

Use `moved` blocks or `terraform state mv`, then confirm the plan shows no replacement or destruction.

### What is the risk of `terraform apply -target`?

It applies only part of the graph and can leave dependencies inconsistent. Use it rarely for recovery or controlled exceptional cases.

---

## Ansible Questions

### What is Ansible?

Ansible is an agentless automation tool for host configuration, provisioning, deployment, and orchestration. It usually connects over SSH and runs tasks on managed hosts.

### What is an inventory?

Inventory defines the hosts and groups Ansible manages. It can be static or dynamic from a cloud API.

### What is a playbook?

A YAML file describing tasks to run on selected hosts.

### What is idempotency?

Running the same automation repeatedly should converge to the same result without unnecessary changes or damage.

### Why prefer modules over shell commands?

Modules understand system state and are usually idempotent. Shell commands are harder to reason about and may run every time.

### What are handlers?

Handlers run only when notified, often to restart or reload a service after configuration changes.

---

## Scenario Questions

### Terraform plan wants to replace a production database. What do you do?

Stop. Identify why replacement is proposed. Check schema changes, provider changes, lifecycle settings, renamed resources, and state address changes. Use `prevent_destroy` for critical resources and never approve destructive replacement without a recovery plan.

### A resource was created manually. How do you bring it under Terraform?

Write a matching resource block, import it, run plan, adjust configuration until no unexpected changes remain, then commit the code and document ownership.

### Two engineers ran apply at the same time. What should have prevented this?

Remote state locking. For AWS, S3 backend with DynamoDB locking is a common pattern.

### Ansible playbook restarts all web servers at once. How do you reduce risk?

Use `serial`, health checks, handlers, and rolling batches. Avoid restarting all hosts simultaneously in production.

### A Terraform module change breaks many teams. What went wrong?

The module was treated as an internal script instead of a versioned platform product. Use semantic versioning, release notes, examples, and canary adoption.

---

## Staff-Level Questions

### How do you design an IaC platform for many teams?

Provide golden modules, remote state standards, CI plan/apply workflow, policy-as-code, drift detection, documentation, and clear ownership. Teams consume safe defaults and request exceptions when needed.

### What should be centralized?

State backend patterns, module registry, policy checks, account/project vending, networking baselines, tagging, and production apply controls.

### What should be delegated?

Application-level infrastructure parameters, service-specific scaling, non-production experimentation, and ownership of service modules within platform guardrails.

### What are unhealthy IaC signals?

Manual console changes are common, plans are too large to review, state is shared too broadly, modules have no versions, production applies happen from laptops, and drift is ignored.
