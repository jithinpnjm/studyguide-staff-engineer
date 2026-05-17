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

---

## [SRE] Foundations: CI/CD Premium Teaching Guide For SRE And Platform Engineers

## Foundations: CI/CD Premium Teaching Guide For SRE And Platform Engineers

CI/CD is the system that moves a code change into production safely.

For SRE and platform engineers, CI/CD is not only automation. It is a reliability control system for reducing change risk, shortening feedback loops, proving artifact trust, and making rollback faster than panic.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — CI, CD, pipelines, artifacts, environments.
2. **Intermediate Layer** — tests, builds, approvals, rollout strategies.
3. **Advanced Layer** — GitOps, OIDC, SBOM, signing, policy gates.
4. **Production SRE Layer** — failed deploys, flaky pipelines, rollback design.
5. **Interview Layer** — explain safe delivery tradeoffs clearly.

---

## Memory Palace: CI/CD Is A Factory

| Concept | Factory Analogy | Real Meaning |
|---|---|---|
| Commit | Raw material | Proposed change |
| Pull Request | Design review desk | Human review |
| CI Pipeline | Inspection conveyor | Automated validation |
| Artifact | Finished product | Image, binary, package, chart |
| Registry | Warehouse | Artifact storage |
| Deploy | Shipping dock | Release to environment |
| Canary | Pilot shipment | Small rollout first |
| Blue-Green | Two warehouses | Fast traffic switch |
| Rollback | Product recall | Restore safe version |
| Signature | Tamper seal | Artifact trust proof |

---

## Beginner Layer: CI vs CD

### Continuous Integration

Every change is integrated and validated frequently.

Typical checks:

- formatting
- linting
- unit tests
- type checks
- build
- dependency scan
- secret scan

### Continuous Delivery

Every validated change is deployable, but production may require approval.

### Continuous Deployment

Every validated change automatically reaches production.

Most teams should mature to continuous delivery before continuous deployment.

---

## Beginner Layer: Pipeline Anatomy

A normal delivery path looks like this:

```text
PR -> lint -> test -> build -> scan -> publish artifact -> deploy staging -> smoke test -> approve -> production -> observe
```

Principle:

> Cheap checks early, expensive checks later.

Fast pipelines encourage good engineering behavior. Slow painful pipelines create bypass culture.

---

## Beginner Layer: Artifact Strategy

Deploy artifacts, not random working directories.

Examples:

- container image
- binary
- package
- Helm chart
- static site build

Good artifacts are:

- immutable
- versioned
- traceable to a commit
- scanned
- reproducible
- stored in a trusted registry

Build once, promote many.

---

## Intermediate Layer: Testing Strategy

| Test Type | Purpose | Where |
|---|---|---|
| Unit | Local logic | Early CI |
| Integration | Components together | Mid pipeline |
| Contract | API compatibility | Mid pipeline |
| End-to-End | User journey | Staging |
| Smoke | Basic health | Post deploy |
| Load | Capacity regression | Scheduled or gated |

Do not rely only on end-to-end tests. They are valuable, but expensive and often flaky when overused.

---

## Intermediate Layer: Credentials And Access

Avoid:

- long-lived cloud keys in CI
- secrets printed in logs
- secrets baked into images
- shared admin tokens

Prefer:

- OIDC federation
- short-lived credentials
- scoped environment secrets
- external secret managers
- least privilege roles

A pipeline credential should have only the permissions needed for that stage.

---

## Intermediate Layer: Deployment Strategies

### Rolling Update

Gradually replaces old instances. Good default for stateless services.

### Canary

Sends a small percentage of traffic to the new version first.

### Blue-Green

Keeps two environments and switches traffic.

### Feature Flags

Deploy code separately from exposing behavior.

Choose based on blast radius, rollback speed, and observability maturity.

---

## Advanced Layer: Progressive Delivery

Progressive delivery increases exposure only when health remains good.

```text
1% -> 5% -> 25% -> 50% -> 100%
```

Promotion gates should inspect:

- error rate
- latency
- saturation
- business success metrics
- logs and traces

Canary without metrics is delayed failure.

---

## Advanced Layer: GitOps

GitOps stores desired deployment state in Git.

```text
CI builds image -> updates manifests -> ArgoCD or Flux syncs cluster
```

Benefits:

- Git audit trail
- drift visibility
- rollback by revert
- reduced need for direct cluster access from CI

