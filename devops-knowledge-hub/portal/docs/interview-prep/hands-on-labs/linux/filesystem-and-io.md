---
title: "Linux Lab 2: Filesystem, Disk, and IO Pressure"
sidebar_position: 2
---

# Linux Lab 2: Filesystem, Disk, and IO Pressure

## Why This Matters In Production

"Disk write timeout" with `df -h` showing 40% used is one of the most confusing alerts an SRE encounters. The instinct is to check free space first — and that instinct will fail you. Write failures happen when the disk device is saturated, when inodes are exhausted, when a filesystem is mounted read-only due to corruption, or when the underlying storage is network-attached and the network is degraded. None of these show up in `df -h`. This lab builds the habit of going four layers deep, not one.

## Prerequisites

- Completed Lab 01 (host triage) or comfortable with `top`, `vmstat`, `iostat`
- Knows the difference between a filesystem and a block device
- Has seen a disk full error before (even if unfamiliar with the cause)

## Time Estimate

50 minutes for a thorough pass. The intermediate section can be done on any Linux machine you have access to.

---

## Part 1 — Beginner: Guided Walk-Through

### Step 1 — Check Free Space: df -h

```bash
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           6.3G  2.1G  4.2G  34% /run
/dev/nvme0n1p1  200G   82G  118G  41% /
/dev/nvme0n1p2  500G  487G   13G  97% /var
tmpfs            32G     0   32G   0% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
/dev/nvme1n1    1.0T  310G  690G  31% /data
overlay         500G  487G   13G  97% /var/lib/docker/overlay2/abc123def456/merged
```

**What to read:**
- `/var` at 97% used — this is likely the problem. Most application log directories and package managers write to `/var`.
- The overlay entry shares the same underlying device as `/var`. Container writes count against `/var`'s budget.
- `/` at 41% is fine, but `/var` being near-full explains write timeouts even though "disk" looks okay overall.

**What `df -h` cannot tell you:** inode exhaustion, IO latency, device queue depth, whether the filesystem is mounted read-only due to corruption, or whether an NFS mount is responding.

---

### Step 2 — Check Inode Usage: df -i

```bash
$ df -i
Filesystem       Inodes   IUsed   IFree IUse% Mounted on
tmpfs           8200192    1841 8198351    1% /run
/dev/nvme0n1p1 13107200 2184320 10922880   17% /
/dev/nvme0n1p2 32505856 32505841      15    100% /var
tmpfs           8192000       1 8191999    1% /dev/shm
overlay         32505856 32505841      15   100% /var/lib/docker/overlay2/abc123def456/merged
```

**This is the smoking gun.** `/var` has 100% inodes used with only 15 free. The filesystem has space in bytes but cannot create new files. Every file creation will fail with `ENOSPC` ("No space left on device") even though `df -h` shows 13 GB free.

**What causes inode exhaustion?**
- Millions of small files — email queues, session files, log rotation artifacts, temp files in `/var/tmp`
- Container image layers (each layer stores its files as individual inodes)
- Logging systems that write one file per event (some older syslog configs)

**Finding the culprit:**
```bash
$ for dir in /var/*/; do echo "$(find "$dir" -xdev | wc -l) $dir"; done | sort -n | tail -10
     412 /var/backups/
    2841 /var/lib/apt/
   18420 /var/lib/dpkg/
  220441 /var/log/
 9842001 /var/spool/postfix/deferred/
31048192 /var/lib/docker/overlay2/
```

Docker overlay and a postfix mail queue together consumed all inodes. The application never had a chance.

---

### Step 3 — Check Mount Details: findmnt

```bash
$ findmnt
TARGET                                SOURCE         FSTYPE      OPTIONS
/                                     /dev/nvme0n1p1 ext4        rw,relatime
├─/var                                /dev/nvme0n1p2 ext4        ro,relatime,errors=remount-ro
│ └─/var/lib/docker/overlay2/abc.../merged
│                                     overlay        overlay     rw,relatime,lowerdir=...
├─/data                               /dev/nvme1n1   xfs         rw,relatime,attr2
├─/proc/sys/fs/binfmt_misc            systemd-1      autofs      rw,relatime,fd=29
└─/run                                tmpfs          tmpfs       rw,nosuid,nodev,noexec
```

