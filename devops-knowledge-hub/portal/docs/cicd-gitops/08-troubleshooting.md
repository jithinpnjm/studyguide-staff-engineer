---
title: "Troubleshooting"
sidebar_position: 8
---

# CI/CD & GitOps — Troubleshooting

Delivery troubleshooting is about locating the broken layer before taking action.

```text
Git -> CI -> artifact -> registry -> GitOps repo -> ArgoCD -> Kubernetes -> application
```

---

## First Questions

1. What changed recently?
2. Did CI finish?
3. Was an artifact produced?
4. Was the environment repository updated?
5. Did ArgoCD sync?
6. Did Kubernetes create healthy pods?
7. Did application metrics change?
8. Is rollback safe?

---

## Layer Checklist

| Layer | What to inspect |
|---|---|
| Git | Commit diff, branch, merge history |
| CI | Workflow logs, runner capacity, test reports |
| Artifact | Image tag, image digest, registry entry |
| GitOps | Overlay, values file, application path |
| ArgoCD | App status, diff, sync history |
| Kubernetes | Deployment, ReplicaSet, Pod events |
| App | Logs, metrics, dependency behavior |

---

## Useful Commands

```bash
git log --oneline --graph -10
git show --stat HEAD
git diff HEAD~1..HEAD
```

```bash
argocd app get myapp
argocd app diff myapp
argocd app history myapp
```

```bash
kubectl rollout status deployment/myapp -n production
kubectl rollout history deployment/myapp -n production
kubectl describe deployment/myapp -n production
kubectl get pods -n production
kubectl get events -n production --sort-by=.lastTimestamp
```

---

## Common Patterns

### CI problem

Look at workflow logs, runner labels, dependency caches, tool versions, and shared workflow changes.

### Artifact problem

Confirm the tag or digest exists in the registry and that the deployment references the same value.

### GitOps problem

Confirm the correct environment overlay changed and that ArgoCD watches the same branch and path.

### Kubernetes rollout problem

Inspect Deployment status, ReplicaSets, Pods, probe results, and events.

### Application regression

Compare metrics and logs between old and new versions. Check dependencies and configuration.

---

## Rollback Notes

Rollback works only if the previous artifact, configuration, and database schema are still compatible.

Good release design keeps old artifacts available, uses backward-compatible database migrations, and practices rollback before incidents.

---

## Final Rule

Be precise when describing the issue:

```text
CI did not finish.
The artifact was not produced.
The environment repo was not updated.
ArgoCD did not sync.
Kubernetes did not complete the rollout.
The app rolled out but behaved incorrectly.
```

Each sentence points to a different owner, dashboard, and log source.

---

## Quick Reference: Pipeline Failure Types and First Action

| Failure type | First action |
|---|---|
| All CI jobs fail simultaneously | Check shared runner, shared workflow, or shared library for recent change |
| One job fails, others pass | Check job-specific logs, tool versions, path filters |
| Build fails but was passing 24h ago | Check dependency registry, tool version update, base image change |
| Test failures in CI not seen locally | Check environment variables, test isolation, OS differences |
| Image scan blocks deploy | Check vulnerability details — are CVEs in base image or app dependencies? |
| Image push fails | Check registry auth, quota, network access from runner |
| ArgoCD OutOfSync stuck | Check `argocd app diff`, admission webhook rejections, CRD missing |
| ArgoCD sync loop | Check for controller-mutated fields not in ignoreDifferences |
| Kubernetes rollout stuck | Check pod events, image pull, readiness probe |
| Production degraded after deploy | Correlate deploy time to error spike, consider rollback |
| Rollback failed | Check if previous artifact still exists, check DB migration compatibility |

---

## Jenkins Failure Scenarios

### Agent Offline

Symptom: builds queue but do not start; Jenkins shows "agent offline" or "Node not reachable."

