---
title: "Troubleshooting"
sidebar_position: 8
---

# General DevOps — Troubleshooting

Recurring failure modes in DevOps processes and pipelines. Each section names the problem, the detection signals, and the structured recovery path. Use the senior answer template: failure domain, fastest signal, immediate mitigation, long-term prevention.

---

## 1. Flaky CI — Identification and Resolution

### What it is

A flaky test passes and fails on the same code without changes. Flaky CI is the single largest source of developer trust erosion in a CI system. When engineers stop believing CI results, they merge on red and the pipeline loses its purpose.

### Identification

Track failure rates per test, not just per pipeline run:

```bash
# GitHub Actions: list recent workflow run outcomes
gh run list --workflow=ci.yml --limit=50 --json conclusion,headSha \
  | jq '.[] | select(.conclusion == "failure") | .headSha'

# For Jenkins: use the Test Results Analyzer plugin
# For custom: export test results to a database and query failure rate by test name
```

Flakiness classification:

| Failure type | Characteristic | Root cause |
|---|---|---|
| Intermittent failure on CI, always passes locally | Environment-specific | Resource contention, timing, test ordering |
| Fails in some branches, not others | Data-specific | Test data pollution, shared state |
| Fails 1 in N runs consistently | Race condition or timing | Async operations, timeouts too tight |
| Fails after long runs | Resource leak | Memory, file handles, temp files |

### Quarantine process

Do not delete flaky tests — that removes coverage. Quarantine them.

```yaml
# pytest: mark flaky tests — run separately, do not block CI
@pytest.mark.flaky(reruns=3, reruns_delay=2)
def test_async_webhook_delivery():
    ...
```

```bash
# Run quarantined tests in a separate non-blocking job
# CI pipeline structure:
# Job 1: core-tests (blocks merge)
# Job 2: quarantine-tests (reports only, never blocks)
```

Quarantine workflow:
1. Engineer reports test as flaky — creates ticket with failure evidence (3+ failed runs on unchanged code)
2. Test is moved to quarantine suite within 24 hours
3. Quarantine ticket is assigned and must be resolved within 2 sprints
4. If not fixed within 2 sprints, escalate to tech lead

### Root cause patterns

**Test isolation failure:** Tests share state through a database, filesystem, or global variable. Fix with test isolation (unique test databases per test run, temp directories, teardown hooks).

**Resource contention:** CI runners are undersized — tests time out waiting for CPU or memory. Fix by right-sizing runners or parallelizing across more runners.

**Timing dependencies:** Tests use `sleep(N)` or hard-coded timeouts. Fix with polling and explicit wait conditions:

```python
# Bad: brittle sleep
time.sleep(5)
assert service.is_ready()

# Good: poll with timeout
import time
deadline = time.time() + 30
while time.time() < deadline:
    if service.is_ready():
        break
    time.sleep(0.5)
else:
    pytest.fail("Service did not become ready within 30s")
```

**Test ordering dependency:** Tests depend on side effects from previous tests. Fix by running tests in random order (`pytest-randomly`) to surface ordering dependencies.

---

## 2. Merge Conflict Storm at Scale

### What it is

Multiple long-lived feature branches diverge significantly from main. When teams attempt to merge, they encounter large, complex conflicts. The resolution process takes longer than the feature development itself and introduces regressions.

### Root cause

Long-lived branches are the primary cause. Any branch that lives more than 2–3 days will accumulate drift. At scale (10+ engineers on a shared codebase), this drift compounds into a conflict storm.

### Trunk-based development as the fix

Trunk-based development (TBD) requires:
- All engineers commit directly to main (or use branches that live less than 24 hours)
- No long-lived feature branches
- Features that are not ready for users are hidden behind feature flags, not withheld in a branch

TBD branch lifetime rule: if a branch is more than 2 days old and cannot be merged today, something is wrong — either the scope is too large, or the feature needs a flag.

### Feature flags as an alternative to long-lived branches

```python
# LaunchDarkly / homegrown feature flag check
from flags import is_enabled

def get_recommendations(user_id):
    if is_enabled("new-recommendation-algorithm", user_id):
        return _new_recommendations(user_id)
    return _legacy_recommendations(user_id)
```

With this pattern:
- Code merges to main immediately (no drift)
- Feature is invisible to users until the flag is enabled
- The flag can be enabled for internal users only, then for 1%, then for 100%
- If the feature causes problems, the flag is turned off — faster than a rollback

