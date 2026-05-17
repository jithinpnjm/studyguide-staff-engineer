---
title: "Foundations: Observability, SLOs, And Incident Response Premium Teaching Guide"
sidebar_position: 9
---

# Foundations: Observability, SLOs, And Incident Response Premium Teaching Guide

Reliable systems are built by seeing clearly, deciding calmly, and learning continuously.

Observability gives visibility into behavior. SLOs define reliability targets. Incident response restores service under pressure.

This guide teaches observability from first principles to production-grade reliability operations.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — metrics, logs, traces, alerts.
2. **Intermediate Layer** — SLIs, SLOs, dashboards, runbooks.
3. **Advanced Layer** — burn-rate alerts, tracing strategy, incident command.
4. **Production SRE Layer** — outages, mitigations, postmortems, alert quality.
5. **Interview Layer** — explain reliability tradeoffs clearly.

---

# Memory Palace: Hospital Emergency Room

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

# Beginner Layer: Monitoring vs Observability

Monitoring asks:

> Did a known bad thing happen?

Observability asks:

> Why is the system behaving this way?

Three core signals:

- Metrics = trends and alerting
- Logs = exact events
- Traces = request path across services

---

# Beginner Layer: Golden Signals / RED / USE

## Golden Signals

- Latency
- Traffic
- Errors
- Saturation

## RED

- Rate
- Errors
- Duration

## USE

- Utilization
- Saturation
- Errors

Use RED for services. Use USE for infrastructure.

---

# Beginner Layer: Metrics Foundations

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

# Beginner Layer: Logging Foundations

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

# Beginner Layer: Tracing Foundations

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

# Intermediate Layer: SLI / SLO / SLA

## SLI

Measured user experience.

Example:

Fraction of checkout requests succeeding under 500ms.

## SLO

Target objective.

Example:

99.9% over rolling 28 days.

## SLA

External commercial promise.

Usually looser than SLO.

---

# Intermediate Layer: Error Budgets

99.9% means 0.1% unreliability budget.

Use it to guide risk:

- healthy budget -> ship faster
- budget exhausted -> prioritize reliability

Error budgets align product speed with operational reality.

---

# Intermediate Layer: Alerting Philosophy

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

# Intermediate Layer: Dashboards That Help

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

# Advanced Layer: Burn Rate Thinking

- 14x burn = severe active issue
- 3x burn = meaningful degradation
- 1x burn = on target

Burn-rate alerts tie signals to commitments rather than arbitrary thresholds.

---

# Advanced Layer: Incident Lifecycle

## Detect

Alert, user report, synthetic probe.

## Triage

- scope
- user impact
- worsening or stable
- recent changes

## Mitigate

1. rollback
2. disable feature
3. reroute traffic
4. scale out
5. shed load
6. restart last

## Communicate

Clear regular updates.

## Resolve
nMetrics normal and understood.

## Learn

Postmortem with tracked actions.

---

# Advanced Layer: Incident Roles

| Role | Responsibility |
|---|---|
| Incident Commander | Coordination |
| Tech Lead | Debugging and mitigation |
| Comms | Stakeholder updates |
| SMEs | Focused expertise |

---

# Production SRE Layer: Real Incidents

## CPU High, Users Fine

Observe first. Do not auto-page on infrastructure noise alone.

## Errors After Deploy

If confidence is high, rollback quickly before deep analysis.

## Users Slow, Metrics Fine

Check p99/p999, region split, traces, synthetic flows.

## Nightly Noisy Alerts

Fix alerts, not people.

## Dependency Brownout

Your service may be healthy internally while users fail externally. Inspect downstream dependencies.

---

# Production SRE Layer: Troubleshooting Flow

## Traffic Drop

Check:

- load balancer
- DNS
- deploy markers
- upstream routing

## Error Spike

Check:

- latest deploy
- dependency errors
- auth changes
- saturation

## Latency Increase

Check:

- p95/p99 split
- traces
- queue depth
- database latency

## Alert Storm

Check:

- root dependency causing fan-out alerts
- duplicate rules
- noisy thresholds

---

# Postmortems That Matter

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

# Tools To Know

- Prometheus
- Grafana
- Alertmanager
- Loki
- OpenSearch / Elasticsearch
- OpenTelemetry
- Jaeger / Tempo
- PagerDuty / Opsgenie

---

# Interview Layer: Strong Answers

## Monitoring vs Observability?

> Monitoring detects known failure conditions. Observability helps explain unknown behavior using telemetry.

## Why averages mislead?

> Averages hide tail pain. Many users can suffer while the mean looks normal.

## Why burn-rate alerts?

> They map incidents to SLO risk, helping prioritize what truly threatens commitments.

## How do you run a SEV1?

> Establish command, assess impact, mitigate quickly, communicate clearly, and capture a clean timeline.

---

# Labs

## Beginner

1. Build one service dashboard.
2. Add latency and error alerts.
3. Add structured logs.

## Intermediate

1. Define an SLO and budget.
2. Add synthetic probe.
3. Trace a slow endpoint.

## Advanced

1. Add burn-rate alerts.
2. Run a mock incident drill.
3. Write a postmortem.
4. Remove 50% noisy alerts safely.

---

# Memory Review

- Why is p99 often better than average?
- Why should alerts map to actions?
- What does an error budget buy you?
- Why rollback before deep debugging sometimes?
- Why do postmortems need owners?

---

# Senior Summary

> I page only on user-impacting symptoms tied to SLO risk, then use metrics, logs, and traces to narrow blast radius quickly. During incidents I prioritize mitigation over elegant root-cause hunting, communicate clearly, and convert outages into tracked reliability improvements.