```bash
# Check agent status from Jenkins master
curl -u admin:TOKEN http://JENKINS_URL/computer/api/json | jq '.computer[] | {name:.displayName, offline:.offline}'

# If agent is a Kubernetes pod
kubectl get pods -n jenkins
kubectl describe pod <agent-pod> -n jenkins
kubectl logs <agent-pod> -n jenkins

# Check if agent pod image can pull
kubectl get events -n jenkins --sort-by=.lastTimestamp | tail -20

# Common pod-agent fix: restart the pod
kubectl delete pod <agent-pod> -n jenkins
# Jenkins will provision a new one

# Check connectivity: agent must reach Jenkins controller on port 50000 (JNLP)
kubectl exec -it <agent-pod> -n jenkins -- \
  nc -vz jenkins.jenkins.svc.cluster.local 50000
```

Fix:
- If image pull failure: check imagePullPolicy and registry credentials.
- If JNLP port blocked: check NetworkPolicy and security group rules.
- If disk pressure: check `kubectl describe node` for disk pressure taint.

Prevention:
- Use liveness probe on agent containers.
- Use Kubernetes agent autoscaler to provision fresh pods per build.
- Set `maxAgentConnectTime` in Jenkins Kubernetes plugin to detect stuck connections.

---

### Build Hung (No Output, Not Failing)

Symptom: build has been running for longer than expected with no log output.

```bash
# Find the stuck build
curl -u admin:TOKEN http://JENKINS_URL/job/myapp/lastBuild/api/json | jq '.building,.estimatedDuration'

# Check what the agent is doing
kubectl exec -it <agent-pod> -n jenkins -- ps aux
kubectl exec -it <agent-pod> -n jenkins -- top -bn1

# Kill the stuck process
kubectl exec -it <agent-pod> -n jenkins -- kill -9 <pid>
```

Common causes:
- Test waiting on a TCP connection that never arrives (missing mock).
- Docker build waiting on network (proxy issue).
- Maven waiting on a dependency download with no timeout.
- Shell command waiting for stdin when none is connected.

Prevention:
- Set pipeline `timeout(time: 30, unit: 'MINUTES')`.
- Set Maven `-Dmaven.wagon.http.connectionTimeout=30000`.
- Use `docker build --network host` or configure a build-time proxy.

---

### Shared Library Broken

Symptom: many unrelated pipelines fail immediately with a library error.

```bash
# Identify which library version is loaded
# Jenkins: Manage Jenkins > Configure System > Global Pipeline Libraries > version
# Look at the failing pipeline console for "@Library" references

# Check if the library itself has a test
git log --oneline -10  # in the library repo
git diff HEAD~1..HEAD   # see what changed
```

Remediation:
1. Identify the breaking commit in the library repo.
2. Revert the breaking commit to a known-good version.
3. Pin the library to a specific tag in Jenkins configuration until the fix is landed.
4. Re-run affected pipelines.

Prevention:
- Version shared libraries with semantic tags.
- Do not allow `@main` references in production pipelines — use `@v1.2.3`.
- Test library changes against a representative pipeline set before merging.
- Canary the library change to one low-risk service first.

---

### Credential Expired or Mismatched

Symptom: pipeline fails with "credential not found," "authentication failed," or "unauthorized."

```bash
# Check credential ID in the Jenkinsfile vs actual credential store
# In Jenkinsfile:
# credentials('docker-registry-creds')   <- this ID must match

# List available credentials via REST API
curl -u admin:TOKEN \
  http://JENKINS_URL/credentials/store/system/domain/_/api/json

# Common: credential was renamed or deleted
# Solution: re-create or rename the credential ID to match

# Docker registry: check login test
docker login registry.example.com -u $REGISTRY_USER -p $REGISTRY_PASS
echo "Exit code: $?"
```

Prevention:
- Never hard-code credential IDs in Jenkinsfiles; define them as pipeline parameters or shared variables.
- Audit credential expiry dates for certificates and API tokens.
- Use Vault with dynamic secrets — credentials auto-rotate.

---

### Jenkins OOM (OutOfMemoryError)

Symptom: Jenkins controller becomes unresponsive; builds fail with "GC overhead limit exceeded" or heap dump appears.