### Conflict resolution workflow (when you are already in a storm)

When a conflict storm is in progress:

```bash
# Identify the most diverged branches first
git log main..feature-branch --oneline | wc -l   # commits behind main
git diff main...feature-branch --stat             # files changed

# Resolution order: merge the smallest, most isolated branches first
# Establish a merge schedule: one team merges per 2-hour slot to reduce simultaneous conflicts

# Post-merge validation
git log --merges --since="24 hours ago" --oneline
# Run the full test suite after every branch merge — do not batch merge
```

---

## 3. Deployment Pipeline Bottleneck

### What it is

The pipeline takes too long, blocking delivery. Engineers batch changes to avoid waiting, increasing blast radius. Feedback on broken code is delayed. Lead time for changes rises.

### Pipeline stage analysis

Map every stage and its duration:

```
Stage             Duration    Parallelisable?
──────────────────────────────────────────────
checkout          30s         No
install deps      3m 10s      Partially (cache)
lint              45s         Yes
unit tests        4m 30s      Yes (sharding)
build image       6m 00s      No (but cacheable)
push image        1m 30s      No
integration tests 12m 00s     Yes (split suites)
security scan     3m 00s      Yes (parallel to int tests)
deploy to staging 2m 00s      No
e2e tests         18m 00s     Yes (browser sharding)
──────────────────────────────────────────────
TOTAL SERIAL:     51m 25s
```

The goal is to find the critical path (the longest chain that cannot be parallelized) and reduce it.

### Parallelization strategies

```yaml
# GitHub Actions: parallel test jobs
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/unit/ -n auto   # pytest-xdist parallel

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/integration/ -n 4

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - run: trivy image $IMAGE

  # All three run simultaneously; build only proceeds after all pass
  build:
    needs: [unit-tests, integration-tests, security-scan]
    ...
```

### Caching strategies

```yaml
# GitHub Actions: dependency caching
- uses: actions/cache@v3
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-

# Docker layer caching via registry
- uses: docker/build-push-action@v5
  with:
    cache-from: type=registry,ref=myrepo/myapp:buildcache
    cache-to: type=registry,ref=myrepo/myapp:buildcache,mode=max
```

**Rule of thumb for pipeline targets:**

| Stage | Target |
|---|---|
| Lint + unit tests | < 5 minutes |
| Build + push image | < 3 minutes |
| Integration tests | < 10 minutes |
| End-to-end tests | < 15 minutes |
| Total pipeline (critical path) | < 20 minutes |

If the pipeline exceeds 20 minutes, engineers stop running it locally and stop treating results as fast feedback.

---

## 4. On-Call Burnout

### What it is

Engineers on the on-call rotation are paged too frequently, sleep is disrupted, and engineers begin to dread the rotation. Burnout follows: two states — engineers leave the rotation, or engineers leave the company.

### Measurement

Track these metrics per engineer per week:

| Metric | Healthy | Warning | Critical |
|---|---|---|---|
| Pages per engineer per week | < 5 | 5–10 | > 10 |
| Out-of-hours pages (nights/weekends) | < 2 | 2–5 | > 5 |
| MTTR (average) | < 30 min | 30–60 min | > 60 min |
| On-call rotation size | > 6 people | 4–5 people | < 4 people |
| Time spent on toil per week | < 20% | 20–40% | > 40% |

### Toil reduction playbook

Toil is operational work that is manual, repetitive, automatable, and does not produce lasting value.

Step 1: Categorize last 30 days of pages into:
- Actionable incidents (real problems requiring engineering judgment)
- Toil incidents (same fix every time — can be automated)
- Noise (resolved on its own before action was taken)

Step 2: For each toil incident, write the automation before writing a runbook. A runbook is not the goal — zero pages for that class of event is the goal.

Step 3: For noise incidents, raise the threshold or remove the alert.

```
Example toil reduction:
  Alert: "Disk usage > 80%" → engineer runs log rotation → disk drops to 60%
  
  Toil fix: automate log rotation on threshold
  cron: "0 2 * * * /usr/local/bin/rotate-logs.sh"  # runs nightly
  
  Better fix: structured log retention policy so disk never reaches 80% without abnormal growth
  Better alert: alert on abnormal disk growth rate, not absolute threshold
```

### Rotation health metrics

A healthy on-call rotation has:
- Minimum 6 engineers in the pool (so each engineer is on-call 1 week in 6)
- Primary + secondary coverage (secondary takes over when primary does not acknowledge within 5 minutes)
- On-call period no longer than 1 week
- Post-rotation retrospective after every on-call week — what was toil, what was signal?
- New engineers shadowing before going on primary call

