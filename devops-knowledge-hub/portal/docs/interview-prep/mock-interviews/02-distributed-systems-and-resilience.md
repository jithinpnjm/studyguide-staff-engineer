---
title: "Mock Interview 2: Distributed Systems, HA, Low Latency, and Resilience"
sidebar_position: 2
---

# Mock Interview 2: Distributed Systems, HA, Low Latency, and Resilience

## Format and Intent

This is a 60-minute system design interview with SRE depth. Unlike a pure design interview, the interviewer here expects you to lead with failure modes, not feature enthusiasm. Every design decision should be accompanied by an explicit tradeoff: what does this buy you, what does it cost, what breaks first if the assumption changes?

The questions are open-ended by design. A strong candidate narrows them with requirements before drawing boxes. A weak candidate draws boxes immediately and adds requirements as an afterthought.

**Suggested timing per question:** 6–8 minutes for design questions, 3–4 minutes for conceptual questions.

Practice this out loud. The difference between a well-structured verbal answer and an unstructured one is stark on distributed systems questions.

---

## Question 1

**"Design a low-latency control-plane API used by many internal services across zones."**

**Time guidance:** 7–8 minutes. Start with requirements before any architecture.

**What a strong answer covers:**
- Opens with clarifying questions: what is the latency target (P99)? What are the consistency requirements — can callers tolerate stale reads? What is the write rate? How many internal callers?
- Proposes a design with a local read path (per-zone caching or read replicas) to avoid cross-zone latency on the critical read path.
- Names the consistency model explicitly: eventual for reads, strong for writes to a primary, with bounded staleness for caches.
- Discusses leader election or primary routing (etcd, Raft, or external coordinator) for write coordination.
- Includes a client-side retry strategy with exponential backoff and jitter, plus circuit breakers to prevent cascade when the control plane is degraded.

**What a weak answer looks like:**
- Immediately proposes "a REST API behind a load balancer with a database." No latency reasoning, no zone topology consideration.
- Does not address what happens when the API is slow or partially available.

**Sample answer skeleton:**
> "Before I design anything: what is the P99 latency target and is it for reads or writes? Are callers tolerant of bounded staleness, say 1 second? Is this read-heavy? Assuming read-heavy with strong-write, I'd put a replicated in-memory store (like a per-zone Redis cluster or a distributed cache) in front of a strongly-consistent write log. Reads hit the local zone replica. Writes go to the primary and replicate asynchronously. Cache invalidation is event-driven via a change stream. For the unavailability case: callers get a circuit breaker that returns last-known-good data after N failures, so the control plane being slow doesn't immediately take down callers. I'd set SLOs on the read P99 per zone separately from write latency."

---

## Question 2

**"How would you detect and survive overload caused by a successful product launch?"**

**Time guidance:** 6 minutes. Detection and survival are both required — do not cover only one.

**What a strong answer covers:**
- Detection: leading indicators before service impact — queue depth, request rate acceleration, error rate on backends even while frontend appears healthy, saturation metrics approaching capacity.
- Survival mechanisms: load shedding (drop lowest-priority traffic before saturation), backpressure propagation (upstream callers are told to slow down), horizontal auto-scaling pre-warmed before the event.
- Pre-event preparation: load test to establish capacity baselines; set traffic targets and have runbooks for staged scale-out; coordinate with capacity team on quota pre-provisioning.
- During event: feature flags to disable expensive operations (e.g., turn off heavy analytics endpoints), graceful degradation of non-essential features.
- Post-event: review which capacity signals fired first and adjust alerting thresholds.

**What a weak answer looks like:**
- "We would scale up." No detection signals named, no priority traffic shedding, no pre-event strategy.
- Does not distinguish detection (knowing overload is coming) from survival (protecting the service once it arrives).

