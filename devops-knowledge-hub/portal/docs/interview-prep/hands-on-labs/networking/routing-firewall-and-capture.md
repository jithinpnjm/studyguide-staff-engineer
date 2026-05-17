---
title: "Networking Lab 3: Routing, Filtering, And Packet Capture"
sidebar_position: 3
---

# Networking Lab 3: Routing, Filtering, And Packet Capture

## Production Context

An alert fires at 16:12 UTC: the `payment-processor` service is unreachable from the
`order-service` pod, but the same `payment-processor` endpoint is reachable from a
developer's laptop via VPN. The services are in the same Kubernetes cluster, in
different namespaces. Infrastructure was changed at 15:58 UTC — a new NetworkPolicy
and a node firewall rule were applied. You need to determine whether this is a routing
problem, a filtering problem, or both, and pinpoint exactly which rule is responsible.

---

## Prerequisites

- Linux host or a running Kubernetes cluster
- Tools: `ip`, `ss`, `curl`, `traceroute`, `tcpdump`, `iptables` (or `nft`)
- For Kubernetes: `kubectl exec` access to pods in affected namespaces

---

## Environment Setup

For the host-level firewall scenario, simulate a DROP rule blocking a specific source:

```bash
# Create a test server on port 9090
python3 -m http.server 9090 &
SERVER_PID=$!

# Allow traffic from loopback (working path)
# Block traffic from 10.10.2.0/24 (broken path)
sudo iptables -I INPUT -s 10.10.2.0/24 -p tcp --dport 9090 -j DROP

# Verify working path (loopback)
curl -s http://127.0.0.1:9090 | head -1

# Verify broken path (use a secondary IP in the blocked range if available)
# cleanup:
# sudo iptables -D INPUT -s 10.10.2.0/24 -p tcp --dport 9090 -j DROP
# kill $SERVER_PID
```

---

## Beginner Section: Guided Walkthrough

### Step 1 — Understand the three failure signatures before running any commands

Before touching any tool, you need to know what you are looking for. Different network
failures produce different symptoms:

| Failure type | Client symptom | Time to fail | What packet capture shows |
|-------------|---------------|-------------|--------------------------|
| No route | `Network unreachable` (ICMP) | Immediate | ICMP destination unreachable from nearest router |
| Firewall DROP | Connection times out | Full timeout (15-120s) | SYN packets sent, no SYN-ACK ever arrives |
| Firewall REJECT | `Connection refused` (TCP RST) | Immediate | SYN sent, RST received |
| Service not listening | `Connection refused` | Immediate | SYN sent, RST from destination |
| DNS failure | Could not resolve | DNS timeout (~5s) | DNS query sent, no response |

The most important distinction for this incident: **timeout vs refused**. A timeout
almost always means a DROP rule or routing black hole. A refused means something is
listening but rejecting, or a REJECT rule.

### Step 2 — Run curl with verbose output and note the failure mode

From the broken source (order-service pod or a host in the blocked range):

```bash
curl -v --connect-timeout 5 http://payment-processor.payments.svc.cluster.local:8080/health
```

Expected output for a DROP scenario:

```
*   Trying 10.96.88.14:8080...
* connect to 10.96.88.14 port 8080 failed: Connection timed out
* Failed to connect to payment-processor.payments.svc.cluster.local port 8080 after 5003 ms: Connection timed out
* Closing connection 0
curl: (28) Failed to connect to payment-processor.payments.svc.cluster.local port 8080 after 5003 ms: Connection timed out
```

Expected output for a REJECT scenario:

```
*   Trying 10.96.88.14:8080...
* connect to 10.96.88.14 port 8080 failed: Connection refused
* Failed to connect to payment-processor.payments.svc.cluster.local port 8080 after 1 ms: Connection refused
curl: (7) Failed to connect to payment-processor.payments.svc.cluster.local port 8080 after 1 ms: Connection refused
```

This is `Connection timed out` — consistent with a DROP rule, not REJECT.

### Step 3 — Check routing tables

On the source host or pod:

```bash
ip route show
```

Expected output:

```
default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.55 metric 100
10.96.0.0/12 via 10.0.0.1 dev eth0 proto kernel   # Kubernetes service CIDR
10.244.0.0/16 via 10.0.0.1 dev eth0 proto kernel  # Kubernetes pod CIDR
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.55
```

If the route to the destination's CIDR is absent, traffic takes the default route and
may miss the network entirely. But here the route to `10.96.0.0/12` (Service CIDR) is
present, so routing is not the issue. Move to filtering.

```bash
ip route get 10.96.88.14
```

Expected output:

