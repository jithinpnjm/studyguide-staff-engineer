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

## First 10 Minutes — Full Runbook

### Step 1: Orient (30 seconds)

```bash
hostname       # confirm you are on the right host
date           # is system time correct?
uptime         # load average 1/5/15 min vs nproc
w              # logged-in users and their activity
whoami         # confirm identity
```

Interpret `uptime`: if 1-min load >> 15-min load, problem is recent. If all three are high, it has been sustained. Load consistently above `nproc` = overloaded.

### Step 2: Resource Snapshot (60 seconds)

```bash
free -h                          # available memory (not free)
vmstat 1 5                       # CPU breakdown, swap, IO across 5 samples
df -h                            # bytes per filesystem
df -i                            # inodes per filesystem
```

Do not skip `df -i`. A filesystem at 40% bytes can be 100% inodes.

### Step 3: Deeper Signals (2 minutes)

```bash
top -bn1                         # full CPU breakdown including wa and st
iostat -x 1 3                    # per-device IO: %util, r_await, w_await, aqu-sz
mpstat -P ALL 1 3                # per-CPU breakdown
pidstat -u 1 5                   # per-process CPU with %wait column
```

### Step 4: Network And Services (2 minutes)

```bash
ss -s                            # socket state summary
ss -tulnp                        # listening services with process names
ip addr                          # interface states
ip route                         # routing table
resolvectl status || cat /etc/resolv.conf
```

### Step 5: Errors (1 minute)

```bash
dmesg -T | tail -20              # kernel messages with timestamps
journalctl -n 50 --no-pager      # recent journal
journalctl -p err -n 100 --no-pager  # errors across all services
```

### Step 6: Scope Classification (30 seconds)

```bash
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
systemctl list-units --failed
```

### Interpretation Table

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
| `iostat` | Per-device IO saturation |
| `mpstat` | Per-CPU breakdown |

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

### CPU Steal (st) High In Cloud

`st` (steal) above 5% means the hypervisor is taking CPU cycles from your VM. This appears as "unexplained slowness" — your application's CPUs are not available for the full time slice.

Detection:

```bash
vmstat 1 5       # st column
top              # %st in header
```

Mitigation:
- Move the VM to a different host (stop/start or live migrate).
- Reduce VM density on the hypervisor host.
- Move to a dedicated tenancy instance type if available.
- Alert on sustained `st > 3%`.

### Safe Response

Prefer graceful process restart, scaling out, or load shedding before force-killing critical processes.

---

## Memory Pressure Triage

### OOM vs Swap Saturation vs Cache Eviction — How To Tell Them Apart

**OOM Kill:**
- Evidence: `dmesg | grep "Out of memory"` or `dmesg | grep "killed process"`.
- Process terminated by kernel.
- Memory `available` was near zero.
- Systemd may auto-restart the service.

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

**Swap Saturation:**
- Evidence: `vmstat 1 5` shows nonzero `si` (swap in) and `so` (swap out).
- Active swapping causes latency spikes. Not an OOM event.
- `free -h` shows swap used.

```bash
vmstat 1 5        # si/so columns
cat /proc/meminfo | grep Swap
```

**Cache Eviction:**
- Evidence: `available` memory is dropping but no OOM yet. Page cache (`Cached` in `/proc/meminfo`) is shrinking.
- Kernel is evicting cache to serve application allocations.
- Leads to higher disk I/O as previously-cached reads now hit the device.

```bash
cat /proc/meminfo | grep -E 'MemAvailable|Cached|Active|Inactive'
sar -B 1 5        # paging rate
```

**Direct Reclaim (pre-OOM latency spikes):**
- Evidence: P99 latency spikes without OOM. `pgmajfault` counter climbing.
- Allocation is blocking in the kernel while pages are reclaimed.

```bash
cat /proc/vmstat | grep pgmajfault
sar -B 1 5
```

### Check

