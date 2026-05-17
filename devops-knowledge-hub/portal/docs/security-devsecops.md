---
title: "🔐 Security & DevSecOps"
sidebar_position: 6
description: "Zero to hero study guide for Security & DevSecOps — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

Security is no longer the team at the end of the pipeline that approves releases. DevSecOps integrates security into every stage of development and operations. For a Staff/Principal SRE, security is a design constraint, not a post-hoc check — it determines architecture, tooling choices, and operational procedures.

The cost of fixing a security issue multiplies at every stage: free at design, cheap in development, expensive in staging, catastrophic in production.

---

## Core Mental Models

**Defense in depth** — no single security control is sufficient. Layer controls: network segmentation, IAM, encryption, vulnerability scanning, runtime detection. An attacker must bypass ALL layers.

**Least privilege is a design principle** — every service, user, and process gets only the minimum permissions needed for its function. This limits blast radius when any component is compromised.

**Assume breach** — design systems as if attackers are already inside. East-west traffic controls (NetworkPolicies, mTLS), runtime threat detection, and audit logging matter as much as perimeter defenses.

**Shift left** — catch security issues as early as possible. Code review, SAST, secret scanning, and IaC scanning happen before any code is deployed.

---

## Securing CI/CD Pipelines

CI/CD pipelines are high-value attack targets — a compromised pipeline can deploy malicious code to production. Security must be built into every stage.

**Key controls for pipeline security:**
- Use secrets management tools like HashiCorp Vault or AWS Secrets Manager — never hardcode credentials
- Enforce Role-Based Access Control (RBAC) to limit who can trigger, modify, or approve pipeline stages
- Enable HTTPS for all inter-service communication and use signed artifacts to verify build integrity
- Integrate vulnerability scanners (Trivy, Snyk) into the pipeline — fail builds on critical findings
- Monitor and log all pipeline activities and set up alerts for anomalies (unexpected deployments, config changes)
- Regularly audit and update pipeline configurations and dependencies

**Pipeline security stages:**
1. Source control: branch protection, required code reviews, secret scanning
2. Build: SAST (SonarQube), dependency scanning (Snyk, Dependabot), IaC scanning (tfsec, Checkov)
3. Container: image scanning (Trivy, Clair), base image policy enforcement
4. Deploy: signed artifacts, RBAC, environment approval gates
5. Runtime: Pod Security Admission, runtime threat detection, audit logging

---

## Source Code Security

**Protecting the repository:**
- Enable branch protection rules and require code reviews before merging
- Scan repositories for hardcoded secrets using tools like GitGuardian or `git-secrets`
- Integrate static code analysis tools like SonarQube for vulnerability detection on every PR
- Use dependency management tools like Dependabot or Snyk to auto-detect vulnerable packages
- Store sensitive files (`.env`, certificates, keys) securely — never commit them to the repository
- Educate developers on secure coding practices (OWASP Top 10, input validation, output encoding)

---

## SonarQube — Static Code Analysis

SonarQube is a widely used static code analysis and code quality tool that detects vulnerabilities, bugs, code smells, and security issues.

### Key Concepts

**Static Code Analysis:**
- Identifies bugs, security vulnerabilities, and code smells in source code without executing it
- Supports multiple programming languages: Java, Python, JavaScript, C#, Go, and 25+ others
- Maintains code quality and consistency across teams

**Quality Gates:**
- Defines thresholds for code quality based on issues, code coverage, duplications, and maintainability
- Enforces pass/fail conditions in CI/CD pipelines
- Blocks insecure or low-quality code from being deployed — a failed Quality Gate stops the pipeline

**Security Vulnerability Detection:**
- Detects security flaws based on OWASP Top 10, SANS 25, and CWE guidelines
- Helps meet compliance requirements: ISO 27001, GDPR, PCI DSS
- Identifies injection vulnerabilities, insecure deserialization, hardcoded credentials, and more

**CI/CD Integration:**
- Works with GitHub Actions, GitLab CI/CD, Jenkins, Azure DevOps, Bitbucket Pipelines
- Scans every commit, pull request, or deployment for security and quality issues
- Provides automated real-time feedback to developers in their PR workflow

### Running SonarQube Locally

```bash
sonar-scanner \
  -Dsonar.projectKey=my-project \
  -Dsonar.sources=src \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=my-token
```

