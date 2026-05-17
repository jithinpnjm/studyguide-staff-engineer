---
title: "Hands-On Labs"
sidebar_position: 5
---

# Linux & Systems — Hands-On Labs

These labs build production-debugging muscle memory. Run them on a disposable VM, local Linux machine, or container where safe. Repeat each lab until you can complete the beginner steps from memory in under 8 minutes.

---

## Lab 1: First 60 Seconds Host Snapshot

**Goal:** Build a repeatable first-response routine.

Run:

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

Write down:

| Signal | Observation |
|---|---|
| Load average |  |
| Memory available |  |
| Swap activity |  |
| Disk usage |  |
| Inode usage |  |
| Socket summary |  |
| Recent errors |  |

**Expected learning:** classify a host as CPU-bound, memory-bound, disk-bound, network-bound, service-specific, or unknown within a few minutes.

---

## SRE Lab 1: First 10 Minutes On A "Slow Host" (Full Triage Drill)

**Source:** linux/lab-01-host-triage.md

**Why this matters:** You get paged at 2 AM. "Host latency elevated." No stack trace. The first 10 minutes either converge on a hypothesis or you thrash. Every experienced SRE has a repeatable triage sequence burned into muscle memory.

**Prerequisites:** Comfortable reading process lists and file sizes. Knows what load average is.

**Time estimate:** 45 minutes first pass. Repeat until beginner steps take under 8 minutes.

### Step 1 — Get Initial Signal: uptime

```bash
$ uptime
 14:32:17 up 47 days,  3:12,  2 users,  load average: 18.43, 16.91, 14.22
```

Load average is jobs waiting for CPU or disk, averaged over 1, 5, and 15 minutes. Compare to `nproc`. On a 4-core host, load 18.43 means roughly 4.6x overloaded.

Bad looks like: 1-min load >> 15-min load (sudden spike). All three near or above `nproc` (sustained overload).

### Step 2 — Who Is On: w

```bash
$ w
USER     TTY      FROM             LOGIN@   IDLE JCPU   PCPU WHAT
jithin   pts/0    10.0.0.5         14:30    0.00s  0.03s  0.01s w
deploy   pts/1    10.0.0.12        14:28    2:01   1.24s  0.00s /bin/sh /opt/deploy.sh
```

Is anyone running a deploy or backup script that explains the load?

### Step 3 — Interactive Process View: top

```bash
$ top
%Cpu(s): 12.4 us,  2.1 sy,  0.0 ni, 14.3 id, 68.7 wa,  0.0 hi,  2.5 si,  0.0 st
```

Critical fields:
- `wa` 68.7%: the smoking gun. CPUs are waiting for disk.
- `id` 14.3%: almost no free CPU despite `us` being only 12.4%.
- `D` in STAT column: processes in uninterruptible sleep (waiting on disk).
- Swap used: active swapping compounds disk pressure.

### Step 4 — Memory Detail: free -m

```bash
$ free -m
               total        used        free      shared  buff/cache   available
Mem:           64042       58901         412        1084        4728        1141
```

`available` 1141 MB on a 64 GB host = under 2%. System will thrash swap.

### Step 5 — Confirm IO Pressure: vmstat 1 5

```bash
$ vmstat 1 5
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 3  8 2139648 422948 ... 1024 4096 98304 91136 ... 12  2 14 69  0
```

Key readings:
- `b` column 7-9: many blocked processes.
- `si`/`so` nonzero and climbing: active memory pressure.
- `bi`/`bo` 98304 blocks/s: ~48 MB/s read + ~44 MB/s write.

### Step 6 — Confirm Disk Saturation: iostat -xz 1 3

```bash
$ iostat -xz 1 3
Device            r/s     w/s   r_await w_await aqu-sz  %util
nvme0n1          312.4   287.1    8.42   12.17    4.82  98.4
```

- `%util` 98.4%: device fully saturated.
- `r_await`/`w_await` 8-12 ms on NVMe: 8-12x above normal (normal < 1 ms).
- `aqu-sz` 4.82: nearly 5 requests stacked up.

### Step 7 — Check Error Logs: journalctl -p err -n 30