```bash
free -h
vmstat 1 5
ps aux --sort=-%mem | head
cat /proc/meminfo | grep -E 'MemAvailable|Cached|Swap'
```

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
- Docker image layers (each file = one inode)
- Bad cache cleanup
- Mail spool growth
- Session files
- Exploded log shards

### Response

Remove safe generated files, fix cleanup logic, and add inode alerts.

```bash
docker system prune -f                              # reclaim Docker inodes
find /var/spool/postfix/deferred -mtime +3 -delete  # purge old mail queue
find /tmp -maxdepth 1 -mtime +1 -delete
```

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
sudo systemctl reset-failed SERVICE    # clear start-limit-hit before restart
```

Use restart carefully if it will drop active traffic.

---

## systemd Unit File Debugging — Anatomy

Reading `systemctl status` output:

```text
● appserver.service - Application Server
   Loaded: loaded (/etc/systemd/system/appserver.service; enabled; vendor preset: enabled)
   Active: failed (Result: exit-code) since Wed 2026-04-09 23:06:41 UTC; 3min 42s ago
  Process: 28914 ExecStart=/usr/bin/appserver --config /etc/appserver/config.yaml
           (code=exited, status=1/FAILURE)
     CPU: 412ms

Apr 09 23:06:41 app-worker-02 appserver[28914]: FATAL: cannot open config file: no such file
```

Key fields:
- `Loaded` + `enabled`: unit file found, will start on boot.
- `Active: failed (Result: exit-code)`: nonzero exit.
- `status=1/FAILURE`: application error code.
- `status=137`: SIGKILL (128+9), likely OOM.
- `status=139`: SIGSEGV (128+11), segfault.
- Last log lines embedded in status — often the root cause.

### ExecStartPre Failures

If `ExecStartPre=` fails, systemd does not run `ExecStart`. Check both:

```bash
journalctl -u SERVICE -n 100 --no-pager
systemctl show SERVICE --property=ExecStartPre
```

### Dependency Ordering

```bash
systemctl list-dependencies SERVICE          # what this service needs
systemctl show SERVICE --property=After,Requires,Wants,BindsTo
```

Difference:
- `Requires=`: if dependency fails, this service fails.
- `Wants=`: if dependency fails, this service starts anyway.
- `After=`: start order, not dependency strength.

---

## Port Not Reachable

### Check Listening State

```bash
sudo ss -lntp
sudo ss -lntp | grep :8080
curl -v http://localhost:PORT/health
```

### Check Bind Address

```bash
ss -lntp | grep :8080
# 127.0.0.1:8080 = loopback only, external cannot reach
# 0.0.0.0:8080 = all interfaces, external can reach
```

### Check Network Path

```bash
ip addr
ip route
nc -vz host PORT
curl -vk https://host
```

### Check Firewall

```bash
iptables-save | grep -E "DROP|REJECT|PORT"
nft list ruleset | grep -E "drop|reject"
```

### Interpret

| Symptom | Meaning |
|---|---|
| Connection refused | Host reachable, port closed |
| Timeout | Packet drop, firewall, route, or security layer |
| No route to host | Routing problem |
| Local works, remote fails | Firewall, bind address, routing, or load balancer issue |

### "Connection Refused" vs "Connection Timed Out" — TCP Level

**Connection refused:** Host received the SYN. Kernel replied with RST+ACK immediately. Nothing listening on that port, or connection was explicitly rejected. Occurs in milliseconds.

**Connection timed out:** SYN sent, no response. Packet was dropped by a firewall, routing issue, or host unreachable. Occurs after 30 seconds to 2+ minutes of retransmission.

---

## DNS Failure

### Check

```bash
dig example.com
dig @8.8.8.8 example.com    # test against specific resolver
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
- CoreDNS throttled in Kubernetes

### Response

Validate the resolver path and compare with a healthy host before changing application configuration.

---

## Zombie Processes

