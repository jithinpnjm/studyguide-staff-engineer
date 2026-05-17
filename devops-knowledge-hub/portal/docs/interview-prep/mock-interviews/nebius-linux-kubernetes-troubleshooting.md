---
title: "Mock Interview 1: Linux, Networking, and Kubernetes Troubleshooting"
sidebar_position: 1
---

# Mock Interview 1: Linux, Networking, and Kubernetes Troubleshooting

## Format and Intent

This is a 45–60 minute technical depth interview. The interviewer is not testing whether you know the answer — they are testing how you reason under uncertainty. Every question has a diagnostic structure: you are expected to form hypotheses, name the tools that produce evidence, and explain what each result would mean. Jumping to a conclusion without naming evidence is a red flag. Staying vague about the Linux or network layer when the question demands it is also a red flag.

Prepare to be interrupted with "what command gives you that?" and "what does a bad result look like?" Practice answering these out loud before you run them mentally.

**Suggested timing per question:** 4–6 minutes verbally, 2–3 minutes written debrief after the mock.

---

## Question 1

**"A service is timing out only from some nodes in a cluster. Walk me through your first ten minutes."**

**Time guidance:** 5–6 minutes. This is a scoping and triage question. Do not solve it — scope it methodically.

**What a strong answer covers:**
- Establishes the boundary: is this all pods on affected nodes, one namespace, one service, or one destination? Use `kubectl get pods -o wide` and compare node placement.
- Checks whether the pattern is node-local (kube-proxy, iptables, CNI agent) or rack/AZ-local (BGP, fabric, MTU).
- Names specific commands: `curl -v`, `traceroute`, `ss -s`, `iptables -L -n -v`, `tcpdump -i any -nn`, `conntrack -L`.
- Considers ECMP hashing and whether flows are consistently routing to one broken backend.
- Separates DNS resolution failures from TCP connect failures from HTTP-level errors early.

**What a weak answer looks like:**
- "I would check the logs and see if there are errors." No commands named, no failure domain reasoning.
- Jumps to "probably a node issue" without explaining how the node-specific pattern was confirmed.

**Sample answer skeleton:**
> "First I confirm the scope: I run `kubectl get pods -o wide` and map which pods are affected versus which nodes they sit on. If pods on nodes A and C fail but nodes B and D succeed, the pattern is node-local. I then check whether this is a new rollout — `kubectl rollout history` — or a pre-existing condition. On an affected node I'd run `curl -v <service-ip>:<port>` directly to test connectivity without DNS, then `ss -s` to check for socket exhaustion. I'd check kube-proxy logs with `journalctl -u kube-proxy --since '10m ago'` and validate iptables rules with `iptables -L KUBE-SERVICES -n -v`. If retransmits show up in `ss -i`, I look at the physical layer — MTU mismatch, bad NIC queue, or a failed BGP peer at the ToR switch."

---

## Question 2

**"Explain how a packet reaches a Pod from a client outside the cluster."**

**Time guidance:** 4–5 minutes. This is a conceptual depth check. Walk the full path without skipping layers.

**What a strong answer covers:**
- External load balancer (L4 or L7), NodePort or LoadBalancer service, kube-proxy iptables/IPVS rules doing DNAT, routing to the pod CIDR via CNI (Flannel/Cilium/Calico), container veth pair, pod netns.
- Notes that reply packets reverse the path and that conntrack is what makes the stateful DNAT work.
- Mentions where MTU issues can appear (VXLAN encapsulation, IPsec, GRE tunnels adding overhead).
- If Cilium is in scope: eBPF replaces iptables rules; kube-proxy may be absent; XDP handles early path.
- Can state where to look when each hop fails.

**What a weak answer looks like:**
- Stops at "the packet hits the Service and gets routed to a Pod." Does not explain DNAT, conntrack, or the CNI veth.
- Cannot name where MTU or encapsulation overhead enters the picture.

**Sample answer skeleton:**
> "The packet enters the cluster at the cloud LB, which forwards to a healthy node's NodePort or directly to a pod via the LB's backend pool. On the node, kube-proxy (or Cilium eBPF) has installed DNAT rules — the packet's destination is rewritten from the Service ClusterIP to the selected Pod IP. The kernel's conntrack table records this translation so the reply can be un-NATted on the way back. The CNI plugin is responsible for delivering the packet from the node's network namespace to the pod's veth pair inside the pod's netns. In an overlay CNI like Flannel VXLAN, the packet is encapsulated in UDP before crossing the node boundary, which adds 50 bytes of overhead. If the physical MTU is 1500, the effective pod MTU must be set lower or you get silent fragmentation and retransmits."

---

## Question 3

**"A Pod is Ready, but requests still fail. Give me five causes and how you would disprove each one."**

