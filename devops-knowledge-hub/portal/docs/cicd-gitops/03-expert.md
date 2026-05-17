---
title: "Expert"
sidebar_position: 3
---

# CI/CD & GitOps — Expert

Expert-level CI/CD is trusted delivery architecture. The central question is no longer “does the pipeline run?” It is: can we prove what is running in production, who reviewed it, which controls verified it, and how quickly we can stop or reverse a bad change?

---

## Trusted Delivery Control Plane

A staff-level delivery system has five contracts.

```text
source control -> CI -> artifact registry -> GitOps state -> runtime admission
```

| Layer | Contract |
|---|---|
| Source control | Reviewed changes on protected branches |
| CI | Deterministic build from reviewed source |
| Registry | Immutable artifact storage and metadata |
| GitOps repo | Desired runtime state per environment |
| Runtime platform | Only approved artifacts and manifests are admitted |

If one layer cannot prove its contract, the delivery chain is weak.

---

## Source-To-Production Traceability

A strong answer to “what is running in production?” should include:

- Git commit SHA
- Pull request and reviewer history
- CI run identifier
- Artifact digest
- Scan result
- Signature or attestation
- GitOps commit that promoted the artifact
- ArgoCD sync history
- Kubernetes audit event or deployment revision

Production should run an artifact produced by CI from reviewed source, not a locally built image or a mutable tag.

---

## Immutable Tags And Digest Pinning

Mutable tags are convenient but risky.

Bad:

```yaml
image: registry.example.com/myapp:latest
```

Better:

```yaml
image: registry.example.com/myapp:2026-05-17-abc123
```

Best for high assurance:

```yaml
image: registry.example.com/myapp@sha256:111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000
```

Digest pinning makes rollback and audit reliable because the image reference cannot silently move.

---

## Artifact Metadata

An expert pipeline attaches metadata to every artifact:

| Metadata | Why it matters |
|---|---|
| Commit SHA | Links runtime back to source |
| Build URL | Links artifact to CI execution |
| SBOM | Identifies dependencies inside the artifact |
| Scan summary | Shows known risk at promotion time |
| Signature | Shows artifact was produced by the expected builder |
| Deployment environment | Shows where it was promoted |

Example OCI labels:

```dockerfile
LABEL org.opencontainers.image.revision=$GIT_SHA
LABEL org.opencontainers.image.source="https://github.com/org/repo"
LABEL org.opencontainers.image.created=$BUILD_TIME
```

---

## OIDC And Short-Lived Build Identity

Static keys in CI age badly. They leak, get copied, and are hard to rotate. A better pattern is workload identity federation: the CI provider proves workflow identity to the cloud provider and receives short-lived permissions for the specific job.

GitHub Actions example shape:

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Configure cloud identity
        run: echo "exchange workflow identity for short-lived cloud access"
```

Design rules:

- Scope identity to repository, branch, workflow, and environment.
- Separate build permissions from deploy permissions.
- Do not allow pull requests from unknown forks to access privileged contexts.
- Log every promotion event.

---

## Multi-Tenant CI Platform Design

A multi-tenant CI platform has different trust tiers.

| Tier | Example workload | Isolation pattern |
|---|---|---|
| Low trust | External PR or fork build | No privileged contexts, isolated runner pool |
| Medium trust | Internal team CI | Namespace or project isolation, scoped caches |
| High trust | Production promotion | Dedicated runner pool, approval gate, audited actions |

A namespace alone is not a full isolation boundary. For high-risk workloads, use separate node pools, separate projects/accounts, or separate clusters.

Design controls:

- Ephemeral workspaces
- No shared mutable build directories
- Clear cache boundaries
- Restricted network egress
- Separate production promotion workers
- Logs retained for audit

---

## GitOps At Expert Level

GitOps is not just “ArgoCD applies YAML.” It is a reconciliation model.

```text
Git desired state <-> runtime actual state
```

Expert design questions:

1. Which repo owns desired state?
2. Who can approve environment changes?
3. How do emergency runtime changes get backported to Git?
4. Which fields are ignored because controllers mutate them?
5. How is drift surfaced and routed?
6. What is the rollback path: Argo rollback or Git revert?

Manual changes can be useful during incidents, but if the GitOps controller self-heals, manual changes may disappear. The long-term fix must be committed to Git.

---

## Progressive Delivery With Automated Judgment

A progressive delivery controller should decide promotion based on observed health, not time alone.

```text
set 5% traffic
  -> wait
  -> query metrics
  -> continue or abort
