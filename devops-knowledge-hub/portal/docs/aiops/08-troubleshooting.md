---
title: "AIOps Troubleshooting"
sidebar_label: "Troubleshooting"
sidebar_position: 8
---

# AIOps Troubleshooting

Diagnosing and fixing problems in the AI alert enrichment pipeline — from deployment issues to LLM failures to Alertmanager routing problems.

---

## The AI Alert Router Is Not Receiving Alerts

**Symptom:** Alerts fire in Alertmanager but no enriched messages appear in Slack. The default-receiver still works.

**Diagnosis:**
```bash
# 1. Check the service is running
kubectl get pods -n monitoring -l app=ai-alert-router

# 2. Check Alertmanager config is correct
kubectl exec -n monitoring deploy/alertmanager -- \
  amtool config show | grep -A 10 "ai-enrichment"

# 3. Check Alertmanager is actually routing to the webhook
kubectl logs -n monitoring -l app=alertmanager | grep "ai-enrichment"

# 4. Test the webhook directly
kubectl run test --rm -it --image=curlimages/curl -- \
  curl -v http://ai-alert-router.monitoring.svc:3000/health
```

**Common causes:**
- Alertmanager config not reloaded after change — send `SIGHUP` or restart
- Webhook URL wrong (namespace, port, or service name typo)
- NetworkPolicy blocking Alertmanager → ai-alert-router traffic
- Service not ready (readiness probe failing)

---

## Enriched Messages Not Appearing in Slack

**Symptom:** The service receives alerts (logs show incoming webhooks) but no Slack messages.

**Diagnosis:**
```bash
# Check service logs for Slack errors
kubectl logs -n monitoring -l app=ai-alert-router | grep -i "slack\|error\|failed"

# Verify the Slack webhook secret is correctly mounted
kubectl exec -n monitoring deploy/ai-alert-router -- \
  env | grep SLACK_WEBHOOK_URL
# Should show the URL, not empty
```

**Common causes:**
- `SLACK_WEBHOOK_URL` secret not synced by External Secrets Operator
- Slack webhook URL rotated but secret not updated
- Slack channel archived or bot removed from channel
- Rate limiting from Slack (>1 message/second to same channel)

**Fix for stale secret:**
```bash
# Force ESO to re-sync
kubectl annotate externalsecret ai-alert-router-secrets \
  force-sync=$(date +%s) -n monitoring
```

---

## LLM Returns Invalid JSON

**Symptom:** Logs show `JSON.parse error` or `ZodError`, enrichment falls back.

**Example log:**
```
[ERROR] LLM response parse failed: SyntaxError: Unexpected token 'H' at position 0
[ERROR] Raw response: "Here is the analysis:\n\n```json\n{...}\n```"
```

**Root cause:** The LLM wrapped its response in a markdown code block despite the prompt saying not to. This happens when:
- `temperature` is above 0 (adds randomness)
- The model version changed and the system prompt needs updating
- The prompt is too short and the model defaults to its "helpful" formatting

**Fix:**
```typescript
// Strip markdown code blocks before parsing
function extractJSON(raw: string): string {
  // Remove ```json ... ``` wrapper if present
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return raw.trim();
}

const cleaned = extractJSON(response.choices[0].message.content ?? '');
const parsed = JSON.parse(cleaned);
```

**Prevention:** Always set `temperature: 0` and include in the system prompt: "Output ONLY valid JSON. No markdown. No code blocks. No explanation."

---

## LLM Confidence Is Always Low

**Symptom:** Most enrichments have `confidence < 0.5` and `needs_human_review: true`.

**Diagnosis:** Check what data is reaching the LLM:
```bash
# Enable debug logging temporarily
kubectl set env deployment/ai-alert-router LOG_LEVEL=debug -n monitoring
kubectl logs -n monitoring -l app=ai-alert-router | grep "user_prompt"
```

**Common causes:**
- Alert rules missing `summary` and `description` annotations — LLM has nothing to work with
- `business_impact` annotation not set — LLM cannot assess severity
- Elasticsearch log context always empty — ES query returning no results

**Fix — add annotations to alert rules:**
```yaml
# In your PrometheusRule
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  annotations:
    summary: "Error rate above 5% on {{ $labels.service }}"
    description: "HTTP 5xx rate is {{ $value | humanizePercentage }} on {{ $labels.service }} in {{ $labels.namespace }}"
    business_impact: "User-facing errors; checkout or API failures depending on service"
    runbook_url: "https://wiki.internal/runbooks/high-error-rate"
    team: "{{ $labels.team }}"
```

---

## Elasticsearch Queries Always Timing Out

**Symptom:** Every enrichment shows "log context unavailable" in Slack. Logs show ES timeout.

**Diagnosis:**
```bash
# Check ES cluster health
kubectl exec -n logging deploy/elasticsearch -- \
  curl -s http://localhost:9200/_cluster/health | jq .status

# Check ES query latency from the router pod
kubectl exec -n monitoring deploy/ai-alert-router -- \
  curl -w "%{time_total}" -o /dev/null -s \
  http://elasticsearch.logging.svc:9200/_cluster/health
```