---

## 5. Alert Fatigue

### What it is

The monitoring system produces so many alerts that engineers stop trusting them. Real incidents are missed because they are buried in noise. This is a design failure, not a people failure.

### Alert audit process

Run a full alert audit quarterly. For every alert:

```
Questions to answer for each alert:
1. What action does this alert require from the engineer?
   → If "check and wait", the alert is not actionable. Delete or lower to ticket severity.
2. What is the P50 time to resolution for this alert?
   → If > 30 minutes: the alert lacks a clear runbook.
3. How often does this alert resolve before the engineer takes action?
   → If > 30% of the time: the threshold is too sensitive.
4. Does this alert have a linked runbook?
   → If no: add one before the next week's on-call shift.
5. How many other alerts fire simultaneously with this alert?
   → If > 3: alert grouping or suppression is needed.
```

### Actionability criteria

An alert should only fire if ALL of the following are true:
- The situation requires a human decision (not a script)
- The situation cannot wait until business hours (if it can, use a ticket or a morning report)
- There is a specific action the engineer should take (documented in a linked runbook)
- The alert has been confirmed to be a true positive (not a transient spike)

### Alert classification

| Classification | Examples | Delivery |
|---|---|---|
| Page (immediate response) | Service down, error rate > SLO burn rate | PagerDuty with escalation |
| Ticket (next business day) | Disk at 75%, certificate expires in 30 days | JIRA / Linear ticket auto-created |
| Dashboard only | Cache hit rate dropping gradually | Visible in Grafana; no notification |
| Informational | Deployment completed | Slack message, no action required |

### Runbook linkage requirement

Every page-level alert must have a runbook linked in the alert definition:

```yaml
# Prometheus alert with runbook annotation
- alert: ServiceHighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 5m
  annotations:
    summary: "{{ $labels.service }} error rate above 5%"
    runbook_url: "https://runbooks.internal/service-high-error-rate"
    description: "Error rate is {{ $value | humanizePercentage }}. Check recent deploys first."
```

---

## 6. Technical Debt Sprint

### What it is

Technical debt has accumulated to the point where it materially slows feature delivery or causes recurring incidents. A structured debt paydown sprint is needed.

### Identification

Debt signals to track continuously:

| Signal | Source |
|---|---|
| Services causing > 20% of incidents | PagerDuty / incident tracker |
| Files with > 10 reverts in 90 days | `git log --all --grep="revert" --oneline` |
| Test coverage below 50% on critical paths | Coverage report |
| Dependency versions > 12 months old | `npm outdated`, `pip list --outdated` |
| Build time increasing month-over-month | CI metrics |
| Developer surveys mentioning specific areas | SPACE survey, retros |

### Prioritization with RICE scoring

RICE: Reach × Impact × Confidence ÷ Effort

```
Reach:      How many engineers or services does this debt affect? (1–10)
Impact:     How much does it slow delivery or cause incidents? (1–10)  
Confidence: How certain are you of the estimate? (0.5–1.0)
Effort:     Engineering weeks to resolve (1–20)

RICE score = (Reach × Impact × Confidence) / Effort

Higher score = higher priority.
```

Example:

| Debt item | Reach | Impact | Confidence | Effort | RICE |
|---|---|---|---|---|---|
| Auth service Python 2 migration | 3 | 9 | 0.8 | 6 | 3.6 |
| Shared test database (flaky tests) | 8 | 7 | 0.9 | 4 | 12.6 |
| Manual deploy process (no ArgoCD) | 5 | 8 | 0.7 | 8 | 3.5 |

Highest RICE score gets the first sprint.

### Getting buy-in

Connect debt to business language:

- Incident cost: "This service caused 8 P1 incidents in Q3. Each incident averaged 4 engineer-hours. That is 32 engineer-hours of reactive work — nearly one engineer-week lost."
- Feature velocity: "Engineers estimate each feature in this area takes 2× longer than similar features in other services due to the test and deployment debt."
- Risk: "The dependency is end-of-life. Security patches no longer exist. The next CVE could require an emergency migration."

### Measuring paydown

Before the sprint, baseline:
- Incident rate for the target service
- PR cycle time for changes in the target area
- Test flakiness rate if relevant

After the sprint, measure the same metrics for 30 days. Report the delta.

---

## 7. DORA Metrics Regression