```bash
# Check controller JVM memory
java -jar jenkins-cli.jar -s http://JENKINS_URL -auth admin:TOKEN \
  groovy = <<'EOF'
println "Max heap: " + Runtime.getRuntime().maxMemory() / 1024 / 1024 + " MB"
println "Used heap: " + (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / 1024 / 1024 + " MB"
EOF

# Check pod memory in Kubernetes
kubectl top pod -n jenkins
kubectl describe pod <jenkins-pod> -n jenkins | grep -A4 Requests
```

Remediation:
1. Increase `JAVA_OPTS="-Xmx4g -Xms512m"` in Jenkins pod environment.
2. Reduce concurrent builds (`Executors` setting on controller — use agents, not controller).
3. Clean old build artifacts: Manage Jenkins > Script Console: `Jenkins.instance.items.each { it.builds.limit(20) }`.

---

### Workspace Collision

Symptom: one build picks up artifacts or state from a previous build, causing non-deterministic failures.

```bash
# Jenkins: ensure cleanWs() in post always {}
post {
  always {
    cleanWs()
  }
}

# Kubernetes agents: workspace is inside the pod (ephemeral) — no collision by design
# Static VM agents: use unique workspace directory per build
# agent {
#   label 'linux'
#   customWorkspace "workspace/${JOB_NAME}/${BUILD_NUMBER}"
# }
```

---

## GitHub Actions Failure Scenarios

### Rate Limit Hit

Symptom: workflow fails with "API rate limit exceeded" or "403 Forbidden" from GitHub API.

```bash
# Check remaining rate limit
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit | jq '.resources.core'

# Response includes:
# "limit": 5000, "remaining": 0, "reset": 1716000000
```

Causes:
- Too many `actions/checkout@v4` calls with `fetch-depth: 0` in large repos.
- Too many API calls to GitHub in a script step.
- Multiple workflows triggered simultaneously for the same commit.

Fix:
- Use `fetch-depth: 1` unless full history is needed.
- Cache the checkout: `actions/cache@v4` for the `.git` directory.
- Spread workflow load using `concurrency` groups.

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true   # cancel older runs for the same branch
```

---

### OIDC Token Expired or Not Issued

Symptom: `configure-aws-credentials` or GCP auth action fails with "Unable to exchange OIDC token" or "token is expired."

```bash
# The OIDC token lifetime is typically 10 minutes
# If the job takes longer than 10 minutes before the auth step, the token may expire

# Fix: move the auth step as close as possible to the AWS/GCP operations
# Or: re-authenticate mid-job (call the action a second time)
```

Common misconfiguration: missing `permissions.id-token: write` in the job:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write      # REQUIRED for OIDC — if missing, token is not requested
      contents: read
```

Check: the IAM trust policy sub condition does not match the current workflow context. If the workflow is running in a different environment than the trust policy expects:

```bash
# Debug: print the token claims (without using it)
curl -s -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
  "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | \
  jq -r '.value' | cut -d. -f2 | base64 -d 2>/dev/null | jq .
```

---

### Runner Not Found or Busy

Symptom: jobs queue but never start; "no runners found" or job waits for a runner with the required labels.

```bash
# Check available runners
gh api repos/org/repo/actions/runners | jq '.runners[] | {name:.name,status:.status,labels:.labels[].name}'

# GitHub-hosted runners: usually a transient capacity issue
# Check GitHub status: https://githubstatus.com

# Self-hosted runners: check runner process
systemctl status github-actions-runner
journalctl -u github-actions-runner -n 50

# Kubernetes-based runners: check pod status
kubectl get pods -n github-runners
kubectl describe pod <runner-pod> -n github-runners
```

Fix:
- GitHub-hosted: add retry logic or wait and re-trigger.
- Self-hosted: restart the runner service, check disk space, check token expiry.
- Kubernetes: scale the runner deployment or check autoscaler configuration.

---

### Secret Not Set

Symptom: step fails with "Error: Input required and not supplied: password" or variable is empty.

