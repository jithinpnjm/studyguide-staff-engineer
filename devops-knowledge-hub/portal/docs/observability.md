---
title: "📊 Observability"
sidebar_position: 3
description: "Zero to hero study guide for Observability — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

Observability is the practice of understanding system internals from external outputs. The shift from monitoring (checking if things are up) to observability (understanding WHY things are behaving the way they are) is what enables engineers to debug distributed systems without guessing.

For Staff/Principal engineers: you design the observability platform that all teams build on. Getting this right means incidents are resolved in minutes not hours, capacity planning is data-driven, and SLO conversations with business are grounded in reality.

---

## 📋 Prerequisites & Mental Models

**The three pillars — Metrics, Logs, Traces:**
- **Metrics:** numeric measurements over time. Efficient, alertable, aggregatable. Tell you WHAT is happening.
- **Logs:** timestamped event records. Tell you WHAT happened and show the sequence.
- **Traces:** end-to-end request flow across services. Tell you WHERE time was spent in a distributed system.

No single pillar is sufficient. A trace with no metrics misses the 1% of slow requests that manifest as a p99 alert. Metrics without logs tell you something is wrong but not why. Logs without traces can't show distributed causality.

**SLO-based alerting vs symptom-based:** alert on what users experience (error rate, latency), not on what the system does internally (CPU, memory). Alert fatigue comes from internal metrics that spike without user impact.

**Cardinality is the enemy of scale** — high-cardinality labels (user_id, request_id) on metrics explode storage and query time. Keep label cardinality bounded. Use traces for high-cardinality data.

---

## 🔷 Core Concepts

### Prometheus

Time-series metrics database. Pull-based: Prometheus scrapes `/metrics` endpoints from targets.

**Data model:**
```
http_requests_total{method="GET", status="200", service="api"} 1234 1672531200000
│                  │                                           │     └ timestamp (ms)
└ metric name      └ labels (key=value pairs)                  └ value
```

**Metric types:**
- **Counter:** monotonically increasing (request count, errors). Never decreases (except on restart). Use `rate()` to get per-second rate.
- **Gauge:** current value, can go up or down (memory usage, active connections, temperature).
- **Histogram:** samples observations into configurable buckets (request duration, response size). Calculates `_count`, `_sum`, and `_bucket`. Use for latency percentiles.
- **Summary:** similar to histogram but calculates quantiles client-side (not aggregatable across instances — use histograms instead).

**Key PromQL functions:**
```promql
# Rate of increase (use for counters)
rate(http_requests_total[5m])

# Ratio of errors to total
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# p99 latency from histogram
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))

# Memory usage percentage
container_memory_working_set_bytes / container_spec_memory_limit_bytes

# Aggregation
sum(rate(http_requests_total[5m])) by (service)
sum without (pod, instance) (rate(http_requests_total[5m]))

# Alerting: sustained high error rate
(sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) > 0.01
```

**Prometheus architecture:**
- Prometheus server: scrapes targets, stores TSDB, evaluates recording rules and alerts
- Alertmanager: receives alerts, deduplicates, routes to receivers (PagerDuty, Slack)
- Pushgateway: for short-lived jobs (batch, CI) that can't be scraped (avoid over-using)
- Exporters: adapt non-Prometheus metrics (node_exporter, postgres_exporter, blackbox_exporter)

**Long-term storage:** Prometheus local storage is not designed for multi-year retention. Use Thanos or Cortex (now Mimir) for global view and long-term storage. Thanos adds: multi-Prometheus deduplication, object storage backend (S3/GCS), unlimited retention.

### Grafana

Visualization layer for metrics, logs, and traces. Connects to Prometheus, Loki, Tempo, Elasticsearch, and 50+ other data sources.

**Effective dashboard design:**
1. Single business metric at top (SLO compliance, error rate)
2. RED (Rate, Errors, Duration) per service
3. Resource utilization (CPU, memory, disk, network)
4. Links to runbooks and related dashboards

**Grafana variables** — parameterize dashboards with dropdowns:
```
Variable: namespace
Type: Query
Query: label_values(kube_pod_info, namespace)
```

**Alerting in Grafana 9+** — use Grafana unified alerting with alert rules, contact points (PagerDuty, Slack), and notification policies. Replaces Prometheus Alertmanager for teams using Grafana Cloud.

### Loki — Log Aggregation

