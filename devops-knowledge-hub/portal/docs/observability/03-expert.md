---
title: "Expert"
sidebar_position: 3
---

# Observability — Expert

Expert observability is about designing a telemetry platform that scales technically and organizationally. The goal is to help teams detect real user impact, debug distributed systems, control cost, and improve reliability decisions.

---

## Staff-Level Observability Questions

Before building a platform, ask:

1. What user journeys matter most?
2. Which SLIs represent those journeys?
3. Which teams own each service and alert?
4. Which telemetry is required during incidents?
5. What is the cardinality budget?
6. What retention is required?
7. How is cost controlled?
8. How are dashboards and alerts reviewed?
9. How do logs, metrics, and traces correlate?
10. What is the runbook quality standard?

Observability without ownership becomes noise.

---

## Telemetry Architecture

A common cloud-native observability architecture:

```text
applications
  -> metrics endpoint / logs / traces
  -> collectors and agents
  -> Prometheus / Loki / tracing backend
  -> Grafana dashboards
  -> Alertmanager routes
  -> incident response
```

Kubernetes architecture:

```text
kubelet + cAdvisor -> Prometheus
kube-state-metrics -> Prometheus
Node Exporter -> Prometheus
application metrics -> Prometheus
pod logs -> collector -> Loki
OpenTelemetry SDK -> collector -> tracing backend
```

---

## Cardinality Engineering

High cardinality is one of the most common observability scaling failures.

Dangerous labels:

```text
user_id
request_id
session_id
order_id
pod_uid
full_url
error_message
trace_id
```

Better labels:

```text
service
environment
cluster
namespace
route
method
status
region
team
```

Metric design rule:

```text
bounded dimensions belong in labels
unbounded context belongs in logs or traces
```

Cardinality must be reviewed like capacity planning. High cardinality causes:
- high memory use
- slow queries
- large storage growth
- expensive remote write
- alert rule evaluation pressure

---

## Prometheus Scaling

Scaling options:

| Pattern | Use case |
|---|---|
| Recording rules | Precompute expensive queries |
| Federation | Aggregate selected metrics across clusters |
| Remote write | Send metrics to long-term storage |
| Sharding | Split scrape load across instances |
| Thanos/Cortex/Mimir | Global query and long-term metrics |
| Retention tuning | Reduce local disk pressure |

Federation allows a parent Prometheus to scrape selected metrics from child instances. Use complexity only when simpler approaches fail.

Prometheus anti-patterns:
- Scraping too frequently without need
- High-cardinality labels
- Expensive dashboard queries
- Alert rules over raw high-volume metrics
- No ownership of noisy metrics

Prometheus memory high — likely causes:
- cardinality explosion
- too many targets
- expensive queries

---

## Recording Rules

Recording rules save expensive queries as new time series.

```yaml
groups:
  - name: service-recording-rules
    rules:
      - record: service:http_requests:rate5m
        expr: sum(rate(http_requests_total[5m])) by (service, environment)

      - record: service:error_ratio:5m
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          /
          sum(rate(http_requests_total[5m])) by (service)

      - record: job:http_request_duration_seconds:p99_5m
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job)
          )
```

Use recording rules for:
- Expensive repeated dashboard queries
- Common SLI calculations
- Alert inputs
- Aggregations over many series

Do not create recording rules for every ad-hoc query.

---

## SLO-Based Alerting In Depth

SLO alerts should detect fast and slow error-budget burn. Multi-window burn-rate alerting catches both fast spikes and slow drains.

Burn rate formula:

```text
burn rate = actual error rate / (1 - SLO target)
```

For a 99.9% SLO (0.1% error budget):
- 1x burn = consuming budget at expected rate
- 3x burn = budget exhausted in ~10 days instead of 30
- 14x burn = budget exhausted in ~2 hours

Multi-window burn-rate alert example:

```yaml
groups:
  - name: slo-alerts
    rules:
      # Fast burn: 2% budget consumed in 1 hour -> 14x burn rate
      - alert: SLOFastBurn
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
          summary: "Checkout SLO fast burn: error budget draining rapidly"
          runbook_url: "https://runbooks.example.com/checkout-slo"

      # Slow burn: 5% budget consumed in 6 hours -> 3x burn rate
      - alert: SLOSlowBurn
        expr: |
          (
            job:slo_errors:rate6h{job="checkout"} > (6 * 0.001)
            and
            job:slo_errors:rate30m{job="checkout"} > (6 * 0.001)
          )
        for: 15m
        labels:
          severity: warning
          team: payments
        annotations:
          summary: "Checkout SLO slow burn: sustained degradation"
          runbook_url: "https://runbooks.example.com/checkout-slo"
```

