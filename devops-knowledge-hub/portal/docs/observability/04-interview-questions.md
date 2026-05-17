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
