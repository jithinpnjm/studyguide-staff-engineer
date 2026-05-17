---
title: "Interview Questions"
sidebar_position: 4
---

# Linux & Systems — Interview Questions

Strong Linux interview answers explain how you reason under pressure. Do not only list commands. Explain what signal you would collect, how you would interpret it, and what safe mitigation you would choose.

---

## Beginner Questions

### Why is Linux important for SREs?

Most cloud infrastructure, Kubernetes nodes, containers, databases, proxies, and observability agents run on Linux. Production incidents often reduce to Linux resource behavior: CPU, memory, disk, process, network, kernel, or filesystem issues.

### What does "everything is a file" mean?

Linux exposes many system interfaces as files or file-like objects: devices under `/dev`, process data under `/proc`, kernel subsystem data under `/sys`, logs under `/var/log`, and sockets/file descriptors under process directories.

### What is `/proc`?

`/proc` is a virtual filesystem that exposes live kernel and process information. It is not normal disk data.

```bash
cat /proc/meminfo
cat /proc/cpuinfo
ls /proc/$$
```

### What is an inode?

An inode stores file metadata and block pointers. Filenames are directory entries that point to inodes. Hard links share the same inode; symlinks point to a path.

### What is the correct permission for `/tmp`?

Usually `1777`: world-writable with the sticky bit so users can create files but cannot delete other users' files.

---

## Permissions And Users

### Explain Linux file permissions.

Permissions are split into owner, group, and others. Each can have read, write, and execute bits.

```text
r=4, w=2, x=1
755 = rwxr-xr-x
644 = rw-r--r--
600 = rw-------
```

### What are setuid, setgid, and sticky bit?

Setuid runs an executable with the owner's privileges. Setgid runs with group privileges and makes directories inherit group ownership. Sticky bit on directories allows only file owners to delete their own files.

Real examples:

```bash
ls -l /usr/bin/passwd    # -rwsr-xr-x (setuid set — runs as root)
ls -ld /tmp              # drwxrwxrwt (sticky bit set)
```

### What is umask and when does it matter?

`umask` sets the default permission mask for new files and directories. With `umask 0022`, a file created with mode `0666` gets `0644`, and a directory with `0777` gets `0755`. Production services sometimes need `umask 0027` to prevent group and world read on sensitive files.

### User was added to a group but still cannot access a file. Why?

The session may not have refreshed group membership. Ask the user to log out and back in, or start a new session. Also verify with `id username` and check file group ownership and mode.

### How do you debug a user who cannot SSH?

Check account status, shell, home directory, SSH logs, group policy, key permissions, and network path.

```bash
passwd -S username
chage -l username
getent passwd username
sudo journalctl -u sshd --since "1 hour ago"
```

---

## Process Questions

### Walk me through what happens when a Linux process is killed with SIGKILL vs SIGTERM.

**SIGTERM (signal 15):**
- Sent to the process by `kill -15 PID` or `kill PID`.
- The kernel delivers it as a signal to the process.
- The process can catch, ignore, or handle SIGTERM.
- Most well-written daemons use SIGTERM to flush data, close connections, release locks, and exit cleanly.
- If the process is in a signal handler or has SIGTERM blocked, it may not respond immediately.
- Timeout then SIGKILL is the standard pattern: `systemctl stop` sends SIGTERM, waits, then sends SIGKILL.

**SIGKILL (signal 9):**
- The kernel terminates the process immediately.
- The process has no opportunity to handle it — no cleanup, no flush, no lock release.
- Files being written may be incomplete. Database WAL may be dirty. Temp files may remain.
- A process in `D` state (uninterruptible sleep) may not respond to SIGKILL until the kernel call returns.
- Use only when SIGTERM has failed and you accept the risk of data inconsistency.

### What is a zombie process?

A process that has exited but whose parent has not collected its exit status with `wait()`. It uses a PID slot but not normal memory. Zombie processes accumulate when a parent has a bug in signal handling or is itself hung.

```bash
ps aux | awk '$8 == "Z" {print}'
```

Zombies do not consume CPU or memory, but they hold a PID. On systems with tight PID limits, too many zombies can prevent new processes from starting. Fix: fix or restart the parent process.

### What is D-state?

Uninterruptible sleep, usually waiting in the kernel for I/O or a kernel resource. D-state processes often cannot be killed until the kernel call returns.

