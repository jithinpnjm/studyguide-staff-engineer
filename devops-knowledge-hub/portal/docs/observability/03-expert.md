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

Cardinality must be reviewed like capacity planning.

---

## Prometheus Scaling

Scaling options:

| Pattern | Use case |
|---|---|
| Recording rules | Precompute expensive queries |
| Federation | Aggregate selected metrics |
| Remote write | Send metrics to long-term storage |
| Sharding | Split scrape load |
| Thanos/Cortex/Mimir | Global query and long-term metrics |
| Retention tuning | Reduce local disk pressure |

Prometheus anti-patterns:

- Scraping too frequently without need
- High-cardinality labels
- Expensive dashboard queries
- Alert rules over raw high-volume metrics
- No ownership of noisy metrics

---

## Recording Rules

Recording rules save expensive queries as new time series.

```yaml
groups:
  - name: service-recording-rules
    rules:
      - record: service:http_requests:rate5m
        expr: sum(rate(http_requests_total[5m])) by (service, environment)
```

Use recording rules for:

- Expensive repeated dashboard queries
- Common SLI calculations
- Alert inputs
- Aggregations over many series

Do not create recording rules for every ad-hoc query.

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

## SLO-Based Alerting

SLO alerts should detect fast and slow error-budget burn.

Concept:

```text
fast burn: urgent, high-impact degradation
slow burn: sustained degradation that will exhaust budget
```

Example error ratio query:

```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

SLO-based alerting reduces noise because it focuses on user-facing reliability objectives.

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
correlation IDs
low-cardinality labels
clear retention classes
redaction of sensitive values
```

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

## Expert Takeaways

1. Observability is a production platform, not only dashboards.
2. Cardinality is a scalability and cost constraint.
3. SLOs make alerts user-impact aware.
4. Recording rules reduce repeated query cost.
5. Logs need retention and label discipline.
6. Traces need sampling strategy.
7. Alert quality must be reviewed after incidents.
8. Telemetry must have ownership, or it becomes noise.
