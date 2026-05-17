---
title: "🔄 CI/CD & GitOps"
sidebar_position: 2
description: "Zero to hero study guide for CI/CD & GitOps — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

CI/CD is the nervous system of software delivery. A well-designed pipeline is the difference between deploying with confidence 20 times a day and deploying with dread once a sprint. GitOps extends this to infrastructure: when everything running in production is expressed as code in Git, you get audit trails, rollback, and drift detection for free.

For a Staff/Principal engineer, this domain is about designing systems that make the right thing easy and the wrong thing hard — fast feedback on bad code, safe progressive delivery of good code, and automatic reconciliation when reality diverges from intent.

Business outcomes:
- **DORA metrics** — elite performers deploy on demand with <1h lead time and <1% change failure rate; pipeline design is the primary lever
- **Developer productivity** — a 30-minute CI pipeline × 50 engineers = 25 hours of waiting daily; cutting to 10 minutes returns real headcount
- **Blast radius reduction** — canary delivery means a bad deployment affects 1% of users instead of all of them
- **Compliance** — immutable artifacts, signed commits, and audit logs satisfy SOC2/ISO27001 automatically

---

## 📋 Prerequisites & Mental Models

**Trunk-based development** — the mental model that makes CI/CD work. Short-lived branches (hours, not weeks), feature flags to hide unfinished work, continuous integration with main. Long-lived branches → merge conflicts → big-bang deploys → incidents.

**The three capabilities of a pipeline:** BUILD (produce an immutable artifact from source), VERIFY (prove it works), DELIVER (get it to users safely). These are logically separate even when coupled in one YAML file.

**GitOps = Git as the source of truth for desired state.** An operator continuously compares Git state to cluster state and reconciles drift — automatically. This is pull-based deployment, not push-based. Security implication: your CD system never needs write credentials pushed to it from outside.

**Artifact immutability** — every build produces a unique artifact (Docker image tagged with git SHA). You never rebuild; you re-deploy. This is what makes rollback reliable and reproducible.

**Shift-left security** — fixing a vulnerability in production costs 100x a pre-commit hook finding. Shift every check as early as possible.

---

## 🔷 Core Concepts

### Pipeline Stages

```
Pre-commit hooks → CI (build/test/scan) → Registry → CD (staging) → Validation → CD (production)
```

**Pre-commit hooks** (local): linting, secret scanning (gitleaks), formatting. Sub-second. Enforce with team culture — no `--no-verify`.

**CI stage** (on PR/push):
1. Dependency install (cached)
2. Unit + integration tests
3. Static analysis (SonarQube, Semgrep)
4. Container image build (multi-stage Dockerfile + BuildKit)
5. Image vulnerability scan (Trivy) — fail on CRITICAL
6. Image sign (Cosign)
7. Push to registry (ECR, GCR, Harbor)
8. Update GitOps repo with new image tag

**CD stage** (triggered by Git config change):
1. ArgoCD/Flux detects config change in GitOps repo
2. Applies to staging → automated smoke tests
3. Promotion PR to production overlay (manual approval gate)
4. ArgoCD syncs to production — canary → full rollout

### Jenkins

Java-based automation server. **Controller/agent architecture** — controller manages jobs and scheduling, agents execute builds. Never run builds on the controller in production.

**Jenkinsfile (declarative pipeline):**
```groovy
pipeline {
  agent { kubernetes { yaml podYaml } }
  stages {
    stage('Build & Push') {
      steps {
        sh 'docker build -t myapp:${GIT_COMMIT} .'
        sh 'docker push myapp:${GIT_COMMIT}'
      }
    }
    stage('Deploy Staging') {
      steps { sh 'helm upgrade --install myapp ./chart --set image.tag=${GIT_COMMIT}' }
    }
  }
  post { failure { slackSend channel: '#alerts', message: "Failed: ${env.BUILD_URL}" } }
}
```

**Shared Libraries** — reusable pipeline Groovy code in a separate Git repo, loaded with `@Library('my-lib')`. Centralize common steps (build, scan, push, notify) so every team's pipeline calls the same vetted code.

**JCasC (Jenkins Configuration as Code)** — configure Jenkins itself from YAML. Reproducible, auditable, version-controlled controller configuration.

