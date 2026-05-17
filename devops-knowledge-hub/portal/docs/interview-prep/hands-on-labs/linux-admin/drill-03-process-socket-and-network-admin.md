---
title: "Linux Admin Drill 3: Processes, Sockets, and Basic Network Administration"
sidebar_position: 99
---

# Linux Admin Drill 3: Processes, Sockets, and Basic Network Administration

## Why This Matters In Production

"Clients time out" is one of the most ambiguous alerts an SRE receives. The process could be dead. The process could be running but not listening. It could be listening on the wrong address. A firewall rule could be dropping packets. A routing issue could be preventing packets from arriving at all. Each of these has a different fix. Working through the layers systematically — process state, then bind state, then path reachability — avoids the trap of rebooting a service that was never the problem.

## Prerequisites

- Comfortable with `ps aux` and `systemctl status`
- Has seen a socket in `ss` output before
- Basic understanding of what a port is

## Time Estimate

50 minutes. The firewall and routing sections require root access — use a VM or a home lab if needed.

---

## Scenario

It is 15:20. Clients report connection timeouts to `api-server-01` on port 8443. The service was last deployed 2 hours ago with no alerts at the time. This is a fresh complaint.

---

## Part 1 — Beginner: Step-By-Step Triage

### Step 1 — Confirm The Process Is Running: ps aux

```bash
$ ps aux | grep appserver
appuser  22914  0.4  2.1 12984320 1384448 ?  Ssl  13:18   0:48 /usr/bin/appserver --config /etc/appserver/config.yaml --port 8443
appuser  22918  0.1  0.5  4194304  327680 ?  Sl   13:18   0:12 /usr/bin/appserver --worker --parent 22914
appuser  22920  0.0  0.5  4194304  327680 ?  Sl   13:18   0:11 /usr/bin/appserver --worker --parent 22914
root     31042  0.0  0.0   6748   884 pts/0  S+   15:21   0:00 grep appserver
```

**The process is running** (PID 22914, uptime since 13:18 — 2 hours ago, consistent with the deploy). Three processes: one parent and two workers. `STAT Ssl` — sleeping, multi-threaded, session leader.

The process is alive. So the issue is either: not listening, listening on wrong address, or path blocked.

---

### Step 2 — Confirm What Is Listening: ss -lntp

```bash
$ ss -lntp
State    Recv-Q   Send-Q   Local Address:Port   Peer Address:Port   Process
LISTEN   0        128      127.0.0.1:8443        0.0.0.0:*          users:(("appserver",pid=22914,fd=12))
LISTEN   0        4096     0.0.0.0:22            0.0.0.0:*          users:(("sshd",pid=841,fd=4))
LISTEN   0        4096        [::]:22               [::]:*          users:(("sshd",pid=841,fd=6))
```

**Found the problem: `127.0.0.1:8443`.** The application is listening only on the loopback address. Clients connecting from outside the host will never reach it — their packets arrive on the primary interface (`eth0`, `ens3`, etc.) but the socket is not bound there.

**Loopback-only vs all-interfaces:**
- `127.0.0.1:8443` — only processes on the same host can connect.
- `0.0.0.0:8443` — any IPv4 interface on the host. External clients can connect.
- `:::8443` — any IPv4 or IPv6 interface (the `ss` shorthand for `[::]`).

**Why does this happen?** Configuration files typically have a `bind_address` or `listen_address` field. After a deploy, this field was set or defaulted to `127.0.0.1` instead of `0.0.0.0`. You can verify locally:

```bash
$ curl -k https://127.0.0.1:8443/healthz
{"status":"ok","version":"2.14.1"}

$ curl -k https://10.0.0.41:8443/healthz
curl: (7) Failed to connect to 10.0.0.41 port 8443: Connection refused
```

---

### Step 3 — Check Active Connections: ss -tanp

```bash
$ ss -tanp
State       Recv-Q   Send-Q   Local Address:Port   Peer Address:Port   Process
LISTEN      0        128      127.0.0.1:8443         0.0.0.0:*         users:(("appserver",pid=22914,fd=12))
ESTABLISHED 0        0        127.0.0.1:8443         127.0.0.1:58201   users:(("healthcheck",pid=29041,fd=8))
ESTABLISHED 0        0        127.0.0.1:8443         127.0.0.1:58202   users:(("healthcheck",pid=29041,fd=9))
TIME_WAIT   0        0        10.0.0.41:8443         10.0.0.12:54312
TIME_WAIT   0        0        10.0.0.41:8443         10.0.0.14:54788
CLOSE_WAIT  32       0        10.0.0.41:8443         10.0.0.12:48210   users:(("appserver",pid=22914,fd=24))
CLOSE_WAIT  32       0        10.0.0.41:8443         10.0.0.14:48412   users:(("appserver",pid=22914,fd=25))
```