```bash
$ journalctl -p err -n 30
kernel: EXT4-fs error (device nvme0n1p1): ext4_find_entry
kernel: INFO: task appserver:17842 blocked for more than 120 seconds.
```

Kernel logging EXT4 errors and 120-second blocked task: hardware or filesystem-level problem. The application is a victim, not the cause.

### Intermediate Analysis

After the guided walk-through, run these without explanation and write one sentence about each:

```bash
ps aux --sort=-%cpu | head -15
ps aux --sort=-%mem | head -15
ss -tanp | grep -c CLOSE_WAIT
df -h
df -i
```

### Advanced: Filesystem Error Triage

```bash
dmesg | grep -E "EXT4|I/O error|blk_update_request" | tail -20
smartctl -a /dev/nvme0n1
lsof +D /data/appserver 2>/dev/null | head -20
fuser -v /data/appserver
```

If `smartctl` shows reallocated sectors or pending uncorrectable errors: hardware failure, escalate to infra team.

### Common Mistakes

- Looking at CPU first when `wa` is the signal.
- Trusting load average alone.
- Ignoring swap activity.
- Not reading the `D` state.
- Rebooting before checking SMART.

---

## SRE Lab 2: Filesystem And IO Pressure

**Source:** linux/lab-02-filesystem-and-io.md

**Why this matters:** "Disk write timeout" with `df -h` showing 40% used is one of the most confusing alerts. Write failures happen when the device is saturated, inodes are exhausted, the filesystem is read-only due to corruption, or storage is network-attached and the network is degraded. None of these show up in `df -h` alone.

### Step 1 — Bytes First: df -h

```bash
$ df -h
/dev/nvme0n1p2  500G  487G   13G  97% /var
overlay         500G  487G   13G  97% /var/lib/docker/overlay2/...
```

`/var` at 97%. Docker overlay shares the same underlying device.

### Step 2 — Inodes: df -i

```bash
$ df -i
/dev/nvme0n1p2 32505856 32505841      15    100% /var
```

100% inodes with 15 free. No new files can be created even though 13 GB bytes remain.

Finding the culprit:

```bash
for dir in /var/*/; do echo "$(find "$dir" -xdev | wc -l) $dir"; done | sort -n | tail -10
```

### Step 3 — Mount State: findmnt

```bash
$ findmnt
├─/var   /dev/nvme0n1p2 ext4  ro,relatime,errors=remount-ro
```

`ro` = filesystem silently remounted read-only after an error. Every write fails. `df -h` still shows capacity as if nothing is wrong.

### Step 4 — IO Latency: iostat -xz 1 5

```bash
$ iostat -xz 1 5
Device            r/s     w/s   r_await w_await aqu-sz  %util
nvme0n1          31.2   891.4     0.41   18.74    3.84  88.1   # sample 2
nvme0n1          29.8  1042.1     0.39   24.13    4.97  96.8   # sample 3
```

`%util` went from 8% to 97% in two seconds. `w_await` climbed from 0.42 to 24 ms. This is a write storm.

### Step 5 — Large Consumers: du -sh

```bash
$ du -sh /var/log/appserver/debug.log
8.7G    /var/log/appserver/debug.log
```

8.7 GB debug log growing continuously.

Safe truncation (preserves open file descriptor):

```bash
> /var/log/appserver/debug.log
```

Never `rm` a file held open by a live process. The inode stays allocated until the fd closes.

### Step 6 — Block Device Layout: lsblk

```bash
$ lsblk
nvme0n1     disk
├─nvme0n1p1 part /
└─nvme0n1p2 part /var
```

Two partitions: `/var` is separate from `/`. Problems on `/var` are invisible when checking `/` usage.

### Recovery For Inode Exhaustion

```bash
# Confirm and quantify:
df -i /var

# Find top inode consumers:
find /var -xdev -printf '%h\n' | sort | uniq -c | sort -rn | head -20

# Prune safely:
docker system prune -f                               # remove unused images/build cache
find /var/spool/postfix/deferred -mtime +3 -delete  # purge old mail queue

# Verify recovery:
df -i /var

# Remount read-write after confirming no new errors:
dmesg | grep "EXT4-fs error" | tail -5
mount -o remount,rw /var
```

