---
title: "Linux Debug Playbook Zero To Hero"
sidebar_position: 5
---

# Linux Debug Playbook Zero To Hero

This playbook is for production days when a Linux host, service, node, or dependency is unhealthy and you need to reduce uncertainty fast.

The goal is not to memorize commands. The goal is to classify symptoms, collect evidence, interpret signals, and choose safe mitigations.

This guide is designed as a complete path:

- Beginner: where to start and what commands mean
- Intermediate: CPU, memory, disk, process, network, and log debugging
- Advanced: D-state, IO wait, OOM, deleted-open files, syscalls, conntrack, cgroups
- SRE Level: 10-minute triage, incident scenarios, mitigation discipline
- Interview Level: explain troubleshooting like a senior operator

---

# Part 1: Debugging Mindset

Before touching the system, ask:

1. What exactly is failing?
2. Who is impacted?
3. When did it start?
4. What changed?
5. Is this host-wide, service-specific, or dependency-related?

Senior rule:

> Observe before changing. Mitigate before perfect root cause when users are impacted.

---

# Part 2: The First 60 Seconds

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

# Part 3: The 10-Minute Triage Routine

## 1. Classify Scope

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

## 2. Check CPU / Memory / IO

```bash
vmstat 1 5
iostat -xz 1 5
pidstat 1 5
```

## 3. Check Disk

```bash
df -h
df -i
du -sh /var/* | sort -rh | head
lsof +L1
```

## 4. Check Network

```bash
ip addr
ip route
ss -lntp
ss -tanp | head
resolvectl status
dig example.com
```

## 5. Check Errors

```bash
journalctl -u SERVICE -n 200 --no-pager
journalctl -p err -n 100 --no-pager
dmesg | tail -100
```

---

# Part 4: CPU And Load Debugging

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

## High Load, High CPU

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

## High Load, Low CPU

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

# Part 5: Memory Debugging

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

## OOM Investigation

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

## Memory Leak Pattern

```bash
watch -n 5 "ps -o pid,rss,vsz,cmd -p PID"
cat /proc/PID/status | grep -E 'VmRSS|VmSize|Threads'
```

Growing RSS over time may indicate leak.

---

# Part 6: Disk And Filesystem Debugging

## Disk Full

```bash
df -h
du -sh /var/* | sort -rh | head
find / -xdev -size +1G -ls 2>/dev/null
```

## Inodes Full

```bash
df -i
find / -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head
```

## Deleted But Still Open

```bash
lsof +L1
```

If a deleted log is still open, restart or reload the owning process safely.

## IO Latency

```bash
iostat -xz 1 5
pidstat -d 1 5
```

Look at:

- `await`
- `%util`
- read/write throughput

---

# Part 7: Process Debugging

```bash
ps aux
pgrep -af SERVICE
top
lsof -p PID
cat /proc/PID/status
```

## Signals

```bash
kill -15 PID   # graceful
kill -9 PID    # force, last resort
```

## strace

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

# Part 8: Network Debugging

## Local Listening

```bash
ss -lntp
lsof -i :PORT
```

## Connectivity

```bash
curl -vk https://host/path
nc -vz host 443
ping -c 5 host
tracepath host
```

## DNS

```bash
dig host
getent hosts host
resolvectl status
```

## TCP State

```bash
ss -tanp
ss -s
```

## Conntrack

```bash
conntrack -S
sysctl net.netfilter.nf_conntrack_max
```

New connections failing while old ones work can mean conntrack/NAT exhaustion.

---

# Part 9: Logs And Time Correlation

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

# Part 10: Kubernetes Node Connection

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

# Part 11: Troubleshooting By Symptom

## Host Slow

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

## Disk Full

```bash
df -h
df -i
du -sh /var/* | sort -rh | head
lsof +L1
```

## Service Running But Unreachable

```bash
systemctl status SERVICE
ss -lntp
curl -v localhost:PORT
ip route
iptables-save | head
```

## SSH Slow

```bash
time ssh -vvv user@host
dig host
journalctl -u sshd -n 100
vmstat 1 5
```

## New Connections Fail

```bash
ss -s
conntrack -S
netstat -s | grep -i retrans
```

---

# Part 12: Safe Mitigation Rules

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

# Part 13: Real Incident Stories

## Disk Still Full After Cleanup

Cause:

- deleted file still open

Fix:

```bash
lsof +L1
systemctl restart owning-service
```

## Load 40, CPU 10%

Cause:

- IO wait / D-state

Fix:

- inspect disk/NFS/storage
- identify blocked process
- resolve storage dependency

## Service Flapping

Cause:

- systemd restart loop

Check:

```bash
systemctl status SERVICE
journalctl -u SERVICE -n 200
```

## One Kubernetes Node Has Failures

Cause candidates:

- kubelet sick
- CNI issue
- disk pressure
- conntrack exhaustion

---

# Part 14: Command Interpretation Table

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

# Part 15: Labs

## Beginner

- fill a temp directory and recover
- find top CPU process
- inspect service logs

## Intermediate

- simulate deleted-open file
- create service listening on localhost only
- debug DNS failure

## Advanced

- simulate IO wait
- inspect D-state behavior conceptually
- trace a process with strace
- inspect conntrack counters

---

# Part 16: Interview Questions

- High load but low CPU — what does it mean?
- Disk full after deleting logs — why?
- What does `available` memory mean?
- How do you debug a service running but unreachable?
- When is `kill -9` acceptable?
- How do Linux node issues affect Kubernetes Pods?

---

# Part 17: Senior Answer Shape

> I first classify the symptom as process-local, host-wide, network, storage, memory, or dependency-related. Then I take a quick evidence snapshot with uptime, vmstat, free, df, iostat, ss, top processes, and recent logs. I interpret before acting: high load with low CPU points to blocked work, disk full may be inode or deleted-open files, and service reachability must separate listening, routing, DNS, and policy. I prefer reversible mitigations and preserve evidence for root cause.

---

# Recall Prompts

- Why can load be high while CPU is low?
- What does `lsof +L1` reveal?
- Why does active swap hurt latency?
- What does `strace -T` add?
- Why should mitigation be reversible?
