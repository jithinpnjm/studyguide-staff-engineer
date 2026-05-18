---
title: "Hands-On Labs"
sidebar_position: 5
---

# Security & DevSecOps — Hands-On Labs

These labs use local tools and a Kubernetes cluster (kind or minikube). Each lab builds a concrete skill with a specific, verifiable outcome.

---

## Lab 1: Container Image Scanning with Trivy

**Goal:** scan a container image for vulnerabilities, interpret the results, and integrate the scan into a CI pipeline.

**Prerequisites:** Docker, Trivy installed (`brew install trivy` or `apt install trivy`)

### Step 1: Basic image scan

```bash
# Scan a commonly-used image
trivy image nginx:latest

# You will see output like:
# CVE-2023-XXXX  HIGH  openssl  3.0.2  3.0.3  ...
```

### Step 2: Understand severity levels

```bash
# Scan only for HIGH and CRITICAL
trivy image --severity HIGH,CRITICAL nginx:latest

# Count total findings by severity
trivy image --format json nginx:latest | \
  jq '.Results[].Vulnerabilities[] | .Severity' | sort | uniq -c
```

### Step 3: Scan your own image

```dockerfile
# Create a deliberately vulnerable Dockerfile
FROM python:3.9-slim

RUN pip install django==3.0.0  # known CVEs

COPY app.py .
CMD ["python", "app.py"]
```

```bash
docker build -t lab-vuln:latest .
trivy image lab-vuln:latest
```

### Step 4: Fix and rescan

```dockerfile
FROM python:3.12-slim
RUN pip install django==4.2.7  # patched version
```

```bash
docker build -t lab-fixed:latest .
trivy image --severity HIGH,CRITICAL lab-fixed:latest
# Verify: fewer or zero findings
```

### Step 5: Fail CI on CRITICAL findings

```bash
# Exit code 1 if any CRITICAL CVE found
trivy image --exit-code 1 --severity CRITICAL lab-fixed:latest
echo "Exit code: $?"
```

### Step 6: Generate SARIF for GitHub Security tab

```bash
trivy image --format sarif --output trivy-results.sarif lab-fixed:latest
cat trivy-results.sarif | jq '.runs[0].results | length'
```

### Step 7: Scan for secrets in an image

```bash
# Scan image layers for accidentally baked-in secrets
trivy image --scanners secret lab-fixed:latest
```

**Verification:** you can explain what each CVE is, why it is rated as it is, and how to remediate it (upgrade the package).

---

## Lab 2: OPA/Gatekeeper Policy Enforcement

**Goal:** install Gatekeeper on a local cluster, write a policy that requires resource limits, and verify it blocks non-compliant pods.

**Prerequisites:** kind or minikube, kubectl, Helm

### Step 1: Create a kind cluster

```bash
kind create cluster --name security-lab
kubectl cluster-info --context kind-security-lab
```

### Step 2: Install Gatekeeper

```bash
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update
helm install gatekeeper gatekeeper/gatekeeper \
  --namespace gatekeeper-system \
  --create-namespace

# Wait for Gatekeeper to be ready
kubectl wait --for=condition=ready pod \
  -l app=gatekeeper \
  -n gatekeeper-system \
  --timeout=60s
```

### Step 3: Create a ConstraintTemplate

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredresources
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredResources
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredresources

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.memory
          msg := sprintf("Container '%v' must set resources.limits.memory", [container.name])
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.cpu
          msg := sprintf("Container '%v' must set resources.limits.cpu", [container.name])
        }
EOF
```

### Step 4: Apply the Constraint

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredResources
metadata:
  name: require-resource-limits
spec:
  match:
    kinds:
      - apiGroups: ["", "apps"]
        kinds: ["Pod", "Deployment"]
    namespaces: ["default"]
EOF
```

### Step 5: Test — deploy without resource limits (should be blocked)

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-limits
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: no-limits
  template:
    metadata:
      labels:
        app: no-limits
    spec:
      containers:
        - name: app
          image: nginx:latest
          # No resources.limits set — should be blocked
