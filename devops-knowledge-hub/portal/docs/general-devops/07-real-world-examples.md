---
title: "Real-World Examples"
sidebar_position: 7
---

# General DevOps — Real-World Examples

These scenarios are drawn from common patterns in production engineering. Each one is structured as a situation, the decision-making process, and the outcome with lessons learned.

---

## Scenario 1: Production Incident Postmortem — SDK Timeout Regression

**Situation:** The checkout service began showing a 15% error rate at 14:32 UTC on a Thursday. The on-call engineer was paged by the payment error rate alert. The service had been deployed 20 minutes earlier.

**What happened during the incident:**

1. On-call acknowledged within 4 minutes
2. First check: `kubectl logs deployment/checkout --since=30m` showed timeout errors against the payment provider
3. `git log --oneline production..HEAD` showed one change: payment SDK v3.2.0 → v3.3.0
4. Review of v3.3.0 changelog: default timeout changed from 30s to 5s
5. The payment provider's P99 latency is 8–12s — the new default was too aggressive
6. Rollback to previous image tag: `kubectl set image deployment/checkout app=myrepo/checkout:v1.4.2-prev`
7. Error rate recovered within 3 minutes of rollback
8. Total duration: 42 minutes

**Postmortem excerpt:**

Root cause: Third-party SDK updated default timeout from 30s to 5s without a major version bump. The payment provider P99 latency regularly reaches 8–12s, causing systematic timeout failures under the new default.

Contributing factors:
- CI pipeline used mocked payment calls, not real integration tests against the payment provider
- SDK changelog was not reviewed as part of dependency update PR
- No alert on per-dependency success rate (only overall error rate)

Action items:
- Add real integration test against payment staging API in CI — @alice, due in 10 days
- Add automatic changelog review to dependency bump PRs — @bob, due in 7 days
- Add per-provider error rate dashboard — @carol, due in 14 days
- Set timeout configuration explicitly (not relying on SDK defaults) — @dave, due in 5 days

**Lesson:** Never rely on SDK defaults for latency-sensitive operations. Always configure timeouts explicitly and test against real dependency behaviour in staging.

---

## Scenario 2: Technical Debt Paydown Strategy

**Situation:** The authentication service was 4 years old, written in Python 2 (EOL), running with a shared database that also served the user profile service. Any change to the auth service required coordination with the profile team. The service generated 40% of all P1 incidents in Q3.

**The challenge:** Product demanded 3 major features from the auth service in Q4. The team estimated 12 weeks of work. The tech debt — Python 2, shared database, no test coverage — meant every feature PR caused a week of firefighting.

**Decision-making process:**

The staff engineer ran a quantified debt analysis:
- P1 incidents involving auth: 8 of 20 total in Q3
- Average incident cost (MTTR × engineers): 6 engineer-hours per incident × 8 incidents = 48 engineer-hours of reactive work
- Estimate for debt paydown: 6 weeks (Python 3 migration, test coverage to 70%, separate database)
- Estimate for features without paydown: 12 weeks + ongoing incident overhead

**Proposal to management:**

"Q3 incident data shows the auth service is our most expensive reliability liability: 40% of P1 incidents, 48 engineer-hours of reactive work. Attempting to deliver Q4 features without addressing the foundation will produce: 14–16 weeks actual delivery time (feature work + ongoing fires), continued incident load, and increasing fragility as we add complexity.

Proposed: 6 weeks of focused debt reduction (Python 3, test coverage, database decoupling), followed by 8 weeks of feature delivery. Net result: faster feature delivery in Q4, 70%+ reduction in auth incidents, and a stable foundation for the roadmap."

**Outcome:** Management approved the 6-week paydown. Auth incidents dropped by 65% in Q4. Feature delivery completed in 7 weeks (ahead of estimate). The investment paid back within one quarter.

**Lesson:** Connect technical debt to incident data and developer hours lost. Abstract arguments about "code quality" lose. Data about incident cost wins.

---

## Scenario 3: New Team Onboarding — Production Readiness in 6 Weeks

**Situation:** A newly formed team (4 engineers) was tasked with building and operating a new recommendation service from scratch. The service needed to be in production within 3 months.