---

## SRE Lab 3: Processes, cgroups, And Namespaces

**Source:** linux/lab-03-processes-cgroups-namespaces.md

**Why this matters:** Kubernetes says the pod is Running. The application is slow. You SSH to the node and find nothing obviously wrong. CPU throttling is invisible to Kubernetes controllers.

### Step 1 — Find The Process From Host: ps aux

```bash
$ ps aux | grep appserver
appuser    17842  0.4  2.1 12984320 1384448 ? Sl  09:12  18:42 /app/appserver
```

`%CPU` 0.4% with a process that should be doing work means it might be throttled, not idle.

CPU throttling vs saturation:
- **Saturation:** `%CPU` near 100%, load high.
- **Throttling:** cgroup quota consumed. `%CPU` low. Host looks idle. Application is slow.

### Step 2 — Per-Process CPU: pidstat

```bash
$ pidstat -u 1 5 -p 17842
%wait    %CPU   CPU  Command
78.42    3.00     4  appserver
82.14    5.00     4  appserver
```

`%wait` 78-82%: process is runnable but waiting to be scheduled. Host CPU idle is 60%. This is CPU throttling, not saturation.

### Step 3 — Confirm Cgroup Throttling

```bash
$ cat /proc/17842/cgroup
10:cpu,cpuacct:/kubepods/burstable/pod8a4f.../abc123container

$ cat /sys/fs/cgroup/cpu,cpuacct/.../cpu.stat
nr_periods 18241
nr_throttled 14092
throttled_time 82914731948
```

14092 out of 18241 periods throttled = 77% of all scheduling periods. 82.9 seconds total throttle time.

### Step 4 — Find The Limit

```bash
$ cat .../cpu.cfs_quota_us
200000
$ cat .../cpu.cfs_period_us
100000
# 200000/100000 = 2.0 CPU limit
```

Pod has `resources.limits.cpu: "2"`. On a 16-core host, it gets 2 cores regardless of how many idle cores exist.

### Step 5 — Inspect Namespaces: lsns

```bash
$ lsns -p 17842
        NS TYPE   NPROCS   PID USER     COMMAND
4026531835 cgroup      4 17842 appuser  /app/appserver
4026532841 mnt         4 17842 appuser  /app/appserver
4026532843 pid         4 17842 appuser  /app/appserver
4026532133 net         4 17842 appuser  /app/appserver
```

Key: `mnt` namespace gives container its own filesystem view. `pid` namespace means PID 1 inside container is not the real host init. `net` namespace gives container its own interfaces.

Enter container's network namespace from host for tcpdump:

```bash
nsenter --target 17842 --net -- tcpdump -i eth0 -n port 8080
```

### Step 6 — Check Memory Cgroup

```bash
$ cat .../memory.usage_in_bytes
3623878656   # 3.37 GB

$ cat .../memory.limit_in_bytes
4294967296   # 4 GB limit
```

At 84% of limit. Check for major faults:

```bash
cat .../memory.stat | grep pgmajfault
```

High `pgmajfault` means kernel is fetching pages from disk due to memory pressure.

### OOM Score Inspection

```bash
cat /proc/17842/oom_score
cat /proc/17842/oom_score_adj
```

### Common Mistakes

- Trusting `kubectl get pod` status. Running means process exists, not that it performs well.
- Checking host CPU and concluding no problem. Idle host CPUs cannot help a throttled cgroup.
- Not knowing where cgroup files live (v1 vs v2 hierarchy).

---

## SRE Drill 1: Service And systemd Triage

**Source:** linux-admin/drill-01-service-and-systemd-triage.md

**Scenario:** Deploy just finished. Alert: "appserver on app-worker-02 is not responding on port 8080." You SSH to the host.

### Step 1 — Unit State: systemctl status

```bash
$ systemctl status appserver.service
Active: failed (Result: exit-code) since ... ; 3min 42s ago
Process: 28914 ExecStart=... (code=exited, status=1/FAILURE)
appserver[28914]: FATAL: cannot open config file: /etc/appserver/config.yaml: no such file
```