EOF
# Expected: admission webhook denied the request
```

### Step 6: Test — deploy with resource limits (should succeed)

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: with-limits
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: with-limits
  template:
    metadata:
      labels:
        app: with-limits
    spec:
      containers:
        - name: app
          image: nginx:latest
          resources:
            limits:
              cpu: "100m"
              memory: "128Mi"
            requests:
              cpu: "50m"
              memory: "64Mi"
EOF
kubectl get deployment with-limits
```

### Step 7: Test conftest locally

```bash
# Install conftest
brew install conftest

# Create a Rego policy file
cat > policy/require_limits.rego <<'REGO'
package main

deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %v must have memory limits", [container.name])
}
REGO

# Test against a manifest
conftest test ./kubernetes/deployment.yaml --policy policy/
```

**Verification:** you can deploy compliant workloads and are blocked from deploying non-compliant ones.

---

## Lab 3: HashiCorp Vault Secret Injection

**Goal:** run Vault locally, enable Kubernetes authentication, and inject a secret into a pod without storing it as a Kubernetes Secret.

**Prerequisites:** Vault CLI, kubectl, kind cluster

### Step 1: Start Vault in dev mode

```bash
# Dev mode starts Vault with root token and in-memory storage
vault server -dev -dev-root-token-id="root" &
export VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_TOKEN="root"
vault status
```

### Step 2: Write a secret

```bash
vault kv put secret/production/database \
  username="app_user" \
  password="super-secret-password"

# Verify
vault kv get secret/production/database
```

### Step 3: Enable Kubernetes auth

```bash
vault auth enable kubernetes

vault write auth/kubernetes/config \
  kubernetes_host="https://$(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.server}')" \
  kubernetes_ca_cert=@<(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' | base64 -d) \
  token_reviewer_jwt="$(kubectl create token vault-auth -n default)"
```

### Step 4: Create a Vault policy and role

```bash
vault policy write production-db - <<'EOF'
path "secret/data/production/database" {
  capabilities = ["read"]
}
EOF

vault write auth/kubernetes/role/production-app \
  bound_service_account_names=vault-app-sa \
  bound_service_account_namespaces=default \
  policies=production-db \
  ttl=1h
```

### Step 5: Install Vault Agent Injector

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --set "injector.enabled=true" \
  --set "server.dev.enabled=true" \
  --namespace vault \
  --create-namespace
```

### Step 6: Deploy a pod with Vault secret injection

```bash
kubectl create serviceaccount vault-app-sa -n default

cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secret-consumer
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: secret-consumer
  template:
    metadata:
      labels:
        app: secret-consumer
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "production-app"
        vault.hashicorp.com/agent-inject-secret-database: "secret/data/production/database"
    spec:
      serviceAccountName: vault-app-sa
      containers:
        - name: app
          image: busybox
          command: ["sh", "-c", "cat /vault/secrets/database && sleep 3600"]
EOF
```

### Step 7: Verify the secret was injected

```bash
kubectl exec -n default deployment/secret-consumer -- cat /vault/secrets/database
# Expected output: the database credentials, never stored as K8s Secret
```

**Verification:** no Kubernetes Secret object exists; the secret was fetched at runtime and written to an in-memory volume.

---

## Lab 4: Network Policy Implementation

**Goal:** implement a zero-trust network policy for a multi-tier application.

**Prerequisites:** kind cluster with a CNI that supports NetworkPolicy (kindest/node uses kindnet — install Calico for full support)

### Step 1: Deploy a three-tier app

```bash
# Create namespaces
kubectl create namespace frontend
kubectl create namespace backend
kubectl create namespace data

# Deploy services
kubectl run frontend --image=nginx --port=80 -n frontend
kubectl run backend --image=nginx --port=8080 -n backend
kubectl run database --image=postgres --port=5432 -n data \
  --env="POSTGRES_PASSWORD=password"
```

### Step 2: Default deny all in each namespace

```bash
for ns in frontend backend data; do
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: $ns
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
EOF
done
```

### Step 3: Allow frontend to receive external traffic

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-ingress
  namespace: frontend
spec:
  podSelector:
    matchLabels:
      run: frontend
  policyTypes:
    - Ingress
  ingress:
    - {}  # allow all ingress (from load balancer)
EOF
```

