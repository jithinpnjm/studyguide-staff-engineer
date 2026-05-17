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

## The First 10 Minutes On A Bad Host

Start with a snapshot:

```bash
hostname
date
uptime
w
whoami
free -h
vmstat 1 5
df -h
df -i
ss -s
journalctl -p err -n 100 --no-pager
dmesg | tail -100
```

Interpretation:

| Signal | Meaning |
|---|---|
| High load | CPU run queue, blocked I/O, or both |
| Low available memory | Memory pressure |
| Swap in/out | Latency risk |
| Disk full | Writes fail |
| Inodes full | New files fail |
| Socket explosion | Connection leak or traffic spike |
| Kernel errors | OOM, disk, driver, or network clue |

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

`vmstat` fields:

| Field | Meaning |
|---|---|
| r | Runnable processes waiting for CPU |
| b | Blocked processes |
| us | User CPU |
| sy | Kernel CPU |
| id | Idle CPU |
| wa | I/O wait |
| si | Software interrupts |

High load + high CPU usually means CPU-bound work.

High load + low CPU often means I/O wait or D-state processes.

Find D-state processes:

```bash
ps aux | awk '$8 ~ /D/ {print}'
```

---

## Memory Debugging

```bash
free -h
cat /proc/meminfo | head
vmstat 1 5
ps aux --sort=-%mem | head
```

Important distinction:

```text
free memory low: often normal
available memory low: real pressure
swap activity: latency risk
```

Check a process:

```bash
cat /proc/PID/status | grep -E 'VmRSS|VmSize|Threads'
pmap -x PID | tail -20
```

Watch for growth:

```bash
watch -n 5 "ps -o pid,rss,vsz,cmd -p PID"
```

OOM investigation:

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

If the OOM killer fired, identify the killed process and why memory demand exceeded available capacity.

---

## Disk And Filesystem Debugging

Disk space:

```bash
df -h
sudo du -sh /var/* | sort -rh | head
sudo find / -xdev -type f -size +1G -ls 2>/dev/null
```

Inodes:

```bash
df -i
sudo find / -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head
```

Deleted but open files:

```bash
sudo lsof +L1
```

Common cause: application deletes or rotates a log file, but the process keeps the file descriptor open. Disk space is not released until the descriptor closes.

---

## I/O Latency

Install tools if needed:

```bash
sudo apt-get install -y sysstat
```

Check I/O:

```bash
iostat -xz 1 5
pidstat -d 1 5
```

Important fields:

| Field | Meaning |
|---|---|
| await | Average I/O wait time |
| r/s, w/s | Reads/writes per second |
| rkB/s, wkB/s | Throughput |
| %util | Device busy percentage |

High `%util` and high `await` usually indicate storage bottleneck.

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

Open file descriptor count:

```bash
ls /proc/PID/fd | wc -l
ulimit -n
cat /proc/PID/limits | grep files
```

---

## systemd Troubleshooting

```bash
systemctl status SERVICE
systemctl cat SERVICE
systemctl show SERVICE
journalctl -u SERVICE -n 200 --no-pager
journalctl -u SERVICE --since "1 hour ago"
```

Common failure reasons:

- Wrong ExecStart path
- Missing environment file
- Permission problem
- Port already in use
- Service dependency not ready
- Restart loop
- Resource limits

Check restart behavior:

```bash
systemctl show SERVICE | grep -E 'Restart|StartLimit|NRestarts'
```

Reload unit after editing:

```bash
sudo systemctl daemon-reload
sudo systemctl restart SERVICE
```

---

## Networking Debugging

Local state:

```bash
ip addr
ip route
ss -lntp
ss -tanp
ss -s
```

DNS:

```bash
dig example.com
resolvectl status
cat /etc/resolv.conf
```

Connectivity:

```bash
curl -vk https://example.com
nc -vz host 443
traceroute host
```

Interpretation:

| Symptom | Likely meaning |
|---|---|
| connection refused | host reachable, port closed |
| timeout | packet dropped or route/firewall issue |
| no route to host | routing problem |
| DNS NXDOMAIN | name does not exist |
| DNS timeout | resolver path issue |

---

## Logs

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
grep -i error /var/log/app/app.log
```

Use time windows:

```bash
journalctl --since "2026-05-17 10:00" --until "2026-05-17 10:30"
```

---

## Intermediate Takeaways

1. Start with host-wide signals before changing anything.
2. High load can be CPU or I/O wait.
3. Low free memory is normal; low available memory is important.
4. Disk can be full by bytes or inodes.
5. Deleted-open files keep disk space allocated.
6. `systemctl status` plus `journalctl` gives fast service context.
7. Network errors have different meanings: refused, timeout, NXDOMAIN, no route.
8. Mitigate safely before perfect root cause when users are impacted.
