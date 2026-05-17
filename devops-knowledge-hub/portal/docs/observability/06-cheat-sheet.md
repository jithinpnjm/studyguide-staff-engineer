---
title: "Cheat Sheet"
sidebar_position: 6
---

# Observability — Cheat Sheet

Quick reference for common observability concepts.

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
| Alertmanager | Alert routing system |

Common query shapes:

```promql
rate(http_requests_total[5m])
```

```promql
up
```

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

---

## Metric Types

| Type | Use case |
|---|---|
| Counter | Requests, errors, completed jobs |
| Gauge | Memory, queue depth, open connections |
| Histogram | Latency and size distributions |
| Summary | Client-calculated quantiles |

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
```

Avoid unbounded labels:

```text
user_id
request_id
session_id
order_id
full_url
```

---

## Grafana Dashboard Shape

```text
top: golden signals
middle: dependencies and saturation
bottom: logs, traces, events, runbook links
```

---

## Loki

Basic LogQL:

```logql
{app="api"}
```

```logql
{app="api"} |= "timeout"
```

Keep labels low-cardinality.

---

## Alert Checklist

```text
owner
severity
impact
runbook
service label
environment label
dashboard link
clear threshold
```

---

## SLO Terms

```text
SLI: measured reliability signal
SLO: target for that signal
error budget: allowed unreliability
burn rate: speed of budget consumption
```