Loki is "Prometheus for logs." Indexes only metadata (labels), not the full log content. Much cheaper than Elasticsearch at scale.

**Architecture:**
- **Promtail** (or Fluent Bit, Fluentd): agent on each node, tails log files and /var/log, ships to Loki
- **Loki:** receives log streams, stores in chunks (compressed), indexes labels
- **Grafana:** queries Loki via LogQL

**LogQL:**
```logql
# Filter logs
{app="api", namespace="production"} |= "ERROR"

# Filter with regex
{app="api"} |~ "timeout|connection refused"

# Parse JSON logs and filter
{app="api"} | json | level="error" | duration > 500ms

# Log rate (for alerting on error spike)
sum(rate({app="api"} |= "ERROR" [5m])) by (pod)
```

**Label design for Loki:** only use labels for values with bounded cardinality (namespace, app, pod_name, environment). Do NOT use user_id, request_id as labels — use them as parsed fields in LogQL.

### Distributed Tracing — Tempo & Jaeger

**Why tracing:** in a distributed system, a single user request touches 10+ services. Logs from each service are siloed. Tracing connects them into a unified view showing: which service was slow, which DB query was the bottleneck, where errors originated.

**OpenTelemetry (OTel):** the standard for instrumentation. Language SDKs for Go, Python, Java, Node, etc. Emits traces, metrics, and logs in a vendor-neutral format. Collector receives OTel data and forwards to Tempo/Jaeger/etc.

**Key concepts:**
- **Trace:** the complete journey of a request across services
- **Span:** one unit of work (one service call, one DB query). Contains: operation name, timestamps, tags, logs, status.
- **Trace context propagation:** HTTP headers (W3C Trace-Context: `traceparent`) carry the trace ID across service boundaries

**Grafana Tempo:** backend for traces, integrates with Grafana. Stores traces in object storage (S3). No index — searches by trace ID (fast) or service graph (via Prometheus metrics).

**Sampling strategies:**
- Head-based sampling: decision at request start (100% or N% of requests)
- Tail-based sampling: decision at request end, after seeing if request was slow/errored (better, more complex)
- Adaptive sampling: auto-adjust sample rate to stay within budget

### SLOs & Error Budgets

**SLI (Service Level Indicator):** the metric we measure. e.g., `ratio of successful requests`

**SLO (Service Level Objective):** the target we set. e.g., `99.9% of requests succeed over 30 days`

**Error Budget:** how much unreliability the SLO allows. 99.9% SLO = 0.1% error budget = 43.2 minutes/month.

**Error budget policy:** when budget is depleted, halt new feature work and focus on reliability. This converts an abstract goal ("be reliable") into a concrete negotiation between product (features) and SRE (reliability).

**Multi-window, multi-burn-rate alerting (Google SRE book):**
```yaml
# Alert when burning budget 14x faster than sustainable over 1h (page immediately)
- alert: HighErrorBudgetBurnRate
  expr: |
    (
      sum(rate(http_requests_total{code=~"5.."}[1h])) / sum(rate(http_requests_total[1h]))
    ) > (14 * (1 - 0.999))
  for: 2m
  annotations:
    summary: "14x burn rate — 1h window"

# Alert when burning 3x faster over 6h (ticket/warning)
- alert: MediumErrorBudgetBurnRate
  expr: |
    (sum(rate(http_requests_total{code=~"5.."}[6h])) / sum(rate(http_requests_total[6h])))
    > (3 * (1 - 0.999))
```

---

## 🛠️ Tools & Ecosystem

| Tool | Purpose |
|------|---------|
| Prometheus | Metrics collection and alerting |
| Grafana | Visualization and dashboarding |
| Loki | Log aggregation (Prometheus for logs) |
| Tempo | Distributed tracing backend |
| Jaeger | Distributed tracing (self-hosted) |
| OpenTelemetry | Instrumentation standard (traces + metrics + logs) |
| Thanos / Mimir | Long-term Prometheus storage + global query |
| Alertmanager | Alert routing and deduplication |
| VictoriaMetrics | High-performance Prometheus-compatible alternative |
| Datadog | Full SaaS observability (metrics + logs + APM) |
| New Relic | SaaS observability platform |
| Elastic (ELK) | Log search and analytics (high cost at scale) |
| PagerDuty / Opsgenie | On-call alerting and incident management |
| Blackbox Exporter | External probing (HTTP, TCP, DNS, ICMP) |

