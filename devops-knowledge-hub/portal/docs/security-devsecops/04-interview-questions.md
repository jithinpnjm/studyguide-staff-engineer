---
title: "Interview Questions"
sidebar_position: 4
---

# Security & DevSecOps — Interview Questions

25 questions covering RBAC, secrets management, supply chain security, zero trust, and compliance. Structured for Staff/Principal engineer interviews.

---

## RBAC and Access Control

### Q1: Explain Kubernetes RBAC. How does it differ from AWS IAM?

**Kubernetes RBAC:**
- Role/ClusterRole defines what verbs are allowed on which resources
- RoleBinding/ClusterRoleBinding assigns these to Users, Groups, or ServiceAccounts
- Role is namespace-scoped; ClusterRole is cluster-wide
- No allow/deny — only allow; anything not explicitly allowed is denied

**AWS IAM:**
- Policies attached to users, roles, or groups
- Supports both allow and explicit deny; explicit deny always wins
- Trust policies define who can assume a role (federation, cross-account)
- Resource-level and action-level control via ARNs and conditions

**Key difference:** Kubernetes RBAC has no deny statements — you can only grant permissions. AWS IAM supports explicit deny, enabling SCP-level restriction on top of permission grants.

---

### Q2: A developer needs to view logs in the `production` namespace but not modify anything. How do you set that up?

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: log-reader
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dev-log-reader
  namespace: production
subjects:
  - kind: User
    name: developer@company.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: log-reader
  apiGroup: rbac.authorization.k8s.io
```

Verify: `kubectl auth can-i get pods/log --as=developer@company.com -n production`

---

### Q3: What is the difference between a RoleBinding and a ClusterRoleBinding?

A RoleBinding grants permissions within a specific namespace. A ClusterRoleBinding grants permissions across all namespaces in the cluster.

You can bind a ClusterRole with a RoleBinding — the ClusterRole defines the permissions, but the binding scopes them to a specific namespace. This is a common pattern: define a reusable ClusterRole (`pod-reader`) and bind it in each namespace where it is needed.

Anti-pattern: using ClusterRoleBindings where namespace-scoped RoleBindings would suffice. A CI tool that only deploys to `staging` does not need cluster-wide permissions.

---

### Q4: How would you audit who has admin access to a Kubernetes cluster?

```bash
# Find all ClusterRoleBindings that grant cluster-admin
kubectl get clusterrolebinding -o json | \
  jq '.items[] | select(.roleRef.name=="cluster-admin") | {name: .metadata.name, subjects: .subjects}'

# Find all bindings across the cluster
kubectl get rolebinding,clusterrolebinding -A -o wide

# Check if a specific user has dangerous permissions
kubectl auth can-i '*' '*' --as=user@company.com
kubectl auth can-i escalate clusterroles --as=user@company.com

# Export full RBAC state for audit
kubectl get roles,rolebindings,clusterroles,clusterrolebindings -A -o yaml > rbac-audit.yaml
```

Regular RBAC audits should check:
- Who has cluster-admin?
- Which service accounts have ClusterRoleBindings?
- Which namespaces lack a default-deny NetworkPolicy?

---

## Secrets Management

### Q5: What happens when HashiCorp Vault is sealed, and how do you handle it in production?

**When sealed:** Vault's encryption key is removed from memory. Vault cannot decrypt any data or respond to any secret requests. All dependent services stop working.

**Recovery:**
- **Manual unseal:** provide the threshold number of unseal keys (e.g., 3 of 5) generated during `vault operator init`
- **Auto-unseal (preferred for production):** configure Vault to retrieve its encryption key from a cloud KMS (AWS KMS, GCP Cloud KMS, Azure Key Vault) — Vault unseals automatically on restart

```bash
# Manual unseal
vault operator unseal <key-1>
vault operator unseal <key-2>
vault operator unseal <key-3>

