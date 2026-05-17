---
title: "Linux Lab 3: Processes, cgroups, and Namespaces"
sidebar_position: 99
---

# Linux Lab 3: Processes, cgroups, and Namespaces

## Why This Matters In Production

Kubernetes says the pod is Running. The application team says it is slow. You SSH to the node and find nothing obviously wrong at first glance. This scenario plays out weekly in production GPU clusters and multi-tenant platforms. The gap between "pod is Running" and "application is healthy" lives entirely in Linux primitives: cgroups throttle CPU and memory silently, namespaces isolate the process's view of the system, and kernel scheduling decisions made at the node level are invisible to Kubernetes controllers. This lab builds the bridge.

## Prerequisites

- Completed Lab 01 and Lab 02, or comfortable with `top`, `ps`, `iostat`
- Basic familiarity with what a container is conceptually
- Has used `kubectl describe pod` before

## Time Estimate

60 minutes. The cgroup inspection steps require root access on a node — use a local Docker container or a VM if you do not have a Kubernetes node available.

---

## Part 1 — Beginner: Guided Walk-Through

### Step 1 — Find the Process From the Host: ps aux

```bash
$ ps aux | grep -E "PID|appserver|pytorch"
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
appuser    17842  0.4  2.1 12984320 1384448 ?   Sl   09:12  18:42 /app/appserver --config /etc/app/config.yaml
appuser    17901  0.1  0.8  8421376  524288 ?   Sl   09:12   4:11 /app/appserver --worker
root        1204  0.0  0.0  14432   1024 pts/0  S+   14:01   0:00 grep -E PID|appserver|pytorch
```

**What to read:**
- The process exists. `STAT` shows `Sl` — sleeping (`S`), multi-threaded (`l`). This is normal for a running application.
- `%CPU` is 0.4%. If the application is supposed to be doing work, 0.4% CPU could mean it is being throttled, not that it is idle. This is a critical distinction.
- `VSZ` is virtual memory (12 GB mapped). `RSS` is resident set — actual physical pages in RAM (1.35 GB). The gap between them is normal for large Java or Python processes that map memory lazily.

**CPU throttling vs CPU saturation:**
- **Saturation:** the process wants more CPU than exists. `%CPU` is pegged near 100%, load average is high.
- **Throttling:** a cgroup limit caps how much CPU the process can use per period. The process is forced to sleep even when CPUs are free. `%CPU` looks low. The host looks idle. The application is slow. This is the deceptive case.

---

### Step 2 — Inspect Scheduling State More Carefully: pidstat

```bash
$ pidstat -u 1 5 -p 17842
Linux 5.15.0-91-generic (gpu-node-07)   04/09/2026   _x86_64_   (16 CPU)

14:32:01      UID       PID    %usr %system  %guest   %wait    %CPU   CPU  Command
14:32:02     1001     17842    3.00    0.00    0.00   78.42    3.00     4  appserver
14:32:03     1001     17842    4.00    1.00    0.00   82.14    5.00     4  appserver
14:32:04     1001     17842    2.00    0.00    0.00   76.88    2.00     4  appserver
14:32:05     1001     17842    3.00    1.00    0.00   80.33    4.00     4  appserver
14:32:06     1001     17842    4.00    0.00    0.00   79.71    4.00     4  appserver
```

**The `%wait` column is the signal.** 78-82% of the time, this process is runnable but waiting to be scheduled. The CPU is not busy (host `%idle` was 60% in `top`). This is CPU throttling by a cgroup, not CPU saturation. The process is ready to run but the cgroup scheduler is holding it back.

**How to tell the difference:**
- Throttling: `%wait` is high, host CPU idle is also high, load average is moderate.
- Saturation: `%wait` is high, host CPU idle is near 0%, load average exceeds CPU count.

---

### Step 3 — Confirm Cgroup Throttling: Inspect The Cgroup

First, find the process's cgroup:

```bash
$ cat /proc/17842/cgroup
12:memory:/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container
10:cpu,cpuacct:/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container
8:blkio:/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container
```

Now inspect the CPU throttle counters:

```bash
$ cat /sys/fs/cgroup/cpu,cpuacct/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container/cpu.stat
nr_periods 18241
nr_throttled 14092
throttled_time 82914731948
```

