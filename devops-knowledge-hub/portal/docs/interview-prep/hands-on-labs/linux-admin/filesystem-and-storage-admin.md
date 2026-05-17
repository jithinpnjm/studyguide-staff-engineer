---
title: "Linux Admin Drill 2: Filesystem and Storage Administration"
sidebar_position: 2
---

# Linux Admin Drill 2: Filesystem and Storage Administration

## Why This Matters In Production

Storage failures are one of the most reliably confusing categories of incidents. Unlike CPU or memory issues where "high number bad" is roughly true, storage problems require reading four separate dimensions simultaneously: byte usage, inode usage, mount state, and IO queue behavior. An application reporting write failures while `df -h` shows 40% used is a classic trap. This drill builds the reflex to check all four dimensions without being told to.

## Prerequisites

- Completed Lab 02 (filesystem and IO), or read the explanation of inodes and IO wait
- Comfortable with `df -h` output
- Has seen at least one "disk full" incident, real or simulated

## Time Estimate

45 minutes. Run each step on a real machine. Document your outputs — the habit of capturing state before changing anything is the entire point.

---

## Scenario

It is 10:40. An application on `stor-node-04` begins reporting write failures and slow response times. The on-call engineer before you checked `df -h`, said "disk is 43% full, space is fine," and closed the alert. The alert fired again 20 minutes later. Your job is to go deeper.

---

## Part 1 — Beginner: Guided Triage Walk-Through

### Step 1 — Bytes First, Then Inodes: df -h and df -i

```bash
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           6.3G  1.1G  5.2G  18% /run
/dev/nvme0n1p1  200G   82G  118G  41% /
/dev/nvme0n1p2  500G  215G  285G  43% /var
tmpfs            32G   12G   20G  38% /dev/shm
/dev/nvme1n1    1.0T  310G  690G  31% /data
overlay         500G  215G  285G  43% /var/lib/docker/overlay2/abc123/merged
```

**As the previous engineer noted: 43% used on `/var`, plenty of space.** This is the wrong conclusion. Byte usage is only one dimension.

```bash
$ df -i
Filesystem       Inodes   IUsed   IFree IUse% Mounted on
tmpfs           8200192    2401 8197791    1% /run
/dev/nvme0n1p1 13107200  841280 12265920    6% /
/dev/nvme0n1p2 32505856 32505701     155   100% /var
tmpfs           8192000      24 8191976    1% /dev/shm
/dev/nvme1n1   65536000 11200000 54336000   17% /data
overlay         32505856 32505701     155   100% /var/lib/docker/overlay2/abc123/merged
```

**Found it: 100% inode usage on `/var`.** 155 inodes remaining out of 32.5 million. No new files can be created on this filesystem regardless of how much byte space exists.

**Why do inodes run out before bytes?** Each filesystem is formatted with a fixed inode table. By default, ext4 allocates one inode per 16 KB of device capacity. A filesystem holding millions of small files (each under 1 KB) will exhaust inodes while using a fraction of the byte capacity. Common culprits: email queues, session token files, log rotation artifacts, container layers, small cache files written per-request.

---

### Step 2 — Find the Inode Consumer

```bash
$ for dir in /var/cache /var/lib /var/log /var/spool /var/tmp; do
    echo "$(find $dir -xdev 2>/dev/null | wc -l) $dir"
  done | sort -rn
28441902 /var/lib
  3281094 /var/spool
    422081 /var/log
    180441 /var/cache
     14202 /var/tmp
```

`/var/lib` holds 28 million inodes. Drill down:

```bash
$ for dir in /var/lib/*/; do
    echo "$(find "$dir" -xdev 2>/dev/null | wc -l) $dir"
  done 2>/dev/null | sort -rn | head -5
27901042 /var/lib/docker/
   388012 /var/lib/kubelet/
   102441 /var/lib/postgresql/
    28800 /var/lib/apt/
    10220 /var/lib/systemd/
```

Docker is holding 27.9 million inodes. This is accumulated container layers, image cache, and build artifacts.

```bash
$ docker system df
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          48        12        84.2GB    61.1GB (72%)
Containers      3         3         2.41GB    0B (0%)
Local Volumes   18        8         14.2GB    5.8GB (40%)
Build Cache     2.1GB     0B        2.1GB     2.1GB (100%)

$ docker image ls | wc -l
49
```

48 Docker images, only 12 active. 36 unused images can be pruned.

---

### Step 3 — Check Mount State and Options: findmnt

