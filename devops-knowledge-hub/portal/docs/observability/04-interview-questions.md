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

Monitoring usually checks known conditions. Observability helps investigate unknown problems by giving enough signals to ask new questions during an incident.

### What are the three pillars?

Metrics, logs, and traces. Metrics show numeric trends, logs show event context, and traces show request flow across services.

### Why are metrics useful?

Metrics are cheap to store, easy to aggregate, and suitable for dashboards and alerts.

### Why are logs useful?

Logs provide rich event context, error messages, request details, and sequence of behavior.

### Why are traces useful?

Traces show where time is spent across distributed services and help find the slow or failing dependency.

---

## Prometheus Questions

### What is Prometheus?

Prometheus is an open-source time-series monitoring and alerting system. It scrapes metrics from targets over HTTP and stores them with labels and timestamps.

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

---

## Grafana Questions

### What is Grafana?

Grafana is a visualization and dashboarding platform. It can query Prometheus, Loki, Elasticsearch, CloudWatch, and many other data sources.

### What makes a good dashboard?

A good dashboard answers operational questions: health, user impact, saturation, dependency status, recent changes, and recovery progress.

### What is a dashboard variable?

A dynamic filter used to select service, cluster, namespace, region, or environment.

### Why are dashboards not enough?

Dashboards are passive. Alerts, runbooks, traces, and logs are needed for incident response.

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

### Symptom alert vs cause alert?

A symptom alert detects user-facing impact, such as high error rate. A cause alert detects a possible internal reason, such as disk pressure. Symptom alerts are better for paging; cause alerts are useful for diagnosis.

---

## SLO Questions

### What is an SLI?

A measured reliability signal, such as successful request ratio or latency below threshold.

### What is an SLO?

A target for an SLI, such as 99.9% successful requests over 30 days.

### What is an error budget?

The amount of unreliability allowed by the SLO.

### Why alert on error-budget burn?

It ties alerts to user-impacting reliability risk instead of arbitrary low-level thresholds.

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

Loki is a log aggregation system that works well with Grafana. It indexes labels instead of full log text.

### What is LogQL?

The query language for Loki logs.

```logql
{namespace="payments"} |= "timeout"
```

### What labels are good for logs?

Cluster, namespace, app, container, environment, and team. Avoid unbounded labels.

---

## Tracing Questions

### What is a trace?

A trace represents one request path through a distributed system.

### What is a span?

A span is one operation within a trace, such as an HTTP call or database query.

### What is OpenTelemetry?

A vendor-neutral standard and toolkit for collecting metrics, logs, and traces.

### Why sample traces?

Tracing every request can be expensive. Sampling controls cost while keeping useful traces.

---

## Scenario Questions

### API latency increased. How do you debug?

Check golden signals, compare latency by route/service/version, inspect traces for slow spans, check dependency metrics, look at recent deploys, and inspect logs for errors or timeouts.

### Prometheus memory usage is growing. What do you check?

Metric cardinality, scrape target count, scrape interval, retention, expensive rules, high-cardinality labels, and remote write behavior.

### Alert fires but no one knows what to do. What is wrong?

The alert lacks ownership, runbook, impact statement, or useful labels. Fix the alert, not only the incident.

### Grafana dashboard is slow. What do you check?

Query cost, time range, dashboard variables, high-cardinality labels, repeated panels, and whether recording rules should be used.

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
