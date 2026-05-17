---
title: "🐧 Linux & Systems"
sidebar_position: 9
description: "Zero to hero study guide for Linux & Systems — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

Linux powers over 90% of cloud infrastructure, web servers, embedded systems, and supercomputers. Kubernetes nodes run Linux. Docker runs Linux containers. Cloud VMs run Linux. As a Staff/Principal SRE, deep Linux knowledge is the foundation for understanding why systems behave the way they do under load, during incidents, and at the edges of their design.

---

## Mental Models

**Everything is a file** — devices, processes, network sockets, kernel parameters — all exposed as files in the filesystem hierarchy. `/proc` is a live window into the kernel's state. `/sys` exposes kernel subsystem configuration. `/dev` is device interfaces.

**The process model** — all processes are children of PID 1. `fork()` creates a copy, `exec()` replaces the process image. Understanding the process tree explains why killing a parent leaves orphans and why signals propagate the way they do.

**Kernel space vs user space** — applications run in user space and cannot directly touch hardware. System calls (read, write, fork, ioctl) cross the boundary. The kernel validates and mediates all hardware access.

---

## Linux Filesystem Hierarchy (FHS)

```
/           Root of the filesystem tree
├── /boot   Kernel, GRUB bootloader config
├── /etc    All system-wide configuration files
├── /var    Variable data: logs (/var/log), spool, databases
├── /tmp    Temporary files (cleared on reboot) — must be chmod 1777
├── /proc   Virtual FS: live kernel and process info (not on disk)
├── /sys    Virtual FS: kernel subsystem and hardware configuration
├── /dev    Device files (block devices, character devices)
├── /bin    Essential binaries (often symlink to /usr/bin today)
├── /usr    User programs, shared libraries, include files
├── /home   User home directories
├── /root   Root user's home directory
├── /opt    Optional third-party software
├── /mnt    Temporary mount points
├── /run    Runtime data for processes started since last boot (PIDs, locks)
└── /srv    Service data (web server files, etc.)
```

**Key facts:**
- `/etc` — every configuration file lives here. Change hostname: edit `/etc/hostname` and `/etc/hosts`, then run `hostnamectl set-hostname newname`
- `/tmp` — world-writable with sticky bit. Correct permission is `1777`. If apps can't create files in `/tmp`, check: `ls -ld /tmp` and restore with `sudo chmod 1777 /tmp`
- `/proc` — not on disk. `cat /proc/meminfo` shows live memory stats. `cat /proc/PID/fd/N` lets you read a file descriptor still open by a running process (useful for recovering deleted-but-open files)
- `/etc/passwd`, `/etc/shadow`, `/etc/group` — user account database, password hashes, group membership

**Inodes** — the filesystem's metadata record for every file (permissions, ownership, timestamps, block pointers). Filenames are directory entries pointing to inodes. Hard links are multiple entries pointing to the same inode. Check inode numbers with `ls -i`.

---

## File Permissions

```
-rwxr-xr--  1  owner  group  4096  Jan 1 12:00  filename
│└┬┘└┬┘└┬┘
│ │  │  └── Other:  r-- = read only
│ │  └───── Group:  r-x = read + execute
│ └──────── Owner:  rwx = read + write + execute
└────────── Type: - file, d dir, l symlink, c char device, b block device
```

**Numeric permissions:** r=4, w=2, x=1:
- `chmod 755` = rwxr-xr-x (owner all, group+other read+execute)
- `chmod 644` = rw-r--r-- (owner read+write, group+other read only)
- `chmod 600` = rw------- (owner read+write, no access for others)
- `chmod 1777` = rwxrwxrwt (world-writable + sticky bit, used on /tmp)

**Special bits:**
- `setuid (4000)` — execute with owner's permissions (e.g., `passwd`, `sudo`)
- `setgid (2000)` — execute with group permissions; on directories, new files inherit group
- `sticky bit (1000)` — on directories: only owner can delete their own files

**umask** — default permission mask subtracted from 666 (files) or 777 (dirs). `umask 022` gives files 644, dirs 755.

**ACLs** — beyond standard permissions:
```bash
getfacl /path/to/file          # view access control list
setfacl -m u:username:rw file  # give specific user rw access
chattr +i file                 # make file immutable (even root can't delete)
lsattr file                    # list file attributes
```

**Fix permissions — common scenarios:**
```bash
# Q: User can see a file (ls) but cannot edit it
ls -l /path/to/file
sudo chown username:groupname /path/to/file  # fix ownership
sudo chmod u+w /path/to/file                 # or add write permission

# Q: Script is executable by one user but not another
# Check group membership and file group ownership
id username                          # show user's groups
ls -l script.sh                      # check owner/group/permissions
sudo chmod g+x script.sh             # add execute for group

# Q: Permission denied when creating file under /tmp
ls -ld /tmp                          # should show drwxrwxrwt
sudo chmod 1777 /tmp                 # restore sticky bit + world-writable
```

---

## User and Group Management

