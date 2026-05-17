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

---

## Jenkins: Shared Libraries, Declarative vs Scripted, Credential Binding

### Jenkins Shared Libraries

Shared libraries let you centralize pipeline logic and enforce consistency across teams. Store them in a Git repo structured as:

```text
(root)
+- src/                       # Groovy source files (org.example.package classes)
+- vars/                      # Global variables/functions (available to pipelines as steps)
|   +- buildAndPush.groovy    # exposed as buildAndPush(...)
|   +- deployToEnv.groovy
+- resources/                 # Non-Groovy resource files
```

To use a shared library in a Jenkinsfile:

```groovy
@Library('my-shared-lib@main') _

pipeline {
  agent { label 'linux' }
  stages {
    stage('Build and Push') {
      steps {
        buildAndPush(
          image: "registry.example.com/myapp",
          tag: "${GIT_COMMIT[0..7]}"
        )
      }
    }
    stage('Deploy') {
      steps {
        deployToEnv(env: 'staging', tag: "${GIT_COMMIT[0..7]}")
      }
    }
  }
}
```

Register the library in Jenkins: Manage Jenkins > Configure System > Global Pipeline Libraries. Pin to a specific branch or tag. Avoid `@main` for production pipelines as it picks up every change automatically.

### Declarative vs Scripted Pipelines

| Feature | Declarative | Scripted |
|---|---|---|
| Syntax | Structured `pipeline {}` block | Full Groovy code |
| Validation | Pre-execution YAML-like validation | Runtime only |
| Complexity limit | Moderate | Unlimited |
| Readability | High (preferred for most teams) | Lower |
| When to use | Standard CI/CD | Complex dynamic pipeline logic |

Declarative example with parallel stages:

```groovy
pipeline {
  agent { label 'linux' }
  stages {
    stage('Parallel Tests') {
      parallel {
        stage('Unit') {
          steps { sh 'mvn test -Dtest=UnitSuite' }
        }
        stage('Integration') {
          steps { sh 'mvn test -Dtest=IntegrationSuite' }
        }
        stage('Lint') {
          steps { sh 'mvn checkstyle:check' }
        }
      }
    }
  }
}
```

Scripted example for dynamic parallelism (building a matrix across services):

```groovy
def services = ['auth', 'payment', 'order']
def parallelBuilds = [:]

for (svc in services) {
  def s = svc
  parallelBuilds[s] = {
    node('linux') {
      sh "cd services/${s} && mvn clean package"
    }
  }
}

parallel parallelBuilds
```

### Credential Binding

Use `withCredentials` to inject secrets into build steps without printing them:

```groovy
withCredentials([
  usernamePassword(
    credentialsId: 'docker-registry',
    usernameVariable: 'DOCKER_USER',
    passwordVariable: 'DOCKER_PASS'
  ),
  string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')
]) {
  sh """
    echo "$DOCKER_PASS" | docker login registry.example.com \
      -u "$DOCKER_USER" --password-stdin
    mvn sonar:sonar -Dsonar.login=$SONAR_TOKEN
  """
}
```

Jenkins masks credential values in console output but they can still appear in environment dumps. Use `set +x` before and `set -x` after sensitive operations in shell scripts.

---

## GitHub Actions: Matrix Builds, Reusable Workflows, OIDC, Composite Actions

### Matrix Builds

Test across multiple OS/runtime combinations without copy-paste:

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: ['18', '20', '22']
        exclude:
          - os: macos-latest
            node: '18'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci && npm test
```

`fail-fast: false` lets all matrix jobs complete even if one fails, which is useful for seeing which combinations are broken.

### Reusable Workflows (workflow_call)

Define once, call from many repositories:

```yaml
# .github/workflows/reusable-build.yml
name: Reusable Build

on:
  workflow_call:
    inputs:
      image-name:
        required: true
        type: string
      tag:
        required: true
        type: string
    secrets:
      registry-password:
        required: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push
        run: |
          echo "${{ secrets.registry-password }}" | \
            docker login -u ci --password-stdin registry.example.com
          docker build -t registry.example.com/${{ inputs.image-name }}:${{ inputs.tag }} .
          docker push registry.example.com/${{ inputs.image-name }}:${{ inputs.tag }}
```

Caller workflow:

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    uses: org/shared-workflows/.github/workflows/reusable-build.yml@main
    with:
      image-name: myapp
      tag: ${{ github.sha }}
    secrets:
      registry-password: ${{ secrets.REGISTRY_PASSWORD }}
```

