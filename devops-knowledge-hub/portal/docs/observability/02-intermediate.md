---
title: "Intermediate"
sidebar_position: 2
---

# Observability — Intermediate

Intermediate observability is about turning telemetry into useful operational signals. The goal is not to collect everything. The goal is to answer production questions quickly.

---

## Observability Design Flow

Start from user impact.

```text
user journey -> SLI -> telemetry -> dashboard -> alert -> runbook
```

Example:

```text
checkout success
  -> request success rate and latency
  -> Prometheus metrics and traces
  -> Grafana dashboard
  -> alert on burn rate
  -> runbook for dependency failures
```

---

## PromQL Fundamentals

Counter rate:

```promql
rate(http_requests_total[5m])
```

Error ratio:

```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

Latency from histogram buckets:

```promql
histogram_quantile(
  0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
)
```

Host CPU usage:

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

Memory available percentage:

```promql
(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100
```

Sum by service:

```promql
sum(rate(http_requests_total[5m])) by (service)
```

---

## Metric Types

| Type | Use case | Query pattern |
|---|---|---|
| Counter | Monotonic count | `rate()` |
| Gauge | Current value | direct query |
| Histogram | Distribution | `histogram_quantile()` |
| Summary | Client-side quantile | direct quantile series |

Use counters for requests and errors. Use histograms for latency. Use gauges for memory, queue depth, open connections, and capacity signals.

Histograms for p95/p99 latency are the correct approach. Do not average percentiles — use bucket aggregation first, then quantiles. Tail latency often matters more than averages.

---

## SLI, SLO, SLA, and Error Budget

| Term | Meaning |
|---|---|
| SLI | Measured reliability signal |
| SLO | Target for that signal |
| SLA | External commercial promise |
| Error budget | Allowed unreliability |

Example:

```text
SLI: successful HTTP requests / total HTTP requests
SLO: 99.9% success over 30 days
Error budget: 0.1% allowed failures
```

SLOs make alerting business-aware. Error budgets align product speed with operational reality:
- healthy budget -> ship faster
- budget exhausted -> prioritize reliability

SLA is usually looser than SLO.

---

## Burn Rate Thinking

Burn rate describes how quickly error budget is being consumed relative to the target consumption rate.

- 14x burn rate = severe active issue requiring immediate response
- 3x burn rate = meaningful degradation, needs attention
- 1x burn rate = consuming budget at exactly the planned rate

Burn-rate alerts tie signals to commitments rather than arbitrary thresholds. They map incidents to SLO risk, helping prioritize what truly threatens commitments.

SLO alerts should detect fast and slow error-budget burn:

```text
fast burn: urgent, high-impact degradation
slow burn: sustained degradation that will exhaust budget
```

---

## Alerting Principles

Actionable alerts should have:

- Clear impact
- Team owner
- Severity
- Runbook
- Service and environment labels
- Dashboard or query link

Alert on symptoms that need action. Avoid paging for every warning-level internal condition.

Good alerting is tied to user impact and SLOs.

Good pages:
- sustained error spike
- severe burn rate
- sustained latency breach
- synthetic checkout failing

Bad pages:
- one pod restart
- CPU briefly high
- disk 70%
- transient blips without impact

Use `for:` in alert rules to avoid noisy short spikes.

---

## Alertmanager Configuration

Alertmanager receives alerts from Prometheus, groups and deduplicates them, applies routing rules, and sends notifications.

Core Alertmanager capabilities:
- **Grouping**: combine related alert instances into one notification
- **Deduplication**: suppress repeated identical alerts
- **Silences**: temporarily suppress alerts during maintenance
- **Inhibition**: suppress child alerts when a parent alert fires
- **Routing**: direct alerts to teams and channels by label

Example routing configuration:

```yaml
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'default-slack'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
    - match:
        severity: warning
      receiver: 'slack-warnings'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
```

---

## Alert Rule Example

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

Good alerts include: severity, owner/team, summary, runbook link, and clear action.

---

## Grafana Dashboard Design

Good dashboards answer questions:

- Is the service healthy?
- What changed recently?
- Which dependency is slow?
- Is the system saturated?
- Is impact global or isolated?
- Is recovery happening?

Recommended layout:

```text
top row: golden signals (request rate, error rate, p95/p99 latency, saturation)
second row: resources, dependency latency, queue depth, deploy markers
third row: dependencies, feature flags, version
bottom: logs, traces, and runbook links
```

Dashboard variables allow dynamic filtering by service, cluster, namespace, region, and environment.

Use annotations to mark deploys and config changes on dashboards. A dashboard should answer a question in under 10 seconds.

---

## Kubernetes Observability

| Component | Signal |
|---|---|
| kubelet/cAdvisor | Container resource metrics |
| kube-state-metrics | Kubernetes object state |
| Node Exporter | Node OS metrics |
| API server metrics | Control plane behavior |
| App metrics | Service behavior |

Useful Kubernetes signals:

```text
pod restarts
container OOM kills
CPU throttling
node pressure
deployment unavailable replicas
API server latency
persistent volume usage
```

PromQL examples:

```promql
increase(kube_pod_container_status_restarts_total[15m])
```

```promql
kube_deployment_status_replicas_unavailable
```

---

## Loki And Logs

Loki query examples:

```logql
{namespace="payments"} |= "error"
```

```logql
{app="api"} | json | level="error"
```

```logql
{namespace="payments"} |= "timeout"
```

Count timeout logs:

```logql
sum(rate({app="api"} |= "timeout" [5m]))
```

Label guidance:

```text
Good labels: cluster, namespace, app, container, environment
Bad labels: request_id, user_id, order_id
```

Keep high-cardinality values inside the log body, not labels.

---

## Tracing Basics

A trace contains spans. Each span represents one operation.

```text
frontend
  -> api-gateway
    -> payment-service
      -> database
      -> queue
```

Tracing helps answer where latency or failure happened in a distributed request path.

OpenTelemetry is the vendor-neutral standard for collecting metrics, logs, and traces. Tools in the ecosystem include Jaeger and Tempo for trace storage and querying.

Trace context propagation ensures a trace ID flows through all hops of a distributed request. Structured logs should include the trace_id field so logs and traces can be correlated.

---

## Intermediate Takeaways

1. PromQL is the query language for Prometheus metrics.
2. SLOs connect telemetry to business reliability.
3. Error budgets guide risk decisions — ship faster or stabilize.
4. Burn-rate alerts are better than arbitrary CPU or error thresholds.
5. Alertmanager groups, deduplicates, routes, inhibits, and silences alerts.
6. Dashboards should answer operational questions in under 10 seconds.
7. Kubernetes requires node, container, object, control-plane, and app signals.
8. Logs need low-cardinality labels.
9. Traces show distributed request causality.
10. Alert quality matters more than alert quantity.
