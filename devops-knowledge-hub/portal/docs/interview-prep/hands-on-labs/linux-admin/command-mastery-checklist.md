---
title: "Linux Admin Drill 4: Command Mastery Checklist"
sidebar_position: 4
---

# Linux Admin Drill 4: Command Mastery Checklist

## How To Use This Drill

For each command, the format is: **what problem it solves**, **one key signal to look for**, **one thing it cannot tell you**, and **one common misuse**. Read each entry, then close this document and recite it from memory. If you can explain what a command proves and what it does not prove, you are using it like an operator and not like someone who Googled it.

This drill pairs with the three labs and three preceding drills. If a command's explanation here feels abstract, go back to the lab where you saw it used in context.

---

## systemctl status

**Problem it solves:** Tell you the lifecycle state of a systemd-managed service — is it running, failed, activating, or inactive.

**Signal to look for:** The `Active:` line. Specifically: `failed (Result: signal)` vs `failed (Result: exit-code)` vs `active (running)` vs `activating`. Also scan the embedded journal snippet for the last few log lines — often the error message is right there.

**What it cannot tell you:** Whether the process is actually healthy. `active (running)` means the process exists and systemd has not detected a crash. The application could be deadlocked, out of memory, or returning 500s to every request.

**Common misuse:** Restarting the service without reading the exit code or log lines first. The restart will fail the same way if the root cause (missing config, permission error, port conflict) is not addressed.

**Example signal:**
```
Active: failed (Result: exit-code) since Wed 2026-04-09 23:06:41 UTC; 3min ago
Process: 28914 ExecStart=... (code=exited, status=1/FAILURE)
Apr 09 23:06:41 appserver[28914]: FATAL: cannot open config file: no such file or directory
```

---

## journalctl

**Problem it solves:** Query structured logs from the systemd journal. Covers both the kernel (dmesg equivalent) and all services writing to journald.

**Signal to look for:** Error and critical priority messages. Use `-p err` to filter. Look for timestamps clustering around the incident window. `journalctl -u <unit> --since "10 minutes ago"` scopes to relevant time.

**What it cannot tell you:** Logs that the application writes directly to a file (not to stdout/stderr or syslog). If the app writes `/var/log/app.log` itself, journalctl will not have those entries.

**Common misuse:** Running `journalctl -u service` without `--since` or `-n` and getting flooded with days of logs. Always add a time window or line limit.

**Key flags to know:**
```bash
journalctl -u appserver -n 50 --no-pager       # Last 50 lines, unit-scoped
journalctl -p err --since "1 hour ago"          # Errors across all units, last hour
journalctl -k --since "30 minutes ago"          # Kernel messages only (like dmesg with time filter)
journalctl -f -u appserver                      # Follow live (like tail -f)
```

---

## ps aux

**Problem it solves:** List all processes with their CPU, memory, state, and command line. The fastest way to confirm a process is alive and see what it is doing.

**Signal to look for:** The `STAT` column. `D` = uninterruptible sleep (blocked on IO or kernel resource). `Z` = zombie (parent has not called `wait()`). `S` = sleeping normally. `R` = running. Multiple processes in `D` state is a warning of IO saturation.

**What it cannot tell you:** Whether a process is being CPU-throttled by a cgroup. A throttled process shows low `%CPU` even when the host has idle cores. Use `pidstat` and `cat /sys/fs/cgroup/.../cpu.stat` for that.

**Common misuse:** Sorting by `%CPU` and concluding the top process is the problem. `%CPU` is a point-in-time snapshot — a process might be showing 0.1% during a brief lull in a job that is actually causing saturation at other times.

---

## top

**Problem it solves:** Real-time view of system resource usage — overall CPU breakdown, memory, swap, and the top processes by CPU or memory.

**Signal to look for:** The `%wa` (IO wait) field in the CPU line. High `wa` (above 20-30%) means CPUs are idle waiting for disk. Processes in `D` state in the process list. `used` vs `available` in the memory line.

**What it cannot tell you:** Per-device IO breakdown. `top` tells you there is IO pressure, not which device or which process is causing it. Use `iostat` for device breakdown and `iotop` for per-process IO accounting.

**Common misuse:** Looking only at `us` (user CPU) and ignoring `wa`, `sy`, and `st`. On a cloud VM, `st` (steal) above 5% means the hypervisor is taking CPU cycles away from your VM — a common source of unexplained slowness.

---

## pidstat