```bash
# Create, manage users
useradd username                      # create user
useradd -m -s /bin/bash -G sudo username  # create with home, bash, sudo group
passwd username                       # set or change password
userdel -r username                   # delete user and home directory
usermod -aG groupname username        # add user to a group

# Check user info
id username                           # UID, GID, groups
who                                   # who is logged in
w                                     # who logged in + what they're doing
last                                  # login history

# Groups
groupadd groupname
groupdel groupname
groups username                       # list user's groups

# Sudo access
visudo                                # edit /etc/sudoers safely
# Add line: username ALL=(ALL:ALL) ALL
# Or for specific command: username ALL=(ALL) /usr/bin/systemctl

# Password aging
chage -l username                     # view password expiry info
chage -M 90 username                  # max 90 days before password expires
chage -E 2025-12-31 username          # account expires on date
```

**Scenario — user complains they cannot log in:**
1. Check if account is locked: `passwd -S username` (look for "L" in output)
2. Check if account is expired: `chage -l username`
3. Check `/etc/passwd` — is shell set to `/sbin/nologin`?
4. Check auth logs: `sudo journalctl -u sshd` or `tail /var/log/auth.log`
5. Check if home directory exists: `ls -la /home/username`

**Scenario — user was added to sudoers but sudo still doesn't work:**
- Log out and log back in (group membership changes require new session)
- Verify with `groups` or `id` that the group shows up
- Check sudoers for syntax errors: `sudo visudo -c`

---

## Process Management

```bash
ps aux                           # all processes, detailed
ps -ef --forest                  # process tree view
top                              # interactive process viewer
htop                             # improved interactive viewer (if installed)

# Signals
kill -15 PID                     # SIGTERM: graceful shutdown (default)
kill -9 PID                      # SIGKILL: immediate, uncatchable
kill -1 PID                      # SIGHUP: reload config
pkill -f "pattern"               # kill by command pattern
killall processname              # kill all by name

# Priority
nice -n 10 command               # start with lower priority (range -20 to 19)
renice -n 5 -p PID               # change priority of running process

# Background jobs
command &                        # run in background
jobs                             # list background jobs
fg %1                            # bring job 1 to foreground
bg %1                            # resume stopped job in background
nohup command &                  # persist after terminal closes
```

