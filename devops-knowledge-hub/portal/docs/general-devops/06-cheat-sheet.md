---
title: "Cheat Sheet"
sidebar_position: 6
---

# General DevOps — Cheat Sheet

Quick reference for daily use. Use this during interview prep, incident response, and code review.

---

## Git Commands

### Daily Workflow

```bash
git status                          # current state — run constantly
git diff                            # unstaged changes
git diff --staged                   # what will be committed
git add <file>                      # stage specific file
git add -p                          # stage interactively (review hunks)
git commit -m "feat: description"   # commit with message
git push origin <branch>            # push to remote
git pull --rebase origin main       # rebase local changes on top of remote
```

### Branching

```bash
git branch                          # list local branches
git branch -a                       # list all branches (local + remote)
git checkout -b feature/my-thing    # create and switch to new branch
git switch -c feature/my-thing      # modern syntax for same
git branch -d feature/my-thing      # delete local branch (safe)
git push origin --delete feature/my-thing  # delete remote branch
```

### History and Inspection

```bash
git log --oneline                   # compact log
git log --oneline --graph --all     # visual branch graph
git show <SHA>                      # show commit details
git diff main..feature/my-thing     # diff between branches
git blame <file>                    # who changed each line and when
```

### Undoing Changes

```bash
git restore <file>                  # discard unstaged changes (safe)
git restore --staged <file>         # unstage a file (safe)
git revert <SHA>                    # create undo commit (safe for shared branches)
git reset --soft HEAD~1             # undo last commit, keep changes staged
git reset --mixed HEAD~1            # undo last commit, unstage changes
git reset --hard HEAD~1             # undo last commit, discard changes (destructive)
```

**Rule:** Use `revert` on shared branches. `reset --hard` only on local branches.

### Advanced / Recovery

```bash
git reflog                          # HEAD movement history (recovery tool)
git switch -c rescue HEAD@{3}       # create branch at reflog position
git stash                           # save uncommitted changes temporarily
git stash pop                       # restore stashed changes
git bisect start                    # start binary regression search
git bisect bad                      # mark current as broken
git bisect good <SHA>               # mark reference as good
git bisect run <test-script>        # automate bisect
git bisect reset                    # end bisect
```

### Tags

```bash
git tag -a v2.1.0 -m "Release"      # create annotated tag
git push origin v2.1.0              # push tag
git tag -l                          # list all tags
git checkout v2.1.0                 # check out at tag (detached HEAD)
```

### GitOps / Infrastructure

```bash
git revert <SHA>                    # safe rollback on main
git log --oneline --since="2 hours ago"  # recent changes (incident timeline)
git diff v1.4.0..v1.4.1             # what changed between releases
```

---

## DORA Metrics Benchmarks

| Metric | Elite | High | Medium | Low |
|--------|-------|------|--------|-----|
| **Deployment Frequency** | Multiple/day | 1/day – 1/week | 1/month – 1/week | Less than once/month |
| **Lead Time for Changes** | < 1 hour | 1 day – 1 week | 1 week – 1 month | > 6 months |
| **Change Failure Rate** | 0 – 5% | 0 – 15% | 16 – 30% | > 30% |
| **MTTR** | < 1 hour | < 1 day | 1 day – 1 week | > 6 months |

### Calculating DORA

```
Deployment Frequency = deployments_to_production / time_period

Lead Time = deploy_timestamp - commit_timestamp (mean across all deployments)

Change Failure Rate = deployments_causing_incidents / total_deployments

MTTR = mean(incident.resolved_at - incident.created_at)
```

### Interpreting DORA

- **High frequency + high failure rate**: test coverage or staging parity problem
- **Low frequency + low failure rate**: batch releases; moving to smaller batches would improve both
- **High MTTR**: runbook quality, alert precision, rollback automation problem
- **High lead time**: CI speed, review queue, staging bottleneck, approval gates

---

## Deployment Strategy Comparison

