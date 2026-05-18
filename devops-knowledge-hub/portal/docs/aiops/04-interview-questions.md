---
title: "AIOps Interview Questions"
sidebar_label: "Interview Questions"
sidebar_position: 4
---

# AIOps Interview Questions

Twenty-five questions covering AIOps architecture, LLM integration, alert routing design, Elasticsearch context retrieval, GitOps deployment, and production trade-offs. Each answer references the real implementation from the `ai-alert-router` project.

---

## Foundational AIOps Concepts

**Q1: Why would you introduce an AIOps layer between Alertmanager and Slack when traditional alerting already works?**

Traditional Alertmanager alerts are raw metric threshold crossings. They tell you a metric violated a rule but not why it happened, who owns the affected service, what the business impact is, or what to do first. Engineers spend 5–15 minutes on mechanical triage before they can begin remediation.

AIOps inserts an enrichment layer that adds: team ownership from a ConfigMap, recent error logs from Elasticsearch, an AI-generated probable cause analysis, and recommended remediation steps. The result is a message the on-call engineer can act on immediately. MTTA (mean time to acknowledge) drops because the first thing the engineer does is act, not investigate.

The key design constraint: enrichment is always additive. The original alert is always delivered via the unmodified `default-receiver`. If the AI path fails entirely, nothing is lost.

---

**Q2: What is alert fatigue and how does AIOps specifically address it?**

Alert fatigue occurs when engineers receive so many low-context, low-signal alerts that they start ignoring them or develop slow response reflexes. It has two root causes: volume (too many alerts) and quality (alerts without actionable context).

AIOps addresses quality directly. It cannot reduce volume (that is a rules and thresholds problem), but it ensures that every alert reaching the engineer is accompanied by a structured brief: what happened, who owns it, what is the business impact, what are the probable causes, and what to do first. This makes each alert worth reading, which restores confidence in the alerting system.

In the pilot implementation, the `business_impact` annotation was added to all 8 pilot alert rules specifically so that even the fallback path (when AI enrichment fails) delivers more context than the raw alert.

---

**Q3: How do you decide which alerts to route through AI enrichment vs which to leave as raw alerts?**

For the pilot, 5 alert types were selected based on:
1. **Frequency** — alerts that fire regularly enough to generate useful feedback data
2. **Ownership ambiguity** — alerts where the owning team is not obvious from the alert name
3. **Diagnostic complexity** — alerts that typically require investigation before the engineer knows what to do
4. **Business impact** — alerts whose impact statement is valuable to include in the Slack message

Alerts like `Watchdog` and `InfoInhibitor` were explicitly excluded — they are synthetic health check alerts that have no business impact and no diagnostic complexity.

The `continue: true` flag on the Alertmanager child route ensures the routing decision is not all-or-nothing. Selected alerts go through enrichment AND the original channel. Unselected alerts only go to the original channel.

---

## Alert Enrichment Design

**Q4: Walk me through the alert label schema you added to PrometheusRules for AIOps.**

Each pilot alert received four additional labels and three additional annotations:

Labels:
- `team: <platform|business|data>` — direct lookup key in the team ownership ConfigMap
- `service: <logical-name>` — used for service-level overrides in ConfigMap (takes precedence over namespace lookup)
- `component: <subsystem>` — granular context for the AI prompt
- `environment: staging` — enables environment-scoped routing in Phase 2

Annotations:
- `business_impact: "..."` — human-readable business consequence, used in the fallback Slack message and AI prompt
- `runbook_url: "https://..."` — surfaced as a Slack action button
- `suggested_query: "..."` — used for the Grafana dashboard deep-link action button

The resolution order in the ConfigMap lookup is: service override → namespace lookup → fallback. The `service` label bypass is important because some services (like `redis`) span multiple namespaces.

---

**Q5: Why store team ownership in a ConfigMap instead of the service code?**

Team ownership changes frequently: services change hands, new namespaces are created, Slack channel names evolve. Encoding this in service code requires a rebuild and redeployment to update a mapping.