**Dynamic agents via Kubernetes Plugin** — Jenkins creates Pods for each build, destroys them after. Eliminates idle agent cost, provides clean environments.

### GitHub Actions

GitHub-native CI/CD. Zero infrastructure. YAML in `.github/workflows/`.

```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  packages: write
  id-token: write   # for OIDC

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

    - name: Build & push to ECR
      uses: docker/build-push-action@v5
      with:
        push: true
        tags: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Scan image
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:${{ github.sha }}
        severity: CRITICAL
        exit-code: 1
```

**Key patterns:**
- Pin action versions to SHA (not tags) — tags are mutable
- Use OIDC for AWS/GCP/Azure auth — no long-lived keys
- Environments with required reviewers for production deployments
- Reusable workflows via `workflow_call`
- Self-hosted runners for private network access or GPU

### Azure DevOps

Multi-stage YAML pipeline:
```yaml
stages:
- stage: Build
  jobs:
  - job: BuildTest
    pool: { vmImage: ubuntu-latest }
    steps:
    - task: Docker@2
      inputs: { command: buildAndPush, repository: myapp, tags: $(Build.SourceVersion) }
    - task: SonarQubePrepare@5
      inputs: { SonarQube: SonarQube, scannerMode: CLI }

- stage: DeployStaging
  dependsOn: Build
  environment: staging    # environment with approval gates
  jobs:
  - deployment: Deploy
    strategy:
      runOnce:
        deploy:
          steps:
          - task: HelmDeploy@0
            inputs: { command: upgrade, chartName: myapp, releaseName: myapp-staging }
```

Key concepts: **Environments** (deployment targets with approvals), **Variable Groups** (shared vars linked to Azure Key Vault), **Service Connections** (authenticated connections to external systems).

### ArgoCD — GitOps Controller

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/org/gitops-repo
    path: apps/myapp/overlays/production
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true      # delete resources removed from Git
      selfHeal: true   # revert manual changes (drift remediation)
    syncOptions:
    - CreateNamespace=true
    - ServerSideApply=true
```

**ApplicationSet** — generate Applications from a template. Multi-cluster, multi-environment:
```yaml
generators:
- list:
    elements:
    - cluster: production
      url: https://prod.example.com
    - cluster: staging
      url: https://staging.example.com
template:
  metadata: { name: 'myapp-{{cluster}}' }
  spec:
    destination: { server: '{{url}}' }
```

**Sync waves** — control apply order with `argocd.argoproj.io/sync-wave: "0"`. Apply CRDs before CRs, Namespace before resources, migrations before app.

### Argo Rollouts — Progressive Delivery

```yaml
strategy:
  canary:
    steps:
    - setWeight: 5
    - pause: {duration: 10m}
    - analysis:
        templates:
        - templateName: success-rate   # checks Prometheus metric
    - setWeight: 50
    - pause: {duration: 10m}
    - setWeight: 100
```

Automatic rollback if the AnalysisRun fails. Integrates with Nginx Ingress, Istio, AWS ALB for traffic splitting.

### SonarQube / Code Quality

**Quality Gates** — pass/fail thresholds. Production-grade gate:
- New code coverage ≥ 80%
- New duplicated lines < 3%
- Reliability rating: A (no bugs)
- Security rating: A (no vulnerabilities)
- Security hotspots reviewed: 100%

Fails the PR if any gate is breached. Use SonarCloud (hosted) unless you need air-gapped or custom rules.

---

## 🛠️ Tools & Ecosystem

| Tool | Purpose |
|------|---------|
| Jenkins | Self-hosted, flexible, mature CI |
| GitHub Actions | GitHub-native, zero infrastructure |
| Azure DevOps | Microsoft ecosystem, integrated boards |
| ArgoCD | GitOps CD, rich UI, ApplicationSets |
| Flux | GitOps CD, Helm-first, multi-tenancy |
| Argo Rollouts | Progressive delivery with metrics |
| Tekton | Kubernetes-native CI primitives |
| SonarQube | Code quality + SAST |
| Trivy | Container + IaC vulnerability scanning |
| Cosign | Image signing (Sigstore) |
| gitleaks | Secret scanning, pre-commit + CI |
| Harbor | Self-hosted container registry with proxy cache |
| Nexus | Universal artifact repository |

---

## 🏗️ Architecture Patterns

### Two-Repo GitOps Pattern (Recommended)

**app-repo:** source code + Dockerfile + Helm chart
**gitops-repo:** Kustomize overlays / Helm values per environment

CI writes to gitops-repo on successful build:
```bash
yq -i ".image.tag = \"${GIT_SHA}\"" apps/myapp/overlays/staging/values.yaml
git commit -m "deploy: myapp ${GIT_SHA} to staging"
git push
# ArgoCD picks it up and deploys automatically
```

### Supply Chain Security Architecture

```
Developer pushes code
  → CI builds image
  → Trivy scans (CRITICAL = fail)
  → Cosign signs image with Fulcio CA
  → Push to registry (with SBOM attestation)
  → GitOps repo updated