| Strategy | Rollback Speed | Downtime Risk | Cost | Use Case |
|----------|---------------|---------------|------|---------|
| **Big Bang** | Slow (redeploy) | High | Low | Internal tools, maintenance windows |
| **Rolling Update** | Medium (undo rollout) | Low | Low | Stateless services, default K8s |
| **Blue-Green** | Instant (LB switch) | None | 2x infra during switch | Critical services, instant rollback required |
| **Canary** | Fast (route back) | Very low | Small overhead | High-traffic, metrics-driven rollback |
| **Feature Flag** | Instant (toggle) | None | Negligible | Any feature, decoupled from deploy |
| **Shadow / Traffic Mirror** | N/A (read-only) | None | 2x backend | Pre-production validation of new service |

### Kubernetes Rollout Commands

```bash
kubectl rollout status deployment/myapp     # watch progress
kubectl rollout history deployment/myapp    # list revisions
kubectl rollout undo deployment/myapp       # rollback to previous
kubectl rollout undo deployment/myapp --to-revision=3  # rollback to specific revision
kubectl set image deployment/myapp app=myrepo/myapp:v2.1.0  # update image
```

---

## On-Call Escalation Checklist

### First 5 Minutes — Triage

- [ ] Acknowledge the alert (stops repeated pages)
- [ ] Post status in incident channel: `[INVESTIGATING] Payment service errors — @oncall engaged`
- [ ] Assess blast radius: how many users affected? which services?
- [ ] Check monitoring dashboard: what spiked? when did it start?
- [ ] Check recent deployments: was there a deploy in the last hour?

### First 15 Minutes — Diagnosis

- [ ] Check application logs for error messages
- [ ] Check infrastructure health (pod status, node status, disk, memory)
- [ ] Check dependency health (database, external APIs, message queues)
- [ ] Narrow down the failure domain: single pod? single zone? single dependency?

### Mitigation (Before Root Cause)

- [ ] If recent deploy is suspect: rollback immediately
- [ ] If traffic is high: scale up replicas or enable rate limiting
- [ ] If a dependency is down: disable non-critical feature flag or enable fallback
- [ ] If single pod/instance is bad: terminate it (Kubernetes will reschedule)
- [ ] Communicate status update: `[UPDATE] Investigating payment timeout — evidence points to Redis connection pool exhaustion`

### Escalation Decision

Escalate when:
- You cannot identify the cause within 15–30 minutes
- The issue affects more than one system or team
- MTTR is approaching SLA breach
- You need access you do not have

### After Recovery

- [ ] Confirm error rate is back to baseline
- [ ] Communicate resolution: `[RESOLVED] Payment service normal — cause: Redis connection pool. Postmortem to follow.`
- [ ] Capture incident timeline while fresh
- [ ] File postmortem draft within 24 hours
- [ ] Add follow-up ticket for root cause fix

---

## SLO Quick Reference

```
SLI (Service Level Indicator): measurement
  Example: "fraction of HTTP requests returning 2xx in < 200ms"

SLO (Service Level Objective): target for the SLI
  Example: "99.9% of requests return 2xx in < 200ms over 30 days"

SLA (Service Level Agreement): contractual commitment (typically SLO - 1%)
  Example: "99.8% availability guaranteed or credits apply"

Error Budget: what remains in the SLO period
  Example: 99.9% SLO = 0.1% budget = 43.8 minutes/month of allowed downtime
```

### Error Budget Math

| SLO | Monthly budget | Weekly budget |
|-----|---------------|--------------|
| 99.0% | 7.3 hours | 1.7 hours |
| 99.5% | 3.6 hours | 50 minutes |
| 99.9% | 43.8 minutes | 10 minutes |
| 99.95% | 21.9 minutes | 5 minutes |
| 99.99% | 4.4 minutes | 1 minute |

---

## Common Port Reference

