---
title: "GPU and AI Infrastructure — Nebius Level"
sidebar_position: 3
---

# GPU and AI Infrastructure — Nebius Level

> Nebius is an AI-first cloud. Their SREs operate GPU fleets, InfiniBand fabrics, and LLM inference platforms at hyperscale. This is not typical Kubernetes operations — it requires understanding hardware failure modes, high-speed networking physics, and AI workload lifecycle.

---

## Mental Model

GPU infrastructure has a fundamentally different failure economics than CPU infrastructure:
- One failed GPU in an 8-GPU training job can idle 7 working GPUs
- Network congestion on InfiniBand can reduce all-reduce throughput by 90%
- A model checkpoint is hours of work — losing it to a hardware failure without checkpointing means starting over

**The Nebius philosophy:** Automate detection, isolation, and replacement so fast that humans never need to be in the emergency loop. Their 12-minute MTTR is achieved by automation, not heroics.

---

## Part 1: GPU Hardware and Failure Modes

### GPU Architecture (What You Need to Know as an SRE)

A modern NVIDIA GPU (H100, H200, B200) is a compute device with:
- **SMs (Streaming Multiprocessors):** Where computation happens. H100 has 132 SMs.
- **HBM memory:** High-Bandwidth Memory stacked on the GPU die. H100: 80GB HBM3 at 3.35 TB/s
- **NVLink:** High-speed GPU-to-GPU interconnect within a node. H100 NVLink 4.0: 900 GB/s bidirectional
- **PCIe interface:** GPU-to-CPU communication path. PCIe 4.0 x16: ~32 GB/s (much slower than NVLink)
- **InfiniBand HCA:** Network interface card for GPU-to-GPU across nodes. 200–800 Gbps

**Why memory bandwidth matters more than compute:**
For most AI workloads (LLM inference, large batch training), the bottleneck is loading weights from HBM to SMs, not arithmetic. A model with 70B parameters at FP16 requires 140GB of memory — this is why multi-GPU serving exists.

### GPU Health Monitoring with DCGM

DCGM (Data Center GPU Manager) is NVIDIA's tool for GPU fleet management and health monitoring.

```bash
# Check GPU health
dcgmi diag -r 1          # quick health check
dcgmi diag -r 3          # comprehensive health check (takes minutes)

# GPU field values (real-time)
dcgmi dmon -e 203,252,155,1004,1005,1006
# 203  = SM utilization
# 252  = Memory utilization
# 155  = Temperature
# 1004 = PCIe TX bytes
# 1005 = PCIe RX bytes
# 1006 = NVLink bandwidth

# Check for ECC errors (critical)
dcgmi dmon -e 310,311,312,313,314,315
# 310 = SBE memory errors (Single Bit: usually correctable)
# 311 = DBE memory errors (Double Bit: uncorrectable, GPU needs replacement)
# 312 = SBE L1 cache
# 313 = DBE L1 cache

# GPU topology
dcgmi topo -d 0          # GPU 0 topology

# Also via nvidia-smi
nvidia-smi -q -d ECC          # ECC error counts
nvidia-smi -q -d CLOCK         # clock speeds (thermal throttling visible here)
nvidia-smi -q -d TEMPERATURE   # temperatures
nvidia-smi topo -m             # NVLink topology matrix
```

### XID Error Codes (Critical for Nebius SRE)

XID errors are GPU hardware error codes logged by the NVIDIA driver. They appear in `dmesg` and are critical indicators of GPU health.

```bash
# Find XID errors
dmesg | grep -i "NVRM: Xid"
journalctl -k | grep "Xid"
```

**Key XID codes:**

| XID | Meaning | Action |
|-----|---------|--------|
| 13 | Graphics Engine Exception | Usually page fault in GPU code; check application |
| 31 | GPU memory page fault | Application error or driver bug |
| 43 | GPU stopped processing | GPU hang; may recover after reset |
| 45 | Preemptive cleanup | GPU reset occurred |
| 48 | DBE (Double Bit ECC Error) | **GPU needs replacement** — unrecoverable memory error |
| 61 | Internal micro-controller halt | **GPU needs replacement** |
| 63 | ECC page retirement | ECC row retired; monitor count, >10 = replace |
| 74 | NVLink error | InfiniBand/NVLink degradation; investigate fabric |
| 79 | GPU fell off the bus | PCIe error; check seating and power |
| 119 | GSP RPC timeout | Firmware error; try reset, then replace |