**What each state means:**
- `LISTEN` — the socket is open, accepting connections.
- `ESTABLISHED` — an active two-way connection.
- `TIME_WAIT` — connection has been closed but is held for 2*MSL (60-120 seconds) to handle late packets. Normal. Old connections from before the config change.
- `CLOSE_WAIT` — the remote peer sent FIN (closed its side), but the local process has not closed the socket yet. **Two CLOSE_WAIT sockets with `Recv-Q: 32` means unread data is sitting in the buffer.** The application is not draining those connections. This often means the application's connection-close code is not being reached (hung goroutine, blocked handler, etc.).

**CLOSE_WAIT accumulation is a connection leak.** If you see dozens or hundreds of CLOSE_WAIT sockets from `ss -tanp`, the application is not calling `close()` on sockets after the remote end closes. Over time this exhausts file descriptors.

---

### Step 4 — Check Interfaces and Routing: ip addr and ip route

```bash
$ ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
2: ens3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 52:54:00:ab:cd:ef brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.41/24 brd 10.0.0.255 scope global dynamic ens3
       valid_lft 72841sec preferred_lft 72841sec
3: ens4: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN group default qlen 1000
    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff
```

**What to read:**
- `lo` is loopback — always present, always `127.0.0.1`.
- `ens3` is the primary interface, IP `10.0.0.41`, state `UP`. Clients connecting to `10.0.0.41:8443` should arrive here. But the socket is bound to `127.0.0.1`, so they get `Connection refused`.
- `ens4` is `DOWN` — a second interface that is not active. Irrelevant here but good to check.

```bash
$ ip route
default via 10.0.0.1 dev ens3 proto dhcp src 10.0.0.41 metric 100
10.0.0.0/24 dev ens3 proto kernel scope link src 10.0.0.41
```

**The routing table looks correct.** Default gateway is `10.0.0.1`. The `/24` subnet is directly connected on `ens3`. Traffic to/from external clients will use `ens3` correctly. The problem is purely the bind address.

---

### Step 5 — Check Firewall Rules: iptables-save

```bash
$ iptables-save
# Generated by iptables-save v1.8.7 on Wed Apr 09 15:22:11 2026
*filter
:INPUT ACCEPT [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]
-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 8080 -j ACCEPT
-A INPUT -j DROP
COMMIT
```

**Additional finding: port 8443 is not in the firewall rules.** Even if the bind address were fixed to `0.0.0.0`, the firewall would drop incoming connections to 8443. Only ports 22 and 8080 are explicitly allowed. This is a second problem layered on top of the bind address issue.

**How to add the rule temporarily:**
```bash
iptables -I INPUT -p tcp --dport 8443 -j ACCEPT
```

**For persistent rules** (survives reboot), use `netfilter-persistent save` or `iptables-save > /etc/iptables/rules.v4`.

---

### Step 6 — Check if nftables Is Also Active

Some systems use `nftables` (the newer framework) alongside or instead of `iptables`. Always check both:

```bash
$ nft list ruleset
table inet filter {
    chain input {
        type filter hook input priority filter; policy drop;
        ct state established,related accept
        iifname "lo" accept
        tcp dport 22 accept
        tcp dport 8080 accept
    }
    chain forward {
        type filter hook forward priority filter; policy drop;
    }
    chain output {
        type filter hook output priority filter; policy accept;
    }
}
```

The `nftables` ruleset confirms the same restriction: only 22 and 8080 allowed. Port 8443 is dropped at the INPUT chain.

---

## Part 2 — Intermediate: Directed Analysis

Run these and interpret:

```bash
# How many CLOSE_WAIT connections does the service have right now?
ss -tanp | grep CLOSE_WAIT | wc -l

# How many file descriptors does the process have open?
ls /proc/22914/fd | wc -l
cat /proc/22914/limits | grep "open files"

# Is DNS resolving correctly from this host?
resolvectl status
dig api-server-01.internal @$(resolvectl status | grep "DNS Servers" | awk '{print $3}' | head -1)

# Trace the path to a client:
traceroute -n 10.0.0.12
```

Questions to answer:
1. The application is listening on `0.0.0.0:8443`. Clients in the same subnet connect successfully. Clients from a different subnet time out. What are the possible causes?
2. You see 847 CLOSE_WAIT sockets. The process has been running for 4 hours. Is this a leak? How do you distinguish a normal spike from a leak?
3. The firewall allows 8443. The process is listening on `0.0.0.0:8443`. A client from 10.0.1.5 still times out. `traceroute` to the host shows 3 hops. What next?
4. `dig app-service.svc.cluster.local` fails from the host but works from inside a pod on the same node. Why?

---

