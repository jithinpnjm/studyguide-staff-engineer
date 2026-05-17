---
title: "Real-World Examples"
sidebar_position: 7
---

# CI/CD & GitOps — Real-World Examples

These examples show how delivery systems fail in production and how a senior SRE or platform engineer should reason about them.

---

## Example 1: Bad Deploy Caused 5xx Spike

### Scenario

A service deployment finished successfully. Ten minutes later, Grafana shows a sharp increase in HTTP 5xx errors for only the new version.

### What Happened

The pipeline was green because unit tests passed and the image built successfully. The failure was in runtime behavior: the new version had a configuration mismatch with a downstream dependency.

### Strong Response

```text
1. Correlate deploy timestamp with error spike.
2. Compare metrics by version or pod template hash.
3. Pause rollout if still progressing.
4. Roll back if confidence is high.
5. Confirm recovery.
6. Investigate root cause after mitigation.
```

Useful commands:

```bash
kubectl rollout history deployment/payment -n production
kubectl rollout undo deployment/payment -n production
kubectl rollout status deployment/payment -n production
kubectl logs deploy/payment -n production --since=15m
```

### Prevention

- Canary rollout with version-labelled metrics
- Smoke test against real dependency path
- Staging config parity
- Rollback drill before production launch

---

## Example 2: CI Passed But Production Failed

### Scenario

The build passed, image was pushed, and ArgoCD synced the application. Pods entered CrashLoopBackOff in production only.

### Likely Causes

- Environment variable exists in staging but not production
- Production Secret key name differs
- Readiness path changed but ingress health check did not
- Production-only feature flag enabled a code path not tested in staging

### Investigation

```bash
argocd app get myapp
kubectl get pods -n production
kubectl describe pod <pod> -n production
kubectl logs <pod> -n production --previous
kubectl get secret myapp-secrets -n production -o yaml
```

### Lesson

CI verifies artifact correctness. Deployment verifies environment compatibility. You need both.

---

## Example 3: Wrong Image Deployed

### Scenario

Production is running code that nobody expected. The manifest says `myapp:latest`, and the tag was overwritten by a later build.

### Root Cause

The team used a mutable image tag in production. The tag name stayed the same while the content changed.

### Better Pattern

```yaml
image: registry.example.com/myapp@sha256:111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000
```

### Operational Fix

```bash
kubectl get deploy myapp -n production -o jsonpath='{.spec.template.spec.containers[0].image}'
echo
argocd app history myapp
argocd app rollback myapp <known-good-revision>
```

### Prevention

- Use Git SHA tags or digest pinning
- Promote by digest, not mutable tag
- Attach commit and build metadata to images
- Block direct pushes to production registry paths where possible

---

## Example 4: Shared Jenkins Library Broke Every Team

### Scenario

A shared Jenkins library was updated to change a function signature. Dozens of pipelines failed on the next run.

### Root Cause

The shared library was effectively platform code, but it was released like a normal repo commit. There was no versioning, no canary adoption, and no compatibility window.

### Strong Platform Fix

- Version shared pipeline libraries
- Keep old function signatures during migration
- Test library changes against a representative pipeline set
- Canary to one or two services first
- Publish migration notes

### SRE Framing

The delivery platform is a production dependency. A change to common pipeline logic has broad blast radius.

---

## Example 5: GitOps Reverted A Manual Hotfix

### Scenario

During an incident, an engineer manually scaled a deployment from 3 to 10 replicas. A few minutes later it returned to 3.

### What Happened

ArgoCD self-heal detected drift and reconciled the cluster back to Git.

### Correct Response

```bash
argocd app get myapp
argocd app diff myapp
```

If the scale change is still required, commit it to the GitOps repo or use an approved emergency process that temporarily suspends reconciliation for the resource.

### Lesson

GitOps is doing its job. Manual runtime changes are temporary unless the desired state changes in Git.

---

## Example 6: Secret Rotation Caused Outage

### Scenario

A credential was rotated after a security finding. Within minutes, production pods started failing to access object storage.

### Failure Chain

```text
old credential revoked
  -> pods still using old value
  -> application auth failures
  -> retries increased
  -> latency rose
  -> user-facing errors
```

### Mitigation

- Restore service using the approved identity path
- Restart pods if they load values only at startup
- Confirm downstream access
- Track affected services from inventory

### Prevention

- Maintain credential ownership inventory
- Prefer workload identity over long-lived static credentials
- Test rotation in staging
- Use rotation runbooks with blast-radius check

---

## Example 7: Multi-Tenant CI Trust Boundary Failure

### Scenario

A pull request from an external contributor ran on the same self-hosted runner pool used for internal deployment jobs.

### Risk

Persistent workspaces and shared runner state can leak data between builds. Low-trust jobs must not run on high-trust workers.

### Safer Design

| Trust tier | Runner model |
|---|---|
| External PR | Ephemeral, no privileged contexts |
| Internal CI | Scoped runner pool, isolated workspaces |
| Production promotion | Dedicated controlled pool with approval |

### Lesson

CI is not just compute. It is part of your security and reliability boundary.

---

## Example 8: Pipeline Too Slow, Teams Bypass It

### Scenario

The official pipeline takes 45 minutes. Teams start using local scripts and direct deploys to save time.

### Symptoms

- Fewer changes go through the golden path
- Large batched PRs become normal
- Hotfixes bypass review
- Production changes become hard to audit

### Platform Response

```text
measure -> remove waste -> parallelize -> cache -> split fast/slow suites -> improve ownership
```

Practical improvements:

- Cache dependencies
- Split unit and integration jobs
- Run affected-service builds only
- Pre-build common base images
- Add runner autoscaling

### Lesson

Developer experience is a reliability control. Slow platforms create unsafe behavior.

---

## Example 9: ArgoCD OutOfSync For Hours

### Scenario

Several apps remain OutOfSync for half a day. Nobody is paged because user traffic is still healthy.

### Risk

Long-lived drift means the next deployment may behave unexpectedly. It also weakens the promise that Git reflects runtime state.

### Investigation

```bash
argocd app list
argocd app get myapp
argocd app diff myapp
kubectl get events -n myapp --sort-by=.lastTimestamp
```

### Common Causes

- Manual runtime edits
- Controller-mutated fields
- Missing CRDs
- Admission rejection
- Failed hooks
- Helm rendering difference

### Prevention

- Alert on OutOfSync age
- Define acceptable drift windows
- Use ignore-differences intentionally, not casually
- Route ownership by ArgoCD project or app label

---

## Example 10: Database Migration Breaks Rollback

### Scenario

The app deploy fails and rollback is attempted, but the old version no longer works because a database column was dropped.

### Root Cause

The migration was not backward compatible.

### Safer Expand-Contract Pattern

```text
1. Add nullable new column.
2. Deploy code that writes both old and new fields.
3. Backfill existing rows.
4. Deploy code that reads new field.
5. Drop old column only after old code is gone.
```

### Lesson

Rollback is not only a Kubernetes or ArgoCD operation. Data compatibility determines whether rollback actually works.

---

## Staff-Level Summary

A strong delivery platform is not measured only by successful builds. It is measured by safe change flow, artifact trust, fast detection, controlled rollout, and reliable rollback. Most delivery incidents are not tool failures; they are missing contracts between source, CI, artifact, GitOps state, runtime, and observability.
