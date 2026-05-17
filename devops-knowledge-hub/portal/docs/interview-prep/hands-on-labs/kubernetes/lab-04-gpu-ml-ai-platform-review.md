---
title: "Kubernetes Lab 4: GPU And AI Platform Architecture Review"
sidebar_position: 99
---

# Kubernetes Lab 4: GPU And AI Platform Architecture Review

## Scenario

A company is building an AI compute platform on Kubernetes. It must support four distinct workload classes:

- general stateless product services (web APIs, microservices)
- scheduled CPU-heavy batch jobs (data pipelines, preprocessing)
- distributed GPU training jobs (multi-node, long-running, expensive)
- GPU-based and CPU-based model inference (latency-sensitive, availability-critical)

The platform must enforce cost control, prevent resource interference between workload classes, and support multiple tenant teams without any single team being able to monopolize scarce GPU capacity.

## Prerequisites

Before attempting this lab, you should be comfortable with:

- Kubernetes node pools, taints, tolerations, and node affinity
- ResourceQuota and LimitRange objects
- PriorityClass and preemption behavior
- Kubernetes Job and CronJob behavior
- GPU device plugin basics (how Kubernetes sees GPU resources)
- Basic familiarity with what Kubeflow Trainer, KServe, and Kueue are for

Foundation reading: [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)

## Time Estimate

60-90 minutes for a written design. 20-30 minutes additional for pressure questions.

---

## How To Think About This

Before writing anything, break the problem into layers. An interviewer who sees structured decomposition is much more confident you can operate this platform, not just describe it.

**Layer 1: Workload classification**
Ask: what are the distinct workload types and what do they each need from the scheduler, network, storage, and cost model?

**Layer 2: Isolation**
Ask: how do I prevent training jobs from consuming inference capacity, and general services from landing on GPU nodes?

**Layer 3: Scheduling and admission**
Ask: how do I control who gets GPU resources, in what order, and at what cost?

**Layer 4: Training platform specifics**
Ask: what happens if a distributed training job half-starts? How does the platform handle preemption and node loss?

**Layer 5: Inference platform specifics**
Ask: what does warm capacity mean here? What is the difference between predictive and generative inference?

**Layer 6: Observability**
Ask: what does a GPU sitting idle look like in metrics? What tells me a training job is making no progress?

**Layer 7: Cost and governance**
Ask: who can approve very large training runs? How do I show teams their GPU spend?

---

## Building Blocks

These are the tools and concepts relevant to this design. You do not need to use all of them — the decision about which to include and why is part of the answer.

| Component | What it does |
|---|---|
| Node pools | Separate groups of nodes with distinct hardware, taints, and scaling policies |
| Taints and tolerations | Repel general workloads from GPU nodes by default |
| Node affinity | Attract GPU workloads to nodes with specific hardware labels |
| ResourceQuota | Limit how much CPU, memory, or GPU a namespace can consume |
| PriorityClass | Allow inference traffic to preempt lower-priority training jobs |
| Kueue | Queue-based admission for batch and GPU jobs — prevents partial starts |
| Kubeflow Trainer | Higher-level controller for distributed multi-worker training jobs |
| KServe | Standardized model serving platform with inference protocol support |
| NVIDIA device plugin | Exposes GPU resources to Kubernetes as schedulable units |
| Horizontal Pod Autoscaler | Scale inference replicas based on load |
| Checkpoint storage (PVC / object store) | Persists training state for resume after failure |
| OPA / Kyverno | Admission policies to block unqualified GPU requests |

---

## Beginner Starter Skeleton

This gives you approximately 30% of a complete answer. Use it to get started, then extend it.

**Workload classes I would separate:**

- stateless product services — CPU node pools, no GPU access
- batch jobs — lower-priority CPU node pools, scheduled or queued
- GPU training — dedicated GPU node pools with taints, queued admission
- GPU inference — separate GPU node pools or dedicated GPU nodes, higher priority

**Why I separate these:**

Training jobs are long-running and interruptible. Inference services are latency-sensitive and need predictable capacity. Mixing them on shared node pools creates scheduling interference and makes cost accounting impossible.

**GPU isolation starting point:**

```yaml
# GPU node pool taint — applied at node pool creation or via kubectl taint
kubectl taint nodes <gpu-node> workload=gpu-training:NoSchedule

# GPU workload toleration — only GPU pods carry this
tolerations:
  - key: "workload"
    operator: "Equal"
    value: "gpu-training"
    effect: "NoSchedule"
```

**Quota to block unintended GPU consumption:**

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: no-gpu
  namespace: general-services
spec:
  hard:
    requests.nvidia.com/gpu: "0"
