---
sidebar_position: 6
title: "System Design Examples — K8s, AWS, GCP"
---

# System Design Examples: Kubernetes, AWS, and GCP

*Production-grade system design questions with SRE-level architecture. 9 examples across K8s (3), AWS (4), and GCP (3).*

---

## Kubernetes System Designs

---

### K8s-1: Design a Multi-Tenant Kubernetes Platform

#### Scenario
Your organization runs 50+ internal engineering teams on shared infrastructure. Design a Kubernetes platform that allows teams to self-serve deployments while enforcing isolation, resource fairness, and security boundaries. Target: 500+ namespaces, 10,000+ pods at peak.

#### Requirements

**Functional**
- Teams provision namespaces and deploy workloads without platform team intervention
- Per-tenant resource quotas, network isolation, and RBAC
- Tenant-level audit logs and cost showback
- Support for custom CRDs per-tenant without cluster-scope conflicts

**Non-Functional**
- Blast radius of a misbehaving tenant must not affect others
- 99.9% control plane availability
- Namespace provisioning within 60 seconds of request
- Support soft (namespace) and hard (virtual cluster) isolation tiers

#### High-Level Architecture

```
                         ┌──────────────────────────────────┐
                         │    Platform Management Plane      │
                         │  (GitOps repo + Crossplane/ACK)   │
                         └───────────────┬──────────────────┘
                                         │ reconciles
              ┌──────────────────────────▼──────────────────────────┐
              │               Host Kubernetes Cluster                │
              │                                                      │
              │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
              │  │ team-a NS  │  │ team-b NS  │  │ team-c NS  │    │
              │  │ (soft iso.)│  │ (soft iso.)│  │ (vCluster) │    │
              │  └────────────┘  └────────────┘  └────────────┘    │
              │                                                      │
              │  ┌──────────────────────────────────────────────┐   │
              │  │   Shared Control-Plane Add-ons               │   │
              │  │ OPA Gatekeeper | Kyverno | Falco | Prometheus │   │
              │  │ External Secrets | cert-manager | Vault Agent │   │
              │  └──────────────────────────────────────────────┘   │
              └─────────────────────────────────────────────────────┘
```

**Tier 1 — Namespace-based (trusted internal teams)**
- Namespaces + RBAC + NetworkPolicy + ResourceQuota + LimitRange
- OPA Gatekeeper / Kyverno policies enforce guardrails (no `latest` tags, required labels, resource limits)
- HPA + VPA for workload autoscaling

**Tier 2 — Virtual clusters (untrusted / external tenants)**
- vCluster gives each tenant a dedicated API server + etcd running as pods in the host cluster
- Tenant has full cluster-scoped CRD control without touching the host API
- Stronger isolation with lower cost than a dedicated cluster

**Tier 3 — Dedicated node pools (compliance / GPU)**
- Node taints + tolerations + pod affinity rules
- Used for HIPAA/PCI workloads or GPU batch jobs

#### Key Design Decisions and Tradeoffs

| Decision | Option A | Option B | Chosen |
|---|---|---|---|
| Isolation model | Namespace | vCluster | Both, tiered |
| Policy engine | OPA Gatekeeper | Kyverno | Kyverno (simpler authoring) |
| Secrets | K8s secrets + RBAC | Vault + External Secrets Operator | Vault (audit trail) |
| Tenant self-service | kubectl direct | GitOps (PR-based) | GitOps for auditability |

**Key tradeoff:** vClusters add per-tenant etcd overhead (~100MB RAM each). Namespace isolation is cheaper but shares the host API server — one tenant running `kubectl get pods --all-namespaces` in a loop can spike API server CPU.

**SRE concern:** API Priority and Fairness (APF) must be tuned. Create per-tenant FlowSchemas to prevent noisy-neighbor API exhaustion.

#### K8s Services Used
- **Namespaces, RBAC, NetworkPolicy, ResourceQuota, LimitRange** — core isolation
- **OPA Gatekeeper / Kyverno** — policy admission
- **vCluster** — virtual cluster tenancy
- **Falco** — runtime threat detection
- **Prometheus + Grafana** — per-tenant metrics with label-based multi-tenancy
- **External Secrets Operator + HashiCorp Vault** — secrets lifecycle
- **Crossplane** — infrastructure provisioning via K8s API

---

### K8s-2: Design a GitOps-Based CI/CD Platform on Kubernetes

#### Scenario
Design a CI/CD system that deploys microservices to Kubernetes with full audit trail, rollback capability, and multi-environment promotion. The system must support 200+ services, 50 deployments per hour at peak, and 3 environments (dev/staging/prod).

#### Requirements

**Functional**
- Developer commits code → automated build, test, image push, and deploy
- Git is the single source of truth for cluster state
- Promotion gates between environments (manual approval for prod)
- Automatic rollback on failed health checks

**Non-Functional**
- Deployment lead time under 10 minutes from commit to dev
- Rollback to any previous state within 2 minutes
- Zero-downtime deployments
- Full audit log of who changed what and when

#### High-Level Architecture