```

Useful gates:

- HTTP 5xx rate
- Request latency percentile
- Pod restart rate
- Saturation metrics
- Queue lag
- Business transaction success

Prometheus-style signals:

```promql
sum(rate(http_requests_total{status=~"5..",version="canary"}[5m]))
/
sum(rate(http_requests_total{version="canary"}[5m]))
```

A canary should fail closed. If metrics are missing or the query is broken, do not silently promote.

---

## Delivery Platform SLIs

Your delivery platform is itself a reliability dependency.

Track:

| SLI | Why it matters |
|---|---|
| CI success rate excluding app failures | Platform health |
| P95 queue time | Runner capacity |
| P95 build duration | Developer productivity |
| Deployment duration | Release reliability |
| Rollback duration | Incident response |
| ArgoCD OutOfSync age | Drift risk |
| Flaky-test rate | Trust erosion |
| Shadow pipeline count | Platform adoption failure |

When teams create unofficial pipelines, the golden path is probably too slow, too limited, or too painful.

---

## Expert Failure Modes

### Wrong Artifact Deployed

Likely causes:

- Mutable tag reused
- Build happened outside CI
- Staging and production rebuilt separately
- Promotion updated the wrong environment overlay

Prevention:

- Use digest pinning
- Attach metadata
- Promote by digest
- Require diff review for production overlays

### Delivery Control Broke All Teams

Likely causes:

- Shared Jenkins library changed without canary adoption
- Reusable GitHub workflow changed with breaking inputs
- Global runner image updated without test cohort

Prevention:

- Version shared libraries
- Canary pipeline changes with one or two services
- Maintain rollback for runner images
- Publish migration guides

### GitOps Reverted Manual Hotfix

Cause:

- Runtime actual state differed from Git desired state
- Controller self-healed the manual change

Fix:

- Commit the fix to Git
- Use documented break-glass flow only for emergency mitigation
- Review why normal promotion was too slow

---

## Expert Takeaways

1. Trusted delivery requires traceability from source to runtime.
2. Artifact digest is stronger than image tag.
3. GitOps makes drift visible, but it also enforces discipline.
4. CI identity should be short-lived and scoped.
5. Multi-tenant CI must distinguish trust levels.
6. Delivery platform SLIs are real production SLIs.
7. Progressive delivery must use health signals, not only pauses.
8. Rollback must be rehearsed before it is needed.

---

## Supply Chain Security: SLSA, Sigstore, SBOM, In-Toto

### SLSA Levels

SLSA (Supply-chain Levels for Software Artifacts) is a framework for progressively hardening the build supply chain.

| Level | What it requires |
|---|---|
| SLSA 1 | Provenance generated but unsigned. Scripts document the build. |
| SLSA 2 | Provenance signed by the build service. Source and build platform authenticated. |
| SLSA 3 | Provenance comes from a hardened, isolated, verified build service. Builder is trusted. |
| SLSA 4 (deprecated as separate level) | Two-party review for all changes; reproducible builds. Now folded into track model. |

A SLSA 2 build from GitHub Actions looks like this in practice: the CI workflow generates a signed provenance document that attests which workflow, repository, ref, and trigger produced the artifact. The provenance is uploaded to the registry alongside the image.

### Sigstore / Cosign Keyless Signing

Keyless signing eliminates long-lived private keys. The CI workflow obtains a short-lived OIDC certificate from Sigstore's Fulcio CA, signs the image, and uploads the signature to Sigstore's Rekor transparency log.

```bash
# Sign an image keylessly in a CI context (GitHub Actions, env provides OIDC token)
cosign sign \
  --yes \
  registry.example.com/myapp@sha256:<digest>

# Verify signature — checks Rekor transparency log
cosign verify \
  --certificate-identity-regexp "https://github.com/org/myapp" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  registry.example.com/myapp@sha256:<digest>

# Sign with a KMS key (deterministic, requires key management)
cosign sign \
  --key awskms:///alias/cosign-signing-key \
  registry.example.com/myapp@sha256:<digest>

# Verify with KMS key
cosign verify \
  --key awskms:///alias/cosign-signing-key \
  registry.example.com/myapp@sha256:<digest>

# Attach an SBOM to an image
cosign attach sbom \
  --sbom myapp.spdx.json \
  registry.example.com/myapp@sha256:<digest>

# Attach a custom attestation (e.g., scan results)
cosign attest \
  --yes \
  --predicate scan-result.json \
  --type vuln \
  registry.example.com/myapp@sha256:<digest>
```

### SBOM Generation with Syft and Grype

```bash
# Generate SBOM in SPDX JSON format
syft registry.example.com/myapp:$IMAGE_TAG \
  -o spdx-json=myapp.spdx.json

