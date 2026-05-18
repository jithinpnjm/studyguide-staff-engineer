---
title: "AIOps Implementation"
sidebar_label: "Intermediate"
sidebar_position: 2
---

# AIOps Implementation

This guide covers the implementation mechanics of the AIOps pipeline: how Alertmanager is configured to send webhooks, how alert labels carry enrichment metadata, how the team ownership ConfigMap works, how the FastAPI/TypeScript service processes alerts, and how routing logic maps teams to Slack channels.

---

## Alertmanager Webhook Receiver Design

The Alertmanager configuration in this repo uses the ExternalSecrets Operator pattern. The configuration lives inside an `ExternalSecret` resource as a Go-templated string. The External Secrets Operator renders the actual Slack webhook URL from GCP Secret Manager at deployment time.

### Before AIOps (existing routing)

```
route (group_by: namespace, repeat_interval: 12h)
├── receiver: default-receiver (slack → #allex-staging-alerts-k8s)
└── child route:
    └── receiver: dead-mans-switch (matches: Watchdog, InfoInhibitor)
```

### After AIOps (with ai-enricher added)

```
route (group_by: namespace, repeat_interval: 12h)
├── receiver: default-receiver (slack → #allex-staging-alerts-k8s)  ← UNCHANGED
└── child routes:
    ├── receiver: dead-mans-switch (matches: Watchdog, InfoInhibitor)  ← UNCHANGED
    └── receiver: ai-enricher (webhook → ai-alert-router)  ← NEW
        continue: true
        matches: alertname =~ "KubernetesPodCrashLooping|RedisDown|..."
```

The `continue: true` flag on the `ai-enricher` child route is critical. Without it, Alertmanager stops routing after the first match — the existing Slack delivery would be suppressed.

### The ai-enricher receiver definition

```yaml
receivers:
  - name: ai-enricher
    webhook_configs:
      - url: 'http://ai-alert-router.monitoring.svc.cluster.local:3000/webhook/alertmanager'
        send_resolved: true
        http_config:
          follow_redirects: true
        max_alerts: 0   # 0 = no limit; all alerts in the group are sent

route:
  group_by: ['namespace']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'default-receiver'
  routes:
  - receiver: 'dead-mans-switch'
    matchers:
      - alertname =~ "InfoInhibitor|Watchdog"
  - receiver: 'ai-enricher'
    continue: true
    matchers:
      - alertname =~ "KubernetesPodCrashLooping|RedisDown|RedisRejectedConnections|FailedAsyncJobs|TooManyPendingMessagesNotifications"
```

### Alertmanager webhook payload schema

When Alertmanager fires, the webhook receives a JSON payload conforming to the Alertmanager v2 schema:

```typescript
interface AlertmanagerWebhookPayload {
  version: string;           // "4"
  groupKey: string;          // identifies the group of alerts
  truncatedAlerts: number;   // alerts omitted due to max_alerts
  status: 'firing' | 'resolved';
  receiver: string;          // "ai-enricher"
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;   // labels shared by all alerts in group
  commonAnnotations: Record<string, string>;
  externalURL: string;       // link back to Alertmanager UI
  alerts: AlertmanagerAlert[];
}

interface AlertmanagerAlert {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;          // ISO 8601
  endsAt: string;            // "0001-01-01T00:00:00Z" if still firing
  generatorURL: string;      // link to the Prometheus expression
  fingerprint: string;       // unique alert instance ID
}
```

Note: Alert-level labels override group-level `commonLabels` for the same key. The normaliser merges them with alert labels taking precedence.

---

## Alert Label Structure (AIOPS-02)

Raw alerts from Prometheus carry only `severity`. AIOps requires structured metadata. The enriched label schema added to each PrometheusRule:

```yaml
labels:
  severity: <critical|warning>    # existing — never remove
  team: <platform|business|data>  # added for team ownership lookup
  service: <logical-service-name> # added for service override in ConfigMap
  component: <subsystem>          # added for granular context in prompt
  environment: staging            # added for environment-scoped routing

annotations:
  summary: "..."                  # existing
  business_impact: "..."          # added for AI prompt and fallback message
  runbook_url: "https://..."      # added for Slack action button
  suggested_query: "..."          # added for Grafana dashboard deep-link
```