### What it is

One or more DORA metrics deteriorate after a change — an infrastructure migration, a process change, a new team, or an organizational restructure.

### Investigation framework

When deployment frequency drops or lead time increases:

```
Step 1: Identify when the regression started
  - Chart DORA metrics over time (weekly granularity)
  - Identify the inflection point date

Step 2: Identify what changed near that date
  - New CI/CD tooling or config changes
  - Organizational changes (team splits, new approval processes)
  - New compliance or security requirements added
  - Major codebase changes (monorepo split, large refactor)

Step 3: Map the value stream
  Code review time → CI time → Staging wait → Approval → Production deploy
  
  Measure each stage separately. The bottleneck will be obvious.

Step 4: Quantify the regression
  - Deployment frequency: from X/week to Y/week — what is the delta?
  - Lead time: from X hours to Y hours — which stage grew?
```

### DORA regression patterns and fixes

| Symptom | Likely cause | Investigation |
|---|---|---|
| Deployment frequency dropped | Batching (changes waiting for approval) | Check approval queue depth and time |
| Lead time increased | New stage added to pipeline | Map each pipeline stage duration |
| Change failure rate increased | Test coverage gaps in new code | Correlate failures with recently changed files |
| MTTR increased | Observability gaps, poor runbooks | Check time-to-detect vs time-to-fix split |

### Deployment frequency diagnostic

```bash
# Count production deployments per week from Git tags or deployment events
git log --tags --simplify-by-decoration --pretty="format:%d %ai" | \
  grep -E "v[0-9]+\.[0-9]+\.[0-9]+" | \
  awk '{print $NF}' | cut -c1-10 | sort | uniq -c
```

### Lead time diagnostic

```bash
# For a given PR, calculate commit-to-production time
# Requires deployment events logged with commit SHA

# Simple version: measure PR merge to deploy time
# From GitHub Actions workflow_run events or deployment API
gh api repos/ORG/REPO/deployments --jq '.[].created_at' | head -20
```

---

## 8. Postmortem Culture Not Sticking

### What it is

Postmortems are written but not read, action items are not completed, patterns are not identified across incidents, and the same classes of failure recur. The postmortem process becomes a compliance exercise rather than a learning system.

### Blameless culture signals

A blameless postmortem names systems and processes, not people. Check these signals:

- Do postmortems use language like "the engineer should have" or "engineer X failed to"? (blame signals)
- Are postmortems written by the person who was on-call, under pressure to defend decisions?
- Are action items assigned to individuals who made mistakes, rather than to systems that need fixing?
- Do engineers fear being on-call during incidents because of how postmortems are used?

Blameless replacements for common blame language:

| Blame language | Blameless replacement |
|---|---|
| "Engineer should have checked X" | "The runbook did not include a step for checking X" |
| "Developer merged without testing" | "The CI pipeline did not catch this class of failure" |
| "On-call didn't escalate in time" | "The escalation criteria were not defined in the runbook" |

### Postmortem quality checklist

A postmortem is complete when it has:

```
[ ] Timeline: events in chronological order, with timestamps (not vague "early in the incident")
[ ] User impact: how many users, what they experienced, for how long
[ ] Root cause: the technical mechanism that caused the failure
[ ] Contributing factors: the conditions that made the failure possible (these are the action items)
[ ] What went well: what slowed or contained the damage?
[ ] Action items: each has an owner, a due date, and is a system/process change (not "be more careful")
[ ] MTTR: detection time + response time + resolution time, measured separately
[ ] Reviewed by: at least one person not involved in the incident
```

### Follow-up tracking

Postmortem action items fail because there is no system to track them.

```
Minimum viable tracking:
1. Every action item is a ticket in the team's backlog — not a note in a document
2. Action items appear in the next sprint planning
3. Postmortem owner reviews open action items 30 days after the incident
4. Quarterly review: how many postmortem action items from the previous quarter are complete?

Better tracking:
- Incident tracker (FireHydrant, Blameless, or similar) links postmortems to action item tickets
- Automated reminder to postmortem owner when action items are > 30 days old and unresolved
- Monthly metric: postmortem action item completion rate (target: > 80% within 30 days)
```

---

## 9. Feature Flag Sprawl

### What it is

Feature flags accumulate over time. Old flags that were used for a launch are never cleaned up. The codebase contains code paths that are conditionally executed based on flags that have been 100% on or 100% off for months. Engineers are afraid to remove them. New engineers do not know which flags are active.

