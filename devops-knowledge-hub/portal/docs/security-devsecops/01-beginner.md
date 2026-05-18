---
title: "Beginner"
sidebar_position: 1
---

# Security & DevSecOps — Beginner

Security is a design constraint, not a post-hoc check. The cost of fixing a security issue multiplies at every stage: free at design, cheap in development, expensive in staging, catastrophic in production.

---

## The CIA Triad

The CIA triad is the foundational model for information security. Every security control maps back to one or more of these three properties.

| Property | Meaning | Example threat | Example control |
|---|---|---|---|
| Confidentiality | Only authorized parties can read data | Secret leaked in logs | Encryption, access control |
| Integrity | Data cannot be tampered with undetected | MITM modifies response | TLS, checksums, signing |
| Availability | Systems remain accessible to authorized users | DDoS, ransomware | Redundancy, rate limiting, backups |

When designing a security control, ask which CIA properties it protects. A firewall rule improves confidentiality and availability. Checksums protect integrity.

---

## Authentication vs Authorization

These two terms are frequently confused but address entirely different questions.

**Authentication** — "Who are you?" Verifying identity before granting access.
- Mechanisms: passwords, certificates, SSH keys, OIDC tokens, MFA
- Examples: `kubectl` uses kubeconfig client certs; GitHub Actions uses OIDC tokens; SSH uses key pairs

**Authorization** — "What are you allowed to do?" Determining permitted actions after identity is confirmed.
- Mechanisms: RBAC, ACLs, IAM policies, OPA
- Examples: a service account authorized to read secrets but not delete pods

Both must be correct. Authenticating someone without authorizing them gives you verified identity with no access. Authorizing without authentication means anyone can claim any identity.

---

## HTTPS and TLS Basics

HTTP sends data in plaintext. HTTPS wraps HTTP in TLS (Transport Layer Security), providing:
- **Encryption** — data in transit cannot be read by eavesdroppers
- **Authentication** — the server proves its identity via a certificate signed by a trusted CA
- **Integrity** — a MAC detects tampering during transit

### TLS Handshake (simplified)
1. Client sends `ClientHello` with supported cipher suites
2. Server responds with its certificate and chosen cipher
3. Client verifies the certificate against trusted CAs
4. Both derive session keys from key exchange (ECDHE)
5. Encrypted communication begins

### TLS versions to know
- TLS 1.0/1.1 — deprecated, vulnerable (POODLE, BEAST)
- TLS 1.2 — minimum acceptable standard
- TLS 1.3 — preferred; removes weak ciphers, faster handshake

```bash
# Check what TLS version a server supports
openssl s_client -connect api.example.com:443 -tls1_3
openssl s_client -connect api.example.com:443 | openssl x509 -noout -dates
```

---

## Principle of Least Privilege

Every service, user, and process gets only the minimum permissions needed to perform its function.

**Why it matters:** When any component is compromised, the blast radius is proportional to its permissions. A read-only service account cannot delete production data even if its credentials are stolen.

**Applying least privilege in practice:**
- Give CI pipelines only the permissions they need for that stage — a test stage does not need registry write access
- Service accounts in Kubernetes should have namespace-scoped Roles, not ClusterAdmin
- IAM roles for applications should be scoped to specific resources and actions
- Humans should use just-in-time elevated access rather than permanent admin roles

---

## OWASP Top 10

The OWASP Top 10 is the industry-standard list of the most critical web application security risks. Staff engineers are expected to understand these and ensure they are addressed in design reviews.

| Rank | Risk | Common cause | Mitigation |
|---|---|---|---|
| A01 | Broken Access Control | Missing authorization checks | RBAC, tests for authorization |
| A02 | Cryptographic Failures | Weak ciphers, plain HTTP, keys in code | TLS 1.2+, key management, no secrets in code |
| A03 | Injection | Unsanitized input to SQL/shell/LDAP | Parameterized queries, input validation |
| A04 | Insecure Design | No threat modelling, no abuse cases | Threat modelling in design phase |
| A05 | Security Misconfiguration | Default credentials, verbose errors | Hardened configs, regular audits |
| A06 | Vulnerable Components | Outdated libraries with known CVEs | Dependency scanning (Snyk, Dependabot) |
| A07 | Auth & Session Failures | Weak passwords, no MFA, token leaks | MFA, short-lived tokens, proper logout |
| A08 | Software Integrity Failures | Unverified packages, tampered artifacts | Signing, SBOM, verified supply chain |
| A09 | Security Logging Failures | No audit logs, logs not monitored | Centralized logging, alerting on anomalies |
| A10 | SSRF | App fetches user-supplied URLs | Allow-list for outbound destinations |