A ConfigMap is version-controlled in Git, reconciled by FluxCD, and takes effect within minutes of a merge without any service restart. The service reads the ConfigMap file on each request with mtime-based caching — if the file has not changed, it uses the cached version; if the ConfigMap has been updated and the file mtime has changed, it reloads.

This is the single-source-of-truth approach: team assignments live in one place, are auditable via Git history, and can be updated by anyone with repo access without needing to understand the service internals.

---

**Q6: What happens if the same alert fires in a namespace that is not in the ConfigMap?**

The resolution falls through to the fallback: `team: "unknown"` and the fallback Slack channel (`#allex-staging-alerts-k8s`). The alert is still delivered — just without team attribution in the enriched message.

In practice, the fallback catches new namespaces before they are added to the ConfigMap. This is the correct failure mode: better to send the alert without team attribution than to drop it.

The pilot validation checklist includes verifying that all pilot namespaces are covered by the ConfigMap before Phase 2 begins.

---

## LLM Prompt Engineering for Ops

**Q7: How do you structure a prompt for alert enrichment with an LLM?**

The prompt is split into system and user components:

**System prompt**: Defines the role (`expert SRE analyst for Allex`), output rules (JSON only, no markdown), specific field constraints (`category` must be one of 6 valid values, `confidence` between 0.0-1.0), and the exact output schema. Rules are numbered and explicit.

**User prompt**: Contains alert-specific data in a structured key-value list. Fields that are not available are stated explicitly (`"Not provided"` rather than omitted) so the model does not hallucinate values for missing fields. The recent log context is appended as a named section.

Temperature is set to `0.1` for consistent, factual output. Low temperature reduces variance and makes prompt regression testing more reliable.

`response_format: { type: 'json_object' }` is set in the API call — this is Azure OpenAI's JSON mode, which forces the model to emit valid JSON regardless of the prompt. Combined with Zod schema validation on the output, this prevents format-related failures.

---

**Q8: How do you handle LLM hallucination in an incident response context?**

Three mechanisms:

1. **`needs_human_review: true`**: The schema includes this boolean. The system prompt instructs the model to set it when `confidence < 0.5` or when the alert has no description/summary, or when there are contradictory signals. When set, the Slack message displays a "Needs human review" badge prominently.

2. **`confidence: 0.0-1.0`**: Shown as a percentage in the Slack message. Engineers can immediately assess how much weight to give the AI's analysis.

3. **Source attribution rule**: The system prompt says explicitly "Do not invent facts not present in the input." This does not eliminate hallucination but reduces it. The real protection is the `needs_human_review` flag — the AI should flag its own uncertainty.

4. **Fallback path**: If the AI produces an invalid schema or fails entirely, the fallback message uses only verified data (alert labels and annotations from Prometheus) with no AI-generated content. This is always safe.

---

**Q9: What is the token budget for the alert enrichment prompt and why does it matter?**

The estimated token budget per call:
- System prompt: ~250 tokens (static)
- User prompt with alert data: ~150-200 tokens (variable, depends on annotation length)
- Log context (when available): ~200-300 tokens (capped at 1000 chars)
- Total prompt: ~600-750 tokens average
- Completion: ~200-300 tokens for the JSON response
- Total per call: ~800-1050 tokens

At Azure OpenAI GPT-4o pricing ($5/1M prompt + $15/1M completion), this is approximately $0.004-0.008 per alert enrichment. Over 2 weeks at 10-20 alerts/day, total cost is well under $5.

Token budget matters because:
- Azure OpenAI has TPM (tokens per minute) limits — staying small leaves headroom
- Larger prompts increase latency
- The 1000-char hard cap on log context injection prevents prompt bloat during high-error periods

---

**Q10: How do you test that a prompt change has not regressed the output quality?**

1. **Schema validation tests**: Run the Zod schema against a saved set of real OpenAI responses. If a prompt change causes the model to produce invalid JSON or violate schema constraints, the test fails.

2. **Golden output tests**: Save 5-10 representative alert payloads and their expected enrichment outputs. After a prompt change, run the same payloads and compare category, confidence, and needs_human_review to expected values.

3. **Timeout simulation**: Set `OPENAI_TIMEOUT_MS=1` and verify that no code path panics — the service should emit `event: openai_timeout` and fall back cleanly.