```
Developer → Git Push
                │
                ▼
        ┌───────────────┐
        │   CI Pipeline  │  (GitHub Actions / Tekton)
        │  build + test  │
        │  image push    │
        └───────┬───────┘
                │ updates image tag in
                ▼
        ┌───────────────────┐
        │  GitOps Repo      │  (config/manifests)
        │  environments/    │
        │    dev/           │
        │    staging/       │
        │    prod/          │
        └───────┬───────────┘
                │ watched by
        ┌───────▼────────────────────────────────┐
        │          Kubernetes Cluster             │
        │                                         │
        │  ArgoCD (CD controller)                 │
        │   ├── App: service-a (dev)     synced   │
        │   ├── App: service-a (staging) synced   │
        │   └── App: service-a (prod)   manual ✋ │
        │                                         │
        │  Argo Rollouts (canary/blue-green)       │
        └─────────────────────────────────────────┘
```

**CI Layer (Tekton or GitHub Actions)**
- On PR merge: `docker build → trivy scan → push to OCI registry → kustomize image tag update → PR to GitOps repo`
- Image signing with Cosign; Kyverno validates signatures before admission

**CD Layer (ArgoCD)**
- ArgoCD ApplicationSets manage per-environment apps from a single template
- Sync waves control dependency ordering (database migration before app rollout)
- Auto-sync for dev/staging; manual gate for production

**Progressive Delivery (Argo Rollouts)**
- Canary: 5% → 25% → 50% → 100% with automated analysis (Prometheus metrics, error rate < 1%)
- On failed analysis, automatic rollback by shifting weight back to stable

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| Pull-based CD (ArgoCD) vs push-based | Pull eliminates CI system needing cluster credentials. Slight delay (polling interval) vs immediate push. |
| Helm vs Kustomize | Kustomize for environment overlays is simpler; Helm for complex shared charts with values. Use both via ArgoCD plugin. |
| Monorepo vs polyrepo for manifests | Monorepo simplifies cross-service dependency ordering; polyrepo better for team autonomy at scale. |
| Image tags: SHA vs semver | SHA (content-addressable) preferred for immutability; semver for release communication |

**SRE concern:** GitOps drift detection is a feature, not a bug. If ArgoCD shows `OutOfSync`, that is your change management signal. Set up alerts on prolonged drift rather than always auto-syncing prod.

#### K8s Services Used
- **Tekton** — in-cluster CI pipelines (alternative: GitHub Actions)
- **ArgoCD + ApplicationSets** — GitOps CD controller
- **Argo Rollouts** — progressive delivery (canary, blue-green)
- **Kustomize / Helm** — manifest templating
- **Cosign + Kyverno** — image signing and admission verification
- **Harbor / ECR / Artifact Registry** — OCI image registry
- **Prometheus + AnalysisTemplate** — automated rollout analysis

---

### K8s-3: Design an Event-Driven Autoscaling System with KEDA

#### Scenario
Design a Kubernetes-based order processing system where worker pods process messages from a message queue (Kafka/SQS). Load is highly variable — near-zero overnight, 50,000 messages per minute during peak. Optimize for cost and latency.

#### Requirements

**Functional**
- Workers scale to zero when no messages; scale up in under 90 seconds on burst
- Support Kafka, SQS, and Prometheus as trigger sources
- Separate scaling policies for different queue priorities (normal vs express orders)

**Non-Functional**
- Message processing latency p99 < 500ms during scale-up
- Cost savings of >60% vs always-on worker pools
- No message loss; exactly-once semantics for order records

#### High-Level Architecture

```
   Kafka Topics                KEDA ScaledObjects
   ┌──────────────┐            ┌─────────────────────────────┐
   │orders.normal │──trigger──▶│ ScaledObject: normal-worker │
   │orders.express│──trigger──▶│ ScaledObject: express-worker│
   └──────────────┘            │ minReplicas: 0              │
                               │ maxReplicas: 100            │
   SQS Queue                   │ pollingInterval: 15s        │
   ┌──────────────┐            └────────────┬────────────────┘
   │dlq-processor │──trigger──▶             │ feeds
                               ┌────────────▼────────────────┐
                               │     Kubernetes HPA           │
                               │  (KEDA acts as metrics srv)  │
                               └────────────┬────────────────┘
                                            │ scales
                               ┌────────────▼────────────────┐
                               │  Worker Deployment Pods      │
                               │  (normal-worker, 0-100)     │
                               │  (express-worker, 2-50)     │
                               └─────────────────────────────┘
```

**KEDA ScaledObject Configuration Key Points**
- `lagThreshold`: scale up when Kafka consumer group lag exceeds N messages per partition
- `activationLagThreshold`: minimum lag to wake from zero (avoids thrashing)
- `cooldownPeriod`: 300s before scaling back to zero (drains in-flight messages)
- `useCachedMetrics: true` to reduce scaler poll overhead at high replica counts

**Dead Letter Queue handling**
- Failed messages routed to DLQ; separate KEDA ScaledJob (not Deployment) processes DLQ
- Runs as a Job per batch, exits when done — eliminates idle pod cost

**Exactly-once semantics**
- Workers write to DynamoDB with conditional writes (idempotency key = message ID)
- Kafka consumer commits offset only after successful DynamoDB write

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| ScaledObject (Deployment) vs ScaledJob | Deployments for latency-sensitive continuous consumers; Jobs for batch/DLQ where startup overhead is acceptable |
| Scale-to-zero | Saves ~60% cost; introduces cold-start latency. Mitigate with `activationLagThreshold` keeping minimum 1 pod during business hours via cron trigger |
| Per-topic ScaledObjects | Allows independent scaling policies by priority; adds complexity managing multiple ScaledObjects |
| KEDA vs custom HPA with Prometheus | KEDA provides 59+ native scalers with auth management; custom HPA requires maintaining a metrics adapter |