**Problem it solves:** Per-process resource statistics over time. Critically: the `%wait` column shows how long a process spends runnable but not scheduled — the fingerprint of CPU throttling.

**Signal to look for:** `%wait` column. Above 50% means the process is ready to run but is being held back more than half the time. Combine with host `%idle` to distinguish throttling (host idle, process %wait high) from saturation (host idle near 0%, %wait high).

**What it cannot tell you:** Cgroup limits directly. It shows the effect (high wait) but you need to read `cpu.stat` in the cgroup filesystem to confirm the cause is a quota.

**Common misuse:** Running `pidstat` once and drawing conclusions. CPU scheduling is bursty. Run `pidstat -u 1 10 -p <PID>` for 10 one-second samples.

---

## free -m

**Problem it solves:** Quick summary of physical memory and swap — total, used, free, and crucially the `available` column.

**Signal to look for:** The `available` column (not `free`). Available accounts for reclaimable page cache and is the realistic "how much more can a new process allocate" number. Also: any nonzero `used` in the Swap line warrants investigation on a host that should have ample RAM.

**What it cannot tell you:** Which process is consuming memory. It shows aggregate totals only. Use `ps aux --sort=-%mem` or check cgroup `memory.usage_in_bytes` per container.

**Common misuse:** Looking at the `free` column and concluding memory is fine. `free` excludes buff/cache. On a well-utilized host, `free` is always near zero because the kernel fills the rest with page cache. `available` is the correct column.

---

## vmstat

**Problem it solves:** System-wide view of process states, memory activity, swap IO, block IO, interrupts, and CPU breakdown — all in one line per interval.

**Signal to look for:** `b` column (processes blocked on IO), `si`/`so` (swap in/swap out — nonzero si or so means active swapping), `wa` CPU column (IO wait). Watch the trend across multiple samples.

**What it cannot tell you:** Per-device breakdown. `vmstat` gives aggregate block IO (`bi`/`bo`), not per-device await or utilization. Use `iostat -xz` for that.

**Common misuse:** Running `vmstat` once (`vmstat 1`) and only reading the first line. The first line of `vmstat` output is averages since boot — meaningless for current state. Always collect multiple samples: `vmstat 1 10`.

---

## iostat

**Problem it solves:** Per-device IO statistics — read/write throughput, request latency (`r_await`, `w_await`), queue depth (`aqu-sz`), and device utilization (`%util`).

**Signal to look for:** `%util` near 100% (device saturated). `w_await` or `r_await` much higher than the device's normal baseline (under 1ms for NVMe, under 5ms for modern SSD, under 20ms for spinning disk). `aqu-sz` above 1 (requests queuing up).

**What it cannot tell you:** Which process is causing the IO. `iostat` is device-centric. Pair it with `iotop -o` (processes causing IO right now) or `blktrace` for deep tracing.

**Common misuse:** Trusting `%util` as a linear capacity indicator. SSDs and NVMe drives can handle parallel requests (queue depth > 1) — a device at 80% `%util` with `aqu-sz` of 0.1 is healthy. A device at 40% `%util` with `aqu-sz` of 8 is congested. Read both together.

---

## df -h

**Problem it solves:** Filesystem byte usage — total size, used, available, and percentage per mounted filesystem.

**Signal to look for:** Any filesystem above 85% usage (approaching inode or space exhaustion risk). The `/var` partition specifically — it holds logs, package managers, container layers, and spool queues.

**What it cannot tell you:** Inode usage, IO latency, whether the filesystem is mounted read-only, or whether a deleted-but-open file is holding space. It is a capacity snapshot, nothing more.

**Common misuse:** Stopping at `df -h` when diagnosing write failures. Always also run `df -i`. Always also run `findmnt` to check mount options. The combination of all three takes 15 seconds.

---

## df -i

**Problem it solves:** Filesystem inode usage — total inodes, used, free, and percentage per filesystem.

**Signal to look for:** Any filesystem at or near 100% inode usage. A filesystem can be at 10% byte usage and 100% inode usage simultaneously. When `IUse%` is 100%, no new files can be created, and applications receive `ENOSPC` from file creation syscalls.

**What it cannot tell you:** Which directories hold the most inodes. Follow up with `find <dir> -xdev | wc -l` per subdirectory or the loop pattern from Drill 02.

**Common misuse:** Not running it at all. Most SREs check `df -h` reflexively but not `df -i`. In environments with Docker, mail queues, or high-churn small files, inode exhaustion is a real production failure mode.

---

## findmnt

**Problem it solves:** Show the full mount tree with filesystem types and mount options — a more complete view than `mount | grep`.