---

## Advanced Layer: Trusted Supply Chain

Ask:

- Which commit produced this artifact?
- What dependencies are included?
- Was it scanned?
- Was it signed?
- Can production verify it?

Useful concepts:

- SBOM
- provenance
- image signing
- digest pinning
- admission policy

Prefer immutable digests over mutable tags.

---

## Advanced Layer: Guardrails

Strong delivery systems use:

- branch protection
- required reviews
- CODEOWNERS
- required checks
- environment approvals
- protected runners
- audit logs

The goal is safe speed, not bureaucracy.

---

## Production SRE Layer: Real Incidents

### Bad Deploy Caused Error Spike

Response:

- compare deploy timestamp to metrics
- pause rollout
- rollback if confidence is high
- confirm recovery
- investigate after mitigation

### Pipeline Too Slow

Symptoms:

- bypass pressure
- giant pull requests
- hotfix culture

Fix:

- caching
- parallel tests
- split fast and slow suites
- targeted runs

### Flaky Tests Block Releases

Fix:

- quarantine flaky tests
- assign owners
- repair root causes
- stop normalizing blind reruns

### Wrong Image Deployed

Likely cause:

- mutable tag reused

Fix:

- immutable tags
- digest pinning
- release metadata

### Rollback Failed

Likely causes:

- database schema incompatibility
- old artifact missing
- config drift
- rollback path never tested

Rollback must be designed and rehearsed.

---

## Production SRE Layer: Troubleshooting Flow

### CI Fails

Check:

- recent dependency changes
- test logs
- environment mismatch
- credentials expiry

### Deploy Fails

Check:

- artifact exists
- correct manifest tag or digest
- RBAC and permissions
- cluster events
- health checks

### Production Degraded After Deploy

Check:

- version-by-version metrics
- logs and traces by release
- dependency saturation
- rollback readiness

---

## Interview Layer: Strong Answers

### Why separate build from deploy?

> Build once to produce a trusted immutable artifact, then promote the same artifact across environments.

### Why use short-lived credentials?

> Short-lived credentials reduce long-term secret exposure and allow access to be scoped to repo, branch, workflow, and environment.

### Why are mutable tags risky?

> The same tag can point to different content over time, which breaks reproducibility and rollback certainty.

### How do you design safe delivery?

> Fast CI feedback, trusted artifacts, least-privilege credentials, progressive rollout, strong observability, and tested rollback paths.

---

## Labs

### Beginner

1. Build CI for lint and test.
2. Publish a test report.
3. Build a container image.

### Intermediate

1. Add a security scan.
2. Add staging deploy.
3. Add smoke test.
4. Add manual approval for production.

### Advanced

1. Configure short-lived cloud auth.
2. Generate an SBOM.
3. Sign an image.
4. Deploy via GitOps.
5. Add a canary metric gate.
6. Practice rollback.

---

## Memory Review

- Why build once and promote many?
- Why is canary weak without metrics?
- Why use short-lived credentials?
- Why must rollback be tested?
- Why do slow pipelines create bypass behavior?

---

## Senior Summary

> I design CI/CD as a trusted delivery system: rapid feedback in CI, immutable artifacts, least-privilege credentials, controlled promotion across environments, observable progressive rollout, and rehearsed rollback. Change management should increase speed and safety simultaneously.

---

## [SRE] Foundations: Git Premium Teaching Guide For SRE And Platform Engineers

## Foundations: Git Premium Teaching Guide For SRE And Platform Engineers

Git is more than source control. For platform teams it is the audit trail for infrastructure, the trigger for CI/CD, the source of truth for GitOps, and the fastest safe rollback tool when change goes wrong.

This guide teaches Git from first principles to production-grade operational use.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — repos, commits, branches, remotes.
2. **Intermediate Layer** — merges, rebases, PR workflow, conflicts.
3. **Advanced Layer** — reflog, bisect, tags, history surgery.
4. **Production SRE Layer** — IaC review, rollback, GitOps discipline.
5. **Interview Layer** — explain tradeoffs calmly and clearly.

---

## Memory Palace: Engineering Control Room

| Concept | Analogy | Meaning |
|---|---|---|
| Working Tree | Draft desk | Current files |
| Staging Area | Approval tray | Next snapshot contents |
| Commit | Timestamped change record | Immutable history point |
| Branch | Route marker | Named pointer |
| Remote | Shared control room | Team repository |
| Tag | Milestone marker | Release point |
| Reflog | Security camera | HEAD movement history |