Active state meanings:
- `active (running)`: process alive.
- `active (exited)`: ran and exited cleanly (normal for oneshot).
- `failed (Result: exit-code)`: exited nonzero.
- `failed (Result: signal)`: killed by signal (137=SIGKILL, 139=SIGSEGV).
- `failed (Result: start-limit-hit)`: exceeded restart burst.

**Diagnosis:** config file missing. Service never started.

### Step 2 — Full Logs: journalctl -u

```bash
$ journalctl -u appserver.service -n 50 --no-pager
appserver[28914]: FATAL: cannot open config file: no such file or directory
systemd[1]: appserver.service: Scheduled restart job, restart counter is at 3/5.
systemd[1]: appserver.service: Start request repeated too quickly.
systemd[1]: appserver.service: Failed with result 'start-limit-hit'.
```

Time-scoped query:

```bash
journalctl -u appserver.service --since "2026-04-09 23:00:00" --until "2026-04-09 23:10:00"
journalctl -u appserver.service -p err --since "1 hour ago"
```

### Step 3 — Check Listening: ss -lntp

```bash
$ ss -lntp | grep -E "State|8080"
State    Recv-Q   Send-Q   Local Address:Port ...
(empty — nothing listening on 8080)
```

Nothing listening confirms app never reached the bind phase.

### Step 4 — Inspect Unit File: systemctl show

```bash
$ systemctl show appserver.service --property=ExecStart,Restart,RestartSec,StartLimitBurst,EnvironmentFile
Restart=on-failure
RestartSec=5s
StartLimitBurst=5
StartLimitIntervalSec=30s
EnvironmentFile=/etc/appserver/env (ignore_errors=no)
```

If EnvironmentFile is missing and `ignore_errors=no`, service fails to start.

### Step 5 — List Failed Units: systemctl list-units

```bash
$ systemctl list-units --type=service --state=failed
● appserver.service      loaded failed failed Application Server
● filebeat.service       loaded failed failed Filebeat log shipper
```

Multiple failures may share a root cause.

### Recovery

```bash
# After placing missing config:
systemctl reset-failed appserver    # clear start-limit-hit state
systemctl start appserver
```

### Advanced: ProtectSystem And Namespace Issues

If the config file exists but service still fails:

```bash
# Check filesystem namespace restrictions:
systemctl show appserver.service --property=PrivateTmp,ProtectSystem,ReadWritePaths

# Check path exists in service's mount namespace:
nsenter --target $(systemctl show appserver.service --property=MainPID --value) --mount -- ls /etc/appserver/

# Check SELinux/AppArmor denials:
ausearch -m AVC -ts recent 2>/dev/null | tail -10
journalctl -k | grep -i "apparmor.*DENIED" | tail -5
```

---

## SRE Drill 2: Filesystem And Storage Admin

**Source:** linux-admin/drill-02-filesystem-and-storage-admin.md

**Scenario:** Application on `stor-node-04` reporting write failures. Previous engineer checked `df -h`, said "disk is 43% full, space is fine," and closed the alert. Alert fired again 20 minutes later.

### Step 1 — Four Dimensions, Not One

```bash
df -h      # bytes
df -i      # inodes
findmnt    # mount state and options
iostat -xz 1 3   # IO latency per device
```

### Step 2 — Find The Inode Consumer

```bash
for dir in /var/cache /var/lib /var/log /var/spool /var/tmp; do
    echo "$(find $dir -xdev 2>/dev/null | wc -l) $dir"
  done | sort -rn
# Output: /var/lib 28M, /var/spool 3M, /var/log 422K ...

for dir in /var/lib/*/; do
    echo "$(find "$dir" -xdev 2>/dev/null | wc -l) $dir"
  done 2>/dev/null | sort -rn | head -5
# Output: /var/lib/docker/ 27.9M inodes
```

### Step 3 — Docker Prune

```bash
docker system df
# Images: 48 total, 12 active, 61 GB reclaimable
docker system prune -f    # remove unused images, build cache
df -i /var                # confirm inode recovery
```

### Step 4 — NFS Check (If Applicable)

```bash
nfsstat -c
mountstats /data/nfs-mount | grep -E "ops/s|avg RTT"
```

### Step 5 — Identify Large Files