---

## 🏗️ Architecture Patterns

### Prometheus Operator (kube-prometheus-stack)

Deploy the full monitoring stack with one Helm chart:
```bash
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack   --set prometheus.prometheusSpec.retention=30d   --set prometheus.prometheusSpec.retentionSize=50GB   --set grafana.adminPassword=changeme
```

Includes: Prometheus, Grafana, Alertmanager, node-exporter, kube-state-metrics, and default dashboards/alerts for Kubernetes.

**ServiceMonitor** — tells Prometheus what to scrape:
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
spec:
  selector:
    matchLabels: {app: myapp}
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Centralized Logging Architecture

```
Kubernetes Pods
  → Fluent Bit (DaemonSet, per node)
    → Loki (or S3 for long-term)
      → Grafana (query via LogQL)
      → Alertmanager (log-based alerts)
```

**Fluent Bit config (Kubernetes):**
```ini
[SERVICE]
    Flush 5
    Log_Level info

[INPUT]
    Name              tail
    Path              /var/log/containers/*.log
    Parser            cri
    Tag               kube.*
    Mem_Buf_Limit     5MB

[FILTER]
    Name   kubernetes
    Match  kube.*
    Merge_Log On
    K8S-Logging.Parser On

[OUTPUT]
    Name   loki
    Match  kube.*
    host   loki.monitoring.svc.cluster.local
    port   3100
    labels job=fluentbit,namespace=$kubernetes['namespace_name'],pod=$kubernetes['pod_name']
```

### Grafana Stack (LGTM)

Logs (Loki) + Metrics (Grafana Mimir) + Traces (Tempo) + Dashboards (Grafana). Run the full stack on-premises or use Grafana Cloud (hosted SaaS).

---

## ⚙️ Production Operations

### Alert Design

**Good alert:** actionable, relevant to users, has a clear runbook, fires rarely but importantly.

**Bad alert:** fires on a metric the on-call cannot act on, no runbook, fires multiple times per week.

Alert fatigue is the #1 cause of missed critical alerts. If your on-call gets >10 alerts per shift, audit and tune.

**Alert hierarchy:**
1. **Page (immediate):** SLO breach, P1 customer impact, data loss risk
2. **Ticket (business hours):** approaching error budget, resource near limit, performance degradation
3. **Info (log only):** anomaly detected, worth investigating during next working day

### On-Call Tooling

Recording rules for expensive queries:
```yaml
groups:
- name: recording_rules
  interval: 30s
  rules:
  - record: job:http_requests_total:rate5m
    expr: sum(rate(http_requests_total[5m])) by (job)
  - record: job:http_errors_total:rate5m
    expr: sum(rate(http_requests_total{status=~"5.."}[5m])) by (job)
```

Pre-compute expensive queries → dashboards and alerts load faster.

---

## 📊 Key Metrics Per Layer

```
Application layer:
  RED: request Rate, Error rate, Duration (latency percentiles)
  Business KPIs: orders/min, signups, revenue events

Infrastructure layer:
  USE: resource Utilization, Saturation (queue depth), Errors
  Kubernetes: pod restarts, pending pods, PVC capacity

Platform layer:
  Control plane: API server latency, etcd latency
  Networking: DNS latency, packet drops, connection errors
  Storage: IOPS, throughput, latency, capacity
```

---

## 🔐 Security Considerations

**Access control:** Grafana with SSO (Okta/Google). Role-based access — engineers see their services, on-call sees all, admins can configure.

**Data privacy:** logs may contain PII. Redact sensitive fields at the shipper (Fluent Bit transform). Don't log request bodies by default. Retention policies to comply with GDPR.

**Alert routing security:** PagerDuty integrations need secure webhooks. Rotate integration keys when team members leave.

---

## 🎓 Staff/Principal Engineer Perspective

**Observability as a platform service** — the platform team provides the stack (Prometheus, Grafana, Loki, Tempo), the operational model (how to deploy ServiceMonitors, how to write dashboards as code), and the SLO framework. Teams plug into it.

**Dashboards as code** — Grafana dashboards in JSON committed to Git. Use `grafonnet` (Jsonnet library) or Terraform's Grafana provider. Never create dashboards via UI that aren't backed by code.

