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

## Example 4: OOM Killer Restarts A Critical Service

### Scenario

Production service suddenly restarts. Application logs show nothing useful. The service PID changes and the deployment team insists "we did not deploy anything."

### Investigation

```bash
journalctl -k | grep -i oom
dmesg | grep -i 'killed process'
free -h
ps aux --sort=-%mem | head
cat /proc/PID/oom_score
cat /proc/PID/oom_score_adj
```

### Root Cause

The kernel OOM killer terminated the process when memory could not be reclaimed. The OOM score was high because the process had large RSS. No prior warning in application logs — OOM events appear only in kernel logs.

### Full SRE Response

1. Confirm host OOM vs cgroup/container OOM:
   ```bash
   dmesg | grep -E "OOM|oom_kill|Memory cgroup"
   # "Memory cgroup out of memory" = cgroup OOM (container exceeded limit)
   # "Out of memory: Kill process" alone = host OOM
   ```
2. Check memory trend before the event:
   ```bash
   cat /proc/PID/status | grep VmRSS   # for new PID
   watch -n5 "ps -o pid,rss,vsz,cmd -p PID"  # watch for growth
   ```
3. Check cgroup/container memory limit:
   ```bash
   cat /sys/fs/cgroup/<path>/memory.limit_in_bytes
   cat /sys/fs/cgroup/<path>/memory.max    # v2
   ```
4. Protect the service from future OOM by adjusting score:
   ```bash
   echo -500 > /proc/$(pgrep -f myservice)/oom_score_adj
   # Or in systemd unit file:
   # OOMScoreAdjust=-500
   ```
5. Set cgroup memory limit to force OOM before host OOM:
   ```ini
   # In systemd unit:
   MemoryMax=4G
   ```

### Lesson

OOM evidence is in kernel logs, not application logs. Protect critical services with `oom_score_adj`.

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
- App listens on localhost (`127.0.0.1`) only — external traffic cannot reach it.
- Firewall or route blocks remote traffic.
- Health endpoint fails even though process exists.
- Load balancer targets are unhealthy.

### Lesson

Process running is not the same as service healthy.

---

## Example 6: File Descriptor Leak

### Scenario

An API stops accepting new connections. CPU and memory look normal. The process has been running for 3 days.

### Investigation

```bash
ls /proc/PID/fd | wc -l
cat /proc/PID/limits | grep files
sudo lsof -p PID | head
journalctl -u app -n 200 --no-pager
```

### Root Cause

The process exhausted its file descriptor limit due to leaked sockets or files. Each connection creates a socket fd. If `close()` is never called, fds accumulate until the limit is hit.

### Mitigation

- Restart one instance to restore service if user impact is ongoing.
- Increase limit only if the workload legitimately requires it.
- Fix the application leak.
- Add file descriptor monitoring: `ls /proc/PID/fd | wc -l` as a metric.

### Lesson

A service can fail from kernel resource limits even when CPU and memory are fine.

---

## Example 7: iowait Spike Caused Service Degradation

### Scenario

Application P99 latency jumps from 50 ms to 4 seconds. CPU usage is normal. Memory is fine. A noisy-neighbor container on the same node is running a heavy batch job.

### Investigation

```bash
iostat -xz 1 5           # identify which device is saturated and which process
iotop -ao                 # find the top IO-consuming process
pidstat -d 1 5            # per-process IO rates

# Confirm which cgroup the batch job belongs to:
cat /proc/BATCH_PID/cgroup

# Check cgroup IO limits:
cat /sys/fs/cgroup/<path>/io.max     # v2
```

### Root Cause

The batch job has no IO cgroup limits. It saturates the shared NVMe device. The application's writes and reads queue behind batch writes. `w_await` climbs from 0.4 ms to 40 ms.

### Fix With cgroup blkio (Kubernetes)

Add IO limits to the batch pod spec. At the Linux level, cgroup v2 IO limits:

```bash
# Set IO limit: 50 MB/s write on nvme0n1 (major:minor from lsblk)
echo "8:0 wbps=52428800" > /sys/fs/cgroup/<path>/io.max
```

For Kubernetes, use `resources.limits` with storage classes that support IOPs limits, or use node taints to isolate batch workloads.

### Lesson

Noisy-neighbor IO is common in multi-tenant environments. cgroup blkio limits protect latency-sensitive services from batch jobs.

---

## Example 8: Deleted Log File Still Consuming Disk

### Scenario

Log rotation ran. `df -h` shows `/var` still full. The log file `debug.log` no longer appears in `ls /var/log/app/`.

### Investigation

```bash
lsof | grep deleted | awk '{print $1, $2, $7}' | sort -k3 -rn | head
```

Sample output:

```text
logger  18204  8589934592  /var/log/app/debug.log (deleted)
```

The `logger` process (PID 18204) holds an 8 GB deleted file open.

### Fix

```bash
# Option 1: restart the process gracefully
systemctl restart logger

# Option 2: send SIGHUP to reopen files (if supported by the application)
kill -1 18204

# Option 3: truncate through the fd (risky — use only if restart is not possible)
# Find the fd number from lsof output, then:
> /proc/18204/fd/7
```

After fix:

```bash
df -h /var    # space recovered
```

### Prevention

Configure logrotate with `postrotate` to signal the application:

```ini
/var/log/app/*.log {
    daily
    rotate 7
    compress
    postrotate
        systemctl reload logger || true
    endscript
}
```

### Lesson

Log rotation does not free disk until the process reopens the file. Always verify space recovery after rotation.

---