**The problem:** The team had no experience with the company's deployment platform, monitoring stack, or on-call processes. Putting them on-call after 2 months of development would be setting them up for a painful first year.

**Staff engineer's onboarding plan:**

Week 1–2: Platform familiarity
- Shadow the on-call engineer for one week
- Run through the Production Readiness Review checklist without building anything
- Deploy the service template (golden path) to the dev environment

Week 3–4: Observability and alerting
- Define 2 SLOs for the recommendation service (availability + latency)
- Build a Grafana dashboard with the four golden signals
- Write a runbook for the most likely failure modes

Week 5–6: Chaos and confidence
- Run a game day: inject a failure into the staging environment, let the team respond
- Debrief: what did they discover about alert coverage, runbook gaps, and escalation?
- Fix gaps before production go-live

**Production go-live conditions:**
- [ ] Runbook reviewed by another team member (not the author)
- [ ] Game day completed with documented gaps closed
- [ ] SLOs defined with error budget alerts
- [ ] On-call rotation covers all team members (no single person dependency)
- [ ] Rollback procedure tested (not just documented)

**Outcome:** The recommendation service went live on week 10 (slightly ahead of the 12-week target). The team handled their first real incident in week 12 independently, using the runbook they had written. MTTR: 18 minutes.

**Lesson:** Investing in operational readiness before go-live pays dividends. A team that understands how to run their service will outperform one that learned under fire.

---

## Scenario 4: DORA Metrics Regression After Major Refactor

**Situation:** A platform team spent 6 weeks refactoring the CI/CD pipeline from Jenkins to GitHub Actions. The migration went smoothly, but 4 weeks later, the DORA metrics showed:
- Deployment frequency: down 40% (from 3.5/week to 2.1/week)
- Lead time: up 200% (from 4 hours to 12 hours)
- Change failure rate: unchanged at 8%
- MTTR: unchanged at 45 minutes

**Investigation:**

The staff engineer mapped the value stream:

```
Code review time: unchanged (2 hours average)
CI runtime: 45 minutes -> 38 minutes (improved)
Wait for staging: 30 minutes -> 4 hours (REGRESSION)
Deployment to production: 15 minutes -> 12 minutes (improved)
```

Root cause: The GitHub Actions pipeline ran integration tests in staging sequentially across 3 services. Jenkins had a parallel execution setup that was not replicated in the migration. Staging became a bottleneck — only one service could use it at a time.

**Fix:** Implemented parallel staging slots using Kubernetes namespaces (one namespace per PR for integration testing). Lead time returned to 3.8 hours within 2 weeks.

**Lesson:** Always baseline DORA metrics before and after infrastructure changes. A "smooth migration" can hide operational regressions that only show up in aggregate data after several weeks.

---

## Scenario 5: Alert Fatigue and On-Call Burnout

**Situation:** The platform team's on-call rotation was covering 8–12 pages per night shift. Engineers were burning out. Two engineers requested to be removed from the rotation entirely.

**Analysis:**

The staff engineer audited 90 days of PagerDuty data:
- Total pages: 340
- Pages requiring action: 62 (18%)
- Pages that resolved on their own: 178 (52%)
- Pages that fired for transient spikes under 5 minutes: 100 (30%)

**The three categories of noise:**

1. **Self-healing events**: 5xx rate spikes that resolved before the engineer could even look at them. Alert threshold was too sensitive (any spike >1% for 1 minute). Fix: raise threshold to 2% for 5 minutes continuous.

2. **Non-actionable alerts**: Disk usage at 80% alert that fired nightly. No action was needed until 95%. Fix: raise threshold, change to ticket-severity instead of page.

3. **Duplicate alerts**: CPU alert + memory alert + pod restart alert all fired simultaneously for the same root cause. Fix: alert suppression (silence child alerts when parent fires).

**Outcome:** Pages dropped from 8–12/night to 1–3/night within 3 weeks. Two engineers re-joined the rotation. MTTR for real incidents dropped by 30% — engineers were rested and responsive.

