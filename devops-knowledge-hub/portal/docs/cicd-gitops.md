---
title: "🔄 CI/CD & GitOps"
sidebar_position: 2
description: "Zero to hero study guide for CI/CD & GitOps — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

CI/CD is the nervous system of software delivery. A well-designed pipeline is the difference between deploying with confidence 20 times a day and deploying with dread once a sprint. GitOps extends this to infrastructure: when everything running in production is expressed as code in Git, you get audit trails, rollback, and drift detection for free.

**Business outcomes:**
- DORA metrics — elite performers deploy on demand with under 1h lead time and under 1% change failure rate; pipeline design is the primary lever
- Developer productivity — a 30-minute CI pipeline across 50 engineers = 25 hours of waiting daily; cutting to 10 minutes returns real headcount
- Blast radius reduction — canary delivery means a bad deployment affects 1% of users instead of all of them
- Compliance — immutable artifacts, signed commits, and audit logs satisfy SOC2/ISO27001 automatically

---

## Core Concepts

### What is CI/CD?

**Continuous Integration (CI):** Automates building and testing code changes. Whenever a developer commits code using a source code management tool like Git, the CI pipeline automatically triggers builds and unit tests. Bugs are found more quickly. Reduces developers' manual tasks by 20-30%.

**Continuous Delivery (CD):** Making the application available for deployment. Anytime a new build artifact is available, it is automatically placed in the desired environment.

**Continuous Deployment:** When you commit code it gets automatically tested, built, and deployed to the production server without manual intervention.

**CI/CD Pipeline:** A set of automated steps and tasks that code changes go through, from initial commit to deployment. Stages typically include:

1. Version Control — developer commits to Git
2. Build — code compiled (e.g., Java → Maven → JAR)
3. Unit Test — fast, isolated tests
4. Deploy to dev/staging — deploy and check output
5. Auto Test — Selenium or JUnit integration tests
6. Deploy to Production — if all tests pass

**Key principle:** If there is an error in code or build, the pipeline gives feedback and stops. Bugs are reported fast and rectified, making the entire development process faster.

### Pipeline Stage Architecture

```
Pre-commit hooks → CI (build/test/scan) → Registry → CD (staging) → Validation → CD (production)
```

**Pre-commit hooks** (local, sub-second):
- Linting, secret scanning (gitleaks), formatting
- Enforce with team culture — no `--no-verify`

**CI stage** (on PR/push):
1. Dependency install (cached)
2. Unit + integration tests
3. Static analysis (SonarQube, Semgrep)
4. Container image build (multi-stage Dockerfile + BuildKit)
5. Image vulnerability scan (Trivy) — fail on CRITICAL
6. Image sign (Cosign)
7. Push to registry (ECR, GCR, ACR, Harbor)
8. Update GitOps repo with new image tag

**CD stage** (triggered by Git config change):
1. ArgoCD/Flux detects config change in GitOps repo
2. Applies to staging → automated smoke tests
3. Promotion PR to production overlay (manual approval gate)
4. ArgoCD syncs to production — canary → full rollout

---

## Git and Version Control

### Git Fundamentals

```bash
# Setup
git --version
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global core.editor "vim"
git config --global init.defaultBranch main
git config --list

# Repository operations
git init                          # initialize new repo
git clone <repo_url>              # clone existing repo
git remote add origin <repo_url>  # link local to remote
git remote -v                     # list remote repositories
git remote show origin            # show details of remote

# Day-to-day workflow
git status                        # check status of changes
git add <file>                    # stage a file
git add .                         # stage all files
git add -A                        # stage all including deletions
git commit -m "message"           # commit staged files
git commit -am "message"          # add + commit in one step
git push origin <branch_name>     # push to remote
git pull origin <branch_name>     # fetch and merge
git fetch                         # download without merging

# History
git log                           # commit history
git log --oneline                 # compact one-line format
git log --graph --decorate --all  # graphical branch history
git show <commit_id>              # details of specific commit
git diff                          # unstaged changes
git diff --staged                 # staged but uncommitted changes
git blame <file>                  # who modified each line
```

### Branching

```bash
git branch                        # list all branches
git branch <branch_name>          # create new branch
git checkout <branch_name>        # switch to branch
git checkout -b <branch_name>     # create and switch in one step
git merge <branch_name>           # merge into current branch
git rebase <branch_name>          # rebase onto branch (rewrites history)
git branch -d <branch_name>       # delete branch (local)
git branch -D <branch_name>       # force delete branch (local)
git push origin <branch_name>     # push branch to remote
git push -u origin <branch_name>  # push and set upstream tracking
git tag <tagname>                 # create tag
git push origin --tags            # push all tags
```

### Undoing Changes