Error budget policy:
- full budget remaining: normal release velocity
- 50% budget remaining: review release risk
- budget exhausted: freeze non-critical changes, focus on reliability

---

## Alert Quality Engineering

A good alert has:

```text
symptom-based condition
service owner
severity
impact statement
runbook
relevant labels
dashboard link
clear threshold rationale
```

Alert review questions:
- Did this page someone who could act?
- Did it fire before user impact or after?
- Was the runbook enough?
- Was the alert noisy?
- Did it miss important context?
- Should this be ticket, page, or dashboard-only?

Alert fatigue is a reliability risk. Noisy alerts train teams to ignore the system.

---

## Alertmanager Advanced Configuration

### Inhibit Rules

Suppress lower-severity alerts when a high-severity alert is active for the same service:

```yaml
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']

  # Suppress individual service alerts during a cluster outage
  - source_match:
      alertname: 'ClusterDown'
    target_match_re:
      alertname: 'Service.*'
    equal: ['cluster']
```

### Routing With Matchers

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
      continue: false
    - matchers:
        - team="payments"
      receiver: 'payments-slack'
    - matchers:
        - alertname=~"SLO.*"
      receiver: 'sre-channel'
```

### Silences

Silences suppress matching alerts for a defined time window. Use for planned maintenance.

```text
silence matchers:
  alertname="DeploymentRollout"
  cluster="prod-eu"
duration: 2h
created_by: jithin
comment: "Planned maintenance window"
```

---

## Logs At Scale

Log platforms fail when teams treat logs as unlimited free storage.

Design decisions:
- What log levels are kept?
- How long are logs retained?
- Which logs need indexing?
- Which logs can be sampled?
- Which logs are security/audit records?
- Which logs are debugging-only?

Good practice:

```text
structured logs
stable field names
correlation IDs (trace_id in every log line)
low-cardinality labels
clear retention classes
redaction of sensitive values
```

Loki advanced patterns:

```logql
# Parse and extract fields from JSON logs
{namespace="payments"} | json | level="error" | latency > 500

# Count errors by service over time
sum by (app) (rate({namespace="prod"} |= "ERROR" [5m]))

# Pipeline filter then metric extraction
{app="api"} | json | unwrap duration_ms | p99 by (route)
```

Log ingestion lag symptoms:
- Grafana shows no recent log data
- `loki_ingester_blocks_per_chunk` metric elevated
- tail queries returning stale results

---

## Tracing At Scale

Tracing requires sampling strategy.

Common sampling approaches:

| Strategy | Use case |
|---|---|
| Head sampling | Decide at request start |
| Tail sampling | Decide after seeing result |
| Error sampling | Keep failed requests |
| Latency sampling | Keep slow requests |
| Probabilistic sampling | Keep percentage of traffic |

Tail sampling is powerful because it can keep traces that are slow or failed while dropping normal traffic.

Jaeger/Tempo trace context propagation:

```text
W3C TraceContext headers (standard):
  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

OpenTelemetry SDK adds trace_id to:
  - HTTP headers (for propagation)
  - span attributes
  - log fields (via trace context injection)