```bash
du -sh /var/log/* 2>/dev/null | sort -h | tail -10
lsof /var/log/appserver/debug.log   # which process holds it open

# Rotate safely:
logrotate -f /etc/logrotate.d/appserver
# Or truncate safely:
> /var/log/appserver/debug.log
```

### Common Mistakes

- Checking only `df -h` and declaring disk is fine.
- Not checking `findmnt` for read-only remounts.
- Deleting a file and expecting immediate space recovery when still open.
- Forgetting that Docker overlay uses host inode budget.

---

## SRE Drill 3: Processes, Sockets, And Network Admin

**Source:** linux-admin/drill-03-process-socket-and-network-admin.md

**Scenario:** Clients report connection timeouts to `api-server-01` on port 8443.

### Step 1 — Is The Process Running?

```bash
$ ps aux | grep appserver
appuser  22914  0.4  2.1 ... Ssl  13:18  0:48 /usr/bin/appserver --port 8443
```

Process is running since 13:18 (2 hours ago, consistent with last deploy).

### Step 2 — What Is Listening?

```bash
$ ss -lntp
LISTEN   0   128   127.0.0.1:8443   0.0.0.0:*   users:(("appserver",pid=22914,fd=12))
```

Problem found: listening on `127.0.0.1` (loopback only). External clients cannot reach it.

Verify locally:

```bash
curl -k https://127.0.0.1:8443/healthz    # works
curl -k https://10.0.0.41:8443/healthz    # "Connection refused"
```

### Step 3 — Active Connections: ss -tanp

```bash
$ ss -tanp
LISTEN      0   128   127.0.0.1:8443    0.0.0.0:*
ESTABLISHED 0   0     127.0.0.1:8443    127.0.0.1:58201  # healthcheck (local)
TIME_WAIT   0   0     10.0.0.41:8443    10.0.0.12:54312  # old connections
CLOSE_WAIT  32  0     10.0.0.41:8443    10.0.0.12:48210  # connection leak
```

CLOSE_WAIT with `Recv-Q: 32` = unread data. Application not draining connections.

### Step 4 — Interface And Routing

```bash
$ ip addr
ens3: inet 10.0.0.41/24 scope global dynamic ens3  # primary interface is UP
$ ip route
default via 10.0.0.1 dev ens3
```

Routing is correct. Problem is purely the bind address.

### Step 5 — Firewall Check

```bash
$ iptables-save
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 8080 -j ACCEPT
-A INPUT -j DROP
# Port 8443 is not allowed!

$ nft list ruleset
# Same: only 22 and 8080 allowed.
```

Two issues found: wrong bind address AND port 8443 blocked by firewall.

Fix bind address: update config.yaml `bind_address` from `127.0.0.1` to `0.0.0.0`, restart.

Add firewall rule:

```bash
iptables -I INPUT -p tcp --dport 8443 -j ACCEPT
iptables-save > /etc/iptables/rules.v4    # persist
```

### CLOSE_WAIT Monitoring

```bash
watch -n2 'ss -tanp | grep -c CLOSE_WAIT'
# Growing count = leak. Stable = normal backpressure.
```

### MTU Mismatch (Advanced)

If external clients fail but internal succeed:

```bash
tcpdump -i ens3 -n port 8443 -w /tmp/capture.pcap
ip link show ens3 | grep mtu
ping -M do -s 1400 10.0.0.12        # internal (expect success)
ping -M do -s 1400 203.0.113.45     # external (failure = MTU issue)
```

Fix MTU via TCP MSS clamping:

```bash
iptables -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
```

---

## SRE Drill 4: Command Mastery Self-Test

**Source:** linux-admin/drill-04-command-mastery-checklist.md

For each command below, answer from memory: (1) what problem it solves, (2) one key signal to look for, (3) one thing it cannot tell you, (4) one common misuse.

### Self-Test Questions