**Nebius's response to critical XID codes:**
1. DCGM health monitor detects XID 48 or 61
2. Kubernetes node is automatically tainted `nvidia.com/gpu-failure: NoSchedule`
3. Running pods are checkpointed or signaled to drain
4. Node is removed from the scheduling pool
5. Spare node from pre-provisioned buffer is brought in as replacement
6. Total time: ~12 minutes

### GPU Performance Debugging

```bash
# GPU utilization and memory
watch -n 1 nvidia-smi

# Detailed per-process GPU usage
nvidia-smi pmon -s um          # process-level utilization and memory

# Check thermal throttling
nvidia-smi -q -d CLOCK | grep -A 3 "Clocks Throttle Reasons"
# "HW Thermal Slowdown" = GPU is too hot, clocks reduced
# "SW Power Cap" = power limit hit, clocks reduced

# NVLink health per GPU
nvidia-smi nvlink --status -i 0      # NVLink status for GPU 0
nvidia-smi nvlink --errorcounters -i 0  # NVLink error counts

# InfiniBand port health
ibstat                               # IB HCA status
ibstatus                             # IB HCA status (shorter)
ibportstate 0 1                      # port state for port 1 of HCA 0
perfquery                            # port performance counters

# IB bandwidth benchmark
ib_write_bw                          # measure IB write bandwidth
ib_write_lat                         # measure IB write latency
# Nebius uses these as standard health checks
```

---

## Part 2: InfiniBand — The Networking Backbone for GPU Clusters

### What Is InfiniBand?

InfiniBand is a high-performance network technology designed from scratch for HPC (High-Performance Computing). Unlike Ethernet which evolved from LAN technology, InfiniBand was built with three priorities:
1. **Extremely low latency:** 3–5 microseconds port-to-port (vs 20–80µs for 100G Ethernet)
2. **Very high bandwidth:** 200 Gbps (HDR) to 800 Gbps (NDR) per port
3. **RDMA:** Remote Direct Memory Access — one GPU can write to another GPU's memory without involving the destination CPU

**Why RDMA matters for AI training:**
In a distributed training all-reduce operation:
- With TCP/Ethernet: GPU memory → CPU → kernel TCP stack → NIC → wire → NIC → kernel → CPU → GPU memory (~10µs + software overhead)
- With RDMA: GPU memory → RDMA engine in NIC → wire → RDMA engine in NIC → GPU memory (~3µs, no CPU involvement)

For a 70B parameter model with 140GB of weight gradients synchronized every iteration, this difference is massive.

### InfiniBand Architecture

```
GPU Cluster (Fat Tree Topology)
                    
    [Core Switch 1]  [Core Switch 2]
          │                │
    ─────────────────────────────
    │              │             │
[Spine Switch 1] [Spine Switch 2] [Spine Switch 3]
    │         ─────┘        ─────┘
    │        │             │
[Leaf Switch] [Leaf Switch] [Leaf Switch]
   │  │         │  │           │  │
[GPU][GPU]   [GPU][GPU]     [GPU][GPU]
   (Node 1)    (Node 2)       (Node 3)
```

**Fat Tree topology:** Non-blocking bandwidth between any two nodes. Every path from leaf to leaf has the same bandwidth. This ensures all-reduce operations do not have bottleneck links.

### RoCE — InfiniBand-Style RDMA over Ethernet

Nebius also uses **RoCE (RDMA over Converged Ethernet)** with NVIDIA Spectrum-X as an alternative to InfiniBand:
- Same RDMA capabilities as InfiniBand
- Uses standard Ethernet cabling and switches
- Lower cost than InfiniBand at moderate scale
- Requires Priority Flow Control (PFC) and ECN (Explicit Congestion Notification) for reliable operation
- NVIDIA Quantum-2 InfiniBand vs Spectrum-X Ethernet are Nebius's two network options

### InfiniBand Troubleshooting

