---
title: "Troubleshooting"
sidebar_position: 8
---

# Security & DevSecOps — Troubleshooting Runbooks

Systematic runbooks for the most common security and DevSecOps failures in production Kubernetes environments.

---

## Runbook 1: Admission Webhook Blocking All Deployments

**Symptoms:** All `kubectl apply` commands fail with `admission webhook denied` or `context deadline exceeded`. May affect all namespaces or specific ones.

**Diagnosis:**

```bash
# Identify which webhooks are configured
kubectl get validatingwebhookconfigurations
kubectl get mutatingwebhookconfigurations

# Describe the webhook to find endpoint and failure policy
kubectl describe validatingwebhookconfiguration <name>

# Check if webhook pod is running
kubectl get pods -n <webhook-namespace>
kubectl logs -n <webhook-namespace> deployment/<webhook-controller> --tail=50

# Test webhook endpoint reachability from cluster
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- \
  curl -k https://<webhook-service>.<namespace>.svc/validate
```

**Common causes and fixes:**

| Cause | Symptom | Fix |
|---|---|---|
| Webhook pod down | `context deadline exceeded` | Restart webhook deployment |
| Wrong TLS cert | `x509: certificate signed by unknown authority` | Rotate webhook cert/secret |
| `failurePolicy: Fail` + pod down | All deployments blocked | Temporarily set `failurePolicy: Ignore` for recovery |
| Namespace selector mismatch | Only specific namespaces blocked | Fix `namespaceSelector` in webhook spec |
| Policy violation | `admission webhook denied: policy X` | Read policy reason, fix manifest or adjust policy |

**Emergency bypass (use only when webhook is broken, not policy-blocking):**

```bash
# Temporarily disable a webhook (restore immediately after recovery)
kubectl delete validatingwebhookconfiguration <name>
# OR patch failurePolicy
kubectl patch validatingwebhookconfiguration <name> \
  --type=json -p='[{"op":"replace","path":"/webhooks/0/failurePolicy","value":"Ignore"}]'
```

**OPA/Gatekeeper specific:**

```bash
# Check constraint violations
kubectl get constraints
kubectl describe constraint <name>

# Check Gatekeeper controller logs
kubectl logs -n gatekeeper-system deployment/gatekeeper-controller-manager

# Audit mode — see violations without blocking
kubectl patch constrainttemplate <name> --type=merge \
  -p '{"spec":{"targets":[{"rego":"...","target":"admission.k8s.gatekeeper.sh"}]}}'
```

---

## Runbook 2: RBAC Permission Denied

**Symptoms:** `Error from server (Forbidden): ... is forbidden: User "..." cannot ...`

**Diagnosis:**

```bash
# Check what the user/SA can do
kubectl auth can-i get pods --as=system:serviceaccount:default:mysa
kubectl auth can-i --list --as=system:serviceaccount:default:mysa -n production

# Find role bindings for a service account
kubectl get rolebindings,clusterrolebindings -A \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.subjects[*].name}{"\n"}{end}' \
  | grep <sa-name>

# Describe the binding to see what role it grants
kubectl describe clusterrolebinding <name>
kubectl describe clusterrole <role-name>

# Check audit logs (if audit logging is enabled)
# Look for verb=... user=... resource=... decision=deny
```

**Fix patterns:**

```yaml
# Grant a specific permission with a Role + RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: mysa
  namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

**Principle of least privilege checklist:**
- Never grant `cluster-admin` to application service accounts
- Prefer `Role` + `RoleBinding` (namespace-scoped) over `ClusterRole` + `ClusterRoleBinding`
- Audit bindings quarterly: `kubectl get clusterrolebindings -o json | jq '.items[] | select(.roleRef.name=="cluster-admin")'`

---

## Runbook 3: TLS Certificate Expiry

**Symptoms:** Browser `NET::ERR_CERT_EXPIRED`, curl `SSL certificate problem: certificate has expired`, services returning 503.

**Detect certificates expiring soon:**

```bash
# Check all cert-manager Certificate objects
kubectl get certificates -A
kubectl describe certificate <name> -n <namespace>

# Check expiry manually with OpenSSL
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null \
  | openssl x509 -noout -dates

# Check Kubernetes TLS secrets directly
kubectl get secret <tls-secret> -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate
```

**cert-manager ACME challenge failures:**

```bash
# Check CertificateRequest status
kubectl get certificaterequest -A
kubectl describe certificaterequest <name> -n <namespace>

# Check Order and Challenge objects
kubectl get orders,challenges -A
kubectl describe challenge <name> -n <namespace>