### OIDC to AWS — No Long-Lived Keys

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write      # required for OIDC token request
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deployer
          role-session-name: deploy-${{ github.sha }}
          aws-region: us-east-1

      - name: Push image to ECR
        run: |
          aws ecr get-login-password --region us-east-1 | \
            docker login --username AWS \
            --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
          docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:${{ github.sha }}
```

Required IAM trust policy on the AWS role:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:org/myapp:environment:production"
      }
    }
  }]
}
```

Lock the `sub` condition to a specific repo and environment to prevent any GitHub repo from assuming the role.

### Composite Actions

A composite action wraps multiple steps into a reusable action stored in a repo:

```yaml
# .github/actions/trivy-scan/action.yml
name: Trivy Scan
description: Scan image for vulnerabilities

inputs:
  image-ref:
    required: true
    description: Image to scan

runs:
  using: composite
  steps:
    - name: Install Trivy
      shell: bash
      run: |
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | \
          sh -s -- -b /usr/local/bin v0.50.1

    - name: Scan
      shell: bash
      run: |
        trivy image \
          --exit-code 1 \
          --severity HIGH,CRITICAL \
          --format table \
          ${{ inputs.image-ref }}
```

### Environments With Required Reviewers

```yaml
jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production     # must be configured in repo Settings > Environments
    steps:
      - run: echo "deploying to production"
```

Configure in GitHub repo Settings > Environments > production > Required reviewers: add people or teams. The job pauses until reviewers approve or reject.

### Artifact Passing Between Jobs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: mvn clean package -DskipTests
      - uses: actions/upload-artifact@v4
        with:
          name: app-jar
          path: target/*.jar
          retention-days: 7

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: app-jar
          path: ./artifacts
      - run: ls -la ./artifacts
```

---

## Azure Pipelines: Full Multi-Stage YAML

Complete pipeline with Build, Test, Dev approval, and Production approval:

```yaml
trigger:
  branches:
    include:
      - main

variables:
  - group: myapp-dev-vars      # variable group from Library
  - name: imageRepository
    value: myapp
  - name: containerRegistry
    value: myregistry.azurecr.io

stages:
- stage: Build
  displayName: Build and Test
  jobs:
  - job: BuildTest
    pool:
      vmImage: ubuntu-latest
    steps:
    - task: Maven@4
      displayName: Build and test
      inputs:
        goals: 'clean verify'
        publishJUnitResults: true
        testResultsFiles: '**/surefire-reports/TEST-*.xml'
        sonarQubeRunAnalysis: false

    - task: Docker@2
      displayName: Build image
      inputs:
        containerRegistry: 'ACR-Service-Connection'
        repository: $(imageRepository)
        command: build
        Dockerfile: Dockerfile
        tags: $(Build.SourceVersion)

    - task: AzureContainerApps@1
      displayName: Trivy scan
      inputs:
        azureSubscription: 'Azure-Service-Connection'
        imageToDeploy: $(containerRegistry)/$(imageRepository):$(Build.SourceVersion)

    - task: Docker@2
      displayName: Push image
      inputs:
        containerRegistry: 'ACR-Service-Connection'
        repository: $(imageRepository)
        command: push
        tags: $(Build.SourceVersion)

    - publish: $(System.DefaultWorkingDirectory)/k8s
      artifact: k8s-manifests

