---
title: "Foundations: Kubernetes Networking Deep Dive Premium Teaching Guide"
sidebar_position: 6
---

# Foundations: Kubernetes Networking Deep Dive Premium Teaching Guide

Kubernetes networking is where Linux networking, container networking, DNS, load balancing, policy, cloud networking, and service discovery meet.

If you can explain the packet path, you can debug the packet path.

This guide teaches Kubernetes networking from first principles to production-grade troubleshooting.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — Pod IPs, Services, DNS, Ingress.
2. **Intermediate Layer** — CNI, EndpointSlices, kube-proxy, NetworkPolicy.
3. **Advanced Layer** — eBPF, conntrack, overlays, native routing, MTU, SNAT.
4. **Production SRE Layer** — DNS failures, Service failures, ingress 502s, one-node bugs.
5. **Interview Layer** — explain traffic paths without vague “CNI issue” answers.

---

# Memory Palace: Kubernetes Is A City

| Concept | City Analogy | Meaning |
|---|---|---|
| Cluster | City | Whole platform network |
| Node | Building | Worker host |
| Pod | Apartment | Workload network namespace |
| Pod IP | Apartment address | Direct workload address |
| Service | Public phone number | Stable virtual access |
| EndpointSlice | Apartment directory | Ready backend list |
| CoreDNS | City directory desk | Name resolution |
| CNI | Road crew | Pod networking implementation |
| kube-proxy/eBPF | Traffic dispatcher | Service translation |
| Ingress | City gate | External HTTP entry |
| NetworkPolicy | Access rules | Traffic authorization |
| Conntrack | Visitor logbook | Kernel flow tracking |

---

# Beginner Layer: Kubernetes Networking Requirements

Kubernetes expects:

1. every Pod has its own IP
2. Pods can reach Pods across nodes
3. nodes can reach Pods
4. containers inside a Pod share localhost
5. Services provide stable access to changing Pods

The CNI plugin makes this real.

---

# Beginner Layer: Pod Networking

A Pod usually has its own Linux network namespace.

Containers in the same Pod share:

- IP address
- port space
- localhost
- network interfaces

This means two containers in the same Pod cannot bind the same port.

Useful commands:

```bash
kubectl get pods -o wide
kubectl exec -it POD -- ip addr
kubectl exec -it POD -- ip route
```

---

# Beginner Layer: Service And EndpointSlice

Pods are temporary. Services are stable.

A Service selects ready Pods using labels.

```bash
kubectl get svc
kubectl describe svc api
kubectl get endpointslice -l kubernetes.io/service-name=api -o yaml
```

A Service with no ready endpoints cannot send useful traffic.

Common causes:

- selector mismatch
- readiness probe failing
- Pods terminating
- wrong namespace

---

# Beginner Layer: DNS And CoreDNS

CoreDNS resolves Service names.

```text
api.default.svc.cluster.local -> Service ClusterIP
```

