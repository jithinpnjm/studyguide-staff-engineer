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

---

## Incident Response Basics

Observability tools only matter if you can act on what they show. Incident response is the structured process for doing that.

### The Incident Lifecycle

```
Detect → Triage → Mitigate → Communicate → Resolve → Learn
```

**Detect** — An alert fires, a user reports a problem, or an anomaly is spotted on a dashboard. Good detection means catching problems before users notice them.

**Triage** — Assess scope and severity. The senior engineer order of questions:
1. Are users hurting right now?
2. How many users are affected?
3. Is it getting worse or stable?
4. What is the fastest safe mitigation?

**Mitigate** — Stop the bleeding. This is not the same as fixing the root cause. A rollback, a feature flag disable, or traffic rerouting can restore service while investigation continues. Mitigation before root cause is almost always the right call during active user impact.

**Communicate** — Keep stakeholders informed with regular updates. A short status update every 15–30 minutes is better than silence. Use a standard format: what is happening, what is the impact, what is being done, when is the next update.

**Resolve** — Confirm the service is healthy. Check SLO burn rate is back to normal, error rate is at baseline, and latency is within bounds. Do not close the incident until metrics confirm recovery.

**Learn** — Write a postmortem. Capture what happened, why it happened, and what will prevent recurrence. This is where incidents become reliability improvements.

### Incident Severity Levels

| Severity | Meaning | Example |
|---|---|---|
| SEV1 | Critical — major user impact | Checkout down, login broken |
| SEV2 | High — partial user impact | Slow responses for 20% of users |
| SEV3 | Medium — degraded but functional | Non-critical feature broken |
| SEV4 | Low — minor or cosmetic | Dashboard shows wrong label |

### Incident Roles

**Incident Commander (IC)** — Owns the incident. Coordinates the response, makes decisions, delegates tasks, and drives communication. Does not do deep technical investigation.

**Tech Lead** — Leads the technical investigation. Digs into metrics, logs, and traces. Reports findings to the IC.

**Communications Lead** — Handles external and internal updates. Writes status page entries and stakeholder messages.

**Subject Matter Experts (SMEs)** — Domain owners called in as needed. Database team, networking team, platform team.

### What Good Detection Looks Like

- Alert fires within 5 minutes of user impact starting
- Alert message includes: what is broken, which service, severity, and a runbook link
- On-call engineer can triage from the alert alone without needing to search dashboards

### What Bad Detection Looks Like

- User reports the problem before any alert fires
- Alert fires but the message says "CPU high" with no context on user impact
- Multiple alerts fire for the same root cause (alert storm)

---

## Postmortem Basics

A postmortem is a structured document written after an incident to capture what happened and prevent recurrence. The goal is learning, not blame.

### Why Blameless Matters

Blame-focused postmortems cause engineers to hide mistakes and avoid on-call rotations. Blameless postmortems treat incidents as system failures, not individual failures. The question is always "what allowed this to happen?" not "who caused this?"

### What a Postmortem Includes

**Timeline** — A chronological sequence of events from first signal to resolution. Include timestamps. Include what was tried and what did not work.

**Impact** — How many users were affected, for how long, and what was the business impact. Be specific: "checkout was unavailable for 23 minutes affecting approximately 4,000 users."

**Detection quality** — How was the incident detected? Was it an alert, a user report, or a dashboard check? How long between the problem starting and detection? This section drives alert improvements.

**Root cause chain** — Not a single cause but a chain. Each step in the chain is a place where a safeguard could have stopped the incident. Example: bad config deployed → no staging validation → no canary check → full rollout → outage.

**Mitigation effectiveness** — What was tried, what worked, what did not work, and how long mitigation took. This section drives runbook improvements.

**Prevention actions** — Concrete, specific actions with owners and due dates. Vague actions like "improve monitoring" are not acceptable. Specific actions like "add alert for connection pool exhaustion by [date] owned by [team]" are.

### Postmortem Anti-Patterns

- Writing the postmortem but never tracking the action items
- Identifying a single root cause when there is always a chain
- Assigning blame to an individual rather than the system
- Writing the postmortem weeks after the incident when details are lost
- Action items with no owner or no due date