ArgoCD deploys to cluster:
  → Kyverno admission controller verifies Cosign signature
  → Rejects unsigned images
```

### Secrets in Pipelines

Never store secrets in pipeline YAML. Use:
1. **OIDC federation** — GitHub Actions gets AWS/GCP/Azure credentials dynamically, no static keys
2. **Vault dynamic secrets** — pipeline gets a short-lived DB password for the test run
3. **External Secrets Operator** — secrets pulled from Vault into K8s at deploy time

---

## ⚙️ Production Operations

### CI Performance Optimization

- **Parallelism:** lint, unit tests, security scan — run simultaneously
- **Docker layer caching:** order Dockerfile from least to most frequently changing layers
- **Dependency caching:** cache `node_modules`, pip packages, Go modules
- **Selective builds:** only build services that changed (nx, Turborepo, Bazel for monorepos)
- **Target:** <10 minutes end-to-end CI for developer feedback

### Rollback Runbook

| Tier | Rollback Method | Time |
|------|----------------|------|
| Application | ArgoCD rollback to previous sync | <2 min |
| Application | `kubectl rollout undo deployment/myapp` | <1 min |
| Database migration | Feature flag off + backwards-compat schema | Instant |
| Infra (Terraform) | `git revert` + `terraform apply` | 5-15 min |
| Full environment | Argo Rollouts auto-rollback on metric failure | <5 min |

### Pipeline Reliability

- Flaky tests: quarantine them immediately (`@Flaky` annotation), fix within one sprint
- Agent exhaustion: autoscale agents (K8s Pod agents, GitHub Actions larger runners)
- Break-glass: document and test a manual deployment procedure quarterly

---

## 📊 Observability & Debugging

```promql
# Pipeline build success rate
sum(rate(jenkins_builds_success_build_count_total[1h])) /
sum(rate(jenkins_builds_total_build_count_total[1h]))

# ArgoCD app health
argocd_app_info{health_status!="Healthy"}

