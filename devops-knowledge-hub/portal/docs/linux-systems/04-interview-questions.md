---
title: "Interview Questions"
sidebar_position: 4
---

# Linux & Systems — Interview Questions

Strong Linux interview answers explain how you reason under pressure. Do not only list commands. Explain what signal you would collect, how you would interpret it, and what safe mitigation you would choose.

---

## Beginner Questions

### Why is Linux important for SREs?

Most cloud infrastructure, Kubernetes nodes, containers, databases, proxies, and observability agents run on Linux. Production incidents often reduce to Linux resource behavior: CPU, memory, disk, process, network, kernel, or filesystem issues.

### What does “everything is a file” mean?

Linux exposes many system interfaces as files or file-like objects: devices under `/dev`, process data under `/proc`, kernel subsystem data under `/sys`, logs under `/var/log`, and sockets/file descriptors under process directories.

### What is `/proc`?

`/proc` is a virtual filesystem that exposes live kernel and process information. It is not normal disk data.

```bash
cat /proc/meminfo
cat /proc/cpuinfo
ls /proc/$$
```

### What is an inode?

An inode stores file metadata and block pointers. Filenames are directory entries that point to inodes. Hard links share the same inode; symlinks point to a path.

### What is the correct permission for `/tmp`?

Usually `1777`: world-writable with the sticky bit so users can create files but cannot delete other users' files.

---

## Permissions And Users

### Explain Linux file permissions.

Permissions are split into owner, group, and others. Each can have read, write, and execute bits.

```text
r=4, w=2, x=1
755 = rwxr-xr-x
644 = rw-r--r--
600 = rw-------
```

### What are setuid, setgid, and sticky bit?

Setuid runs an executable with the owner’s privileges. Setgid runs with group privileges and makes directories inherit group ownership. Sticky bit on directories allows only file owners to delete their own files.

### User was added to a group but still cannot access a file. Why?

The session may not have refreshed group membership. Ask the user to log out and back in, or start a new session. Also verify with `id username` and check file group ownership and mode.

### How do you debug a user who cannot SSH?

Check account status, shell, home directory, SSH logs, group policy, key permissions, and network path.

```bash
passwd -S username
chage -l username
getent passwd username
sudo journalctl -u sshd --since "1 hour ago"
```

---

## Process Questions

### What is the difference between SIGTERM and SIGKILL?

SIGTERM asks a process to shut down gracefully and can be handled. SIGKILL cannot be caught and terminates immediately. Use SIGTERM first unless immediate force is required.

### What is a zombie process?

A process that has exited but whose parent has not collected its exit status. It uses a PID slot but not normal memory. Restart or fix the parent process.

### What is D-state?

Uninterruptible sleep, usually waiting in the kernel for I/O. D-state processes often cannot be killed until the kernel call returns.

### How do you find what a process is doing?

```bash
ps -fp PID
lsof -p PID
strace -p PID
cat /proc/PID/status
```

Use `strace` carefully on production hot paths.

---

## CPU And Load Questions

### Load average is high. What do you check?

Check whether it is CPU run queue or blocked I/O.

```bash
uptime
vmstat 1 5
mpstat -P ALL 1 5
pidstat -u 1 5
ps aux --sort=-%cpu | head
```

If CPU is low but load is high, check D-state and I/O wait.

### What does high `wa` in `vmstat` mean?

The CPU is waiting on I/O. Investigate disk, network storage, or blocked filesystem operations.

### What does high `sy` mean?

High kernel CPU usage. Possible causes include syscall-heavy workload, packet processing, filesystem work, or kernel-level overhead.

---

## Memory Questions

### `free` memory is low. Is that bad?

Not necessarily. Linux uses free memory for page cache. Check `available` memory and swap activity.

```bash
free -h
vmstat 1 5
```

### How do you detect OOM?

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

Identify whether it was host-level OOM or cgroup/container OOM.

### What is the difference between RSS and VSZ?

RSS is resident memory actually in RAM. VSZ is virtual address space and can be much larger than real memory usage.

---

## Disk Questions

### Disk is full but you deleted files. Why is space not free?

A process may still hold deleted files open.

```bash
sudo lsof +L1
```

Restart or reload the owning process safely.

### What is inode exhaustion?

The filesystem has run out of inode metadata entries, so it cannot create new files even if bytes are free.

```bash
df -i
```

### How do you find large files?

```bash
sudo du -sh /var/* | sort -rh | head
sudo find / -xdev -type f -size +1G -ls 2>/dev/null
```

---

## Networking Questions

### Connection refused vs timeout?

Connection refused means the host was reachable but nothing accepted the connection on that port. Timeout means packets were dropped or the route/firewall path failed.

### How do you check which process is listening on a port?

```bash
sudo ss -lntp
```

### How do you debug DNS?

```bash
dig example.com
resolvectl status
cat /etc/resolv.conf
```

### What does many CLOSE-WAIT connections suggest?

The remote side closed the connection, but the local application did not close its socket. This often indicates an application bug or resource leak.

---

## systemd Questions

### How do you debug a failed service?

```bash
systemctl status SERVICE
systemctl cat SERVICE
journalctl -u SERVICE -n 200 --no-pager
journalctl -p err -n 100 --no-pager
```

Check unit file, environment files, permissions, working directory, restart limits, and port conflicts.

### What is `daemon-reload`?

It makes systemd reload unit files after changes.

```bash
sudo systemctl daemon-reload
```

---

## Scenario Questions

### A host has high load but CPU is mostly idle. What do you do?

Check blocked processes and I/O wait.

```bash
vmstat 1 5
ps aux | awk '$8 ~ /D/ {print}'
iostat -xz 1 5
```

Likely causes: disk bottleneck, network storage issue, stuck filesystem, or blocked kernel calls.

### A service is running but users get 503. What do you check?

Check service health endpoint, listening port, load balancer target health, logs, resource pressure, and dependencies.

### A process is using too many file descriptors. What do you check?

```bash
ls /proc/PID/fd | wc -l
cat /proc/PID/limits | grep files
sudo lsof -p PID | head
```

Then decide whether it is a leak or limit too low.

### A node had an OOM kill. How do you explain it?

Identify killed process, memory pressure timeline, cgroup/host boundary, recent deploy or traffic change, and whether requests/limits or host capacity need adjustment.

---

## Staff-Level Questions

### How do you troubleshoot Linux during an incident without making it worse?

Collect a fast snapshot, classify the failure, avoid destructive commands, mitigate only the clear bottleneck, preserve evidence, and communicate uncertainty.

### What are signs of poor Linux operational maturity?

No runbooks, no baseline metrics, no log retention, manual restarts without evidence, no cgroup visibility, no disk/inode alerts, and inability to correlate app symptoms with host signals.

### What should every SRE know cold?

Processes, systemd, logs, permissions, CPU/load, memory/OOM, disk/inodes, networking basics, DNS, and safe mitigation patterns.
