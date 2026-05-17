---
title: "🐧 Linux & Systems"
sidebar_position: 9
description: "Zero to hero study guide for Linux & Systems — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

Linux is the substrate for everything in modern infrastructure. Kubernetes nodes run Linux. Docker runs Linux containers. Cloud VMs run Linux. Even "serverless" Lambda functions run on Linux. As a Staff/Principal SRE, deep Linux knowledge is the foundation for understanding why systems behave the way they do under load, during incidents, and at the edges of their design.

---

## 📋 Prerequisites & Mental Models

**Everything is a file** — devices, processes, network sockets, kernel parameters — all exposed as files in the filesystem hierarchy. `/proc` is a window into the kernel's live state. `/sys` exposes kernel subsystem configuration. `/dev` is device interfaces.

**The process model** — all processes are children of PID 1. `fork()` creates a copy, `exec()` replaces the process image. Understanding the process tree explains why killing a parent leaves orphans, why signals propagate the way they do, and why `SIGKILL` cannot be caught.

**Kernel space vs user space** — applications run in user space, cannot directly touch hardware. System calls (read, write, fork, ioctl) cross the boundary. The kernel validates and mediates all hardware access.

---

## 🔷 Core Concepts

### File System Hierarchy

```
/           Root of the filesystem tree
├── /boot   Kernel, bootloader (GRUB)
├── /etc    System-wide configuration files
├── /var    Variable data: logs, spool, databases
├── /tmp    Temporary files (cleared on reboot)
├── /proc   Virtual FS: kernel and process info (live, not on disk)
├── /sys    Virtual FS: kernel subsystem and hardware configuration
├── /dev    Device files (block devices, character devices)
├── /bin    Essential binaries (now often symlink to /usr/bin)
├── /usr    User programs and libraries
├── /home   User home directories
├── /root   Root user home
├── /opt    Optional third-party software
├── /mnt    Temporary mount points
└── /srv    Service data (web server files, etc.)
```

**Inodes** — the filesystem's metadata record for every file (permissions, ownership, timestamps, block pointers). Not the filename — filenames are directory entries pointing to inodes. Hard links are multiple directory entries pointing to the same inode. `ls -i` shows inode numbers.

### File Permissions

```
-rwxr-xr--  1  owner  group  4096  Jan 1 12:00  filename
│└┬┘└┬┘└┬┘
│ │  │  │
│ │  │  └── Other: r-x = read + execute, no write
│ │  └───── Group: r-x = read + execute, no write
│ └──────── Owner: rwx = read + write + execute
└────────── File type: - (file), d (dir), l (symlink), c (char device), b (block device)
```

**Numeric permissions:** r=4, w=2, x=1. Owner/Group/Other:
- `chmod 755` = rwxr-xr-x (owner: all, group+other: read+execute)
- `chmod 644` = rw-r--r-- (owner: read+write, group+other: read only)
- `chmod 600` = rw------- (owner: read+write only, no access for others)

**Special bits:**
- `setuid (4000)` — execute with owner's permissions (passwd, sudo)
- `setgid (2000)` — execute with group's permissions; on directories, new files inherit group
- `sticky bit (1000)` — on directories: only owner can delete their files (used on /tmp)

**umask** — default permission mask subtracted from 666 (files) or 777 (dirs). `umask 022` → files get 644, dirs get 755.

### Process Management

**Key commands:**
```bash
ps aux                          # all processes, detailed
ps -ef --forest                 # process tree
top / htop                      # interactive process viewer
kill -9 PID                     # SIGKILL: immediate, uncatchable
kill -15 PID                    # SIGTERM: graceful shutdown (default)
kill -1 PID                     # SIGHUP: reload config (many daemons)
pkill -f "pattern"              # kill by command pattern
nice -n 10 command              # start with lower priority
renice -n 5 -p PID              # change priority of running process
```