### Step 4: Allow frontend to reach backend

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: backend
spec:
  podSelector:
    matchLabels:
      run: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: frontend
      ports:
        - port: 8080
EOF
```

### Step 5: Allow backend to reach database

```bash
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-database
  namespace: data
spec:
  podSelector:
    matchLabels:
      run: database
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: backend
      ports:
        - port: 5432
EOF
```

### Step 6: Verify policies work

```bash
# Frontend CAN reach backend
kubectl exec -n frontend frontend -- curl -s http://backend.backend.svc.cluster.local:8080

# Frontend CANNOT directly reach database
kubectl exec -n frontend frontend -- nc -zv database.data.svc.cluster.local 5432
# Expected: connection refused/timeout
```

---

## Lab 5: Falco Rule Writing

**Goal:** install Falco, write a custom rule, and trigger it.

**Prerequisites:** kind cluster, Helm

### Step 1: Install Falco

```bash
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update
helm install falco falcosecurity/falco \
  --namespace falco \
  --create-namespace \
  --set driver.kind=ebpf \
  --set tty=true
```

### Step 2: View default rule triggers

```bash
# Run a suspicious command in a container
kubectl run test-pod --image=ubuntu --restart=Never -- \
  bash -c "apt-get install -y curl 2>/dev/null; sleep 600" &

# Execute a shell inside the running pod
kubectl exec test-pod -- bash

# In the shell, run a suspicious command
cat /etc/shadow
```

```bash
# In another terminal, watch Falco alerts
kubectl logs -n falco -l app.kubernetes.io/name=falco -f | \
  grep -i "CRITICAL\|WARNING\|shell"
```

### Step 3: Write a custom rule

```bash
cat > custom-rules.yaml <<'EOF'
- rule: Detect curl in production container
  desc: Detect curl being executed inside a container (potential data exfiltration)
  condition: >
    spawned_process
    and container
    and proc.name = curl
  output: >
    curl executed in container
    (user=%user.name container=%container.id image=%container.image.repository
     cmdline=%proc.cmdline)
  priority: WARNING
  tags: [network, data-exfiltration]

- rule: Detect write to /tmp in sensitive container
  desc: Writing to /tmp in a container that should be stateless
  condition: >
    open_write
    and container
    and fd.directory = /tmp
    and container.image.repository contains "myapp"
  output: "Write to /tmp in container (file=%fd.name cmdline=%proc.cmdline)"
  priority: NOTICE
EOF

# Validate the rule syntax
falco -r custom-rules.yaml --validate custom-rules.yaml
```

### Step 4: Test the custom rule

```bash
# Deploy Falco with custom rules
helm upgrade falco falcosecurity/falco \
  --namespace falco \
  --set-file customRules.custom-rules\.yaml=custom-rules.yaml

# Trigger the rule
kubectl exec test-pod -- curl https://example.com

# Check for alert
kubectl logs -n falco -l app.kubernetes.io/name=falco -f | grep curl
```

### Step 5: Write a rule to detect cloud metadata access

```bash
cat >> custom-rules.yaml <<'EOF'

- rule: Detect EC2 metadata endpoint access
  desc: A process is trying to access AWS EC2 metadata service — potential credential theft
  condition: >
    (evt.type = connect or evt.type = sendto)
    and container
    and fd.rip = 169.254.169.254
  output: >
    AWS metadata endpoint accessed from container
    (user=%user.name container=%container.id image=%container.image.repository
     cmdline=%proc.cmdline destination=%fd.rip)
  priority: CRITICAL
  tags: [aws, credential-theft]
EOF
```

**Verification:** Falco alerts appear in logs when the rule conditions are met. You can articulate what each rule detects and why it is a security concern.

---

## Lab Completion Checklist

- [ ] Lab 1: Trivy scan finds CVEs; fixed image has fewer; CI fails on CRITICAL
- [ ] Lab 2: Gatekeeper blocks pods without resource limits; compliant pods deploy
- [ ] Lab 3: Secret appears in pod filesystem without being stored as Kubernetes Secret
- [ ] Lab 4: Frontend cannot reach database directly; only via backend
- [ ] Lab 5: Falco generates an alert when curl runs inside a container