```bash
git restore <file>                # discard working directory changes
git restore --staged <file>       # unstage a file
git reset HEAD~1                  # undo last commit, keep changes staged
git reset --soft HEAD~1           # undo last commit, keep changes in working dir
git reset --hard HEAD~1           # undo last commit and discard changes
git revert <commit_id>            # create new commit to undo changes (safe for shared branches)
git stash                         # save uncommitted changes temporarily
git stash pop                     # apply stashed changes
git stash drop                    # remove stashed changes
git stash list                    # list all stashes
```

**Rebase vs Merge:**
- `git rebase` — rewrites history, creates linear commit history, no merge commit
- `git merge` — preserves commit history, creates a merge commit
- Rule: rebase local/feature branches before merging; never rebase shared/published branches

**Squash commits before pushing:**
```bash
git rebase -i HEAD~3              # interactively rebase last 3 commits
# In editor, mark commits as 'squash' or 's' to combine them
```

**Git stash use case:** You're in the middle of a feature and need to switch to fix a bug. Instead of committing incomplete work:
```bash
git stash                         # save current state
git checkout main
git checkout -b hotfix
# ... fix bug, commit, push ...
git checkout feature-branch
git stash pop                     # restore your work
```

### Branching Strategies

**Feature branching:** Each feature developed in a separate branch, merged back via PR.

**GitFlow:** main (production), develop (integration), feature branches, release branches, hotfix branches. Good for release-based software.

**Trunk-based development:** Short-lived branches (hours, not weeks), feature flags to hide unfinished work, continuous integration with main. This is the mental model that makes CI/CD work properly. Long-lived branches → merge conflicts → big-bang deploys → incidents.

**Branch policies (Azure Repos / GitHub):**
- Require pull request reviews (minimum 1-2 reviewers)
- Require build validation (CI must pass)
- Prevent force pushes to protected branches
- Require squash merge or linear history

---

## Jenkins

### Architecture and Concepts

Jenkins is an open-source automation server written in Java by Kohsuke Kawaguchi. It runs on Windows, Linux, and macOS. It is community-supported, free to use, and the first choice for Continuous Integration.

**Architecture: Controller/Agent**
- Controller (Master): manages jobs, scheduling, and orchestrating builds. Never run builds on the controller in production
- Agents (Minions/Slaves): execute builds on their workspace. Selected based on labels

**Workflow:**
1. Developer commits code to Git repository
2. Controller becomes aware of commit and triggers the appropriate pipeline
3. Controller distributes the build to an appropriate agent based on labels
4. Agent runs the build — Linux commands to build, test, and deploy the code

**Agent Types:**
- **Permanent Agent:** Dedicated standalone Linux/Windows servers. Requires Java installed and SSH setup for controller communication. Necessary tools must be installed on the servers
- **Cloud Agents (Ephemeral):** More popular in the real world. Dynamic agents spun up on demand based on agent template. Examples: Docker, Kubernetes, AWS Fleet Manager

**Build Types:**
- **Freestyle Project:** Simplest method. UI and plugin managed. Mostly set up to execute a shell script
- **Pipeline:** Uses Groovy syntax. Broken into stages: Clone → Build → Test → Package → Deploy. Defined in a `Jenkinsfile` in the repository

### Jenkins Installation

**System requirements:**
- JDK 1.5 or above
- 2 GB RAM (recommended)
- Sufficient disk space for build storage
- Runs on: Windows, Ubuntu/Debian, Red Hat/Fedora/CentOS, macOS, Docker, AWS

```bash
# Ubuntu installation
sudo apt install jenkins

# Or via Docker (recommended for new setups):
docker run -d -p 8080:8080 jenkins/jenkins:lts-jdk17

# Access Jenkins container
docker exec -it <container_id> /bin/bash

# Get initial admin password
cat /var/jenkins_home/secrets/initialAdminPassword

# Start Jenkins WAR file directly
java -jar jenkins.war
```

**Suggested plugins to install:**
- Git (source code integration)
- Maven 2 Project
- HTML Publisher (publishing HTML test reports)
- Pipeline
- Blue Ocean (modern UI)
- Role-Based Authorization Strategy (RBAC)
- Amazon EC2 (for cloud agents)

### Jenkinsfile — Declarative Pipeline

