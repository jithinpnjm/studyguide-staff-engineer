---
title: "Hands-On Labs"
sidebar_position: 5
---

# Linux & Systems — Hands-On Labs

These labs are designed to build production-debugging muscle memory. Run them on a disposable VM, local Linux machine, or container where safe.

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

**Expected learning:** you should classify a host as CPU-bound, memory-bound, disk-bound, network-bound, service-specific, or unknown within a few minutes.

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
```

Set sticky bit:

```bash
sudo chmod 1777 /tmp/shared-lab
ls -ld /tmp/shared-lab
```

**Review question:** why is `1777` safer than `0777` for shared temporary directories?

---

## Lab 3: Process And Signal Practice

**Goal:** See process state and signals.

Start a process:

```bash
sleep 1000 &
echo $!
ps -fp $!
```

Terminate gracefully:

```bash
kill -15 $!
```

Start another process and force-kill it:

```bash
sleep 1000 &
kill -9 $!
```

Inspect process tree:

```bash
ps -ef --forest | head -50
```

**Expected learning:** SIGTERM allows graceful shutdown; SIGKILL is immediate and should not be your default first action.

---

## Lab 4: systemd Service Debugging

**Goal:** Practice reading service state and logs.

Use an existing service, for example ssh or cron depending on distro:

```bash
systemctl status ssh || systemctl status sshd || systemctl status cron
journalctl -u ssh -n 50 --no-pager || journalctl -u sshd -n 50 --no-pager
systemctl cat ssh || systemctl cat sshd
```

Check failed units:

```bash
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
```

Inspect current shell:

```bash
cat /proc/$$/status | grep -E 'VmRSS|VmSize|Threads'
```

**Expected learning:** Linux uses RAM for cache. `available` is more important than `free`.

---

## Lab 6: Disk Full And Inode Investigation

**Goal:** Practice byte and inode checks.

```bash
df -h
df -i
sudo du -sh /var/* 2>/dev/null | sort -rh | head
sudo find / -xdev -type f -size +500M -ls 2>/dev/null | head
```

Create many small files in a safe temp directory:

```bash
mkdir /tmp/inode-lab
for i in $(seq 1 1000); do touch /tmp/inode-lab/file-$i; done
find /tmp/inode-lab -type f | wc -l
rm -rf /tmp/inode-lab
```

**Expected learning:** a filesystem can fail due to inode exhaustion even when byte usage looks acceptable.

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
```

Stop the Python process and check again.

**Expected learning:** deleting a file removes the directory entry, not necessarily the open file descriptor.

---

## Lab 8: Network Listening And Connectivity

**Goal:** Distinguish listening, refused, timeout, and DNS failures.

Start a local server:

```bash
python3 -m http.server 8080
```

In another terminal:

```bash
ss -lntp | grep 8080
curl -v http://localhost:8080
nc -vz localhost 8080
nc -vz localhost 9090
```

DNS checks:

```bash
dig example.com
resolvectl status || cat /etc/resolv.conf
```

**Expected learning:** connection refused means the host is reachable but the port is closed. Timeout suggests route, firewall, or packet drop.

---

## Lab 9: strace A Simple Process

**Goal:** See system calls.

```bash
strace -o /tmp/ls.trace ls /tmp
head /tmp/ls.trace
```

Attach to a running process safely:

```bash
sleep 1000 &
sudo strace -p $! -o /tmp/sleep.trace &
sleep 2
kill -15 $!
cat /tmp/sleep.trace
```

**Expected learning:** `strace` shows what a process asks the kernel to do. Use carefully on production hot paths.

---

## Lab 10: Build A Linux Incident Note

**Goal:** Practice writing a short incident-quality diagnosis.

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