# Generate SBOM in CycloneDX format
syft registry.example.com/myapp:$IMAGE_TAG \
  -o cyclonedx-json=myapp.cdx.json

# Scan SBOM for known vulnerabilities
grype sbom:myapp.spdx.json \
  --fail-on high

# Full pipeline: build, generate SBOM, scan, sign, attach SBOM
IMAGE="registry.example.com/myapp"
TAG="${GITHUB_SHA}"

docker build -t ${IMAGE}:${TAG} .
syft ${IMAGE}:${TAG} -o spdx-json > ${TAG}.spdx.json
grype sbom:${TAG}.spdx.json --fail-on critical
cosign sign --yes ${IMAGE}@$(docker inspect --format='{{index .RepoDigests 0}}' ${IMAGE}:${TAG})
cosign attach sbom --sbom ${TAG}.spdx.json ${IMAGE}@<digest>
```

### GitHub Actions Full Supply Chain Workflow

```yaml
jobs:
  build-sign-attest:
    runs-on: ubuntu-latest
    permissions:
      id-token: write        # OIDC for keyless cosign
      contents: read
      packages: write
      attestations: write    # GitHub artifact attestation

    steps:
      - uses: actions/checkout@v4

      - name: Build image
        id: build
        run: |
          docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .
          docker push ghcr.io/${{ github.repository }}:${{ github.sha }}
          DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' \
            ghcr.io/${{ github.repository }}:${{ github.sha }} | cut -d@ -f2)
          echo "digest=${DIGEST}" >> $GITHUB_OUTPUT

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}
          format: spdx-json
          output-file: sbom.spdx.json

      - name: Scan for vulnerabilities
        uses: anchore/scan-action@v3
        with:
          sbom: sbom.spdx.json
          fail-build: true
          severity-cutoff: critical

      - name: Sign image with Cosign (keyless)
        uses: sigstore/cosign-installer@v3

      - run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      - name: GitHub artifact attestation
        uses: actions/attest-build-provenance@v1
        with:
          subject-name: ghcr.io/${{ github.repository }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true
```

### In-Toto Attestations

In-toto is the framework underlying SLSA provenance. An attestation is a signed statement about an artifact: "this image was built from this commit by this workflow." Cosign uses the in-toto envelope format for attestations.

```bash
# Verify a SLSA provenance attestation
cosign verify-attestation \
  --type slsaprovenance \
  --certificate-identity-regexp "https://github.com/org" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/org/myapp@sha256:<digest> | jq .payload | base64 -d | jq .
```

---

## OIDC Federation: GitHub Actions and Jenkins to AWS/GCP

### GitHub Actions to AWS (Full Detail)

The flow:
1. GitHub generates an OIDC JWT for the workflow job.
2. `configure-aws-credentials` exchanges it with AWS STS via `AssumeRoleWithWebIdentity`.
3. AWS verifies the token against the GitHub OIDC provider.
4. STS returns a short-lived credential (15 minutes to 12 hours).

```bash
# Setup: Create OIDC provider in AWS (once per account)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Trust policy with fine-grained conditions:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:org/myapp:environment:production"
      }
    }
  }]
}
```

Lock `sub` to the specific repo and environment. Do not use `*` wildcards on production deployment roles.

### Jenkins to AWS with OIDC

Jenkins can use `withAWS` from the CloudBees AWS Credentials plugin or `aws sts assume-role` with instance profile. For OIDC, configure the Jenkins OIDC plugin:

```groovy
withAWS(roleAccount: '123456789012', role: 'jenkins-deployer', region: 'us-east-1') {
  sh 'aws s3 ls s3://my-bucket/'
  sh 'aws ecr get-login-password | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com'
}
```

### GitHub Actions to GCP (Workload Identity Federation)

```yaml
- name: Authenticate to GCP
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github
    service_account: deployer@project.iam.gserviceaccount.com

- name: Deploy to GKE
  uses: google-github-actions/get-gke-credentials@v2
  with:
    cluster_name: production
    location: us-central1
```

---

## Artifact Promotion Gates and Digest Pinning

### Why Mutable Tags Break Traceability

A mutable tag like `myapp:latest` can point to any digest. When a new build overwrites the tag:

- The old running pod still uses the old digest (if already pulled)
- A new pod pull gets a different digest
- Two pods in the same Deployment run different code
- Rollback by tag name is ambiguous — which build was the "good" one?

### Promotion Gate Pattern

```bash
# Build phase: tag with Git SHA
IMAGE="registry.example.com/myapp"
GIT_SHA=$(git rev-parse HEAD)
docker build -t ${IMAGE}:${GIT_SHA} .
docker push ${IMAGE}:${GIT_SHA}