### What They Are

A zombie is a process that has exited but whose parent has not yet called `wait()` to collect the exit status. The process entry remains in the process table, consuming a PID.

```bash
ps aux | awk '$8 == "Z" {print}'
ps aux | grep -w Z
```

### Why They Matter

Zombies do not consume CPU or memory. They consume PIDs. On systems with tight PID limits (`/proc/sys/kernel/pid_max`), zombie accumulation can prevent new processes from starting.

### Root Cause

The parent process is not handling `SIGCHLD` (sent when a child exits). Common causes:
- Parent process is hung or deadlocked.
- Container PID 1 is not a proper init process (does not reap children).
- Bug in parent's signal handling code.

### Fix

```bash
# Identify the parent:
ps -o ppid= -p ZOMBIE_PID

# If parent is hung: restart or fix parent
# If parent is a container with no init: use --init flag or tini
# If parent is still healthy: it will reap when it gets to it
```

### SIGCHLD And Zombie Reaping In Containers

PID 1 in Linux has special responsibility: it reaps orphan zombies. If you run an application directly as PID 1 in a container without proper signal handling:

```bash
# Bad: java becomes PID 1 and does not reap zombies
ENTRYPOINT ["java", "-jar", "app.jar"]

# Better: use tini as PID 1 init
ENTRYPOINT ["/tini", "--", "java", "-jar", "app.jar"]

# Docker --init flag:
docker run --init myimage
```

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

## NFS Stale Mount Causing D-State Processes

### Symptoms

- Load average spikes.
- Many processes in D-state.
- CPU is low.
- `ps aux | awk '$8 ~ /D/ {print}'` shows many processes.
- All blocked processes have NFS-backed paths open.

### Detection

```bash
ps aux | awk '$8 ~ /D/ {print}'
findmnt | grep nfs
dmesg | grep -i "nfs\|sunrpc\|rpc\|stale"
nfsstat -c
```

### Fix

```bash
umount /nfs-mount               # graceful attempt
umount -f /nfs-mount             # force
umount -l /nfs-mount             # lazy (detach from namespace, processes released when done)
```

Lazy unmount (`-l`) is the safer option when processes are stuck — it detaches the mount from the namespace immediately and allows processes to return errors rather than hanging indefinitely.

### Prevention

Mount NFS with timeout options:

```bash
mount -t nfs -o soft,timeo=60,retrans=2 server:/export /mnt/data
```

Add to `/etc/fstab`:

```text
server:/export  /mnt/data  nfs4  soft,timeo=60,retrans=2  0  0
```

---

## LVM — Common Admin Tasks

```bash
# Show LVM status:
pvs                                  # physical volumes
vgs                                  # volume groups
lvs                                  # logical volumes
lvdisplay /dev/vg0/lv0

# Extend a logical volume (online, no unmount needed with ext4/xfs):
lvextend -L +10G /dev/vg0/lv0       # add 10 GB
lvextend -l +100%FREE /dev/vg0/lv0  # use all free space
resize2fs /dev/vg0/lv0              # resize ext4 filesystem
xfs_growfs /mountpoint              # resize XFS filesystem (must be mounted)

# Create a snapshot:
lvcreate -L 5G -s -n lv0-snap /dev/vg0/lv0

# Add a physical volume:
pvcreate /dev/sdb
vgextend vg0 /dev/sdb
```

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
namei -l /path/to/file
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

- OOM killer: `Out of memory: Kill process`
- I/O errors: `blk_update_request: I/O error`, `end_request: I/O error`
- Filesystem errors: `EXT4-fs error`, `XFS: xfs_log_force`
- Blocked task warnings: `task blocked for more than 120 seconds`
- Network driver resets: `eth0: reset adapter`
- Segfaults: `segfault at ... error 4`
- cgroup kill events: `Memory cgroup out of memory`

Kernel logs often contain evidence missing from application logs.

---