- stage: DeployDev
  displayName: Deploy to Dev
  dependsOn: Build
  jobs:
  - deployment: DeployDev
    pool:
      vmImage: ubuntu-latest
    environment: dev
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: k8s-manifests
          - task: KubernetesManifest@1
            displayName: Deploy to dev cluster
            inputs:
              action: deploy
              kubernetesServiceConnection: 'AKS-Dev-Connection'
              namespace: dev
              manifests: $(Pipeline.Workspace)/k8s-manifests/*.yaml
              containers: $(containerRegistry)/$(imageRepository):$(Build.SourceVersion)

- stage: DeployProd
  displayName: Deploy to Production
  dependsOn: DeployDev
  jobs:
  - deployment: DeployProd
    pool:
      vmImage: ubuntu-latest
    environment: production        # environment has required approvers configured
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: k8s-manifests
          - task: KubernetesManifest@1
            displayName: Deploy to production cluster
            inputs:
              action: deploy
              kubernetesServiceConnection: 'AKS-Prod-Connection'
              namespace: production
              manifests: $(Pipeline.Workspace)/k8s-manifests/*.yaml
              containers: $(containerRegistry)/$(imageRepository):$(Build.SourceVersion)
```

Configure approvals in Azure DevOps: Pipelines > Environments > production > Approvals and checks > Approvals > add reviewers.

---

## GitOps: Flux v2 vs ArgoCD

| Feature | ArgoCD | Flux v2 |
|---|---|---|
| UI | Rich web UI built-in | Minimal, external dashboards |
| Architecture | Application server + agent | All-in-cluster controllers |
| Source support | Git, Helm, Kustomize, OCI | Git, Helm, Kustomize, OCI, S3-compatible |
| Multi-tenancy | Projects + AppProject RBAC | Tenancy via namespaced resources |
| Multi-cluster | App + cluster registration in hub | Remote cluster refs via kubeconfig secrets |
| Progressive delivery | Argo Rollouts (separate install) | Flagger (separate install) |
| Config model | Application CRDs | Source/Kustomization/HelmRelease CRDs |
| Drift detection | Yes — manual and auto-heal | Yes — via Kustomization reconcile |
| Notification | Notifications controller (separate) | Built-in alerting via Providers |

ArgoCD is more common in organizations that need a visible UI and centralized control. Flux v2 is preferred in GitOps-first organizations that want pure Kubernetes-native operators.

### Flux v2 Quick Reference

```bash
# Install Flux
flux install

# Bootstrap with GitHub
flux bootstrap github \
  --owner=org \
  --repository=gitops-repo \
  --branch=main \
  --path=./clusters/production \
  --personal

# Check reconciliation
flux get kustomizations
flux get helmreleases -A
flux reconcile kustomization myapp --with-source

# Check source
flux get sources git
flux get sources helm
```

```yaml
# GitRepository source
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: myapp
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/org/gitops-repo
  ref:
    branch: main
---
# Kustomization that applies overlays/production
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: myapp
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps/myapp/overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: myapp
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: myapp
      namespace: production
```

### ArgoCD ApplicationSet for Multi-Cluster

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: myapp-clusters
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - cluster: us-east-1
            url: https://k8s-us-east-1.example.com
            env: production
          - cluster: eu-west-1
            url: https://k8s-eu-west-1.example.com
            env: production
  template:
    metadata:
      name: myapp-{{cluster}}
    spec:
      project: default
      source:
        repoURL: https://github.com/org/gitops-repo
        path: apps/myapp/overlays/{{env}}
        targetRevision: HEAD
      destination:
        server: '{{url}}'
        namespace: myapp
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

### ArgoCD App-of-Apps Pattern

One root Application manages all other Applications:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/gitops-repo
    path: apps/
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

The `apps/` directory contains ArgoCD Application manifests for each service. ArgoCD creates them, and they self-manage their own sync targets.

---

## Progressive Delivery: Canary vs Blue-Green vs Rolling

| Strategy | Traffic model | Rollback speed | Observability requirement | Best for |
|---|---|---|---|---|
| Rolling update | Gradual pod replacement, no traffic split | Minutes (undo rollout) | Basic health checks | Stateless services, low risk |
| Canary | % traffic split to new version | Instant (set weight to 0) | Full metrics per version | High-risk changes, new features |
| Blue-Green | Full traffic switch between two environments | Instant (LB flip) | Health checks both envs | Zero-downtime, fast rollback |
| Feature flags | Code deployed, behavior hidden | Per-flag toggle | Per-flag metrics | Decoupling deploy from release |

When to use canary: when you need per-version error rate, latency, and business metrics observed before full rollout. Requires instrumented metrics.

When to use blue-green: when rollback must be instant and you can afford the duplicate infrastructure cost.

When to use rolling: for safe defaults on stateless services where progressive exposure is not strictly needed.

### Argo Rollouts AnalysisTemplate

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
  namespace: production
spec:
  metrics:
    - name: error-rate
      interval: 1m
      count: 5
      successCondition: result[0] < 0.01    # less than 1% 5xx
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring.svc:9090
          query: |
            sum(rate(http_requests_total{
              app="myapp-canary",
              status=~"5.."
            }[5m]))
            /
            sum(rate(http_requests_total{
              app="myapp-canary"
            }[5m]))
    - name: p99-latency
      interval: 1m
      count: 5
      successCondition: result[0] < 0.5    # under 500ms
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring.svc:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                app="myapp-canary"
              }[5m])) by (le)
            )
---
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: myapp-canary
      stableService: myapp-stable
      trafficRouting:
        nginx:
          stableIngress: myapp-ingress
      steps:
        - setWeight: 5
        - pause: {duration: 5m}
        - analysis:
            templates:
              - templateName: error-rate-check
        - setWeight: 20
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100
```

The `analysis` step queries Prometheus. If the error-rate metric exceeds `0.01` more than twice, the rollout aborts and rolls back automatically.
