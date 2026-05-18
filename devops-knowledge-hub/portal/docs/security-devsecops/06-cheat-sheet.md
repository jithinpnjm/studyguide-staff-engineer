---
title: "Cheat Sheet"
sidebar_position: 6
---

# Security & DevSecOps — Cheat Sheet

Quick reference for the most-used security commands. Bookmark this for on-call and interview prep.

---

## kubectl — Security Commands

```bash
# RBAC audit
kubectl auth can-i get pods --as=jane -n production
kubectl auth can-i '*' '*' --as=jane
kubectl auth can-i get secrets --as=system:serviceaccount:production:my-sa -n production

# Find all cluster-admin bindings
kubectl get clusterrolebinding -o json | \
  jq '.items[] | select(.roleRef.name=="cluster-admin") | {name: .metadata.name, subjects: .subjects}'

# Find all role bindings for a user
kubectl get rolebinding,clusterrolebinding -A -o wide | grep jane

# List all RBAC resources
kubectl get roles,rolebindings,clusterroles,clusterrolebindings -A

# Export full RBAC state
kubectl get roles,rolebindings,clusterroles,clusterrolebindings -A -o yaml > rbac-audit.yaml

# Check SecurityContext on a pod
kubectl get pod <pod-name> -o yaml | grep -A 20 securityContext

# Check pod security admission labels on namespaces
kubectl get namespaces -o json | jq '.items[] | {name: .metadata.name, labels: .metadata.labels | with_entries(select(.key | contains("pod-security")))}'

# List network policies
kubectl get networkpolicy -A
kubectl describe networkpolicy <name> -n <ns>

# Check events for security-related errors
kubectl get events -A --sort-by=.lastTimestamp | grep -i "forbidden\|denied\|error"

# Debug admission webhook rejections
kubectl describe pod <pod-name> | grep -A 5 "Warning\|Error"

# Check if a service account auto-mounts tokens
kubectl get serviceaccount <name> -n <ns> -o yaml | grep automountServiceAccountToken

# Disable token auto-mounting (patch in place)
kubectl patch serviceaccount default -n production \
  -p '{"automountServiceAccountToken": false}'

# Decode a Kubernetes Secret
kubectl get secret <name> -n <ns> -o jsonpath='{.data.<key>}' | base64 -d

# Check cert-manager certificate status
kubectl describe certificate <name> -n <ns>
kubectl get certificaterequest -A
kubectl logs -n cert-manager deploy/cert-manager | tail -50
```

---

## Trivy

```bash
# Scan a container image
trivy image nginx:latest

# Scan only HIGH and CRITICAL
trivy image --severity HIGH,CRITICAL nginx:latest

# Fail CI if any CRITICAL found
trivy image --exit-code 1 --severity CRITICAL myapp:$GIT_SHA

# Scan image layers for secrets
trivy image --scanners secret myapp:latest

# Scan for misconfigurations (Dockerfile, K8s manifests)
trivy image --scanners misconfig myapp:latest

# Scan a local filesystem
trivy fs /path/to/project

# Scan Kubernetes cluster
trivy k8s --report summary cluster

# Scan specific namespace
trivy k8s --namespace production --report summary cluster

# SARIF output for GitHub Security tab
trivy image --format sarif --output trivy-results.sarif myapp:latest

# JSON output for parsing
trivy image --format json --output results.json myapp:latest

# Filter by CVE ID
trivy image --format json myapp:latest | jq '.Results[].Vulnerabilities[] | select(.VulnerabilityID == "CVE-2023-XXXX")'

# Scan with ignore file (suppress known false positives)
trivy image --ignorefile .trivyignore myapp:latest

# Scan an SBOM file
trivy sbom sbom.spdx.json
```

**.trivyignore example:**
```
# CVE-YYYY-XXXX: accepted risk, no fix available upstream
CVE-2023-12345
```

---

## OPA / conftest

