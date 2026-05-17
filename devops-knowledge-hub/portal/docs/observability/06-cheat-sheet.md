---
title: "Cheat Sheet"
sidebar_position: 6
---

# Observability — Cheat Sheet

Quick reference for common observability concepts, queries, and patterns.

---

## Core Signals

```text
metrics: numeric measurements over time
logs: timestamped event records
traces: request path across services
events: discrete state changes
```

Golden signals:

```text
latency
traffic
errors
saturation
```

RED (for services): Rate, Errors, Duration

USE (for infrastructure): Utilization, Saturation, Errors

---

## Prometheus

Core concepts:

| Concept | Meaning |
|---|---|
| Target | Endpoint scraped by Prometheus |
| Scrape | Pull metrics over HTTP |
| Metric | Time-series measurement |
| Label | Dimension on a metric |
| PromQL | Query language |
| Rule | Recording or alerting expression |
| Alertmanager | Alert routing system |

Common query shapes:

```promql
# Counter rate
rate(http_requests_total[5m])

# Target health
up

# p95 latency from histogram
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Error ratio
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))

# CPU usage
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory available %
(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Sum by label
sum(rate(http_requests_total[5m])) by (service)
```

---

## Metric Types

| Type | Use case | Query |
|---|---|---|
| Counter | Requests, errors, completed jobs | `rate()` |
| Gauge | Memory, queue depth, open connections | direct |
| Histogram | Latency and size distributions | `histogram_quantile()` |
| Summary | Client-calculated quantiles | direct quantile series |

---

## Recording Rules

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
```

---

## Alert Rule Shape

```yaml
groups:
  - name: service-alerts
    rules:
      - alert: HighErrorRate
        expr: service:error_ratio:5m > 0.05
        for: 10m
        labels:
          severity: critical
          team: payments
        annotations:
          summary: "High error rate on payments"
          runbook_url: "https://runbooks.example.com/payments"
```

---

## SLO Burn Rate Alerts

| Burn Rate | Meaning | Action |
|---|---|---|
| 14x | 2% budget consumed in 1 hour | Page immediately |
| 6x | 5% budget consumed in 6 hours | Page on-call |
| 3x | 10% budget consumed in 3 days | Create ticket |
| 1x | Normal consumption | No action |

Multi-window fast burn:

```promql
job:slo_errors:rate1h > (14.4 * 0.001)
and
job:slo_errors:rate5m > (14.4 * 0.001)
```

---

## SLO Terms

```text
SLI: measured reliability signal (e.g., successful request ratio)
SLO: target for that signal (e.g., 99.9% over 30 days)
SLA: external contractual promise (usually looser than SLO)
error budget: allowed unreliability (0.1% for 99.9% SLO)
burn rate: speed of budget consumption vs planned rate
```

Error budget by SLO over 30 days:

| SLO | Error budget (minutes/month) |
|---|---|
| 99.9% | ~43 minutes |
| 99.95% | ~22 minutes |
| 99.99% | ~4 minutes |

---

## Cardinality Rules

Good labels:

```text
service
environment
cluster
namespace
route
method
status
team
region
```

Avoid unbounded labels:

```text
user_id
request_id
session_id
order_id
full_url
trace_id
pod_uid
```

---

## Alertmanager

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
```

Alertmanager capabilities:

| Feature | Purpose |
|---|---|
| Grouping | Combine related alerts into one notification |
| Deduplication | Suppress repeated identical alerts |
| Routing | Send to correct team and channel |
| Silences | Suppress during maintenance |
| Inhibition | Suppress child alerts when parent fires |

---

## Grafana Dashboard Shape

```text
top row: golden signals (rate, errors, p95/p99 latency, saturation)
second row: dependency health, resources, queue depth, deploy markers
third row: infrastructure detail, feature flags
bottom: logs, traces, runbook links
```

Dashboard checklist:

```text
answers user-impact question in 10 seconds
shows p95/p99 not just averages
has deploy annotation markers
variables for service/env/cluster
link to runbook
link to logs
link to traces
```

---

## Loki / LogQL

Basic:

```logql
{app="api"}
```

Filter:

```logql
{app="api"} |= "timeout"
```

JSON parse:

```logql
{app="api"} | json | level="error"
```

Rate:

```logql
sum(rate({app="api"} |= "timeout" [5m]))
```

Extract field and filter:

```logql
{namespace="payments"} | json | latency_ms > 500
```

Good Loki labels: cluster, namespace, app, container, environment, team

---

## Tracing

| Concept | Meaning |
|---|---|
| Trace | Full request path through all services |
| Span | One operation within a trace |
| Context propagation | Passing trace ID via headers |
| Tail sampling | Sample after seeing full trace result |
| Head sampling | Sample at request start |

Always keep: error traces, latency outliers.
Sample: healthy traffic (1–10% typical).

Tools: Jaeger, Grafana Tempo, Zipkin. Standard: OpenTelemetry.

---

## Alert Checklist

```text
owner / team label
severity label
impact summary
runbook URL
service label
environment label
dashboard link
symptom-based condition (not cause-based)
for: duration to avoid flapping
```

---

## Incident Response Quick Reference

```text
Detect: alert, synthetic probe, user report
Triage: scope, user count, trend, recent change
Mitigate: rollback > feature flag > reroute > scale > shed load > restart
Communicate: short clear updates, regular cadence
Resolve: metrics normal, cause understood
Learn: postmortem, blameless, tracked actions

Senior question order:
1. Are users hurting?
2. How many?
3. Getting worse?
4. Fastest safe mitigation?
```

Incident roles:

| Role | Responsibility |
|---|---|
| Incident Commander | Coordination and decision making |
| Tech Lead | Debugging and mitigation |
| Comms | Stakeholder updates |
| SMEs | Domain expertise on demand |

---

## Prometheus Scaling Options

| Pattern | Use case |
|---|---|
| Recording rules | Precompute expensive queries |
| Federation | Aggregate across clusters |
| Remote write | Long-term storage (Thanos, Mimir) |
| Sharding | Split scrape load |
| Thanos/Mimir/Cortex | Global query, HA, long retention |

---

## Common Exporters

| Exporter | Purpose |
|---|---|
| node_exporter | Linux host metrics |
| kube-state-metrics | Kubernetes object state |
| cAdvisor | Container resource metrics |
| blackbox_exporter | HTTP/TCP/ICMP probes |
| postgres_exporter | PostgreSQL metrics |
| redis_exporter | Redis metrics |
| nginx exporter | Web server metrics |
