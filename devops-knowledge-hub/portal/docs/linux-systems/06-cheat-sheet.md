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
CPU
memory
disk bytes
inodes
network
service
kernel
external dependency
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
chown user:group file
```

Permission numbers:

```text
r=4
w=2
x=1
755 = rwxr-xr-x
644 = rw-r--r--
600 = rw-------
```

ACLs and attributes:

```bash
getfacl file
setfacl -m u:username:rw file
lsattr file
chattr +i file
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
```

Manage users:

```bash
sudo useradd -m -s /bin/bash appuser
sudo passwd appuser
sudo usermod -aG sudo appuser
sudo userdel -r appuser
```

Login troubleshooting:

```bash
passwd -S username
chage -l username
getent passwd username
sudo journalctl -u sshd --since "1 hour ago"
```

---

## Processes

```bash
ps aux
ps -ef --forest
pgrep -af nginx
top
htop
```

Signals:

```bash
kill -15 PID
kill -9 PID
kill -1 PID
pkill -f pattern
```

Process details:

```bash
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
D uninterruptible sleep
Z zombie
T stopped
```

---

## systemd

```bash
systemctl status SERVICE
systemctl cat SERVICE
systemctl show SERVICE
sudo systemctl start SERVICE
sudo systemctl stop SERVICE
sudo systemctl restart SERVICE
sudo systemctl reload SERVICE
sudo systemctl enable SERVICE
sudo systemctl disable SERVICE
sudo systemctl daemon-reload
```

Logs:

```bash
journalctl -u SERVICE -n 200 --no-pager
journalctl -u SERVICE --since "1 hour ago"
journalctl -p err -n 100 --no-pager
journalctl -k -n 100 --no-pager
```

---

## CPU And Load

```bash
uptime
vmstat 1 5
mpstat -P ALL 1 5
pidstat -u 1 5
ps aux --sort=-%cpu | head
```

Interpretation:

```text
high r: CPU run queue
high b: blocked tasks
high wa: I/O wait
high sy: kernel CPU
high si: software interrupt/network pressure
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
```

---

## Disk And Inodes

```bash
df -h
df -i
lsblk
mount
sudo du -sh /var/* | sort -rh | head
sudo find / -xdev -type f -size +1G -ls 2>/dev/null
sudo lsof +L1
```

I/O:

```bash
iostat -xz 1 5
pidstat -d 1 5
```

Look at:

```text
await
%util
r/s
w/s
```

---

## Network

```bash
ip addr
ip route
ip rule
ss -lntp
ss -tanp
ss -s
curl -vk https://example.com
nc -vz host 443
dig example.com
resolvectl status
```

Interpretation:

```text
connection refused: host reached, port closed
timeout: route/firewall/drop
NXDOMAIN: DNS name does not exist
CLOSE-WAIT: app did not close socket
SYN-SENT: waiting for remote response
```

---

## Logs

```bash
journalctl -p err -n 100 --no-pager
journalctl -u SERVICE --since "1 hour ago"
journalctl --since "2026-05-17 10:00" --until "2026-05-17 10:30"
dmesg -T | tail -100
tail -f /var/log/syslog
grep -i error /var/log/app.log
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
```