```
10.96.88.14 via 10.0.0.1 dev eth0 src 192.168.1.55 uid 1000
    cache
```

`ip route get` shows exactly which route applies to a single destination. It confirms
the packet will use `eth0` via the Kubernetes service gateway.

### Step 4 — Use tcpdump to see what the wire shows

Run tcpdump on the source side while repeating the failing curl:

```bash
# Terminal 1 — capture
sudo tcpdump -i any -n 'host 10.96.88.14 and port 8080' -c 20

# Terminal 2 — trigger
curl --connect-timeout 5 http://10.96.88.14:8080/health
```

Expected output when packets are being dropped:

```
16:14:02.114822 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240, length 0
16:14:03.122410 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240, length 0
16:14:05.130891 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240, length 0
```

Three SYN packets sent (`Flags [S]`), no SYN-ACK (`Flags [S.]`) ever returned. TCP
is retransmitting the SYN (first at 0s, then 1s, then 3s — standard exponential backoff).
This pattern is definitive: packets are being dropped somewhere between source and
destination.

Expected output for a healthy connection:

```
16:14:02.114822 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [S], seq 3842917645, win 64240
16:14:02.115190 IP 10.96.88.14.8080 > 10.10.2.5.49201: Flags [S.], seq 2917364821, ack 3842917646, win 65535
16:14:02.115230 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [.], ack 1, win 502
16:14:02.115310 IP 10.10.2.5.49201 > 10.96.88.14.8080: Flags [P.], seq 1:80, ack 1, win 502, length 79
16:14:02.116050 IP 10.96.88.14.8080 > 10.10.2.5.49201: Flags [.], ack 80, win 501
```

### Step 5 — Inspect iptables rules to find the DROP

```bash
sudo iptables -L INPUT -n -v --line-numbers
```

Expected output:

```
Chain INPUT (policy ACCEPT 0 packets, 0 bytes)
num  pkts bytes target     prot opt in     out     source            destination
1       3   180 DROP       tcp  --  *      *       10.10.2.0/24      0.0.0.0/0      tcp dpt:9090
2      12   720 ACCEPT     tcp  --  *      *       0.0.0.0/0         0.0.0.0/0      tcp dpt:9090
3    1204  82K  ACCEPT     all  --  lo     *       0.0.0.0/0         0.0.0.0/0
```

Rule 1 matches source `10.10.2.0/24` and drops it. Rule 2 would accept everything else.
The `pkts: 3` counter confirms this rule matched the three SYN retransmissions from the
failing curl. Line numbers allow targeted deletion:

```bash
sudo iptables -D INPUT 1
```

Verify fix immediately:

```bash
curl --connect-timeout 5 http://10.96.88.14:8080/health
```

### Step 6 — Check ss for connection state on the destination

On the destination (payment-processor) host:

```bash
ss -tanp | grep 8080
```

Expected output when nothing is reaching the service (all dropped before destination):

```
State    Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
LISTEN   0       128     0.0.0.0:8080        0.0.0.0:*          users:(("payment-proc",pid=4412,fd=8))
```

Only a `LISTEN` entry — no `SYN_RECV` or `ESTAB` from the failing client. This confirms
the packets never reached the application. If you saw `SYN_RECV` entries, that would mean
the server received the SYN but the ACK back is being dropped (asymmetric filtering).

### Step 7 — For Kubernetes: inspect NetworkPolicy

```bash
kubectl get networkpolicy -n payments -o yaml
```

Expected output of a policy with a namespace selector bug:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-processor-allow
  namespace: payments
