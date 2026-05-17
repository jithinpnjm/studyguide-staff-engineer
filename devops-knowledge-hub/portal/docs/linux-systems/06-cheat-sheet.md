---
title: "Cheat Sheet"
sidebar_position: 6
---

# Linux & Systems — Cheat Sheet

Fast recall for production Linux debugging, SRE interviews, and incident response.

---

## First 60 Seconds

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

Classify:

```text
CPU pressure
memory pressure
disk bytes full
inodes full
network problem
service problem
kernel/hardware
external dependency
```

---

## systemctl — Full Reference

```bash
systemctl status SERVICE           # lifecycle state + last log lines
systemctl cat SERVICE              # show unit file contents
systemctl show SERVICE             # all unit properties
systemctl show SERVICE --property=ExecStart,Restart,LimitNOFILE  # specific props
systemctl list-units --type=service --state=failed  # failed services
systemctl list-units --type=service --state=active  # running services
systemctl list-units --all         # all units regardless of state
systemctl list-dependencies SERVICE  # dependency tree

sudo systemctl start SERVICE
sudo systemctl stop SERVICE
sudo systemctl restart SERVICE
sudo systemctl reload SERVICE      # reload config without restart
sudo systemctl enable SERVICE      # start on boot
sudo systemctl disable SERVICE
sudo systemctl mask SERVICE        # prevent starting (even manually)
sudo systemctl unmask SERVICE
sudo systemctl daemon-reload       # reload unit files after changes
sudo systemctl reset-failed SERVICE  # clear start-limit-hit state
sudo systemctl edit SERVICE        # create drop-in override
```

Active state meanings:

```text
active (running)       process alive
active (exited)        ran and exited cleanly (oneshot)
failed (exit-code)     exited nonzero
failed (signal)        killed (137=SIGKILL, 139=SIGSEGV)
failed (start-limit)   exceeded restart burst
activating             start in progress
```

---

## journalctl — Full Reference

```bash
journalctl -u SERVICE -n 50 --no-pager     # last 50 lines for a service
journalctl -u SERVICE --since "1 hour ago"  # time-scoped
journalctl -u SERVICE -f                    # follow live
journalctl -u SERVICE -p err --since "1 hour ago"  # errors only
journalctl -p err -n 100 --no-pager        # all errors across services
journalctl -k -n 200 --no-pager            # kernel messages (like dmesg)
journalctl -k --since "30 minutes ago"     # kernel, time-scoped
journalctl -b                              # this boot only
journalctl -b -1                           # previous boot
journalctl --since "2026-05-17 10:00" --until "2026-05-17 10:30"
journalctl -e                              # jump to end immediately
```

Priority levels: `emerg(0) alert(1) crit(2) err(3) warning(4) notice(5) info(6) debug(7)`

---

## ss — Complete Reference

| Command | Purpose |
|---|---|
| `ss -s` | Socket state summary |
| `ss -lntp` | Listening TCP sockets with process |
| `ss -tulnp` | Listening TCP+UDP with process |
| `ss -tanp` | All TCP with state and process |
| `ss -4 -tanp` | IPv4 only |
| `ss -6 -tanp` | IPv6 only |
| `ss -tanp \| grep CLOSE_WAIT` | Connection leaks |
| `ss -tan state time-wait \| wc -l` | TIME_WAIT count |
| `ss -tan state established \| wc -l` | Active connections |
| `ss -o` | Show timer information |

Flag reference:

```text
-t  TCP
-u  UDP
-l  listening only
-n  numeric (no DNS/service lookups)
-p  process info
-s  summary
-4  IPv4
-6  IPv6
-o  options/timers
```

---

## lsof — Patterns

```bash
lsof -p PID                  # all open files for a process
lsof +D /path                # processes with files open in a directory
lsof /path/to/file           # processes with this specific file open
lsof +L1                     # deleted files still held open (ghost space)
lsof -i :8080                # processes using port 8080
lsof -i TCP:8080             # TCP-specific port check
lsof -u username             # all open files for a user
lsof -c nginx                # all open files for processes named nginx
lsof | wc -l                 # system-wide open file count
lsof | grep deleted          # all deleted-but-open files
lsof | grep deleted | awk '{print $7}' | sort -rn | head  # by size
```

---

## /proc Key Paths Reference

### System-Wide

