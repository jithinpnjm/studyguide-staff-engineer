---
title: "AIOps Fundamentals"
sidebar_label: "Beginner"
sidebar_position: 1
---

# AIOps Fundamentals

AIOps (Artificial Intelligence for IT Operations) applies machine learning and large language models to automate and enhance operational tasks — particularly alert triage, enrichment, and incident routing. This guide starts from first principles and builds toward understanding the real implementation used in production.

---

## The Problem: Alert Fatigue and Manual Triage

Every alert fired in a Kubernetes cluster arrives as a flat text message. Without context, the on-call engineer must answer three questions before they can even begin fixing the problem:

1. **What is broken?** — The alert name tells you a metric threshold was crossed, but not why.
2. **Who owns it?** — Namespace names like `allex-notifications` require institutional knowledge to map to a team.
3. **What should I do first?** — Without a runbook or recent log context, the engineer starts from scratch.

This process — understanding before acting — consumes the first 5–15 minutes of every incident. At scale, with dozens of engineers and hundreds of alerts per day, this is a systemic inefficiency and a contributor to burnout.

Traditional alerting systems send a raw notification. AIOps systems enrich the alert before it reaches the human.

---

## What AIOps Solves

| Problem | AIOps Solution |
|---------|---------------|
| Alert fatigue from noisy, low-context alerts | Enriched summaries with AI-generated probable causes |
| Manual team triage ("who owns this?") | Automated team ownership lookup from ConfigMap |
| Missing runbook links | `runbook_url` annotation added at the PrometheusRule level |
| No log context at alert time | Elasticsearch query retrieves last 15 min of errors |
| Wrong team paged | Service-to-team mapping with service label override |
| Slow MTTA (mean time to acknowledge) | Actionable Slack Block Kit message with recommended steps |

The goal is not to replace the engineer — it is to give them a head start so the first thing they do is act, not investigate.

---

## Core Components

```
Prometheus
    │
    ▼ (evaluates PrometheusRule with team/service labels)
Alertmanager
    │
    ├──► default-receiver ──► #allex-staging-alerts-k8s (always fires)
    │
    └──► ai-enricher (child route, continue: true)
              │
              ▼
        ai-alert-router service
              │
              ├──► Team Ownership ConfigMap
              │    (namespace/service → team + Slack channel)
              │
              ├──► Elasticsearch
              │    (last 15 min error logs for the namespace)
              │
              └──► Azure OpenAI GPT-4o
                   (generates structured incident summary)
                        │
                        ▼
              #allex-aiops-test (pilot) or team channel (phase 2)
```

This architecture has one non-negotiable property: **the original alert is always delivered**. The AI enrichment path is additive. If anything in the enrichment chain fails — OpenAI times out, Elasticsearch is down, the service crashes — the alert still reaches `#allex-staging-alerts-k8s` via the `default-receiver`.

---

## Key Tools

| Tool | Role in AIOps |
|------|--------------|
| **Prometheus** | Evaluates alert rules; fires alerts with structured labels |
| **PrometheusRule** | Kubernetes CRD defining alert expressions, severity, and enrichment annotations |
| **Alertmanager** | Groups and routes alerts; sends webhook to `ai-alert-router` |
| **ai-alert-router** | Node.js/TypeScript service: receives webhook, enriches with AI, routes to Slack |
| **Kubernetes ConfigMap** | Stores team ownership mapping (namespace/service → team + channel) |
| **Azure OpenAI (GPT-4o)** | Generates structured JSON incident summary from alert context |
| **Elasticsearch** | Stores container logs from Fluentd; queried for error context |
| **Fluentd** | Ships all container logs to Elasticsearch with Kubernetes metadata |
| **Slack Block Kit** | Formats the enriched alert as a scannable, actionable message |
| **FluxCD** | GitOps reconciliation — all Kubernetes resources managed from Git |

---

## Alert Enrichment vs Raw Alerting

### Raw Alert (what exists without AIOps)

```
*Alert:* Redis down (instance redis-cache:6379)
*Details:*
- alertname: RedisDown
- severity: critical
- instance: redis-cache:6379
- job: redis
```

The on-call engineer sees this and must:
- Know that Redis is owned by the platform team
- Know to check `kubectl get pod -n allex-redis`
- Know which Grafana dashboard to open
- Find the runbook manually

### Enriched Alert (with AIOps)