**Cost of observability:** Prometheus storage and Loki ingestion are not free. High-cardinality metrics and noisy log sources can make the observability stack more expensive than the application. Audit every service's metrics cardinality. Use recording rules to pre-aggregate.

**The three questions any alert must answer:** What is broken? Why is it broken? What do I do? If your alert can't answer all three (with runbook links), it's incomplete.

---

## 💥 Failure Modes & Incident Patterns

**Prometheus scrape target disappearing** — service disappeared, label changed, port changed. Prometheus shows target as `DOWN`. Check `up` metric: `up{job="myapp"} == 0`.

**Alert storm during incident** — 50 alerts fire at once. Alertmanager inhibition rules suppress child alerts when parent fires. Group related alerts to send one notification.

**Loki ingestion backlog** — log volume spikes (error storm), Loki can't keep up. Agents buffer on disk. Tune: Loki ingestion rate limits, Fluent Bit backpressure, scale Loki distributor.

**Trace loss at high rate** — sampling too aggressive during incident. Tail-based sampling helps (sample 100% of errored requests). Use adaptive sampling.

---

## 💼 Interview Prep

**"How do you design alerting for a new service?"**
Define SLIs (what matters to users), set SLO targets, instrument for RED metrics, write multi-window burn-rate alerts, create runbooks, test with synthetic traffic, review with on-call team.

**"What's the difference between monitoring and observability?"**
Monitoring: checking known-unknowns (is the service up? Is CPU high?). Observability: understanding unknown-unknowns via high-cardinality exploration of metrics, logs, and traces. You can be monitored without being observable.

---

## 📚 Key Takeaways

1. **Alert on user impact** — SLO-based alerting (error rate, latency) not internal metrics (CPU, memory)
2. **Cardinality is the enemy of scale** — bounded label cardinality in Prometheus; high-cardinality in traces
3. **The three pillars are complementary** — metrics for WHAT, logs for sequence, traces for WHERE in distributed systems
4. **Recording rules are mandatory at scale** — pre-aggregate expensive queries for dashboard and alert performance
5. **Dashboards as code** — Grafana JSON in Git, no manual-only dashboards in production
6. **Error budgets convert reliability into product negotiation** — concrete, automated, blameless
7. **Tail-based sampling catches what head-based misses** — sample 100% of slow/errored requests
8. **Alert fatigue kills on-call culture** — >10 alerts per shift = something needs tuning, not acknowledging
9. **Loki is Prometheus for logs** — same query pattern, much cheaper than Elasticsearch at scale
10. **Runbooks must answer: what, why, and what to do** — incomplete runbooks waste incident response time



---

## 📁 Source Documents

