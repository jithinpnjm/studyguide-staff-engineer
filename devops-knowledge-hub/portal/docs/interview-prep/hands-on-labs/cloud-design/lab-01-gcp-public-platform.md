---
title: "Cloud Design Lab 1: GCP Public Platform"
sidebar_position: 99
---

# Cloud Design Lab 1: GCP Public Platform

## Scenario

Design a public production platform on GCP for a customer-facing API product with global users.

Requirements:
- global users, read-heavy traffic with some write APIs
- public DNS with low-latency resolution
- CDN for cacheable content
- WAF and DDoS protection at the edge
- L7 load balancing
- stateless API tier on GKE or Cloud Run (your choice, justify it)
- private relational database with no public exposure
- Pub/Sub for async work
- centralized logs, metrics, traces, and alerting
- high availability with zonal failure tolerance
- secure CI/CD and rollout controls

---

## Prerequisites

Before attempting this lab, review:
- GCP networking: VPC, subnets, firewall rules, private service access
- Cloud Load Balancing (external HTTPS), Cloud CDN, Cloud Armor
- GKE cluster architecture (node pools, zones, workload identity)
- Cloud Run (regional, private vs public ingress)
- Cloud SQL (private IP, failover replicas, connection pooling via Cloud SQL Auth Proxy)
- Pub/Sub (topics, subscriptions, dead-letter topics)
- Cloud Monitoring, Cloud Logging, Cloud Trace
- Binary Authorization and Cloud Deploy

Estimated time: 90-120 minutes for a first attempt. 45 minutes if you have designed cloud platforms before.

---

## How to Think About This

Do not start by drawing boxes. Start by answering these questions in order. Each layer depends on the one before it.

**Step 1 — Clarify what is public and what is private.**
The scenario says "public platform." That does not mean everything is public. Only the edge should be public. Ask yourself: which IP addresses should be reachable from the internet? The answer should be very short: the external load balancer IP, and optionally a CDN/WAF IP. Everything else should be private.

**Step 2 — Trace the request path from a user's device to the database.**
Walk through every hop: DNS resolution, CDN cache hit or miss, WAF rule check, load balancer, ingress or API gateway, application pod, cache lookup, database query. Write this as a numbered list before you draw anything. This reveals where latency comes from and where you can insert controls.

**Step 3 — Separate stateless from stateful.**
Mark every component as stateless (can be restarted or scaled horizontally without losing data) or stateful (holds durable data that must survive failure). Stateless components are cheap to run in multiple zones. Stateful components are where HA gets hard.

**Step 4 — Define your failure domains.**
A zone failure means one GCP zone goes down. A region failure means all zones in a region go down. A shared dependency failure means something like Cloud SQL or Pub/Sub has a service-level problem. For each failure type, answer: what degrades, what stays up, what data is at risk?

**Step 5 — Layer in security from the outside in.**
At the edge: what stops bad traffic before it hits compute? In the application layer: how do services identify each other? At the data layer: how do workloads connect to the database without static credentials?

**Step 6 — Add the delivery and observability glue.**
How does a new version get deployed safely? What signals tell you something is wrong before users notice? What does the on-call engineer look at first when they get paged?

---

## Building Blocks Available

