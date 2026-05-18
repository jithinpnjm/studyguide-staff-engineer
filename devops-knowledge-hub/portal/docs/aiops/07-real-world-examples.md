---
title: "AIOps Real-World Examples"
sidebar_label: "Real-World Examples"
sidebar_position: 7
---

# AIOps Real-World Examples

Production scenarios showing how the AI alert enrichment pipeline behaves across different alert types, failure modes, and edge cases.

---

## Example 1: High Error Rate — Full Enrichment Path

**Alert fired:** `HighErrorRate` on `payment-service`, severity `critical`, firing for 8 minutes.

**Elasticsearch log context retrieved (3 errors in 15 min):**
```
[47x] java.sql.SQLException: Connection pool exhausted — no available connections after 30000ms
[12x] org.springframework.dao.DataAccessResourceFailureException: Unable to acquire JDBC Connection
[3x]  HikariPool-1 - Connection is not available, request timed out after 30000ms
```

**LLM output:**
```json
{
  "team": "payments",
  "category": "dependency",
  "severity_override": null,
  "summary": "Payment service database connection pool is exhausted, causing HTTP 5xx errors on all checkout requests.",
  "impact": "All payment processing is failing; revenue impact is active.",
  "probable_causes": [
    "Database connection pool size too small for current traffic",
    "Connection leak — connections not being returned to pool after use",
    "Upstream database slowdown causing connections to be held longer than usual"
  ],
  "recommended_actions": [
    "Check HikariCP pool metrics: active, idle, pending connections",
    "Review recent traffic spike — compare current RPS to baseline",
    "Check RDS CloudWatch: DatabaseConnections, ReadLatency, WriteLatency",
    "Temporary: increase pool size via env var HIKARI_MAX_POOL_SIZE",
    "Check for long-running transactions holding connections"
  ],
  "confidence": 0.92,
  "needs_human_review": false
}
```

**Slack message delivered to `#payments-incidents`:**
> 🔴 **CRITICAL** · payment-service · HighErrorRate
> Database connection pool exhausted — all checkout requests failing. Revenue impact active.
> **Probable causes:** Pool too small for traffic · Connection leak · DB slowdown
> **Actions:** Check HikariCP metrics → Check RDS CloudWatch → Increase pool size if needed
> Confidence: 92% · Team: payments

**Outcome:** On-call engineer went directly to HikariCP metrics, found pool at 100% utilization, identified a connection leak introduced in the last deploy. Rollback in 4 minutes. MTTA: 2 min (vs 11 min baseline).

---

## Example 2: Pod CrashLooping — Elasticsearch Unavailable

**Alert fired:** `PodCrashLooping` on `auth-service`, severity `warning`, 3 restarts in 10 minutes.

**Elasticsearch query:** timed out after 3 seconds (ES cluster under load).

**LLM input:** alert data only, no log context.

**LLM output:**
```json
{
  "team": "platform",
  "category": "application",
  "severity_override": null,
  "summary": "auth-service pods are crash-looping; log context unavailable due to Elasticsearch timeout.",
  "impact": "Authentication failures possible; dependent services may be unable to validate tokens.",
  "probable_causes": [
    "OOMKill — memory limit too low for current load",
    "Application startup failure — missing config or secret",
    "Dependency unavailable at startup — database or cache not reachable"
  ],
  "recommended_actions": [
    "kubectl logs auth-service-xxx --previous — check crash reason",
    "kubectl describe pod auth-service-xxx — check exit code (137=OOM, 1=app error)",
    "Check if recent deployment changed resource limits or env vars",
    "Verify dependent services: Redis, PostgreSQL reachable from pod"
  ],
  "confidence": 0.55,
  "needs_human_review": true
}
```

**Note:** `needs_human_review: true` because confidence is below 0.5 threshold and no log context was available. The Slack message included a banner: "⚠️ Low confidence — log context unavailable. Manual investigation recommended."

**Outcome:** Engineer checked `kubectl logs --previous`, found `OOMKilled` (exit 137). Memory limit was 256Mi, actual usage was 280Mi after a recent traffic increase. Limit bumped to 512Mi.

---

## Example 3: Severity Override in Action

**Alert fired:** `HighMemoryUsage` on `ml-inference-service`, severity `warning`, memory at 87%.

