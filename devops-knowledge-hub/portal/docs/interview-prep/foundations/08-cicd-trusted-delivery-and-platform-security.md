---
title: "Foundations: CI/CD Premium Teaching Guide For SRE And Platform Engineers"
sidebar_position: 8
---

# Foundations: CI/CD Premium Teaching Guide For SRE And Platform Engineers

CI/CD is the system that moves a code change into production safely.

For SRE and platform engineers, CI/CD is not only automation. It is a reliability control system for reducing change risk, shortening feedback loops, proving artifact trust, and making rollback faster than panic.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — CI, CD, pipelines, artifacts, environments.
2. **Intermediate Layer** — tests, builds, approvals, rollout strategies.
3. **Advanced Layer** — GitOps, OIDC, SBOM, signing, policy gates.
4. **Production SRE Layer** — failed deploys, flaky pipelines, rollback design.
5. **Interview Layer** — explain safe delivery tradeoffs clearly.

---

# Memory Palace: CI/CD Is A Factory

| Concept | Factory Analogy | Real Meaning |
|---|---|---|
| Commit | Raw material | Proposed change |
| Pull Request | Design review desk | Human review |
| CI Pipeline | Inspection conveyor | Automated validation |
| Artifact | Finished product | Image, binary, package, chart |
| Registry | Warehouse | Artifact storage |
| Deploy | Shipping dock | Release to environment |
| Canary | Pilot shipment | Small rollout first |
| Blue-Green | Two warehouses | Fast traffic switch |
| Rollback | Product recall | Restore safe version |
| Signature | Tamper seal | Artifact trust proof |

---

# Beginner Layer: CI vs CD

## Continuous Integration

Every change is integrated and validated frequently.

Typical checks:

- formatting
- linting
- unit tests
- type checks
- build
- dependency scan
- secret scan

## Continuous Delivery

Every validated change is deployable, but production may require approval.

## Continuous Deployment

Every validated change automatically reaches production.

Most teams should mature to continuous delivery before continuous deployment.

---

# Beginner Layer: Pipeline Anatomy

A normal delivery path looks like this:

```text
PR -> lint -> test -> build -> scan -> publish artifact -> deploy staging -> smoke test -> approve -> production -> observe
```

Principle:

> Cheap checks early, expensive checks later.

Fast pipelines encourage good engineering behavior. Slow painful pipelines create bypass culture.

---

# Beginner Layer: Artifact Strategy

Deploy artifacts, not random working directories.

Examples:

- container image
- binary
- package
- Helm chart
- static site build

Good artifacts are:

- immutable
- versioned
- traceable to a commit
- scanned
- reproducible
- stored in a trusted registry

Build once, promote many.

---

# Intermediate Layer: Testing Strategy

| Test Type | Purpose | Where |
|---|---|---|
| Unit | Local logic | Early CI |
| Integration | Components together | Mid pipeline |
| Contract | API compatibility | Mid pipeline |
| End-to-End | User journey | Staging |
| Smoke | Basic health | Post deploy |
| Load | Capacity regression | Scheduled or gated |

Do not rely only on end-to-end tests. They are valuable, but expensive and often flaky when overused.

---

# Intermediate Layer: Credentials And Access

Avoid:

- long-lived cloud keys in CI
- secrets printed in logs
- secrets baked into images
- shared admin tokens

Prefer:

- OIDC federation
- short-lived credentials
- scoped environment secrets
- external secret managers
- least privilege roles

A pipeline credential should have only the permissions needed for that stage.

---

# Intermediate Layer: Deployment Strategies

## Rolling Update

Gradually replaces old instances. Good default for stateless services.

## Canary

Sends a small percentage of traffic to the new version first.

## Blue-Green

Keeps two environments and switches traffic.

## Feature Flags

Deploy code separately from exposing behavior.

Choose based on blast radius, rollback speed, and observability maturity.

---

