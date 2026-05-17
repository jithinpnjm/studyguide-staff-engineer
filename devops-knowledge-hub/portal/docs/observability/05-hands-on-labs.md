---
title: "Hands-On Labs"
sidebar_position: 5
---

# Observability — Hands-On Labs

These labs build practical observability skill using Prometheus, Grafana, Loki, Kubernetes signals, PromQL, alerting, SLO thinking, and incident response.

---

## Lab 1: Prometheus Architecture Walkthrough

**Goal:** Understand the moving parts before running tools.

Draw this architecture:

```text
application / exporter -> Prometheus scrape -> TSDB -> PromQL -> Grafana / alert rules -> Alertmanager
```

Answer:

- What exposes metrics?
- What scrapes metrics?
- Where are time series stored?
- What evaluates alert rules?
- What sends notifications?
- What visualizes dashboards?

Expected learning: Prometheus is a pull-based metrics system; targets must expose metrics and Prometheus must discover or configure those targets.

---

## Lab 2: Node Exporter Signal Mapping

**Goal:** Map Linux host symptoms to Node Exporter metrics.

| Symptom | Metric family to inspect |
|---|---|
| High CPU | `node_cpu_seconds_total` |
| Low memory | `node_memory_*` |
| Disk filling | `node_filesystem_*` |
| Disk I/O slow | `node_disk_*` |
| Network traffic spike | `node_network_*` |
| System load high | `node_load*` |

Write one PromQL query for each symptom.

Example:

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

Memory available:

```promql
(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100
```

---

## Lab 3: cAdvisor Container Metrics Review

**Goal:** Understand container-level signals.

Important cAdvisor signals:

```text
container_cpu_usage_seconds_total
container_memory_working_set_bytes
container_fs_usage_bytes
container_network_receive_bytes_total
container_network_transmit_bytes_total
```

Exercise:

- Find CPU usage by container.
- Find memory working set by container.
- Identify which labels are safe to group by.
- Identify labels that may create too much cardinality.

Example query:

```promql
sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace, pod, container)
```

---

## Lab 4: Basic PromQL Practice

**Goal:** Learn common query patterns.

Targets up:

```promql
up
```

Scrape duration:

```promql
scrape_duration_seconds
```

Filesystem free percentage:

```promql
(node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100
```

Memory available percentage:

```promql
(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100
```

HTTP request rate by service:

```promql
sum(rate(http_requests_total[5m])) by (service)
```

Error ratio:

```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

Review question: which queries are gauges and which require `rate()`?

---

## Lab 5: Grafana Dashboard Design

**Goal:** Design a useful service dashboard.

Dashboard rows:

```text
row 1: golden signals (request rate, error rate, p95 latency, p99 latency, saturation)
row 2: dependency health (downstream service latency and error rates)
row 3: saturation (CPU, memory, queue depth, connection pool)
row 4: recent deploy/version markers and feature flag state
row 5: links to logs, traces, and runbook
```

Dashboard review checklist:

- Can I see user impact in 30 seconds?
- Can I identify saturation?
- Can I identify the failing dependency?
- Can I filter by environment and service?
- Are variables bounded and useful?
- Is there a link to the runbook?
- Are deploy annotations visible on the timeline?

---

## Lab 6: Alert Rule Review

**Goal:** Review an alert for actionability.

Example alert shape:

```yaml
groups:
  - name: service-alerts
    rules:
      - alert: HighServiceErrorRate
        expr: service:error_ratio:5m > 0.05
        for: 10m
        labels:
          severity: page
          team: payments
        annotations:
          summary: "High error rate for payments service"
          runbook_url: "https://runbooks.example.com/payments-errors"
```

Review:

- Is there an owner?
- Is there a runbook?
- Does it represent user impact?
- Is the threshold meaningful?
- Is the `for` duration appropriate?
- Are labels enough for routing?

Then write a burn-rate alert for the same service:

```yaml
- alert: CheckoutSLOFastBurn
  expr: |
    (
      job:slo_errors:rate1h{job="checkout"} > (14.4 * 0.001)
      and
      job:slo_errors:rate5m{job="checkout"} > (14.4 * 0.001)
    )
  for: 2m
  labels:
    severity: critical
    team: payments
  annotations:
    summary: "Checkout SLO fast burn rate"
    runbook_url: "https://runbooks.example.com/checkout-slo"
