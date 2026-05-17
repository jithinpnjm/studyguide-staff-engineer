---
title: "Intermediate"
sidebar_position: 2
---

# Linux & Systems — Intermediate

Intermediate Linux skill means you can classify production symptoms quickly: CPU saturation, memory pressure, disk exhaustion, inode exhaustion, network reachability, process leaks, systemd failures, and kernel-level signals.

The SRE mental model:

```text
symptom -> resource pressure -> evidence -> safe mitigation -> root cause
```

---

## The First 10 Minutes On A Bad Host — Full Runbook

When paged at 2 AM with "host latency elevated," run commands in this exact order. Do not skip steps to jump to what you think the problem is.

### Step 1 — Orient

```bash
hostname           # am I on the right machine?
date               # is system time sane?
uptime             # load average: 1/5/15 min. Compare to nproc.
w                  # who is logged in, what are they running?
whoami             # am I the expected user?
```

**Reading uptime:** If 1-minute load is much higher than 15-minute, problem is recent. If all three are high, it has been happening a while. Load above `nproc` means the system is overloaded.

### Step 2 — Resource Snapshot

```bash
top -bn1           # one-shot top: CPU fields us/sy/id/wa/st, process list
free -h            # memory: look at 'available', not 'free'
vmstat 1 5         # CPU/memory/IO across 5 samples (first line = since boot, ignore it)
df -h              # byte usage per filesystem
df -i              # inode usage per filesystem
```

### Step 3 — Deeper CPU and I/O

```bash
iostat -x 1 3                     # per-device IO: r_await, w_await, %util, aqu-sz
mpstat -P ALL 1 3                 # per-CPU breakdown
pidstat -u 1 5                    # per-process CPU with %wait column
```

### Step 4 — Network And Sockets

```bash
ss -s                             # socket state summary
ss -tulnp                         # listening TCP/UDP with process names
ip addr                           # interface state and IPs
ip route                          # routing table
resolvectl status || cat /etc/resolv.conf
```

### Step 5 — Error Logs

```bash
dmesg -T | tail -20               # kernel messages with timestamps
journalctl -n 50 --no-pager       # recent journal entries
journalctl -p err -n 100 --no-pager   # errors across all services
```

### Step 6 — Scope Classification

```bash
ps aux --sort=-%cpu | head        # top CPU consumers
ps aux --sort=-%mem | head        # top memory consumers
systemctl list-units --failed     # failed systemd units
```

**Interpretation table:**

| Signal | Meaning |
|---|---|
| High load | CPU run queue, blocked I/O, or both |
| Low available memory | Memory pressure |
| Swap in/out | Latency risk |
| Disk full | Writes fail |
| Inodes full | New files fail |
| Socket explosion | Connection leak or traffic spike |
| Kernel errors | OOM, disk, driver, or network clue |
| High wa% | Processes blocked waiting on disk |
| High st% | Hypervisor stealing CPU (cloud VM) |

---

## CPU And Load Debugging

Load average is not CPU percentage. Load includes runnable processes and processes stuck in uninterruptible sleep.

```bash
uptime
vmstat 1 5
mpstat -P ALL 1 5
pidstat -u 1 5
ps aux --sort=-%cpu | head
```

### vmstat Fields

| Field | Meaning |
|---|---|
| r | Runnable processes waiting for CPU |
| b | Blocked processes |
| us | User CPU |
| sy | Kernel CPU |
| id | Idle CPU |
| wa | I/O wait |
| si | Software interrupts |
| so | Swap out (nonzero = memory pressure) |
| bi/bo | Block reads/writes per second |

### Interpreting CPU Wait Fields

```text
us (user):   application CPU — your code
sy (system): kernel CPU — syscalls, networking, filesystem
id (idle):   genuinely idle
wa (iowait): CPUs idle waiting for disk/network storage IO
hi (hardirq): hardware interrupt processing
si (softirq): software interrupt (often network packet processing)
st (steal):  hypervisor stealing from VM — cloud performance problem
```

