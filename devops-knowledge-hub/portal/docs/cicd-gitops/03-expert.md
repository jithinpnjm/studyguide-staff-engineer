---
title: "Expert"
sidebar_position: 3
---

# CI/CD & GitOps — Expert

Expert-level CI/CD is trusted delivery architecture. The central question is no longer “does the pipeline run?” It is: can we prove what is running in production, who reviewed it, which controls verified it, and how quickly we can stop or reverse a bad change?

---

## Trusted Delivery Control Plane

A staff-level delivery system has five contracts.

```text
source control -> CI -> artifact registry -> GitOps state -> runtime admission
```

| Layer | Contract |
|---|---|
| Source control | Reviewed changes on protected branches |
| CI | Deterministic build from reviewed source |
| Registry | Immutable artifact storage and metadata |
| GitOps repo | Desired runtime state per environment |
| Runtime platform | Only approved artifacts and manifests are admitted |

If one layer cannot prove its contract, the delivery chain is weak.

---

## Source-To-Production Traceability

A strong answer to “what is running in production?” should include:

- Git commit SHA
- Pull request and reviewer history
- CI run identifier
- Artifact digest
- Scan result
- Signature or attestation
- GitOps commit that promoted the artifact
- ArgoCD sync history
- Kubernetes audit event or deployment revision

Production should run an artifact produced by CI from reviewed source, not a locally built image or a mutable tag.

---

## Immutable Tags And Digest Pinning

Mutable tags are convenient but risky.

Bad:

```yaml
image: registry.example.com/myapp:latest
```

Better:

```yaml
image: registry.example.com/myapp:2026-05-17-abc123
```

Best for high assurance:

```yaml
image: registry.example.com/myapp@sha256:111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000
```

Digest pinning makes rollback and audit reliable because the image reference cannot silently move.

---

## Artifact Metadata

An expert pipeline attaches metadata to every artifact:

| Metadata | Why it matters |
|---|---|
| Commit SHA | Links runtime back to source |
| Build URL | Links artifact to CI execution |
| SBOM | Identifies dependencies inside the artifact |
| Scan summary | Shows known risk at promotion time |
| Signature | Shows artifact was produced by the expected builder |
| Deployment environment | Shows where it was promoted |

Example OCI labels:

```dockerfile
LABEL org.opencontainers.image.revision=$GIT_SHA
LABEL org.opencontainers.image.source="https://github.com/org/repo"
LABEL org.opencontainers.image.created=$BUILD_TIME
```

---

## OIDC And Short-Lived Build Identity

Static keys in CI age badly. They leak, get copied, and are hard to rotate. A better pattern is workload identity federation: the CI provider proves workflow identity to the cloud provider and receives short-lived permissions for the specific job.

GitHub Actions example shape:

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure cloud identity
        run: echo "exchange workflow identity for short-lived cloud access"
```

Design rules:

- Scope identity to repository, branch, workflow, and environment.
- Separate build permissions from deploy permissions.
- Do not allow pull requests from unknown forks to access privileged contexts.
- Log every promotion event.

---

## Multi-Tenant CI Platform Design

A multi-tenant CI platform has different trust tiers.

| Tier | Example workload | Isolation pattern |
|---|---|---|
| Low trust | External PR or fork build | No privileged contexts, isolated runner pool |
| Medium trust | Internal team CI | Namespace or project isolation, scoped caches |
| High trust | Production promotion | Dedicated runner pool, approval gate, audited actions |

A namespace alone is not a full isolation boundary. For high-risk workloads, use separate node pools, separate projects/accounts, or separate clusters.

Design controls:

- Ephemeral workspaces
- No shared mutable build directories
- Clear cache boundaries
- Restricted network egress
- Separate production promotion workers
- Logs retained for audit

---

## GitOps At Expert Level

GitOps is not just “ArgoCD applies YAML.” It is a reconciliation model.

```text
Git desired state <-> runtime actual state
```

Expert design questions:

1. Which repo owns desired state?
2. Who can approve environment changes?
3. How do emergency runtime changes get backported to Git?
4. Which fields are ignored because controllers mutate them?
5. How is drift surfaced and routed?
6. What is the rollback path: Argo rollback or Git revert?

Manual changes can be useful during incidents, but if the GitOps controller self-heals, manual changes may disappear. The long-term fix must be committed to Git.

---

## Progressive Delivery With Automated Judgment

A progressive delivery controller should decide promotion based on observed health, not time alone.

```text
set 5% traffic
  -> wait
  -> query metrics
  -> continue or abort
```

Useful gates:

- HTTP 5xx rate
- Request latency percentile
- Pod restart rate
- Saturation metrics
- Queue lag
- Business transaction success

Prometheus-style signals:

```promql
sum(rate(http_requests_total{status=~"5..",version="canary"}[5m]))
/
sum(rate(http_requests_total{version="canary"}[5m]))
```

A canary should fail closed. If metrics are missing or the query is broken, do not silently promote.

---

## Delivery Platform SLIs

Your delivery platform is itself a reliability dependency.

Track:

| SLI | Why it matters |
|---|---|
| CI success rate excluding app failures | Platform health |
| P95 queue time | Runner capacity |
| P95 build duration | Developer productivity |
| Deployment duration | Release reliability |
| Rollback duration | Incident response |
| ArgoCD OutOfSync age | Drift risk |
| Flaky-test rate | Trust erosion |
| Shadow pipeline count | Platform adoption failure |

When teams create unofficial pipelines, the golden path is probably too slow, too limited, or too painful.

---

## Expert Failure Modes

### Wrong Artifact Deployed

Likely causes:

- Mutable tag reused
- Build happened outside CI
- Staging and production rebuilt separately
- Promotion updated the wrong environment overlay

Prevention:

- Use digest pinning
- Attach metadata
- Promote by digest
- Require diff review for production overlays

### Delivery Control Broke All Teams

Likely causes:

- Shared Jenkins library changed without canary adoption
- Reusable GitHub workflow changed with breaking inputs
- Global runner image updated without test cohort

Prevention:

- Version shared libraries
- Canary pipeline changes with one or two services
- Maintain rollback for runner images
- Publish migration guides

### GitOps Reverted Manual Hotfix

Cause:

- Runtime actual state differed from Git desired state
- Controller self-healed the manual change

Fix:

- Commit the fix to Git
- Use documented break-glass flow only for emergency mitigation
- Review why normal promotion was too slow

---

## Expert Takeaways

1. Trusted delivery requires traceability from source to runtime.
2. Artifact digest is stronger than image tag.
3. GitOps makes drift visible, but it also enforces discipline.
4. CI identity should be short-lived and scoped.
5. Multi-tenant CI must distinguish trust levels.
6. Delivery platform SLIs are real production SLIs.
7. Progressive delivery must use health signals, not only pauses.
8. Rollback must be rehearsed before it is needed.