```

Now extend this skeleton by working through the tasks below.

---

## Tasks

Complete these in order. Write your answer as a design document, not a list of commands.

**Task 1: Node pool strategy**

Describe the node pool layout for this platform. Specify at minimum:
- what node pools exist and what hardware they use
- what taints each GPU pool carries
- what autoscaling policy each pool uses and why

**Task 2: GPU isolation strategy**

Explain how you prevent a general service team from accidentally consuming GPU capacity. Cover taints, tolerations, quota, and any admission policy layer you would add.

**Task 3: Training platform design**

Explain how the platform supports multi-worker distributed training. Address:
- the partial-start problem and how you prevent it
- what happens when a training node is lost mid-job
- whether you use plain Jobs, Kubeflow Trainer, or something else — and why
- how checkpointing fits into the reliability model

**Task 4: Inference platform design**

Explain how the platform supports GPU model inference. Address:
- how inference capacity stays warm
- how you handle generative inference (long request duration, streaming, concurrency)
- how you handle predictive inference (batch-able, often CPU-friendly)
- whether KServe is appropriate and what it gives you

**Task 5: Scheduling and quota design**

Describe how you allocate GPU capacity across multiple tenant teams. Include:
- how you use ResourceQuota and PriorityClass together
- how Kueue fits in if demand exceeds supply
- how you prevent one team from monopolizing resources

**Task 6: Observability for GPU workloads**

List the signals you would instrument. Separate platform-level signals from workload-level signals. What tells you a training job is stalled versus making progress?

**Task 7: Failure handling**

Describe your failure model for:
- a training node going down at hour 3 of a 6-hour job
- an inference pod OOMing under traffic spike
- the GPU device plugin crashing on a node

**Task 8: Tooling decision**

State which controllers you would adopt (Trainer, KServe, Kueue, plain Kubernetes) and which you would defer. Give a reason for each choice. Explain what operational cost each controller adds.

---

## What A Beginner Answer Looks Like

A beginner answer describes GPU node isolation using taints and tolerations and ResourceQuota. It separates training from inference at the node pool level. It identifies checkpointing as important. It reaches for Kubeflow and KServe by name but does not explain the tradeoffs. It does not address the partial-start problem, does not distinguish generative from predictive inference, and does not reason about cost governance or tenant fairness.

## What An Intermediate Answer Looks Like

An intermediate answer correctly separates all four workload classes. It adds Kueue or an equivalent for queued GPU admission and explains the partial-start problem explicitly. It distinguishes generative inference needs from predictive inference needs. It addresses checkpointing as part of job reliability, not just ML convenience. It describes observability at both platform level and workload level. It explains Kubeflow Trainer as a tradeoff — reduced scheduling complexity in exchange for operator overhead. It may still miss cost governance and team budget visibility.

## What A Strong Answer Looks Like

A strong answer includes everything in the intermediate answer and adds:
- explicit cost governance: GPU budget visibility per team, quota guardrails, approval flow for very large jobs
- a clear principle that inference and training do not share scheduling policy
- distinction between driver readiness and node readiness — a GPU node can be "Ready" but unusable if the device plugin is in a bad state
- deliberate minimalism on tooling adoption: a clear reason why you are not adopting all four controllers at once
- separate SLOs for inference latency, training throughput, and platform control services
- discussion of data locality and input pipeline throughput as first-class training concerns, not afterthoughts

---

## Interviewer Pressure Questions

These are questions a strong interviewer will ask after your initial answer. Prepare a response for each.

1. You said you would use dedicated GPU node pools for training and inference. What if inference demand is low and training demand is high — do you allow overflow?
2. Your quota prevents general teams from getting GPUs. But what if a critical team needs a temporary GPU allocation outside their quota?
3. Kueue manages fair queuing. But what if a training job has been waiting for 6 hours and a higher-priority inference job keeps preempting the available nodes?
4. How do you validate that a GPU node is actually healthy before you schedule a training job onto it? The node can be Ready without the device plugin being functional.
5. A training job ran for 18 hours and produced no checkpoint. The node was preempted. What do you do with this information operationally?
6. You chose KServe. What does it cost your team to adopt it? Who owns it when it breaks?

---

## Deliverable Guidance

Your answer should include:

- a written description of the node pool layout (can be a table)
- a description of the isolation strategy with at least one concrete YAML or kubectl example
- a written explanation of how you would handle training job failures
- a list of observability signals separated by layer (platform vs workload)
- a tooling decision with justification for each choice

Do not submit bullet lists without explanation. An interviewer wants to see reasoning, not enumeration.

---

## What To Study Next

- [lab-05-operators-mesh-and-dr-review.md](lab-05-operators-mesh-and-dr-review.md) — operators, admission policy, and DR design
- [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md) — GPU platform depth
- [../../foundations/09-observability-slos-and-incident-response.md](../../foundations/09-observability-slos-and-incident-response.md) — SLO design for platform services
- Kueue documentation: https://kueue.sigs.k8s.io/docs/tasks/
- Kubeflow Trainer overview: https://www.kubeflow.org/docs/components/trainer/overview/
- KServe admin overview: https://kserve.github.io/website/docs/admin-guide/overview
- NVIDIA device plugin: https://nvidia.github.io/k8s-device-plugin/
