---
title: "Beginner"
sidebar_position: 1
---

# CI/CD & GitOps — Beginner

CI/CD is the delivery nervous system of a modern engineering organization. It turns a source-code change into a tested, packaged, reviewed, deployable artifact. GitOps extends the same idea to runtime state: the cluster should not be configured manually; it should be reconciled from Git.

For an SRE or platform engineer, CI/CD is not only automation. It is a reliability control system. It answers four operational questions:

1. What changed?
2. Who reviewed it?
3. Which artifact was produced?
4. How do we safely promote, observe, and roll it back?

A weak pipeline only runs scripts. A strong pipeline reduces production risk.

---

## Mental Model: CI/CD As A Factory

| Delivery concept | Factory analogy | Production meaning |
|---|---|---|
| Commit | Raw material | Proposed source change |
| Pull request | Design review desk | Human review and approval |
| CI pipeline | Inspection conveyor | Automated validation |
| Artifact | Finished product | Image, binary, package, chart |
| Registry | Warehouse | Trusted artifact storage |
| Deployment | Shipping dock | Release to an environment |
| Canary | Pilot shipment | Small rollout before full release |
| Rollback | Product recall | Return to a known-good version |
| Signature | Tamper seal | Proof of artifact origin |

The key idea: validate the change, package it, store it, promote it, and observe it. Do not treat production deployment as a shell script that happens after tests.

---

## CI, CD, Continuous Delivery, And Continuous Deployment

### Continuous Integration

Continuous Integration validates every change frequently. A developer opens a pull request or pushes a commit. The CI system runs checks such as formatting, linting, unit tests, type checks, dependency scans, and build steps.

```text
format -> lint -> unit test -> build -> scan -> publish test report
```

CI should fail fast. Cheap checks should run before expensive checks. A formatting failure should not wait behind a 25-minute integration suite.

### Continuous Delivery

Continuous Delivery means every validated change is ready to deploy, but production promotion may still require approval. This is the normal mature target for many teams because it balances automation with governance.

### Continuous Deployment

Continuous Deployment means every validated change automatically reaches production. This requires mature test coverage, progressive rollout, observability, and rollback discipline.

---

## Pipeline Anatomy

A healthy delivery path looks like this:

```text
Pull request
  -> lint
  -> unit tests
  -> build artifact
  -> scan artifact
  -> publish artifact
  -> deploy staging
  -> smoke test
  -> approval
  -> deploy production
  -> observe SLOs
```

Key rules:

- Build once, promote many.
- Use the same artifact across environments.
- Fail early, fail clearly.
- Keep production write access narrow.
- Make rollback faster than investigation.

---

## Artifacts

An artifact is the deployable output of CI.

Examples:

- Container image
- Java JAR or WAR
- Go binary
- Python wheel
- Helm chart
- Static site build
- Terraform plan output

Good artifacts are immutable, versioned, traceable to a Git commit, reproducible, scanned, and stored in a trusted registry.

Bad pattern:

```text
build in staging -> rebuild in prod -> hope both builds are identical
```

Good pattern:

```text
build once -> tag with git SHA -> promote same digest through environments
```

---

## Git Fundamentals

Git is more than version control. In platform work, Git is the audit trail for infrastructure, CI workflows, Kubernetes manifests, dashboards, alert rules, and runbooks.

Daily safe workflow:

```bash
git status
git diff
git add <file>
git diff --staged
git commit -m "Describe the intent clearly"
git push
```

Use `git status` constantly. It is your cockpit panel.

Repository setup:

```bash
git --version
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git clone <repo-url>
git remote -v
```

History and diff:

```bash
git log --oneline
git log --graph --decorate --all
git show <commit-sha>
git diff
git diff --staged
git blame <file>
```

A commit message should explain intent, not only mechanics.

```text
Weak: update files
Strong: Increase readiness timeout after startup latency regression
```

---

## Branches And Pull Requests