This analyzes source code and sends results to the SonarQube dashboard at `http://localhost:9000`.

### SonarQube in GitHub Actions

```yaml
jobs:
  sonarqube_scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v2

      - name: Run SonarQube Scanner
        run: |
          sonar-scanner \
            -Dsonar.projectKey=my-project \
            -Dsonar.sources=src \
            -Dsonar.host.url=${{ secrets.SONAR_HOST_URL }} \
            -Dsonar.login=${{ secrets.SONAR_TOKEN }}
```

### SonarQube in Jenkins

```groovy
pipeline {
  agent any
  stages {
    stage('SonarQube Scan') {
      steps {
        withSonarQubeEnv('SonarQube') {
          sh 'sonar-scanner \
            -Dsonar.projectKey=my-project \
            -Dsonar.sources=src'
        }
      }
    }
    stage('Quality Gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }
  }
}
```

**SonarLint** provides IDE-based analysis — developers get feedback before even committing code.

---

## TFsec — Terraform IaC Security Scanning

TFsec is an Aqua Security open-source static analysis tool for scanning Terraform configurations for security vulnerabilities and misconfigurations. It identifies risks before infrastructure is deployed.

### Key Concepts

**IaC Security Scanning:**
- Analyzes `.tf` files to detect security misconfigurations
- Enforces cloud security best practices for AWS, Azure, and Google Cloud
- Identifies overly permissive IAM roles, unencrypted storage, open security groups

**Policy-as-Code and Compliance:**
- Uses built-in rules aligned with CIS Benchmarks, NIST, and OWASP
- Supports custom rule definitions to align with internal security policies
- Enforces least privilege access and encryption requirements

**Severity Levels:**
- Critical, High, Medium, Low
- Findings categorized with remediation recommendations
- Reports in JSON, JUnit, CSV, and SARIF formats

**CI/CD Integration:**
- Works with GitHub Actions, GitLab CI/CD, Jenkins, Azure DevOps
- Blocks Terraform code merges if security violations are detected
- Automates security scanning before `terraform apply`

### Running TFsec

```bash
# Scan entire Terraform project
tfsec /path/to/terraform

# Output findings with severity levels and remediation recommendations
tfsec . --format json > tfsec-results.json

# Generate SARIF report (for GitHub Security tab)
tfsec . --format sarif > tfsec.sarif

# Ignore a specific rule with justification
# Add inline comment to .tf file:
# tfsec:ignore:aws-s3-enable-bucket-encryption
```

### TFsec in Jenkins

```groovy
stage('TFScan') {
  steps {
    dir('terraform') {
      sh '''
        echo "Running TFScan..."
        tfsec . > tfsec-results.json || { echo "TFSec scan failed"; exit 1; }
      '''
    }
    archiveArtifacts artifacts: 'terraform/tfsec-results.json', allowEmptyArchive: true
  }
}
```

### Common TFsec Findings

- S3 bucket without server-side encryption enabled
- Security group with port 0-65535 open to `0.0.0.0/0`
- IAM policy with wildcard `*` permissions
- RDS instance without encrypted storage
- EKS cluster without logging enabled
- EC2 instance with public IP and no security group restrictions

---

## Container Security

### Securing Docker Images

Docker images are a common attack vector — they may contain outdated packages, hardcoded secrets, or run as root unnecessarily.

**Best practices:**
- Use minimal base images (Alpine, distroless) to reduce attack surface
- Scan images with tools like Trivy, Clair, or Snyk before deployment
- Avoid using the `latest` tag — use immutable tags with specific version hashes
- Regularly update base images and remove unused ones from registries
- Implement Docker Content Trust to sign and verify images
- Never run containers as root unless absolutely required

**Example Dockerfile following security best practices:**
```dockerfile
FROM alpine:3.18

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install only required dependencies
RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --chown=appuser:appgroup ./bin/myapp .

# Switch to non-root user
USER appuser

EXPOSE 8080
ENTRYPOINT ["./myapp"]
```

### Trivy — Container Vulnerability Scanning

Trivy (by Aqua Security) is a comprehensive vulnerability scanner for containers, filesystems, and IaC.

