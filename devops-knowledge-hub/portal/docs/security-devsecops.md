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

## 📁 Source Documents

> 6 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[SonarQube] 1743044997847](http://localhost:8765/api/documents/30f47db8-5271-459c-be81-ba8aaedeb5ed/view) | PDF | intermediate |
| [[Terraform] 1742484778408 (1)](http://localhost:8765/api/documents/fa631ff9-e3a7-457d-902c-5548c094cffa/view) | PDF | intermediate |
| [[Kubernetes] 1741415798350](http://localhost:8765/api/documents/1094e2f6-7b5c-47e2-a85c-96f2197d05cb/view) | PDF | intermediate |
| [[Kubernetes] 1741753193057](http://localhost:8765/api/documents/31037995-2de8-4c05-8a4b-3baf919b98b0/view) | PDF | intermediate |
| [[Kubernetes] 1747111565780](http://localhost:8765/api/documents/55b4f9f1-0e64-4e21-8284-402e03206b9f/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1742535550458](http://localhost:8765/api/documents/108e500a-230e-40ff-b348-ac13a26b2eb6/view) | PDF | staff-level |


<AIChatWidget domain="security-devsecops" title="Ask AI about Security & DevSecOps" />

---

## [SRE] SonarQube and Code Quality Gates

## SonarQube and Code Quality Gates

### What It Is and Why It Matters

SonarQube is a static code analysis platform that scans source code for bugs, security vulnerabilities, code smells, and test coverage gaps. It integrates into CI/CD pipelines as a quality gate — blocking deployments when code fails to meet defined quality thresholds.

Understanding SonarQube matters for platform engineers because: you will be asked to integrate it into CI/CD pipelines, configure quality gates, interpret scan results, and explain to developers why their PR is blocked. Knowing the difference between what SonarQube catches and what it misses is important for setting realistic expectations.

---

### Mental Model

SonarQube analyzes code statically — without running it. It parses source files, builds abstract syntax trees (ASTs), runs rule checks, and produces reports on:

- **Bugs**: code that will likely produce wrong behavior
- **Vulnerabilities**: security issues (OWASP Top 10, CWE, SANS)
- **Code Smells**: maintainability issues (too complex, too long, duplicated)
- **Security Hotspots**: code requiring manual review for security
- **Coverage**: percentage of code executed by tests

The key insight: SonarQube is a floor, not a ceiling. It catches known patterns but not all bugs, and it cannot replace integration testing, pen testing, or human code review.

---

### SonarQube Architecture

```
Developer push
    → CI/CD runs SonarScanner
    → SonarScanner sends results to SonarQube server
    → SonarQube server analyzes, stores results
    → Quality Gate evaluated against results
    → Pass/Fail reported back to CI/CD
    → CI/CD proceeds or fails based on Quality Gate
```

Components:
- **SonarQube Server**: the analysis engine, web UI, database
- **SonarScanner**: the CLI tool that runs in CI, collects data, sends to server
- **SonarCloud**: SaaS version (no self-hosted server required)
- **SonarLint**: IDE plugin that runs checks locally during development

---

### CI/CD Integration

#### GitHub Actions Integration

```yaml
# .github/workflows/sonarqube.yml
name: SonarQube Analysis

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  sonarqube:
    name: SonarQube Analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # full history needed for blame information

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Run tests with coverage
        run: |
          pip install pytest pytest-cov
          pytest tests/ --cov=src --cov-report=xml:coverage.xml

      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
        with:
          args: >
            -Dsonar.projectKey=myapp
            -Dsonar.python.coverage.reportPaths=coverage.xml
            -Dsonar.sources=src
            -Dsonar.tests=tests

      - name: Check Quality Gate
        uses: SonarSource/sonarqube-quality-gate-action@master
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

#### sonar-project.properties

```properties
# sonar-project.properties (in project root)
sonar.projectKey=myapp
sonar.projectName=My Application
sonar.projectVersion=1.0

# Source directories
sonar.sources=src
sonar.tests=tests

# Exclusions (don't scan these)
sonar.exclusions=**/migrations/**,**/__pycache__/**,**/node_modules/**

# Coverage report
sonar.python.coverage.reportPaths=coverage.xml

# Language-specific settings
sonar.python.version=3.11

# Pull request decoration (shows issues inline on the PR)
sonar.pullrequest.provider=github
sonar.pullrequest.github.repository=org/myapp
```

#### Jenkins Integration

```groovy
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh 'pytest tests/ --cov=src --cov-report=xml'
            }
        }
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube-Server') {   // configured in Jenkins
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey=myapp \
                          -Dsonar.sources=src \
                          -Dsonar.python.coverage.reportPaths=coverage.xml
                    '''
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

---

### Quality Gates

A Quality Gate is a set of conditions that code must meet to pass. The default Sonar Way gate requires:

- 0 new bugs
- 0 new vulnerabilities
- 0 new security hotspots unreviewed
- 80% coverage on new code
- 3% or less new duplicated lines
- Rating A on new code maintainability

Custom quality gate:

```
Quality Gate: "Platform Team Standard"
Conditions on new code:
  - Reliability Rating is worse than A (any new bug fails)
  - Security Rating is worse than A (any new vulnerability fails)
  - Coverage is less than 70%
  - Duplication is greater than 5%
```

**New code vs overall code:** Quality gates typically apply to *new code* (changes in the PR or since a defined date). This prevents legacy code debt from blocking new features while still enforcing standards going forward.

---

### Issue Types and Severity

#### Bugs

Code that will likely produce incorrect behavior:

```python
# Bug: NullPointerException risk
def get_user_name(user):
    return user.name    # user could be None

# Better: handle None
def get_user_name(user):
    if user is None:
        return "Unknown"
    return user.name

# Bug: resource not closed
def read_file(path):
    f = open(path)      # file handle leak if exception occurs
    return f.read()

# Better: use context manager
def read_file(path):
    with open(path) as f:
        return f.read()
```

#### Vulnerabilities

Security issues that could be exploited:

```python
# VULNERABILITY: SQL injection
def get_user(username):
    query = f"SELECT * FROM users WHERE username = '{username}'"  # BAD
    return db.execute(query)

# Secure: parameterized query
def get_user(username):
    query = "SELECT * FROM users WHERE username = %s"
    return db.execute(query, (username,))

# VULNERABILITY: hardcoded credentials
API_KEY = "sk-1234abcdef"  # SonarQube detects hardcoded secrets

# VULNERABILITY: insecure random for security-sensitive use
import random
token = str(random.random())  # predictable — use secrets module instead
import secrets
token = secrets.token_hex(32)
```

#### Code Smells

Maintainability issues that reduce readability and increase technical debt:

```python
# CODE SMELL: function too long (> 50 lines typically)
def process_everything(data):
    # ... 200 lines of mixed concerns ...

# CODE SMELL: too many parameters
def create_order(user_id, product_id, quantity, price, discount, currency, shipping_address, billing_address, payment_method):
    ...
# Better: use dataclass or object

# CODE SMELL: duplicated code (same block in 3+ places)
# SonarQube detects copy-pasted code blocks

# CODE SMELL: cyclomatic complexity too high
# Function with many if/elif/while branches is hard to test and understand
```

#### Security Hotspots

Code that requires manual review to determine if it's secure. Not necessarily a vulnerability, but needs human assessment:

```python
# HOTSPOT: reading environment variable (could contain sensitive data)
import os
key = os.environ.get('SECRET_KEY')

# HOTSPOT: making HTTP request (could be SSRF)
import requests
url = request.args.get('url')
response = requests.get(url)    # SSRF if URL is user-controlled

# HOTSPOT: writing to file system (path traversal risk)
with open(user_provided_path, 'w') as f:
    f.write(data)
```

Hotspots require a reviewer to mark them as "Reviewed — Safe" or "Reviewed — Needs Fix".

---

### Coverage Reports

SonarQube reads coverage data from your test framework's report. It does not run tests itself.

```bash
# Python — generate XML coverage report
pytest tests/ --cov=src --cov-report=xml:coverage.xml

# Java — JaCoCo
mvn test jacoco:report
# Report: target/site/jacoco/jacoco.xml

# JavaScript/TypeScript — Istanbul/NYC
npx jest --coverage --coverageReporters=lcov
# Report: coverage/lcov.info

# Go
go test ./... -coverprofile=coverage.out
go tool cover -func coverage.out > coverage.txt

# Pass the report path to sonar-scanner
sonar-scanner \
  -Dsonar.python.coverage.reportPaths=coverage.xml \
  -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
```

---

### Configuring SonarQube

#### Setting Up a Project

```bash
# Via sonar-scanner (first run creates the project)
sonar-scanner \
  -Dsonar.projectKey=myapp \
  -Dsonar.projectName="My Application" \
  -Dsonar.host.url=http://sonarqube:9000 \
  -Dsonar.login=<token>

# Or via REST API
curl -X POST "http://sonarqube:9000/api/projects/create" \
  -u admin:password \
  -d "project=myapp&name=My%20Application"
```

#### Managing Rules

Rules are the individual checks SonarQube runs. You can enable/disable per language and customize in Quality Profiles:

```
Quality Profile: "Platform Team Python"
Based on: Sonar Way (Python)
Changes:
  + Enable: "Variables should be initialized" (extra strictness)
  - Disable: "TODO comments should be resolved" (too noisy for us)
```

#### Branch Analysis

SonarQube Community Edition analyzes one branch. Developer and Enterprise editions support multi-branch and PR analysis. For PR decoration (showing issues inline in GitHub PRs), you need Developer Edition or SonarCloud.

---

### What SonarQube Cannot Do

Setting realistic expectations is important:

- **Does not catch runtime errors** (logic bugs that only appear with specific inputs)
- **Does not replace integration tests** (doesn't test behavior, only structure)
- **Does not do penetration testing** (can't test for authentication bypasses, business logic flaws)
- **Has false positives** — legitimate code sometimes triggers a rule
- **Has false negatives** — not all security issues are detectable statically
- **Coverage percentage can be misleading** — high coverage with weak assertions is "covered but not tested"

SonarQube is most valuable when:
- Catching obvious security mistakes (SQL injection, hardcoded secrets, eval on user input)
- Enforcing code quality standards across a team
- Tracking technical debt over time
- Identifying dangerously complex functions that need refactoring

---

### Common Failure Modes

**Quality Gate fails on legacy code:** Organization adds SonarQube after years of unreviewed code. New PR fails because overall coverage is 20%. Fix: configure quality gate to apply to *new code only*, not overall metrics. Set a date from which "new code" is measured.

**False positive blocking a PR:** A security hotspot is correctly marked as safe but SonarQube marks it as a vulnerability. Fix: use `// NOSONAR` comment on the line (suppresses the specific issue) or mark the hotspot as "Reviewed — Safe" in the UI. Document why it's safe.

**Scanner can't reach SonarQube server:** CI agent is behind a firewall, SonarQube is in a different network. Fix: configure proxy settings in sonar-scanner, or use SonarCloud instead. Check that `SONAR_HOST_URL` is reachable from the CI runner.

**Coverage not being picked up:** SonarQube shows 0% coverage despite tests running. Fix: check that the coverage report path in `sonar-project.properties` matches where the test runner actually creates the file. Verify the coverage file exists: `cat coverage.xml | head -5`.

---

### Key Questions and Answers

**Q: What is a Quality Gate and what should it enforce?**

A Quality Gate is a pass/fail decision based on metric thresholds. At minimum, a good quality gate for production deployments should require: zero new vulnerabilities (any security issue blocks), zero new bugs (reliability regression blocks), and minimum test coverage on new code (80% is common). It should apply to new code, not overall — otherwise legacy debt blocks all new features. The goal is to prevent regression, not to enforce perfection on every PR from day one.

**Q: A developer says SonarQube is wrong — it flagged safe code as a vulnerability. How do you handle it?**

First: read the rule description and understand why it flagged. Sometimes "safe" code has a subtle issue. If it's truly a false positive: use `// NOSONAR` to suppress the specific instance, add a comment explaining why, and document it in the PR. If the rule consistently false-positives across the codebase, evaluate whether to disable that rule in the Quality Profile. Don't suppress indiscriminately — each suppression is a decision that should be reviewed.

**Q: What is a Security Hotspot vs a Vulnerability in SonarQube?**

A vulnerability is code SonarQube is confident is a security issue (SQL injection, hardcoded password). A security hotspot is code that *might* be a security issue depending on context — it requires human review to determine. Example: reading from an environment variable is flagged as a hotspot because it could contain sensitive data. Whether that's a problem depends on what you do with the value. Hotspots require a reviewer to explicitly mark them "Safe" or "To Fix" — they can't be auto-dismissed.

**Q: Why might 90% test coverage not mean the code is well-tested?**

Coverage measures whether lines were executed, not whether assertions were meaningful. A test can call `process_payment(amount=100)` and check that it returns without crashing, without verifying the payment was actually processed correctly. This is "covered" but not meaningfully tested. Good tests have coverage AND meaningful assertions about behavior. SonarQube can tell you which lines aren't covered; it can't tell you if the tests covering them are any good.

---

### Points to Remember

- SonarQube: static analysis for bugs, vulnerabilities, code smells, and coverage
- Quality Gate: pass/fail decision; apply to new code only to avoid legacy debt blocking
- Four issue types: bugs (incorrect behavior), vulnerabilities (security), smells (maintainability), hotspots (manual security review)
- SonarScanner runs in CI, sends data to SonarQube server
- Coverage: SonarQube reads your test framework's XML report — it doesn't run tests
- `// NOSONAR` suppresses a specific issue (use with comment explaining why)
- SonarCloud: hosted version — no server to maintain
- SonarLint: IDE plugin for catching issues during development (before commit)
- Limitations: can't catch runtime bugs, can't test behavior, has false positives
- Security hotspots must be manually reviewed (marked Safe or To Fix)

### What to Study Next

- [CI/CD and Trusted Delivery](./cicd-trusted-delivery-and-platform-security) — where SonarQube fits in the pipeline
- [Delivery Systems: Jenkins, GitHub Actions, ArgoCD](./delivery-systems-jenkins-github-actions-and-argocd) — pipeline integration patterns
- [Git and Version Control](./git-and-version-control-for-platform-engineers) — branch policies and PR workflows

---

## [SRE] DevOps Troubleshooting And Security Errors Zero To Hero

## DevOps Troubleshooting And Security Errors Zero To Hero

Production failures repeat in patterns: bad credentials, wrong DNS, blocked network paths, expired certificates, broken rollouts, resource exhaustion, or policy misconfiguration.

Great operators do not memorize random error strings. They recognize failure classes quickly and test hypotheses systematically.

This guide is designed as a complete path:

- Beginner: troubleshooting framework and common failure layers
- Intermediate: Kubernetes, Docker, CI/CD, IAM, DNS, TLS, Linux permission issues
- Advanced: rollout failures, drift, RBAC, secrets, state locks, policy chains
- SRE Level: blast radius, mitigation-first debugging, production triage
- Interview Level: explain incidents with structured reasoning

---

## Part 1: Memory Palace — Airport Operations

| Reliability concept | Airport analogy | Meaning |
|---|---|---|
| User request | Passenger trip | Desired journey |
| DNS | Flight board | Where to go |
| Network path | Runway/taxiway | Traffic path |
| Credentials | Passport | Identity access |
| TLS cert | Security stamp | Trusted connection |
| CI/CD | Departure system | Release pipeline |
| Kubernetes scheduler | Gate assignment | Placement |
| RBAC | Staff access badge | Authorization |
| Incident lead | Airport controller | Coordination |

When flights fail, ask where the passenger got blocked.

---

## Part 2: Universal Troubleshooting Framework

Ask first:

1. What exactly is failing?
2. Who is impacted?
3. What changed recently?
4. Is it getting worse?
5. Fastest safe mitigation?

Loop:

```text
Symptom -> Hypothesis -> Test -> Interpret -> Next step
```

Never shotgun commands randomly.

---

## Part 3: Failure Layers Model

```text
User -> DNS -> Network -> TLS -> Load balancer -> App -> Dependency -> Data store
```

Or for delivery:

```text
Git -> CI -> artifact -> registry -> deploy controller -> cluster -> pod -> service
```

Find the broken layer first.

---

## Part 4: Kubernetes Failure Patterns

### Pod Pending

```bash
kubectl describe pod POD
kubectl get events -A --sort-by=.lastTimestamp
```

Likely:

- insufficient resources
- taint/toleration mismatch
- affinity impossible
- PVC not bound

### CrashLoopBackOff

```bash
kubectl logs POD --previous
kubectl describe pod POD
```

Likely:

- startup config error
- missing secret/env var
- dependency unavailable
- bad command

### ImagePullBackOff

Likely:

- bad tag
- registry auth missing
- registry outage

### Service Exists But Fails

```bash
kubectl get svc NAME
kubectl get endpointslice -l kubernetes.io/service-name=NAME
kubectl get pods --show-labels
```

Likely:

- selector mismatch
- no ready endpoints
- wrong targetPort
- NetworkPolicy

---

## Part 5: Docker / Container Failures

```bash
docker ps -a
docker logs CONTAINER
docker inspect CONTAINER
```

Exit codes:

- 0 clean exit
- 1 app error
- 127 command not found
- 137 SIGKILL/OOM
- 143 SIGTERM

Common issues:

- wrong ENTRYPOINT
- missing file
- permission denied
- env var missing
- memory limit too low

---

## Part 6: CI/CD Failures

### GitHub Actions

Common:

- permission denied to write releases/packages
- secret unavailable
- network issue on runner
- wrong branch/path filters

### Jenkins

Common:

- credential id mismatch
- missing plugin
- agent disk full
- agent pod Pending

### ArgoCD / GitOps

Common:

- Git auth failure
- rollout unhealthy
- RBAC issue
- cluster disconnected

Golden rule:

> Separate pipeline failure from application failure.

---

## Part 7: DNS Failures

```bash
dig api.example.com
nslookup api.example.com
getent hosts api.example.com
cat /etc/resolv.conf
```

Interpretation:

- NXDOMAIN = name does not exist
- SERVFAIL = resolver/server issue
- resolves but connect fails = DNS not root cause

Kubernetes:

```bash
kubectl exec POD -- nslookup kubernetes.default
kubectl get pods -n kube-system -l k8s-app=kube-dns
```

---

## Part 8: TCP / Network Path Failures

```bash
curl -vk https://host
nc -vz host 443
tracepath host
ss -tanp
ss -s
```

Use `curl -v` to separate:

- DNS
- TCP connect
- TLS handshake
- HTTP response

---

## Part 9: TLS / Certificate Failures

```bash
openssl s_client -connect api.example.com:443 -servername api.example.com
echo | openssl s_client -connect api.example.com:443 2>/dev/null | openssl x509 -noout -dates
```

Common issues:

- expired certificate
- hostname mismatch
- missing intermediate CA
- talking HTTPS to HTTP port

Kubernetes cert-manager:

```bash
kubectl describe certificate NAME
kubectl describe certificaterequest
kubectl logs -n cert-manager deploy/cert-manager
```

---

## Part 10: IAM / RBAC / Permission Failures

Linux:

```bash
ls -ld PATH
namei -l /path/to/file
id
sudo -l
```

Kubernetes:

```bash
kubectl auth can-i get pods --as=system:serviceaccount:ns:sa
kubectl get rolebinding,clusterrolebinding -A
```

Cloud:

- missing assume-role trust
- expired token
- wrong IAM policy scope
- SCP/organization deny

---

## Part 11: Terraform Failures

Common:

- state lock stuck
- provider auth missing
- drift detected
- unexpected destroy
- bad refactor/rename

Commands:

```bash
terraform plan
terraform state list
terraform state mv OLD NEW
terraform refresh
```

Never apply destructive plans you do not understand.

---

## Part 12: Secret Failures

Patterns:

- wrong key name
- secret missing in namespace
- base64 confusion
- rotation happened but pods stale
- env var loaded only at startup

Check:

```bash
kubectl get secret NAME -o yaml
kubectl describe pod POD
kubectl exec POD -- env | grep KEY
```

---

## Part 13: Rollout Failures

```bash
kubectl rollout status deploy/app
kubectl rollout history deploy/app
kubectl rollout undo deploy/app
```

Likely causes:

- readiness probe failing
- image pull failing
- config incompatibility
- database migration issue
- maxUnavailable too aggressive

Mitigation often = rollback.

---

## Part 14: Real Incident Stories

### 503 Errors After Deploy

Path:

- check ingress/LB health
- check Deployment rollout
- check endpoints
- rollback if confidence high

### Works In Dev, Fails In Prod

Likely:

- env var difference
- stricter NetworkPolicy
- lower resource limits
- different image tag/arch
- secret missing

### CI Passed, Prod Broken

Likely:

- test gap
- env drift
- runtime dependency issue
- rollout config issue

### Users Cannot Login Suddenly

Likely:

- IdP outage
- expired OIDC secret/cert
- DNS issue to auth provider
- clock skew/token validation

---

## Part 15: Mitigation Priority

Prefer:

1. rollback recent change
2. fail over region/path
3. disable feature flag
4. scale capacity
5. bypass noncritical dependency
6. deep root-cause hunt after stability

---

## Part 16: Command Packs By Symptom

### Web Service Down

```bash
curl -vk URL
kubectl get pods
kubectl get svc
kubectl get endpointslice
kubectl logs POD --since=10m
```

### Auth Failure

```bash
date
curl -vk AUTH_URL
kubectl describe secret AUTH_SECRET
kubectl auth can-i ...
```

### Pipeline Failure

```bash
git diff LAST_GOOD..HEAD
check secrets
check permissions
check artifact existence
```

### DNS Suspected

```bash
dig HOST
nslookup HOST
cat /etc/resolv.conf
```

---

## Part 17: Anti-Patterns

Avoid:

- restarting everything immediately
- changing multiple variables at once
- assuming DNS is always the issue
- assuming CPU high means root cause
- applying Terraform blindly
- granting cluster-admin to fix RBAC fast
- disabling TLS verification casually

---

## Part 18: Interview Questions

- Pod Pending: how debug?
- Service returns 503: where start?
- CI passes but prod fails: why?
- How diagnose TLS handshake issue?
- How debug access denied in Kubernetes?
- Why rollback before root cause sometimes?
- Terraform wants destroy prod DB—what do you do?

---

## Part 19: Labs

### Beginner

- break a Service selector
- create expired self-signed cert locally
- fail pipeline with missing secret

### Intermediate

- create CrashLoopBackOff intentionally
- simulate RBAC forbidden
- break DNS inside namespace

### Advanced

- run mock outage after deploy
- compare dev/prod env drift
- simulate stuck Terraform lock

---

## Part 20: Senior Answer Shape

> I troubleshoot by isolating the failing layer first: identity, DNS, network, TLS, workload health, dependency health, or policy. I test one hypothesis at a time and prefer fast reversible mitigations when users are impacted. For recent-change incidents, rollback is often the safest first move. After recovery, I eliminate the class of failure through automation, guardrails, and better observability.

---

## Recall Prompts

- Why should you identify the broken layer first?
- Why can CI pass while production fails?
- Why does rollback often beat deep debugging during incidents?
- Why is `kubectl auth can-i` powerful?
- Why are many failures really dependency-chain failures?
