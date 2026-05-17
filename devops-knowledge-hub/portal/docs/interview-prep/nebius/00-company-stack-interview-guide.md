---
title: "Nebius: Company, Stack, and Interview Guide"
sidebar_position: 0
---

# Nebius: Company, Stack, and Interview Guide

> Know who you are interviewing with as deeply as you know the technology they test you on.

---

## What Is Nebius?

Nebius Group (NASDAQ: NBIS) is a **full-stack AI cloud company** headquartered in Amsterdam. It emerged in 2024 from Yandex's international assets when Yandex divested its non-Russian operations under Western sanctions. The founding team of ~850+ engineers brought 15–20 years of hyperscale infrastructure experience from building Yandex Cloud.

**In plain terms:** Nebius is what you get when hyperscale infrastructure engineers decide to build a GPU cloud from scratch, specifically for AI workloads, without the general-purpose cloud baggage of AWS/GCP/Azure.

**Key facts:**
- 1,400+ employees, 400+ infrastructure/platform engineers
- Data centers: Finland (primary), New Jersey (US), Iceland (H200 cluster)
- Backed by NVIDIA ($2B), Meta (up to $27B), Microsoft ($19.4B)
- Revenue FY2025: $529.8M, growing 479% YoY
- ARR target: $7–9B by end of 2026

---

## What Nebius Actually Builds

Understanding their products tells you what their SREs operate every day.

### 1. GPU Compute (Core Product)
- **GPU fleet:** NVIDIA GB300 NVL72, HGX B300/B200/H200/H100 — multiple Blackwell generations
- First cloud globally to run GB300 NVL72 on 800 Gbps InfiniBand
- Bare-metal performance with KVM/QEMU virtualization for tenant isolation
- SREs manage the hypervisor layer, not just the orchestration layer

### 2. High-Speed Networking
- **InfiniBand:** NVIDIA Quantum-X800 at 800 Gbps, non-blocking fabric
- **RoCE:** RDMA over Converged Ethernet with Spectrum-X as alternative
- 3–5 microsecond latency (vs 20–80ms for standard Ethernet)
- RDMA for direct memory access without CPU involvement
- This is not your typical Kubernetes networking problem — it is physics-level engineering

### 3. Storage
- Proprietary shared filesystem: up to **1 TB/s read throughput**
- NFS at 12 GBps read per 8-GPU VM (vs AWS EFS max 1.5 GBps)
- Object storage at 2 GB/s per GPU
- WEKA and VAST Data integrations for enterprise use

### 4. Managed Kubernetes
- **Cilium CNI** with Hubble enabled by default — eBPF-based dataplane
- Hardware monitoring with automatic node tainting for faulty nodes
- HPA for autoscaling inference workloads
- Topology-aware scheduling for GPU job placement

### 5. Soperator (their open-source Kubernetes operator for Slurm)
- Runs Slurm workloads inside Kubernetes
- Node types: Login (SSH load-balanced), Controller, Worker (StatefulSets)
- "Jail" — shared PV mounted across nodes using Linux `pivot_root` + namespaces
- Inline health checks, node autohealing, topology-aware training job placement
- GitHub: `nebius/soperator`

### 6. Token Factory (LLM Inference Platform)
- Serves foundation models: text, vision, audio, multimodal
- KV cache-aware routing (cache hit rate tuned from 5% to 50–60%)
- Prefill/decode phase separation
- Dedicated inference endpoints with 99.9% uptime SLA
- vLLM, Triton, Ray Serve as serving backends

### 7. Reliability Model (The 5-Layer System)
Their published fault tolerance architecture — know this:
1. **Multi-stage acceptance testing:** factory → deployment → virtualization → pre-provisioning
2. **Passive + active health monitoring:** continuous ECC error tracking, XID codes, NVLink bandwidth, IB counters
3. **Workload isolation and prevention:** automatic node draining, emergency checkpointing signals
4. **Automated node replacement:** spare buffer pool, pre-installed dependencies, fully automated
5. **End-to-end observability:** dashboards, Slack notifications, root-cause tracking

**MTTR: 12 minutes** average from fault detection to replacement node provisioned. This is achieved by pre-staging replacement nodes, not by fixing broken nodes under pressure.

---

## The Interview Process (4 Stages)

Nebius publishes their SRE interview structure publicly. No secrets here.

### Stage 1 — Initial Interview (60–90 min)
**What happens:**
- Questions about your experience: languages, OS, databases, tools
- General questions on service management, Linux, networks
- One practical coding task
- One practical Linux console task

**What they are looking for:**
- Breadth — do you have real operational experience?
- How you think through problems, not just what you know
- Comfort with Linux terminal work under observation

**Preparation:**
- Be ready to explain any tool you mention at three levels: what it is, how it works internally, how you have used it at scale
- The Linux console task is often: given a symptom, diagnose it live

---

### Stage 2 — Technical Interview (60–90 min)
**What happens:**
- Deep dive: Linux internals, system calls, file descriptors
- 2 algorithm problems (Easy to Medium LeetCode difficulty)

**Confirmed question patterns:**
- "What would you do if you don't have the right permissions for a file your service needs, but `chmod` doesn't work?" (tests creative Linux problem-solving: ACLs, bind mounts, `nsenter`, capabilities, `chattr`)
- "Explain what happens when a process calls `open()`"
- "How does cgroup v2 limit CPU for a container?"
- "Walk me through the `/proc` filesystem — what can you find there?"

**Confirmed LeetCode problems (reported by candidates):**
- Pascal's Triangle
- Minimum Path Sum
- Maximum Units on a Truck
- Isomorphic Strings
- Custom Sort String

**What they are looking for:**
- Deep Linux systems knowledge, not surface-level familiarity
- Clean, readable code — not clever tricks
- Structured thinking when problem-solving