**SRE concern:** KEDA's `pollingInterval` defaults to 30s. For high-priority queues, reduce to 10s. Enable `useCachedMetrics` to prevent hammering Kafka/SQS during rapid HPA metric fetches.

#### K8s Services Used
- **KEDA** — event-driven autoscaler (ScaledObject, ScaledJob, TriggerAuthentication)
- **Kubernetes HPA** — underlying autoscaler (KEDA feeds it external metrics)
- **Kafka (Strimzi on K8s or MSK)** — event streaming
- **SQS** — managed queue for DLQ integration
- **DynamoDB** — idempotency store for exactly-once processing
- **Prometheus** — custom metrics trigger for business-logic-based scaling

---

## AWS System Designs

---

### AWS-1: Design a URL Shortener on AWS

#### Scenario
Design a globally available URL shortening service like bit.ly. Support 100M URLs created per day, 10B redirects per day (read:write ratio 100:1). Redirects must complete in under 100ms globally.

#### Requirements

**Functional**
- Create short URL from long URL (custom slugs optional)
- Redirect short URL to original with 301/302
- URL expiry with TTL
- Click analytics (count, geo, device, referrer)

**Non-Functional**
- 99.99% availability
- Redirect latency p99 < 100ms globally
- Short code: 7 characters, ~3.5 trillion combinations
- Analytics pipeline must not block redirect path (async)

#### High-Level Architecture

```
User
 │
 ▼
CloudFront (edge cache, 200+ PoPs)
 │ cache miss
 ▼
API Gateway (Regional)
 │
 ├──[POST /shorten]──► Lambda (create) ──► DynamoDB (shortCode → longURL, TTL, metadata)
 │
 └──[GET /{code}]───► Lambda (redirect)
                           │
                           ├──► DynamoDB (read longURL)
                           │         │
                           │         └──[cache hit: ElastiCache Redis]
                           │
                           ├──► 302 Redirect to user
                           │
                           └──► Kinesis Data Streams (async click event)
                                       │
                                 Kinesis Firehose
                                       │
                                ┌──────┴───────┐
                                S3 (raw events) Redshift (analytics)
                                                │
                                           QuickSight (dashboard)
```

**Short Code Generation**
- Base62 encoding of a distributed counter (DynamoDB atomic increment) or ULID
- Avoid hash collisions by checking existence before insert (conditional put in DynamoDB)
- Custom slugs: prefix with `c/` to separate namespace, checked against reserved words list

**Caching Layer**
- CloudFront caches 302 responses for popular URLs (Cache-Control: max-age=3600)
- ElastiCache Redis for hot URLs that miss CloudFront (write-through on create)
- LRU eviction; cache ~20% of URLs that serve 80% of traffic

**Analytics (async, non-blocking)**
- Lambda publishes click event to Kinesis on every redirect
- Kinesis Firehose buffers and writes to S3 (raw) + Redshift (aggregated)
- Real-time counts in DynamoDB `clicks` attribute via atomic increment (for UI counter)

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| 301 vs 302 redirect | 301 (permanent) cached by browser = fewer hits but breaks analytics. Use 302 for analytics-enabled links |
| Counter-based vs hash-based short code | Counter is sequential (guessable); hash adds randomness but needs collision check. Use counter + random salt |
| DynamoDB vs RDS | DynamoDB: no schema, scales horizontally, TTL native. RDS: richer queries but needs read replicas for this read volume |
| Kinesis vs SQS for analytics | Kinesis preserves ordering and supports replay; SQS simpler but no replay. Kinesis preferred for analytics pipelines |

**SRE concern:** CloudFront origin shield reduces DynamoDB read load during cache warm-up. Set DynamoDB DAX if cache miss rate is high and you need sub-millisecond DynamoDB reads.

#### AWS Services Used
- **CloudFront** — global edge caching for redirects
- **API Gateway + Lambda** — serverless compute for create/redirect
- **DynamoDB** — primary store (shortCode → URL, TTL, atomic counters)
- **ElastiCache Redis** — hot URL cache
- **Kinesis Data Streams + Firehose** — async click event pipeline
- **S3** — raw event storage (data lake)
- **Redshift** — analytics warehouse
- **QuickSight** — BI dashboard
- **Route 53** — DNS with health checks

---

### AWS-2: Design a Multi-Channel Notification System on AWS

#### Scenario
Design a notification system for an e-commerce platform that sends transactional alerts (order confirmations, shipping updates, payment failures) via email, SMS, and push notification. 50M users, 5M notifications per hour at peak.

#### Requirements

**Functional**
- Publish notification events from any microservice
- Route to email (SES), SMS (SNS/Pinpoint), push (APNs/FCM via SNS)
- Respect per-user channel preferences and opt-outs
- Retry failed deliveries; dead-letter queue for persistent failures
- Template management with variable substitution

**Non-Functional**
- End-to-end delivery within 30 seconds for transactional notifications
- At-least-once delivery guarantee
- Channel failures must not block other channels (fan-out isolation)
- Throughput: 1,400+ notifications/second sustained

#### High-Level Architecture

