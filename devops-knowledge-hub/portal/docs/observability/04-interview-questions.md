---
title: "Interview Questions"
sidebar_position: 4
---

# Observability — Interview Questions

Strong observability answers explain how you detect user impact, debug distributed systems, control telemetry cost, and design actionable alerts. Weak answers only list Prometheus and Grafana features.

---

## Beginner Questions

### What is observability?

Observability is the ability to understand a system's internal state from the signals it emits: metrics, logs, traces, and events.

### Monitoring vs observability?

Monitoring detects known failure conditions. Observability helps explain unknown behavior using telemetry — it allows you to ask new questions during an incident using the signals the system emits.

### What are the three pillars?

Metrics, logs, and traces. Metrics show numeric trends, logs show event context, and traces show request flow across services.

### Why are metrics useful?

Metrics are cheap to store, easy to aggregate, and suitable for dashboards and alerts.

### Why are logs useful?

Logs provide rich event context, error messages, request details, and sequence of behavior.

### Why are traces useful?

Traces show where time is spent across distributed services and help find the slow or failing dependency.

### What is the RED method?

Rate, Errors, Duration — for measuring service health. Use RED for services.

### What is the USE method?

Utilization, Saturation, Errors — for measuring infrastructure health. Use USE for infrastructure components like CPUs, disks, and queues.

### What are the Golden Signals?

Latency, Traffic, Errors, and Saturation. These four signals cover most user-facing service health needs.

---

## Prometheus Questions

### What is Prometheus?

Prometheus is an open-source time-series monitoring and alerting system. It scrapes metrics from targets over HTTP and stores them with labels and timestamps.

### Why the pull model?

Centralized scraping simplifies discovery, health visibility, and target control. Prometheus knows which targets are down because it controls the scrape schedule.

### What is a scrape target?

An endpoint that exposes metrics in Prometheus format, usually `/metrics`.

### What is PromQL?

PromQL is the query language used to query and aggregate Prometheus time-series data.

### Counter vs gauge?

A counter only increases and is used for counts like requests and errors. A gauge can go up and down and is used for values like memory usage, queue depth, or active connections.

### Why use `rate()` with counters?

Counters are cumulative. `rate()` converts the increase over time into a per-second rate.

```promql
rate(http_requests_total[5m])
```

### What is a histogram?

A histogram samples observations into buckets. It is commonly used for latency and request duration.

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

Do not average percentiles. Use bucket aggregation first, then apply `histogram_quantile()`.

### What is a recording rule?

A recording rule precomputes an expensive query and saves it as a new time series. Used for repeated dashboard queries, SLI math, and faster alert evaluation.

```yaml
- record: service:error_ratio:5m
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
    /
    sum(rate(http_requests_total[5m])) by (service)
```

### Why is cardinality dangerous?

Too many unique label combinations increase memory, storage, and query cost. High-cardinality labels like user_id or request_id can cause Prometheus to run out of memory.

---

## Grafana Questions

### What is Grafana?

Grafana is a visualization and dashboarding platform. It can query Prometheus, Loki, Elasticsearch, CloudWatch, and many other data sources.

### What makes a good dashboard?

A good dashboard answers operational questions in under 10 seconds: health, user impact, saturation, dependency status, recent changes, and recovery progress.

Top row: request rate, error rate, p95/p99 latency, saturation. Second row: dependencies, resources, deploy markers.

### What is a dashboard variable?

A dynamic filter used to select service, cluster, namespace, region, or environment.

### What are annotations?

Annotations mark events on a dashboard timeline — typically deploys, config changes, or incidents. They help correlate metric changes with system events.

### Why are dashboards not enough?

Dashboards are passive. Alerts, runbooks, traces, and logs are needed for incident response. A dashboard that looked fine but users were slow usually means averages were displayed without p95/p99 and dependency panels were missing.

---

## Alerting Questions

### What makes an alert actionable?

It has clear impact, owner, severity, runbook, evidence, and a path to mitigation.

### Why is alert fatigue dangerous?

Noisy alerts train teams to ignore alerts. This delays response when a real incident happens.

### What is Alertmanager?

Alertmanager receives alerts from Prometheus, groups and deduplicates them, applies routing rules, and sends notifications to systems like Slack, PagerDuty, or email.

