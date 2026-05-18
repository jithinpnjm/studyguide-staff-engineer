---
title: "Intermediate"
sidebar_position: 2
---

# Security & DevSecOps — Intermediate

At the intermediate level, security moves from concepts to implementation: enforcing access controls at scale, integrating scanning into pipelines, and building cryptographic trust into artifact delivery.

---

## Kubernetes RBAC

RBAC (Role-Based Access Control) is Kubernetes' mechanism for managing permissions. It controls what users, groups, and service accounts can do with Kubernetes resources.

### Core objects

| Object | Scope | Purpose |
|---|---|---|
| Role | Namespace | Defines allowed verbs on resources within a namespace |
| ClusterRole | Cluster-wide | Defines allowed verbs on resources across all namespaces |
| RoleBinding | Namespace | Assigns a Role or ClusterRole to a subject in a namespace |
| ClusterRoleBinding | Cluster-wide | Assigns a ClusterRole to a subject across the whole cluster |

**Subjects** — who the binding applies to:
- `User` — a human authenticated to the cluster
- `Group` — a collection of users (often LDAP/OIDC groups)
- `ServiceAccount` — a pod's identity within the cluster

### Read-only role for a namespace

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "pods/status"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]
```

### Bind the role to a user

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: production
subjects:
  - kind: User
    name: jane
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### Service account for a monitoring tool

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: monitoring-agent
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-agent-binding
subjects:
  - kind: ServiceAccount
    name: monitoring-agent
    namespace: monitoring
roleRef:
  kind: ClusterRole
  name: cluster-reader
  apiGroup: rbac.authorization.k8s.io
```

### Auditing RBAC permissions

```bash
# Check if a user can perform an action
kubectl auth can-i get pods --as=jane -n production
kubectl auth can-i delete deployments --as=jane -n production
kubectl auth can-i '*' '*' --as=jane   # check for admin

# Check service account permissions
kubectl auth can-i get secrets \
  --as=system:serviceaccount:production:app-sa -n production

# List all role bindings in a namespace
kubectl get rolebinding,clusterrolebinding -A | grep jane

# See what a ClusterRole allows
kubectl describe clusterrole cluster-reader
```

### RBAC anti-patterns

- Granting `cluster-admin` to fix a permission problem quickly — sets a precedent and is hard to remove later
- Using `*` on verbs or resources — defeats the purpose of RBAC
- Binding ClusterRoles where namespace-scoped Roles would suffice
- Not regularly auditing who has what access

---

## Network Policies

Without a NetworkPolicy, all pods in a Kubernetes cluster can reach all other pods. NetworkPolicies are the firewall rules for pod-to-pod traffic.

### Default deny all ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
```

This policy selects all pods in the namespace and blocks all incoming traffic. Explicitly allow only what is needed.

### Allow frontend to reach backend on port 8080

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
```

### Allow monitoring namespace to scrape metrics

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-prometheus-scrape
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - protocol: TCP
          port: 9090
```

---

## Pod Security Standards

Pod Security Standards (PSS) replaced Pod Security Policies (PSP) in Kubernetes 1.25. They define security profiles enforced via the Pod Security Admission controller.

### Three profiles

| Profile | Intent | Key restrictions |
|---|---|---|
| Privileged | Unrestricted | No restrictions — only for trusted system pods |
| Baseline | Prevent known privilege escalations | Blocks hostNetwork, hostPID, hostPath, privilege |
| Restricted | Hardened | Requires non-root, read-only root FS, seccomp, drops all capabilities |

### Apply at namespace level

```bash
# Label a namespace to enforce the restricted profile
kubectl label namespace production \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted
```

Using `enforce` blocks non-compliant pods. `warn` allows them but shows a warning. `audit` logs violations.

---

## Image Scanning with Trivy

Trivy scans container images, filesystems, git repos, and Kubernetes clusters for vulnerabilities, misconfigurations, and secrets.

```bash
# Scan a Docker image
trivy image nginx:latest

# Scan only HIGH and CRITICAL
trivy image --severity HIGH,CRITICAL nginx:latest

# Fail CI if any CRITICAL CVE is found
trivy image --exit-code 1 --severity CRITICAL myapp:$GIT_SHA

# Scan a local filesystem
trivy fs /path/to/project

# Scan a Kubernetes cluster
trivy k8s --report summary cluster

# Output SARIF for GitHub Security tab
trivy image --format sarif --output trivy-results.sarif myapp:latest
```

### Trivy in GitHub Actions

```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'

- name: Upload Trivy scan results to GitHub Security tab
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

---

## SAST and DAST

### SAST — Static Application Security Testing

Analyzes source code without executing it. Catches security issues during development.

Tools:
- **SonarQube** — broad language support, quality gates, CI integration
- **Semgrep** — fast, pattern-based, custom rules for org-specific patterns
- **CodeQL** — GitHub's semantic analysis engine; finds logic vulnerabilities

```bash
# SonarQube scan
sonar-scanner \
  -Dsonar.projectKey=my-project \
  -Dsonar.sources=src \
  -Dsonar.host.url=$SONAR_HOST_URL \
  -Dsonar.login=$SONAR_TOKEN

# Semgrep scan
semgrep --config auto src/
semgrep --config p/owasp-top-ten src/
```

### DAST — Dynamic Application Security Testing

Tests a running application by sending crafted requests. Catches issues only visible at runtime: injection, auth bypasses, business logic flaws.

Tools:
- **OWASP ZAP** — open-source, CI-friendly
- **Burp Suite** — manual and automated; standard in pen testing
- **Nuclei** — template-based scanner

