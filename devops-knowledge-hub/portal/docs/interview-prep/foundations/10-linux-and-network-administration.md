---
title: "Foundations: Linux Premium Teaching Guide For SRE And Platform Engineers"
sidebar_position: 10
---

# Foundations: Linux Premium Teaching Guide For SRE And Platform Engineers

Linux is the operating foundation underneath cloud VMs, Kubernetes nodes, CI runners, databases, containers, build agents, observability collectors, and most production systems.

This guide is not a command dump. It is a learning path. The goal is to help you understand Linux from first principles, operate it confidently, troubleshoot it during incidents, and explain it clearly in interviews.

---

# How To Use This Module

Read this guide in layers.

1. **Beginner Layer** — understand what Linux is and how to move around safely.
2. **Intermediate Layer** — operate files, users, services, storage, and networking.
3. **Advanced Layer** — understand CPU, memory, IO, cgroups, namespaces, and kernel signals.
4. **Production SRE Layer** — troubleshoot real host failures with a repeatable routine.
5. **Interview Layer** — explain your reasoning like a senior operator.

Do not try to memorize every command first. Learn what question each command answers.

---

# Memory Palace: Linux Is A Hospital

Imagine a hospital.

| Linux concept | Hospital analogy | Production meaning |
|---|---|---|
| Kernel | Hospital administration | Allocates CPU, memory, devices, network, filesystems |
| Processes | Patients / active cases | Running programs needing resources |
| Scheduler | Triage nurse | Decides which process gets CPU next |
| Memory | Hospital beds | Limited space for active work |
| Swap | Overflow hallway beds | Better than collapse, but slow and painful |
| Disk | Medical archive | Stores files, logs, databases, images |
| Inodes | File record numbers | You can run out of records before space |
| systemd | Ward manager | Starts, monitors, restarts services |
| Logs | Patient chart | Evidence of what happened |
| Network | Ambulance routes | How requests enter and leave |
| Permissions | Hospital access badges | Who can enter/read/change what |
| cgroups | Department quotas | Resource limits for groups of processes |
| Namespaces | Separate treatment rooms | Isolated views used by containers |

When a host is sick, you are the on-call doctor. Your job is not to randomly restart organs. Your job is to identify whether the patient is CPU-bound, memory-starved, disk-blocked, network-isolated, misconfigured, or waiting on another dependency.

---

# Beginner Layer: What Linux Actually Is

People use the word Linux loosely. In production, separate three layers.

| Layer | What it is | Example |
|---|---|---|
| Kernel | Core program that manages hardware and resources | process scheduling, memory, network stack |
| Userland | Commands and libraries users interact with | `bash`, `ls`, `grep`, `systemctl` |
| Distribution | Packaged OS combining kernel + userland + package system | Ubuntu, Debian, RHEL, Fedora, Alpine |

A simple stack:

```text
Application
Shell / commands / libraries
Linux kernel
Hardware or virtual hardware
```

When an application reads a file, opens a socket, allocates memory, or starts a process, it ultimately asks the kernel through system calls. This is why Linux fundamentals matter even when you mostly work with Kubernetes: containers are still Linux processes using kernel features.

## Your First Safety Rule

Before running commands on a host, orient yourself.

```bash
hostname
whoami
date
pwd
```

These answer:

- Am I on the right machine?
- Am I the expected user?
- Is the system time sane?
- Where am I in the filesystem?

Many real incidents get worse because someone runs a destructive command on the wrong host, wrong namespace, wrong cluster, or wrong directory.

---

# Beginner Layer: Filesystem And Navigation

Linux exposes everything through a filesystem-like hierarchy starting at `/`.

```bash
pwd
ls -lah
cd /var/log
less syslog
```

## Important Directories Explained

| Path | What it means | Why SREs care |
|---|---|---|
| `/etc` | configuration | broken config often lives here |
| `/var/log` | logs | first evidence during incidents |
| `/proc` | live process/kernel view | memory, CPU, process internals |
| `/sys` | kernel/device information | devices, cgroups, low-level state |
| `/run` | runtime state | sockets, PID files, service state |
| `/tmp` | temporary files | can fill, can be cleaned, usually ephemeral |
| `/home` | user directories | scripts, SSH configs, user files |
| `/usr/bin` | common binaries | where many commands live |