4. **Pilot feedback loop**: Track the "Probable Cause Relevant?" column in the pilot validation table over time. A drop in relevance score after a prompt change indicates regression.

---

## Vector Search for Runbooks

**Q11: The current implementation uses Elasticsearch full-text search for log context. How would you extend this to vector search for runbook retrieval?**

The current implementation retrieves error logs by namespace and time window. Vector search for runbooks would work differently:

1. **Index runbooks as embeddings**: Each runbook section is chunked and embedded using an embedding model (e.g., `text-embedding-ada-002`). The embeddings are stored in an Elasticsearch dense_vector field or a dedicated vector store (Pinecone, pgvector, Weaviate).

2. **Query by alert similarity**: At alert time, the alert's summary + description + probable_causes are embedded and used as the query vector. The nearest-neighbour search returns the most semantically similar runbook sections.

3. **Inject into prompt**: The retrieved runbook excerpt is added to the user prompt alongside the log context: `RELEVANT RUNBOOK SECTION: <excerpt>`.

The advantage over the current `runbook_url` annotation approach is that the LLM can reason from the actual runbook content, not just link to it. The disadvantage is additional cost (embedding calls), infrastructure complexity (vector index), and retrieval accuracy depends on runbook quality and embedding model.

For the current implementation, the `runbook_url` annotation provides the link and the LLM uses it in `recommended_actions` to point the engineer there. Vector search is a Phase 3 enhancement.

---

## False Positive Rate and Metrics

**Q12: What metrics would you track to measure AIOps effectiveness?**

Quantitative:
- **Team classification accuracy**: % of alerts where AI-assigned team matches actual resolving team
- **Enrichment latency p50/p95**: From `enrichment_complete` log events, `latency_ms` field
- **Fallback rate**: % of alerts that use the unenriched fallback message (from `enrichment_fallback` log events)
- **Confidence distribution**: Average and p5 of `confidence` field — consistently low confidence indicates prompt issues
- **`needs_human_review` rate**: High rate means the model lacks confidence; low rate on complex incidents means it may be overconfident
- **OpenAI token usage and cost**: From `openai_call_success` log events, `prompt_tokens` and `completion_tokens`
- **Elasticsearch hit rate**: % of enrichments where `log_context_available: true`
- **MTTA delta**: Compare mean time to acknowledge before and after AIOps (requires incident tracking system integration)

Qualitative:
- Engineer utility score from pilot feedback
- Number of "probable cause was correct" annotations in the pilot log table

---

## GitOps for AI Services

**Q13: What are the specific considerations when deploying an AI service (with LLM calls and external API dependencies) via GitOps compared to a standard stateless service?**

Additional considerations for AI services:

1. **Secret management**: API keys for LLM providers must never appear in Git. Use ExternalSecrets Operator to pull from GCP/AWS Secret Manager. Verify key rotation does not cause `refreshInterval: "0"` to cache a stale key.

2. **Environment variable gates**: `SHADOW_MODE` and `PILOT_MODE` are deployment-phase flags. The GitOps repo is the source of truth — changing these triggers FluxCD reconciliation within minutes, giving a quick rollback path.

3. **Resource sizing**: LLM calls hold HTTP connections for several seconds. The service needs enough CPU and memory to handle concurrent alert groups. Monitor `OOMKilled` events after enabling live mode.

4. **Timeout configuration as GitOps variables**: `OPENAI_TIMEOUT_MS` and `ES_TIMEOUT_MS` are in the HelmRelease values. Tuning these does not require a code change — just a Git commit.

5. **Image policy automation**: The `ImagePolicy` resource in FluxCD watches the registry and automatically creates a PR to update the image tag. This means a successful CI build auto-deploys to staging without manual intervention — desirable for shadow mode, but should require a manual approval gate before enabling live Slack delivery.

---

**Q14: How do you handle LLM latency in the alert delivery critical path?**

The fundamental answer: the LLM is NOT in the alert delivery critical path.

The `ai-alert-router` returns HTTP 200 to Alertmanager immediately upon receiving the webhook, before any enrichment work begins. Alertmanager's timeout applies only to the initial response, not to the enrichment pipeline.

