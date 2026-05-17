---
title: "Cloud Design Lab 4: Low-Latency Multi-Region Control Plane"
sidebar_position: 4
---

# Cloud Design Lab 4: Low-Latency Multi-Region Control Plane

## Scenario

Design a low-latency control plane used by compute workloads across GCP and AWS. This is not a customer-facing product. It is an internal infrastructure service that other systems depend on to make real-time decisions — for example, a policy enforcement service, a configuration service, or a metadata service that workloads query at startup and periodically during operation.

Requirements:
- p99 latency matters more than raw throughput
- correctness matters more than marketing-grade multi-cloud symmetry
- stateful metadata store is required
- regional and zonal failure tolerance
- no public API; consumers are internal workloads on GCP and AWS
- strong security and auditability
- strict rollout safety — a bad control-plane push can affect all consuming workloads simultaneously

---

## Prerequisites

Before attempting this lab, review:
- Distributed systems basics: consistency models (strong, eventual, linearizable), CAP theorem, and PACELC tradeoffs
- GCP: Spanner (globally consistent), Bigtable (wide-column, low latency reads), Firestore (document, strong consistency per-document), Cloud Memorystore (Redis for caching)
- AWS: DynamoDB (multi-region replication via Global Tables), ElastiCache (Redis), RDS with cross-region read replicas
- Multi-region networking: GCP interconnect vs Dedicated Interconnect, AWS Direct Connect, VPN between clouds
- Read-through and write-through caching patterns, cache invalidation strategies
- gRPC: health checking, deadlines, retry policies, service mesh integration
- Canary deployment for control-plane services (blast radius is much higher than for stateless services)
- SLO budgeting and latency percentile reasoning (p50 vs p99 and why they tell different stories)

Estimated time: 120-150 minutes. This lab requires distributed systems reasoning beyond cloud product knowledge.

---

## How to Think About This

This lab is harder than the others because it requires you to reason about correctness, latency, and failure simultaneously. Do not start with a product list. Start with the fundamental constraints, then select components that satisfy them.

**Step 1 — Separate the control plane from the data plane clearly.**
A control plane decides what should happen. A data plane makes it happen at scale. Your control plane here is the decision and configuration service — it stores metadata and policies that workloads consult. The workloads themselves (doing compute, processing requests) are the data plane. This separation matters because: the control plane must be more correct than the data plane, but it does not need to handle every request the data plane handles. Define control-plane responsibilities precisely before designing anything.

**Step 2 — Define your latency budget before picking components.**
p99 latency is a commitment. Work backwards from the number your consumers need. If a workload needs a control-plane response within 5ms p99, and network alone from AWS us-east-1 to GCP us-central1 is 15ms, then a design that routes every request to a central point fails the requirement before you even add service latency. The latency budget forces you to decide: read from a local replica, use a local cache, or accept a weaker consistency model. You cannot avoid this tradeoff.

**Step 3 — Name the stateful core early.**
Every distributed system has a core where state lives. Name it explicitly. Is it Spanner? A Raft cluster? DynamoDB Global Tables? Redis Cluster? Each has different consistency, latency, and operational properties. Your entire HA and failover design derives from what the stateful core can and cannot do during failures.

**Step 4 — Design your cache strategy around your consistency requirement.**
A cache in front of a strongly consistent store improves read latency but introduces staleness. How stale is acceptable for your use case? If a policy changes, how quickly must all workloads see the new version? Can a workload briefly operate with a slightly stale policy, or does stale data cause security violations or incorrect routing? The answer to this determines whether you need aggressive cache invalidation, short TTLs, or push-based update propagation.

**Step 5 — Place your replicas and caches with the latency budget in mind.**
Cross-cloud network latency between GCP and AWS is typically 20-60ms round-trip depending on the regions. If your p99 budget is 10ms, you cannot round-trip cross-cloud on the hot path. This means: local read replica or local cache in each cloud, with the authoritative write path going to one primary region, and async replication to replicas.