### Real examples from the pilot alert set

**KubernetesPodCrashLooping** — platform/kubernetes:
```yaml
labels:
  severity: warning
  team: platform
  service: kubernetes
  component: pod-lifecycle
  environment: staging
annotations:
  business_impact: "Service availability degraded in namespace {{ $labels.namespace }}; dependent services may be experiencing errors or timeouts."
  runbook_url: "https://wiki.allex.ai/runbooks/kubernetes/KubernetesPodCrashLooping"
  suggested_query: "increase(kube_pod_container_status_restarts_total{namespace=\"{{ $labels.namespace }}\",pod=\"{{ $labels.pod }}\"}[10m])"
```

**FailedAsyncJobs** — business/job-executor:
```yaml
labels:
  severity: warning
  team: business
  service: job-executor
  component: async-queue
  environment: staging
annotations:
  business_impact: "Background jobs (data exports, scheduled tasks, bulk operations) are silently failing and accumulating in the dead-letter queue. Manual intervention required to prevent data loss."
  runbook_url: "https://wiki.allex.ai/runbooks/job-executor/FailedAsyncJobs"
```

These labels pass through Alertmanager to the webhook payload, giving the `ai-alert-router` structured inputs without any inference required.

---

## Team Ownership ConfigMap (AIOPS-03)

The ConfigMap is the single source of truth for team-to-namespace and team-to-service mapping. It is stored in Git, managed by FluxCD, and read by the service on every request (with mtime-based caching to avoid disk I/O on each call).

### Structure

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-alert-router-team-ownership
  namespace: monitoring
data:
  teams.yaml: |
    fallback_channel: "#allex-staging-alerts-k8s"

    teams:
      platform:
        slack_channel: "#allex-platform-alerts"
        namespaces:
          - allex-graphql
          - allex-api-gateway
          - allex-redis
          - allex-neo4j-cluster

      business:
        slack_channel: "#allex-business-alerts"
        namespaces:
          - allex-notifications
          - allex-job-executor
          - allex-planning-objects

      data:
        slack_channel: "#allex-data-alerts"
        namespaces:
          - allex-search
          - allex-data-exchange
          - confluent

      devops:
        slack_channel: "#allex-platform-alerts"
        namespaces:
          - monitoring
          - flux-system
          - cert-manager

    # Service label overrides (from AIOPS-02) — take precedence over namespace lookup
    service_overrides:
      redis:
        team: platform
        slack_channel: "#allex-platform-alerts"
      notifications:
        team: business
        slack_channel: "#allex-business-alerts"
      search-ingestor:
        team: data
        slack_channel: "#allex-data-alerts"

    pilot_mode: true          # true = all enriched alerts → pilot_channel
    pilot_channel: "#allex-aiops-test"
```

### Resolution order

```
1. Service label override (alert.labels.service in service_overrides)
   → Highest priority: explicit service-to-team mapping

2. Namespace lookup (alert.labels.namespace in teams[*].namespaces)
   → Used when no service override exists

3. Fallback
   → team: "unknown", channel: fallback_channel
```

### TypeScript lookup implementation

```typescript
export function resolveOwnership(
  namespace: string,
  service?: string
): { team: string; slackChannel: string } {
  const config = loadConfig(); // mtime-cached

  // 1. Service override (highest priority)
  if (service) {
    const override = config.serviceOverrides[service];
    if (override) {
      const channel = config.pilotMode
        ? config.pilotChannel
        : override.slackChannel;
      return { team: override.team, slackChannel: channel };
    }
  }

  // 2. Namespace lookup
  for (const [teamName, teamData] of Object.entries(config.teams)) {
    if (teamData.namespaces.includes(namespace)) {
      const channel = config.pilotMode
        ? config.pilotChannel
        : teamData.slackChannel;
      return { team: teamName, slackChannel: channel };
    }
  }

  // 3. Fallback
  return { team: 'unknown', slackChannel: config.fallbackChannel };
}
```

The `pilotMode` flag ensures that during the pilot, every resolved team channel is overridden with `#allex-aiops-test`. Setting `pilot_mode: false` in the ConfigMap triggers immediate per-team routing on the next request without a service restart.