**Lesson:** Alert fatigue is a system design problem, not a people problem. High page volume reduces response quality for real incidents. Audit alert quality quarterly.

---

## Scenario 6: Canary Deployment that Prevented a P1

**Situation:** A team was deploying a new version of the search service with a rewritten ranking algorithm. The new algorithm had performed well in offline testing but had not been validated against live traffic patterns.

**Setup:**
- Canary: 5% of traffic routed to new version
- Metrics-based rollback: if error rate >1% or P99 latency >500ms for 5 minutes, auto-rollback
- Monitoring dashboard open during rollout

**What happened:**
At minute 8 of the canary, the P99 latency for the new version climbed to 620ms. The automated rollback triggered, routing 100% of traffic back to the stable version. Total users affected by degraded performance: approximately 3,000 (5% of 60,000 active users during the window).

**Without a canary**, all 60,000 users would have experienced the latency degradation. Given the team's typical MTTR of 35 minutes, that would have been a P1 incident.

**Root cause found after rollback:** The new ranking algorithm made N+1 database queries for certain query patterns that were common in production but rare in the offline test dataset.

Fix: query batching added to the new algorithm. Canary re-run 3 days later with zero latency regression. Full rollout completed.

**Lesson:** Canary deployments require pre-defined rollback criteria, not just monitoring. "We will watch it" is not a rollback plan. "If P99 >500ms for 5 minutes, rollback automatically" is.

---

## Scenario 7: GitOps Rollback Reverting a Manual Hotfix

**Situation:** A production outage was caused by a misconfigured nginx ingress. The on-call engineer SSHed into the cluster and manually applied a corrected ingress configuration. The outage resolved.

Twenty minutes later, ArgoCD reconciliation ran. It detected that the cluster state differed from the Git state (the manually applied change was not in Git). ArgoCD reverted the cluster to the Git state. The outage returned.

**The missed step:**

After manually fixing the cluster, the engineer did not commit the fix to Git. The GitOps controller interpreted the "fix" as drift and corrected it back to the "desired" (but broken) state in Git.

**The right procedure:**

```bash
# Step 1: Emergency manual fix to stop the bleeding
kubectl apply -f corrected-ingress.yaml

# Step 2: Immediately commit the fix to Git
git checkout -b hotfix/ingress-timeout-prod
# Make the same change to the Git manifest
git add k8s/ingress/nginx-ingress.yaml
git commit -m "hotfix: increase ingress timeout to 60s (emergency, production)"
git push origin hotfix/ingress-timeout-prod
# Open PR + merge quickly (or push directly to main in true emergency with post-PR)

# Step 3: Confirm ArgoCD shows Synced, not OutOfSync
argocd app get myapp-production
```

**Lesson:** In GitOps environments, emergency runbooks must include "commit the change to Git" as a mandatory step. Manual cluster changes are temporary by design. The controller is doing its job when it reverts them.

---

## Scenario 8: Technical Debt Accumulation from Sprint Pressure

**Situation:** During a 3-month push to ship a major product launch, the team skipped writing tests for new payment flows, used hardcoded configuration instead of environment variables, and did not add observability for the new components.

Post-launch, incidents increased immediately. Three incidents in the first 4 weeks were traced to the payment flows launched without tests. Configuration drift between environments caused two deployments to fail.

**Staff engineer's post-launch retro:**

"We took on three categories of debt:
1. Missing test coverage (caused 3 P1 incidents = ~24 engineer-hours reactive work)
2. Hardcoded config (caused 2 deployment failures = ~8 engineer-hours)
3. Missing observability (increased MTTR by 45 minutes per incident)

The time "saved" by skipping tests was approximately 20 engineer-days during the launch. The time cost in incidents and debug work in the first month post-launch exceeded 40 engineer-days. We made the wrong trade."

**Action plan:**
- Two-sprint debt paydown: test coverage for all payment flows, config externalisation
- New definition of done: no merge without tests, no merge without observability
- Retrospective process added: pre-launch readiness review with explicit debt tracking

**Lesson:** Technical shortcuts taken under time pressure must be tracked explicitly at the time they are made. "We will deal with it later" becomes "we cannot find it later." Debt taken knowingly and tracked is manageable. Debt taken and forgotten compounds silently.

