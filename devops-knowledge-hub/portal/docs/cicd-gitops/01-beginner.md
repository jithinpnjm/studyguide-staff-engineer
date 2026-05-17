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

---

## Git Internal Object Model

Git stores four object types. Understanding them explains why Git behaves the way it does.

| Object | What it stores | How to inspect |
|---|---|---|
| blob | File contents | `git cat-file -p <blob-sha>` |
| tree | Directory listing (names + blob/tree references) | `git ls-tree HEAD` |
| commit | Author, timestamp, parent SHA, root tree SHA, message | `git cat-file -p HEAD` |
| tag | Annotated pointer to any object | `git tag -v v1.0.0` |

Every object is content-addressed: the SHA is derived from the content. If any byte changes, the SHA changes. This is why Git guarantees integrity.

```bash
# Inspect the raw objects
git cat-file -t HEAD               # prints "commit"
git cat-file -p HEAD               # full commit object
git ls-tree HEAD                   # root tree of HEAD
git cat-file -p HEAD:src/app.py    # blob for a specific file
```

Refs are human-readable names that point to commits:

```bash
cat .git/HEAD                     # usually "ref: refs/heads/main"
cat .git/refs/heads/main          # the SHA that main points to
git show-ref                      # all refs
```

HEAD is the current position. When you commit, HEAD's branch advances. When HEAD is detached, it points directly to a SHA, not a branch name.

---

## Branching Strategy Comparison

| Strategy | Description | Best for | Risks |
|---|---|---|---|
| Trunk-based | All devs commit directly or via short-lived branches to main | High-frequency releases, feature flags mature | Requires strong test coverage and feature flag discipline |
| GitHub Flow | Feature branches off main, PR to main, deploy main | Small teams, frequent deploys | Requires CI reliability; merge can break main without protection |
| Gitflow | Separate develop, release, hotfix, feature branches | Release-cycle-driven products, versioned libraries | Complex branching; long-lived branches cause merge conflicts |
| Release branching | Feature branches + per-release stabilization branches | Enterprise products with separate release trains | High maintenance overhead |

For SRE and platform teams: trunk-based development with feature flags reduces merge conflict risk and keeps the main branch always deployable. Gitflow is common in enterprises with fixed release windows.

---

## Webhook-Based vs Polling-Based CI Triggers

| Method | How it works | Latency | Drawbacks |
|---|---|---|---|
| Webhook push | Source host sends HTTP POST to CI on push | Near-instant | CI server must be reachable from the internet; must validate payloads |
| Polling | CI checks the repo on a schedule | Minutes | Delay between commit and CI start; extra API calls |
| Hybrid | Webhook primary; polling fallback | Effectively instant | Needs both webhook and schedule config |

GitHub Actions and Azure DevOps use webhooks by default. Jenkins uses webhooks or polling depending on configuration. For private Jenkins in an air-gapped network, polling or a reverse tunnel is common.

```bash
# Validate webhook payload signature (GitHub HMAC)
# Jenkins: configure GitHub Plugin with webhook secret
# GitHub Actions: native, no config needed — event is delivered to runner
```

---

## Concrete Jenkinsfile: Full CI/CD Pipeline

This example covers Checkout, Build (Maven), Test, Docker build, Docker push, and Deploy to staging:

```groovy
pipeline {
  agent { label 'linux' }

  environment {
    IMAGE_NAME = "registry.example.com/myapp"
    IMAGE_TAG  = "${GIT_COMMIT[0..7]}"
    REGISTRY_CREDS = credentials('docker-registry-creds')
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '30'))
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git log -1 --oneline'
      }
    }

    stage('Build') {
      steps {
        sh 'mvn clean package -DskipTests -q'
        sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
      }
    }

    stage('Test') {
      steps {
        sh 'mvn test -q'
      }
      post {
        always {
          junit 'target/surefire-reports/*.xml'
          jacoco execPattern: 'target/*.exec'
        }
      }
    }

    stage('Security Scan') {
      steps {
        sh "trivy image --severity HIGH,CRITICAL --exit-code 1 ${IMAGE_NAME}:${IMAGE_TAG}"
      }
    }

    stage('Push') {
      when { branch 'main' }
      steps {
        sh """
          echo "\${REGISTRY_CREDS_PSW}" | docker login registry.example.com \
            -u "\${REGISTRY_CREDS_USR}" --password-stdin
          docker push ${IMAGE_NAME}:${IMAGE_TAG}
          docker push ${IMAGE_NAME}:latest
        """
      }
    }

    stage('Deploy Staging') {
      when { branch 'main' }
      steps {
        sh """
          yq -i ".image.tag = \\"${IMAGE_TAG}\\"" \
            gitops/overlays/staging/values.yaml
          git -C gitops add .
          git -C gitops commit -m "deploy myapp ${IMAGE_TAG} to staging"
          git -C gitops push
        """
      }
    }
  }

  post {
    failure {
      slackSend channel: '#ci-alerts', message: "FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
    }
    success {
      slackSend channel: '#ci-alerts', message: "PASSED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
    }
    always {
      cleanWs()
    }
  }
}
```

---

## Complete GitHub Actions CI/CD Workflow

A full working workflow for a Node/Docker project with checkout, test, Docker build, push, Trivy scan, and staging deploy step:

```yaml
name: CI/CD

on:
  pull_request:
  push:
    branches:
      - main

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to container registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build image
        run: |
          docker build \
            --label "org.opencontainers.image.revision=${{ github.sha }}" \
            -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
            .

      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          severity: CRITICAL
          exit-code: '1'
          format: table

      - name: Push image
        run: |
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - uses: actions/checkout@v4
        with:
          repository: org/gitops-repo
          token: ${{ secrets.GITOPS_TOKEN }}
          path: gitops

      - name: Update staging image tag
        run: |
          yq -i ".image.tag = \"${{ github.sha }}\"" \
            gitops/apps/myapp/overlays/staging/values.yaml
          cd gitops
          git config user.email "ci@example.com"
          git config user.name "CI Bot"
          git add .
          git commit -m "deploy myapp ${{ github.sha }} to staging"
          git push
```

---

## ArgoCD Application with Auto-Sync, Self-Heal, and AppProject

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: platform
  namespace: argocd
spec:
  description: Platform team applications
  sourceRepos:
    - 'https://github.com/org/gitops-repo'
  destinations:
    - namespace: 'myapp-*'
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
  namespaceResourceBlacklist:
    - group: ''
      kind: ResourceQuota
---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-staging
  namespace: argocd
  labels:
    environment: staging
    team: platform
spec:
  project: platform
  source:
    repoURL: https://github.com/org/gitops-repo
    path: apps/myapp/overlays/staging
    targetRevision: HEAD
    kustomize:
      images:
        - registry.example.com/myapp:latest
  destination:
    server: https://kubernetes.default.svc
    namespace: myapp-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas     # HPA manages replicas; ignore ArgoCD diff
```

`selfHeal: true` restores Git state when manual edits are detected. `ignoreDifferences` prevents HPA-managed replica counts from causing false OutOfSync alerts.

---

## Memory Palace: CI/CD As A Factory

The SRE framing:

| Concept | Factory analogy | Real meaning |
|---|---|---|
| Commit | Raw material | Proposed change |
| Pull Request | Design review desk | Human review |
| CI Pipeline | Inspection conveyor | Automated validation |
| Artifact | Finished product | Image/binary/package/chart |
| Registry | Warehouse | Artifact storage |
| Deploy | Shipping dock | Release to environment |
| Canary | Pilot shipment | Small rollout first |
| Blue-Green | Two warehouses | Fast traffic switch |
| Rollback | Product recall | Restore safe version |
| Signature | Tamper seal | Artifact trust proof |
