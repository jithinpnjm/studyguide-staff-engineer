---
title: "Foundations: Prometheus, Grafana, And Alertmanager Premium Teaching Guide"
sidebar_position: 19
---

# Foundations: Prometheus, Grafana, And Alertmanager Premium Teaching Guide

Prometheus, Grafana, and Alertmanager form one of the most common observability stacks used by SRE and platform teams.

Prometheus collects metrics and evaluates rules. Grafana visualizes data. Alertmanager routes alerts to humans and systems.

This guide teaches the stack from first principles to production-grade operations.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — metrics, scraping, dashboards, alerts.
2. **Intermediate Layer** — PromQL, exporters, rules, routing.
3. **Advanced Layer** — cardinality, recording rules, scaling, SLO alerts.
4. **Production SRE Layer** — missing metrics, noisy alerts, bad dashboards.
5. **Interview Layer** — explain a real metrics platform clearly.

---

# Memory Palace: Hospital Monitoring Ward

| Tool | Analogy | Meaning |
|---|---|---|
| Prometheus | Bedside monitor | Continuously reads signals |
| Grafana | Nurse station screen | Visual overview |
| Alertmanager | Paging desk | Sends alerts to responders |
| Exporter | Sensor adapter | Converts system signals |
| Rule | Escalation policy | Trigger condition |
| Dashboard | Ward board | Shared situational awareness |

---

# Beginner Layer: Metrics Model

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

# Beginner Layer: Metric Types

| Type | Meaning | Use |
|---|---|---|
| Counter | Only increases | requests, errors |
| Gauge | Current value | memory, queue depth |
| Histogram | Bucketed observations | latency |
| Summary | Client-side quantiles | niche use |

Important rule:

Use `rate()` with counters.

---

# Beginner Layer: Pull Model

Prometheus usually scrapes targets over HTTP.

```text
app /metrics <- Prometheus scrape every interval
```

Benefits:

- central scheduling
- target health visibility
- easier service discovery

---

# Beginner Layer: First Useful Queries

```promql
up
rate(http_requests_total[5m])
process_resident_memory_bytes
sum(rate(http_requests_total[5m])) by (service)
```

---

# Intermediate Layer: RED And USE Dashboards

## RED for services

- Rate
- Errors
- Duration

## USE for infrastructure

- Utilization
- Saturation
- Errors

Start dashboards with these before vanity metrics.

---

# Intermediate Layer: Exporters

Common exporters:

- node_exporter
- kube-state-metrics
- blackbox_exporter
- postgres_exporter
- redis_exporter
- nginx exporter

Exporters expose system facts. They do not replace thinking.

---

# Intermediate Layer: Alert Rules

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

# Intermediate Layer: Alertmanager

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

# Advanced Layer: Histograms And Percentiles

Use histograms for p95/p99 latency.

Important truth:

Do not average percentiles.

Use bucket aggregation first, then quantiles.

Tail latency often matters more than averages.

---

# Advanced Layer: Cardinality

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

# Advanced Layer: Recording Rules

Use recording rules to precompute expensive queries.

Good for:

- repeated dashboards
- SLO math
- expensive histograms
- faster alerts

---

# Advanced Layer: Scaling Prometheus

Paths:

- bigger single instance
- federation
- sharding
- Thanos
- Mimir/Cortex style systems

Use complexity only when needed.

---

# Advanced Layer: SLO Burn Alerts

Better than arbitrary CPU pages.

Burn alerts page when reliability commitments are being consumed too quickly.

This aligns paging with user impact.

---

# Production SRE Layer: Real Incidents

## Grafana Shows No Data

Check:

- time range
- datasource
- query labels
- target scrape health

## Target Down (`up=0`)

Check:

- app running
- port/path correct
- network policy/firewall
- service discovery labels

## Prometheus Memory High

Likely causes:

- cardinality explosion
- too many targets
- expensive queries

## Alert Never Paged

Check:

- rule firing?
- routed correctly?
- silence active?
- receiver healthy?

## Dashboard Looked Fine But Users Slow

Cause often:

- averages only
n- no p95/p99
- no dependency panels

---

# Production SRE Layer: Dashboard Design

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

# Interview Layer: Strong Answers

## Why Prometheus pull model?

> Centralized scraping simplifies discovery, health visibility, and target control.

## Counter vs Gauge?

> Counter only increases and is used with rate functions. Gauge represents a current value.

## Why is cardinality dangerous?

> Too many unique label combinations increase memory, storage, and query cost.

## How would you page reliably?

> Use actionable alerts tied to user impact or SLO burn, with ownership and runbooks.

---

# Labs

## Beginner

1. Scrape node_exporter.
2. Query `up`.
3. Build one CPU dashboard.

## Intermediate

1. Build RED dashboard.
2. Create error-rate alert.
3. Route warnings and critical alerts differently.

## Advanced

1. Simulate cardinality problem.
2. Add recording rules.
3. Build burn-rate alerts.
4. Configure inhibition.

---

# Memory Review

- Why use `rate()` with counters?
- Why are user IDs bad labels?
- Why do averages hide pain?
- What is inhibition?
- Why should dashboards begin with RED metrics?

---

# Senior Summary

> I design metrics platforms around actionable low-cardinality signals. Services expose counters, gauges, and histograms. Prometheus scrapes and evaluates rules, Grafana visualizes RED and USE dashboards, and Alertmanager routes only actionable alerts with clear ownership. I control cardinality, precompute expensive queries, and align paging with SLO risk.
