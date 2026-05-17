---
title: "Networking Lab 2: SSH Latency Drill"
sidebar_position: 2
---

# Networking Lab 2: SSH Latency Drill

## Production Context

An ops engineer reports that SSH to `bastion.prod.example.com` takes 18–22 seconds
before the shell prompt appears. Interactive sessions feel sluggish once connected. The
host is reachable over TCP — `ping` and `curl http://bastion.prod.example.com:8080/health`
return immediately. A junior engineer says "the server must be overloaded." Your job
is to place the delay in the exact phase of SSH login without accepting vague explanations.

---

## Prerequisites

- SSH client with verbose flag support
- `dig`, `ss`, `tcpdump` available
- A test SSH target (use localhost or a VM; the lab is designed to be runnable with
  `ssh localhost` if you have SSH server running)
- Optional: Wireshark or `tcpdump` for packet capture

---

## Environment Setup

To simulate a slow-auth scenario locally using PAM delay:

```bash
# Add PAM delay to simulate auth latency (Linux only, needs sudo)
# This adds 3 seconds to every PAM auth interaction
sudo bash -c 'echo "auth optional pam_faildelay.so delay=3000000" >> /etc/pam.d/sshd'

# To simulate reverse-DNS delay, add a fake hostname entry:
sudo bash -c 'echo "192.168.1.100  slow.bastion.test" >> /etc/hosts'
# Then in sshd_config ensure UseDNS yes
```

To restore after the lab:

```bash
sudo sed -i '/pam_faildelay/d' /etc/pam.d/sshd
```

---

## Beginner Section: Guided Walkthrough

### Step 1 — Time the full SSH connection to locate the delay

```bash
time ssh -o ConnectTimeout=10 user@bastion.prod.example.com true
```

Expected output when delay is in auth:

```
real    0m19.412s
user    0m0.031s
sys     0m0.011s
```

The `true` command means SSH connects, authenticates, runs `true` (exit 0 immediately),
and disconnects. This measures total connection time with no shell startup bias. If this
is fast but interactive shell feels slow, the delay is in shell startup (`.bashrc`,
`.profile`, NFS home dir mounts). If this is slow, the delay is before the shell.

### Step 2 — Use ssh -vvv to locate the phase

```bash
ssh -vvv -o ConnectTimeout=10 user@bastion.prod.example.com true 2>&1 | head -60
```

Expected output showing delay at auth phase:

```
OpenSSH_9.2, LibreSSL 3.3.6
debug1: Reading configuration data /etc/ssh/ssh_config
debug1: Connecting to bastion.prod.example.com [10.10.4.22] port 22.
debug1: Connection established.                      <-- TCP connect: immediate
debug1: identity file /home/user/.ssh/id_ed25519 type 3
debug1: Local version string SSH-2.0-OpenSSH_9.2
debug1: Remote protocol version 2.0, remote software version OpenSSH_8.9p1
debug3: kex alg list
debug1: kex: algorithm: curve25519-sha256           <-- key exchange: <100ms
debug1: kex: host key algorithm: ssh-ed25519
debug3: send packet: type 30
debug3: receive packet: type 31
debug1: SSH2_MSG_KEX_ECDH_REPLY received
debug1: Server host key: ssh-ed25519 SHA256:abc123...
debug1: Host 'bastion.prod.example.com' is known
debug3: send packet: type 21
debug1: SSH2_MSG_NEWKEYS sent
debug3: receive packet: type 21
debug1: SSH2_MSG_NEWKEYS received
debug1: rekey out after 134217728 blocks
debug1: SSH2_MSG_SERVICE_REQUEST sent
debug3: receive packet: type 6                      <-- here: pause begins (~18 seconds)
debug1: SSH2_MSG_SERVICE_ACCEPT received            <-- here: auth accepted
debug1: Authentications that can continue: publickey,gssapi-with-mic,password
debug3: start over, passed a different list of user auth methods
debug1: Next authentication method: publickey
debug3: send packet: type 50
debug3: receive packet: type 51
debug1: Authentications that can continue: publickey,gssapi-with-mic,password
debug1: Trying private key: /home/user/.ssh/id_ed25519
debug3: sign_and_send_pubkey: RSA SHA256
debug3: send packet: type 50
debug3: receive packet: type 52                     <-- auth success: immediate after
debug1: Authentication succeeded (publickey).
debug1: channel 0: new [client-session]
debug1: Entering interactive session.
```

The debug output tells you precisely where the delay is:

- `Connection established` to first key exchange: `< 50ms` — TCP is fast, routing is fine
- Key exchange to `SSH2_MSG_SERVICE_ACCEPT`: this is where the 18-second gap lives
- After service accept: auth and shell start fast

This gap between `SSH2_MSG_SERVICE_REQUEST sent` and `SSH2_MSG_SERVICE_ACCEPT received`
on the server side is typically caused by: reverse DNS lookup, GSSAPI negotiation timeout,
PAM stack delay, or failed access control check that eventually times out.

