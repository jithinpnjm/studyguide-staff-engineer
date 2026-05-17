---
title: "System Design for Nebius — Distributed GPU Infrastructure"
sidebar_position: 4
---

# System Design for Nebius — Distributed GPU Infrastructure

> Nebius's system design stage tests whether you can design infrastructure that fails gracefully, recovers automatically, and scales to hyperscale. This is not FAANG-style "design Twitter" — it is infrastructure design for AI workloads.

---

## Mental Model for System Design at Nebius

Three principles drive every good answer:

1. **Design for failure, not for success.** Every component will fail. The question is whether your system detects it, isolates it, and recovers from it automatically — without human intervention.

2. **Estimate, then design.** A design without numbers is a guess. How many GPUs? What throughput? What latency SLO? Numbers force you to justify your architecture choices.

3. **Observability is not an afterthought.** Instrument everything from day one. You cannot fix what you cannot see, and at Nebius scale, silent failures are the most dangerous kind.

---

## How to Run a System Design Interview (The Framework)

### Step 1 — Clarify Requirements (5 minutes)
Never start drawing before you ask:
- **Scale:** How many GPUs in the cluster? How many concurrent training jobs? What is peak throughput?
- **Reliability:** What is the SLO? 99.9% = 8.7 hours/year downtime. 99.99% = 52 minutes.
- **Latency:** What is the acceptable MTTR for a GPU node failure?
- **Consistency vs availability:** Can a training job tolerate a brief interruption if it can checkpoint and resume?
- **Scope:** Design the whole system or a specific component?

### Step 2 — Capacity Estimation (5 minutes)
Make rough estimates before designing:
- Write down key numbers: nodes, GPUs per node, network bandwidth, storage throughput
- Back-of-envelope: "If we have 1,000 nodes × 8 GPUs = 8,000 GPUs. At 80% utilization, ~6,400 active GPUs."
- Estimate storage: "A 70B model at BF16 = 140GB. With 100 concurrent inference replicas = 14TB hot storage."

### Step 3 — High-Level Architecture (10 minutes)
Draw the major components and data flows. Be explicit about:
- Control plane vs data plane
- Synchronous vs asynchronous paths
- Where state lives (and what happens if that state is lost)

### Step 4 — Deep Dive (20 minutes)
Interviewer will pick 1–2 areas to go deep. Be ready for:
- "How does the health monitoring work exactly?"
- "What happens if the replacement node fails too?"
- "How do you handle a partial cluster failure?"

### Step 5 — Tradeoffs and Failure Scenarios (5 minutes)
Close with:
- What are the known weaknesses of your design?
- What would you do differently with more time?
- What could cause your system to fail in ways you haven't addressed?

---

## Design 1: Fault-Tolerant GPU Training Cluster

**Prompt:** "Design a system that can run large-scale distributed AI training workloads with high reliability and fast recovery from hardware failures."

This is the most Nebius-relevant system design. Their engineering blog describes exactly this — use it as your reference architecture.

### Clarifying Questions to Ask
- "What cluster size are we targeting? 1,000 nodes? 10,000?"
- "What is the target MTTR for a single GPU node failure?"
- "Should training jobs auto-resume from checkpoint or require manual restart?"
- "Do we need multi-tenant support (multiple users sharing the cluster)?"
- "What is the acceptable overhead of health monitoring on training throughput?"

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Management Plane                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Kubernetes  │  │   Soperator  │  │  Health Controller   │  │
│  │  API Server  │  │  (Slurm CRD) │  │  (Node Lifecycle)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
└─────────┼─────────────────┼──────────────────────┼─────────────┘
          │                 │                      │