```bash
# Install conftest
brew install conftest

# Test a manifest against policies in ./policy dir
conftest test deployment.yaml

# Test multiple files
conftest test ./kubernetes/*.yaml

# Test Terraform plan
terraform plan -out=plan.out
terraform show -json plan.out > plan.json
conftest test plan.json --policy policies/

# Test with a specific policy file
conftest test deployment.yaml --policy policies/security.rego

# Show all results including passing tests
conftest test deployment.yaml --all-namespaces

# Lint Rego files
opa fmt --diff policy/*.rego

# Test a Rego policy unit test
opa test policy/ -v

# Evaluate a Rego expression directly
opa eval -d policy/security.rego 'data.main.deny' \
  --input deployment.json

# Parse and validate a Rego file
opa check policy/security.rego
```

**Rego quick patterns:**
```rego
# Deny if field is missing
deny[msg] {
  not input.spec.template.spec.securityContext.runAsNonRoot
  msg := "runAsNonRoot must be true"
}

# Deny if value is wrong
deny[msg] {
  input.spec.template.spec.containers[_].securityContext.privileged == true
  msg := "privileged containers are not allowed"
}

# Deny if label missing
deny[msg] {
  not input.metadata.labels.team
  msg := "all deployments must have a 'team' label"
}
```

---

## Vault CLI

```bash
# Authentication
vault login -method=kubernetes role=my-role
vault login -method=aws role=my-role
vault login <token>

# Status and health
vault status
vault health

# Secrets — KV v2
vault kv get secret/production/database
vault kv put secret/production/database password=mysecret
vault kv list secret/production/
vault kv delete secret/production/database
vault kv metadata get secret/production/database  # version history

# Dynamic secrets — database
vault secrets enable database
vault read database/creds/my-role

# Dynamic secrets — AWS
vault secrets enable aws
vault read aws/creds/my-role

# Leases
vault lease list secret/production/database
vault lease renew <lease-id>
vault lease revoke <lease-id>
vault lease revoke -prefix secret/production/  # revoke all under path

# Policies
vault policy list
vault policy read my-policy
vault policy write my-policy policy.hcl

# Tokens
vault token create -policy=my-policy -ttl=1h
vault token renew <token>
vault token revoke <token>
vault token lookup <token>

# Audit
vault audit enable file file_path=/var/log/vault-audit.log
vault audit list

# Seal/Unseal
vault status
vault operator unseal <key>
vault operator seal  # emergency seal

# Init (first-time setup)
vault operator init -key-shares=5 -key-threshold=3

# Raft (HA storage)
vault operator raft list-peers
vault operator raft join https://vault-node-2:8200
```

---

## Cosign

```bash
# Generate key pair
cosign generate-key-pair
# Creates cosign.key (private) and cosign.pub (public)

# Sign an image (key-based)
cosign sign --key cosign.key myregistry/myapp:v1.0.0

# Sign an image (keyless — uses OIDC identity)
cosign sign myregistry/myapp:$GIT_SHA
# Set env: COSIGN_EXPERIMENTAL=1 for transparency log

# Verify a signature (key-based)
cosign verify --key cosign.pub myregistry/myapp:v1.0.0

# Verify a signature (keyless)
cosign verify \
  --certificate-identity=https://github.com/myorg/myapp/.github/workflows/build.yaml@refs/heads/main \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  myregistry/myapp:v1.0.0

# Attach SBOM to image
cosign attach sbom --sbom sbom.spdx.json myregistry/myapp:v1.0.0

# Attest with predicate (SBOM, SLSA provenance, etc.)
cosign attest \
  --key cosign.key \
  --predicate sbom.spdx.json \
  --type spdxjson \
  myregistry/myapp:v1.0.0

# Verify attestation
cosign verify-attestation \
  --key cosign.pub \
  --type spdxjson \
  myregistry/myapp:v1.0.0 | jq .

# Copy signature to another registry
cosign copy myregistry/myapp:v1.0.0 newregistry/myapp:v1.0.0

# Generate SBOM with Syft and sign
syft myregistry/myapp:v1.0.0 -o spdx-json > sbom.json
cosign attest --predicate sbom.json --type spdxjson myregistry/myapp:v1.0.0
```