**Critical finding:** `/var` is mounted with `ro` (read-only) and `errors=remount-ro`. The filesystem detected an error and automatically remounted itself read-only to prevent corruption. Every write to `/var` will fail silently at the filesystem level. `df -h` would still show the capacity as if nothing were wrong.

**`errors=remount-ro` is the default for ext4.** When the kernel encounters an IO error or journal inconsistency, it flips the mount to read-only rather than risking data corruption. This is a feature, not a bug — but it terminates all writes instantly.

---

### Step 4 — Check IO Latency: iostat -xz 1 5

```bash
$ iostat -xz 1 5
Device            r/s     w/s     rkB/s     wkB/s r_await w_await aqu-sz  %util
nvme0n1          28.4   214.7   4544.0   34352.0    0.38    0.42    0.09   8.2
nvme1n1           2.1     1.4    336.0     224.0    0.39    0.41    0.00   0.4

Device            r/s     w/s     rkB/s     wkB/s r_await w_await aqu-sz  %util
nvme0n1          31.2   891.4   4992.0  142624.0    0.41   18.74    3.84  88.1
nvme1n1           1.8     0.9    288.0     144.0    0.40    0.42    0.00   0.3

Device            r/s     w/s     rkB/s     wkB/s r_await w_await aqu-sz  %util
nvme0n1          29.8  1042.1   4768.0  166736.0    0.39   24.13    4.97  96.8
nvme1n1           1.2     0.7    192.0     112.0    0.41    0.39    0.00   0.2
```

**What to read across the three snapshots:**
- nvme0n1 `%util` went from 8% to 97% in two seconds. Write throughput jumped from 34 MB/s to 163 MB/s in the same window.
- `w_await` climbed from 0.42 ms to 24.13 ms. On NVMe, normal is under 0.5 ms. 24 ms is a 48x slowdown.
- `aqu-sz` (queue depth) grew to 4.97, meaning requests are piling up faster than the device drains them.
- This pattern — sudden burst of writes causing queue buildup and latency spike — is characteristic of a write storm, often triggered by a log rotation event, a backup job starting, or a container flush cycle.

---

### Step 5 — Identify the Largest Consumers: du -sh

```bash
$ du -sh /var/log/* 2>/dev/null | sort -h | tail -10
4.0K    /var/log/wtmp
12K     /var/log/auth.log
24K     /var/log/kern.log
184K    /var/log/syslog
2.1M    /var/log/apt/history.log
18M     /var/log/journal
44M     /var/log/nginx
1.2G    /var/log/appserver
8.7G    /var/log/appserver/debug.log
```

**Diagnosis:** A single debug log grew to 8.7 GB. The file is open and being written continuously. Because it is a single file (one inode), it does not explain inode exhaustion — but it does explain byte consumption. Rotate or truncate:

```bash
# Safe truncation of a file being written to by a live process:
> /var/log/appserver/debug.log

# Or force log rotation:
logrotate -f /etc/logrotate.d/appserver
```

**Never `rm` a file that is still open by a running process.** The inode stays allocated until the process closes it. The space will not be freed until the process is restarted or the fd is closed.

---

### Step 6 — Check Block Device Layout: lsblk

```bash
$ lsblk
NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
nvme0n1     259:0    0   200G  0 disk
├─nvme0n1p1 259:1    0    50G  0 part /
└─nvme0n1p2 259:2    0   150G  0 part /var
nvme1n1     259:4    0     1T  0 disk /data
```

**What to read:** Two NVMe devices, two partitions on nvme0n1. The partition table confirms `/var` is on a separate partition from `/`. Problems on `/var` will not be visible when you check `/` usage.

---

## Part 2 — Intermediate: Directed Analysis