┌─────────▼─────────────────▼──────────────────────▼─────────────┐
│                    Compute Plane                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Node Pool (Production)              Node Pool (Buffer)   │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐        ┌──────┐ ┌──────┐    │  │
│  │  │Node 1│ │Node 2│ │Node 3│  ...   │Node N│ │Node M│    │  │
│  │  │8xH100│ │8xH100│ │8xH100│        │8xH100│ │8xH100│    │  │
│  │  └──────┘ └──────┘ └──────┘        └──────┘ └──────┘    │  │
│  │  DCGM agents on every node    Pre-tested, pre-provisioned │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               InfiniBand Fabric (Fat Tree)                 │  │
│  │  Non-blocking 800 Gbps between any two nodes              │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
          │
┌─────────▼─────────────────────────────────────────────────────┐
│                   Observability Plane                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Prometheus  │  │   Grafana    │  │      Alertmanager    │  │
│  │  + DCGM exp  │  │  Dashboards  │  │  PagerDuty / Slack   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### The Health Monitoring Pipeline (Core Component)

```
DCGM Agent (on each node)
    │ scrapes every 10s
    │ ECC errors, XID codes, temperature, NVLink BW, IB counters
    ▼
Prometheus (cluster-wide)
    │ stores time-series
    │ evaluates alert rules
    ▼
Alertmanager
    │ deduplication, routing, inhibition
    ▼
Health Controller (custom Kubernetes operator)
    │ receives alert
    │ evaluates severity
    ├─ WARN (SBE errors): flag node, schedule next maintenance window
    └─ CRITICAL (DBE error, XID 48/61): immediately taint + drain
            │
            ▼
    Node Replacement Operator
            │ selects pre-provisioned spare from buffer pool
            │ joins spare to cluster
            │ marks failed node for diagnostics
            └─ ~12 minutes total
```

**Buffer pool sizing calculation:**
- At 1,000 nodes: GPU hardware failure rate ≈ 0.5% per day = 5 failures/day
- Each replacement takes 12 minutes, requires 1 spare
- At peak failure rate: need ~2 spares available simultaneously
- Add safety margin: maintain 2–3% buffer = 20–30 spare nodes for 1,000-node cluster

**Interview follow-up: "What if the buffer pool is exhausted?"**
- Alert on buffer pool depth < threshold (e.g., < 5 spares)
- Failed node replacement falls back to: drain job, schedule on next available production node after others complete
- Degrade gracefully: accept longer MTTR rather than over-provision buffer

### Checkpoint and Recovery Strategy

```
Training Job Lifecycle:
─────────────────────────────────────────────────────────────────
normal run ──────────────────────────────────────────────────────►
                 checkpoint      checkpoint
                    │               │
             ───────▼───────────────▼─────────────────────────────
                 /checkpoint/step-1000   /checkpoint/step-2000

hardware fault detected at step 2500:
1. Health controller taints node
2. Job coordinator receives SIGTERM
3. Job saves emergency checkpoint at step 2500
4. Job exits cleanly
5. Replacement node is provisioned (runs in parallel with step 3-4)
6. Scheduler submits job with --resume /checkpoint/step-2500
7. Training continues with no data loss
─────────────────────────────────────────────────────────────────
```

**Checkpoint storage design:**
- Use distributed filesystem (WEKA/VAST) with multi-AZ replication
- Checkpoint write is not on the critical path — use async write, job continues computing
- Keep last N checkpoints, rotate old ones (save storage)
- Pre-validate checkpoint integrity: save checksum, verify on load

### SLO Definition for the Training Platform

| SLO | Target | Measurement |
|-----|--------|-------------|
| Node MTTR (hardware failure → replacement ready) | ≤ 15 minutes | P99 replacement time |
| Training job resumption time (from checkpoint) | ≤ 5 minutes | P95 job restart time |
| Job completion rate (fraction of submitted jobs that complete without manual intervention) | ≥ 99.5% | 30-day rolling |
| Cluster GPU utilization | ≥ 80% | Daily average |
| Health monitoring detection latency | ≤ 30 seconds | P95 ECC→alert time |

---

## Design 2: LLM Inference Platform at Scale

**Prompt:** "Design an inference platform that can serve multiple large language models with 99.9% uptime, sub-second latency, and cost-efficient GPU utilization."

