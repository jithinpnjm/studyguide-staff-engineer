---
title: "AIOps Production Engineering"
sidebar_label: "Expert"
sidebar_position: 3
---

# AIOps Production Engineering

This guide covers the advanced implementation decisions: Azure OpenAI integration with structured output and fallback paths, Elasticsearch log context retrieval with timeout budgets, GitOps deployment patterns for AI services, Kubernetes secret management, pilot validation methodology, and production considerations including rate limiting, cost controls, and PII handling.

---

## Azure OpenAI Integration (AIOPS-07)

### Why structured JSON output

Free-text LLM responses cannot be reliably parsed. By instructing GPT-4o to emit only valid JSON conforming to a schema — and validating that schema before use — the service treats AI output as structured data throughout the pipeline. This also enables schema validation tests and prompt regression detection.

### Prompt architecture

The prompt is split into a system prompt (role, rules, schema) and a user prompt (alert-specific data):

```typescript
// System prompt — defines role and output contract
export function buildSystemPrompt(): string {
  return `You are an expert SRE analyst for a SaaS project management platform called Allex.
Your job is to analyse Kubernetes/infrastructure alert data and produce a concise,
actionable incident summary for the on-call engineer.

RULES:
1. Output ONLY valid JSON — no markdown, no code blocks, no explanation text.
   The output must be parseable by JSON.parse().
2. Do not invent facts not present in the input. If uncertain, set needs_human_review: true.
3. Keep the summary to a maximum of 2 sentences.
4. probable_causes and recommended_actions must each contain 1-5 items.
5. confidence reflects certainty about probable_causes (0.0 = guess, 1.0 = certain).
6. Set needs_human_review: true if: confidence < 0.5, no description/summary, contradictory signals.
7. category must be exactly one of: capacity, dependency, deployment, application, data, infrastructure.
8. severity_override must be null unless you have clear evidence the original severity is wrong.

Output schema:
{
  "team": "<string>",
  "category": "<capacity|dependency|deployment|application|data|infrastructure>",
  "severity_override": "<null|critical|warning|info>",
  "summary": "<1-2 sentences>",
  "impact": "<1-2 sentences>",
  "probable_causes": ["<string>", ...],
  "recommended_actions": ["<string>", ...],
  "confidence": <0.0-1.0>,
  "needs_human_review": <boolean>
}`;
}

// User prompt — alert-specific content
export function buildUserPrompt(input: PromptInput): string {
  const logSection = input.recentLogContext
    ? `\nRECENT ERROR LOGS (last 15 minutes, top errors by frequency):\n${input.recentLogContext}`
    : '\nRECENT ERROR LOGS: Not available.';

  return `ALERT DATA:
- Alert name: ${input.alertName}
- Severity: ${input.severity}
- Team: ${input.team}
- Service: ${input.service}
- Component: ${input.component}
- Environment: ${input.environment}
- Namespace: ${input.namespace}
- Summary: ${input.summary || 'Not provided'}
- Description: ${input.description || 'Not provided'}
- Business impact: ${input.businessImpact || 'Not provided'}
- Runbook: ${input.runbookUrl || 'Not available'}
- Active duration: ${input.activeDurationMinutes} minutes
- Grouped alerts count: ${input.groupedAlertsCount}
${logSection}

Analyse this alert and respond with ONLY the JSON object described in your instructions.`;
}
```

### Schema validation with Zod

```typescript
import { z } from 'zod';

export const EnrichmentResponseSchema = z.object({
  team: z.string(),
  category: z.enum(['capacity', 'dependency', 'deployment', 'application', 'data', 'infrastructure']),
  severity_override: z.enum(['critical', 'warning', 'info']).nullable(),
  summary: z.string().max(500),
  impact: z.string().max(500),
  probable_causes: z.array(z.string()).min(1).max(5),
  recommended_actions: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
});
```

### Azure OpenAI client with timeout

