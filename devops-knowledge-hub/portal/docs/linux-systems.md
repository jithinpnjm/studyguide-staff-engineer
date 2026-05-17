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
