---
title: "Troubleshooting"
sidebar_position: 8
---

# Linux & Systems — Troubleshooting

Linux troubleshooting is evidence-driven. Start broad, classify the failure, then narrow. Avoid changing the system before you know whether the problem is CPU, memory, disk, network, service, kernel, or dependency related.

```text
symptom -> scope -> resource signal -> process evidence -> logs -> mitigation -> root cause
```

---

## First 60 Seconds

Run this snapshot:

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
journalctl -p err -n 50 --no-pager
dmesg | tail -50
```

Interpret quickly:

| Signal | What it tells you |
|---|---|
| `uptime` | Load trend |
| `free -h` | Available memory and swap |
| `vmstat` | CPU run queue, blocked tasks, swap, I/O wait |
| `df -h` | Disk byte usage |
| `df -i` | Inode usage |
| `ss -s` | Socket pressure |
| `journalctl` | Recent service/system errors |
| `dmesg` | Kernel-level evidence |

---

## High Load

### Check

```bash
uptime
vmstat 1 5
ps aux --sort=-%cpu | head
ps aux | awk '$8 ~ /D/ {print}'
iostat -xz 1 5
```

### Interpret

| Pattern | Likely cause |
|---|---|
| High load, high CPU | CPU-bound workload |
| High load, high `wa` | I/O wait |
| High load, low CPU | Blocked tasks or D-state |
| High `si` | Network interrupt pressure |

### Mitigation

- Reduce traffic if safe.
- Restart or move one unhealthy workload, not the whole fleet.
- Investigate storage if D-state or I/O wait is high.
- Avoid `kill -9` for D-state processes; it usually will not help.

---

## High CPU

### Check

```bash
top
ps aux --sort=-%cpu | head
pidstat -u 1 5
mpstat -P ALL 1 5
```

### Investigate Process

```bash
lsof -p PID
strace -tt -T -p PID
cat /proc/PID/status
```

### Common Causes

- Traffic spike
- Busy loop
- Inefficient query or code path
- Too many workers
- Compression/encryption overhead
- Logging overhead

### Safe Response

Prefer graceful process restart, scaling out, or load shedding before force-killing critical processes.

---

## Memory Pressure

### Check

```bash
free -h
vmstat 1 5
ps aux --sort=-%mem | head
cat /proc/meminfo | grep -E 'MemAvailable|Cached|Swap'
```

### OOM Check

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

### Interpret

- Low `free` alone is normal.
- Low `available` matters.
- Non-zero swap in/out indicates latency risk.
- OOM evidence is usually in kernel logs.

### Response

- Identify top memory users.
- Confirm host OOM vs cgroup/container OOM.
- Check recent deploy or traffic change.
- Increase capacity only after checking for leak or bad configuration.

---

## Disk Full

### Check

```bash
df -h
sudo du -sh /var/* 2>/dev/null | sort -rh | head
sudo find / -xdev -type f -size +1G -ls 2>/dev/null | head
```

### Deleted But Still Open

```bash
sudo lsof +L1
```

### Response

- Remove only safe files.
- Compress or rotate logs when appropriate.
- Restart or reload a process holding deleted files open.
- Fix log retention or logrotate configuration.

Do not delete random files under `/var/lib` or database directories during an incident unless you know the application semantics.

---

## Inodes Full

### Check

```bash
df -i
sudo find / -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head
```

### Common Causes

- Millions of tiny temp files
- Bad cache cleanup
- Mail spool growth
- Session files
- Exploded log shards

### Response

Remove safe generated files, fix cleanup logic, and add inode alerts.

---

## Service Down

### Check

```bash
systemctl status SERVICE
systemctl cat SERVICE
journalctl -u SERVICE -n 200 --no-pager
journalctl -p err -n 100 --no-pager
```

### Common Causes

- Bad config
- Missing environment file
- Permission problem
- Port already in use
- Dependency unavailable
- Start limit reached

### Commands

```bash
sudo systemctl daemon-reload
sudo systemctl restart SERVICE
sudo systemctl reset-failed SERVICE
```

Use restart carefully if it will drop active traffic.

---

## Port Not Reachable

### Check Listening State

```bash
sudo ss -lntp
curl -v http://localhost:PORT/health
```

### Check Network Path

```bash
ip addr
ip route
nc -vz host PORT
curl -vk https://host
```

### Interpret

| Symptom | Meaning |
|---|---|
| Connection refused | Host reachable, port closed |
| Timeout | Packet drop, firewall, route, or security layer |
| No route to host | Routing problem |
| Local works, remote fails | Firewall, bind address, routing, or load balancer issue |

---

## DNS Failure

### Check

```bash
dig example.com
resolvectl status
cat /etc/resolv.conf
```

### Common Causes

- Wrong resolver
- Search domain issue
- Split-horizon DNS
- Resolver unreachable
- Stale cache
- Record missing

### Response

Validate the resolver path and compare with a healthy host before changing application configuration.

---

## File Descriptor Exhaustion

### Symptoms

- Too many open files
- New connections fail
- Logs show EMFILE

### Check

```bash
ls /proc/PID/fd | wc -l
cat /proc/PID/limits | grep files
sudo lsof -p PID | head
cat /proc/sys/fs/file-nr
```

### Response

- Restart one affected instance if impact is active.
- Increase limits only if the workload needs them.
- Fix descriptor leak if count grows continuously.

---

## Socket State Problems

### Check

```bash
ss -tanp | head
ss -tan state close-wait | head
ss -tan state time-wait | wc -l
```

### Interpret

| State | Meaning |
|---|---|
| SYN-SENT | Waiting for remote response |
| SYN-RECV | Server received SYN and replied |
| ESTABLISHED | Active connection |
| CLOSE-WAIT | App did not close after peer closed |
| TIME-WAIT | Recently closed connection retained |

Many `CLOSE-WAIT` sockets usually point to application connection handling issues.

---

## Permission Denied

### Check

```bash
id username
ls -l file
ls -ld directory
getfacl file
sudo -l
```

### Common Causes

- Wrong owner
- Wrong group
- Missing execute bit on parent directory
- ACL overrides
- SELinux/AppArmor policy
- User session does not include new group membership

### Response

Fix the narrowest permission needed. Avoid broad `chmod 777` as a production shortcut.

---

## Kernel Or Hardware Clues

### Check

```bash
dmesg -T | tail -100
journalctl -k -n 200 --no-pager
journalctl -p err -n 100 --no-pager
```

Look for:

- OOM killer
- I/O errors
- filesystem errors
- blocked task warnings
- network driver resets
- segfaults
- cgroup kill events

Kernel logs often contain evidence missing from application logs.

---

## Safe Mitigation Checklist

Before changing production:

```text
Do I know the scope?
Do I know the resource under pressure?
Can I mitigate one instance before the whole fleet?
Will this destroy evidence?
Is rollback possible?
Who needs to know?
```

Good incident behavior:

- Capture evidence before restart when possible.
- Prefer graceful shutdown.
- Avoid deleting unknown data.
- Mitigate user impact first.
- Write down commands run.
- Follow up with root cause after recovery.

---

## Final Rule

Be precise:

```text
CPU is saturated.
Tasks are blocked in I/O.
Available memory is exhausted.
Disk bytes are full.
Inodes are full.
The service is down.
The port is not listening.
DNS resolution is failing.
The app rolled out but is unhealthy.
```

Each sentence points to a different evidence source and mitigation path.