```groovy
pipeline {
  agent { label 'linux' }

  environment {
    DOCKER_IMAGE = "myapp:${env.GIT_COMMIT}"
    REGISTRY = "123456789.dkr.ecr.us-east-1.amazonaws.com"
  }

  stages {
    stage('Clone') {
      steps {
        checkout scm
      }
    }

    stage('Build') {
      steps {
        sh 'mvn clean package -DskipTests'
        // Or for Docker:
        sh "docker build -t ${DOCKER_IMAGE} ."
      }
    }

    stage('Test') {
      steps {
        sh 'mvn test'
      }
      post {
        always {
          junit 'target/surefire-reports/*.xml'   // publish test results
        }
      }
    }

    stage('Security Scan') {
      steps {
        sh "trivy image ${DOCKER_IMAGE} --exit-code 1 --severity CRITICAL"
      }
    }

    stage('Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'ecr-creds',
                         usernameVariable: 'USER', passwordVariable: 'PASS')]) {
          sh "docker push ${REGISTRY}/${DOCKER_IMAGE}"
        }
      }
    }

    stage('Deploy Staging') {
      steps {
        sh "helm upgrade --install myapp ./chart --set image.tag=${env.GIT_COMMIT} --namespace staging"
      }
    }

    stage('Deploy Production') {
      when { branch 'main' }
      input { message 'Deploy to production?' }
      steps {
        sh "helm upgrade --install myapp ./chart --set image.tag=${env.GIT_COMMIT} --namespace prod"
      }
    }
  }

  post {
    success {
      slackSend channel: '#deployments', message: "SUCCESS: ${env.JOB_NAME} ${env.BUILD_URL}"
    }
    failure {
      slackSend channel: '#alerts', message: "FAILED: ${env.JOB_NAME} ${env.BUILD_URL}"
    }
  }
}
```

**Handling intermittent failures with retry:**
```groovy
stage('Flaky Tests') {
  steps {
    retry(3) {
      sh './run-tests.sh'
    }
  }
}

// Graceful failure handling:
stage('Optional Scan') {
  steps {
    catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
      sh './optional-scan.sh'
    }
  }
}
```

### Jenkins Security

**Secure credentials:**
```groovy
// Store secrets in Jenkins Credentials plugin, access with withCredentials:
withCredentials([string(credentialsId: 'api-key', variable: 'API_KEY')]) {
  sh "curl -H 'Authorization: Bearer ${API_KEY}' https://api.example.com"
}
```

**RBAC with Role-Based Authorization Strategy plugin:**
- Define roles: Admin, Developer, Viewer
- Admin: full access; Developer: build and configure jobs; Viewer: read only
- Use folder-based multi-tenancy to isolate pipelines per team

**Enforce branch policies:**
- Use Multibranch Pipelines — automatically detect new branches and create pipelines
- Configure Jenkinsfile in each branch to define pipeline behavior
- Restrict pipeline to specific branches:
```groovy
when { branch 'main' }
when { anyOf { branch 'main'; branch 'release/*' } }
```

### Jenkins Monitoring (Prometheus + Grafana)

```yaml
# prometheus.yml — scrape Jenkins metrics
scrape_configs:
  - job_name: "jenkins"
    static_configs:
      - targets:
          - "localhost:8080"
    metrics_path: /prometheus

# Run Prometheus in Docker:
docker run -d --name prometheus-container \
  -v /home/ubuntu/prometheus.yml:/etc/prometheus/prometheus.yml \
  -e TZ=UTC \
  -p 9090:9090 \
  ubuntu/prometheus:2.33-22.04_beta
```

**Required Jenkins plugins for monitoring:**
1. Prometheus Plugin — exposes Jenkins metrics at `/prometheus`
2. InfluxDB Plugin — push metrics to InfluxDB

**Jenkins scenario Q&As:**

**Q: How to scale Jenkins for high build loads?**
Use Kubernetes-based Jenkins agents that scale dynamically based on workload. Implement build queue monitoring. Use Jenkins Operations Center (CloudBees CI) for centralized management of multiple Jenkins instances.

**Q: How to design Jenkins for multiple teams?**
- Master-agent architecture where master handles scheduling, agents execute jobs
- Use distributed builds with agents on different machines or containers
- Implement folder-based multi-tenancy to isolate pipelines per team
- Secure with role-based access control (RBAC)
- Example: Team A has access to Folder A with restricted pipeline visibility

**Q: How to manage plugins for stability?**
- Maintain a list of approved plugins after testing compatibility with Jenkins version
- Regularly update plugins in staging before rolling to production
- Example: While upgrading the Git plugin, test with your pipelines in staging first

---

## GitHub Actions

GitHub's native CI/CD platform — zero infrastructure needed. YAML in `.github/workflows/`.

### Key Components

**1. Workflow:** defines the entire automation pipeline. Location: `.github/workflows/workflow-name.yml`

**2. Events (Triggers):** when a workflow runs

| Trigger | Description |
|---------|-------------|
| `push` | On code push |
| `pull_request` | When a PR is opened/synced |
| `schedule` | Cron-based (e.g., nightly builds) |
| `workflow_dispatch` | Manual trigger from GitHub UI |
| `release` | On release creation |

**3. Jobs:** group of steps executed on a runner. Jobs can run in parallel or have dependencies.

