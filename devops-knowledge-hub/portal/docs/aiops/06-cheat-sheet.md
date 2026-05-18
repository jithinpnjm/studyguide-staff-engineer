---
title: "AIOps Cheat Sheet"
sidebar_label: "Cheat Sheet"
sidebar_position: 6
---

# AIOps Cheat Sheet

Quick reference for AIOps architecture, key patterns, and operational commands.

---

## Architecture at a Glance

```
Alertmanager
  └─► default-receiver (Slack/PagerDuty) — always fires
  └─► ai-enrichment webhook (continue: true)
        └─► ai-alert-router service
              ├─► Elasticsearch (log context, 3s timeout)
              ├─► Azure OpenAI GPT-4o (structured JSON output)
              └─► Slack enriched message
```

**Key invariant:** `continue: true` on the child route means the original alert always reaches the default receiver, even if the AI path is completely down.

---

## Alertmanager Routing Snippet

```yaml
routes:
  - receiver: ai-enrichment
    continue: true          # never block the original alert
    matchers:
      - alertname =~ "HighErrorRate|PodCrashLooping|HighMemoryUsage"
    group_wait: 10s

receivers:
  - name: ai-enrichment
    webhook_configs:
      - url: "http://ai-alert-router.monitoring.svc:3000/webhook"
        send_resolved: false
        http_config:
          timeout: 30s
```

---

## LLM Prompt Rules (Non-Negotiable)

| Rule | Why |
|------|-----|
| Output ONLY valid JSON | Enables `JSON.parse()` without regex |
| No markdown, no code blocks | Prevents parse failures |
| `needs_human_review: true` if confidence < 0.5 | Flags uncertain output |
| Do not invent facts | Prevents hallucinated runbook steps |
| `temperature: 0` | Deterministic output for same input |
| `max_tokens: 500` | Caps cost and latency |

---

## Enrichment Response Schema

```typescript
interface EnrichmentResult {
  team: string;
  category: "capacity" | "dependency" | "deployment" | "application" | "data" | "infrastructure";
  severity_override: "critical" | "warning" | "info" | null;
  summary: string;           // 1-2 sentences
  impact: string;            // 1-2 sentences
  probable_causes: string[]; // 1-5 items
  recommended_actions: string[]; // 1-5 items
  confidence: number;        // 0.0–1.0
  needs_human_review: boolean;
}
```

---

## Timeout Budget

| Step | Timeout | On failure |
|------|---------|------------|
| Elasticsearch query | 3s | Skip log context, continue |
| Azure OpenAI call | 25s | Use fallback enrichment |
| Total webhook handler | 30s | Return 200 with fallback |

**Rule:** Always return HTTP 200 to Alertmanager. A 5xx causes Alertmanager to retry, flooding the service.

---

## Fallback Enrichment (When LLM Fails)

```typescript
const FALLBACK: EnrichmentResult = {
  team: extractTeamFromLabels(alert.labels),
  category: "application",
  severity_override: null,
  summary: alert.annotations.summary ?? alert.labels.alertname,
  impact: alert.annotations.business_impact ?? "Impact unknown",
  probable_causes: ["AI enrichment unavailable — manual investigation required"],
  recommended_actions: ["Check runbook", "Review recent deployments", "Check service logs"],
  confidence: 0,
  needs_human_review: true,
};
```

---

## Kubernetes Commands

```bash
# Check service health
kubectl get pods -n monitoring -l app=ai-alert-router

# View logs
kubectl logs -n monitoring -l app=ai-alert-router --tail=50

# Send test alert manually
kubectl run test-alert --rm -it --image=curlimages/curl -- \
  curl -X POST http://ai-alert-router.monitoring.svc:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"version":"4","status":"firing","receiver":"ai-enrichment","alerts":[{"status":"firing","labels":{"alertname":"TestAlert","severity":"warning"},"annotations":{"summary":"Test"},"startsAt":"2025-01-01T00:00:00Z"}]}'

# Check secret is synced
kubectl get secret ai-alert-router-secrets -n monitoring -o jsonpath='{.data}' | base64 -d

# Restart deployment (after secret rotation)
kubectl rollout restart deployment/ai-alert-router -n monitoring
```

---

## Prometheus Metrics to Watch

```promql
# Enrichment success rate
sum(rate(ai_alert_router_enrichments_total{status="success"}[5m]))
/ sum(rate(ai_alert_router_enrichments_total[5m]))

# LLM latency p99
histogram_quantile(0.99, rate(ai_alert_router_llm_duration_seconds_bucket[5m]))

# Fallback rate (LLM failures)
rate(ai_alert_router_enrichments_total{status="fallback"}[5m])

# Elasticsearch timeout rate
rate(ai_alert_router_es_timeouts_total[5m])
```

---

## Alert Annotation Conventions

Add these to every alert rule that goes through AI enrichment:

```yaml
annotations:
  summary: "Short human-readable description"
  description: "Detailed technical description with metric values"
  business_impact: "What breaks for users/revenue if this fires"
  runbook_url: "https://wiki.internal/runbooks/alert-name"
  team: "owning-team-slug"
```

`business_impact` is the most valuable annotation — it appears in the Slack message even when AI enrichment fails.

---

## Cost Controls

| Control | Value |
|---------|-------|
| `max_tokens` | 500 |
| `temperature` | 0 |
| `send_resolved: false` | Halves token usage (no resolve events) |
| Alert selector (not all alerts) | Limits volume |
| Pilot scope (5 alert types) | Validate before expanding |

Approximate cost: GPT-4o at ~500 tokens/call × N alerts/day. At 100 alerts/day: ~$0.50/day.

---

## Security Checklist

- [ ] API keys in Kubernetes Secrets via External Secrets Operator (never in env vars in manifests)
- [ ] No PII in alert labels or annotations (user IDs, emails)
- [ ] Elasticsearch query scoped to namespace (not cluster-wide)
- [ ] LLM prompt instructs: "do not include PII in output"
- [ ] Slack webhook URL in Secret, not hardcoded
- [ ] NetworkPolicy: only Alertmanager can reach port 3000

---

## Pilot Validation Checklist

- [ ] Baseline MTTA measured (30 days before)
- [ ] 5 alert types selected (frequency + complexity criteria)
- [ ] `continue: true` verified in Alertmanager config
- [ ] Fallback path tested (kill the service, confirm original alerts still fire)
- [ ] On-call team briefed on new Slack message format
- [ ] Feedback collection mechanism in place (thumbs up/down on Slack messages)
- [ ] Cost monitoring dashboard set up
- [ ] 30-day post-pilot MTTA comparison scheduled