```bash
# Diagnose in the workflow step (safely — GitHub masks secrets)
- name: Debug secret presence
  run: |
    if [ -z "${{ secrets.MY_SECRET }}" ]; then
      echo "Secret MY_SECRET is not set or is empty"
      exit 1
    else
      echo "Secret is set (length: ${#MY_SECRET})"
    fi
  env:
    MY_SECRET: ${{ secrets.MY_SECRET }}
```

Causes:
- Secret is defined at organization level but not shared with the repo.
- Secret is defined at environment level (e.g., `production`) but the job does not specify `environment: production`.
- Secret name has a typo.
- Job was triggered by a pull request from a fork — fork PRs cannot access secrets by default.

Fix for fork PR secrets:

```yaml
# Only run secret-dependent steps for non-fork PRs
- name: Push image
  if: github.event.pull_request.head.repo.full_name == github.repository
  run: docker push ...
```

---

### Artifact Upload Failed

Symptom: `actions/upload-artifact` fails with "No files were found with the provided path."

```bash
# Debug: list files before upload
- name: List files to upload
  run: find ./target -name "*.jar" -ls

- name: Upload artifact
  uses: actions/upload-artifact@v4
  with:
    name: app-jar
    path: ./target/*.jar    # glob pattern
    if-no-files-found: error  # fail explicitly instead of silently skipping
```

Common cause: the build step failed silently, producing no output files. Check for `continue-on-error: true` on the build step hiding failures.

---

### Matrix Job Partial Failure

Symptom: matrix job shows some jobs passed and some failed; the overall job is reported as failed.

```yaml
# Default: one failure fails all others still pending
# To allow all to complete:
strategy:
  fail-fast: false   # let all matrix combinations run to completion
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
```

To examine individual matrix failures:

```bash
gh run view <run-id> --log | grep -A5 "macos-latest"
```

---

## Azure Pipelines Failure Scenarios

### Service Connection Expired

Symptom: task fails with "Could not authenticate to Azure" or "The service principal has expired."

```bash
# Check service connection status in Azure DevOps:
# Project Settings > Service Connections > <connection> > Edit > Verify
```

Fix:
1. Go to Project Settings > Service Connections.
2. Click the failing service connection.
3. Click Edit > Verify connection.
4. If expired: click "Manage Service Principal" to refresh the credential in Azure AD.
5. Alternatively: create a new service connection and update pipeline references.

Prevention:
- Use Workload Identity Federation (OIDC) for Azure service connections — no credential expiry.
- Set calendar reminders for service principal credential expiry.
- Use managed identities on self-hosted agents when possible.

---

### Approval Timeout

Symptom: pipeline is paused at an environment approval and nobody approved in time.

```bash
# Default approval timeout: 30 days in Azure DevOps
# The pipeline run expires after the timeout
```

Fix: configure a shorter approval timeout and add email/Teams notifications for pending approvals:
- Go to Environments > production > Approvals and checks.
- Set a maximum wait time.
- Add required reviewers with notification.

```yaml
# In pipeline: add a pre-approval notification step
- bash: |
    curl -X POST ${{ variables.TEAMS_WEBHOOK }} \
      -H 'Content-Type: application/json' \
      -d '{"text": "Production deployment awaiting approval: ${{ variables.Build.BuildId }}"}'
  displayName: Notify Teams — awaiting approval
```

---

### Artifact Not Found in Downstream Stage

Symptom: download task in Deploy stage fails with "artifact not found" or "no match."

```yaml
# BAD: inconsistent artifact name
# Build stage:
- publish: $(System.DefaultWorkingDirectory)/dist
  artifact: app-dist         # published as "app-dist"

# Deploy stage:
- download: current
  artifact: app              # looking for "app" — wrong name

# GOOD: use consistent names
- download: current
  artifact: app-dist         # must match the publish artifact name
```

Also check: the Build stage completed successfully and the artifact was actually published. Check the pipeline run timeline view.

---

### Variable Group Missing or Not Linked

Symptom: pipeline fails with "Variable group 'myapp-dev-vars' could not be found."