### Step 3 — Check reverse DNS

Many SSH servers perform a reverse DNS lookup on the client IP before proceeding. A
slow or broken PTR record adds the DNS timeout (typically 5–15 seconds) to every login.

```bash
# Find your client IP as seen by the server
dig -x $(curl -s ifconfig.me) +short
```

Expected output when PTR is missing:

```
;; connection timed out; no servers could be reached
```

Expected output when PTR is present:

```
client-123.isp.example.com.
```

If PTR lookup times out, the server's sshd waits for DNS resolution before proceeding.
The fix is either to add a PTR record, or to set `UseDNS no` in `/etc/ssh/sshd_config`
on the server. `UseDNS no` is now the default in modern OpenSSH, but many hardened
server images re-enable it.

### Step 4 — Check GSSAPI negotiation

GSSAPI (Kerberos) is attempted before publickey by default if enabled on the server.
A broken Kerberos KDC causes a timeout on every login attempt.

```bash
# Disable GSSAPI on the client to bypass the timeout
ssh -o GSSAPIAuthentication=no user@bastion.prod.example.com true
time ssh -o GSSAPIAuthentication=no user@bastion.prod.example.com true
```

If this is fast, GSSAPI is the culprit. Permanent client-side fix:

```
# ~/.ssh/config
Host bastion.prod.example.com
    GSSAPIAuthentication no
```

### Step 5 — Inspect the SSH server from the server side

On the bastion host itself, check active SSH sessions and auth log:

```bash
# On the server
ss -tanp | grep :22
```

Expected output:

```
State    Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
LISTEN   0       128     0.0.0.0:22          0.0.0.0:*          users:(("sshd",pid=1234,fd=3))
ESTAB    0       0       10.10.4.22:22       10.10.1.55:49812   users:(("sshd",pid=8821,fd=4))
ESTAB    0       0       10.10.4.22:22       10.10.1.55:49818   users:(("sshd",pid=8824,fd=4))
```

Multiple `ESTAB` connections from the same source is normal for persistent sessions.
`SYN_RECV` would indicate a half-open connection flood. `CLOSE_WAIT` would indicate
sessions not being cleaned up.

```bash
# On the server — tail auth log during a connection attempt
sudo tail -f /var/log/auth.log
```

Expected output showing reverse DNS delay:

```
Apr  9 11:23:41 bastion sshd[8821]: Connection from 10.10.1.55 port 49812
Apr  9 11:23:41 bastion sshd[8821]: reverse mapping checking getaddrinfo for ... [10.10.1.55] -- wait
Apr  9 11:23:59 bastion sshd[8821]: reverse mapping failed -- using IP address
Apr  9 11:23:59 bastion sshd[8821]: Accepted publickey for user from 10.10.1.55
```

The 18-second gap (11:23:41 to 11:23:59) is the reverse DNS lookup timing out.

### Step 6 — Packet capture to confirm TCP handshake is fast

```bash
# On client or intermediate host
sudo tcpdump -i any -n port 22 -c 20
```

Expected output for a healthy TCP connection followed by slow auth:

```
11:23:41.002145 IP 10.10.1.55.49812 > 10.10.4.22.22: Flags [S], seq 1234567, win 64240
11:23:41.018223 IP 10.10.4.22.22 > 10.10.1.55.49812: Flags [S.], seq 8765432, ack 1234568, win 65535
11:23:41.018301 IP 10.10.1.55.49812 > 10.10.4.22.22: Flags [.], ack 1, win 502
11:23:41.019420 IP 10.10.4.22.22 > 10.10.1.55.49812: Flags [P.], seq 1:22, ack 1, win 501, length 21
11:23:41.019501 IP 10.10.1.55.49812 > 10.10.4.22.22: Flags [P.], seq 1:22, ack 22, win 501, length 21
...
11:23:59.118204 IP 10.10.4.22.22 > 10.10.1.55.49812: Flags [P.], seq 44:280, ack 180, win 501, length 236
```

The `[S]` → `[S.]` → `[.]` sequence is the 3-way handshake. It completes in 16ms
(11:23:41.002 to 11:23:41.018). The next meaningful exchange is at 11:23:59 — 18 seconds
later. The TCP layer was never the problem. The gap lives entirely within the SSH
application layer.

TCP flag decode reference:

| Flag | Meaning |
|------|---------|
| `[S]` | SYN — initiating connection |
| `[S.]` | SYN-ACK — server accepting |
| `[.]` | ACK — handshake complete |
| `[P.]` | PSH+ACK — data payload |
| `[F.]` | FIN+ACK — graceful close |
| `[R]` | RST — abrupt close |

---

## Intermediate Section: Diagnose Without Full Hints

You receive this `ssh -vvv` excerpt from a user's ticket:

