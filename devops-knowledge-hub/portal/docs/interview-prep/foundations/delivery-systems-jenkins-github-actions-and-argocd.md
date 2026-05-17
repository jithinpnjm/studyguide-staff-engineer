---
title: "Foundations: Delivery Systems, Jenkins, GitHub Actions, And ArgoCD Premium Teaching Guide"
sidebar_position: 17
---

# Foundations: Delivery Systems, Jenkins, GitHub Actions, And ArgoCD Premium Teaching Guide

Delivery systems turn code changes into safe production reality.

For SRE and platform engineers, delivery is not only automation. It is risk management: who can ship, what gets verified, how artifacts are trusted, how rollbacks work, and how drift is corrected.

This guide teaches practical delivery systems from first principles to production-grade operations.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — CI, CD, pipelines, artifacts, environments.
2. **Intermediate Layer** — Jenkins, GitHub Actions, ArgoCD, approvals.
3. **Advanced Layer** — GitOps, OIDC, runners, rollout safety.
4. **Production SRE Layer** — broken pipelines, failed deploys, drift.
5. **Interview Layer** — explain safe delivery architecture clearly.

---

# Memory Palace: Factory + Shipping Port

| Concept | Analogy | Meaning |
|---|---|---|
| Commit | Raw material | Proposed change |
| PR | Design review desk | Human review |
| CI | Quality line | Validation automation |
| Artifact | Finished product | Image/binary/package |
| Registry | Warehouse | Artifact storage |
| CD | Shipping dock | Release automation |
| ArgoCD | Port robot | Sync Git to cluster |
| Rollback | Product recall | Restore safe version |

---

# Beginner Layer: CI vs CD vs GitOps

## CI

Validates every change.

Typical checks:

- lint
- test
- build
- scan

## CD

Moves validated changes to environments.

## GitOps

Git stores desired runtime state. A controller reconciles actual state to Git.

```text
CI builds image -> manifest updated -> ArgoCD syncs cluster
```

---

# Beginner Layer: Healthy Pipeline Shape

```text
PR -> checks -> build artifact -> publish -> deploy staging -> smoke test -> approve -> production -> observe
```

Principles:

- cheap checks early
- expensive checks later
- build once promote many
- fast rollback path

---

# Beginner Layer: Artifact Trust

Good artifacts are:

- immutable
- traceable to commit
- scanned
- versioned
- reproducible

Avoid mutable `latest` in production.

---

# Intermediate Layer: Jenkins Explained

Best for:

- legacy enterprises
- private networks
- custom pipelines
- unusual build environments

Architecture:

```text
Controller -> queue -> agents -> workspaces
```

Operational risks:

- plugin sprawl
- credential sprawl
- controller bottleneck
- snowflake jobs

Use ephemeral agents when possible.

---

# Intermediate Layer: GitHub Actions Explained

Best for:

- GitHub-native teams
- fast onboarding
- repo-based workflows

Key parts:

- workflow
- job
- step
- runner
- environment
- artifact

Use branch protection and required checks.

---

# Intermediate Layer: ArgoCD Explained

ArgoCD compares:

```text
Git desired state <-> cluster actual state
```

States:

- Synced
- OutOfSync
- Healthy
- Degraded

Why teams like it:

- Git audit trail
- drift visibility
- rollback by Git revert
- less direct cluster access from CI

---

# Intermediate Layer: Environment Controls

Use environments such as:

- dev
- staging
- production

Production controls may include:

- approvals
- restricted secrets
- deployment windows
- separate credentials

---

# Advanced Layer: OIDC Instead Of Static Secrets

Prefer short-lived cloud credentials issued at runtime.

Benefits:

- no long-lived keys in CI
- scoped trust policies
- better auditability
- easier rotation model

---

# Advanced Layer: Self-Hosted Runners

Use when needing:

- private network access
- custom hardware
- GPU builds
- compliance controls

Risks:

- persistence between jobs
- secret leakage
- untrusted code risk

Use isolated ephemeral runners for sensitive workloads.

---

# Advanced Layer: Rollout Strategies

- rolling update
- canary
- blue-green
- feature flags

Choose based on blast radius and rollback speed.

Canary without observability is guesswork.

---

# Advanced Layer: GitOps Safety

Use:

- PR review on manifests
- protected branches
- sync windows if needed
- RBAC in ArgoCD
- project boundaries
- diff visibility

---

# Production SRE Layer: Real Incidents

## CI Passed But Prod Failed

Likely gaps:

- config path untested
- manifest wrong
- missing secret
- dependency mismatch

## ArgoCD OutOfSync Repeatedly

Likely causes:

- manual cluster edits
- HPA changing replicas
- controller-mutated fields

## Pipeline Slow And Painful

Fix:

- cache dependencies
- parallelize jobs
- split fast/slow suites
- remove waste

## Runner Outage Blocks Deploys

Need:

- runner redundancy
- autoscaling pool
- separate critical deploy runners

## Rollback Failed

Often due to:

- database schema changes
- missing old artifact
- incompatible config

Rollback must be designed in advance.

---

# Production SRE Layer: Troubleshooting Flow

## Build Failing
nCheck:

- dependency registry
- credentials
- changed tool versions
- test logs

## Deploy Failing

Check:

- artifact exists
- correct image digest
- permissions
- cluster health
- readiness failures

## Drift Suspected

Check:

- ArgoCD diff
- recent manual changes
- automation controllers

---

# Interview Layer: Strong Answers

## Why separate CI from CD?

> CI validates and builds trusted artifacts. CD promotes verified artifacts safely through environments.

## Why GitOps?

> Git becomes the audit trail and source of truth. Drift becomes visible and rollback can be a Git revert.

## Why are mutable tags risky?

> The same tag may point to different content over time, breaking reproducibility.

## How do you secure pipelines?

> Least privilege, short-lived credentials, approvals, protected branches, signed artifacts, and strong logging.

---

# Labs

## Beginner

1. Build a test workflow.
2. Publish an artifact.
3. Add staging deploy.

## Intermediate

1. Add approval gate.
2. Build and push image.
3. Deploy with ArgoCD.

## Advanced

1. Configure OIDC cloud auth.
2. Simulate drift and self-heal.
3. Add canary rollout.
4. Practice rollback.

---

# Memory Review

- Why build once promote many?
- Why is GitOps useful?
- Why are self-hosted runners risky?
- Why can schema changes break rollback?
- Why should prod access be tighter than dev?

---

# Senior Summary

> I design delivery systems around fast feedback, immutable trusted artifacts, least-privilege credentials, controlled promotion, observable rollout, and rehearsed rollback. For Kubernetes I prefer GitOps so desired state is versioned and drift is visible.