### Stale flag detection

A flag is stale if:
- It has been at 100% (fully on) for more than 30 days
- It has been at 0% (fully off) for more than 14 days with no active plan to enable it
- The feature it controls has been in production for more than 2 release cycles

```bash
# LaunchDarkly API: find flags that haven't changed in 90 days
curl -X GET "https://app.launchdarkly.com/api/v2/flags/PROJECT_KEY" \
  -H "Authorization: $LD_API_KEY" \
  | jq '.items[] | select(.creationDate < (now - 7776000) * 1000) | .key'

# For homegrown flag systems: query flag evaluation table
SELECT flag_key, MAX(evaluated_at) as last_evaluated
FROM flag_evaluations
GROUP BY flag_key
HAVING MAX(evaluated_at) < NOW() - INTERVAL '90 days';
```

### Cleanup process

```
Flag lifecycle states:
  Active (being tested) → Rolled out (100% on, monitoring) → Deprecated (scheduled for removal) → Removed

Cleanup workflow:
1. Automated weekly report: flags at 100% > 30 days, flags at 0% > 14 days
2. Report goes to flag owners (from flag metadata)
3. Owner has 1 week to either: (a) schedule removal, (b) document why the flag must stay
4. Flags with no response in 1 week are escalated to tech lead
5. Removal PR template: remove flag check, remove old code path, update tests
```

### Flag lifecycle policy

Define these rules and enforce them at flag creation time:

| Flag type | Maximum lifetime | Removal trigger |
|---|---|---|
| Release flag (gradual rollout) | 30 days from 100% rollout | 30 days at 100% |
| Experiment flag (A/B test) | 90 days | Experiment concluded |
| Ops flag (kill switch) | Indefinite | Deprecated with feature |
| Permission flag (user entitlement) | Indefinite | Feature removed |

---

## 10. Engineering Productivity Decline

### What it is

Engineering output — measured as delivered features, deployments, or DORA metrics — declines without a clear technical cause. The cause is usually systemic: build time increases, test flakiness grows, toil accumulates, or context switching from incidents dominates engineering time.

### Signal detection

Track these signals with monthly granularity:

| Signal | How to measure | Regression threshold |
|---|---|---|
| P50 CI build time | CI metrics per week | > 20% increase month-over-month |
| Test flakiness rate | Failed runs / total runs per week | > 5% of CI runs affected |
| Toil ratio (% of time on non-feature work) | Eng survey or ticket categorisation | > 30% |
| Deployment frequency | DORA — deploys to production per week | > 20% decrease |
| PR cycle time | PR opened to merged, P50 | > 20% increase |
| On-call pages per engineer per week | PagerDuty export | > 10/week |

Track all six signals on the same dashboard. Productivity decline rarely has one cause — it is usually 3–4 signals degrading simultaneously.

### Intervention playbook

For each signal that is regressing:

**Build times increasing:**
```
1. Profile the slowest pipeline stages (wall clock time per stage, trend over 90 days)
2. Add dependency caching if not present
3. Parallelize test stages
4. Audit for steps that have been added without corresponding removal
5. Target: build time back to baseline within 1 sprint
```

**Test flakiness increasing:**
```
1. Generate a flakiness report: which tests fail intermittently?
2. Quarantine top-5 flaky tests within 1 week
3. Assign ownership — each quarantined test gets an owner and a 2-sprint deadline
4. Root cause: test isolation, timing, or resource contention (see Section 1)
```

**Toil ratio too high:**
```
1. Run a 2-week time tracking exercise — categorise all engineering work
   Categories: feature, quality, reliability, toil, planning, meetings
2. Identify the top 3 toil sources
3. Sprint dedicated to automating or eliminating top toil source
4. Re-measure toil ratio after 4 weeks
```

**PR cycle time increasing:**
```
1. Split into components: time waiting for review vs time waiting for CI vs time waiting for approval
2. If review time: reduce WIP (fewer simultaneous open PRs), add review queue SLA
3. If CI time: pipeline optimization (see Section 3)
4. If approval time: replace synchronous approvals with async comment-period reviews
```

After any intervention, recheck the signal metric after 30 days. Productivity improvements are only real if they sustain — a one-week improvement followed by regression means the root cause was not addressed.

---

## 11. "Works In Dev, Fails In Production"

### What it is

A service passes all tests in staging but fails or behaves incorrectly in production. This is one of the most common and most frustrating DevOps failure classes.

### Systematic investigation