```bash
$ findmnt
TARGET                                   SOURCE         FSTYPE   OPTIONS
/                                        /dev/nvme0n1p1 ext4     rw,relatime
├─/var                                   /dev/nvme0n1p2 ext4     rw,relatime,errors=remount-ro
│ └─/var/lib/docker/overlay2/abc123/merged
│                                        overlay        overlay  rw,relatime,lowerdir=...
├─/dev/shm                               tmpfs          tmpfs    rw,nosuid,nodev
├─/data                                  /dev/nvme1n1   xfs      rw,relatime,attr2,inode64
│ └─/data/nfs-mount                      nfs-server:/exports/data
│                                        nfs4           rw,relatime,vers=4.2,rsize=1048576
└─/run                                   tmpfs          tmpfs    rw,nosuid,nodev,noexec
```

**Key observations:**
- `/var` has `errors=remount-ro` — if ext4 encounters a journal or block error, it will flip to read-only automatically.
- `/data/nfs-mount` is an NFS4 mount. Write failures here would not be visible in local `iostat` — they travel over the network.
- The overlay filesystem for the container is backed by `/var` — its inode usage contributes to `/var`'s inode count.

**What to check if NFS is involved:**
```bash
$ nfsstat -c
$ mountstats /data/nfs-mount | grep -E "ops/s|avg RTT"
```

---

### Step 4 — Block Device Layout: lsblk

```bash
$ lsblk
NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
nvme0n1     259:0    0   200G  0 disk
├─nvme0n1p1 259:1    0    50G  0 part /
└─nvme0n1p2 259:2    0   150G  0 part /var
nvme1n1     259:4    0     1T  0 disk /data
nvme2n1     259:6    0   500G  1 disk
```

**Note:** nvme2n1 has `RO=1` — read-only flag set at the block device level. Any filesystem on this device will refuse writes regardless of mount options. This could be a write-protect jumper, a hardware failure indicator, or a deliberate lock.

---

### Step 5 — IO Latency Across Devices: iostat -xz 1 3

```bash
$ iostat -xz 1 3
Device            r/s     w/s     rkB/s    wkB/s r_await w_await aqu-sz  %util
nvme0n1          18.2    142.8   2912.0  22848.0    0.41    0.44    0.07   4.2
nvme1n1           2.4      0.9    384.0    144.0    0.42    0.38    0.00   0.2

Device            r/s     w/s     rkB/s    wkB/s r_await w_await aqu-sz  %util
nvme0n1          21.4   1841.2   3424.0 294592.0    0.44   32.84    3.12  87.4
nvme1n1           2.1      0.7    336.0    112.0    0.40    0.41    0.00   0.1

Device            r/s     w/s     rkB/s    wkB/s r_await w_await aqu-sz  %util
nvme0n1          19.8   2104.7   3168.0 336752.0    0.43   41.22    4.88  96.1
nvme1n1           1.9      0.8    304.0    128.0    0.42    0.39    0.00   0.1
```

**Three snapshots tell a story:**
- nvme0n1 `%util` went from 4% to 96% between sample 1 and sample 3 — a write burst hit the device.
- `w_await` climbed from 0.44 ms to 41.22 ms — writes are taking 41 ms instead of the normal sub-millisecond. The application would experience this as latency spikes.
- `aqu-sz` grew to 4.88 — requests are queuing up.
- nvme1n1 is completely unaffected — the problem is isolated to nvme0n1 (which hosts `/var`).

**Translating to application impact:** A write() syscall on `/var/log/app.log` during this window would block for ~41 ms per 512-byte kernel IO. An application writing 100 log lines per request would add 4 seconds of latency per request during the burst. This is how a "disk issue" becomes an "application is slow" alert.

---

### Step 6 — Find The Largest Files: du -sh with sort

```bash
$ du -sh /var/log/* 2>/dev/null | sort -h | tail -10
48K     /var/log/auth.log
112K    /var/log/kern.log
288K    /var/log/syslog
1.4M    /var/log/journal
6.2M    /var/log/nginx/access.log
28M     /var/log/nginx/error.log
214M    /var/log/appserver
4.1G    /var/log/appserver/debug.log
```

A 4.1 GB debug log. Check if it is actively written and by what:

```bash
$ lsof /var/log/appserver/debug.log
COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF    NODE NAME
appserver 18204 appuser   7w   REG  259,2   4412490880 2883912 /var/log/appserver/debug.log
```

One process, one open write descriptor. This file can be rotated safely:

```bash
# Force logrotate to rotate it now:
logrotate -f /etc/logrotate.d/appserver

# If logrotate is not configured, truncate safely (process keeps writing to same fd):
> /var/log/appserver/debug.log
```