```bash
# Scan a Docker image
trivy image nginx:latest

# Scan and output JSON
trivy image --format json --output results.json nginx:latest

# Scan only HIGH and CRITICAL
trivy image --severity HIGH,CRITICAL nginx:latest

# Scan a local filesystem
trivy fs /path/to/project

# Scan Kubernetes cluster
trivy k8s --report summary cluster

# Scan in CI — exit code 1 if vulnerabilities found
trivy image --exit-code 1 --severity CRITICAL myapp:latest
```

**Trivy in GitHub Actions:**
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

### Seccomp — Secure Computing Mode

Seccomp restricts the system calls that a container can execute. By limiting system calls to a defined allowlist, it reduces the attack surface even if the container process is compromised.

Kubernetes allows applying a seccomp profile via `securityContext`:
```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault
```

`RuntimeDefault` applies the container runtime's default seccomp profile, which blocks many dangerous syscalls.

---

## Kubernetes Security

### SecurityContext

The `SecurityContext` controls security settings for a pod or container. Common misconfigurations cause `CrashLoopBackOff` with `permission denied` errors.

**Diagnosing SecurityContext issues:**
```bash
# Check SecurityContext settings on a pod
kubectl get pod <pod-name> -o yaml | grep -i securityContext -A 10

# Check security-related errors
kubectl describe pod <pod-name>

# Check Pod Security Policies or Admission Controls
kubectl get psp
kubectl describe psp <policy-name>
```

**Recommended SecurityContext settings:**
```yaml
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

**If the app requires root (rebuild the image to avoid this):**
```yaml
securityContext:
  runAsUser: 0
```

After modifying, apply and verify:
```bash
kubectl apply -f deployment.yaml
kubectl delete pod <pod-name>   # force recreation
kubectl logs <pod-name> -f
```

If the application does not require root, rebuild the Docker image with `USER 1000` to run as a non-root user.

### Kubernetes RBAC (Role-Based Access Control)

RBAC is Kubernetes' security mechanism for managing permissions. It controls what users, groups, and service accounts can do with Kubernetes resources.

**Two key processes in RBAC:**
1. **Authentication** — verifying the identity (Are you who you claim to be?)
2. **Authorization** — determining permitted actions (What can you do?)

**RBAC Objects:**

| Object | Description |
|--------|-------------|
| User | A real person (developer, DevOps engineer, auditor) |
| Group | A collection of users sharing access needs |
| Service Account | An automated process or application running inside the cluster |
| Role | Namespace-scoped permissions |
| ClusterRole | Cluster-wide permissions |
| RoleBinding | Binds a Role to a User/Group/ServiceAccount in a namespace |
| ClusterRoleBinding | Binds a ClusterRole across the entire cluster |

**Role vs ClusterRole:**
- Role provides namespace-based permissions (access limited to a specific namespace)
- ClusterRole provides cluster-wide permissions (access across all namespaces)

**Example Role — read-only access to pods in a namespace:**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
```

**RoleBinding — assign the Role to a user:**
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

