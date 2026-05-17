---
title: "Beginner"
sidebar_position: 1
---

# Observability — Beginner

Observability is the ability to understand what is happening inside a system by looking at the signals it emits. Monitoring tells you whether something is wrong. Observability helps you understand why it is wrong.

Beginner mental model:

```text
system emits signals -> platform collects signals -> humans and automation interpret them -> action
```

For SREs, observability is not a dashboard project. It is the foundation for incident response, capacity planning, reliability engineering, and SLO-based decision making.

Memory palace — think of a hospital emergency room:

| Concept | Analogy | Meaning |
|---|---|---|
| Metrics | Vital signs | Quantitative health signals |
| Logs | Doctor notes | Event evidence |
| Traces | Patient journey | Request path |
| Alert | Emergency alarm | Needs action now |
| SLO | Treatment target | Reliability objective |
| Error Budget | Spare risk capacity | Allowed unreliability |
| Runbook | Emergency procedure | Known response steps |

---

## Monitoring vs Observability

| Concept | Meaning |
|---|---|
| Monitoring | Checks known symptoms and predefined conditions |
| Observability | Helps debug unknown failure modes from emitted signals |
| Alerting | Notifies humans or systems when action is required |
| Telemetry | Metrics, logs, traces, and events emitted by systems |

Monitoring asks: did a known bad thing happen? Observability asks: why is the system behaving this way?

Example:

```text
Monitoring: CPU > 90% for 10 minutes.
Observability: why did CPU increase, which requests changed, which deployment caused it, and which users are affected?
```

---

## The Three Pillars

### Metrics

Metrics are numerical measurements over time.

Examples:

```text
http_requests_total
http_request_duration_seconds
node_cpu_seconds_total
container_memory_working_set_bytes
postgres_connections
```

Metrics are efficient, aggregatable, and alert-friendly.

### Logs

Logs are timestamped records of events. Use structured logs:

```json
{"level":"error","service":"checkout","trace_id":"abc123","message":"payment timeout"}
```

Include: timestamp UTC, level, service, trace or request ID, useful context. Never leak secrets. Logs are useful for context, sequence, and root-cause investigation.

### Traces

Traces show the journey of one request across services.

```text
frontend -> api-gateway -> payment-service -> database -> queue
```

Tracing helps answer where time is spent, which dependency failed, and which user path is degraded. Traces are essential for distributed systems where latency may be spread across many services.

Sampling guidance:
- keep errors
- sample healthy traffic
- increase during incidents when safe

---

## Why No Single Pillar Is Enough

| Signal | Strength | Weakness |
|---|---|---|
| Metrics | Cheap, aggregate, alertable | Limited detail |
| Logs | Rich context | Expensive and noisy at scale |
| Traces | Request causality | Sampling and instrumentation needed |

A p99 latency alert is usually detected by metrics, investigated with traces, and explained with logs.

---

## Golden Signals, RED, and USE

### Golden Signals

For user-facing services, start with:

| Signal | Meaning |
|---|---|
| Latency | How long requests take |
| Traffic | Request volume |
| Errors | Failed requests |
| Saturation | How full the system is |

Example:

```text
latency: p95 and p99 request duration
traffic: requests per second
errors: 5xx rate
saturation: CPU, memory, DB connections, queue depth
```

### RED (for services)

- Rate
- Errors
- Duration

### USE (for infrastructure)

- Utilization
- Saturation
- Errors

Use RED for services. Use USE for infrastructure.

Important truth: average latency can look healthy while p99 is painful.

---

## Prometheus Basics

Prometheus is a time-series monitoring and alerting system that uses a pull model — scraping metrics from targets over HTTP.

Core ideas:

| Concept | Meaning |
|---|---|
| Target | Endpoint Prometheus scrapes |
| Scrape | HTTP pull of metrics |
| Metric | Time-series measurement |
| Label | Key/value dimension on metric |
| PromQL | Query language |
| Rule | Recording or alerting expression |
| Alertmanager | Alert routing and notification system |

A metric is:

```text
name + labels + value + time
```

Example:

```text
http_requests_total{service="api",status="500"}
```

Prometheus usually pulls metrics from endpoints like:

```text
http://service:9090/metrics
```

Benefits of the pull model:
- central scheduling
- target health visibility
- easier service discovery

---

## Metric Types

| Type | Meaning | Use |
|---|---|---|
| Counter | Only increases | requests, errors |
| Gauge | Current value | memory, queue depth |
| Histogram | Bucketed observations | latency |
| Summary | Client-side quantiles | niche use |

Important rule: use `rate()` with counters. Counters are cumulative; `rate()` converts the increase over time into a per-second rate.

First useful queries:

```promql
up
rate(http_requests_total[5m])
process_resident_memory_bytes
sum(rate(http_requests_total[5m])) by (service)
```

---

## Prometheus Configuration Shape

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"
  - "recording_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
```

Key beginner rule: a metric does not exist in Prometheus unless something exposes it and Prometheus is configured to scrape it.

---

## Exporters

Exporters expose metrics for systems that do not natively expose Prometheus format.

Common exporters:

| Exporter | Purpose |
|---|---|
| Node Exporter | Linux host metrics |
| cAdvisor | Container metrics |
| kube-state-metrics | Kubernetes object state |
| Blackbox Exporter | Probe HTTP/TCP/ICMP endpoints |
| PostgreSQL Exporter | Database metrics |
| Redis Exporter | Redis metrics |
| nginx exporter | Web server metrics |

Example Node Exporter metric:

```text
node_filesystem_avail_bytes
```

---

## Grafana Basics

Grafana visualizes data from Prometheus, Loki, Elasticsearch, CloudWatch, and other data sources.

Grafana concepts:

| Concept | Meaning |
|---|---|
| Data source | Backend queried by Grafana |
| Dashboard | Collection of panels |
| Panel | One graph/table/stat view |
| Variable | Dynamic dashboard filter |
| Alert | Notification rule from panel or query |

Good dashboard panels answer operational questions, not just display random metrics. A dashboard should answer a question in under 10 seconds.

Alertmanager handles:
- grouping
- deduplication
- silences
- inhibition
- routing
- notification delivery

Example routing:

```text
warning -> Slack
critical -> PagerDuty
```

---

## Loki Basics

Loki is a log aggregation system designed to work well with Grafana. It indexes labels rather than full log text, which can make it cheaper than full-text log systems for some use cases.

Loki mental model:

```text
application logs -> collector -> Loki -> LogQL -> Grafana
```

Important rule: use low-cardinality labels. Do not label logs with request IDs or user IDs.

---

## Cardinality

Cardinality is the number of unique time series created by metric labels.

Bad metric:

```text
http_requests_total{user_id="123",request_id="abc",path="/orders/987"}
```

Better metric:

```text
http_requests_total{service="orders",method="GET",route="/orders/:id",status="200"}
```

Dangerous labels: user_id, request_id, trace_id, full URL with IDs, random GUIDs.

High cardinality causes:
- More storage
- Slower queries
- Higher memory usage
- Expensive remote storage
- Alert rule pressure

Beginner rule: use bounded labels for metrics and use logs/traces for high-cardinality context.

---

## Beginner Takeaways

1. Metrics tell you what is happening over time.
2. Logs explain events and context.
3. Traces show distributed request paths.
4. Prometheus scrapes targets over HTTP.
5. Grafana visualizes and alerts on telemetry.
6. Loki stores logs with labels and LogQL.
7. Cardinality must be controlled.
8. Good observability starts from operational questions.
9. Use RED for services, USE for infrastructure.
10. Alert on symptoms; investigate causes.