**Time guidance:** 5–6 minutes. Depth over speed. Name the command for each disproof.

**What a strong answer covers:**
- Readiness probe passes but the app is partially broken (bad connection pool, missing env var): `kubectl exec` + `curl localhost:<port>/healthz` with a deeper path.
- Service selector does not match pod labels: `kubectl get endpoints <svc>` — if the pod IP is absent, selector mismatch confirmed.
- kube-proxy lag: iptables rules not yet updated after pod replacement — compare endpoint list vs iptables DNAT chain timestamps.
- Network policy blocking traffic from the caller's namespace: `kubectl get netpol -A` and trace the policy against source/destination labels.
- Application-level TLS cert mismatch or expired cert even though the container is up: `openssl s_client -connect <pod-ip>:<port>` from another pod.

**What a weak answer looks like:**
- Lists causes without naming how to disprove them. "Could be a network policy" with no follow-up.
- Does not distinguish between the probe path and the actual serving path.

**Sample answer skeleton:**
> "Cause one: probe passes a shallow path but the real handler is broken. Disproof: exec into the pod and curl the actual endpoint. Cause two: selector mismatch — `kubectl get endpoints` shows the pod IP is missing. Cause three: stale iptables rule on the caller's node — compare the pod IP in `iptables -L KUBE-SEP-* -n` versus the current pod IP. Cause four: NetworkPolicy block — `kubectl get netpol` in both namespaces, trace ingress rules. Cause five: the app is bound to 127.0.0.1 not 0.0.0.0, so cluster traffic can't reach it — `ss -tlnp` inside the pod confirms the bind address."

---

## Question 4

**"Why can memory pressure hurt latency before any OOM kill occurs?"**

**Time guidance:** 4 minutes. This is a Linux internals question. Be specific about kernel behavior.

**What a strong answer covers:**
- Page reclaim: kswapd wakes up and scans page lists, competing for CPU with application threads.
- Dirty page writeback: if the app writes frequently, the kernel throttles writes when dirty_ratio is hit — this introduces blocking I/O inside what looks like memory operations.
- Swap: even small amounts of swap activity cause microsecond-to-millisecond delays when hot pages are evicted and re-faulted.
- cgroup memory limits: when a cgroup approaches its limit, direct reclaim runs synchronously in the application's call path, adding latency to any allocation.
- THP (Transparent Hugepages): compaction runs to create 2MB pages; compaction scans and pauses can introduce milliseconds of stall even without OOM.

**What a weak answer looks like:**
- "The system starts swapping and slows down." Correct but not enough depth.
- Does not distinguish kswapd (async) from direct reclaim (synchronous, in application path).

**Sample answer skeleton:**
> "The most impactful mechanism is direct reclaim. When a cgroup's memory usage is near its limit, any new allocation triggers synchronous page reclaim inside the calling thread's context — that allocation call now takes milliseconds instead of nanoseconds. This shows up as P99 spikes without OOM events. kswapd also competes for CPU in the background. If dirty page ratio is high, kernel writeback throttling can stall writes inside the app even when the app thinks it is doing in-memory work. I'd confirm with `sar -B`, `cat /proc/vmstat | grep pgmajfault`, and cgroup memory.stat to see reclaim events."

---

## Question 5

**"What does the kubelet do that matters operationally during a bad rollout?"**

**Time guidance:** 4–5 minutes. Focus on kubelet's active role, not just pod scheduling.

**What a strong answer covers:**
- kubelet enforces liveness and readiness probes and acts on them: it restarts containers on liveness failure and removes pods from endpoint slices on readiness failure.
- kubelet garbage collects dead containers and images — during a rollout with crash loops, image layer space can fill up.
- kubelet reports NodeConditions (MemoryPressure, DiskPressure, PIDPressure) which the scheduler and controllers react to.
- kubelet enforces cgroup limits and will OOM-kill a container that exceeds its memory limit.
- During eviction, kubelet follows priority classes — this matters for which pods survive when nodes are under pressure.

**What a weak answer looks like:**
- "kubelet starts and stops pods." Does not explain which signals kubelet acts on or what downstream effects follow.
- Does not mention probe enforcement or eviction.

**Sample answer skeleton:**
> "During a bad rollout the kubelet is doing several things that matter. First, it is running the readiness probe against new pods — if the probe fails, the pod stays out of the endpoint slice and traffic is not sent to it. This is the mechanism that (should) protect the service if rollout detection works. Second, it is running the liveness probe — if the app crashes into a broken state that passes liveness, the kubelet will not restart it, which is the subtle misconfiguration risk. Third, if new pods are crash-looping, the kubelet is pulling images and starting containers repeatedly — that uses ephemeral storage and can trigger DiskPressure. Finally, kubelet emits events that surface in `kubectl describe pod` and in the control plane — those are usually the first signal to an on-call engineer."