**4. Steps:** individual tasks in a job (checkout code, run tests, build image).

**5. Runners:**

| Type | OS | Notes |
|------|----|-------|
| ubuntu-latest | Linux | Most commonly used |
| windows-latest | Windows | For .NET/Windows apps |
| macos-latest | macOS | For iOS/macOS builds |
| self-hosted | Any | Custom hardware/software needs |

**6. Actions:** pre-built reusable modules. Official (GitHub), Community (published by developers), or Custom (write your own).

**7. Secrets and Variables:**
- Secrets: encrypted values stored in repo/org settings (e.g., AWS keys, Docker passwords)
- Variables: environment-specific values (region, env name, etc.)

### Real-World Workflow Examples

**Simple Node.js CI:**
```yaml
name: Node CI

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

**Docker Build and Push:**
```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USER }}
          password: ${{ secrets.DOCKER_PASS }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: myapp:${{ github.sha }}
```

**Multi-cloud CI/CD with OIDC (no long-lived keys):**
```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  packages: write
  id-token: write    # required for OIDC

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions
          aws-region: us-east-1

      - name: Build and push to ECR
        uses: docker/build-push-action@v6
        with:
          push: true
          tags: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:${{ github.sha }}
          severity: CRITICAL
          exit-code: 1
```

**Trigger only on changes to specific path:**
```yaml
on:
  push:
    paths:
      - 'nginx/**'    # only trigger when nginx folder changes
```

**Cron-based scheduled workflow:**
```yaml
on:
  schedule:
    - cron: "0 0 * * *"    # runs at midnight UTC daily
```

### Self-Hosted Runner on Kubernetes

```bash
# Step 1: Encode GitHub token
echo -n "ghp_your_generated_token" | base64

# Step 2: Update secret.yaml with encoded token
data:
  TOKEN: "your-new-base64-encoded-value"

# Step 3: Update deployment with GitHub username and repo name
- name: GITHUB_USERNAME
  value: "your-github-username"
- name: REPOSITORY_NAME
  value: "your-repo-name"

# Step 4: Deploy the runner
cd /home/setup-k8s-runner
kubectl apply -f selfthosted-runner

# Step 5: Verify runner is running
kubectl get pods
kubectl logs <runner-pod-name>

# Step 6: Verify in GitHub
# Go to Settings > Actions > Runners
# Runner should appear as active
```

### GitHub Actions Security

- Pin all action versions to SHA (not tags) — tags are mutable and can be replaced
- Use OIDC for AWS/GCP/Azure auth — never store cloud credentials as static secrets
- Ephemeral runners — no persistent state between builds
- Separate CI permissions (read + artifact push) from CD permissions (cluster write)
- Require 2+ approvers on production deployment PRs via Environments
- Audit all `.github/workflows/` changes via PR review

---

## Azure DevOps

### Core Components

| Component | Purpose |
|-----------|---------|
| Azure Repos | Version control supporting Git and TFVC |
| Azure Pipelines | CI/CD automation for build, test, deploy |
| Azure Artifacts | Package management (store/share dependencies) |
| Azure Test Plans | Testing framework |
| Azure Boards | Agile project tracking (Kanban boards, issues) |

**Azure DevOps vs GitHub:**
- Azure DevOps: enterprise-focused, deep Microsoft ecosystem integration
- GitHub: open-source and community-driven, native to open source

### Azure Pipelines — YAML Pipeline

**Pipeline triggers:**
```yaml
trigger:
  branches:
    include:
      - main
    exclude:
      - feature/*

# Or multi-stage pipeline:
trigger: [main]
```

**Agent types:**
- Microsoft-hosted: managed by Azure, fresh environment per build
- Self-hosted: installed by user for custom configurations (e.g., on AWS EC2)

```bash
# Set up self-hosted agent:
cd ~/myagent
./run.sh
```

**Multi-stage YAML pipeline:**
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

    - task: Docker@2
      inputs:
        command: buildAndPush
        repository: myapp
        tags: $(Build.SourceVersion)

    - task: SonarQubePrepare@5
      inputs:
        SonarQube: 'SonarQube'
        scannerMode: CLI

- stage: DeployStaging
  dependsOn: Build
  jobs:
  - deployment: Deploy
    environment: staging          # environment with approval gates
    strategy:
      runOnce:
        deploy:
          steps:
          - task: HelmDeploy@0
            inputs:
              command: upgrade
              chartName: myapp
              releaseName: myapp-staging
              namespace: staging

- stage: DeployProduction
  dependsOn: DeployStaging
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - deployment: Deploy
    environment: production        # requires manual approval
    strategy:
      runOnce:
        deploy:
          steps:
          - task: HelmDeploy@0
            inputs:
              command: upgrade
              chartName: myapp
              releaseName: myapp-prod
              namespace: production
```

**Secure secrets in Azure Pipelines:**
```yaml
# Use Azure Key Vault:
- task: AzureKeyVault@2
  inputs:
    azureSubscription: 'MyServiceConnection'
    KeyVaultName: 'mykeyvault'
    SecretsFilter: 'DB_PASSWORD,API_KEY'

# Use Pipeline Variables with "secret" option:
# Set in Azure DevOps UI → Pipeline → Variables → Mark as secret
- script: echo "Secret is $(MY_SECRET)"
```

### Service Connections

Service Connections allow pipelines to securely connect to external services:
- Azure Resource Manager (for deploying to Azure)
- Kubernetes (for deploying to AKS)
- Docker Registry (for pushing images to ACR)
- SonarQube (for code analysis)
- GitHub (for source code)

**Required service connections for Java app on AKS:**
1. Application Service Connection for ACR
2. Kubernetes service connection for AKS
3. SonarQube service connection

### Java Web App on AKS — Full Pipeline

From PDF: Complete deployment of Java Web App using Azure DevOps and AKS:

**Tools and Services used:**
- Build Tool: Maven
- CI/CD Tool: Azure Pipelines
- Centralized Repo: Azure Repos
- Artifact Repository: Azure Artifacts
- Code Quality: SonarQube
- Containerization: Docker
- Container Security: Trivy
- Container Registry: ACR (Azure Container Registry)
- Deployment: AKS Cluster

**Setup steps:**
1. Create Azure DevOps organization and project
2. Import code repo from GitHub
3. Configure AWS Security Group for Azure DevOps Agent and SonarQube Server
4. Set up Azure DevOps Agent on AWS EC2 (`./run.sh` to make it online)
5. Create AKS cluster and note the credentials
6. Create Azure Container Registry (ACR)
7. Create Application Service Connection; update credentials as Kubernetes secret; add role assignment
8. Create service connections for ACR, Kubernetes, and SonarQube
9. Define pipeline stages: Build → Test → Security Scan → Push → Deploy

**Pipeline stages (conceptual):**
```
Stage 1: Maven build (produces JAR artifact stored in Azure Artifacts)
Stage 2: SonarQube analysis
Stage 3: Docker build and Trivy security scan
Stage 4: Push image to ACR
Stage 5: Deploy to AKS (2 pods behind LoadBalancer service)
```

### Azure DevOps Q&As

**Q: How to implement rollback in Azure Pipelines?**
- Re-deploy the previous successful artifact
- Use App Service Slots to swap environments back
- For Kubernetes: `kubectl rollout undo deployment/myapp`

**Q: How to enforce code quality?**
- Use SonarQube for static analysis (integrate via SonarQubePrepare task)
- Enable code coverage reports in test results
- Fail pipeline if quality gate is not met

**Q: How to implement pipeline approvals?**
- Use pre-deployment approvals in **Environments**
- Navigate to Pipelines → Environments → select environment → Approvals and checks
- Add required reviewers who must approve before deployment proceeds

**Q: How to cache dependencies?**
```yaml
- task: Cache@2
  inputs:
    key: 'maven | "$(Agent.OS)" | pom.xml'
    path: $(Pipeline.Workspace)/.m2
    restoreKeys: |
      maven | "$(Agent.OS)"
      maven
```

**Q: How to monitor pipeline execution?**
- Use Logs, Azure Monitor, and Application Insights
- Set up Diagnostic Settings to push pipeline events to Log Analytics

---

## GitOps and ArgoCD

### What is GitOps?

GitOps is a paradigm for continuous delivery using Git as the single source of truth. Benefits:
1. **Declarative Descriptions:** desired state is described declaratively
2. **Version Control:** every change is tracked and auditable via Git
3. **Automated Synchronization:** tools like ArgoCD automatically sync desired Git state with actual cluster state
4. **Enhanced Collaboration:** pull request workflow for reviewing infrastructure changes

**GitOps vs Traditional CD:**

Traditional CD (push-based): Developer executes commands to move code to server. In Kubernetes, developers configure clusters using kubectl/Helm in the pipeline. The CI/CD system needs write access to the cluster.

GitOps/ArgoCD (pull-based): ArgoCD lives inside the cluster. It pulls the most recent verified version from Git and deploys it. The cluster initiates contact with Git — not the other way around. Improved security because no outbound write credentials are needed by external systems.

**Problems GitOps solves:**
1. Complexity in configuration management across multiple environments
2. Lack of consistency between dev/staging/production
3. Manual interventions for deployments (errors, inefficiencies)
4. Poor visibility into deployment state and application status

### ArgoCD Setup

```yaml
# ArgoCD Application manifest
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
    namespace: production
  syncPolicy:
    automated:
      prune: true       # delete resources removed from Git
      selfHeal: true    # revert manual kubectl changes (drift remediation)
    syncOptions:
    - CreateNamespace=true
    - ServerSideApply=true
```

**Key ArgoCD concepts:**
- **prune: true** — if you delete a resource from Git, ArgoCD deletes it from the cluster
- **selfHeal: true** — if someone manually edits a resource with `kubectl`, ArgoCD reverts it back to Git state. This is drift remediation
- **Sync Waves** — control apply order with annotation `argocd.argoproj.io/sync-wave: "0"`. Apply CRDs before CRs, Namespace before resources, DB migrations before app

**ApplicationSet — multi-cluster, multi-environment:**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: myapp-all-envs
spec:
  generators:
  - list:
      elements:
      - cluster: production
        url: https://prod.example.com
      - cluster: staging
        url: https://staging.example.com
  template:
    metadata:
      name: 'myapp-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/gitops-repo
        path: 'apps/myapp/overlays/{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: myapp
```

### Two-Repo GitOps Pattern (Recommended)

**app-repo:** source code + Dockerfile + Helm chart
**gitops-repo:** Kustomize overlays or Helm values per environment

CI writes to gitops-repo on successful build:
```bash
# After CI builds and pushes image:
yq -i ".image.tag = \"${GIT_SHA}\"" apps/myapp/overlays/staging/values.yaml
git commit -m "deploy: myapp ${GIT_SHA} to staging"
git push
# ArgoCD picks it up and deploys automatically
```

**Project overview example from PDF (Jenkins + ArgoCD):**
1. Developer commits code to GitHub app repo
2. Jenkins CI picks up the commit, builds the application image
3. Jenkins pushes image to container registry
4. Jenkins updates the GitOps repo with new image tag
5. ArgoCD detects the change in the GitOps repo (polling or webhook)
6. ArgoCD deploys the new version to Kubernetes
7. If ArgoCD detects any drift in the cluster (e.g., manual changes), it automatically re-applies the Git state

### ArgoCD Operations

```bash
# CLI commands
argocd app get myapp                    # get app status and details
argocd app diff myapp                   # what's different between Git and cluster
argocd app sync myapp                   # manually trigger a sync
argocd app rollback myapp               # rollback to previous sync
argocd app history myapp                # deployment history

# Debugging stuck sync:
argocd app get myapp                    # see error message
argocd app diff myapp                   # what's different
kubectl get events -n myapp --field-selector reason=FailedCreate   # admission webhook rejections
kubectl get policyreport -n myapp       # Kyverno policy violations
```

**Argo Rollouts — Progressive Delivery:**
```yaml
# Canary rollout strategy
strategy:
  canary:
    steps:
    - setWeight: 5               # send 5% of traffic to new version
    - pause: {duration: 10m}     # wait 10 minutes
    - analysis:
        templates:
        - templateName: success-rate   # check Prometheus metric
    - setWeight: 50              # increase to 50%
    - pause: {duration: 10m}
    - setWeight: 100             # full rollout
```

Automatic rollback if the AnalysisRun fails. Integrates with Nginx Ingress, Istio, AWS ALB for traffic splitting.

---

## SonarQube — Code Quality

**What is SonarQube?**
A code review tool that automatically detects bugs, vulnerabilities, and code smells. Analyzes 27+ programming languages. Integrates into CI/CD workflow.

**SonarQube instance components:**
1. **SonarQube Server** — web server (UI), search server (data), compute engine (processes analysis reports)
2. **Database server** — stores config and code quality metrics (PostgreSQL, SQL Server, Oracle)
3. **Scanners** — analyze projects and send results to server

**Prerequisites for SonarQube on Linux:**
```bash
# Check current values
sysctl vm.max_map_count           # must be >= 524288
sysctl fs.file-max                # must be >= 131072
ulimit -n                         # must be >= 131072 file descriptors
ulimit -u                         # must be >= 8192 threads

# Set permanently:
echo "vm.max_map_count=524288" >> /etc/sysctl.conf
echo "fs.file-max=131072" >> /etc/sysctl.conf
sudo sysctl -p

# In /etc/security/limits.conf:
sonarqube - nofile 131072
sonarqube - nproc  8192
```

**Quality Gates — pass/fail thresholds for production:**
- New code coverage >= 80%
- New duplicated lines < 3%
- Reliability rating: A (no bugs)
- Security rating: A (no vulnerabilities)
- Security hotspots reviewed: 100%

Quality Gate must be binary — warning-only gates are no gates at all.

**SonarQube integration in Azure Pipelines:**
```yaml
steps:
- task: SonarQubePrepare@5
  inputs:
    SonarQube: 'SonarQube'        # service connection name
    scannerMode: CLI
    configMode: manual
    cliProjectKey: myapp
    cliSources: src

- task: Maven@4
  inputs:
    goals: 'clean verify sonar:sonar'

- task: SonarQubePublish@5
  inputs:
    pollingTimeoutSec: '300'
```

---

## Jenkins Glossary (from PDF)

| Term | Definition |
|------|-----------|
| Jenkins | Open-source automation server for CI/CD pipelines |
| Continuous Integration | Frequently merging code and automatically building/testing |
| Continuous Delivery | Auto-deploying to production after successful testing |
| Pipeline | Series of steps code goes through in CI/CD process |
| Job | Single unit of work in Jenkins |
| Build | Compiling, packaging, and testing code |
| Artifact | Compiled and packaged code component (binary, JAR file) |
| SCM | Source Code Management (e.g., Git) |
| Branch | Separate copy of codebase for parallel development |
| Merge | Combining code changes from one branch into another |
| Pull Request | Request to merge code, usually with review process |
| Agent | Software component that runs on a separate machine to execute pipeline steps |
| Node | Physical or virtual machine that hosts agents |
| Master/Controller | Central server that coordinates pipeline execution and manages agents |
| Plugin | Software module that extends Jenkins functionality |
| Docker | Containerization platform used to package and deploy applications |
| Environment | Specific configuration (staging, production) |

---

## Tools Reference

| Tool | Purpose |
|------|---------|
| Jenkins | Self-hosted, flexible, mature CI; Groovy-based Pipelines |
| GitHub Actions | GitHub-native, zero infrastructure; YAML workflows |
| Azure DevOps | Microsoft ecosystem; integrated boards, repos, pipelines |
| ArgoCD | GitOps CD, rich UI, ApplicationSets, drift detection |
| Flux | GitOps CD, Helm-first, multi-tenancy |
| Argo Rollouts | Progressive delivery (canary/blue-green) with metric analysis |
| Tekton | Kubernetes-native CI primitives |
| SonarQube | Code quality analysis + SAST (27 languages) |
| Trivy | Container + IaC vulnerability scanning (by Aqua Security) |
| Cosign | Image signing (Sigstore) |
| gitleaks | Secret scanning, pre-commit + CI |
| Harbor | Self-hosted container registry with proxy cache |
| Nexus | Universal artifact repository |
| InfluxDB | Time-series database for Jenkins metrics |
| Grafana | Visualization for Jenkins/Prometheus metrics |

---

## Container Security with Trivy (from PDF)

Containers may contain vulnerabilities in base images or dependencies. Trivy (by Aqua Security) scans Docker images for:
- OS package vulnerabilities
- Application dependency vulnerabilities
- Misconfigurations in Dockerfiles and Kubernetes manifests
- Exposed secrets

```bash
# Scan an image
trivy image myapp:latest

# Fail pipeline on CRITICAL vulnerabilities
trivy image --exit-code 1 --severity CRITICAL myapp:latest

# Scan as part of GitHub Actions
- uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:${{ github.sha }}
    severity: CRITICAL
    exit-code: 1
```

**Supply Chain Security Architecture:**
```
Developer pushes code
  → CI builds image
  → Trivy scans (CRITICAL = fail pipeline)
  → Cosign signs image with Fulcio CA
  → Push to registry (with SBOM attestation)
  → GitOps repo updated with new tag

ArgoCD deploys to cluster:
  → Kyverno admission controller verifies Cosign signature
  → Rejects unsigned images
```

---

## Production Operations

### CI Performance Optimization

- **Parallelism:** lint, unit tests, security scan — run simultaneously
- **Docker layer caching:** order Dockerfile from least to most frequently changing layers
- **Dependency caching:** cache `node_modules`, pip packages, Go modules, Maven `.m2`
- **Selective builds:** only build services that changed (nx, Turborepo, Bazel for monorepos)
- **Target:** under 10 minutes end-to-end CI for developer feedback

### Rollback Runbook

| Tier | Rollback Method | Time |
|------|----------------|------|
| Application | ArgoCD rollback to previous sync | < 2 min |
| Application | `kubectl rollout undo deployment/myapp` | < 1 min |
| Database migration | Feature flag off + backwards-compat schema | Instant |
| Infra (Terraform) | `git revert` + `terraform apply` | 5-15 min |
| Full environment | Argo Rollouts auto-rollback on metric failure | < 5 min |

### Debugging a Stuck ArgoCD Sync

```bash
argocd app get myapp              # see error message in status
argocd app diff myapp             # what's different between Git and cluster
# Check for admission webhook rejections:
kubectl get events -n myapp --field-selector reason=FailedCreate
# Check Kyverno policy violations:
kubectl get policyreport -n myapp
# Force a sync:
argocd app sync myapp --force
```

### Pipeline Observability (PromQL)

```promql
# Jenkins build success rate
sum(rate(jenkins_builds_success_build_count_total[1h])) /
sum(rate(jenkins_builds_total_build_count_total[1h]))

# ArgoCD app health (unhealthy apps)
argocd_app_info{health_status!="Healthy"}

# ArgoCD sync status (OutOfSync = drift)
argocd_app_info{sync_status="OutOfSync"}
```

---

## Failure Modes and Incident Patterns

**Broken shared pipeline library** — all teams' pipelines fail simultaneously. Keep the library versioned; use a canary adoption pattern for breaking changes.

**Cascading deploy freeze** — flaky staging tests block all production deployments. Flaky tests are P1 priority; fix within the sprint.

**Secrets rotation break** — credentials rotated in Vault but not updated in pipeline config. Solution: use OIDC or Vault dynamic secrets to eliminate static credentials entirely.

**Drift between environments** — works in staging, fails in production. Use GitOps self-healing for both environments, production-like config in staging, infrastructure parity enforced by code.

**Agent exhaustion** — too many builds queued, no agents available. Solution: autoscale agents (K8s Pod agents, GitHub Actions larger runners). Monitor build queue depth.

---

## Interview Design Questions

**"Design a CI/CD pipeline for 30 microservices"**
- Monorepo vs polyrepo decision; selective builds (nx/Bazel for affected services only)
- Shared pipeline library (Jenkins) or reusable workflows (GitHub Actions)
- GitOps CD with ArgoCD; environment progression with approval gates
- Canary delivery with Argo Rollouts; OIDC auth; Trivy scanning; Cosign signing
- Target: < 10 minutes CI feedback per service change

**"How do you ensure a deployment doesn't break production?"**
- Pre-deploy: unit tests, SAST (SonarQube quality gate), image scan (Trivy), image signing (Cosign)
- At deploy: canary rollout with Prometheus metric analysis (error rate, p99 latency)
- Post-deploy: SLO monitoring with automated rollback on SLO breach
- Database: expand-contract pattern for schema migrations

**"What is GitOps vs traditional CD?"**
- GitOps: pull-based. Git is source of truth. Operator reconciles continuously. No outbound write credentials from CI system needed. Audit trail = Git history. Rollback = `git revert`
- Traditional CD: push-based. Pipeline writes directly to cluster/servers. Pipeline needs cluster write credentials

**"How do you handle database migrations safely?"**
Expand-contract pattern:
1. Add column nullable (no breaking change) — deploy
2. Write to both old and new column — deploy
3. Backfill existing rows — run migration
4. Read from new column only — deploy
5. Drop old column — deploy

Never break old code with a migration. Each step is a separate deployment. Feature flags can hide new code until migration is complete.

**"How to trigger a pipeline automatically in Azure DevOps?"**
```yaml
trigger:
  branches:
    include:
      - main
```
Available trigger types: Manual, Commit, Scheduled, Pipeline, Pull Request (PR).

**"How to store secrets securely in Azure Pipelines?"**
- Use Azure Key Vault with the AzureKeyVault task
- Use Pipeline Variables with the "secret" option enabled in Azure DevOps UI
- Never store secrets in YAML pipeline files or source code

**"What is a Deployment Group?"**
A collection of servers or VMs used for on-premises or non-Kubernetes deployments. The group has agents installed that receive deploy instructions from Azure Pipelines.

---

## Key Takeaways

1. **CI = Continuous Build + Continuous Test** — reduce manual work by 20-30%, find bugs faster
2. **Git is the source of truth in GitOps** — everything running in production comes from a commit in Git
3. **Pull-based over push-based** — ArgoCD pulls from Git; external CI doesn't need cluster write credentials
4. **Fail fast at the cheapest stage** — lint before test, unit before integration, scan before deploy
5. **Artifacts are immutable** — same image that passed CI goes to production; never rebuild
6. **Trunk-based development is a prerequisite** — long-lived branches make CI/CD theater
7. **OIDC eliminates long-lived secrets** — dynamic credentials via identity federation for AWS/Azure/GCP
8. **Quality Gates must be binary** — warning-only gates provide no actual protection
9. **Canary or don't deploy** — never push 100% at once; automate rollback on SLO breach
10. **Shared pipeline libraries multiply investment** — write once, all teams benefit (Jenkins) or reusable workflows (GitHub Actions)
11. **selfHeal in ArgoCD = drift remediation** — manual kubectl changes get automatically reverted
12. **Pipeline speed = developer productivity** — every minute saved times team size = real hours returned daily
13. **Separate CI and CD permissions** — read for testing, write for deploy; mixing expands blast radius
14. **Environment parity is not optional** — staging without production-like config gives false confidence
15. **Test your rollback quarterly** — rollback that's never been tested will fail when you need it most