```
🔴 RedisDown
Team: platform | Env: staging | Namespace: allex-redis | Active: 5m | Category: infrastructure

Summary
The Redis instance has become unavailable, likely due to a pod OOM kill or node eviction.

Impact
All caching and stream processing dependent on this Redis instance is down. Affects async
job processing, notifications, and real-time features.

Probable Causes
1. Pod OOM kill (memory limit exceeded in allex-redis namespace)
2. Node eviction due to memory pressure on monitoring-stack node pool
3. Redis configuration error causing crash on startup

Recommended Actions
1. Check pod status: kubectl get pod -n allex-redis
2. Check recent events: kubectl describe pod -n allex-redis <pod>
3. Check node pressure: kubectl describe node <node>

[View Runbook] [View Dashboard] [Silence Alert]

🤖 AI confident (80%) | Labels: severity=critical namespace=allex-redis
```

The engineer reads this and immediately knows what happened, who owns it, and where to start. MTTA drops from 10+ minutes to under 2 minutes.

---

## The Alert Label Schema

AIOps works because alerts carry structured metadata. This metadata is added to PrometheusRule definitions:

```yaml
labels:
  severity: critical        # existing
  team: platform            # added by AIOPS-02
  service: redis            # added by AIOPS-02
  component: cache          # added by AIOPS-02
  environment: staging      # added by AIOPS-02

annotations:
  summary: "Redis instance is down"
  business_impact: "All services using Redis for caching and streaming are unavailable."
  runbook_url: "https://wiki.allex.ai/runbooks/redis/RedisDown"
  suggested_query: "redis_up{instance=\"{{ $labels.instance }}\"}"
```

Without these labels, the `ai-alert-router` would need to infer team ownership from namespace names — which is fragile and fails when namespaces are renamed or when multiple teams share a namespace.

---

## The Pilot Approach

The system was deployed using a careful pilot methodology:

1. **Shadow mode first** (Week 1): The service receives webhooks and logs what it *would* do, but sends nothing to Slack. This validates the webhook connectivity and team-lookup logic without risk.

2. **5 pilot alerts only**: Only `KubernetesPodCrashLooping`, `RedisDown`, `RedisRejectedConnections`, `FailedAsyncJobs`, and `TooManyPendingMessagesNotifications` are routed through the AI enrichment path. All other alerts continue to `#allex-staging-alerts-k8s` unchanged.

3. **Test channel**: All enriched alerts go to `#allex-aiops-test` during the pilot, not to team channels. Engineers can observe the output without it affecting their real alert flow.

4. **Metrics-driven graduation**: Phase 2 (per-team routing) only begins when the pilot meets defined thresholds — 80% team classification accuracy, p95 enrichment latency under 10 seconds, and confirmed engineer utility.

---

## Non-Blocking Design

Alertmanager has a webhook timeout. If the `ai-alert-router` does not respond within that timeout, Alertmanager marks the delivery as failed and retries. To avoid this:

```typescript
router.post('/alertmanager', (req: Request, res: Response) => {
  // Return 200 immediately — before any enrichment work
  res.status(200).json({ status: 'accepted' });

  // All enrichment happens asynchronously after the response
  processAlerts(req.body).catch(err => {
    console.error({ event: 'processing_error', error: String(err) });
  });
});
```

This pattern is fundamental to AIOps webhook receivers. The HTTP response and the enrichment pipeline are decoupled. Alert delivery is never blocked by LLM latency.

---

## Guardrails Summary

| Guardrail | Implementation |
|-----------|---------------|
| No alert loss | `default-receiver` always active; AI path is additive |
| Non-blocking LLM calls | Return 200 immediately, enrich async |
| No secrets in logs | Never log full annotation values or API keys |
| GitOps only | All Kubernetes resources via FluxCD; no `kubectl apply` in production |
| Pilot scope limited | Only 5 alert types in Phase 1 |
| Monitoring node pool co-location | Pod tolerations for `monitoring-stack` node pool |

---

## Summary

AIOps is not about replacing human judgment. It is about reducing the time engineers spend on mechanical triage so they can focus on resolution. The stack — Prometheus labels, Alertmanager routing, a webhook receiver service, team ownership ConfigMap, Elasticsearch log context, and an LLM — forms a pipeline that converts a raw metric alert into an actionable incident brief in under 10 seconds.

The critical design principle: enrichment is always additive and always fallible. If any step fails, the original alert is still delivered unchanged.