---

## Question 6

**"A DNS issue is suspected, but application teams insist 'the network is down.' How do you arbitrate with evidence?"**

**Time guidance:** 4–5 minutes. This is about structured evidence collection and communication under pressure.

**What a strong answer covers:**
- Separates DNS resolution failure from TCP connectivity failure from HTTP failure — each has a different test.
- Tests DNS directly: `dig @<coredns-ip> <service-name>.namespace.svc.cluster.local` from inside a pod.
- Tests raw connectivity: `curl -v <pod-ip>:<port>` bypassing DNS, to prove the network path works.
- Checks CoreDNS health independently: pod restarts, CPU throttling (`kubectl top pod -n kube-system`), upstream DNS resolution.
- Presents the evidence neutrally: "DNS resolution failed with NXDOMAIN from CoreDNS at 15:32; TCP connect to the pod IP succeeds; therefore the network is up and DNS is the failure."

**What a weak answer looks like:**
- "I would check the logs and explain to the team what I found." No specific tests, no evidence structure.
- Takes sides ("they're wrong") instead of using evidence to narrow the scope.

**Sample answer skeleton:**
> "I run two tests in parallel from inside the affected pod. Test one: `curl -v http://<direct-pod-ip>:<port>/` — this bypasses DNS entirely. If it succeeds, the network is not down and DNS is the issue. Test two: `dig @10.96.0.10 <service>.namespace.svc.cluster.local` — if this returns NXDOMAIN or times out, CoreDNS is the problem. I check CoreDNS pods for restarts and CPU throttling. I present the result as a timeline: TCP works, DNS fails at time X, CoreDNS pod was at 98% CPU limit. That is the arbitration. The network path is fine; the DNS resolver is the bottleneck."

---

## Question 7

**"You see retransmits, elevated tail latency, and partial rack impact. What layers do you test first and why?"**

**Time guidance:** 5 minutes. Layered diagnostic reasoning is the point.

**What a strong answer covers:**
- Rack-partial pattern strongly implicates physical: a bad ToR switch, a degraded uplink, or a failed NIC on one or two nodes.
- First checks: `ethtool -S <iface>` for NIC error counters, `ip -s link` for TX/RX errors and drops, `/proc/net/dev`.
- Second layer: checks whether affected pods all share the same physical host or the same ToR — `kubectl get pods -o wide` plus node-to-rack mapping.
- Network layer: ECMP routing asymmetry causing one path to be congested while others are idle.
- Distinguishes TCP retransmits (application-visible, causes latency jitter) from ethernet-level retransmits (layer 2, may be invisible to applications but indicate physical degradation).

**What a weak answer looks like:**
- Starts with application logs. Physical symptoms are described but no physical-layer tools are named.
- Does not use the "partial rack" clue to narrow scope early.

**Sample answer skeleton:**
> "Partial rack impact tells me this is probably physical before it is logical. I start with `ethtool -S eth0` on nodes in the affected rack — I am looking for `tx_errors`, `rx_missed_errors`, and `rx_crc_errors`. Simultaneously I check `ip -s link` for drops. If one node has a degraded NIC, I see asymmetric error counts compared to healthy nodes. If the NIC is clean, I look at the ToR switch: is there a port flapping? I get this from the network team's syslog or from SNMP counters. Only after ruling out physical do I look at iptables conntrack overflow or kernel ring buffer drops with `dmesg | grep -i drop`."

---

## Question 8

**"What are requests, limits, and QoS really buying you in a multi-tenant platform?"**

**Time guidance:** 4 minutes. This is a policy and system design question disguised as a K8s question.

**What a strong answer covers:**
- Requests determine scheduling: the scheduler will not place a pod on a node unless the sum of requests fits the node's allocatable capacity.
- Limits are enforced by cgroups at runtime: CPU limit triggers CFS throttling; memory limit triggers OOM kill.
- QoS class (Guaranteed, Burstable, BestEffort) determines eviction order and OOM score — important for protecting high-priority workloads under node pressure.
- In multi-tenant settings, a single badly configured workload without limits can cause noisy neighbor CPU or memory issues.
- Requests and limits alone are not enough — namespace ResourceQuotas and LimitRanges enforce guardrails at the tenant level.

**What a weak answer looks like:**
- "Requests tell K8s how much CPU/memory a pod needs." Technically right but misses the scheduling and enforcement mechanics.
- Does not mention QoS classes or eviction behavior.