**Sample answer skeleton:**
> "Detection comes first. I'd instrument request rate acceleration with a derivative metric — if req/s is growing at 20% per minute, that is a leading indicator before error rate spikes. I'd also watch queue depth and backend saturation metrics. For survival: load shedding at the ingress layer (drop or 503 non-critical traffic classes by authenticated tier), with priority lanes for core flows like checkout or auth. Auto-scaling should be pre-warmed, not reactive — for a known launch we'd scale to estimated peak minus 20% in advance and set the auto-scaler ceiling above. During the event, feature flags disable expensive non-essential paths. The key is: shedding and degradation preserve the core service when capacity math doesn't work out."

---

## Question 3

**"What are the biggest causes of tail latency in distributed systems?"**

**Time guidance:** 4–5 minutes. Be specific and mechanistic, not just categorical.

**What a strong answer covers:**
- Queuing delay: even a lightly loaded system with high variance in request service time produces a long tail. Little's Law applies — queue depth times service time equals latency.
- GC pauses (JVM or Go): stop-the-world GC pauses of 10–100ms create P99 spikes that are invisible to CPU metrics.
- Head-of-line blocking: a slow request at the front of a connection's queue delays all requests behind it (relevant in HTTP/1.1, and partially in HTTP/2 with many streams).
- Fan-out amplification: a request that fans out to N backends has a latency of max(backend latencies), not average — the tail of the ensemble grows with N.
- Stragglers: in large fan-out architectures, one slow node defines the response time. Hedged requests (send a duplicate after a short delay, cancel when first response arrives) reduce this.

**What a weak answer looks like:**
- "Network latency and slow databases." Not wrong, but does not engage with the distribution mechanics.
- Cannot explain why P99 is disproportionately worse than P50 in a fan-out system.

**Sample answer skeleton:**
> "The most underappreciated cause is fan-out amplification. If a request fans out to 100 shards, the total latency is the maximum across 100 distributions. Even if each shard has a P99 of 10ms, the chance that at least one shard takes 10ms on a given request is near-certain. With 100 shards, your effective P99 is roughly the P99.99 of a single shard. The mitigation is hedged requests with a short speculative delay. Beyond that: GC pauses in managed runtimes create P99 spikes that are hard to attribute, queuing delay increases non-linearly as utilization approaches 100%, and TCP head-of-line blocking on shared connections concentrates slow requests."

---

## Question 4

**"Compare active-active and active-passive for a service with strict availability goals."**

**Time guidance:** 5 minutes. Frame this as a tradeoff, not a recommendation.

**What a strong answer covers:**
- Active-active: all nodes serve traffic simultaneously. Failover is instant because no promotion is needed. Requires that writes be either conflict-free (CRDT, last-write-wins with causal ordering) or routed to the same primary by key.
- Active-passive: one node is primary, standby is promoted on failure. Failover takes time (detection + promotion + DNS/LB update). Simpler consistency model. Risk of split-brain if the primary is slow but not dead.
- Strict availability goal pushes toward active-active to eliminate failover time. But active-active requires harder consistency engineering.
- Practical hybrid: active-active for reads (strong availability, tolerates node loss), active-passive for writes (simpler consistency, accept brief write unavailability on failover).
- Split-brain risk in active-passive: use fencing tokens or STONITH to guarantee the old primary cannot accept writes after promotion.

**What a weak answer looks like:**
- "Active-active is better because it has no single point of failure." Does not address the consistency complexity or split-brain risk.

**Sample answer skeleton:**
> "The tradeoff is consistency complexity versus failover time. Active-passive is operationally simpler — one primary, one standby, clear write path — but failover takes time: detection is 10–30 seconds, promotion adds more. For a service with a 99.99% availability SLO, that failover time may burn through the annual error budget in one incident. Active-active eliminates failover time but requires you to reason about concurrent writes. If the service is read-heavy, active-active reads with active-passive writes is a practical middle ground. The risk I'd highlight is split-brain in active-passive: if the primary is network-partitioned but not dead, you need a reliable fencing mechanism before the standby accepts writes."

---

## Question 5

**"When do retries help, and when do they make the incident worse?"**