### What is alert grouping?

Combining related alert instances into one notification so responders see one incident context rather than many duplicate pages.

### What is alert inhibition?

Inhibition suppresses lower-severity or child alerts when a higher-severity alert is active for the same scope. This prevents an alert storm when one root cause triggers many downstream alerts.

### What is a silence?

A silence temporarily suppresses matching alerts for a defined time window. Used for planned maintenance.

### Symptom alert vs cause alert?

A symptom alert detects user-facing impact, such as high error rate. A cause alert detects a possible internal reason, such as disk pressure. Symptom alerts are better for paging; cause alerts are useful for diagnosis.

---

## SLO Questions

### What is an SLI?

A measured reliability signal, such as successful request ratio or latency below threshold.

Example: fraction of checkout requests succeeding under 500ms.

### What is an SLO?

A target for an SLI, such as 99.9% successful requests over 30 days.

### What is an error budget?

The amount of unreliability allowed by the SLO. A 99.9% SLO gives 0.1% error budget — approximately 43 minutes of downtime per month.

### Why alert on error-budget burn?

It ties alerts to user-impacting reliability risk instead of arbitrary low-level thresholds.

### What is burn rate?

The rate at which error budget is being consumed. A 1x burn rate means consuming budget exactly as planned. A 14x burn rate means the budget will be exhausted far sooner than the measurement window.

### What is multi-window burn rate alerting?

Checking burn rate over two windows — a short window to catch fast spikes and a long window to confirm sustained degradation. This reduces false positives from momentary spikes while still catching slow drains.

### What is an error budget policy?

An agreed team policy on what actions to take at different error budget consumption levels. Example: freeze non-critical deploys when budget is exhausted.

---

## Cardinality Questions

### What is cardinality?

The number of unique time series created by metric label combinations.

### Why is high cardinality bad?

It increases memory usage, storage, query cost, and alert evaluation load.

### Give examples of bad labels.

`user_id`, `request_id`, `session_id`, `order_id`, full URL, or raw error message.

### Where should high-cardinality context go?

Logs or traces, not metric labels.

---

## Logs And Loki Questions

### What is Loki?

Loki is a log aggregation system that works well with Grafana. It indexes labels instead of full log text, making it cheaper to operate than full-text search engines for many use cases.

### What is LogQL?

The query language for Loki logs.

```logql
{namespace="payments"} |= "timeout"
```

```logql
{app="api"} | json | level="error"
```

### What labels are good for logs?

Cluster, namespace, app, container, environment, and team. Avoid unbounded labels.

### What should a structured log contain?

Timestamp UTC, level, service name, trace_id or request_id (in the body), and useful context without secrets.

```json
{"level":"error","service":"checkout","trace_id":"abc123","message":"payment timeout"}
```

---

## Tracing Questions

### What is a trace?

A trace represents one request path through a distributed system.

### What is a span?

A span is one operation within a trace, such as an HTTP call or database query.

### What is OpenTelemetry?

A vendor-neutral standard and toolkit for collecting metrics, logs, and traces. It provides SDKs, APIs, and a collector component.

### What is trace context propagation?

Passing a trace ID through all hops of a distributed request (via HTTP headers) so all spans can be assembled into one trace.

### Why sample traces?

Tracing every request can be expensive. Sampling controls cost while keeping useful traces.

### What is tail sampling?

Making the sampling decision after a trace is complete, allowing you to always keep traces that were slow or failed.

### What tools implement distributed tracing?

Jaeger, Tempo (Grafana), Zipkin. OpenTelemetry is the instrumentation standard; these tools are backends.

---

## Scenario Questions

### API latency increased. How do you debug?

Check golden signals, compare latency by route/service/version, inspect traces for slow spans, check dependency metrics, look at recent deploys, and inspect logs for errors or timeouts. Check p95/p99 not just averages.

### Prometheus memory usage is growing. What do you check?

Metric cardinality, scrape target count, scrape interval, retention, expensive rules, high-cardinality labels, and remote write behavior.

### Alert fires but no one knows what to do. What is wrong?

The alert lacks ownership, runbook, impact statement, or useful labels. Fix the alert, not only the incident.