| Path | Contents |
|---|---|
| `/proc/meminfo` | Memory breakdown |
| `/proc/cpuinfo` | CPU details |
| `/proc/loadavg` | Load averages |
| `/proc/uptime` | System uptime |
| `/proc/net/tcp` | TCP socket table |
| `/proc/net/nf_conntrack` | Connection tracking |
| `/proc/sys/vm/swappiness` | Swap tendency |
| `/proc/sys/vm/dirty_ratio` | Write-back trigger |
| `/proc/sys/vm/dirty_background_ratio` | Background flush trigger |
| `/proc/sys/fs/file-max` | System-wide fd limit |
| `/proc/sys/fs/file-nr` | Current fd usage |
| `/proc/sys/kernel/panic` | Panic auto-reboot |
| `/proc/sys/net/core/somaxconn` | Socket backlog max |
| `/proc/sys/net/netfilter/nf_conntrack_max` | Conntrack table size |
| `/proc/pressure/cpu` | PSI CPU pressure |
| `/proc/pressure/memory` | PSI memory pressure |
| `/proc/pressure/io` | PSI IO pressure |

### Per-Process /proc/PID

| Path | Contents |
|---|---|
| `/proc/PID/status` | State, memory, UID, threads |
| `/proc/PID/limits` | Resource limits |
| `/proc/PID/fd/` | Open file descriptors |
| `/proc/PID/cgroup` | cgroup membership |
| `/proc/PID/oom_score` | OOM kill likelihood |
| `/proc/PID/oom_score_adj` | OOM score adjustment |
| `/proc/PID/cmdline` | Full command (NUL-separated) |
| `/proc/PID/environ` | Environment at launch |
| `/proc/PID/maps` | Memory map |
| `/proc/PID/smaps_rollup` | Memory summary |
| `/proc/PID/net/tcp` | TCP sockets |
| `/proc/PID/task/` | Per-thread status |

---

## /sys Key Paths Reference

| Path | Contents |
|---|---|
| `/sys/block/<dev>/queue/scheduler` | I/O scheduler (mq-deadline, none, bfq) |
| `/sys/block/<dev>/stat` | Device IO stats |
| `/sys/block/<dev>/queue/nr_requests` | Queue depth |
| `/sys/fs/cgroup/` | cgroup v2 hierarchy |
| `/sys/kernel/mm/transparent_hugepage/enabled` | THP mode |
| `/sys/class/net/<iface>/statistics/` | NIC counters |
| `/sys/class/net/<iface>/mtu` | Interface MTU |
| `/sys/class/net/<iface>/speed` | Interface speed |

---

## strace / ltrace Patterns

```bash
strace -p PID                         # attach to running process
strace -tt -T -p PID                  # timestamps + time per syscall
strace -p PID -e trace=network        # network syscalls only
strace -p PID -e trace=file           # file access syscalls only
strace -p PID -e trace=process        # process lifecycle syscalls
strace -c -p PID sleep 30            # frequency summary over 30s
strace -f -o /tmp/trace.log command  # trace including forks
strace -e read,write -p PID          # specific syscalls

ltrace -p PID                         # library calls (not syscalls)
```

Common patterns and meanings:

| Pattern | Meaning |
|---|---|
| `connect() ETIMEDOUT` | Network unreachable or firewalled |
| `open() ENOENT` | Missing file or config |
| `read()` blocking | Waiting on socket or file |
| `futex()` blocking | Lock contention |
| `EACCES` on `open()` | Permission denied |
| Rapid `read()`/`write()` | Normal busy I/O |

---

## perf One-Liners

```bash
perf top                                           # real-time hot functions
perf top -p PID                                    # limit to one process
perf stat -p PID sleep 10                         # hardware counters
perf stat -e cache-misses,cache-references -p PID sleep 10
perf record -g -F 99 -p PID sleep 30             # call graph recording
perf report                                        # analyze recording
perf script | ./FlameGraph/stackcollapse-perf.pl | ./FlameGraph/flamegraph.pl > flame.svg
```

---

## awk / sed / grep Log Analysis One-Liners

```bash
# Count HTTP status codes from nginx access log:
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Error frequency from any log:
grep -i error /var/log/*.log | sort | uniq -c | sort -rn | head -20

# Top IPs by request count:
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head

# Socket state summary:
ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c

# Remove comment lines:
sed '/^#/d' /etc/app/config.conf | sed '/^$/d'

# In-place replacement:
sed -i.bak 's/listen_address=127.0.0.1/listen_address=0.0.0.0/g' /etc/app/config.conf

# Extract field from colon-separated file:
awk -F: '{print $1, $3}' /etc/passwd    # username and UID

# Sum a column:
awk '{sum += $2} END {print sum}' data.txt

# Print lines between two patterns:
sed -n '/ERROR BEGIN/,/ERROR END/p' app.log

# Grep with context:
grep -A5 -B5 "stack trace" /var/log/app.log
```

---

## find Power Patterns

```bash
# By modification time:
find /var/log -mtime -1          # modified in last 24 hours
find /tmp -mtime +7 -delete      # delete files older than 7 days
find /etc -newer /etc/passwd     # modified more recently than /etc/passwd

# By size:
find / -xdev -size +1G -ls 2>/dev/null
find / -xdev -size +500M -type f -ls 2>/dev/null

# By permissions:
find /etc -type f -perm -004     # world-readable files
find /var -type f -perm -002     # world-writable files (security risk)
find / -perm -4000 -type f       # setuid files

# Execute:
find /var/log -name "*.gz" -exec rm {} \;
find /var/log -name "*.gz" | xargs rm
find . -name "*.conf" -exec grep -l "password" {} \;

# Inode consumers:
find /var -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head
```

