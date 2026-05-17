---
title: "Hands-On Labs"
sidebar_position: 5
---

# CI/CD & GitOps — Hands-On Labs

These labs are designed to be executable and interview-useful. They progress from Git workflow basics to GitOps promotion, quality gates, progressive delivery, and rollback drills.

---

## Lab 1: Git Workflow With Safe Rollback

**Goal:** Practice feature branch workflow, PR-ready commits, and safe rollback with `git revert`.

### Step 1 — Create a repository and feature branch

```bash
mkdir delivery-lab
cd delivery-lab
git init
git config user.name "SRE Student"
git config user.email "sre@example.com"
echo "v1" > app.txt
git add app.txt
git commit -m "Initial application version"
git checkout -b feature/change-message
```

### Step 2 — Make a focused change

```bash
echo "v2" > app.txt
git diff
git add app.txt
git commit -m "Update application message to v2"
```

### Step 3 — Simulate merge to main

```bash
git checkout main
git merge feature/change-message
git log --oneline --graph --decorate --all
```

### Step 4 — Roll back safely

```bash
git revert HEAD
git log --oneline
cat app.txt
```

**Interview takeaway:** on shared branches, prefer `git revert` because it preserves history and creates an auditable undo commit.

---

## Lab 2: GitHub Actions CI For A Node Service

**Goal:** Create a basic CI workflow with dependency install, test execution, and artifact upload.

```bash
mkdir gha-node-ci
cd gha-node-ci
npm init -y
npm pkg set scripts.test="node test.js"
echo "console.log('test ok')" > test.js
mkdir -p .github/workflows
```

```yaml
# .github/workflows/ci.yml
name: Node CI

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
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm test
      - name: Upload test artifact
        uses: actions/upload-artifact@v4
        with:
          name: test-output
          path: test.js
```

```bash
git add .
git commit -m "Add GitHub Actions CI"
git push origin main
```

**Expected result:** workflow runs on push and PR. Test output artifact appears in the workflow run.

---

## Lab 3: Jenkinsfile Build-Test-Package Pipeline

**Goal:** Create a declarative Jenkins pipeline with build, test, archive, and test report stages.

```groovy
pipeline {
  agent { label 'linux' }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build') {
      steps { sh 'mvn clean package -DskipTests' }
    }

    stage('Test') {
      steps { sh 'mvn test' }
      post {
        always { junit 'target/surefire-reports/*.xml' }
      }
    }

    stage('Archive') {
      steps { archiveArtifacts artifacts: 'target/*.jar', fingerprint: true }
    }
  }
}
```

**Validation checklist:** create a multibranch pipeline, point it to the repository, confirm Jenkinsfile detection, then confirm test reports and artifacts are visible.

---

## Lab 4: Azure Pipeline With Build And Environment Promotion

**Goal:** Define a multi-stage Azure Pipeline with build and staging deployment.

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main

stages:
- stage: Build
  displayName: Build and Test
  jobs:
  - job: BuildTest
    pool:
      vmImage: ubuntu-latest
    steps:
    - script: echo "build"
    - script: echo "test"
    - publish: $(System.DefaultWorkingDirectory)
      artifact: source-drop

- stage: DeployStaging
  displayName: Deploy Staging
  dependsOn: Build
  jobs:
  - deployment: Deploy
    environment: staging
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: source-drop
          - script: echo "deploy staging"
```

**Validation checklist:** confirm the pipeline runs on `main`, artifact is published, and the staging environment records deployment history.

---

## Lab 5: ArgoCD Application For GitOps

**Goal:** Define an ArgoCD Application that syncs an app from a GitOps repo.

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/example/gitops-repo
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

```bash
kubectl apply -f argocd-application.yaml
argocd app get myapp
argocd app diff myapp
argocd app sync myapp
```

**Expected result:** ArgoCD creates or updates resources under the target namespace and reports app health.

---

## Lab 6: GitOps Image Promotion By Updating Values

**Goal:** Simulate CI updating the GitOps repo after building an image.

```bash
export GIT_SHA=$(git rev-parse --short HEAD)
mkdir -p apps/myapp/overlays/staging
cat > apps/myapp/overlays/staging/values.yaml <<EOF
image:
  repository: registry.example.com/myapp
  tag: old
EOF

yq -i ".image.tag = \"${GIT_SHA}\"" apps/myapp/overlays/staging/values.yaml
git add apps/myapp/overlays/staging/values.yaml
git commit -m "deploy myapp ${GIT_SHA} to staging"
git diff HEAD~1..HEAD
```

**Interview takeaway:** the GitOps commit is the environment promotion event. ArgoCD applies it later.

---

## Lab 7: Add A Quality Gate Stage

**Goal:** Add a quality gate concept to a pipeline.

```yaml
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run static checks
        run: |
          echo "run lint"
          echo "run unit tests"
          echo "run code quality gate"
```

For SonarQube in Azure Pipelines, the stage shape is:

```yaml
steps:
- task: SonarQubePrepare@5
  inputs:
    SonarQube: 'SonarQube'
    scannerMode: CLI
    configMode: manual
    cliProjectKey: myapp
    cliSources: src
- script: echo "run build and sonar analysis"
- task: SonarQubePublish@5
  inputs:
    pollingTimeoutSec: '300'
```

**Expected result:** the pipeline should stop if the gate fails. A warning-only quality gate is not a real gate.

---

## Lab 8: Rollout And Rollback Drill

**Goal:** Practice deployment status, history, and rollback.

```bash
kubectl create namespace rollout-lab
kubectl create deployment web --image=nginx:1.25 -n rollout-lab
kubectl rollout status deployment/web -n rollout-lab
kubectl set image deployment/web nginx=nginx:1.26 -n rollout-lab
kubectl rollout status deployment/web -n rollout-lab
kubectl rollout history deployment/web -n rollout-lab
kubectl rollout undo deployment/web -n rollout-lab
kubectl rollout status deployment/web -n rollout-lab
```

Inspect the deployed image:

```bash
kubectl get deploy web -n rollout-lab -o jsonpath='{.spec.template.spec.containers[0].image}'
echo
```

**Expected result:** rollback returns the Deployment to the previous ReplicaSet template.

---

## Lab 9: ArgoCD Drift And Self-Heal Drill

**Goal:** Understand why manual changes disappear under GitOps.

```bash
argocd app get myapp
kubectl scale deployment myapp --replicas=10 -n myapp
argocd app diff myapp
argocd app sync myapp
kubectl get deploy myapp -n myapp
```

If self-heal is enabled, ArgoCD may automatically restore the replica count from Git.

**Interview takeaway:** GitOps drift is not a bug. It is the reconciliation model doing its job. Emergency runtime changes must be backported into Git.

---

## Lab 10: Delivery Platform Health Dashboard Queries

**Goal:** Define metrics that show whether delivery itself is healthy.

```promql
argocd_app_info{health_status!="Healthy"}
```

```promql
argocd_app_info{sync_status="OutOfSync"}
```

```promql
sum(rate(jenkins_builds_success_build_count_total[1h]))
/
sum(rate(jenkins_builds_total_build_count_total[1h]))
```

Dashboard panels:

- Build success rate
- Queue time
- P95 build duration
- Deployment duration
- Rollback duration
- OutOfSync age
- Failed sync count

**Production takeaway:** your delivery platform is a reliability dependency. Instrument it like one.