**Step 6 — Define your failure modes and responses.**
For each failure type — single AZ loss, single region loss, inter-cloud network partition, control-plane database unavailability — answer: does the system fail closed (rejects requests), fail open (applies cached/last-known state), or degrade (returns stale data with a warning)? Each choice has safety implications. A policy enforcement system failing open is a security incident. A configuration service failing closed blocks all workload startups.

**Step 7 — Reason about rollout blast radius.**
For a stateless API, a bad deploy affects 5% of traffic during canary. For a control plane that all workloads depend on, a bad deploy can affect all workloads simultaneously even with canary traffic routing — because workloads keep reading from the control plane after the deploy. Define how you gate rollouts and how you detect control-plane-wide impact before it becomes a platform-wide outage.

---

## Building Blocks Available

| Component | What it does | Latency / Consistency Notes |
|---|---|---|
| Cloud Spanner | GCP-managed globally distributed SQL; strongly consistent; horizontal scale | Writes: ~10ms regional, ~100ms+ globally; Reads: ~5-10ms with read staleness allowed |
| Cloud Bigtable | GCP wide-column store; very low latency reads; no SQL joins; good for key-value at scale | Read p99: ~1-3ms in-region; good for hot-path lookups |
| Cloud Firestore | GCP document store; strong consistency per document; good for low-volume config reads | Read p99: ~5-15ms; not suited for high-QPS hot path |
| Cloud Memorystore (Redis) | Managed Redis in GCP; sub-millisecond reads; in-memory; data loss on failure without persistence | Read p99: under 1ms in-region; use as cache layer, not primary store |
| DynamoDB Global Tables | AWS multi-region NoSQL; active-active replication; eventual consistency across regions | Cross-region replication: typically under 1s; reads from local region: ~5ms |
| ElastiCache (Redis) | Managed Redis in AWS; same sub-millisecond properties as Memorystore | Read p99: under 1ms in-region; use as cache layer |
| gRPC | High-performance RPC framework; supports streaming, deadlines, retries, health checking | Adds ~0.5-2ms over TCP in-region; important for deadline propagation |
| Envoy / Service Mesh | Proxy layer for service-to-service traffic; handles retries, circuit breaking, mTLS, observability | Adds ~0.5-1ms per hop; necessary for mutual TLS between clouds |
| Cloud Interconnect / AWS Direct Connect | Dedicated private network links between on-prem or cloud environments | Reduces cross-cloud latency vs public internet; requires setup |
| Cloud VPN / AWS VPN | Encrypted tunnel over internet between VPCs; higher latency than Interconnect | Round-trip latency: typically 30-60ms between GCP and AWS regions |
| Cloud Armor / AWS WAF | Edge protection — less relevant for internal control plane unless you have a public API endpoint | |
| Binary Authorization / OPA | Policy enforcement for deployments; critical for control-plane rollout safety | |
| Cloud Monitoring + AWS CloudWatch | Metrics and alerting; critical for detecting control-plane latency degradation | |
| OpenTelemetry | Vendor-neutral tracing/metrics instrumentation; works across GCP and AWS | |
| Raft / etcd | Distributed consensus algorithm; used internally by Kubernetes and other systems; not a managed service but useful to understand for consistency reasoning | |

---

## Beginner Starter Skeleton

This is roughly 30-40% of a complete answer. Every section needs expansion.

### Assumptions I Would Clarify First

- Consumers are internal workloads on GCP and AWS that read control-plane metadata periodically (e.g., every 30s) and at startup
- p99 read latency target: 10ms from within either cloud (this forces local caching)
- Write latency is less critical — writes come from operators and automation, not from hot request paths
- Correctness requirement: a policy update must reach all workloads within 60 seconds (eventual consistency with bounded staleness)
- The system must fail closed for security policy reads (prefer rejecting a request over applying stale security policy)
- Rollout must be staged: changes deployed to one region before the other, with automatic rollback gates

### Control Plane vs Data Plane Separation

Control plane responsibilities (this system):
- Stores and serves metadata, policies, and configuration to consuming workloads
- Authoritative for what workloads are allowed to do
- Low write rate, high read rate
- Must be strongly consistent for writes; can tolerate bounded read staleness

