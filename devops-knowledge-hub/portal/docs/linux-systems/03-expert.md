---
title: "Expert"
sidebar_position: 3
---

# Linux & Systems — Expert

Expert Linux troubleshooting is about understanding how user-space symptoms map to kernel behavior: scheduler pressure, memory reclaim, page cache, OOM decisions, filesystem semantics, sockets, cgroups, namespaces, and systemd supervision.

At this level, you do not only run commands. You interpret kernel signals and choose mitigations with minimal blast radius.

---

## Expert Triage Model

```text
service symptom
  -> process state
  -> resource pressure
  -> kernel evidence
  -> dependency evidence
  -> mitigation
  -> root cause
```

Senior rule:

```text
Observe before changing. Mitigate before perfect root cause when users are impacted.
```

---

## Load Average — Deep Understanding

Load average counts runnable tasks and tasks in uninterruptible sleep. This is why a machine can show high load while CPU appears idle.

```bash
uptime
vmstat 1 5
ps aux | awk '$8 ~ /D/ {print}'
iostat -xz 1 5
```

### What 1/5/15 Minute Values Tell You

- **1-minute much higher than 15-minute:** recent sudden spike. Problem is new.
- **All three similar and high:** sustained overload. Has been happening for at least 15 minutes.
- **1-minute dropping from 15-minute:** problem is recovering.

On an N-CPU host:
- Load exactly N: system is fully utilized but not over.
- Load 2N: every CPU has one runnable and one waiting task.
- Load 4N: severe overload; latency increases non-linearly.

### Why Load > CPU Count Matters

Each unit of load is one task consuming a scheduler slot — either actively running or blocked in `D` state (uninterruptible sleep). If load is 40 on an 8-CPU host and CPU `us` is only 10%, those 32 extra units are mostly `D`-state tasks — blocked on disk or kernel resources.

### D-State Processes And Disk I/O Link

`D` (uninterruptible sleep) means the process is blocked inside a kernel call waiting for something it cannot interrupt. Common causes:
- Synchronous disk I/O
- NFS operation not yet complete
- Lock inside the kernel
- Memory allocation that triggered direct reclaim

D-state processes **cannot be killed** until the kernel call returns. `kill -9` does nothing.

```bash
ps aux | awk '$8 ~ /D/ {print}'
# Combined: load >> nproc, CPU low, D-state processes present = I/O bottleneck
```

Interpretation:

| Pattern | Likely meaning |
|---|---|
| High load, high user CPU | CPU-bound workload |
| High load, high system CPU | Kernel/network/syscall pressure |
| High load, high I/O wait | Disk or network storage bottleneck |
| High load, low CPU | Blocked tasks, often D-state |
| High softirq | Network packet processing pressure |

---

## OOM Killer — Full Understanding

Linux kills processes when memory cannot be reclaimed fast enough.

### How OOM Scoring Works

The kernel assigns each process an OOM score between 0 and 1000.

```bash
cat /proc/PID/oom_score         # current score (0=never kill, 1000=kill first)
cat /proc/PID/oom_score_adj     # adjustment (-1000 to 1000)
```

Score calculation considers:
- RSS (physical memory used)
- Swap usage
- Child processes' memory
- `oom_score_adj` value (admin-controlled)

Setting `oom_score_adj` to `-1000` makes the process unkillable by OOM:

```bash
echo -1000 > /proc/$(pgrep sshd)/oom_score_adj    # protect sshd from OOM
echo 500 > /proc/$(pgrep java)/oom_score_adj       # bias OOM toward this process
```

### Reading OOM Kill In dmesg

```bash
dmesg | grep -E "OOM|killed|out of memory"
```

Sample OOM message:

```text
[12345.678] Out of memory: Kill process 31042 (java) score 847 or sacrifice child
[12345.679] Killed process 31042 (java) total-vm:4194304kB, anon-rss:3145728kB, file-rss:0kB
```

The score (847 here) is what caused this process to be chosen.

### Protecting Critical Processes

For systemd-managed services, set in the unit file:

```ini
[Service]
OOMScoreAdjust=-500
```

### Cgroup Memory Limits vs OOM

In Kubernetes, an OOM kill at the cgroup level looks like container OOM, not host OOM:

```bash
journalctl -k | grep -i "oom\|killed"
dmesg | grep -i 'killed process'
cat /proc/PID/oom_score
cat /proc/PID/oom_score_adj
```