```
Microservices (Order, Payment, Shipping)
        │
        │ publish event
        ▼
   SNS Topic: notification-events
        │
   Fan-out to per-channel SQS queues
        │
   ┌────┴──────────────────────────────┐
   │              │                    │
   ▼              ▼                    ▼
SQS:email     SQS:sms           SQS:push
   │              │                    │
   ▼              ▼                    ▼
Lambda         Lambda              Lambda
EmailWorker    SMSWorker           PushWorker
   │              │                    │
   ▼              ▼                    ▼
SES          Pinpoint/SNS         SNS Mobile
(email)       (SMS)               (APNs/FCM)
   │              │                    │
   └──────────────┴────────────────────┘
                  │
          DynamoDB: delivery_log
          (messageId, userId, channel, status, timestamp)

   Preferences: DynamoDB (userId → {email, sms, push, optOut})
   SQS DLQ per channel → Lambda alert → SNS ops alarm
```

**Preference Check Flow**
Each worker Lambda: `fetch preferences → check opt-out → render template → call channel provider → write delivery status`

**Template Engine**
- Templates stored in S3, versioned
- Variable substitution in Lambda using Jinja2/Mustache
- Template cache in Lambda memory (5-minute TTL)

**Retry Strategy**
- SQS visibility timeout = 30s; max receive count = 3
- Exponential backoff handled by SQS redrive policy
- DLQ holds failed messages for 14 days; alerting via CloudWatch alarm on DLQ depth

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| Fan-out (SNS→SQS per channel) vs single queue | Per-channel isolation: email outage doesn't delay SMS. Single queue simpler but one slow channel blocks others |
| Lambda vs ECS for workers | Lambda auto-scales per SQS message; ECS has lower cold-start overhead at sustained high throughput. Use Lambda up to ~5M/hr, ECS Fargate beyond |
| SES vs 3rd-party (SendGrid) | SES: cheaper ($0.10/1000), AWS-native. SendGrid: better deliverability reputation, dedicated IPs |
| Sync preference check vs async | Sync in worker ensures freshest opt-out state; async (cached) is faster but risks sending after opt-out within cache window |

**SRE concern:** SES sending quotas are per-region. Request production limits in advance. Monitor `SES:Bounce` and `SES:Complaint` rates — exceeding 5% bounce or 0.1% complaint triggers automatic SES account pause.

#### AWS Services Used
- **SNS** — fan-out pub/sub hub
- **SQS** — per-channel buffering with DLQ
- **Lambda** — per-channel worker functions
- **SES** — email delivery
- **Pinpoint** — SMS + push with analytics
- **DynamoDB** — user preferences + delivery log
- **S3** — notification templates
- **CloudWatch** — DLQ depth alarms, delivery metrics

---

### AWS-3: Design a Real-Time Analytics Platform on AWS

#### Scenario
Design a real-time analytics platform for a SaaS product that tracks user events (page views, clicks, feature usage). Ingest 100,000 events per second, support real-time dashboards (5-second lag) and batch reporting (daily aggregations), store 2 years of raw data.

#### Requirements

**Functional**
- Ingest events via HTTP and SDK
- Real-time aggregations (active users, event counts by feature, funnel analysis)
- Ad-hoc SQL queries over historical data
- Data retention: hot (30 days), warm (1 year), cold (2+ years)

**Non-Functional**
- Ingestion p99 latency < 200ms
- Dashboard queries < 3 seconds
- Horizontal scalability to 500,000 events/second
- Cost-effective tiered storage

#### High-Level Architecture

```
Client SDKs / HTTP
        │
        ▼
API Gateway + Lambda (validation, enrichment, batching)
        │
        ▼
Kinesis Data Streams (100 shards, 100K events/sec)
        │
        ├────────────────────────────────────────────────┐
        │                                                │
        ▼                                                ▼
Kinesis Data Analytics (Flink)            Kinesis Firehose
Real-time aggregations                    (buffer + compress)
        │                                         │
        ▼                                         ▼
DynamoDB                               S3 (Parquet, partitioned
(real-time counters,                   by year/month/day/hour)
 5-min aggregates)                            │
        │                              ┌───────┴──────────────┐
        ▼                              │                      │
QuickSight (live dashboard)    Redshift Spectrum          Athena
                               (30-day hot tier)     (historical ad-hoc)
```

**Ingestion Optimization**
- Client SDK batches events (100 events or 1s, whichever first) — reduces API calls 100x
- Lambda validates schema (JSON Schema), enriches with server-side timestamp and geo-IP, writes to Kinesis in batch (PutRecords up to 500 records per call)
- Kinesis partition key = `tenantId` to ensure per-tenant ordering

**Real-Time Layer (Kinesis Data Analytics / Flink)**
- Tumbling windows (1-min, 5-min) compute aggregates: DAU, event counts, session duration
- Results written to DynamoDB (dashboard reads from here, p99 < 3ms)
- Sliding windows for funnel analysis (user completed step A → B within 30 mins)

**Storage Tiering**
- Firehose writes Parquet to S3 with Snappy compression (10:1 compression ratio)
- Redshift loads 30-day rolling window from S3 (Redshift Spectrum for spill-over queries)
- Athena for historical queries beyond Redshift hot tier (pay-per-query, ~$5/TB scanned)
- S3 Lifecycle: Standard → Standard-IA (30 days) → Glacier (1 year) → Deep Archive (2 years)

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| Kinesis vs Kafka (MSK) | Kinesis: fully managed, simpler operations, native AWS integration. MSK: more control, supports Kafka ecosystem. Kinesis preferred for pure AWS stacks |
| Redshift vs Athena for hot queries | Redshift: faster for repeated queries (query result cache), better concurrency. Athena: serverless, no cluster cost, ideal for ad-hoc |
| DynamoDB for real-time counters | Atomic increments with TTL enable fast dashboard reads. Alternative: Redis (ElastiCache) for sub-millisecond but no durability |
| Flink vs Lambda for stream processing | Flink: stateful, windowed aggregations, exactly-once. Lambda: simpler but stateless, harder to implement windows correctly |