Data plane (consuming workloads, NOT this system):
- Does the actual compute work (serving user traffic, processing jobs)
- Reads from control plane at startup and periodically
- Should cache control-plane responses locally to avoid blocking on control-plane availability

### Latency Budget Sketch

```
Target: p99 < 10ms from EKS pod in us-east-1

Budget breakdown:
  Network (pod to local cache): ~0.1ms
  Local cache (Redis/ElastiCache) read: ~0.5ms
  Cache hit: total ~1ms [ACCEPTABLE]

  Cache miss path:
  Network (pod to local control-plane replica): ~2ms
  Control-plane service processing: ~2ms
  Local read replica read: ~3ms
  Total ~7ms [ACCEPTABLE if replica is in same region]

  Cache miss with cross-cloud read (fallback only):
  Network (us-east-1 to us-central1): ~25ms
  [NOT on hot path - only for write propagation]
```

### Stateful Core Choice

Starting recommendation: Cloud Spanner (primary region) + read replicas (secondary GCP region) + DynamoDB Global Tables replication (for AWS-region reads).

Rationale:
- Spanner gives strong consistency for writes
- Read replicas give low-latency reads in the primary cloud
- DynamoDB Global Tables replication (via an async bridge) gives AWS consumers a local read path
- Redis/ElastiCache in each cloud is the hot-path cache layer

### What I Have Not Designed Yet (expand these)

- The async replication bridge between Spanner and DynamoDB and its consistency guarantees
- Cache invalidation strategy when a policy changes
- Exact failure response per failure type (close vs open vs degrade)
- Rollout gating and automatic rollback mechanism
- Cross-cloud mTLS and identity model

---

## Tasks

Complete all of the following. This lab requires you to make and defend architectural tradeoffs, not just list components.

1. **Control-plane vs data-plane responsibilities** — Define what this control plane does, what it explicitly does NOT do, and what the interface contract is between the control plane and its consumers. If consumers cache responses, how does the control plane signal that a cached value is stale?

2. **Request path and latency budget** — Build a complete latency budget for a read request from a workload in GCP us-central1, and separately for a workload in AWS us-east-1. Show each hop. Identify where the budget gets tight and what design decisions reduce p99.

3. **Consistency model** — What consistency level do your consumers need? Can they tolerate bounded staleness? If so, what is the acceptable staleness window? How does your stateful core's consistency model map to those requirements? What happens if a policy is updated but the consumer reads a stale cached copy?

4. **Cache strategy** — Describe your caching architecture. Where does a cache sit (consumer-side, control-plane-side, or both)? What is the TTL? How do you handle invalidation when the authoritative state changes? How do you handle a cold start (no cached data)?

5. **Regional placement** — Where do you place the write-primary? Where do you place read replicas? Where do you place caches? Draw the data flow for a write (operator changes a policy) and for a read (workload fetches current policy).

6. **Failure mode handling** — For each of the following, describe the system behavior and whether it fails closed, open, or degrades: (a) single AZ loss in GCP primary region, (b) GCP primary region unavailable, (c) inter-cloud network partition (GCP and AWS cannot reach each other), (d) control-plane database (Spanner) write path unavailable.

7. **Observability and alerting** — What metrics do you instrument? What are your SLO definitions for this service? What is the first alert an on-call engineer receives, and what do they look at first?

8. **Delivery and policy controls** — Why is rollout safety harder for a control plane than for a stateless API? What is your canary/staged rollout mechanism? What automatic rollback triggers would you define?

---

## What a Beginner Answer Looks Like

- Understands the control plane vs data plane separation conceptually
- Names an appropriate storage backend (Spanner or DynamoDB)
- Knows that caching is needed for latency
- Can describe a basic multi-region deployment
- May not have a latency budget with actual numbers
- Likely missing: consistency model reasoning, failure-mode analysis, cache invalidation strategy, rollout blast radius for a control plane

## What an Intermediate Answer Looks Like