**Time guidance:** 4 minutes. Think about retry storms, idempotency, and amplification.

**What a strong answer covers:**
- Retries help when the error is transient: a momentary network glitch, a pod restart, a connection pool blip. The success rate on the second attempt is high.
- Retries hurt when the service is overloaded: each failed request that retries adds load to an already-struggling service. At 3x retry multiplier, a service at 80% capacity receives 240% load.
- Retry amplification compounds through a call graph: if A retries B and B retries C, a single user request becomes 9 requests at layer C.
- Mitigations: exponential backoff with jitter (spreads retry load over time), retry budget (limit retries to N% of total requests per time window), idempotency keys (so the service can deduplicate retried writes).
- Non-idempotent operations should not be retried without idempotency keys — retrying a payment or an order creation causes double-execution.

**What a weak answer looks like:**
- "Retries help with transient errors. Use exponential backoff." Correct but shallow — no amplification math, no idempotency discussion.

**Sample answer skeleton:**
> "Retries work against transient, low-rate errors — a SYN timeout, a single bad pod. They fail catastrophically under partial overload. If a service is at 70% capacity and experiencing 10% errors, and every caller retries once, the effective load becomes 110%+ of capacity, pushing the error rate higher, causing more retries. This is a retry storm. The fix is a retry budget at the RPC layer — say, allow retries for at most 10% of total requests in a 10-second window. Beyond that, the caller returns an error rather than amplifying. Exponential backoff with jitter reduces synchronization effects. And for writes: any operation that is not idempotent needs an idempotency key sent by the client so the server can deduplicate retried requests."

---

## Question 6

**"How do you design observability for a system where the tracing backend itself can fail?"**

**Time guidance:** 5 minutes. This is about resilience of the observability plane, not just its design.

**What a strong answer covers:**
- Head-based vs. tail-based sampling: head-based sampling decisions are made at trace start, so traces are not lost if the backend is slow (sampled data is just not collected). Tail-based requires buffering until the trace is complete.
- Local buffering and async export: the tracing SDK should buffer spans locally and export asynchronously so that a slow or unavailable tracing backend does not block the application request path.
- Sampling under pressure: when the collector is degraded, reduce the sample rate rather than blocking. This preserves application performance at the cost of trace completeness.
- Metrics as a fallback: structured logs and RED metrics (Rate, Error, Duration) per service should be independently available even when distributed traces are lost, so that incident diagnosis does not require traces.
- Backpressure from the collector: the application SDK should apply a circuit breaker or drop spans rather than queueing indefinitely.

**What a weak answer looks like:**
- "Use a reliable tracing backend like Jaeger." Does not address what happens when the backend is unavailable.

**Sample answer skeleton:**
> "The principle is: observability infrastructure must not be in the critical path of the application. Tracing is asynchronous — spans are batched and exported out-of-band. The SDK buffers locally, drops spans if the buffer fills, and uses a circuit breaker against the collector endpoint. If the tracing backend is down, the application continues serving requests; we lose trace data but not availability. The fallback is RED metrics and structured logs, which should be collected independently via a different pipeline. I'd also tail-based-sample only critical traces and head-sample the rest to reduce collector load. During a collector outage, I'd reduce the global sample rate to near-zero to eliminate export pressure."

---

## Question 7

**"How would you choose between queueing, shedding, and backpressure?"**

**Time guidance:** 5 minutes. These are three fundamentally different flow control mechanisms — compare them with intent.

**What a strong answer covers:**
- Queueing: absorbs short bursts, allows smooth throughput. Fails when the burst lasts longer than the queue drain time — queue depth grows unbounded, latency grows unbounded, and eventually memory is exhausted. Queuing is a latency amplifier for sustained overload.
- Load shedding: reject requests when at or near capacity. Latency stays low for accepted requests. The user experience degrades (errors) but the service stays alive. Best when some requests are lower priority than others.
- Backpressure: the overloaded service signals its callers to slow down. This requires a cooperative protocol (rate limiting headers, TCP flow control, async acknowledgment). It prevents the overload from occurring in the first place.
- Choosing: backpressure is best when callers can slow down safely (async pipelines, batch jobs). Shedding is best when caller latency budget is tight and there is a priority ordering. Queueing is best for genuine bursts that are short relative to service time.

