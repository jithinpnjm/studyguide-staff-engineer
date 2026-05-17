---
title: "Linux Lab 1: First 10 Minutes On A Slow Host"
sidebar_position: 1
---

# Linux Lab 1: First 10 Minutes On A "Slow Host"

## Why This Matters In Production

You get paged at 2 AM. The alert says "host latency elevated." That is it. No stack trace, no obvious metric spike. The first 10 minutes are the most important: you either converge on a hypothesis or you thrash. Every experienced SRE has a repeatable triage sequence burned into muscle memory. This lab builds yours.

The trap: jumping straight to CPU metrics. "Slow" has six distinct causes — CPU saturation, memory pressure, disk IO stalls, network waits, a hung dependency, or a single runaway process. Starting with the wrong tool wastes minutes and misleads the team.

## Prerequisites

- Comfortable reading process lists and file sizes
- Knows what load average is conceptually
- Can SSH into a Linux host

## Time Estimate

45 minutes for a first pass. Repeat until you can walk through beginner steps from memory in under 8 minutes.

---

## Part 1 — Beginner: Guided Triage Walk-Through

Run each command in this order. Read the explanation before you run, then compare your actual output.

### Step 1 — Get Initial Signal: uptime

```bash
$ uptime
 14:32:17 up 47 days,  3:12,  2 users,  load average: 18.43, 16.91, 14.22
```

**What to read:** Load average is jobs waiting for CPU or disk, averaged over 1, 5, and 15 minutes. Compare to the number of CPUs (`nproc`). On a 4-core host, load 18.43 means roughly 4.6x overloaded. If the 1-minute number is much higher than the 15-minute number, the problem is recent and sharp. If all three are high, it has been festering.

**Bad looks like:** 1-min load >> 15-min load (sudden spike). All three near or above `nproc` (sustained overload). Load near 0 when a service is "slow" points toward network or dependency wait, not host saturation.

---

### Step 2 — Who Is On and What Are They Running: w

```bash
$ w
 14:32:17 up 47 days,  3:12,  2 users,  load average: 18.43, 16.91, 14.22
USER     TTY      FROM             LOGIN@   IDLE JCPU   PCPU WHAT
jithin   pts/0    10.0.0.5         14:30    0.00s  0.03s  0.01s w
deploy   pts/1    10.0.0.12        14:28    2:01   1.24s  0.00s /bin/sh /opt/deploy.sh
```

**What to read:** Is anyone running a maintenance script that explains the load? Deployment scripts, backup jobs, and compaction tasks are common culprits. The JCPU column shows total CPU time consumed by all processes in that session.

---

### Step 3 — Interactive Process View: top

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

### Step 4 — Memory Detail: free -m

```bash
$ free -m
               total        used        free      shared  buff/cache   available
Mem:           64042       58901         412        1084        4728        1141
Swap:           8192        2088        6104
```

**What to read:** The `available` column is what actually matters — it accounts for reclaimable buff/cache. Here it is 1141 MB on a 64 GB host, which is very low (under 2%). The system will start evicting pages and thrashing swap.

**Bad looks like:** `available` below 5% of total. Any swap used on a host that should have plenty of RAM (common in memory leak scenarios). `buff/cache` extremely low means the page cache has already been evicted.

---

### Step 5 — Confirm IO Pressure: vmstat 1 5

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

### Step 6 — Confirm Disk Saturation: iostat -xz 1 3

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

### Step 7 — Check for Error Logs: journalctl -p err -n 30

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

## Part 2 — Intermediate: Directed Analysis

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

## Part 3 — Advanced / Stretch

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

## Sample Incident Update

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

## Common Mistakes

- **Looking at CPU first** when `wa` is the signal. `us` being low means the CPU is not the bottleneck.
- **Trusting load average alone.** High load can be caused by IO-blocked processes, not CPU-hungry ones.
- **Ignoring swap.** Active swapping on a host with "plenty of RAM" means there is a memory leak or cgroup limit in play.
- **Not reading the `D` state.** Processes stuck in uninterruptible sleep are the fingerprint of IO saturation.
- **Rebooting before checking SMART.** If the disk is failing, a reboot does not fix it, and you lose the IO error history in dmesg.
- **Missing the time window.** `journalctl -p err -n 30` without `--since` can show stale errors from days ago. Always check timestamps.

---

## What To Study Next

- Lab 02: Filesystem and IO — dig into why free space is not the whole story
- Lab 03: Processes, cgroups, Namespaces — understand why one container can starve others
- Foundation doc: 10-linux-and-network-administration.md, section on storage and IO
- `man iostat`, specifically the `await` vs `svctm` distinction (svctm is deprecated but still appears in interviews)
