---
title: "Hands-On Labs"
sidebar_position: 5
---

# Observability — Hands-On Labs

These labs build practical observability skill using Prometheus, Grafana, Loki, Kubernetes signals, PromQL, alerting, and SLO thinking.

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

Review question: which queries are gauges and which require `rate()`?

---

## Lab 5: Grafana Dashboard Design

**Goal:** Design a useful service dashboard.

Dashboard rows:

```text
row 1: golden signals
row 2: dependency health
row 3: saturation
row 4: recent deploy/version
row 5: links to logs, traces, and runbook
```

Dashboard review checklist:

- Can I see user impact in 30 seconds?
- Can I identify saturation?
- Can I identify the failing dependency?
- Can I filter by environment and service?
- Are variables bounded and useful?
- Is there a link to the runbook?

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
Alert threshold:
Runbook:
Owner:
```

Example:

```text
User journey: checkout request
SLI: successful checkout HTTP requests / total checkout HTTP requests
SLO target: 99.9% over 30 days
Owner: payments team
```

---

## Lab 9: Kubernetes Monitoring Checklist

**Goal:** Identify what must be visible for a Kubernetes service.

Checklist:

```text
pod restarts
container memory
container CPU throttling
deployment unavailable replicas
service request rate
service error rate
service latency
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