---

## rsync Patterns

```bash
rsync -avz local-dir/ user@host:/remote/          # sync to remote
rsync -avz user@host:/remote/ local-dir/          # sync from remote
rsync -avz --dry-run local-dir/ user@host:/remote/ # preview
rsync -avz --exclude '*.log' local-dir/ user@host:/remote/
rsync -avz --exclude-from=exclude.txt local-dir/ user@host:/remote/
rsync -avz --delete local-dir/ user@host:/remote/ # delete files not in source
rsync -avz --bwlimit=10000 local-dir/ user@host:/remote/ # 10 MB/s limit
rsync -avz -e "ssh -i ~/.ssh/key.pem" local/ user@host:/remote/
rsync --progress -avz large-file.tar user@host:/path/  # show progress
```

---

## tcpdump Patterns

```bash
tcpdump -i eth0 port 80 -n                          # HTTP on eth0
tcpdump -i any host 10.0.0.12 -n                    # traffic to/from host
tcpdump -i eth0 src 10.0.0.5 -n                     # traffic from source IP
tcpdump -i eth0 dst 10.0.0.10 -n                    # traffic to destination IP
tcpdump -i eth0 port 443 and host api.example.com -n
tcpdump -i eth0 -w /tmp/capture.pcap                # write to file
tcpdump -r /tmp/capture.pcap                        # read saved file
tcpdump -i eth0 -w /tmp/cap.pcap -C 100             # rotate at 100 MB
tcpdump -i eth0 'tcp[tcpflags] == tcp-syn' -n       # SYN packets only
tcpdump -i eth0 'tcp[tcpflags] & tcp-rst != 0' -n  # RST packets
tcpdump -vvv -i eth0 port 53 -n                     # verbose DNS
```

Always use `-n` to avoid reverse DNS lookups slowing the capture.

---

## iptables / nftables Quick Reference

```bash
# iptables:
iptables-save                                       # dump all rules
iptables -L -n -v                                   # list with counters
iptables -L INPUT -n -v --line-numbers             # INPUT chain with line numbers
iptables -I INPUT -p tcp --dport 8443 -j ACCEPT    # insert rule at top
iptables -A INPUT -p tcp --dport 8443 -j ACCEPT    # append rule
iptables -D INPUT -p tcp --dport 8443 -j ACCEPT    # delete rule
iptables -F INPUT                                   # flush INPUT chain
iptables-save > /etc/iptables/rules.v4              # persist (Debian/Ubuntu)

# nftables:
nft list ruleset                                    # show all rules
nft add rule inet filter input tcp dport 8443 accept
nft list counters                                   # show packet counters
```

---

## Disk: fdisk, parted, mkfs, mount

```bash
# Block device info:
lsblk                               # block device tree
lsblk -f                            # with filesystem type and UUID
blkid /dev/sdb                      # filesystem UUID and type
fdisk -l /dev/sdb                   # partition table

# Partitioning:
fdisk /dev/sdb                      # interactive MBR partitioning
parted /dev/sdb                     # GPT-capable interactive
parted -l                           # list all partitions

# Formatting:
mkfs.ext4 /dev/sdb1                 # create ext4 filesystem
mkfs.xfs /dev/sdb1                  # create XFS filesystem
mkfs.ext4 -i 8192 /dev/sdb1        # ext4 with more inodes (bytes-per-inode=8192)

# Mounting:
mount /dev/sdb1 /data               # mount
mount -o remount,rw /var            # remount read-write
mount -o ro /dev/sdb1 /mnt/inspect  # mount read-only
umount /data                        # unmount
umount -f -l /data                  # force + lazy unmount (for stuck NFS)

# SMART health:
smartctl -a /dev/nvme0n1            # full SMART data
smartctl -H /dev/sda               # health check only
```

---

## cgroup v2 Quick Reference

```bash
# Check if cgroup v2 is active:
stat -fc %T /sys/fs/cgroup/    # cgroup2fs = v2

# Key files:
/sys/fs/cgroup/<path>/cpu.max              # "quota period_us" (e.g., "200000 100000" = 2 CPUs)
/sys/fs/cgroup/<path>/memory.max          # hard memory limit in bytes
/sys/fs/cgroup/<path>/memory.current      # current usage
/sys/fs/cgroup/<path>/cpu.stat            # nr_periods, nr_throttled, throttled_time
/sys/fs/cgroup/<path>/memory.stat         # rss, cache, pgmajfault, etc.
/sys/fs/cgroup/<path>/io.max              # block I/O limits
/sys/fs/cgroup/<path>/pids.max            # process count limit
/sys/fs/cgroup/<path>/cgroup.procs        # PIDs in this cgroup

# Find a process's cgroup:
cat /proc/PID/cgroup

# Navigate:
systemd-cgls                              # tree view
systemd-cgtop                             # live usage by cgroup
```