```bash
# Check IB fabric health
ibdiagnet                        # comprehensive fabric diagnostic
ibswitches                       # list all switches in fabric
ibrouters                        # list routers (rarely used)
iblinkinfo                       # all link states and speeds

# Port state
ibportstate <lid> <port>
# Expected: LinkUp, Active, Active (physical, logical, subnet)

# Check for degraded links
iblinkinfo | grep -v "==4X  25.781 Gbps"   # shows non-HDR links

# Performance counters
perfquery <lid> <port>
# Look for: PortXmitDiscards, PortRcvErrors, LinkErrorRecovery, SymbolErrorCounter
# Any non-zero errors = investigate

# Bandwidth test between two nodes
# On receiver:
ib_write_bw -d mlx5_0
# On sender:
ib_write_bw -d mlx5_0 <receiver-ip>

# Expected for HDR200 (200 Gbps): ~23,000 MB/s
# Expected for NDR800 (800 Gbps): ~90,000 MB/s
# If measured value is <80% of expected: link degradation

# Check for IB routing issues
ibping <lid>                     # ping a node by LID
ibtracert <lid>                  # trace route through fabric
```

### NCCL (NVIDIA Collective Communications Library)

NCCL implements collective operations (all-reduce, broadcast, all-gather) used by PyTorch and TensorFlow for distributed training.

```bash
# NCCL debug logging (set in environment before training job)
export NCCL_DEBUG=INFO           # basic NCCL messages
export NCCL_DEBUG=WARN           # only warnings and errors
export NCCL_DEBUG_SUBSYS=ALL     # very verbose

# NCCL IB transport selection
export NCCL_IB_HCA=mlx5_0       # force specific HCA
export NCCL_IB_DISABLE=0        # enable IB (default if IB available)
export NCCL_P2P_DISABLE=0       # enable NVLink P2P (default)

# NCCL bandwidth test
nccl-tests/build/all_reduce_perf -b 8 -e 512M -f 2 -g 8
# Tests all-reduce from 8 bytes to 512MB, doubling each time, 8 GPUs
# Key metric: busbw (bus bandwidth) — should be near IB link speed
```

---

## Part 3: Distributed Training — Failure Modes and Operations

### How Distributed Training Works

**Data Parallelism (most common):**
- Each GPU gets a copy of the model
- Dataset is split across GPUs (each GPU sees different batches)
- After forward+backward pass, gradients are synchronized via all-reduce
- All GPUs update their models identically

```
GPU 0: batch 0 → forward → backward → gradients
GPU 1: batch 1 → forward → backward → gradients
...
GPU 7: batch 7 → forward → backward → gradients
                                ↓
                    All-reduce: sum gradients across all GPUs
                                ↓
                    Each GPU updates model with summed gradients
```

**Tensor Parallelism (for very large models):**
- A single model layer is split across GPUs
- Requires extremely fast GPU-to-GPU communication (NVLink)
- All 8 GPUs in a node compute parts of the same layer simultaneously

**Pipeline Parallelism:**
- Different model layers on different GPUs
- Micro-batches flow through the pipeline
- GPUs are rarely all working simultaneously (bubble overhead)

### Distributed Training Failure Modes

**Worker crash:**
- One process dies (OOM, CUDA error, kernel kill)
- Training job hangs — other workers are waiting for the failed worker in all-reduce
- Recovery: detect via timeout, checkpoint the state, restart the failed worker from checkpoint

**Straggler node:**
- One GPU/node is slow (thermal throttle, PCIe degradation, slower DRAM)
- All-reduce is synchronous — the fastest workers wait for the slowest
- Recovery: identify via per-worker timing, check hardware health, replace if persistent

**Network congestion:**
- IB fabric congestion causes packet drops or retransmissions
- all-reduce latency spikes → training throughput drops
- Check: `perfquery` for PortXmitDiscards, NCCL_DEBUG for timeout messages

**CUDA error mid-training:**
```
RuntimeError: CUDA error: device-side assert triggered
# This is a GPU computation error, often:
# - NaN in gradients (learning rate too high, missing gradient clipping)
# - Invalid memory access in CUDA kernel
# - GPU soft error (ECC correctable, usually harmless)

# After CUDA error: job should checkpoint, node should be health-checked
# Persistent CUDA errors → DCGM diagnostic → XID check
```

### Checkpointing Strategy

Checkpointing is saving training state to persistent storage so a failure can resume from a checkpoint rather than restarting from scratch.

**What to checkpoint:**
- Model weights (the most important)
- Optimizer state (momentum, Adam m/v vectors)
- Training step count
- RNG state (for reproducibility)
- DataLoader state (to resume from same position in dataset)

**Checkpoint frequency tradeoffs:**
- Too infrequent: lose hours of work on failure
- Too frequent: checkpoint I/O stalls training, wastes GPU time