High `st` (steal above 5%) on cloud VMs means the hypervisor is taking cycles. Detect: `vmstat 1 5`, check `st` column. Mitigation: move to a less-contended host or instance type.

### Finding CPU Offenders

```bash
ps aux --sort=-%cpu | head
pidstat -u 1 5                    # shows %wait — key for throttling detection
perf top                          # real-time function-level CPU usage
perf stat -p PID sleep 10         # CPU event counters for a process
```

High `%wait` in `pidstat` with low host CPU = cgroup throttling, not saturation.

High `%wait` with low host idle = CPU saturation.

D-state processes:

```bash
ps aux | awk '$8 ~ /D/ {print}'
```

D-state processes cannot be killed until the kernel I/O call returns.

---

## Memory Debugging

```bash
free -h
cat /proc/meminfo | head
vmstat 1 5
ps aux --sort=-%mem | head
```

### free -h Output Explained

```text
               total        used        free      shared  buff/cache   available
Mem:            64G         58G         412M      1.1G        4.7G         1.1G
Swap:           8G          2G          6G
```

- `total`: physical RAM installed.
- `used`: allocated memory excluding cache.
- `free`: completely unused — almost always low on a busy system and that is fine.
- `buff/cache`: disk cache and buffers — Linux fills this with free RAM to speed up I/O.
- `available`: realistic estimate of how much new allocations can use. This is the key number.
- `Swap used`: nonzero swap during normal operation is a warning. Active swap causes millisecond latency.

### /proc/meminfo Key Fields

```bash
cat /proc/meminfo | grep -E 'MemAvailable|Cached|SwapUsed|Dirty|Writeback|AnonPages'
```

| Field | Meaning |
|---|---|
| MemAvailable | Best estimate of usable memory |
| Cached | File-backed page cache |
| SwapUsed | How much swap is in use |
| Dirty | Memory pending write to disk |
| Writeback | Pages actively being written |
| AnonPages | Application heap and stack |

### Memory Leak Detection

```bash
watch -n 5 "ps -o pid,rss,vsz,cmd -p PID"
cat /proc/PID/status | grep -E 'VmRSS|VmSize|Threads'
```

Growing RSS over time indicates a memory leak.

### vmstat For Memory Pressure

```bash
vmstat 1 5
```

Watch `si` (swap in) and `so` (swap out). Any nonzero `so` means pages are being pushed to swap — latency risk.

### OOM Investigation

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

---

## Disk And Filesystem Debugging

### Disk Space

```bash
df -h
sudo du -sh /var/* | sort -rh | head
sudo find / -xdev -type f -size +1G -ls 2>/dev/null
```

### Inode Exhaustion

```bash
df -i
sudo find / -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head
```

A filesystem at 100% inode usage rejects all file creation even with free bytes. Typical culprits: Docker image layers, mail queues, session files, temp files per-request.

### Deleted But Still Open

```bash
sudo lsof +L1
```

`+L1` shows files with a link count below 1 — meaning they have been deleted from the directory but are still held open. The disk blocks are not freed until the file descriptor closes.

Fix: restart or reload the owning process.

### Finding Mount State

```bash
findmnt                                        # show full mount tree with options
mount | grep " ro,"                            # find unexpected read-only mounts
```

If a filesystem has `errors=remount-ro` (ext4 default) and encounters an error, it flips to read-only. Writes then fail silently.

---

## I/O Latency

Install tools if needed:

```bash
sudo apt-get install -y sysstat
```

### iostat — Device-Level Analysis

```bash
iostat -xz 1 5
```

Key fields:

| Field | Meaning |
|---|---|
| r_await | Average read request completion time (ms) |
| w_await | Average write request completion time (ms) |
| r/s, w/s | Reads/writes per second |
| rkB/s, wkB/s | Throughput |
| aqu-sz | Average queue depth |
| %util | Device busy percentage |

Thresholds:
- NVMe: normal await < 1 ms. Above 5 ms = degraded.
- SSD: normal await < 5 ms. Above 20 ms = problem.
- `%util` above 80% = device saturated. Above 95% = crisis.
- `aqu-sz` above 1 = requests queuing up.