### How do you find what a process is doing?

```bash
ps -fp PID
lsof -p PID
strace -p PID
cat /proc/PID/status
```

Use `strace` carefully on production hot paths. `strace -c` gives a syscall frequency summary with lower overhead.

---

## CPU And Load Questions

### A server has load average 40 but only 8 CPUs. Where do you start?

Full answer:

> Load 40 on 8 CPUs means 5x overload. My first question is whether this is CPU saturation or blocked work — they have completely different causes and fixes.
>
> I run `vmstat 1 5` immediately. If `wa` is high (above 20%), the CPUs are mostly idle waiting for disk I/O. If `us`/`sy` is high, it is genuine CPU saturation.
>
> Then I check for D-state processes: `ps aux | awk '$8 ~ /D/ {print}'`. Multiple D-state processes with high `wa` in `vmstat` confirms I/O blocking.
>
> Next I run `iostat -xz 1 5` to find which device is saturated. If `%util` is near 100% or `r_await`/`w_await` is elevated, the disk is the bottleneck.
>
> I also look at what the D-state processes are waiting on — if it is NFS, I check mount health. If it is local disk, I check `dmesg | grep "I/O error"` for device errors.
>
> For genuine CPU saturation: `pidstat -u 1 5` shows which processes consume CPU. `perf top` shows which kernel and user functions are hot.
>
> My safe mitigation would be: move traffic off the node (if Kubernetes), restrict or kill runaway processes with SIGTERM first, not SIGKILL. D-state processes usually will not respond to kill anyway until the I/O returns.

```bash
uptime
vmstat 1 5
ps aux | awk '$8 ~ /D/ {print}'
iostat -xz 1 5
mpstat -P ALL 1 5
pidstat -u 1 5
```

### What does `iowait` (`wa`) mean and what does high iowait indicate?

`wa` (iowait) shows the percentage of time CPUs are idle while waiting for disk or network storage I/O to complete. CPUs cannot do other work during this time — they are literally waiting.

High iowait (above 20-30%) means:
- The disk device is the bottleneck, not the CPU.
- Application latency increases because process I/O calls block for longer.
- Load average rises because I/O-waiting processes count as D-state.

It does not mean the CPU is busy. It means the CPU is idle but cannot pick up other runnable work while waiting.

```bash
vmstat 1 5     # wa column
iostat -xz 1 5 # confirm which device is saturated
```

### What does high `sy` mean?

High kernel CPU usage. Possible causes include syscall-heavy workload, packet processing, filesystem work, or kernel-level overhead.

---

## Memory Questions

### `free` memory is low. Is that bad?

Not necessarily. Linux uses free memory for page cache. Check `available` memory and swap activity.

```bash
free -h
vmstat 1 5
```

### How does the Linux OOM killer decide what to kill?

> The OOM killer scores each process. The score considers the process's physical memory usage (RSS), swap usage, and child processes. Larger memory consumers get higher scores.
>
> The score is then adjusted by `oom_score_adj` — an admin-controlled value from -1000 to +1000. Setting it to -1000 makes the process almost unkillable. Setting it to +1000 means it gets killed first.
>
> When OOM triggers, the kernel kills the process with the highest final score. This is a heuristic to free the most memory with one kill.
>
> Kubernetes sets higher `oom_score_adj` for BestEffort pods and lower for Guaranteed pods. That is how QoS class protects critical workloads.

```bash
cat /proc/PID/oom_score
cat /proc/PID/oom_score_adj
dmesg | grep -E "OOM|killed"
```

### Why can memory pressure hurt latency before any OOM kill?

> When a cgroup approaches its memory limit, any new allocation triggers direct reclaim — synchronous page reclaim runs inside the application's call path. That `malloc()` call now takes milliseconds instead of nanoseconds. This shows up as P99 latency spikes without OOM events.
>
> Additionally, kswapd competes for CPU doing background reclaim, dirty page writeback throttles writes when `dirty_ratio` is hit, and THP compaction scans pause memory access. All of these happen before OOM kills anything.

```bash
sar -B 1 5
cat /proc/vmstat | grep pgmajfault
```

### What is the difference between RSS and VSZ?

RSS is resident memory actually in RAM. VSZ is virtual address space and can be much larger than real memory usage.

---

## Disk Questions

### Disk is full but `df -h` shows space. What is happening?