---

## Secrets Management Basics

### The problem with environment variables

Storing secrets in environment variables is common but has significant risks:
- Environment variables are readable by any process in the same process group
- They appear in crash dumps, debug logs, and `docker inspect` output
- They are often committed accidentally in `.env` files
- There is no audit trail of who accessed them or when

### The problem with hardcoded secrets

Never commit secrets to source control. Even a secret committed for one second and then deleted remains in git history. Leaked secrets in public repos are found within seconds by automated scanners.

```bash
# Scanning a repo for accidentally committed secrets
git log --all --full-history -- "*.env"
trufflehog git file://. --only-verified
```

### What to use instead

| Option | When to use | Notes |
|---|---|---|
| HashiCorp Vault | Production secrets, dynamic credentials | Full audit trail, TTL-based leases |
| AWS Secrets Manager | AWS workloads | Automatic rotation, IAM-based access |
| Kubernetes Secrets | K8s workloads | Base64-encoded (not encrypted at rest by default — enable KMS) |
| External Secrets Operator | Sync cloud secrets into K8s | Bridges Vault/AWS SM into K8s Secrets |

The rule of thumb: secrets should be fetched at runtime from a secrets manager, not baked into images, config files, or environment definitions.

---

## Container Security Basics

### Why containers are not inherently secure

A container shares the host kernel. If a container process escapes the container namespace, it interacts directly with the host. Containers are process isolation, not virtual machine isolation.

### Key risks
- Running as root inside a container — root in the container is root on the host if isolation breaks
- Using `latest` tag — unpredictable image content, breaks reproducibility
- Including unnecessary tools — an attacker inside a container can use curl, wget, bash to exfiltrate data or download tools
- Secrets baked into the image — visible in image layers with `docker history`

### Secure Dockerfile basics

```dockerfile
FROM alpine:3.19

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install only what is required
RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --chown=appuser:appgroup ./bin/myapp .

# Run as non-root
USER appuser

EXPOSE 8080
ENTRYPOINT ["./myapp"]
```

### Key container security controls

```yaml
# SecurityContext in Kubernetes
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
  seccompProfile:
    type: RuntimeDefault
```

**readOnlyRootFilesystem** — prevents attackers from writing tools or persistence scripts to the container filesystem.

**capabilities: drop ALL** — Linux capabilities are fine-grained root privileges. Dropping all and adding back only what is needed significantly limits what a compromised process can do.

**seccompProfile RuntimeDefault** — applies the container runtime's default seccomp profile, blocking dangerous syscalls like `ptrace` and `mount`.

---

## Security in the Software Delivery Lifecycle

Security must appear at every stage of delivery. "Shift left" means catching issues as early as possible.

```text
Code -> PR -> Build -> Container -> Deploy -> Runtime
  |      |      |          |           |          |
secrets SAST  deps    image scan  admission   threat
 scan  scan  scan      (Trivy)    webhooks  detection
```

**Stage controls:**

| Stage | Tool examples | What it catches |
|---|---|---|
| Code | IDE linters, SonarLint | Insecure patterns as you type |
| PR | GitGuardian, TruffleHog, SonarQube | Secrets, SAST findings |
| Build | tfsec, Checkov, Snyk | IaC misconfigs, vulnerable deps |
| Container | Trivy, Clair | CVEs in image layers |
| Deploy | OPA/Gatekeeper, Kyverno | Policy enforcement |
| Runtime | Falco, eBPF | Unexpected process/network activity |

---

## Key Takeaways

- CIA triad: Confidentiality, Integrity, Availability — map every control to these
- Authentication proves identity; authorization grants permissions — both must be correct
- TLS 1.2 minimum, TLS 1.3 preferred; always verify certificates
- Least privilege limits blast radius when a component is compromised
- OWASP Top 10 covers the most common exploited vulnerabilities — design against them
- Secrets belong in secret managers, not environment variables, images, or source code
- Container security requires non-root user, read-only filesystem, dropped capabilities, and seccomp
- Shift left: catch security issues at code review, not in production