**Nebius's approach:**
- On detecting a hardware fault, emit SIGTERM to the training process
- Training process has a signal handler that triggers an emergency checkpoint
- Node replacement happens while checkpoint is being saved
- Training resumes on new node from checkpoint

```python
# Signal handler for graceful checkpoint on SIGTERM
import signal, sys, torch

def save_checkpoint(model, optimizer, step, path):
    torch.save({
        'step': step,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
    }, path)

def sigterm_handler(signum, frame):
    print("SIGTERM received — saving checkpoint before exit")
    save_checkpoint(model, optimizer, current_step, '/checkpoint/latest.pt')
    sys.exit(0)

signal.signal(signal.SIGTERM, sigterm_handler)
```

---

## Part 4: LLM Inference Platform (Token Factory)

### How LLM Inference Works

Running inference on a large language model is different from training:
- **No gradient computation** — just forward pass
- **Memory bound, not compute bound** — loading 70B × 2 bytes (FP16) = 140GB per request start
- **KV cache** — the key/value attention states from prior tokens are cached to avoid recomputation
- **Autoregressive generation** — each token depends on all previous tokens

**Two phases:**
1. **Prefill:** Process the prompt (all input tokens at once). Computationally intensive. Parallelizable across tokens.
2. **Decode:** Generate output tokens one by one. Memory bandwidth bound. Sequential.

This is why Nebius separates prefill and decode onto different resources — they have different hardware requirements.

### vLLM Architecture

vLLM is the most widely used LLM inference serving framework. Key innovations:

**PagedAttention:** KV cache is managed in fixed-size pages (like OS virtual memory), allowing the system to:
- Allocate KV cache pages on demand (no pre-allocation per request)
- Share KV cache pages between requests with the same prefix (KV cache sharing)
- Achieve much higher throughput than naive implementations

```python
# vLLM inference example (how it's invoked)
from vllm import LLM, SamplingParams

llm = LLM(model="meta-llama/Llama-3-70b-instruct", 
          tensor_parallel_size=8,      # split model across 8 GPUs
          gpu_memory_utilization=0.90)  # use 90% of GPU memory for KV cache

outputs = llm.generate(
    ["Explain InfiniBand networking"],
    SamplingParams(temperature=0.7, max_tokens=200)
)
```

**vLLM SRE concerns:**
- OOM: KV cache fills up → requests fail. Fix: reduce `gpu_memory_utilization`, enable preemption
- High latency: too many concurrent requests, decode phase bottlenecked on memory bandwidth
- Model loading time: 70B model at FP16 = 140GB. Loading takes minutes without optimizations (quantization, lazy loading)

### KV Cache-Aware Routing (Nebius's 50–60% Hit Rate)

When many users send similar prompts (same system prompt, same few-shot examples), their KV cache can be shared:
```
Request 1: "You are a helpful assistant. [unique user question A]"
Request 2: "You are a helpful assistant. [unique user question B]"
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
           Same prefix → same KV cache
```

Nebius's routing layer:
1. Hash the prompt prefix
2. Route to the server that already has that prefix in KV cache
3. Cache hit: skip prefill for the shared prefix, only compute decode
4. Cache miss: full prefill, cache the result

Result: 50–60% cache hit rate → 50–60% of requests skip expensive prefill → 2–3x throughput improvement

### Autoscaling Inference Workloads

```yaml
# HPA for inference deployment
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-inference-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-inference
  minReplicas: 2
  maxReplicas: 16
  metrics:
  - type: External
    external:
      metric:
        name: inference_queue_depth   # custom metric from Prometheus
      target:
        type: AverageValue
        averageValue: "10"            # scale when queue > 10 requests per replica
```

**Scale-to-zero challenge for GPU inference:**
- Cold start time for a 70B model: 3–5 minutes (load model from storage to GPU HBM)
- Cannot scale to zero for real user-facing services — need minimum warm replicas
- Nebius keeps "warm capacity" — pre-loaded model on standby GPUs

---

## Part 5: Soperator — Running HPC Inside Kubernetes

### What Problem Soperator Solves

HPC workloads traditionally use Slurm as their scheduler. Data scientists and HPC users expect:
- SSH into login nodes
- `srun`/`sbatch` job submission
- MPI, OpenMPI, NCCL collective communications
- Shared filesystem across all nodes

But cloud providers run Kubernetes, not bare-metal Slurm clusters. Soperator bridges this: it runs Slurm inside Kubernetes while preserving the Slurm user experience.

### Soperator Architecture