---

## Filesystem

```bash
pwd
ls -la
ls -li
stat file.txt
find /var/log -type f -name "*.log"
```

Important paths:

```text
/etc    config
/var    logs and variable data
/tmp    temporary files, usually 1777
/proc   live process/kernel data
/sys    kernel subsystem data
/dev    device files
/run    runtime state since boot
```

Links:

```bash
ln file hardlink
ln -s /path/to/file symlink
```

---

## Permissions

```bash
ls -l file
ls -ld directory
chmod 755 script.sh
chmod 644 config.yml
chmod 600 private-key.pem
chmod 1777 /tmp
chmod u+s /usr/bin/binary     # setuid
chmod g+s /shared/dir         # setgid
chown user:group file
namei -l /path/to/file        # full path permission check
umask                         # show current default mask
```

Permission numbers:

```text
r=4, w=2, x=1
755 = rwxr-xr-x
644 = rw-r--r--
600 = rw-------
4755 = setuid + 755
```

---

## Users And Groups

```bash
id
id username
whoami
groups username
getent passwd username
cat /etc/passwd
cat /etc/group
sudo -l
useradd -m -s /bin/bash appuser
usermod -aG sudo appuser
userdel -r appuser
```

---

## Processes

```bash
ps aux
ps -ef --forest
pgrep -af nginx
top
htop
kill -15 PID     # SIGTERM
kill -9 PID      # SIGKILL
kill -1 PID      # SIGHUP
pkill -f pattern
lsof -p PID
strace -p PID
cat /proc/PID/status
cat /proc/PID/limits
ls /proc/PID/fd | wc -l
```

States:

```text
R running/runnable
S sleeping
D uninterruptible sleep (disk/kernel IO)
Z zombie (parent not calling wait())
T stopped
```

---

## CPU And Load

```bash
uptime
vmstat 1 5
mpstat -P ALL 1 5
pidstat -u 1 5
ps aux --sort=-%cpu | head
perf top
```

CPU fields:

```text
us: user-space
sy: kernel/system
id: idle
wa: iowait (CPUs idle waiting for disk)
st: steal (hypervisor taking cycles, cloud VMs)
```

D-state:

```bash
ps aux | awk '$8 ~ /D/ {print}'
```

---

## Memory

```bash
free -h
cat /proc/meminfo
vmstat 1 5
ps aux --sort=-%mem | head
cat /proc/PID/status | grep -E 'VmRSS|VmSize|Threads'
```

OOM:

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
cat /proc/PID/oom_score
cat /proc/PID/oom_score_adj
```

Rule:

```text
available memory matters more than free memory
swap activity is latency risk
direct reclaim causes P99 spikes before OOM
```

---

## Disk And Inodes

```bash
df -h
df -i
lsblk
findmnt
sudo du -sh /var/* | sort -rh | head
sudo find / -xdev -type f -size +1G -ls 2>/dev/null
sudo lsof +L1                           # deleted-but-open files
iostat -xz 1 5
sudo iotop -ao
```

---

## Network

```bash
ip addr
ip route
ip route get 8.8.8.8                    # which path to a destination
ip -s link                              # interface stats with errors
ss -lntp
ss -tulnp
ss -tanp
ss -s
curl -vk https://example.com
nc -vz host 443
dig example.com
dig @8.8.8.8 example.com
resolvectl status
mtr host
tcpdump -i eth0 port 80 -n
conntrack -S
conntrack -L | wc -l
```

Interpretation:

```text
connection refused: host reached, port closed
timeout: route/firewall/drop
NXDOMAIN: DNS name does not exist
CLOSE_WAIT: app did not close socket after peer closed
TIME_WAIT: recently closed, held for 2*MSL
SYN_SENT: waiting for remote response
```

---

## Logs

```bash
journalctl -p err -n 100 --no-pager
journalctl -u SERVICE --since "1 hour ago"
journalctl --since "2026-05-17 10:00" --until "2026-05-17 10:30"
journalctl -k -n 100 --no-pager
dmesg -T | tail -100
tail -f /var/log/syslog
grep -i error /var/log/app.log
grep -i error /var/log/*.log | sort | uniq -c | sort -rn | head -20
```

---

## Safe Mitigation Rules

```text
observe before changing
prefer graceful stop before force kill
preserve logs during incident
free disk by removing safe files only
restart one instance before whole fleet
check health after mitigation
write down what changed
collect dmesg/journal before reboot
```