## All Troubleshooting Scenarios From Debug Playbook

### Symptom: Host Slow

```bash
uptime
vmstat 1 5
free -h
iostat -xz 1 5
ps aux --sort=-%cpu | head
```

Decision tree:
- CPU high: `ps aux --sort=-%cpu`, `pidstat`, `perf top`
- IO wait high: `iostat`, `iotop`, `lsof +D`
- Swap active: memory pressure, `ps aux --sort=-%mem`
- Load high, CPU low: D-state, `ps aux | awk '$8 ~ /D/'`

### Symptom: Service Running But Unreachable

```bash
systemctl status SERVICE
ss -lntp | grep :PORT
curl -v http://127.0.0.1:PORT
curl -v http://HOST_IP:PORT
journalctl -u SERVICE -n 100 --no-pager
ip route
iptables-save | head
```

Interpretation:
- Listening on `127.0.0.1`: remote clients cannot connect.
- Wrong port: Service/LB config may be wrong.
- Local curl works but remote fails: network/firewall/routing issue.

### Symptom: SSH Slow

```bash
time ssh -vvv user@host
dig host
journalctl -u sshd -n 100
vmstat 1 5
```

### Symptom: New Connections Fail

```bash
ss -s
conntrack -S
cat /proc/sys/net/netfilter/nf_conntrack_count
cat /proc/sys/net/netfilter/nf_conntrack_max
netstat -s | grep -i retrans
```

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

Prefer reversible actions:
- Rollback recent deploy.
- Rotate/truncate log safely.
- Restart one instance behind load balancer.
- Increase capacity temporarily.
- Remove bad node from rotation.

Risky (avoid unless necessary):
- `kill -9` without context.
- Deleting unknown files.
- Changing permissions broadly.
- Rebooting before collecting evidence.
- Editing config without backup.

---

## Kubernetes Node Triage

When a Kubernetes node is unhealthy, Linux symptoms manifest as cluster symptoms. Start with the Linux host first, then connect to cluster signals.

```bash
systemctl status kubelet              # is kubelet running?
journalctl -u kubelet -n 200 --no-pager  # kubelet errors
crictl ps -a                          # all containers including exited
crictl logs CONTAINER_ID              # container output
df -h                                 # disk pressure evicts pods
df -i                                 # inode exhaustion fails image pulls
conntrack -S                          # conntrack table state
```

Node issues that appear as cluster symptoms:

| Node symptom | Cluster impact |
|---|---|
| `kubelet` stopped | Node NotReady, pods evicted |
| Disk full (bytes) | `DiskPressure`, pod evictions |
| Disk full (inodes) | ImagePullBackOff, failed writes |
| conntrack full | New pod connections silently dropped |
| CNI misconfigured | Pods stuck in ContainerCreating |
| Container runtime crash | Pods fail to start, crictl shows no containers |

Useful `crictl` commands:

```bash
crictl images                        # locally cached images
crictl ps -a | grep Exited           # recently exited containers
crictl inspect CONTAINER_ID          # detailed container state
crictl stopp POD_ID && crictl rmp POD_ID  # force-remove a stuck pod sandbox
```

---

## Command Interpretation Table

Use this table to quickly answer: "what does this command tell me?" and "what is a bad sign?"

