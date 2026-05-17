---
title: "Cheat Sheet"
sidebar_position: 6
---

# CI/CD & GitOps — Cheat Sheet

Fast recall for commands, YAML patterns, and operational checks.

---

## Git Daily Commands

```bash
git status
git diff
git diff --staged
git add <file>
git commit -m "message"
git push
git pull --rebase
```

```bash
git log --oneline --graph --decorate --all
git show <sha>
git blame <file>
git reflog
git bisect start
```

```bash
git checkout -b feature/name
git merge feature/name
git rebase origin/main
git revert <sha>
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
```

---

## Git Branching And Release Tags

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
git describe --tags
git branch -vv
git remote -v
```

Safe rollback on shared branch:

```bash
git revert <bad-commit-sha>
git push origin main
```

---

## GitHub Actions Skeletons

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "test"
```

Job dependency:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: echo "build"
```

Manual trigger:

```yaml
on:
  workflow_dispatch:
```

Scheduled trigger:

```yaml
on:
  schedule:
    - cron: "0 0 * * *"
```

Path filter:

```yaml
on:
  push:
    paths:
      - 'services/payment/**'
```

Environment promotion:

```yaml
jobs:
  deploy:
    environment: production
    runs-on: ubuntu-latest
    steps:
      - run: echo "deploy"
```

---

## Jenkins Pipeline Snippets

```groovy
pipeline {
  agent any
  stages {
    stage('Build') {
      steps { sh 'mvn clean package' }
    }
    stage('Test') {
      steps { sh 'mvn test' }
      post {
        always { junit 'target/surefire-reports/*.xml' }
      }
    }
  }
}
```

Retry transient failures:

```groovy
retry(3) {
  sh './check-transient-dependency.sh'
}
```

Archive artifact:

```groovy
archiveArtifacts artifacts: 'target/*.jar', fingerprint: true
```

Useful Jenkins checks:

```bash
df -h
free -m
java -version
docker ps
kubectl get pods -n jenkins
kubectl logs <jenkins-agent-pod> -n jenkins
```

---

## Azure Pipelines Snippets

```yaml
trigger:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

steps:
- script: echo "build"
- script: echo "test"
```

Multi-stage structure:

```yaml
stages:
- stage: Build
  jobs:
  - job: BuildJob
    steps:
    - script: echo "build"

- stage: Deploy
  dependsOn: Build
  jobs:
  - deployment: DeployJob
    environment: staging
    strategy:
      runOnce:
        deploy:
          steps:
          - script: echo "deploy"
```

Cache example:

```yaml
- task: Cache@2
  inputs:
    key: 'maven | "$(Agent.OS)" | pom.xml'
    path: $(Pipeline.Workspace)/.m2
```

SonarQube shape:

```yaml
- task: SonarQubePrepare@5
  inputs:
    SonarQube: 'SonarQube'
    scannerMode: CLI
    configMode: manual
    cliProjectKey: myapp
    cliSources: src
- task: SonarQubePublish@5
  inputs:
    pollingTimeoutSec: '300'
```

---

## ArgoCD Commands

```bash
argocd login <server>
argocd app list
argocd app get myapp
argocd app diff myapp
argocd app sync myapp
argocd app history myapp
argocd app rollback myapp <revision>
argocd app terminate-op myapp
```

Kubernetes side checks:

```bash
kubectl get deploy,rs,pods -n myapp
kubectl get events -n myapp --sort-by=.lastTimestamp
kubectl describe deploy myapp -n myapp
kubectl logs deploy/myapp -n myapp
```

---

## ArgoCD Application Template

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
    path: apps/myapp/overlays/production
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

---

## Kubernetes Rollout Commands

```bash
kubectl rollout status deployment/myapp -n production
kubectl rollout history deployment/myapp -n production
kubectl rollout undo deployment/myapp -n production
kubectl describe deployment/myapp -n production
kubectl get rs -n production
```

Update image:

```bash
kubectl set image deployment/myapp myapp=registry.example.com/myapp:v2 -n production
```

Inspect current image:

```bash
kubectl get deploy myapp -n production -o jsonpath='{.spec.template.spec.containers[0].image}'
echo
```

---

## GitOps Promotion Commands

```bash
export GIT_SHA=$(git rev-parse --short HEAD)
yq -i ".image.tag = \"${GIT_SHA}\"" apps/myapp/overlays/staging/values.yaml
git add apps/myapp/overlays/staging/values.yaml
git commit -m "deploy myapp ${GIT_SHA} to staging"
git push
```

Review environment diff:

```bash
git diff HEAD~1..HEAD
argocd app diff myapp
```

---

## Trivy Commands

```bash
trivy image myapp:latest
trivy image --severity HIGH,CRITICAL myapp:latest
trivy image --exit-code 1 --severity CRITICAL myapp:latest
trivy fs .
trivy config .
```

GitHub Actions shape:

```yaml
- uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:${{ github.sha }}
    severity: CRITICAL
    exit-code: '1'
```

---

## Cosign Commands

```bash
cosign sign registry.example.com/myapp@sha256:<digest>
cosign verify registry.example.com/myapp@sha256:<digest>
cosign triangulate registry.example.com/myapp@sha256:<digest>
```

Use digest references for strong verification.

---

## Delivery Observability PromQL

ArgoCD unhealthy apps:

```promql
argocd_app_info{health_status!="Healthy"}
```

ArgoCD drift:

```promql
argocd_app_info{sync_status="OutOfSync"}
```

Jenkins success ratio:

```promql
sum(rate(jenkins_builds_success_build_count_total[1h]))
/
sum(rate(jenkins_builds_total_build_count_total[1h]))
```

Canary error ratio:

```promql
sum(rate(http_requests_total{version="canary",status=~"5.."}[5m]))
/
sum(rate(http_requests_total{version="canary"}[5m]))
```

---

## Fast Failure Diagnosis Matrix

| Symptom | First check |
|---|---|
| CI suddenly fails for all repos | Shared runner image or shared workflow change |
| One service deploy fails | Artifact, manifest, events, readiness |
| ArgoCD OutOfSync | Manual change, controller mutation, failed sync |
| Rollout stuck | Pod events, image pull, readiness probe |
| Jenkins queue growing | Agent capacity or offline labels |
| Quality gate fails | New code coverage, duplication, bug rating |
| Wrong version running | Image tag, digest, GitOps values, rollout history |