**Process states:**
- R — Running or runnable (in run queue)
- S — Sleeping/interruptible (waiting for event)
- D — Uninterruptible sleep — usually waiting for disk I/O. High D count = I/O bottleneck
- Z — Zombie (process exited, parent hasn't called `wait()`)
- T — Stopped

**Signals summary:**
- SIGTERM (15) — polite shutdown. Processes can catch it for graceful cleanup
- SIGKILL (9) — uncatchable, kernel terminates immediately
- SIGINT (2) — Ctrl+C
- SIGHUP (1) — traditionally reloads daemon config
- SIGUSR1/SIGUSR2 — application-defined

**Zombie processes** — consume a PID slot but no memory. Accumulation → PID table exhaustion:
```bash
ps aux | grep Z                  # find zombie processes
# Fix: restart the parent process, or kill it (zombies get adopted by init)
```

**Scenario — service consuming 100% CPU:**
```bash
top                              # find PID with high %CPU
ps aux --sort=-%cpu | head -10   # sort by CPU usage
strace -p PID                    # see what system calls it's making
lsof -p PID                      # what files does it have open
kill -15 PID                     # try graceful stop first
kill -9 PID                      # force kill if not responding
```

**Scenario — finding and killing processes using a file:**
```bash
lsof | grep filename             # find process with file open
lsof +D /mnt/partition           # find all processes using a directory
fuser /mnt/partition             # simpler: show PIDs using a path
```

---

## Memory Management

```bash
free -h                          # memory overview (human readable)
free -m                          # in megabytes
cat /proc/meminfo                # detailed memory stats
vmstat 1 10                      # memory + swap + cpu stats, 10 samples at 1s interval
```

**Output interpretation:**
- `available` (not `free`) is what matters — free + reclaimable cache
- Buffers/Cache — disk cache. Linux uses all free RAM for cache. This is correct behavior, not a leak
- `si`/`so` (swap in/swap out) in vmstat — if non-zero, system is swapping (serious problem)

**Memory types:**
- RSS (Resident Set Size) — actual physical RAM the process uses
- VSZ (Virtual Memory Size) — total virtual address space (includes shared libs, mmap)

**OOM Killer** — when memory is exhausted, kernel invokes OOM killer. It scores processes and kills the highest scorer. Check if it fired:
```bash
dmesg | grep -i 'oom'           # kernel ring buffer for OOM events
free -m                          # check current memory state
```

**Swap:**
```bash
# Create a swap file
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

# Check swap usage
swapon --show
cat /proc/swaps
```

---

## Disk & Storage Management

```bash
# Disk space
df -h                            # disk usage per filesystem
df -i                            # inode usage (important when df -h shows space but can't create files)
du -sh /path/*                   # directory sizes
du -ah / | sort -rh | head -20   # find largest files/dirs on system
du -sh /* 2>/dev/null            # top-level directory sizes

# Block devices
lsblk                           # block devices and partition layout
fdisk -l                        # partition tables (detailed)
blkid                           # UUID and filesystem type of devices

# Filesystem operations
mount | column -t               # mounted filesystems
mount -o remount,rw /           # remount root read-write (after crash)
umount /mnt/partition           # unmount
umount -l /mnt/nfs              # lazy unmount (for NFS with stale handles)

# I/O performance
iostat -x 1                    # I/O stats per device, 1-second intervals
iotop                          # per-process I/O usage

# Filesystem check and repair
umount /dev/sdXn               # must unmount first
fsck -y /dev/sdXn              # check and auto-repair
# Or in rescue mode: sudo fsck /dev/sdX
```

**Filesystem types:**
- ext4 — reliable, widely supported, good general purpose, journaling
- xfs — better for large files and parallel I/O, good for databases, default on RHEL/CentOS
- btrfs — copy-on-write, snapshots, checksums — higher overhead
- tmpfs — RAM-backed, fast, disappears on reboot (used for /tmp, /dev/shm)

**LVM (Logical Volume Manager):**
```bash
# Concepts: Physical Volumes (PVs) → Volume Group (VG) → Logical Volumes (LVs) → Filesystems

# Add new disk
pvcreate /dev/sdb               # initialize as physical volume
vgextend myvg /dev/sdb          # add to volume group
lvextend -L +10G /dev/myvg/mylv # extend logical volume
resize2fs /dev/myvg/mylv        # resize ext4 filesystem (no unmount needed)
xfs_growfs /mountpoint          # resize xfs (use mountpoint, not device)

# Check LVM
pvs                             # physical volumes
vgs                             # volume groups
lvs                             # logical volumes
lvdisplay /dev/myvg/mylv        # detailed LV info
```

**Scenario — disk full (`No space left on device`):**
```bash
df -h                                    # identify which partition is full
du -ah / | sort -rh | head -20           # find largest files
# Common culprits:
ls -lh /var/log/                         # large log files
journalctl --disk-usage                  # journal size
journalctl --vacuum-size=500M            # trim journal

# File deleted but space not freed:
lsof | grep deleted                      # process still holds file open
# Kill that process or restart the service to free space
```

**Scenario — `df -h` and `du -sh` show different usage:**
A process has a deleted file still open. The disk block is still allocated. Find it:
```bash
lsof | grep deleted              # find the process holding deleted file open
```

**Inode exhaustion** — `df -h` shows space but can't create files:
```bash
df -i                            # check inode usage
# /tmp full of many tiny files (e.g., session files, crash dumps)
find /tmp -type f | wc -l        # count files in /tmp
```

**Recover a deleted file while process has it open:**
```bash
lsof | grep deleted              # find PID and FD number
cp /proc/PID/fd/FD /path/to/recovered_file
```

**Partition extension without unmounting (LVM):**
```bash
lvextend -L +10G /dev/vg0/lv0   # extend LV
resize2fs /dev/vg0/lv0          # grow ext4 online
```

**Add a new disk to a Linux server:**
```bash
lsblk                            # confirm new disk (e.g., /dev/sdb)
fdisk /dev/sdb                   # partition it (n → primary → defaults → w)
mkfs.ext4 /dev/sdb1              # create filesystem
mkdir /data
mount /dev/sdb1 /data
# For persistence:
blkid /dev/sdb1                  # get UUID
echo 'UUID=xxx /data ext4 defaults 0 2' >> /etc/fstab
```

**RAID check:**
```bash
cat /proc/mdstat                 # RAID array status
mdadm --detail /dev/md0          # detailed RAID info
```

---

## Networking

```bash
# Modern tools (use these, not ifconfig/netstat)
ip addr show                     # show interfaces and IPs
ip addr add 192.168.1.10/24 dev eth0  # add IP to interface
ip route show                    # routing table
ip neigh                         # ARP table
ip link set eth0 up/down         # bring interface up/down

# Sockets
ss -tulpn                        # listening sockets with process info
ss -t state established          # established TCP connections
ss -s                            # socket statistics summary

# DNS
nslookup hostname                # DNS lookup
dig hostname                     # DNS lookup (detailed)
dig +short hostname              # just the IP
dig -x IP                        # reverse DNS lookup

# Connectivity debugging
ping -c 4 8.8.8.8                # basic connectivity test
traceroute hostname               # path to host
curl -v --trace-time url         # detailed HTTP timing with timestamps
curl -o /dev/null -w "%{time_total}\n" url  # measure response time

# Packet capture
tcpdump -i eth0 port 80          # capture packets on port 80
tcpdump -i eth0 host 10.0.0.1   # capture traffic to/from host
tcpdump -w capture.pcap          # write to file for Wireshark analysis

# TLS inspection
openssl s_client -connect host:443  # test TLS connection and view cert
```

**Key network configuration files:**
- `/etc/hosts` — static hostname resolution (checked before DNS)
- `/etc/resolv.conf` — DNS servers
- `/etc/nsswitch.conf` — name service switch: order of resolution (files, dns, etc.)

**TCP states:** ESTABLISHED, LISTEN, TIME_WAIT, CLOSE_WAIT, SYN_SENT.
- `TIME_WAIT` is normal — port held for 2×MSL after connection close. Too many = port exhaustion risk
- Tuning: `net.ipv4.tcp_tw_reuse = 1`

**Firewall:**
```bash
# Ubuntu/Debian (ufw)
sudo ufw status
sudo ufw allow ssh
sudo ufw allow 8080/tcp
sudo ufw enable

# RHEL/CentOS (firewalld)
sudo firewall-cmd --list-all
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --reload

# iptables (raw)
iptables -L -n -v                # list all rules with counts
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
```

**Scenario — SSH connection refused:**
```bash
sudo systemctl status sshd       # is SSH service running?
sudo systemctl start sshd        # start if stopped
sudo ufw allow ssh               # open firewall
# Check sshd config:
sudo sshd -t                     # test config for errors
# Check /etc/ssh/sshd_config:
# PermitRootLogin, PasswordAuthentication, AllowUsers
```

**Scenario — ping works but SSH fails by hostname:**
- `/etc/hosts` may have wrong IP for that hostname
- DNS may be returning different IP than expected
- Check: `dig hostname` vs `cat /etc/hosts | grep hostname`
- Resolution order: `cat /etc/nsswitch.conf | grep hosts`

**Scenario — cannot SSH into remote machine:**
```bash
ssh -v user@host                 # verbose SSH for debugging
# Common causes:
# 1. SSH service not running on remote
# 2. Firewall blocking port 22
# 3. Wrong SSH key / key not in authorized_keys
# 4. AllowUsers in sshd_config doesn't include user
# 5. SELinux blocking on remote
```

---

## System Monitoring and Performance

### 60-Second Performance Assessment

```bash
uptime                           # load averages (1, 5, 15 min) + uptime
dmesg | tail -20                 # recent kernel messages (OOM kills, errors)
vmstat 1 3                       # overall system stats: cpu, memory, io, swap
mpstat -P ALL 1 1               # per-CPU utilization breakdown
pidstat 1 1                      # per-process CPU usage
iostat -xz 1 1                  # disk I/O: %util, await, IOPS
free -m                          # memory overview
sar -n DEV 1 1                  # network interface utilization
sar -n TCP,ETCP 1 1             # TCP stats: active, passive, retrans
top                              # identify top CPU/memory consumers
```

### Interpreting `top` output

```
top - 14:30:01 up 45 days, load average: 1.23, 0.87, 0.65
Tasks: 234 total, 2 running, 232 sleeping
%Cpu(s): 12.5 us, 3.2 sy, 0.0 ni, 82.1 id, 1.8 wa, 0.0 hi, 0.4 si
         └user  └system            └idle  └iowait         └softirq
MiB Mem: 15873.2 total, 1234.5 free, 8456.7 used, 6181.9 buff/cache
```

- `iowait` (`wa`) > 20% — disk I/O bottleneck. Use `iostat -x` next
- `softirq` (`si`) > 10% — network interrupt processing under load (consider RSS)
- Load > number of CPU cores — CPU saturation, processes waiting in run queue

**Load average interpretation:**
- Load=4.0 on 4 cores = 100% busy (saturated)
- Load=4.0 on 8 cores = 50% busy (fine)
- Sustained load > CPU count = saturation — check what's in the run queue

```bash
# Scenario — high load average but low CPU utilization
# This means processes are blocking on I/O (state D)
iostat -x 1                     # check await (latency) and %util
vmstat 1                        # check b column (blocked processes)
ps aux | grep " D "             # find processes in uninterruptible sleep
```

### Monitoring memory in real time

```bash
watch -n 1 free -m               # refresh every 1 second
vmstat 1                         # si/so columns: swap in/swap out activity
cat /proc/meminfo | grep -E 'MemTotal|MemAvailable|SwapTotal|SwapFree'
```

### Log analysis

```bash
# systemd journal
journalctl -u servicename -f     # follow service logs
journalctl -u servicename --since "1 hour ago"
journalctl -p err                # only error-level and above
journalctl -xb                   # this boot, with explanations
journalctl --disk-usage          # how much space journal uses

# Traditional log files
tail -f /var/log/syslog          # follow system log (Debian/Ubuntu)
tail -f /var/log/messages        # (RHEL/CentOS)
tail -f /var/log/auth.log        # authentication events

# Find errors across logs
grep -r "ERROR\|CRITICAL\|FATAL" /var/log/
grep "Out of memory" /var/log/kern.log
dmesg | grep -i 'error\|fail\|oom'
```

### Cron and Scheduled Jobs

```bash
crontab -e                       # edit current user's crontab
crontab -l                       # list current user's crontab
crontab -l -u username           # list another user's crontab
cat /etc/crontab                 # system-wide crontab
ls /etc/cron.d/                  # per-package cron jobs
ls /etc/cron.daily/              # daily scripts

# Cron syntax: minute hour day month weekday command
# Schedule script every hour:
0 * * * * /path/to/script.sh
# Every day at 2:30 AM:
30 2 * * * /path/to/backup.sh
# Every 5 minutes:
H/5 * * * * /path/to/check.sh   # Jenkins-style
*/5 * * * * /path/to/check.sh   # standard cron
```

**Scenario — crontab not running:**
1. Check cron service: `systemctl status cron` (or `crond` on RHEL)
2. Check cron logs: `grep CRON /var/log/syslog`
3. Verify script is executable: `ls -l /path/to/script.sh`
4. Test script manually as cron user
5. Check for environment variable issues — cron has minimal PATH. Use full paths in scripts
6. Redirect output to log: `* * * * * /script.sh >> /tmp/cron.log 2>&1`

---

## systemd and Service Management

```bash
systemctl status nginx           # show service status with recent logs
systemctl start/stop/restart nginx
systemctl reload nginx           # reload config without restart
systemctl enable/disable nginx   # start on boot
systemctl list-units --failed    # show all failed units
systemctl list-units --type=service  # all service units
systemd-analyze blame            # boot time contribution per service
systemd-analyze critical-chain   # longest boot path

# Logs
journalctl -u nginx -f           # follow nginx logs
journalctl -u nginx -n 50        # last 50 lines
journalctl -u nginx --since "10 minutes ago"
```

**Writing a systemd unit file:**
```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application
After=network.target
Requires=postgresql.service

[Service]
Type=exec
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/server --config /etc/myapp/config.yaml
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5s
LimitNOFILE=65536
LimitNPROC=4096
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload          # reload after editing unit files
systemctl enable --now myapp     # enable and start immediately
```

**Key settings explained:**
- `Restart=on-failure` — restarts if process exits non-zero
- `LimitNOFILE=65536` — file descriptor limit (critical for services handling many connections)
- `After=` — ordering only, not hard dependency
- `Requires=` — hard dependency (fails if dependency fails)

**Scenario — service not starting:**
```bash
sudo journalctl -xe | grep servicename   # check detailed error logs
sudo journalctl -u servicename -n 50     # recent service logs
systemctl status servicename             # status with last log lines
# Check config file for errors:
nginx -t                                 # nginx config test
apache2ctl configtest                    # apache config test
```

**Port conflicts — service fails to bind:**
```bash
ss -tulpn | grep :8080           # what's using port 8080?
lsof -i :8080                    # process using that port
```

---

## Package Management

**Debian/Ubuntu (apt):**
```bash
sudo apt update                  # update package lists
sudo apt upgrade                 # upgrade installed packages
sudo apt install packagename     # install package
sudo apt remove packagename      # remove (keep config files)
sudo apt purge packagename       # remove including config files
sudo apt autoremove              # remove unused dependencies
sudo apt search keyword          # search packages
dpkg -l | grep packagename       # check if installed
dpkg -L packagename              # list files installed by package

# Fix broken packages
sudo apt --fix-broken install
sudo apt clean && sudo apt autoremove
sudo apt install -f
```

**RHEL/CentOS (yum/dnf):**
```bash
sudo yum update                  # (or dnf update)
sudo yum install packagename
sudo yum remove packagename
sudo yum search keyword
rpm -qa | grep packagename       # check if installed
rpm -ql packagename              # list files from package
yum history                      # package installation history
```

**Scenario — package installation failing:**
```bash
sudo apt update                  # refresh package lists first
sudo apt --fix-broken install    # fix broken dependencies
sudo apt clean                   # clear downloaded package cache
# If specific package fails:
sudo apt-get install -f packagename  # force dependency resolution
```

---

## Shell Scripting

**Basic bash script structure:**
```bash
#!/bin/bash
# Shebang must be first line — tells system which interpreter to use

# Variables
word="fun"
echo "Linux is $word"
NAME="DevOps"
echo "Hello, ${NAME}!"          # braces for clarity in strings

# Check current shell
echo $SHELL

# Make script executable and run
chmod +x myscript.sh
./myscript.sh
```

**Conditionals:**
```bash
#!/bin/bash
FILE="/etc/passwd"

if [ -f "$FILE" ]; then
    echo "File exists"
elif [ -d "$FILE" ]; then
    echo "Is a directory"
else
    echo "Does not exist"
fi

# Numeric comparison
if [ $count -gt 10 ]; then echo "Count > 10"; fi
# String comparison
if [ "$var" = "value" ]; then echo "Match"; fi
# Command success check
if ping -c 1 8.8.8.8 &>/dev/null; then echo "Network up"; fi
```

**Loops:**
```bash
#!/bin/bash

# For loop over list
for server in web01 web02 web03; do
    echo "Checking $server"
    ssh "$server" uptime
done

# For loop with range
for i in {1..5}; do
    echo "Iteration $i"
done

# While loop
count=0
while [ $count -lt 10 ]; do
    echo "Count: $count"
    ((count++))
done

# Read lines from file
while IFS= read -r line; do
    echo "Processing: $line"
done < /path/to/file
```

**Functions:**
```bash
#!/bin/bash

check_disk() {
    local threshold=${1:-90}        # parameter with default value
    local usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$usage" -gt "$threshold" ]; then
        echo "ALERT: Disk usage ${usage}% exceeds ${threshold}%"
        return 1
    fi
    return 0
}

check_disk 85
```

**Strict mode (recommended for production scripts):**
```bash
#!/bin/bash
set -euo pipefail
# -e: exit on error
# -u: error on undefined variable
# -o pipefail: pipe fails if any command fails
```

**Environment variables:**
```bash
export MYVAR="value"             # export to child processes
env | grep MYVAR                 # check if set
unset MYVAR                      # remove variable
printenv                         # print all environment variables
# Persist across sessions: add export to ~/.bashrc or ~/.profile
```

**Secure file transfer:**
```bash
scp file.txt user@remote:/path/to/destination    # secure copy
scp -r /local/dir user@remote:/remote/dir        # recursive
rsync -avz file.txt user@remote:/path/           # sync with progress
rsync -avz --delete /local/ user@remote:/remote/ # mirror (removes extra files)
```

---

## 100 Linux Errors and Solutions (Selected from PDF)

### Permission and Access Errors

**1. Permission Denied**
- Cause: User lacks permissions to execute or modify the file
- Solution: `sudo chmod +x script.sh` or fix ownership with `sudo chown user:group file`

**2. File Not Found (No such file or directory)**
- Cause: File doesn't exist or path is incorrect; OR missing shared library for a binary
- Solution: `ls -l /path/to/file` to verify; `ldd ./binaryfile` to check library deps; `file ./binaryfile` to check architecture

**3. Read-Only File System**
- Cause: Filesystem mounted read-only due to disk corruption or improper shutdown
- Solution: `mount -o remount,rw /` to remount; then `sudo fsck -y /dev/sdXn` to repair

**4. Too Many Open Files**
- Cause: System reached file descriptor limit
- Solution: `ulimit -n 100000` (temporary); persistent: add to `/etc/security/limits.conf`:
```
* soft nofile 65536
* hard nofile 65536
```
Also check in systemd unit: `LimitNOFILE=65536`

**5. Text File Busy**
- Cause: File in use by another process while trying to modify or delete it
- Solution: `lsof | grep filename` → `kill -9 <PID>`

**6. Stale NFS File Handle**
- Cause: NFS-mounted file was deleted or moved on remote system
- Solution: `umount -l /mnt/nfs` (lazy unmount) then `mount -a`

**7. Argument List Too Long**
- Cause: Too many arguments passed to a command (e.g., `rm *` on huge directory)
- Solution: `find /path -type f -delete` (avoids shell argument expansion)

**8. Process Killed Automatically (OOM Kill)**
- Cause: OOM killer terminated process due to memory exhaustion
- Solution: `free -m` to check memory; `dmesg | grep -i 'oom'` to confirm; increase swap or optimize app memory usage

**9. Zombie Processes**
- Cause: Parent process has not cleaned up child process
- Solution: `ps aux | grep Z` to find zombies; restart the parent process

**10. Segmentation Fault (core dumped)**
- Cause: Program attempted to access restricted memory
- Solution: `gdb ./program core` to debug; check application code or update dependencies

**11. Device is Busy (when unmounting)**
- Cause: A process is using the partition
- Solution: `lsof +D /mnt/partition` to find process; `kill -9 <PID>`; then `umount /mnt/partition`

**12. Fork Bomb / Too Many Processes**
- Cause: Process recursively creating child processes (e.g., `:(){ :|:& };:`)
- Solution: `ulimit -u 5000` (max processes per user); persistent: `/etc/security/limits.conf`

**13. Network Unreachable**
- Cause: Incorrect network config or firewall rule
- Solution: `ip a` to check interfaces; `systemctl restart NetworkManager`; check routing: `ip route show`

**14. Broken Symlink**
- Cause: Original file of symlink was moved or deleted
- Solution: `ls -l symlink_name` to verify target; `ln -sf /new/target/path symlink_name` to recreate

---

## 200 Scenario-Based Interview Q&As (Selected)

### File System & Storage Scenarios

**Q: How do you extend a partition without unmounting it?**
Use LVM. `lvextend -L +10G /dev/vg0/lv0` then `resize2fs /dev/vg0/lv0` for ext4 (online). XFS: `xfs_growfs /mountpoint`.

**Q: What happens when a file is deleted but is still in use by a process?**
The filesystem removes the directory entry (filename) but the inode and disk blocks remain allocated until the process releases the file descriptor. `df -h` still shows the space used. Fix: `lsof | grep deleted` to find the process, then restart it.

**Q: How do you recover a deleted file in Linux?**
If a process still has it open: `lsof | grep deleted` → `cp /proc/PID/fd/FD /path/to/recovered`. If no process: use `extundelete` on unmounted ext filesystem. Best: restore from backup.

**Q: How do you find large unused files across multiple partitions?**
```bash
find / -type f -size +100M -mtime +90 2>/dev/null   # files >100MB, not accessed in 90 days
du -ah / | sort -rh | head -20                       # largest files/dirs
ncdu /                                               # interactive disk usage browser
```

**Q: How do you copy a huge file across servers fastest?**
```bash
rsync -avz --progress source user@remote:/dest       # with progress
# For fastest raw transfer (no encryption):
nc -l 9999 | dd of=/dest/file &                     # receiver
dd if=/source/file | nc remote 9999                  # sender
```

**Q: How do you check disk I/O performance?**
```bash
iostat -x 1                     # await = latency ms, %util = saturation
iotop                           # per-process I/O
hdparm -tT /dev/sda             # raw disk read speed test
```

### Process and Performance Scenarios

**Q: A user reports the server is slow. Walk through your investigation:**
```bash
uptime                          # load average vs CPU count
top                             # top consumers
iostat -x 1                    # disk I/O bottleneck?
free -m                         # memory pressure / swapping?
ss -s                           # connection count
vmstat 1                        # overall system health
```

**Q: How do you monitor system load over time?**
```bash
sar -u 1 3                      # CPU utilization (3 samples)
sar -q 1 3                      # load average and run queue
vmstat 5                        # every 5 seconds
```

**Q: How to find all files modified in last 10 minutes?**
```bash
find / -type f -mmin -10 2>/dev/null
```

**Q: How to manage system updates automatically?**
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
# Config: /etc/apt/apt.conf.d/50unattended-upgrades
```

**Q: How to schedule a script to run every hour?**
```bash
crontab -e
# Add:
0 * * * * /path/to/script.sh
# Or using systemd timer (preferred for new systems)
```

### Networking Scenarios

**Q: Securing file transfers between servers:**
```bash
scp file.txt user@remote:/path/to/destination     # SCP over SSH
rsync -avz file.txt user@remote:/path/            # rsync with SSH
```

**Q: Handling high database connections:**
```bash
# PostgreSQL: edit postgresql.conf
max_connections = 200
# Use connection pooling (PgBouncer, PgPool) to reduce overhead
```

**Q: Optimizing database connections — check current connections:**
```bash
ss -tulpn | grep 5432            # PostgreSQL port
ss -t state established | grep 5432 | wc -l  # count active connections
```

---

## Linux Boot Process

1. BIOS/UEFI firmware initializes hardware, runs POST
2. GRUB bootloader loads from MBR/ESP, presents boot menu
3. GRUB loads kernel from `/boot` into memory
4. Kernel decompresses, initializes hardware, mounts initrd/initramfs
5. initramfs runs early userspace, finds and mounts root filesystem
6. Kernel mounts root filesystem, starts PID 1 (systemd)
7. systemd runs default target (usually `multi-user.target` or `graphical.target`)

**GRUB Issues:**

Symptoms: System doesn't boot, stuck at GRUB prompt (`grub-rescue>`), or "error: no such device"

```bash
# Recovery from Live CD/USB:
sudo mount /dev/sdXn /mnt          # mount root partition
sudo grub-install --root-directory=/mnt /dev/sdX  # reinstall GRUB
sudo update-grub                   # regenerate grub.cfg
```

**Kernel Panic:**

Symptoms: Black screen with panic messages; "Kernel panic – not syncing"

```bash
# Recovery: reboot and select older kernel from GRUB menu
# After boot, check logs:
journalctl -xb                     # this boot's logs with explanations
# Roll back kernel update if necessary
```

**Boot into rescue mode (forgot root password):**
1. At GRUB menu, press `e` to edit boot entry
2. Find line starting with `linux`, add `rw init=/bin/bash` at end
3. Press Ctrl+X to boot
4. `passwd root` to reset password
5. `exec /sbin/init` or reboot

---

## cgroups and Namespaces (Container Foundation)

**cgroups v2:** hierarchical resource limits. Every process belongs to a cgroup. Limits enforced: cpu.max, memory.max, io.max. Container memory limits = cgroup memory.max.

```bash
cat /proc/PID/cgroup              # which cgroup a process belongs to
ls /sys/fs/cgroup/                # cgroup hierarchy
cat /sys/fs/cgroup/memory.max     # memory limit for cgroup
```

**Namespaces:** isolation layers:
- `pid` — process tree isolation (PID 1 in container)
- `net` — separate network stack (own IP, interfaces)
- `mnt` — separate filesystem view
- `uts` — separate hostname/domainname
- `ipc` — separate shared memory
- `user` — UID/GID mapping (container root ≠ host root)

```bash
ls -la /proc/PID/ns/              # inspect process namespaces
```

---

## SSH Hardening

```ini
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers deploy ops
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
Port 2222                         # non-standard port (minor security through obscurity)
```

```bash
sudo sshd -t                      # test sshd config before reloading
sudo systemctl reload sshd        # apply config changes
```

---

## File Descriptor Limits

Many `too many open files` errors are FD exhaustion:

```bash
ulimit -n                         # current per-process FD limit (default: 1024)
cat /proc/sys/fs/file-max         # system-wide FD limit
lsof | wc -l                      # current open files system-wide
lsof -p PID | wc -l               # open files for specific process

# Temporary (current session):
ulimit -n 100000

# Permanent per-user (/etc/security/limits.conf):
* soft nofile 65536
* hard nofile 65536

# Permanent system-wide (/etc/sysctl.conf):
fs.file-max = 2097152
# Apply: sudo sysctl -p
```

---

## Kernel Tuning for Production

```bash
# View current sysctl settings
sysctl -a | grep net.ipv4.tcp

# TCP tuning for high connection rate
net.core.somaxconn = 65535        # listen backlog
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1         # reuse TIME_WAIT sockets
net.ipv4.tcp_fin_timeout = 30     # reduce FIN timeout

# File descriptor limits
fs.file-max = 2097152

# Memory
vm.swappiness = 10                # prefer RAM over swap (0-100)
vm.dirty_ratio = 15               # % of RAM that can be dirty before writeback

# Apply permanently
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
sudo sysctl -p                    # reload without reboot
```

**SonarQube Linux prerequisites (from PDF):**
```bash
# Check current values
sysctl vm.max_map_count           # need >= 524288
sysctl fs.file-max                # need >= 131072
ulimit -n                         # need >= 131072
ulimit -u                         # need >= 8192

# Set permanently
echo "vm.max_map_count=524288" >> /etc/sysctl.conf
echo "fs.file-max=131072" >> /etc/sysctl.conf
sudo sysctl -p

# In /etc/security/limits.conf (for SonarQube user):
sonarqube - nofile 131072
sonarqube - nproc 8192
```

---

## Security Considerations

**Principle of least privilege:**
- Run services as dedicated non-root users
- Use `setcap CAP_NET_BIND_SERVICE` instead of root for ports < 1024
- `sudo` for specific commands only, logged via auditd

**Auditd — kernel-level audit:**
```bash
auditctl -w /etc/passwd -p wa -k passwd_changes    # watch passwd file
ausearch -k passwd_changes                          # search audit log
aureport --login                                    # login report
```

**SELinux / AppArmor:**
```bash
getenforce                        # Enforcing, Permissive, or Disabled
setenforce 0                      # temporary permissive (for debugging)
ausearch -m AVC -ts recent        # find SELinux denials
audit2allow -a                    # generate policy from denials
```

**First action when sysadmin leaves company:**
```bash
# 1. Change root password immediately
passwd root

# 2. Lock or delete the user account
passwd -l username                # lock account
userdel -r username               # or delete entirely

# 3. Revoke SSH keys
# Remove from /home/username/.ssh/authorized_keys
# Remove from /root/.ssh/authorized_keys if they had root access

# 4. Review and rotate any service credentials they had access to
```

---

## Key Interview Questions and Answers

**Q: What is load average and how to interpret it?**
Load average shows the average number of processes in the run queue (or waiting for I/O) over 1, 5, and 15 minutes. Compare to CPU count. Load=4.0 on 4 CPUs = saturated. Load=4.0 on 8 CPUs = 50% utilized. Sustained load > CPU count = saturation.

**Q: A server has high load average but low CPU utilization — what's happening?**
Processes are blocking on disk I/O (state D = uninterruptible sleep). Check `iostat -x`: high `await` (latency) and `%util`. Also `vmstat`: `b` column shows processes blocked waiting for I/O. Solution: optimize disk I/O, add more disk, or move to faster storage.

**Q: How does a process get a port number < 1024?**
Must be root, OR have `CAP_NET_BIND_SERVICE` capability (via `setcap`), OR use authbind. Best practice: start as root, bind port, drop privileges to unprivileged user.

**Q: Explain the difference between a process and a thread:**
Processes have separate address spaces; threads share address space within a process. Context switch between threads is cheaper than between processes. All Linux threads are implemented as processes via `clone()` with shared resources.

**Q: What are the different types of shells?**
sh, bash, ksh, csh, zsh. Check current shell: `echo $SHELL`. Check available shells: `cat /etc/shells`.

**Q: What is the purpose of the sticky bit?**
On directories: only the file owner (or root) can delete or rename files, even if others have write permission on the directory. Used on `/tmp` (chmod 1777) so all users can create files but can't delete each other's.

**Q: What is NTP sync and how to fix time issues?**
```bash
timedatectl status               # check time sync status
timedatectl set-ntp true         # enable NTP sync
systemctl status systemd-timesyncd  # check sync daemon
chronyc tracking                 # if using chrony
```

**Q: Explain /etc/passwd, /etc/shadow, /etc/group:**
- `/etc/passwd` — user accounts: username, UID, GID, home dir, shell. World-readable
- `/etc/shadow` — password hashes and aging info. Readable only by root
- `/etc/group` — group definitions: group name, GID, members

**Q: How to check kernel version?**
```bash
uname -a                         # full kernel info
uname -r                         # kernel version only
cat /proc/version                # alternative
```

**Q: How to find recently changed files?**
```bash
find / -type f -mmin -10 2>/dev/null    # modified in last 10 minutes
find /etc -type f -newer /etc/passwd    # newer than reference file
```

---

## Key Takeaways

1. **Everything is a file** — `/proc` and `/sys` expose live kernel state; learn to read them directly
2. **Load average must be compared to CPU count** — 4.0 means different things on 2 vs 16 CPUs
3. **Buffer/cache memory is not wasted** — Linux reclaims it under pressure; `available` is what matters
4. **iowait means disk is the bottleneck** — not CPU; `iostat -x` is your next tool
5. **Always check file descriptor limits** — "too many open files" is almost always `ulimit -n` being too low
6. **Use `ss` not `netstat`** — ss is faster and current; netstat is deprecated
7. **systemd logs everything** — `journalctl` is your first stop for service debugging
8. **cgroups = container resource limits** — same mechanism limiting containers applies to all services
9. **SIGTERM before SIGKILL** — always give processes a chance to clean up gracefully
10. **Check `dmesg` for kernel messages** — OOM kills, hardware errors, network driver issues appear here
11. **Disk full stops writes immediately** — monitor at 80%, alert at 85%, never hit 100%
12. **A deleted file's space isn't freed until all FDs are closed** — use `lsof | grep deleted`
13. **`/tmp` must be chmod 1777`** — without sticky bit, users can delete each other's files
14. **Cron has minimal PATH** — always use full paths in cron scripts; redirect output to capture errors
15. **SSH key rotation is operational hygiene** — unused keys are attack surface; audit regularly