**SRE concern:** Kinesis shard throttling at `GetRecords` (5 reads/sec per shard) hits Lambda consumers hard during fan-out. Use Enhanced Fan-Out (EFO) — dedicated 2MB/s per consumer per shard, push-based delivery.

#### AWS Services Used
- **Kinesis Data Streams** — high-throughput event ingestion
- **Kinesis Data Analytics (Flink)** — stateful stream processing
- **Kinesis Firehose** — S3 delivery pipeline
- **DynamoDB** — real-time aggregation store
- **Redshift** — SQL analytics on hot data
- **Athena** — serverless ad-hoc queries on S3
- **S3 + Lifecycle Policies** — tiered cold storage
- **QuickSight** — dashboards with SPICE cache
- **Lambda** — ingestion validation and enrichment

---

### AWS-4: Design a Distributed Rate Limiter on AWS

#### Scenario
Design a rate limiting service for a multi-tenant API platform. Support 10,000 tenants, each with custom rate limits (requests per second, requests per day). Handle 500,000 API requests per second globally. Enforce limits at the edge with <5ms overhead per request.

#### Requirements

**Functional**
- Per-tenant, per-endpoint rate limits (token bucket algorithm)
- Soft limits (throttle with 429) and hard limits (block)
- Dynamic limit updates without redeployment
- Limit reset at configurable windows (per-second, per-minute, per-day)

**Non-Functional**
- Rate limit check adds < 5ms latency
- 99.999% availability (rate limiter itself must not become SPOF)
- Globally consistent limits across AWS regions (eventual vs strong consistency tradeoff)
- Handles 500K RPS across 3 AWS regions

#### High-Level Architecture

```
Client Request
      │
      ▼
CloudFront (edge, WAF rate-based rules for IP-level DDoS)
      │
      ▼
API Gateway (account-level 10K RPS throttle, usage plans per API key)
      │
      ▼
Lambda Authorizer (rate limit check, <5ms target)
      │
      ├──► ElastiCache Redis (Cluster Mode)
      │    Token Bucket state per tenantId+endpoint
      │    Lua script: atomic GETSET for race-free decrement
      │    TTL-based window reset
      │
      ├──[within limit]──► Backend service (ECS/Lambda)
      │
      └──[over limit]────► 429 Too Many Requests + Retry-After header

Config Store: DynamoDB
  (tenantId → {rps: 1000, daily: 1M, burst: 2000})
  DynamoDB Streams → Lambda → cache invalidation in Redis
```

**Token Bucket in Redis (Lua script for atomicity)**
```lua
-- Atomic: read tokens, refill based on elapsed time, consume 1
local tokens = tonumber(redis.call('GET', key) or capacity)
local last_refill = tonumber(redis.call('GET', key..':ts') or now)
local elapsed = now - last_refill
local refill = math.floor(elapsed * rate)
tokens = math.min(capacity, tokens + refill)
if tokens >= 1 then
    redis.call('SET', key, tokens - 1)
    return 1  -- allowed
else
    return 0  -- rejected
end
```

**Global Consistency Strategy**
- Each region has its own Redis cluster; limits are enforced per-region
- Effective global limit = per-region limit / number of active regions
- Alternative for strong global limits: DynamoDB global tables with conditional updates (~15ms latency — unacceptable for <5ms requirement)
- Accept eventual consistency: occasional over-admission during region failover is acceptable

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| Redis Lua vs DynamoDB atomic writes | Redis: <1ms, local. DynamoDB: ~5-15ms, globally consistent. Redis wins for latency requirement |
| Per-region limits vs global limits | Per-region: low latency, slight over-admission at region level. Global: accurate but ~15ms for cross-region consistency |
| Lambda Authorizer vs sidecar proxy | Lambda Authorizer: centralized, easy to update. Sidecar (Envoy): enforced at pod level, better for K8s |
| Sliding window vs fixed window | Fixed window: simple, prone to boundary bursts (2x limit at window reset). Token bucket: best balance |

**SRE concern:** Redis ElastiCache in cluster mode requires consistent hashing. Rate limit keys for the same tenant must land on the same shard — use `{tenantId}` hash tags in Redis key naming to force co-location.

#### AWS Services Used
- **CloudFront + WAF** — IP-level DDoS protection at edge
- **API Gateway** — usage plans, account-level throttling
- **Lambda Authorizer** — custom rate limit enforcement
- **ElastiCache Redis (Cluster Mode)** — token bucket state, Lua atomicity
- **DynamoDB** — rate limit config store with Streams for cache invalidation
- **CloudWatch** — throttle metrics and alarms

---

## GCP System Designs

---

### GCP-1: Design a Real-Time Data Pipeline on GCP

#### Scenario
Design a real-time data ingestion and processing pipeline for an IoT platform. 10,000 devices send telemetry every second (temperature, pressure, GPS). Process and store data for real-time alerting, ML feature engineering, and long-term analytics. Total: ~10,000 events/second steady state, 50,000 events/second burst.

#### Requirements