# ArgoCD sync status (OutOfSync = drift)
argocd_app_info{sync_status="OutOfSync"}
```

**Debugging a stuck ArgoCD sync:**
1. `argocd app get myapp` — see error message
2. `argocd app diff myapp` — what's different
3. Check admission webhook rejections: `kubectl get events -n myapp --field-selector reason=FailedCreate`
4. Check Kyverno policy violations: `kubectl get policyreport -n myapp`

---

## 🔐 Security Considerations

**Pipeline attack surface:**
- Pin all GitHub Actions to SHA (not tags)
- Use OIDC — never store AWS/GCP/Azure keys as secrets
- Ephemeral runners — no persistent state between builds
- Separate CI permissions (read + artifact push) from CD permissions (cluster write)
- Require 2+ approvers on production deployment PRs
- Audit all `.github/workflows/` changes via PR review

**Dependency confusion attacks:** use private package registries with namespace protection. Validate package sources in CI.

---

## 🎓 Staff/Principal Engineer Perspective

**Make the right thing easy.** A developer should ship to production in 15 minutes without knowing Kubernetes or Docker registry auth. The platform team builds this once; all teams benefit.

**Every environment is production.** Staging with lax config hides production bugs. Same pipeline, same images, same Helm charts across all environments — only values differ.

**Pipelines are code.** Pipeline YAML gets code review, is tested (use `act` locally for GitHub Actions), and gets versioned. A broken pipeline is a production outage for all teams.

**Choosing a stack:**
- GitHub shop → GitHub Actions + ArgoCD
- Azure shop → Azure DevOps Pipelines + ArgoCD
- Air-gapped / complex legacy → Jenkins + ArgoCD + Argo Rollouts
- CD layer: always GitOps (ArgoCD or Flux)

---

## 💥 Failure Modes & Incident Patterns

**Broken shared pipeline library** — all teams' pipelines fail simultaneously. Keep the library versioned; use a canary adoption pattern for breaking changes.

**Cascading deploy freeze** — flaky staging tests block all production deployments. Flaky tests are a P1; fix within the sprint.

**Secrets rotation break** — credentials rotated in Vault but not updated in pipeline config. Use dynamic credentials (OIDC, Vault dynamic secrets) to eliminate this class of failure.

**Drift between environments** — works in staging, fails in production. GitOps self-healing for both environments, production-like config in staging, infrastructure parity enforced by code.

---

## 💼 Interview & Design Review Prep

**"Design a CI/CD pipeline for 30 microservices"**
Monorepo vs polyrepo decision, selective builds (nx/Bazel), shared pipeline library, GitOps CD with ArgoCD, environment progression with gates, canary with Argo Rollouts, OIDC auth, Trivy scanning, Cosign signing.

**"How do you ensure a deployment doesn't break production?"**
Pre-deploy: tests + SAST + image scan + signing. At deploy: canary with Prometheus metric analysis. Post-deploy: SLO monitoring, automated rollback on breach.

**"What is GitOps vs traditional CD?"**
GitOps: pull-based, Git is source of truth, operator reconciles continuously. Traditional: push-based, pipeline writes directly to cluster. GitOps gives audit trail, rollback via `git revert`, drift detection, no outbound write credentials required.

**"How do you handle database migrations safely?"**
Expand-contract pattern: (1) add column nullable, (2) write to both old+new, (3) backfill, (4) read from new only, (5) drop old column. Never break old code with a migration. Each step is a separate deployment.

---

## 📚 Key Takeaways

1. **Trunk-based development is a prerequisite** — long-lived branches make CI/CD theater
2. **Fail fast at the cheapest stage** — lint before test, unit before integration
3. **Artifacts are immutable** — same image that passed CI goes to production; never rebuild
4. **GitOps = audit trail + rollback for free** — Git history is your deployment history
5. **OIDC eliminates long-lived secrets** — dynamic credentials via identity federation
6. **Sign your artifacts** — Cosign + Kyverno policy verification closes the supply chain gap
7. **Canary or fail** — never deploy 100% at once; automate rollback on SLO breach
8. **Shared pipeline libraries multiply the investment** — write once, all teams benefit
9. **Pipeline speed = developer productivity** — every minute saved × team size = real hours returned
10. **Test your rollback quarterly** — rollback that's never been tested will fail when needed
11. **Separate CI and CD permissions** — read for testing, write for deploy; mixing expands blast radius
12. **Environment parity is not optional** — staging without production-like config is theater
13. **Secret scanning in pre-commit is the last line of defense** — committed secrets are compromised
14. **Quality gates must be binary** — warning-only gates are no gates at all
15. **Design for developer experience first** — the best pipeline is one that developers trust and never work around



---

## 📁 Source Documents

> 30 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[SonarQube] 1740567845276](http://localhost:8765/api/documents/699f7255-3756-4944-a41d-7b0f9d2762c6/view) | PDF | intermediate |
| [[Terraform] 1742535124517](http://localhost:8765/api/documents/413d5837-a4dd-4e4e-8770-e3a41e387ff3/view) | PDF | intermediate |
| [[Kubernetes] 1741982484517](http://localhost:8765/api/documents/fd216c2c-db69-4047-98ce-e51cab099c39/view) | PDF | advanced |
| [[Github Action] 1743347890536](http://localhost:8765/api/documents/dc9902a1-517f-45df-a20f-693f492451ea/view) | PDF | intermediate |
| [[Interview Ouestions > Azure Devops] 1743182144138](http://localhost:8765/api/documents/f4dba52e-8f0f-49b6-b19e-d40bf91b055d/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1741085969236](http://localhost:8765/api/documents/ec731113-983c-4eab-84a5-3b4e07484e62/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1743105247143](http://localhost:8765/api/documents/98755c76-2eba-4330-8590-15b4dd9a0f01/view) | PDF | intermediate |
| [[Interview Ouestions > Jenkins] 1742587738930](http://localhost:8765/api/documents/917dd181-58a2-44a5-b98e-8973573c90dd/view) | PDF | intermediate |
| [[Interview Ouestions > Jenkins] 1742998084619](http://localhost:8765/api/documents/3ea45dcd-8d77-45c0-89b5-0d767e5344f1/view) | PDF | intermediate |
| [[Jenkins] 1716983029017](http://localhost:8765/api/documents/948b361e-e84c-4299-8d25-14977b428fd4/view) | PDF | intermediate |
| [[Jenkins] 1717577931872](http://localhost:8765/api/documents/a047a719-3333-4760-98f5-48ce60123915/view) | PDF | intermediate |
| [[Jenkins] 1735258490619](http://localhost:8765/api/documents/9bfbda92-0f09-4737-82b9-a7067751e493/view) | PDF | intermediate |
| [[Jenkins] 1739519968806](http://localhost:8765/api/documents/7e7af140-0d8d-4bbf-af6d-0553ec0da098/view) | PDF | intermediate |
| [[Jenkins] 1740831168229](http://localhost:8765/api/documents/f5b28a49-d12b-4d09-b9d8-bfc2649035c6/view) | GIF | intermediate |
| [[Jenkins] 1741510633643](http://localhost:8765/api/documents/d922f7ae-4e68-403d-8462-673b46de209f/view) | PDF | intermediate |
| [[Jenkins] 1741625031410](http://localhost:8765/api/documents/dc99bf8c-e0e4-4954-a9cd-5ba69bac63d8/view) | PDF | intermediate |
| [[Jenkins] 1742878809115](http://localhost:8765/api/documents/1b90f9fd-faf7-40ef-8061-1a83eaabb2b7/view) | PDF | intermediate |
| [[ArgoCD] 1743618800322](http://localhost:8765/api/documents/7225d464-6c0e-44b0-9293-f48ef945884d/view) | PDF | intermediate |
| [[Azure DevOps] 1740145317159](http://localhost:8765/api/documents/41aa9076-0b8f-4e62-b4be-36bc6daae103/view) | PDF | intermediate |
| [[Azure-Devops] 1741939519541](http://localhost:8765/api/documents/1848dc04-1e93-4b51-a8d9-c978596e1a4a/view) | PDF | intermediate |
| [[Azure-Devops] 1742899728232](http://localhost:8765/api/documents/9e860ec9-8597-491c-9c0c-2270d9826ac5/view) | PDF | intermediate |
| [[Git] 1739357836335](http://localhost:8765/api/documents/5e693bb2-a8af-48b0-9f06-14c05b6b0e15/view) | PDF | intermediate |
| [[Git] 1740051760233](http://localhost:8765/api/documents/d73c2cb9-526f-456f-9c7b-5a9474ecc10c/view) | PDF | intermediate |
| [[Git] 1740577213205](http://localhost:8765/api/documents/2291323f-0453-4ac6-84fc-fca985318de5/view) | PDF | intermediate |
| [[Git] 1740913277336](http://localhost:8765/api/documents/a1a93cde-8bdb-4c4b-84c2-5e8b8a1b303b/view) | GIF | intermediate |
| [[Git] 1741064210999](http://localhost:8765/api/documents/8a09b2a8-569f-4119-b6ba-fa8eaaf188b2/view) | JPG | intermediate |
| [[Git] 1744261184001](http://localhost:8765/api/documents/a30114cf-8ddf-490d-b87b-9e5ade7250ed/view) | PDF | intermediate |
| [[Github Action] 1739811510268](http://localhost:8765/api/documents/d60d49b0-4dbe-42eb-bccd-2a00a527243e/view) | PDF | intermediate |
| [[Github Action] 1742387729023](http://localhost:8765/api/documents/4c828e7d-ac95-4ced-b4d9-8c894aeb46f6/view) | PDF | intermediate |
| [[Github Action] 1742550678420](http://localhost:8765/api/documents/ae40dc6b-4bb9-4905-a8f8-b7b4471a9d19/view) | PDF | intermediate |


<AIChatWidget domain="cicd-gitops" title="Ask AI about CI/CD & GitOps" />