The pattern "works in dev, fails in prod" always points to a difference between environments. Map the differences before touching code.

```
Environment diff checklist:
  [ ] Environment variables — different values, missing entirely?
  [ ] Secrets — same names but different values? Missing in prod namespace?
  [ ] Resource limits — prod has tighter CPU/memory limits than dev?
  [ ] NetworkPolicy — prod has default-deny not present in dev?
  [ ] Database — prod has a different schema version, or different data volume?
  [ ] Image tag — same tag, but the image was rebuilt? (mutable tag problem)
  [ ] Architecture — amd64 image on arm64 nodes?
  [ ] Config files — mounted from different ConfigMaps?
  [ ] TLS — prod uses mutual TLS, dev does not?
  [ ] External dependencies — prod hits real payment provider (5s latency); dev hits a mock (0ms)
```

### Most common causes

| Pattern | Cause | Fix |
|---------|-------|-----|
| Missing env var in prod | Secret or ConfigMap not created in prod namespace | Audit env vars during deploy; validate at startup |
| Stricter NetworkPolicy in prod | Dev allows all egress; prod has default-deny | Test with prod-equivalent NetworkPolicy in staging |
| Different resource limits | Dev has no limits; prod has 256Mi — OOMKilled on first load spike | Set prod-equivalent limits in staging |
| Mutable image tag | `myapp:latest` rebuilt between staging and prod deploy | Always deploy with immutable tags or digest pins |
| Env-specific config mismatch | App reads `APP_ENV=production` and branches on it — branch not tested | Test the production branch in staging |

### Prevention

- **Environment parity**: staging should have the same NetworkPolicy, resource limits, secrets structure, and config shapes as production. Not necessarily the same data volume — but the same policy posture.
- **Smoke tests** after every deploy (not just before): verify the key user journey in prod immediately after deployment completes.
- **Startup validation**: apps should crash fast at startup if required env vars are missing, rather than failing silently at runtime.

---

## 12. Users Cannot Log In After a Deploy or Infrastructure Change

### What it is

Authentication fails for all or a subset of users. Login endpoints return errors. This often appears as a spike in 401/403 errors or user-facing "Session expired" / "Unable to authenticate" messages.

### Rapid triage

```bash
# Is the auth service healthy?
kubectl get pods -n auth
kubectl logs -n auth deploy/auth-service --since=10m

# Is the IdP reachable?
curl -vk https://your-idp.com/.well-known/openid-configuration

# Check clock skew (JWT tokens are time-sensitive)
date && curl -sk https://your-idp.com/time
timedatectl status   # on affected nodes

# Check certificate validity
echo | openssl s_client -connect your-idp.com:443 2>/dev/null | openssl x509 -noout -dates

# Check OIDC secret/client credentials in Kubernetes
kubectl get secret oidc-credentials -n auth -o yaml
kubectl describe pod -n auth -l app=auth-service | grep -A 5 "Environment"
```

### Common causes

| Cause | Detection | Fix |
|-------|-----------|-----|
| OIDC client secret rotated at IdP but not updated in cluster | Auth service logs: `invalid_client` or `unauthorized_client` | Update the Kubernetes secret, restart auth pod |
| TLS cert expired on IdP endpoint | `openssl` shows `notAfter` in past | Renew cert; check cert-manager status |
| Clock skew between cluster and IdP | JWT validation fails (iat/exp claims reject) | Sync NTP: `chronyc makestep` or restart `systemd-timesyncd` |
| DNS failure to reach IdP | `curl -v` to IdP hangs or NXDOMAIN | Fix DNS; check CoreDNS; check NetworkPolicy |
| OIDC `/.well-known/openid-configuration` URL changed | Auth service cannot discover endpoints | Update the OIDC issuer URL in config |
| New deploy changed redirect URI | IdP rejects login callback | Add new redirect URI to IdP application settings |

### Clock skew note

JWT tokens include `iat` (issued at) and `exp` (expiry). If the cluster clock is ahead of the IdP clock by more than the JWT's tolerance (often 5 minutes), all tokens fail validation — even freshly issued ones.

```bash
# Quick check on every control-plane and worker node
for node in $(kubectl get nodes -o name); do
  kubectl debug node/${node##*/} -it --image=busybox -- date
done
```

**Prevention:** Enable NTP synchronization via `chronyd` or `systemd-timesyncd` on all nodes. Monitor for clock drift with a Prometheus alert:

```promql
abs(node_time_seconds - time()) > 60
```