### Capacity Estimation
- Target: 100K requests/day peak = ~1,200 requests/minute peak
- Model: Llama-3 70B, FP16 = 140GB, needs 2× H100 80GB per replica
- Prefill latency for 1K token prompt: ~500ms on 2× H100
- Decode throughput: ~50 tokens/second per replica
- Average response: 200 output tokens = 4 seconds of decode
- RPS per replica: ~15 concurrent requests with batching
- Replicas needed: 1,200 / 15 = 80 replicas → 160 H100 GPUs for 70B model

### Component Architecture

```
                    ┌─────────────────────┐
                    │   API Gateway        │
                    │   (rate limiting,    │
                    │   auth, routing)     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Router / Scheduler  │
                    │  (KV-cache aware)    │
                    │  prefix hash → node  │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐      ┌──────▼──────┐     ┌──────▼──────┐
   │  vLLM Pod   │      │  vLLM Pod   │     │  vLLM Pod   │
   │  (2× H100)  │      │  (2× H100)  │     │  (2× H100)  │
   │  Llama-3 70B│      │  Llama-3 70B│     │  Llama-3 70B│
   │  + KV cache │      │  + KV cache │      │  + KV cache │
   └─────────────┘      └─────────────┘     └─────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Model Registry     │
                    │   (weights storage)  │
                    │   WEKA filesystem    │
                    └─────────────────────┘
```

### KV-Cache Aware Routing (Critical Differentiator)

```python
# Pseudocode for KV-cache aware router
def route_request(request: InferenceRequest) -> str:
    # Extract the system prompt + first N tokens as the "prefix"
    prefix = extract_prefix(request.messages, max_tokens=512)
    prefix_hash = sha256(prefix)
    
    # Find a replica that has this prefix cached
    for replica in get_healthy_replicas():
        if replica.has_prefix(prefix_hash):
            return replica.endpoint  # cache hit: fast prefill
    
    # No cache hit: route to least-loaded replica
    return get_least_loaded_replica().endpoint
```

**Tradeoff to discuss in interview:**
- KV-cache routing creates affinity — some replicas get more traffic
- Pure load balancing would be more even but lose cache benefits
- Solution: combine cache affinity with a load cap (if replica is >90% loaded, route to next-best)

### Autoscaling Strategy

```
Scale signal: inference_queue_depth > 10 per replica for > 60 seconds
Scale up: add 2 replicas (model loading takes 3 minutes — scale proactively)
Scale down: inference_queue_depth < 2 per replica for > 5 minutes, scale in 1 replica
Min replicas: 2 (for HA — one replica should survive any single pod failure)
Max replicas: 80 (GPU budget)

Scale-to-zero: NOT for production inference (3-minute cold start is unacceptable)
Scale-to-zero: YES for dev/test endpoints (cost savings, longer SLO acceptable)
```

### Handling Model Updates (Zero-Downtime Deployment)

```
Blue-green deployment for model updates:
1. Provision new replicas with updated model (green fleet)
2. Pre-warm green fleet: send test requests, ensure model is loaded and responsive
3. Router: shift 10% traffic to green fleet (canary)
4. Monitor: error rate, latency, accuracy metrics
5. If healthy for 10 minutes: shift 100% traffic to green
6. Decommission blue fleet
7. If unhealthy: shift 0% back to blue immediately

Key difference from web service blue-green:
- "Pre-warm" step is critical because model loading takes minutes
- GPU memory must be available on green nodes before starting switch
```

---

## Design 3: Observability Pipeline for a GPU Cloud

**Prompt:** "Design the observability stack for a 10,000-GPU cluster. It should handle metrics, logs, and traces at scale."

### Scale Estimation
- 10,000 GPUs = ~1,250 nodes (8 GPU each)
- Metrics: each node exposes ~500 metrics, scraped every 15s = ~42K metrics/second ingested
- Logs: 1,250 nodes × 100 log lines/second average = 125K log lines/second
- Traces: training spans are long-lived (hours), not like web request traces — adapt accordingly