## Teaching Example: Why `/proc` Feels Weird

`/proc` looks like files, but many entries are not real disk files. They are live windows into kernel state.

```bash
cat /proc/loadavg
cat /proc/meminfo
cat /proc/uptime
```

When you read them, the kernel generates the answer. This is why `/proc` is useful in debugging: it shows current truth from the kernel’s point of view.

---

# Beginner Layer: Permissions And Identity

Linux is multi-user. Every file has an owner, group, and permission bits.

```text
-rwxr-x---
 owner group others
```

| Bit | File meaning | Directory meaning |
|---|---|---|
| `r` | read file contents | list directory names |
| `w` | modify file | create/delete/rename entries |
| `x` | execute file | traverse directory |

The directory meaning is the part many beginners miss. A user may have permission on the file but still fail because they cannot traverse a parent directory.

## Scenario: User Can See A File But Cannot Edit It

A junior answer is: “chmod 777 it.”

A senior answer checks identity and path permissions first.

```bash
whoami
id
ls -l /path/to/file
ls -ld /path /path/to
namei -l /path/to/file
```

Reasoning:

1. Does the user own the file?
2. Is the user in the owning group?
3. Does the file have write permission?
4. Can the user traverse every parent directory?
5. Is there ACL, SELinux, or mount policy involved?

A safe fix is usually group-based access, not world-writable access.

---

# Intermediate Layer: Processes And Services

A process is a running program. Every process has a PID, parent process, user, memory, CPU usage, open files, and environment.

```bash
ps aux
ps -ef
top
pgrep -af nginx
```

## Process vs Service

A process is what the kernel runs. A service is the operational unit managed by systemd.

```bash
systemctl status nginx
journalctl -u nginx -n 100 --no-pager
```

`systemctl status` answers: is systemd trying to keep this service alive?

`journalctl -u` answers: what did this service recently say?

## Signals Explained

Signals are messages sent to processes.

| Signal | Meaning | Operational use |
|---|---|---|
| `SIGTERM` / 15 | please stop gracefully | normal shutdown |
| `SIGKILL` / 9 | stop immediately | last resort |
| `SIGHUP` | reload in many daemons | config reload |
| `SIGINT` | interrupt | Ctrl-C style stop |

Do not start with `kill -9`. It gives the process no chance to flush data, close connections, release locks, or clean temporary state.

---

# Intermediate Layer: Logs And Evidence

Logs are the patient chart.

```bash
journalctl -p err -n 100 --no-pager
journalctl -u nginx -n 200 --no-pager
dmesg | tail -50
tail -f /var/log/syslog
```

Do not read logs randomly from the top. Start with time and symptom.

Ask:

1. When did the problem begin?
2. Which service or host reported first?
3. Are errors application-level, kernel-level, or dependency-level?
4. Did a deploy, config change, restart, or resource spike happen nearby?

Good incident reading is timeline building.

---

# Intermediate Layer: Storage, Mounts, And Inodes

Disk issues often look like application bugs.

```bash
df -h
df -i
du -sh /var/* | sort -h
lsblk
findmnt
```

## Disk Space vs Inodes

Disk bytes are storage capacity. Inodes are file records.

A system can have free GB but no inodes left if it has millions of tiny files.

```bash
df -h   # bytes
df -i   # inode count
```

## Scenario: Disk Still Full After Deleting Logs

If a process has a file open, deleting the filename removes the directory entry but does not free the disk blocks until the process closes the file.

Check:

```bash
lsof +L1
```

Hospital analogy: the chart was removed from the front desk, but a doctor is still holding it in a treatment room. The archive space is not free yet.

Fix options:

- restart or reload the process holding the file
- truncate the open file carefully if appropriate
- fix log rotation

---

# Intermediate Layer: Linux Networking Basics

A Linux host makes networking decisions using interfaces, IP addresses, routes, ports, sockets, and DNS.