# Record the digest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' ${IMAGE}:${GIT_SHA} | cut -d@ -f2)
echo "IMAGE_DIGEST=${DIGEST}" >> promotion.env

# Promotion gate: scan with digest
trivy image --exit-code 1 --severity CRITICAL ${IMAGE}@${DIGEST}

# Sign the digest (not the tag)
cosign sign --yes ${IMAGE}@${DIGEST}

# Promote: update GitOps manifest with pinned digest
yq -i ".image.digest = \"${DIGEST}\"" \
  apps/myapp/overlays/production/kustomization.yaml
```

Kustomize with digest pinning:

```yaml
# kustomization.yaml
images:
  - name: registry.example.com/myapp
    newName: registry.example.com/myapp
    digest: sha256:111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000
```

---

## Multi-Tenant CI: Isolation Design

### Trust Tier Model

| Tier | Example | Node pool | Network | Secrets | Approval |
|---|---|---|---|---|---|
| 0 — External | OSS fork PRs | Separate hardened pool | No egress except registry | None | None |
| 1 — Internal CI | Team builds and tests | Shared pool | Registry + build cache | Dev/staging secrets | None |
| 2 — Staging deploy | Deploy to staging | Separate pool | Staging cluster API | Staging secrets | Auto on merge |
| 3 — Production | Deploy to production | Dedicated hardened pool | Prod cluster API only | Prod secrets via Vault | Manual approval |

### Poison Pill Prevention

A "poison pill" is a malicious or broken job that corrupts the runner environment for subsequent jobs:

- Use ephemeral runners: destroy after each job
- Set `clean_workspace: true` on Jenkins agents
- Use separate namespaces for each build in Kubernetes pod agents
- Set network policies that prevent lateral movement
- Mount only necessary service account tokens

```yaml
# Kubernetes Jenkins agent with per-job isolation
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-agent         # least-privilege SA
  automountServiceAccountToken: false       # disable if not needed
  securityContext:
    runAsNonRoot: true
    runAsUser: 10000
  containers:
    - name: jnlp
      image: jenkins/inbound-agent:3107.v665000b_51092-5
      resources:
        limits:
          cpu: "2"
          memory: "4Gi"
  volumes: []                               # no host volumes
```

### Resource Quotas Per Team Pipeline

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-ci-quota
  namespace: team-a-builds
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
    count/pods: "50"
    count/persistentvolumeclaims: "10"
```

---

## DORA Metrics and Delivery SLIs/SLOs

DORA (DevOps Research and Assessment) defines four key metrics for software delivery performance.

| Metric | Definition | Elite benchmark | Formula |
|---|---|---|---|
| Deployment frequency | How often changes are deployed to production | Multiple times per day | `deployments_per_day` |
| Lead time for changes | Time from commit to production | Less than 1 hour | `production_deploy_time - commit_time` |
| Change failure rate | Percentage of deployments causing incidents | 0-15% | `failed_deployments / total_deployments` |
| MTTR | Time to recover from a production incident | Less than 1 hour | `time_resolved - time_detected` |

Collecting DORA metrics from pipeline events:

```promql
# Deployment frequency (last 7 days)
count_over_time(
  deployment_events_total{env="production"}[7d]
) / 7

# Change failure rate (last 30 days)
sum(deployment_events_total{env="production",result="failure"}[30d])
/
sum(deployment_events_total{env="production"}[30d])
```

---

## Policy-as-Code in Pipelines: OPA/Conftest

Use `conftest` to validate Kubernetes manifests before `kubectl apply` or before ArgoCD sync:

```bash
# Install conftest
curl -L https://github.com/open-policy-agent/conftest/releases/download/v0.50.0/conftest_0.50.0_Linux_x86_64.tar.gz | tar xz
mv conftest /usr/local/bin/

# Run against Kubernetes manifests
conftest test --policy ./policy/ deployment.yaml
```

```rego
# policy/deny-latest-tag.rego
package main

deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  endswith(container.image, ":latest")
  msg := sprintf("Container %q uses :latest tag — use a specific digest or SHA tag", [container.name])
}

deny[msg] {
  input.kind == "Deployment"
  not input.spec.template.spec.containers[_].resources.limits.memory
  msg := "Deployment containers must specify memory limits"
}

deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  container.securityContext.runAsRoot == true
  msg := sprintf("Container %q must not run as root", [container.name])
}
```

Integrate into GitHub Actions:

```yaml
- name: Validate manifests with conftest
  run: |
    for manifest in k8s/**/*.yaml; do
      conftest test --policy policy/ "$manifest" || exit 1
    done
```

Integrate into Jenkins:

```groovy
stage('Policy Check') {
  steps {
    sh 'find k8s/ -name "*.yaml" -exec conftest test --policy policy/ {} \\;'
  }
}
```

---

## Secret Management in Pipelines

### Comparison

| Method | Where secrets live | Pod restart on rotation? | Audit | Complexity |
|---|---|---|---|---|
| CI-native secrets | CI provider encrypted store | N/A — injected at job start | CI audit log | Low |
| Vault agent injector | Vault, injected as files | No (file mount auto-refreshes) | Vault audit log | Medium |
| External Secrets Operator | Cloud secret manager, creates K8s Secret | Yes (env var) or No (file mount) | Cloud audit log | Medium |
| Sealed Secrets | Git (encrypted), K8s Secret | Yes | Git history | Low |

### Vault Agent Injector Pattern

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "myapp-production"
        vault.hashicorp.com/agent-inject-secret-config.env: "secret/data/myapp/config"
        vault.hashicorp.com/agent-inject-template-config.env: |
          {{- with secret "secret/data/myapp/config" -}}
          DB_PASSWORD="{{ .Data.data.db_password }}"
          API_KEY="{{ .Data.data.api_key }}"
          {{- end }}
    spec:
      serviceAccountName: myapp   # must be bound to a Vault role
      containers:
        - name: myapp
          image: registry.example.com/myapp:abc123
          command: ["/bin/sh", "-c", "source /vault/secrets/config.env && ./start.sh"]
```

### Rule: Never Log Secrets

```groovy
// BAD: this prints the secret in Jenkins console
echo "Database password: ${DB_PASSWORD}"

// GOOD: use withCredentials and avoid echo on secret variables
withCredentials([string(credentialsId: 'db-password', variable: 'DB_PASS')]) {
  sh """
    set +x
    export DB_PASSWORD="${DB_PASS}"
    set -x
    ./run-migration.sh
  """
}
```

---

## Dependency Caching Strategies

### Docker Layer Caching

```dockerfile
# Separate dependency installation from code copy to maximize cache hits
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production    # only changes when package*.json changes

FROM dependencies AS build
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
```

Docker layer caching with BuildKit and inline cache:

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build with inline cache export
docker build \
  --cache-from registry.example.com/myapp:cache \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t registry.example.com/myapp:${GIT_SHA} \
  -t registry.example.com/myapp:cache \
  .

docker push registry.example.com/myapp:cache
```

### npm/pip Cache in GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: npm                   # caches ~/.npm automatically

- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: pip                   # caches ~/.cache/pip automatically
```

### Maven Cache in Azure Pipelines

```yaml
- task: Cache@2
  inputs:
    key: 'maven | "$(Agent.OS)" | **/pom.xml'
    restoreKeys: |
      maven | "$(Agent.OS)"
      maven
    path: $(MAVEN_CACHE_FOLDER)
  displayName: Cache Maven packages

- script: mvn clean verify -Dmaven.repo.local=$(MAVEN_CACHE_FOLDER)
  displayName: Build with cached Maven
```

---

## Immutable Infrastructure Delivery

Immutable infrastructure means no SSH deploys, no manual config changes on running servers. Changes come through new deployments, not in-place patching.

### Rules

1. Never SSH into production to edit configuration.
2. All config changes come through CI/CD and GitOps.
3. To change runtime state, change Git and let the controller apply it.
4. A running pod is never modified — it is replaced.
5. Config drift is a CI/CD delivery failure, not a normal operational state.

### Config Drift Prevention

```bash
# Detect drift with kubectl diff before applying
kubectl diff -f k8s/overlays/production/

# ArgoCD drift check (report without apply)
argocd app diff myapp --local k8s/overlays/production/

# Terraform drift detection in CI
terraform plan -detailed-exitcode
# Exit code 2 means drift detected
```

### Break-Glass Process for Emergencies

When an emergency requires a runtime change before GitOps can propagate:

1. Make the minimal required change directly.
2. Open a PR to the GitOps repo immediately.
3. Merge the PR — this becomes the durable state.
4. Verify ArgoCD shows Synced after merge.
5. Document the emergency in a post-incident review.

If self-heal is enabled and the PR is slow, temporarily suspend auto-sync for the affected app:

```bash
argocd app set myapp --sync-policy none     # disable auto-sync
kubectl scale deploy myapp --replicas=10    # emergency fix
# ... merge PR ...
argocd app set myapp --sync-policy automated --self-heal  # re-enable
```