**LLM output:**
```json
{
  "team": "ml-platform",
  "category": "capacity",
  "severity_override": "critical",
  "summary": "ML inference service memory at 87% and climbing; OOMKill imminent within estimated 15 minutes at current growth rate.",
  "impact": "OOMKill will cause inference request failures and model reload latency spike affecting all downstream recommendation features.",
  "probable_causes": [
    "Memory leak in model serving code — gradual growth pattern visible in logs",
    "Batch inference job running concurrently with online serving, competing for memory"
  ],
  "recommended_actions": [
    "Immediately scale replicas to distribute load: kubectl scale deployment ml-inference --replicas=4",
    "Check if batch job is running: kubectl get jobs -n ml-platform",
    "Review memory growth rate in Grafana — is it linear or accelerating?"
  ],
  "confidence": 0.78,
  "needs_human_review": false
}
```

**What happened:** The original alert was `warning` but the LLM upgraded it to `critical` based on the trajectory analysis in the description. The Slack message was routed to the critical channel and paged the on-call.

**Outcome:** On-call found a batch job running during peak hours (a misconfigured CronJob). Job cancelled, memory stabilized. The severity override prevented what would have been a missed OOMKill.

---

## Example 4: Fallback Path — LLM Timeout

**Alert fired:** `ServiceDown` on `inventory-service`, severity `critical`.

**Situation:** Azure OpenAI endpoint was experiencing elevated latency (>25s). The LLM call timed out.

**Fallback enrichment delivered:**
```json
{
  "team": "inventory",
  "category": "application",
  "severity_override": null,
  "summary": "inventory-service · ServiceDown · AI enrichment unavailable",
  "impact": "Checkout failures affecting revenue — inventory checks failing",
  "probable_causes": ["AI enrichment unavailable — manual investigation required"],
  "recommended_actions": [
    "Check runbook: https://wiki.internal/runbooks/service-down",
    "Review recent deployments",
    "Check service logs"
  ],
  "confidence": 0,
  "needs_human_review": true
}
```

**Critical behaviour verified:** The original alert was still delivered to `#alerts` via the `default-receiver` (because `continue: true`). The fallback enrichment was delivered to `#inventory-incidents` with the `business_impact` annotation ("Checkout failures affecting revenue") which was present in the alert rule itself.

**Outcome:** No alert was lost. The on-call received both the raw alert and the fallback enrichment. The `business_impact` annotation in the fallback message still gave more context than a raw Alertmanager notification.

---

## Example 5: Multi-Alert Grouping

**Situation:** A node failure caused 6 alerts to fire simultaneously:
- `PodCrashLooping` × 3 (different services)
- `HighErrorRate` × 2
- `NodeNotReady` × 1

**Alertmanager grouping:** All 6 alerts were grouped into one webhook call (same `group_by: [namespace]`).

**AI enrichment behaviour:** The service processed the grouped payload, identified `NodeNotReady` as the root cause alert, and generated a single enrichment:

```json
{
  "team": "platform",
  "category": "infrastructure",
  "severity_override": "critical",
  "summary": "Node failure in production cluster causing cascading pod evictions across 3 services.",
  "impact": "Multiple services degraded; payment and auth services showing elevated error rates.",
  "probable_causes": [
    "Node hardware failure or kernel panic",
    "Node evicted due to disk pressure or memory pressure",
    "Cloud provider instance termination (spot interruption)"
  ],
  "recommended_actions": [
    "kubectl describe node <node-name> — check conditions and events",
    "Check cloud provider console for instance health",
    "Verify pods are rescheduling: kubectl get pods -A --field-selector=status.phase=Pending",
    "Check if Karpenter/Cluster Autoscaler is provisioning replacement node"
  ],
  "confidence": 0.88,
  "needs_human_review": false
}
```

**Outcome:** One enriched message instead of 6 raw alerts. On-call immediately understood the blast radius and root cause.

---

## Example 6: Pilot Metrics After 30 Days

**Baseline (30 days before deployment):**
- MTTA: 11.2 minutes average
- Alert volume: 847 alerts
- On-call feedback: "alerts are noisy, hard to know where to start"

**Post-deployment (30 days after):**
- MTTA: 4.1 minutes average (−63%)
- Enrichment success rate: 94.2% (LLM responded within timeout)
- Fallback rate: 5.8% (ES timeout or LLM timeout)
- Severity overrides issued: 12 (8 upgrades, 4 downgrades)
- `needs_human_review: true` rate: 18% (low-confidence situations correctly flagged)
- On-call feedback: "I know what to do before I even open the terminal"

**Cost:** ~$0.40/day at 94 enriched alerts/day with GPT-4o at ~500 tokens/call.