| Command | Problem it solves | Signal | Cannot tell you | Common misuse |
|---|---|---|---|---|
| `systemctl status` | Lifecycle state of service | `Active:` line + embedded journal | Whether the app is healthy | Restarting without reading exit code |
| `journalctl` | Structured log query | Error/warning messages | App logs written to file directly | Not using `--since` or `-n` limits |
| `ps aux` | All processes with state | `STAT` column: `D` state | Whether process is cgroup-throttled | Sorting `%CPU` and concluding the problem |
| `top` | Real-time resource view | `%wa` CPU line | Per-device IO breakdown | Ignoring `wa`, `st`, only looking at `us` |
| `pidstat` | Per-process stats over time | `%wait` column | Cgroup limits directly | Running once and drawing conclusions |
| `free -m` | Memory and swap summary | `available` column, not `free` | Which process consumes memory | Looking at `free` column |
| `vmstat` | System-wide pressure | `b`, `si`/`so`, `wa` trend | Per-device IO | Reading first line (boot average) |
| `iostat` | Per-device IO stats | `%util`, `r_await`, `w_await`, `aqu-sz` | Which process causes IO | Trusting `%util` as linear capacity |
| `df -h` | Filesystem byte usage | Any FS above 85% | Inodes, IO latency, mount state | Stopping at `df -h` for write failures |
| `df -i` | Inode usage | Any FS at 100% inode | Which directories use inodes | Not running it at all |
| `findmnt` | Mount tree with options | `ro` in OPTIONS column | Whether NFS mount is hung | Skipping for `mount` command |
| `lsblk` | Block device tree | `RO` column | IO stats, filesystem health | Confusing no-mount with unused device |
| `ss -s` | Socket count summary | CLOSE_WAIT or TIME_WAIT counts | Which process owns sockets | Single reading without trending |
| `ss -tanp` | Full TCP socket list | LISTEN bind address, Recv-Q > 0 | Whether packets reach socket | Static reading instead of trending |
| `ip addr` | Interfaces and IPs | Interface UP/DOWN state | Routing or firewall | Confusing UP with NO-CARRIER |
| `ip route` | Kernel routing table | Default route presence | Gateway reachability | Not checking after interface reconfiguration |
| `resolvectl` | DNS configuration | Which server per-link | Whether DNS server responds | Reading `/etc/resolv.conf` on resolved systems |
| `dig` | DNS query | ANSWER SECTION, NXDOMAIN, SERVFAIL | What application resolver uses | Not specifying `@server` to test specific resolver |
| `tcpdump` | Packet capture | SYN without SYN-ACK, RST | App content in TLS | Running without `-n` (causes DNS lookups) |
| `iptables-save` | Full ruleset | INPUT chain drop rules | Whether nftables is also active | Editing without saving for reboot persistence |
| `nft list ruleset` | nftables rules | `policy drop` on input chain | iptables rules | Making iptables changes when nftables is active |

---

## Lab 2: Permissions And Sticky Bit

**Goal:** Understand permissions and why `/tmp` needs sticky bit.

```bash
mkdir /tmp/linux-permission-lab
cd /tmp/linux-permission-lab
echo "hello" > file.txt
ls -l file.txt
chmod 600 file.txt
ls -l file.txt
chmod 644 file.txt
ls -l file.txt
```

Create shared directory:

```bash
sudo mkdir /tmp/shared-lab
sudo chmod 0777 /tmp/shared-lab
ls -ld /tmp/shared-lab

# Set sticky bit:
sudo chmod 1777 /tmp/shared-lab
ls -ld /tmp/shared-lab
```

**Review question:** why is `1777` safer than `0777` for shared temporary directories?

---

## Lab 3: Process And Signal Practice

**Goal:** See process state and signals.

```bash
sleep 1000 &
echo $!
ps -fp $!
kill -15 $!

sleep 1000 &
kill -9 $!

ps -ef --forest | head -50
```

**Expected learning:** SIGTERM allows graceful shutdown; SIGKILL is immediate and should not be your default.

---

## Lab 4: systemd Service Debugging

**Goal:** Practice reading service state and logs.

```bash
systemctl status ssh || systemctl status sshd || systemctl status cron
journalctl -u ssh -n 50 --no-pager || journalctl -u sshd -n 50 --no-pager
systemctl cat ssh || systemctl cat sshd
systemctl --failed
journalctl -p err -n 100 --no-pager
```

**Review question:** what is the difference between process running and service healthy?

---

## Lab 5: Memory Pressure Observation

**Goal:** Learn Linux memory signals.