OOM investigation steps:
1. Identify the killed process.
2. Check whether it was cgroup/container OOM or host OOM.
3. Check cgroup/container memory limits.
4. Check host memory and swap.
5. Check process RSS growth over time.
6. Check recent deployment or traffic spike.

Kubernetes note: a container OOM kill may restart only the container. Linux host OOM may affect unrelated workloads on the node.

---

## Page Cache And Reclaim

Linux aggressively uses free RAM for cache. This is good.

```bash
free -h
cat /proc/meminfo | grep -E 'MemAvailable|Cached|Buffers|Dirty|Writeback'
```

Important fields:

| Field | Meaning |
|---|---|
| MemAvailable | Best estimate of usable memory |
| Cached | File-backed page cache |
| Dirty | Memory waiting to be written to disk |
| Writeback | Pages actively being written |

High dirty/writeback with I/O wait may indicate storage cannot flush writes fast enough.

### vfs_cache_pressure

Controls how aggressively the kernel reclaims inode and dentry cache:

```bash
sysctl vm.vfs_cache_pressure        # default 100
# higher = reclaim faster (less cache, more available memory)
# lower = keep more cache (better filesystem performance, less available memory)
```

### dirty_ratio And dirty_background_ratio

```bash
sysctl vm.dirty_ratio               # default 20 — hard limit: blocks writes at this %
sysctl vm.dirty_background_ratio    # default 10 — soft limit: triggers background flush
```

When dirty pages hit `dirty_ratio`, the kernel blocks further writes from applications until flushing catches up. This is how a write-heavy application can stall even with CPU and disk both available.

### Direct Reclaim vs Background Reclaim

- **Background reclaim (kswapd):** Asynchronous. kswapd wakes up and scans page lists when memory drops below a watermark. Application threads continue running.
- **Direct reclaim:** Synchronous. Happens in the application's call path when an allocation cannot be satisfied. The `malloc()` call itself blocks until pages are freed. This causes P99 latency spikes without OOM events.

```bash
sar -B 1 5                          # paging statistics including reclaim rate
cat /proc/vmstat | grep pgmajfault  # major page faults (swap-in events)
```

### Transparent Huge Pages (THP) And Latency Spikes

THP merges 4K pages into 2MB huge pages. The compaction process that scans memory to create contiguous regions causes latency stalls.

```bash
cat /sys/kernel/mm/transparent_hugepage/enabled
# [always] madvise never
```

To disable THP (common in databases and latency-sensitive services):

```bash
echo madvise > /sys/kernel/mm/transparent_hugepage/enabled
echo defer+madvise > /sys/kernel/mm/transparent_hugepage/defrag
```

---

## File Descriptor Exhaustion

Symptoms:

- `Too many open files`
- Service accepts no new connections
- Log files or sockets grow unexpectedly

### Check Limits

```bash
ulimit -n                              # soft limit for current session
cat /proc/PID/limits | grep files     # process hard/soft limits
ls /proc/PID/fd | wc -l               # current count
sudo lsof -p PID | head
```

### System-Wide

```bash
cat /proc/sys/fs/file-max              # system-wide max
cat /proc/sys/fs/file-nr               # current open, free slots, max
```

### Increase Limit Via /etc/security/limits.conf

```bash
# /etc/security/limits.conf
appuser soft nofile 65535
appuser hard nofile 65535
* soft nofile 65535
* hard nofile 65535
```

For systemd services, use unit file:

```ini
[Service]
LimitNOFILE=65535
```

Fix requires understanding: is the process leaking descriptors (growing count over time) or is the configured limit too low for the legitimate workload?

---

## Deleted-Open Files

Disk can remain full after deleting a large file because a process still holds the file descriptor.

```bash
sudo lsof +L1
```

The `+L1` flag shows files with link count below 1 — they have been unlinked but are still held open. Output shows which process (`COMMAND`, `PID`) holds the file and the size.

Example output:

```text
COMMAND   PID    USER   FD   TYPE DEVICE SIZE/OFF NLINK NODE NAME
logger  18204 appuser    7w   REG  259,2 8589934592     0 88120 /var/log/debug.log (deleted)
```

This process holds an 8 GB file open. Disk is not freed until it closes or restarts.

Mitigation:

```text
restart or reload owning process
truncate through file descriptor only if you understand the risk
fix log rotation configuration
```

Better prevention:

- Use logrotate correctly with `postrotate` script to send `SIGHUP`.
- Signal applications to reopen logs after rotation.
- Prefer stdout/stderr collection for containerized workloads.

---

## cgroups V2 — Deep Reference

Containers are Linux processes with namespaces and cgroups.

### cgroup v1 vs v2

- **v1:** separate hierarchies per subsystem (`/sys/fs/cgroup/cpu/`, `/sys/fs/cgroup/memory/`).
- **v2:** unified hierarchy at `/sys/fs/cgroup/`. Single file for all controls.

Check which version:

```bash
stat -fc %T /sys/fs/cgroup/
# tmpfs = v1 (or hybrid)
# cgroup2fs = v2
```

### cgroup v2 Key Files

```bash
cat /sys/fs/cgroup/<path>/cpu.max          # "quota period" or "max period"
cat /sys/fs/cgroup/<path>/memory.max       # memory hard limit
cat /sys/fs/cgroup/<path>/memory.current   # current usage
cat /sys/fs/cgroup/<path>/cpu.stat         # throttle counters
cat /sys/fs/cgroup/<path>/memory.stat      # memory breakdown
```

### Namespaces

Namespaces control what a process can see.

| Namespace | Isolates |
|---|---|
| PID | process IDs |
| network | interfaces, routes, ports |
| mount | filesystem view |
| user | user/group mappings |
| UTS | hostname |
| IPC | shared memory/semaphores |
| cgroup | cgroup hierarchy view |

### cgroups Controls

| cgroup area | Controls |
|---|---|
| CPU | shares, quotas, throttling |
| memory | memory limit and OOM behavior |
| pids | process count |
| IO | disk IO controls |

### Inspect cgroup Context

```bash
cat /proc/PID/cgroup                # which cgroup the process belongs to
systemd-cgls                        # tree view of all cgroups
systemd-cgtop                       # live resource usage by cgroup
```

Container resource limits in Kubernetes map directly to cgroup files:

```bash
# Find the container's cgroup path from /proc/<pid>/cgroup, then:
cat /sys/fs/cgroup/cpu,cpuacct/<path>/cpu.stat
# Output:
# nr_periods 18241
# nr_throttled 14092       <- 77% of periods throttled
# throttled_time 82914731948
```

---

## CPU Throttling — Deep

In containers, CPU limits cause throttling even when the host has idle CPU.

### Detection

```bash
# Find the cgroup path:
cat /proc/PID/cgroup

# Check throttle stats (v1):
cat /sys/fs/cgroup/cpu,cpuacct/<path>/cpu.stat
# nr_throttled / nr_periods = throttle percentage

# cgroup v2:
cat /sys/fs/cgroup/<path>/cpu.stat | grep -E 'usage_usec|throttled_usec|nr_throttled'
```

### pidstat — The Process-Level Signal

```bash
pidstat -u 1 10 -p PID
```

High `%wait` with low host CPU idle = cgroup throttling.

High `%wait` with near-zero host CPU idle = CPU saturation.

### Kubernetes CPU Limits Map To cgroup

```bash
# For a pod with cpu.limit: "2":
cat .../cpu.cfs_quota_us     # 200000 (microseconds per period)
cat .../cpu.cfs_period_us    # 100000 (100ms period)
# Effective: 200000/100000 = 2.0 CPUs
```

SRE lesson: CPU limits protect noisy neighbors but can create latency if set too low for the workload's burst requirements.

---

## Network Internals

Useful Linux network layers:

```text
application socket -> TCP/UDP -> routing table -> iptables/nftables -> interface -> network
```

### Conntrack Table

```bash
conntrack -S                                      # per-CPU stats
sysctl net.netfilter.nf_conntrack_max             # max entries
cat /proc/sys/net/netfilter/nf_conntrack_count    # current count
conntrack -L | wc -l                              # current connections
```

When conntrack fills, **new connections are silently dropped**. No error, no RST — packets vanish. This caused famous production incidents at scale.

### SYN Backlog

```bash
sysctl net.core.somaxconn                    # max listen backlog
sysctl net.ipv4.tcp_max_syn_backlog          # SYN queue depth
```

If accept queue is full (`Recv-Q > 0` on a LISTEN socket in `ss -lntp`), the application is not calling `accept()` fast enough.

