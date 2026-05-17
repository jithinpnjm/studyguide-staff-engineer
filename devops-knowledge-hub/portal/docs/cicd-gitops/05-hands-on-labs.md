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

---

## Lab 11: Complete GitHub Actions CI/CD with Docker, Trivy, and GitOps Update

**Goal:** Build a production-realistic CI/CD workflow with test, Docker build, Trivy scan, push, and GitOps manifest update.

Create the workflow file:

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

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
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm test -- --coverage --coverageReporters=text-summary

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  build-push:
    name: Build and Push
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write

    outputs:
      image-digest: ${{ steps.push.outputs.digest }}

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build image (no push yet)
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          labels: |
            org.opencontainers.image.revision=${{ github.sha }}
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          load: true

      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: table
          exit-code: '1'
          severity: CRITICAL
          vuln-type: os,library

      - name: Push image
        id: push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    needs: build-push
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Checkout GitOps repo
        uses: actions/checkout@v4
        with:
          repository: org/gitops-repo
          token: ${{ secrets.GITOPS_TOKEN }}
          path: gitops

      - name: Update staging image tag
        run: |
          cd gitops
          yq -i ".image.tag = \"${{ github.sha }}\"" \
            apps/myapp/overlays/staging/values.yaml
          git config user.email "ci@example.com"
          git config user.name "GitHub Actions Bot"
          git add apps/myapp/overlays/staging/values.yaml
          git commit -m "ci: deploy myapp ${{ github.sha }} to staging"
          git push

      - name: Wait for ArgoCD sync
        run: |
          # Install argocd CLI
          curl -sSL -o /usr/local/bin/argocd \
            https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
          chmod +x /usr/local/bin/argocd
          argocd login ${{ secrets.ARGOCD_SERVER }} \
            --auth-token ${{ secrets.ARGOCD_TOKEN }} --grpc-web
          argocd app wait myapp-staging \
            --health --timeout 300
