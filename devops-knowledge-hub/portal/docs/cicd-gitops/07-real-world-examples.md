---
title: "Real-World Examples"
sidebar_position: 7
---

# CI/CD & GitOps — Real-World Examples

These examples show how delivery systems fail in production and how a senior SRE or platform engineer should reason about them.

---

## Example 1: Bad Deploy Caused 5xx Spike

### Scenario

A service deployment finished successfully. Ten minutes later, Grafana shows a sharp increase in HTTP 5xx errors for only the new version.

### What Happened

The pipeline was green because unit tests passed and the image built successfully. The failure was in runtime behavior: the new version had a configuration mismatch with a downstream dependency.

### Strong Response

```text
1. Correlate deploy timestamp with error spike.
2. Compare metrics by version or pod template hash.
3. Pause rollout if still progressing.
4. Roll back if confidence is high.
5. Confirm recovery.
6. Investigate root cause after mitigation.
```

Useful commands:

```bash
kubectl rollout history deployment/payment -n production
kubectl rollout undo deployment/payment -n production
kubectl rollout status deployment/payment -n production
kubectl logs deploy/payment -n production --since=15m
```

### Prevention

- Canary rollout with version-labelled metrics
- Smoke test against real dependency path
- Staging config parity
- Rollback drill before production launch

---

## Example 2: CI Passed But Production Failed

### Scenario

The build passed, image was pushed, and ArgoCD synced the application. Pods entered CrashLoopBackOff in production only.

### Likely Causes

- Environment variable exists in staging but not production
- Production Secret key name differs
- Readiness path changed but ingress health check did not
- Production-only feature flag enabled a code path not tested in staging

### Investigation

```bash
argocd app get myapp
kubectl get pods -n production
kubectl describe pod <pod> -n production
kubectl logs <pod> -n production --previous
kubectl get secret myapp-secrets -n production -o yaml
```

### Lesson

CI verifies artifact correctness. Deployment verifies environment compatibility. You need both.

---

## Example 3: Wrong Image Deployed

### Scenario

Production is running code that nobody expected. The manifest says `myapp:latest`, and the tag was overwritten by a later build.

### Root Cause

The team used a mutable image tag in production. The tag name stayed the same while the content changed.

### Better Pattern

```yaml
image: registry.example.com/myapp@sha256:111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000
```

### Operational Fix

```bash
kubectl get deploy myapp -n production -o jsonpath='{.spec.template.spec.containers[0].image}'
echo
argocd app history myapp
argocd app rollback myapp <known-good-revision>
```

### Prevention

- Use Git SHA tags or digest pinning
- Promote by digest, not mutable tag
- Attach commit and build metadata to images
- Block direct pushes to production registry paths where possible

---

## Example 4: Shared Jenkins Library Broke Every Team

### Scenario

A shared Jenkins library was updated to change a function signature. Dozens of pipelines failed on the next run.

### Root Cause

The shared library was effectively platform code, but it was released like a normal repo commit. There was no versioning, no canary adoption, and no compatibility window.

### Strong Platform Fix

- Version shared pipeline libraries
- Keep old function signatures during migration
- Test library changes against a representative pipeline set
- Canary to one or two services first
- Publish migration notes

### SRE Framing

The delivery platform is a production dependency. A change to common pipeline logic has broad blast radius.

---

## Example 5: GitOps Reverted A Manual Hotfix

### Scenario

During an incident, an engineer manually scaled a deployment from 3 to 10 replicas. A few minutes later it returned to 3.

### What Happened

ArgoCD self-heal detected drift and reconciled the cluster back to Git.

### Correct Response

```bash
argocd app get myapp
argocd app diff myapp
```

If the scale change is still required, commit it to the GitOps repo or use an approved emergency process that temporarily suspends reconciliation for the resource.

### Lesson

GitOps is doing its job. Manual runtime changes are temporary unless the desired state changes in Git.

---

## Example 6: Secret Rotation Caused Outage

### Scenario

A credential was rotated after a security finding. Within minutes, production pods started failing to access object storage.

### Failure Chain

```text
old credential revoked
  -> pods still using old value
  -> application auth failures
  -> retries increased
  -> latency rose
  -> user-facing errors
```

### Mitigation

- Restore service using the approved identity path
- Restart pods if they load values only at startup
- Confirm downstream access
- Track affected services from inventory

### Prevention

- Maintain credential ownership inventory
- Prefer workload identity over long-lived static credentials
- Test rotation in staging
- Use rotation runbooks with blast-radius check

---

## Example 7: Multi-Tenant CI Trust Boundary Failure

### Scenario

A pull request from an external contributor ran on the same self-hosted runner pool used for internal deployment jobs.

### Risk

Persistent workspaces and shared runner state can leak data between builds. Low-trust jobs must not run on high-trust workers.