**What a weak answer looks like:**
- "Use a queue to handle traffic spikes." Does not address when queuing makes things worse or how backpressure works.

**Sample answer skeleton:**
> "They solve different problems. Queueing smooths burst traffic but trades latency for throughput — during sustained overload, the queue fills and latency grows without bound. I use queueing only when the overload is transient and I can bound queue depth with a timeout. Shedding is preferable when I need to protect the service at the cost of some requests: reject at the edge, preserve the core. This requires a priority classification. Backpressure is the cleanest solution when the protocol supports it — the overloaded component signals upstream to slow production. In a Kafka pipeline, consumer lag is implicit backpressure. In a gRPC service, I can return RESOURCE_EXHAUSTED and the client should back off. The danger of queueing is the illusion of resilience — the queue is growing, the service looks 'up', but latency is already unacceptable."

---

## Question 8

**"Explain a safe failover decision when data consistency is uncertain."**

**Time guidance:** 5 minutes. Focus on the decision process, not just the mechanism.

**What a strong answer covers:**
- Acknowledges the CAP tradeoff explicitly: if you cannot confirm the standby is consistent with the primary, promoting it trades availability for potential data loss or divergence.
- Fencing: before promoting the standby, attempt to fence the primary — revoke its access credentials, remove it from the LB, or break its storage connection — to prevent split-brain writes.
- Observation window: wait for the standby's replication lag metric to reach zero (if possible) before promoting. If it cannot reach zero (primary is unreachable), make a conscious decision with documented acceptance of potential data divergence up to the last known replication position.
- Rollback criteria: define in advance what state of the primary's data would require reconciliation after failover. Automate detection of divergent writes.
- Human-in-the-loop for uncertain states: fully automated failover is safe only when the system can definitively determine replication state. Under uncertainty, alert a human before promoting.

**What a weak answer looks like:**
- "Promote the standby and reconcile later." Does not address fencing, divergence scope, or the decision process.

**Sample answer skeleton:**
> "The first action is not promotion — it is fencing. I need to guarantee the old primary cannot accept writes while the standby is promoted, or I get divergent state that is very hard to reconcile. If the primary is unreachable (not just slow), I revoke its database credentials or remove its storage mount via the control plane before promoting the standby. Then I check replication lag on the standby: how many bytes or transactions are missing? I document that number, note the time, and accept that those transactions are potentially lost. After promotion I compare primary transaction logs (if the primary recovers) against the standby's committed state to detect divergence. Automated failover only executes if replication lag is below a threshold; above that threshold, a human approves."

---

## Question 9

**"How would you define SLOs for a control-plane service used by CI/CD systems?"**

**Time guidance:** 4–5 minutes. SLOs require a user perspective, not just metrics.

**What a strong answer covers:**
- Identifies the user of the SLO: CI/CD systems care about job success rate and job start latency, not raw API latency — the SLO should reflect the user's experience.
- Distinguishes availability SLOs (proportion of requests that succeed) from latency SLOs (proportion under a threshold).
- Sets a meaningful latency threshold: for a control plane that schedules CI jobs, P95 < 500ms might be the SLO; above that, job start times degrade noticeably.
- Defines a burn rate alert: an SLO without alerting is a metric, not an operational commitment.
- Considers SLO windows and reset: a 28-day rolling window is common; the error budget resets at the window boundary.
- Excludes known planned maintenance from SLO calculations explicitly.

**What a weak answer looks like:**
- "99.9% availability." No user framing, no latency SLO, no burn rate, no error budget.