**Functional**
- Ingest device telemetry via MQTT/HTTP
- Real-time anomaly alerting (temperature > threshold → notify operations)
- Store processed data for ML training
- Analytical queries over historical data (device health trends, aggregate statistics)

**Non-Functional**
- Ingestion to alert: < 10 seconds end-to-end
- No data loss; at-least-once delivery
- Data retention: 90 days queryable, 7 years archival
- Scale to 100,000 devices with no architecture change

#### High-Level Architecture

```
IoT Devices (MQTT/HTTP)
        │
        ▼
Cloud IoT Core / IoT Hub  (device registry, auth)
        │
        ▼
Cloud Pub/Sub Topic: raw-telemetry
        │
        ├──────────────────────────────────────────────┐
        │                                              │
        ▼                                              ▼
Dataflow Job (Streaming)                    Dataflow Job (Batch - nightly)
Apache Beam pipeline                        Aggregate daily stats
  ├─ parse + validate                       └──► BigQuery (aggregates table)
  ├─ enrich (device metadata from Firestore)
  ├─ windowed aggregations (1-min tumbling)
  ├─ anomaly detection (threshold check)
  │       │
  │       └──► Pub/Sub: alerts → Cloud Functions → PagerDuty/Slack
  │
  ├──► BigQuery (streaming inserts via Storage Write API)
  │    Partitioned by date, clustered by device_id
  │
  └──► Cloud Storage (GCS)
       Parquet format, partitioned
       └──► Vertex AI Feature Store (ML features)

Looker Studio / Looker → BigQuery (dashboards)
Cloud Monitoring → Uptime checks + alerting policies
```

**Pub/Sub Configuration**
- Dead letter topic with max delivery attempts = 5; messages older than 7 days expired
- Message ordering enabled per `device_id` (ordering key) for time-series correctness
- BigQuery subscription (direct Pub/Sub → BigQuery) for simple landing table

**Dataflow Optimizations**
- Use Streaming Engine (managed backend) — reduces VM cost by offloading state to managed store
- Storage Write API vs streaming inserts: Storage Write API offers 10x throughput and exactly-once semantics
- Worker autoscaling: `--autoscalingAlgorithm=THROUGHPUT_BASED`

**Storage Strategy**
- BigQuery: partitioned by `DATE(event_timestamp)`, clustered by `device_id` — reduces query cost 80%
- GCS: raw Parquet for ML training pipelines (Vertex AI Pipelines reads directly from GCS)
- BigQuery long-term storage pricing kicks in after 90 days (60% cheaper)

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| Dataflow vs Spark on Dataproc | Dataflow: fully managed, auto-scales, Apache Beam. Dataproc: more control, cheaper for batch, requires cluster management |
| Pub/Sub direct to BigQuery vs Dataflow | Direct subscription: simpler, lower cost for raw landing. Dataflow: transformation logic, fan-out to multiple sinks, enrichment |
| BigQuery streaming vs batch load | Streaming: queryable within seconds, costs ~$0.01/200MB. Batch (GCS → BQ): free but 15-min delay |
| Firestore for device metadata | Firestore supports real-time lookups in Dataflow side inputs. Cloud SQL: simpler but requires JDBC in Dataflow (higher latency) |

**SRE concern:** Pub/Sub acknowledgment deadline must exceed your Dataflow processing time. Default is 600s. If processing stalls, messages are redelivered — your pipeline must be idempotent. Use `event_id` as BigQuery insert deduplication key.

#### GCP Services Used
- **Cloud Pub/Sub** — durable message ingestion and fan-out
- **Dataflow (Apache Beam)** — stream and batch processing
- **BigQuery** — analytical warehouse (Storage Write API)
- **Cloud Storage (GCS)** — raw data lake + ML feature storage
- **Vertex AI Feature Store** — ML feature serving
- **Firestore** — device metadata lookups (Dataflow side inputs)
- **Cloud Functions** — alert fan-out (Pub/Sub → PagerDuty)
- **Cloud Monitoring + Cloud Logging** — pipeline observability

---

### GCP-2: Design a Microservices Platform on GKE

#### Scenario
Design a production-grade microservices platform on GKE for a fintech application with 30+ services, strict compliance requirements (PCI-DSS), mutual TLS between all services, observability out of the box, and zero-downtime deployments.

#### Requirements

**Functional**
- Service-to-service communication with mTLS enforced
- Centralized traffic management (retries, circuit breaking, timeouts)
- Distributed tracing across all services
- Compliance: all intra-cluster traffic encrypted, network segmentation enforced

**Non-Functional**
- 99.99% availability per service
- Observability with <1% overhead
- Canary deployments with automatic traffic shifting
- Multi-region active-active (GKE clusters in us-central1 + europe-west1)

#### High-Level Architecture

```
Internet
   │
   ▼
Cloud Armor (DDoS + WAF)
   │
   ▼
Global External Application Load Balancer
   │
   ├──[us-central1]──────────────────────────────────┐
   │                                                  │
   ▼                                                  ▼
GKE Cluster (us-central1)                   GKE Cluster (europe-west1)
┌──────────────────────────────┐             (mirror architecture)
│  Cloud Service Mesh (Istio)  │
│                              │
│  Ingress Gateway             │
│    │                         │
│    ▼                         │
│  Service A (3 pods)          │
│    │  mTLS  │                │
│    ▼        ▼                │
│  Service B  Service C        │
│    │                         │
│    ▼                         │
│  Cloud SQL / AlloyDB         │
│  Firestore (managed)         │
└──────────────────────────────┘
   │
   ▼
Cloud Monitoring / Cloud Logging / Cloud Trace
(automatic via mesh sidecar — Envoy proxy)
```