---

## Beginner Layer: What Git Really Stores

Git stores snapshots, not only patches.

```text
working tree -> index -> commit graph -> remote
```

A branch is usually just a movable pointer to a commit.

Cheap branches enable safer experimentation.

---

## Beginner Layer: Daily Safe Workflow

```bash
git status
git diff
git add file
git diff --staged
git commit -m "Clear message"
git push
```

Use `git status` constantly. It is your cockpit panel.

---

## Beginner Layer: Commit Messages That Matter

Weak:

```text
update files
```

Strong:

```text
Increase API timeout after dependency latency spikes in EU region
```

Explain intent, not only mechanics.

---

## Intermediate Layer: Branching Model

Good names:

- feature/add-labs
- fix/pages-build
- docs/networking-refresh
- hotfix/prod-timeout

Keep branches focused and short-lived when possible.

---

## Intermediate Layer: Pull Requests

A good PR explains:

- what changed
- why it changed
- how it was tested
- blast radius
- rollback plan

For infrastructure PRs, blast radius matters as much as code quality.

---

## Intermediate Layer: Merge vs Rebase

### Merge

Preserves exact branch history.

Best when:

- many contributors touched branch
- integration history matters

### Rebase

Replays commits on new base.

Best when:

- cleaning local feature branch
- keeping history linear

Rule:

> Do not rewrite shared public history casually.

---

## Intermediate Layer: Conflict Resolution

Conflict markers mean Git needs a human decision.

```text
<<<<<<<
=======
>>>>>>>
```

Correct approach:

1. Understand both changes.
2. Edit intentionally.
3. Re-test.
4. Continue merge/rebase.

---

## Advanced Layer: Safe Undo Options

### Restore file

```bash
git restore file
```

### Unstage

```bash
git restore --staged file
```

### Revert shared history safely

```bash
git revert SHA
```

### Reset local history

```bash
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
```

Use reset carefully. Prefer revert on shared branches.

---

## Advanced Layer: Reflog = Recovery Superpower

```bash
git reflog
git switch -c rescue HEAD@{3}
```

Use after:

- bad rebase
- accidental reset
- detached HEAD confusion
- lost local commits

Many “lost” commits are recoverable.

---

## Advanced Layer: Git Bisect

Use binary search to find the breaking commit.

```bash
git bisect start
git bisect bad
git bisect good v1.0.0
```

Excellent for regressions where many commits landed.

---

## Advanced Layer: Tags And Releases

Use annotated tags for real releases.

```bash
git tag -a v2.1.0 -m "Release"
git push origin v2.1.0
```

Useful for:

- deployments
- rollback anchors
- changelog generation
- audit history

---

## Production SRE Layer: Git For Infrastructure

Git often controls:

- Terraform
- Kubernetes manifests
- Helm charts
- CI workflows
- dashboards as code
- runbooks
- alert rules

Change quality in Git directly affects production risk.

---

## Production SRE Layer: GitOps Discipline

```text
Git desired state -> controller syncs runtime
```

Meaning:

- manual cluster edits may be reverted
- emergency changes must be backported to Git
- drift becomes visible

If it is not in Git, it may not persist.

---

## Production SRE Layer: Real Incidents

### Bad Config Merged To Main

Action:

- revert quickly
- validate recovery
- inspect review/test gaps

### Secret Committed

Action:

- rotate secret immediately
- revoke old credential
- scrub history if needed
- audit exposure

History cleanup alone does not un-leak a secret.

### Force Push Broke Shared Branch

Action:

- stop more pushes
- inspect reflog / remote refs
- restore known good state carefully

### GitOps Reverted Manual Hotfix

Cause:

Desired state in Git differed from cluster.

Fix:

Commit the hotfix properly.

---

## Production SRE Layer: Troubleshooting Flow

### CI Fails After Merge

Check:

- missing files in commit
- merge conflict logic bug
- environment assumptions

### Unsure What Changed

Use:

```bash
git log --oneline --graph
git show SHA
git diff old..new
```

### Need Fast Rollback

Prefer:

```bash
git revert SHA
```

---

## Interview Layer: Strong Answers

### Why is revert safer than reset on main?