# Common failure: HTTP-01 challenge — ingress must serve /.well-known/acme-challenge/
# Verify the challenge path is reachable externally
curl http://yourdomain.com/.well-known/acme-challenge/test

# DNS-01 challenge failure — check if DNS TXT record was created
dig _acme-challenge.yourdomain.com TXT
```

**Manual cert renewal trigger:**

```bash
# Force renewal by deleting the Certificate's Secret
kubectl delete secret <tls-secret> -n <namespace>
# cert-manager will re-issue automatically

# Or annotate the Certificate to force renewal
kubectl annotate certificate <name> -n <namespace> \
  cert-manager.io/issue-temporary-certificate="true"
```

---

## Runbook 4: Vault Token Renewal Failure

**Symptoms:** Application logs `permission denied` or `403` from Vault. Pods may CrashLoopBackOff if they rely on Vault secrets at startup.

**Diagnosis:**

```bash
# Check Vault pod status
kubectl get pods -n vault

# Check Vault Agent sidecar logs (if using agent injection)
kubectl logs <pod> -c vault-agent

# Check the Vault auth method
vault auth list

# Test Kubernetes auth from within a pod
kubectl exec -it <pod> -- sh -c \
  'curl -s -X POST $VAULT_ADDR/v1/auth/kubernetes/login \
   -d "{\"jwt\":\"$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)\",\"role\":\"my-role\"}"'

# Check token TTL and renewable status
vault token lookup
```

**Common causes:**

| Cause | Fix |
|---|---|
| Token TTL too short | Increase `ttl` and `max_ttl` on Vault role |
| AppRole secret_id expired | Rotate secret_id; use `secret_id_ttl=0` for non-expiring |
| Kubernetes auth role not bound to SA | Add service account to Vault role `bound_service_account_names` |
| Vault sealed | `vault operator unseal` (or auto-unseal via KMS) |
| Network policy blocking Vault port | Allow egress to Vault service port 8200 |

**Vault Agent injection annotation:**

```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "my-app-role"
  vault.hashicorp.com/agent-inject-secret-db-creds: "secret/data/db/creds"
  vault.hashicorp.com/agent-pre-populate-only: "false"  # enable renewal
```

---

## Runbook 5: Image Pull Failing Due to Registry Auth

**Symptoms:** Pod stuck in `ImagePullBackOff` or `ErrImagePull`. Events show `unauthorized: authentication required` or `access denied`.

**Diagnosis:**

```bash
# Check pod events
kubectl describe pod <name> -n <namespace>

# Check if imagePullSecrets is set
kubectl get pod <name> -o jsonpath='{.spec.imagePullSecrets}'

# Check the secret exists and is valid
kubectl get secret regcred -n <namespace> -o jsonpath='{.data.\.dockerconfigjson}' | \
  base64 -d | jq .

# Test the credentials manually
docker login <registry> -u <username> -p <password>
```

**ECR token refresh (tokens expire every 12 hours):**

```bash
# Renew ECR token manually
aws ecr get-login-password --region us-east-1 | \
  kubectl create secret docker-registry ecr-secret \
    --docker-server=<account>.dkr.ecr.us-east-1.amazonaws.com \
    --docker-username=AWS \
    --docker-password=$(aws ecr get-login-password --region us-east-1) \
    --dry-run=client -o yaml | kubectl apply -f -
```

**Automated ECR token refresh with CronJob:**

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: ecr-token-refresh
spec:
  schedule: "0 */6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: ecr-token-refresh-sa
          containers:
          - name: refresh
            image: amazon/aws-cli
            command:
            - /bin/sh
            - -c
            - |
              TOKEN=$(aws ecr get-login-password --region us-east-1)
              kubectl create secret docker-registry ecr-secret \
                --docker-server=$ECR_REGISTRY \
                --docker-username=AWS \
                --docker-password=$TOKEN \
                --dry-run=client -o yaml | kubectl apply -f -
```

**IRSA / Workload Identity for ECR (preferred, no secret rotation needed):**

```yaml
# Annotate service account with IAM role
kubectl annotate serviceaccount default \
  eks.amazonaws.com/role-arn=arn:aws:iam::<account>:role/ecr-read-role
```

---

## Runbook 6: Falco Generating Excessive False Positives

**Symptoms:** Falco alert volume overwhelming SIEM/PagerDuty. Real alerts getting buried.

**Diagnosis:**

```bash
# Check Falco logs
kubectl logs -n falco daemonset/falco --tail=100

# See which rules are firing most
kubectl logs -n falco daemonset/falco | \
  grep '"rule":' | jq -r '.rule' | sort | uniq -c | sort -rn | head -20
```