| Service | Port |
|---------|------|
| HTTP | 80 |
| HTTPS | 443 |
| SSH | 22 |
| Jenkins | 8080 |
| SonarQube | 9000 |
| Nexus | 8081 |
| Prometheus | 9090 |
| Grafana | 3000 |
| Alertmanager | 9093 |
| Node Exporter | 9100 |
| Blackbox Exporter | 9115 |
| Elasticsearch | 9200 |
| Kibana | 5601 |
| Kubernetes API | 6443 |
| etcd | 2379–2380 |
| Docker Registry | 5000 |
| MySQL | 3306 |
| PostgreSQL | 5432 |
| MongoDB | 27017 |
| Redis | 6379 |

---

## Kubernetes Debug Commands

```bash
# Pod state
kubectl get pods                           # list pods
kubectl get pods -o wide                   # with node assignment
kubectl describe pod <pod>                 # full event log
kubectl logs <pod>                         # current logs
kubectl logs <pod> --previous              # logs from previous crash
kubectl logs <pod> -c <container>          # multi-container pod
kubectl exec -it <pod> -- bash             # shell into pod

# Resources
kubectl top pods                           # CPU/memory by pod
kubectl top nodes                          # CPU/memory by node

# Networking
kubectl get svc                            # services
kubectl get endpointslice                  # endpoint details
kubectl exec <pod> -- nslookup kubernetes.default   # DNS check

# Events
kubectl get events --sort-by=.lastTimestamp

# Auth
kubectl auth can-i get pods --as=system:serviceaccount:ns:sa
```

---

## DevSecOps Quick Reference

```bash
# Trivy — container scanning
trivy image myrepo/myapp:latest
trivy fs /path/to/project
trivy image --severity HIGH,CRITICAL myrepo/myapp:latest

# SonarQube — static analysis
sonar-scanner \
  -Dsonar.projectKey=myproject \
  -Dsonar.host.url=http://sonar:9000 \
  -Dsonar.login=${SONAR_TOKEN}

# Secret scanning
git secrets --scan
truffleHog --json .

# SSL/TLS inspection
openssl s_client -connect host:443 -servername host
echo | openssl s_client -connect host:443 2>/dev/null | openssl x509 -noout -dates

# Kubernetes secrets
kubectl create secret generic my-secret \
  --from-literal=password=hunter2
kubectl get secret my-secret -o jsonpath='{.data.password}' | base64 -d
```

---

## Incident Mitigation Priority Order

When users are impacted, use this ordering. Diagnose after stability is restored.

1. **Rollback the recent change** — most incidents are caused by changes. Rollback fast.
2. **Failover region or traffic path** — if a zone or region is impaired, reroute.
3. **Disable the feature flag** — if the broken feature is gated, kill the flag instantly.
4. **Scale capacity** — if the cause is load-induced, buy time with more replicas.
5. **Bypass a non-critical dependency** — if a downstream is down and not required, fail gracefully.
6. **Deep root-cause hunt** — only after service is stable.

The instinct to understand before acting is natural but counterproductive during an active incident.

---

## Incident Anti-Patterns

Avoid these — they make incidents worse or harder to recover from:

| Anti-pattern | Why it is harmful |
|---|---|
| Restarting everything immediately | Masks evidence; doesn't fix the root cause |
| Changing multiple variables at once | Makes it impossible to know what fixed (or broke) it |
| "Assuming DNS is always the issue" | DNS is common but not always. Test it; don't assume. |
| Granting `cluster-admin` to fix RBAC fast | Creates a persistent security hole; fix with scoped roles |
| Applying `terraform apply` blindly | Destructive changes can make an incident worse |
| Disabling TLS verification to debug | Trains bad habits and can persist in production |
| Deep root-cause hunting before mitigation | User impact grows while you investigate |
| "Retries are harmless" | Retries can amplify load and cascade into full outage |
| Assuming healthy averages = healthy tails | P99 problems are invisible in averages |

---

## Troubleshooting Framework Quick Reference

### The 5 Universal Questions

Ask these in order before touching anything:

1. **What exactly is failing?** — specific service, endpoint, or operation (not "the site is down")
2. **Who is impacted?** — all users, a region, a subset, internal only?
3. **What changed recently?** — deployment, config change, dependency update, traffic spike?
4. **Is it getting worse, stable, or recovering?** — trend determines urgency
5. **What is the fastest safe mitigation?** — rollback, scale, disable feature flag, reroute traffic?

### Failure Layers Model

Map symptoms to layers to narrow the blast radius quickly:

```
User-facing symptom
  -> DNS          (NXDOMAIN, SERVFAIL, wrong IP)
    -> Network    (packet loss, routing, firewall)
      -> TLS      (expired cert, hostname mismatch, self-signed)
        -> Load Balancer  (health check failing, no healthy backends)
          -> Application  (crash, OOM, bug in new deploy)
            -> Dependency (database, cache, external API)
              -> Data Store (disk full, connection pool exhausted, replication lag)
```

For delivery failures, use the delivery layer model:

```
Git (auth, branch protection)
  -> CI (test failure, permission denied, secret unavailable)
    -> Artifact (build failed, image not pushed)
      -> Registry (pull rate limit, auth failure)
        -> Deploy Controller (ArgoCD sync error, Helm failure)
          -> Cluster (node not ready, resource quota exceeded)
            -> Pod (CrashLoopBackOff, ImagePullBackOff, OOMKilled)
              -> Service (no endpoints, wrong selector, port mismatch)
```

### Symptom-to-Layer Mapping

| Symptom | Likely layer | First command |
|---------|-------------|---------------|
| DNS resolution fails | DNS | `nslookup <host>` or `dig <host>` |
| Connection refused | Network / App not running | `telnet <host> <port>` or `nc -zv <host> <port>` |
| Connection timeout | Network / Firewall | `traceroute <host>` |
| TLS handshake error | TLS | `openssl s_client -connect <host>:443` |
| 502 Bad Gateway | Load balancer / App crashed | Check pod status, LB health checks |
| 503 Service Unavailable | No healthy backends | `kubectl get endpoints <svc>` |
| 403 Forbidden | IAM / RBAC | Check role bindings, policy attachments |
| CrashLoopBackOff | Application / Config | `kubectl logs <pod> --previous` |
| ImagePullBackOff | Registry auth / Image tag | `kubectl describe pod <pod>` |

---

## Common Error Patterns