### Architecture

```
                        ┌───────────────────────────────────┐
Nodes                   │  Metrics          Logs    Traces   │
                        │  Prometheus   Fluentbit  OTel Agent │
  ┌──────────────┐      └──────┬─────────────┬────────┬─────┘
  │  Node Exporter│            │             │        │
  │  DCGM Exporter│────────────┤             │        │
  │  cAdvisor    │            │             │        │
  │  App metrics  │            │             │        │
  └──────────────┘            │             │        │
                               ▼             ▼        ▼
                        ┌──────────┐  ┌──────────┐ ┌──────────┐
                        │  Prom    │  │   Loki   │ │  Tempo   │
                        │  Remote  │  │ (log agg)│ │ (traces) │
                        │  Write   │  └────┬─────┘ └────┬─────┘
                        └────┬─────┘       │             │
                             │             │             │
                        ┌────▼─────────────▼─────────────▼─────┐
                        │          Grafana (Unified UI)          │
                        │  Dashboards | Alerts | Explore         │
                        └────────────────────┬──────────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Alertmanager    │
                                    │  PagerDuty/Slack │
                                    └─────────────────┘
```

### Prometheus at Scale — The Federation Challenge

A single Prometheus instance can handle ~1M active time series. At 10K nodes × 500 metrics = 5M series — needs sharding.

**Two strategies:**

**Strategy 1: Prometheus Federation**
```yaml
# Global Prometheus scrapes aggregated metrics from regional Prometheus instances
scrape_configs:
- job_name: 'federate'
  honor_labels: true
  metrics_path: '/federate'
  params:
    match[]:
    - '{__name__=~"job:.*"}'   # only pre-aggregated metrics
  static_configs:
  - targets:
    - 'prometheus-region-1:9090'
    - 'prometheus-region-2:9090'
```

**Strategy 2: Thanos or Cortex (preferred at Nebius scale)**
- Multiple Prometheus instances, each sharding a portion of the cluster
- Thanos Sidecar uploads data to object storage (Nebius Object Storage)
- Thanos Query handles cross-shard queries with deduplication
- Thanos Compact for long-term storage compaction
- This gives: unlimited retention, global queries, HA

### SLI/SLO Design for the Platform

**What to measure (SLIs):**
- GPU availability: `count(healthy_gpus) / count(total_gpus)` — target 99.5%
- Training job completion rate: jobs completed / jobs submitted — target 99.5%
- Inference API error rate: `rate(http_errors_5xx[5m]) / rate(http_requests[5m])` — target < 0.1%
- Inference P99 latency: `histogram_quantile(0.99, inference_duration_seconds)` — target < 2s

**Alert routing:**
```yaml
# Critical: pages on-call immediately
- alert: GPUHealthCritical
  expr: dcgm_ecc_dbe_errors_total > 0
  labels:
    severity: critical
  annotations:
    summary: "GPU {{ $labels.gpu }} has uncorrectable ECC errors"
    runbook: "https://wiki/runbooks/gpu-ecc-critical"

# Warning: creates ticket, notifies Slack
- alert: InferenceLatencyHigh
  expr: histogram_quantile(0.99, rate(inference_duration_seconds_bucket[5m])) > 1.5
  for: 5m
  labels:
    severity: warning
```

---

## Design 4: Kubernetes Multi-Tenant GPU Cluster

**Prompt:** "Design a Kubernetes cluster that supports multiple tenants sharing a GPU pool, with fair resource allocation, isolation, and cost attribution."

### The Core Challenges
1. **Resource contention:** One tenant can starve others if not limited
2. **Isolation:** A tenant's training failure should not affect other tenants
3. **Cost attribution:** Who used what, for billing and chargeback
4. **Fairness:** Multiple jobs waiting for the same GPU pool

### Architecture with Kueue