### iotop — Process-Level I/O

```bash
sudo iotop -ao               # show only processes doing IO, cumulative
sudo iotop -b -n 5           # batch mode, 5 snapshots
pidstat -d 1 5               # per-process disk IO without root
```

### Advanced I/O Tools

```bash
lsof +D /path                # which processes have files open in a path
fuser /path/to/file          # which processes are accessing a file
```

---

## Process Debugging

```bash
ps aux
ps -ef --forest
pgrep -af service-name
lsof -p PID
strace -p PID
cat /proc/PID/status
cat /proc/PID/limits
```

Useful questions:

- Is the process running?
- Is it stuck in system calls?
- Which files or sockets are open?
- How many threads does it have?
- Is it hitting file descriptor limits?

### Open File Descriptor Count

```bash
ls /proc/PID/fd | wc -l
ulimit -n
cat /proc/PID/limits | grep files
```

### strace For Process Investigation

```bash
strace -p PID                           # attach to running process
strace -p PID -e trace=network          # only network syscalls
strace -p PID -e trace=file             # only file syscalls
strace -T -p PID                        # show time spent in each syscall
strace -c -p PID                        # summary of syscall counts and time
strace -f -o /tmp/trace.log command     # trace forked children
```

What strace answers:
- What is the process waiting on? (`connect()`, `read()`, `futex()`)
- Is it getting permission errors? (`EACCES`)
- Is it opening files that do not exist? (`ENOENT`)
- Is it stuck in a network call? (repeated `connect()` or `recv()`)

### /proc/PID Key Files

```bash
cat /proc/PID/status          # state, memory, threads, uid
cat /proc/PID/limits          # per-resource limits (nofile, nproc, etc.)
ls -l /proc/PID/fd            # open file descriptors
cat /proc/PID/cmdline | tr '\0' ' '   # full command line
cat /proc/PID/net/tcp         # TCP sockets for this process
cat /proc/PID/cgroup           # which cgroup the process belongs to
```

---

## systemd Troubleshooting — Deep

```bash
systemctl status SERVICE
systemctl cat SERVICE
systemctl show SERVICE
journalctl -u SERVICE -n 200 --no-pager
journalctl -u SERVICE --since "1 hour ago"
```

### Reading systemctl status Output

The key lines:

```text
Loaded: loaded (/etc/systemd/system/app.service; enabled; ...)
Active: failed (Result: exit-code) since ...
Process: 28914 ExecStart=... (code=exited, status=1/FAILURE)
```

Active states:
- `active (running)`: process is alive.
- `active (exited)`: ran and exited cleanly (normal for oneshot units).
- `failed (Result: exit-code)`: process exited nonzero.
- `failed (Result: signal)`: killed by signal (137 = SIGKILL/OOM, 139 = SIGSEGV).
- `activating`: start in progress or stuck on a dependency.
- `failed (Result: start-limit-hit)`: exceeded restart burst limit.

### Restart Behavior

```bash
systemctl show SERVICE | grep -E 'Restart|StartLimit|NRestarts'
```

If a service hits `start-limit-hit`, it stops retrying. To restart it manually:

```bash
sudo systemctl reset-failed SERVICE
sudo systemctl start SERVICE
```

### Overriding Unit Files

Instead of editing the original unit file, use drop-in overrides:

```bash
sudo systemctl edit SERVICE       # creates /etc/systemd/system/SERVICE.d/override.conf
```

Example override to increase open file limit:

```ini
[Service]
LimitNOFILE=65535
```

After editing:

```bash
sudo systemctl daemon-reload
sudo systemctl restart SERVICE
```

### journalctl For Service Logs

```bash
journalctl -u SERVICE --since "1 hour ago"   # time-scoped service logs
journalctl -u SERVICE -p err --since "1 hour ago"  # errors only
journalctl -u SERVICE -f                     # follow live
journalctl --since "2026-05-17 10:00" --until "2026-05-17 10:30"  # exact window
```

### Common Failure Reasons