**Tuning approach — override noisy rules:**

```yaml
# falco_rules_override.yaml — add to custom rules ConfigMap
- rule: Write below etc
  desc: Write to /etc directory
  condition: >
    open_write and container and fd.name startswith /etc
    and not proc.name in (known_etc_writers)
  output: "Write below /etc (user=%user.name command=%proc.cmdline)"
  priority: WARNING
  enabled: true
  override:
    condition: append
    # Append exception for our known init containers
    # Appended: and not (proc.name="my-init" and container.image.repository="myrepo/init")
```

**Add macro exceptions:**

```yaml
- macro: known_etc_writers
  condition: proc.name in (sed, dpkg, apt, yum, pip, npm)
  override:
    condition: append
    # Add your app's init container
    # Appended: or proc.name in (my-config-writer)
```

**Priority filtering — suppress low-priority noise in routing:**

```yaml
# In falcosidekick config — only page on CRITICAL/ERROR
outputs:
  pagerduty:
    routingkey: "xxx"
    minimumpriority: "error"
  slack:
    minimumpriority: "warning"
```

---

## Runbook 7: Secret Leaked in Git History

**Symptoms:** Secret (API key, password, private key) found in git commit history. May be discovered via automated scanning (truffleHog, GitGuardian) or manual audit.

**Immediate response (first 15 minutes):**

```bash
# 1. Revoke/rotate the secret immediately — do this FIRST
# (AWS key: deactivate in IAM console; GitHub token: revoke in settings; etc.)

# 2. Determine exposure window
git log --all --oneline -- path/to/file/with/secret
git log -p --all -S "SECRET_VALUE" 2>/dev/null

# 3. Check if secret was cloned/forked
# Check GitHub Insights → Traffic for clone counts
```

**Remove from git history with BFG Repo-Cleaner:**

```bash
# Install BFG
brew install bfg

# Remove the specific string from all history
echo "MY_SECRET_VALUE" > secrets.txt
bfg --replace-text secrets.txt myrepo.git

# OR remove a specific file from history
bfg --delete-files id_rsa myrepo.git

# Clean up and force push (coordinate with team — rewrites history)
cd myrepo
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

**Post-incident rotation checklist:**

```text
[ ] Secret revoked/rotated at source
[ ] New secret stored in proper secrets manager (Vault/AWS Secrets Manager)
[ ] All services updated to use new secret
[ ] Git history rewritten and force-pushed
[ ] All forks/clones notified or access revoked
[ ] Audit log checked for unauthorized use of leaked secret
[ ] Pre-commit hooks added (gitleaks, detect-secrets)
[ ] CI/CD secret scanning enabled (GitHub secret scanning, GitGuardian)
[ ] Postmortem written
```

**Add pre-commit hook to prevent future leaks:**

```bash
# Install gitleaks pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
gitleaks protect --staged --redact -v
if [ $? -ne 0 ]; then
  echo "Secret detected. Commit blocked."
  exit 1
fi
EOF
chmod +x .git/hooks/pre-commit
```

---

## Runbook 8: Compromised Image Detected

**Symptoms:** Trivy/Grype scan finds critical CVE in a running image. Security team flags image digest as compromised in threat feed. Falco runtime alert fires on unexpected process in container.

**Immediate triage:**

```bash
# Identify all running pods using the image
kubectl get pods -A -o json | \
  jq -r '.items[] | select(.spec.containers[].image | contains("suspicious-image")) | 
  .metadata.namespace + "/" + .metadata.name'

# Check image digest vs expected
kubectl get pod <name> -o jsonpath='{.status.containerStatuses[0].imageID}'

# Scan with Grype for CVEs
grype <image>:<tag>

# Scan with Syft for SBOM
syft <image>:<tag> -o json | jq '.artifacts[] | select(.type=="apk" or .type=="deb") | .name'
```

**Quarantine and rollback:**

```bash
# Immediately rollback to last known-good deployment
kubectl rollout undo deployment/<name> -n <namespace>

# Block the compromised image via OPA/Gatekeeper policy
cat <<EOF | kubectl apply -f -
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sBlockedImages
metadata:
  name: block-compromised-image
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
  parameters:
    blockedImages:
    - "myregistry/myimage:bad-tag"
EOF

# If Falco detected runtime compromise: isolate the pod via NetworkPolicy
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-compromised-pod
  namespace: <namespace>
spec:
  podSelector:
    matchLabels:
      app: <compromised-app>
  policyTypes:
  - Ingress
  - Egress
  # No ingress/egress rules = all traffic blocked
