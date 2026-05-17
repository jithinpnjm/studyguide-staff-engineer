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

---

## ArgoCD CLI Full Reference

```bash
# Login
argocd login <server>
argocd login <server> --grpc-web --sso

# Application management
argocd app list
argocd app get <app>
argocd app diff <app>
argocd app diff <app> --local ./overlays/production
argocd app sync <app>
argocd app sync <app> --prune --force
argocd app sync <app> --dry-run
argocd app history <app>
argocd app rollback <app> <revision>
argocd app terminate-op <app>
argocd app delete <app>

# App actions
argocd app set <app> --sync-policy automated
argocd app set <app> --sync-policy none
argocd app set <app> --self-heal
argocd app set <app> --auto-prune
argocd app set <app> --repo <url> --revision main --path apps/myapp/overlays/production

# Wait for sync/health
argocd app wait <app> --health --timeout 120
argocd app wait <app> --sync --timeout 60

# Projects
argocd proj list
argocd proj get <project>
argocd proj create <project>
argocd proj delete <project>
argocd proj add-source <project> <repo-url>
argocd proj add-destination <project> <server> <namespace>

# Cluster management
argocd cluster list
argocd cluster add <context-name>
argocd cluster get <server>

# Repository management
argocd repo list
argocd repo add <url> --username <user> --password <pass>
argocd repo add <url> --ssh-private-key-path ~/.ssh/id_rsa

# Context and account
argocd context
argocd account list
argocd account update-password
```

---

## Flux CLI Commands

```bash
# Installation check
flux check --pre

# Bootstrap
flux bootstrap github \
  --owner=org \
  --repository=gitops-repo \
  --branch=main \
  --path=./clusters/production \
  --personal

# Source management
flux get sources git
flux get sources helm
flux reconcile source git flux-system
flux reconcile source helm <name>

# Kustomization management
flux get kustomizations
flux reconcile kustomization <name>
flux reconcile kustomization <name> --with-source
flux suspend kustomization <name>
flux resume kustomization <name>

# HelmRelease management
flux get helmreleases -A
flux reconcile helmrelease <name> -n <namespace>
flux suspend helmrelease <name> -n <namespace>
flux resume helmrelease <name> -n <namespace>

# Image automation
flux get image repositories -A
flux get image policies -A
flux reconcile image repository <name> -n <namespace>

# Logs and events
flux logs --follow
flux logs --kind=Kustomization --name=myapp
flux events

# Uninstall
flux uninstall --namespace=flux-system
```

---

## gh CLI for PRs and Actions

```bash
# Authentication
gh auth login
gh auth status

# Pull requests
gh pr list
gh pr create --title "feat: add OIDC" --body "Removes static AWS keys"
gh pr view <number>
gh pr checkout <number>
gh pr merge <number> --squash
gh pr close <number>
gh pr review <number> --approve
gh pr review <number> --request-changes --body "needs tests"

# Workflow management
gh workflow list
gh workflow run <workflow-name>
gh workflow run <workflow-name> --ref main --field environment=staging
gh workflow disable <workflow-name>
gh workflow enable <workflow-name>

# Workflow runs
gh run list
gh run list --workflow=ci.yml
gh run view <run-id>
gh run view <run-id> --log
gh run rerun <run-id>
gh run cancel <run-id>
gh run watch <run-id>

# Secrets management
gh secret list
gh secret set MY_SECRET
gh secret set MY_SECRET --body "value"
gh secret set MY_SECRET --env production
gh secret delete MY_SECRET

# Repos
gh repo view
gh repo clone org/repo
gh repo create org/new-repo --private
```

---

## git bisect Workflow

`git bisect` uses binary search to find the commit that introduced a bug.

```bash
# Start bisect session
git bisect start

# Mark the current state as bad
git bisect bad

# Mark a known-good commit (tag, SHA, or relative ref)
git bisect good v1.4.0

# Git checks out the midpoint commit
# Test it, then mark it
git bisect good     # if the bug is NOT present
git bisect bad      # if the bug IS present

# Git narrows down and checks out the next midpoint
# Continue until Git identifies the first bad commit

# End bisect and return to original HEAD
git bisect reset

# Automated bisect with a test script
git bisect start
git bisect bad HEAD
git bisect good v1.4.0
git bisect run ./test-for-bug.sh
# Git automatically marks commits based on exit code (0=good, non-0=bad)
```

---

## git reflog Recovery

```bash
# View HEAD movement history
git reflog

# Output example:
# abc1234 HEAD@{0}: commit: Add OIDC config
# def5678 HEAD@{1}: rebase finished: returning to refs/heads/main
# ghi9012 HEAD@{2}: commit: Update pipeline
# jkl3456 HEAD@{3}: reset: moving to HEAD~2

# Recover a lost commit
git switch -c rescue-branch HEAD@{3}

# Recover after a bad rebase
git reflog
git reset --hard HEAD@{4}    # go back to before the rebase

# Recover a deleted branch
git reflog --all | grep 'feature/my-branch'
git checkout -b feature/my-branch <sha>

# Show reflog for a specific branch
git reflog show main
git reflog show origin/main
```

---

## Jenkins CLI and REST API

