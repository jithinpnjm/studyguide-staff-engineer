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

When production fails, you need to move from "the app is slow" to "which Linux resource or dependency is under pressure?"

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

## Linux Boot Sequence

Understanding the boot sequence helps diagnose startup failures.

```text
BIOS/UEFI -> GRUB -> Kernel -> initramfs -> systemd -> services
```

### What Happens At Each Stage

**BIOS/UEFI:** Firmware initialises hardware, performs Power-On Self Test (POST), then locates a bootable device.

What can go wrong: bad BIOS settings, corrupted firmware, wrong boot device order.

**GRUB (bootloader):** Loads the kernel image and initramfs from `/boot`, passes kernel parameters.

What can go wrong: corrupted GRUB config, wrong partition UUID in `/etc/grub.d/`, missing kernel image after a bad kernel update.

```bash
# Recover GRUB from live USB:
sudo mount /dev/sdXn /mnt
sudo grub-install --root-directory=/mnt /dev/sdX
sudo update-grub
```

**Kernel:** The kernel decompresses itself, initialises drivers, mounts the root filesystem.

What can go wrong: kernel panic (incompatible module, corrupt filesystem), hardware not supported by kernel version.

```bash
# View kernel messages from last boot:
journalctl -xb
dmesg | head -100
```

**initramfs (initial RAM filesystem):** A minimal root filesystem loaded into RAM. Handles early disk setup (LVM, RAID, encrypted volumes) before the real root is mounted.

What can go wrong: missing modules for RAID or LVM, wrong cryptsetup passphrase, broken initramfs after kernel update. Fix by regenerating: `update-initramfs -u` (Debian/Ubuntu) or `dracut -f` (RHEL).

**systemd (PID 1):** The init system. Mounts filesystems, starts services in dependency order.

What can go wrong: failed unit prevents other units from starting, cyclic dependency, missing environment file, ExecStart path wrong.

```bash
# Check what failed at boot:
systemctl --failed
journalctl -b -p err --no-pager
```

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

## File Permissions — Full Reference

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
chmod 755 script.sh        # owner rwx, group/other rx
chmod 644 config.yml       # owner rw, group/other r
chmod 600 private-key.pem  # owner rw only, no group/other access
chmod 1777 /tmp            # world-writable with sticky bit
```

### Symbolic chmod

```bash
chmod u+x script.sh        # add execute for owner
chmod g-w config.yml       # remove write for group
chmod o=r file.txt         # set other to read-only
chmod a+r file.txt         # add read for all (user, group, other)
chmod u=rwx,g=rx,o= file   # explicit assignment
```

### umask

`umask` controls the default permissions for newly created files and directories.

```bash
umask             # show current mask (commonly 0022)
umask 0027        # set restrictive mask: owner full, group read-only, no other
```

When `umask` is `0022`, a new file created with mode `0666` gets `0644`, and a new directory with `0777` gets `0755`.

### Setuid, Setgid, Sticky Bit

```bash
chmod u+s /usr/bin/passwd   # setuid: runs as file owner (root), not caller
chmod g+s /shared/dir       # setgid: new files inherit directory group
chmod +t /tmp               # sticky bit: only owner can delete own files
```

Real examples:

```bash
ls -l /usr/bin/passwd
# -rwsr-xr-x 1 root root ... /usr/bin/passwd
# 's' in owner execute = setuid set

ls -ld /tmp
# drwxrwxrwt ... /tmp
# 't' in others execute = sticky bit set
```

Numeric special bits (prepend to 3-digit mode):

```text
4xxx = setuid
2xxx = setgid
1xxx = sticky
```

Example: `chmod 4755 binary` sets setuid + 755.

Check full permission path:

```bash
namei -l /path/to/file    # shows every directory permission in the path
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

## Essential Commands With Real One-Liners

### find

```bash
find /var/log -type f -name "*.log"                         # all log files
find /tmp -mtime +7 -delete                                  # delete files older than 7 days
find / -xdev -size +1G -ls 2>/dev/null                      # files larger than 1 GB
find /etc -type f -perm -004 -ls                            # world-readable config files
find /var/lib/docker -xdev -type f | wc -l                  # count Docker inode usage
find / -xdev -printf '%h\n' 2>/dev/null | sort | uniq -c | sort -rn | head  # top inode dirs
```

### grep

```bash
grep -r "FATAL" /var/log/app/                               # recursive search
grep -i "error" /var/log/syslog                             # case insensitive
grep -v "INFO" app.log                                       # exclude lines
grep -n "OOM" /var/log/kern.log                             # show line numbers
grep -c "timeout" access.log                                 # count occurrences
grep -E "ERROR|WARN|FATAL" app.log                          # extended regex alternation
grep -A3 -B3 "stack trace" app.log                          # context lines around match
```