```bash
ip addr
ip route
ip neigh
ss -lntp
ss -tanp
dig example.com
curl -vk https://example.com
```

## Traffic Path From A Process

```text
application -> socket -> local port -> routing table -> interface -> gateway -> network
```

If a service is unreachable, split the problem:

1. Is the process running?
2. Is it listening on the expected address and port?
3. Is the host route correct?
4. Does DNS resolve?
5. Does TCP connect?
6. Does HTTP/TLS/application behavior work?

This prevents the common mistake: blaming firewall before proving the service is even listening.

---

# Advanced Layer: CPU, Scheduler, And Load Average

CPU is not just “percentage used.” Linux schedules many tasks across available CPUs.

```bash
uptime
top
vmstat 1 5
mpstat -P ALL 1 5
```

## Load Average Explained Properly

Load average is roughly the number of tasks that are runnable or stuck in uninterruptible wait.

That means high load can happen because:

- processes want CPU
- processes are blocked on disk IO
- processes are stuck waiting on kernel resources

## Hospital Story: High Load, Low CPU

Imagine a hospital waiting room with 40 patients waiting. Doctors are not busy because the lab machine is broken and everyone is waiting for test results.

That is high load with low CPU.

The CPU doctors look idle, but the hospital is still overloaded because patients are blocked elsewhere.

Check:

```bash
vmstat 1 5
iostat -xz 1 5
cat /proc/pressure/io
```

Senior interpretation:

> High load with low CPU usually means blocked work, often IO wait, lock contention, or dependency stalls. I would not add CPU until I prove CPU is the bottleneck.

---

# Advanced Layer: Memory, Page Cache, Swap, OOM

Linux memory usage can look scary because Linux uses free RAM for cache.

```bash
free -m
cat /proc/meminfo
vmstat 1 5
```

## Page Cache

Linux caches disk reads in RAM to make future reads faster.

High used memory is not automatically bad. Look at available memory, swap activity, and pressure.

## Swap

Swap is disk used as overflow memory.

A little swap usage is not always fatal. Active swap-in/swap-out during request serving is dangerous because disk is far slower than RAM.

`vmstat` columns to watch:

- `si` swap in
- `so` swap out
- `wa` IO wait

## OOM Killer

When memory is exhausted and the kernel cannot recover, it kills a process.

```bash
dmesg | grep -i oom
journalctl -k | grep -i oom
```

In Kubernetes, this often appears as `OOMKilled` on a container, but the underlying behavior is still Linux memory enforcement through cgroups.

---

# Advanced Layer: cgroups And Namespaces

Containers are not tiny VMs. They are Linux processes with isolation and limits.

## Namespaces

Namespaces control what a process can see.

| Namespace | Isolates |
|---|---|
| PID | process IDs |
| network | interfaces, routes, ports |
| mount | filesystem view |
| user | user/group mappings |
| UTS | hostname |
| IPC | shared memory/semaphores |

## cgroups

cgroups control what a process can use.

| cgroup area | Controls |
|---|---|
| CPU | shares, quotas, throttling |
| memory | memory limit and OOM behavior |
| pids | process count |
| IO | disk IO controls |

Kubernetes requests and limits eventually become scheduler decisions and cgroup settings on Linux nodes.

---

# Production SRE Layer: 10-Minute Host Triage

Use this when a Linux host is unhealthy.

## 1. Orient

```bash
hostname
date
uptime
whoami
w
```

Goal: confirm host, time, users, and rough load.

## 2. Resource Snapshot

```bash
top
free -m
vmstat 1 5
iostat -xz 1 5
```

Goal: separate CPU pressure, memory pressure, IO pressure, and blocked work.

## 3. Process Offenders

```bash
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
pgrep -af SERVICE_NAME
```

Goal: identify whether one process dominates or service is missing/flapping.

## 4. Storage

```bash
df -h
df -i
findmnt
lsof +L1
```

Goal: detect full disk, inode exhaustion, wrong mounts, deleted-open files.

## 5. Network