```typescript
const TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '5000', 10);

export async function enrichAlert(
  alert: Alert,
  groupedAlertsCount: number,
  recentLogContext: string | null
): Promise<EnrichmentResult> {
  const startTime = Date.now();

  try {
    const client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: 'https://allex-openai-rg.openai.azure.com',
      apiVersion: '2025-01-01-preview',
      timeout: TIMEOUT_MS,
    });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(promptInput) },
      ],
      temperature: 0.1,      // Low for consistent, factual output
      max_tokens: 800,
      response_format: { type: 'json_object' },  // Enforces JSON mode
    });

    const rawContent = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(rawContent);
    const validation = EnrichmentResponseSchema.safeParse(parsed);

    if (!validation.success) {
      // Schema validation failure — fall back, don't crash
      return { response: null, success: false, error: 'Schema validation failed', ... };
    }

    return { response: validation.data, success: true, ... };

  } catch (err) {
    const isTimeout = String(err).includes('timeout') || String(err).includes('ETIMEDOUT');
    // Log and return null — caller handles fallback routing
    return { response: null, success: false, error: isTimeout ? 'timeout' : String(err), ... };
  }
}
```

### Fallback decision matrix

```
OpenAI result              → Service action
─────────────────────────────────────────────────────────
Success + valid JSON        → Enrich incident, route to team channel
Success + invalid JSON      → Log schema error, route original to fallback
Timeout (> 5000ms)          → Log timeout, route original to fallback
Network error               → Log error, route original to fallback
SHADOW_MODE=true            → Skip OpenAI entirely, log shadow_mode_skip_openai
API key missing/expired     → Log error on startup, all alerts use fallback
```

---

## Elasticsearch Log Context Retrieval (AIOPS-08)

### Why log context improves enrichment

Without logs, the LLM can only reason from the alert metadata — the expression that fired, the labels, and the annotations. With recent error logs from the affected namespace, it can cite specific error messages, exception types, and pod-level failures in its probable cause analysis.

### Query design

```json
{
  "query": {
    "bool": {
      "must": [
        { "term": { "kubernetes.namespace_name": "allex-redis" } },
        { "range": { "@timestamp": { "gte": "now-15m", "lte": "now" } } }
      ],
      "should": [
        { "term": { "level": "error" } },
        { "term": { "level": "ERROR" } },
        { "term": { "severity": "error" } },
        { "match_phrase": { "log": "ERROR" } },
        { "match_phrase": { "log": "Exception" } },
        { "match_phrase": { "log": "Error:" } }
      ],
      "minimum_should_match": 1
    }
  },
  "sort": [{ "@timestamp": { "order": "desc" } }],
  "size": 10,
  "_source": ["@timestamp", "log", "kubernetes.pod_name", "kubernetes.container_name"]
}
```

### Log deduplication for token efficiency

Ten identical OOM error lines become one: `[x10] FATAL: Killed`. This reduces prompt token count significantly:

```typescript
function summariseLogLines(lines: RawLogLine[]): Array<{ message: string; count: number }> {
  const groups = new Map<string, { count: number; example: string }>();
  for (const line of lines) {
    // Normalise: replace numbers and hex IDs so identical messages group together
    const key = line.message
      .replace(/\d+/g, 'N')
      .replace(/[0-9a-f]{8,}/gi, '<id>');
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, { count: 1, example: line.message });
    }
  }
  // Top 3 by frequency
  return Array.from(groups.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 3)
    .map(([, { count, example }]) => ({ message: key, count, example }));
}
```

### Prompt injection with hard cap

```typescript
export function formatLogContextForPrompt(context: SummarisedLogContext): string | null {
  if (!context.available || context.topErrors.length === 0) return null;

  const lines = context.topErrors.map(
    (e, i) => `${i + 1}. [x${e.count}] ${e.example}`
  );
  return lines.join('\n').slice(0, 1000); // Hard cap: never inject more than 1000 chars
}
```