### awk

```bash
awk '{print $1}' access.log                                  # first field (IP)
awk '{print $9}' access.log | sort | uniq -c | sort -rn     # HTTP status code summary
awk -F: '{print $1}' /etc/passwd                            # usernames from passwd
awk '$3 > 100 {print $1, $3}' report.txt                    # filter by numeric column
awk 'NR>1 {sum += $2} END {print sum}' data.csv             # sum a column
ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c            # socket state summary
```

### sed

```bash
sed -n '1,20p' file.txt                                     # print lines 1-20
sed 's/DEBUG/INFO/g' app.log                                # replace all occurrences
sed '/^#/d' config.conf                                     # delete comment lines
sed -i.bak 's/old/new/g' file.txt                           # in-place edit with backup
sed -n '/ERROR/,/END/p' app.log                             # print between patterns
```

### xargs

```bash
find /tmp -name "*.tmp" | xargs rm                          # delete found files
find /var/log -name "*.log" | xargs grep -l "ERROR"         # find logs containing ERROR
cat hosts.txt | xargs -I{} ssh {} uptime                    # run command on each host
find . -type f | xargs wc -l | sort -rn | head              # line count per file
```

### cut

```bash
cut -d: -f1 /etc/passwd                                     # extract usernames
cut -d, -f1,3 data.csv                                      # first and third CSV fields
cut -c1-10 file.txt                                         # first 10 characters per line
```

### sort

```bash
sort -n numbers.txt                                         # numeric sort
sort -rn numbers.txt                                        # reverse numeric sort
sort -k2 -t: file.txt                                       # sort by second field
du -sh /var/* | sort -rh                                    # sort by human-readable size
```

### uniq

```bash
sort file.txt | uniq                                        # remove duplicates
sort file.txt | uniq -c                                     # count each unique line
sort file.txt | uniq -d                                     # show only duplicates
grep ERROR app.log | sort | uniq -c | sort -rn             # error frequency count
```

### wc

```bash
wc -l file.txt                                              # line count
wc -c file.txt                                              # byte count
find /var -name "*.log" | wc -l                            # count files
ls /proc/PID/fd | wc -l                                    # open file descriptor count
```

### tr

```bash
echo "hello" | tr '[:lower:]' '[:upper:]'                  # uppercase
echo "a:b:c" | tr ':' '\n'                                 # replace colon with newline
cat file.txt | tr -d '\r'                                   # remove Windows carriage returns
echo "  spaces  " | tr -s ' '                              # squeeze repeated spaces
```

---

## Redirection And Piping

```bash
command > file.txt          # redirect stdout, overwrite
command >> file.txt         # redirect stdout, append
command 2> error.log        # redirect stderr
command 2>&1                # merge stderr into stdout
command > file.txt 2>&1     # both stdout and stderr to file
command | tee file.txt      # stdout to both terminal and file
command1 | command2         # pipe stdout of command1 to stdin of command2
command < input.txt         # feed file as stdin
```

Here-doc (heredoc):

```bash
cat <<EOF > /etc/app/config.ini
[server]
port = 8080
log_level = info
EOF
```

Null device:

```bash
command 2>/dev/null         # discard stderr
command >/dev/null 2>&1     # discard all output
```

---

## Package Management

### Debian / Ubuntu (apt)

```bash
sudo apt update                          # refresh package index
sudo apt upgrade                         # upgrade installed packages
sudo apt install -y nginx                # install a package
sudo apt remove nginx                    # remove package, keep config
sudo apt purge nginx                     # remove package and config
sudo apt autoremove                      # remove orphaned dependencies
apt search nginx                         # search for a package
apt show nginx                           # show package details
dpkg -l | grep nginx                     # list installed matching pattern
dpkg -L nginx                            # list files in installed package
```

### RHEL / CentOS / Amazon Linux (yum/dnf)

```bash
sudo yum update                          # update all packages
sudo yum install -y nginx                # install
sudo yum remove nginx                    # remove
yum search nginx                         # search
yum info nginx                           # show package info
rpm -qa | grep nginx                     # list installed matching pattern
rpm -ql nginx                            # list files in installed package
sudo dnf update                          # dnf is the modern replacement for yum
```

---

## SSH Basics And Key-Based Authentication

### Key-based auth setup

```bash
# Generate a key pair on your local machine:
ssh-keygen -t ed25519 -C "user@machine"

# Copy public key to remote host:
ssh-copy-id user@host

# Manual method:
cat ~/.ssh/id_ed25519.pub | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### SSH config aliases

```bash
# ~/.ssh/config
Host bastion
    HostName 10.0.0.5
    User deploy
    IdentityFile ~/.ssh/bastion_key

