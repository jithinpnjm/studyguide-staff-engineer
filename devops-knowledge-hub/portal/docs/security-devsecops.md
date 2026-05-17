---
title: "🔐 Security & DevSecOps"
sidebar_position: 6
description: "Zero to hero study guide for Security & DevSecOps — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

Security is no longer the team at the end of the pipeline that approves releases. DevSecOps integrates security into every stage of development and operations. For a Staff/Principal SRE, security is a design constraint, not a post-hoc check — it determines architecture, tooling choices, and operational procedures.

The cost of fixing a security issue multiplies at every stage: free at design, cheap in development, expensive in staging, catastrophic in production.

---

## 📋 Prerequisites & Mental Models

**Defense in depth** — no single security control is sufficient. Layer controls: network segmentation, IAM, encryption, vulnerability scanning, runtime detection. An attacker must bypass ALL layers.

**Least privilege is a design principle** — every service, user, and process gets only the minimum permissions needed for its function. This limits blast radius when any component is compromised.

**Assume breach** — design systems as if attackers are already inside. East-west traffic controls (NetworkPolicies, mTLS), runtime threat detection, and audit logging matter as much as perimeter defenses.

**Security is a feedback loop** — shift left, measure, iterate. Security is never "done."

---

## 🔷 Core Concepts

### RBAC (Role-Based Access Control)

**In Kubernetes:**
```yaml
# ServiceAccount per workload
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-service
  namespace: production
---
# Role: minimum permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-role
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["api-config"]  # named resources only
  verbs: ["get"]
---
# RoleBinding: connect SA to Role
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-binding
subjects:
- kind: ServiceAccount
  name: api-service
roleRef:
  kind: Role
  name: api-role
  apiGroup: rbac.authorization.k8s.io
```

**Audit RBAC quarterly:**
```bash
kubectl auth can-i --list --as=system:serviceaccount:production:api-service
kubectl get clusterrolebinding -o json | jq '.items[] | select(.subjects[]?.name == "system:unauthenticated")'
```

**Common RBAC mistakes:**
- Binding `cluster-admin` to application service accounts
- Using `*` verbs or resources (wildcard grants)
- Forgetting to scope with `resourceNames` for Secrets
- Not auditing bindings after team changes

### Kubernetes Pod Security

**Pod Security Standards** (enforced via admission):
```yaml
# Apply to namespace
labels:
  pod-security.kubernetes.io/enforce: restricted  # enforce restricted standard
  pod-security.kubernetes.io/warn: restricted      # warn in kubectl output
  pod-security.kubernetes.io/audit: restricted     # audit log violations
```

**Restricted standard requires:**
- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `capabilities: {drop: [ALL]}`
- `readOnlyRootFilesystem: true`
- `seccompProfile: {type: RuntimeDefault}`

**Kyverno policy enforcement:**
```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: Enforce
  rules:
  - name: verify-signature
    match:
      any:
      - resources: {kinds: [Pod]}
    verifyImages:
    - imageReferences: ["*"]
      attestors:
      - entries:
        - keyless:
            subject: "https://github.com/myorg/*"
            issuer: "https://token.actions.githubusercontent.com"
```

### Secrets Management

**Never store secrets in:**
- Git repositories (even private ones — breach exposes all history)
- Environment variables set in Deployment manifests (visible to anyone with `kubectl get pod -o yaml`)
- Container images
- Log files

**Secrets management stack:**

**1. HashiCorp Vault** — the gold standard for dynamic secrets:
```
Application authenticates via Kubernetes ServiceAccount token (Vault K8s auth method)
Vault validates with Kubernetes API
Vault issues short-lived secret (database password, API key)
Application uses secret, secret expires automatically
```

Dynamic database credentials: Vault creates a unique DB user per request, grants minimum permissions, TTL of 1 hour. Compromised credential is useless after TTL.

**2. External Secrets Operator (ESO):**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: api-secrets     # creates this K8s Secret
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: production/api/db
      property: password
```

**3. Sealed Secrets (Bitnami):** encrypt K8s Secrets with a cluster-side key, store encrypted form in Git.

### Static Application Security Testing (SAST)

**SonarQube rules and integration:**
```yaml
# In CI (GitHub Actions)
- name: SonarQube Scan
  uses: SonarSource/sonarqube-scan-action@v2
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    SONAR_HOST_URL: ${{ vars.SONAR_HOST_URL }}

# Quality Gate: block PR merge if:
# - New vulnerabilities introduced
# - Security hotspots not reviewed
# - Reliability rating drops below A
```

**Semgrep** — lightweight SAST, rules as YAML, runs fast in CI:
```yaml
rules:
- id: no-hardcoded-secrets
  patterns:
  - pattern: password = "$SECRET"
  - pattern-not: password = ""
  message: "Hardcoded password detected"
  severity: ERROR