```typescript
router.post('/alertmanager', (req: Request, res: Response) => {
  res.status(200).json({ status: 'accepted' }); // immediate
  // Everything below happens after the response
  processAlerts(req.body).catch(err => { /* log, don't crash */ });
});
```

The consequence: if the LLM takes 8 seconds and the OpenAI timeout is 5 seconds, the Slack message is delayed by 5 seconds. This is acceptable — Alertmanager already delivered the raw alert to `#allex-staging-alerts-k8s` via the `default-receiver`. The enriched message is a nice-to-have, not a blocker.

The only metric we track for latency is end-to-end enrichment time (`enrichment_complete.latency_ms`) and the p95 threshold is 10 seconds, not 5. Engineers may see the enriched message arrive 5-15 seconds after the raw alert.

---

**Q15: How would you roll out AIOps gradually without disrupting existing on-call processes?**

The implementation used a three-phase rollout:

**Phase 0 — Shadow mode**: Service receives webhooks and logs routing decisions. No Slack messages sent. Run for 1-2 weeks. Validates: webhook connectivity, team lookup accuracy, log output safety.

**Phase 1 — Pilot test channel**: Shadow mode disabled. 5 alert types routed to `#allex-aiops-test`. All alerts still go to `#allex-staging-alerts-k8s` unchanged (via `continue: true`). Engineers subscribe voluntarily and provide feedback. Run for 2 weeks.

**Phase 2 — Per-team channels**: `pilot_mode: false` in ConfigMap. Enriched alerts go to team channels. `#allex-staging-alerts-k8s` still receives all alerts (engineers transition off it gradually). 

**Phase 3 — Full coverage**: All alert types enriched. `#allex-staging-alerts-k8s` deprecated or converted to audit log.

At no point does a phase transition require shutting down the original alert delivery. The rollback is always: set `SHADOW_MODE=true` and commit.

---

## Cost vs Value of AI Enrichment

**Q16: How do you justify the cost of Azure OpenAI calls for every alert?**

At ~$0.005 per enrichment and 10-20 alerts per day in staging, the monthly cost is under $3. Even at 10x production volume (100-200 alerts/day), this is $15-30/month — less than a single hour of on-call engineer time.

The value side: if AIOps reduces MTTA by 5 minutes per incident, and the team handles 50 incidents per month at an average engineering cost of $150/hour, the monthly saving is $625. The ROI is clear.

The risk: OpenAI pricing can change, alert volume can spike, and the 5-minute MTTA reduction must be validated (not assumed). The pilot's MTTA delta measurement is specifically designed to validate this assumption before committing to full rollout.

For cost control: `max_tokens: 800`, fingerprint-based caching for repeated alerts, and Azure OpenAI monthly budget alerts.

---

**Q17: What is the argument AGAINST using LLMs for alert enrichment?**

Legitimate objections:

1. **Hallucination risk**: The model may suggest incorrect probable causes, especially for novel failure modes not represented in training data. Engineers may act on bad advice. Mitigated by `needs_human_review` and `confidence` fields, but not eliminated.

2. **Latency**: Even a 5-second LLM call means the enriched message arrives after the raw alert. In a fast-moving incident, engineers may already be triaging before the enrichment arrives.

3. **External API dependency**: Azure OpenAI is an external service. Outages (however rare) mean all enrichments fall back to plain-text for the duration.

4. **Cost at scale**: For teams with thousands of alerts per day, the per-call cost becomes meaningful and requires careful budget governance.

5. **Prompt maintenance**: The system prompt needs updating as the system evolves. If new alert types are added without updating the prompt context, enrichment quality degrades silently.

The correct framing: AIOps is a supplement to good alert hygiene, not a substitute. If alerts are genuinely noisy and poorly defined, an LLM cannot fix that — it just produces confident-sounding descriptions of bad alerts.

---

## Advanced Technical Questions

**Q18: How would you implement rate limiting in the ai-alert-router to protect against alert storms?**

During an alert storm, dozens of alerts may fire simultaneously. Each calls OpenAI, creating a spike in TPM consumption that could hit rate limits.

