---
title: "Expert"
sidebar_position: 3
---

# Security & DevSecOps — Expert

Expert-level security is about architecture: designing systems that are secure by default, enforcing policies programmatically, and building runtime visibility that catches what static controls miss.

---

## Zero-Trust Architecture

### The principle

Traditional perimeter security assumes that anything inside the network is trusted. Zero trust assumes the opposite: no implicit trust based on network location. Every request must be authenticated, authorized, and validated — regardless of where it originates.

**Zero trust tenets:**
1. Verify explicitly — authenticate and authorize based on all available data points (identity, device health, location, service)
2. Use least privilege access — limit access to the minimum required, for the minimum time
3. Assume breach — design east-west controls as if attackers are already inside

### Zero trust in Kubernetes

A Kubernetes cluster without additional controls is not zero trust — pods can freely communicate, service accounts get default permissions, and workloads share the same network namespace.

Zero trust Kubernetes layers:
- **Identity**: Workload Identity (IRSA on AWS, GKE Workload Identity) gives pods cloud IAM roles
- **mTLS**: Service mesh (Istio, Linkerd) encrypts and authenticates all pod-to-pod communication
- **NetworkPolicy**: explicit allow-lists for pod-to-pod and pod-to-internet traffic
- **Admission control**: OPA/Gatekeeper enforces security baselines at deploy time
- **Runtime**: Falco detects unexpected behavior inside running pods

### Network segmentation model

```text
Internet -> WAF -> Ingress -> [namespace: frontend]
                                      |
                           NetworkPolicy (explicit allow)
                                      |
                              [namespace: backend]
                                      |
                           NetworkPolicy (explicit allow)
                                      |
                              [namespace: data]
```

Each boundary requires explicit policy. Default deny everywhere.

---

## OPA/Gatekeeper — Policy as Code

Open Policy Agent (OPA) is a general-purpose policy engine. Gatekeeper is the Kubernetes operator that integrates OPA with the Kubernetes admission webhook.

### How it works

When a resource is created or updated in Kubernetes, the API server calls the admission webhook. Gatekeeper evaluates the resource against all active policies and returns allow or deny.

### ConstraintTemplate — define the policy

```yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
      validation:
        openAPIV3Schema:
          type: object
          properties:
            labels:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels

        violation[{"msg": msg}] {
          provided := {label | input.review.object.metadata.labels[label]}
          required := {label | label := input.parameters.labels[_]}
          missing := required - provided
          count(missing) > 0
          msg := sprintf("Missing required labels: %v", [missing])
        }
```

### Constraint — apply the policy

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-team-label
spec:
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
  parameters:
    labels: ["team", "environment"]
```

### Common OPA/Gatekeeper policies

```rego
# Deny containers running as root
package k8snoroot

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.securityContext.runAsNonRoot
  msg := sprintf("Container %v must set runAsNonRoot: true", [container.name])
}

# Require resource limits
package k8srequiredresources

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %v must have memory limits set", [container.name])
}

# Deny privileged containers
package k8sdenyprivileged

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  container.securityContext.privileged
  msg := sprintf("Container %v must not be privileged", [container.name])
}
```

---

## Admission Webhooks

Kubernetes has two types of admission webhooks:
- **MutatingAdmissionWebhook** — modifies resources before persistence (add labels, inject sidecars, set defaults)
- **ValidatingAdmissionWebhook** — validates resources and allows or rejects them (policy enforcement)

### Webhook execution order

```text
API Request -> Authentication -> Authorization -> Mutating Webhooks -> Validating Webhooks -> etcd
```

Mutating webhooks run first and can change the object. Validating webhooks see the final (mutated) object.

### Common admission webhook patterns

**Sidecar injection** (Istio, Vault Agent, Datadog):
```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: istio-sidecar-injector
webhooks:
  - name: istio-webhook.istio.io
    admissionReviewVersions: ["v1"]
    sideEffects: None
    clientConfig:
      service:
        name: istiod
        namespace: istio-system
        path: /inject
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
    namespaceSelector:
      matchLabels:
        istio-injection: enabled