DAST runs against staging environments, never against production directly.

---

## Supply Chain Security — SBOM and Sigstore/Cosign

### Why supply chain matters

The SolarWinds attack (2020) and Log4Shell demonstrated that compromised build processes and dependencies can reach thousands of organizations simultaneously. A supply chain attack targets the build or distribution process rather than the running application.

### SBOM — Software Bill of Materials

An SBOM is a machine-readable inventory of every component in a software artifact: libraries, versions, licenses, and provenance.

```bash
# Generate SBOM with Syft
syft myapp:latest -o spdx-json > sbom.json
syft myapp:latest -o cyclonedx-json > sbom-cyclonedx.json

# Scan SBOM for vulnerabilities with Grype
grype sbom:./sbom.json

# Attach SBOM to image with Cosign
cosign attach sbom --sbom sbom.json myapp:latest
```

SBOM formats:
- **SPDX** — Linux Foundation standard, widely supported
- **CycloneDX** — OWASP standard, richer metadata support

### Sigstore and Cosign — Image Signing

Cosign (from the Sigstore project) signs container images to prove they came from a trusted build process.

```bash
# Generate a key pair
cosign generate-key-pair

# Sign an image after build
cosign sign --key cosign.key myregistry/myapp:$GIT_SHA

# Verify a signature before deploying
cosign verify --key cosign.pub myregistry/myapp:$GIT_SHA

# Keyless signing with OIDC (GitHub Actions)
cosign sign myregistry/myapp:$GIT_SHA
# Uses GitHub Actions OIDC identity — no key management needed
```

### Keyless signing in GitHub Actions

```yaml
- name: Sign container image
  uses: sigstore/cosign-installer@main
- run: |
    cosign sign \
      --yes \
      ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
  env:
    COSIGN_EXPERIMENTAL: "1"
```

---

## Secrets Management at Scale

### HashiCorp Vault

Vault is the production standard for secrets management. Key capabilities:

- **Dynamic secrets** — generates short-lived credentials on demand (database passwords, AWS keys, TLS certs)
- **Lease and renewal** — secrets have TTLs; applications must renew or they expire automatically
- **Audit log** — every secret access is logged with identity and timestamp
- **Policies** — fine-grained control over which paths each identity can access

```bash
# Enable database secrets engine
vault secrets enable database

# Configure PostgreSQL
vault write database/config/my-postgres \
    plugin_name=postgresql-database-plugin \
    connection_url="postgresql://{{username}}:{{password}}@postgres:5432/mydb" \
    username="vault-admin" \
    password="vault-password" \
    allowed_roles="app-role"

# Create role with 1-hour TTL
vault write database/roles/app-role \
    db_name=my-postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"

# Generate credentials
vault read database/creds/app-role
```

### Kubernetes Secrets with encryption at rest

Kubernetes Secrets are base64-encoded, not encrypted by default. Enable encryption at rest with KMS:

```yaml
# encryption-config.yaml (apply to kube-apiserver)
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-key>
      - identity: {}
```

### External Secrets Operator

Syncs secrets from external stores (Vault, AWS SM, GCP SM) into Kubernetes Secrets:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: database-credentials
  data:
    - secretKey: password
      remoteRef:
        key: production/database
        property: password
```

---

## Mutual TLS (mTLS)

Standard TLS authenticates only the server to the client. mTLS adds client certificate authentication — both sides prove their identity.

**Why it matters for microservices:**
- In a zero-trust architecture, services cannot trust other services just because they are inside the cluster
- mTLS provides cryptographic proof of service identity, not just network location
- Eliminates the need for shared secrets between services

### mTLS with Istio (service mesh)

```yaml
# Enforce mTLS across the entire mesh
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
```

```yaml
# Namespace-level mTLS
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT
```

With STRICT mode, all traffic in the namespace must use mTLS. Linkerd and Cilium provide similar capabilities.

---

## IaC Security Scanning

Catch misconfigurations before infrastructure is deployed.

| Tool | Targets | Key feature |
|---|---|---|
| tfsec | Terraform | CIS Benchmarks, custom rules, SARIF output |
| Checkov | Terraform, CloudFormation, K8s, Dockerfiles | Multi-platform |
| Terrascan | Terraform, Helm, K8s | OPA policies |
| kube-score | Kubernetes manifests | Security and reliability scoring |

```bash
# tfsec scan
tfsec . --format sarif > tfsec.sarif

# Checkov — scan Kubernetes manifests
checkov -d ./kubernetes --framework kubernetes --output json > checkov.json

# kube-score
kube-score score ./kubernetes/*.yaml
```

Common findings:
- S3 bucket without server-side encryption
- Security group with `0.0.0.0/0` open on all ports
- IAM policy with `*:*` wildcard permissions
- Kubernetes containers without resource limits
- Missing `runAsNonRoot: true` in securityContext

---

## Key Takeaways

- RBAC: use the minimal Role for the minimal scope; always prefer namespace Roles over ClusterRoles
- Network Policies: default deny all, then explicitly allow; test with `kubectl exec` to verify
- Pod Security Standards replace PSP — label namespaces with `restricted` for production
- Trivy: fail CI on `CRITICAL` findings; use SARIF to publish results to GitHub Security tab
- SBOM is the ingredient list for your software; sign it and attach it to every image
- Cosign keyless signing uses OIDC — no key management, full traceability to the CI job
- Vault dynamic secrets: short-lived credentials are automatically revoked; prefer them over long-lived secrets
- mTLS provides cryptographic service identity — not just "inside the cluster" trust
