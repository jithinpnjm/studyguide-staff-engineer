---
title: "Examples"
sidebar_position: 7
---

# Observability — Real-World Examples

These examples show how SREs use observability signals, SLO data, Prometheus, Grafana, and Alertmanager to detect, investigate, and resolve real production problems.

---

## Example 1: CPU High, Users Fine

**Situation:** Prometheus fires an alert — node CPU is at 95%. On-call wakes up.

**Investigation:**
- Check golden signals: error rate is 0%, p99 latency is normal, request rate is stable.
- No user-impacting symptoms.

**Outcome:** The CPU spike was a batch job. No user impact. The alert was a false positive.

**Lesson:** Do not auto-page on infrastructure metrics alone. Page on symptoms. This alert should either be:
- Demoted to a ticket or dashboard-only warning, or
- Gated on user-impact evidence (error rate > threshold AND CPU > threshold)

```promql
# Symptom-tied alert is better than:
node_cpu_seconds_total > 0.95

# This:
(
  node_cpu_usage_ratio > 0.9
  and
  service:error_ratio:5m > 0.01
)
```

---

## Example 2: Errors After Deploy

**Situation:** Error rate on the checkout service spikes to 12% two minutes after a new version is deployed.

**Dashboard evidence:**
- Grafana annotation shows deploy at 14:32.
- Error rate panel shows the spike starting at 14:34.
- p99 latency also increases from 120ms to 890ms.

**Decision:** Confidence is high — the deploy caused the regression. Rollback immediately before attempting root-cause analysis.

**Timeline:**
- 14:32 — deploy completed
- 14:34 — error rate alert fires
- 14:35 — incident commander declares SEV2
- 14:37 — rollback initiated
- 14:40 — error rate returns to baseline
- 14:41 — incident resolved

**Lesson:** When a deploy correlates tightly with an error spike, rollback before debugging. Mitigation speed reduces customer impact.

---

## Example 3: Users Slow, Metrics Look Fine

**Situation:** Users report that checkout is slow. Dashboards show p50 latency at 80ms, which looks healthy.

**Investigation:**
- Switch Grafana panel to show p99 instead of p50: p99 is 2400ms.
- Filter by region: EU-WEST latency is healthy, AP-SOUTHEAST p99 is 2400ms.
- Open Jaeger and pull traces from AP-SOUTHEAST: database query spans show 2200ms.
- Check database metrics for AP-SOUTHEAST: connection pool is at 98% utilization.

**Root cause:** Database connection pool exhaustion in one region, visible only in p99 latency and traces.

**Lesson:**
- Average latency hides tail pain.
- Always show p95 and p99 on dashboards.
- Always include regional breakdowns as dashboard variables.
- Traces are essential for pinpointing distributed latency.

---

## Example 4: Nightly Noisy Alert

**Situation:** A `DiskFilling` alert fires every night at 02:00 when a nightly log rotation job runs. Nobody acts on it. On-call team has started ignoring it.

**Problem:** Alert fatigue. When real alerts fire, they get ignored in the noise.

**Fix:**
- Add a time-window restriction to the alert so it only fires outside maintenance windows, or
- Increase the threshold and `for:` duration so brief spikes do not trigger, or
- Convert the alert to a ticket/warning if disk utilization is not at a critical level

```yaml
- alert: DiskFillingCritical
  expr: |
    (node_filesystem_size_bytes - node_filesystem_avail_bytes)
    / node_filesystem_size_bytes > 0.90
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: "Disk utilization above 90% for 30 minutes"
```

**Lesson:** Fix alerts, not people. Alert fatigue is a reliability risk.

---

## Example 5: Dependency Brownout

**Situation:** Checkout service metrics look internally healthy — no pod restarts, CPU and memory normal, internal error rate 0%. But users are reporting payment failures.

**Investigation:**
- Check Grafana dependency panel: payment-processor downstream shows error rate 18%.
- Checkout service is correctly propagating upstream errors to users.

**Root cause:** The checkout service was healthy, but the payment processor was failing. User experience was broken even though the immediate service appeared fine.

**Lesson:** Always include downstream dependency health in dashboards. A service that is healthy internally can still cause user failures if its dependencies are failing.

---