spec:
  podSelector:
    matchLabels:
      app: payment-processor
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: orders     # BUG: namespace labels are not set by default
```

```bash
# Check if the orders namespace has the expected label
kubectl get namespace orders --show-labels
```

Expected output showing the label is missing:

```
NAME     STATUS   AGE   LABELS
orders   Active   3d    kubernetes.io/metadata.name=orders
```

The NetworkPolicy requires label `name=orders` on the namespace, but the namespace only
has the auto-set label `kubernetes.io/metadata.name=orders`. Fix:

```bash
kubectl label namespace orders name=orders
```

---

## Intermediate Section: Diagnose Without Full Hints

You are given these two tcpdump captures from opposite ends of the same connection:

**Source side (order-service pod, 10.244.1.8):**
```
10.244.1.8.52331 > 10.244.3.12.8080: Flags [S]
10.244.1.8.52331 > 10.244.3.12.8080: Flags [S]   (retransmit +1s)
10.244.1.8.52331 > 10.244.3.12.8080: Flags [S]   (retransmit +3s)
```

**Destination side (payment-processor pod, 10.244.3.12) — no output from this command.**

Questions without hints:

1. What does it mean that the source sees SYN packets but the destination sees nothing?
2. At which layer (CNI, node iptables, NetworkPolicy) is the drop most likely occurring?
3. Write the exact sequence of kubectl and iptables commands you would run on the
   destination node to find the specific DROP rule.
4. How does asymmetric routing change this picture? (What would tcpdump on destination
   show if the problem were asymmetric?)

---

## Advanced / Stretch

**Scenario A — NAT and asymmetric routing**

In a cloud environment, traffic from a pod goes through SNAT before leaving the node.
The return traffic arrives with the original destination IP, not the pod IP. Sketch the
iptables MASQUERADE flow. Explain why `tcpdump` on the pod sees the original IPs but
`tcpdump` on the physical interface sees the NATed IPs. Explain how this makes firewall
debugging misleading if you do not know which interface to capture on.

**Scenario B — eBPF (Cilium) policy tracing**

With Cilium as the CNI, iptables rules may not show the blocking policy. Use:

```bash
cilium monitor --type drop
kubectl exec -n kube-system -it $(kubectl get pod -n kube-system -l k8s-app=cilium -o name | head -1) \
  -- cilium policy trace --src-identity <source-endpoint> --dst-identity <dest-endpoint> --dport 8080
```

Explain what `cilium monitor --type drop` output looks like, and why host-level
iptables `-L` shows nothing despite packets being dropped.

**Scenario C — conntrack table exhaustion**

On a high-traffic node, the conntrack table can fill up, causing new connections to fail
with a "table full" kernel message:

```bash
# Check conntrack table usage
cat /proc/sys/net/netfilter/nf_conntrack_count
cat /proc/sys/net/netfilter/nf_conntrack_max
```

Explain the symptom (intermittent, affects new connections only, existing sessions work)
and the kernel log entry you would look for with `dmesg | grep conntrack`.

---

## Sample Diagnosis Note

```
Incident: payment-processor unreachable from order-service 16:12–16:31 UTC

Observable symptoms:
  - curl from order-service pod: Connection timed out (not refused)
  - curl from developer laptop via VPN: immediate HTTP 200
  - ip route on order-service pod: route to 10.96.0.0/12 present, routing not broken

Investigation:
  tcpdump on order-service pod: three SYN retransmits, no SYN-ACK
  tcpdump on payment-processor node: no packets arriving from 10.244.1.0/24
  → Packets dropped between source node and destination node

  Checked iptables on payment-processor node (node-3):
    iptables -L INPUT -n -v
    → Rule 1: DROP tcp src 10.244.0.0/14 dpt:8080  (pkts: 9, added 15:58 UTC)

Root cause: automation script applied a node-level iptables DROP rule targeting the
entire pod CIDR (10.244.0.0/14) on port 8080 as part of a "security hardening" change.
The intent was to block external access on 8080, but the rule accidentally covered
internal pod-to-pod traffic because pod IPs fall within 10.244.0.0/14.

Fix: removed rule at 16:31 UTC. Replaced with a more specific rule targeting only
external (non-pod) source IPs on 8080.
```

---

## Common Mistakes

- **Using `ping` to diagnose TCP application failures.** ICMP and TCP use different
  paths through firewalls. A host that responds to ping may still DROP TCP on specific
  ports.
- **Only checking iptables on one end.** Firewall rules exist on source, transit, and
  destination. Capture on both ends to localise where packets disappear.
- **Confusing REJECT with DROP.** REJECT sends back an error immediately (RST or ICMP
  unreachable). DROP silently discards. A fast failure is REJECT or "not listening".
  A timeout is DROP or routing black hole.
- **Forgetting cloud security groups are stateful.** In AWS/GCP, security groups track
  connection state. If you allow inbound on port 8080, the reply is automatically
  allowed. NACLs are stateless and require explicit rules for return traffic.
- **Not checking NetworkPolicy labels.** Kubernetes NetworkPolicy uses label selectors.
  A single missing or wrong label makes an entire allow rule ineffective — and the
  default-deny behaviour means all traffic from that namespace is silently dropped.

---

## What To Study Next

- Netfilter/iptables table and chain order: PREROUTING, INPUT, FORWARD, OUTPUT, POSTROUTING
- conntrack and stateful firewall tracking in Linux
- Kubernetes NetworkPolicy: ingress/egress, namespaceSelector, podSelector
- Cilium eBPF policy model: identities, endpoint policies, hubble observability
- Cloud security groups vs NACLs: stateful vs stateless, evaluation order
- Asymmetric routing and why it breaks stateful firewalls