Two possible causes:

**Inode exhaustion:** The filesystem has run out of metadata records. Files cannot be created even though bytes are free. Diagnose with `df -i`. Happens with millions of tiny files.

**Deleted-open files:** A process has a deleted file open. The directory entry is gone but disk blocks remain allocated. Diagnose with `sudo lsof +L1`. Fix by restarting the owning process.

```bash
df -h        # bytes
df -i        # inodes
sudo lsof +L1   # deleted-but-open files
```

### How do you debug a service that starts but immediately exits?

Full answer:

> First I check `systemctl status SERVICE` — this shows the exit code and last few log lines. `exit-code` vs `signal` tells me a lot: `status=1` is application error, `status=137` is SIGKILL (likely OOM), `status=139` is SIGSEGV.
>
> Then `journalctl -u SERVICE -n 50 --no-pager` for the full startup log sequence.
>
> If the logs show a config or dependency error, I fix that. If the logs are empty or show nothing useful, I attach `strace`: `strace -f -e trace=file,network /path/to/binary` to see what it is accessing before dying.
>
> I also check: does the binary exist? Is it executable? Is the EnvironmentFile present? Is the port in use? Is there a permission error on the working directory?

```bash
systemctl status SERVICE
journalctl -u SERVICE -n 100 --no-pager
strace -f -e trace=file /path/to/binary
ls -la /path/to/binary
cat /proc/sys/fs/file-nr
```

### How do you find what is holding a file open?

```bash
sudo lsof /path/to/file          # which process has this specific file open
sudo lsof +D /path/to/directory  # which processes have files open in this directory
fuser /path/to/file              # simpler: just shows PIDs
sudo lsof -p PID                 # all open files for a specific process
```

---

## Networking Questions

### "Connection refused" vs "connection timed out" — what each means at the TCP level

**Connection refused:**
- The host received the SYN packet.
- The kernel responded with RST+ACK immediately.
- Cause: nothing is listening on that port, or the connection was explicitly rejected.
- Occurs quickly (milliseconds).
- Means the network path to the host is working.

**Connection timed out:**
- The SYN packet was sent but no response arrived.
- The client retransmits SYN multiple times then gives up.
- Cause: the packet was dropped by a firewall, routing issue, or the host is unreachable.
- Occurs after a long wait (30 seconds to 2+ minutes).
- Does not prove the network path works.

```bash
curl -v http://host:port    # shows which stage fails
nc -vz host port            # raw TCP test
```

### How do you check which process is listening on a port?

```bash
sudo ss -lntp
sudo ss -lntp | grep :8080
sudo lsof -i :8080
```

### How do you debug DNS?

```bash
dig example.com                          # full query with answer section
dig @8.8.8.8 example.com                 # test specific resolver
resolvectl status                        # systemd-resolved config
cat /etc/resolv.conf                     # resolver configuration
nslookup example.com                     # alternative query tool
```

### What does many CLOSE-WAIT connections suggest?

The remote side closed the connection, but the local application did not close its socket. This often indicates an application bug or resource leak. Watch the count over time with `watch -n2 'ss -tanp | grep -c CLOSE_WAIT'`. Growing count = leak.

---

## systemd Questions

### How do you debug a failed service?

```bash
systemctl status SERVICE
systemctl cat SERVICE
journalctl -u SERVICE -n 200 --no-pager
journalctl -p err -n 100 --no-pager
```

Check unit file, environment files, permissions, working directory, restart limits, and port conflicts.

### What is `daemon-reload`?

It makes systemd reload unit files after changes.

```bash
sudo systemctl daemon-reload
```

### How do you tune `ulimit` for a high-connection service?

Full answer:

> For a high-connection service (proxies, API gateways, databases), each connection uses a file descriptor. A service handling 50,000 connections needs `nofile` above 50,000 plus headroom for other open files.
>
> First I confirm the current limit and actual usage:

```bash
cat /proc/PID/limits | grep "open files"
ls /proc/PID/fd | wc -l
```

> For systemd-managed services, I add to the unit file:

```ini
[Service]
LimitNOFILE=131072
```

> For session-level limits (non-systemd processes):

```bash
# /etc/security/limits.conf
appuser soft nofile 131072
appuser hard nofile 131072
```

> System-wide check to ensure the system limit is also high enough:

```bash
cat /proc/sys/fs/file-max
# Increase if needed:
sysctl -w fs.file-max=2097152
# Persist in /etc/sysctl.conf:
echo "fs.file-max = 2097152" >> /etc/sysctl.conf
```

---

## cgroups And Containers

### How do cgroups work and how do they relate to containers?

> cgroups (control groups) are a Linux kernel mechanism that organises processes into hierarchical groups and enforces resource limits on each group.
>
> cgroups v2 uses a unified hierarchy at `/sys/fs/cgroup/`. Key controllers:
> - `cpu`: limits CPU time via CFS quota (`cpu.max`)
> - `memory`: limits RAM and can trigger OOM kill within the cgroup (`memory.max`)
> - `io`: limits block I/O bandwidth
> - `pids`: limits number of processes
>
> Every container runtime (Docker, containerd, CRI-O) creates a cgroup per container when it starts. The Kubernetes CPU and memory `limits` in pod specs are translated directly into cgroup settings on the node:
> - `cpu: "2"` becomes `cpu.cfs_quota_us = 200000` with `cpu.cfs_period_us = 100000`
> - `memory: "4Gi"` becomes `memory.max = 4294967296`
>
> When a container exceeds its memory limit, the cgroup OOM killer fires and terminates the process. Kubernetes sees this as OOMKilled and restarts the container.
>
> CPU throttling is silent — the process is forced to sleep during CFS periods where quota is exceeded. This causes latency but no restart.

```bash
cat /proc/PID/cgroup
systemd-cgls
cat /sys/fs/cgroup/<path>/cpu.stat   # nr_throttled shows throttle events
```

---

## Mock Interview Scenarios (Nebius Linux + Kubernetes)

### Q: A service is timing out only from some nodes. Walk me through your first ten minutes.

> First I confirm the scope: `kubectl get pods -o wide` to map affected pods to nodes. If pods on nodes A and C fail but B and D succeed, the pattern is node-local.
>
> On an affected node I test directly: `curl -v <service-ip>:<port>` to bypass DNS. Then `ss -s` for socket exhaustion. Then `journalctl -u kube-proxy --since '10m ago'` and `iptables -L KUBE-SERVICES -n -v` to validate rules.
>
> If retransmits appear in `ss -i`, I look at physical layer: `ethtool -S eth0` for NIC errors, `ip -s link` for TX/RX drops. Partial rack impact strongly suggests a bad ToR switch port or degraded NIC.

### Q: Explain how a packet reaches a Pod from outside the cluster.

> The packet enters at the cloud LB, which forwards to a node. On the node, kube-proxy (or Cilium eBPF) has installed DNAT rules — the destination is rewritten from the Service ClusterIP to the selected Pod IP. The kernel's conntrack table records this translation so replies can be un-NATted.
>
> The CNI plugin delivers the packet to the pod's veth pair inside its network namespace. In overlay CNIs like Flannel VXLAN, the packet is encapsulated in UDP, adding ~50 bytes overhead. If physical MTU is 1500 and pod MTU is not reduced, silent fragmentation and retransmits occur.

### Q: A Pod is Ready but requests still fail. Give me five causes.

> 1. Readiness probe passes a shallow path but the real handler is broken. Disproof: `kubectl exec` and curl the actual endpoint.
> 2. Service selector does not match pod labels. `kubectl get endpoints <svc>` — pod IP absent confirms mismatch.
> 3. Stale iptables rule after pod replacement. Compare pod IP in `iptables -L KUBE-SEP-* -n` vs current pod IP.
> 4. NetworkPolicy blocks caller's namespace. `kubectl get netpol -A` and trace ingress rules.
> 5. App bound to 127.0.0.1 not 0.0.0.0. `ss -tlnp` inside the pod confirms bind address.

### Q: Why can memory pressure hurt latency before OOM kill?

> The most impactful mechanism is direct reclaim. When a cgroup's memory is near its limit, any new allocation triggers synchronous page reclaim in the calling thread's context — that allocation call now takes milliseconds instead of nanoseconds. This shows up as P99 spikes without OOM events.
>
> kswapd also competes for CPU. Dirty page writeback throttling can stall writes. THP compaction scans pause memory access. All before any OOM kill.

```bash
sar -B 1 5
cat /proc/vmstat | grep pgmajfault
```

### Q: DNS issue suspected but team says "network is down." How do you arbitrate?

