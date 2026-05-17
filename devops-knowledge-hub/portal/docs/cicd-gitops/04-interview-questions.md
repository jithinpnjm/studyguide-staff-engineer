---
title: "Interview Questions"
sidebar_position: 4
---

# CI/CD & GitOps — Interview Questions

Use these questions to practice both tool knowledge and staff-level reasoning. Strong answers explain tradeoffs, blast radius, rollback, and operational failure modes. Weak answers list product features.

---

## Beginner Questions

### What is CI/CD?

CI validates changes automatically. CD promotes validated artifacts to environments. Continuous Delivery keeps every change deployable with optional approval. Continuous Deployment pushes every validated change to production automatically.

### What is the difference between build and release pipelines?

A build pipeline compiles, tests, packages, and publishes artifacts. A release pipeline promotes those artifacts to environments. In modern YAML pipelines these may be in one file, but the responsibilities should still be separate.

### What is an artifact?

A versioned output from CI: container image, JAR, binary, package, Helm chart, or static build. It should be immutable and traceable to a commit.

### Why build once and promote many?

Because staging must test the same artifact that production will run. Rebuilding per environment breaks reproducibility and makes rollback uncertain.

### What is GitOps?

GitOps uses Git as the desired-state source. A controller such as ArgoCD or Flux compares Git with the cluster and reconciles differences.

### What is the difference between push-based CD and pull-based GitOps?

Push-based CD lets an external pipeline write to the cluster. Pull-based GitOps has an in-cluster controller pull desired state from Git. Pull-based delivery reduces the need for direct cluster write access from CI and gives drift visibility.

---

## Git And Version Control

### What is the difference between merge and rebase?

Merge preserves branch history and may create a merge commit. Rebase replays local commits on top of another branch to create a cleaner linear history. Rebase local branches; do not casually rewrite shared history.

### Why is revert safer than reset on main?

Revert creates an explicit undo commit while preserving shared history. Reset moves history and can break collaborators if used on shared branches.

### How do you recover a lost local commit?

Use reflog.

```bash
git reflog
git switch -c rescue HEAD@{3}
```

### How do you find the commit that introduced a regression?

Use timing from logs first, then `git bisect` for systematic search.

```bash
git bisect start
git bisect bad
git bisect good v1.0.0
```

### What should a good infrastructure PR include?

What changed, why it changed, how it was tested, blast radius, rollback plan, and screenshots or plan output when useful.

---

## Jenkins Questions

### Explain Jenkins controller-agent architecture.

The controller schedules jobs, manages configuration, and coordinates pipelines. Agents execute build steps in workspaces. In production, builds should run on agents, not on the controller.

### How do you scale Jenkins?

Use ephemeral agents, often Kubernetes pod agents or cloud VM agents. Monitor queue time, agent startup latency, disk pressure, and plugin health. Keep the controller small and stable.

### What are common Jenkins failure modes?

Plugin incompatibility, credential ID mismatch, agent disk full, agent pod Pending, controller overload, shared library breaking many jobs, and stale workspaces.

### How do you manage Jenkins plugins safely?

Maintain approved plugin versions, test upgrades in staging, keep a rollback path, avoid unnecessary plugins, and version shared pipeline libraries.

---

## GitHub Actions Questions

### What are workflow, job, step, runner, and action?

A workflow is the YAML automation file. A job is a group of steps. A step is a command or action invocation. A runner executes the job. An action is reusable logic.

### When do you use self-hosted runners?

Use them for private network access, custom hardware, special toolchains, or compliance requirements. Use isolation and cleanup because persistent runners can leak state between builds.

### How do you structure a monorepo workflow?

Use path filters, service ownership, dependency graph detection, and reusable workflows. Be careful with shared libraries because a shared change can require more services to test.

### Why should production deployment jobs be separated from normal CI jobs?

They have different risk, permissions, audit requirements, and approval needs. CI validates; production promotion changes customer-facing runtime state.

---

## Azure DevOps Questions

### What are the core Azure DevOps components?

Azure Repos, Azure Pipelines, Azure Artifacts, Azure Boards, and Azure Test Plans.

### What is a service connection?