### Safer Design

| Trust tier | Runner model |
|---|---|
| External PR | Ephemeral, no privileged contexts |
| Internal CI | Scoped runner pool, isolated workspaces |
| Production promotion | Dedicated controlled pool with approval |

### Lesson

CI is not just compute. It is part of your security and reliability boundary.

---

## Example 8: Pipeline Too Slow, Teams Bypass It

### Scenario

The official pipeline takes 45 minutes. Teams start using local scripts and direct deploys to save time.

### Symptoms

- Fewer changes go through the golden path
- Large batched PRs become normal
- Hotfixes bypass review
- Production changes become hard to audit

### Platform Response

```text
measure -> remove waste -> parallelize -> cache -> split fast/slow suites -> improve ownership
```

Practical improvements:

- Cache dependencies
- Split unit and integration jobs
- Run affected-service builds only
- Pre-build common base images
- Add runner autoscaling

### Lesson

Developer experience is a reliability control. Slow platforms create unsafe behavior.

---

## Example 9: ArgoCD OutOfSync For Hours

### Scenario

Several apps remain OutOfSync for half a day. Nobody is paged because user traffic is still healthy.

### Risk

Long-lived drift means the next deployment may behave unexpectedly. It also weakens the promise that Git reflects runtime state.

### Investigation

```bash
argocd app list
argocd app get myapp
argocd app diff myapp
kubectl get events -n myapp --sort-by=.lastTimestamp
```

### Common Causes

- Manual runtime edits
- Controller-mutated fields
- Missing CRDs
- Admission rejection
- Failed hooks
- Helm rendering difference

### Prevention

- Alert on OutOfSync age
- Define acceptable drift windows
- Use ignore-differences intentionally, not casually
- Route ownership by ArgoCD project or app label

---

## Example 10: Database Migration Breaks Rollback

### Scenario

The app deploy fails and rollback is attempted, but the old version no longer works because a database column was dropped.

### Root Cause

The migration was not backward compatible.

### Safer Expand-Contract Pattern

```text
1. Add nullable new column.
2. Deploy code that writes both old and new fields.
3. Backfill existing rows.
4. Deploy code that reads new field.
5. Drop old column only after old code is gone.
```

### Lesson

Rollback is not only a Kubernetes or ArgoCD operation. Data compatibility determines whether rollback actually works.

---

## Staff-Level Summary

A strong delivery platform is not measured only by successful builds. It is measured by safe change flow, artifact trust, fast detection, controlled rollout, and reliable rollback. Most delivery incidents are not tool failures; they are missing contracts between source, CI, artifact, GitOps state, runtime, and observability.

---

## Example 11: End-to-End Journey — Java App From Commit to Production

This traces a complete change across all five platform layers for a typical Java web service.

### The Five-Layer Platform Stack

```text
Layer 5: Observability     — Prometheus, Grafana, AlertManager, Loki
Layer 4: App Delivery      — ArgoCD, Helm, Kustomize, Argo Rollouts
Layer 3: Build/Supply Chain — GitHub Actions, Trivy, Cosign, Syft (SBOM)
Layer 2: Compute           — EKS, Docker, containerd
Layer 1: Infrastructure    — Terraform, AWS, VPC, IAM, ECR
```

### The Full Journey

```text
1. Developer commits to feature branch, opens PR.
2. GitHub Actions CI triggers (test → lint → static analysis).
3. PR approved and merged to main.
4. GitHub Actions CI builds Docker image: myapp:abc123def.
5. Trivy scans image — blocks on CRITICAL CVEs.
6. Cosign signs image using OIDC keyless signing.
7. Syft generates SBOM and attaches it to the image.
8. Image pushed to ECR: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:abc123def.
9. CI updates k8s-manifests repo:
   apps/myapp/overlays/staging/kustomization.yaml → newTag: abc123def.
10. ArgoCD detects manifest change in staging overlay.
11. ArgoCD syncs: creates new ReplicaSet in myapp-staging namespace.
12. Readiness probe passes; old ReplicaSet scaled down.
13. Smoke test job runs: curl https://staging.myapp.example.com/health → 200.
14. Platform team promotes image to production:
    ./scripts/promote.sh staging production abc123def.
15. CI updates apps/myapp/overlays/production/kustomization.yaml.
16. ArgoCD triggers Argo Rollouts canary: 5% traffic to new version.
17. AnalysisTemplate queries Prometheus — error rate < 1%.
18. Steps: 5% → 25% → 50% → 100%.
19. Prometheus fires no alerts during rollout window.
20. ArgoCD shows Synced + Healthy. Production complete.
```

### Rollback Path

If an alert fires during canary:

```bash
# Option 1: Argo Rollouts automatic abort (triggered by failed AnalysisTemplate)
# Option 2: Manual abort
kubectl argo rollouts abort myapp -n production

# Revert GitOps manifest (durable state)
cd k8s-manifests
git revert HEAD
git push
# ArgoCD syncs back to previous image

# Verify recovery
kubectl argo rollouts get rollout myapp -n production
kubectl rollout status deployment/myapp -n production
```

---

## Example 12: Capstone Pattern — Delivery Platform for 100 Services

What a production delivery system looks like at scale.

### Repository Structure

```text
Organization repositories:
  ├── shared-workflows/         # Reusable GitHub Actions workflows
  ├── pipeline-templates/       # Jenkins shared library
  ├── k8s-manifests/            # GitOps monorepo (all service overlays)
  │   ├── apps/                 # ArgoCD Application CRDs (app-of-apps)
  │   ├── services/
  │   │   ├── payment/
  │   │   │   ├── base/
  │   │   │   └── overlays/{dev,staging,production}/
  │   │   ├── auth/
  │   │   └── order/
  │   └── clusters/
  │       ├── us-east-1/
  │       └── eu-west-1/
  ├── platform-policies/        # OPA/Kyverno policies
  └── runbooks/                 # Incident response documentation
```

### Shared Workflow Library

Every service calls the shared workflow. The platform team owns the template:

```yaml
# shared-workflows/.github/workflows/service-ci.yml (reusable)
on:
  workflow_call:
    inputs:
      service-name: { required: true, type: string }
      java-version: { required: false, type: string, default: '17' }
      min-coverage: { required: false, type: number, default: 70 }
    secrets:
      ecr-role-arn: { required: true }
      sonar-token: { required: false }
```

Each service's CI calls it:

```yaml
# payment-service/.github/workflows/ci.yml
jobs:
  ci:
    uses: org/shared-workflows/.github/workflows/service-ci.yml@v2
    with:
      service-name: payment
      java-version: '21'
      min-coverage: 85
    secrets:
      ecr-role-arn: ${{ secrets.ECR_ROLE_ARN }}
      sonar-token: ${{ secrets.SONAR_TOKEN }}
```

### Platform Guardrails Applied at Namespace Creation

A platform operator or GitOps bootstrap applies these to every new team namespace:

```yaml
# platform-templates/namespace-defaults.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
spec:
  limits:
    - default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "100m"
        memory: "128Mi"
      type: Container
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
    pods: "100"
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

### Multi-Cluster GitOps with ApplicationSet

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: payment-service
  namespace: argocd
spec:
  generators:
    - matrix:
        generators:
          - list:
              elements:
                - cluster: us-east-1
                  url: https://k8s-us-east-1.internal.example.com
                - cluster: eu-west-1
                  url: https://k8s-eu-west-1.internal.example.com
          - list:
              elements:
                - env: production
  template:
    metadata:
      name: payment-{{cluster}}-{{env}}
    spec:
      project: payment-team
      source:
        repoURL: https://github.com/org/k8s-manifests
        path: services/payment/overlays/{{env}}
        targetRevision: HEAD
      destination:
        server: '{{url}}'
        namespace: payment-{{env}}
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

---

## Example 13: Design a Delivery Platform for a Fintech with 50 Teams

**Interviewer prompt:** "Design the CI/CD and delivery platform for a fintech company with 50 product teams, PCI-DSS compliance, and an existing mix of Java and Node services."

### Constraints First

- 50 teams means blast radius from a shared platform change is enormous. Version and canary platform changes.
- PCI-DSS: immutable audit logs, network segmentation, no developer access to production data or production cluster, mandatory code review, artifact signing, access logging.
- Existing services: migration cannot be big-bang. Golden path must be better than current ad-hoc pipelines to attract adoption.

### Architecture

```text
Source:         GitHub Enterprise (on-prem or cloud) with branch protection required on main
CI:             GitHub Actions with OIDC to AWS — no static keys in any repo
Artifact:       ECR with image scanning enabled; digest-only promotion in production
Supply chain:   Cosign keyless signing on every production artifact; Trivy blocks CRITICAL CVEs
GitOps:         ArgoCD with project-level RBAC per team; app-of-apps bootstrap per cluster
Secrets:        HashiCorp Vault with Kubernetes auth backend; dynamic database credentials
Policy:         Kyverno validating webhook: require image signature, require scan attestation, deny root containers
Audit:          All ArgoCD syncs logged; Vault audit log to SIEM; GitHub Audit Log to SIEM
Progressive delivery: Argo Rollouts canary with Prometheus gates for all payment-path services
Observability:  Prometheus + Grafana SLO dashboards; PagerDuty for page-worthy alerts
```

### Team Isolation Model

- Each team gets a dedicated namespace with LimitRange + ResourceQuota + default-deny NetworkPolicy applied at creation.
- ArgoCD AppProject per team: can only sync to their namespace from their GitOps path.
- Vault policy per team: can only read secrets under `secret/data/<team>/`.
- No team can read another team's secrets or deploy to another team's namespace.

### Promotion Governance

- CI builds image → pushes to ECR with SHA tag → creates PR to k8s-manifests with staging overlay change.
- PR auto-approved by platform bot after scan attestation and signature verification pass.
- Production promotion: separate PR with required approval from team lead + platform security reviewer.
- Automated checks on the production PR: no new CRITICAL CVEs, coverage regression < 5%, change failure rate for this service in last 30 days < 15%.

---

## Example 14: CI Security Incident — Credential Leaked in Build Log

### Scenario

An engineer added a debug `echo` statement during development that printed a database password. The Jenkinsfile was merged, the build ran, and the credential appeared in the Jenkins build console log.

### Response

```bash
# Step 1: Rotate the credential immediately (do not wait to confirm scope)
# Rotate the database password in AWS Secrets Manager / Vault
aws secretsmanager rotate-secret --secret-id production/myapp/database