### Grafana dashboard is slow. What do you check?

Query cost, time range, dashboard variables, high-cardinality labels, repeated panels, and whether recording rules should be used.

### Users are slow but metrics look fine. What do you investigate?

Check p99/p999 instead of averages, look for regional splits, inspect traces for slow spans, check dependency health from your service, and run synthetic probes to confirm user-perceived latency.

### An alert never paged even though a rule exists. What do you check?

Is the rule firing in Prometheus? Is Alertmanager receiving it? Is there a matching silence? Is the routing correct? Is the receiver healthy?

### How do you handle a noisy alert that fires every night?

Fix the alert, not the on-call. Tune the threshold, increase the `for` duration, make it informational instead of a page, or remove it if it has no actionable response.

---

## Staff-Level Questions

### How do you design observability for many teams?

Provide standard instrumentation libraries, dashboard templates, alert templates, ownership labels, SLO patterns, logging standards, trace propagation, and cardinality review.

### What are unhealthy observability signals?

Too many noisy alerts, dashboards nobody uses, missing ownership labels, high-cardinality metrics, no trace correlation, logs too expensive, and no post-incident alert review.

### What should be centralized?

Telemetry platform, retention policy, cardinality guardrails, global dashboards, alert routing standards, and SLO framework.

### What should teams own?

Service-level SLIs, custom business metrics, service dashboards, domain-specific alerts, and runbooks.

### How do you run a SEV1 incident?

Establish command, assess scope and user impact, mitigate quickly (rollback before deep analysis if confidence is high), communicate clearly with regular updates, then capture a clean timeline and write a blameless postmortem with tracked action items.

### What is the senior summary on observability?

Page only on user-impacting symptoms tied to SLO risk, then use metrics, logs, and traces to narrow blast radius quickly. During incidents prioritize mitigation over elegant root-cause hunting, communicate clearly, and convert outages into tracked reliability improvements.

---

## Incident Response Questions

### How do you run a SEV1 incident?

Establish an Incident Commander immediately — one person owns the incident, everyone else supports. The IC's first questions: are users hurting, how many, is it getting worse, what is the fastest safe mitigation? Mitigate before root cause if rollback confidence is high. Communicate every 15–30 minutes with a standard format: what is happening, what is the impact, what is being done, next update time. Once service is restored, confirm via SLO burn rate returning to normal, then open a postmortem within 24 hours while the timeline is fresh.

### What is an Incident Commander and why do you need one?

The IC is the single decision-maker during an incident. Without one, multiple engineers pull in different directions, communication breaks down, and mitigation takes longer. The IC does not do deep technical work — they coordinate, delegate, and drive decisions. The Tech Lead handles investigation and reports findings to the IC. Separating these roles prevents the most senior engineer from going heads-down on debugging while the incident communication falls apart.

### Why do you rollback before finding the root cause?

Because mitigation and investigation are separate goals. During active user impact, every minute matters. A rollback can restore service in minutes. Root cause analysis can take hours. If you have reasonable confidence that a recent deploy caused the problem, rollback first, then investigate on a stable system. The exception is when rollback itself carries risk — for example, a database migration that cannot be reversed cleanly.

### What is a blameless postmortem and what does it include?

A blameless postmortem treats incidents as system failures, not individual failures. The question is always "what allowed this to happen?" not "who caused this?" A complete postmortem includes: a timestamped timeline, a specific impact statement (users affected, duration, business impact), detection quality assessment, a root cause chain (not a single cause), mitigation effectiveness, and prevention actions with owners and due dates. Action items without owners and due dates are the most common postmortem failure — they get written and never done.

### How do you reduce alert fatigue?

Alert fatigue comes from too many low-signal alerts. Fix it by: alerting on symptoms (user-impacting signals) not causes (CPU, memory), tying every alert to an SLO or a user-visible impact, setting burn rate thresholds so alerts only fire when the error budget is genuinely at risk, adding inhibition rules in Alertmanager so a root cause alert suppresses downstream symptom alerts, and running a regular alert review to retire alerts that have never led to a real action. The goal is that every page requires a human decision — if an alert can be auto-resolved or ignored, it should not page.

---