Run these on a live machine and write one-sentence interpretations:

```bash
mount | grep -E "ro,|,ro"
dmesg | grep -E "EXT4|XFS|I/O error|remount" | tail -20
ls -l /proc/$(pgrep appserver | head -1)/fd | wc -l
lsof +D /var/log 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head
```

Questions to answer:
1. Why does `df -h` show 13 GB free on `/var` while every write returns ENOSPC?
2. A file is deleted but `df -h` does not show the space recovered. What is happening?
3. An NFS mount hangs. How would `df -h` behave? How would `findmnt` help?
4. The overlay filesystem for a container uses 90% of its layer budget. Where does that actually live on disk?

---

## Part 3 — Advanced / Stretch

**Scenario extension:** You have confirmed inode exhaustion and a read-only remount. The application team says they cannot restart the service. You need to free inodes without restarting.

1. Find and remove stale session files:
   ```bash
   find /var/spool/postfix/deferred -type f -mtime +7 | wc -l
   find /var/spool/postfix/deferred -type f -mtime +7 -delete
   ```
2. Prune dangling Docker layers (inodes without running containers):
   ```bash
   docker system prune -f --volumes
   ```
3. Remount read-write after confirming no filesystem errors:
   ```bash
   dmesg | grep "EXT4-fs error" | tail -5
   mount -o remount,rw /var
   ```

**Edge cases to reason through:**
- `/tmp` is mounted as tmpfs but your process writes multi-gigabyte temp files. What happens when tmpfs fills? How does this differ from filling a disk partition?
- A Kubernetes PVC is backed by Ceph RBD. The PVC reports 80% full. The pod's application writes fail. But `kubectl exec` into the pod and `df -h` shows 80% used — not full. What other dimension could be exhausted?
- `iostat` shows 0% utilization on all local devices during a write storm. Where is the IO going?

---

## Sample Incident Update

```
[09:14 UTC] Service write failures on app-worker-03 confirmed. Not a space issue.

df -h: /var at 97% bytes, 13 GB remaining.
df -i: /var at 100% inodes, 15 inodes remaining — all file creation blocked.
findmnt: /var remounted read-only (errors=remount-ro triggered by ext4 journal error).
dmesg: EXT4 errors on nvme0n1p2 at 09:08, 09:11, 09:13.
iostat: nvme0n1 write await spiked to 24ms at 09:09, correlates with write storm.

Root cause working theory: write storm exhausted inode table, triggering ext4 error,
which caused automatic read-only remount. Inode source: /var/lib/docker/overlay2 and
/var/spool/postfix/deferred (31M+ files combined).

Actions taken: Docker prune freed 18M inodes. Postfix deferred queue cleanup in progress.
Remount rw after dmesg confirms no new errors. Application team notified, no restart needed.
```

---

## Common Mistakes

- **Stopping at `df -h`** and concluding "disk is fine." Always also run `df -i`.
- **Deleting open files expecting immediate space recovery.** The file's inode and data blocks are held until all open file descriptors are closed.
- **Not checking `findmnt` for read-only mounts.** A silently read-only filesystem looks healthy in `df` but rejects all writes.
- **`du` vs `df` discrepancy.** Deleted but open files are not counted by `du` but are still consuming disk blocks counted by `df`. The gap between them reveals "ghost space."
- **Assuming container writes go to the container's own disk.** Overlay layers live on the host's filesystem. Container disk pressure is host disk pressure.
- **Running `fsck` on a mounted filesystem.** Always unmount or use read-only mode first. Running `fsck` on a live mounted filesystem can corrupt it further.

---

## What To Study Next

- Lab 03: Processes, cgroups, Namespaces — how container resource limits interact with the filesystem
- Foundation doc: 10-linux-and-network-administration.md, storage section
- Understand `ext4` journal mode: `data=ordered` vs `data=writeback` and how each affects write durability under pressure
- Practice: find the largest inode-consuming directories on any machine you have access to using `find . -xdev | wc -l` per subdirectory