A configured connection that lets a pipeline interact with an external system such as Azure, Kubernetes, Docker registry, GitHub, or SonarQube. It should be scoped narrowly.

### How do you implement approvals in Azure Pipelines?

Use Environments and configure approvals and checks before deployment jobs run.

### How do you cache dependencies in Azure Pipelines?

Use `Cache@2` keyed by operating system and dependency file.

```yaml
- task: Cache@2
  inputs:
    key: 'maven | "$(Agent.OS)" | pom.xml'
    path: $(Pipeline.Workspace)/.m2
    restoreKeys: |
      maven | "$(Agent.OS)"
      maven
```

### How do you rollback in Azure Pipelines?

Redeploy the previous artifact, swap application slots where applicable, or use Kubernetes rollback for deployments.

```bash
kubectl rollout undo deployment/myapp -n production
```

---

## ArgoCD And GitOps Questions

### What does OutOfSync mean?

The cluster actual state differs from the desired state in Git. It may be caused by manual edits, controller-mutated fields, failed sync, or drift.

### What is `prune`?

When enabled, ArgoCD deletes cluster resources that were removed from Git.

### What is `selfHeal`?

When enabled, ArgoCD repairs cluster drift by applying Git state again.

### How do you debug a stuck ArgoCD sync?

```bash
argocd app get myapp
argocd app diff myapp
kubectl get events -n myapp --sort-by=.lastTimestamp
kubectl describe deploy myapp -n myapp
```

Check manifest validity, permissions, image pull, readiness, admission policies, and namespace existence.

### Why might GitOps revert a manual hotfix?

Because the manual runtime state differs from Git desired state. With self-heal enabled, the controller restores Git state. The durable fix must be committed to Git.

---

## Security And Trust Questions

### How do you know production came from reviewed source?

Trace the chain: protected branch commit, pull request review, CI run, artifact digest, scan result, signature or attestation, GitOps promotion commit, and deployment revision.

### Why are mutable tags risky?

The same tag can point to different content over time. That breaks auditability and rollback certainty.

### What is an SBOM?

A Software Bill of Materials lists components and dependencies inside an artifact. It helps answer which running services contain a vulnerable library.

### How do you design a multi-tenant CI platform?

Separate trust tiers. External PRs get no privileged context. Internal CI gets scoped resources. Production promotion runs on more controlled workers with explicit approval and audit.

---

## Staff-Level Design Questions

### Design a CI/CD pipeline for 30 microservices.

Strong answer:

- Decide monorepo vs polyrepo based on team and dependency structure.
- Use reusable workflow or shared pipeline library.
- Use selective builds so one small change does not rebuild everything.
- Build immutable images tagged by SHA.
- Scan artifacts and publish metadata.
- Update GitOps environment overlays.
- Use ArgoCD for deployment.
- Use canary rollout for high-risk services.
- Track delivery SLIs: queue time, build duration, deploy duration, rollback duration, flaky-test rate.

### How do you ensure a deployment does not break production?

Use layered defense: tests, static analysis, artifact checks, staging smoke tests, progressive rollout, SLO-based monitoring, and rollback drills. Database changes use expand-contract migration, not breaking one-step schema changes.

### A pipeline is technically correct but teams bypass it. What do you do?

Diagnose friction first. If the compliant path is slow or confusing, enforcement alone creates resentment and shadow pipelines. Improve ergonomics, then enforce at high-risk promotion gates.

### What signals show the delivery platform is becoming a reliability risk?

- CI infra failures rising
- P95 queue time rising
- P95 deployment duration rising
- Teams creating shadow pipelines
- Rollbacks increasing without deployment volume increasing
- Platform appears as contributing factor in incidents

---

## Pressure Follow-Ups

### Where is the blast radius?

Name the teams, services, environments, clusters, and users affected if this pipeline or policy fails incorrectly.

### What would you centralize?

Centralize shared templates, artifact policy, runner baseline, observability interface, and production promotion controls.

### What would you leave to teams?

Service-level test design, application-specific rollout metrics, domain-specific deployment timing, and non-production experimentation.

### What is the rollback story?

For every release, know whether rollback is Git revert, Argo rollback, image digest rollback, slot swap, or database-compatible forward fix.