> 4 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[Prometheus+Grafana] 1741106482909](http://localhost:8765/api/documents/5203a528-59d3-4f0d-8673-c1afa3d27f3a/view) | PDF | intermediate |
| [[Prometheus+Grafana] 1741579830045](http://localhost:8765/api/documents/6c8c8c2b-fe2c-4dcb-8a83-17c015d231d0/view) | PDF | intermediate |
| [[Prometheus+Grafana] 1742060929644](http://localhost:8765/api/documents/a809c9f4-40d4-482e-a9f3-0dfe2ad581e2/view) | PDF | intermediate |
| [[Grafana+Prometheus] 1738604702921](http://localhost:8765/api/documents/d2060a34-e60b-49a4-a6e9-00260acdeb54/view) | PDF | intermediate |


<AIChatWidget domain="observability" title="Ask AI about Observability" />

---

## [SRE] Foundations: Observability, SLOs, And Incident Response Premium Teaching Guide

## Foundations: Observability, SLOs, And Incident Response Premium Teaching Guide

Reliable systems are built by seeing clearly, deciding calmly, and learning continuously.

Observability gives visibility into behavior. SLOs define reliability targets. Incident response restores service under pressure.

This guide teaches observability from first principles to production-grade reliability operations.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — metrics, logs, traces, alerts.
2. **Intermediate Layer** — SLIs, SLOs, dashboards, runbooks.
3. **Advanced Layer** — burn-rate alerts, tracing strategy, incident command.
4. **Production SRE Layer** — outages, mitigations, postmortems, alert quality.
5. **Interview Layer** — explain reliability tradeoffs clearly.

---

## Memory Palace: Hospital Emergency Room

| Concept | Analogy | Meaning |
|---|---|---|
| Metrics | Vital signs | Quantitative health signals |
| Logs | Doctor notes | Event evidence |
| Traces | Patient journey | Request path |
| Alert | Emergency alarm | Needs action now |
| SLO | Treatment target | Reliability objective |
| Error Budget | Spare risk capacity | Allowed unreliability |
| IC | Lead doctor | Coordinates response |
| Runbook | Emergency procedure | Known response steps |
| Postmortem | Case review | Learn and improve |

Senior questions first:

- Are users hurting?
- How many?
- Is it getting worse?
- What is the fastest safe mitigation?

---

## Beginner Layer: Monitoring vs Observability

Monitoring asks:

> Did a known bad thing happen?

Observability asks:

> Why is the system behaving this way?

Three core signals:

- Metrics = trends and alerting
- Logs = exact events
- Traces = request path across services

---

## Beginner Layer: Golden Signals / RED / USE

### Golden Signals

- Latency
- Traffic
- Errors
- Saturation

### RED

- Rate
- Errors
- Duration

### USE

- Utilization
- Saturation
- Errors

Use RED for services. Use USE for infrastructure.

---

## Beginner Layer: Metrics Foundations

Track:

- requests per second
- error rate
- p95 and p99 latency
- queue depth
- CPU and memory
- disk and network pressure

Important truth:

> Average latency can look healthy while p99 is painful.

Metric types:

- Counter
- Gauge
- Histogram
- Summary

---

## Beginner Layer: Logging Foundations

Use structured logs.

```json
{"level":"error","service":"checkout","trace_id":"abc123","message":"payment timeout"}
```

Include:

- timestamp UTC
- level
- service
- trace or request id
- useful context

Never leak secrets.

---

## Beginner Layer: Tracing Foundations

```text
frontend -> api -> auth -> payments -> db
```

Tracing helps answer:

- where time is spent
- which dependency failed
- which user path is degraded

Sampling guidance:

- keep errors
- sample healthy traffic
- increase during incidents when safe

---

## Intermediate Layer: SLI / SLO / SLA

### SLI

Measured user experience.

Example:

Fraction of checkout requests succeeding under 500ms.

### SLO

Target objective.

Example:

99.9% over rolling 28 days.

### SLA

External commercial promise.

Usually looser than SLO.

---

## Intermediate Layer: Error Budgets

99.9% means 0.1% unreliability budget.

Use it to guide risk:

- healthy budget -> ship faster
- budget exhausted -> prioritize reliability

Error budgets align product speed with operational reality.

---

## Intermediate Layer: Alerting Philosophy

Page humans only for actionable user-impacting issues.

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

Alert on symptoms. Investigate causes.

---

## Intermediate Layer: Dashboards That Help

Top row:

1. request rate
2. error rate
3. p95/p99 latency
4. saturation

Second row:

- pods / restarts
- CPU / memory
- queue depth

Third row:

- dependencies
- deploy markers
- feature flags

A dashboard should answer a question in under 10 seconds.

---

## Advanced Layer: Burn Rate Thinking

- 14x burn = severe active issue
- 3x burn = meaningful degradation
- 1x burn = on target

Burn-rate alerts tie signals to commitments rather than arbitrary thresholds.

---

## Advanced Layer: Incident Lifecycle

### Detect

Alert, user report, synthetic probe.

### Triage

- scope
- user impact
- worsening or stable
- recent changes

### Mitigate

1. rollback
2. disable feature
3. reroute traffic
4. scale out
5. shed load
6. restart last

### Communicate

Clear regular updates.

### Resolve
nMetrics normal and understood.

### Learn

Postmortem with tracked actions.

---

## Advanced Layer: Incident Roles

| Role | Responsibility |
|---|---|
| Incident Commander | Coordination |
| Tech Lead | Debugging and mitigation |
| Comms | Stakeholder updates |
| SMEs | Focused expertise |

---

## Production SRE Layer: Real Incidents

### CPU High, Users Fine

Observe first. Do not auto-page on infrastructure noise alone.

### Errors After Deploy

If confidence is high, rollback quickly before deep analysis.

### Users Slow, Metrics Fine

Check p99/p999, region split, traces, synthetic flows.

### Nightly Noisy Alerts

Fix alerts, not people.

### Dependency Brownout

Your service may be healthy internally while users fail externally. Inspect downstream dependencies.

---

## Production SRE Layer: Troubleshooting Flow

### Traffic Drop

Check:

- load balancer
- DNS
- deploy markers
- upstream routing

### Error Spike

Check:

- latest deploy
- dependency errors
- auth changes
- saturation

### Latency Increase

Check:

- p95/p99 split
- traces
- queue depth
- database latency

### Alert Storm

Check:

- root dependency causing fan-out alerts
- duplicate rules
- noisy thresholds

---

## Postmortems That Matter

Include:

- timeline
- impact
- detection quality
- root cause chain
- mitigation effectiveness
- prevention actions
- owners and due dates

Blameless means focus on system improvement, not avoiding accountability.

---

## Tools To Know

- Prometheus
- Grafana
- Alertmanager
- Loki
- OpenSearch / Elasticsearch
- OpenTelemetry
- Jaeger / Tempo
- PagerDuty / Opsgenie

---

## Interview Layer: Strong Answers

### Monitoring vs Observability?

> Monitoring detects known failure conditions. Observability helps explain unknown behavior using telemetry.

### Why averages mislead?

> Averages hide tail pain. Many users can suffer while the mean looks normal.

### Why burn-rate alerts?

> They map incidents to SLO risk, helping prioritize what truly threatens commitments.

### How do you run a SEV1?

> Establish command, assess impact, mitigate quickly, communicate clearly, and capture a clean timeline.

---

## Labs

### Beginner

1. Build one service dashboard.
2. Add latency and error alerts.
3. Add structured logs.

### Intermediate

1. Define an SLO and budget.
2. Add synthetic probe.
3. Trace a slow endpoint.

### Advanced

1. Add burn-rate alerts.
2. Run a mock incident drill.
3. Write a postmortem.
4. Remove 50% noisy alerts safely.

---

## Memory Review

- Why is p99 often better than average?
- Why should alerts map to actions?
- What does an error budget buy you?
- Why rollback before deep debugging sometimes?
- Why do postmortems need owners?

---

## Senior Summary

> I page only on user-impacting symptoms tied to SLO risk, then use metrics, logs, and traces to narrow blast radius quickly. During incidents I prioritize mitigation over elegant root-cause hunting, communicate clearly, and convert outages into tracked reliability improvements.

---

## [SRE] Foundations: Prometheus, Grafana, And Alertmanager Premium Teaching Guide

## Foundations: Prometheus, Grafana, And Alertmanager Premium Teaching Guide

Prometheus, Grafana, and Alertmanager form one of the most common observability stacks used by SRE and platform teams.

Prometheus collects metrics and evaluates rules. Grafana visualizes data. Alertmanager routes alerts to humans and systems.

This guide teaches the stack from first principles to production-grade operations.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — metrics, scraping, dashboards, alerts.
2. **Intermediate Layer** — PromQL, exporters, rules, routing.
3. **Advanced Layer** — cardinality, recording rules, scaling, SLO alerts.
4. **Production SRE Layer** — missing metrics, noisy alerts, bad dashboards.
5. **Interview Layer** — explain a real metrics platform clearly.

---

## Memory Palace: Hospital Monitoring Ward

| Tool | Analogy | Meaning |
|---|---|---|
| Prometheus | Bedside monitor | Continuously reads signals |
| Grafana | Nurse station screen | Visual overview |
| Alertmanager | Paging desk | Sends alerts to responders |
| Exporter | Sensor adapter | Converts system signals |
| Rule | Escalation policy | Trigger condition |
| Dashboard | Ward board | Shared situational awareness |

---

## Beginner Layer: Metrics Model

A metric is usually:

```text
name + labels + value + time
```

Example:

```text
http_requests_total{service="api",status="500"}
```

Labels create dimensions for filtering and aggregation.

---

## Beginner Layer: Metric Types

| Type | Meaning | Use |
|---|---|---|
| Counter | Only increases | requests, errors |
| Gauge | Current value | memory, queue depth |
| Histogram | Bucketed observations | latency |
| Summary | Client-side quantiles | niche use |

Important rule:

Use `rate()` with counters.

---

## Beginner Layer: Pull Model

Prometheus usually scrapes targets over HTTP.

```text
app /metrics <- Prometheus scrape every interval
```

Benefits:

- central scheduling
- target health visibility
- easier service discovery

---

## Beginner Layer: First Useful Queries

```promql
up
rate(http_requests_total[5m])
process_resident_memory_bytes
sum(rate(http_requests_total[5m])) by (service)
```

---

## Intermediate Layer: RED And USE Dashboards

### RED for services

- Rate
- Errors
- Duration

### USE for infrastructure

- Utilization
- Saturation
- Errors

Start dashboards with these before vanity metrics.

---

## Intermediate Layer: Exporters

Common exporters:

- node_exporter
- kube-state-metrics
- blackbox_exporter
- postgres_exporter
- redis_exporter
- nginx exporter

Exporters expose system facts. They do not replace thinking.

---

## Intermediate Layer: Alert Rules

Example pattern:

```text
High error rate for 5 minutes
```

Good alerts include:

- severity
- owner/team
- summary
- runbook link
- clear action

Use `for:` to avoid noisy short spikes.

---

## Intermediate Layer: Alertmanager

Alertmanager handles:

- grouping
- deduplication
- silences
- inhibition
- routing
- notification delivery

Example:

```text
warning -> Slack
critical -> PagerDuty
```

---

## Advanced Layer: Histograms And Percentiles

Use histograms for p95/p99 latency.

Important truth:

Do not average percentiles.

Use bucket aggregation first, then quantiles.

Tail latency often matters more than averages.

---

## Advanced Layer: Cardinality

Cardinality = number of unique time series.

Dangerous labels:

- user_id
- request_id
- trace_id
- full URL with IDs
- random GUIDs

High cardinality causes:

- high memory use
- slow queries
- large storage growth

Design labels intentionally.

---

## Advanced Layer: Recording Rules

Use recording rules to precompute expensive queries.

Good for:

- repeated dashboards
- SLO math
- expensive histograms
- faster alerts

---

## Advanced Layer: Scaling Prometheus

Paths:

- bigger single instance
- federation
- sharding
- Thanos
- Mimir/Cortex style systems

Use complexity only when needed.

---

## Advanced Layer: SLO Burn Alerts

Better than arbitrary CPU pages.

Burn alerts page when reliability commitments are being consumed too quickly.

This aligns paging with user impact.

---

## Production SRE Layer: Real Incidents

### Grafana Shows No Data

Check:

- time range
- datasource
- query labels
- target scrape health

### Target Down (`up=0`)

Check:

- app running
- port/path correct
- network policy/firewall
- service discovery labels

### Prometheus Memory High

Likely causes:

- cardinality explosion
- too many targets
- expensive queries

### Alert Never Paged

Check:

- rule firing?
- routed correctly?
- silence active?
- receiver healthy?

### Dashboard Looked Fine But Users Slow

Cause often:

- averages only
n- no p95/p99
- no dependency panels

---

## Production SRE Layer: Dashboard Design

Top row:

1. request rate
2. error rate
3. p95/p99 latency
4. saturation

Second row:

- resources
- dependency latency
- queue depth
- deploy markers

A dashboard should answer a question in under 10 seconds.

---

## Interview Layer: Strong Answers

### Why Prometheus pull model?

> Centralized scraping simplifies discovery, health visibility, and target control.

### Counter vs Gauge?

> Counter only increases and is used with rate functions. Gauge represents a current value.

### Why is cardinality dangerous?

> Too many unique label combinations increase memory, storage, and query cost.

### How would you page reliably?

> Use actionable alerts tied to user impact or SLO burn, with ownership and runbooks.

---

## Labs

### Beginner

1. Scrape node_exporter.
2. Query `up`.
3. Build one CPU dashboard.

### Intermediate

1. Build RED dashboard.
2. Create error-rate alert.
3. Route warnings and critical alerts differently.

### Advanced

1. Simulate cardinality problem.
2. Add recording rules.
3. Build burn-rate alerts.
4. Configure inhibition.

---

## Memory Review

- Why use `rate()` with counters?
- Why are user IDs bad labels?
- Why do averages hide pain?
- What is inhibition?
- Why should dashboards begin with RED metrics?

---

## Senior Summary

> I design metrics platforms around actionable low-cardinality signals. Services expose counters, gauges, and histograms. Prometheus scrapes and evaluates rules, Grafana visualizes RED and USE dashboards, and Alertmanager routes only actionable alerts with clear ownership. I control cardinality, precompute expensive queries, and align paging with SLO risk.