**ClusterRole for cluster-wide read access:**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-reader
rules:
  - apiGroups: [""]
    resources: ["nodes", "namespaces", "pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]
```

**Service Account RBAC — give a monitoring tool read access:**
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

**Audit RBAC — check what permissions a user has:**
```bash
kubectl auth can-i get pods --as=jane -n production
kubectl auth can-i delete deployments --as=jane -n production
kubectl auth can-i '*' '*' --as=jane   # check admin
```

### Network Policies for Security

Network Policies restrict pod-to-pod communication. Without a NetworkPolicy, all pods in the cluster can reach all other pods.

**Debug network policy blocking communication:**
```bash
# List existing policies
kubectl get networkpolicy -n <namespace>

# Inspect a specific policy
kubectl describe networkpolicy <policy-name> -n <namespace>
```

**Allow pods in the same namespace to communicate:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector: {}
```

### SSL/TLS Certificate Management

SSL (Secure Sockets Layer) and TLS (Transport Layer Security) encrypt data between clients and servers. TLS 1.2 and 1.3 are the currently secure versions.

**Key benefits in DevOps:**
- Data encryption: prevents unauthorized access and MITM attacks
- Authentication: ensures client communicates with the intended server
- Data integrity: protects against tampering during transmission
- Regulatory compliance: GDPR, PCI-DSS, HIPAA requirements

**Let's Encrypt with Certbot (NGINX):**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain and configure certificate
sudo certbot --nginx -d example.com -d www.example.com

# Test auto-renewal
sudo certbot renew --dry-run

# Certbot auto-renewal cron (added automatically)
# 0 */12 * * * root certbot renew --quiet
```

**cert-manager in Kubernetes (automatic certificate provisioning):**
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: my-tls
  namespace: production
spec:
  secretName: my-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - api.example.com
```

**NGINX SSL configuration:**
```nginx
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Enforce TLS 1.2 and 1.3
    ssl_protocols TLSv1.2 TLSv1.3;

    # Strong cipher suites
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS — force HTTPS for 1 year
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
}
```

**Inspect a TLS certificate:**
```bash
openssl s_client -connect api.example.com:443
openssl s_client -connect api.example.com:443 | openssl x509 -noout -dates
```

**Monitor certificate expiry:**
```bash
# Check expiry date
echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -enddate

# Alert if certificate expires within 30 days
cert_expiry=$(echo | openssl s_client -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -enddate | cut -d= -f2)
```

---

## Secrets Management

### HashiCorp Vault

Vault is the standard for secrets management in DevOps environments. It stores, rotates, and audits access to secrets.

**Dynamic secrets** — Vault generates short-lived credentials on demand:
1. Enable the appropriate secrets engine (database, AWS, PKI)
2. Create roles that specify access policies
3. Use Vault's API or CLI to generate secrets with a short TTL
4. Monitor and revoke secrets when no longer needed

**Configuring dynamic database secrets:**
```bash
# Enable database secrets engine
vault secrets enable database

# Configure a PostgreSQL connection
vault write database/config/my-postgres \
    plugin_name=postgresql-database-plugin \
    allowed_roles="app-role" \
    connection_url="postgresql://{{username}}:{{password}}@postgres:5432/mydb" \
    username="vault-admin" \
    password="vault-password"

# Create a role with short TTL
vault write database/roles/app-role \
    db_name=my-postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"

# Generate credentials
vault read database/creds/app-role
```

**Unsealing Vault:**
When Vault is sealed, its encryption keys are inaccessible and it cannot serve requests.
```bash
# Manual unseal (requires unseal keys from initialization)
vault operator unseal <unseal-key-1>
vault operator unseal <unseal-key-2>
vault operator unseal <unseal-key-3>

# Auto-unseal with AWS KMS (preferred for production)
# Configure in vault.hcl:
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "alias/vault-unseal-key"
}
```

### Terraform State Security

Terraform state files can contain sensitive values (credentials, private keys). Secure them:
```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true           # server-side encryption
    dynamodb_table = "terraform-locks"  # state locking
    kms_key_id     = "alias/terraform-state-key"
  }
}
```

Additional controls:
- Enable versioning on the S3 bucket for rollback capability
- Use role-based access to restrict who can read or write the state file
- Avoid storing secrets directly in Terraform resources — use Vault provider or AWS Secrets Manager data sources instead

---

## IaC Security Scanning

Tools for scanning Infrastructure as Code configurations before deployment:

| Tool | Targets | Key Feature |
|------|---------|-------------|
| tfsec | Terraform | CIS Benchmarks, custom rules |
| Checkov | Terraform, CloudFormation, K8s, Dockerfiles | Multi-platform, SARIF output |
| Terrascan | Terraform, Helm, Kubernetes | Policy-as-Code, OPA |
| TFLint | Terraform | Linting and provider-specific rules |
| kube-score | Kubernetes manifests | Security and reliability scoring |

**Checkov scan:**
```bash
# Install
pip install checkov

# Scan Terraform directory
checkov -d /path/to/terraform

# Scan Kubernetes manifests
checkov -d /path/to/k8s --framework kubernetes

# Scan Dockerfile
checkov -f Dockerfile

# Output JSON for CI integration
checkov -d . --output json > checkov-results.json
```

---

## Compliance and Audit

### What Checkov and tfsec Detect

- S3 buckets without encryption, versioning, or access logging
- Security groups with `0.0.0.0/0` open on dangerous ports
- IAM roles with `*:*` permissions (wildcard)
- Missing MFA requirements on IAM users
- Unencrypted RDS instances or EBS volumes
- Kubernetes containers running as root
- Missing resource limits on Kubernetes containers
- Secrets stored in environment variables instead of secret stores

### Kubernetes CIS Benchmarks

Use `kube-bench` to audit a Kubernetes cluster against CIS Benchmarks:
```bash
# Run kube-bench on a node
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench
```

---

## DevSecOps Pipeline — Full Example

A complete GitHub Actions pipeline with security scanning at every stage:

```yaml
name: DevSecOps Pipeline

on:
  push:
    branches: [main]
  pull_request:

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: SonarQube Scan
        run: |
          sonar-scanner \
            -Dsonar.projectKey=my-project \
            -Dsonar.sources=src \
            -Dsonar.host.url=${{ secrets.SONAR_HOST_URL }} \
            -Dsonar.login=${{ secrets.SONAR_TOKEN }}

  iac-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: TFsec scan
        run: tfsec ./terraform --format sarif > tfsec.sarif
      - name: Checkov scan
        run: checkov -d ./kubernetes --framework kubernetes --output sarif > checkov.sarif

  build-and-scan:
    runs-on: ubuntu-latest
    needs: [secret-scan, sast]
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .
      - name: Trivy container scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: 1

  deploy:
    runs-on: ubuntu-latest
    needs: [build-and-scan, iac-scan]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to staging
        run: kubectl apply -f ./kubernetes/
```

---

## Interview Preparation

**Common DevSecOps interview questions:**

1. **How would you secure a CI/CD pipeline?**
   - Secrets management via Vault or AWS Secrets Manager (never hardcoded)
   - RBAC to limit who can trigger or modify pipelines
   - SAST (SonarQube) on every PR
   - Container scanning (Trivy) before push to registry
   - IaC scanning (tfsec, Checkov) before `terraform apply`
   - Signed artifacts and image verification
   - Audit logging of all pipeline activities

2. **What happens when Vault is sealed, and how do you unseal it?**
   - When sealed, encryption keys are inaccessible — Vault cannot serve requests
   - Manual unseal: provide the threshold number of unseal keys generated at initialization (typically 3 of 5)
   - Auto-unseal: configure Vault to use a cloud KMS (AWS KMS, Azure Key Vault) — Vault unseals automatically on restart without human intervention

3. **What is the role of seccomp in container security?**
   - Seccomp restricts the Linux system calls a container can make
   - Reduces attack surface — compromised process cannot call dangerous syscalls (e.g., `ptrace`, `mount`)
   - Apply via `securityContext.seccompProfile.type: RuntimeDefault` in Kubernetes pod spec

4. **How do you secure Terraform state files?**
   - Store in S3 with SSE-KMS encryption enabled
   - Enable state locking with DynamoDB to prevent concurrent operations
   - Restrict access with IAM roles and bucket policies
   - Enable S3 versioning for rollback capability
   - Never store raw secrets in Terraform resources — use data sources to reference secrets from Vault or Secrets Manager

5. **A pod is in CrashLoopBackOff due to a permission denied error. What do you check?**
   - `kubectl describe pod` — look for security context errors
   - `kubectl get pod -o yaml | grep -i securityContext -A 10` — check runAsUser, allowPrivilegeEscalation
   - Check if PSP or Pod Security Admission is restricting the pod
   - Check if the container image requires root — rebuild with `USER 1000` if possible
   - If root is needed temporarily: set `runAsUser: 0` and plan image rebuild

6. **What tools do you use for IaC security scanning and what do they find?**
   - tfsec: Terraform misconfigs — open security groups, unencrypted storage, missing IAM conditions
   - Checkov: multi-platform (Terraform, K8s, Dockerfiles) — compliance violations against CIS, NIST
   - Terrascan: uses OPA policies for custom organizational rules
   - All integrate into CI/CD to block merges on HIGH/CRITICAL findings

7. **Explain RBAC in Kubernetes. How does it differ from AWS IAM?**
   - Kubernetes RBAC: Role/ClusterRole defines what actions are allowed on which resources. RoleBinding/ClusterRoleBinding assigns these to Users, Groups, or ServiceAccounts
   - AWS IAM: policies attached to users/roles/groups; resource-level and action-level control; trust policies define who can assume a role
   - Key difference: Kubernetes RBAC is namespace-scoped (Role) or cluster-scoped (ClusterRole); AWS IAM operates at account or resource ARN level