```bash
ip addr
ip route
ss -lntp
ss -s
resolvectl status || cat /etc/resolv.conf
```

Goal: detect route, listener, socket, and DNS clues.

## 6. Recent Errors

```bash
journalctl -p err -n 100 --no-pager
dmesg | tail -50
```

Goal: find OOM, disk errors, filesystem remounts, driver resets, service crashes.

---

# Production Incident Walkthroughs

## Incident 1: Host Is Slow But CPU Is Low

Beginner guess: “CPU is fine, so host is fine.”

Senior reasoning:

- high load may mean blocked tasks
- blocked tasks often wait on disk, locks, network, or kernel resources
- CPU can be idle while requests are stuck

Commands:

```bash
uptime
vmstat 1 5
iostat -xz 1 5
cat /proc/pressure/io
```

Decision:

- if IO wait is high, inspect disks and noisy processes
- if run queue is high, inspect CPU saturation
- if memory pressure is high, inspect swap and OOM clues

## Incident 2: Service Running But Unreachable

Do not stop at `systemctl status`.

```bash
systemctl status myapp
ss -lntp | grep myapp
ip route
curl -v http://127.0.0.1:PORT
curl -v http://HOST_IP:PORT
journalctl -u myapp -n 100 --no-pager
```

Interpretation:

- listening only on `127.0.0.1` means remote clients cannot connect
- listening on wrong port means Service/LB config may be wrong
- local curl works but remote fails means network/firewall/routing path

## Incident 3: Disk Full After Log Cleanup

```bash
df -h
df -i
lsof +L1
du -sh /var/log/* | sort -h
```

Likely explanation:

- process still holds deleted file open
- inode exhaustion
- logs immediately recreated
- different mount is full than expected

---

# Interview Layer: How To Sound Senior

## Question: How would you troubleshoot a slow Linux host?

> I would first decide whether the issue is host-wide or isolated to one process. Then I would gather a quick snapshot across load, CPU, memory, IO, disk, network sockets, and recent kernel/service errors. I would not assume high load means CPU. High load with low CPU often points to blocked IO or lock contention. After identifying the pressure area, I would inspect the responsible processes and recent changes before restarting anything.

## Question: Why can memory look full but the system be healthy?

> Linux uses available RAM for page cache. That cache improves performance and can be reclaimed when applications need memory. I would look at available memory, swap activity, OOM logs, and pressure metrics rather than only the used-memory number.

## Question: Why does deleting a log not free space?

> If a process still has the deleted file open, the directory entry is gone but the disk blocks remain allocated until the file descriptor closes. I would use `lsof +L1` to find deleted-open files and then reload or restart the owning process safely.

---

# Labs: Build Real Skill

## Beginner Labs

1. Create a directory tree under `/tmp/linux-lab`.
2. Create files, copy them, move them, and inspect with `ls -lah`.
3. Create a test user and group if you have a safe lab machine.
4. Practice `chmod`, `chown`, and `namei -l` on a nested path.

## Intermediate Labs

1. Create a simple systemd service that runs a script.
2. Break the service command and inspect `journalctl -u`.
3. Start a Python HTTP server and inspect it with `ss -lntp`.
4. Fill a small test filesystem or tmp directory and inspect `df -h` vs `df -i`.

## Advanced Labs

1. Generate CPU load and observe `top`, `uptime`, and `vmstat`.
2. Generate IO pressure and observe `iostat` and PSI metrics.
3. Run a container and inspect namespaces/cgroups from the host.
4. Simulate a deleted-open file and recover the space.

---

# Memory Review

## Beginner Recall

- What is the difference between kernel, userland, and distribution?
- Why does directory execute permission matter?
- What does `/proc` show?

## Intermediate Recall

- What is the difference between process and service?
- Why should `kill -9` be a last resort?
- Why can DNS success still mean TCP failure?

## Advanced Recall

- Why can load be high while CPU is low?
- Why is page cache healthy?
- What do cgroups and namespaces do for containers?

## Production Recall

- What is your first 10-minute Linux triage routine?
- How do you debug disk full after deleting files?
- How do you prove whether a service is listening correctly?