## Example 9: Load Average 80 On 4-CPU Server — All D-State Processes Waiting On Stale NFS

### Scenario

All services on a host become unresponsive. Load average is 80 on a 4-CPU server. CPU usage is 5%. Engineers cannot find a runaway process.

### Investigation

```bash
ps aux | awk '$8 ~ /D/ {print}'
# Output: 60+ processes in D state
```

All are stuck in NFS client calls. The NFS server became unreachable (network partition, server crash).

```bash
findmnt | grep nfs
# Shows NFS mount at /data/shared

# Check NFS stats:
nfsstat -c
mountstats /data/shared

# Check kernel for NFS errors:
dmesg | grep -i "nfs\|sunrpc\|rpc"
```

### Fix

```bash
# Attempt graceful unmount first:
umount /data/shared

# If that hangs (because processes are in D-state holding it):
umount -f /data/shared    # force
umount -l /data/shared    # lazy unmount (detaches from namespace, processes released when done)
```

After unmount, D-state processes wake up and return errors from their NFS calls. The application handles the error and continues.

### Prevention

- Set NFS mount options `soft,timeo=60,retrans=2` to prevent indefinite blocking.
- Monitor NFS latency separately from local disk.
- Add timeouts at the application level for operations on network-backed paths.

### Lesson

NFS stale mounts cause D-state accumulation that is invisible to Kubernetes and application health checks. Forced lazy unmount is the tool.

---

## Example 10: Hardening A Linux Server For Production

### Scenario

A new server is being deployed as a production API node. Standard baseline hardening checklist.

### SSH Hardening

```bash
# /etc/ssh/sshd_config changes:
PermitRootLogin no
PasswordAuthentication no
X11Forwarding no
MaxAuthTries 3
AllowUsers deploy appuser
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

sudo systemctl reload sshd
```

### fail2ban Installation

```bash
sudo apt install fail2ban
# /etc/fail2ban/jail.local:
# [sshd]
# enabled = true
# maxretry = 5
# bantime = 3600
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### auditd For Security Events

```bash
sudo apt install auditd
sudo auditctl -w /etc/passwd -p wa -k passwd_changes
sudo auditctl -w /etc/sudoers -p wa -k sudoers_changes
sudo auditctl -a always,exit -F arch=b64 -S execve -k exec_commands
sudo systemctl enable auditd
ausearch -k passwd_changes    # search audit log
```

### Unattended Upgrades (Security Patches)

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
# /etc/apt/apt.conf.d/50unattended-upgrades:
# Unattended-Upgrade::Allowed-Origins { "Ubuntu:$(lsb_release -cs)-security"; };
# Unattended-Upgrade::Automatic-Reboot "false";
```

### Kernel Parameter Hardening

```bash
# /etc/sysctl.d/99-hardening.conf:
net.ipv4.ip_forward = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.default.accept_redirects = 0
kernel.randomize_va_space = 2
sysctl -p /etc/sysctl.d/99-hardening.conf
```

### Lesson

Production hardening is a checklist, not optional configuration. SSH key-only auth, fail2ban, auditd, and unattended security updates are the baseline.

---

## Example 11: Fleet-Wide Configuration Drift Management

### Scenario

500 Linux servers. Configuration has drifted from the baseline over 18 months. Some have old kernel versions, different sysctl settings, and unauthorized packages.

### Detection

```bash
# Ansible ad-hoc to check kernel version across fleet:
ansible all -m command -a "uname -r" -i inventory.ini

# Check a specific sysctl across fleet:
ansible all -m command -a "sysctl vm.swappiness" -i inventory.ini

# Find hosts with unexpected packages:
ansible all -m shell -a "dpkg -l | grep -E 'netcat|ncat'" -i inventory.ini
```

### Remediation Approach

1. **Ansible playbook for baseline enforcement:**
   ```bash
   ansible-playbook baseline.yml -i inventory.ini --check    # dry run
   ansible-playbook baseline.yml -i inventory.ini            # apply
   ```

2. **Continuous compliance scanning:** Use tools like Ansible Tower, Puppet, Chef, or a policy-as-code tool (InSpec, Open Policy Agent) to scan on a schedule and alert on drift.

3. **Immutable infrastructure:** Where possible, rebuild nodes from base images rather than patching in place. Drift is eliminated by replacement.

### Lesson

Configuration drift is inevitable in large fleets. Detection requires automation. Remediation should be idempotent (safe to run multiple times).

---

## Example 12: systemd Restart Loop

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

## Example 13: DNS Works On One Host But Not Another

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

## Example 14: CLOSE-WAIT Explosion

### Scenario

A service has thousands of `CLOSE-WAIT` sockets.

### Investigation

```bash
ss -tan state close-wait | head
ss -tanp | grep CLOSE-WAIT | head
watch -n2 'ss -tanp | grep -c CLOSE_WAIT'
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

## Staff-Level Summary

Linux incidents often look like application failures at first. The SRE job is to translate symptoms into host evidence: scheduler pressure, memory pressure, disk bytes, inode count, file descriptors, socket states, service logs, kernel logs, and dependency behavior. The best operators collect enough evidence to mitigate safely without destroying the root-cause trail.

Production patterns worth knowing cold:
- OOM is in kernel logs, not application logs.
- Disk full after deletion = open file descriptor.
- High load with low CPU = D-state and I/O wait.
- CPU throttling is invisible to Kubernetes controllers — inspect cgroup `cpu.stat`.
- NFS stale mounts cause D-state accumulation — forced lazy unmount is the fix.
- Fleet drift requires automation; manual audits do not scale.