---

## Falco

```bash
# Check Falco status
kubectl get pods -n falco
kubectl logs -n falco -l app.kubernetes.io/name=falco -f

# View alerts in real time
kubectl logs -n falco -l app.kubernetes.io/name=falco -f | grep -v "^{" | grep -i "warning\|error\|critical"

# List active rules
falcoctl rule list

# Validate a custom rule file
falco --validate /path/to/custom-rules.yaml

# Run Falco with a custom rule
falco -r /path/to/custom-rules.yaml

# Test a specific rule
falco -r custom-rules.yaml -M 30  # run for 30 seconds

# View Falco metrics (if Prometheus enabled)
curl http://falco-pod-ip:8765/metrics

# Filter Falco output by priority
kubectl logs -n falco -l app=falco | jq '. | select(.priority == "CRITICAL")'
```

**Common Falco rule conditions:**
```yaml
# Useful macros
container            # event is in a container
spawned_process      # a new process was started
open_write           # a file was opened for writing
outbound             # outbound network connection

# Common rule structure
condition: >
  spawned_process
  and container
  and proc.name = bash
  and not proc.pname in (known_shell_parents)
```

---

## TLS / Certificates

```bash
# Check certificate expiry date
echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -dates

# Full certificate details
openssl s_client -connect api.example.com:443 -servername api.example.com

# Check certificate SANs (Subject Alternative Names)
echo | openssl s_client -connect api.example.com:443 2>/dev/null \
  | openssl x509 -noout -text | grep -A 3 "Subject Alternative"

# Decode a certificate file
openssl x509 -in cert.pem -noout -text

# Check TLS version support
openssl s_client -connect api.example.com:443 -tls1_2
openssl s_client -connect api.example.com:443 -tls1_3

# Alert if certificate expires within 30 days
cert_expiry=$(echo | openssl s_client -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -enddate | cut -d= -f2)
expiry_epoch=$(date -d "$cert_expiry" +%s)
now_epoch=$(date +%s)
days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
echo "Days until expiry: $days_left"
[ $days_left -lt 30 ] && echo "ALERT: Certificate expires in $days_left days"

# Generate a self-signed cert (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout selfsigned.key -out selfsigned.crt \
  -subj "/CN=example.com"

# Generate CSR
openssl req -new -newkey rsa:2048 -nodes \
  -keyout private.key -out request.csr \
  -subj "/CN=api.example.com/O=MyOrg"
```

---

## IaC Scanning

```bash
# tfsec — scan Terraform
tfsec .
tfsec . --minimum-severity HIGH
tfsec . --format sarif > tfsec.sarif
tfsec . --format json > tfsec.json
tfsec . --include-passed  # show passing checks too

# Checkov — multi-platform
pip install checkov

checkov -d ./terraform
checkov -d ./kubernetes --framework kubernetes
checkov -f Dockerfile
checkov -d . --output json > checkov-results.json
checkov -d . --hard-fail-on HIGH,CRITICAL

# kube-bench — CIS Benchmark audit
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench
kubectl delete job kube-bench

# kube-score — security and reliability scoring
kube-score score ./kubernetes/*.yaml
kube-score score deployment.yaml --output-format ci

# Semgrep — SAST
semgrep --config auto src/
semgrep --config p/owasp-top-ten src/
semgrep --config p/kubernetes src/
```

---

## Secret Scanning

```bash
# TruffleHog — scan git history for secrets
trufflehog git file://. --only-verified
trufflehog github --org=myorg --only-verified

# detect-secrets — pre-commit hook
pip install detect-secrets
detect-secrets scan > .secrets.baseline
detect-secrets audit .secrets.baseline

# git-secrets
git-secrets --install
git-secrets --register-aws
git-secrets --scan

# Scan a single file
gitleaks detect --source . --log-opts="--all"

# Pre-commit hook setup
cat > .pre-commit-config.yaml <<'EOF'
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
EOF
pre-commit install
```