**Cloud Service Mesh (Anthos Service Mesh / Istio)**
- Envoy sidecar injected automatically via MutatingAdmissionWebhook
- PeerAuthentication policy: `STRICT` mode — all pods must present valid cert; plain text rejected
- DestinationRule: connection pool, outlier detection (circuit breaker), TLS settings
- VirtualService: traffic splitting for canary (95% stable / 5% canary), retry policy (3 retries, 500ms timeout)

**Observability Stack (automatic via sidecar)**
- Metrics: Envoy proxy emits HTTP/gRPC metrics → Cloud Monitoring (request rate, error rate, latency p50/p99)
- Traces: Cloud Trace collects distributed traces; automatic propagation of trace headers by Envoy
- Logs: structured logs from sidecar → Cloud Logging → Log Analytics (BigQuery-backed)

**Multi-Region Strategy**
- Global LB routes to nearest healthy region (health checks every 10s)
- GKE clusters are independent; Cloud Spanner used for globally consistent transactional data
- Pub/Sub for async cross-region event propagation
- Anthos Config Management syncs policies and configs across both clusters from Git (GitOps)

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| Cloud Service Mesh vs self-managed Istio | Cloud Service Mesh: Google-managed upgrades, integrated with Cloud Monitoring. Self-managed: more control, operational burden |
| mTLS STRICT vs PERMISSIVE mode | STRICT: full enforcement, any unproxied pod rejected (breaks during migration). PERMISSIVE: allows migration period but no security until STRICT |
| Cloud Spanner vs AlloyDB | Spanner: unlimited scale, global, 5 9s SLA. AlloyDB: PostgreSQL-compatible, lower latency, regional |
| GKE Autopilot vs Standard | Autopilot: per-pod billing, managed node pools. Standard: custom machine types, node-level access needed for compliance scanning |

**SRE concern:** Envoy sidecar adds ~1ms latency per hop and ~50MB RAM per pod. For a 30-service mesh, latency compounds. Set aggressive circuit breaker thresholds (outlier detection: 50% error rate → 30s ejection) to prevent cascade failures across the mesh.

#### GCP Services Used
- **GKE (Standard or Autopilot)** — Kubernetes clusters
- **Cloud Service Mesh (Anthos/Istio)** — mTLS, traffic management, observability
- **Cloud Armor** — DDoS + WAF at edge
- **Global Application Load Balancer** — anycast, multi-region routing
- **Cloud Spanner** — globally distributed ACID transactions
- **Firestore** — document store for non-transactional data
- **Cloud Monitoring + Cloud Trace + Cloud Logging** — observability (sidecar-fed)
- **Anthos Config Management** — GitOps policy sync across clusters
- **Artifact Registry** — OCI image store with Vulnerability Scanning

---

### GCP-3: Design a Globally Available CDN-Backed Web Platform on GCP

#### Scenario
Design a globally available SaaS web platform serving 50M users across 6 continents. Handle 2M requests per minute at peak, with static assets, API calls, and user-generated content (images, documents). Protect against DDoS and achieve <50ms TTFB globally for cached content.

#### Requirements

**Functional**
- Serve static assets (JS, CSS, images) from edge cache globally
- Route API requests to regional backends
- User-generated content upload and serve (up to 10GB files)
- Block malicious traffic: SQL injection, XSS, known bad IPs, country-level blocks

**Non-Functional**
- Cache hit ratio >95% for static assets
- TTFB <50ms for cached, <200ms for dynamic (globally)
- Absorb 1Tbps DDoS attack without impact
- 99.99% availability

#### High-Level Architecture

```
User (any continent)
        │
        ▼
Google Global Anycast IP (advertised from 200+ PoPs)
        │
        ▼
Cloud Armor (edge security policies)
  ├── Rate-based rules (IP: 1000 req/min)
  ├── Preconfigured WAF rules (OWASP Top 10)
  ├── Adaptive Protection (ML-based DDoS detection)
  └── Geo-based block/allow rules
        │
        ▼
Global External Application Load Balancer
  URL map routing:
   /static/* → Cloud CDN (GCS origin)
   /api/*    → Regional backend (GKE / Cloud Run)
   /uploads/* → GCS signed URL redirect
        │
   ┌────┴────────────────────────────────────────┐
   │                                             │
   ▼                                             ▼
Cloud CDN                               Regional Backends
(GCS bucket origin)                     (Cloud Run / GKE)
Cache-Control: max-age=31536000         (us-central1, europe-west1,
Versioned asset paths (/v1.2.3/app.js)  asia-east1)
                                              │
                                              ▼
                                     AlloyDB + Memorystore (Redis)
                                     Cloud Storage (UGC)

UGC upload flow:
  API → GCS Signed URL (15-min TTL)
  Client uploads directly to GCS (bypasses LB)
  GCS triggers Pub/Sub → Cloud Run (virus scan, transcode)
  Serve via separate CDN-backed GCS bucket
```

**Cloud Armor Strategy**
- Edge security policies applied before content reaches CDN cache
- Adaptive Protection: ML model trained on traffic baseline; auto-suggests WAF rules during anomalous spikes
- Rate limiting: per-IP (1,000 req/min), per-user (5,000 req/min via JWT claim extraction)
- Custom rules for known bad ASNs (Tor exit nodes, known botnet ranges)

