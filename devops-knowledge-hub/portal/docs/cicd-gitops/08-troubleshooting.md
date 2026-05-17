---
title: "Troubleshooting"
sidebar_position: 8
---

# CI/CD & GitOps — Troubleshooting

Delivery troubleshooting is about locating the broken layer before taking action.

```text
Git -> CI -> artifact -> registry -> GitOps repo -> ArgoCD -> Kubernetes -> application
```

---

## First Questions

1. What changed recently?
2. Did CI finish?
3. Was an artifact produced?
4. Was the environment repository updated?
5. Did ArgoCD sync?
6. Did Kubernetes create healthy pods?
7. Did application metrics change?
8. Is rollback safe?

---

## Layer Checklist

| Layer | What to inspect |
|---|---|
| Git | Commit diff, branch, merge history |
| CI | Workflow logs, runner capacity, test reports |
| Artifact | Image tag, image digest, registry entry |
| GitOps | Overlay, values file, application path |
| ArgoCD | App status, diff, sync history |
| Kubernetes | Deployment, ReplicaSet, Pod events |
| App | Logs, metrics, dependency behavior |

---

## Useful Commands

```bash
git log --oneline --graph -10
git show --stat HEAD
git diff HEAD~1..HEAD
```

```bash
argocd app get myapp
argocd app diff myapp
argocd app history myapp
```

```bash
kubectl rollout status deployment/myapp -n production
kubectl rollout history deployment/myapp -n production
kubectl describe deployment/myapp -n production
kubectl get pods -n production
kubectl get events -n production --sort-by=.lastTimestamp
```

---

## Common Patterns

### CI problem

Look at workflow logs, runner labels, dependency caches, tool versions, and shared workflow changes.

### Artifact problem

Confirm the tag or digest exists in the registry and that the deployment references the same value.

### GitOps problem

Confirm the correct environment overlay changed and that ArgoCD watches the same branch and path.

### Kubernetes rollout problem

Inspect Deployment status, ReplicaSets, Pods, probe results, and events.

### Application regression

Compare metrics and logs between old and new versions. Check dependencies and configuration.

---

## Rollback Notes

Rollback works only if the previous artifact, configuration, and database schema are still compatible.

Good release design keeps old artifacts available, uses backward-compatible database migrations, and practices rollback before incidents.

---

## Final Rule

Be precise when describing the issue:

```text
CI did not finish.
The artifact was not produced.
The environment repo was not updated.
ArgoCD did not sync.
Kubernetes did not complete the rollout.
The app rolled out but behaved incorrectly.
```

Each sentence points to a different owner, dashboard, and log source.