```yaml
# ClusterQueue: defines resource capacity
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: shared-gpu-pool
spec:
  namespaceSelector: {}
  cohort: company-wide           # enables borrowing between queues
  resourceGroups:
  - coveredResources: ["nvidia.com/gpu", "cpu", "memory"]
    flavors:
    - name: h100-nodes
      resources:
      - name: nvidia.com/gpu
        nominalQuota: 64         # 8 nodes guaranteed
        borrowingLimit: 128      # can borrow up to 128 if pool is available
        lendingLimit: 32         # can lend up to 32 to others

---
# LocalQueue: per-team queue
apiVersion: kueue.x-k8s.io/v1beta1
kind: LocalQueue
metadata:
  name: team-research-queue
  namespace: team-research
spec:
  clusterQueue: shared-gpu-pool
```

**Preemption strategy:**
- High-priority job from Team A needs GPUs held by low-priority job from Team B
- Kueue preempts Team B's job (sends SIGTERM for checkpoint), releases GPUs
- Team B's job is re-queued (will run when capacity is available)
- Fair scheduling: BorrowWithinCohort — teams can borrow each other's capacity

### Namespace Isolation Model

```
Kubernetes Cluster
├── Namespace: team-research
│   ├── ResourceQuota: 64 GPUs max, 1TB memory max
│   ├── LimitRange: pod max = 8 GPUs per pod
│   ├── NetworkPolicy: egress to internet blocked, ingress from team only
│   └── Pod Security Standard: Restricted (no privileged containers)
│
├── Namespace: team-inference
│   ├── ResourceQuota: 32 GPUs max
│   └── ...
│
└── Namespace: kube-system (cluster management)
    └── (isolated from tenant workloads)
```

### Cost Attribution

```
# Per-namespace GPU hour consumption
sum by (namespace) (
  increase(
    kube_pod_container_resource_requests{resource="nvidia.com/gpu"}[1d]
  )
)

# This gives you: "Team Research used 1,024 GPU-hours today"
# Multiply by cost-per-GPU-hour = chargeback amount
```

---

## Common Tradeoffs to Discuss in Every Design

### Availability vs Consistency
- During a network partition, should the cluster accept new job submissions (availability) or refuse until quorum is restored (consistency)?
- For training jobs: availability — resume from checkpoint if needed
- For billing data: consistency — wrong charges are worse than delayed job acceptance

### Horizontal vs Vertical Scaling
- Inference serving: scale horizontally (add replicas) — stateless, easy
- etcd: scale vertically (more RAM/faster disk) — consensus overhead makes horizontal scaling harder
- Checkpointing storage: scale horizontally (more nodes, more WEKA storage servers)

### Centralized vs Distributed Monitoring
- Centralized (Thanos): global queries, easier operations, single failure domain
- Distributed (per-datacenter Prometheus): fault isolation, lower cross-DC traffic, harder to query globally

---

## Points to Remember

- Always ask clarifying questions before designing — scale, SLO, latency requirements
- Buffer pool sizing: 2–3% of cluster as spare nodes is the Nebius model
- KV-cache aware routing improves inference throughput 2–3x without adding hardware
- Blue-green for ML inference: pre-warm before shifting traffic (model loading takes minutes)
- Thanos/Cortex over raw Prometheus for >5M active time series
- Kueue for fair multi-tenant GPU scheduling with gang scheduling and preemption
- SLI/SLO definitions: make them measurable, make them actionable
- The 5-layer reliability model is Nebius's actual architecture — knowing it shows you did homework

## What to Study Next

- [06-stress-interview-incident-response.md](/docs/nebius/stress-interview-incident-response) — apply these designs to incident scenarios
- [03-gpu-ai-infrastructure.md](/docs/nebius/gpu-ai-infrastructure) — the hardware detail behind these designs
- Interview-prep foundations [07-system-design-cloud-architecture.md](../foundations/07-system-design-cloud-architecture.md) — broader system design principles