# Check seal status
vault status
```

**Vault HA setup:** in production, run Vault in HA mode (Raft or Consul storage backend) with at least 3 nodes. Auto-unseal with cloud KMS. Alert on seal events via `vault audit` and Prometheus metrics.

---

### Q6: What are dynamic secrets in Vault and why are they better than static secrets?

Dynamic secrets are generated on demand by Vault and expire after a configurable TTL (e.g., 1 hour). No static credential exists that can be stolen.

**Comparison:**

| Property | Static Secret | Dynamic Secret |
|---|---|---|
| Lifetime | Until manually rotated | Minutes to hours |
| Revocation | Manual | Automatic on TTL expiry |
| Audit trail | Who has the secret? Unknown | Every lease logged with identity |
| Blast radius if stolen | Valid indefinitely | Expires quickly |
| Rotation effort | Manual, error-prone | Automatic |

**Use cases:** database credentials, AWS access keys, TLS certificates, SSH certificates. The application requests credentials at startup, uses them, and they expire. No rotation runbook needed.

---

### Q7: A secret was accidentally committed to a public GitHub repository. What do you do?

**Immediate actions (first 5 minutes):**
1. Rotate/revoke the secret immediately — assume it has already been compromised
2. If a cloud credential: revoke the access key, check CloudTrail/audit logs for unauthorized use
3. Remove the secret from the branch (but this does not remove it from git history)

**Git history cleanup:**
```bash
# Use git-filter-repo (preferred over BFG)
pip install git-filter-repo
git filter-repo --path secrets.yaml --invert-paths

# Force push all branches
git push origin --force --all

# Ask GitHub to run garbage collection (file support ticket)
```

**Medium-term actions:**
- Add the secret pattern to secret scanning rules (GitHub Advanced Security, GitGuardian)
- Enable pre-commit hooks with `detect-secrets` or `git-secrets` to prevent recurrence
- Add the file to `.gitignore` with documentation on why
- Review who may have forked or cloned the repo during the exposure window

**Key insight:** rotating the secret is the most important action. Cleaning git history is important but secondary.

---

### Q8: How do you inject secrets into Kubernetes pods without storing them as plain Kubernetes Secrets?

**Option 1: Vault Agent Sidecar**
The Vault Agent runs as a sidecar, authenticates to Vault using Kubernetes service account tokens, fetches secrets, and writes them to a shared in-memory volume.

```yaml
# Annotation-based injection (Vault Agent Injector)
metadata:
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/agent-inject-secret-db: "production/data/database"
    vault.hashicorp.com/role: "my-app"
```

**Option 2: External Secrets Operator**
Syncs secrets from Vault/AWS SM/GCP SM into Kubernetes Secrets automatically. Secrets are encrypted at rest (with KMS) and rotated on TTL.

**Option 3: CSI Secrets Store Driver**
Mounts secrets from external stores as volumes directly into pods. Secrets never exist as Kubernetes Secret objects.

```yaml
volumes:
  - name: secrets-store
    csi:
      driver: secrets-store.csi.k8s.io
      readOnly: true
      volumeAttributes:
        secretProviderClass: vault-provider
```

---

## Supply Chain Security

### Q9: What is an SBOM and why does it matter?

An SBOM (Software Bill of Materials) is a machine-readable list of all components in a software artifact: libraries, frameworks, versions, licenses, and provenance.

**Why it matters:**
- Log4Shell (2021): organizations with SBOMs immediately knew which services were affected; others spent weeks auditing manually
- Regulatory compliance: US Executive Order 14028 mandates SBOMs for software sold to the US government
- License compliance: SBOMs expose GPL or commercial license dependencies that may require action
- Dependency monitoring: SBOM enables continuous scanning against new CVEs without rebuilding

**SBOM formats:**
- SPDX — Linux Foundation, widely supported
- CycloneDX — OWASP, richer metadata

```bash
# Generate with Syft
syft myapp:latest -o spdx-json > sbom.spdx.json

# Scan SBOM for vulnerabilities
grype sbom:./sbom.spdx.json

