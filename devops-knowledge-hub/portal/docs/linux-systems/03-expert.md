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

## Load Average Deep Dive

Load average counts runnable tasks and tasks in uninterruptible sleep. This is why a machine can show high load while CPU appears idle.

```bash
uptime
vmstat 1 5
ps aux | awk '$8 ~ /D/ {print}'
iostat -xz 1 5
```

Interpretation:

| Pattern | Likely meaning |
|---|---|
| High load, high user CPU | CPU-bound workload |
| High load, high system CPU | Kernel/network/syscall pressure |
| High load, high I/O wait | Disk or network storage bottleneck |
| High load, low CPU | Blocked tasks, often D-state |
| High softirq | Network packet processing pressure |

D-state processes cannot be killed until the kernel call returns. Killing them with `kill -9` usually does not help.

---

## OOM Killer And Memory Pressure

Linux kills processes when memory cannot be reclaimed fast enough.

```bash
journalctl -k | grep -i oom
dmesg | grep -i 'killed process'
cat /proc/PID/oom_score
cat /proc/PID/oom_score_adj
```

OOM investigation:

1. Identify killed process.
2. Check cgroup/container memory limits.
3. Check host memory and swap.
4. Check process RSS growth.
5. Check recent deployment or traffic spike.
6. Confirm whether this is host OOM or container/cgroup OOM.

Kubernetes note: a container OOM kill may restart only the container, not necessarily the whole pod object. Linux host OOM may affect unrelated workloads on the node.

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

---

## File Descriptor Exhaustion

Symptoms:

- `Too many open files`
- Service accepts no new connections
- Log files or sockets grow unexpectedly

Check limits:

```bash
ulimit -n
cat /proc/PID/limits | grep files
ls /proc/PID/fd | wc -l
sudo lsof -p PID | head
```

System-wide:

```bash
cat /proc/sys/fs/file-nr
cat /proc/sys/fs/file-max
```

Fix requires understanding whether the process leaks descriptors or the configured limit is too low.

---

## Deleted-Open Files

Disk can remain full after deleting a large file because a process still holds the file descriptor.

```bash
sudo lsof +L1
```

Mitigation:

```text
restart or reload owning process
truncate through file descriptor only if you understand the risk
fix log rotation configuration
```

Better prevention:

- Use logrotate correctly.
- Signal applications to reopen logs after rotation.
- Prefer stdout/stderr collection for containerized workloads.

---

## cgroups And Containers

Containers are Linux processes with namespaces and cgroups.

Namespaces isolate what a process can see. Cgroups limit what a process can use.

| Mechanism | Purpose |
|---|---|
| PID namespace | Process visibility |
| Network namespace | Interfaces, routes, ports |
| Mount namespace | Filesystem view |
| User namespace | UID/GID mapping |
| cgroup CPU | CPU shares/quota |
| cgroup memory | Memory limit and OOM boundary |
| cgroup pids | Process count limit |

Check cgroup context:

```bash
cat /proc/PID/cgroup
systemd-cgls
systemd-cgtop
```

This is essential when host metrics look fine but a container is throttled or OOM-killed.

---

## CPU Throttling

In containers, CPU limits can cause throttling even when the host has idle CPU.

Signals:

```text
high latency
low host CPU
container CPU throttling metrics
application worker starvation
```

Check in Kubernetes with metrics if available:

```bash
kubectl top pod -n namespace
kubectl describe pod pod-name -n namespace
```

SRE lesson: CPU limits protect noisy neighbors but can create latency if set too low.

---

## Network Internals

Useful Linux network layers:

```text
application socket -> TCP/UDP -> routing table -> iptables/nftables -> interface -> network
```

Commands:

```bash
ss -lntp
ss -tan state established
ip addr
ip route
ip rule
iptables -S
nft list ruleset
conntrack -S
```

Connection states matter:

| State | Meaning |
|---|---|
| LISTEN | Local process accepts connections |
| ESTABLISHED | Active connection |
| SYN-SENT | Waiting for remote SYN-ACK |
| SYN-RECV | Server saw SYN and replied |
| TIME-WAIT | Recently closed connection retained |
| CLOSE-WAIT | Local app has not closed after peer closed |

Many `CLOSE-WAIT` connections often indicate an application bug.

---

## Syscalls And strace

`strace` shows system calls a process is making.

```bash
sudo strace -p PID
sudo strace -tt -T -p PID
sudo strace -f -o trace.log command
```

Use it when a process is running but you do not know what it is waiting on.

Examples:

| strace pattern | Meaning |
|---|---|
| repeated `connect()` | dependency or network issue |
| repeated `open()` ENOENT | missing file/config |
| slow `read()` | blocked input or slow file/socket |
| `EACCES` | permission problem |

Avoid attaching heavy tracing to critical hot paths for long periods without understanding overhead.

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
```

Inspect:

```bash
systemctl show SERVICE
systemctl cat SERVICE
systemd-cgls
journalctl -u SERVICE --since "1 hour ago"
```

If a service restarts repeatedly, check `StartLimitBurst` and `StartLimitIntervalSec`.

---

## Kernel Evidence

Kernel logs are essential for OOM, disk errors, NIC issues, filesystem errors, and driver messages.

```bash
dmesg -T | tail -100
journalctl -k -n 200 --no-pager
journalctl -p err -n 100 --no-pager
```

Look for:

- OOM killer messages
- filesystem errors
- I/O errors
- blocked task warnings
- network driver resets
- segfaults
- cgroup kill events

---

## Expert Takeaways

1. High load is not always CPU saturation.
2. D-state usually means the process is stuck in kernel I/O.
3. OOM must be classified as host OOM or cgroup/container OOM.
4. Deleted-open files keep disk space allocated.
5. File descriptor leaks break services before CPU or memory look bad.
6. Containers are Linux processes with namespaces and cgroups.
7. `strace` explains what a process is waiting on.
8. Kernel logs often contain the first real clue.