```bash
free -h
cat /proc/meminfo | grep -E 'MemAvailable|Cached|Buffers|SwapTotal|SwapFree'
vmstat 1 5
ps aux --sort=-%mem | head
cat /proc/$$/status | grep -E 'VmRSS|VmSize|Threads'
```

---

## Lab 6: Disk Full And Inode Investigation

**Goal:** Practice byte and inode checks.

```bash
df -h
df -i
sudo du -sh /var/* 2>/dev/null | sort -rh | head
sudo find / -xdev -type f -size +500M -ls 2>/dev/null | head
```

Create 100K tiny files and observe inode exhaustion:

```bash
mkdir /tmp/inode-lab
for i in $(seq 1 100000); do touch /tmp/inode-lab/file-$i; done
# Check inode count:
find /tmp/inode-lab -type f | wc -l
df -i /tmp
# Clean up:
rm -rf /tmp/inode-lab
df -i /tmp
```

**Expected learning:** inode exhaustion blocks file creation even when bytes are available.

---

## Lab 7: Deleted But Open File

**Goal:** Understand why disk space may not free after deletion.

Terminal 1:

```bash
python3 - <<'PY'
import time
f = open('/tmp/open-file-lab.log', 'w')
f.write('x' * 1024 * 1024 * 50)
f.flush()
print('holding file open')
time.sleep(600)
PY
```

Terminal 2:

```bash
ls -lh /tmp/open-file-lab.log
rm /tmp/open-file-lab.log
sudo lsof +L1 | grep open-file-lab || true
df -h /tmp    # space not freed yet
```

Stop the Python process and check again:

```bash
df -h /tmp    # space freed now
```

**Expected learning:** deleting a file removes the directory entry, not necessarily the disk blocks.

---

## Lab 8: cgroup v2 Memory Limit And OOM Observation

**Goal:** Set a cgroup memory limit, trigger OOM, observe dmesg.

```bash
# Create a test cgroup (requires root and cgroup v2):
mkdir /sys/fs/cgroup/test-lab
echo "104857600" > /sys/fs/cgroup/test-lab/memory.max   # 100 MB limit

# Add current shell to the cgroup:
echo $$ > /sys/fs/cgroup/test-lab/cgroup.procs

# Allocate memory beyond the limit with a Python script:
python3 -c "
import ctypes
buf = ctypes.create_string_buffer(200 * 1024 * 1024)  # 200 MB
print('allocated')
"

# Observe OOM kill:
dmesg | grep -E "OOM|killed" | tail -10

# Clean up (move shell back to default cgroup first):
echo $$ > /sys/fs/cgroup/cgroup.procs
rmdir /sys/fs/cgroup/test-lab
```

---

## Lab 9: strace A Mystery Hung Process

**Goal:** Use strace to identify what a hung process is waiting for.

```bash
# Start a process that blocks:
python3 - <<'PY' &
import time, socket
s = socket.socket()
s.connect(('10.255.255.1', 9999))   # unreachable address
PY
PID=$!

# Attach strace to see what it is doing:
strace -p $PID -e trace=network -T &

# Wait 10 seconds, then kill:
sleep 10
kill -9 $PID

# Summary of what strace showed:
strace -c -p $PID sleep 5
```

**Expected learning:** `strace` shows the exact kernel call the process is blocked in. A `connect()` to an unreachable address will retry visibly.

---

## Lab 10: Network Listening And Connectivity

**Goal:** Distinguish listening, refused, timeout, and DNS failures.

```bash
python3 -m http.server 8080

# In another terminal:
ss -lntp | grep 8080
curl -v http://localhost:8080
nc -vz localhost 8080
nc -vz localhost 9090    # should show "connection refused"

# DNS checks:
dig example.com
resolvectl status || cat /etc/resolv.conf
```

---

## Lab 11: Build A Linux Incident Note

**Goal:** Practice writing incident-quality diagnosis.

Template:

```text
Symptom:
Scope:
Started at:
Recent change:
Evidence:
- CPU:
- Memory:
- Disk:
- Network:
- Logs:
Mitigation:
Remaining uncertainty:
Next action:
```

Use the template after any lab. This builds interview-ready explanation skill.
