---
title: "AIOps Hands-On Labs"
sidebar_label: "Hands-On Labs"
sidebar_position: 5
---

# AIOps Hands-On Labs

Practical exercises for building, deploying, and operating an AIOps alert enrichment pipeline. Labs progress from local development to production GitOps deployment.

---

## Lab 1: Run the AI Alert Router Locally

**Goal:** Get the service running locally and send a test alert through the full enrichment pipeline.

**Prerequisites:** Node.js 20+, Docker, an Azure OpenAI or OpenAI API key.

```bash
# Clone and install
git clone https://github.com/your-org/ai-alert-router
cd ai-alert-router
npm install

# Set environment variables
export AZURE_OPENAI_ENDPOINT="https://your-instance.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-key"
export AZURE_OPENAI_DEPLOYMENT="gpt-4o"
export ELASTICSEARCH_URL="http://localhost:9200"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Start the service
npm run dev
```

Send a test alert payload:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "groupKey": "{}:{alertname=\"HighErrorRate\"}",
    "status": "firing",
    "receiver": "ai-enrichment",
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "HighErrorRate",
        "severity": "critical",
        "namespace": "production",
        "service": "payment-service",
        "team": "payments"
      },
      "annotations": {
        "summary": "Error rate above 5% for 10 minutes",
        "description": "HTTP 5xx rate is 8.3% on payment-service",
        "business_impact": "Checkout failures affecting revenue"
      },
      "startsAt": "2025-01-15T10:00:00Z"
    }]
  }'
```

**Expected output:** A structured JSON enrichment response with `probable_causes`, `recommended_actions`, and `confidence` fields.

---

## Lab 2: Build a Minimal Prompt + Structured Output Pipeline

**Goal:** Write a TypeScript function that calls an LLM with a structured output schema and validates the response.

```typescript
import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define the expected output schema
const EnrichmentSchema = z.object({
  summary: z.string(),
  probable_causes: z.array(z.string()).min(1).max(5),
  recommended_actions: z.array(z.string()).min(1).max(5),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
});

type Enrichment = z.infer<typeof EnrichmentSchema>;

async function enrichAlert(alertData: {
  name: string;
  severity: string;
  description: string;
}): Promise<Enrichment> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an SRE analyst. Analyse the alert and respond with ONLY valid JSON matching this schema:
{
  "summary": "<1-2 sentences>",
  "probable_causes": ["<string>"],
  "recommended_actions": ["<string>"],
  "confidence": <0.0-1.0>,
  "needs_human_review": <boolean>
}`,
      },
      {
        role: "user",
        content: `Alert: ${alertData.name}\nSeverity: ${alertData.severity}\nDescription: ${alertData.description}`,
      },
    ],
    temperature: 0,
    max_tokens: 500,
  });

  const raw = response.choices[0].message.content ?? "";

  // Parse and validate
  const parsed = JSON.parse(raw);
  return EnrichmentSchema.parse(parsed); // throws ZodError if schema mismatch
}

// Test it
enrichAlert({
  name: "HighMemoryUsage",
  severity: "warning",
  description: "payment-service memory at 92% of limit for 15 minutes",
}).then(console.log);
```

**Exercise:** Add a fallback that returns a default `Enrichment` object when `JSON.parse` or `ZodError` is thrown, so the pipeline never crashes on bad LLM output.

---

## Lab 3: Elasticsearch Log Context Retrieval

**Goal:** Query Elasticsearch for recent error logs for a given service and format them for LLM context.