| Component | What it does |
|---|---|
| Cloud DNS | Authoritative DNS with anycast routing; can respond differently by location |
| Cloud CDN | Caches responses at Google's edge PoPs; reduces origin load and latency for cacheable paths |
| Cloud Armor | Layer 7 WAF and DDoS protection; evaluates rules before requests hit your compute |
| External HTTPS Load Balancer | Global Anycast L7 LB; terminates TLS; routes to backends by path/header |
| GKE (Google Kubernetes Engine) | Managed Kubernetes; multi-zone node pools; works with Workload Identity |
| Cloud Run | Serverless containers; auto-scales to zero; per-request billing; simpler operational model |
| Cloud SQL | Managed PostgreSQL/MySQL; supports private IP; failover replicas; read replicas |
| Cloud Memorystore | Managed Redis or Memcached; private networking only |
| Pub/Sub | Managed message queue; durable; push or pull delivery; dead-letter topic support |
| Workload Identity | Binds a Kubernetes service account to a GCP IAM service account; eliminates static keys |
| Cloud SQL Auth Proxy | Sidecar that handles encrypted, IAM-authenticated connections to Cloud SQL |
| Artifact Registry | Stores and signs container images; integrates with Binary Authorization |
| Binary Authorization | Policy that blocks deployments unless images have attestations from trusted builders |
| Cloud Deploy | Managed progressive delivery; supports canary and blue/green rollout pipelines |
| Cloud Monitoring | Metrics, SLOs, alerting; integrates with GKE and Cloud Run natively |
| Cloud Logging | Structured log ingestion; query with Log Explorer; export to BigQuery for analysis |
| Cloud Trace | Distributed tracing; auto-instrumented with Cloud Run; manual SDK for GKE |
| Secret Manager | Stores API keys, DB passwords; access controlled by IAM; audit-logged |

---

## Beginner Starter Skeleton

This is roughly 30-40% of a complete answer. Use it to get started, then expand each section.

### Assumptions I Would Clarify First

- Traffic is globally distributed, mostly read-heavy
- p99 latency matters for API responses
- Zonal loss should cause no more than brief degradation, not full outage
- All database writes must be consistent; I will not attempt active-active multi-region writes initially
- The team has the operational capacity to run GKE (if not, Cloud Run would be the starting point)

### High-Level Request Path

```
User
  -> Cloud DNS (resolves api.example.com)
  -> Cloud CDN (cache hit: return immediately; cache miss: continue)
  -> Cloud Armor (WAF rules, rate limiting, DDoS mitigation)
  -> External HTTPS Load Balancer (TLS termination, L7 routing)
  -> GKE Ingress / Cloud Run (stateless API pods, multi-zone)
  -> [Cache lookup via Memorystore for read-heavy paths]
  -> Cloud SQL (private IP, primary in region, failover replica in another zone)
  -> Pub/Sub (for async side effects, e.g., notifications, audit events)
  -> Worker pods/Cloud Run services (consume from Pub/Sub)
```

### Network Boundaries

- Public: only the external load balancer IP
- Private application tier: GKE nodes in private subnet, no external IPs
- Private data tier: Cloud SQL on private IP, Memorystore on private IP
- All subnets within a single VPC; use VPC firewall rules to restrict east-west traffic

### Stateless vs Stateful

Stateless (easy to scale and replace):
- API pods on GKE
- Pub/Sub consumer workers
- Ingress/gateway layer

Stateful (where HA gets hard):
- Cloud SQL — primary + failover replica across zones
- Memorystore — if used for warm cache, treat as soft state, design for cold start
- Pub/Sub backlogs — messages are durable, but unprocessed backlog is a stateful risk

### What I Have Not Designed Yet (expand these)

- Exact IAM policy for each service account
- Rollout pipeline stages (canary %, promotion gates)
- Observability dashboard layout and SLO definitions
- CDN cache key design and invalidation strategy
- Regional failover decision tree

---

## Tasks

Complete all of the following. Write prose or annotated lists, not just bullet points. Explain your reasoning for each choice.

1. **Requirements and assumptions** — State your traffic, latency, HA, and security assumptions explicitly. If you assume read-heavy traffic or a specific SLA, say so here.

2. **Edge and traffic path** — Describe every hop from DNS to database. Explain why each layer exists and what happens if it is removed.

3. **Network layout** — Define your VPCs, subnets, and firewall rules. Which resources get public IPs? Which are strictly private? Where do you use Private Service Access?

4. **Stateless versus stateful split** — List every component and classify it. For stateful components, describe your HA mechanism (replica, failover, backup).

5. **Database and async design** — How is Cloud SQL configured for zonal HA? How do you handle connection pooling? What goes to Pub/Sub versus staying in the synchronous path?

6. **Observability architecture** — What metrics, logs, and traces do you collect? What are your SLO definitions? What does the on-call dashboard look like?

7. **Security controls** — Describe your approach at each layer: edge (Cloud Armor), workload identity (Workload Identity + IAM), secrets (Secret Manager), image trust (Binary Authorization).