# Attach to image with Cosign
cosign attach sbom --sbom sbom.spdx.json myregistry/myapp:v1.0
```

---

### Q10: Explain Sigstore/Cosign image signing. What problem does it solve?

**The problem:** without image signing, you cannot prove that the image in your registry is the exact image produced by your build system. A registry breach, a misconfigured image pull policy, or mutable tags can silently change what gets deployed.

**Cosign solution:**
- Signs the image manifest digest (not the tag) — immutable
- Stores the signature in the same registry as the image (OCI artifact)
- Keyless mode uses the CI system's OIDC identity — no key management, full traceability to the workflow

**Verification in Kubernetes:** pair Cosign with a policy controller (Sigstore Policy Controller, Kyverno) that verifies the signature before admitting the image.

```yaml
# Kyverno policy: require signed images
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  rules:
    - name: check-image-signature
      match:
        resources:
          kinds: ["Pod"]
      verifyImages:
        - imageReferences: ["myregistry/*"]
          attestors:
            - entries:
                - keyless:
                    subject: "https://github.com/myorg/myapp/.github/workflows/build.yaml@refs/heads/main"
                    issuer: "https://token.actions.githubusercontent.com"
```

---

### Q11: What is the SLSA framework and which level should production workloads target?

SLSA (Supply-chain Levels for Software Artifacts) is a four-level framework that measures build integrity:

- **SLSA 1:** Provenance document exists (build metadata is captured)
- **SLSA 2:** Hosted CI/CD produces signed provenance
- **SLSA 3:** Build is isolated, provenance is unforgeable (hardened runner, no secret access during build)
- **SLSA 4:** Hermetic and reproducible build, dual-party review

**Production target:** SLSA 2 is achievable for most teams using GitHub Actions with the SLSA generic generator. SLSA 3 requires hardened runners (no outbound internet, isolated build environment). SLSA 4 requires reproducible builds, which most projects cannot achieve today.

---

## Zero Trust and Network Security

### Q12: How would you implement zero trust for inter-service communication in Kubernetes?

**Layer 1 — mTLS with a service mesh:**
Deploy Istio or Linkerd. Enable STRICT mTLS mode — all pod-to-pod traffic is authenticated with certificates derived from SPIFFE/SPIRE identities.

**Layer 2 — NetworkPolicy:**
Apply default-deny ingress and egress in each namespace. Explicitly allow only required communication paths.

**Layer 3 — Authorization policy (Istio):**
```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-frontend-to-api
  namespace: production
spec:
  selector:
    matchLabels:
      app: api-service
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/frontend-sa"]
      to:
        - operation:
            methods: ["GET", "POST"]
            paths: ["/api/*"]