### TIME_WAIT Accumulation

```bash
ss -tan state time-wait | wc -l
sysctl net.ipv4.tcp_tw_reuse                 # allow reuse (0=off, 1=on for outgoing)
sysctl net.ipv4.tcp_fin_timeout              # TIME_WAIT duration (default 60s)
```

High TIME_WAIT counts are normal under high connection rates. They only become a problem when port exhaustion occurs.

### Commands Reference

```bash
ss -s                        # summary
ss -tulnp                    # listening with process
ss -tanp                     # all TCP with process
ip route get 8.8.8.8         # which route/interface is used to reach a destination
nmap -sV localhost           # service version scan
tcpdump -i eth0 port 80 -n   # packet capture
mtr host                     # path analysis with packet loss
traceroute host              # classic path tracing
```

---

## strace Patterns — Expert Use

```bash
sudo strace -p PID
sudo strace -tt -T -p PID             # timestamps + duration per call
sudo strace -f -o trace.log command   # trace forked children
```

### Common strace Patterns

| strace pattern | Meaning |
|---|---|
| repeated `connect()` ETIMEDOUT | dependency or network issue |
| repeated `open()` ENOENT | missing file/config |
| slow `read()` | blocked input or slow file/socket |
| `EACCES` on `open()` | permission problem |
| `futex()` blocking | lock contention, possible deadlock |
| `epoll_wait()` blocking | event loop idle, waiting for IO |
| rapid `write()` to /proc file | sysctl-style tuning going on |

### strace -c For Syscall Frequency

```bash
strace -c -p PID sleep 30     # summarize syscall counts and time over 30 seconds
```

Output shows which syscalls consume the most time — useful for identifying unexpected kernel overhead.

Avoid attaching heavy tracing to critical hot paths for long periods without understanding overhead.

---

## Kernel Evidence

Kernel logs are essential for OOM, disk errors, NIC issues, filesystem errors, and driver messages.

```bash
dmesg -T | tail -100
journalctl -k -n 200 --no-pager
journalctl -p err -n 100 --no-pager
dmesg | grep -E "OOM|killed|panic|error|warn"
```

Look for:

- OOM killer messages: `Out of memory: Kill process`
- Filesystem errors: `EXT4-fs error`, `XFS: xfs_log_force`
- I/O errors: `blk_update_request: I/O error`, `end_request: I/O error`
- Blocked task warnings: `task blocked for more than 120 seconds`
- Network driver resets: `eth0: NIC Ring params`
- Segfaults: `segfault at ... ip ... error 4`
- cgroup kill events: `Memory cgroup out of memory`

### Kernel Panic Configuration

```bash
cat /proc/sys/kernel/panic          # seconds before auto-reboot (0 = no reboot)
cat /proc/sys/kernel/panic_on_oops  # 1 = panic on kernel oops
```

### kdump and crash — Post-Mortem Analysis

If a kernel crash dump was captured:

```bash
crash /usr/lib/debug/boot/vmlinux-$(uname -r) /var/crash/*/vmcore
```

This requires `kdump-tools` installed and configured with sufficient crashkernel memory reserved.

---

## Performance Flamegraphs

For identifying hot functions in a live process:

```bash
# Record for 30 seconds with call graph:
perf record -g -F 99 -p PID sleep 30

# Generate report:
perf report

# For flamegraph (requires Brendan Gregg's FlameGraph tools):
perf script | ./FlameGraph/stackcollapse-perf.pl | ./FlameGraph/flamegraph.pl > flame.svg
```

Quick perf one-liners:

```bash
perf top                            # real-time CPU function usage
perf stat -p PID sleep 10          # CPU hardware counters
perf stat -e cache-misses,cache-references -p PID sleep 10  # cache stats
```

---

## /proc And /sys Key Paths Reference

### /proc Key Files

| Path | Contents |
|---|---|
| `/proc/meminfo` | Memory breakdown |
| `/proc/cpuinfo` | CPU details |
| `/proc/loadavg` | Load averages |
| `/proc/net/tcp` | TCP socket table |
| `/proc/net/nf_conntrack` | Connection tracking table |
| `/proc/sys/vm/` | VM tuning parameters |
| `/proc/sys/net/` | Network tuning parameters |
| `/proc/sys/fs/file-max` | System-wide fd limit |
| `/proc/sys/fs/file-nr` | Current fd usage |
| `/proc/sys/kernel/panic` | Panic behavior |
| `/proc/pressure/` | PSI (Pressure Stall Information) metrics |