---

## Scenario 9: CI/CD Pipeline Failure During Release

**Situation:** A team was mid-release for a high-priority feature on a Friday afternoon. The CI/CD pipeline passed all tests and reached the production deploy step — then failed with a Helm upgrade error. The new version was partially deployed: 3 of 10 pods were running the new image, 7 were still on the old version.

```
Error: UPGRADE FAILED: cannot patch "payment-service" with kind Deployment:
Deployment.apps "payment-service" is invalid: spec.selector: Invalid value:
v1.LabelSelector{...}: field is immutable
```

**The decision: rollback vs fix-forward**

The on-call engineer and the release owner had to decide within 10 minutes. The framework they used:

| Factor | Rollback | Fix-Forward |
|--------|----------|-------------|
| Is the service currently degraded? | Yes → rollback | No → fix-forward is safer |
| Do you understand the root cause? | No → rollback | Yes → fix-forward is viable |
| Is the fix simple and low-risk? | No → rollback | Yes → fix-forward |
| Is it a Friday afternoon? | Yes → rollback | — |
| Is there a hard deadline to ship? | No → rollback | Yes → weigh carefully |

In this case: service was partially degraded (mixed versions), root cause was not immediately understood, and it was Friday. Decision: rollback.

```bash
# Rollback the Helm release to the previous revision
helm rollback payment-service 0   # 0 = previous revision

# Verify all pods are back on the old version
kubectl rollout status deployment/payment-service
kubectl get pods -l app=payment-service -o jsonpath='{.items[*].spec.containers[0].image}'
```

**Root cause (found after rollback):** A developer had changed a label selector in the Deployment spec. Kubernetes label selectors are immutable — you cannot patch them in place. The fix required deleting and recreating the Deployment, not a rolling update.

**Fix-forward procedure (applied Monday):**

```bash
# Delete the existing deployment (pods will be rescheduled)
kubectl delete deployment payment-service

# Apply the new manifest with the updated selector
kubectl apply -f payment-service-deployment.yaml

# Watch the rollout
kubectl rollout status deployment/payment-service
```

**Process improvement:** The team added a pre-deploy validation step to CI that runs `helm diff` and flags immutable field changes before the deploy step runs.

**Lesson:** The rollback-vs-fix-forward decision should be made with a framework, not under pressure. When in doubt on a Friday with a partially degraded service and an unclear root cause, rollback. Investigate on Monday.

---

## Scenario 10: Toil Reduction Initiative

**Situation:** The platform team's on-call rotation included a recurring manual task: rotating database credentials for 12 services every 30 days. The process required an engineer to generate new credentials in AWS Secrets Manager, update each service's Kubernetes secret, and restart the affected pods. Total time: approximately 4 hours per rotation cycle.

**Quantifying the toil:**

Before building a business case, the staff engineer measured the actual cost:

```
Frequency: monthly (12 times/year)
Time per rotation: 4 hours (1 engineer)
Annual cost: 48 engineer-hours
Error rate: 2 failed rotations/year (wrong secret format, missed service)
Incident cost per failure: ~3 hours (2 engineers)
Total annual cost: 48 + 6 = 54 engineer-hours ≈ 6.75 engineer-days
```

Additionally: the task required elevated AWS IAM permissions, creating a security risk each time it was performed manually.

**Building the business case:**

"Manual credential rotation consumes 54 engineer-hours per year and has caused 2 incidents in the past 12 months. Automating it with External Secrets Operator and AWS Secrets Manager rotation will eliminate the manual work, reduce the blast radius of credential exposure (shorter rotation window), and remove the need for engineers to hold elevated IAM permissions during rotation."

**The automation solution:**

```yaml
# ExternalSecret — pulls from AWS Secrets Manager and keeps it synced
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: payment
spec:
  refreshInterval: 1h          # check for rotation every hour
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-credentials       # Kubernetes Secret name
    creationPolicy: Owner
  data:
    - secretKey: password
      remoteRef:
        key: prod/payment/db
        property: password
```