```
debug1: Connecting to jump.prod.corp [10.20.0.5] port 22.
debug1: Connection established.
debug3: send packet: type 20
debug3: receive packet: type 20
debug1: kex: algorithm: curve25519-sha256
debug3: send packet: type 30
debug3: receive packet: type 31
debug1: SSH2_MSG_KEX_ECDH_REPLY received
debug1: SSH2_MSG_NEWKEYS sent
debug3: receive packet: type 21
debug1: SSH2_MSG_NEWKEYS received
debug2: service_accept: ssh-userauth
debug1: SSH2_MSG_SERVICE_ACCEPT received
debug1: Authentications that can continue: publickey,keyboard-interactive
debug1: Next authentication method: publickey
debug3: send packet: type 50
debug3: receive packet: type 60    <-- waited 14 seconds here
debug1: Server accepts key: /home/jithin/.ssh/id_ed25519 ED25519
debug3: sign_and_send_pubkey
debug3: send packet: type 50
debug3: receive packet: type 51    <-- failure
debug1: Authentications that can continue: keyboard-interactive
debug1: Next authentication method: keyboard-interactive
```

Questions without hints:

1. In which SSH phase does the 14-second gap occur?
2. What is `type 60` in the SSH protocol? What does the server's slow response here suggest?
3. Why does it fall back to `keyboard-interactive`? What does this indicate about the
   key?
4. Write the `authorized_keys` check you would run on the server and the permission check
   that commonly causes key auth to silently fail.

---

## Advanced / Stretch

**Scenario A — Shell startup latency**

Even after a fast auth, the time to first prompt can be slow. Create a slow `.bashrc`:

```bash
echo "sleep 3" >> ~/.bashrc
```

Run `ssh localhost true` versus `ssh localhost bash -c true`. Explain why `true` is fast
but an interactive login is slow. Identify the exact sshd option and `.bashrc` pattern
that causes this, and write the fix.

**Scenario B — MaxSessions and connection multiplexing**

SSH multiplexing (ControlMaster) reuses one TCP connection for multiple SSH sessions:

```
# ~/.ssh/config
Host bastion.prod.example.com
    ControlMaster auto
    ControlPath ~/.ssh/cm-%r@%h:%p
    ControlPersist 5m
```

Explain how this eliminates the DNS + TCP + TLS overhead for subsequent sessions.
Explain the failure mode when the control socket becomes stale and how to recover.

**Scenario C — SSH through a bastion with ProxyJump**

```bash
ssh -J bastion.prod.example.com user@internal.host
```

Map the TCP connections this creates: how many TCP handshakes, how many SSH negotiations.
Explain what `ssh -vvv` output would look like if the jump host can reach the final host
but the final host refuses the key.

---

## Sample Diagnosis Note

```
Incident: SSH to bastion.prod.example.com taking 18-22s, reported by 6 engineers

Investigation timeline:
  11:30 UTC — time ssh user@bastion true: 19.4s
  11:31 UTC — ssh -vvv: 18s gap between SSH2_MSG_SERVICE_REQUEST and SERVICE_ACCEPT
  11:32 UTC — ssh -o GSSAPIAuthentication=no: still 18s (GSSAPI not the cause)
  11:33 UTC — dig -x <client-IP>: connection timed out (PTR lookup failing)
  11:34 UTC — confirmed sshd_config has UseDNS yes

Root cause: sshd was performing reverse DNS lookup on each client IP. Our DNS resolver
for the 10.10.1.0/24 range was silently timing out PTR queries after the zone SOA record
was misconfigured during a maintenance window at 11:00 UTC. Each lookup timed out after
~18 seconds before sshd fell back to using the IP address.

Fix: set UseDNS no in /etc/ssh/sshd_config on bastion.prod.example.com; sshd reload
at 11:42 UTC. SSH logins returned to <2s immediately.

Permanent fix: restore PTR records for 10.10.1.0/24 zone. Scheduled for 13:00 UTC.
```

---

## Common Mistakes

- **Assuming TCP slow means network is slow.** TCP connect for SSH is typically under
  50ms. Auth latency is almost always application-layer, not TCP.
- **Not testing with `ssh ... true`.** Testing by opening an interactive shell includes
  shell startup time, which can mask where the real delay is.
- **Forgetting GSSAPI as a cause.** GSSAPI is tried before publickey on many enterprise
  setups. It is the most common cause of 10-30 second SSH delays in AD-joined environments.
- **Reading `ss` output without context.** `ESTAB` state just means the connection is
  up. Check the age of connections with `ss -tan --info` to spot stuck states.
- **Patching the client config without fixing the server.** Setting `GSSAPIAuthentication no`
  in `~/.ssh/config` fixes your logins but not everyone else's. Root-cause the server.

---

## What To Study Next

- SSH protocol internals: key exchange (KEX), user authentication, channel protocol
- PAM (Pluggable Authentication Modules) stack and how it affects SSH auth latency
- `sshd_config` performance settings: `UseDNS`, `GSSAPIAuthentication`, `MaxStartups`
- SSH multiplexing and ProxyJump for operations at scale
- TCP half-open connections and `MaxStartups` DDoS protection in sshd
- `authorized_keys` permission requirements (why mode 644 on the file breaks key auth)
