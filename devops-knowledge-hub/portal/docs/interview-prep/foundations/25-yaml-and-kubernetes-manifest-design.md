---
title: "Foundations: YAML And Kubernetes Manifest Design Premium Teaching Guide"
sidebar_position: 25
---

# Foundations: YAML And Kubernetes Manifest Design Premium Teaching Guide

YAML is the configuration language most Kubernetes engineers touch every day, but production-quality manifest design is much more than indentation.

A manifest is an operational contract. It tells Kubernetes what to run, how to run it, how to expose it, how to secure it, how to update it, and how to recover when things go wrong.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — YAML syntax and Kubernetes object structure.
2. **Intermediate Layer** — Deployments, Services, ConfigMaps, Secrets, probes, resources.
3. **Advanced Layer** — scheduling, securityContext, NetworkPolicy, PDBs, HPA, Kustomize.
4. **Production SRE Layer** — outage prevention and manifest review.
5. **Interview Layer** — explain safe manifest design clearly.

---

# Memory Palace: Restaurant Order System

| Concept | Analogy | Meaning |
|---|---|---|
| YAML | Order form | Structured config |
| apiVersion/kind | Cuisine + dish type | Kubernetes object identity |
| metadata | Order label | Name, namespace, labels |
| spec | Customer request | Desired state |
| status | Kitchen update | Observed state |
| labels | Table tags | Object grouping |
| selector | Waiter filter | Which objects to target |
| probes | Food quality checks | Health behavior |
| resources | Kitchen allocation | CPU/memory reservation |

---

# Beginner Layer: YAML Basics

YAML uses indentation to express structure.

```yaml
name: checkout
replicas: 3
enabled: true
ports:
  - 80
  - 443
labels:
  app: checkout
  team: payments
```

Spaces matter. Tabs are dangerous.

Quote risky values:

```yaml
version: "1.10"
value: "true"
port: "080"
```

---

# Beginner Layer: Kubernetes Object Anatomy

Most objects look like this:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
spec:
  replicas: 3
```

| Field | Meaning |
|---|---|
| apiVersion | API group/version |
| kind | object type |
| metadata | name, namespace, labels, annotations |
| spec | desired state |
| status | observed state |

You write `spec`. Controllers write `status`.

---

# Beginner Layer: Labels And Selectors

Labels connect objects.

A Service finds Pods through selectors.

```yaml
selector:
  app: checkout
```

Common outage:

> Service exists but has no endpoints because selector does not match Pod labels.

---

# Intermediate Layer: Production Deployment Shape

A production Deployment should usually define:

- stable labels
- immutable image tag or digest
- readiness probe
- resource requests
- safe rollout strategy
- security context

Key rule:

> A Deployment should describe behavior during rollout and failure, not only what image to run.

---

# Intermediate Layer: Service Design

```yaml
ports:
  - name: http
    port: 80
    targetPort: 8080
