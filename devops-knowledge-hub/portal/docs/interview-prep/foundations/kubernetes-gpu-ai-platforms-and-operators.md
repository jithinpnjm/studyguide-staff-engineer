---
title: "Foundations: Kubernetes GPU, AI Platforms, And Operators Zero To Hero"
sidebar_position: 12
---

# Foundations: Kubernetes GPU, AI Platforms, And Operators Zero To Hero

GPU workloads on Kubernetes are not just larger Pods. They introduce scarce hardware, expensive scheduling mistakes, model cold starts, distributed training coordination, driver/runtime dependencies, high-performance networking, storage pressure, and deeper observability needs.

This guide is designed as a complete path:

- Beginner: what GPUs are and why AI workloads need them
- Intermediate: GPU scheduling, device plugins, node labels, resource requests
- Advanced: NVIDIA GPU Operator, MIG, topology, NCCL, Kueue/Volcano, operators
- SRE Level: debug ImagePullBackOff, missing GPUs, OOM, bad nodes, slow training, inference latency
- Interview Level: explain GPU platform design and operational tradeoffs clearly

---

# Part 1: Why GPUs Matter For AI Platforms

GPUs accelerate parallel math. AI training and inference use large matrix and tensor operations that GPUs handle much faster than CPUs.

Common workloads:

| Workload | Pattern | SRE concern |
|---|---|---|
| Training | long-running batch jobs | scheduling, checkpoints, failures, throughput |
| Inference | online request serving | latency, warm capacity, model loading, autoscaling |
| Batch inference | offline processing | throughput, cost, queueing |
| Fine-tuning | smaller training jobs | quota, isolation, checkpointing |

GPU mistakes are expensive because idle GPUs cost money even when no useful work happens.

---

# Part 2: Memory Palace — GPU Cluster As A Specialist Hospital Wing

Think of a GPU cluster as a high-cost specialist wing in a hospital.

| GPU platform concept | Hospital analogy | Production meaning |
|---|---|---|
| GPU node | Specialist treatment room | expensive compute host |
| GPU | specialist machine | scarce accelerator |
| GPU memory | machine capacity | HBM/model/KV cache limit |
| Device plugin | equipment registrar | exposes GPUs to kubelet |
| GPU Operator | equipment operations team | installs drivers/runtime/exporters |
| MIG | partitioned machine rooms | hardware GPU slicing |
| Training job | long surgery | coordinated, long-running workload |
| Inference service | emergency response desk | low-latency request serving |
| Checkpoint | saved patient state | restart point for training |
| DCGM exporter | equipment monitor | GPU metrics |

---

# Part 3: Kubernetes Has No Native GPU Magic

Kubernetes sees GPUs as extended resources.

The NVIDIA device plugin advertises GPUs to kubelet.

```bash
kubectl describe node GPU_NODE | grep -A5 nvidia.com/gpu
kubectl get nodes -L nvidia.com/gpu.product
kubectl get pods -A -o wide
```

A Pod requests GPUs like this:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
```

Important:

- standard GPU resources are not fractional
- requests and limits are effectively the same for GPUs
- scheduler places Pods only on nodes with enough allocatable GPUs
- GPU allocation does not guarantee high utilization

---

# Part 4: Beginner GPU Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-test
spec:
  restartPolicy: Never
  containers:
    - name: cuda
      image: nvidia/cuda:12.2.0-base-ubuntu22.04
      command: ["nvidia-smi"]
      resources:
        limits:
          nvidia.com/gpu: 1
```

Check:

```bash
kubectl logs gpu-test
kubectl describe pod gpu-test
```

If `nvidia-smi` fails, think driver/runtime/device-plugin path.

---

# Part 5: GPU Platform Stack

Typical stack:

```text
GPU hardware
NVIDIA driver
container runtime integration
NVIDIA device plugin
kubelet extended resources
scheduler placement
Pod uses GPU
DCGM exporter exposes metrics
```

Failure at any layer can make GPUs unavailable.

---

# Part 6: NVIDIA GPU Operator

The GPU Operator automates GPU node setup.

It can manage:

- NVIDIA drivers
- container toolkit
- device plugin
- DCGM exporter
- MIG manager
- node feature discovery
- validator jobs

Check operator components:

```bash
kubectl get pods -n gpu-operator
kubectl get clusterpolicy
kubectl logs -n gpu-operator deploy/gpu-operator
```

Useful question:

> Are GPUs missing because hardware is missing, driver failed, device plugin failed, or kubelet did not advertise allocatable resources?

---

# Part 7: Node Labels, Taints, And Scheduling

GPU nodes should be labeled.

```bash
kubectl get nodes --show-labels | grep nvidia
```

Common labels:

- `nvidia.com/gpu.product`
- `nvidia.com/gpu.count`
- `nvidia.com/cuda.driver.major`
- `feature.node.kubernetes.io/pci-10de.present`