Fix:
1. Go to Library > Variable Groups.
2. Check the variable group exists with the exact name referenced in the pipeline.
3. Verify the variable group is linked to the pipeline (Library > Variable Groups > Pipeline permissions).
4. For Key Vault-linked groups: verify the service connection has `Get` and `List` permissions on the vault.

---

## ArgoCD and GitOps Failure Scenarios

### OutOfSync Stuck — Not Progressing

Symptom: `argocd app get myapp` shows OutOfSync but sync button or `argocd app sync myapp` does nothing.

```bash
# Step 1: check what is different
argocd app diff myapp

# Step 2: check sync status in detail
argocd app get myapp -o json | jq '.status.conditions'
argocd app get myapp -o json | jq '.status.operationState'

# Step 3: check for admission rejection
kubectl get events -n myapp --sort-by=.lastTimestamp | tail -20

# Step 4: check if a resource hook is stuck
argocd app get myapp -o json | jq '.status.resources[] | select(.hookPhase)'

# Step 5: force sync
argocd app sync myapp --force --prune
```

Common causes:
- Admission webhook rejects the manifest (OPA, Kyverno, PodSecurityAdmission).
- CRD missing: ArgoCD cannot apply a custom resource whose CRD has not been installed.
- Helm rendering difference between ArgoCD and local rendering.
- Namespace does not exist and `CreateNamespace=true` is not set.

For CRD-not-installed:

```bash
kubectl get crd | grep <resource-group>
# If missing: install the operator/CRD first, then sync
```

---

### ArgoCD Sync Loop

Symptom: ArgoCD keeps syncing the same application repeatedly, even though Kubernetes accepted the manifest.

```bash
argocd app get myapp -o json | jq '.status.sync.status'
# Shows OutOfSync immediately after each sync

argocd app diff myapp
# Shows diff on a field that changes after apply
```

Cause: a controller or admission webhook mutates the resource after ArgoCD applies it, creating a perpetual diff.

Fix: add `ignoreDifferences` for the mutated field:

```yaml
spec:
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas        # HPA changes this
    - group: ""
      kind: ServiceAccount
      jsonPointers:
        - /secrets              # Kubernetes injects token secrets
    - group: admissionregistration.k8s.io
      kind: ValidatingWebhookConfiguration
      jqPathExpressions:
        - .webhooks[].clientConfig.caBundle  # cert-manager injects this
```

---

### Resource Hook Failed

Symptom: `argocd app sync myapp` fails with "Sync operation failed: failed pre/post sync hook."

```bash
# View hook job status
argocd app get myapp -o json | jq '.status.resources[] | select(.kind=="Job")'

# Check hook job logs
kubectl get jobs -n myapp
kubectl logs job/<hook-job-name> -n myapp

# Common: database migration job failed
# Fix: check the migration output, fix the migration script, retry sync
argocd app retry myapp

# If the hook is stuck (job running but never completing)
kubectl delete job <hook-job-name> -n myapp
argocd app sync myapp --replace
```

---

### Application Degraded

Symptom: ArgoCD shows app as `Healthy: false` or `Degraded`.

```bash
argocd app get myapp
# Look at: Health Status, Sync Status

# Check which resource is degraded
argocd app get myapp -o json | jq '.status.resources[] | select(.health.status=="Degraded")'

# Common: Deployment degraded because pods are not ready
kubectl rollout status deployment/myapp -n myapp
kubectl get pods -n myapp
kubectl describe pod <failing-pod> -n myapp
kubectl logs <failing-pod> -n myapp --previous
```

---

### Webhook Not Firing (ArgoCD Not Detecting Git Change)

Symptom: commit was pushed to GitOps repo but ArgoCD does not sync within the expected interval.

```bash
# Check if webhook is configured in GitHub
# GitHub repo > Settings > Webhooks > check for ArgoCD webhook

# Check ArgoCD webhook receiver logs
kubectl logs -n argocd deploy/argocd-server | grep "webhook"

# Force a manual refresh
argocd app get myapp --refresh

# Check repository connectivity
argocd repo list
argocd repo get https://github.com/org/gitops-repo
```