```

This enforces: only the `frontend-sa` service account can call GET/POST on `/api/*` on the API service. mTLS proves the identity is not spoofed.

---

### Q13: Explain the difference between mTLS and standard TLS.

| Property | TLS | mTLS |
|---|---|---|
| Who authenticates | Server only | Both server and client |
| Certificate required | Server cert from CA | Both sides have certs |
| Use case | Browser-to-server (public traffic) | Service-to-service (internal) |
| Identity proof | Server identity only | Both service identities |

In a zero-trust model, mTLS is critical because "inside the cluster" is not a trust boundary. A compromised pod could impersonate any service using its network address. With mTLS, the certificate proves identity cryptographically.

---

## Runtime Security and Compliance

### Q14: How does Falco detect a container escape attempt?

Falco monitors system calls at the kernel level (via eBPF or kernel module). Container escapes typically involve:
- Calling `unshare` to escape namespace isolation
- Writing to `cgroup` directories
- Calling `ptrace` on host processes
- Mounting host filesystem paths

A Falco rule can detect and alert on any of these syscalls:

```yaml
- rule: Container escape via unshare
  condition: >
    spawned_process and container
    and proc.name = "unshare"
  output: "Possible container escape via unshare (user=%user.name container=%container.id)"
  priority: CRITICAL
```

---

### Q15: A pod is in CrashLoopBackOff with "permission denied" errors. How do you diagnose and fix it?

```bash
# Step 1: Check logs from previous crash
kubectl logs my-pod --previous

# Step 2: Inspect security context
kubectl get pod my-pod -o yaml | grep -A 20 securityContext

# Step 3: Check Pod Security Admission violations
kubectl describe pod my-pod | grep -i "security\|admission\|forbidden"

# Step 4: Check if namespace enforces Pod Security Standards
kubectl get namespace production -o yaml | grep pod-security

# Step 5: Check if a NetworkPolicy is blocking a required connection
kubectl get networkpolicy -n production
```

**Common causes and fixes:**

| Cause | Fix |
|---|---|
| App runs as root but `runAsNonRoot: true` is set | Rebuild image with `USER 1000` |
| `readOnlyRootFilesystem: true` but app writes to filesystem | Mount a writable `emptyDir` for temp files |
| App needs capabilities (e.g., bind port 80) | Add specific capability: `capabilities.add: [NET_BIND_SERVICE]` |
| PSS `restricted` profile blocks the pod | Review which restriction is violated; fix in image or deployment |

---

## Compliance and Policy

### Q16: How do you enforce a company policy that all containers must have resource limits?

Use OPA/Gatekeeper with a ConstraintTemplate:

```rego
package k8srequiredresources

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %v must set resources.limits.memory", [container.name])
}

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.cpu
  msg := sprintf("Container %v must set resources.limits.cpu", [container.name])
}
```

This blocks any Deployment or Pod that does not set CPU and memory limits at admission time, before the resource is created.

---

### Q17: What does CIS Benchmark scanning catch that Trivy misses?

Trivy scans for known CVEs in software packages within images. CIS Benchmarks (via `kube-bench`) audit the Kubernetes cluster configuration itself:
- API server flags (audit logging enabled, anonymous auth disabled)
- Kubelet configuration (TLS authentication required, protect kernel defaults)
- etcd security (TLS encryption, separate etcd cluster)
- RBAC configuration (no default service account token auto-mounting)
- Pod Security Standards enforcement at the namespace level

Both are necessary: Trivy finds vulnerable software; kube-bench finds misconfigured cluster components.

---

### Q18: How do you secure Terraform state files?

```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "alias/terraform-state-key"
    dynamodb_table = "terraform-state-locks"
  }
}
```

**Full checklist:**
- S3 bucket with SSE-KMS encryption
- S3 versioning enabled (rollback capability)
- DynamoDB state locking (prevents concurrent applies)
- IAM bucket policy restricts access to terraform role only
- S3 access logging enabled
- Never store raw secrets in Terraform resources — reference from Vault or Secrets Manager

---

### Q19: What is a Security Quality Gate and how do you implement one in CI?

A Security Quality Gate is a pass/fail condition in the CI pipeline that blocks deployment when security standards are not met.

```yaml
# GitHub Actions security quality gate
jobs:
  security-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Container scan — fail on CRITICAL
        run: |
          trivy image --exit-code 1 --severity CRITICAL \
            myapp:${{ github.sha }}

      - name: SAST — check quality gate
        run: |
          sonar-scanner -Dsonar.projectKey=myapp
          # Quality gate checked via webhook or poll

      - name: Secrets scan — fail if secrets found
        uses: trufflesecurity/trufflehog@main
        with:
          fail: true

      - name: IaC scan — fail on HIGH
        run: |
          tfsec ./terraform --minimum-severity HIGH
          checkov -d ./kubernetes --framework kubernetes \
            --hard-fail-on HIGH
```

All must pass before the deploy job runs.

---

### Q20: How would you detect lateral movement in a Kubernetes cluster?

Lateral movement occurs when an attacker who has compromised one pod attempts to reach other pods, services, or cloud credentials.

**Detection methods:**

1. **Falco rules:** alert on unexpected outbound connections, DNS lookups to cloud metadata endpoints, or `curl` running inside containers

2. **Network flow monitoring (Cilium/Hubble):**
```bash
# See all flows in the cluster
hubble observe --all-namespaces
# Filter for unexpected pod-to-pod flows
hubble observe --namespace production --verdict DROPPED
```

3. **Audit log analysis:** watch for service accounts accessing secrets or API resources outside their normal pattern

4. **Cloud metadata endpoint access:** alert on any pod calling `169.254.169.254` (AWS IMDS) that is not explicitly allowed — this is a common step in cloud credential theft

---

### Q21: What is STRIDE and how do you use it in a design review?

STRIDE is a threat modelling framework applied at design time to find security gaps before implementation.

**Process:**
1. Draw a data flow diagram of the proposed system
2. Identify all trust boundaries (where data crosses security zones)
3. For each component and each boundary, apply STRIDE:
   - Spoofing — who could impersonate this identity?
   - Tampering — who could modify this data in transit or at rest?
   - Repudiation — could someone deny performing an action?
   - Information Disclosure — who could read data they should not?
   - Denial of Service — how could this component be made unavailable?
   - Elevation of Privilege — how could access be gained beyond what is authorized?
4. For each threat: assign likelihood, impact, and mitigation
5. Assign mitigations to design requirements

At a staff engineer level, you facilitate STRIDE sessions for new systems and ensure mitigations appear in design documents.

---

### Q22: How do you prevent secrets from being baked into container images?

**Detection:**
```bash
# Scan image layers for secrets
trivy image --scanners secret myapp:latest

# Check image history for suspicious ENV or COPY steps
docker history myapp:latest --no-trunc
```

**Prevention:**
- Never use `ENV PASSWORD=...` in Dockerfiles
- Use multi-stage builds — build stage has secrets, final stage does not
- Use `--secret` flag in BuildKit (secret not written to any layer):
```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm install
```
```bash
docker build --secret id=npm_token,env=NPM_TOKEN .
```
- Scan images in CI before push to registry; fail build if secrets detected

---

### Q23: How would you respond to a supply chain attack where a compromised package was published to npm?

**Immediate:**
1. Identify which services consume the package (SBOM makes this instant)
2. Check the exact version range — is the compromised version in the lockfile?
3. If affected: roll back deployments to last known-good image, do not redeploy until fixed
4. Notify security team; begin incident response

**Investigation:**
- Check if the malicious package executed at install time (`postinstall` scripts are a common vector)
- Review CI logs for unexpected network connections during the build that used the package
- Check for exfiltrated secrets (outbound connections from build environment)

**Recovery:**
- Pin the dependency to a known-good version
- Update lockfile and rebuild
- Scan new image with Trivy and Grype before deployment
- Add the package to a dependency allow-list or block-list in Artifactory/Nexus

**Prevention:**
- Lock exact versions in package-lock.json or yarn.lock
- Use npm audit and Snyk in CI
- Use an internal artifact proxy (Nexus, Artifactory) that can block flagged packages
- Enable dependency review (GitHub) on PRs

---

### Q24: What is workload identity and why is it preferred over service account keys?

**Service account keys (bad practice):**
- JSON file with a private key that never expires unless manually rotated
- If stolen, valid indefinitely until rotated
- Key rotation is a manual operational burden
- No automatic revocation when a pod is deleted

**Workload identity (preferred):**
- Pod receives a short-lived OIDC token (rotated every ~1 hour by the kubelet)
- Token is exchanged for cloud credentials via STS/OIDC federation
- Credentials expire automatically — no rotation needed
- If a pod is deleted, access is immediately revoked
- Full audit trail: every credential exchange logged with pod identity and namespace

**Implementations:**
- AWS: IRSA (IAM Roles for Service Accounts)
- GKE: Workload Identity
- Azure: Workload Identity (federated credentials)

---

### Q25: How do you implement least privilege for a CI/CD pipeline?

**Principle:** each pipeline stage should have only the permissions needed for that specific stage, for the duration of that stage.

```yaml
# GitHub Actions — scoped permissions per job
jobs:
  build:
    permissions:
      contents: read
      packages: write     # only for the build job

  deploy-staging:
    permissions:
      id-token: write     # for OIDC federation
      contents: read
    environment: staging  # requires approval for production
```

**OIDC federation for cloud access:**
```yaml
- name: Configure AWS credentials via OIDC
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT:role/github-ci-staging
    aws-region: us-east-1
    role-session-duration: 900  # 15 minutes — minimum needed
```

The IAM role's trust policy scopes it to:
- Specific GitHub org/repo
- Specific branch (`refs/heads/main`)
- Specific environment (`staging`)

No long-lived credentials stored anywhere. Short-lived tokens for each job run.