Branches let you work safely without changing the main line immediately.

```bash
git branch
git checkout -b feature/add-ci
git push -u origin feature/add-ci
```

A good pull request explains:

- What changed
- Why it changed
- How it was tested
- Blast radius
- Rollback plan

For infrastructure and delivery changes, blast radius matters as much as code quality.

---

## Merge, Rebase, Revert, Reset

Merge preserves branch history:

```bash
git checkout main
git merge feature/add-ci
```

Rebase replays your commits on top of a new base:

```bash
git checkout feature/add-ci
git fetch origin
git rebase origin/main
```

Revert creates a new commit that undoes an old commit. It is safe for shared branches:

```bash
git revert <commit-sha>
```

Reset moves your local branch pointer:

```bash
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
```

Use reset carefully. Prefer revert on shared branches.

---

## Beginner GitHub Actions

GitHub Actions uses workflows stored in `.github/workflows/`.

| Concept | Meaning |
|---|---|
| Workflow | Full automation definition |
| Event | Trigger such as push, pull request, schedule, manual run |
| Job | Group of steps executed on a runner |
| Step | One command or action invocation |
| Runner | Machine that executes the job |
| Action | Reusable workflow component |
| Secret | Encrypted value stored in repository or organization settings |

Simple Node.js CI:

```yaml
name: Node CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
```

---

## Beginner Jenkins

Jenkins is a self-hosted automation server. It is common in enterprises because it is flexible, mature, plugin-rich, and works in private networks.

```text
Controller -> build queue -> agent -> workspace -> artifact
```

Minimal Jenkinsfile:

```groovy
pipeline {
  agent any

  stages {
    stage('Build') {
      steps {
        sh 'mvn clean package'
      }
    }
    stage('Test') {
      steps {
        sh 'mvn test'
      }
    }
  }
}
```

Do not run production builds on the controller. Use agents, preferably ephemeral agents.

---

## Beginner Azure DevOps

Azure DevOps provides Repos, Pipelines, Boards, Artifacts, and Test Plans.

| Component | Purpose |
|---|---|
| Azure Repos | Git or TFVC version control |
| Azure Pipelines | CI/CD automation |
| Azure Artifacts | Package storage |
| Azure Boards | Work tracking |
| Azure Test Plans | Manual and exploratory testing |

Simple Azure Pipeline:

```yaml
trigger:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

steps:
  - script: echo "Building the project"
  - script: echo "Running tests"
```

---

## What Is GitOps?

GitOps uses Git as the source of truth for runtime state. Instead of a CI system directly applying manifests to the cluster, a controller inside the cluster pulls desired state from Git and reconciles the cluster.

Traditional push-based deployment:

```text
CI pipeline -> kubectl/helm -> cluster
```

GitOps pull-based deployment:

```text
CI builds image -> updates GitOps repo -> ArgoCD/Flux pulls -> cluster
```

Benefits include Git audit trail, drift visibility, rollback by Git revert, reduced need for cluster credentials in CI, and declarative runtime state.

---

## Beginner ArgoCD

ArgoCD compares desired state in Git with actual state in Kubernetes.

| State | Meaning |
|---|---|
| Synced | Cluster matches Git |
| OutOfSync | Cluster differs from Git |
| Healthy | Kubernetes resources are functioning |
| Degraded | Resource health is failing |

Basic ArgoCD Application:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/gitops-repo
    path: apps/myapp/overlays/staging
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: myapp
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

`prune: true` removes resources deleted from Git. `selfHeal: true` reverts manual cluster drift.

---

## Beginner Takeaways

1. CI validates changes.
2. CD promotes validated artifacts.
3. GitOps reconciles runtime state from Git.
4. Build once and promote the same artifact.
5. Use Git as audit trail and rollback path.
6. Use pull requests for review and blast-radius control.
7. Canary without observability is only delayed failure.
8. Rollback must be designed before the incident.
9. Slow pipelines create bypass culture.
