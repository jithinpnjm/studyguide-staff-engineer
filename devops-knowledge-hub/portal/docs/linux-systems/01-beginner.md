---
title: "Beginner"
sidebar_position: 1
---

# Linux & Systems — Beginner

Linux is the runtime foundation behind most cloud VMs, Kubernetes nodes, containers, databases, proxies, and observability agents. For SRE work, Linux is not only an operating system; it is the layer where application symptoms become CPU, memory, disk, process, network, and kernel behavior.

Beginner mental model:

```text
user process -> system calls -> kernel -> CPU / memory / disk / network
```

When production fails, you need to move from “the app is slow” to “which Linux resource or dependency is under pressure?”

---

## Why Linux Matters For SREs

Linux knowledge helps you answer:

- Why is this process consuming CPU?
- Why is the host load high but CPU low?
- Why did the kernel kill a process?
- Why is disk full even after deleting files?
- Why is a service listening on one port but not reachable?
- Why can one user run a script but another cannot?
- Why does a container behave differently from the host?

Kubernetes and cloud platforms hide some details, but incidents often expose the Linux layer underneath.

---

## Filesystem Hierarchy

Important directories:

```text
/       root filesystem
/etc    system-wide configuration
/var    logs, spool, runtime data, application state
/tmp    temporary files, should usually be mode 1777
/proc   live kernel and process information
/sys    kernel subsystem and hardware information
/dev    device files
/usr    user-space programs and libraries
/home   user home directories
/root   root user home
/run    runtime files since boot
/boot   kernel and bootloader files
```

Useful commands:

```bash
pwd
ls -la
cd /etc
find /var/log -type f -name "*.log"
cat /proc/meminfo
ls /proc/$$
```

`/proc` is not normal disk data. It is a live view into kernel and process state.

---

## Files, Inodes, And Links

A filename points to an inode. The inode stores metadata such as owner, permissions, timestamps, and pointers to file data.

```bash
ls -li file.txt
stat file.txt
```

Hard link:

```bash
ln original.txt hardlink.txt
ls -li original.txt hardlink.txt
```

Both names point to the same inode.

Symbolic link:

```bash
ln -s /var/log/app.log app.log
ls -l app.log
```

A symlink points to a path, not directly to the same inode.

---

## File Permissions

Permission layout:

```text
-rwxr-xr-- owner group file
```

Meaning:

```text
owner: rwx
group: r-x
other: r--
```

Numeric permissions:

| Permission | Meaning |
|---|---|
| 7 | read + write + execute |
| 6 | read + write |
| 5 | read + execute |
| 4 | read only |
| 0 | no access |

Common examples:

```bash
chmod 755 script.sh
chmod 644 config.yml
chmod 600 private-key.pem
chmod 1777 /tmp
```

Special bits:

| Bit | Meaning |
|---|---|
| setuid | Run with file owner's identity |
| setgid | Run with file group; directories inherit group |
| sticky bit | On shared dirs, only file owner can delete own files |

Check permissions:

```bash
ls -l /path/to/file
ls -ld /tmp
id username
```

---

## Users And Groups

Users are identified by UID. Groups are identified by GID.

```bash
id
id username
whoami
groups username
cat /etc/passwd
cat /etc/group
sudo -l
```

Common user management:

```bash
sudo useradd -m -s /bin/bash appuser
sudo passwd appuser
sudo usermod -aG sudo appuser
sudo userdel -r appuser
```

Troubleshooting login:

```bash
passwd -S username
chage -l username
getent passwd username
sudo journalctl -u sshd --since "1 hour ago"
```

If a user was added to a group but permissions still fail, they may need a new login session.

---

## Processes

A process is a running program. Every process has a PID and parent process.

```bash
ps aux
ps -ef --forest
pgrep -af nginx
top
```

Process states:

| State | Meaning |
|---|---|
| R | Running or runnable |
| S | Sleeping |
| D | Uninterruptible sleep, often I/O wait |
| Z | Zombie |
| T | Stopped |

Signals:

```bash
kill -15 PID   # graceful termination
kill -9 PID    # force kill
kill -1 PID    # reload for many daemons
pkill -f pattern
```

Use `SIGTERM` before `SIGKILL` unless the process is causing immediate harm.

---

## Services And systemd

Most modern Linux distributions use systemd.

```bash
systemctl status nginx
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl reload nginx
sudo systemctl enable nginx
sudo systemctl disable nginx
```

Logs:

```bash
journalctl -u nginx -n 100 --no-pager
journalctl -u nginx --since "1 hour ago"
journalctl -p err -n 50 --no-pager
```

A service can be running but unhealthy. Always check the application health endpoint, logs, and listening ports.

---

## Memory Basics

Linux uses unused memory for page cache. Low `free` memory is not automatically a problem. Look at `available`.

```bash
free -h
cat /proc/meminfo
vmstat 1 5
ps aux --sort=-%mem | head
```

Important terms:

| Term | Meaning |
|---|---|
| RSS | Resident memory physically used by process |
| VSZ | Virtual address space |
| Swap | Disk-backed memory extension |
| Page cache | RAM used to cache disk data |
| OOM | Out-of-memory condition |

Check OOM:

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

---

## Disk Basics

```bash
df -h       # filesystem space
df -i       # inode usage
du -sh *    # directory sizes
lsblk       # block devices
mount       # mounted filesystems
```

Disk full causes writes to fail. Inodes full causes new file creation to fail even if bytes are available.

Find large files:

```bash
sudo find /var -xdev -type f -size +500M -ls 2>/dev/null
sudo du -sh /var/* | sort -rh | head
```

Deleted but still open files:

```bash
sudo lsof +L1
```

If a process keeps a deleted log open, disk space is not freed until the process closes the file or restarts.

---

## Network Basics

```bash
ip addr
ip route
ss -lntp
ss -tanp
curl -v http://localhost:8080/health
dig example.com
resolvectl status
```

Useful distinction:

```text
service not listening -> process/config problem
service listening locally but unreachable remotely -> firewall/routing/security group problem
DNS fails -> resolver or name record problem
connection refused -> host reached, port closed
connection timed out -> path/firewall/drop problem
```

---

## Beginner Triage Routine

When a Linux host is unhealthy, start with:

```bash
hostname
date
uptime
whoami
w
free -h
vmstat 1 5
df -h
df -i
ss -s
journalctl -p err -n 50 --no-pager
dmesg | tail -50
```

Then classify:

```text
CPU pressure
memory pressure
disk full
inode full
network problem
service problem
dependency problem
kernel/hardware problem
```

---

## Beginner Takeaways

1. Linux exposes system state through files and commands.
2. `/proc` and `/sys` are live kernel interfaces.
3. Permissions combine owner, group, mode bits, and sometimes ACLs.
4. Load average is not the same as CPU percentage.
5. `available` memory matters more than `free` memory.
6. Disk can fail by bytes or by inodes.
7. Services need process state, logs, listening ports, and health checks.
8. Always observe before changing production systems.