# Advanced Layer: Progressive Delivery

Progressive delivery increases exposure only when health remains good.

```text
1% -> 5% -> 25% -> 50% -> 100%
```

Promotion gates should inspect:

- error rate
- latency
- saturation
- business success metrics
- logs and traces

Canary without metrics is delayed failure.

---

# Advanced Layer: GitOps

GitOps stores desired deployment state in Git.

```text
CI builds image -> updates manifests -> ArgoCD or Flux syncs cluster
```

Benefits:

- Git audit trail
- drift visibility
- rollback by revert
- reduced need for direct cluster access from CI

---

# Advanced Layer: Trusted Supply Chain

Ask:

- Which commit produced this artifact?
- What dependencies are included?
- Was it scanned?
- Was it signed?
- Can production verify it?

Useful concepts:

- SBOM
- provenance
- image signing
- digest pinning
- admission policy

Prefer immutable digests over mutable tags.

---

# Advanced Layer: Guardrails

Strong delivery systems use:

- branch protection
- required reviews
- CODEOWNERS
- required checks
- environment approvals
- protected runners
- audit logs

The goal is safe speed, not bureaucracy.

---

# Production SRE Layer: Real Incidents

## Bad Deploy Caused Error Spike

Response:

- compare deploy timestamp to metrics
- pause rollout
- rollback if confidence is high
- confirm recovery
- investigate after mitigation

## Pipeline Too Slow

Symptoms:

- bypass pressure
- giant pull requests
- hotfix culture

Fix:

- caching
- parallel tests
- split fast and slow suites
- targeted runs

## Flaky Tests Block Releases

Fix:

- quarantine flaky tests
- assign owners
- repair root causes
- stop normalizing blind reruns

## Wrong Image Deployed

Likely cause:

- mutable tag reused

Fix:

- immutable tags
- digest pinning
- release metadata

## Rollback Failed

Likely causes:

- database schema incompatibility
- old artifact missing
- config drift
- rollback path never tested

Rollback must be designed and rehearsed.

---

# Production SRE Layer: Troubleshooting Flow

## CI Fails

Check:

- recent dependency changes
- test logs
- environment mismatch
- credentials expiry

## Deploy Fails

Check:

- artifact exists
- correct manifest tag or digest
- RBAC and permissions
- cluster events
- health checks

## Production Degraded After Deploy

Check:

- version-by-version metrics
- logs and traces by release
- dependency saturation
- rollback readiness

---

# Interview Layer: Strong Answers

## Why separate build from deploy?

> Build once to produce a trusted immutable artifact, then promote the same artifact across environments.

## Why use short-lived credentials?

> Short-lived credentials reduce long-term secret exposure and allow access to be scoped to repo, branch, workflow, and environment.

## Why are mutable tags risky?

> The same tag can point to different content over time, which breaks reproducibility and rollback certainty.

## How do you design safe delivery?

> Fast CI feedback, trusted artifacts, least-privilege credentials, progressive rollout, strong observability, and tested rollback paths.

---

# Labs

## Beginner

1. Build CI for lint and test.
2. Publish a test report.
3. Build a container image.

## Intermediate

1. Add a security scan.
2. Add staging deploy.
3. Add smoke test.
4. Add manual approval for production.

## Advanced

1. Configure short-lived cloud auth.
2. Generate an SBOM.
3. Sign an image.
4. Deploy via GitOps.
5. Add a canary metric gate.
6. Practice rollback.

---

# Memory Review

- Why build once and promote many?
- Why is canary weak without metrics?
- Why use short-lived credentials?
- Why must rollback be tested?
- Why do slow pipelines create bypass behavior?

---

# Senior Summary

> I design CI/CD as a trusted delivery system: rapid feedback in CI, immutable artifacts, least-privilege credentials, controlled promotion across environments, observable progressive rollout, and rehearsed rollback. Change management should increase speed and safety simultaneously.