```typescript
import { Client } from "@elastic/elasticsearch";

const es = new Client({ node: process.env.ELASTICSEARCH_URL });

interface LogContext {
  topErrors: Array<{ message: string; count: number }>;
  totalErrors: number;
  windowMinutes: number;
}

async function getLogContext(
  namespace: string,
  service: string,
  windowMinutes = 15
): Promise<LogContext | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000); // 3s hard timeout

  try {
    const result = await es.search(
      {
        index: `logs-${namespace}-*`,
        body: {
          query: {
            bool: {
              must: [
                { term: { "kubernetes.labels.app": service } },
                { terms: { level: ["error", "ERROR", "fatal", "FATAL"] } },
                {
                  range: {
                    "@timestamp": { gte: `now-${windowMinutes}m`, lte: "now" },
                  },
                },
              ],
            },
          },
          aggs: {
            top_errors: {
              terms: { field: "message.keyword", size: 5 },
            },
          },
          size: 0,
        },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const buckets =
      (result.aggregations?.top_errors as any)?.buckets ?? [];
    const totalErrors = (result.hits.total as any)?.value ?? 0;

    if (totalErrors === 0) return null;

    return {
      topErrors: buckets.map((b: any) => ({
        message: b.key,
        count: b.doc_count,
      })),
      totalErrors,
      windowMinutes,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.warn("Elasticsearch query timed out");
    }
    return null; // always return null on failure — never block the alert
  }
}

// Format for LLM prompt
function formatLogContext(ctx: LogContext): string {
  const lines = ctx.topErrors.map(
    (e) => `  [${e.count}x] ${e.message.slice(0, 200)}`
  );
  return `${ctx.totalErrors} errors in last ${ctx.windowMinutes}m:\n${lines.join("\n")}`;
}
```

**Exercise:** Add a second query that fetches the 3 most recent individual error log lines (not aggregated) and appends them to the context string.

---

## Lab 4: Alertmanager Webhook Routing Configuration

**Goal:** Configure Alertmanager to route selected alerts to the AI enrichment service while keeping the original receiver.

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: default-receiver
  group_by: ["alertname", "namespace"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    # AI enrichment route — fires for selected alert types
    - receiver: ai-enrichment
      continue: true  # CRITICAL: also send to default-receiver
      matchers:
        - alertname =~ "HighErrorRate|PodCrashLooping|HighMemoryUsage|ServiceDown|HighLatency"
      group_wait: 10s

receivers:
  - name: default-receiver
    slack_configs:
      - api_url: "${SLACK_WEBHOOK_URL}"
        channel: "#alerts"
        title: "{{ .GroupLabels.alertname }}"
        text: "{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"

  - name: ai-enrichment
    webhook_configs:
      - url: "http://ai-alert-router.monitoring.svc.cluster.local:3000/webhook"
        send_resolved: false
        http_config:
          timeout: 30s
```

**Exercise:** Add a second child route that sends `severity=critical` alerts to a `pagerduty-receiver` in addition to the AI enrichment path.

---

## Lab 5: Deploy to Kubernetes with GitOps

**Goal:** Write the Kubernetes manifests for the AI alert router and deploy via ArgoCD.

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-alert-router
  namespace: monitoring
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-alert-router
  template:
    metadata:
      labels:
        app: ai-alert-router
    spec:
      serviceAccountName: ai-alert-router
      containers:
        - name: ai-alert-router
          image: ghcr.io/your-org/ai-alert-router:latest
          ports:
            - containerPort: 3000
          env:
            - name: AZURE_OPENAI_ENDPOINT
              valueFrom:
                secretKeyRef:
                  name: ai-alert-router-secrets
                  key: azure-openai-endpoint
            - name: AZURE_OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: ai-alert-router-secrets
                  key: azure-openai-api-key
            - name: ELASTICSEARCH_URL
              value: "http://elasticsearch.logging.svc.cluster.local:9200"
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              memory: "256Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: ai-alert-router
  namespace: monitoring
spec:
  selector:
    app: ai-alert-router
  ports:
    - port: 3000
      targetPort: 3000
```

```yaml
# external-secret.yaml — pull secrets from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: ai-alert-router-secrets
  namespace: monitoring
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: ai-alert-router-secrets
  data:
    - secretKey: azure-openai-endpoint
      remoteRef:
        key: production/ai-alert-router
        property: azure_openai_endpoint
    - secretKey: azure-openai-api-key
      remoteRef:
        key: production/ai-alert-router
        property: azure_openai_api_key
```

**Exercise:** Add a `PodDisruptionBudget` with `minAvailable: 1` and a `HorizontalPodAutoscaler` that scales between 2 and 5 replicas based on CPU.

---

## Lab 6: Write Integration Tests for the Enrichment Pipeline

**Goal:** Test the full webhook → enrich → Slack path with mocked external dependencies.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";

// Mock external dependencies
vi.mock("../src/llm/client", () => ({
  enrichAlert: vi.fn().mockResolvedValue({
    team: "payments",
    category: "application",
    severity_override: null,
    summary: "Payment service error rate elevated",
    impact: "Checkout failures affecting revenue",
    probable_causes: ["Recent deployment introduced regression"],
    recommended_actions: ["Check recent deployments", "Review error logs"],
    confidence: 0.85,
    needs_human_review: false,
  }),
}));

vi.mock("../src/elasticsearch/client", () => ({
  getLogContext: vi.fn().mockResolvedValue(null), // simulate ES unavailable
}));

vi.mock("../src/slack/client", () => ({
  sendEnrichedAlert: vi.fn().mockResolvedValue(undefined),
}));

describe("POST /webhook", () => {
  it("returns 200 and enriches the alert", async () => {
    const payload = {
      version: "4",
      status: "firing",
      receiver: "ai-enrichment",
      alerts: [
        {
          status: "firing",
          labels: {
            alertname: "HighErrorRate",
            severity: "critical",
            namespace: "production",
            service: "payment-service",
          },
          annotations: {
            summary: "Error rate above 5%",
            business_impact: "Revenue impact",
          },
          startsAt: "2025-01-15T10:00:00Z",
        },
      ],
    };

    const res = await request(app).post("/webhook").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.enriched).toBe(true);
  });

  it("returns 200 even when LLM fails", async () => {
    const { enrichAlert } = await import("../src/llm/client");
    vi.mocked(enrichAlert).mockRejectedValueOnce(new Error("LLM timeout"));

    const res = await request(app).post("/webhook").send({
      version: "4",
      status: "firing",
      receiver: "ai-enrichment",
      alerts: [
        {
          status: "firing",
          labels: { alertname: "HighErrorRate", severity: "critical" },
          annotations: {},
          startsAt: "2025-01-15T10:00:00Z",
        },
      ],
    });

    expect(res.status).toBe(200); // never return 5xx to Alertmanager
  });
});
```

---

## Lab 7: Measure Pilot Success Metrics

**Goal:** Write a script that queries your incident management system and calculates MTTA before and after AIOps deployment.

```python
import httpx
import statistics
from datetime import datetime, timedelta