```

**gitleaks** — pre-commit and CI secret scanning:
```bash
gitleaks detect --source . --verbose
```

### Container Image Security

**Trivy** — fast, comprehensive scanner:
```bash
# Scan image
trivy image --severity CRITICAL,HIGH myapp:latest

# Scan in CI, fail on CRITICAL
trivy image --exit-code 1 --severity CRITICAL myapp:${TAG}

# Scan Kubernetes manifests for misconfigs
trivy config ./k8s/

# Scan IaC (Terraform, Helm)
trivy fs --security-checks config ./terraform/
```

**Cosign image signing:**
```bash
# Sign image (keyless, uses OIDC from GitHub Actions)
cosign sign --yes ghcr.io/org/myapp:${SHA}

# Verify signature
cosign verify --certificate-identity-regexp="https://github.com/myorg"               --certificate-oidc-issuer="https://token.actions.githubusercontent.com"               ghcr.io/org/myapp:${SHA}
```

**Image hardening checklist:**
- [ ] Multi-stage build — no build tools in final image
- [ ] Non-root user (`USER 1000`)
- [ ] No SUID binaries
- [ ] Minimal base image (distroless or UBI minimal)
- [ ] No secrets in image layers
- [ ] Pinned base image digest (not tag)
- [ ] SBOM generated and attested

### IaC Security — tfsec / Checkov

```bash
# Scan Terraform
tfsec ./terraform --soft-fail=false

# Checkov (also scans Helm, K8s manifests, Dockerfiles)
checkov -d ./terraform --framework terraform

# In CI: fail on HIGH or CRITICAL
checkov -d . --check HIGH,CRITICAL
```

Common findings:
- Security group allows 0.0.0.0/0 on SSH/RDP
- S3 bucket without encryption or access logging
- RDS not using Multi-AZ or encryption
- Lambda without VPC and no resource-based policy restriction
- EC2 using IMDSv1 (vulnerable to SSRF → credential theft)

### Network Security

**Zero-trust networking principles:**
1. Never trust, always verify — authenticate and authorize every request
2. Least-privilege access — users and services get minimum needed
3. Assume breach — monitor all traffic, log all access

**mTLS via service mesh:** every service call is authenticated (certificate) and encrypted (TLS). No plaintext internal traffic.

**AWS Security Groups:**
- Inbound: only allow what's needed (no 0.0.0.0/0 on 22/3389)
- Outbound: consider restricting (uncommon but valuable for data exfiltration prevention)
- Use SG-to-SG references: `source = sg-xxxxxxxx` instead of CIDR ranges

---

## 🛠️ Tools & Ecosystem

| Category | Tools |
|----------|-------|
| SAST | SonarQube, Semgrep, Snyk Code |
| SCA (dependencies) | Snyk Open Source, OWASP Dependency-Check, Trivy |
| Container scanning | Trivy, Grype, Clair |
| IaC scanning | tfsec, Checkov, Snyk IaC |
| Secret scanning | gitleaks, truffleHog, GitGuardian |
| Image signing | Cosign (Sigstore) |
| Runtime security | Falco, Tetragon (eBPF) |
| Policy enforcement | Kyverno, OPA/Gatekeeper |
| Secrets management | HashiCorp Vault, AWS Secrets Manager, External Secrets Operator |
| Compliance | AWS Config, Prowler, Steampipe |

### Falco — Runtime Threat Detection

Detects anomalous behavior at runtime:
```yaml
# Detect unexpected outbound connections
- rule: Unexpected outbound connection in container
  desc: Detect unexpected outbound connections from a container
  condition: >
    outbound and container.id != host
    and not proc.name in (allowed_processes)
  output: >
    Unexpected connection (user=%user.name command=%proc.cmdline
    container=%container.id image=%container.image.repository:%container.image.tag
    connection=%fd.name)
  priority: WARNING
```

---

## 🏗️ Architecture Patterns

### DevSecOps Pipeline

```
Developer workstation:
  pre-commit: gitleaks (secrets), terraform fmt, helm lint

PR stage (GitHub Actions):
  - SAST: Semgrep, SonarQube scan
  - SCA: Snyk/Trivy for dependency vulnerabilities
  - IaC scan: tfsec/Checkov
  - Build image
  - Container scan: Trivy (fail on CRITICAL)
  - Sign image: Cosign
  - SonarQube quality gate

Staging deploy:
  - Kyverno verifies image signature
  - Integration + security tests (DAST via OWASP ZAP)

Production deploy:
  - Kyverno policy checks (image signed, non-root, read-only FS)
  - Falco runtime monitoring active
  - Network policies enforced
