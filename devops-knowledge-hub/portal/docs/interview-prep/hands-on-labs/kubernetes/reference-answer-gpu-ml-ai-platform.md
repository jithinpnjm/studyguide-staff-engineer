---
title: "Reference Answer: GPU And AI Kubernetes Platform"
sidebar_position: 99
---

# Reference Answer: GPU And AI Kubernetes Platform

Use this as a quality bar for [lab-04-gpu-ml-ai-platform-review.md](lab-04-gpu-ml-ai-platform-review.md).

## 1. Requirements And Assumptions

I would first separate the workload classes because the platform requirements are not the same:

- normal stateless product services
- CPU-heavy batch jobs
- distributed GPU training jobs
- GPU or CPU inference services

Key assumptions:

- GPU nodes are expensive and must be tightly controlled
- some training jobs are multi-node and partially scheduled startup is wasteful
- inference may need lower latency and stronger availability than training
- observability must cover both Kubernetes behavior and accelerator utilization
- platform guardrails must prevent general workloads from consuming scarce GPU capacity

## 2. Cluster And Node Pool Strategy

I would not mix everything on homogeneous node pools.

I would use at least:

- general-purpose CPU node pools for product services
- batch-oriented CPU node pools for lower-priority jobs
- dedicated GPU node pools for training
- possibly separate GPU node pools for inference if latency and scaling behavior differ enough

Reasons:

- cost isolation
- scheduling clarity
- easier quota and taint strategy
- easier incident containment
- different autoscaling and maintenance policies

## 3. GPU Isolation Strategy

I would isolate GPU capacity using:

- dedicated GPU node pools
- taints on GPU nodes
- tolerations only for approved GPU workloads
- node labels and affinity for model-specific or accelerator-specific placement
- namespace-level quota or admission policy to restrict who can request GPUs

I would also explicitly control:

- allowed GPU resource requests
- maximum parallel jobs by team or tenant
- workload priority for expensive training versus business-critical inference

The goal is to make accidental GPU consumption difficult by default.

## 4. Drivers, Device Plugins, And Node Preparation

At the node layer, the platform needs:

- correct GPU drivers
- vendor device plugin
- node labeling for hardware characteristics
- validation that nodes are actually healthy before admitting expensive work

Operationally, I would treat GPU node readiness as stricter than ordinary node readiness, because a node can be "up" but still be unusable for the intended workload if drivers or plugin state are wrong.

## 5. Training Versus Inference Platform Design

### Training

Training platform priorities:

- coordinated startup across workers
- fast east-west networking
- checkpointing
- data locality and input pipeline throughput
- restart and resume behavior
- queueing of scarce GPU resources

I would strongly consider a scheduling layer such as Kueue or an equivalent queueing mechanism for expensive jobs, especially if demand exceeds GPU supply.

For distributed jobs, I would likely use Kubeflow Trainer or a similar higher-level controller if the organization is serious about repeated training workflows, because plain Jobs are usually too primitive for long-term platform ergonomics.

### Inference

Inference platform priorities:

- startup latency
- warm capacity
- batching strategy
- queueing and concurrency control
- model memory fit
- predictable routing and autoscaling

For inference, I would evaluate KServe if teams need standardized model serving workflows, inference protocol consistency, and traffic management features.

I would treat predictive inference and generative inference differently:

- classic predictive models may be dense and CPU-friendly
- generative inference often needs stronger GPU isolation, longer request duration, streaming support, and tighter concurrency control

## 6. Scheduling And Admission Strategy

For general multi-tenancy, I would combine:

- taints and tolerations
- node affinity
- resource quota
- priority classes
- admission policy

For distributed training, I would explicitly address the "partial start" problem. If four workers are needed and only two start, the platform can burn GPU time without useful progress.

That is why gang-like or coordinated scheduling behavior matters. Even if Kubernetes does not natively provide all of it, the platform should enforce queueing or orchestration logic that prevents expensive half-starts.

## 7. Storage And Data Movement

AI workloads fail in boring ways if data movement is ignored.

I would explicitly design:

- where training data lives
- how workers read it
- whether data locality matters
- where checkpoints live
- how resume works after node or job failure

Checkpointing is part of reliability, not just ML convenience.

Without it, preemption, node failure, or control-plane events can waste hours or days of training time.

## 8. Observability

I would require both platform and workload observability.

Platform-level:

- node health
- pod scheduling delay
- queue backlog for GPU jobs
- GPU capacity and allocatable tracking
- cluster events
- device plugin health

Workload-level:

- GPU utilization
- memory utilization on accelerators
- training step throughput
- data loader stalls
- inference queue depth
- per-model latency
- error and timeout rate

For incident response, I would want dashboards separating:

- scheduler or queue pressure
- node or device health
- training throughput
- inference latency

## 9. Failure Handling

### Training Failures

For training, I would favor:

- checkpointing
- queued restart behavior
- explicit retry policy only when it makes economic sense
- clear handling for node interruption or preemption

### Inference Failures

For inference, I would favor:

- strict concurrency limits
- warm capacity for critical models
- fallback behavior if a GPU model backend becomes saturated
- clear separation between availability policy and cost optimization

## 10. Tooling Choices

My rough decision model:

- plain Kubernetes for simple isolated jobs
- Kubeflow Trainer when multi-worker training becomes a repeated product need
- Kueue when GPU supply is scarce and fair, queued admission matters
- KServe when teams need shared model-serving patterns and governance

I would avoid adopting all of them just because they exist. Each controller adds operational weight and new failure modes.

## 11. Cost And Platform Governance

This platform can become financially unsafe if governance is weak.

So I would add:

- GPU budget visibility by team
- quota and admission guardrails
- idle capacity review
- stronger approval or queue policy for very large training jobs
- separate SLOs for inference and platform control services

Critical principle:

- product-serving inference and exploratory training do not deserve the same scheduling policy

## 12. What I Would Keep Simple

I would avoid:

- one giant cluster policy pretending all workload classes are the same
- uncontrolled self-service GPU scheduling
- adding mesh to every training path by default
- adopting too many operators before operational ownership is clear

I would keep the initial platform opinionated:

- clear workload classes
- dedicated GPU pools
- one queueing strategy for scarce GPUs
- one preferred training controller path
- one preferred inference platform path

That usually gives better reliability and cost control than a highly flexible but weakly governed platform.