> I run two parallel tests from inside the affected pod. Test one: `curl -v http://<direct-pod-ip>:<port>/` — bypasses DNS. If it succeeds, the network is not down. Test two: `dig @<coredns-ip> <service>.namespace.svc.cluster.local` — if this returns NXDOMAIN or times out, CoreDNS is the problem.
>
> I check CoreDNS pods for restarts and CPU throttling (`kubectl top pod -n kube-system`). I present evidence neutrally: "TCP works, DNS fails at time X, CoreDNS pod was at 98% CPU limit. The network path is fine; the DNS resolver is the bottleneck."

### Q: What does kubelet do that matters during a bad rollout?

> kubelet enforces readiness probes — if they fail, it removes pods from endpoint slices, protecting the service. It enforces liveness probes — if misconfigured with too-short timeout, it restarts containers that are merely slow under load.
>
> During a crash loop, kubelet pulls images and starts containers repeatedly — this uses ephemeral storage and can trigger DiskPressure. kubelet emits events that surface in `kubectl describe pod`, usually the first signal to on-call.

---

## Scenario Questions

### A host has high load but CPU is mostly idle. What do you do?

Check blocked processes and I/O wait.

```bash
vmstat 1 5
ps aux | awk '$8 ~ /D/ {print}'
iostat -xz 1 5
```

Likely causes: disk bottleneck, network storage issue, stuck filesystem, or blocked kernel calls.

### A service is running but users get 503. What do you check?

Check service health endpoint, listening port, load balancer target health, logs, resource pressure, and dependencies.

### A process is using too many file descriptors. What do you check?

```bash
ls /proc/PID/fd | wc -l
cat /proc/PID/limits | grep files
sudo lsof -p PID | head
```

Then decide whether it is a leak or limit too low.

### A node had an OOM kill. How do you explain it?

Identify killed process, memory pressure timeline, cgroup/host boundary, recent deploy or traffic change, and whether requests/limits or host capacity need adjustment.

---

## Staff-Level Questions

### How do you troubleshoot Linux during an incident without making it worse?

Collect a fast snapshot, classify the failure, avoid destructive commands, mitigate only the clear bottleneck, preserve evidence, and communicate uncertainty.

### What are signs of poor Linux operational maturity?

No runbooks, no baseline metrics, no log retention, manual restarts without evidence, no cgroup visibility, no disk/inode alerts, and inability to correlate app symptoms with host signals.

### What should every SRE know cold?

Processes, systemd, logs, permissions, CPU/load, memory/OOM, disk/inodes, networking basics, DNS, cgroups, and safe mitigation patterns.

### Design the observability strategy for a fleet of 10,000 Linux nodes.

> For 10,000 nodes I need observability at four layers: host metrics, process metrics, kernel events, and application logs.
>
> **Host metrics:** Run a metrics agent (Prometheus node_exporter or similar) on every node. Collect CPU (per-core us/sy/id/wa/st), memory (available, swap, dirty, writeback), disk (bytes, inodes, await per device), network (bytes, errors, drops per interface), and system-level counters (load average, fd usage, process count).
>
> **Kernel events:** Collect `dmesg` ring buffer via a log agent (Fluentbit, Promtail). Forward to a central log store. Alert on OOM kills, I/O errors, blocked tasks, filesystem remounts, and NIC resets.
>
> **Process and cgroup metrics:** Track cgroup CPU throttle rate, memory usage vs limit, and OOM events per container/pod. For Kubernetes, this is available via the kubelet metrics endpoint.
>
> **Alerting tiers:**
> - Page immediately: host unreachable, OOM kill on critical process, disk 100% bytes or inodes, node NotReady.
> - Warn: disk above 80%, inode above 80%, memory available below 10%, swap in/out nonzero for 5 minutes, CPU steal above 5%.
> - Trend: fd count growth, connection state anomalies, iowait trending up.
>
> **At scale specifics:** Use pull-based metrics (Prometheus scrape) with push gateway for short-lived jobs. Store metrics at 15-second resolution for 30 days. Use remote write to a long-term store for 1-year retention. Alert on anomaly (stddev) rather than static thresholds where possible.
>
> **Operational tooling:** Fleet-wide command execution via Ansible or parallel-ssh for investigations. Config drift detection via a policy-as-code tool. Node labeling in Prometheus metadata for filtering by AZ, role, and OS version.