**CDN Cache Strategy**
- Static assets use content-addressed filenames (`app.abc123.js`) — infinite TTL (`max-age=31536000, immutable`)
- API responses: `Cache-Control: no-store` (personalized), or `max-age=60` with `Vary: Accept-Encoding`
- CDN cache warming: pre-populate on deployment via Cloud Build step
- Cache invalidation: path-based invalidation on deployment (`/static/v2.0.0/*`)

**High Availability**
- Global LB automatically removes unhealthy regional backends from rotation
- Traffic auto-shifts to next nearest region during outage — no DNS TTL wait (anycast failover)
- GCS multi-region bucket: 99.999999999% (11 9s) durability, multi-region read availability

#### Key Design Decisions and Tradeoffs

| Decision | Tradeoff |
|---|---|
| CDN caching at GCS origin vs backend origin | GCS: highly available, cheap, infinite scale. Backend origin: dynamic content caching possible but harder to invalidate |
| Signed URLs for UGC upload | Client uploads directly to GCS — offloads bandwidth from backend. URL can be shared for 15 min (TTL controls risk) |
| Cloud Armor Adaptive Protection | ML-based: automatic during attacks. Manual rules: predictable, auditable. Use both |
| Cloud Run vs GKE for regional backends | Cloud Run: serverless, scales to zero, fast deploy. GKE: more control, persistent connections (WebSockets) |

**SRE concern:** Cloud Armor is enforced at the edge, but `X-Forwarded-For` headers must be preserved and validated in your backend to prevent IP spoofing. Backends should enforce rate limits independently — Cloud Armor is not a substitute for application-level throttling.

#### GCP Services Used
- **Global External Application Load Balancer** — anycast, multi-region, URL-based routing
- **Cloud Armor** — WAF, DDoS protection, Adaptive Protection (ML)
- **Cloud CDN** — edge caching, GCS-backed, 200+ PoPs
- **Cloud Storage (GCS)** — static assets + UGC (multi-region bucket)
- **Cloud Run** — regional serverless API backends
- **AlloyDB** — PostgreSQL-compatible, high-performance regional DB
- **Memorystore (Redis)** — session cache, API response cache
- **Pub/Sub + Cloud Run** — UGC post-processing (virus scan, image resize)
- **Cloud Monitoring + Cloud Logging** — traffic and security dashboards

---

## Quick Reference: Service Comparison

| Concern | AWS | GCP | Kubernetes-Native |
|---|---|---|---|
| Message queue | SQS | Pub/Sub | KEDA + Kafka (Strimzi) |
| Stream processing | Kinesis Data Analytics (Flink) | Dataflow (Beam) | Kafka Streams on K8s |
| Serverless compute | Lambda | Cloud Run / Cloud Functions | KEDA ScaledJob |
| Container orchestration | EKS | GKE | Upstream Kubernetes |
| Service mesh | App Mesh / Istio on EKS | Cloud Service Mesh (Anthos) | Istio / Linkerd |
| CDN + WAF | CloudFront + WAF | Cloud CDN + Cloud Armor | NGINX Ingress + ModSecurity |
| Secrets | Secrets Manager + KMS | Secret Manager + Cloud KMS | External Secrets Operator + Vault |
| GitOps CD | CodePipeline / Flux on EKS | Cloud Deploy / ArgoCD on GKE | ArgoCD + Argo Rollouts |
| Event-driven autoscaling | Lambda (SQS trigger) | Cloud Run (Pub/Sub trigger) | KEDA |
| Analytical warehouse | Redshift | BigQuery | — |

---

## Interview Question Bank

Use these as practice prompts. Aim for 30-40 minutes per design.

### Kubernetes Questions
1. Design a Kubernetes platform for 200 development teams with network isolation and cost showback.
2. Design a zero-downtime blue-green deployment system for a monolith migrating to microservices.
3. Design a Kubernetes batch processing system that handles 1M jobs per day with priority queues.
4. Design a secure multi-cluster federation with unified observability across AWS and GCP.
5. Design a Kubernetes operator for managing database lifecycle (provision, backup, restore, failover).

### AWS Questions
1. Design a serverless e-commerce checkout system handling Black Friday load (10x normal traffic).
2. Design a multi-region active-active payment processing system with consistency guarantees.
3. Design a data lake ingestion pipeline from 500 microservices with schema evolution support.
4. Design a real-time fraud detection system with <100ms response time.
5. Design an internal developer platform on AWS that provisions environments via self-service.

### GCP Questions
1. Design a ML training pipeline on GCP that trains models on 50TB datasets daily.
2. Design a globally distributed gaming backend on GKE with <50ms latency in 6 regions.
3. Design a compliance-ready data warehouse for a healthcare company on GCP (HIPAA).
4. Design a CI/CD platform on GCP using Cloud Build, Artifact Registry, and Cloud Deploy.
5. Design a real-time recommendation engine serving 100M users with personalization.

### Cross-Cloud / Architecture Questions
1. Design a disaster recovery strategy across AWS and GCP with RTO < 15 minutes.
2. Design a unified secret management system across Kubernetes, AWS, and GCP.
3. How would you migrate a 200-service monorepo from on-premise to Kubernetes with zero downtime?
4. Design a cost optimization system that automatically right-sizes resources across cloud providers.
5. Design a platform observability system: how do you detect, alert, and recover from incidents automatically?