**Signal to look for:** Mounts with `ro` in the OPTIONS column (unexpected read-only mount). NFS mounts (fstype `nfs4` or `nfs`) — these introduce network dependency and latency into what looks like a local write. `errors=remount-ro` in ext4 mounts (will remount read-only on error).

**What it cannot tell you:** Whether an NFS mount is currently hung. `df -h` on a hung NFS mount will itself hang. Use `findmnt` first (it reads `/proc/mounts` without triggering IO) before `df` on systems with NFS.

**Common misuse:** Skipping it entirely and using `mount` instead. `findmnt` shows the tree structure (which overlays are stacked on which devices) more clearly than `mount` output.

---

## lsblk

**Problem it solves:** Show the block device tree — physical disks, partitions, LVM volumes, RAID devices — and which filesystems are mounted on which.

**Signal to look for:** The `RO` column. `RO=1` means the block device itself is read-only (hardware level or kernel flag). This is distinct from a filesystem being mounted read-only. Also check `TYPE` — `disk`, `part`, `lvm`, `raid1` tell you what layer you are on.

**What it cannot tell you:** IO statistics or filesystem health. For IO, use `iostat`. For filesystem errors, use `dmesg | grep EXT4` or `xfs_info`.

**Common misuse:** Confusing `lsblk` output for an NVMe device that shows no mounts with an unmounted disk. The device may be in use by LVM or MD RAID but not show a direct mount.

---

## ss -s

**Problem it solves:** Summary of socket counts by type and state — how many TCP connections are in each state across the whole host.

**Signal to look for:** Unusually high CLOSE_WAIT count (connection leak). Unusually high TIME_WAIT count (short-lived connections being created faster than they drain — often a sign of a retry storm). Large number of sockets overall on a service that should have a bounded connection pool.

**What it cannot tell you:** Which process owns which sockets. Use `ss -tanp` for process attribution.

**Sample output to recognize:**
```
Total: 3284
TCP:   2941 (estab 1204, closed 128, orphaned 0, timewait 118)
        Transport Total     IP        IPv6
        *         3284      -         -
        RAW       0         0         0
        UDP       12        8         4
        TCP       2813      1904      909
        INET      2825      1912      913
```

---

## ss -tanp

**Problem it solves:** Full TCP socket list with state, queue sizes, addresses, ports, and owning process. The primary tool for diagnosing connection-level networking issues.

**Signal to look for:** Sockets in `LISTEN` state (confirm the service is bound and on which address). `Recv-Q > 0` on a LISTEN socket means the accept queue is backed up — the application is not accepting connections fast enough. CLOSE_WAIT sockets growing over time (connection leak).

**What it cannot tell you:** Whether packets are reaching the socket or being dropped by a firewall upstream. For that, use `tcpdump` on the interface.

**Common misuse:** Running it once and reading it as a static picture. Socket states change constantly. For CLOSE_WAIT analysis, poll with `watch -n2 'ss -tanp | grep -c CLOSE_WAIT'` and watch the trend.

---

## ip addr

**Problem it solves:** Show all network interfaces, their IP addresses, states, and flags.

**Signal to look for:** Interface state (`UP` vs `DOWN`). IP address assigned to the right interface. Whether the expected IP is present at all (important after a failed cloud metadata refresh or static config error). `NO-CARRIER` on an interface that should be connected.

**What it cannot tell you:** Routing or firewall state. Use `ip route` for routing and `iptables-save`/`nft list ruleset` for firewall.

**Common misuse:** Confusing interface state with link state. An interface can be `UP` (administratively enabled) but `NO-CARRIER` (no physical or virtual cable connected).

---

## ip route

**Problem it solves:** Show the kernel routing table — which traffic goes via which interface and gateway.

**Signal to look for:** Is a default route present? `default via <gateway> dev <interface>`. If absent, the host cannot reach anything outside its local subnet. Is traffic to a specific destination being routed through the expected interface?

**What it cannot tell you:** Whether the gateway is reachable or whether there is packet loss. Follow up with `ping <gateway>` and `traceroute`.

**Common misuse:** Not checking after a network interface reconfiguration. Bringing an interface down and back up can remove routes, leaving the host with a local subnet route but no default gateway.

---

## resolvectl status

**Problem it solves:** Show DNS configuration managed by `systemd-resolved` — which DNS servers are configured, per-link settings, and the current resolver state.