With AWS Secrets Manager automatic rotation enabled (30-day schedule), the External Secrets Operator polls every hour and updates the Kubernetes Secret when the value changes. The application picks up the new credential on the next pod restart or via a mounted secret refresh.

**Outcome:**
- Manual rotation time: 4 hours/month → 0 (fully automated)
- Rotation window: 30 days → 30 days (unchanged), but now enforced automatically
- Incidents from rotation errors: 2/year → 0 in the 6 months post-automation
- Engineer IAM permissions: elevated access removed from rotation runbook

**Lesson:** Toil reduction requires measurement first. "This is annoying" is not a business case. "This costs 54 engineer-hours per year and caused 2 incidents" is. Automate the measurement before you automate the task.

---

## Scenario 11: Cross-Team Dependency Incident

**Situation:** The checkout service (Team A) experienced a P2 incident: order confirmation emails were not being sent for approximately 40 minutes. The root cause was traced to the notification service (Team B), which had deployed a breaking change to its internal API without versioning or advance notice.

**What the incident revealed:**

Team A had a hard dependency on Team B's notification service with no fallback. Team B had no SLO — they had never defined one. When the incident review asked "what is the notification service's availability target?", the answer was: "We don't have one."

The blast radius: any Team B outage or breaking change silently degraded Team A's checkout flow. Neither team had visibility into the cross-service dependency health.

**The immediate fix:**

Team A added a circuit breaker around the notification service call:

```python
import pybreaker

notification_breaker = pybreaker.CircuitBreaker(
    fail_max=5,           # open after 5 consecutive failures
    reset_timeout=60      # retry after 60 seconds
)

@notification_breaker
def send_order_confirmation(order_id: str, email: str) -> None:
    notification_client.send(order_id, email)

# In the checkout flow:
try:
    send_order_confirmation(order.id, user.email)
except pybreaker.CircuitBreakerError:
    # Degrade gracefully: queue for async retry, don't fail the order
    retry_queue.enqueue(order.id, user.email)
    logger.warning("Notification service unavailable, queued for retry", order_id=order.id)
```

**The systemic fix — platform-wide SLO adoption:**

The incident became the catalyst for a broader initiative. The staff engineer presented the data to engineering leadership:

- 6 services had undeclared dependencies on Team B's notification service
- 3 other internal services also had no SLOs
- In the past quarter, 4 incidents were caused by undeclared cross-service dependencies

Proposal: every service that other teams depend on must define and publish an SLO within 60 days. The platform team would provide a standard SLO template and Grafana dashboard.

**SLO template adopted:**

```yaml
service: notification-service
owner: team-b
slos:
  - name: availability
    description: "Fraction of send_notification calls that succeed"
    target: 99.5%
    window: 30d
    sli: rate(notification_requests_total{status="success"}[30d]) / rate(notification_requests_total[30d])

  - name: latency
    description: "P99 send_notification latency"
    target: 500ms
    window: 30d
    sli: histogram_quantile(0.99, rate(notification_request_duration_seconds_bucket[5m]))
```

**Outcome:**
- 8 services defined SLOs within 60 days
- Cross-service dependency map created and published in the internal developer portal
- 2 subsequent incidents were caught by SLO burn rate alerts before users were impacted
- Team A's checkout flow degraded gracefully during a subsequent Team B outage (circuit breaker worked)

**Lesson:** Undeclared dependencies are invisible risk. An incident that crosses team boundaries is often a signal that the platform lacks a contract layer between services. SLOs are that contract. The incident that reveals the gap is the best time to fix it — the pain is fresh and leadership attention is available.

---

## Common Patterns Across All Scenarios

Looking across these scenarios, a few patterns repeat regardless of the specific technology or team:

### 1. Data beats intuition

Every successful intervention in these scenarios started with measurement. The toil reduction initiative quantified 54 engineer-hours before proposing automation. The alert fatigue audit counted 340 pages before changing thresholds. The technical debt paydown cited 48 engineer-hours of reactive work before asking for 6 weeks of investment.

Abstract arguments ("this is messy", "we have too many alerts") lose to data arguments ("this costs X hours per quarter and caused Y incidents").