**Sample answer skeleton:**
> "Requests are a scheduling hint and a QoS input. The scheduler packs pods until the sum of requests exceeds the node's allocatable. Limits are a runtime enforcement: the Linux CFS scheduler enforces CPU limits with quota cycles, and the cgroup memory controller enforces memory limits. The QoS class is derived from the relationship between requests and limits — Guaranteed means they are equal, which gives the pod a low OOM score and makes it last to be evicted. In a multi-tenant platform, Guaranteed QoS for critical control-plane workloads means they survive node memory pressure that would evict BestEffort pods first. I'd also add LimitRanges so tenants who omit limits still get defaults."

---

## Question 9

**"A probe configuration caused cascading failure during peak load. Explain the mechanism."**

**Time guidance:** 5 minutes. Walk through the failure chain step by step.

**What a strong answer covers:**
- A liveness probe with too-short a timeout and too-low a failure threshold: under load, the app is slow to respond, the probe fails, kubelet restarts the container, the restart causes more latency elsewhere (lost connections, cold cache), which causes more probe failures.
- A readiness probe misconfiguration: probe passes but the app is not ready (shallow health check), traffic is sent to an overwhelmed pod, which fails, which triggers more retries, which causes overload.
- Probe timeout being shorter than the app's P99 under load: normal load causes normal probe failures during bursts.
- Cascading effect: as pods are restarted, fewer pods handle the same traffic, increasing per-pod load, causing more probe failures, causing more restarts — a death spiral.
- Mitigation: generous timeouts, initialDelaySeconds, startupProbe to avoid premature liveness during warm-up.

**What a weak answer looks like:**
- "The probe was configured wrong and pods kept restarting." No failure chain, no explanation of why restarts cause more restarts.

**Sample answer skeleton:**
> "The mechanism is a feedback loop. Under peak load, the app is responding to real requests at P99 of 800ms. The liveness probe has a `timeoutSeconds: 1` and `failureThreshold: 2`, so two 1-second probe timeouts in a row trigger a restart. During peak load, every pod is slow enough to fail two consecutive probes. kubelet begins restarting pods serially. Each restart removes a pod from the endpoint set — the remaining pods handle proportionally more traffic, pushing their latency higher. This causes them to fail probes faster. Within 2–3 minutes, the deployment has restarted most of its pods during peak load, drained the connection pool, and cleared any in-memory cache. Traffic is now hitting cold pods in a death spiral."

---

## Question 10

**"Give me an example of a production issue where Linux, networking, and Kubernetes all interacted."**

**Time guidance:** 6 minutes. This is behavioral and technical combined. Use a real or realistic scenario.

**What a strong answer covers:**
- Tells a structured story: context, symptoms, hypothesis chain, diagnosis, fix, prevention.
- Shows that the candidate can reason across layers without compartmentalizing.
- The root cause should be genuinely cross-layer (not just "K8s thing" or "network thing").
- Names the tools used at each layer and what each one revealed.
- Includes what was learned and what changed as a result.

**What a weak answer looks like:**
- A vague story: "We had a networking issue and eventually found a K8s config problem." No commands named, no failure chain.
- A single-layer story that is relabeled as multi-layer.

**Sample answer skeleton:**
> "We had intermittent 503s in one region. Pods were healthy, endpoints were populated, logs showed nothing. I ran `tcpdump` on the affected node and saw SYN packets arriving but no SYN-ACK. The conntrack table was full — `sysctl net.netfilter.nf_conntrack_max` was at its default of 65536, and we had scaled to 200+ pods per node during a load test. The conntrack overflow silently dropped new connections. This was a Linux kernel parameter, triggered by a Kubernetes scaling event, on a network path that only used conntrack because kube-proxy was in iptables mode. Fix: raised nf_conntrack_max and nf_conntrack_buckets, added monitoring on conntrack usage. Prevention: added a node-level DaemonSet that monitors conntrack fill rate and alerts before saturation."

---

## Scoring Rubric

| Level | Indicators |
|-------|-----------|
| Strong | Names specific commands unprompted. Explains what output means, not just what to run. Reasons through failure chains. Uses "partial rack" or "some nodes" clues to narrow the scope early. Distinguishes probe paths from serving paths. |
| Medium | Concepts are mostly correct but generic. Commands are named only after probing. Does not reach the kernel or network layer without prompting. Treats K8s objects as the only layer of abstraction. |
| Weak | Stays at YAML or dashboard level. Uses "check the logs" as a primary diagnostic tool without naming which logs or what to look for. Cannot describe a failure chain. Cannot name commands for more than one layer. |

---

## Self-Debrief Template

After each practice run, write one sentence per item:

1. Which question took longest? Was that appropriate for the depth required?
2. Which answer stayed at the YAML/dashboard layer when it should have gone deeper?
3. Did you name commands or tools without prompting on at least 7 of 10 questions?
4. Where did you jump to a single root cause too early?
5. Did you use the clues in the question (partial rack, some nodes, peak load) to narrow the scope?
6. What is one mechanism you described clearly, and one you would reread before the next run?