---

### Stage 3 — System Design (60–90 min)
**What happens:**
- Design a distributed system
- Evaluate overall system performance
- Estimate required computing resources

**Confirmed example prompt:**
- "Design a web app that counts square roots" — deceptively simple, tests scalability thinking

**What a Staff SRE candidate should expect:**
- Design a fault-tolerant GPU training cluster (they have published this architecture)
- Design an LLM inference platform at scale
- Design an observability pipeline for a 10,000+ GPU cluster

**What they are looking for:**
- Can you drive the design? Do you ask the right clarifying questions?
- Do you think about failure modes and recovery, not just the happy path?
- Can you estimate resource requirements with real numbers?
- Do you understand the Nebius reliability model (5-layer) as a design pattern?

---

### Stage 4 — Stress Interview (30 min)
**What happens:**
- Simulate a production incident in a deliberately pressured environment
- They may interrupt, add new information, or push back on your hypotheses

**What they are looking for:**
- Structured, hypothesis-driven debugging (not random command firing)
- Communication under pressure — can you narrate what you are doing and why?
- Prioritization — what do you check first and why?
- Composure — do you slow down when overwhelmed or speed up and make mistakes?

**The winning pattern:**
```
"I observe X symptom. My first hypothesis is Y because Z.
To confirm, I will run [command] and look for [specific output].
While I confirm that, the immediate mitigation I would consider is A.
If Y is wrong, my next hypothesis is B."
```

---

## What the Six Competency Dimensions Mean

Nebius assesses all candidates on six explicit dimensions. Know what each one actually requires:

### 1. Linux and Network Proficiency
**Not:** knowing commands  
**Actually:** understanding kernel subsystems — scheduler, memory management, VFS, cgroups, namespaces, TCP stack

### 2. Console Tools and Utilities
**Not:** knowing tool names  
**Actually:** live terminal work — diagnosing a problem with only terminal access, using `strace`, `ss`, `perf`, `dmesg`, `/proc`

### 3. Common Service Operation Issue Handling
**Not:** describing runbooks  
**Actually:** structured incident command — hypothesis, evidence, mitigation, escalation, post-mortem thinking

### 4. Code Writing in Python or Go
**Not:** knowing syntax  
**Actually:** clean, production-quality automation scripts with error handling, retries, timeouts, structured logging

### 5. Service/System Design and Architecture
**Not:** drawing boxes  
**Actually:** designing for failure, estimating capacity, making tradeoffs explicit, thinking like an operator not an architect

### 6. Classical Algorithms and Data Structures
**Not:** grinding LeetCode  
**Actually:** clear problem decomposition, correct complexity analysis, readable implementation in one pass

---

## Recommended Books (From Nebius Directly)

Nebius publishes a reading list for SRE candidates. These are not suggestions — read the relevant chapters.

1. **"Systems Performance: Enterprise and the Cloud"** — Brendan Gregg  
   The single most important book. Covers USE method, flame graphs, every OS subsystem, BPF tools. Read chapters 1, 2, 5, 6, 7, 9.

2. **"The Linux Programming Interface"** — Michael Kerrisk  
   The definitive Linux systems programming reference. Focus on: processes, signals, file I/O, memory mapping, sockets, namespaces.

3. **"UNIX and Linux System Administration Handbook"** — Evi Nemeth et al.  
   Broad operational depth. Good for filling gaps in your mental model.

4. **"Practical Monitoring: Effective Strategies for the Real World"** — Mike Julian  
   Observability philosophy. Short, practical, and directly applicable to how Nebius builds observability into their reliability model.

5. **"Performance Analysis and Tuning on Modern CPUs"** — Denis Bakhvalov  
   CPU microarchitecture, cache effects, branch prediction. Relevant for GPU cluster operations and low-level performance debugging.

6. **Google SRE Book** (free at sre.google)  
   SLOs, error budgets, toil reduction, on-call culture. Know this framework cold.

---

## Tech Stack Summary (For Interview Context)

When they ask "tell me about your experience with X," these are the Xs that matter:

| Domain | Stack |
|--------|-------|
| Compute | QEMU/KVM, NVIDIA GPU drivers, DCGM, virtio |
| Container orchestration | Kubernetes, Helm, Kustomize |
| CNI | Cilium (eBPF dataplane, Hubble, NetworkPolicy) |
| GPU scheduling | NVIDIA device plugin, Node Feature Discovery, Kueue, topology-aware scheduling |
| AI workload orchestration | Soperator (Slurm in K8s), KubeFlow, Ray, SkyPilot |
| Inference serving | vLLM, Triton Inference Server, Ray Serve |
| Networking | InfiniBand (RDMA), RoCE, BGP, VPC, Cilium/eBPF |
| Observability | Prometheus, Grafana, Loki, Alertmanager, DCGM exporter, Hubble |
| IaC | Terraform |
| CI/CD | ArgoCD, GitHub Actions |
| Languages | Python (automation), Go (tooling) |
| Linux debugging | perf, eBPF/bpftrace, strace, ltrace, ss, ip, tcpdump, /proc, /sys |

---

## The One Thing That Separates Staff from Senior at Nebius

At the senior level, you solve problems. At the staff level, you prevent classes of problems and build systems that detect, isolate, and recover from failures automatically.

In the interview, this means:
- When you design something, explain how it fails and how it recovers
- When you debug something, explain what you would build so you never debug it manually again
- When you describe an incident, explain the detection gap and the systemic fix

Nebius's own 5-layer reliability model is the perfect example: they do not rely on humans to respond to GPU hardware failures fast enough — they built automation that detects, drains, and replaces nodes in 12 minutes with no human in the loop.

That is the mindset they want to see.