### /proc/PID Key Files

| Path | Contents |
|---|---|
| `/proc/PID/status` | Process state, memory, UID |
| `/proc/PID/limits` | Resource limits |
| `/proc/PID/fd/` | Open file descriptors |
| `/proc/PID/cgroup` | cgroup membership |
| `/proc/PID/oom_score` | OOM kill likelihood |
| `/proc/PID/oom_score_adj` | OOM score adjustment |
| `/proc/PID/net/tcp` | TCP sockets for this process |
| `/proc/PID/cmdline` | Full command line (NUL-separated) |
| `/proc/PID/environ` | Environment variables at launch |
| `/proc/PID/maps` | Memory map |
| `/proc/PID/smaps_rollup` | Memory usage summary |

### /sys Key Paths

| Path | Contents |
|---|---|
| `/sys/block/<dev>/queue/scheduler` | I/O scheduler (mq-deadline, none, bfq) |
| `/sys/block/<dev>/stat` | Device I/O stats |
| `/sys/fs/cgroup/` | cgroup hierarchy |
| `/sys/kernel/mm/transparent_hugepage/` | THP settings |
| `/sys/class/net/<iface>/statistics/` | NIC counters |
| `/sys/class/net/<iface>/mtu` | Interface MTU |

---

## systemd Expert Controls

Resource controls in unit files:

```ini
[Service]
Restart=on-failure
RestartSec=5
LimitNOFILE=65535
MemoryMax=2G
CPUQuota=200%
OOMScoreAdjust=-500
```

Inspect:

```bash
systemctl show SERVICE
systemctl cat SERVICE
systemd-cgls
journalctl -u SERVICE --since "1 hour ago"
```

If a service restarts repeatedly, check `StartLimitBurst` and `StartLimitIntervalSec`. Once `start-limit-hit` is reached, use `systemctl reset-failed SERVICE` before restarting.

---

---

## Linux Kernel Scheduler — Deep Reference

The Linux scheduler (CFS — Completely Fair Scheduler) allocates CPU time fairly across runnable tasks. Understanding it helps diagnose throttling, starvation, and latency issues.

### CFS Concepts

| Concept | Meaning |
|---------|---------|
| `vruntime` | Virtual runtime — how much CPU the task has consumed. CFS picks the task with the smallest `vruntime`. |
| Nice value | Priority bias (-20 to +19). Lower nice = more CPU. `nice -n -5 cmd` gives higher priority. |
| CPU shares | cgroup `cpu.shares` controls relative weight between cgroups. |
| CPU quota | cgroup `cpu.cfs_quota_us / cpu.cfs_period_us` = hard limit. Throttled when quota exhausted. |

```bash
# Real-time priority / nice of a process
ps -o pid,ni,pri,cmd -p PID

# Set nice value for running process
renice -n 10 -p PID

# Check scheduling policy
chrt -p PID       # SCHED_OTHER, SCHED_FIFO, SCHED_RR

# Set real-time scheduling (FIFO, priority 50)
chrt -f -p 50 PID
```

### Scheduler Latency Tuning

```bash
# Key sysctl for scheduler latency
sysctl kernel.sched_latency_ns          # default 18ms — scheduler period
sysctl kernel.sched_min_granularity_ns  # minimum time slice per task
sysctl kernel.sched_migration_cost_ns   # cost to move task between CPUs
```

Low-latency services may benefit from pinning to specific CPUs:

```bash
# Pin a process to CPUs 0 and 1
taskset -cp 0,1 PID

# Pin a new command to CPU 2
taskset -c 2 command

# Check current CPU affinity
taskset -cp PID
```

---

## Filesystem Internals — ext4, XFS, btrfs

### Inode and Dentry Structures

**Inode:** Every file has an inode containing metadata (size, owner, permissions, timestamps, pointers to data blocks). The filename is stored in a directory entry, not in the inode.

```bash
stat file.txt                   # shows inode number, blocks, timestamps
ls -li                          # list with inode numbers
df -i                           # inode usage per filesystem
```

Key inode timestamps:
- `atime`: last access (usually disabled with `noatime` for performance)
- `mtime`: last content modification
- `ctime`: last metadata change (permissions, links)