- Wrong ExecStart path
- Missing EnvironmentFile (`ignore_errors=no`)
- Permission problem on binary or config
- Port already in use
- Service dependency not ready (`After=`, `Requires=`)
- Restart loop from a bug (`start-limit-hit`)
- Resource limits (`LimitNOFILE`, `MemoryMax`)

---

## Network Debugging

### Local State

```bash
ip addr
ip route
ss -lntp
ss -tulnp
ss -tanp
ss -s
```

### ss Reference

| Flag | Meaning |
|---|---|
| -t | TCP sockets |
| -u | UDP sockets |
| -l | Listening sockets only |
| -n | Numeric addresses and ports |
| -p | Show owning process |
| -s | Summary of socket counts |
| -4 | IPv4 only |
| -6 | IPv6 only |

### DNS

```bash
dig example.com
dig @8.8.8.8 example.com         # query specific resolver
dig example.com +short            # IP only
resolvectl status
cat /etc/resolv.conf
```

### Connectivity

```bash
curl -vk https://example.com      # shows DNS, TCP, TLS, and HTTP separately
nc -vz host 443                   # raw TCP connect test
traceroute host                   # path tracing
mtr host                          # continuous traceroute with packet loss
nmap -sV localhost                # service version detection
```

### tcpdump For Packet-Level Debug

```bash
tcpdump -i eth0 port 80 -n                    # HTTP traffic, numeric
tcpdump -i any host 10.0.0.12 -n              # all traffic to/from a host
tcpdump -i eth0 -w /tmp/capture.pcap          # save to file
tcpdump -r /tmp/capture.pcap                  # read saved file
tcpdump -i eth0 'tcp[tcpflags] == tcp-syn'    # SYN packets only
```

Always use `-n` to avoid reverse DNS lookups which slow the capture.

### Conntrack

```bash
conntrack -S                                  # connection tracking statistics
sysctl net.netfilter.nf_conntrack_max         # max entries
cat /proc/net/nf_conntrack | wc -l            # current count
conntrack -L | wc -l                          # same, via tool
```

When conntrack is full, new connections are silently dropped.

### Network Debug Interpretation

| Symptom | Likely meaning |
|---|---|
| connection refused | host reachable, port closed |
| timeout | packet dropped or route/firewall issue |
| no route to host | routing problem |
| DNS NXDOMAIN | name does not exist |
| DNS timeout | resolver path issue |
| CLOSE_WAIT accumulation | application connection leak |
| many TIME_WAIT | short-lived connections, consider SO_REUSEADDR |

---

## Log Analysis

System logs:

```bash
journalctl -p err -n 100 --no-pager
journalctl -k -n 100 --no-pager
dmesg | tail -100
```

Application logs:

```bash
journalctl -u app -n 200 --no-pager
tail -f /var/log/app/app.log
journalctl -f                        # follow all journal
```

Log analysis one-liners:

```bash
grep -i error /var/log/*.log | sort | uniq -c | sort -rn | head -20
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn    # HTTP status codes
tail -f /var/log/syslog | grep -i "error\|warn\|crit"
journalctl --since "1 hour ago" -p warning --no-pager | tail -50
```

Use time windows to correlate with deployment or alert time:

```bash
journalctl --since "2026-05-17 10:00" --until "2026-05-17 10:30"
```

---

## Intermediate Takeaways

1. Start with host-wide signals before changing anything.
2. High load can be CPU or I/O wait — check `wa` and D-state.
3. Low free memory is normal; low available memory is important.
4. Disk can be full by bytes or inodes — always run both `df -h` and `df -i`.
5. Deleted-open files keep disk space allocated until the fd closes.
6. `systemctl status` plus `journalctl` gives fast service context.
7. `iostat` shows device saturation; `iotop` shows which process is responsible.
8. `strace` shows what a process is waiting for in the kernel.
9. Network errors have different meanings: refused, timeout, NXDOMAIN, no route.
10. Mitigate safely before perfect root cause when users are impacted.
11. The first line of `vmstat` is averages since boot — always read multiple samples.
12. `ss -tulnp` and `findmnt` are the most underused first-response commands.