**Process states:** R (running), S (sleeping/interruptible), D (uninterruptible sleep — usually IO), Z (zombie — parent hasn't waited), T (stopped).

**Signals:** SIGTERM (15) is the polite shutdown request. Processes can catch and handle it for graceful shutdown. SIGKILL (9) cannot be caught — kernel terminates immediately. SIGINT (2) is Ctrl+C. SIGHUP (1) traditionally reloads config. SIGUSR1/SIGUSR2 are application-defined.

**Zombie processes** — process has exited but parent hasn't called `wait()`. They consume a PID slot but no memory. If they accumulate, you'll run out of PIDs. Fix: fix the parent process, or kill the parent (zombie's children are adopted by init).

### Memory Management

```bash
free -h                         # memory overview
cat /proc/meminfo               # detailed memory stats
vmstat 1 10                     # memory + swap + cpu stats, 10 samples
```

**Memory types:**
- **Resident Set Size (RSS)** — physical RAM the process is using
- **Virtual Memory Size (VSZ)** — total virtual address space (includes shared libs, mmap)
- **Shared memory** — pages shared with other processes (same library loaded once)
- **Buffers/Cache** — disk cache; Linux uses all free RAM for cache (this is correct behavior, not a leak)

**OOM Killer** — when memory is exhausted, kernel invokes OOM killer. It scores processes and kills the one with the highest `oom_score`. Container memory limits trigger OOMKill before the node-level OOM killer.

**Swap** — disk-backed virtual memory. Swap I/O is orders of magnitude slower than RAM. High swap usage = serious performance problem. In containers, disable swap or set `swappiness=0`.

### Networking

```bash
ip addr show                    # show interfaces and IPs (modern, not ifconfig)
ip route show                   # routing table
ip neigh                        # ARP table
ss -tulpn                       # listening sockets with process info (modern, not netstat)
ss -t state established         # established TCP connections
curl -v --trace-time url        # detailed HTTP timing
traceroute / tracepath          # path to host
tcpdump -i eth0 port 80         # capture packets on port 80
tcpdump -w capture.pcap         # write to file for Wireshark analysis
```

**TCP states:** ESTABLISHED, LISTEN, TIME_WAIT, CLOSE_WAIT, SYN_SENT. `TIME_WAIT` is normal — holds port for 2×MSL after connection close. Too many TIME_WAIT connections = port exhaustion risk; tune `net.ipv4.tcp_tw_reuse`.

**Key network files:**
- `/etc/hosts` — static hostname resolution (checked before DNS)
- `/etc/resolv.conf` — DNS servers
- `/etc/nsswitch.conf` — name service switch: order of resolution (files, dns, etc.)
- `/proc/net/tcp` — raw TCP connection table
- `/proc/net/if_inet6` — IPv6 interface info

### Disk & I/O

```bash
df -h                           # disk usage per filesystem
du -sh /path/*                  # directory sizes
lsblk                          # block devices and partitions
fdisk -l                        # partition tables
mount | column -t               # mounted filesystems
iostat -x 1                    # I/O statistics (requires sysstat)
iotop                          # per-process I/O usage
```

**Filesystem types:**
- **ext4** — reliable, widely supported, good general purpose
- **xfs** — better for large files and parallel I/O, good for databases
- **btrfs** — copy-on-write, snapshots, checksums — higher overhead
- **tmpfs** — RAM-backed, fast, disappears on reboot (used for /tmp, /dev/shm)

**LVM (Logical Volume Manager):**
```
Physical Volumes (PVs) → Volume Group (VG) → Logical Volumes (LVs) → Filesystems
```
LVM enables: resize LVs without downtime, snapshots for backups, spanning multiple disks.

### systemd

The init system and service manager (PID 1 in modern Linux).

```bash
systemctl status nginx          # show service status
systemctl start/stop/restart nginx
systemctl enable/disable nginx  # start on boot
systemctl list-units --failed   # show failed units
journalctl -u nginx -f          # follow service logs
journalctl -u nginx --since "1 hour ago"
journalctl -p err               # only error level logs
systemd-analyze blame           # boot time per service
```

**Unit file (service):**
```ini
[Unit]
Description=My Application
After=network.target

[Service]
Type=exec
User=myapp
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/server
Restart=on-failure
RestartSec=5s
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

**Key settings:** `Restart=on-failure` restarts crashed services. `LimitNOFILE` sets file descriptor limit (important for services handling many connections). `After=` defines ordering, not dependency.

---

## 🛠️ Tools & Ecosystem

### Essential CLI Tools

```bash
# Text processing
grep -r "pattern" /path         # recursive search
grep -E "regex" file            # extended regex
awk '{print $1, $3}' file       # column extraction
sed 's/old/new/g' file          # stream edit
sort | uniq -c | sort -rn       # count occurrences, sort by frequency
cut -d: -f1 /etc/passwd         # extract field from delimited file
jq '.items[].name' file.json    # JSON processing

# System investigation
strace -p PID                   # trace system calls of running process
lsof -p PID                     # open files for process
lsof -i :8080                   # process listening on port 8080
perf top                        # CPU profiling (Linux perf)
dmesg | tail -20                # kernel ring buffer messages
/var/log/syslog or /var/log/messages  # system logs

# Network debugging  
curl -o /dev/null -w "%{time_total}
" url  # measure URL response time
nslookup hostname               # DNS lookup (interactive)
dig hostname                    # DNS lookup (detailed)
dig +short hostname             # just the IP
openssl s_client -connect host:443  # test TLS connection
```

### Performance Tools (USE Method)

**Utilization, Saturation, Errors** — check each resource:

```bash
# CPU
top / htop                      # utilization
vmstat 1                        # run queue (saturation)
mpstat -P ALL 1                 # per-CPU utilization

# Memory
free -h                         # utilization
vmstat 1 (si/so columns)       # swap I/O (saturation)

# Disk I/O
iostat -x 1                    # %util (utilization), await (saturation)
iotop                          # per-process

# Network
sar -n DEV 1                   # network interface utilization
```

---

## 🏗️ Architecture Patterns

### Linux Boot Process

1. BIOS/UEFI firmware initializes hardware
2. GRUB bootloader loads kernel from /boot
3. Kernel decompresses, initializes hardware, mounts initrd
4. initrd runs early userspace (finds root filesystem)
5. Kernel mounts root filesystem, starts PID 1 (systemd)
6. systemd runs targets (multi-user.target, etc.) in order

### cgroups & namespaces (Container Foundation)

**cgroups v2:** hierarchical resource limits. Every process belongs to a cgroup. Limits: cpu.max, memory.max, io.max. Container memory limits = cgroup memory.max. View: `cat /proc/PID/cgroup`, explore `/sys/fs/cgroup/`.

**Namespaces:** isolation layers:
- `pid` — process tree isolation (PID 1 in container)
- `net` — separate network stack (own IP, interfaces)
- `mnt` — separate filesystem view
- `uts` — separate hostname/domainname
- `ipc` — separate shared memory
- `user` — UID/GID mapping (container root ≠ host root)

Inspect: `ls -la /proc/PID/ns/`

### SSH Hardening

```ini
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers deploy ops
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
```

---

## ⚙️ Production Operations

### System Performance Debugging (60-Second Assessment)

```bash
uptime                          # load averages (1, 5, 15 min)
dmesg | tail -20                # kernel errors
vmstat 1 3                      # overall system stats
mpstat -P ALL 1 1               # CPU breakdown
pidstat 1 1                     # per-process CPU
iostat -xz 1 1                  # disk I/O
free -m                         # memory
sar -n DEV 1 1                  # network
sar -n TCP,ETCP 1 1             # TCP stats
top                             # identify top processes
```

**Load average interpretation:** compare to number of CPU cores. Load=4.0 on 4 cores = 100% busy. Load=4.0 on 8 cores = 50% busy. Sustained load > CPU count = saturation.

### Log Management

```bash
journalctl --vacuum-size=1G     # limit journal size
journalctl --since "2024-01-01" --until "2024-01-02"
logrotate -d /etc/logrotate.conf  # dry-run rotation
```

**Structured logging:** applications should log JSON to stdout; systemd/journald captures it; Fluent Bit ships to Loki/Elasticsearch.

### File Descriptor Limits

Many connection issues are actually FD exhaustion:
```bash
ulimit -n                       # current per-process FD limit (default: 1024)
cat /proc/sys/fs/file-max       # system-wide FD limit
lsof | wc -l                    # current open files system-wide

# Permanent increase:
# /etc/security/limits.conf
* soft nofile 65536
* hard nofile 65536
```

---

## 📊 Observability & Debugging

### Key Metrics

```
CPU: overall utilization, per-core, iowait (waiting for disk), steal (VM)
Memory: used, available (not free), swap used, page faults
Disk: utilization %, await (latency), IOPS, throughput
Network: packets/s, bytes/s, errors, drops, retransmits
System: load average, context switches, interrupts
```

### Interpreting `top`

```
top - 14:30:01 up 45 days, load average: 1.23, 0.87, 0.65
Tasks: 234 total, 2 running, 232 sleeping
%Cpu(s): 12.5 us, 3.2 sy, 0.0 ni, 82.1 id, 1.8 wa, 0.0 hi, 0.4 si
         └ user  └ system              └ idle  └ iowait
MiB Mem: 15873.2 total, 1234.5 free, 8456.7 used, 6181.9 buff/cache
```

- `iowait` > 20%: disk I/O bottleneck
- `si` (software interrupts) > 10%: network interrupt processing under load (consider RSS)
- Load > nCPU: CPU saturation — processes waiting in run queue

---

## 🔐 Security Considerations

**Principle of least privilege:**
- Run services as dedicated non-root users
- Use `setcap CAP_NET_BIND_SERVICE` instead of root for ports <1024
- `sudo` for specific commands only, logged

**Auditd** — kernel-level audit log of system calls, file access, user logins:
```bash
auditctl -w /etc/passwd -p wa -k passwd_changes
ausearch -k passwd_changes
```

**SELinux / AppArmor** — mandatory access control. Processes are confined to defined profiles. `getenforce` (SELinux) shows status. Use `audit2allow` to create policies from denials rather than disabling SELinux.

**SSH key management:** use `~/.ssh/authorized_keys` for public keys. Centralize via LDAP or Teleport for teams. Regularly audit and rotate keys.

---

## 🎓 Staff/Principal Engineer Perspective

**Use eBPF for performance analysis** — tools like `bpftrace`, `bcc`, and BCC tools (`execsnoop`, `opensnoop`, `tcpretrans`) let you trace kernel activity with zero overhead when not active. This is the modern alternative to strace (which has overhead).

**Kernel tuning for production:** most defaults are conservative. For high-throughput workloads:
```bash
# TCP tuning for high connection rate
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Increase file descriptor limits
fs.file-max = 2097152

# Reduce TCP TIME_WAIT for connection reuse
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
```

**Understand the memory hierarchy:** cache misses are the primary cause of unexpected latency. L1 cache access: ~1ns. L2: ~5ns. RAM: ~100ns. SSD: ~100μs. Network round trip: ~1ms. These numbers explain why Redis is fast (RAM), why databases benefit from in-memory caching, and why database connection pooling matters.

---

## 💥 Failure Modes & Incident Patterns

**Disk full:** application stops writing, logs stop, databases corrupt. Prevention: monitor disk at >80%, alert at >85%, have a runbook for emergency cleanup. Reserve 5% of disk for root (df shows this).

**Load spike from fork bomb:** `:(){ :|:& };:` depletes process table. Prevention: `LimitNPROC` in systemd unit files, `/etc/security/limits.conf`.

**zombie accumulation:** signals that parent isn't reaping children. If PID 1 is a shell script (not a real init), it won't reap zombies. In containers: use `tini` as PID 1 or Docker's `--init` flag.

**FD exhaustion:** `too many open files` errors, often in high-connection services. Quick check: `lsof -p PID | wc -l`. Fix: increase `LimitNOFILE` in systemd unit.

---

## 💼 Interview & Design Review Prep

**"A server has high load average but low CPU utilization — what's happening?"**
`iowait`: processes blocking on disk I/O. Check `iostat -x`: high `await` and `%util`. Also check `vmstat`: `b` column shows processes in uninterruptible sleep (waiting for I/O).

**"How does a process get a port number < 1024?"**
Must be root, OR have `CAP_NET_BIND_SERVICE` capability (via `setcap`), OR use authbind. Best practice: start as root, bind port, drop privileges to unprivileged user.

**"Explain the difference between a process and a thread"**
Processes have separate address spaces; threads share address space within a process. Context switch between threads is cheaper than between processes. All Linux threads are implemented as processes via `clone()` with shared resources.

---

## 📚 Key Takeaways

1. **Everything is a file** — /proc and /sys expose live kernel state; learn to read them
2. **Load average must be compared to CPU count** — 4.0 means different things on 2 vs 16 CPUs
3. **Buffer/cache memory is not wasted** — Linux reclaims it under pressure; "available" is what matters
4. **iowait means disk is the bottleneck** — not the CPU; iostat is your next tool
5. **Always check file descriptor limits** — "too many open files" is almost always `ulimit -n` being too low
6. **Use `ss` not `netstat`** — ss is faster and correct; netstat is deprecated
7. **systemd logs everything** — journalctl is your first stop for service debugging
8. **cgroups = container resource limits** — the same mechanism that limits containers is available to all services
9. **`strace` has overhead** — use it surgically in production, prefer eBPF tools (bpftrace) at scale
10. **SIGTERM before SIGKILL** — always give processes a chance to clean up
11. **Check dmesg for kernel messages** — OOM kills, hardware errors, network driver issues all appear here
12. **SSH key rotation is operational hygiene** — unused keys are attack surface
13. **Kernel tuning requires benchmarking** — sysctl changes should be validated with production workloads
14. **Disk full stops writes immediately** — monitor at 80%, alert at 85%, never hit 100%
15. **The process tree reveals architecture** — `ps --forest` shows you how your system is actually organized



---

## 📁 Source Documents

> 31 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[Linux] 1740016028922](http://localhost:8765/api/documents/4a89af80-41ac-4fc1-9432-5ed8f1216223/view) | PDF | beginner |
| [[Linux] 1740016371759](http://localhost:8765/api/documents/337366ab-dbd7-449b-89d7-1b10980bbb66/view) | PDF | beginner |
| [[Linux] 1741878559328](http://localhost:8765/api/documents/2420300e-06e1-4e6a-b055-b724accdc6cd/view) | PDF | intermediate |
| [[Linux] 1741953295160](http://localhost:8765/api/documents/07847559-6b17-4b33-b51c-378a879af9e4/view) | PDF | intermediate |
| [[Linux] 1742166489504](http://localhost:8765/api/documents/33062d1c-da34-43bc-8009-c297c09f4fa3/view) | PDF | beginner |
| [[Linux] 1742972904431](http://localhost:8765/api/documents/2d590413-3d96-48ac-bda1-f864440057cd/view) | PDF | beginner |
| [[Linux] 1743019011401](http://localhost:8765/api/documents/2be6ced4-f948-4b77-b5f3-367cd4cd3f50/view) | PDF | intermediate |
| [[Linux] 1743193266079](http://localhost:8765/api/documents/2f317611-06a5-484b-82cb-ca4857af8db5/view) | PDF | intermediate |
| [[Linux] 1743348519032](http://localhost:8765/api/documents/2c56d411-a128-428f-96d0-18683d0150ae/view) | PDF | beginner |
| [[Linux] 1744135868388](http://localhost:8765/api/documents/c7660f77-c762-4d51-9b84-f083b2fbaffd/view) | PDF | beginner |
| [[Linux] Basic Level Commands](http://localhost:8765/api/documents/1ef03cc7-8eaf-49b2-a20d-d3d9a8993c62/view) | PDF | beginner |
| [[Linux] BootProcess](http://localhost:8765/api/documents/d09afe03-8c80-48eb-921e-6939841b5880/view) | GIF | intermediate |
| [[Linux] Curl Commands](http://localhost:8765/api/documents/aab5bd5b-4e01-4511-b86b-5af6c95b3427/view) | JPG | beginner |
| [[Linux] DevopsCheatsheet](http://localhost:8765/api/documents/bac7c8b5-b577-4a8c-b614-1dde63152661/view) | PDF | beginner |
| [[Linux] Linux FS](http://localhost:8765/api/documents/528e95ad-9d66-4672-811e-77cfaa6fd662/view) | GIF | intermediate |
| [[Linux] What is LVM](http://localhost:8765/api/documents/b0e5d4f2-e9cb-4619-8065-d47959875cd2/view) | PDF | intermediate |
| [[Interview Ouestions > Linux] 1738956449752](http://localhost:8765/api/documents/385d0965-5bd0-4d7b-b9a1-9d1295f2c336/view) | PDF | beginner |
| [[Interview Ouestions > Linux] 1739758169462](http://localhost:8765/api/documents/d8573449-f941-406a-bdcc-5567fc3da7d5/view) | PDF | intermediate |
| [[Interview Ouestions > Linux] 1741025303181](http://localhost:8765/api/documents/6e8986d5-2201-44da-8d0a-876606ceb3d1/view) | PDF | beginner |
| [[Interview Ouestions > Linux] 1741228624828](http://localhost:8765/api/documents/56f29976-51a2-4853-bf92-ab0953b37aca/view) | PDF | beginner |
| [[Interview Ouestions > Linux] 1741588566278](http://localhost:8765/api/documents/f6a3a094-5b49-4886-aa74-4ae71584ce84/view) | PDF | intermediate |
| [[Interview Ouestions > Linux] 1741678379903](http://localhost:8765/api/documents/c25a395c-49d5-4d89-9aad-77415283ebad/view) | PDF | beginner |
| [[Interview Ouestions > Linux] 1741682113389](http://localhost:8765/api/documents/a731f05c-8c22-44d9-a652-c8804457969f/view) | PDF | beginner |
| [[Interview Ouestions > Linux] 1742058246535](http://localhost:8765/api/documents/3040c4db-c832-4c3e-8adc-edcf6a3dedbd/view) | PDF | intermediate |
| [[Interview Ouestions > Linux] 1742526608815](http://localhost:8765/api/documents/0e91b5ab-bebf-4608-b27d-09e7171354f2/view) | JPG | intermediate |
| [[Interview Ouestions > Linux] 1745044439807](http://localhost:8765/api/documents/63c9e2ec-016e-41d2-aa09-8c2be1b6c82d/view) | PDF | intermediate |
| [[Interview Ouestions > Linux] 1745926735252](http://localhost:8765/api/documents/9866d64b-6f56-4752-b4c7-c9d923cf9049/view) | PDF | staff-level |
| [[Bash Scripting] 1739951943036](http://localhost:8765/api/documents/244bd729-ffb6-4d0f-9a49-a978d4d3a6a1/view) | PDF | intermediate |
| [[Bash Scripting] 1741491098763](http://localhost:8765/api/documents/976d4b31-e0c4-45c5-b510-c6128eaeb75f/view) | PDF | intermediate |
| [[Bash Scripting] 1741835354329](http://localhost:8765/api/documents/267f0877-c084-4a0b-9574-6b361a5c2632/view) | PDF | intermediate |
| [[Bash Scripting] 1741874554309](http://localhost:8765/api/documents/a866f9a4-ec7c-46cc-b62a-133cf60bd856/view) | PDF | intermediate |


<AIChatWidget domain="linux-systems" title="Ask AI about Linux & Systems" />

---

## [SRE] Foundations: Kubernetes Premium Teaching Guide For SRE And Platform Engineers

## Foundations: Kubernetes Premium Teaching Guide For SRE And Platform Engineers

Kubernetes is a platform for running containers reliably at scale.

It schedules workloads, heals failures, manages service discovery, supports rolling updates, controls resources, and provides a standard operating model across infrastructure.

Many engineers memorize YAML without understanding the system. This guide teaches Kubernetes from first principles to production mastery.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — understand cluster building blocks.
2. **Intermediate Layer** — deploy apps, expose traffic, debug pods.
3. **Advanced Layer** — scheduler, control plane, CNI, storage, autoscaling.
4. **Production SRE Layer** — real incident handling.
5. **Interview Layer** — explain Kubernetes like a senior engineer.

---

## Memory Palace: Kubernetes Is A City

| Kubernetes Concept | City Analogy | Real Meaning |
|---|---|---|
| Cluster | Entire city | Whole Kubernetes environment |
| Control Plane | City government | Makes decisions |
| Node | Building | Worker machine |
| Pod | Apartment | Smallest runnable unit |
| Container | Resident | Running application |
| Deployment | Housing manager | Maintains desired replicas |
| ReplicaSet | Apartment counter | Ensures pod count |
| Service | Public phone number | Stable access point |
| Ingress | City gate | External HTTP access |
| Namespace | District | Logical separation |
| ConfigMap | Notice board | Non-secret config |
| Secret | Vault | Sensitive config |
| PVC | Reserved warehouse space | Persistent storage |
| Scheduler | Housing allocator | Chooses node |
| kubelet | Building supervisor | Runs pods on node |
| CNI | Roads | Pod networking |
| HPA | Demand planner | Auto scales workloads |

When Kubernetes has problems, ask: is the issue in government, building, roads, apartments, storage, or public phone system?

---

## Beginner Layer: What Kubernetes Actually Solves

Without Kubernetes, teams manually start containers, restart failures, scale traffic spikes, update versions, and connect services.

Kubernetes automates:

- scheduling
- self-healing
- scaling
- service discovery
- rolling deployments
- config management

It is best understood as a desired-state control system. You declare what should exist. Kubernetes continuously tries to make reality match.

```text
Desired state -> control loops -> actual running workloads
```

---

## Beginner Layer: Core Architecture

```text
kubectl
  -> API Server
      -> etcd
      -> Scheduler
      -> Controller Manager
  -> Worker Nodes
      -> kubelet
      -> container runtime
      -> Pods
```

### API Server

The front door. Every `kubectl` request and controller action goes through it.

### etcd

The cluster database. It stores Kubernetes objects and desired state.

### Scheduler

Chooses which node should run a Pod.

### Controller Manager

Runs reconciliation loops. If desired replicas are 3 and actual replicas are 2, a controller creates another Pod.

### kubelet

The agent on each node. It ensures assigned Pods are running.

### Container Runtime

Actually starts containers. Common runtimes include containerd and CRI-O.

---

## Beginner Layer: Pod Explained

A Pod is the smallest deployable unit.

Usually it contains one application container and sometimes helper sidecars.

Pods are ephemeral:

- they can die
- they can be recreated
- they can move to another node
- their IP can change

Never treat Pods like pets. Treat them like replaceable apartments in the city.

Useful commands:

```bash
kubectl get pods -A
kubectl describe pod POD -n NAMESPACE
kubectl logs POD -n NAMESPACE
kubectl exec -it POD -n NAMESPACE -- sh
```

---

## Beginner Layer: Deployment Explained

Use Deployments for stateless apps.

A Deployment manages ReplicaSets, and ReplicaSets manage Pods.

```text
Deployment -> ReplicaSet -> Pods
```

Deployment gives you:

- desired replica count
- rolling updates
- rollback
- failed Pod replacement

```bash
kubectl get deploy
kubectl rollout status deploy/web
kubectl rollout history deploy/web
kubectl rollout undo deploy/web
```

---

## Beginner Layer: Service Explained

Pods change IPs. A Service gives stable access.

| Type | Use |
|---|---|
| ClusterIP | Internal access |
| NodePort | Expose through every node on a port |
| LoadBalancer | Cloud load balancer integration |
| Headless | Direct pod discovery |

A Service selects Pods using labels. If selectors do not match labels, the Service has no useful backend.

```bash
kubectl get svc
kubectl describe svc api
kubectl get endpointslice
```

---

## Beginner Layer: Ingress Explained

Ingress routes HTTP and HTTPS traffic into the cluster.

```text
Internet -> Load Balancer -> Ingress Controller -> Service -> Pod
```

Ingress commonly handles:

- hostnames
- paths
- TLS
- routing to Services

---

## Intermediate Layer: kubectl Essentials

Learn what each command answers.

```bash
kubectl get pods
kubectl get deploy
kubectl get svc
kubectl get nodes
kubectl get events -A --sort-by=.lastTimestamp
kubectl describe pod POD
kubectl logs POD --previous
kubectl exec -it POD -- sh
```

`get` shows state. `describe` shows details and events. `logs` shows app output. `events` show what the cluster tried to do.

---

## Intermediate Layer: ConfigMaps, Secrets, And Namespaces

### ConfigMap

Stores non-sensitive configuration.

### Secret

Stores sensitive values, but must still be protected with RBAC, encryption at rest, and careful logging.

### Namespace

A logical district for resources.

Use namespaces for environment, ownership, access boundaries, quotas, and operational clarity.

---

## Intermediate Layer: Requests And Limits

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "1"
    memory: "1Gi"
```

### Requests

Used by the scheduler. They say: reserve this much capacity for placement.

### Limits

Used at runtime. They say: do not let the container exceed this boundary.

Important behavior:

- CPU limit usually throttles
- memory limit can OOMKill
- missing requests cause poor scheduling
- requests too low create noisy-neighbor risk

---

## Intermediate Layer: Probes

| Probe | Question | Result |
|---|---|---|
| Startup | Has the app finished booting? | protects slow startup |
| Readiness | Can this Pod receive traffic? | controls Service endpoints |
| Liveness | Is the app stuck and should restart? | restarts container |

Bad probes cause outages. Do not use liveness to check a database dependency. If the DB is down, restarting every app instance creates a storm.

---

## Advanced Layer: Scheduler Deep Dive

The scheduler places Pods on nodes.

It considers:

- CPU and memory requests
- taints and tolerations
- node selectors
- affinity and anti-affinity
- topology spread
- volume constraints
- quotas and policy

A Pending Pod is usually not an app bug. It means the scheduler cannot place it.

```bash
kubectl describe pod POD
kubectl describe node NODE
kubectl get events -A --sort-by=.lastTimestamp
```

---

## Advanced Layer: Taints, Tolerations, Affinity

### Taints

Keep normal Pods away from special nodes.

Examples:

- GPU nodes
- database nodes
- infra-only nodes

### Tolerations

Allow a Pod to tolerate a taint.

### Anti-Affinity

Spread replicas across nodes or zones for availability.

Senior habit: placement is part of reliability design, not only capacity management.

---

## Advanced Layer: Kubernetes Networking

Each Pod gets an IP. Services provide stable virtual access. The CNI plugin makes Pod networking real.

```text
Client -> Service IP -> kube-proxy/eBPF -> Pod IP
```

Important pieces:

- CNI plugin
- CoreDNS
- Service
- EndpointSlice
- Ingress controller
- NetworkPolicy

If direct Pod IP works but Service fails, focus on Service, EndpointSlice, kube-proxy/eBPF, or policy.

---

## Advanced Layer: Storage

Persistent workloads need storage beyond Pod lifetime.

```text
PVC requests storage
PV provides storage
Pod mounts volume
```

Concepts:

- Volume
- PersistentVolume
- PersistentVolumeClaim
- StorageClass
- CSI driver

Storage problems often appear as Pods stuck in Pending or ContainerCreating.

---

## Advanced Layer: StatefulSet

Use StatefulSet for workloads needing stable identity and storage.

Examples:

- PostgreSQL
- Kafka
- Elasticsearch

StatefulSet provides:

- stable Pod names
- ordered rollout
- stable volume identity

Stateful workloads require deeper failure planning than stateless Deployments.

---

## Advanced Layer: Autoscaling

### HPA

Scales Pod replicas using CPU, memory, or custom metrics.

### Cluster Autoscaler / Karpenter

Adds or removes nodes based on pending workloads and capacity needs.

Autoscaling only works well when requests, metrics, and startup behavior are sane.

---

## Production SRE Layer: Incident Framework

When Kubernetes breaks, first classify the failure.

Ask:

1. Is user traffic broken?
2. Are Pods running?
3. Are Pods ready?
4. Does Service have endpoints?
5. Is the failure scoped to one node, namespace, deployment, AZ, or cluster?
6. Did a rollout or config change happen?

Core commands:

```bash
kubectl get pods -A
kubectl get nodes
kubectl get events -A --sort-by=.lastTimestamp
kubectl describe pod POD
kubectl logs POD --previous
kubectl get svc,endpointslice -n NAMESPACE
```

---

## Production Incident Walkthroughs

### CrashLoopBackOff

Likely causes:

- bad config
- missing secret
- app exits immediately
- dependency unavailable
- bad command or args

Check:

```bash
kubectl describe pod POD
kubectl logs POD --previous
```

### Pending Pods

Likely causes:

- insufficient CPU/memory
- taints not tolerated
- PVC unavailable
- impossible affinity
- quota exhausted

Check scheduler events in `kubectl describe pod`.

### Service Has No Traffic

Likely causes:

- selector mismatch
- readiness failing
- no endpoints
- wrong targetPort
- NetworkPolicy

Check:

```bash
kubectl describe svc SERVICE
kubectl get pods --show-labels
kubectl get endpointslice
```

### Node NotReady

Likely causes:

- kubelet issue
- disk pressure
- memory pressure
- CNI failure
- cloud node/network issue

Check:

```bash
kubectl describe node NODE
journalctl -u kubelet -n 200
```

---

## Kubernetes + Linux Connection

Kubernetes desired state becomes Linux reality.

| Kubernetes | Linux underneath |
|---|---|
| Pod | namespaces |
| requests/limits | cgroups |
| Service | iptables/IPVS/eBPF |
| volume | mounts/filesystems |
| container | process |
| node pressure | CPU/memory/disk pressure |

Weak Linux knowledge limits Kubernetes troubleshooting.

---

## Interview Layer: Strong Answers

### Why use Kubernetes?

> Kubernetes standardizes deployment, scaling, self-healing, service discovery, resource control, and rollout management for containerized workloads.

### Pod vs Deployment?

> A Pod is the runtime unit. A Deployment manages replicas and rolling updates for stateless workloads.

### Why can a Pod be Running but not healthy?

> Running means the container process exists. It does not prove readiness, dependency health, correct listener behavior, or application correctness.

### How would you debug a production outage?

> I would start from user impact, then inspect Pods, readiness, Services, EndpointSlices, events, nodes, rollout history, and dependencies. I separate control-plane state, node execution, service routing, and application behavior before changing anything.

---

## Labs

### Beginner

1. Deploy nginx.
2. Scale replicas.
3. Expose with ClusterIP.
4. Inspect Pods, Services, and logs.

### Intermediate

1. Perform rolling update and rollback.
2. Create ConfigMap and Secret.
3. Break readiness and observe endpoint removal.
4. Create ImagePullBackOff intentionally.

### Advanced

1. Add taints and tolerations.
2. Create HPA.
3. Apply NetworkPolicy default deny.
4. Create PVC and StatefulSet.
5. Inspect node-level kubelet/runtime logs.

---

## Memory Review

### Beginner Recall

- Why does Kubernetes exist?
- What is a Pod?
- Why does a Service exist?

### Intermediate Recall

- Request vs limit?
- Readiness vs liveness?
- Why use namespaces?

### Advanced Recall

- What does the scheduler consider?
- What does CNI do?
- Why can a Service have no endpoints?

### Production Recall

- How do you debug CrashLoopBackOff?
- How do you debug Pending?
- How do you separate app, Service, node, and control-plane failures?

---

## [SRE] Linux Debug Playbook Zero To Hero

## Linux Debug Playbook Zero To Hero

This playbook is for production days when a Linux host, service, node, or dependency is unhealthy and you need to reduce uncertainty fast.

The goal is not to memorize commands. The goal is to classify symptoms, collect evidence, interpret signals, and choose safe mitigations.

This guide is designed as a complete path:

- Beginner: where to start and what commands mean
- Intermediate: CPU, memory, disk, process, network, and log debugging
- Advanced: D-state, IO wait, OOM, deleted-open files, syscalls, conntrack, cgroups
- SRE Level: 10-minute triage, incident scenarios, mitigation discipline
- Interview Level: explain troubleshooting like a senior operator

---

## Part 1: Debugging Mindset

Before touching the system, ask:

1. What exactly is failing?
2. Who is impacted?
3. When did it start?
4. What changed?
5. Is this host-wide, service-specific, or dependency-related?

Senior rule:

> Observe before changing. Mitigate before perfect root cause when users are impacted.

---

## Part 2: The First 60 Seconds

Run a fast host snapshot:

```bash
hostname
date
uptime
w
whoami
```

Then check core resources:

```bash
top
free -h
vmstat 1 5
df -h
df -i
ss -s
journalctl -p err -n 50 --no-pager
dmesg | tail -50
```

Interpretation:

- load rising: pressure increasing
- low available memory: memory pressure
- swap activity: latency risk
- disk/inodes full: writes fail
- socket explosion: connection issue
- kernel errors: hardware/runtime clue

---

## Part 3: The 10-Minute Triage Routine

### 1. Classify Scope

```bash
systemctl status SERVICE
curl -vk http://localhost:PORT/health
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
```

Ask:

- is service running?
- is host unhealthy?
- is dependency unreachable?

### 2. Check CPU / Memory / IO

```bash
vmstat 1 5
iostat -xz 1 5
pidstat 1 5
```

### 3. Check Disk

```bash
df -h
df -i
du -sh /var/* | sort -rh | head
lsof +L1
```

### 4. Check Network

```bash
ip addr
ip route
ss -lntp
ss -tanp | head
resolvectl status
dig example.com
```

### 5. Check Errors

```bash
journalctl -u SERVICE -n 200 --no-pager
journalctl -p err -n 100 --no-pager
dmesg | tail -100
```

---

## Part 4: CPU And Load Debugging

Load average is not CPU percent.

Load includes runnable tasks and tasks stuck in uninterruptible sleep.

```bash
uptime
vmstat 1 5
mpstat -P ALL 1 5
pidstat -u 1 5
```

Interpretation:

- high `r`: CPU run queue
- high `b`: blocked processes
- high `wa`: IO wait
- high `sy`: kernel/system work
- high `si`: software interrupts/network processing

### High Load, High CPU

Likely:

- CPU-bound process
- request spike
- inefficient code
- too many workers

Find culprit:

```bash
ps aux --sort=-%cpu | head
pidstat -u 1 5
```

### High Load, Low CPU

Likely:

- IO wait
- D-state processes
- lock contention
- stuck NFS/disk

Check:

```bash
vmstat 1 5
ps aux | awk '$8 ~ /D/ {print}'
iostat -xz 1 5
```

---

## Part 5: Memory Debugging

```bash
free -h
cat /proc/meminfo | head
vmstat 1 5
ps aux --sort=-%mem | head
```

Important:

- `available` matters more than `free`
- page cache is normal
- active swap is dangerous for latency

### OOM Investigation

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

### Memory Leak Pattern

```bash
watch -n 5 "ps -o pid,rss,vsz,cmd -p PID"
cat /proc/PID/status | grep -E 'VmRSS|VmSize|Threads'
```

Growing RSS over time may indicate leak.

---

## Part 6: Disk And Filesystem Debugging

### Disk Full

```bash
df -h
du -sh /var/* | sort -rh | head
find / -xdev -size +1G -ls 2>/dev/null
```

### Inodes Full

```bash
df -i
find / -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head
```

### Deleted But Still Open

```bash
lsof +L1
```

If a deleted log is still open, restart or reload the owning process safely.

### IO Latency

```bash
iostat -xz 1 5
pidstat -d 1 5
```

Look at:

- `await`
- `%util`
- read/write throughput

---

## Part 7: Process Debugging

```bash
ps aux
pgrep -af SERVICE
top
lsof -p PID
cat /proc/PID/status
```

### Signals

```bash
kill -15 PID   # graceful
kill -9 PID    # force, last resort
```

### strace

```bash
strace -p PID
strace -T -p PID
strace -p PID -e trace=network
strace -p PID -e trace=file
```

Use strace to answer:

- waiting on file?
- waiting on socket?
- permission denied?
- repeated failed syscall?

---

## Part 8: Network Debugging

### Local Listening

```bash
ss -lntp
lsof -i :PORT
```

### Connectivity

```bash
curl -vk https://host/path
nc -vz host 443
ping -c 5 host
tracepath host
```

### DNS

```bash
dig host
getent hosts host
resolvectl status
```

### TCP State

```bash
ss -tanp
ss -s
```

### Conntrack

```bash
conntrack -S
sysctl net.netfilter.nf_conntrack_max
```

New connections failing while old ones work can mean conntrack/NAT exhaustion.

---

## Part 9: Logs And Time Correlation

```bash
journalctl -u SERVICE --since "30 minutes ago"
journalctl -p err -n 100
tail -f /var/log/syslog
```

Always correlate:

- alert time
- deploy time
- config change time
- traffic spike
- first error

---

## Part 10: Kubernetes Node Connection

On a Kubernetes node, Linux symptoms become cluster symptoms.

```bash
systemctl status kubelet
journalctl -u kubelet -n 200
crictl ps -a
crictl logs CONTAINER_ID
df -h
df -i
conntrack -S
```

Node issues can appear as:

- Pods stuck ContainerCreating
- ImagePullBackOff
- DNS failures
- Service timeouts
- Evictions
- node NotReady

---

## Part 11: Troubleshooting By Symptom

### Host Slow

Check:

```bash
uptime
vmstat 1 5
free -h
iostat -xz 1 5
ps aux --sort=-%cpu | head
```

Decision:

- CPU high -> process/profile
- IO wait high -> disk/NFS/storage
- swap active -> memory pressure
- load high CPU low -> blocked work

### Disk Full

```bash
df -h
df -i
du -sh /var/* | sort -rh | head
lsof +L1
```

### Service Running But Unreachable

```bash
systemctl status SERVICE
ss -lntp
curl -v localhost:PORT
ip route
iptables-save | head
```

### SSH Slow

```bash
time ssh -vvv user@host
dig host
journalctl -u sshd -n 100
vmstat 1 5
```

### New Connections Fail

```bash
ss -s
conntrack -S
netstat -s | grep -i retrans
```

---

## Part 12: Safe Mitigation Rules

Prefer reversible actions.

Better:

- rollback recent deploy
- rotate/truncate log safely
- restart one instance behind load balancer
- increase capacity temporarily
- remove bad node from rotation

Risky:

- `kill -9` without context
- deleting unknown files
- changing permissions broadly
- rebooting before collecting evidence
- editing config without backup

---

## Part 13: Real Incident Stories

### Disk Still Full After Cleanup

Cause:

- deleted file still open

Fix:

```bash
lsof +L1
systemctl restart owning-service
```

### Load 40, CPU 10%

Cause:

- IO wait / D-state

Fix:

- inspect disk/NFS/storage
- identify blocked process
- resolve storage dependency

### Service Flapping

Cause:

- systemd restart loop

Check:

```bash
systemctl status SERVICE
journalctl -u SERVICE -n 200
```

### One Kubernetes Node Has Failures

Cause candidates:

- kubelet sick
- CNI issue
- disk pressure
- conntrack exhaustion

---

## Part 14: Command Interpretation Table

| Command | Answers | Bad signs |
|---|---|---|
| `uptime` | load trend | 1m load much higher |
| `vmstat` | CPU/mem/IO pressure | high wa, si/so, b |
| `free -h` | memory availability | low available, swap use |
| `iostat -xz` | disk latency | high await/util |
| `df -h` | bytes full | filesystem 100% |
| `df -i` | inode full | inode 100% |
| `ss -s` | socket summary | huge states/failures |
| `lsof +L1` | deleted-open files | large deleted files |
| `journalctl` | service/system errors | repeated failures |
| `strace` | syscalls/waits | stuck connect/open/futex |

---

## Part 15: Labs

### Beginner

- fill a temp directory and recover
- find top CPU process
- inspect service logs

### Intermediate

- simulate deleted-open file
- create service listening on localhost only
- debug DNS failure

### Advanced

- simulate IO wait
- inspect D-state behavior conceptually
- trace a process with strace
- inspect conntrack counters

---

## Part 16: Interview Questions

- High load but low CPU — what does it mean?
- Disk full after deleting logs — why?
- What does `available` memory mean?
- How do you debug a service running but unreachable?
- When is `kill -9` acceptable?
- How do Linux node issues affect Kubernetes Pods?

---

## Part 17: Senior Answer Shape

> I first classify the symptom as process-local, host-wide, network, storage, memory, or dependency-related. Then I take a quick evidence snapshot with uptime, vmstat, free, df, iostat, ss, top processes, and recent logs. I interpret before acting: high load with low CPU points to blocked work, disk full may be inode or deleted-open files, and service reachability must separate listening, routing, DNS, and policy. I prefer reversible mitigations and preserve evidence for root cause.

---

## Recall Prompts

- Why can load be high while CPU is low?
- What does `lsof +L1` reveal?
- Why does active swap hurt latency?
- What does `strace -T` add?
- Why should mitigation be reversible?

---

## [SRE] Foundations: Linux Premium Teaching Guide For SRE And Platform Engineers

## Foundations: Linux Premium Teaching Guide For SRE And Platform Engineers

Linux is the operating foundation underneath cloud VMs, Kubernetes nodes, CI runners, databases, containers, build agents, observability collectors, and most production systems.

This guide is not a command dump. It is a learning path. The goal is to help you understand Linux from first principles, operate it confidently, troubleshoot it during incidents, and explain it clearly in interviews.

---

## How To Use This Module

Read this guide in layers.

1. **Beginner Layer** — understand what Linux is and how to move around safely.
2. **Intermediate Layer** — operate files, users, services, storage, and networking.
3. **Advanced Layer** — understand CPU, memory, IO, cgroups, namespaces, and kernel signals.
4. **Production SRE Layer** — troubleshoot real host failures with a repeatable routine.
5. **Interview Layer** — explain your reasoning like a senior operator.

Do not try to memorize every command first. Learn what question each command answers.

---

## Memory Palace: Linux Is A Hospital

Imagine a hospital.

| Linux concept | Hospital analogy | Production meaning |
|---|---|---|
| Kernel | Hospital administration | Allocates CPU, memory, devices, network, filesystems |
| Processes | Patients / active cases | Running programs needing resources |
| Scheduler | Triage nurse | Decides which process gets CPU next |
| Memory | Hospital beds | Limited space for active work |
| Swap | Overflow hallway beds | Better than collapse, but slow and painful |
| Disk | Medical archive | Stores files, logs, databases, images |
| Inodes | File record numbers | You can run out of records before space |
| systemd | Ward manager | Starts, monitors, restarts services |
| Logs | Patient chart | Evidence of what happened |
| Network | Ambulance routes | How requests enter and leave |
| Permissions | Hospital access badges | Who can enter/read/change what |
| cgroups | Department quotas | Resource limits for groups of processes |
| Namespaces | Separate treatment rooms | Isolated views used by containers |

When a host is sick, you are the on-call doctor. Your job is not to randomly restart organs. Your job is to identify whether the patient is CPU-bound, memory-starved, disk-blocked, network-isolated, misconfigured, or waiting on another dependency.

---

## Beginner Layer: What Linux Actually Is

People use the word Linux loosely. In production, separate three layers.

| Layer | What it is | Example |
|---|---|---|
| Kernel | Core program that manages hardware and resources | process scheduling, memory, network stack |
| Userland | Commands and libraries users interact with | `bash`, `ls`, `grep`, `systemctl` |
| Distribution | Packaged OS combining kernel + userland + package system | Ubuntu, Debian, RHEL, Fedora, Alpine |

A simple stack:

```text
Application
Shell / commands / libraries
Linux kernel
Hardware or virtual hardware
```

When an application reads a file, opens a socket, allocates memory, or starts a process, it ultimately asks the kernel through system calls. This is why Linux fundamentals matter even when you mostly work with Kubernetes: containers are still Linux processes using kernel features.

### Your First Safety Rule

Before running commands on a host, orient yourself.

```bash
hostname
whoami
date
pwd
```

These answer:

- Am I on the right machine?
- Am I the expected user?
- Is the system time sane?
- Where am I in the filesystem?

Many real incidents get worse because someone runs a destructive command on the wrong host, wrong namespace, wrong cluster, or wrong directory.

---

## Beginner Layer: Filesystem And Navigation

Linux exposes everything through a filesystem-like hierarchy starting at `/`.

```bash
pwd
ls -lah
cd /var/log
less syslog
```

### Important Directories Explained

| Path | What it means | Why SREs care |
|---|---|---|
| `/etc` | configuration | broken config often lives here |
| `/var/log` | logs | first evidence during incidents |
| `/proc` | live process/kernel view | memory, CPU, process internals |
| `/sys` | kernel/device information | devices, cgroups, low-level state |
| `/run` | runtime state | sockets, PID files, service state |
| `/tmp` | temporary files | can fill, can be cleaned, usually ephemeral |
| `/home` | user directories | scripts, SSH configs, user files |
| `/usr/bin` | common binaries | where many commands live |

### Teaching Example: Why `/proc` Feels Weird

`/proc` looks like files, but many entries are not real disk files. They are live windows into kernel state.

```bash
cat /proc/loadavg
cat /proc/meminfo
cat /proc/uptime
```

When you read them, the kernel generates the answer. This is why `/proc` is useful in debugging: it shows current truth from the kernel’s point of view.

---

## Beginner Layer: Permissions And Identity

Linux is multi-user. Every file has an owner, group, and permission bits.

```text
-rwxr-x---
 owner group others
```

| Bit | File meaning | Directory meaning |
|---|---|---|
| `r` | read file contents | list directory names |
| `w` | modify file | create/delete/rename entries |
| `x` | execute file | traverse directory |

The directory meaning is the part many beginners miss. A user may have permission on the file but still fail because they cannot traverse a parent directory.

### Scenario: User Can See A File But Cannot Edit It

A junior answer is: “chmod 777 it.”

A senior answer checks identity and path permissions first.

```bash
whoami
id
ls -l /path/to/file
ls -ld /path /path/to
namei -l /path/to/file
```

Reasoning:

1. Does the user own the file?
2. Is the user in the owning group?
3. Does the file have write permission?
4. Can the user traverse every parent directory?
5. Is there ACL, SELinux, or mount policy involved?

A safe fix is usually group-based access, not world-writable access.

---

## Intermediate Layer: Processes And Services

A process is a running program. Every process has a PID, parent process, user, memory, CPU usage, open files, and environment.

```bash
ps aux
ps -ef
top
pgrep -af nginx
```

### Process vs Service

A process is what the kernel runs. A service is the operational unit managed by systemd.

```bash
systemctl status nginx
journalctl -u nginx -n 100 --no-pager
```

`systemctl status` answers: is systemd trying to keep this service alive?

`journalctl -u` answers: what did this service recently say?

### Signals Explained

Signals are messages sent to processes.

| Signal | Meaning | Operational use |
|---|---|---|
| `SIGTERM` / 15 | please stop gracefully | normal shutdown |
| `SIGKILL` / 9 | stop immediately | last resort |
| `SIGHUP` | reload in many daemons | config reload |
| `SIGINT` | interrupt | Ctrl-C style stop |

Do not start with `kill -9`. It gives the process no chance to flush data, close connections, release locks, or clean temporary state.

---

## Intermediate Layer: Logs And Evidence

Logs are the patient chart.

```bash
journalctl -p err -n 100 --no-pager
journalctl -u nginx -n 200 --no-pager
dmesg | tail -50
tail -f /var/log/syslog
```

Do not read logs randomly from the top. Start with time and symptom.

Ask:

1. When did the problem begin?
2. Which service or host reported first?
3. Are errors application-level, kernel-level, or dependency-level?
4. Did a deploy, config change, restart, or resource spike happen nearby?

Good incident reading is timeline building.

---

## Intermediate Layer: Storage, Mounts, And Inodes

Disk issues often look like application bugs.

```bash
df -h
df -i
du -sh /var/* | sort -h
lsblk
findmnt
```

### Disk Space vs Inodes

Disk bytes are storage capacity. Inodes are file records.

A system can have free GB but no inodes left if it has millions of tiny files.

```bash
df -h   # bytes
df -i   # inode count
```

### Scenario: Disk Still Full After Deleting Logs

If a process has a file open, deleting the filename removes the directory entry but does not free the disk blocks until the process closes the file.

Check:

```bash
lsof +L1
```

Hospital analogy: the chart was removed from the front desk, but a doctor is still holding it in a treatment room. The archive space is not free yet.

Fix options:

- restart or reload the process holding the file
- truncate the open file carefully if appropriate
- fix log rotation

---

## Intermediate Layer: Linux Networking Basics

A Linux host makes networking decisions using interfaces, IP addresses, routes, ports, sockets, and DNS.

```bash
ip addr
ip route
ip neigh
ss -lntp
ss -tanp
dig example.com
curl -vk https://example.com
```

### Traffic Path From A Process

```text
application -> socket -> local port -> routing table -> interface -> gateway -> network
```

If a service is unreachable, split the problem:

1. Is the process running?
2. Is it listening on the expected address and port?
3. Is the host route correct?
4. Does DNS resolve?
5. Does TCP connect?
6. Does HTTP/TLS/application behavior work?

This prevents the common mistake: blaming firewall before proving the service is even listening.

---

## Advanced Layer: CPU, Scheduler, And Load Average

CPU is not just “percentage used.” Linux schedules many tasks across available CPUs.

```bash
uptime
top
vmstat 1 5
mpstat -P ALL 1 5
```

### Load Average Explained Properly

Load average is roughly the number of tasks that are runnable or stuck in uninterruptible wait.

That means high load can happen because:

- processes want CPU
- processes are blocked on disk IO
- processes are stuck waiting on kernel resources

### Hospital Story: High Load, Low CPU

Imagine a hospital waiting room with 40 patients waiting. Doctors are not busy because the lab machine is broken and everyone is waiting for test results.

That is high load with low CPU.

The CPU doctors look idle, but the hospital is still overloaded because patients are blocked elsewhere.

Check:

```bash
vmstat 1 5
iostat -xz 1 5
cat /proc/pressure/io
```

Senior interpretation:

> High load with low CPU usually means blocked work, often IO wait, lock contention, or dependency stalls. I would not add CPU until I prove CPU is the bottleneck.

---

## Advanced Layer: Memory, Page Cache, Swap, OOM

Linux memory usage can look scary because Linux uses free RAM for cache.

```bash
free -m
cat /proc/meminfo
vmstat 1 5
```

### Page Cache

Linux caches disk reads in RAM to make future reads faster.

High used memory is not automatically bad. Look at available memory, swap activity, and pressure.

### Swap

Swap is disk used as overflow memory.

A little swap usage is not always fatal. Active swap-in/swap-out during request serving is dangerous because disk is far slower than RAM.

`vmstat` columns to watch:

- `si` swap in
- `so` swap out
- `wa` IO wait

### OOM Killer

When memory is exhausted and the kernel cannot recover, it kills a process.

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

In Kubernetes, this often appears as `OOMKilled` on a container, but the underlying behavior is still Linux memory enforcement through cgroups.

---

## Advanced Layer: cgroups And Namespaces

Containers are not tiny VMs. They are Linux processes with isolation and limits.

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

### cgroups

cgroups control what a process can use.

| cgroup area | Controls |
|---|---|
| CPU | shares, quotas, throttling |
| memory | memory limit and OOM behavior |
| pids | process count |
| IO | disk IO controls |

Kubernetes requests and limits eventually become scheduler decisions and cgroup settings on Linux nodes.

---

## Production SRE Layer: 10-Minute Host Triage

Use this when a Linux host is unhealthy.

### 1. Orient

```bash
hostname
date
uptime
whoami
w
```

Goal: confirm host, time, users, and rough load.

### 2. Resource Snapshot

```bash
top
free -m
vmstat 1 5
iostat -xz 1 5
```

Goal: separate CPU pressure, memory pressure, IO pressure, and blocked work.

### 3. Process Offenders

```bash
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
pgrep -af SERVICE_NAME
```

Goal: identify whether one process dominates or service is missing/flapping.

### 4. Storage

```bash
df -h
df -i
findmnt
lsof +L1
```

Goal: detect full disk, inode exhaustion, wrong mounts, deleted-open files.

### 5. Network

```bash
ip addr
ip route
ss -lntp
ss -s
resolvectl status || cat /etc/resolv.conf
```

Goal: detect route, listener, socket, and DNS clues.

### 6. Recent Errors

```bash
journalctl -p err -n 100 --no-pager
dmesg | tail -50
```

Goal: find OOM, disk errors, filesystem remounts, driver resets, service crashes.

---

## Production Incident Walkthroughs

### Incident 1: Host Is Slow But CPU Is Low

Beginner guess: “CPU is fine, so host is fine.”

Senior reasoning:

- high load may mean blocked tasks
- blocked tasks often wait on disk, locks, network, or kernel resources
- CPU can be idle while requests are stuck

Commands:

```bash
uptime
vmstat 1 5
iostat -xz 1 5
cat /proc/pressure/io
```

Decision:

- if IO wait is high, inspect disks and noisy processes
- if run queue is high, inspect CPU saturation
- if memory pressure is high, inspect swap and OOM clues

### Incident 2: Service Running But Unreachable

Do not stop at `systemctl status`.

```bash
systemctl status myapp
ss -lntp | grep myapp
ip route
curl -v http://127.0.0.1:PORT
curl -v http://HOST_IP:PORT
journalctl -u myapp -n 100 --no-pager
```

Interpretation:

- listening only on `127.0.0.1` means remote clients cannot connect
- listening on wrong port means Service/LB config may be wrong
- local curl works but remote fails means network/firewall/routing path

### Incident 3: Disk Full After Log Cleanup

```bash
df -h
df -i
lsof +L1
du -sh /var/log/* | sort -h
```

Likely explanation:

- process still holds deleted file open
- inode exhaustion
- logs immediately recreated
- different mount is full than expected

---

## Interview Layer: How To Sound Senior

### Question: How would you troubleshoot a slow Linux host?

> I would first decide whether the issue is host-wide or isolated to one process. Then I would gather a quick snapshot across load, CPU, memory, IO, disk, network sockets, and recent kernel/service errors. I would not assume high load means CPU. High load with low CPU often points to blocked IO or lock contention. After identifying the pressure area, I would inspect the responsible processes and recent changes before restarting anything.

### Question: Why can memory look full but the system be healthy?

> Linux uses available RAM for page cache. That cache improves performance and can be reclaimed when applications need memory. I would look at available memory, swap activity, OOM logs, and pressure metrics rather than only the used-memory number.

### Question: Why does deleting a log not free space?

> If a process still has the deleted file open, the directory entry is gone but the disk blocks remain allocated until the file descriptor closes. I would use `lsof +L1` to find deleted-open files and then reload or restart the owning process safely.

---

## Labs: Build Real Skill

### Beginner Labs

1. Create a directory tree under `/tmp/linux-lab`.
2. Create files, copy them, move them, and inspect with `ls -lah`.
3. Create a test user and group if you have a safe lab machine.
4. Practice `chmod`, `chown`, and `namei -l` on a nested path.

### Intermediate Labs

1. Create a simple systemd service that runs a script.
2. Break the service command and inspect `journalctl -u`.
3. Start a Python HTTP server and inspect it with `ss -lntp`.
4. Fill a small test filesystem or tmp directory and inspect `df -h` vs `df -i`.

### Advanced Labs

1. Generate CPU load and observe `top`, `uptime`, and `vmstat`.
2. Generate IO pressure and observe `iostat` and PSI metrics.
3. Run a container and inspect namespaces/cgroups from the host.
4. Simulate a deleted-open file and recover the space.

---

## Memory Review

### Beginner Recall

- What is the difference between kernel, userland, and distribution?
- Why does directory execute permission matter?
- What does `/proc` show?

### Intermediate Recall

- What is the difference between process and service?
- Why should `kill -9` be a last resort?
- Why can DNS success still mean TCP failure?

### Advanced Recall

- Why can load be high while CPU is low?
- Why is page cache healthy?
- What do cgroups and namespaces do for containers?

### Production Recall

- What is your first 10-minute Linux triage routine?
- How do you debug disk full after deleting files?
- How do you prove whether a service is listening correctly?

---

## [SRE] Linux Lab 1: First 10 Minutes On A "Slow Host"

## Linux Lab 1: First 10 Minutes On A "Slow Host"

### Why This Matters In Production

You get paged at 2 AM. The alert says "host latency elevated." That is it. No stack trace, no obvious metric spike. The first 10 minutes are the most important: you either converge on a hypothesis or you thrash. Every experienced SRE has a repeatable triage sequence burned into muscle memory. This lab builds yours.

The trap: jumping straight to CPU metrics. "Slow" has six distinct causes — CPU saturation, memory pressure, disk IO stalls, network waits, a hung dependency, or a single runaway process. Starting with the wrong tool wastes minutes and misleads the team.

### Prerequisites

- Comfortable reading process lists and file sizes
- Knows what load average is conceptually
- Can SSH into a Linux host

### Time Estimate

45 minutes for a first pass. Repeat until you can walk through beginner steps from memory in under 8 minutes.

---

### Part 1 — Beginner: Guided Triage Walk-Through

Run each command in this order. Read the explanation before you run, then compare your actual output.

#### Step 1 — Get Initial Signal: uptime

```bash
$ uptime
 14:32:17 up 47 days,  3:12,  2 users,  load average: 18.43, 16.91, 14.22
```

**What to read:** Load average is jobs waiting for CPU or disk, averaged over 1, 5, and 15 minutes. Compare to the number of CPUs (`nproc`). On a 4-core host, load 18.43 means roughly 4.6x overloaded. If the 1-minute number is much higher than the 15-minute number, the problem is recent and sharp. If all three are high, it has been festering.

**Bad looks like:** 1-min load >> 15-min load (sudden spike). All three near or above `nproc` (sustained overload). Load near 0 when a service is "slow" points toward network or dependency wait, not host saturation.

---

#### Step 2 — Who Is On and What Are They Running: w

```bash
$ w
 14:32:17 up 47 days,  3:12,  2 users,  load average: 18.43, 16.91, 14.22
USER     TTY      FROM             LOGIN@   IDLE JCPU   PCPU WHAT
jithin   pts/0    10.0.0.5         14:30    0.00s  0.03s  0.01s w
deploy   pts/1    10.0.0.12        14:28    2:01   1.24s  0.00s /bin/sh /opt/deploy.sh
```

**What to read:** Is anyone running a maintenance script that explains the load? Deployment scripts, backup jobs, and compaction tasks are common culprits. The JCPU column shows total CPU time consumed by all processes in that session.

---

#### Step 3 — Interactive Process View: top

```bash
$ top
top - 14:32:20 up 47 days, load average: 18.43, 16.91, 14.22
Tasks: 312 total,   3 running, 309 sleeping,   0 stopped,   0 zombie
%Cpu(s): 12.4 us,  2.1 sy,  0.0 ni, 14.3 id, 68.7 wa,  0.0 hi,  2.5 si,  0.0 st
MiB Mem :  64042.2 total,    412.8 free,  58901.3 used,   4728.1 buff/cache
MiB Swap:   8192.0 total,   6104.2 free,   2088.8 used.  1141.1 avail Mem

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
17842 appuser   20   0   12.4g   9.8g  21144 D  34.2  15.7   8:22.13 appserver
 9901 root      20   0  824124 412088   8820 D  28.1   0.6   3:14.07 compaction
  881 root      20   0    8196   2344    944 S   0.1   0.0   1:12.03 systemd-journal
```

**Critical fields:**

- `wa` (IO wait): 68.7% — this is the smoking gun. The CPUs are not busy computing; they are waiting for disk. This tells you the bottleneck is storage, not code.
- `id` (idle): 14.3% — almost no free CPU time despite `us` being only 12.4%. The rest is blocked on IO.
- `S` column per process: `D` means uninterruptible sleep (waiting for disk or kernel resource). Two processes in `D` state is unusual and suspicious.
- `MiB Swap used: 2088.8` — the system is actively swapping, which compounds disk pressure.

**Bad looks like:** `wa` above 30% is significant. `wa` above 60% usually means a disk device is saturated or failing. Multiple processes in `D` state means IO is backing up.

---

#### Step 4 — Memory Detail: free -m

```bash
$ free -m
               total        used        free      shared  buff/cache   available
Mem:           64042       58901         412        1084        4728        1141
Swap:           8192        2088        6104
```

**What to read:** The `available` column is what actually matters — it accounts for reclaimable buff/cache. Here it is 1141 MB on a 64 GB host, which is very low (under 2%). The system will start evicting pages and thrashing swap.

**Bad looks like:** `available` below 5% of total. Any swap used on a host that should have plenty of RAM (common in memory leak scenarios). `buff/cache` extremely low means the page cache has already been evicted.

---

#### Step 5 — Confirm IO Pressure: vmstat 1 5

```bash
$ vmstat 1 5
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 3  8 2139648 422948  41028 4842660 1024 4096 98304 91136 8421 12048 12  2 14 69  0
 4  9 2201088 389204  40192 4701936 2048 6144 102400 98304 9102 13241 11  3 12 71  0
 2  7 2204160 378824  39680 4644256  512 2048 96256 87040 7882 11204 13  2 15 68  0
 3  8 2218496 361024  38912 4599680 1024 4096 99328 92160 8614 12402 12  2 14 70  0
 4  8 2230784 344608  38144 4554192  512 3072 97280 89088 8102 11884 13  3 13 69  0
```

**What to read:**
- `b` column: processes blocked waiting for IO. Consistently 7-9 blocked processes is severe.
- `wa` column: confirms the ~70% IO wait from `top`.
- `si`/`so` (swap in/swap out): both nonzero and climbing — active memory pressure. `so` nonzero means pages are being pushed to swap, which causes latency.
- `bi`/`bo` (block in/out in 512-byte blocks): 98304 blocks/sec read, 91136 write. Translate: ~48 MB/s read + ~44 MB/s write. On a spinning disk this would be near saturation. On SSD, this might still saturate if the device is undersized.

---

#### Step 6 — Confirm Disk Saturation: iostat -xz 1 3

```bash
$ iostat -xz 1 3
Linux 5.15.0-91-generic (gpu-node-07)   04/09/2026   _x86_64_    (16 CPU)

avg-cpu:  %user  %nice %system %iowait  %steal   %idle
          12.41   0.00    2.13   68.72    0.00   16.74

Device            r/s     w/s     rkB/s     wkB/s r_await w_await aqu-sz  %util
nvme0n1          312.4   287.1  49984.0   45936.0    8.42   12.17    4.82  98.4
nvme1n1            1.2     0.8    192.0     128.0    0.41    0.38    0.00   0.8
```

**What to read:**
- `%util` for nvme0n1: 98.4% — this device is fully saturated. Near 100% means every millisecond the disk is busy; requests queue up.
- `r_await` / `w_await`: average time in milliseconds for read/write requests to complete. 8 ms reads and 12 ms writes on NVMe is high. Normal NVMe averages under 1 ms. This is an 8-12x slowdown.
- `aqu-sz`: average queue size 4.82 means nearly 5 requests stacked up at all times. Healthy is under 1.
- nvme1n1 is idle, so the problem is isolated to one device.

**Bad looks like:** `%util` above 80% warrants investigation. Above 95% is a crisis. `r_await` or `w_await` above 5 ms on NVMe or above 30 ms on SSD is slow.

---

#### Step 7 — Check for Error Logs: journalctl -p err -n 30

```bash
$ journalctl -p err -n 30
Apr 09 14:29:03 gpu-node-07 kernel: EXT4-fs error (device nvme0n1p1): ext4_find_entry:1455: inode #2: comm appserver: reading directory lblock 0
Apr 09 14:29:04 gpu-node-07 kernel: EXT4-fs error (device nvme0n1p1): ext4_find_entry:1455: inode #2: comm appserver: reading directory lblock 0
Apr 09 14:29:11 gpu-node-07 kernel: INFO: task appserver:17842 blocked for more than 120 seconds.
Apr 09 14:29:11 gpu-node-07 kernel:       Tainted: G           OE     5.15.0-91-generic #101
Apr 09 14:29:11 gpu-node-07 kernel: "echo 0 > /proc/sys/kernel/hung_task_timeout_secs" disables this message.
Apr 09 14:29:14 gpu-node-07 kernel: EXT4-fs error (device nvme0n1p1): ext4_find_entry:1455: inode #2: comm compaction: reading directory lblock 0
```

**What to read:** The kernel is logging EXT4 filesystem errors on nvme0n1p1 and the task blocked for 120 seconds message confirms a hung task. This is a clear hardware or filesystem-level problem, not an application bug. The application is a victim, not the cause.

---

### Part 2 — Intermediate: Directed Analysis

Run the following without guided explanation. After each, write one sentence about what it tells you.

```bash
ps aux --sort=-%cpu | head -15
ps aux --sort=-%mem | head -15
ss -tanp | grep -c CLOSE_WAIT
df -h
df -i
```

Questions to answer on paper before checking the next lab:
1. The `top` output shows a process in `D` state. What does that mean and is it always bad?
2. The host has 64 GB RAM and `available` shows 800 MB. What is the risk, and what would you look at next?
3. Load average is 2.1 on a 16-core host. Is this a problem?
4. `iostat` shows `%util` 40% with `w_await` 85 ms. What does that combination suggest?

---

### Part 3 — Advanced / Stretch

**Scenario extension:** The disk issue is confirmed. The on-call escalation path requires you to assess whether to reboot or not.

1. Check for filesystem errors without rebooting:
   ```bash
   dmesg | grep -E "EXT4|I/O error|blk_update_request" | tail -20
   smartctl -a /dev/nvme0n1
   ```
2. Determine which processes have open files on the affected device:
   ```bash
   lsof +D /data/appserver 2>/dev/null | head -20
   fuser -v /data/appserver
   ```
3. Check if the issue is the device itself or the filesystem layer:
   - If `smartctl` shows reallocated sectors or pending uncorrectable errors: hardware failure, escalate to infra team.
   - If SMART is clean but errors are filesystem-level: consider `fsck` after unmounting, or remounting read-only.

**Edge cases to reason through:**
- The disk is healthy but a single file is being written by 200 concurrent processes. How would that appear in `iostat`?
- A container overlay filesystem is causing the write amplification. How would you distinguish this from a disk issue?
- Network-attached storage (NFS/Ceph) is involved. Why would `iostat` show low local disk IO while the host is still IO-wait heavy?

---

### Sample Incident Update

Write something like this into the incident channel after your triage:

```
[14:35 UTC] Host gpu-node-07 — confirmed IO bottleneck, not CPU.

nvme0n1 at 98% utilization, w_await 12ms (normal <1ms for NVMe).
Two processes in D-state: appserver (PID 17842) and compaction (PID 9901).
Kernel logs show EXT4 read errors on nvme0n1p1 since ~14:29.
System actively swapping (2.1 GB used), available memory 1.1 GB / 64 GB total.

Hypothesis: nvme0n1 hardware degraded or filesystem corruption. Not an application bug.
Next: run smartctl, check dmesg for blk_update_request errors, loop in infra team.
Service impact: appserver response latency elevated, not yet down.
```

**What makes this good:** Time-stamped, specific numbers cited, distinguishes device vs application, states next action, does not guess root cause as confirmed fact.

---

### Common Mistakes

- **Looking at CPU first** when `wa` is the signal. `us` being low means the CPU is not the bottleneck.
- **Trusting load average alone.** High load can be caused by IO-blocked processes, not CPU-hungry ones.
- **Ignoring swap.** Active swapping on a host with "plenty of RAM" means there is a memory leak or cgroup limit in play.
- **Not reading the `D` state.** Processes stuck in uninterruptible sleep are the fingerprint of IO saturation.
- **Rebooting before checking SMART.** If the disk is failing, a reboot does not fix it, and you lose the IO error history in dmesg.
- **Missing the time window.** `journalctl -p err -n 30` without `--since` can show stale errors from days ago. Always check timestamps.

---

### What To Study Next

- Lab 02: Filesystem and IO — dig into why free space is not the whole story
- Lab 03: Processes, cgroups, Namespaces — understand why one container can starve others
- Foundation doc: 10-linux-and-network-administration.md, section on storage and IO
- `man iostat`, specifically the `await` vs `svctm` distinction (svctm is deprecated but still appears in interviews)

---

## [SRE] Linux Lab 2: Filesystem, Disk, and IO Pressure

## Linux Lab 2: Filesystem, Disk, and IO Pressure

### Why This Matters In Production

"Disk write timeout" with `df -h` showing 40% used is one of the most confusing alerts an SRE encounters. The instinct is to check free space first — and that instinct will fail you. Write failures happen when the disk device is saturated, when inodes are exhausted, when a filesystem is mounted read-only due to corruption, or when the underlying storage is network-attached and the network is degraded. None of these show up in `df -h`. This lab builds the habit of going four layers deep, not one.

### Prerequisites

- Completed Lab 01 (host triage) or comfortable with `top`, `vmstat`, `iostat`
- Knows the difference between a filesystem and a block device
- Has seen a disk full error before (even if unfamiliar with the cause)

### Time Estimate

50 minutes for a thorough pass. The intermediate section can be done on any Linux machine you have access to.

---

### Part 1 — Beginner: Guided Walk-Through

#### Step 1 — Check Free Space: df -h

```bash
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           6.3G  2.1G  4.2G  34% /run
/dev/nvme0n1p1  200G   82G  118G  41% /
/dev/nvme0n1p2  500G  487G   13G  97% /var
tmpfs            32G     0   32G   0% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
/dev/nvme1n1    1.0T  310G  690G  31% /data
overlay         500G  487G   13G  97% /var/lib/docker/overlay2/abc123def456/merged
```

**What to read:**
- `/var` at 97% used — this is likely the problem. Most application log directories and package managers write to `/var`.
- The overlay entry shares the same underlying device as `/var`. Container writes count against `/var`'s budget.
- `/` at 41% is fine, but `/var` being near-full explains write timeouts even though "disk" looks okay overall.

**What `df -h` cannot tell you:** inode exhaustion, IO latency, device queue depth, whether the filesystem is mounted read-only due to corruption, or whether an NFS mount is responding.

---

#### Step 2 — Check Inode Usage: df -i

```bash
$ df -i
Filesystem       Inodes   IUsed   IFree IUse% Mounted on
tmpfs           8200192    1841 8198351    1% /run
/dev/nvme0n1p1 13107200 2184320 10922880   17% /
/dev/nvme0n1p2 32505856 32505841      15    100% /var
tmpfs           8192000       1 8191999    1% /dev/shm
overlay         32505856 32505841      15   100% /var/lib/docker/overlay2/abc123def456/merged
```

**This is the smoking gun.** `/var` has 100% inodes used with only 15 free. The filesystem has space in bytes but cannot create new files. Every file creation will fail with `ENOSPC` ("No space left on device") even though `df -h` shows 13 GB free.

**What causes inode exhaustion?**
- Millions of small files — email queues, session files, log rotation artifacts, temp files in `/var/tmp`
- Container image layers (each layer stores its files as individual inodes)
- Logging systems that write one file per event (some older syslog configs)

**Finding the culprit:**
```bash
$ for dir in /var/*/; do echo "$(find "$dir" -xdev | wc -l) $dir"; done | sort -n | tail -10
     412 /var/backups/
    2841 /var/lib/apt/
   18420 /var/lib/dpkg/
  220441 /var/log/
 9842001 /var/spool/postfix/deferred/
31048192 /var/lib/docker/overlay2/
```

Docker overlay and a postfix mail queue together consumed all inodes. The application never had a chance.

---

#### Step 3 — Check Mount Details: findmnt

```bash
$ findmnt
TARGET                                SOURCE         FSTYPE      OPTIONS
/                                     /dev/nvme0n1p1 ext4        rw,relatime
├─/var                                /dev/nvme0n1p2 ext4        ro,relatime,errors=remount-ro
│ └─/var/lib/docker/overlay2/abc.../merged
│                                     overlay        overlay     rw,relatime,lowerdir=...
├─/data                               /dev/nvme1n1   xfs         rw,relatime,attr2
├─/proc/sys/fs/binfmt_misc            systemd-1      autofs      rw,relatime,fd=29
└─/run                                tmpfs          tmpfs       rw,nosuid,nodev,noexec
```

**Critical finding:** `/var` is mounted with `ro` (read-only) and `errors=remount-ro`. The filesystem detected an error and automatically remounted itself read-only to prevent corruption. Every write to `/var` will fail silently at the filesystem level. `df -h` would still show the capacity as if nothing were wrong.

**`errors=remount-ro` is the default for ext4.** When the kernel encounters an IO error or journal inconsistency, it flips the mount to read-only rather than risking data corruption. This is a feature, not a bug — but it terminates all writes instantly.

---

#### Step 4 — Check IO Latency: iostat -xz 1 5

```bash
$ iostat -xz 1 5
Device            r/s     w/s     rkB/s     wkB/s r_await w_await aqu-sz  %util
nvme0n1          28.4   214.7   4544.0   34352.0    0.38    0.42    0.09   8.2
nvme1n1           2.1     1.4    336.0     224.0    0.39    0.41    0.00   0.4

Device            r/s     w/s     rkB/s     wkB/s r_await w_await aqu-sz  %util
nvme0n1          31.2   891.4   4992.0  142624.0    0.41   18.74    3.84  88.1
nvme1n1           1.8     0.9    288.0     144.0    0.40    0.42    0.00   0.3

Device            r/s     w/s     rkB/s     wkB/s r_await w_await aqu-sz  %util
nvme0n1          29.8  1042.1   4768.0  166736.0    0.39   24.13    4.97  96.8
nvme1n1           1.2     0.7    192.0     112.0    0.41    0.39    0.00   0.2
```

**What to read across the three snapshots:**
- nvme0n1 `%util` went from 8% to 97% in two seconds. Write throughput jumped from 34 MB/s to 163 MB/s in the same window.
- `w_await` climbed from 0.42 ms to 24.13 ms. On NVMe, normal is under 0.5 ms. 24 ms is a 48x slowdown.
- `aqu-sz` (queue depth) grew to 4.97, meaning requests are piling up faster than the device drains them.
- This pattern — sudden burst of writes causing queue buildup and latency spike — is characteristic of a write storm, often triggered by a log rotation event, a backup job starting, or a container flush cycle.

---

#### Step 5 — Identify the Largest Consumers: du -sh

```bash
$ du -sh /var/log/* 2>/dev/null | sort -h | tail -10
4.0K    /var/log/wtmp
12K     /var/log/auth.log
24K     /var/log/kern.log
184K    /var/log/syslog
2.1M    /var/log/apt/history.log
18M     /var/log/journal
44M     /var/log/nginx
1.2G    /var/log/appserver
8.7G    /var/log/appserver/debug.log
```

**Diagnosis:** A single debug log grew to 8.7 GB. The file is open and being written continuously. Because it is a single file (one inode), it does not explain inode exhaustion — but it does explain byte consumption. Rotate or truncate:

```bash
# Safe truncation of a file being written to by a live process:
> /var/log/appserver/debug.log

# Or force log rotation:
logrotate -f /etc/logrotate.d/appserver
```

**Never `rm` a file that is still open by a running process.** The inode stays allocated until the process closes it. The space will not be freed until the process is restarted or the fd is closed.

---

#### Step 6 — Check Block Device Layout: lsblk

```bash
$ lsblk
NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
nvme0n1     259:0    0   200G  0 disk
├─nvme0n1p1 259:1    0    50G  0 part /
└─nvme0n1p2 259:2    0   150G  0 part /var
nvme1n1     259:4    0     1T  0 disk /data
```

**What to read:** Two NVMe devices, two partitions on nvme0n1. The partition table confirms `/var` is on a separate partition from `/`. Problems on `/var` will not be visible when you check `/` usage.

---

### Part 2 — Intermediate: Directed Analysis

Run these on a live machine and write one-sentence interpretations:

```bash
mount | grep -E "ro,|,ro"
dmesg | grep -E "EXT4|XFS|I/O error|remount" | tail -20
ls -l /proc/$(pgrep appserver | head -1)/fd | wc -l
lsof +D /var/log 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head
```

Questions to answer:
1. Why does `df -h` show 13 GB free on `/var` while every write returns ENOSPC?
2. A file is deleted but `df -h` does not show the space recovered. What is happening?
3. An NFS mount hangs. How would `df -h` behave? How would `findmnt` help?
4. The overlay filesystem for a container uses 90% of its layer budget. Where does that actually live on disk?

---

### Part 3 — Advanced / Stretch

**Scenario extension:** You have confirmed inode exhaustion and a read-only remount. The application team says they cannot restart the service. You need to free inodes without restarting.

1. Find and remove stale session files:
   ```bash
   find /var/spool/postfix/deferred -type f -mtime +7 | wc -l
   find /var/spool/postfix/deferred -type f -mtime +7 -delete
   ```
2. Prune dangling Docker layers (inodes without running containers):
   ```bash
   docker system prune -f --volumes
   ```
3. Remount read-write after confirming no filesystem errors:
   ```bash
   dmesg | grep "EXT4-fs error" | tail -5
   mount -o remount,rw /var
   ```

**Edge cases to reason through:**
- `/tmp` is mounted as tmpfs but your process writes multi-gigabyte temp files. What happens when tmpfs fills? How does this differ from filling a disk partition?
- A Kubernetes PVC is backed by Ceph RBD. The PVC reports 80% full. The pod's application writes fail. But `kubectl exec` into the pod and `df -h` shows 80% used — not full. What other dimension could be exhausted?
- `iostat` shows 0% utilization on all local devices during a write storm. Where is the IO going?

---

### Sample Incident Update

```
[09:14 UTC] Service write failures on app-worker-03 confirmed. Not a space issue.

df -h: /var at 97% bytes, 13 GB remaining.
df -i: /var at 100% inodes, 15 inodes remaining — all file creation blocked.
findmnt: /var remounted read-only (errors=remount-ro triggered by ext4 journal error).
dmesg: EXT4 errors on nvme0n1p2 at 09:08, 09:11, 09:13.
iostat: nvme0n1 write await spiked to 24ms at 09:09, correlates with write storm.

Root cause working theory: write storm exhausted inode table, triggering ext4 error,
which caused automatic read-only remount. Inode source: /var/lib/docker/overlay2 and
/var/spool/postfix/deferred (31M+ files combined).

Actions taken: Docker prune freed 18M inodes. Postfix deferred queue cleanup in progress.
Remount rw after dmesg confirms no new errors. Application team notified, no restart needed.
```

---

### Common Mistakes

- **Stopping at `df -h`** and concluding "disk is fine." Always also run `df -i`.
- **Deleting open files expecting immediate space recovery.** The file's inode and data blocks are held until all open file descriptors are closed.
- **Not checking `findmnt` for read-only mounts.** A silently read-only filesystem looks healthy in `df` but rejects all writes.
- **`du` vs `df` discrepancy.** Deleted but open files are not counted by `du` but are still consuming disk blocks counted by `df`. The gap between them reveals "ghost space."
- **Assuming container writes go to the container's own disk.** Overlay layers live on the host's filesystem. Container disk pressure is host disk pressure.
- **Running `fsck` on a mounted filesystem.** Always unmount or use read-only mode first. Running `fsck` on a live mounted filesystem can corrupt it further.

---

### What To Study Next

- Lab 03: Processes, cgroups, Namespaces — how container resource limits interact with the filesystem
- Foundation doc: 10-linux-and-network-administration.md, storage section
- Understand `ext4` journal mode: `data=ordered` vs `data=writeback` and how each affects write durability under pressure
- Practice: find the largest inode-consuming directories on any machine you have access to using `find . -xdev | wc -l` per subdirectory

---

## [SRE] Linux Lab 3: Processes, cgroups, and Namespaces

## Linux Lab 3: Processes, cgroups, and Namespaces

### Why This Matters In Production

Kubernetes says the pod is Running. The application team says it is slow. You SSH to the node and find nothing obviously wrong at first glance. This scenario plays out weekly in production GPU clusters and multi-tenant platforms. The gap between "pod is Running" and "application is healthy" lives entirely in Linux primitives: cgroups throttle CPU and memory silently, namespaces isolate the process's view of the system, and kernel scheduling decisions made at the node level are invisible to Kubernetes controllers. This lab builds the bridge.

### Prerequisites

- Completed Lab 01 and Lab 02, or comfortable with `top`, `ps`, `iostat`
- Basic familiarity with what a container is conceptually
- Has used `kubectl describe pod` before

### Time Estimate

60 minutes. The cgroup inspection steps require root access on a node — use a local Docker container or a VM if you do not have a Kubernetes node available.

---

### Part 1 — Beginner: Guided Walk-Through

#### Step 1 — Find the Process From the Host: ps aux

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

#### Step 2 — Inspect Scheduling State More Carefully: pidstat

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

#### Step 3 — Confirm Cgroup Throttling: Inspect The Cgroup

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

#### Step 4 — Find the Limit Set By Kubernetes

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

#### Step 5 — Inspect Namespaces: lsns

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

#### Step 6 — Check Memory Pressure: Memory Cgroup

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

### Part 2 — Intermediate: Directed Analysis

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

### Part 3 — Advanced / Stretch

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

### Sample Incident Update

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

### Common Mistakes

- **Trusting `kubectl get pod` status.** Running means the container process exists, not that it is performing well. CPU throttling is invisible to Kubernetes.
- **Checking host CPU and concluding there is no problem.** Idle host CPUs cannot help a throttled cgroup. The cgroup quota is the constraint, not physical CPU availability.
- **Confusing high `%CPU` with bad health.** A GPU training process at 100% CPU is normal. A web server at 100% CPU is usually a bug.
- **Not knowing where cgroup files live.** v1 is under `/sys/fs/cgroup/<subsystem>/...`, v2 is a unified hierarchy at `/sys/fs/cgroup/` using `cpu.max` instead of `cpu.cfs_quota_us`. Know which version your nodes use.
- **Entering the container to debug instead of using the host.** For namespace and cgroup inspection, host vantage gives you the full picture. Inside the container you only see what the namespaces expose.
- **Confusing OOM kill with memory limit.** A container at 99% memory limit is not yet killed. It can run degraded (allocations failing) before the OOM killer fires.

---

### What To Study Next

- Foundation doc: 12-kubernetes-gpu-ai-platforms-and-operators.md — GPU resource management and device plugins
- Foundation doc: 02-linux-kubernetes-foundations.md — CFS scheduler, cgroup v2 unified hierarchy
- Practice: run `cat /proc/self/cgroup` inside a Docker container and trace the path to `/sys/fs/cgroup` on the host
- `man 7 namespaces` — comprehensive reference for all namespace types
- `nsenter` man page — critical for host-side debugging of containers

---

## [SRE] Linux Admin Drill 1: Service and systemd Triage

## Linux Admin Drill 1: Service and systemd Triage

### Why This Matters In Production

A deploy is pushed. Someone in Slack says "service looks unhealthy." You SSH to the host. What is the first command? If you do not have a reflexive answer, this drill is for you. systemd is the init system on every production Linux host you will encounter (Ubuntu, RHEL, Debian, Amazon Linux). Being able to distinguish "failed to start" from "started but crashed" from "running but misbehaving" in under two minutes is a baseline SRE skill.

### Prerequisites

- Knows what a systemd unit file is
- Has used `systemctl status` at least once
- Understands the difference between stdout and the journal

### Time Estimate

40 minutes. Run through it once reading everything, then repeat from scratch without the guidance to confirm retention.

---

### Scenario

You are an on-call SRE. It is 23:10. The deploy pipeline finished 4 minutes ago. A monitoring alert fires: `appserver on app-worker-02 is not responding on port 8080`. You SSH to the host. Begin.

---

### Part 1 — Beginner: Step-By-Step Triage

#### Step 1 — Check Unit State: systemctl status

```bash
$ systemctl status appserver.service
● appserver.service - Application Server
     Loaded: loaded (/etc/systemd/system/appserver.service; enabled; vendor preset: enabled)
     Active: failed (Result: exit-code) since Wed 2026-04-09 23:06:41 UTC; 3min 42s ago
    Process: 28914 ExecStart=/usr/bin/appserver --config /etc/appserver/config.yaml (code=exited, status=1/FAILURE)
   Main PID: 28914 (code=exited, status=1/FAILURE)
        CPU: 412ms

Apr 09 23:06:41 app-worker-02 appserver[28914]: FATAL: cannot open config file: /etc/appserver/config.yaml: no such file or directory
Apr 09 23:06:41 app-worker-02 systemd[1]: appserver.service: Main process exited, code=exited, status=1/FAILURE
Apr 09 23:06:41 app-worker-02 systemd[1]: appserver.service: Failed with result 'exit-code'.
Apr 09 23:06:41 app-worker-02 appserver[28914]: FATAL: cannot open config file: /etc/appserver/config.yaml: no such file or directory
Apr 09 23:06:41 app-worker-02 systemd[1]: Failed to start Application Server.
```

**How to read the unit state:**

- `Loaded` line: is the unit file present and enabled? `enabled` means it will start on boot. `disabled` means it will not. `masked` means it is blocked from starting entirely.
- `Active` line: this is the lifecycle state. The five important states are:
  - `active (running)` — process is alive and the service considers itself healthy
  - `active (exited)` — process ran and exited cleanly (normal for oneshot services)
  - `failed (Result: exit-code)` — process exited with nonzero status
  - `failed (Result: signal)` — process was killed by a signal (often SIGSEGV or SIGKILL)
  - `activating` — start is in progress (may be stuck waiting for a dependency)
- `Process:` line: shows the last PID and exit code. `status=1/FAILURE` is a generic failure. `status=137` means SIGKILL (128+9). `status=139` means SIGSEGV (128+11).

**Diagnosis from this output:** The config file is missing. The service never started. The deploy likely forgot to install or render the config file.

---

#### Step 2 — Pull Structured Logs: journalctl -u

```bash
$ journalctl -u appserver.service -n 50 --no-pager
-- Logs begin at Mon 2026-04-07 00:00:12 UTC, end at Wed 2026-04-09 23:10:04 UTC. --
Apr 09 23:06:35 app-worker-02 systemd[1]: Starting Application Server...
Apr 09 23:06:35 app-worker-02 appserver[28914]: INFO: starting appserver v2.14.1
Apr 09 23:06:35 app-worker-02 appserver[28914]: INFO: loading configuration from /etc/appserver/config.yaml
Apr 09 23:06:35 app-worker-02 appserver[28914]: FATAL: cannot open config file: /etc/appserver/config.yaml: no such file or directory
Apr 09 23:06:41 app-worker-02 systemd[1]: appserver.service: Main process exited, code=exited, status=1/FAILURE
Apr 09 23:06:41 app-worker-02 systemd[1]: Failed to start Application Server.
Apr 09 23:06:41 app-worker-02 systemd[1]: appserver.service: Scheduled restart job, restart counter is at 3/5.
Apr 09 23:06:46 app-worker-02 systemd[1]: Stopped Application Server.
Apr 09 23:06:46 app-worker-02 systemd[1]: appserver.service: Start request repeated too quickly.
Apr 09 23:06:46 app-worker-02 systemd[1]: appserver.service: Failed with result 'start-limit-hit'.
Apr 09 23:06:46 app-worker-02 systemd[1]: Failed to start Application Server.
```

**What to read:**
- The log shows the exact sequence: started, tried to read config, failed, systemd retried, hit the restart limit.
- `restart counter is at 3/5` — systemd will retry failing services per the `Restart=` and `StartLimitBurst=` config. Once it hits `start-limit-hit`, it stops retrying. The service will not come back on its own.
- `StartLimitIntervalSec` and `StartLimitBurst` in the unit file define the retry window.
- The application exit at 23:06:35 and the failure at 23:06:41 differ by 6 seconds — the `RestartSec=` delay between attempts.

**Time window filtering (important habit):**
```bash
# Only logs from the last deploy window:
$ journalctl -u appserver.service --since "2026-04-09 23:00:00" --until "2026-04-09 23:10:00"

# Only errors from this service:
$ journalctl -u appserver.service -p err --since "1 hour ago"
```

---

#### Step 3 — Check if It Is Listening: ss -lntp

```bash
$ ss -lntp | grep -E "State|8080|8443"
State    Recv-Q   Send-Q   Local Address:Port   Peer Address:Port   Process
```

**Empty output means nothing is listening on port 8080.** The service never got far enough to bind. This confirms the config failure — the application did not reach the port-binding step.

A healthy service would show:
```bash
LISTEN   0    128   0.0.0.0:8080   0.0.0.0:*   users:(("appserver",pid=28914,fd=9))
```

---

#### Step 4 — Inspect Unit File Metadata: systemctl show

```bash
$ systemctl show appserver.service --property=ExecStart,Restart,RestartSec,StartLimitBurst,StartLimitIntervalSec,Environment,EnvironmentFile
ExecStart={ path=/usr/bin/appserver ; argv[]=/usr/bin/appserver --config /etc/appserver/config.yaml ; ... }
Restart=on-failure
RestartSec=5s
StartLimitBurst=5
StartLimitIntervalSec=30s
Environment=LOG_LEVEL=info APP_PORT=8080
EnvironmentFile=/etc/appserver/env (ignore_errors=no)
```

**What to check here:**
- `EnvironmentFile` — if this file is missing and `ignore_errors=no`, the service will fail to start even if the binary exists.
- `Restart=on-failure` — it retries on nonzero exit, but not on clean exit (exit code 0).
- `StartLimitBurst=5` in `StartLimitIntervalSec=30s` — 5 restarts within 30 seconds will trip the `start-limit-hit` brake.

---

#### Step 5 — List All Services With State: systemctl list-units

```bash
$ systemctl list-units --type=service --state=failed
  UNIT                   LOAD   ACTIVE SUB    DESCRIPTION
● appserver.service      loaded failed failed Application Server
● filebeat.service       loaded failed failed Filebeat log shipper

LOAD   = Reflects whether the unit definition was properly loaded.
ACTIVE = The high-level unit activation state.
SUB    = The low-level unit activation state.

2 loaded units listed.
```

**Multiple failures are informative:** filebeat is also failing. If filebeat depends on appserver or if both depend on a shared environment file, a single misconfigured file can cascade.

---

### Part 2 — Intermediate: Directed Questions

Run these and interpret without guided explanation:

```bash
systemctl list-dependencies appserver.service
systemctl show appserver.service --property=After,Requires,Wants
journalctl -p warning --since "30 minutes ago" --no-pager | tail -30
journalctl -k --since "30 minutes ago" | grep -iE "oom|kill|error"
```

Questions to answer:
1. What is the difference between `Requires=` and `Wants=` in a unit file?
2. A service shows `Active: active (running)` but the health check fails. Systemd says it is fine. Why?
3. How do you safely restart a service without triggering the start-limit-hit brake?
4. A service is masked. How is that different from disabled? How do you unmask it?
5. `ExecStartPre=` fails with exit code 1. What happens to the main `ExecStart=`?

---

### Part 3 — Advanced / Stretch

**Scenario extension:** The config file is present (you confirmed `ls -la /etc/appserver/config.yaml` shows it exists). But the service still fails with "no such file or directory." How is this possible?

Investigate:
```bash
# Check if the service runs in a restricted filesystem namespace:
systemctl show appserver.service --property=PrivateTmp,ProtectSystem,ReadWritePaths,BindPaths

# Check if the path exists in the service's mount namespace:
nsenter --target $(systemctl show appserver.service --property=MainPID --value) --mount -- ls /etc/appserver/

# Look for SELinux or AppArmor denials:
ausearch -m AVC -ts recent 2>/dev/null | tail -10
journalctl -k | grep -i "apparmor.*DENIED" | tail -5
```

**Reasoning exercises:**
- `ProtectSystem=strict` makes the entire filesystem read-only except for paths listed in `ReadWritePaths`. A config file at `/etc/appserver/` would be visible but not writable.
- `PrivateTmp=true` gives the service its own `/tmp` and `/var/tmp`. Files left in host `/tmp` are not visible to the service.
- A service running as a non-root user with `DynamicUser=true` has an ephemeral UID. Files owned by a previous run's UID may not be readable.

---

### Sample Incident Note

```
[23:14 UTC] appserver on app-worker-02 down post-deploy — config file missing.

systemctl status: failed (exit-code), service has hit start-limit-hit after 5 retries.
journal: FATAL: cannot open config file /etc/appserver/config.yaml — no such file or directory.
ss -lntp: nothing listening on 8080 — app never reached bind phase.
Confirmed: /etc/appserver/config.yaml does not exist on host. Deploy ran at 23:06.

Root cause: config file not deployed by pipeline. Binary deployed without its config.
Immediate action: copy config from app-worker-01 (healthy host) after comparing content.
After file is placed: systemctl reset-failed appserver && systemctl start appserver.
Service will not auto-restart until reset-failed clears the start-limit-hit state.

Impact: appserver on app-worker-02 has been down 8 minutes. Load balancer is routing
traffic to remaining 3 healthy nodes. No user-visible SLA breach at this time.
```

---

### Common Mistakes

- **Running `systemctl restart` without clearing `start-limit-hit`.** The restart will fail immediately. Use `systemctl reset-failed <unit>` first.
- **Reading only the last line of `journalctl`.** The actual error is almost always a few lines up, before systemd's own messaging.
- **Confusing unit state with application health.** `active (running)` means the process is alive. It does not mean the application is serving requests. Separate health checks are needed.
- **Forgetting the `--no-pager` flag** in scripts or when piping `journalctl` output.
- **Not checking `systemctl show` for `EnvironmentFile`.** If an environment file is absent, the service may fail silently or with a confusing error.
- **Using `kill` or `pkill` instead of `systemctl stop`.** Killing the process directly leaves systemd in an inconsistent state and may trigger unexpected restart behavior.

---

### What To Study Next

- Foundation doc: 10-linux-and-network-administration.md, systemd section
- Practice writing a unit file from scratch including `After=`, `Requires=`, `ExecStartPre=`, and `Restart=`
- `man systemd.unit` and `man systemd.service` — the authoritative reference
- Drill 02: Filesystem and Storage — the next most common cause of service failures after config errors

---

## [SRE] Linux Admin Drill 2: Filesystem and Storage Administration

## Linux Admin Drill 2: Filesystem and Storage Administration

### Why This Matters In Production

Storage failures are one of the most reliably confusing categories of incidents. Unlike CPU or memory issues where "high number bad" is roughly true, storage problems require reading four separate dimensions simultaneously: byte usage, inode usage, mount state, and IO queue behavior. An application reporting write failures while `df -h` shows 40% used is a classic trap. This drill builds the reflex to check all four dimensions without being told to.

### Prerequisites

- Completed Lab 02 (filesystem and IO), or read the explanation of inodes and IO wait
- Comfortable with `df -h` output
- Has seen at least one "disk full" incident, real or simulated

### Time Estimate

45 minutes. Run each step on a real machine. Document your outputs — the habit of capturing state before changing anything is the entire point.

---

### Scenario

It is 10:40. An application on `stor-node-04` begins reporting write failures and slow response times. The on-call engineer before you checked `df -h`, said "disk is 43% full, space is fine," and closed the alert. The alert fired again 20 minutes later. Your job is to go deeper.

---

### Part 1 — Beginner: Guided Triage Walk-Through

#### Step 1 — Bytes First, Then Inodes: df -h and df -i

```bash
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           6.3G  1.1G  5.2G  18% /run
/dev/nvme0n1p1  200G   82G  118G  41% /
/dev/nvme0n1p2  500G  215G  285G  43% /var
tmpfs            32G   12G   20G  38% /dev/shm
/dev/nvme1n1    1.0T  310G  690G  31% /data
overlay         500G  215G  285G  43% /var/lib/docker/overlay2/abc123/merged
```

**As the previous engineer noted: 43% used on `/var`, plenty of space.** This is the wrong conclusion. Byte usage is only one dimension.

```bash
$ df -i
Filesystem       Inodes   IUsed   IFree IUse% Mounted on
tmpfs           8200192    2401 8197791    1% /run
/dev/nvme0n1p1 13107200  841280 12265920    6% /
/dev/nvme0n1p2 32505856 32505701     155   100% /var
tmpfs           8192000      24 8191976    1% /dev/shm
/dev/nvme1n1   65536000 11200000 54336000   17% /data
overlay         32505856 32505701     155   100% /var/lib/docker/overlay2/abc123/merged
```

**Found it: 100% inode usage on `/var`.** 155 inodes remaining out of 32.5 million. No new files can be created on this filesystem regardless of how much byte space exists.

**Why do inodes run out before bytes?** Each filesystem is formatted with a fixed inode table. By default, ext4 allocates one inode per 16 KB of device capacity. A filesystem holding millions of small files (each under 1 KB) will exhaust inodes while using a fraction of the byte capacity. Common culprits: email queues, session token files, log rotation artifacts, container layers, small cache files written per-request.

---

#### Step 2 — Find the Inode Consumer

```bash
$ for dir in /var/cache /var/lib /var/log /var/spool /var/tmp; do
    echo "$(find $dir -xdev 2>/dev/null | wc -l) $dir"
  done | sort -rn
28441902 /var/lib
  3281094 /var/spool
    422081 /var/log
    180441 /var/cache
     14202 /var/tmp
```

`/var/lib` holds 28 million inodes. Drill down:

```bash
$ for dir in /var/lib/*/; do
    echo "$(find "$dir" -xdev 2>/dev/null | wc -l) $dir"
  done 2>/dev/null | sort -rn | head -5
27901042 /var/lib/docker/
   388012 /var/lib/kubelet/
   102441 /var/lib/postgresql/
    28800 /var/lib/apt/
    10220 /var/lib/systemd/
```

Docker is holding 27.9 million inodes. This is accumulated container layers, image cache, and build artifacts.

```bash
$ docker system df
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          48        12        84.2GB    61.1GB (72%)
Containers      3         3         2.41GB    0B (0%)
Local Volumes   18        8         14.2GB    5.8GB (40%)
Build Cache     2.1GB     0B        2.1GB     2.1GB (100%)

$ docker image ls | wc -l
49
```

48 Docker images, only 12 active. 36 unused images can be pruned.

---

#### Step 3 — Check Mount State and Options: findmnt

```bash
$ findmnt
TARGET                                   SOURCE         FSTYPE   OPTIONS
/                                        /dev/nvme0n1p1 ext4     rw,relatime
├─/var                                   /dev/nvme0n1p2 ext4     rw,relatime,errors=remount-ro
│ └─/var/lib/docker/overlay2/abc123/merged
│                                        overlay        overlay  rw,relatime,lowerdir=...
├─/dev/shm                               tmpfs          tmpfs    rw,nosuid,nodev
├─/data                                  /dev/nvme1n1   xfs      rw,relatime,attr2,inode64
│ └─/data/nfs-mount                      nfs-server:/exports/data
│                                        nfs4           rw,relatime,vers=4.2,rsize=1048576
└─/run                                   tmpfs          tmpfs    rw,nosuid,nodev,noexec
```

**Key observations:**
- `/var` has `errors=remount-ro` — if ext4 encounters a journal or block error, it will flip to read-only automatically.
- `/data/nfs-mount` is an NFS4 mount. Write failures here would not be visible in local `iostat` — they travel over the network.
- The overlay filesystem for the container is backed by `/var` — its inode usage contributes to `/var`'s inode count.

**What to check if NFS is involved:**
```bash
$ nfsstat -c
$ mountstats /data/nfs-mount | grep -E "ops/s|avg RTT"
```

---

#### Step 4 — Block Device Layout: lsblk

```bash
$ lsblk
NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
nvme0n1     259:0    0   200G  0 disk
├─nvme0n1p1 259:1    0    50G  0 part /
└─nvme0n1p2 259:2    0   150G  0 part /var
nvme1n1     259:4    0     1T  0 disk /data
nvme2n1     259:6    0   500G  1 disk
```

**Note:** nvme2n1 has `RO=1` — read-only flag set at the block device level. Any filesystem on this device will refuse writes regardless of mount options. This could be a write-protect jumper, a hardware failure indicator, or a deliberate lock.

---

#### Step 5 — IO Latency Across Devices: iostat -xz 1 3

```bash
$ iostat -xz 1 3
Device            r/s     w/s     rkB/s    wkB/s r_await w_await aqu-sz  %util
nvme0n1          18.2    142.8   2912.0  22848.0    0.41    0.44    0.07   4.2
nvme1n1           2.4      0.9    384.0    144.0    0.42    0.38    0.00   0.2

Device            r/s     w/s     rkB/s    wkB/s r_await w_await aqu-sz  %util
nvme0n1          21.4   1841.2   3424.0 294592.0    0.44   32.84    3.12  87.4
nvme1n1           2.1      0.7    336.0    112.0    0.40    0.41    0.00   0.1

Device            r/s     w/s     rkB/s    wkB/s r_await w_await aqu-sz  %util
nvme0n1          19.8   2104.7   3168.0 336752.0    0.43   41.22    4.88  96.1
nvme1n1           1.9      0.8    304.0    128.0    0.42    0.39    0.00   0.1
```

**Three snapshots tell a story:**
- nvme0n1 `%util` went from 4% to 96% between sample 1 and sample 3 — a write burst hit the device.
- `w_await` climbed from 0.44 ms to 41.22 ms — writes are taking 41 ms instead of the normal sub-millisecond. The application would experience this as latency spikes.
- `aqu-sz` grew to 4.88 — requests are queuing up.
- nvme1n1 is completely unaffected — the problem is isolated to nvme0n1 (which hosts `/var`).

**Translating to application impact:** A write() syscall on `/var/log/app.log` during this window would block for ~41 ms per 512-byte kernel IO. An application writing 100 log lines per request would add 4 seconds of latency per request during the burst. This is how a "disk issue" becomes an "application is slow" alert.

---

#### Step 6 — Find The Largest Files: du -sh with sort

```bash
$ du -sh /var/log/* 2>/dev/null | sort -h | tail -10
48K     /var/log/auth.log
112K    /var/log/kern.log
288K    /var/log/syslog
1.4M    /var/log/journal
6.2M    /var/log/nginx/access.log
28M     /var/log/nginx/error.log
214M    /var/log/appserver
4.1G    /var/log/appserver/debug.log
```

A 4.1 GB debug log. Check if it is actively written and by what:

```bash
$ lsof /var/log/appserver/debug.log
COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF    NODE NAME
appserver 18204 appuser   7w   REG  259,2   4412490880 2883912 /var/log/appserver/debug.log
```

One process, one open write descriptor. This file can be rotated safely:

```bash
# Force logrotate to rotate it now:
logrotate -f /etc/logrotate.d/appserver

# If logrotate is not configured, truncate safely (process keeps writing to same fd):
> /var/log/appserver/debug.log
```

---

### Part 2 — Intermediate: Directed Analysis

Run these on a machine you have access to:

```bash
# Check for deleted files still held open (ghost space):
lsof | grep deleted | awk '{print $1, $7}' | sort -k2 -rn | head -10

# Check for filesystems mounted read-only unexpectedly:
mount | grep " ro,"

# Find directories with the most entries (inode density):
find /var -maxdepth 3 -type d -exec sh -c 'echo "$(ls -1 {} | wc -l) {}"' \; 2>/dev/null | sort -rn | head -10

# Check kernel IO error log:
dmesg | grep -E "I/O error|blk_update_request|EXT4-fs error" | tail -20
```

Questions to answer:
1. `du -sh /var` reports 8 GB. `df -h` shows 12 GB used for `/var`. What explains the 4 GB gap?
2. You rotate a log file but `df -h` shows no space recovered. Why?
3. A filesystem is mounted with `noatime`. What write overhead does this eliminate and why would you set it on a busy log-writing host?
4. `/data` is an XFS filesystem. How does XFS handle inode allocation differently from ext4?

---

### Part 3 — Advanced / Stretch

**Recovery sequence for a full inode partition:**

```bash
# Step 1: confirm and quantify
df -i /var

# Step 2: find the top-N inode consumers
find /var -xdev -printf '%h\n' | sort | uniq -c | sort -rn | head -20

# Step 3: prune safely
docker system prune -f                          # Remove unused images/containers/build cache
find /var/spool/postfix/deferred -mtime +3 -delete   # Purge old mail queue
find /tmp -maxdepth 1 -mtime +1 -delete         # Purge old temp files

# Step 4: verify recovery
df -i /var
```

**Reasoning exercises:**

- You have a 1 TB XFS volume for `/data`. You want to pre-allocate more inodes because you know you will store millions of small files. How do you do this at format time? (Hint: `mkfs.xfs -i maxpct=` or `-n size=`)
- A container writes millions of empty lock files to `/var/run/app/sessions/`. The container is deleted and recreated daily. Why might inodes still be exhausted?
- `smartctl -a /dev/nvme0n1` shows `Reallocated Sectors: 48` and `Pending Uncorrectable: 12`. What action do you take, and in what order?
- A volume is 100% full in bytes. You delete a 5 GB file. `df -h` shows the same usage. `lsof | grep deleted` shows nothing. What else could be holding the space?

---

### Sample Incident Note

```
[10:58 UTC] Write failures on stor-node-04 — inode exhaustion on /var, not byte shortage.

df -h: /var at 43% bytes (215 GB / 500 GB) — no byte issue.
df -i: /var at 100% inodes, 155 inodes remaining — all new file creation blocked.
Root consumer: /var/lib/docker — 27.9M inodes across 48 images (36 unused).
Secondary: iostat shows nvme0n1 w_await spiking to 41ms during write bursts.
findmnt: /var mount healthy (rw), no remount-ro triggered yet.

Immediate action: docker system prune freed 18.2M inodes. /var now at 44% inode usage.
Write failures resolved. Application team confirmed writes succeeding at 10:56.

Follow-up required:
- Add monitoring for inode usage on /var (alert at 80% inodes)
- Add Docker image cleanup cronjob (weekly prune of images older than 14 days)
- Review debug log rotation — 4.1 GB log found, adding to logrotate config.
```

---

### Common Mistakes

- **Checking only `df -h` and declaring disk is fine.** Always check `df -i` in the same breath.
- **Not checking `findmnt` for read-only remounts.** A remounted-ro filesystem looks healthy in `df` but rejects writes silently.
- **Deleting a file and expecting immediate space recovery** when the file is still open by a running process.
- **`du` and `df` showing different numbers** — the gap is deleted-but-open files. `lsof | grep deleted` reveals them.
- **Pruning Docker without checking for running containers.** `docker system prune -f` will not remove images used by running containers, but double-check before running in production.
- **Forgetting that overlay filesystems count against the host's inode budget.** Containers do not have their own separate inode tables — they share the host partition's inodes.
- **Ignoring `iostat` after fixing space.** High IO wait and device saturation are separate problems that can persist even after space is recovered.

---

### What To Study Next

- Lab 02: Filesystem and IO — the companion lab with more depth on IO wait and device saturation
- Foundation doc: 10-linux-and-network-administration.md, storage section
- Practice: `man mkfs.ext4` — understand the `-i bytes-per-inode` option and when to use it
- Drill 03: Process, Socket, and Network — the storage problem is fixed, now confirm the application actually recovered

---

## [SRE] Linux Admin Drill 3: Processes, Sockets, and Basic Network Administration

## Linux Admin Drill 3: Processes, Sockets, and Basic Network Administration

### Why This Matters In Production

"Clients time out" is one of the most ambiguous alerts an SRE receives. The process could be dead. The process could be running but not listening. It could be listening on the wrong address. A firewall rule could be dropping packets. A routing issue could be preventing packets from arriving at all. Each of these has a different fix. Working through the layers systematically — process state, then bind state, then path reachability — avoids the trap of rebooting a service that was never the problem.

### Prerequisites

- Comfortable with `ps aux` and `systemctl status`
- Has seen a socket in `ss` output before
- Basic understanding of what a port is

### Time Estimate

50 minutes. The firewall and routing sections require root access — use a VM or a home lab if needed.

---

### Scenario

It is 15:20. Clients report connection timeouts to `api-server-01` on port 8443. The service was last deployed 2 hours ago with no alerts at the time. This is a fresh complaint.

---

### Part 1 — Beginner: Step-By-Step Triage

#### Step 1 — Confirm The Process Is Running: ps aux

```bash
$ ps aux | grep appserver
appuser  22914  0.4  2.1 12984320 1384448 ?  Ssl  13:18   0:48 /usr/bin/appserver --config /etc/appserver/config.yaml --port 8443
appuser  22918  0.1  0.5  4194304  327680 ?  Sl   13:18   0:12 /usr/bin/appserver --worker --parent 22914
appuser  22920  0.0  0.5  4194304  327680 ?  Sl   13:18   0:11 /usr/bin/appserver --worker --parent 22914
root     31042  0.0  0.0   6748   884 pts/0  S+   15:21   0:00 grep appserver
```

**The process is running** (PID 22914, uptime since 13:18 — 2 hours ago, consistent with the deploy). Three processes: one parent and two workers. `STAT Ssl` — sleeping, multi-threaded, session leader.

The process is alive. So the issue is either: not listening, listening on wrong address, or path blocked.

---

#### Step 2 — Confirm What Is Listening: ss -lntp

```bash
$ ss -lntp
State    Recv-Q   Send-Q   Local Address:Port   Peer Address:Port   Process
LISTEN   0        128      127.0.0.1:8443        0.0.0.0:*          users:(("appserver",pid=22914,fd=12))
LISTEN   0        4096     0.0.0.0:22            0.0.0.0:*          users:(("sshd",pid=841,fd=4))
LISTEN   0        4096        [::]:22               [::]:*          users:(("sshd",pid=841,fd=6))
```

**Found the problem: `127.0.0.1:8443`.** The application is listening only on the loopback address. Clients connecting from outside the host will never reach it — their packets arrive on the primary interface (`eth0`, `ens3`, etc.) but the socket is not bound there.

**Loopback-only vs all-interfaces:**
- `127.0.0.1:8443` — only processes on the same host can connect.
- `0.0.0.0:8443` — any IPv4 interface on the host. External clients can connect.
- `:::8443` — any IPv4 or IPv6 interface (the `ss` shorthand for `[::]`).

**Why does this happen?** Configuration files typically have a `bind_address` or `listen_address` field. After a deploy, this field was set or defaulted to `127.0.0.1` instead of `0.0.0.0`. You can verify locally:

```bash
$ curl -k https://127.0.0.1:8443/healthz
{"status":"ok","version":"2.14.1"}

$ curl -k https://10.0.0.41:8443/healthz
curl: (7) Failed to connect to 10.0.0.41 port 8443: Connection refused
```

---

#### Step 3 — Check Active Connections: ss -tanp

```bash
$ ss -tanp
State       Recv-Q   Send-Q   Local Address:Port   Peer Address:Port   Process
LISTEN      0        128      127.0.0.1:8443         0.0.0.0:*         users:(("appserver",pid=22914,fd=12))
ESTABLISHED 0        0        127.0.0.1:8443         127.0.0.1:58201   users:(("healthcheck",pid=29041,fd=8))
ESTABLISHED 0        0        127.0.0.1:8443         127.0.0.1:58202   users:(("healthcheck",pid=29041,fd=9))
TIME_WAIT   0        0        10.0.0.41:8443         10.0.0.12:54312
TIME_WAIT   0        0        10.0.0.41:8443         10.0.0.14:54788
CLOSE_WAIT  32       0        10.0.0.41:8443         10.0.0.12:48210   users:(("appserver",pid=22914,fd=24))
CLOSE_WAIT  32       0        10.0.0.41:8443         10.0.0.14:48412   users:(("appserver",pid=22914,fd=25))
```

**What each state means:**
- `LISTEN` — the socket is open, accepting connections.
- `ESTABLISHED` — an active two-way connection.
- `TIME_WAIT` — connection has been closed but is held for 2*MSL (60-120 seconds) to handle late packets. Normal. Old connections from before the config change.
- `CLOSE_WAIT` — the remote peer sent FIN (closed its side), but the local process has not closed the socket yet. **Two CLOSE_WAIT sockets with `Recv-Q: 32` means unread data is sitting in the buffer.** The application is not draining those connections. This often means the application's connection-close code is not being reached (hung goroutine, blocked handler, etc.).

**CLOSE_WAIT accumulation is a connection leak.** If you see dozens or hundreds of CLOSE_WAIT sockets from `ss -tanp`, the application is not calling `close()` on sockets after the remote end closes. Over time this exhausts file descriptors.

---

#### Step 4 — Check Interfaces and Routing: ip addr and ip route

```bash
$ ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
2: ens3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 52:54:00:ab:cd:ef brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.41/24 brd 10.0.0.255 scope global dynamic ens3
       valid_lft 72841sec preferred_lft 72841sec
3: ens4: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN group default qlen 1000
    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff
```

**What to read:**
- `lo` is loopback — always present, always `127.0.0.1`.
- `ens3` is the primary interface, IP `10.0.0.41`, state `UP`. Clients connecting to `10.0.0.41:8443` should arrive here. But the socket is bound to `127.0.0.1`, so they get `Connection refused`.
- `ens4` is `DOWN` — a second interface that is not active. Irrelevant here but good to check.

```bash
$ ip route
default via 10.0.0.1 dev ens3 proto dhcp src 10.0.0.41 metric 100
10.0.0.0/24 dev ens3 proto kernel scope link src 10.0.0.41
```

**The routing table looks correct.** Default gateway is `10.0.0.1`. The `/24` subnet is directly connected on `ens3`. Traffic to/from external clients will use `ens3` correctly. The problem is purely the bind address.

---

#### Step 5 — Check Firewall Rules: iptables-save

```bash
$ iptables-save
# Generated by iptables-save v1.8.7 on Wed Apr 09 15:22:11 2026
*filter
:INPUT ACCEPT [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]
-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 8080 -j ACCEPT
-A INPUT -j DROP
COMMIT
```

**Additional finding: port 8443 is not in the firewall rules.** Even if the bind address were fixed to `0.0.0.0`, the firewall would drop incoming connections to 8443. Only ports 22 and 8080 are explicitly allowed. This is a second problem layered on top of the bind address issue.

**How to add the rule temporarily:**
```bash
iptables -I INPUT -p tcp --dport 8443 -j ACCEPT
```

**For persistent rules** (survives reboot), use `netfilter-persistent save` or `iptables-save > /etc/iptables/rules.v4`.

---

#### Step 6 — Check if nftables Is Also Active

Some systems use `nftables` (the newer framework) alongside or instead of `iptables`. Always check both:

```bash
$ nft list ruleset
table inet filter {
    chain input {
        type filter hook input priority filter; policy drop;
        ct state established,related accept
        iifname "lo" accept
        tcp dport 22 accept
        tcp dport 8080 accept
    }
    chain forward {
        type filter hook forward priority filter; policy drop;
    }
    chain output {
        type filter hook output priority filter; policy accept;
    }
}
```

The `nftables` ruleset confirms the same restriction: only 22 and 8080 allowed. Port 8443 is dropped at the INPUT chain.

---

### Part 2 — Intermediate: Directed Analysis

Run these and interpret:

```bash
# How many CLOSE_WAIT connections does the service have right now?
ss -tanp | grep CLOSE_WAIT | wc -l

# How many file descriptors does the process have open?
ls /proc/22914/fd | wc -l
cat /proc/22914/limits | grep "open files"

# Is DNS resolving correctly from this host?
resolvectl status
dig api-server-01.internal @$(resolvectl status | grep "DNS Servers" | awk '{print $3}' | head -1)

# Trace the path to a client:
traceroute -n 10.0.0.12
```

Questions to answer:
1. The application is listening on `0.0.0.0:8443`. Clients in the same subnet connect successfully. Clients from a different subnet time out. What are the possible causes?
2. You see 847 CLOSE_WAIT sockets. The process has been running for 4 hours. Is this a leak? How do you distinguish a normal spike from a leak?
3. The firewall allows 8443. The process is listening on `0.0.0.0:8443`. A client from 10.0.1.5 still times out. `traceroute` to the host shows 3 hops. What next?
4. `dig app-service.svc.cluster.local` fails from the host but works from inside a pod on the same node. Why?

---

### Part 3 — Advanced / Stretch

**Scenario extension:** The bind address and firewall are now fixed. Traffic is flowing. But 30% of requests from external clients are failing with connection reset. Internal clients on the same subnet succeed 100% of the time.

Investigate:

```bash
# Capture packets on the public interface for 30 seconds:
tcpdump -i ens3 -n port 8443 -w /tmp/capture.pcap

# Summarize connection states:
ss -tanp | awk '{print $1}' | sort | uniq -c | sort -rn

# Check if the MTU differs between paths (common cause of TCP resets on external traffic):
ip link show ens3 | grep mtu
ping -M do -s 1400 10.0.0.12      # Internal client
ping -M do -s 1400 203.0.113.45   # External client
```

**MTU mismatch explained:** Internal paths often use MTU 1500. VPN or cloud overlay networks often use MTU 1450 or lower. If the server sends a 1500-byte packet through a path with MTU 1450, routers either fragment it or drop it with ICMP type 3 code 4 (Fragmentation Needed). If ICMP is blocked by the firewall, Path MTU Discovery silently fails and TCP connections appear to hang or reset.

Fix for confirmed MTU issue:
```bash
# Cap the maximum segment size for outbound TCP on this interface:
iptables -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
```

**Reasoning exercises:**
- A service is listening on `:::8443` (IPv6 all-interfaces). A client connecting to the IPv4 address `10.0.0.41:8443` succeeds on some hosts but fails on others. Why? (Hint: `IPV6_V6ONLY` socket option)
- A process exits but its port stays in `TIME_WAIT` for 2 minutes. A new instance of the service tries to start and gets "address already in use." What socket option would you add to the service to avoid this?
- `tcpdump` on the server shows the SYN arriving and a SYN-ACK being sent. The client says it never receives the SYN-ACK. Where is the packet being dropped?

---

### Sample Incident Note

```
[15:31 UTC] api-server-01 port 8443 unreachable from external clients — two issues found.

Issue 1: Application bound to 127.0.0.1:8443 (loopback only), not 0.0.0.0:8443.
  - Confirmed: curl 127.0.0.1:8443/healthz returns 200. curl 10.0.0.41:8443/healthz returns "Connection refused".
  - Cause: config.yaml bind_address set to 127.0.0.1 in deploy artifact (should be 0.0.0.0).

Issue 2: iptables INPUT chain only allows ports 22 and 8080. Port 8443 is dropped.
  - Confirmed: iptables-save shows no rule for 8443. nft list ruleset confirms same.
  - Added temporary rule: iptables -I INPUT -p tcp --dport 8443 -j ACCEPT.

Fix applied: updated config.yaml bind_address to 0.0.0.0, restarted appserver.
Verified: curl 10.0.0.41:8443/healthz from remote host returns 200.

Secondary finding: 2 CLOSE_WAIT sockets observed — monitoring for accumulation.
Permanent firewall fix: ticketed to update nftables ruleset via config management (ticket #8841).

Resolved at 15:29. Client-reported timeouts confirmed cleared at 15:30.
```

---

### Common Mistakes

- **Jumping to firewall rules without checking the bind address first.** The bind address is checked in 10 seconds with `ss -lntp`. Do it before touching iptables.
- **Assuming `0.0.0.0` and `[::]` are equivalent.** Some applications with `IPV6_V6ONLY` set will only accept IPv6 on the `[::]` socket even though `0.0.0.0` handles IPv4. Check both `ss` output lines.
- **Not checking `nft list ruleset` if `iptables-save` shows no rules.** Systems can use either nftables or iptables. On modern Debian/Ubuntu, nftables is the default. On RHEL/CentOS, iptables may be in use via the iptables-legacy backend.
- **Counting CLOSE_WAIT sockets once and drawing conclusions.** Watch the count over time with `watch -n2 'ss -tanp | grep -c CLOSE_WAIT'`. Growing count = leak. Stable count = normal backpressure.
- **Forgetting that `traceroute` uses UDP by default.** A firewall blocking UDP may make `traceroute` look like the path is broken when TCP is actually fine. Use `traceroute -T -p 8443` for TCP-specific path tracing.
- **Opening a port in iptables without making the rule persistent.** `iptables` rules are lost on reboot unless saved with `iptables-save` or managed through a tool like `ufw` or Ansible.

---

### What To Study Next

- Foundation doc: 01-networking-fundamentals.md — TCP state machine, TIME_WAIT, CLOSE_WAIT in depth
- Foundation doc: 10-linux-and-network-administration.md — firewall section
- Practice: deliberately bind a test server to `127.0.0.1`, confirm external failure, change to `0.0.0.0`, confirm success
- Drill 04: Command Mastery Checklist — consolidate the diagnostic commands from this drill and the others

---

## [SRE] Linux Admin Drill 4: Command Mastery Checklist

## Linux Admin Drill 4: Command Mastery Checklist

### How To Use This Drill

For each command, the format is: **what problem it solves**, **one key signal to look for**, **one thing it cannot tell you**, and **one common misuse**. Read each entry, then close this document and recite it from memory. If you can explain what a command proves and what it does not prove, you are using it like an operator and not like someone who Googled it.

This drill pairs with the three labs and three preceding drills. If a command's explanation here feels abstract, go back to the lab where you saw it used in context.

---

### systemctl status

**Problem it solves:** Tell you the lifecycle state of a systemd-managed service — is it running, failed, activating, or inactive.

**Signal to look for:** The `Active:` line. Specifically: `failed (Result: signal)` vs `failed (Result: exit-code)` vs `active (running)` vs `activating`. Also scan the embedded journal snippet for the last few log lines — often the error message is right there.

**What it cannot tell you:** Whether the process is actually healthy. `active (running)` means the process exists and systemd has not detected a crash. The application could be deadlocked, out of memory, or returning 500s to every request.

**Common misuse:** Restarting the service without reading the exit code or log lines first. The restart will fail the same way if the root cause (missing config, permission error, port conflict) is not addressed.

**Example signal:**
```
Active: failed (Result: exit-code) since Wed 2026-04-09 23:06:41 UTC; 3min ago
Process: 28914 ExecStart=... (code=exited, status=1/FAILURE)
Apr 09 23:06:41 appserver[28914]: FATAL: cannot open config file: no such file or directory
```

---

### journalctl

**Problem it solves:** Query structured logs from the systemd journal. Covers both the kernel (dmesg equivalent) and all services writing to journald.

**Signal to look for:** Error and critical priority messages. Use `-p err` to filter. Look for timestamps clustering around the incident window. `journalctl -u <unit> --since "10 minutes ago"` scopes to relevant time.

**What it cannot tell you:** Logs that the application writes directly to a file (not to stdout/stderr or syslog). If the app writes `/var/log/app.log` itself, journalctl will not have those entries.

**Common misuse:** Running `journalctl -u service` without `--since` or `-n` and getting flooded with days of logs. Always add a time window or line limit.

**Key flags to know:**
```bash
journalctl -u appserver -n 50 --no-pager       # Last 50 lines, unit-scoped
journalctl -p err --since "1 hour ago"          # Errors across all units, last hour
journalctl -k --since "30 minutes ago"          # Kernel messages only (like dmesg with time filter)
journalctl -f -u appserver                      # Follow live (like tail -f)
```

---

### ps aux

**Problem it solves:** List all processes with their CPU, memory, state, and command line. The fastest way to confirm a process is alive and see what it is doing.

**Signal to look for:** The `STAT` column. `D` = uninterruptible sleep (blocked on IO or kernel resource). `Z` = zombie (parent has not called `wait()`). `S` = sleeping normally. `R` = running. Multiple processes in `D` state is a warning of IO saturation.

**What it cannot tell you:** Whether a process is being CPU-throttled by a cgroup. A throttled process shows low `%CPU` even when the host has idle cores. Use `pidstat` and `cat /sys/fs/cgroup/.../cpu.stat` for that.

**Common misuse:** Sorting by `%CPU` and concluding the top process is the problem. `%CPU` is a point-in-time snapshot — a process might be showing 0.1% during a brief lull in a job that is actually causing saturation at other times.

---

### top

**Problem it solves:** Real-time view of system resource usage — overall CPU breakdown, memory, swap, and the top processes by CPU or memory.

**Signal to look for:** The `%wa` (IO wait) field in the CPU line. High `wa` (above 20-30%) means CPUs are idle waiting for disk. Processes in `D` state in the process list. `used` vs `available` in the memory line.

**What it cannot tell you:** Per-device IO breakdown. `top` tells you there is IO pressure, not which device or which process is causing it. Use `iostat` for device breakdown and `iotop` for per-process IO accounting.

**Common misuse:** Looking only at `us` (user CPU) and ignoring `wa`, `sy`, and `st`. On a cloud VM, `st` (steal) above 5% means the hypervisor is taking CPU cycles away from your VM — a common source of unexplained slowness.

---

### pidstat

**Problem it solves:** Per-process resource statistics over time. Critically: the `%wait` column shows how long a process spends runnable but not scheduled — the fingerprint of CPU throttling.

**Signal to look for:** `%wait` column. Above 50% means the process is ready to run but is being held back more than half the time. Combine with host `%idle` to distinguish throttling (host idle, process %wait high) from saturation (host idle near 0%, %wait high).

**What it cannot tell you:** Cgroup limits directly. It shows the effect (high wait) but you need to read `cpu.stat` in the cgroup filesystem to confirm the cause is a quota.

**Common misuse:** Running `pidstat` once and drawing conclusions. CPU scheduling is bursty. Run `pidstat -u 1 10 -p <PID>` for 10 one-second samples.

---

### free -m

**Problem it solves:** Quick summary of physical memory and swap — total, used, free, and crucially the `available` column.

**Signal to look for:** The `available` column (not `free`). Available accounts for reclaimable page cache and is the realistic "how much more can a new process allocate" number. Also: any nonzero `used` in the Swap line warrants investigation on a host that should have ample RAM.

**What it cannot tell you:** Which process is consuming memory. It shows aggregate totals only. Use `ps aux --sort=-%mem` or check cgroup `memory.usage_in_bytes` per container.

**Common misuse:** Looking at the `free` column and concluding memory is fine. `free` excludes buff/cache. On a well-utilized host, `free` is always near zero because the kernel fills the rest with page cache. `available` is the correct column.

---

### vmstat

**Problem it solves:** System-wide view of process states, memory activity, swap IO, block IO, interrupts, and CPU breakdown — all in one line per interval.

**Signal to look for:** `b` column (processes blocked on IO), `si`/`so` (swap in/swap out — nonzero si or so means active swapping), `wa` CPU column (IO wait). Watch the trend across multiple samples.

**What it cannot tell you:** Per-device breakdown. `vmstat` gives aggregate block IO (`bi`/`bo`), not per-device await or utilization. Use `iostat -xz` for that.

**Common misuse:** Running `vmstat` once (`vmstat 1`) and only reading the first line. The first line of `vmstat` output is averages since boot — meaningless for current state. Always collect multiple samples: `vmstat 1 10`.

---

### iostat

**Problem it solves:** Per-device IO statistics — read/write throughput, request latency (`r_await`, `w_await`), queue depth (`aqu-sz`), and device utilization (`%util`).

**Signal to look for:** `%util` near 100% (device saturated). `w_await` or `r_await` much higher than the device's normal baseline (under 1ms for NVMe, under 5ms for modern SSD, under 20ms for spinning disk). `aqu-sz` above 1 (requests queuing up).

**What it cannot tell you:** Which process is causing the IO. `iostat` is device-centric. Pair it with `iotop -o` (processes causing IO right now) or `blktrace` for deep tracing.

**Common misuse:** Trusting `%util` as a linear capacity indicator. SSDs and NVMe drives can handle parallel requests (queue depth > 1) — a device at 80% `%util` with `aqu-sz` of 0.1 is healthy. A device at 40% `%util` with `aqu-sz` of 8 is congested. Read both together.

---

### df -h

**Problem it solves:** Filesystem byte usage — total size, used, available, and percentage per mounted filesystem.

**Signal to look for:** Any filesystem above 85% usage (approaching inode or space exhaustion risk). The `/var` partition specifically — it holds logs, package managers, container layers, and spool queues.

**What it cannot tell you:** Inode usage, IO latency, whether the filesystem is mounted read-only, or whether a deleted-but-open file is holding space. It is a capacity snapshot, nothing more.

**Common misuse:** Stopping at `df -h` when diagnosing write failures. Always also run `df -i`. Always also run `findmnt` to check mount options. The combination of all three takes 15 seconds.

---

### df -i

**Problem it solves:** Filesystem inode usage — total inodes, used, free, and percentage per filesystem.

**Signal to look for:** Any filesystem at or near 100% inode usage. A filesystem can be at 10% byte usage and 100% inode usage simultaneously. When `IUse%` is 100%, no new files can be created, and applications receive `ENOSPC` from file creation syscalls.

**What it cannot tell you:** Which directories hold the most inodes. Follow up with `find <dir> -xdev | wc -l` per subdirectory or the loop pattern from Drill 02.

**Common misuse:** Not running it at all. Most SREs check `df -h` reflexively but not `df -i`. In environments with Docker, mail queues, or high-churn small files, inode exhaustion is a real production failure mode.

---

### findmnt

**Problem it solves:** Show the full mount tree with filesystem types and mount options — a more complete view than `mount | grep`.

**Signal to look for:** Mounts with `ro` in the OPTIONS column (unexpected read-only mount). NFS mounts (fstype `nfs4` or `nfs`) — these introduce network dependency and latency into what looks like a local write. `errors=remount-ro` in ext4 mounts (will remount read-only on error).

**What it cannot tell you:** Whether an NFS mount is currently hung. `df -h` on a hung NFS mount will itself hang. Use `findmnt` first (it reads `/proc/mounts` without triggering IO) before `df` on systems with NFS.

**Common misuse:** Skipping it entirely and using `mount` instead. `findmnt` shows the tree structure (which overlays are stacked on which devices) more clearly than `mount` output.

---

### lsblk

**Problem it solves:** Show the block device tree — physical disks, partitions, LVM volumes, RAID devices — and which filesystems are mounted on which.

**Signal to look for:** The `RO` column. `RO=1` means the block device itself is read-only (hardware level or kernel flag). This is distinct from a filesystem being mounted read-only. Also check `TYPE` — `disk`, `part`, `lvm`, `raid1` tell you what layer you are on.

**What it cannot tell you:** IO statistics or filesystem health. For IO, use `iostat`. For filesystem errors, use `dmesg | grep EXT4` or `xfs_info`.

**Common misuse:** Confusing `lsblk` output for an NVMe device that shows no mounts with an unmounted disk. The device may be in use by LVM or MD RAID but not show a direct mount.

---

### ss -s

**Problem it solves:** Summary of socket counts by type and state — how many TCP connections are in each state across the whole host.

**Signal to look for:** Unusually high CLOSE_WAIT count (connection leak). Unusually high TIME_WAIT count (short-lived connections being created faster than they drain — often a sign of a retry storm). Large number of sockets overall on a service that should have a bounded connection pool.

**What it cannot tell you:** Which process owns which sockets. Use `ss -tanp` for process attribution.

**Sample output to recognize:**
```
Total: 3284
TCP:   2941 (estab 1204, closed 128, orphaned 0, timewait 118)
        Transport Total     IP        IPv6
        *         3284      -         -
        RAW       0         0         0
        UDP       12        8         4
        TCP       2813      1904      909
        INET      2825      1912      913
```

---

### ss -tanp

**Problem it solves:** Full TCP socket list with state, queue sizes, addresses, ports, and owning process. The primary tool for diagnosing connection-level networking issues.

**Signal to look for:** Sockets in `LISTEN` state (confirm the service is bound and on which address). `Recv-Q > 0` on a LISTEN socket means the accept queue is backed up — the application is not accepting connections fast enough. CLOSE_WAIT sockets growing over time (connection leak).

**What it cannot tell you:** Whether packets are reaching the socket or being dropped by a firewall upstream. For that, use `tcpdump` on the interface.

**Common misuse:** Running it once and reading it as a static picture. Socket states change constantly. For CLOSE_WAIT analysis, poll with `watch -n2 'ss -tanp | grep -c CLOSE_WAIT'` and watch the trend.

---

### ip addr

**Problem it solves:** Show all network interfaces, their IP addresses, states, and flags.

**Signal to look for:** Interface state (`UP` vs `DOWN`). IP address assigned to the right interface. Whether the expected IP is present at all (important after a failed cloud metadata refresh or static config error). `NO-CARRIER` on an interface that should be connected.

**What it cannot tell you:** Routing or firewall state. Use `ip route` for routing and `iptables-save`/`nft list ruleset` for firewall.

**Common misuse:** Confusing interface state with link state. An interface can be `UP` (administratively enabled) but `NO-CARRIER` (no physical or virtual cable connected).

---

### ip route

**Problem it solves:** Show the kernel routing table — which traffic goes via which interface and gateway.

**Signal to look for:** Is a default route present? `default via <gateway> dev <interface>`. If absent, the host cannot reach anything outside its local subnet. Is traffic to a specific destination being routed through the expected interface?

**What it cannot tell you:** Whether the gateway is reachable or whether there is packet loss. Follow up with `ping <gateway>` and `traceroute`.

**Common misuse:** Not checking after a network interface reconfiguration. Bringing an interface down and back up can remove routes, leaving the host with a local subnet route but no default gateway.

---

### resolvectl status

**Problem it solves:** Show DNS configuration managed by `systemd-resolved` — which DNS servers are configured, per-link settings, and the current resolver state.

**Signal to look for:** Which DNS server each interface is using. Whether a link has DNS servers configured at all. `DNSSEC` and `LLMNR` state. This is the correct tool on modern Ubuntu/Debian systems — `/etc/resolv.conf` may just point to `127.0.0.53` (the resolved stub).

**What it cannot tell you:** Whether the DNS server itself is responding correctly. Follow up with `dig @<server> <name>` to test directly.

**Common misuse:** Reading `/etc/resolv.conf` and assuming it shows the actual DNS server. On systems with `systemd-resolved`, `/etc/resolv.conf` shows only the local stub resolver. Use `resolvectl status` to see the real upstream.

---

### dig

**Problem it solves:** Send a DNS query and show the full response — answer records, query time, server used, and any errors.

**Signal to look for:** `ANSWER SECTION` present (name resolved). `NXDOMAIN` (name does not exist). `SERVFAIL` (DNS server encountered an error resolving). Query time (high latency can cascade into application slowness). `SERVER:` line (which resolver was actually used).

**What it cannot tell you:** Whether the application is using the same resolver. The application may have a hard-coded DNS server, use a resolver library with a different timeout, or have a stale cached entry.

**Key usage patterns:**
```bash
dig api.example.com                          # Use default resolver
dig @8.8.8.8 api.example.com                 # Use specific resolver
dig api.example.com +short                   # IP addresses only
dig api.example.com MX                       # Query a specific record type
dig -x 10.0.0.41                             # Reverse lookup (PTR)
```

---

### tcpdump

**Problem it solves:** Capture packets on an interface and inspect them. The last resort when higher-level tools (ss, dig, curl) do not explain the failure — you need to see what is actually on the wire.

**Signal to look for:** SYN without SYN-ACK (server not receiving or not responding). RST immediately after SYN (firewall or application rejecting). Large TCP retransmits (`[R]` flags). Abnormal window sizes or MSS values.

**What it cannot tell you:** Application-layer content in encrypted TLS connections without decryption keys. For HTTPS debugging, use `curl -v` or application-level logging.

**Key usage patterns:**
```bash
tcpdump -i ens3 -n port 8443              # All traffic on port 8443
tcpdump -i any -n host 10.0.0.12          # All traffic to/from a specific host
tcpdump -i ens3 -n -w /tmp/cap.pcap       # Write to file for analysis in Wireshark
tcpdump -i ens3 -n 'tcp[tcpflags] == tcp-syn'  # SYNs only
```

**Common misuse:** Running tcpdump without `-n` (it will do reverse DNS lookups on every packet, slowing the capture and potentially missing packets during a high-traffic storm). Always use `-n` in production.

---

### iptables-save

**Problem it solves:** Dump the full iptables ruleset in a readable, persistent format. More reliable than `iptables -L -n -v` for seeing the exact rules in order.

**Signal to look for:** Rules in the `INPUT` chain that drop or reject traffic to your service port. The `FORWARD` chain if you are debugging container or VM routing. The order of rules matters — the first matching rule wins.

**What it cannot tell you:** Whether nftables rules are also active. On modern systems, iptables and nftables can coexist. If `iptables-save` shows no relevant rules but traffic is still blocked, check `nft list ruleset`.

**Common misuse:** Editing iptables rules directly with `iptables -I` without saving afterward. Rules are lost on reboot. Use `iptables-save > /etc/iptables/rules.v4` or `netfilter-persistent save` to persist.

---

### nft list ruleset

**Problem it solves:** Show the active nftables ruleset — the modern Linux firewall framework that replaced iptables on many distributions.

**Signal to look for:** `policy drop` on the `input` chain (default-deny). Missing `accept` rules for your service port. `counter` statements showing how many packets each rule has matched (useful for confirming a rule is actually being hit).

**What it cannot tell you:** iptables rules (a separate framework). On RHEL 8+, nftables is the default. On Ubuntu 22.04+, nftables is default. Know which framework your hosts use.

**Common misuse:** Making iptables changes on a host where nftables is the active framework. The changes go through the iptables compatibility shim but may interact unexpectedly with native nftables rules. Stick to one framework per host.

---

### Mentor Tip: Prove and Disprove

Every command here proves something and fails to prove something else. An experienced operator says "I ran `df -h` and it shows 43% used — that rules out bytes as the problem but says nothing about inodes, latency, or mount state." They chain commands to sequentially eliminate hypotheses rather than running the same three commands they always run and guessing from there.

The test: can you pick any two commands from this list and explain to a colleague what the first one proves, what gap it leaves, and which command fills that gap?
