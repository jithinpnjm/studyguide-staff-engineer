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

---

## Metric Types

| Type | Use case | Query pattern |
|---|---|---|
| Counter | Monotonic count | `rate()` |
| Gauge | Current value | direct query |
| Histogram | Distribution | `histogram_quantile()` |
| Summary | Client-side quantile | direct quantile series |

Use counters for requests and errors. Use histograms for latency. Use gauges for memory, queue depth, open connections, and capacity signals.

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

---

## SLI, SLO, Error Budget

| Term | Meaning |
|---|---|
| SLI | Measured reliability signal |
| SLO | Target for that signal |
| Error budget | Allowed unreliability |

Example:

```text
SLI: successful HTTP requests / total HTTP requests
SLO: 99.9% success over 30 days
Error budget: 0.1% allowed failures
```

SLOs make alerting business-aware.

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
top: golden signals
middle: dependencies and saturation
bottom: logs, traces, and infrastructure detail
```

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

---

## Loki And Logs

Loki query examples:

```logql
{namespace="payments"} |= "error"
```

```logql
{app="api"} | json | level="error"
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

---

## Intermediate Takeaways

1. PromQL is the query language for Prometheus metrics.
2. SLOs connect telemetry to business reliability.
3. Dashboards should answer operational questions.
4. Kubernetes requires node, container, object, control-plane, and app signals.
5. Logs need low-cardinality labels.
6. Traces show distributed request causality.
7. Alert quality matters more than alert quantity.
8. Cardinality control is part of platform reliability.