If webhook is not configured, ArgoCD polls by default every 3 minutes. Configure a webhook for near-instant detection:

```bash
# Get ArgoCD webhook URL
# https://ARGOCD_SERVER/api/webhook

# GitHub: Settings > Webhooks > Add webhook
# Payload URL: https://ARGOCD_SERVER/api/webhook
# Content type: application/json
# Events: Push events
```

---

### Self-Heal Reverted a Hotfix

Symptom: manual change to a resource disappeared. Engineer complains "Kubernetes undid my fix."

```bash
# Check ArgoCD app config
argocd app get myapp -o json | jq '.spec.syncPolicy'

# If selfHeal: true, ArgoCD restored Git state (this is correct behavior)

# Check sync history to confirm
argocd app history myapp
```

Correct process for emergency changes:
1. Make the minimal change to the running resource.
2. Immediately open a PR to the GitOps repo.
3. Merge the PR — ArgoCD will then sync to the desired state (which now matches your fix).
4. Document in post-incident review.

If the PR takes too long and self-heal keeps reverting:

```bash
# Temporarily disable auto-sync for this app
argocd app set myapp --sync-policy none
# Make the fix and keep it running
# Merge the PR
argocd app set myapp --sync-policy automated --self-heal
```

---

## Git Failure Scenarios

### Merge Conflict in CI

Symptom: CI fails during merge/rebase with "CONFLICT" errors.

```bash
# Reproduce locally
git fetch origin
git checkout feature/my-branch
git rebase origin/main

# git shows conflicts:
# CONFLICT (content): Merge conflict in src/config.py
# Unmerged paths:
#   both modified: src/config.py

git status       # shows conflicted files
git diff         # shows conflict markers

# Resolve: edit the file, remove conflict markers
# Then:
git add src/config.py
git rebase --continue

# Or abort if confused:
git rebase --abort
```

Prevention: keep feature branches short-lived. Rebase regularly against main to reduce conflict surface.

---

### Force-Push to Protected Branch

Symptom: `git push --force origin main` is rejected or succeeded but broke collaborators' history.

```bash
# If push was rejected (branch protection working):
# error: failed to push some refs to 'origin/main'
# hint: Updates were rejected because the tip of your current branch is behind

# If push succeeded (no branch protection — investigate who did this):
git log --oneline origin/main   # check timeline
git reflog show origin/main     # see all HEAD movements

# Restore using reflog (if you know the good SHA)
git push --force origin <good-sha>:main
```

Prevention: configure branch protection rules — require pull requests, require status checks, block force push, block deletion.

---

### Submodule Broken in CI

Symptom: CI fails with "fatal: repository 'https://github.com/org/submodule' not found" or submodule directory is empty.

```bash
# Fix: clone with submodules
git clone --recurse-submodules https://github.com/org/myrepo

# Or: initialize after clone
git submodule update --init --recursive

# GitHub Actions: checkout with submodules
- uses: actions/checkout@v4
  with:
    submodules: recursive
    token: ${{ secrets.GITHUB_TOKEN }}
```

If the submodule is a private repository, the PAT or deploy key needs read access to that repo.

---

### LFS Quota Exceeded

Symptom: `git push` fails with "This repository is over its data quota. Purchase more data packs."

```bash
# List large files in history
git lfs ls-files
git lfs ls-files -s | sort -k 1 -n -r | head -20

# Track files with LFS (prevent future uploads)
git lfs track "*.zip"
git lfs track "*.bin"

# Migrate existing large files to LFS
git lfs migrate import --include="*.zip" --everything
git push --force
```

Alternative: move large binary assets to S3 or a dedicated artifact store and reference them by URL.

---

## Security and Supply Chain Failures

### Cosign Verification Failed

Symptom: `cosign verify` returns "no matching signatures" or admission webhook rejects the pod.