### Timeout and failure handling

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), ES_TIMEOUT_MS); // default 3s

try {
  const response = await fetch(`${ES_URL}/${ES_INDEX}/_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildQuery(namespace)),
    signal: controller.signal,
  });
  // ...
} catch (err) {
  clearTimeout(timeoutId);
  const isTimeout = String(err).includes('abort') || String(err).includes('AbortError');
  // Log and return { available: false } — enrichment continues without logs
  return { topErrors: [], rawLines: [], queryTimeMs, available: false, error: ... };
}
```

Key constraint: Elasticsearch unavailability must never block alert delivery. If ES times out, the LLM receives `RECENT ERROR LOGS: Not available.` in the prompt and continues without log context.

---

## GitOps Deployment Patterns (AIOPS-05)

### FluxCD resource hierarchy

```
flux-system namespace:
  ImageRepository (allex-ai-alert-router)
    → watches GCP Artifact Registry for new tags
  ImagePolicy (allex-ai-alert-router)
    → selects latest dev-* tag by timestamp
  GitRepository (allex-ai-alert-router)
    → clones service repo branch: dev

monitoring namespace:
  HelmRelease (ai-alert-router)
    → references GitRepository chart
    → values: image tag, env vars, volumes, tolerations
  ConfigMap (ai-alert-router-team-ownership)
    → team ownership data, mounted as /config/teams.yaml
```

### HelmRelease with image policy annotation

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: ai-alert-router
  namespace: monitoring
spec:
  interval: 5m
  chart:
    spec:
      chart: ./charts/ai-alert-router
      sourceRef:
        kind: GitRepository
        name: allex-ai-alert-router
        namespace: flux-system
  values:
    image:
      repository: europe-west3-docker.pkg.dev/allex-artifacts/allex-artifacts-docker/ai-alert-router
      # ImagePolicy writes the tag here automatically on new builds:
      tag: dev-20260407120000-abc123 #{"$imagepolicy": "flux-system:allex-ai-alert-router:tag"}
    tolerations:
      - key: nodepool_type
        operator: Equal
        value: monitoring-stack
        effect: NoSchedule
    nodeSelector:
      nodepool_type: monitoring-stack
    env:
      - name: SHADOW_MODE
        value: "true"
      - name: TEAMS_CONFIG_PATH
        value: "/config/teams.yaml"
      - name: AZURE_OPENAI_API_KEY
        valueFrom:
          secretKeyRef:
            name: azure-openai-credentials
            key: apiKey
    volumeMounts:
      - name: team-ownership-config
        mountPath: /config/teams.yaml
        subPath: teams.yaml
        readOnly: true
    volumes:
      - name: team-ownership-config
        configMap:
          name: ai-alert-router-team-ownership
```

### ImagePolicy for continuous deployment

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: allex-ai-alert-router
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: allex-ai-alert-router
  filterTags:
    pattern: '^dev-(?P<timestamp>\d{14})-.*'
    extract: '$timestamp'
  policy:
    alphabetical:
      order: asc  # latest timestamp = latest image
```

FluxCD automatically commits a PR to the GitOps repo when a new image tag is detected, keeping the image tag in `helm-release.yaml` in sync with the latest build.

---

## Azure OpenAI Secret Management (AIOPS-06)

### ExternalSecrets pattern

Both the OpenAI API key and Slack webhook URL exist as GCP Secret Manager entries already used by other services. The only new work is creating Kubernetes ExternalSecret resources in the `monitoring` namespace:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: external-secret-azure-openai-credentials-ai-alert-router
  namespace: monitoring
spec:
  secretStoreRef:
    kind: ClusterSecretStore
    name: gcp-backend
  refreshInterval: "0"          # fetch once, not refreshed (API keys rotate infrequently)
  target:
    name: azure-openai-credentials
    creationPolicy: 'Owner'
    deletionPolicy: 'Retain'    # keep the K8s secret if ESO is removed
    template:
      type: Opaque
      data:
        apiKey: "{{ .apiKey }}"
  data:
  - secretKey: apiKey
    remoteRef:
      key: allex-secret-azure-ai-key-staging
```

### Secret verification (without exposing values)

```bash
# Verify secret exists and has non-empty apiKey
kubectl get secret -n monitoring azure-openai-credentials \
  -o jsonpath='{.data.apiKey}' | base64 -d | wc -c
# Should return > 0

# Verify pod has the env var set
kubectl exec -n monitoring \
  $(kubectl get pod -n monitoring -l app.kubernetes.io/name=ai-alert-router \
    -o jsonpath='{.items[0].metadata.name}') \
  -- sh -c 'echo "Key set: $([ -n "$AZURE_OPENAI_API_KEY" ] && echo YES || echo NO)"'
```

---

## Pilot Validation Methodology (AIOPS-10)

### Success criteria (quantitative)

| Criterion | Threshold | How measured |
|-----------|-----------|-------------|
| Team classification accuracy | ≥ 80% | Manual log table: count `Team Correct? = Y` / total events |
| Enrichment latency p95 | < 10 seconds | `enrichment_complete` log events, `latency_ms` field |
| Zero alert loss | 0 cases | Cross-reference `#allex-aiops-test` vs `#allex-staging-alerts-k8s` |
| Service uptime | ≥ 99% | Pod restart count over 2 weeks |
| OpenAI cost | < $5 total | Token usage log analysis (prompt × $5/1M + completion × $15/1M) |
| Engineer utility | 3/5 engineers confirm improvement | Slack poll or 1:1 feedback |

### Token cost calculation from logs

```bash
kubectl logs -n monitoring -l app.kubernetes.io/name=ai-alert-router --tail=1000 | \
  python3 -c "
import sys, json
total_prompt = 0; total_completion = 0; count = 0
for line in sys.stdin:
    try:
        obj = json.loads(line)
        if obj.get('event') == 'openai_call_success':
            total_prompt += obj.get('prompt_tokens', 0)
            total_completion += obj.get('completion_tokens', 0)
            count += 1
    except: pass
if count:
    cost = (total_prompt * 5 + total_completion * 15) / 1_000_000
    print(f'Calls: {count}, Prompt: {total_prompt}, Completion: {total_completion}')
    print(f'Estimated cost: \${cost:.4f}')
"
```

### p95 latency from logs

```bash
kubectl logs -n monitoring -l app.kubernetes.io/name=ai-alert-router --tail=1000 | \
  python3 -c "
import sys, json
latencies = []
for line in sys.stdin:
    try:
        obj = json.loads(line)
        if obj.get('event') == 'enrichment_complete':
            latencies.append(obj['latency_ms'])
    except: pass
if latencies:
    latencies.sort()
    n = len(latencies)
    print(f'p50: {latencies[n//2]}ms, p95: {latencies[int(n*0.95)]}ms, max: {max(latencies)}ms')
"
```

---

## Production Considerations

### Rate limiting

Azure OpenAI has TPM (tokens per minute) limits. At ~600 tokens per call, the service can process ~83 alerts/minute at a 50k TPM limit. This is more than sufficient for staging but may need sharding or caching for production with hundreds of alerts per hour.

**Caching strategy**: For alerts with the same fingerprint firing repeatedly within a 5-minute window (Alertmanager `group_interval`), cache the enrichment result in memory to avoid redundant LLM calls:

```typescript
const enrichmentCache = new Map<string, { result: EnrichmentResult; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function enrichWithCache(alert: Alert, ...): Promise<EnrichmentResult> {
  const cached = enrichmentCache.get(alert.fingerprint);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  const result = await enrichAlert(alert, ...);
  enrichmentCache.set(alert.fingerprint, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
```

### Fallback when LLM is unavailable

The service has three fallback tiers:

1. **Elasticsearch unavailable**: Continue enrichment with `recentLogContext: null`
2. **OpenAI unavailable/timeout**: Skip enrichment, build fallback Slack message from raw alert data
3. **Slack webhook unavailable**: Log `slack_send_failed`, alert still delivered via `default-receiver`

No fallback tier blocks alert delivery. The only question is the quality of the Slack message.

### Cost controls

- Set `max_tokens: 800` — sufficient for the JSON schema, prevents runaway responses
- Use `temperature: 0.1` — reduces variance, reduces re-prompting costs
- Set `OPENAI_TIMEOUT_MS=5000` — fail fast, don't hold connections
- Monitor `prompt_tokens` average — if consistently > 600, shorten the prompt template
- Set monthly budget alerts in Azure OpenAI resource

### PII in alerts

Alert labels and annotations may contain:
- Pod names that encode user IDs (e.g., `user-123-pod`)
- Namespace names that reveal customer data
- Error messages with email addresses or API tokens

Rules implemented in the service:
1. Never log full annotation values in structured events
2. Never log the full user prompt (may contain log context with PII from Elasticsearch)
3. Log only metadata fields: `alertName`, `namespace`, `team`, `latencyMs`, `fingerprint`
4. Never include the `AZURE_OPENAI_API_KEY` in any log or response body
5. Truncate log lines to 200 chars before prompt injection

```typescript
// Safe log pattern
console.log(JSON.stringify({
  event: 'alert_processed',
  alert_name: alert.alertName,      // safe: well-known enum
  namespace: alert.namespace,        // safe: structural metadata
  team: alert.team,                  // safe
  summary_present: !!alert.summary,  // safe: boolean flag, not value
  business_impact_present: !!alert.businessImpact,  // safe: boolean
  // NOT: summary: alert.summary     ← may contain PII
  // NOT: description: alert.description ← may contain PII
}));
```

---

## Known Failure Modes and Mitigations

| Failure Mode | Symptom | Detection | Mitigation |
|---|---|---|---|
| OpenAI API outage | All unenriched, fallback messages in Slack | `openai_call_error` in logs | Fallback already handles; no action needed |
| Alertmanager webhook timeout | Delayed alerts, Alertmanager logs `context deadline exceeded` | Alertmanager pod logs | Ensure 200 is returned before any async work (already implemented) |
| ConfigMap mount stale | Wrong team after ConfigMap update | Old team in logs for remapped namespace | Restart pod: `kubectl rollout restart deployment -n monitoring -l app.kubernetes.io/name=ai-alert-router` |
| ES index pattern mismatch | `hits_count: 0` for all queries | `elasticsearch_query_success` with `hits_count: 0` | Update `ELASTICSEARCH_INDEX_PATTERN` env var |
| GPT-4o JSON refusal | `openai_response_schema_error` in logs | Schema error log pattern | Strengthen system prompt: add explicit JSON-only instruction |
| Pod OOM | `OOMKilled` in pod events | `kubectl describe pod` | Increase memory limit to 384Mi in HelmRelease |
| Duplicate Slack messages | Same alert multiple times | Count by fingerprint in Slack | Check `group_interval` in Alertmanager; verify `continue: true` not causing re-fires |

---

## Summary

The expert layer reveals that AIOps at production scale requires careful attention to:
- **Prompt engineering**: Schema enforcement via `response_format: json_object`, Zod validation, low temperature
- **Timeout budgets**: 5s for OpenAI, 3s for Elasticsearch — both non-blocking
- **PII hygiene**: Never log annotation content, always use boolean presence flags
- **Cost governance**: `max_tokens`, caching by fingerprint, monthly budget alerts
- **GitOps discipline**: ImagePolicy automation, HelmRelease values as the only source of truth for config
- **Pilot methodology**: Quantitative thresholds before Phase 2, not subjective readiness
