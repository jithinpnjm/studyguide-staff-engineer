---
title: "DevOps Troubleshooting And Security Errors Zero To Hero"
sidebar_position: 26
---

# DevOps Troubleshooting And Security Errors Zero To Hero

Production failures repeat in patterns: bad credentials, wrong DNS, blocked network paths, expired certificates, broken rollouts, resource exhaustion, or policy misconfiguration.

Great operators do not memorize random error strings. They recognize failure classes quickly and test hypotheses systematically.

This guide is designed as a complete path:

- Beginner: troubleshooting framework and common failure layers
- Intermediate: Kubernetes, Docker, CI/CD, IAM, DNS, TLS, Linux permission issues
- Advanced: rollout failures, drift, RBAC, secrets, state locks, policy chains
- SRE Level: blast radius, mitigation-first debugging, production triage
- Interview Level: explain incidents with structured reasoning

---

# Part 1: Memory Palace — Airport Operations

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

# Part 2: Universal Troubleshooting Framework

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

# Part 3: Failure Layers Model

```text
User -> DNS -> Network -> TLS -> Load balancer -> App -> Dependency -> Data store
```

Or for delivery:

```text
Git -> CI -> artifact -> registry -> deploy controller -> cluster -> pod -> service
```

Find the broken layer first.

---

# Part 4: Kubernetes Failure Patterns

## Pod Pending

```bash
kubectl describe pod POD
kubectl get events -A --sort-by=.lastTimestamp
```

Likely:

- insufficient resources
- taint/toleration mismatch
- affinity impossible
- PVC not bound

## CrashLoopBackOff

```bash
kubectl logs POD --previous
kubectl describe pod POD
```

Likely:

- startup config error
- missing secret/env var
- dependency unavailable
- bad command

## ImagePullBackOff

Likely:

- bad tag
- registry auth missing
- registry outage

## Service Exists But Fails

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

# Part 5: Docker / Container Failures

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

# Part 6: CI/CD Failures

## GitHub Actions

Common:

- permission denied to write releases/packages
- secret unavailable
- network issue on runner
- wrong branch/path filters

## Jenkins

Common:

- credential id mismatch
- missing plugin
- agent disk full
- agent pod Pending

## ArgoCD / GitOps

Common:

- Git auth failure
- rollout unhealthy
- RBAC issue
- cluster disconnected

Golden rule:

> Separate pipeline failure from application failure.

---

# Part 7: DNS Failures

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

# Part 8: TCP / Network Path Failures

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

# Part 9: TLS / Certificate Failures

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

# Part 10: IAM / RBAC / Permission Failures

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

# Part 11: Terraform Failures

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

# Part 12: Secret Failures

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

# Part 13: Rollout Failures

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

# Part 14: Real Incident Stories

## 503 Errors After Deploy

Path:

- check ingress/LB health
- check Deployment rollout
- check endpoints
- rollback if confidence high

## Works In Dev, Fails In Prod

Likely:

- env var difference
- stricter NetworkPolicy
- lower resource limits
- different image tag/arch
- secret missing

## CI Passed, Prod Broken

Likely:

- test gap
- env drift
- runtime dependency issue
- rollout config issue

## Users Cannot Login Suddenly

Likely:

- IdP outage
- expired OIDC secret/cert
- DNS issue to auth provider
- clock skew/token validation

---

# Part 15: Mitigation Priority

Prefer:

1. rollback recent change
2. fail over region/path
3. disable feature flag
4. scale capacity
5. bypass noncritical dependency
6. deep root-cause hunt after stability

---

# Part 16: Command Packs By Symptom

## Web Service Down

```bash
curl -vk URL
kubectl get pods
kubectl get svc
kubectl get endpointslice
kubectl logs POD --since=10m
```

## Auth Failure

```bash
date
curl -vk AUTH_URL
kubectl describe secret AUTH_SECRET
kubectl auth can-i ...
```

## Pipeline Failure

```bash
git diff LAST_GOOD..HEAD
check secrets
check permissions
check artifact existence
```

## DNS Suspected

```bash
dig HOST
nslookup HOST
cat /etc/resolv.conf
```

---

# Part 17: Anti-Patterns

Avoid:

- restarting everything immediately
- changing multiple variables at once
- assuming DNS is always the issue
- assuming CPU high means root cause
- applying Terraform blindly
- granting cluster-admin to fix RBAC fast
- disabling TLS verification casually

---

# Part 18: Interview Questions

- Pod Pending: how debug?
- Service returns 503: where start?
- CI passes but prod fails: why?
- How diagnose TLS handshake issue?
- How debug access denied in Kubernetes?
- Why rollback before root cause sometimes?
- Terraform wants destroy prod DB—what do you do?

---

# Part 19: Labs

## Beginner

- break a Service selector
- create expired self-signed cert locally
- fail pipeline with missing secret

## Intermediate

- create CrashLoopBackOff intentionally
- simulate RBAC forbidden
- break DNS inside namespace

## Advanced

- run mock outage after deploy
- compare dev/prod env drift
- simulate stuck Terraform lock

---

# Part 20: Senior Answer Shape

> I troubleshoot by isolating the failing layer first: identity, DNS, network, TLS, workload health, dependency health, or policy. I test one hypothesis at a time and prefer fast reversible mitigations when users are impacted. For recent-change incidents, rollback is often the safest first move. After recovery, I eliminate the class of failure through automation, guardrails, and better observability.

---

# Recall Prompts

- Why should you identify the broken layer first?
- Why can CI pass while production fails?
- Why does rollback often beat deep debugging during incidents?
- Why is `kubectl auth can-i` powerful?
- Why are many failures really dependency-chain failures?