```

**Validating webhook with OPA:**
The Gatekeeper validating webhook is automatically configured when Gatekeeper is installed. All resources pass through it based on the constraint `match` rules.

### Webhook failure modes

Critical: if a webhook is down, it can block all deployments.
- Set `failurePolicy: Ignore` for non-critical webhooks (allow if webhook is unavailable)
- Set `failurePolicy: Fail` for security-critical webhooks (deny if webhook is unavailable)
- Always set `timeoutSeconds` to prevent hanging API calls

---

## Workload Identity

### The problem

Applications running in Kubernetes often need to access cloud resources (S3, RDS, GCS). Storing cloud credentials as Kubernetes Secrets is a security risk — the secret is static, can be exfiltrated, and requires rotation.

### IRSA — IAM Roles for Service Accounts (AWS)

IRSA uses OIDC federation to allow pods to assume IAM roles without static credentials.

```bash
# Create an IAM OIDC provider for the EKS cluster
eksctl utils associate-iam-oidc-provider \
  --cluster my-cluster \
  --approve

# Create IAM role with trust policy
aws iam create-role \
  --role-name my-app-role \
  --assume-role-policy-document '{
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/OIDC_PROVIDER"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "OIDC_PROVIDER:sub": "system:serviceaccount:production:my-app-sa"
        }
      }
    }]
  }'
```

```yaml
# Kubernetes ServiceAccount with IRSA annotation
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/my-app-role
```

When a pod uses this service account, the AWS SDK automatically exchanges the projected service account token for temporary AWS credentials via STS.

### GKE Workload Identity

```bash
# Create a GCP Service Account
gcloud iam service-accounts create my-app-sa

# Bind Kubernetes SA to GCP SA
gcloud iam service-accounts add-iam-policy-binding \
  my-app-sa@PROJECT.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:PROJECT.svc.id.goog[production/my-app-sa]"
```

```yaml
# Annotate the Kubernetes ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: production
  annotations:
    iam.gke.io/gcp-service-account: my-app-sa@PROJECT.iam.gserviceaccount.com
```

---

## SLSA Framework

SLSA (Supply-chain Levels for Software Artifacts) is a framework for measuring and improving the security of software supply chains. It defines four levels of build integrity.

| Level | Requirement | Typical implementation |
|---|---|---|
| SLSA 1 | Provenance exists | Build generates provenance document |
| SLSA 2 | Hosted build, signed provenance | CI system signs provenance |
| SLSA 3 | Hardened build, unforgeable provenance | Isolated build, no credential access |
| SLSA 4 | Reproducible build, two-party review | Hermetic, reproducible, dual approval |

### Generating SLSA provenance

```bash
# Using slsa-verifier
slsa-verifier verify-image \
  myregistry/myapp:v1.0.0 \
  --source-uri github.com/myorg/myapp \
  --source-tag v1.0.0

# GitHub's SLSA generator (GitHub Actions)
# Uses reusable workflow to generate SLSA 3 provenance
```

---

## in-toto Attestations

in-toto is a framework for securing software supply chains by capturing and verifying the steps in the build process. Each step produces a signed "link" that proves what happened and who did it.

```bash
# Generate an attestation
cosign attest \
  --predicate sbom.json \
  --type spdxjson \
  myregistry/myapp:$GIT_SHA

# Verify an attestation
cosign verify-attestation \
  --type spdxjson \
  --certificate-identity-regexp=https://github.com \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  myregistry/myapp:$GIT_SHA
```

The attestation chain proves:
1. Source code was at commit X
2. Build used Dockerfile Y with dependencies Z
3. Trivy scan found no CRITICAL CVEs
4. Image was signed by identity I

Admission controllers (Kyverno, OPA) can verify attestations before allowing deployment.

---

## Runtime Security — Falco

Falco is a cloud-native runtime security tool that detects unexpected behavior in running containers by monitoring system calls via eBPF or kernel modules.

### How Falco works

Falco intercepts system calls at the kernel level, compares them against rules, and generates alerts when rules match. It can detect:
- Shell spawned inside a container
- File read from sensitive paths (`/etc/shadow`, `/root/.ssh`)
- Network connection to unexpected destination
- Container privilege escalation attempt

### Falco rule syntax

```yaml
# Detect shell spawned in a container
- rule: Terminal shell in container
  desc: A shell was spawned by a non-shell program in a container
  condition: >
    spawned_process and container
    and shell_procs
    and proc.pname exists
    and not proc.pname in (shell_binaries)
  output: >
    Shell spawned in a container other than entrypoint
    (user=%user.name container=%container.id image=%container.image.repository
     shell=%proc.name parent=%proc.pname cmdline=%proc.cmdline)
  priority: WARNING