**Sample answer skeleton:**
> "I start by asking: what does a CI/CD system care about? It cares that job submissions succeed and that jobs start within a predictable time. So my SLOs would be: (1) 99.9% of job submission API calls succeed, measured as non-5xx responses over a 28-day rolling window; (2) 95% of job-start-to-first-event latency is under 2 seconds. The second SLO reflects user experience more than raw API latency. I'd set a fast burn rate alert: if we consume 5% of our monthly error budget in any 1-hour window, page immediately. I'd also define a slow burn alert: 10% of budget consumed in 6 hours, ticket created. Error budget resets monthly. Planned maintenance windows are excluded from SLO calculation if communicated 48 hours in advance."

---

## Question 10

**"What would you test in a game day before trusting this design?"**

**Time guidance:** 5 minutes. Be specific about failure injection, not just "chaos engineering."

**What a strong answer covers:**
- Zone loss: kill all nodes in one AZ and verify that read latency stays within SLO, write availability degrades gracefully, and auto-recovery completes within the recovery time objective.
- Dependency degradation: introduce 200ms latency to the database or upstream service and verify that circuit breakers fire before the control plane's own latency SLO is breached.
- Leader failure: kill the write-primary node and measure the time to election completion and the first successful write on the new primary.
- Overload injection: ramp request rate to 150% of capacity and verify that load shedding activates, priority traffic is preserved, and the service recovers cleanly when load drops.
- Observability: verify that alerts fire within the expected detection window during each failure scenario, and that runbooks correctly describe the observed symptoms.

**What a weak answer looks like:**
- "We'd do a game day and test various failure scenarios." No specific tests, no success criteria, no detection verification.

**Sample answer skeleton:**
> "I'd structure the game day around four failure types. First: AZ loss — drain all nodes in zone-b and verify that the service continues with degraded capacity, latency stays within SLO on the surviving zones, and the auto-scaler compensates within 5 minutes. Second: dependency slowdown — inject 500ms artificial latency on the database connection and verify that the circuit breaker opens before our P99 SLO is breached. Third: primary failure — kill the write leader and measure time-to-first-write on the elected successor. My acceptance criterion is under 30 seconds. Fourth: overload — ramp to 200% of traffic and verify load shedding fires, core flows stay available, and the service recovers cleanly when load drops. After each test, I verify that the alert fired within the expected detection window."

---

## Pressure Follow-Up Questions

These are typically asked mid-answer to test depth. Prepare a 60-second response to each:

- **"What breaks first if one zone is lost?"** — Name the component (write primary, stateful service, cache) and the blast radius on latency and availability.
- **"What breaks first if latency doubles but capacity stays the same?"** — Queueing model: service time doubles, queue depth grows, effective throughput drops. What saturates first?
- **"What breaks first if a dependency returns partial success?"** — Which callers tolerate partial responses? Which ones fail open vs. fail closed?
- **"What gets rolled back and what does not?"** — Stateless config changes roll back easily. Migrated data schemas, consumed Kafka offsets, and written records do not. Name your rollback boundary.

---

## Scoring Rubric

| Level | Indicators |
|-------|-----------|
| Strong | States requirements and constraints before drawing architecture. Names failure modes before naming features. Uses specific numbers (latency targets, retry budgets, error budget percentages). Identifies the consistency model explicitly. Addresses rollback and recovery. |
| Medium | Design is generally correct but generic. Failure modes are named but not quantified. Does not address consistency model or SLO structure. Architecture is boxes-and-arrows without operational depth. |
| Weak | Jumps to architecture immediately without requirements. Does not address what happens when a component fails. Cannot explain the tradeoffs between design alternatives. Treats availability as binary. |

---

## Self-Debrief Template

After each practice run, write one sentence per item:

1. Did you state requirements before drawing any architecture on Q1?
2. Which question did you cover only the happy path on?
3. Did you quantify at least one decision (latency target, retry budget, error rate threshold)?
4. Where did you use vague terms like "resilient" or "scalable" without defining them?
5. Which failure mode in your design did you not have a good answer for?
6. What is one concept (fan-out amplification, backpressure, SLO burn rate) you should reread before the next run?