## Part 3 — Advanced / Stretch

**Scenario extension:** The bind address and firewall are now fixed. Traffic is flowing. But 30% of requests from external clients are failing with connection reset. Internal clients on the same subnet succeed 100% of the time.

Investigate:

```bash
# Capture packets on the public interface for 30 seconds:
tcpdump -i ens3 -n port 8443 -w /tmp/capture.pcap

# Summarize connection states:
ss -tanp | awk '{print $1}' | sort | uniq -c | sort -rn

# Check if the MTU differs between paths (common cause of TCP resets on external traffic):
ip link show ens3 | grep mtu
ping -M do -s 1400 10.0.0.12      # Internal client
ping -M do -s 1400 203.0.113.45   # External client
```

**MTU mismatch explained:** Internal paths often use MTU 1500. VPN or cloud overlay networks often use MTU 1450 or lower. If the server sends a 1500-byte packet through a path with MTU 1450, routers either fragment it or drop it with ICMP type 3 code 4 (Fragmentation Needed). If ICMP is blocked by the firewall, Path MTU Discovery silently fails and TCP connections appear to hang or reset.

Fix for confirmed MTU issue:
```bash
# Cap the maximum segment size for outbound TCP on this interface:
iptables -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
```

**Reasoning exercises:**
- A service is listening on `:::8443` (IPv6 all-interfaces). A client connecting to the IPv4 address `10.0.0.41:8443` succeeds on some hosts but fails on others. Why? (Hint: `IPV6_V6ONLY` socket option)
- A process exits but its port stays in `TIME_WAIT` for 2 minutes. A new instance of the service tries to start and gets "address already in use." What socket option would you add to the service to avoid this?
- `tcpdump` on the server shows the SYN arriving and a SYN-ACK being sent. The client says it never receives the SYN-ACK. Where is the packet being dropped?

---

## Sample Incident Note

```
[15:31 UTC] api-server-01 port 8443 unreachable from external clients — two issues found.

Issue 1: Application bound to 127.0.0.1:8443 (loopback only), not 0.0.0.0:8443.
  - Confirmed: curl 127.0.0.1:8443/healthz returns 200. curl 10.0.0.41:8443/healthz returns "Connection refused".
  - Cause: config.yaml bind_address set to 127.0.0.1 in deploy artifact (should be 0.0.0.0).

Issue 2: iptables INPUT chain only allows ports 22 and 8080. Port 8443 is dropped.
  - Confirmed: iptables-save shows no rule for 8443. nft list ruleset confirms same.
  - Added temporary rule: iptables -I INPUT -p tcp --dport 8443 -j ACCEPT.

Fix applied: updated config.yaml bind_address to 0.0.0.0, restarted appserver.
Verified: curl 10.0.0.41:8443/healthz from remote host returns 200.

Secondary finding: 2 CLOSE_WAIT sockets observed — monitoring for accumulation.
Permanent firewall fix: ticketed to update nftables ruleset via config management (ticket #8841).

Resolved at 15:29. Client-reported timeouts confirmed cleared at 15:30.
```

---

## Common Mistakes

- **Jumping to firewall rules without checking the bind address first.** The bind address is checked in 10 seconds with `ss -lntp`. Do it before touching iptables.
- **Assuming `0.0.0.0` and `[::]` are equivalent.** Some applications with `IPV6_V6ONLY` set will only accept IPv6 on the `[::]` socket even though `0.0.0.0` handles IPv4. Check both `ss` output lines.
- **Not checking `nft list ruleset` if `iptables-save` shows no rules.** Systems can use either nftables or iptables. On modern Debian/Ubuntu, nftables is the default. On RHEL/CentOS, iptables may be in use via the iptables-legacy backend.
- **Counting CLOSE_WAIT sockets once and drawing conclusions.** Watch the count over time with `watch -n2 'ss -tanp | grep -c CLOSE_WAIT'`. Growing count = leak. Stable count = normal backpressure.
- **Forgetting that `traceroute` uses UDP by default.** A firewall blocking UDP may make `traceroute` look like the path is broken when TCP is actually fine. Use `traceroute -T -p 8443` for TCP-specific path tracing.
- **Opening a port in iptables without making the rule persistent.** `iptables` rules are lost on reboot unless saved with `iptables-save` or managed through a tool like `ufw` or Ansible.

---

## What To Study Next

- Foundation doc: 01-networking-fundamentals.md — TCP state machine, TIME_WAIT, CLOSE_WAIT in depth
- Foundation doc: 10-linux-and-network-administration.md — firewall section
- Practice: deliberately bind a test server to `127.0.0.1`, confirm external failure, change to `0.0.0.0`, confirm success
- Drill 04: Command Mastery Checklist — consolidate the diagnostic commands from this drill and the others