**What to read:**
- `nr_periods`: number of CFS scheduling periods elapsed. Each period is typically 100ms.
- `nr_throttled`: periods in which the container was throttled. 14092 out of 18241 = **77% of all periods**, the container was penalized and forced to sleep.
- `throttled_time`: total nanoseconds spent throttled. 82.9 seconds total across those periods.

This confirms the hypothesis from `pidstat`. The container has a CPU limit that is too low for the workload.

---

### Step 4 — Find the Limit Set By Kubernetes

```bash
$ cat /sys/fs/cgroup/cpu,cpuacct/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container/cpu.cfs_quota_us
200000

$ cat /sys/fs/cgroup/cpu,cpuacct/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container/cpu.cfs_period_us
100000
```

**How Kubernetes CPU limits translate to cgroups:**
- `cpu.cfs_period_us` = 100000 microseconds (100ms period)
- `cpu.cfs_quota_us` = 200000 microseconds (200ms of CPU time allowed per 100ms period)
- Effective limit = quota / period = 200000 / 100000 = **2.0 CPUs**

The pod has `resources.limits.cpu: "2"` in its spec. On a 16-core host, the pod is limited to 2 cores regardless of how many idle cores exist. When the application needs 6 cores to process a batch, it gets throttled down to 2.

---

### Step 5 — Inspect Namespaces: lsns

```bash
$ lsns -p 17842
        NS TYPE   NPROCS   PID USER     COMMAND
4026531835 cgroup      4 17842 appuser  /app/appserver --config /etc/app/config.yaml
4026531836 ipc         4 17842 appuser  /app/appserver --config /etc/app/config.yaml
4026532841 mnt         4 17842 appuser  /app/appserver --config /etc/app/config.yaml
4026532842 uts         4 17842 appuser  /app/appserver --config /etc/app/config.yaml
4026532843 pid         4 17842 appuser  /app/appserver --config /etc/app/config.yaml
4026532133 net         4 17842 appuser  /app/appserver --config /etc/app/config.yaml
```

**What each namespace isolates:**
- `mnt` — the mount namespace gives the container its own filesystem view. `/proc` inside the container shows only that container's processes.
- `pid` — PID namespace means PID 1 inside the container is not actually init on the host. `ps` inside the container shows a different PID 1 than the host.
- `net` — network namespace gives the container its own network interfaces, routing table, and iptables rules. The host's interfaces are not visible inside.
- `ipc` — IPC namespace isolates shared memory segments and semaphores.
- `uts` — UTS namespace isolates hostname and domain name. The container can have a different hostname than the host.
- `cgroup` — the container's cgroup namespace means it sees itself as the root of the cgroup hierarchy.

**Why this matters for debugging:** When you run `ps aux` from inside a container, you only see processes in that PID namespace. When you run it from the host, you see everything. For cross-namespace debugging, always use the host vantage point.

---

### Step 6 — Check Memory Pressure: Memory Cgroup

```bash
$ cat /sys/fs/cgroup/memory/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container/memory.usage_in_bytes
3623878656

$ cat /sys/fs/cgroup/memory/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container/memory.limit_in_bytes
4294967296

$ cat /sys/fs/cgroup/memory/kubepods/burstable/pod8a4f1234-bc12-4d78-9a01-f2c3d4e5f678/abc123container/memory.stat
cache 1048576000
rss 2575302656
mapped_file 41943040
pgfault 1842190
pgmajfault 8412
inactive_anon 2148532224
active_anon 426770432
inactive_file 524288000
active_file 524288000
unevictable 0
hierarchical_memory_limit 4294967296
total_pgmajfault 8412
```

**What to read:**
- Usage: 3.37 GB. Limit: 4 GB. The container is at 84% of its memory limit.
- `pgmajfault` = 8412 major page faults. A major fault means the kernel had to fetch a page from disk (not from cache). High major faults under memory pressure indicate the kernel is thrashing pages in and out.
- The container has not been OOM-killed yet, but it is close enough that memory allocation failures could start returning ENOMEM to the application, causing subtle errors rather than a hard crash.

---

## Part 2 — Intermediate: Directed Analysis

Run these commands and interpret:

```bash
# What are all the namespaces on this host?
lsns

# How many threads does a process have?
ls /proc/17842/task | wc -l

# What files does it have open?
ls -l /proc/17842/fd | head -20

# What syscalls is it making right now? (requires strace)
strace -p 17842 -c -T 10

# Check OOM score — how likely is the kernel to kill this process under pressure?
cat /proc/17842/oom_score
cat /proc/17842/oom_score_adj
```

