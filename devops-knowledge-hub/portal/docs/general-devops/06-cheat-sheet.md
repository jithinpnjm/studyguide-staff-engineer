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