Schedule to a specific GPU type:

```yaml
nodeSelector:
  nvidia.com/gpu.product: "NVIDIA-H100-80GB-HBM3"
```

Use taints to protect GPU nodes:

```bash
kubectl taint nodes gpu-node dedicated=gpu:NoSchedule
```

Then workloads need toleration:

```yaml
tolerations:
  - key: dedicated
    operator: Equal
    value: gpu
    effect: NoSchedule
```

---

# Part 8: MIG — Multi-Instance GPU

MIG partitions supported GPUs into hardware-isolated slices.

Useful when:

- inference workloads do not need a full GPU
- teams need isolation
- you want better utilization

Example resources may appear as:

```text
nvidia.com/mig-1g.10gb
nvidia.com/mig-2g.20gb
```

Tradeoffs:

- better utilization
- stronger isolation than software sharing
- more scheduling complexity
- not ideal for every training workload

---

# Part 9: Training Workloads

Training characteristics:

- long-running
- expensive
- needs checkpoints
- may require many GPUs at once
- network-heavy for distributed training

Distributed training often uses:

- PyTorch DDP
- MPI
- NCCL
- Ray
- Kubeflow Training Operator

Important:

> Partial allocation can waste huge GPU capacity.

If a 4-worker training job needs 8 GPUs per worker, starting only 3 workers is usually useless.

---

# Part 10: Gang Scheduling And Queues

Use Kueue or Volcano for all-or-nothing scheduling.

Without gang scheduling:

- some workers start
- missing workers block progress
- allocated GPUs sit idle

With gang scheduling:

- job waits until all required resources are available
- then starts together

Concepts:

- queue
- quota
- cohort/fair sharing
- admission
- workload priority

---

# Part 11: Topology Matters

GPU placement affects performance.

Fastest to slowest:

1. same GPU memory
2. NVLink/NVSwitch
3. PCIe same host
4. InfiniBand/RDMA cross-node
5. Ethernet cross-node

For training, poor topology can reduce throughput dramatically.

Check topology:

```bash
nvidia-smi topo -m
```

Kubernetes scheduling should consider:

- GPU type
- node locality
- NUMA
- topology spread
- high-speed network availability

---

# Part 12: NCCL, RDMA, And Distributed Training Networking

Distributed training frequently uses NCCL for collective communication.

Important signals:

- all-reduce latency
- network throughput
- RDMA errors
- packet drops
- straggler workers

Debug ideas:

```bash
kubectl logs JOB_POD
nvidia-smi
ibstat
ibv_devinfo
ethtool -S INTERFACE
```

If one worker is slow, the whole training step can slow down.

---

# Part 13: Inference Workloads

Inference characteristics:

- latency-sensitive
- model-load cold starts
- GPU memory bound
- request batching matters
- warm replicas matter

Common servers:

- NVIDIA Triton
- vLLM
- TorchServe
- TensorRT-LLM

Model cold starts can take minutes for large models.

Production rule:

> Do not scale critical inference to zero unless cold-start latency is acceptable.

---

# Part 14: GPU Memory And KV Cache

For LLM inference, GPU memory holds:

- model weights
- KV cache
- activations
- framework/runtime overhead

Large context windows increase KV cache pressure.

Symptoms:

- OOM during inference
- lower batch capacity
- latency spikes
- model server restarts

Mitigations:

- quantization
- tensor parallelism
- smaller context limits
- batching controls
- more GPUs or MIG strategy

---

# Part 15: Observability For GPU Platforms

Use DCGM exporter for NVIDIA GPU metrics.

Important metrics:

- GPU utilization
- memory used/free
- temperature
- power draw
- ECC errors
- XID errors
- throttling
- PCIe/NVLink throughput
- queue wait time
- training throughput
- inference latency
- model load time

Commands:

```bash
nvidia-smi
nvidia-smi dmon
kubectl logs -n gpu-operator ds/nvidia-dcgm-exporter
```

Watch for:

- low GPU utilization with high queue depth
- memory near full
- XID errors
- GPU temperature/power throttling
- high allocation with poor actual utilization

---

# Part 16: Common GPU Failure Modes

## GPU Not Visible On Node

Check:

```bash
lspci | grep -i nvidia
nvidia-smi
kubectl describe node NODE | grep nvidia.com/gpu
```

Likely causes:

- driver not loaded
- hardware issue
- operator failed
- device plugin failed

## Pod Pending

Likely causes:

- insufficient GPUs
- wrong GPU nodeSelector
- missing toleration
- quota/queue admission

## Pod Starts But CUDA Fails

Likely causes:

- image CUDA version incompatible
- runtime not injecting devices
- driver/toolkit mismatch

## Training Slow

Likely causes:

- poor GPU topology
- slow network/all-reduce
- data pipeline bottleneck
- storage throughput bottleneck
- CPU preprocessing bottleneck

## Inference Latency High

Likely causes:

- cold model loads
- GPU memory pressure
- batch size too high/low
- queue buildup
- model server saturation

---

# Part 17: Operators For AI Platforms

An Operator is a Kubernetes controller that manages a complex system using custom resources.

Operator loop:

```text
Watch desired state -> observe actual state -> reconcile difference -> update status
```

Use operators when lifecycle needs domain knowledge.

Examples:

- GPU Operator
- Kubeflow Training Operator
- KServe
- Ray Operator / KubeRay
- Spark Operator
- custom Slurm/Soperator-style controllers

Good operators are:

- idempotent
- status-rich
- safe during retries
- not in the critical data path
- observable

---

# Part 18: Storage And Data For AI Workloads

Training needs fast access to datasets and checkpoint storage.

Options:

- object storage for datasets/checkpoints
- distributed filesystems
- local NVMe cache
- prefetch sidecars/init containers

SRE concerns:

- storage throughput bottlenecks
- checkpoint frequency
- restore time
- data locality
- failed checkpoint corruption

---

# Part 19: Security And Multi-Tenancy

GPU clusters are often shared by teams.

Controls:

- namespaces
- quotas
- node taints
- RBAC
- NetworkPolicy
- image scanning
- private registries
- workload identity
- admission policies

Multi-tenancy question:

> Is Kubernetes namespace isolation enough for this threat model?

For hostile or strong tenant isolation, consider stronger sandboxing or separate clusters.

---

# Part 20: Cost And Capacity Management

GPU platform SREs must think about utilization and fairness.

Track:

- allocated GPUs
- used GPUs
- idle allocated GPUs
- queue wait time
- job success/failure rate
- cost per team/project

Bad pattern:

> 80% allocated GPUs but only 20% actual utilization.

This means scheduling/accounting looks fine, but business value is poor.

---

# Part 21: Real Incident Stories

## GPUs Missing After Node Upgrade

Likely causes:

- driver mismatch
- operator DaemonSet failed
- device plugin not registered

## Expensive Training Job Idle For Hours

Likely cause:

- no gang scheduling; partial workers started

## Inference Outage After Scale Down

Likely cause:

- scaled to zero; large model cold start too slow

## Random Training Failures On One Node

Likely causes:

- bad GPU hardware
- XID errors
- ECC issues
- thermal throttling

---

# Part 22: Command Interpretation Table

| Command | What it answers | Bad signs |
|---|---|---|
| `nvidia-smi` | driver/GPU visibility | no devices, errors |
| `nvidia-smi topo -m` | GPU topology | unexpected slow links |
| `kubectl describe node` | allocatable GPUs | no `nvidia.com/gpu` |
| `kubectl describe pod` | scheduling reason | insufficient GPU, taints |
| GPU Operator pods | platform health | CrashLoop/validator fail |
| DCGM metrics | GPU health/utilization | XID/ECC/temp/throttle |
| Kueue/Volcano status | queue/admission | job waiting/partial issues |

---

# Part 23: Labs

## Beginner

- run `nvidia-smi` in a GPU Pod
- inspect GPU node allocatable resources
- schedule Pod to GPU node

## Intermediate

- taint GPU nodes and add tolerations
- request specific GPU product with nodeSelector
- deploy DCGM exporter and view metrics

## Advanced

- simulate Pending due to insufficient GPUs
- test MIG resource scheduling
- create queued training job
- debug CUDA image/driver mismatch
- analyze low GPU utilization

---

# Part 24: Interview Questions

- Why are GPU workloads different from normal web services?
- How does Kubernetes know a node has GPUs?
- What does the NVIDIA device plugin do?
- What does the GPU Operator manage?
- Why is gang scheduling important?
- What is MIG and when would you use it?
- How would you debug a GPU Pod stuck Pending?
- Why is inference cold start a production problem?
- How do you monitor GPU health?

---

# Part 25: Senior Answer Shape

> I treat GPU platforms as scarce-resource scheduling systems layered on Kubernetes. The device plugin advertises GPUs, the scheduler places Pods based on extended resources and constraints, and the GPU Operator manages drivers, runtime integration, device plugins, MIG, and metrics. For training I care about gang scheduling, topology, checkpointing, and utilization. For inference I care about warm capacity, model load time, GPU memory/KV cache, batching, and latency SLOs. During incidents I separate hardware, driver, runtime, scheduling, application, and data-path failures.

---

# Recall Prompts

- Why are GPUs exposed as extended resources?
- Why is partial scheduling bad for distributed training?
- What does MIG solve?
- Why can GPU allocation look high while utilization is low?
- What layers can cause `nvidia-smi` to fail inside a Pod?