**Custom Resource: `SlurmCluster`**
```yaml
apiVersion: slurmops.nebius.com/v1
kind: SlurmCluster
metadata:
  name: my-hpc-cluster
spec:
  slurmVersion: "23.11"
  login:
    replicas: 2               # HA login nodes
    service: LoadBalancer     # external SSH access
  controller:
    replicas: 1               # Slurm controller
  workers:
    replicas: 32              # 32 Slurm worker nodes
    resources:
      nvidia.com/gpu: 8       # 8 GPUs per worker
    nodeSelector:
      nvidia.com/gpu.product: "NVIDIA-H100-80GB-HBM3"
  jail:
    storageClass: weka-fast   # shared filesystem for jail mount
    size: 10Ti
```

**The "jail" (shared filesystem + namespace isolation):**
```
Traditional Slurm node:
  - Dedicated VM/bare-metal with full OS
  - SSH directly to Slurm node

Soperator worker pod:
  - Kubernetes Pod running StatefulSet
  - Shared PV mounted at /
  - pivot_root changes / to the shared PV
  - PID namespace: Job sees PID 1 = Slurm daemon
  - Network namespace: Dedicated IP, RDMA-capable
  - User can SSH into login pod, run srun, which dispatches to worker pods
```

**Why `pivot_root` instead of `chroot`:**
`chroot` only changes the root for filesystem operations — the process still runs in the same mount namespace. `pivot_root` actually replaces the root filesystem mount point, moves the old root to a mount point, then unmounts it. This is what container runtimes do. More complete isolation.

### Soperator Node Autohealing

When a worker node fails (GPU error, kernel panic):
1. Soperator controller detects: Pod in `Error` or `OOMKilled` state, or Slurm node marked DOWN
2. Controller drains in-flight Slurm jobs (sends SIGTERM, waits for checkpoint)
3. Controller deletes the failed worker Pod
4. StatefulSet controller creates a replacement Pod
5. New Pod starts, mounts shared PV, joins Slurm cluster as a fresh node
6. Jobs that were checkpointed are resubmitted to the new node

---

## Part 6: Nebius's 5-Layer Fault Tolerance (System Design Reference)

This is Nebius's published reliability architecture. Know it deeply — it will be referenced in system design interviews.

### Layer 1: Multi-Stage Acceptance Testing
Before a GPU node enters service, it goes through:
1. **Factory testing:** NVIDIA burn-in at manufacturer
2. **Delivery testing:** Nebius re-runs DCGM diagnostics on delivery
3. **Pre-deployment:** Full GPU, CPU, memory, IB bandwidth tests
4. **Pre-provisioning:** Attach to cluster, run synthetic workload, verify performance
**Result:** Only GPUs that pass all four stages are put into production rotation.

### Layer 2: Continuous Health Monitoring
Running production nodes are monitored continuously:
- ECC single-bit errors: tracked, node flagged if rate exceeds threshold
- ECC double-bit errors: immediate taint (XID 48)
- NVLink bandwidth: tested via synthetic benchmark on schedule
- InfiniBand: port counters polled by `perfquery`, degraded links flagged
- Temperature and power: DCGM monitors thermal throttling events
- PCIe error counters: polled from `/sys/bus/pci/`

### Layer 3: Workload Isolation and Prevention
When monitoring detects an issue:
- Node is tainted (`nvidia.com/gpu-degraded: NoSchedule`) immediately
- In-flight training jobs receive SIGTERM for checkpoint
- New workloads are not scheduled on this node
- SLO timer starts for replacement

### Layer 4: Automated Node Replacement
- A buffer pool of pre-provisioned, fully tested replacement nodes is always ready
- When a node is condemned: replacement node is allocated from buffer
- Replacement node has all dependencies pre-installed (drivers, NCCL, framework)
- Node joins the cluster, becomes schedulable
- Condemned node is sent back for diagnostics/repair
- **Total time: ~12 minutes** (detection → replacement ready)

### Layer 5: End-to-End Observability
- Dashboards: Grafana showing fleet health, incident history, replacement rates
- Alerts: PagerDuty/Slack for P1 events
- Root cause tracking: each replacement is tagged with failure type
- Trend analysis: identify systematic issues (bad batch of GPUs, firmware version, deployment pattern)

---

## Part 7: Interview Questions + Strong Answers

### Q: "How would you detect a GPU hardware failure in production before it impacts a training job?"

"I would implement a multi-layer detection strategy:

**Layer 1 — Continuous passive monitoring:**
DCGM exporter running on every node exports to Prometheus. Alert rules on:
- `DCGM_FI_DEV_ECC_DBE_VOL_TOTAL > 0` → immediately page: unrecoverable memory error
- `DCGM_FI_DEV_ECC_SBE_VOL_TOTAL` rate increase → flag for investigation
- `DCGM_FI_DEV_GPU_TEMP > 85` → thermal alert, check cooling
- XID errors in dmesg → parsed by a log scraper, critical XID codes trigger alert

**Layer 2 — Active health checks:**
Schedule a weekly `dcgmi diag -r 3` (comprehensive diagnostic) during low-utilization windows. Also schedule hourly `ib_write_bw` tests between all node pairs to catch InfiniBand degradation early.

**Layer 3 — Workload-level telemetry:**
Monitor per-GPU utilization during training jobs. A GPU that drops to less than 50% utilization while others are at 95% is likely degraded (thermal throttle, PCIe issue, slow DRAM). Alert: `histogram_quantile(0.05, dcgm_sm_utilization)` below threshold per node during training.

**Layer 4 — Automatic response:**
When DCGM detects a critical error, a DaemonSet on each node runs a controller loop that:
1. Reads DCGM health status
2. If unhealthy: taints the node `nvidia.com/gpu-health: unhealthy: NoSchedule`
3. Triggers checkpoint signal to running workloads
4. Creates a `NodeReplacementRequest` custom resource
5. The node replacement operator handles provisioning from the buffer pool"

---

### Q: "A distributed training job is running 40% slower than expected. How do you diagnose it?"

"First I establish a baseline: what is 'expected' performance? If I have previous run metrics, I compare them. If not, the theoretical peak is based on hardware specs.

Then I look at three bottleneck categories:

**Compute bottleneck (are GPUs actually computing?):**
```bash
# Per-GPU utilization during the job
nvidia-smi dmon -s u -d 1 | head -50
# If SM utilization is <70%: the job is waiting for data or communication, not computing
```

**Data loading bottleneck (IO/CPU feeding the GPU):**
```bash
# CPU utilization on data loader workers
pidstat -u 1 | grep python
# Check DataLoader prefetch queue depth in application logs
# If CPUs are maxed: increase DataLoader workers, use faster storage, pre-process data
```

**Communication bottleneck (all-reduce is slow):**
```bash
# NCCL timing in logs
export NCCL_DEBUG=INFO
# Look for: "NCCL INFO AllReduce ... took Xms" — compare to bandwidth expectation

# IB bandwidth between nodes
ib_write_bw -d mlx5_0 <node2-ip>
# If below expected: check IB port errors, fabric congestion, ECMP routing

# Check for straggler (one slow node delays all)
# Compare per-node iteration times in training logs
```

**Most common root cause I've seen:** A single node with thermal throttling causes the entire job to run at 60% of the slowest node's speed. Identify with `dcgmi dmon -e 190,191` (GPU clock speeds) — throttled node shows lower clocks."

---

## Points to Remember

- ECC single-bit errors: track over time. Double-bit errors: immediate GPU replacement.
- XID 48 (DBE ECC) and XID 61 (controller halt) mean the GPU must be replaced.
- InfiniBand is not Ethernet. It is a different network stack with RDMA and its own management tools.
- NCCL all-reduce is synchronous — one slow GPU stalls all GPUs in the job.
- KV cache in vLLM is managed with PagedAttention — like virtual memory for attention states.
- Nebius's 5-layer fault tolerance achieves 12-minute MTTR via pre-provisioned spare nodes.
- Soperator uses `pivot_root` + namespaces to create isolated Slurm environments inside Kubernetes.
- Checkpointing strategy: frequency vs overhead tradeoff. SIGTERM handler for emergency checkpoint.
- DCGM is the primary GPU health monitoring tool. Run `dcgmi diag` regularly as preventive maintenance.
- RoCE requires PFC + ECN to prevent packet drops (unlike InfiniBand which has hardware flow control).

## What to Study Next

- [04-system-design.md](/docs/nebius/system-design) — Design the GPU cluster reliability system from scratch
- [02-kubernetes-cilium-production.md](/docs/nebius/kubernetes-cilium-production) — Kubernetes orchestration for GPU workloads
- [06-stress-interview-incident-response.md](/docs/nebius/stress-interview-incident-response) — Incident scenarios involving GPU failures