| Command | Answers | Bad signs |
|---|---|---|
| `uptime` | Load trend (1/5/15 min vs nproc) | 1m load much higher than 15m |
| `vmstat 1 5` | CPU run queue, blocked tasks, IO wait | High `wa` (IO wait), high `b` (blocked), swap `si`/`so` |
| `free -h` | Memory availability and swap | Low `available`, nonzero swap usage |
| `iostat -xz 1 5` | Per-device IO latency and throughput | High `await` or `%util` approaching 100% |
| `df -h` | Disk byte usage per filesystem | Filesystem at 95%+ |
| `df -i` | Inode usage per filesystem | Inode at 90%+ |
| `ss -s` | Socket state summary | Huge CLOSE_WAIT or TIME_WAIT counts |
| `lsof +L1` | Deleted files still held open | Large deleted files consuming disk space |
| `journalctl -p err` | Recent service and kernel errors | Repeated failures from same service |
| `strace -p PID` | System calls a process is making | Stuck in `connect`, `futex`, `read`, or repeated `EACCES` |
| `conntrack -S` | Conntrack table saturation | Count near max; new connections dropped |
| `dmesg \| tail` | Kernel messages and hardware events | OOM kills, disk errors, NIC resets |
| `pidstat -u 1 5` | Per-process CPU breakdown | One process consuming >90% CPU |

---

## Real Incident Stories

### Disk Still Full After Log Cleanup

**Symptom:** `df -h` shows 100% even after `rm -rf /var/log/app/*.log`.

**Cause:** The running service still has the deleted file open. The kernel keeps the inode (and the disk blocks) until the last open file descriptor is closed.

**Diagnosis:**

```bash
lsof +L1   # shows files deleted but still held open, with disk usage
```

**Fix:** Restart or reload the owning service to close the file descriptor. Use `> /var/log/app/app.log` to truncate in-place if restarting is not immediately possible.

---

### Load Average 40, CPU 10%

**Symptom:** `uptime` shows load 40 on a 16-core host. `vmstat` shows CPU mostly idle but `b` column is high.

**Cause:** Tasks are blocked in uninterruptible sleep (D-state) — typically on disk I/O, NFS, or a stuck storage driver.

**Diagnosis:**

```bash
vmstat 1 5          # high b (blocked) and wa (IO wait)
ps aux | awk '$8 ~ /D/ {print}'   # list D-state processes
iostat -xz 1 5      # disk await/util — high values confirm storage bottleneck
```

**Fix:** Identify the storage or NFS dependency causing the block. Resolve the storage issue; `kill -9` on D-state processes does nothing until the block clears.

---

### Service Flapping (Repeated Restarts)

**Symptom:** Service is up briefly then down again. `systemctl status` shows restart cycles.

**Diagnosis:**

```bash
systemctl status SERVICE
journalctl -u SERVICE -n 200 --no-pager
```

**Common Causes:**
- Missing env var or config file on startup
- Port already in use
- Dependency unavailable (DB, API)
- Crash on startup after a bad deploy

**Fix:** Read the exit reason from `journalctl`. Address the root cause — do not just increase `RestartSec`.

---

### One Kubernetes Node Has Failures

**Symptom:** Pods on one node are failing. Other nodes are healthy.

**Cause candidates:**

| Candidate | Evidence |
|---|---|
| kubelet sick | `systemctl status kubelet` shows errors |
| CNI issue | `journalctl -u kubelet` shows network setup failures |
| Disk pressure | `df -h` / `df -i` shows full filesystem |
| conntrack exhaustion | `conntrack -S` count near max |
| Container runtime crash | `crictl ps -a` shows no containers, runtime errors in journal |

**Sequence:**

```bash
systemctl status kubelet
journalctl -u kubelet -n 200
df -h && df -i
conntrack -S
crictl ps -a
```

Resolve the Linux layer first; the Kubernetes symptom will clear once the node is healthy.

---

## Senior Answer Shape

When asked how you troubleshoot a Linux host:

> I classify the symptom as process-local, host-wide, network, storage, memory, or dependency-related. I take a quick evidence snapshot: `uptime`, `vmstat`, `free -h`, `df -h/-i`, `iostat`, `ss -s`, top processes by CPU and memory, and recent errors from `journalctl` and `dmesg`. I interpret before acting — high load with low CPU points to blocked work, disk full may be inodes or deleted-open files, and service reachability must separate listening, routing, DNS, and policy. I prefer reversible mitigations, preserve evidence before restart, and follow up with root cause after recovery.

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