---

## Part 2 — Intermediate: Directed Analysis

Run these on a machine you have access to:

```bash
# Check for deleted files still held open (ghost space):
lsof | grep deleted | awk '{print $1, $7}' | sort -k2 -rn | head -10

# Check for filesystems mounted read-only unexpectedly:
mount | grep " ro,"

# Find directories with the most entries (inode density):
find /var -maxdepth 3 -type d -exec sh -c 'echo "$(ls -1 {} | wc -l) {}"' \; 2>/dev/null | sort -rn | head -10

# Check kernel IO error log:
dmesg | grep -E "I/O error|blk_update_request|EXT4-fs error" | tail -20
```

Questions to answer:
1. `du -sh /var` reports 8 GB. `df -h` shows 12 GB used for `/var`. What explains the 4 GB gap?
2. You rotate a log file but `df -h` shows no space recovered. Why?
3. A filesystem is mounted with `noatime`. What write overhead does this eliminate and why would you set it on a busy log-writing host?
4. `/data` is an XFS filesystem. How does XFS handle inode allocation differently from ext4?

---

## Part 3 — Advanced / Stretch

**Recovery sequence for a full inode partition:**

```bash
# Step 1: confirm and quantify
df -i /var

# Step 2: find the top-N inode consumers
find /var -xdev -printf '%h\n' | sort | uniq -c | sort -rn | head -20

# Step 3: prune safely
docker system prune -f                          # Remove unused images/containers/build cache
find /var/spool/postfix/deferred -mtime +3 -delete   # Purge old mail queue
find /tmp -maxdepth 1 -mtime +1 -delete         # Purge old temp files

# Step 4: verify recovery
df -i /var
```

**Reasoning exercises:**

- You have a 1 TB XFS volume for `/data`. You want to pre-allocate more inodes because you know you will store millions of small files. How do you do this at format time? (Hint: `mkfs.xfs -i maxpct=` or `-n size=`)
- A container writes millions of empty lock files to `/var/run/app/sessions/`. The container is deleted and recreated daily. Why might inodes still be exhausted?
- `smartctl -a /dev/nvme0n1` shows `Reallocated Sectors: 48` and `Pending Uncorrectable: 12`. What action do you take, and in what order?
- A volume is 100% full in bytes. You delete a 5 GB file. `df -h` shows the same usage. `lsof | grep deleted` shows nothing. What else could be holding the space?

---

## Sample Incident Note

```
[10:58 UTC] Write failures on stor-node-04 — inode exhaustion on /var, not byte shortage.

df -h: /var at 43% bytes (215 GB / 500 GB) — no byte issue.
df -i: /var at 100% inodes, 155 inodes remaining — all new file creation blocked.
Root consumer: /var/lib/docker — 27.9M inodes across 48 images (36 unused).
Secondary: iostat shows nvme0n1 w_await spiking to 41ms during write bursts.
findmnt: /var mount healthy (rw), no remount-ro triggered yet.

Immediate action: docker system prune freed 18.2M inodes. /var now at 44% inode usage.
Write failures resolved. Application team confirmed writes succeeding at 10:56.

Follow-up required:
- Add monitoring for inode usage on /var (alert at 80% inodes)
- Add Docker image cleanup cronjob (weekly prune of images older than 14 days)
- Review debug log rotation — 4.1 GB log found, adding to logrotate config.
```

---

## Common Mistakes

- **Checking only `df -h` and declaring disk is fine.** Always check `df -i` in the same breath.
- **Not checking `findmnt` for read-only remounts.** A remounted-ro filesystem looks healthy in `df` but rejects writes silently.
- **Deleting a file and expecting immediate space recovery** when the file is still open by a running process.
- **`du` and `df` showing different numbers** — the gap is deleted-but-open files. `lsof | grep deleted` reveals them.
- **Pruning Docker without checking for running containers.** `docker system prune -f` will not remove images used by running containers, but double-check before running in production.
- **Forgetting that overlay filesystems count against the host's inode budget.** Containers do not have their own separate inode tables — they share the host partition's inodes.
- **Ignoring `iostat` after fixing space.** High IO wait and device saturation are separate problems that can persist even after space is recovered.

---

## What To Study Next

- Lab 02: Filesystem and IO — the companion lab with more depth on IO wait and device saturation
- Foundation doc: 10-linux-and-network-administration.md, storage section
- Practice: `man mkfs.ext4` — understand the `-i bytes-per-inode` option and when to use it
- Drill 03: Process, Socket, and Network — the storage problem is fixed, now confirm the application actually recovered