```bash
# Download Jenkins CLI jar
curl -o jenkins-cli.jar http://JENKINS_URL/jnlpJars/jenkins-cli.jar

# List jobs
java -jar jenkins-cli.jar -s http://JENKINS_URL -auth user:token list-jobs

# Trigger a build
java -jar jenkins-cli.jar -s http://JENKINS_URL -auth user:token \
  build myapp --wait -p BRANCH=main

# Get build log
java -jar jenkins-cli.jar -s http://JENKINS_URL -auth user:token \
  console myapp 42

# Restart Jenkins safely
java -jar jenkins-cli.jar -s http://JENKINS_URL -auth user:token safe-restart

# REST API examples
# Get all jobs
curl -u user:token http://JENKINS_URL/api/json?pretty=true

# Trigger parameterized build
curl -X POST http://JENKINS_URL/job/myapp/buildWithParameters \
  -u user:token \
  --data "BRANCH=main&ENV=staging"

# Get build status
curl -u user:token \
  http://JENKINS_URL/job/myapp/lastBuild/api/json?pretty=true

# Get build log
curl -u user:token \
  http://JENKINS_URL/job/myapp/42/consoleText

# Get all credentials (requires admin)
curl -u admin:token \
  http://JENKINS_URL/credentials/store/system/domain/_/api/json?pretty=true
```

---

## Cosign and Syft Commands Reference

```bash
# Install cosign
curl -sSfL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 \
  -o /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign

# Keyless sign (uses OIDC — works in CI environments with OIDC token)
cosign sign --yes registry.example.com/myapp@sha256:<digest>

# Sign with KMS key
cosign sign --key awskms:///alias/cosign-key registry.example.com/myapp@sha256:<digest>
cosign sign --key gcpkms://projects/PROJECT/locations/global/keyRings/KR/cryptoKeys/KEY \
  registry.example.com/myapp@sha256:<digest>

# Verify keyless (check certificate identity)
cosign verify \
  --certificate-identity-regexp "https://github.com/org/" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  registry.example.com/myapp@sha256:<digest>

# Verify with KMS key
cosign verify --key awskms:///alias/cosign-key registry.example.com/myapp@sha256:<digest>

# Generate and attach SBOM
syft registry.example.com/myapp:$TAG -o spdx-json > sbom.spdx.json
cosign attach sbom --sbom sbom.spdx.json registry.example.com/myapp@sha256:<digest>

# Attest scan results
grype sbom:sbom.spdx.json -o json > scan-results.json
cosign attest --yes \
  --predicate scan-results.json \
  --type vuln \
  registry.example.com/myapp@sha256:<digest>

# Download and verify attestation
cosign verify-attestation \
  --type vuln \
  --certificate-identity-regexp "https://github.com/org/" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  registry.example.com/myapp@sha256:<digest> | jq .payload | base64 -d | jq .

# Find image digest from tag
crane digest registry.example.com/myapp:$TAG
docker buildx imagetools inspect registry.example.com/myapp:$TAG --format "{{.Manifest.Digest}}"
```

```bash
# Install Syft
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# Generate SBOM from image
syft registry.example.com/myapp:$TAG -o spdx-json
syft registry.example.com/myapp:$TAG -o cyclonedx-json
syft registry.example.com/myapp:$TAG -o table

# Generate SBOM from directory
syft dir:./src -o spdx-json

# Install Grype
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Scan image
grype registry.example.com/myapp:$TAG
grype registry.example.com/myapp:$TAG --fail-on critical
grype sbom:sbom.spdx.json

# Scan directory
grype dir:.
```

---

## DORA Metrics Formulas

```text
Deployment Frequency = number of production deployments / time period

Lead Time for Changes = median(production_deploy_timestamp - commit_timestamp)
  for all commits in the period

Change Failure Rate = failed deployments / total deployments
  where failed = deployment required hotfix, rollback, or caused an incident

MTTR (Mean Time to Recover) = mean(time_resolved - time_incident_detected)
  for all production incidents in the period
```

PromQL approximations (requires deployment_events metric from your CD system):

```promql
# Deployment frequency per day (last 7 days)
sum(increase(deployment_events_total{env="production"}[7d])) / 7

# Change failure rate (last 30 days)
sum(deployment_events_total{env="production",result="failure"}[30d])
/
sum(deployment_events_total{env="production"}[30d])
* 100

# P95 lead time (if tracked as histogram)
histogram_quantile(0.95,
  sum(rate(deployment_lead_time_seconds_bucket{env="production"}[30d]))
  by (le)
)
/ 3600    # convert to hours
```

---

## Kubernetes Quick Reference for Delivery

```bash
# Rollout operations
kubectl rollout status deployment/myapp -n production
kubectl rollout history deployment/myapp -n production
kubectl rollout undo deployment/myapp -n production
kubectl rollout undo deployment/myapp -n production --to-revision=3

# Image inspection
kubectl get deploy myapp -n production \
  -o jsonpath='{.spec.template.spec.containers[0].image}'

# Get all images in a namespace
kubectl get pods -n production \
  -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u

# Force restart (pick up new secret values)
kubectl rollout restart deployment/myapp -n production

# Emergency scale (remember to commit to Git afterward)
kubectl scale deployment myapp --replicas=5 -n production

# Debug connectivity from a pod
kubectl exec -it deploy/myapp -n production -- \
  wget -qO- http://other-service.other-ns.svc.cluster.local/health

# Check resource usage
kubectl top pods -n production
kubectl top nodes
```