# Detect write to /etc
- rule: Write below etc
  desc: An attempt to write to /etc directory
  condition: >
    open_write and container
    and fd.directory = /etc
  output: "File below /etc opened for writing (user=%user.name command=%proc.cmdline)"
  priority: ERROR

# Detect outbound connection from a specific service
- rule: Unexpected outbound connection
  desc: Detect outbound network connection not in allow-list
  condition: >
    outbound and container
    and not fd.sip in (allowed_outbound_ips)
    and container.image.repository = "myapp"
  output: "Unexpected outbound connection (destination=%fd.rip:%fd.rport)"
  priority: WARNING
```

```bash
# Test a Falco rule
falco -r custom-rules.yaml --validate custom-rules.yaml

# Check Falco output
kubectl logs -n falco -l app=falco -f

# List active rules
falcoctl rule list
```

---

## eBPF Security

eBPF (extended Berkeley Packet Filter) allows custom programs to run safely in the Linux kernel without modifying kernel source. For security, eBPF enables:

- **Syscall filtering** — inspect and filter system calls with full context
- **Network observability** — track all network flows at the kernel level
- **Container isolation monitoring** — detect namespace escapes, privilege escalation attempts
- **Zero-overhead observability** — kernel-level visibility without instrumentation

Tools using eBPF for security:
- **Falco** — runtime threat detection
- **Cilium** — network policy enforcement and observability
- **Tetragon** — Cilium's eBPF-based security enforcement (can kill processes matching policies)
- **Pixie** — automatic kernel-level observability

### Tetragon — enforcement at kernel level

```yaml
# Kill any process that opens /etc/shadow
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: block-shadow-read
spec:
  kprobes:
    - call: "security_file_open"
      syscall: false
      args:
        - index: 0
          type: "file"
      selectors:
        - matchArgs:
            - index: 0
              operator: "Postfix"
              values:
                - "/etc/shadow"
          matchActions:
            - action: Sigkill
```

---

## Threat Modelling — STRIDE

STRIDE is a systematic method for identifying security threats during design. Each letter represents a threat category.

| Threat | Meaning | Example | Mitigation |
|---|---|---|---|
| Spoofing | Impersonating an identity | Forged JWT, stolen service account token | Strong auth, mTLS, token binding |
| Tampering | Modifying data or code | MITM modifies API response | TLS, integrity checks, signatures |
| Repudiation | Denying an action was performed | "I didn't delete that" | Audit logs, immutable logging |
| Information Disclosure | Unauthorized data access | Secret in logs, over-permissive RBAC | Encryption, least privilege |
| Denial of Service | Making a service unavailable | Exhausting CPU/memory, DDoS | Rate limiting, resource quotas, autoscaling |
| Elevation of Privilege | Gaining higher permissions | Container escape, RBAC misconfiguration | Least privilege, PSS, Gatekeeper |

### Running a STRIDE threat model session

1. Draw a data flow diagram (DFD) of the system — processes, data stores, external entities, data flows
2. Identify trust boundaries — where data crosses security boundaries
3. For each trust boundary and each component, apply STRIDE — what could go wrong?
4. Prioritize threats by likelihood and impact
5. Define mitigations and assign owners

### Data Flow Diagram for a typical API

```text
User Browser -> [TLS] -> CDN -> [mTLS] -> API Gateway -> [RBAC] -> Service
                                                                       |
                                                              [Dynamic secret] -> Database
                                                                       |
                                                              [OIDC] -> Cloud Storage
```

Trust boundaries: browser to CDN (public), CDN to API Gateway (internal but verify), service to database (authenticated with short-lived credentials).

---

## Key Takeaways

- Zero trust: no implicit trust from network location; every request authenticated, authorized, and policy-checked
- OPA/Gatekeeper: define policies in Rego, enforce via admission webhooks — policy violations fail deployment
- Admission webhooks: mutating runs first, validating runs last; set `failurePolicy: Fail` for security webhooks
- IRSA/Workload Identity: no static cloud credentials in clusters — pod identity via OIDC federation
- SLSA framework: four levels of build integrity; target SLSA 2+ for production workloads
- in-toto attestations: signed evidence chain from source to deployment; verifiable by admission controllers
- Falco: runtime syscall monitoring — detect shell-in-container, unexpected file writes, unexpected network connections
- eBPF: kernel-level enforcement; Tetragon can kill processes matching threat policies
- STRIDE: use in design reviews to systematically find Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Privilege Escalation threats