> Revert preserves shared history and creates an explicit undo commit.

### When use rebase?

> For local branch cleanup before review, not for rewriting shared team history casually.

### How find breaking commit?

> Use logs for timing and `git bisect` for systematic isolation.

### Why is Git critical for SRE?

> It governs infrastructure changes, deployment automation, rollback speed, and auditability.

---

## Labs

### Beginner

1. Create repo.
2. Make commits.
3. Create branch.
4. Open PR.

### Intermediate

1. Resolve conflict.
2. Rebase feature branch.
3. Tag release.

### Advanced

1. Recover commit with reflog.
2. Find regression with bisect.
3. Simulate bad deploy then revert.
4. Practice GitOps rollback.

---

## Memory Review

- Why are branches cheap?
- Why prefer revert on main?
- What does reflog save?
- Why can GitOps undo manual fixes?
- Why should commit messages explain intent?

---

## Senior Summary

> I treat Git as the operational control plane for software and infrastructure. I use protected branches, clear PR reviews, safe rollback via revert, clean local history via rebase, and reflog/bisect for recovery and debugging. Good Git hygiene directly reduces production risk.

---

## [SRE] Foundations: Delivery Systems, Jenkins, GitHub Actions, And ArgoCD Premium Teaching Guide

## Foundations: Delivery Systems, Jenkins, GitHub Actions, And ArgoCD Premium Teaching Guide

Delivery systems turn code changes into safe production reality.

For SRE and platform engineers, delivery is not only automation. It is risk management: who can ship, what gets verified, how artifacts are trusted, how rollbacks work, and how drift is corrected.

This guide teaches practical delivery systems from first principles to production-grade operations.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — CI, CD, pipelines, artifacts, environments.
2. **Intermediate Layer** — Jenkins, GitHub Actions, ArgoCD, approvals.
3. **Advanced Layer** — GitOps, OIDC, runners, rollout safety.
4. **Production SRE Layer** — broken pipelines, failed deploys, drift.
5. **Interview Layer** — explain safe delivery architecture clearly.

---

## Memory Palace: Factory + Shipping Port

| Concept | Analogy | Meaning |
|---|---|---|
| Commit | Raw material | Proposed change |
| PR | Design review desk | Human review |
| CI | Quality line | Validation automation |
| Artifact | Finished product | Image/binary/package |
| Registry | Warehouse | Artifact storage |
| CD | Shipping dock | Release automation |
| ArgoCD | Port robot | Sync Git to cluster |
| Rollback | Product recall | Restore safe version |

---

## Beginner Layer: CI vs CD vs GitOps

### CI

Validates every change.

Typical checks:

- lint
- test
- build
- scan

### CD

Moves validated changes to environments.

### GitOps

Git stores desired runtime state. A controller reconciles actual state to Git.

```text
CI builds image -> manifest updated -> ArgoCD syncs cluster
```

---

## Beginner Layer: Healthy Pipeline Shape

```text
PR -> checks -> build artifact -> publish -> deploy staging -> smoke test -> approve -> production -> observe
```

Principles:

- cheap checks early
- expensive checks later
- build once promote many
- fast rollback path

---

## Beginner Layer: Artifact Trust

Good artifacts are:

- immutable
- traceable to commit
- scanned
- versioned
- reproducible

Avoid mutable `latest` in production.

---

## Intermediate Layer: Jenkins Explained

Best for:

- legacy enterprises
- private networks
- custom pipelines
- unusual build environments

Architecture:

```text
Controller -> queue -> agents -> workspaces
```

Operational risks:

- plugin sprawl
- credential sprawl
- controller bottleneck
- snowflake jobs

Use ephemeral agents when possible.

---

## Intermediate Layer: GitHub Actions Explained

Best for:

- GitHub-native teams
- fast onboarding
- repo-based workflows

Key parts:

- workflow
- job
- step
- runner
- environment
- artifact

Use branch protection and required checks.

---

## Intermediate Layer: ArgoCD Explained

ArgoCD compares:

```text
Git desired state <-> cluster actual state
```

States:

- Synced
- OutOfSync
- Healthy
- Degraded

Why teams like it:

- Git audit trail
- drift visibility
- rollback by Git revert
- less direct cluster access from CI

---

## Intermediate Layer: Environment Controls

Use environments such as:

- dev
- staging
- production

Production controls may include:

