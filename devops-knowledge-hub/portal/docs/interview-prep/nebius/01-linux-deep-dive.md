---
title: "Linux Systems Deep Dive — Nebius Level"
sidebar_position: 1
---

# Linux Systems Deep Dive — Nebius Level

> Nebius was built by Yandex engineers. They do not just use Linux — they debug it at the kernel level, tune it for GPU workloads, and run hypervisors on it. This is the highest-weighted area in their SRE interview bar.

---

## Mental Model

Linux is a collection of abstractions built on top of hardware. Every abstraction — a process, a file, a socket, a container — is a kernel-managed data structure with defined lifecycle, resource accounting, and failure modes.

When something breaks, the path to root cause always goes through one question:
> Which kernel subsystem is misbehaving, and what evidence can I find in `/proc`, `/sys`, or kernel logs?

---

## Part 1: Process Model (Beginner → Expert)

### What Is a Process?
A process is a running instance of a program. It has:
- A PID (process ID) — unique integer, assigned on `fork()`
- A virtual address space — isolated memory view
- File descriptors — open files, sockets, pipes
- A thread group (main thread + any spawned threads)
- Resource accounting (CPU, memory, I/O)
- A parent process (PPID) — all processes form a tree rooted at PID 1

**In `/proc/<pid>/`:**
```
/proc/1234/status      # human-readable state, memory, uid
/proc/1234/maps        # virtual memory map (segments)
/proc/1234/smaps       # detailed per-mapping memory stats
/proc/1234/fd/         # open file descriptors (symlinks)
/proc/1234/fdinfo/     # position, flags for each fd
/proc/1234/cmdline     # argv[0..n], null-separated
/proc/1234/environ     # environment variables
/proc/1234/stack       # kernel stack trace (need root)
/proc/1234/wchan       # kernel function process is sleeping in
/proc/1234/net/        # per-namespace network state
```

### Process States
```
R — Running or runnable (on run queue)
S — Interruptible sleep (waiting for event, wakes on signal)
D — Uninterruptible sleep (waiting for I/O, does NOT wake on signal)
Z — Zombie (exited, waiting for parent to call wait())
T — Stopped (SIGSTOP or debugger breakpoint)
```

**Why D state matters:**
A process in D state cannot be killed. It is waiting on a kernel I/O operation. High D state count = kernel I/O subsystem problem (disk, NFS, driver hang). This is not a CPU problem — it explains high load average with low CPU utilization.

### How `fork()` and `exec()` Work
```
fork()  — creates a copy-on-write clone of the calling process
           child gets same address space, fd table, but new PID
           memory is only physically copied when written (COW)

exec()  — replaces the current process's program image
           loads new binary, resets stack/heap, keeps PID and open fds
           this is how shells launch commands: fork then exec
```

