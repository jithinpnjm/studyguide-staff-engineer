---
title: "Real-World Examples"
sidebar_position: 7
---

# Linux & Systems — Real-World Examples

These examples show how Linux issues appear during real production incidents and how an SRE should reason about them.

---

## Example 1: High Load, Low CPU

### Scenario

A Kubernetes node shows load average above 80, but CPU usage is only 20%. Applications on the node are slow.

### Investigation

```bash
uptime
vmstat 1 5
ps aux | awk '$8 ~ /D/ {print}'
iostat -xz 1 5
```

### Likely Cause

Processes are blocked in uninterruptible sleep, often waiting for disk or network storage. Load average includes D-state tasks, so CPU can look low while load is high.

### Mitigation

- Identify the blocked process group.
- Check disk or network storage health.
- Move workloads away from the node if it is a Kubernetes worker.
- Avoid repeated `kill -9`; D-state usually will not respond until the kernel call returns.

### Lesson

High load is not always CPU saturation.

---

## Example 2: Disk Full After Log Deletion

### Scenario

`df -h` shows `/var` is full. An engineer deletes a 20 GB log file, but disk usage does not drop.

### Investigation

```bash
df -h
sudo lsof +L1
```

### Root Cause

A process still holds the deleted file open. The directory entry is gone, but disk blocks remain allocated until the file descriptor closes.

### Mitigation

- Restart or reload the owning service safely.
- Fix logrotate to signal the service after rotation.
- Prefer stdout/stderr log collection in containers.

### Lesson

Deleting a file is not always enough. Open file descriptors matter.

---

## Example 3: Inodes Full But Disk Space Available

### Scenario

A service cannot create new files. `df -h` shows only 60% disk usage.

### Investigation

```bash
df -i
sudo find / -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head
```

### Root Cause

The filesystem ran out of inodes because a job created millions of tiny files.

### Mitigation

- Remove safe temporary files.
- Fix the job to batch, compact, or clean files.
- Alert on inode usage, not only byte usage.

### Lesson

Filesystems can fail by metadata exhaustion, not only storage bytes.

---

## Example 4: OOM Killer Restarts A Critical Process

### Scenario

A service suddenly restarts. Application logs show nothing useful.

### Investigation

```bash
journalctl -k | grep -i oom
dmesg | grep -i 'killed process'
free -h
ps aux --sort=-%mem | head
```

### Root Cause

The kernel OOM killer terminated the process when memory could not be reclaimed.

### SRE Response

- Confirm whether it was host OOM or cgroup/container OOM.
- Check memory usage trend before the event.
- Check recent deploy or traffic increase.
- Review limits, requests, memory leak possibility, and host density.

### Lesson

OOM evidence is often in kernel logs, not application logs.

---

## Example 5: Service Running But Not Reachable

### Scenario

`systemctl status app` says the service is running, but users receive connection errors.

### Investigation

```bash
systemctl status app
journalctl -u app -n 200 --no-pager
ss -lntp
curl -v http://localhost:8080/health
ip route
```

### Possible Causes

- App is running but not listening on expected port.
- App listens on localhost only.
- Firewall or route blocks remote traffic.
- Health endpoint fails even though process exists.
- Load balancer targets are unhealthy.

### Lesson

Process running is not the same as service healthy.

---

## Example 6: File Descriptor Leak

### Scenario

An API stops accepting new connections. CPU and memory look normal.

### Investigation

```bash
ls /proc/PID/fd | wc -l
cat /proc/PID/limits | grep files
sudo lsof -p PID | head
journalctl -u app -n 200 --no-pager
```

### Root Cause

The process exhausted its file descriptor limit due to leaked sockets or files.

### Mitigation

- Restart instance to restore service if user impact is ongoing.
- Increase limit only if workload legitimately requires it.
- Fix the application leak.
- Add file descriptor monitoring.

### Lesson

A service can fail from kernel resource limits even when CPU and memory are fine.

---

## Example 7: DNS Works On One Host But Not Another

### Scenario

One host can reach an internal service; another cannot resolve it.

### Investigation

```bash
cat /etc/resolv.conf
resolvectl status
dig service.internal
ip route
```

### Possible Causes

- Different resolver configuration
- Split-horizon DNS
- Wrong search domain
- Network path to resolver blocked
- Stale local DNS cache

### Lesson

DNS is part of runtime infrastructure. Treat resolver configuration as production config.

---

## Example 8: CLOSE-WAIT Explosion

### Scenario

A service has thousands of `CLOSE-WAIT` sockets.

### Investigation

```bash
ss -tan state close-wait | head
ss -tanp | grep CLOSE-WAIT | head
```

### Root Cause

The peer closed the connection, but the local application did not close its side. This is commonly an application bug or connection lifecycle leak.

### Mitigation

- Restart affected process if impact is ongoing.
- Capture evidence for application team.
- Add socket-state monitoring.
- Fix connection handling in code.

### Lesson

Socket states reveal application behavior.

---

## Example 9: systemd Restart Loop

### Scenario

A service keeps restarting and eventually systemd stops trying.

### Investigation

```bash
systemctl status app
systemctl show app | grep -E 'Restart|StartLimit|NRestarts'
journalctl -u app -n 200 --no-pager
systemctl cat app
```

### Possible Causes

- Bad environment file
- Missing binary or path
- Port already in use
- Permission problem
- App exits quickly
- Start limit reached

### Lesson

systemd is not only a process launcher. It has restart policy, limits, dependencies, and cgroup controls.

---

## Example 10: Slow Host After Log Volume Spike

### Scenario

A host becomes slow after a deployment. CPU is not high, but requests are timing out.

### Investigation

```bash
vmstat 1 5
iostat -xz 1 5
pidstat -d 1 5
sudo du -sh /var/log/* | sort -rh | head
```

### Root Cause

New debug logging creates heavy disk write pressure. Application latency increases due to I/O wait.

### Mitigation

- Reduce log verbosity.
- Move logs to stdout collector or separate disk.
- Apply rate limiting or sampling.
- Alert on I/O wait and log volume.

### Lesson

Observability can become the incident if volume is uncontrolled.

---

## Staff-Level Summary

Linux incidents often look like application failures at first. The SRE job is to translate symptoms into host evidence: scheduler pressure, memory pressure, disk bytes, inode count, file descriptors, socket states, service logs, kernel logs, and dependency behavior. The best operators collect enough evidence to mitigate safely without destroying the root-cause trail.