**Signal to look for:** Which DNS server each interface is using. Whether a link has DNS servers configured at all. `DNSSEC` and `LLMNR` state. This is the correct tool on modern Ubuntu/Debian systems — `/etc/resolv.conf` may just point to `127.0.0.53` (the resolved stub).

**What it cannot tell you:** Whether the DNS server itself is responding correctly. Follow up with `dig @<server> <name>` to test directly.

**Common misuse:** Reading `/etc/resolv.conf` and assuming it shows the actual DNS server. On systems with `systemd-resolved`, `/etc/resolv.conf` shows only the local stub resolver. Use `resolvectl status` to see the real upstream.

---

## dig

**Problem it solves:** Send a DNS query and show the full response — answer records, query time, server used, and any errors.

**Signal to look for:** `ANSWER SECTION` present (name resolved). `NXDOMAIN` (name does not exist). `SERVFAIL` (DNS server encountered an error resolving). Query time (high latency can cascade into application slowness). `SERVER:` line (which resolver was actually used).

**What it cannot tell you:** Whether the application is using the same resolver. The application may have a hard-coded DNS server, use a resolver library with a different timeout, or have a stale cached entry.

**Key usage patterns:**
```bash
dig api.example.com                          # Use default resolver
dig @8.8.8.8 api.example.com                 # Use specific resolver
dig api.example.com +short                   # IP addresses only
dig api.example.com MX                       # Query a specific record type
dig -x 10.0.0.41                             # Reverse lookup (PTR)
```

---

## tcpdump

**Problem it solves:** Capture packets on an interface and inspect them. The last resort when higher-level tools (ss, dig, curl) do not explain the failure — you need to see what is actually on the wire.

**Signal to look for:** SYN without SYN-ACK (server not receiving or not responding). RST immediately after SYN (firewall or application rejecting). Large TCP retransmits (`[R]` flags). Abnormal window sizes or MSS values.

**What it cannot tell you:** Application-layer content in encrypted TLS connections without decryption keys. For HTTPS debugging, use `curl -v` or application-level logging.

**Key usage patterns:**
```bash
tcpdump -i ens3 -n port 8443              # All traffic on port 8443
tcpdump -i any -n host 10.0.0.12          # All traffic to/from a specific host
tcpdump -i ens3 -n -w /tmp/cap.pcap       # Write to file for analysis in Wireshark
tcpdump -i ens3 -n 'tcp[tcpflags] == tcp-syn'  # SYNs only
```

**Common misuse:** Running tcpdump without `-n` (it will do reverse DNS lookups on every packet, slowing the capture and potentially missing packets during a high-traffic storm). Always use `-n` in production.

---

## iptables-save

**Problem it solves:** Dump the full iptables ruleset in a readable, persistent format. More reliable than `iptables -L -n -v` for seeing the exact rules in order.

**Signal to look for:** Rules in the `INPUT` chain that drop or reject traffic to your service port. The `FORWARD` chain if you are debugging container or VM routing. The order of rules matters — the first matching rule wins.

**What it cannot tell you:** Whether nftables rules are also active. On modern systems, iptables and nftables can coexist. If `iptables-save` shows no relevant rules but traffic is still blocked, check `nft list ruleset`.

**Common misuse:** Editing iptables rules directly with `iptables -I` without saving afterward. Rules are lost on reboot. Use `iptables-save > /etc/iptables/rules.v4` or `netfilter-persistent save` to persist.

---

## nft list ruleset

**Problem it solves:** Show the active nftables ruleset — the modern Linux firewall framework that replaced iptables on many distributions.

**Signal to look for:** `policy drop` on the `input` chain (default-deny). Missing `accept` rules for your service port. `counter` statements showing how many packets each rule has matched (useful for confirming a rule is actually being hit).

**What it cannot tell you:** iptables rules (a separate framework). On RHEL 8+, nftables is the default. On Ubuntu 22.04+, nftables is default. Know which framework your hosts use.

**Common misuse:** Making iptables changes on a host where nftables is the active framework. The changes go through the iptables compatibility shim but may interact unexpectedly with native nftables rules. Stick to one framework per host.

---

## Mentor Tip: Prove and Disprove

Every command here proves something and fails to prove something else. An experienced operator says "I ran `df -h` and it shows 43% used — that rules out bytes as the problem but says nothing about inodes, latency, or mount state." They chain commands to sequentially eliminate hypotheses rather than running the same three commands they always run and guessing from there.

The test: can you pick any two commands from this list and explain to a colleague what the first one proves, what gap it leaves, and which command fills that gap?