Host prod-app
    HostName 10.0.1.20
    User ubuntu
    ProxyJump bastion
    IdentityFile ~/.ssh/prod_key
```

Then simply: `ssh prod-app`

### File transfer

```bash
scp local-file.txt user@host:/remote/path/     # copy file to remote
scp user@host:/remote/file.txt ./local/        # copy file from remote
scp -r local-dir/ user@host:/remote/path/      # copy directory
```

### rsync

```bash
rsync -avz local-dir/ user@host:/remote/dir/         # sync local to remote
rsync -avz --dry-run local-dir/ user@host:/remote/   # preview before syncing
rsync -avz --exclude '*.log' local-dir/ user@host:/remote/  # exclude pattern
rsync -avz --bwlimit=10000 local/ user@host:/remote/ # limit bandwidth to 10 MB/s
rsync -avz --delete local-dir/ user@host:/remote/    # delete files not in source
```

---

## Cron And Scheduled Jobs

### Crontab syntax

```text
* * * * * command
| | | | |
| | | | +-- Day of week (0-7, 0 and 7 = Sunday)
| | | +---- Month (1-12)
| | +------ Day of month (1-31)
| +-------- Hour (0-23)
+---------- Minute (0-59)
```

Common cron expressions:

```bash
0 2 * * *    command     # daily at 02:00
0 * * * *    command     # every hour on the hour
*/15 * * * * command     # every 15 minutes
0 2 * * 0    command     # every Sunday at 02:00
@reboot      command     # on every system boot
@hourly      command     # hourly shorthand
@daily       command     # daily shorthand
```

### Managing crontabs

```bash
crontab -e                    # edit current user's crontab
crontab -l                    # list current user's crontab
sudo crontab -u appuser -l    # list another user's crontab
crontab -r                    # remove all crontabs (dangerous)
```

System-wide cron directories:

```bash
ls /etc/cron.daily/          # scripts run daily
ls /etc/cron.hourly/
ls /etc/cron.d/              # additional crontab files
```

### at — one-off jobs

```bash
at now + 30 minutes <<'EOF'
/path/to/script.sh
EOF

at 02:00 tomorrow <<'EOF'
/opt/app/backup.sh
EOF

atq                           # list queued jobs
atrm <job-number>             # remove a queued job
```

Debug cron problems:

```bash
journalctl -u cron --since "1 hour ago"     # Debian/Ubuntu
journalctl -u crond --since "1 hour ago"    # RHEL/CentOS
grep CRON /var/log/syslog | tail -20
```

---

## Environment Variables

```bash
echo $PATH                          # print PATH
echo $HOME                          # print home directory
printenv                            # list all environment variables
env                                 # list environment, or run command in modified environment
export MY_VAR="value"               # set and export to child processes
unset MY_VAR                        # remove variable
```

### Modifying PATH

```bash
export PATH=$PATH:/usr/local/bin
export PATH=/opt/custom/bin:$PATH   # prepend (higher priority)
```

### Startup Files

| File | When loaded | Typical use |
|---|---|---|
| `~/.bash_profile` | Login shell | Set PATH, export vars, source .bashrc |
| `~/.bashrc` | Interactive non-login shell | Aliases, functions, PS1 |
| `~/.profile` | Login shell (sh/bash/dash) | Portable environment setup |
| `/etc/profile` | All users, login shell | System-wide settings |
| `/etc/environment` | All sessions (PAM-based) | System-wide env vars |

```bash
source ~/.bashrc            # reload without a new shell
. ~/.bashrc                 # same as source
```

Difference: `.bash_profile` runs once at login (SSH, TTY login). `.bashrc` runs every time you open a terminal. Usually `.bash_profile` sources `.bashrc` to ensure consistency.

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
kill -15 PID   # graceful termination (SIGTERM)
kill -9 PID    # force kill (SIGKILL)
kill -1 PID    # reload for many daemons (SIGHUP)
pkill -f pattern
```

Use `SIGTERM` before `SIGKILL` unless the process is causing immediate harm. `SIGKILL` cannot be handled and gives the process no chance to flush data or close connections.

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
9. The boot sequence matters: BIOS/UEFI, GRUB, kernel, initramfs, systemd each has its own failure modes.
10. `umask` and special bits (setuid, setgid, sticky) are tested frequently in interviews.
11. Redirection and piping are core tools for log analysis and incident investigation.
12. Cron and at schedule automated work; check the journal when scheduled jobs do not run.