```

### Supply Chain Security (SLSA)

SLSA (Supply chain Levels for Software Artifacts) framework levels:
- **SLSA 1:** Build is scripted/automated (basic provenance)
- **SLSA 2:** Version-controlled build + hosted build service (tamper-resistant provenance)
- **SLSA 3:** Source verified + hardened build (non-falsifiable provenance)
- **SLSA 4:** Two-party review, hermetic builds

Target SLSA 2 as minimum for production software. Use GitHub Actions with Sigstore attestations.

---

## ⚙️ Production Operations

### Security Posture Assessment

Regular activities:
- **Weekly:** review GuardDuty/Falco findings, check for new Critical CVEs in images
- **Monthly:** audit IAM bindings, rotate credentials, review security group changes
- **Quarterly:** penetration test on critical endpoints, RBAC audit, access review, DR test
- **Annually:** full security assessment, compliance audit

### Incident Response for Security Events

1. **Contain:** isolate affected systems (cordon K8s nodes, quarantine EC2, revoke IAM credentials)
2. **Collect:** snapshot logs, network flows, memory if needed
3. **Analyse:** determine scope, attack vector, data accessed
4. **Eradicate:** remove malware, close vulnerability, rotate all credentials
5. **Recover:** restore from clean backup, validate integrity
6. **Learn:** post-mortem, update detections, improve controls

**Key investigation commands:**
```bash
# Check recent IAM activity (CloudTrail)
aws cloudtrail lookup-events --lookup-attributes AttributeKey=Username,AttributeValue=suspicious-user

# Check K8s audit log for suspicious API calls
kubectl get events --sort-by='.lastTimestamp' -A | grep -i "forbidden\|unauthorized"

# Falco alert review
kubectl logs -n falco -l app=falco | grep -i "warning\|error" | tail -50
```

---

## 📊 Security Metrics

```
Mean Time to Detect (MTTD): how long from compromise to detection
Mean Time to Respond (MTTR): how long to contain after detection
Vulnerability SLA compliance: % of Critical CVEs patched within 24h
Failed authentication rate: baseline and alert on spike
Policy violation rate: Kyverno/OPA denials per day
```

---

## 🎓 Staff/Principal Engineer Perspective

**Security champions model** — embed security advocates in each team rather than centralizing security. Platform team provides tools and guardrails; security champions enforce and educate.

**Security as code** — policies (Kyverno, OPA), security tests, compliance checks are all code in Git. They get reviewed, tested, and deployed like application code.

**Threat modeling** — for new systems, spend 2 hours: enumerate assets, identify threats (STRIDE model), rate risk, design mitigations. This is the highest-leverage security activity and requires a Staff engineer's system-level thinking.

**The cost of "we'll add security later"** — it never happens. Security requirements must be in the initial design. The earlier a control is implemented, the cheaper it is.

---

## 💥 Failure Modes & Incident Patterns

**Compromised CI/CD pipeline** — attacker poisons build, inserts backdoor into artifact. Prevention: SLSA provenance, Cosign signing, pin action versions to SHA.

**SSRF → metadata endpoint** — web app allows fetching arbitrary URLs → attacker fetches `http://169.254.169.254/latest/meta-data/iam/security-credentials/` → gets EC2 instance credentials. Prevention: use IMDSv2 (hop limit=1), restrict outbound HTTP from app tier.

**Secret committed to Git** — developer accidentally commits API key. Even if reverted, the commit is in history and the key must be rotated immediately. Prevention: pre-commit hooks with gitleaks, GitGuardian monitoring.

**Over-privileged Lambda/ECS role** — role can read all S3 buckets. Compromised function reads all data. Prevention: IAM least privilege, resource-level policies, AWS Config rules checking overly permissive policies.

---

## 💼 Interview Prep

**"How do you secure a Kubernetes cluster?"**
RBAC (least privilege, per-workload SA), Pod Security Standards (restricted), NetworkPolicies (default-deny), mTLS via service mesh, image signing + Kyverno verification, Secrets via ESO/Vault, audit logging to centralized SIEM, Falco for runtime detection.

**"Walk through OWASP Top 10 for a web application in your platform"**
A1 Broken Access Control → RBAC + AuthZ middleware; A2 Cryptographic Failures → TLS everywhere, secrets in Vault; A3 Injection → parameterized queries in ORM, SAST; A7 Identity failures → SSO/OIDC, MFA; A9 Known vulnerable components → Snyk in CI, automatic dependency PRs.

---

## 📚 Key Takeaways

1. **Shift left is cheaper** — security in pre-commit is free; in production is catastrophic
2. **Least privilege is a design principle** — design every component with minimum needed permissions
3. **Secrets in Git = compromised secrets** — pre-commit hooks and GitGuardian are your last lines of defense
4. **SAST + container scanning in every pipeline** — not optional, not configurable to skip
5. **Sign your images** — Cosign + Kyverno admission verification closes the supply chain gap
6. **mTLS = no plaintext internal traffic** — service mesh provides this without code changes
7. **Dynamic secrets over static secrets** — Vault dynamic DB credentials reduce credential theft impact
8. **Runtime detection closes the gap** — Falco catches what admission controllers miss
9. **RBAC audit quarterly** — permissions drift over time; unused bindings are attack surface
10. **Assume breach** — design for the attacker already being inside; east-west controls matter



---