### 2. Mitigate first, diagnose second

In the SDK timeout regression, the canary rollback, and the CI/CD pipeline failure, the first action was always to restore service — not to understand why it broke. Root cause analysis happened after users were no longer impacted.

The instinct to understand before acting is natural but counterproductive during an active incident. Rollback first. Investigate after.

### 3. Manual fixes in automated systems are temporary

The GitOps scenario and the cross-team dependency incident both illustrate the same principle: in systems designed for automation (GitOps controllers, circuit breakers, SLO alerts), manual interventions that are not codified will be undone or will fail silently.

Every manual fix should be followed immediately by: "How do I make this the permanent state?" In GitOps, that means committing to Git. In reliability, that means writing the runbook and adding the alert.

### 4. Incidents are improvement opportunities

The cross-team SLO adoption, the DORA metrics investigation, and the alert fatigue audit all started as incidents or regressions. The staff engineer's role in each was to convert a painful event into a systemic improvement — not just fix the immediate problem.

When an incident reveals a gap in process, tooling, or contracts between teams, that is the highest-leverage moment to propose the fix. The pain is visible, the stakeholders are paying attention, and the cost of inaction is concrete.

### 5. Operational readiness is a feature

The new team onboarding scenario and the technical debt paydown both demonstrate that investing in operational foundations — runbooks, SLOs, test coverage, observability — before shipping features pays back faster than it costs.

Teams that skip operational readiness to ship faster consistently spend more total time on incidents and firefighting than teams that invest upfront. The math is not close.

---

## Interview Prep: How to Frame These Scenarios

When asked behavioural questions in staff/senior interviews, these scenarios map directly to common prompts. Use the STAR format (Situation, Task, Action, Result) but lead with the business impact.

| Interview prompt | Scenario to draw from |
|-----------------|----------------------|
| "Tell me about a time you reduced operational burden" | Scenario 10 (toil reduction), Scenario 5 (alert fatigue) |
| "Describe a complex incident you led" | Scenario 1 (SDK timeout), Scenario 9 (pipeline failure) |
| "How have you influenced cross-team alignment?" | Scenario 11 (cross-team SLO adoption) |
| "Tell me about a time you made a technical debt argument to leadership" | Scenario 2 (auth service paydown), Scenario 8 (sprint pressure debt) |
| "How do you onboard a new team to production operations?" | Scenario 3 (new team onboarding) |
| "Describe a time a deployment went wrong and how you handled it" | Scenario 9 (pipeline failure), Scenario 7 (GitOps rollback) |
| "How do you measure engineering effectiveness?" | Scenario 4 (DORA regression) |

### What interviewers are listening for

At the staff level, interviewers are not primarily evaluating whether you know the right kubectl command. They are evaluating:

- **Judgment under pressure** — did you mitigate before diagnosing? did you escalate at the right time?
- **Systems thinking** — did you fix the symptom or the root cause? did you prevent recurrence?
- **Influence without authority** — how did you get other teams or leadership to act?
- **Quantified impact** — can you express the problem and the outcome in numbers?

Every scenario in this guide includes a measurable outcome. When you tell these stories, lead with the number: "We reduced on-call pages from 8–12 per night to 1–3" is more compelling than "we fixed the alert fatigue problem."

---

## Using These Scenarios for Study

Each scenario in this guide is designed to be read twice:

1. **First read** — follow the narrative. Understand what happened, why the decisions were made, and what the outcome was.
2. **Second read** — cover the "Lesson" section and try to articulate it yourself before reading it. If you can explain the lesson in your own words, you have internalised it.

For interview preparation, pick three scenarios that map to your own experience and practice telling them out loud. The goal is not to memorise the scenario — it is to have a mental model of the decision-making process that you can apply to novel situations.

The underlying patterns (measure before proposing, mitigate before diagnosing, codify manual fixes, convert incidents into improvements) apply across every technology stack and every organisation size. The specific tools change; the reasoning does not.

For deeper scenario practice, the `06-cheat-sheet.md` in this section has the troubleshooting framework and error pattern tables that underpin most of the diagnostic steps shown here.