**Common causes:**
- ES cluster under heavy indexing load (log storm during incident)
- ES heap pressure causing GC pauses
- Wrong ES URL in config (pointing to wrong namespace/port)
- Index pattern doesn't match (`logs-production-*` vs `logs-prod-*`)

**Fix — increase timeout or make ES optional:**
```typescript
// Already in the implementation — ES failure never blocks the alert
// But you can tune the timeout:
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000); // increase from 3s to 5s
```

**Fix — verify index pattern:**
```bash
kubectl exec -n monitoring deploy/ai-alert-router -- \
  curl -s "http://elasticsearch.logging.svc:9200/_cat/indices?v" | grep logs
```

---

## Alertmanager Keeps Retrying the Webhook

**Symptom:** The same alert is enriched multiple times. Slack gets duplicate messages.

**Root cause:** The service returned a non-200 status code, causing Alertmanager to retry.

**Alertmanager retry behaviour:** If the webhook returns 5xx, Alertmanager retries with exponential backoff. If it returns 4xx, it does not retry.

**Fix — always return 200:**
```typescript
app.post('/webhook', async (req, res) => {
  // Send 200 immediately — never let Alertmanager retry
  res.status(200).json({ received: true });

  // Process asynchronously after responding
  processAlert(req.body).catch(err => {
    logger.error('Alert processing failed', { err });
    // Failure is logged but not surfaced to Alertmanager
  });
});
```

---

## The Service Is Enriching Alerts It Shouldn't

**Symptom:** Low-priority or synthetic alerts (Watchdog, InfoInhibitor) are being enriched and cluttering Slack.

**Fix — tighten the Alertmanager matcher:**
```yaml
routes:
  - receiver: ai-enrichment
    continue: true
    matchers:
      # Explicit allowlist — only these alert names
      - alertname =~ "HighErrorRate|PodCrashLooping|HighMemoryUsage|ServiceDown|HighLatency"
      # Exclude synthetic alerts explicitly
      - alertname !~ "Watchdog|InfoInhibitor|DeadMansSwitch"
      # Only enrich firing alerts, not resolved
      - status = "firing"
```

---

## Secrets Not Syncing from AWS Secrets Manager

**Symptom:** Pod starts but immediately crashes with `AZURE_OPENAI_API_KEY is not set`.

**Diagnosis:**
```bash
# Check ESO sync status
kubectl describe externalsecret ai-alert-router-secrets -n monitoring
# Look for: "SecretSynced" condition

# Check the secret exists
kubectl get secret ai-alert-router-secrets -n monitoring

# Check ESO controller logs
kubectl logs -n external-secrets -l app.kubernetes.io/name=external-secrets | tail -20
```

**Common causes:**
- IRSA role missing `secretsmanager:GetSecretValue` permission for the specific secret ARN
- Secret path in AWS doesn't match the `remoteRef.key` in the ExternalSecret
- ESO ClusterSecretStore not configured for the correct AWS region

**Fix — verify IRSA permissions:**
```bash
# Check what role the ESO service account is using
kubectl get sa external-secrets -n external-secrets -o yaml | grep amazonaws

# Test the permission directly
aws secretsmanager get-secret-value \
  --secret-id production/ai-alert-router \
  --region eu-west-1
```

---

## Debugging Checklist

When something is wrong, work through this in order:

```bash
# 1. Is the pod running?
kubectl get pods -n monitoring -l app=ai-alert-router

# 2. Is the health endpoint responding?
kubectl port-forward -n monitoring svc/ai-alert-router 3000:3000 &
curl http://localhost:3000/health

# 3. Are secrets mounted?
kubectl exec -n monitoring deploy/ai-alert-router -- env | grep -E "AZURE|SLACK|ELASTIC"

# 4. Can it reach Elasticsearch?
kubectl exec -n monitoring deploy/ai-alert-router -- \
  curl -s http://elasticsearch.logging.svc:9200/_cluster/health | jq .status

# 5. Can it reach Azure OpenAI? (check logs for LLM errors)
kubectl logs -n monitoring -l app=ai-alert-router | grep -i "openai\|llm\|azure"

# 6. Is Alertmanager routing to it?
kubectl exec -n monitoring deploy/alertmanager -- \
  amtool alert query --alertmanager.url=http://localhost:9093 | grep -i "ai-enrichment"

# 7. Send a test alert
kubectl run test-alert --rm -it --image=curlimages/curl -- curl -X POST \
  http://ai-alert-router.monitoring.svc:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"version":"4","status":"firing","receiver":"ai-enrichment","alerts":[{"status":"firing","labels":{"alertname":"TestAlert","severity":"warning","namespace":"production","service":"test","team":"platform"},"annotations":{"summary":"Test alert","business_impact":"None — this is a test"},"startsAt":"2025-01-01T00:00:00Z"}]}'
```