**Dentry (directory entry):** Maps filename to inode. Cached in the dentry cache (`dcache`) in RAM. When the kernel looks up `/var/log/app.log` it traverses the dentry tree: `/` → `var` → `log` → `app.log`.

```bash
# Dentry cache and inode cache stats
cat /proc/sys/vm/vfs_cache_pressure    # controls dcache reclaim aggressiveness
slabtop                                # kernel slab allocator (includes dcache, inodes)
```

### ext4 Internals

ext4 is the most common Linux filesystem. Key features:

| Feature | Description |
|---------|-------------|
| Journaling | Writes metadata to journal before applying; prevents corruption on crash |
| Extents | Contiguous disk ranges instead of block lists; efficient for large files |
| Delayed allocation | Buffers writes before allocating blocks; reduces fragmentation |
| Online resize | Can grow while mounted |
| Inode table | Fixed at creation time; `mkfs.ext4 -i bytes-per-inode` controls density |

```bash
# View ext4 filesystem details
tune2fs -l /dev/sdb1                # superblock info including inode count
dumpe2fs /dev/sdb1 | head -50       # detailed block group info

# Check and repair (offline)
fsck.ext4 -f /dev/sdb1

# Adjust bytes-per-inode ratio when creating (more inodes = more small files)
mkfs.ext4 -i 8192 /dev/sdb1        # 1 inode per 8K = more inodes than default 16K
```

Common ext4 error in `dmesg`:
```text
EXT4-fs error (device sdb1): ext4_validate_block_bitmap:376: comm kworker...
```
This indicates filesystem corruption — run `fsck` offline.

### XFS Internals

XFS is preferred for large files, high throughput, and large filesystems. Default on RHEL.

| Feature | Description |
|---------|-------------|
| Allocation groups | Filesystem divided into independent groups; parallel I/O |
| Delayed logging | Transactions grouped in a circular log buffer |
| Extent-based | Like ext4 extents |
| Online defrag | `xfs_fsr` while mounted |
| No online shrink | XFS filesystems cannot be shrunk |

```bash
xfs_info /mountpoint               # filesystem geometry
xfs_repair /dev/sdb1               # repair (offline)
xfs_growfs /mountpoint             # expand (online)
xfs_db -r /dev/sdb1               # XFS debugger (read-only)
```

XFS journal errors in `dmesg`:
```text
XFS: xfs_log_force: error -5 returned.
```
Indicates I/O error flushing the log. Check disk health.

### btrfs Internals

btrfs (B-Tree filesystem) adds copy-on-write, snapshots, and checksumming.

| Feature | Description |
|---------|-------------|
| Copy-on-write (CoW) | Modifications write new copy, old version preserved |
| Snapshots | Near-instant, space-efficient (shared CoW blocks) |
| Data checksums | Detects silent data corruption (bit rot) |
| Compression | zlib, lzo, zstd per file or directory |
| Subvolumes | Independently mountable sections |
| RAID | Built-in software RAID (RAID 0, 1, 10, 5, 6) |

```bash
btrfs filesystem show                    # list btrfs filesystems
btrfs filesystem usage /mountpoint       # space usage by type
btrfs subvolume list /mountpoint         # list subvolumes
btrfs subvolume snapshot /data /data_snap  # create snapshot

# Check and repair
btrfs check /dev/sdb1                    # offline check
btrfs scrub start /mountpoint            # online checksum verification
btrfs scrub status /mountpoint
```

### Filesystem Comparison

| Aspect | ext4 | XFS | btrfs |
|--------|------|-----|-------|
| Max file size | 16 TiB | 8 EiB | 16 EiB |
| Max filesystem | 1 EiB | 8 EiB | 16 EiB |
| Online resize | Grow only | Grow only | Grow only |
| Snapshots | No (LVM needed) | No | Yes (native) |
| Checksums | No | Metadata only | Data + metadata |
| Default distro | Ubuntu/Debian | RHEL/CentOS | openSUSE |
| Small files | Good | Moderate | Good |
| Large files | Good | Excellent | Good |

---

## eBPF and bpftrace — Production Observability

eBPF (extended Berkeley Packet Filter) lets you run safe programs in kernel context for tracing, profiling, and networking — without kernel modules or restarts.

### What eBPF Can Observe