## Scaling and Architecture Questions

### How do you scale Prometheus beyond a single instance?

Four main options in increasing complexity:

1. **Bigger single instance** — vertical scaling, works up to a few million active time series, simplest to operate
2. **Federation** — a global Prometheus scrapes aggregated metrics from regional Prometheus instances, good for cross-cluster dashboards but not for raw metric access
3. **Sharding** — split scrape targets across multiple Prometheus instances using consistent hashing or manual assignment, each shard covers a subset of targets
4. **Remote write to Thanos or Mimir/Cortex** — Prometheus instances write metrics to a long-term store that provides global query, HA deduplication, and multi-year retention

The right choice depends on retention requirements, query patterns, and operational complexity tolerance. Most teams reach for Thanos or Mimir when they need more than 15 days of retention or global query across clusters.

### What is Thanos and what problems does it solve?

Thanos is a set of components that extend Prometheus with long-term storage, global query, and high availability. Core components: Sidecar (runs alongside Prometheus, uploads blocks to object storage), Store Gateway (serves historical data from object storage), Querier (provides a global query layer across all Prometheus instances and the Store Gateway), Compactor (downsamples and compacts old blocks). Thanos solves three problems single Prometheus cannot: retention beyond local disk, querying across multiple Prometheus instances in one query, and HA with deduplication when running Prometheus in pairs.

### What is Prometheus federation and when do you use it?

Federation lets a global Prometheus scrape a subset of metrics from other Prometheus instances using the `/federate` endpoint. Use it when you need a single dashboard that aggregates high-level metrics across clusters — for example, total request rate across all regions. Do not use federation for raw per-instance metrics at scale; the global Prometheus becomes a bottleneck. For full metric access across clusters, use remote write to Thanos or Mimir instead.

### When do you use recording rules?

Recording rules precompute expensive PromQL expressions and store the result as a new metric. Use them when: a query is used in multiple dashboards and is expensive to compute on every load, an SLO burn rate calculation involves a complex ratio that needs to be evaluated frequently, or a histogram quantile calculation over a long range window is slow. Recording rules also reduce query latency for dashboards because the result is already materialized. Name them with a consistent convention like `job:metric:aggregation` so they are easy to identify.

---

## Production Debugging Questions

### Grafana shows no data — how do you debug it?

Work through the layers in order. First check the data source: go to Configuration → Data Sources → Test. If the data source fails, Prometheus is unreachable or the URL is wrong. Second, run the query directly in Prometheus UI to confirm the metric exists and has data. Third, check the time range — if the dashboard is set to "last 5 minutes" and the metric has a 15-second scrape interval, there may simply be no data points in that window. Fourth, check for label mismatches — the dashboard variable may be filtering on a label value that does not exist in the current environment. Fifth, check if the metric name changed after a recent deploy or exporter upgrade.

### An alert rule is firing in Prometheus but no notification was sent — how do you debug it?

Check each layer of the pipeline. In Prometheus, confirm the alert is in `FIRING` state in the Alerts UI and that the `alertmanager_notifications_total` counter is incrementing. If Prometheus is not sending to Alertmanager, check the `--alertmanager.url` flag and network connectivity. In Alertmanager, check the `/api/v2/alerts` endpoint to confirm the alert arrived. Then check the routing tree — use `amtool config routes test` with the alert labels to see which route matches. Common failures: the alert labels do not match any route, the receiver is misconfigured (wrong webhook URL, expired API key), or a silence is active that matches the alert labels. Check `alertmanager_notifications_failed_total` for receiver errors.

### The dashboard looked fine but users were slow — what happened and how do you prevent it?

This is the "metrics lied" scenario. Common causes: the dashboard was showing averages that masked a slow tail (p50 looked fine but p99 was 10 seconds), the dashboard was aggregating across all instances and a single bad instance was diluted, or the metric being graphed was not actually measuring what users experience. Prevention: always include p99 latency alongside p50, use histogram metrics not summary metrics so you can compute any percentile after the fact, add synthetic monitoring (blackbox probes) that measures the full user request path end-to-end, and correlate dashboard metrics with SLO burn rate — if the burn rate is elevated, users are hurting even if the dashboard looks calm.