PAGERDUTY_API_KEY = "your-key"
HEADERS = {
    "Authorization": f"Token token={PAGERDUTY_API_KEY}",
    "Accept": "application/vnd.pagerduty+json;version=2",
}

def get_incidents(since: datetime, until: datetime) -> list[dict]:
    resp = httpx.get(
        "https://api.pagerduty.com/incidents",
        headers=HEADERS,
        params={
            "since": since.isoformat(),
            "until": until.isoformat(),
            "statuses[]": ["resolved"],
            "limit": 100,
        },
    )
    resp.raise_for_status()
    return resp.json()["incidents"]

def calc_mtta(incidents: list[dict]) -> float:
    """Mean time to acknowledge in minutes."""
    deltas = []
    for inc in incidents:
        created = datetime.fromisoformat(inc["created_at"].replace("Z", "+00:00"))
        acked = datetime.fromisoformat(
            inc["first_trigger_log_entry"]["created_at"].replace("Z", "+00:00")
        )
        deltas.append((acked - created).total_seconds() / 60)
    return statistics.mean(deltas) if deltas else 0.0

# Before AIOps (30 days prior to deployment)
before_incidents = get_incidents(
    since=datetime(2025, 1, 1),
    until=datetime(2025, 1, 31),
)

# After AIOps (30 days after deployment)
after_incidents = get_incidents(
    since=datetime(2025, 2, 1),
    until=datetime(2025, 2, 28),
)

before_mtta = calc_mtta(before_incidents)
after_mtta = calc_mtta(after_incidents)
improvement = (before_mtta - after_mtta) / before_mtta * 100

print(f"Before AIOps MTTA: {before_mtta:.1f} min ({len(before_incidents)} incidents)")
print(f"After AIOps MTTA:  {after_mtta:.1f} min ({len(after_incidents)} incidents)")
print(f"Improvement:       {improvement:.1f}%")
```