```

**Validation:** push to main, observe each job, verify the staging values.yaml was updated, and ArgoCD synced the staging cluster.

---

## Lab 12: Complete Declarative Jenkinsfile with Docker, Push, and Deploy

**Goal:** Build a production-grade Jenkinsfile with agent, tools, Checkout, Build, Test, Docker, Push, and Deploy stages.

```groovy
pipeline {
  agent {
    kubernetes {
      yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: maven
    image: maven:3.9-eclipse-temurin-17
    command: ['cat']
    tty: true
    resources:
      limits:
        cpu: '2'
        memory: '4Gi'
  - name: docker
    image: docker:24-dind
    securityContext:
      privileged: true
    volumeMounts:
    - name: dind-storage
      mountPath: /var/lib/docker
  volumes:
  - name: dind-storage
    emptyDir: {}
"""
    }
  }

  environment {
    REGISTRY         = 'registry.example.com'
    IMAGE_NAME       = 'myapp'
    IMAGE_TAG        = "${GIT_COMMIT[0..7]}"
    REGISTRY_CREDS   = credentials('registry-credentials')
    GITOPS_TOKEN     = credentials('gitops-deploy-token')
  }

  options {
    timestamps()
    timeout(time: 45, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
    disableConcurrentBuilds(abortPrevious: true)
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
        container('maven') {
          sh 'mvn clean package -DskipTests -q'
          sh 'ls -lh target/*.jar'
        }
      }
    }

    stage('Unit Tests') {
      steps {
        container('maven') {
          sh 'mvn test -q'
        }
      }
      post {
        always {
          junit 'target/surefire-reports/*.xml'
          jacoco(
            execPattern: 'target/*.exec',
            minimumInstructionCoverage: '70'
          )
        }
      }
    }

    stage('Docker Build') {
      steps {
        container('docker') {
          sh """
            docker build \
              --label org.opencontainers.image.revision=${GIT_COMMIT} \
              -t ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} \
              -t ${REGISTRY}/${IMAGE_NAME}:latest \
              .
          """
        }
      }
    }

    stage('Security Scan') {
      steps {
        container('docker') {
          sh """
            docker run --rm \
              -v /var/run/docker.sock:/var/run/docker.sock \
              aquasec/trivy image \
                --severity HIGH,CRITICAL \
                --exit-code 1 \
                ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
          """
        }
      }
    }

    stage('Push') {
      when {
        anyOf {
          branch 'main'
          branch 'release/*'
        }
      }
      steps {
        container('docker') {
          sh """
            echo "${REGISTRY_CREDS_PSW}" | docker login ${REGISTRY} \
              -u "${REGISTRY_CREDS_USR}" --password-stdin
            docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
            docker push ${REGISTRY}/${IMAGE_NAME}:latest
          """
        }
      }
    }

    stage('Deploy Staging') {
      when { branch 'main' }
      steps {
        sh """
          git clone https://x-access-token:${GITOPS_TOKEN}@github.com/org/gitops-repo /tmp/gitops
          yq -i ".image.tag = \\"${IMAGE_TAG}\\"" \
            /tmp/gitops/apps/myapp/overlays/staging/values.yaml
          cd /tmp/gitops
          git config user.email "jenkins@example.com"
          git config user.name "Jenkins CI"
          git add .
          git commit -m "deploy myapp ${IMAGE_TAG} to staging"
          git push
        """
      }
    }
  }

  post {
    failure {
      slackSend(
        channel: '#ci-failures',
        color: 'danger',
        message: "Build FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|View>)"
      )
    }
    success {
      slackSend(
        channel: '#ci-success',
        color: 'good',
        message: "Build PASSED: ${env.JOB_NAME} #${env.BUILD_NUMBER} image=${IMAGE_TAG}"
      )
    }
    always {
      cleanWs()
    }
  }
}
```

**Validation checklist:**
- Create a multibranch pipeline pointing to this repo.
- Confirm Jenkinsfile detection and pipeline visualization.
- Verify test reports and coverage appear in Jenkins.
- Verify image exists in registry after push stage.
- Verify staging values.yaml was updated.

---

## Lab 13: Complete Azure Pipeline — Build, Test, Dev, Prod with Approvals

**Goal:** Full multi-stage Azure Pipeline with Docker, ACR, AKS, and approval gates.

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main

variables:
  - group: myapp-secrets          # Key Vault linked variable group
  - name: imageRepository
    value: myapp
  - name: containerRegistry
    value: myregistry.azurecr.io
  - name: dockerfilePath
    value: Dockerfile
  - name: tag
    value: $(Build.SourceVersion)

stages:

- stage: Build
  displayName: Build and Test
  jobs:
  - job: Build
    pool:
      vmImage: ubuntu-latest
    steps:

    - task: Maven@4
      displayName: Maven build and test
      inputs:
        mavenPomFile: pom.xml
        goals: 'clean verify'
        publishJUnitResults: true
        testResultsFiles: '**/TEST-*.xml'
        javaHomeOption: JDKVersion
        jdkVersionOption: '1.17'
        mavenVersionOption: Default
        sonarQubeRunAnalysis: false

    - task: Docker@2
      displayName: Build Docker image
      inputs:
        containerRegistry: 'ACR-Service-Connection'
        repository: $(imageRepository)
        command: build
        Dockerfile: $(dockerfilePath)
        tags: |
          $(tag)

    - bash: |
        docker run --rm \
          aquasec/trivy image \
          --severity HIGH,CRITICAL \
          --exit-code 1 \
          $(containerRegistry)/$(imageRepository):$(tag)
      displayName: Trivy vulnerability scan

    - task: Docker@2
      displayName: Push to ACR
      inputs:
        containerRegistry: 'ACR-Service-Connection'
        repository: $(imageRepository)
        command: push
        tags: |
          $(tag)

    - publish: $(System.DefaultWorkingDirectory)/k8s
      artifact: manifests
      displayName: Publish K8s manifests

- stage: DeployDev
  displayName: Deploy to Dev
  dependsOn: Build
  jobs:
  - deployment: DeployDev
    pool:
      vmImage: ubuntu-latest
    environment: dev                     # no approvals on dev
    variables:
      - group: myapp-dev-vars
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: manifests
          - task: KubernetesManifest@1
            displayName: Deploy to dev AKS
            inputs:
              action: deploy
              kubernetesServiceConnection: 'AKS-Dev-Connection'
              namespace: dev
              manifests: '$(Pipeline.Workspace)/manifests/*.yaml'
              containers: '$(containerRegistry)/$(imageRepository):$(tag)'

- stage: DeployProd
  displayName: Deploy to Production
  dependsOn: DeployDev
  jobs:
  - deployment: DeployProd
    pool:
      vmImage: ubuntu-latest
    environment: production              # approvers configured in Azure DevOps
    variables:
      - group: myapp-prod-vars
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: manifests
          - task: KubernetesManifest@1
            displayName: Deploy to production AKS
            inputs:
              action: deploy
              kubernetesServiceConnection: 'AKS-Prod-Connection'
              namespace: production
              manifests: '$(Pipeline.Workspace)/manifests/*.yaml'
              containers: '$(containerRegistry)/$(imageRepository):$(tag)'
          - bash: |
              # Smoke test after deploy
              ENDPOINT="https://myapp.example.com/health"
              for i in $(seq 1 10); do
                STATUS=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT)
                if [ "$STATUS" = "200" ]; then
                  echo "Smoke test passed"
                  exit 0
                fi
                echo "Attempt $i failed (status: $STATUS), retrying..."
                sleep 10
              done
              echo "Smoke test failed after 10 attempts"
              exit 1
            displayName: Smoke test production deployment
```

**Setup steps:**
1. Go to Pipelines > Environments > create `dev` and `production`.
2. On `production`, add Approvals and Checks > Approvals > add your team leads.
3. Create ACR service connection (`ACR-Service-Connection`) in Project Settings > Service Connections.
4. Create AKS service connections for dev and prod clusters.
5. Create variable groups `myapp-dev-vars` and `myapp-prod-vars` in Library > Link to Azure Key Vault.

---

## Lab 14: ArgoCD Application + AppProject Setup

**Goal:** Create a proper ArgoCD AppProject with RBAC and then create an Application within it.

```bash
# Install ArgoCD (local/dev)
kubectl create namespace argocd
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s

# Get initial admin password
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d

# Port forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Create AppProject and Application:

```yaml
# project.yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-a
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  description: Team A applications
  # Allow syncing from only the approved GitOps repo
  sourceRepos:
    - https://github.com/org/gitops-repo
  # Only allow deploying to team-a namespaces
  destinations:
    - namespace: 'team-a-*'
      server: https://kubernetes.default.svc
  # Cluster-wide resources team-a can create
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
  # Namespace-level resources team-a can manage
  namespaceResourceWhitelist:
    - group: 'apps'
      kind: Deployment
    - group: ''
      kind: Service
    - group: ''
      kind: ConfigMap
    - group: ''
      kind: Secret
    - group: 'networking.k8s.io'
      kind: Ingress
  roles:
    - name: team-a-deploy
      description: Team A can sync their own apps
      policies:
        - p, proj:team-a:team-a-deploy, applications, sync, team-a/*, allow
        - p, proj:team-a:team-a-deploy, applications, get, team-a/*, allow
      groups:
        - team-a-engineers
---
# application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: team-a-backend
  namespace: argocd
  labels:
    team: team-a
    environment: production
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: team-a
  source:
    repoURL: https://github.com/org/gitops-repo
    path: apps/team-a/backend/overlays/production
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: team-a-production
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
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

```bash
# Apply and verify
kubectl apply -f project.yaml
kubectl apply -f application.yaml

# Check status
argocd app get team-a-backend
argocd app sync team-a-backend
argocd app wait team-a-backend --health --timeout=120
```

---

## Lab 15: ArgoCD App-of-Apps with Kustomize Structure

**Goal:** Set up a GitOps repository with app-of-apps pattern and Kustomize overlays.

Repository structure:

```bash
mkdir -p gitops-repo/{apps,clusters/production}

# Root ArgoCD Application (the bootstrap)
cat > gitops-repo/clusters/production/bootstrap.yaml << 'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: bootstrap
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
EOF

# Each app in apps/ is its own ArgoCD Application
mkdir -p gitops-repo/apps

cat > gitops-repo/apps/myapp.yaml << 'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/gitops-repo
    path: services/myapp/overlays/production
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
EOF

# Kustomize base
mkdir -p gitops-repo/services/myapp/{base,overlays/production,overlays/staging}

cat > gitops-repo/services/myapp/base/deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: registry.example.com/myapp:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
EOF

cat > gitops-repo/services/myapp/base/kustomization.yaml << 'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
EOF

# Production overlay
cat > gitops-repo/services/myapp/overlays/production/kustomization.yaml << 'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: myapp
resources:
  - ../../base
images:
  - name: registry.example.com/myapp
    newTag: "abc123"      # CI updates this value
patches:
  - patch: |
      - op: replace
        path: /spec/replicas
        value: 3
    target:
      kind: Deployment
      name: myapp
EOF
```

Verify Kustomize rendering locally:

```bash
kustomize build gitops-repo/services/myapp/overlays/production
```

Bootstrap the cluster:

```bash
kubectl apply -f gitops-repo/clusters/production/bootstrap.yaml
argocd app list
# bootstrap app should appear and start creating child apps
```

---

## Lab 16: Argo Rollouts Canary with AnalysisTemplate

**Goal:** Install Argo Rollouts, create a Rollout with canary steps and a Prometheus-backed AnalysisTemplate.

```bash
# Install Argo Rollouts
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f \
  https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Install kubectl plugin
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x kubectl-argo-rollouts-linux-amd64
mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts
```

```yaml
# rollout.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 10
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: registry.example.com/myapp:v1
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
  strategy:
    canary:
      canaryService: myapp-canary
      stableService: myapp-stable
      trafficRouting:
        nginx:
          stableIngress: myapp-ingress
      steps:
        - setWeight: 5
        - pause: {duration: 2m}
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 25
        - pause: {duration: 5m}
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 50
        - pause: {duration: 5m}
        - setWeight: 100
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
  namespace: production
spec:
  metrics:
    - name: success-rate
      interval: 30s
      count: 5
      successCondition: result[0] >= 0.95
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus-operated.monitoring.svc:9090
          query: |
            sum(rate(http_requests_total{
              app="myapp-canary",
              status!~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              app="myapp-canary"
            }[2m]))
---
apiVersion: v1
kind: Service
metadata:
  name: myapp-stable
  namespace: production
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: myapp-canary
  namespace: production
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 8080
```

```bash
kubectl apply -f rollout.yaml

# Trigger a rollout by updating the image
kubectl argo rollouts set image myapp myapp=registry.example.com/myapp:v2 -n production

# Watch the rollout
kubectl argo rollouts get rollout myapp -n production --watch

# Manually promote (skip a pause step)
kubectl argo rollouts promote myapp -n production

# Abort the rollout (rolls back to stable)
kubectl argo rollouts abort myapp -n production

# Check AnalysisRun results
kubectl get analysisruns -n production
kubectl describe analysisrun <name> -n production
```

---

## Lab 17: GitHub Actions OIDC to AWS — No Static Keys

**Goal:** Configure a GitHub Actions workflow that uses OIDC federation to get short-lived AWS credentials.

Step 1: Create the OIDC provider in AWS:

```bash
# Create OIDC provider (one-time setup per account)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create the IAM role with trust policy
aws iam create-role \
  --role-name github-actions-ecr-push \
  --assume-role-policy-document file://trust-policy.json
```

`trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:environment:production"
        }
      }
    }
  ]
}
```

Step 2: Attach ECR push permissions:

```bash
aws iam attach-role-policy \
  --role-name github-actions-ecr-push \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
```

Step 3: The workflow:

```yaml
name: Deploy to ECR

on:
  push:
    branches: [main]

jobs:
  build-push:
    runs-on: ubuntu-latest
    environment: production    # matches the sub condition in trust policy
    permissions:
      id-token: write          # mandatory for OIDC
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/github-actions-ecr-push
          role-session-name: github-${{ github.sha }}
          aws-region: us-east-1

      - name: Verify credentials (no static keys anywhere)
        run: |
          aws sts get-caller-identity
          echo "Role assumed successfully — no long-lived keys used"

      - name: Log in to ECR
        run: |
          aws ecr get-login-password --region us-east-1 | \
            docker login --username AWS \
            --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

      - name: Build and push
        run: |
          IMAGE="ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/myapp"
          docker build -t ${IMAGE}:${{ github.sha }} .
          docker push ${IMAGE}:${{ github.sha }}
```

**Validation:** confirm no `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` secrets exist in the repo. The workflow should authenticate and push using the OIDC-issued short-lived token only.