8. **Rollout and rollback model** — How is a new image built, scanned, attested, and deployed? What is the rollback procedure if a canary shows elevated errors?

9. **Zonal failure behavior** — Walk through what happens, technically and operationally, if zone `us-central1-b` goes down at 2am. What degrades, what is automatic, what requires manual action?

10. **What you would deliberately keep simple** — Name at least two things you chose not to do in this design and explain why.

---

## What a Beginner Answer Looks Like

- Names the key GCP services correctly (GKE, Cloud SQL, Cloud Armor, Pub/Sub)
- Describes a basic request path from user to database
- Understands that the database should be private
- Can explain what Cloud Armor does at a high level
- May not distinguish between zonal and regional failure
- May not address workload identity or delivery pipeline
- Missing: consistency model, CDN cache key design, stateful failover mechanics

## What an Intermediate Answer Looks Like

- Clear public/private boundary; only the LB IP is public
- Correct zonal HA: Cloud SQL failover replica, GKE pods spread across zones
- Understands Workload Identity and why static keys are a risk
- Addresses CDN caching including cache invalidation and what should not be cached
- Includes SLOs with concrete latency and availability targets
- Can explain a basic rollout with progressive delivery and rollback
- Missing: p99 latency budget breakdown, shallow health signal problem, regional failover tradeoffs

## What a Strong Answer Looks Like

- Opens by naming the stateful core and why it defines most HA complexity
- Explicit latency budget: DNS + TLS + CDN + LB + app + DB, with target numbers
- Addresses the shallow health signal problem: a zone can pass platform health checks while degrading real traffic
- CDN cache key design and invalidation are thought through
- Clearly states when regional failover is automatic vs manual, and what data risk exists
- Justifies GKE vs Cloud Run with specific tradeoffs relevant to this scenario
- Delivery pipeline: immutable images, digest-pinned, attested, binary authorization enforced
- Incident example walks through concrete actions, not generic steps
- Names two or three things deliberately not built, with reasoning

---

## Interviewer Pressure Questions

Be ready for these follow-ups. They are designed to test depth beyond the happy path.

- Why GKE over Cloud Run here? What changes in your answer if you choose Cloud Run instead?
- What is exactly public and exactly private in your design? Point to each component.
- Where does TLS terminate? What happens to encryption between the LB and your pods?
- How do you avoid Cloud SQL becoming the real single point of failure even with a failover replica?
- What if Cloud CDN caches a response that is stale or contains private data?
- What if one zone looks healthy to platform health checks but is actually degraded for real user traffic? How do you detect and respond to that?
- Your API pods scaled up fast during a traffic spike. How does Cloud SQL handle the connection surge?
- Walk me through your rollback procedure assuming a bad deploy is caught at 5% canary traffic.
- How does a new engineer get credentials to access Cloud SQL in production right now, at 2am during an incident?

---

## Deliverable Guidance

Your final answer should contain:

**Architecture diagram** (hand-drawn or diagramming tool):
- Show: DNS -> CDN -> Cloud Armor -> LB -> GKE/Cloud Run -> Cloud SQL + Pub/Sub
- Mark which resources are public (external IP) and which are private (no external IP)
- Show zone distribution for GKE node pools and Cloud SQL

**One-page reasoning document** covering:
- Your assumptions
- Why you chose GKE or Cloud Run
- How zonal HA works for each stateful component
- Your edge security model
- Your delivery pipeline in 4-5 steps

**Incident note for zonal degradation** covering:
- What you observe (signals, metrics, alerts)
- What is automatic (LB health checks routing around the zone)
- What you validate (other zones have enough capacity, DB is healthy)
- What you communicate (user impact, mitigation, next update)

---

## What to Study Next

After completing this lab:
- Lab 2: same platform, no public exposure — how does the design change?
- Lab 3: rebuild this for AWS — which choices translate, which do not?
- Reference answer is at `reference-answer-gcp-public-platform.md` — compare after your own attempt
- Deep dives: Cloud SQL connection pooling with PgBouncer or Alloy DB, Binary Authorization policy design, CDN cache key strategies