- Any kernel function (syscalls, scheduler, memory allocator, network stack)
- Any userspace function in a running process (uprobes)
- Hardware performance counters
- Network packets at any layer

```bash
# Check if eBPF is available
uname -r                       # need 4.1+ for basic eBPF, 5.x for full featureset
ls /sys/kernel/btf/            # BTF (debug info) required for bpftrace CO-RE

# Install bpftrace
apt install bpftrace            # Ubuntu
yum install bpftrace            # RHEL/CentOS
```

### bpftrace One-Liners

```bash
# Trace all open() syscalls system-wide
bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%s %s\n", comm, str(args->filename)); }'

# Count syscalls by process
bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }'

# Trace slow disk I/O (>10ms)
bpftrace -e 'tracepoint:block:block_rq_complete /args->rwbs == "R" && args->nr_sector > 0/ {
    @usecs = hist(args->nr_sector * 512); }'

# Count TCP connections by destination port
bpftrace -e 'kprobe:tcp_connect { @[((struct sock *)arg0)->__sk_common.skc_dport] = count(); }'

# Trace file opens for a specific process
bpftrace -e 'tracepoint:syscalls:sys_enter_openat /pid == 1234/ { printf("%s\n", str(args->filename)); }'

# Stack trace for malloc calls over 1MB
bpftrace -e 'uprobe:/lib/x86_64-linux-gnu/libc.so.6:malloc /arg0 > 1048576/ { @[ustack] = count(); }'
```

### bcc Tools (eBPF-based)

```bash
# Install bcc tools
apt install bpfcc-tools

execsnoop              # trace new process executions
opensnoop              # trace file opens
filelife               # file create/delete events with duration
tcpconnect             # trace outgoing TCP connections
tcpaccept              # trace accepted TCP connections
tcpretrans             # trace TCP retransmissions
biolatency             # block I/O latency histogram
biosnoop               # block I/O per-request tracing
cachestat              # page cache hit ratio
cachetop               # per-process page cache stats
runqlat                # CPU run queue latency histogram
cpudist                # on-CPU time distribution
memleak -p PID         # memory leak detection for a process
```

### Flamegraphs with perf + eBPF

```bash
# Profile CPU for 30s (all processes)
perf record -g -F 99 -a sleep 30
perf script > out.perf
./FlameGraph/stackcollapse-perf.pl out.perf | ./FlameGraph/flamegraph.pl > cpu.svg

# Profile a specific PID
perf record -g -F 99 -p PID sleep 30

# Off-CPU flamegraph (time spent NOT running = blocked)
# Requires off-cpu tracer (bcc offcputime tool)
offcputime -f -p PID 30 > out.folded
./FlameGraph/flamegraph.pl out.folded > offcpu.svg
```

Flamegraph reading:
- X-axis: alphabetical, not time
- Y-axis: call stack depth
- Width of bar: how often that function appeared in samples
- Flat tops: on-CPU hot spots
- Tall stacks with narrow bars: deep call paths with little self-time

---

## Expert Takeaways

1. High load is not always CPU saturation. D-state and I/O wait are common causes.
2. Load 1-min >> 15-min = sudden spike. All three high = sustained overload.
3. OOM scoring: protect critical processes with `oom_score_adj = -1000`.
4. Direct reclaim causes P99 spikes long before OOM kill events.
5. THP compaction causes unexpected latency stalls in latency-sensitive services.
6. Deleted-open files keep disk space allocated until the fd closes.
7. File descriptor leaks break services before CPU or memory look bad.
8. Containers are Linux processes with namespaces and cgroups.
9. CPU throttling is invisible to `kubectl get pod` — inspect cgroup `cpu.stat`.
10. Conntrack exhaustion silently drops connections — monitor the table fill rate.
11. `strace` explains what a process is waiting on; use `-c` for frequency analysis.
12. Kernel logs often contain the first real clue.
13. Flamegraphs are the fastest way to identify hot functions in live production.
14. CFS throttles containers on CPU quota boundaries even when host CPU is idle.
15. ext4/XFS/btrfs have different tradeoffs: ext4 for general use, XFS for large files, btrfs for snapshots and checksums.
16. eBPF lets you trace any kernel or userspace function in production with minimal overhead.
17. bpftrace one-liners can answer "what is the kernel doing?" without kernel modules or restarts.