Questions to answer:
1. A container has 1 CPU limit and the host has 32 cores all sitting idle. Why is the application slow?
2. What is the difference between a process being throttled and a process being scheduled normally at low priority (nice value)?
3. The `pgmajfault` counter in `memory.stat` is climbing by 200 per second. What does that mean for application latency?
4. You run `ps aux` inside the container and see only 3 processes. The host `ps aux` shows 400 processes. Is this a problem?

---

## Part 3 — Advanced / Stretch

**Scenario extension:** The application is GPU-bound. The pod has a GPU limit set. How does GPU throttling differ from CPU throttling?

1. Inspect GPU utilization and memory from the host:
   ```bash
   nvidia-smi
   nvidia-smi dmon -s u -d 1 -c 5
   ```
2. Check which processes have GPU context open:
   ```bash
   nvidia-smi --query-compute-apps=pid,used_memory --format=csv
   ```
3. For NVIDIA GPU operator environments, inspect device plugin allocations:
   ```bash
   ls /var/lib/kubelet/device-plugins/
   cat /var/lib/kubelet/pod-resources/kubelet.sock
   ```

**Reasoning exercises:**

- A pod has `cpu.request: 500m` and `cpu.limit: 2000m`. The pod is the only workload on a 4-core host. What is the maximum and minimum CPU it will receive?
- A container runs as PID 1 and catches SIGTERM. The Kubernetes `terminationGracePeriodSeconds` is 30. After 30 seconds, what signal does the process receive?
- Two containers in the same pod share the same network namespace but have separate PID namespaces. Can they communicate via `localhost`? Can one see the other's processes via `ps`?
- You want to `nsenter` into a container's network namespace from the host to run `tcpdump`. What is the command? What namespace type do you specify?

```bash
# Enter the container's network namespace from the host:
nsenter --target 17842 --net -- tcpdump -i eth0 -n port 8080
```

---

## Sample Incident Update

```
[14:45 UTC] Container slowness on gpu-node-07 — confirmed CPU throttling, not saturation.

Process appserver PID 17842 shows 78-82% wait time in pidstat (runnable but not scheduled).
Host CPU idle is 60% — CPUs are available but cgroup quota is consumed.
cpu.stat shows 77% of CFS periods throttled (14092/18241), 82.9s total throttle time.
Cgroup quota: 200ms/100ms period = 2.0 CPU limit. Application needs ~6 cores for batch work.
Memory: 3.37 GB / 4 GB limit, pgmajfault 8412 — minor memory pressure, not crisis.
Kubernetes pod status: Running (correct — kubelet sees no OOM or crash, just slow execution).

Hypothesis: CPU limit set to 2 CPUs is insufficient for batch processing mode.
Request: application team to either reduce batch concurrency or we raise CPU limit to 4.
No service impact to downstream clients yet — latency elevated but not timing out.
```

---

## Common Mistakes

- **Trusting `kubectl get pod` status.** Running means the container process exists, not that it is performing well. CPU throttling is invisible to Kubernetes.
- **Checking host CPU and concluding there is no problem.** Idle host CPUs cannot help a throttled cgroup. The cgroup quota is the constraint, not physical CPU availability.
- **Confusing high `%CPU` with bad health.** A GPU training process at 100% CPU is normal. A web server at 100% CPU is usually a bug.
- **Not knowing where cgroup files live.** v1 is under `/sys/fs/cgroup/<subsystem>/...`, v2 is a unified hierarchy at `/sys/fs/cgroup/` using `cpu.max` instead of `cpu.cfs_quota_us`. Know which version your nodes use.
- **Entering the container to debug instead of using the host.** For namespace and cgroup inspection, host vantage gives you the full picture. Inside the container you only see what the namespaces expose.
- **Confusing OOM kill with memory limit.** A container at 99% memory limit is not yet killed. It can run degraded (allocations failing) before the OOM killer fires.

---

## What To Study Next

- Foundation doc: 12-kubernetes-gpu-ai-platforms-and-operators.md — GPU resource management and device plugins
- Foundation doc: 02-linux-kubernetes-foundations.md — CFS scheduler, cgroup v2 unified hierarchy
- Practice: run `cat /proc/self/cgroup` inside a Docker container and trace the path to `/sys/fs/cgroup` on the host
- `man 7 namespaces` — comprehensive reference for all namespace types
- `nsenter` man page — critical for host-side debugging of containers