**Why this matters for containers:** A container runtime calls `clone()` (Linux's extended fork) with namespace flags. The new "process" has isolated views of PID space, network, filesystem, and IPC.

---

## Part 2: Linux Namespaces (Beginner → Expert)

### What Are Namespaces?
Namespaces are a kernel mechanism that **wraps a global resource so each process sees its own isolated instance**. This is the foundation of containers.

There are 8 namespace types in Linux:

| Namespace | `clone()` flag | What it isolates |
|-----------|---------------|-----------------|
| `mnt` | `CLONE_NEWNS` | Filesystem mount table |
| `pid` | `CLONE_NEWPID` | Process ID space |
| `net` | `CLONE_NEWNET` | Network stack (interfaces, routes, iptables) |
| `ipc` | `CLONE_NEWIPC` | IPC: System V, POSIX message queues |
| `uts` | `CLONE_NEWUTS` | Hostname and domain name |
| `user` | `CLONE_NEWUSER` | UID/GID mapping (rootless containers) |
| `cgroup` | `CLONE_NEWCGROUP` | cgroup root view |
| `time` | `CLONE_NEWTIME` | Clock offsets (Linux 5.6+) |

### How Container Runtimes Use Namespaces

When Docker or containerd starts a container:
1. `clone()` is called with `CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC`
2. The new process sees: PID 1 as itself, its own network interface, its own filesystem root, its own hostname
3. `pivot_root()` or `chroot()` changes the filesystem root to the container image layer

**Soperator's "jail" uses the same mechanism:** worker nodes share a PV but each worker uses `pivot_root` + namespaces to isolate its execution environment.

### Inspecting Namespaces
```bash
# List namespaces of a process
ls -la /proc/<pid>/ns/

# List all namespaces in the system
lsns

# Enter a process's namespace
nsenter -t <pid> --net --pid --mount -- /bin/bash

# See which namespace a process is in (by inode)
readlink /proc/<pid>/ns/net
```

### User Namespaces (Important for Rootless Containers)
User namespaces allow a process to be "root" inside a container while mapping to an unprivileged UID on the host:
```
Container UID 0 → Host UID 100000 (defined in /etc/subuid)
```

This is how Podman runs rootless containers. The kernel enforces that the "root" inside the container has no privileges on the host.

---

## Part 3: cgroups v2 (Beginner → Expert)

### What Are cgroups?
Control groups (cgroups) allow the kernel to **limit, account for, and isolate resource usage** of process groups.

**cgroups v1:** Each resource controller (cpu, memory, blkio) had its own hierarchy. Complex, inconsistent.  
**cgroups v2:** Unified hierarchy. All controllers under one tree. Container runtimes (containerd, crun) use v2 exclusively since kernel 5.x.

### The cgroup Hierarchy
```bash
# The root cgroup
/sys/fs/cgroup/

# A container's cgroup (typical path)
/sys/fs/cgroup/system.slice/docker-<id>.scope/

# What's inside a cgroup directory
cat /sys/fs/cgroup/system.slice/memory.max        # memory limit
cat /sys/fs/cgroup/system.slice/cpu.max           # CPU bandwidth: "quota period"
cat /sys/fs/cgroup/system.slice/io.max            # block IO limits
cat /sys/fs/cgroup/system.slice/memory.current    # current memory usage
cat /sys/fs/cgroup/system.slice/cpu.stat          # CPU stats
cat /sys/fs/cgroup/system.slice/memory.stat       # detailed memory breakdown
```

### CPU Limiting with cgroups v2
```
cpu.max = "200000 1000000"
# This means: 200ms CPU time out of every 1000ms period = 0.2 CPU cores
```

**How it works internally:**
- CFS (Completely Fair Scheduler) uses a quota/period model
- When a cgroup exhausts its quota, processes are "throttled" — moved to D state until next period
- Throttling shows up as `cpu_throttled_seconds` in metrics — very useful for diagnosing Kubernetes CPU limits issues

### Memory Limiting and OOM
```
memory.max = 2G        # hard limit, OOM kill when exceeded
memory.high = 1.8G     # soft limit, triggers reclaim but no kill
memory.swap.max = 0    # disable swap for this cgroup
```

**OOM behavior:**
1. Process attempts allocation, fails
2. Kernel invokes OOM killer for the cgroup
3. OOM killer scores processes (RSS + penalty) and kills the highest scorer
4. `dmesg` shows: `OOM kill process <name> total-vm:<x>kB`

**Why containers get OOM killed:** A Java app's JVM allocates 2x its `-Xmx` for off-heap memory (metaspace, code cache, direct buffers). Setting Kubernetes `memory: 2Gi` limit with a JVM configured for 2GB heap = OOM kill.

### Inspecting cgroups
```bash
# See cgroup v1 or v2
cat /proc/filesystems | grep cgroup
stat /sys/fs/cgroup                          # type tmpfs = v1, type cgroup2 = v2

# Find a process's cgroup
cat /proc/<pid>/cgroup

# Current memory use in a container cgroup
cat /sys/fs/cgroup/kubepods/pod<uid>/<container-id>/memory.current

# PSI (Pressure Stall Information) — available in cgroups v2
cat /sys/fs/cgroup/kubepods/.../cpu.pressure
cat /sys/fs/cgroup/kubepods/.../memory.pressure
cat /sys/fs/cgroup/kubepods/.../io.pressure
```

**PSI explained:** A value like `some avg10=12.34` means 12.34% of time in the last 10 seconds, at least one task was stalled waiting for this resource. This is far more useful than `top`'s CPU% for diagnosing resource saturation.

---

## Part 4: System Calls and File Descriptors (Beginner → Expert)

### What Is a System Call?
A syscall is the interface between user space and kernel space. User code cannot directly access hardware or kernel data structures — it must ask the kernel.

**The mechanics:**
1. User code calls a C library wrapper (e.g., `write()`)
2. Wrapper sets up registers and executes `syscall` instruction (x86-64)
3. CPU switches from ring 3 (user) to ring 0 (kernel)
4. Kernel validates arguments, performs operation, returns result
5. CPU switches back, return value is in `rax` register

**Why this matters for SRE:** Every file open, network send, and timer create is a syscall. `strace` intercepts all syscalls for a process, making it the most powerful single-process debugger available without writing code.

### File Descriptors
Every open file, socket, pipe, or device is represented by a file descriptor — a small integer index into the process's fd table.

```
fd 0 = stdin
fd 1 = stdout
fd 2 = stderr
fd 3+ = first open file/socket/pipe
```

**Inspecting file descriptors:**
```bash
# List open fds for a process
ls -la /proc/<pid>/fd/
lsof -p <pid>

# Count open fds (useful for fd leak detection)
ls /proc/<pid>/fd | wc -l

# See fd limit
cat /proc/<pid>/limits | grep "open files"
ulimit -n                    # per-shell limit
cat /proc/sys/fs/file-max    # system-wide limit
```

**Fd leak scenario:** A service opens log files but never closes them. Over hours, `ls /proc/<pid>/fd | wc -l` grows without bound. Eventually hits `ulimit -n` and the service starts failing with `Too many open files`. Fix: audit the code for missing `close()` / `with` statements, increase limit as temp mitigation.

### Key Syscalls to Know for SRE Debugging

| Syscall | What It Does | Why It Matters |
|---------|-------------|----------------|
| `open()` / `openat()` | Opens a file | fd leaks, permission errors, ENOENT |
| `read()` / `write()` | I/O on fd | blocks when kernel buffer is full |
| `mmap()` | Maps file/memory into address space | JVM, shared memory, huge pages |
| `clone()` | Creates process/thread/container | container startup, thread creation |
| `execve()` | Executes a program | shell commands, container entrypoint |
| `epoll_wait()` | Event notification for multiple fds | async I/O, event loops (nginx, Go runtime) |
| `futex()` | Fast userspace mutex | contention shows as blocked threads |
| `inotify_add_watch()` | File system event notification | log rotation, config reload |
| `accept()` / `connect()` | TCP connection lifecycle | connection pool exhaustion |
| `sendfile()` | Zero-copy file transfer | nginx static file serving |

### Debugging with strace
```bash
# Attach to running process, see all syscalls
strace -p <pid>

# Count syscalls (profile mode)
strace -c -p <pid>

# See timing between syscalls (find slow operations)
strace -T -p <pid>

# Trace only specific syscalls
strace -e trace=read,write,open -p <pid>

# Trace a new process and all its children
strace -f -e trace=network ./my-app

# Common pattern: find why app is slow
strace -T -p <pid> 2>&1 | sort -t'<' -k2 -n | tail -20
# This shows the 20 slowest syscalls
```

---

## Part 5: Linux Performance Tools — USE Method

### The USE Method (Brendan Gregg, Netflix)
For every resource, check: **Utilization, Saturation, Errors**

| Resource | Utilization | Saturation | Errors |
|----------|------------|-----------|--------|
| CPU | `mpstat`, `top` %cpu | `vmstat` r (run queue) | `dmesg` MCE |
| Memory | `free` used/total | `vmstat` si/so (swap), PSI | OOM kills in dmesg |
| Disk I/O | `iostat` %util | `iostat` await, queue | `dmesg` I/O errors |
| Network | `sar -n DEV` %ifutil | `netstat -s` retransmits | `ip -s link` errors |

### CPU Performance Tools
```bash
# Load average context (1/5/15 min)
uptime
# Rule: load > nCPU = saturation

# Per-CPU utilization
mpstat -P ALL 1

# Who is using CPU right now
top                      # interactive
pidstat -u 1             # per-process, non-interactive
ps aux --sort=-%cpu | head

# CPU flame graph (Brendan Gregg method)
perf record -F 99 -a -g -- sleep 30    # sample at 99 Hz
perf script | ./stackcollapse-perf.pl | ./flamegraph.pl > flame.svg

# CPU throttling in containers/cgroups
cat /sys/fs/cgroup/kubepods/.../cpu.stat | grep throttled

# Hardware performance counters
perf stat -e cache-misses,cache-references,instructions,cycles ./app
```

### Memory Performance Tools
```bash
# Quick overview
free -h
vmstat 1 5              # si/so = swap in/out
cat /proc/meminfo

# Detailed memory breakdown
cat /proc/meminfo | grep -E 'MemFree|Cached|Buffers|Slab|Dirty|Writeback'

# Find memory-hungry processes
ps aux --sort=-%mem | head
cat /proc/<pid>/smaps | grep -E 'Size:|Rss:|Pss:' | awk '{s+=$2} END {print s/1024 "MB"}'

# Memory pressure
cat /proc/pressure/memory          # PSI
cat /proc/buddyinfo                # page allocator state
cat /proc/slabinfo | sort -k3 -rn | head  # kernel slab allocations

# Huge pages (important for GPU workloads)
cat /proc/meminfo | grep Huge
hugeadm --pool-list
echo 512 > /proc/sys/vm/nr_hugepages   # allocate huge pages
```

### I/O Performance Tools
```bash
# Block device stats
iostat -xz 1 5
# %util > 80% = device saturated
# await > r_await or w_await = distinguish read vs write latency

# I/O per process
iotop -o -b -n 5        # top-like, batch mode

# Block I/O latency distribution (eBPF)
biolatency                    # requires bpftools
bpftrace -e 'kprobe:blk_account_io_done { @[comm] = hist(nsecs); }'

# Filesystem-specific
df -h && df -i          # disk and inode usage
cat /proc/diskstats     # raw block device statistics
```

### Network Performance Tools
```bash
# Interface stats
ip -s link
sar -n DEV 1 5          # network interface utilization

# TCP stats
ss -s                   # summary
ss -tan state TIME-WAIT | wc -l    # TIME_WAIT count
netstat -s | grep -i retransmit    # retransmit count

# Per-connection detail
ss -tanp                # all TCP sockets with process

# Kernel TCP parameters
sysctl net.core.somaxconn          # listen backlog
sysctl net.ipv4.tcp_tw_reuse       # TIME_WAIT reuse
sysctl net.netfilter.nf_conntrack_count   # conntrack entries used
sysctl net.netfilter.nf_conntrack_max     # conntrack max

# DNS resolution timing
time nslookup google.com
dig +stats google.com
```

---

## Part 6: eBPF — What It Is and How to Use It

### What Is eBPF?
eBPF (extended Berkeley Packet Filter) is a Linux kernel feature that lets you run sandboxed programs in the kernel in response to events — without writing kernel modules and without rebooting.

**Before eBPF:** Adding observability to the kernel meant writing kernel modules (risky, fragile, version-dependent) or recompiling the kernel.

**With eBPF:** You write a small program, the kernel verifies it is safe (no loops, bounded execution, no illegal memory access), and attaches it to a kernel event. The program runs every time the event fires.

**This is why Cilium exists:** Cilium replaces iptables with eBPF programs attached to network hooks, giving O(1) lookup vs iptables' O(n) rule chain traversal.

### eBPF Attachment Points
- **kprobe/kretprobe:** Attach to any kernel function entry/return
- **tracepoint:** Stable kernel trace events (preferred over kprobes)
- **uprobe/uretprobe:** Attach to user-space function entry/return
- **XDP (eXpress Data Path):** Earliest possible packet hook, before sk_buff allocation
- **TC (Traffic Control):** After packet is in kernel networking, before routing
- **socket filters:** Filter packets for specific sockets
- **perf events:** Sampling-based profiling

### bpftrace — Quick eBPF Scripting
```bash
# Trace all execve() calls (every command that runs)
bpftrace -e 'tracepoint:syscalls:sys_enter_execve { printf("%s\n", str(args->filename)); }'

# Trace TCP connection accepts
bpftrace -e 'kretprobe:inet_csk_accept { printf("accept: %s\n", comm); }'

# Profile CPU usage by function (sample every 99ms)
bpftrace -e 'profile:hz:99 { @[kstack] = count(); }'

# Watch file opens
bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%s opens %s\n", comm, str(args->filename)); }'

# Measure block I/O latency
bpftrace -e 'kprobe:blk_account_io_start { @start[arg0] = nsecs; }
kprobe:blk_account_io_done /@start[arg0]/ { @lat = hist(nsecs - @start[arg0]); delete(@start[arg0]); }'

# Find processes causing page faults
bpftrace -e 'software:page-faults:100 { @[comm, pid] = count(); }'
```

### BCC Tools (Higher-level eBPF)
```bash
# CPU profiling (flame graph data)
profile -F 99 -a 30     

# TCP connection tracing
tcpconnect              # new outbound connections
tcpaccept               # new inbound connections
tcpretrans              # TCP retransmissions

# File I/O tracing
opensnoop               # all file opens
filetop                 # top files by I/O

# Memory
memleak                 # detect memory leaks

# Latency
runqlat                 # run queue latency histogram
biolatency              # block I/O latency histogram
```

---

## Part 7: QEMU/KVM Virtualization (Nebius-Specific)

### Why This Matters at Nebius
Nebius uses QEMU/KVM to virtualize their GPU compute nodes. Their Compute Node SRE team maintains the hypervisor layer. You need to understand how VMs work at this level.

### KVM Architecture
```
┌─────────────────────────────────┐
│  Guest OS (VM)                  │
│  ┌─────────────────────────┐    │
│  │ Application              │    │
│  │ Guest kernel (ring 0)    │    │  ← Guest thinks it's ring 0
│  └────────────┬────────────┘    │
│               │ VM exits         │
└───────────────┼─────────────────┘
                │
┌───────────────▼─────────────────┐
│  KVM (kernel module)            │
│  Handles VM exits, VMCS         │
│                                 │
│  QEMU (user space)              │
│  Device emulation, I/O, mgmt   │
└─────────────────────────────────┘
```

**KVM:** Linux kernel module that enables hardware virtualization (Intel VT-x, AMD SVM). Uses VMCS (Virtual Machine Control Structure) to save/restore guest state on VM exits.

**QEMU:** User-space process that emulates hardware devices (VirtIO NIC, disk, GPU passthrough). Communicates with KVM via `/dev/kvm` ioctl calls.

### VM Exit — The Critical Concept
A "VM exit" is when the guest CPU stops executing guest code and gives control back to KVM:
- Guest executes a privileged instruction (I/O port, MSR write, CPUID)
- Guest triggers an interrupt that KVM needs to handle
- VMX preemption timer fires (time slice expired)

**VM exit overhead:** Each VM exit takes 1,000–10,000 ns (1–10 µs). For GPU workloads, you want to minimize exits — this is why virtio drivers are used instead of emulated hardware (virtio uses shared memory and batch notification instead of per-I/O exits).

### VirtIO
```
virtio-net:   Virtual NIC with direct memory access, no per-packet exit
virtio-blk:   Virtual disk with batch I/O queue, efficient for SSDs
virtio-mem:   Hot-pluggable memory
vhost-net:    Kernel-level virtio-net processing (fewer kernel/user switches)
vhost-user:   User-space vhost (DPDK, SPDK for high-performance I/O)
```

### CPU Pinning and NUMA Topology
For GPU workloads, incorrect NUMA topology causes significant performance degradation:
```bash
# Check NUMA topology
numactl --hardware
lscpu | grep -E 'NUMA|Socket|Core'

# Pin VM to specific NUMA node
numactl --cpunodebind=0 --membind=0 -- qemu-system-x86_64 [options]

# In libvirt XML (Nebius uses declarative VM config)
# <vcpupin vcpu='0' cpuset='0-7'/>
# <numatune><memory mode='strict' nodeset='0'/></numatune>

# Check if VM is NUMA-aware
virsh numatune <vm-name>
```

**Why this matters for Nebius:** GPU PCIe slots are connected to specific CPUs via PCIe lanes. A GPU VM's vCPUs must be pinned to the CPU that owns that GPU's PCIe root complex, or data transfer goes through the remote CPU, adding ~100ns latency per transfer.

### GPU Passthrough (PCIe passthrough / VFIO)
```bash
# Check if IOMMU is enabled (required for GPU passthrough)
dmesg | grep -i iommu
cat /proc/cmdline | grep iommu   # intel_iommu=on or amd_iommu=on

# Find GPU IOMMU group
for d in /sys/kernel/iommu_groups/*/devices/*; do
  echo "$(basename $(dirname $(dirname $d))): $(lspci -nns $(basename $d))"
done | grep -i nvidia

# VFIO passthrough: all devices in same IOMMU group must be passed together
# Unbind from nvidia driver, bind to vfio-pci
echo "10de 2204" > /sys/bus/pci/drivers/vfio-pci/new_id  # RTX 3090 example
```

### Debugging VM Performance Issues
```bash
# VM exit statistics (KVM counters)
cat /sys/kernel/debug/kvm/exits    # total exits
cat /sys/kernel/debug/kvm/*        # all KVM debug counters

# Perf on KVM
perf kvm stat record sleep 30
perf kvm stat report

# Find noisy VMs
virsh list
virsh domstats <vm>
virsh schedinfo <vm>

# Check for memory balloon pressure (guest being compressed)
virsh dommemstat <vm>

# QEMU process, confirm it is using KVM acceleration
ls -la /proc/<qemu-pid>/fd | grep kvm
```

---

## Part 8: Nebius-Level Interview Questions + Strong Answers

### Q: "What would you do if you don't have the right permissions for a file your service needs, but chmod doesn't work?"

This is a Stage 2 question. "chmod doesn't work" means the standard POSIX permission model is insufficient or broken. Explore alternatives:

```
1. POSIX ACLs (getfacl/setfacl) — grant access to a specific user without changing owner/group
   setfacl -m u:myservice:r /path/to/file

2. Capabilities (getcap/setcap) — grant specific kernel privilege without root
   setcap cap_net_raw+ep /usr/bin/ping

3. Bind mounts — mount the file at a path where the service has access
   mount --bind /restricted/file /accessible/path/file

4. nsenter — enter the namespace of the process that has access and operate from there
   nsenter -t <pid> --mount --pid -- cat /path/to/file

5. chattr — check if the file has immutable flag set (chattr +i)
   lsattr /path/to/file

6. SELinux/AppArmor — if MAC policy is blocking access, you need to adjust policy labels
   ls -Z /path/to/file     (SELinux context)
   aa-status               (AppArmor status)

7. Overlay filesystem — if the file is in a read-only layer, create a writable overlay
   mount -t overlay overlay -o lowerdir=/ro,upperdir=/rw,workdir=/work /merged
```

**Strong answer structure:** "First I would confirm exactly what is failing — is it EACCES or EPERM? strace on the process would tell me the exact syscall and error. EACCES = permissions issue. EPERM = capability or SELinux issue. Then I would check in order: ACLs, capabilities, MAC policy, file immutable flags, and namespace context."

---

### Q: "Explain what a load average of 10 on a 4-core machine means."

Weak answer: "It means the system is overloaded."

**Strong answer:**
"Load average counts threads in run state (R) plus threads in uninterruptible sleep (D). A value of 10 on 4 cores means 10 threads are competing for CPU or waiting on kernel I/O at once — that is 2.5x oversubscribed.

But the composition matters:
- If all 10 are in R state: CPU contention, processes are being scheduled in/out — expect latency jitter
- If all 10 are in D state: I/O bottleneck, not CPU — maybe disk, NFS, or a hung driver

I would check `vmstat 1 5`: if `r` column is high, it is CPU saturation. If `b` is high and `r` is low, it is I/O wait. Then `iostat -xz 1` to identify the device. PSI in `/proc/pressure/` gives a more accurate view than load average because load average can spike on a brief I/O burst and stay elevated for 5+ minutes due to exponential decay."

---

### Q: "How does cgroup v2 limit CPU for a container?"

"cgroups v2 uses the CFS bandwidth controller. The `cpu.max` file contains two values: quota and period. For example, `200000 1000000` means the cgroup can use at most 200ms of CPU time in each 1000ms window — equivalent to 0.2 CPU cores.

Internally: the CFS scheduler tracks `cpu.stat`'s `usage_usec` counter. When a cgroup exhausts its quota for the current period, the scheduler throttles all processes in that cgroup — they are moved to a waiting state and are not scheduled until the period resets. This shows up as `throttled_usec` in `cpu.stat`.

This is why Kubernetes CPU limits can cause latency spikes without high CPU utilization: a bursty workload exhausts its 100ms quota in the first 10ms of a period, then is throttled for 90ms. The host CPU has plenty of capacity but the process is forced to wait. The fix is either to increase the CPU limit or — better — switch to CPU requests only without limits for latency-sensitive workloads."

---

## Points to Remember

- `D` state processes cannot be killed — they are waiting on kernel I/O
- Load average counts R + D state, not just CPU usage
- cgroups v2 uses a unified hierarchy under `/sys/fs/cgroup/`
- `cpu.max` quota/period model can cause CPU throttling at low utilization
- Containers use `clone()` with namespace flags, not `fork()` alone
- `pivot_root()` changes the filesystem root for a namespace (core container mechanism)
- File descriptors survive `fork()` — this is how stdout/stderr redirection works and how fd leaks happen
- eBPF programs are kernel-verified (safe) — no risk of kernel panics from bpftrace
- KVM uses VMCS hardware mechanism — guest state is saved/restored on VM exits
- GPU passthrough requires IOMMU enabled in BIOS + kernel cmdline
- NUMA mismatch between vCPUs and GPU PCIe = hidden latency for GPU VMs

## What to Study Next

- [02-kubernetes-cilium-production.md](/docs/nebius/kubernetes-cilium-production) — how Linux primitives map to Kubernetes
- [06-stress-interview-incident-response.md](/docs/nebius/stress-interview-incident-response) — apply this knowledge to live debugging scenarios
- Brendan Gregg's "Systems Performance" — chapters 5 (CPUs) and 7 (Memory)