| Error | Likely Cause | First Step |
|-------|-------------|------------|
| `CrashLoopBackOff` | App crashes on start: bad config, missing env var, OOM | `kubectl logs <pod> --previous` |
| `ImagePullBackOff` | Wrong image tag, registry auth failure, private registry | `kubectl describe pod <pod>` — check Events section |
| `OOMKilled` (exit 137) | Container exceeded memory limit | `kubectl describe pod <pod>` — check `Last State` reason |
| `Error: exit code 127` | Command not found in container | Check Dockerfile CMD/ENTRYPOINT, verify binary exists |
| `403 Forbidden` | Missing IAM policy, wrong RBAC role, expired token | Check role bindings: `kubectl auth can-i <verb> <resource>` |
| `DNS NXDOMAIN` | Service name wrong, namespace missing, DNS not propagated | `kubectl exec <pod> -- nslookup <svc>.<namespace>.svc.cluster.local` |
| `DNS SERVFAIL` | CoreDNS pod unhealthy, upstream resolver issue | `kubectl get pods -n kube-system -l k8s-app=kube-dns` |
| `TLS: certificate expired` | Cert not renewed (Let's Encrypt, cert-manager) | `openssl s_client -connect <host>:443 2>/dev/null \| openssl x509 -noout -dates` |
| `TLS: hostname mismatch` | Cert issued for different domain, SNI misconfigured | Check cert SANs: `openssl x509 -noout -text -in cert.pem` |
| `Connection refused` | Service not running, wrong port, firewall rule | `kubectl get svc`, `kubectl get endpoints` |
| `Connection timeout` | Firewall blocking, network policy, wrong security group | `traceroute`, check network policies and security groups |
| `GitHub Actions: permission denied` | Missing `permissions:` block in workflow YAML | Add `permissions: contents: read` (or required scope) to job |
| `ArgoCD: OutOfSync` | Manual cluster change not committed to Git | Commit the change to Git; never rely on manual `kubectl apply` in GitOps |
| `ArgoCD: Degraded` | Rollout unhealthy, pod not reaching Ready state | `kubectl describe rollout <name>`, check pod logs |

---

## DevOps Toolchain Quick Reference

| Category | Tool | Primary Use |
|----------|------|-------------|
| **SCM** | GitHub, GitLab, Bitbucket | Source code hosting, PR workflow, branch protection |
| **CI** | GitHub Actions, Jenkins, CircleCI, GitLab CI | Automated build, test, lint on every push |
| **CD** | ArgoCD, Flux, Spinnaker, GitHub Actions | Deploy artifacts to environments |
| **IaC** | Terraform, Pulumi, CloudFormation, Ansible | Provision and manage infrastructure as code |
| **Containers** | Docker, Podman, containerd | Build and run container images |
| **Orchestration** | Kubernetes, ECS, Nomad | Schedule and manage containers at scale |
| **Observability** | Prometheus, Grafana, Datadog, Loki, Jaeger | Metrics, dashboards, logs, traces |
| **Alerting** | PagerDuty, Opsgenie, Alertmanager | Route alerts to on-call engineers |
| **Secrets** | Vault, AWS Secrets Manager, External Secrets Operator | Store and inject secrets securely |
| **Service Mesh** | Istio, Linkerd, Cilium | mTLS, traffic management, observability between services |
| **Artifact Registry** | Nexus, JFrog Artifactory, ECR, GHCR | Store and version build artifacts and container images |
| **Package Mgmt** | npm, pip, Maven, Gradle, Helm | Manage code and infrastructure dependencies |

---

## Incident Communication Templates

Copy-paste these into your incident channel. Fill in the brackets.

### Initial Acknowledgment

```
[INVESTIGATING] [Service/Feature] — [brief symptom description]

Time: [HH:MM UTC]
Impact: [who is affected, estimated scope]
On-call: @[your name] engaged
Next update: [HH:MM UTC] or when status changes
```

Example:
```
[INVESTIGATING] Payment service — elevated 5xx error rate (~12%)

Time: 14:37 UTC
Impact: Checkout failures for ~8% of users attempting payment
On-call: @alice engaged
Next update: 14:52 UTC or when status changes
```

### Status Update

```
[UPDATE] [Service/Feature] — [current status]

Time: [HH:MM UTC]
Finding: [what you know so far]
Action: [what you are doing right now]
Next update: [HH:MM UTC]
```

Example:
```
[UPDATE] Payment service — still investigating

Time: 14:51 UTC
Finding: Errors correlate with deploy at 14:15 UTC. Rolling back now.
Action: kubectl rollout undo deployment/payment-service
Next update: 15:00 UTC or when rollback completes
```

### Resolution

```
[RESOLVED] [Service/Feature] — service restored

Time: [HH:MM UTC]
Duration: [start time] – [end time] ([X] minutes)
Impact: [final scope — users affected, error rate peak]
Cause: [one-sentence root cause]
Fix: [what was done to restore service]
Follow-up: Postmortem to be published within 48 hours. Tracking issue: [link]
```

### Postmortem Announcement

```
Postmortem published: [Incident title] — [date]

Link: [URL to postmortem doc]
Summary: [2–3 sentence summary of what happened and root cause]
Key action items:
  - [Action 1] — @[owner], due [date]
  - [Action 2] — @[owner], due [date]
  - [Action 3] — @[owner], due [date]

Questions or additions? Comment on the doc or reply here.
```

---

## Linux Host Troubleshooting Quick Reference

```bash
# Load and CPU
uptime                              # load averages (1m, 5m, 15m)
top -bn1 | head -20                 # snapshot of top processes
ps aux --sort=-%cpu | head -10      # top CPU consumers

# Memory
free -h                             # memory overview
cat /proc/meminfo | grep -E 'MemTotal|MemFree|Cached|SwapUsed'

# Disk
df -h                               # disk usage by filesystem
du -sh /var/log/*                   # log directory sizes
lsof +D /var/log | wc -l            # open file handles in /var/log

# Network
ss -tlnp                            # listening TCP ports with process
netstat -s | grep -i error          # network error counters
curl -o /dev/null -sw "%{http_code} %{time_total}s\n" http://localhost:8080/health

# Systemd services
systemctl status <service>
journalctl -u <service> --since "10 minutes ago"
journalctl -u <service> -n 100 --no-pager
```

### High Load Triage

```bash
# Is load CPU-bound or I/O-bound?
vmstat 1 5          # r = run queue, b = blocked on I/O, wa = I/O wait %

# If wa (I/O wait) is high:
iostat -x 1 5       # check %util per disk
iotop -o            # which processes are doing the I/O

# If r (run queue) is high:
pidstat -u 1 5      # per-process CPU usage over time
```

### Disk Full Response

```bash
# Find the biggest files
find /var -type f -size +100M -exec ls -lh {} \; 2>/dev/null | sort -k5 -rh | head -20

# Find and remove old logs (confirm before deleting)
find /var/log -name "*.gz" -mtime +30 -ls
find /var/log -name "*.gz" -mtime +30 -delete

# Truncate a log file without deleting it (safe for open file handles)
truncate -s 0 /var/log/myapp/app.log
```

---

## CI/CD Failure Quick Reference

### GitHub Actions

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied` on `git push` | Missing `contents: write` permission | Add `permissions: contents: write` to job |
| `Secret unavailable` | Secret not set in repo/org settings | Add secret in Settings → Secrets and variables |
| `Resource not accessible by integration` | GITHUB_TOKEN lacks scope | Add required `permissions:` block |
| Workflow not triggering | Branch protection or wrong `on:` trigger | Check `on:` filter matches the branch/event |

### ArgoCD

```bash
# Check sync status
argocd app get <app-name>
argocd app list

# Force sync (use with caution)
argocd app sync <app-name>

# Check why a rollout is degraded
kubectl describe rollout <name> -n <namespace>
kubectl argo rollouts get rollout <name> -n <namespace> --watch

# Common states
# OutOfSync  — cluster state differs from Git (manual change or drift)
# Degraded   — sync succeeded but pods are not healthy
# Progressing — rollout in progress
```

### Jenkins

| Error | Cause | Fix |
|-------|-------|-----|
| `Credential not found` | Credential ID mismatch | Check Manage Jenkins → Credentials |
| `No such DSL method` | Missing plugin | Install required plugin, restart Jenkins |
| `Agent offline` | Build agent disconnected | Check agent logs, restart agent |
| Workspace permission error | Jenkins user lacks write access | Fix directory ownership: `chown -R jenkins:jenkins /var/lib/jenkins/workspace` |

---

## SLO Burn Rate Alerts Quick Reference

Burn rate alerts fire before the error budget is exhausted. They give you time to act.

| Window | Burn Rate | Budget Consumed | Alert Severity |
|--------|-----------|----------------|----------------|
| 1 hour | 14.4x | 2% in 1h | Page (critical) |
| 6 hours | 6x | 5% in 6h | Page (critical) |
| 1 day | 3x | 10% in 1d | Ticket (warning) |
| 3 days | 1x | 10% in 3d | Ticket (info) |

```yaml
# Prometheus burn rate alert for 99.9% SLO
- alert: ErrorBudgetBurnRateHigh
  expr: |
    (
      rate(http_requests_total{status=~"5.."}[1h]) /
      rate(http_requests_total[1h])
    ) > (14.4 * 0.001)
  for: 2m
  labels:
    severity: page
  annotations:
    summary: "Error budget burning at 14.4x rate — will exhaust in ~5 days at this rate"
```