```

---

## Lab 7: Loki Query Practice

**Goal:** Query logs with labels and filters.

Basic query:

```logql
{app="api"}
```

Filter errors:

```logql
{app="api"} |= "error"
```

Parse JSON logs:

```logql
{app="api"} | json | level="error"
```

Count timeout logs:

```logql
sum(rate({app="api"} |= "timeout" [5m]))
```

Extract and filter a field:

```logql
{namespace="payments"} | json | latency_ms > 500
```

Review question: why should `request_id` stay in the log body instead of labels?

---

## Lab 8: SLO Design Exercise

**Goal:** Define SLI, SLO, and error budget for one service.

Template:

```text
User journey:
SLI:
Good events:
Total events:
SLO target:
Window:
Error budget:
Burn rate threshold for fast alert:
Burn rate threshold for slow alert:
Runbook:
Owner:
```

Example:

```text
User journey: checkout request
SLI: successful checkout HTTP requests / total checkout HTTP requests
Good events: requests with status 2xx
Total events: all checkout requests
SLO target: 99.9% over 30 days
Window: 30-day rolling
Error budget: 0.1% = ~43 minutes per month
Fast burn alert: 14x burn rate (2% budget in 1 hour)
Slow burn alert: 3x burn rate (5% budget in 6 hours)
Owner: payments team
```

---

## Lab 9: Kubernetes Monitoring Checklist

**Goal:** Identify what must be visible for a Kubernetes service.

Checklist:

```text
pod restarts
container memory working set
container CPU throttling
deployment unavailable replicas
service request rate
service error rate
service latency p95/p99
node pressure
PVC usage
recent events
```

PromQL examples:

```promql
increase(kube_pod_container_status_restarts_total[15m])
```

```promql
kube_deployment_status_replicas_unavailable
```

```promql
container_memory_working_set_bytes{namespace="payments"}
```

---

## Lab 10: Incident Dashboard Review

**Goal:** Practice reviewing dashboard quality.

For one service dashboard, answer:

```text
Can I see user impact?
Can I identify recent deploy/version?
Can I see dependency health?
Can I see saturation?
Can I jump to logs?
Can I jump to traces?
Can I identify owner?
Can I find the runbook?
```

If the answer is no, the dashboard is incomplete.

---

## Lab 11: Alertmanager Routing Practice

**Goal:** Configure alert routing and inhibition.

Write an Alertmanager configuration that:
- Routes critical alerts to PagerDuty
- Routes warning alerts to Slack
- Groups alerts by alertname, cluster, service
- Suppresses warning alerts when a critical alert fires for the same service

```yaml
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - matchers:
        - severity="critical"
      receiver: 'pagerduty'
    - matchers:
        - severity="warning"
      receiver: 'slack'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']

receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<key>'
  - name: 'slack'
    slack_configs:
      - api_url: '<webhook>'
        channel: '#alerts'
```

---

## Lab 12: Recording Rules Exercise

**Goal:** Write recording rules for a dashboard and SLO.

Write recording rules for:
1. Request rate by service over 5 minutes
2. Error ratio by service over 5 minutes
3. p99 latency by service over 5 minutes

```yaml
groups:
  - name: service-recording-rules
    interval: 60s
    rules:
      - record: service:http_requests:rate5m
        expr: sum(rate(http_requests_total[5m])) by (service, environment)

      - record: service:error_ratio:5m
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          /
          sum(rate(http_requests_total[5m])) by (service)

      - record: service:request_duration_seconds:p99_5m
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          )
```

Review questions:
- Why are recording rules evaluated on a separate interval?
- How do recording rules reduce dashboard load time?
- When should you NOT use a recording rule?

---

## Lab 13: Mock Incident Drill

**Goal:** Practice incident response flow.

Scenario: Checkout service error rate jumped to 8% at 14:00.

Work through:

```text
Detect:
  - Which alert fired?
  - What is the severity?

Triage:
  - How many users affected?
  - Global or isolated to region/version?
  - Is it getting worse or stabilizing?
  - What changed in the last hour?

Mitigate:
  - Can you rollback the latest deploy?
  - Can you disable the problematic feature flag?
  - Is a dependency to blame — should you redirect traffic?

Communicate:
  - Write a 2-sentence status update for stakeholders.

Resolve:
  - What metrics confirm recovery?

Postmortem items:
  - What should be in the timeline?
  - What action prevents recurrence?
```

---

## Lab 14: Remove Noisy Alerts Safely

**Goal:** Audit and fix a noisy alert set.

Process:
1. List all alerts that fired in the last 30 days.
2. For each alert, record: how many times it fired, how many times someone took action, how often it woke someone up at night.
3. Classify each alert:
   - Keep as page: actionable, user-impacting
   - Convert to ticket: informational, low urgency
   - Convert to dashboard-only: useful but not urgent
   - Remove: no action ever taken

Success criteria: reduce nighttime pages by 50% without missing a real user-impacting incident.

---

## Lab 15: Postmortem Writing Exercise

**Goal:** Write a complete postmortem from an incident scenario.

Scenario: Payment service was down for 22 minutes due to a database connection pool exhaustion caused by a misconfigured deploy.

Write a postmortem that includes:

```text
Title: Payment Service Outage — [date]

Impact:
  Users affected:
  Duration:
  Revenue estimate:

Timeline:
  13:42 - Deploy started
  13:47 - Error rate increased
  13:50 - Alert fired
  13:55 - Incident commander engaged
  14:04 - Root cause identified
  14:09 - Rollback completed
  14:12 - Metrics recovered

Root Cause:
  [one paragraph explaining the causal chain]

Detection:
  [Was the alert fast enough? What was the detection gap?]

Mitigation:
  [What worked? What slowed resolution?]

Prevention:
  1. [Action item with owner and due date]
  2. [Action item with owner and due date]
```