## Example 6: Alert Storm After Database Failure

**Situation:** Primary database goes down. Immediately: 47 different alerts fire across 12 services that all depend on it.

**Problem:** On-call is overwhelmed with noise. The real alert is lost.

**Fix with Alertmanager inhibit rules:**

```yaml
inhibit_rules:
  # If the database is down, suppress all downstream alerts
  - source_match:
      alertname: 'DatabaseDown'
    target_match_re:
      alertname: '.*'
    equal: ['cluster']
    source_match_re:
      severity: 'critical'
```

With inhibition active, only `DatabaseDown` pages. The 46 downstream alerts are suppressed until the database recovers.

**Lesson:** Design Alertmanager inhibit rules around known dependency relationships. Alert storms hide the root cause.

---

## Example 7: SLO Burn Rate Alert in Practice

**Situation:** At 09:15, a fast-burn alert fires for the checkout SLO.

```text
Alert: CheckoutSLOFastBurn
Severity: critical
Burn rate: 14.8x over last 1 hour and 5 minutes
Error budget consumed: ~2% in 1 hour (30-day budget)
```

**On-call response:**
1. Check the SLO dashboard: error budget is 73% remaining, 2% just consumed.
2. Check the error rate panel: 1.5% error rate started at 09:10.
3. Check deploy markers: no recent deploy.
4. Check dependency health: auth service shows elevated latency.
5. Check Loki logs: `authentication timeout` errors in checkout service.
6. Escalate to auth service team.

**Resolution:** Auth service team fixes a connection pool misconfiguration. Error rate drops. SLO burn rate returns to 1x.

**Lesson:** Burn-rate alerts tell you how urgently to act based on SLO risk, not arbitrary CPU or error thresholds.

---

## Example 8: Cardinality Explosion

**Situation:** Prometheus memory usage doubles over two days. Alerts start evaluating slowly. Grafana dashboards are timing out.

**Investigation:**

```promql
# Find metrics with highest cardinality
topk(10, count by (__name__)({__name__=~".+"}))
```

Result: `http_requests_total` has 2 million unique time series.

**Root cause:** A new developer added `request_id` as a metric label, creating one time series per request.

```text
# Bad label added:
http_requests_total{service="api", request_id="abc-123-xyz-..."}
```

**Fix:**
- Remove `request_id` from the metric definition.
- Add a cardinality review to the PR process for metric changes.
- Document that request IDs belong in logs, not metric labels.

**Lesson:** High cardinality is a production reliability risk. Cardinality review is part of platform engineering.

---

## Example 9: Grafana Shows No Data

**Investigation checklist when a panel shows "No data":**

1. Check the time range — is it set to the last 5 minutes when data is only available for the last 30 days?
2. Check the datasource — is it pointing to the correct Prometheus instance?
3. Check the query — do the label selectors match actual metric labels?
4. Check the target health in Prometheus — is `up{job="my-service"}` returning 1?
5. Check service discovery — is the target being discovered?

```promql
# Check if target is being scraped
up{job="my-service"}

# Check scrape duration
scrape_duration_seconds{job="my-service"}
```

**Lesson:** Most "no data" issues in Grafana are target scrape problems, incorrect label selectors, or time range mismatches.

---

## Example 10: Postmortem With Tracked Actions

**Incident summary:** Payment service was unavailable for 22 minutes due to database connection pool exhaustion after a deploy changed the pool size configuration from 50 to 5.

**Detection:** SLO fast-burn alert fired 3 minutes after deploy.

**Mitigation:** Rollback to previous configuration.

**Root cause chain:**
1. Configuration value was changed in a PR
2. PR review did not check the impact of the value
3. Staging had lower load so the pool size issue was not visible
4. Production traffic exhausted the reduced pool in minutes

**Actions with owners and due dates:**

| Action | Owner | Due |
|---|---|---|
| Add pool size validation to deploy pipeline | Platform team | 2 weeks |
| Add database connection pool metric to deploy canary checks | SRE | 1 week |
| Write runbook for connection pool exhaustion | Payments team | 3 days |
| Add staging load test that reflects production connection rate | QA | 2 weeks |

**Lesson:** Postmortems without tracked action items are just documents. Tracked actions with owners and due dates produce system improvement.