```bash
# Verbose verify to see what was checked
cosign verify \
  --certificate-identity-regexp "https://github.com/org/" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  registry.example.com/myapp@sha256:<digest> 2>&1

# Common: image was signed with a different identity than what the policy requires
# Check: what was the CI identity when the image was built?
cosign verify \
  --certificate-identity-regexp ".*" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  registry.example.com/myapp@sha256:<digest> | jq .

# Check signature presence in registry
cosign triangulate registry.example.com/myapp@sha256:<digest>
crane ls $(cosign triangulate registry.example.com/myapp@sha256:<digest> | sed 's/:.*//')
```

Common causes:
- Image was built and pushed manually (not through CI) — no signature present.
- Admission policy uses exact identity match but CI identity changed (new org, new repo name).
- Image digest changed after signing (do not re-tag signed images).

---

### SBOM Missing on Production Image

Symptom: supply chain audit query finds no SBOM for a production image.

```bash
# Check if SBOM is attached to the image
cosign verify-attestation \
  --type spdxjson \
  registry.example.com/myapp@sha256:<digest> 2>&1 | head -5

# If no attestation found: the CI pipeline did not generate or attach the SBOM
# Check the CI workflow for syft/sbom-action steps

# Generate SBOM manually for an existing image (add to CI going forward)
syft registry.example.com/myapp@sha256:<digest> -o spdx-json > myapp.spdx.json
cosign attest --yes \
  --predicate myapp.spdx.json \
  --type spdxjson \
  registry.example.com/myapp@sha256:<digest>
```

---

### Trivy Blocking Deploy on False Positive

Symptom: Trivy reports CRITICAL CVE, but the vulnerability is in a package your code does not use.

```bash
# Get detail on the CVE
trivy image --severity CRITICAL \
  --format json \
  registry.example.com/myapp:$TAG | jq '.Results[].Vulnerabilities[] | select(.Severity=="CRITICAL")'

# Is the affected package actually used?
syft registry.example.com/myapp:$TAG -o spdx-json | \
  jq '.packages[] | select(.name=="<package-name>")'

# Create a Trivy ignore file for confirmed false positives
cat > .trivyignore << 'EOF'
# CVE-XXXX-YYYY is in an unused package; confirmed not exploitable in our context
# Accepted by: security-team@example.com, 2026-05-01
# Re-evaluate by: 2026-08-01
CVE-XXXX-YYYY
EOF

# Re-run with ignore file
trivy image --ignorefile .trivyignore \
  --severity CRITICAL --exit-code 1 \
  registry.example.com/myapp:$TAG
```

Document every ignored CVE with: who accepted it, the reason, and a re-evaluation date.

---

## Docker and Artifact Failures

### Layer Cache Miss Causing Slow Builds

Symptom: builds that used to take 3 minutes now take 15 minutes. Docker is not caching layers.

```bash
# Check if BuildKit is enabled
echo $DOCKER_BUILDKIT   # should be 1

# Inspect build output for cache hits
docker build --progress=plain ...
# Look for: "CACHED" vs "RUN"

# Common cache miss causes:
# 1. COPY . . before dependency install — any source file change busts the cache
# 2. No --cache-from specified (inline cache not used)
# 3. Base image tag is mutable (e.g., :latest was updated)
```

Good Dockerfile for caching:

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install dependencies first (cached unless package*.json changes)
COPY package*.json ./
RUN npm ci

# Copy source second (busts cache only when source changes)
COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

With BuildKit inline cache in CI:

```bash
docker build \
  --cache-from type=registry,ref=registry.example.com/myapp:cache \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t registry.example.com/myapp:$TAG \
  -t registry.example.com/myapp:cache \
  .
docker push registry.example.com/myapp:cache
```

---

### Registry Authentication Failure

Symptom: `docker push` fails with "unauthorized: authentication required" or `docker pull` fails with "pull access denied."