# Step 2: Revoke all active sessions using the old credential
# (database-specific, e.g., PostgreSQL)
# SELECT pg_terminate_backend(pid) FROM pg_stat_activity
# WHERE usename = 'myapp' AND backend_start < 'rotation_time';

# Step 3: Archive and restrict access to the affected build logs
# Jenkins: mask the log, revoke access for non-admins
# GitHub Actions: delete the run or use secret masking

# Step 4: Audit which jobs ran in the exposure window
# Check Jenkins build history for myapp between commit time and rotation time
```

### Prevention

```groovy
// BAD: this prints the secret
echo "Connecting to DB: ${DB_PASSWORD}"

// GOOD: use withCredentials and set +x
withCredentials([string(credentialsId: 'db-password', variable: 'DB_PASS')]) {
  sh """
    set +x
    export DATABASE_URL="postgresql://myapp:${DB_PASS}@db.internal/production"
    set -x
    ./run-app.sh
  """
}
```

Platform controls to prevent:
- Enable Jenkins mask-passwords plugin to scrub known secrets from logs.
- Configure log retention and access control on CI build artifacts.
- Use Vault dynamic secrets — each build gets a time-limited credential that expires automatically.
- Run automated secret detection in CI (`detect-secrets` or `trufflesecurity/trufflehog`) as a pre-commit and PR check.

---

## Example 15: Works in Staging, Fails in Production — The Classic Gap

### Scenario

A service passes all staging tests, ArgoCD syncs cleanly, but pods enter CrashLoopBackOff in production within 2 minutes of deployment.

### Investigation Path

```bash
# 1. Check pod state and exit code
kubectl get pods -n production -l app=myapp
kubectl describe pod <failing-pod> -n production
# Look at: Last State > Exit Code, Reason (OOMKilled, Error, etc.)

# 2. Check logs from before crash
kubectl logs <pod> -n production --previous
# Common findings: missing env var, connection refused, permission denied

# 3. Compare environment configuration
kubectl get configmap myapp-config -n production -o yaml
kubectl get configmap myapp-config -n staging -o yaml
diff <(kubectl get cm myapp-config -n production -o jsonpath='{.data}') \
     <(kubectl get cm myapp-config -n staging -o jsonpath='{.data}')

# 4. Compare secrets (key names only, not values)
kubectl get secret myapp-secrets -n production -o jsonpath='{.data}' | jq 'keys'
kubectl get secret myapp-secrets -n staging -o jsonpath='{.data}' | jq 'keys'

# 5. Check resource limits — staging may have higher limits
kubectl get deploy myapp -n production -o jsonpath='{.spec.template.spec.containers[0].resources}'
kubectl get deploy myapp -n staging -o jsonpath='{.spec.template.spec.containers[0].resources}'

# 6. Check NetworkPolicy differences
kubectl get networkpolicies -n production
kubectl get networkpolicies -n staging

# 7. Connectivity from pod
kubectl exec -it deploy/myapp -n production -- \
  wget -qO- http://dependency-service.other-ns.svc.cluster.local/health
```

### Root Causes in Priority Order

1. Missing Secret key in production namespace (different name or not created).
2. NetworkPolicy in production blocking a dependency that staging allows.
3. Lower memory limits in production causing OOMKilled.
4. IRSA role missing a permission needed in production.
5. Different TLS configuration (production requires mTLS, staging does not).
6. Race condition only visible at production replica count (3 replicas, shared resource).

### Systemic Prevention

- Use Kustomize overlays with explicit config diff reviews between staging and production in PRs.
- Automated parity check: compare config/secret key names between environments as a CI step before production promotion.
- Run load tests against staging at production replica counts before promoting.