- approvals
- restricted secrets
- deployment windows
- separate credentials

---

## Advanced Layer: OIDC Instead Of Static Secrets

Prefer short-lived cloud credentials issued at runtime.

Benefits:

- no long-lived keys in CI
- scoped trust policies
- better auditability
- easier rotation model

---

## Advanced Layer: Self-Hosted Runners

Use when needing:

- private network access
- custom hardware
- GPU builds
- compliance controls

Risks:

- persistence between jobs
- secret leakage
- untrusted code risk

Use isolated ephemeral runners for sensitive workloads.

---

## Advanced Layer: Rollout Strategies

- rolling update
- canary
- blue-green
- feature flags

Choose based on blast radius and rollback speed.

Canary without observability is guesswork.

---

## Advanced Layer: GitOps Safety

Use:

- PR review on manifests
- protected branches
- sync windows if needed
- RBAC in ArgoCD
- project boundaries
- diff visibility

---

## Production SRE Layer: Real Incidents

### CI Passed But Prod Failed

Likely gaps:

- config path untested
- manifest wrong
- missing secret
- dependency mismatch

### ArgoCD OutOfSync Repeatedly

Likely causes:

- manual cluster edits
- HPA changing replicas
- controller-mutated fields

### Pipeline Slow And Painful

Fix:

- cache dependencies
- parallelize jobs
- split fast/slow suites
- remove waste

### Runner Outage Blocks Deploys

Need:

- runner redundancy
- autoscaling pool
- separate critical deploy runners

### Rollback Failed

Often due to:

- database schema changes
- missing old artifact
- incompatible config

Rollback must be designed in advance.

---

## Production SRE Layer: Troubleshooting Flow

### Build Failing
nCheck:

- dependency registry
- credentials
- changed tool versions
- test logs

### Deploy Failing

Check:

- artifact exists
- correct image digest
- permissions
- cluster health
- readiness failures

### Drift Suspected

Check:

- ArgoCD diff
- recent manual changes
- automation controllers

---

## Interview Layer: Strong Answers

### Why separate CI from CD?

> CI validates and builds trusted artifacts. CD promotes verified artifacts safely through environments.

### Why GitOps?

> Git becomes the audit trail and source of truth. Drift becomes visible and rollback can be a Git revert.

### Why are mutable tags risky?

> The same tag may point to different content over time, breaking reproducibility.

### How do you secure pipelines?

> Least privilege, short-lived credentials, approvals, protected branches, signed artifacts, and strong logging.

---

## Labs

### Beginner

1. Build a test workflow.
2. Publish an artifact.
3. Add staging deploy.

### Intermediate

1. Add approval gate.
2. Build and push image.
3. Deploy with ArgoCD.

### Advanced

1. Configure OIDC cloud auth.
2. Simulate drift and self-heal.
3. Add canary rollout.
4. Practice rollback.

---

## Memory Review

- Why build once promote many?
- Why is GitOps useful?
- Why are self-hosted runners risky?
- Why can schema changes break rollback?
- Why should prod access be tighter than dev?

---

## Senior Summary

> I design delivery systems around fast feedback, immutable trusted artifacts, least-privilege credentials, controlled promotion, observable rollout, and rehearsed rollback. For Kubernetes I prefer GitOps so desired state is versioned and drift is visible.

---

## [SRE] Azure DevOps Crossover for Platform Engineers

## Azure DevOps Crossover for Platform Engineers

### What It Is and Why It Matters

Azure DevOps is Microsoft's integrated DevOps platform. It combines five services: Boards (work tracking), Repos (Git hosting), Pipelines (CI/CD), Artifacts (package registry), and Test Plans (testing management).

If you come from GitHub Actions or Jenkins, Azure DevOps uses the same fundamental patterns — pipelines triggered by events, stages with jobs and steps, environments for approvals, service connections for credentials. The vocabulary differs but the concepts translate directly.

Understanding Azure DevOps matters because: many enterprise organizations run on it (especially Microsoft/.NET shops), it integrates natively with Azure cloud services, and job descriptions often list it as a requirement even when GitHub Actions would work equally well.

---

### Mental Model: Mapping to GitHub Actions