```bash
# Test authentication directly
echo $REGISTRY_PASSWORD | docker login registry.example.com \
  -u $REGISTRY_USERNAME --password-stdin
echo "Exit: $?"

# Check token expiry (ECR tokens expire after 12 hours)
aws ecr get-authorization-token --region us-east-1 | \
  jq -r '.authorizationData[0].expiresAt'

# For ECR: re-authenticate
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# For GitHub Container Registry:
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Check imagePullSecrets in Kubernetes pod
kubectl get pod <pod> -o jsonpath='{.spec.imagePullSecrets}'
kubectl get secret regcred -n myapp -o jsonpath='{.data.\.dockerconfigjson}' | \
  base64 -d | jq .
```

---

### Image Too Large

Symptom: `docker push` is slow; image pulls take minutes; OOM errors on nodes with many images.

```bash
# Check image size
docker images registry.example.com/myapp:$TAG --format "{{.Size}}"

# Inspect layers
docker history registry.example.com/myapp:$TAG

# Find large files in layers
docker run --rm registry.example.com/myapp:$TAG \
  find / -type f -size +10M 2>/dev/null | head -20
```

Reduction strategies:
- Use a minimal base image: `FROM golang:1.22-alpine` → `FROM alpine:3.19` (multi-stage).
- Remove build tools from final stage.
- Clear package manager caches: `RUN apt-get install -y pkg && rm -rf /var/lib/apt/lists/*`.
- Use `.dockerignore` to exclude `.git`, `node_modules`, test files.

```dockerfile
# Multi-stage: build in full image, run in minimal image
FROM golang:1.22 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app ./cmd/server/

FROM scratch
COPY --from=build /app /app
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["/app"]
```

---

### Manifest Unknown Error

Symptom: `docker pull` or Kubernetes image pull fails with "manifest unknown: manifest unknown."

```bash
# Verify the image and tag exist
docker pull registry.example.com/myapp:$TAG
# or
crane manifest registry.example.com/myapp:$TAG

# Common causes:
# 1. CI pushed the image but used a different tag format
# 2. GitOps manifest references a tag that was never pushed
# 3. Registry is multi-region and image has not replicated yet
# 4. Image was deleted from the registry

# Check available tags
crane ls registry.example.com/myapp | grep $SHORT_SHA

# If the tag does not exist: trace back through CI logs to find where the push happened
```

---

## PromQL Queries for Pipeline Health Monitoring

### ArgoCD

```promql
# Apps not healthy
count(argocd_app_info{health_status!="Healthy"}) by (name, dest_namespace)

# Apps out of sync
count(argocd_app_info{sync_status="OutOfSync"}) by (name)

# Sync duration p95 (seconds)
histogram_quantile(0.95,
  sum(rate(argocd_app_reconcile_bucket[10m])) by (le, dest_server)
)

# Apps in sync error state
argocd_app_info{operation_state_phase="Error"}
```

### GitHub Actions / Jenkins Build Health

```promql
# Jenkins: success ratio over last 1h
sum(rate(jenkins_builds_success_build_count_total[1h]))
/
sum(rate(jenkins_builds_total_build_count_total[1h]))

# Jenkins queue depth (builds waiting)
jenkins_queue_size_value

# Jenkins P95 build duration
histogram_quantile(0.95,
  sum(rate(jenkins_builds_duration_milliseconds_summary_bucket[1h])) by (le)
) / 1000   # convert to seconds
```

### Deployment Health

```promql
# Canary error rate (argo rollouts)
sum(rate(http_requests_total{
  app=~"myapp-canary|myapp",
  status=~"5.."
}[5m])) by (app)
/
sum(rate(http_requests_total{
  app=~"myapp-canary|myapp"
}[5m])) by (app)

# Deployment rollback frequency (last 24h)
sum(increase(deployment_rollback_total{env="production"}[24h]))

# Change failure rate (last 30d)
sum(deployment_events_total{env="production",result="failure"}[30d])
/
sum(deployment_events_total{env="production"}[30d])
* 100

# Lead time p95 (commit to production deploy)
histogram_quantile(0.95,
  sum(rate(deployment_lead_time_seconds_bucket{env="production"}[30d]))
  by (le)
) / 3600   # hours
```