- Has a concrete latency budget with per-hop numbers
- Names the stateful core early and explains its consistency properties
- Understands that cross-cloud latency forces local read replicas or caches
- Can distinguish between fail-closed and fail-open and knows when each is appropriate for a control plane
- Addresses cache invalidation (TTL vs push-based notification)
- Knows that a control-plane rollout has higher blast radius than a stateless service rollout
- Missing: Spanner vs DynamoDB Global Tables comparison for this use case, bounded staleness configuration, OpenTelemetry cross-cloud tracing, the async replication bridge design

## What a Strong Answer Looks Like

- Opens by naming the stateful core and its consistency guarantees before discussing anything else
- Latency budget is specific and shows where the 10ms p99 breaks if you remove any cache layer
- Consistency model is explicit: strong writes, bounded-staleness reads, with specific staleness window chosen based on the use case (security policy vs non-critical config)
- Fail-closed vs fail-open is reasoned per data type: security policy reads fail closed; non-critical config reads can degrade with stale data
- Cache invalidation strategy: explains why short TTL alone is not enough for security-critical data and why push-based invalidation (control plane notifies consumers via a side channel) is necessary for the tightest cases
- Rollout: explains that control planes need schema-level backwards compatibility gating, not just traffic-level canary, because consumers keep reading from the control plane after deploy
- Cross-cloud identity: mTLS between GCP workloads calling the control plane and AWS workloads calling the control plane; explains how each cloud's workload identity (Workload Identity, IRSA) authenticates to the control-plane service
- Degrade-in-place vs failover: argues that for most control-plane failures, serving stale data from cache is safer than failing over the entire write path to a secondary region, and explains the exception cases

---

## Interviewer Pressure Questions

- What stays cloud-specific on purpose? Why would you not make this design perfectly symmetric across GCP and AWS?
- What happens if one cloud is partially degraded — say, GCP us-central1 has 30% packet loss but is not fully down? How does your system behave?
- When do you fail over versus degrade in place? What is the concrete trigger for each?
- What is the stateful core and how do you protect it from a bad deploy?
- A policy changes. How long until every workload in both clouds has seen the new policy? How do you know?
- Your p99 is 8ms normally. After a deploy, it becomes 35ms. What is your detection and response path?
- Why not just use a single globally distributed store (like Spanner with global reads) and skip the cross-cloud replication complexity?
- An AWS workload is calling your control plane in GCP. It needs to authenticate. How does it prove its identity? What does the control plane verify?
- Describe the difference between bounded staleness and eventual consistency. Which does your design use and why?
- A control-plane bug causes all consumers to receive incorrect policy for 90 seconds before the rollback completes. Write the incident timeline.

---

## Deliverable Guidance

Your final answer should contain:

**Architecture sketch** showing:
- Write path: operator -> control-plane primary (GCP) -> Spanner -> async replication -> DynamoDB (AWS)
- Read path from GCP workload: local Redis cache or Spanner read replica
- Read path from AWS workload: local ElastiCache or DynamoDB local read
- Cache invalidation signal path
- Inter-cloud connection (VPN or Interconnect) and where it sits in the latency budget

**Latency budget table** with columns:
- Consumer location
- Request type (cache hit / cache miss / cross-cloud fallback)
- Per-hop breakdown
- Total p50 and p99 estimate

**Failure-domain table** with columns:
- Failure scenario
- System behavior (fail closed / fail open / degrade)
- Recovery mechanism
- Data risk (potential for stale data, data loss, or incorrect policy)

---

## What to Study Next

After completing this lab:
- Labs 1-3 assumed stateless API serving; this lab is where distributed systems depth matters
- Deep dives: Cloud Spanner read staleness configuration and bounded staleness vs strong reads; DynamoDB Global Tables replication topology; gRPC deadline propagation and how it prevents latency from cascading; Redis cache stampede prevention techniques (probabilistic early expiration, lock-on-miss)
- Distributed systems reading: "Designing Data-Intensive Applications" by Martin Kleppmann — chapters on replication, consistency, and distributed transactions are directly relevant
- Production references: How Kubernetes etcd achieves consistency and why it is the control-plane bottleneck; how Istio/Envoy distribute xDS control-plane config to all proxies at scale
- Interview preparation: Be able to draw the write path and read path separately, name the consistency model at each layer, and explain the failure response for at least three failure scenarios without prompting