```

Sampling guidance:
- always sample errors
- always sample requests exceeding p99 threshold
- probabilistically sample 1-10% of healthy traffic
- increase sample rate during active investigations

---

## Observability For Platform Teams

Platform teams should provide golden paths:

- Standard metrics library
- Standard log fields
- Trace propagation headers
- Dashboard templates
- Alert templates
- Service ownership labels
- Runbook format
- Cardinality review process
- Retention and cost policies

The goal is consistency without blocking teams from adding domain-specific signals.

---

## Incident Response And Runbooks

Senior priorities during incidents:
1. Are users hurting?
2. How many?
3. Is it getting worse?
4. What is the fastest safe mitigation?

Incident lifecycle:

| Phase | Actions |
|---|---|
| Detect | Alert, user report, synthetic probe |
| Triage | Scope, user impact, trend, recent changes |
| Mitigate | Rollback, disable feature, reroute, scale, shed load |
| Communicate | Clear regular updates to stakeholders |
| Resolve | Metrics normal and cause understood |
| Learn | Postmortem with tracked actions |

Incident roles:

| Role | Responsibility |
|---|---|
| Incident Commander | Coordination |
| Tech Lead | Debugging and mitigation |
| Comms | Stakeholder updates |
| SMEs | Focused expertise |

Runbook quality standard:

```text
title: alert name
severity: critical / warning
impact: what users experience
detection: which metric or signal fires
triage steps: ordered list
mitigation options: ranked by risk and speed
escalation path: who to call next
owner: team name
last reviewed: date
```

---

## Postmortems That Matter

Include:
- timeline
- impact (users affected, duration, revenue)
- detection quality (how fast was the alert?)
- root cause chain
- mitigation effectiveness
- prevention actions
- owners and due dates

Blameless means focus on system improvement, not avoiding accountability.

---

## Observability Cost Optimization

Telemetry is not free. At scale, metrics storage, log ingestion, and trace retention are significant infrastructure costs.

### Metric Cost Controls

```text
Reduce scrape frequency for low-priority targets (30s -> 60s)
Drop metrics that no team queries (metric_relabel_configs: action: drop)
Set sample_limit per scrape config as a cardinality guardrail
Use recording rules to precompute instead of re-querying at dashboard load
Set shorter retention for raw metrics; keep aggregated recording rules longer
```

Prometheus `metric_relabel_configs` drop example:

```yaml
scrape_configs:
  - job_name: 'verbose-service'
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'go_gc_.*|process_open_.*'
        action: drop
```

### Log Cost Controls

Log tiering approach:

| Tier | Retention | Content |
|---|---|---|
| Hot (indexed) | 7-14 days | Errors, warnings, audit events |
| Warm (queryable) | 30-90 days | All application logs |
| Cold (archived) | 1+ year | Compliance, security audit |

Log sampling — for high-volume debug logs:

```yaml
# Promtail pipeline stage to sample 10% of debug logs
- match:
    selector: '{level="debug"}'
    stages:
      - sampling:
          rate: 10
          drop_reason: "debug_log_sampling"
```

PII and secret scrubbing before ingestion:

```yaml
# Drop fields that may contain sensitive values
- replace:
    expression: '(\b\d{16}\b)'    # credit card pattern
    replace: '[REDACTED]'
```

### Trace Cost Controls

- Keep 100% of error traces
- Keep 100% of traces exceeding p99 threshold
- Sample 1-5% of healthy traces probabilistically
- Use tail sampling to make keep/drop decisions after seeing the full trace

---

## Advanced PromQL Patterns

### `without` — Aggregate Everything Except Specified Labels

```promql
# Sum by all labels except instance (aggregate across pods)
sum without (instance) (rate(http_requests_total[5m]))

# Equivalent with by: sum by (service, environment)
# without is safer when label names are unknown in advance
```

### `on` — Restrict Vector Matching To Specific Labels

```promql
# Join two metrics that share only 'service' label
method_call_duration_seconds
  / on(service)
  method_call_total
```

### Subqueries — Query a Range of Instant Queries

```promql
# Maximum of the 5-minute rate over the past hour (sampled every 30s)
max_over_time(
  rate(http_requests_total[5m])[1h:30s]
)

# Useful for: finding peak rates, detecting bursts that recording rules miss
```

### `predict_linear` — Forecast When a Metric Will Breach Threshold

```promql
# Predict disk full time (seconds from now)
predict_linear(node_filesystem_avail_bytes[1h], 4 * 3600) < 0
```

Alert use: fire before disk is full, not after.

### `absent` — Alert When a Metric Disappears

```promql
# Alert if the checkout service stops reporting metrics
absent(up{job="checkout"})
```

Useful for detecting scrape gaps and dead services before users notice.

### `topk` / `bottomk` — Find Hotspots

```promql
# Top 5 services by error rate
topk(5, sum by (service) (rate(http_requests_total{status=~"5.."}[5m])))

# Bottom 5 services by success ratio
bottomk(5, sum by (service) (rate(http_requests_total{status="200"}[5m])) / sum by (service) (rate(http_requests_total[5m])))
```

---

## Expert Takeaways

1. Observability is a production platform, not only dashboards.
2. Cardinality is a scalability and cost constraint.
3. SLOs make alerts user-impact aware.
4. Multi-window burn-rate alerting catches both fast and slow budget drain.
5. Recording rules reduce repeated query cost.
6. Logs need retention and label discipline.
7. Traces need sampling strategy with tail sampling preferred.
8. Alert quality must be reviewed after incidents.
9. Alertmanager inhibit rules prevent alert storms from noisy child alerts.
10. Telemetry must have ownership, or it becomes noise.
