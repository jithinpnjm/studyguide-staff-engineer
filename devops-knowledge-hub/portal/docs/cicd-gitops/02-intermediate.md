---
title: "Intermediate"
sidebar_position: 2
---

# CI/CD & GitOps — Intermediate

Intermediate CI/CD is about operating a delivery system, not only writing YAML. At this level you should understand how runners behave, how artifacts move between stages, how approvals protect releases, how GitOps controllers reconcile state, and how test strategy affects deployment confidence.

---

## Pipeline Shape For Real Teams

A production pipeline separates validation, packaging, promotion, and deployment.

```text
pull request validation
  -> build immutable artifact
  -> publish artifact
  -> update environment state
  -> deploy through controller
  -> observe health
```

The most important design rule is **build once, promote many**.

Bad pattern:

```text
build image for staging
build image again for production
```

Good pattern:

```text
build image once with git SHA
check it
publish it
promote the same digest to staging and production
```

If staging and production run different builds, staging did not test the production artifact.

---

## Test Strategy

Do not rely only on end-to-end tests. They are useful but slow, brittle, and expensive when overused.

| Test type | Purpose | Where it belongs |
|---|---|---|
| Format and lint | Cheap correctness | First CI step |
| Unit tests | Local logic | Early CI |
| Static analysis | Bug and quality signals | Early CI |
| Contract tests | API compatibility | Mid pipeline |
| Integration tests | Components together | Mid pipeline |
| End-to-end tests | User journey | Staging |
| Smoke tests | Basic deployed health | Post-deploy |
| Load tests | Capacity regression | Scheduled or gated |

A strong delivery platform runs cheap checks early and expensive checks only after the change has passed the basics.

Flaky tests are reliability defects in the delivery platform. If teams stop trusting CI, they rerun blindly, bypass checks, or batch changes into larger riskier deployments.

---

## Jenkins: Intermediate Operations

Jenkins remains common because it is flexible, self-hosted, mature, and deeply integrated into enterprise networks.

Architecture:

```text
controller -> build queue -> agent -> workspace -> artifact
```

Use the controller for scheduling and orchestration. Use agents for build execution.

| Agent type | Use case | Risk |
|---|---|---|
| Static VM agent | Stable enterprise build host | Snowflake configuration |
| Docker agent | Isolated build toolchain | Runtime exposure |
| Kubernetes pod agent | Scalable ephemeral builds | Cluster scheduling dependency |
| Cloud VM fleet | Burst capacity | Cost and startup latency |

```groovy
pipeline {
  agent { label 'linux' }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Build') {
      steps {
        sh 'mvn clean package -DskipTests'
        sh 'docker build -t myapp:${GIT_COMMIT} .'
      }
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

Use retry for transient infrastructure problems, not broken tests.

---

## GitHub Actions: Intermediate Patterns

GitHub Actions is excellent for GitHub-native teams and repository-centered workflows.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myapp:${{ github.sha }} .
```

Path-based CI is useful in monorepos:

```yaml
on:
  push:
    paths:
      - 'services/payment/**'
      - '.github/workflows/payment.yml'
```

Path filters can become dangerous if shared libraries or deployment manifests are forgotten.

---

## Azure Pipelines: Intermediate Patterns

Azure DevOps is commonly paired with Azure Repos, Azure Artifacts, AKS, ACR, Boards, and Test Plans.

```yaml
trigger:
  branches:
    include:
      - main

stages:
- stage: Build
  jobs:
  - job: BuildTest
    pool:
      vmImage: ubuntu-latest
    steps:
    - task: Maven@4
      inputs:
        goals: 'clean package'
        publishJUnitResults: true

- stage: DeployStaging
  dependsOn: Build
  jobs:
  - deployment: Deploy
    environment: staging
    strategy:
      runOnce:
        deploy:
          steps:
          - script: echo "deploy staging"
```

---

## GitOps Intermediate Design

A common production pattern uses two repositories.

```text
app-repo:
  source code
  Dockerfile
  tests
  Helm chart template

gitops-repo:
  environment overlays
  Helm values
  Kustomize patches
  ArgoCD Applications
```

CI builds the artifact and updates desired state:

```bash
yq -i ".image.tag = \"${GIT_SHA}\"" apps/myapp/overlays/staging/values.yaml
git add apps/myapp/overlays/staging/values.yaml
git commit -m "deploy myapp ${GIT_SHA} to staging"
git push
```

ArgoCD then detects the Git change and syncs the cluster.

```bash
argocd app get myapp
argocd app diff myapp
argocd app sync myapp
argocd app history myapp
argocd app rollback myapp
```

---

## Progressive Delivery

Progressive delivery increases exposure only when health remains good.

```text
5% -> pause -> metric check -> 25% -> pause -> 50% -> 100%
```

Useful promotion metrics:

- Error rate
- P95 or P99 latency
- Saturation
- Restart rate
- Business success rate

A canary without metrics is not a safety mechanism. It is only a delayed full rollout.

---

## Intermediate Takeaways

1. Build once and promote the same artifact.
2. Separate validation from deployment.
3. Use staging to validate runtime assumptions, not to rebuild artifacts.
4. Treat agents and runners as production dependencies.
5. Use GitOps for Kubernetes drift visibility and safer rollback.
6. Use environment approvals where production risk requires human judgment.
7. Keep flaky tests visible and owned.
8. Progressive delivery needs metrics, not hope.