Commands:

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system deploy/coredns
kubectl exec -it POD -- cat /etc/resolv.conf
kubectl exec -it POD -- nslookup kubernetes.default
```

Common DNS failures:

- CoreDNS down or overloaded
- NetworkPolicy blocks DNS
- upstream resolver broken
- bad search domains
- `ndots` causing query amplification

---

# Intermediate Layer: Same-Node Pod Traffic

Typical path:

```text
Pod A eth0 -> veth -> bridge/eBPF/datapath -> veth -> Pod B eth0
```

Failures may involve:

- app not listening
- veth missing
- CNI datapath broken
- policy drop
- local firewall state

---

# Intermediate Layer: Cross-Node Pod Traffic

Two major models:

| Model | Meaning | Tradeoff |
|---|---|---|
| Overlay | encapsulate Pod packets between nodes | easier setup, MTU overhead |
| Native routing | network routes Pod CIDRs directly | efficient, needs network support |

Overlay examples:

- VXLAN
- Geneve

Native/eBPF examples:

- Cilium native routing
- cloud VPC CNI models

---

# Intermediate Layer: CNI Responsibilities

CNI configures Pod networking.

Responsibilities:

- create Pod interface
- assign IP
- set routes
- configure datapath
- apply policy if supported

Popular CNIs:

- Calico
- Cilium
- Flannel
- AWS VPC CNI
- Azure CNI
- GKE Dataplane

Debug:

```bash
kubectl get pods -n kube-system
kubectl logs -n kube-system -l k8s-app=cilium
kubectl logs -n kube-system -l k8s-app=calico-node
```

---

# Intermediate Layer: Service Datapath

A ClusterIP is usually virtual.

Traffic to ClusterIP is translated to a backend Pod.

Implementations:

| Implementation | How it works |
|---|---|
| iptables | NAT rules created by kube-proxy |
| IPVS | kernel load balancing tables |
| eBPF | programmable kernel datapath |

Useful checks:

```bash
iptables-save | grep KUBE-SVC
iptables-save | grep KUBE-SEP
```

For Cilium:

```bash
cilium service list
cilium endpoint list
hubble observe --follow
```

---

# Intermediate Layer: Ingress Path

Common external path:

```text
Internet -> Cloud Load Balancer -> Ingress Controller -> Service -> EndpointSlice -> Pod
```

Debug:

```bash
kubectl get ingress -A
kubectl describe ingress NAME
kubectl logs -n ingress-nginx deploy/ingress-nginx-controller
kubectl get svc
kubectl get endpointslice
```

Common failures:

- DNS points to wrong load balancer
- certificate or SNI mismatch
- host/path rule mismatch
- Service port wrong
- no ready endpoints
- NetworkPolicy blocks ingress controller

---

# Advanced Layer: NetworkPolicy

NetworkPolicy controls Pod traffic.

Default is often allow-all until policies select Pods.

Once a Pod is selected by ingress or egress policy, traffic in that direction must be explicitly allowed.

Common mistake:

> Egress default-deny without allowing DNS.

Remember DNS uses TCP and UDP 53.

---

# Advanced Layer: ndots Trap

Pods often use `ndots:5`.

Short external names may trigger multiple cluster-domain lookups before external resolution.

Symptoms:

- external calls slow
- high CoreDNS QPS
- DNS latency in p95/p99

Mitigations:

- use fully qualified names where appropriate
- tune `dnsConfig` carefully
- cache intentionally

---

# Advanced Layer: Conntrack

Linux conntrack tracks flows for NAT and firewall state.

If exhausted, new connections may fail while old ones continue.

Debug:

```bash
conntrack -S
sysctl net.netfilter.nf_conntrack_max
ss -s
```

Symptoms:

- intermittent new connection failures
- DNS timeouts
- Service access flaky under load

---

# Advanced Layer: MTU And Overlay Networking

Overlay networks add encapsulation overhead.

If MTU is wrong:

- small packets work
- large packets hang
- TLS appears flaky
- uploads fail mysteriously

Debug:

```bash
ping -M do -s 1472 TARGET
tracepath TARGET
```

---

# Advanced Layer: Pod To External Traffic

Pod egress may involve:

```text
Pod -> node datapath -> SNAT/NAT gateway -> firewall/security group -> external service
```

Common failures:

- egress NetworkPolicy
- cloud firewall/security group
- NAT port exhaustion
- DNS/upstream resolver
- external allowlist expects node or NAT IP

---

# Advanced Layer: Service Mesh Layer

Service mesh can affect:

- mTLS
- retries
- timeouts
- circuit breaking
- routing
- telemetry

Debug question:

> Is this Kubernetes networking, app networking, or mesh policy?

---

# Production SRE Layer: Troubleshooting By Symptom

## Pod Cannot Resolve DNS

```bash
kubectl exec POD -- cat /etc/resolv.conf
kubectl exec POD -- nslookup kubernetes.default
kubectl logs -n kube-system deploy/coredns
kubectl get networkpolicy -A
```

Likely causes:

- CoreDNS unavailable
- egress policy blocks DNS
- upstream resolver issue
- node-local DNS problem

## Pod Cannot Reach Service

```bash
kubectl get svc SERVICE
kubectl get endpointslice -l kubernetes.io/service-name=SERVICE
kubectl exec POD -- curl -v http://SERVICE:PORT
kubectl exec POD -- curl -v http://POD_IP:PORT
```

Interpretation:

- PodIP works but Service fails: Service/datapath problem
- both fail: backend app, policy, route, or listener problem

## Ingress Returns 502

Check:

```bash
kubectl describe ingress NAME
kubectl get svc SERVICE
kubectl get endpointslice -l kubernetes.io/service-name=SERVICE
kubectl logs -n INGRESS_NS deploy/CONTROLLER
```

Likely causes:

- no ready endpoints
- wrong targetPort
- app not listening
- health/readiness mismatch
- policy blocked ingress controller

## Only One Node Has Failures

Check:

```bash
kubectl get pods -o wide
kubectl describe node NODE
ip route
conntrack -S
journalctl -u kubelet -n 100
```

Likely causes:

- CNI agent broken
- conntrack issue
- node route issue
- kernel/network state drift

---

# Production SRE Layer: Packet-Path Debugging Method

1. Classify traffic type.
   - Pod to Pod
   - Pod to Service
   - external to Ingress
   - Pod to external
2. Test DNS separately.
3. Test backend Pod IP directly.
4. Test Service name and ClusterIP.
5. Inspect EndpointSlice.
6. Inspect policy.
7. Inspect node datapath.
8. Inspect cloud path if traffic leaves cluster.

Never say “CNI issue” until you prove where the path breaks.

---

# Real Incident Stories

## Service Has No Endpoints

Likely causes:

- label selector mismatch
- readiness failing
- wrong namespace

## DNS Fails Only In One Namespace

Likely cause:

- namespace NetworkPolicy blocks egress to CoreDNS

## New Connections Fail During Spike

Likely causes:

- conntrack exhaustion
- NAT exhaustion
- backend backlog saturation

## Ingress 502 After Deploy

Likely causes:

- readiness too shallow
- wrong targetPort
- app not listening
- backend policy blocked

---

# Command Interpretation Table

| Command | What it answers | Bad signs |
|---|---|---|
| `kubectl get pods -o wide` | Pod placement/IPs | failures scoped to one node |
| `kubectl get svc` | service definition | wrong ports/type |
| `kubectl get endpointslice` | ready backends | empty endpoints |
| `nslookup` from Pod | DNS path | timeout/SERVFAIL |
| `curl Service` vs `curl PodIP` | service vs backend path | Service fails, PodIP works |
| `hubble observe` | Cilium flow/drop visibility | policy/drop reasons |
| `conntrack -S` | kernel flow tracking | drops/insert_failed |
| `tcpdump` | packet truth | SYN no reply, resets |

---

# Labs

## Beginner

1. Create two Pods and curl Pod IP.
2. Create ClusterIP Service.
3. Resolve Service DNS.

## Intermediate

1. Break Service selector.
2. Break readiness probe.
3. Apply NetworkPolicy default deny.
4. Expose through Ingress.

## Advanced

1. Compare PodIP vs Service routing.
2. Inspect iptables or eBPF path.
3. Simulate DNS block.
4. Test MTU behavior.
5. Observe Cilium/Hubble drops.

---

# Interview Layer: Strong Answers

## What happens when a Pod curls a ClusterIP Service?

> DNS may resolve the Service name to ClusterIP. The node datapath then translates the virtual Service IP to one ready backend Pod from EndpointSlice, using iptables, IPVS, or eBPF depending on implementation.

## Why can Service exist but have no endpoints?

> The selector may not match Pods, Pods may not be Ready, or the Service may point at the wrong namespace/labels.

## Why can only new connections fail?

> Existing conntrack entries may continue while new entries fail due to conntrack/NAT/backlog exhaustion.

## How debug ingress 502?

> Trace DNS, load balancer, ingress rule, Service, EndpointSlice, readiness, targetPort, and backend app logs.

---

# Memory Review

- What does CoreDNS return for a ClusterIP Service?
- Why can a Running Pod be absent from EndpointSlice?
- What is overlay vs native routing?
- What does conntrack exhaustion look like?
- Why does MTU matter in overlay networking?

---

# Senior Summary

> I debug Kubernetes networking by classifying the traffic path first, then testing DNS, endpoint selection, Service translation, policy enforcement, node datapath, and cloud egress separately. I avoid vague CNI guesses and use packet-path evidence to isolate the failing layer.