Mitigations:
1. **Fingerprint cache**: Cache enrichment results by alert fingerprint for 5 minutes. Repeated fires of the same alert (within Alertmanager's `group_interval`) reuse the cached enrichment.
2. **Concurrency limit**: Process at most N OpenAI calls concurrently. Use a semaphore or queue. Additional alerts are enriched sequentially or fall back after a queue timeout.
3. **Alert grouping**: Alertmanager already groups alerts by `namespace`. The webhook receives one payload per group. Process the highest-severity alert in each group and use its enrichment for the group summary.
4. **Exponential backoff on 429**: The OpenAI SDK handles retries internally, but setting a tight `timeout` prevents long waits during rate limiting.

---

**Q19: What security concerns exist when injecting alert data into an LLM prompt?**

1. **PII in annotations**: Alert annotations may contain user IDs, email addresses, or API tokens from error messages. The service truncates log lines to 200 characters and caps total log injection at 1000 characters. The system prompt does not log annotation values.

2. **Prompt injection**: An attacker who can write to an alert annotation could theoretically inject instructions into the LLM prompt. The `response_format: json_object` constraint and Zod schema validation limit the impact — a prompt injection attack cannot make the service produce arbitrary text output.

3. **Data residency**: Alert data (including potentially sensitive log content) is sent to Azure OpenAI. Ensure the Azure OpenAI resource is in the correct region and that data processing agreements are in place for your compliance requirements.

4. **API key exposure**: The `AZURE_OPENAI_API_KEY` is injected via Kubernetes secret from ExternalSecrets. The service must never log this value. The log hygiene rule: log boolean flags (`summary_present: true`), never annotation content.

---

**Q20: How does `continue: true` work in Alertmanager routing and why is it critical for this architecture?**

Alertmanager routes alerts by evaluating routes from top to bottom. By default, it stops at the first matching route. `continue: true` instructs Alertmanager to continue evaluating subsequent routes even after a match.

Without `continue: true` on the `ai-enricher` route:
- Alert matches `ai-enricher` route
- Alertmanager stops → only `ai-enricher` fires → `default-receiver` suppressed → **alert not delivered to `#allex-staging-alerts-k8s`**

With `continue: true`:
- Alert matches `ai-enricher` route
- Alertmanager continues evaluating → matches `default-receiver` → **both fire**
- Engineers see the enriched message in `#allex-aiops-test` AND the raw alert in `#allex-staging-alerts-k8s`

This is the mechanism that makes the AI path truly additive and zero-risk. Even if `ai-alert-router` is down, `default-receiver` still delivers the alert.

---

**Q21: How would you A/B test different prompt versions in production?**

1. **Feature flag in HelmRelease**: Add `PROMPT_VERSION=v1` to the HelmRelease env vars. The prompt builder reads this and selects the prompt template.

2. **Canary by fingerprint**: Route alerts with even-numbered fingerprints to prompt v1 and odd-numbered to v2 (using `fingerprint.hashCode() % 2`).

3. **Metrics split**: Log `prompt_version` in the `enrichment_complete` event. Analyse latency, fallback rate, and confidence distribution per version.

4. **Engineer feedback split**: During the pilot, send version labels in the Slack message footer so engineers know which version produced the enrichment. Collect thumbs-up/thumbs-down reactions.

The pilot period is naturally an A/B test against the baseline (no enrichment) — all enriched alerts in `#allex-aiops-test` vs raw alerts in `#allex-staging-alerts-k8s`.

---

**Q22: What changes would you need to make to support per-team Slack channels (Phase 2)?**

1. **ConfigMap**: Set `pilot_mode: false`. The existing `slack_channel` per team is already defined. This takes effect immediately without service restart.

2. **GCP secrets**: Each team channel needs its own Slack incoming webhook URL. Create new GCP secret entries and new ExternalSecret resources per channel.

3. **Slack sender**: Update `sendIncidentToSlack` to select the webhook URL based on the resolved team channel. Options: one webhook URL per channel stored as separate secrets, or use the Slack Web API with OAuth bot token (single credential, channel specified in payload).

4. **Alert rules verification**: AIOPS-02 labels must be applied to all alert types, not just the 5 pilot alerts. Missing labels fall back to namespace lookup.

5. **On-call rotation update**: Engineers must know to check their team channel. A transition period where both `#allex-staging-alerts-k8s` and team channels are active is recommended.

---

**Q23: How does the Elasticsearch log context change the LLM's behaviour?**

Without log context, the LLM reasons from static information: the alert name, labels, and annotations. It can produce reasonable probable causes based on its training data about Redis, Kubernetes, etc., but cannot reference what actually happened in the cluster.

With log context (top 3 deduplicated error messages from the last 15 minutes), the LLM can:
- Cite specific error messages: "The logs show `NOAUTH Authentication required` errors from 3 pods, suggesting a Redis authentication configuration change"
- Distinguish between probe failure and actual service failure: "The log context shows no error messages in the allex-redis namespace, suggesting the `redis_up` metric may be a scraping issue rather than a Redis failure"
- Reference recent context: "Multiple `OOMKilled` events in the pod logs align with the CrashLooping pattern"

In the prompt, the log context appears as:
```
RECENT ERROR LOGS (last 15 minutes, top errors by frequency):
1. [x7] FATAL: Redis is down, reconnecting...
2. [x3] Error: NOAUTH Authentication required
3. [x1] Error: Cannot allocate memory
```

The model uses these as evidence in `probable_causes` and adjusts `confidence` accordingly.

---

**Q24: What does the `EnrichedIncident` data model look like and what fields does the Slack message use?**

```typescript
interface EnrichedIncident {
  alert: Alert;                    // normalised from Alertmanager payload
  team: string | null;             // from AI or ConfigMap
  category: string | null;         // capacity|dependency|deployment|application|data|infrastructure
  severityOverride: string | null; // AI may suggest different severity
  summary: string | null;          // 1-2 sentence AI-generated summary
  impact: string | null;           // business impact statement
  probableCauses: string[] | null; // ordered list of probable causes
  recommendedActions: string[] | null;
  confidence: number | null;       // 0.0-1.0
  needsHumanReview: boolean | null;
  recentLogContext: LogLine[] | null;
  logContextAvailable: boolean;
  targetSlackChannel: string;      // from ConfigMap (pilot-aware)
  pilotMode: boolean;
  enrichmentLatencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  shadowMode: boolean;
}
```

The Slack Block Kit formatter uses:
- Header: `alertName`, `status`, `severity` → emoji selection
- Context row: `team`, `environment`, `namespace`, `activeDurationMinutes`, `category`
- Summary section: `summary` (AI) or `alert.summary` (fallback)
- Impact section: `impact` (AI) or `alert.businessImpact` (fallback)
- Probable Causes: `probableCauses` (only if AI succeeded)
- Recommended Actions: `recommendedActions` (only if AI succeeded)
- Confidence badge: `confidence`, `needsHumanReview`
- Action buttons: `alert.runbookUrl`, `alert.suggestedQuery` (for Grafana link), `alert.alertName` (for Alertmanager silence)
- Footer: pilot mode indicator

---

**Q25: What would you change in the architecture if alert volume grew 100x?**

At 100x volume (1000-2000 alerts/day):

1. **Caching layer**: Redis/Memcached cache for enrichment results by fingerprint. TTL = `group_interval` (5 min). Avoids redundant LLM calls for repeated alerts.

2. **Queue-based processing**: Replace synchronous (after-response) processing with a message queue. The webhook handler publishes to the queue; worker pool processes enrichments. Workers can be scaled independently.

3. **Token budget**: Aggressively shorten prompts. Remove log context for non-critical alerts. Only inject log context for `severity: critical`.

4. **Multi-region OpenAI**: Use multiple Azure OpenAI deployments in different regions for redundancy and higher TPM limits.

5. **Batch enrichment**: For alert storms (>10 alerts in one group), enrich only the highest-severity alert and use it as a representative summary for the group.

6. **Dedicated nodes**: Move `ai-alert-router` to its own node pool with higher CPU/memory to handle concurrent enrichments.

7. **Cost governance**: Implement per-team or per-service alert quotas. High-frequency benign alerts (heartbeats, etc.) are excluded from AI enrichment entirely.