| GitHub Actions | Azure DevOps Pipelines |
|----------------|----------------------|
| Workflow | Pipeline |
| Job | Job |
| Step | Step (task) |
| Runner (GitHub-hosted) | Microsoft-hosted agent |
| Self-hosted runner | Self-hosted agent |
| Environment | Environment (with approvals) |
| Secret | Variable / Secret Variable |
| `on: push` | trigger: |
| Service container | Service container |
| `uses: actions/checkout@v4` | `checkout` built-in task |
| `uses: docker/build-push-action` | `Docker@2` task |

---

### Azure Pipelines Core Syntax

#### Basic Pipeline

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - 'release/*'
  paths:
    exclude:
      - docs/*
      - '*.md'

pr:
  branches:
    include:
      - main

variables:
  IMAGE_REPO: 'myregistry.azurecr.io/myapp'
  DOCKER_TAG: '$(Build.BuildId)'

pool:
  vmImage: 'ubuntu-latest'      # Microsoft-hosted agent

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        steps:
          - checkout: self       # clone the repo
            fetchDepth: 0        # full clone for git history

          - task: UsePythonVersion@0
            inputs:
              versionSpec: '3.11'
              addToPath: true

          - script: |
              pip install -r requirements.txt
              pytest tests/ --junitxml=test-results.xml
            displayName: 'Run tests'

          - task: PublishTestResults@2
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: 'test-results.xml'
            condition: always()   # run even if previous step failed

          - task: Docker@2
            displayName: 'Build and push image'
            inputs:
              containerRegistry: 'my-acr-service-connection'
              repository: 'myapp'
              command: 'buildAndPush'
              tags: |
                $(DOCKER_TAG)
                latest

  - stage: DeployStaging
    displayName: 'Deploy to Staging'
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployToStaging
        environment: 'staging'   # requires approval if environment has it configured
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@0
                  displayName: 'Deploy to Kubernetes'
                  inputs:
                    action: 'deploy'
                    kubernetesServiceConnection: 'staging-k8s-connection'
                    namespace: 'staging'
                    manifests: 'k8s/deployment.yaml'
                    containers: '$(IMAGE_REPO):$(DOCKER_TAG)'

  - stage: DeployProduction
    displayName: 'Deploy to Production'
    dependsOn: DeployStaging
    jobs:
      - deployment: DeployToProd
        environment: 'production'   # requires manual approval
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@0
                  inputs:
                    action: 'deploy'
                    kubernetesServiceConnection: 'prod-k8s-connection'
                    namespace: 'production'
                    manifests: 'k8s/deployment.yaml'
                    containers: '$(IMAGE_REPO):$(DOCKER_TAG)'
```

#### Variable Groups and Secrets

Variables are the equivalent of GitHub Actions secrets. Secret variables are masked in logs:

```yaml
# Variable group (defined in Azure DevOps Library)
variables:
  - group: 'production-credentials'    # links to a Library variable group
  - name: 'BUILD_CONFIG'
    value: 'Release'

# Reference in steps
- script: echo "Database: $(DB_HOST)"   # $(variable-name) syntax
```

Variable types:
- **Pipeline variables**: defined in YAML, visible in source
- **Secret variables**: defined in Library or Environment, masked in logs
- **Variable groups**: reusable collections linked to Azure Key Vault

#### Service Connections

Service connections are credentials stored in Azure DevOps for connecting to external services:

```yaml
# Use ACR service connection for Docker
- task: Docker@2
  inputs:
    containerRegistry: 'myacr-service-connection'   # name of the service connection
    ...

# Use Kubernetes service connection
- task: KubernetesManifest@0
  inputs:
    kubernetesServiceConnection: 'prod-aks-connection'
    ...

# Use Azure Resource Manager connection (for Azure resources)
- task: AzureCLI@2
  inputs:
    azureSubscription: 'my-azure-subscription-connection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      az aks get-credentials --name my-cluster --resource-group my-rg
```

Service connection types:
- Docker Registry (ACR, Docker Hub)
- Kubernetes (AKS or generic kubeconfig)
- Azure Resource Manager (ARM) — for managing Azure resources
- GitHub — for triggering builds from GitHub repos
- SSH — for connections to VMs

#### Environments and Approvals

Environments in Azure DevOps provide deployment tracking and approval gates:

```yaml
jobs:
  - deployment: DeployProduction
    environment:
      name: 'production'
      resourceType: Kubernetes   # can scope to specific K8s namespace
      tags: 'prod'
```

In the Azure DevOps UI → Environments → production:
- Add approval check (specific users/groups must approve before deploy proceeds)
- Add branch control (only deploys from `main` branch)
- Add business hours check (only deploy during business hours)
- Deployment history visible per environment

---

### Azure Repos

Azure Repos is Azure DevOps's Git hosting. It works identically to GitHub or GitLab at the Git protocol level.

```bash
# Clone
git clone https://dev.azure.com/org/project/_git/myrepo

# Branch policies (configured in UI, equivalent to GitHub branch protection):
# - Require pull request reviews
# - Require minimum reviewer count
# - Require linked work items
# - Require successful build before merge
# - Comment resolution policy
```

Cross-repository triggers — trigger pipeline B when pipeline A succeeds or when repository B changes:

```yaml
resources:
  repositories:
    - repository: k8s-manifests
      type: git
      name: org/k8s-manifests
      trigger:
        branches:
          include: [main]
```

---

### Azure Artifacts

Azure Artifacts is a package registry supporting npm, NuGet, Maven, Python (pip), and Universal Packages:

```yaml
# Publish a Python package
- task: TwineAuthenticate@1
  inputs:
    artifactFeed: 'myproject/myfeed'

- script: |
    pip install twine build
    python -m build
    twine upload -r "myfeed" dist/*
```

Upstream sources: configure a feed to proxy requests to npmjs.com or PyPI, caching packages internally. Useful for air-gapped environments.

---

### Azure DevOps vs GitHub Actions Tradeoffs

| Aspect | Azure DevOps Pipelines | GitHub Actions |
|--------|----------------------|----------------|
| Source code hosting | Azure Repos or GitHub | GitHub |
| YAML schema | More verbose, explicit stages | Concise, nested jobs |
| Approval gates | Native, configurable per environment | Via environment protection rules |
| Self-hosted agents | Agent pools, VMSS scaling | Runner groups |
| Azure integration | First-class (service connections) | Via OIDC |
| Marketplace | Azure DevOps Extensions | GitHub Marketplace |
| RBAC | Project + organization hierarchy | Organization → repo level |
| Cost model | Per agent minute | Per runner minute |

Choose Azure DevOps when: deep Azure integration is needed, your organization is heavily invested in the Microsoft ecosystem, you need the work tracking (Boards) integrated with deployments, or regulatory compliance requires the enterprise audit features.

Choose GitHub Actions when: your code is on GitHub, you want simpler YAML, your team already uses GitHub for collaboration, or you prefer the larger open-source community ecosystem.

---

### Azure Container Registry (ACR)

ACR is Azure's managed Docker registry, used with Azure DevOps Pipelines:

```bash
# Authenticate to ACR
az acr login --name myregistry

# Or use service principal
docker login myregistry.azurecr.io \
  --username <service-principal-id> \
  --password <service-principal-secret>

# Push image
docker tag myapp:latest myregistry.azurecr.io/myapp:v1.0
docker push myregistry.azurecr.io/myapp:v1.0

# List images
az acr repository list --name myregistry

# Geo-replication
az acr replication create --registry myregistry --location eastus
az acr replication create --registry myregistry --location westeurope
# Images replicated across regions for low-latency pulls
```

ACR tasks: build images in the cloud directly from source code without a CI agent:

```bash
# Build and push in the cloud
az acr build --registry myregistry --image myapp:latest .
```

---

### Azure Kubernetes Service (AKS)

AKS is Azure's managed Kubernetes. Key differences from AWS EKS:

| Aspect | AKS | EKS |
|--------|-----|-----|
| Control plane cost | Free | $0.10/hr (~$72/month) |
| Node identity | Azure Managed Identity | IAM IRSA (OIDC) |
| Networking | Azure CNI or Kubenet | VPC CNI |
| Load balancer | Azure Load Balancer | AWS ALB/NLB |
| Storage CSI | Azure Disk, Azure Files | EBS, EFS |
| Node autoscaler | Cluster Autoscaler built-in | Karpenter or CA |
| Managed node upgrades | Node surge upgrades | Managed node groups |

```bash
# Get credentials
az aks get-credentials --resource-group myRG --name myCluster

# Node pool management
az aks nodepool add \
  --resource-group myRG \
  --cluster-name myCluster \
  --name gpupool \
  --node-vm-size Standard_NC6s_v3 \
  --node-count 1 \
  --labels hardware=gpu

# Upgrade cluster
az aks get-upgrades --resource-group myRG --name myCluster
az aks upgrade --resource-group myRG --name myCluster --kubernetes-version 1.28.5
```

**Workload Identity** (AKS equivalent of IRSA):

```yaml
# Service account annotation for Azure Workload Identity
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  annotations:
    azure.workload.identity/client-id: "<managed-identity-client-id>"
```

The pod gets a federated token that Azure AD validates — no credentials stored in the pod.

---

### Common Failure Modes

**Service connection expired:** Azure DevOps service connections using service principals expire. Pipelines start failing with `401 Unauthorized`. Fix: rotate the service principal secret and update the service connection.

**Agent offline:** Self-hosted agents go offline (VM stopped, agent service crashed). Pipelines queue but never start. Fix: check agent pool in Azure DevOps, restart the agent service on the VM.

**Approval gate blocking deploy:** Pipeline is waiting in production environment for approval, but the approver hasn't been notified. Fix: configure email/Teams notifications for pending approvals. Add a timeout to prevent indefinite blocking.

**Variable group not linked:** Pipeline references a variable group that exists in a different project or isn't linked. Variables resolve as empty strings. Fix: ensure the variable group is created in the same project and linked to the pipeline.

**Branch policy blocking PR:** PR can't be completed because a required reviewer hasn't approved, or the build is failing. Fix: check the branch policies for the target branch, address each required check.

---

### Key Questions and Answers

**Q: What are the key differences between Azure DevOps Pipelines and GitHub Actions?**

Both are YAML-based event-driven CI/CD systems. Azure DevOps is more verbose and explicit — stages, jobs, and steps are always declared. GitHub Actions is more concise — jobs can reference reusable workflows and actions more easily. Azure DevOps has deeper integration with Azure cloud (service connections for ARM, AKS, ACR are first-class). GitHub Actions has deeper integration with GitHub (OIDC to any cloud is straightforward, larger marketplace). For approval gates: Azure DevOps environments have richer approval policies (business hours, branch control, required reviewers). GitHub Actions environments have simpler required reviewers. Choose based on your source control host and primary cloud provider.

**Q: How do you handle secrets in Azure DevOps Pipelines?**

Define secret variables in the pipeline (marked as "Keep this value secret") or in Library variable groups. Secret variables are masked in pipeline logs. For production, use variable groups linked to Azure Key Vault — secrets are pulled from Key Vault at runtime and never stored in Azure DevOps. Reference in YAML with `$(variable-name)`. Never echo or print secrets in script steps. Use the `AzureKeyVault@2` task for explicit Key Vault integration.

**Q: How does Azure Workload Identity compare to AWS IRSA?**

Both allow pods to authenticate to cloud APIs without static credentials. IRSA uses OIDC tokens issued by the EKS cluster's OIDC provider, validated against an IAM role trust policy. Azure Workload Identity uses federated credentials — the pod gets a federated token, and Azure AD validates it against a managed identity. Both result in short-lived credentials that auto-rotate. The difference is naming and the specific federation mechanism. The conceptual model is identical: pod service account → short-lived federated token → cloud IAM role → permissions.

---

### Points to Remember

- Azure DevOps = Boards + Repos + Pipelines + Artifacts + Test Plans
- Pipeline syntax: stages contain jobs; jobs contain steps; stages can have conditions and dependencies
- Service connections: stored credentials for external systems (ACR, AKS, Azure, GitHub)
- Environments: provide deployment history, approval gates, and traceability
- Variable groups: reusable secret/variable collections, can link to Azure Key Vault
- ACR: Azure Container Registry, with geo-replication for multi-region
- AKS control plane is free (vs EKS which charges ~$72/month)
- Workload Identity: pods authenticate to Azure without credentials, same concept as IRSA
- Azure DevOps RBAC: Organization → Project → Team → Resource level hierarchy
- Branch policies in Azure Repos = branch protection rules in GitHub

### What to Study Next

- [CI/CD and Trusted Delivery](./cicd-trusted-delivery-and-platform-security) — security patterns applicable to all CI/CD
- [Delivery Systems: Jenkins, GitHub Actions, ArgoCD](./delivery-systems-jenkins-github-actions-and-argocd) — compare with other delivery tools
- [AWS Cloud Services and Platform Design](./aws-cloud-services-and-platform-design) — AWS equivalent patterns