```

`port` is what callers use.

`targetPort` is where the container listens.

Wrong `targetPort` creates confusing traffic failures.

---

# Intermediate Layer: ConfigMaps And Secrets

ConfigMap = non-sensitive config.

Secret = sensitive value container, but not automatically safe unless RBAC and encryption are configured.

Production guidance:

- separate config from code
- do not log secrets
- restrict RBAC
- prefer external secret managers where appropriate

---

# Intermediate Layer: Probes

| Probe | Question |
|---|---|
| startupProbe | Has app finished booting? |
| readinessProbe | Can app receive traffic? |
| livenessProbe | Should app restart? |

Bad pattern:

> Liveness probe checks database health and causes restart storms during DB outage.

Use readiness for dependency readiness. Use liveness for stuck process detection.

---

# Intermediate Layer: Requests And Limits

Requests affect scheduling.

Limits affect runtime enforcement.

Important behavior:

- CPU limit can throttle
- memory limit can OOMKill
- missing requests cause bad scheduling
- HPA needs requests for utilization math

---

# Advanced Layer: Security Context

Production workloads should minimize privilege.

Good defaults:

- run as non-root
- no privilege escalation
- drop Linux capabilities
- read-only root filesystem where practical
- seccomp RuntimeDefault

Security context is part of reliability because compromised workloads become incidents.

---

# Advanced Layer: Scheduling Controls

Use placement intentionally:

- nodeSelector for simple placement
- taints/tolerations for dedicated nodes
- affinity for co-location
- anti-affinity for spreading
- topology spread for zone resilience

Bad placement can turn one-node failure into full service outage.

---

# Advanced Layer: PodDisruptionBudget

PDB protects replicated workloads during voluntary disruption such as node drains.

Without PDBs, maintenance can evict too many replicas at once.

Use with enough replicas. A PDB cannot protect a single replica from downtime.

---

# Advanced Layer: HPA

HorizontalPodAutoscaler needs:

- metrics
- resource requests
- reasonable min/max replicas
- workload that can scale horizontally

Autoscaling bad metrics creates bad automation.

---

# Advanced Layer: NetworkPolicy

NetworkPolicy controls Pod traffic.

Important:

- default allow unless policies select Pods
- egress deny often breaks DNS unless allowed
- policy requires CNI support

Use policy to encode trust boundaries.

---

# Advanced Layer: Kustomize

Use Kustomize for environment overlays.

```text
base/
overlays/dev/
overlays/prod/
```

Avoid copy-pasting entire manifests per environment. Copy-paste creates silent drift.

---

# Production SRE Layer: Manifest Review Checklist

Before approving, check:

- selector matches labels
- image tag/digest is safe
- readiness probe exists
- liveness is not dangerous
- requests/limits make sense
- rollout strategy preserves availability
- securityContext is hardened
- PDB exists for critical replicated services
- configs and secrets are separated
- NetworkPolicy matches trust model

---

# Production SRE Layer: Real Incidents

## Service Has No Endpoints

Likely:

- selector mismatch
- Pods not ready

Check:

```bash
kubectl describe svc api
kubectl get pods --show-labels
kubectl get endpointslice
```

## Rollout Hangs

Likely:

- readiness failing
- image pull error
- insufficient capacity
- bad maxUnavailable/maxSurge

## Restart Storm

Likely:

- liveness too aggressive
- dependency check in liveness
- slow startup without startupProbe

## Node Drain Caused Outage

Likely:

- no PDB
- too few replicas
- replicas concentrated on one node/AZ

---

# Production SRE Layer: Validation Tools

Use:

```bash
kubectl apply --dry-run=server -f file.yaml
kubectl diff -f file.yaml
kubectl explain deployment.spec.template.spec.containers
kubeconform manifest.yaml
kube-score score manifest.yaml
conftest test manifest.yaml
```

Validation catches syntax. Review catches operational risk.

---

# Interview Layer: Strong Answers

## Why are manifests operational contracts?

> They define not only what to run, but how the workload behaves during scheduling, rollout, failure, security enforcement, and recovery.

## Readiness vs liveness?

> Readiness controls traffic eligibility. Liveness controls restart behavior.

## Why avoid `latest`?

> It is mutable and breaks reproducibility and rollback certainty.

## What should every production Deployment include?

> Stable selectors, safe image reference, probes, resource requests, rollout strategy, security context, and appropriate disruption controls.

---

# Labs

## Beginner

1. Write Pod, Service, Deployment manifests.
2. Break YAML indentation and fix it.
3. Inspect object status.

## Intermediate

1. Break Service selector and debug endpoints.
2. Add ConfigMap and Secret.
3. Add readiness/startup/liveness probes.

## Advanced

1. Add securityContext hardening.
2. Add PDB.
3. Add HPA.
4. Add NetworkPolicy with DNS allowance.
5. Create Kustomize dev/prod overlays.

---

# Memory Review

- Why can a Service exist with no endpoints?
- Why does HPA need requests?
- Why should liveness not check DB health?
- What does a PDB protect against?
- Why is copy-pasted YAML risky?

---

# Senior Summary

> I review Kubernetes manifests as operational contracts. I check selector correctness, rollout safety, probes, resources, security posture, disruption tolerance, and environment drift. A manifest is production-ready only when it describes how the workload behaves during failure, rollout, and recovery.