EOF
```

**Post-incident:**

```bash
# Verify patched image with Trivy
trivy image --exit-code 1 --severity CRITICAL myregistry/myimage:patched-tag

# Sign the patched image with Cosign
cosign sign --key cosign.key myregistry/myimage:patched-tag

# Update image policy to require signatures
# (Sigstore/Cosign admission webhook)
```

---

## Quick Reference: Security Failure → First Command

| Failure | First command |
|---|---|
| Admission webhook blocking | `kubectl get validatingwebhookconfigurations` |
| RBAC forbidden | `kubectl auth can-i --list --as=<user>` |
| TLS expired | `openssl s_client -connect host:443` |
| Vault 403 | `kubectl logs <pod> -c vault-agent` |
| ImagePullBackOff | `kubectl describe pod <name>` → check Events |
| Falco noise | `kubectl logs -n falco daemonset/falco \| jq -r '.rule' \| sort \| uniq -c` |
| Secret in git | `git log -p --all -S "SECRET_VALUE"` |
| Compromised image | `kubectl get pods -A -o json \| jq '...'` → scan with Grype |

---

## Command Packs By Symptom

### Web Service Down

```bash
curl -vk URL
kubectl get pods -n NAMESPACE
kubectl get svc -n NAMESPACE
kubectl get endpointslice -n NAMESPACE
kubectl logs deploy/APP --since=10m
kubectl describe pod POD
```

### Auth Failure

```bash
date                                           # clock skew (JWT validation)
curl -vk AUTH_URL
kubectl describe secret AUTH_SECRET
kubectl auth can-i get pods --as=system:serviceaccount:NAMESPACE:SA
kubectl get rolebinding,clusterrolebinding -A | grep SA_NAME
```

### TLS / Certificate Issues

```bash
openssl s_client -connect api.example.com:443 -servername api.example.com
echo | openssl s_client -connect api.example.com:443 2>/dev/null | openssl x509 -noout -dates

kubectl describe certificate NAME -n NAMESPACE
kubectl describe certificaterequest -n NAMESPACE
kubectl logs -n cert-manager deploy/cert-manager | tail -30
```

Common: expired certificate, hostname mismatch, missing intermediate CA, HTTPS to HTTP port.

### Secret Failure

```bash
kubectl get secret NAME -n NAMESPACE -o yaml
kubectl describe pod POD | grep -A 20 "Environment"
kubectl exec POD -- env | grep KEY
# Common: wrong key name, missing namespace, base64 confusion, rotation without pod restart
```

### Rollout Failure

```bash
kubectl rollout status deploy/APP -n NAMESPACE
kubectl rollout history deploy/APP -n NAMESPACE
kubectl describe deploy/APP -n NAMESPACE | grep -A 10 "Events"
kubectl rollout undo deploy/APP -n NAMESPACE
```

Common: readiness probe failing, image pull failure, config incompatibility, DB migration issue.

---

## Troubleshooting Anti-Patterns to Avoid

| Anti-pattern | Why it's dangerous |
|---|---|
| Restart everything immediately | Loses in-flight state, hides root cause |
| Change multiple variables at once | Can't attribute which change fixed/broke it |
| Assume DNS is always the issue | Masks real failures; wastes time |
| Assume high CPU is the root cause | CPU is often a symptom, not a cause |
| Apply Terraform plan blindly | `-/+` lines may destroy production data |
| Grant `cluster-admin` to fix RBAC fast | Permanent privilege escalation |
| Disable TLS verification casually | `--insecure-skip-verify` in prod = security incident |
| Deep root-cause hunt during active user impact | Delay stable rollback; fix user pain first |

---

## Senior Incident Response Pattern

Work in this order when users are impacted:

```text
1. Identify the failing layer:
   identity → DNS → network → TLS → workload health → dependency health → policy

2. Test one hypothesis at a time

3. For recent-change incidents → rollback first, root-cause after stability

4. Mitigation priority order:
   1. Rollback recent change
   2. Fail over region/path
   3. Disable feature flag
   4. Scale capacity
   5. Bypass non-critical dependency
   6. Root-cause hunt after user impact resolved

5. After stability:
   → Eliminate the class of failure through automation and guardrails
   → Write runbook for this failure mode
   → Add alerting for earlier detection
```

**Interview answer shape:** "I troubleshoot by isolating the failing layer first. I test one hypothesis at a time and prefer fast reversible mitigations when users are impacted. For recent-change incidents, rollback is often the safest first move. After recovery, I eliminate the class of failure through automation, guardrails, and better observability."