---

## Alert Enrichment Pipeline (AIOPS-02 + AIOPS-04)

The normaliser flattens the Alertmanager payload into a single `Alert` object:

```typescript
export function normaliseAlert(
  raw: AlertmanagerAlert,
  payload: AlertmanagerWebhookPayload
): Alert {
  // Alert-level labels override common labels
  const labels = { ...payload.commonLabels, ...raw.labels };
  const annotations = { ...payload.commonAnnotations, ...raw.annotations };

  const namespace = labels.namespace || labels.exported_namespace || 'unknown';
  const service = labels.service || '';
  const { team } = resolveOwnership(namespace, service);

  const startsAt = new Date(raw.startsAt);
  const activeDurationMinutes = Math.round(
    (Date.now() - startsAt.getTime()) / 60000
  );

  return {
    alertName: labels.alertname || 'UnknownAlert',
    status: raw.status,
    severity: labels.severity || 'unknown',
    namespace,
    team,
    service: labels.service || 'unknown',
    component: labels.component || 'unknown',
    environment: labels.environment || 'staging',
    summary: annotations.summary || '',
    description: annotations.description || '',
    businessImpact: annotations.business_impact || '',
    runbookUrl: annotations.runbook_url || '',
    suggestedQuery: annotations.suggested_query || '',
    labels,
    annotations,
    startsAt,
    fingerprint: raw.fingerprint,
    generatorURL: raw.generatorURL,
    activeDurationMinutes: Math.max(0, activeDurationMinutes),
  };
}
```

---

## FastAPI-Equivalent Service Architecture (AIOPS-04)

The service is TypeScript/Node.js using Express, but the architecture is equivalent to a Python FastAPI service. The key design decisions:

### Immediate 200 response

```typescript
router.post('/alertmanager', (req: Request, res: Response) => {
  res.status(200).json({ status: 'accepted' }); // ← respond immediately

  // All enrichment is after the response
  const payload = req.body as AlertmanagerWebhookPayload;
  for (const rawAlert of payload.alerts) {
    const alert = normaliseAlert(rawAlert, payload);
    // ... enrich async
  }
});
```

### Health check endpoint

```typescript
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ai-alert-router',
    timestamp: new Date().toISOString(),
    shadow_mode: process.env.SHADOW_MODE !== 'false',
  });
});
```

### Environment variable configuration

```bash
PORT=3000
LOG_LEVEL=info
SHADOW_MODE=true           # false only after AIOPS-09 complete
PILOT_MODE=true            # false only for Phase 2
TEAMS_CONFIG_PATH=/config/teams.yaml  # mounted ConfigMap path
AZURE_OPENAI_API_KEY=<from secret>
AZURE_OPENAI_ENDPOINT=https://allex-openai-rg.openai.azure.com/...
OPENAI_TIMEOUT_MS=5000
ELASTICSEARCH_URL=http://elasticsearch-master.monitoring.svc.cluster.local:9200
ELASTICSEARCH_INDEX_PATTERN=logstash-*
ES_TIMEOUT_MS=3000
SLACK_WEBHOOK_URL=<from secret>
```

### Multi-stage Docker build (security)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc --build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## Routing Logic: Team → Slack Channel

The routing decision is made in two places:

1. **ConfigMap resolution** (`resolveOwnership`): Maps the alert's namespace/service to a team and channel. During pilot, all alerts go to `#allex-aiops-test`.

2. **AI enrichment override**: The LLM response includes a `team` field. If this differs from the ConfigMap resolution, the AI's team is used (with its own confidence check). This allows the model to correct misclassifications when the alert lacks proper labels.

The final `targetSlackChannel` on the `EnrichedIncident` object is what the Slack sender uses:

```typescript
const incident: EnrichedIncident = {
  alert,
  team: enrichmentResult.response?.team || alert.team,
  // ... AI fields
  targetSlackChannel: slackChannel,  // from ConfigMap (pilot-aware)
  pilotMode: process.env.PILOT_MODE !== 'false',
  // ...
};
```

### Slack delivery (AIOPS-09)

```typescript
// Three message types depending on incident state:
if (incident.alert.status === 'resolved') {
  blocks = buildResolutionBlocks(incident);
} else if (incident.summary && incident.probableCauses) {
  blocks = buildEnrichedBlocks(incident);  // full AI-enriched format
} else {
  blocks = buildFallbackBlocks(incident);  // clean plain-text fallback
}

const payload = {
  channel: incident.targetSlackChannel,
  username: 'AIOps Alert Router',
  icon_emoji: ':robot_face:',
  blocks,
  text: `${incident.alert.status === 'resolved' ? 'RESOLVED' : 'ALERT'}: ${incident.alert.alertName} in ${incident.alert.namespace}`,
};
```

---

## Verification Commands

```bash
# Check Alertmanager has loaded the new config
kubectl get secret -n monitoring alertmanager-prom-stack-secret \
  -o jsonpath='{.data.alertmanager\.yaml}' | base64 -d | grep -A3 "ai-enricher"

# Check ConfigMap exists and is valid YAML
kubectl get configmap -n monitoring ai-alert-router-team-ownership \
  -o jsonpath='{.data.teams\.yaml}' | python3 -c "import yaml,sys; print(list(yaml.safe_load(sys.stdin)['teams'].keys()))"

# Send a test webhook and check routing
kubectl port-forward -n monitoring svc/ai-alert-router 3000:3000 &
curl -s -X POST http://localhost:3000/webhook/alertmanager \
  -H 'Content-Type: application/json' \
  -d '{"version":"4","groupKey":"test","truncatedAlerts":0,"status":"firing","receiver":"ai-enricher","groupLabels":{},"commonLabels":{"namespace":"allex-redis","severity":"critical","service":"redis","team":"platform","component":"cache","environment":"staging"},"commonAnnotations":{"summary":"Redis is down","business_impact":"Cache unavailable"},"externalURL":"http://alertmanager:9093","alerts":[{"status":"firing","labels":{"alertname":"RedisDown"},"annotations":{},"startsAt":"2026-04-07T10:00:00Z","endsAt":"0001-01-01T00:00:00Z","generatorURL":"http://prometheus:9090","fingerprint":"test-001"}]}'

# Check logs for routing decision
kubectl logs -n monitoring -l app.kubernetes.io/name=ai-alert-router --tail=20 | \
  python3 -c "import sys,json; [print(json.dumps(json.loads(l),indent=2)) for l in sys.stdin if 'alert_processed' in l]"
```

---

## Shadow Mode vs Live Mode

| Mode | Env Var | Behaviour |
|------|---------|-----------|
| Shadow | `SHADOW_MODE=true` | Processes alerts, logs routing decisions, does NOT call OpenAI or Slack |
| Live | `SHADOW_MODE=false` | Full enrichment pipeline, Slack delivery |
| Pilot | `PILOT_MODE=true` | All enriched alerts go to `#allex-aiops-test` |
| Phase 2 | `PILOT_MODE=false` | Enriched alerts go to team-specific channels from ConfigMap |

Shadow mode is the safe deployment strategy. Run in shadow for days or weeks before enabling live delivery. This validates:
- Webhook connectivity from Alertmanager
- Team ownership lookup accuracy
- Alert normalisation correctness
- Log output health (no secrets, reasonable latencies)

---

## Summary

The intermediate implementation layer shows that AIOps is built from composable, individually testable pieces:
- Alertmanager routes selected alerts to a webhook with `continue: true`
- PrometheusRule labels provide structured metadata without inference
- A ConfigMap drives routing logic without code changes
- A service normalises, enriches, and dispatches
- Shadow mode enables safe incremental rollout
