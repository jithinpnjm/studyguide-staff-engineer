---
title: "Networking Labs"
sidebar_position: 0
---

# Networking Labs

These labs teach traffic flow reasoning, protocol-level troubleshooting, and the diagnostic sequence that senior SRE engineers use when a network path is broken or degraded.

## Why This Track Matters Operationally

Network problems are the most common source of ambiguous symptoms in production. A service that appears slow might be a DNS lookup delay, a TCP handshake problem, a TLS negotiation overhead, or a routing issue — they look similar at the application layer but require completely different fixes. An SRE who can separate these layers quickly is invaluable during incidents. These labs build that diagnostic discipline.

## Prerequisites

- Understand the TCP/IP model: application, transport, network, link layers
- Know what DNS resolution looks like step by step (recursive resolver, authoritative server)
- Understand what a TLS handshake does and what certificates are being exchanged
- Comfortable with `curl`, `dig`, `ping`, `traceroute`, `ss`, `ip`

Foundation reading: [../../foundations/01-networking-fundamentals.md](../../foundations/01-networking-fundamentals.md)

## Labs

1. [lab-01-http-dns-flow.md](lab-01-http-dns-flow.md) — Trace a complete HTTP request from DNS lookup through TCP connection through TLS handshake through HTTP response. Measure each phase separately. Focus: `curl -v`, `dig`, `openssl s_client`, timing headers.
2. [lab-02-ssh-latency.md](lab-02-ssh-latency.md) — Diagnose an SSH connection that is slow or intermittent. Separate DNS latency, TCP connect time, and SSH negotiation. Focus: `ssh -vvv`, `ping`, `traceroute`, MTU behavior.
3. [lab-03-routing-firewall-and-capture.md](lab-03-routing-firewall-and-capture.md) — A path between two hosts is broken. Identify whether it is a routing issue, a firewall rule, or a service-level problem. Focus: `ip route`, `iptables`, `tcpdump`, packet interpretation.

## Learning Progression

**Beginner:** you describe the request path at a high level and can run the basic commands. You identify "DNS is slow" or "TCP connect is failing" from obvious output.

**Intermediate:** you separate DNS, TCP, and TLS timing before troubleshooting. You use `tcpdump` to verify your theory rather than just running it. You distinguish a firewall drop (RST versus no response) from a routing miss. You explain what you are proving with each command.

**Advanced:** you can reconstruct a complete request timeline from packet capture alone. You diagnose MTU-related fragmentation causing SSH hangs. You explain what a SYN with no SYN-ACK means versus a RST response. You identify split-horizon DNS causing cloud-to-cloud reachability failures.

## How To Use These Labs

1. Write the full expected request path before running any commands.
2. Form a theory about where the failure is before collecting evidence.
3. Use the minimum number of commands to confirm or disprove your theory.
4. Explain what each packet capture or `dig` output is proving — not just that you ran the tool.
5. After the lab, verify that you could explain the full path to a non-technical audience in one minute.

## Tools You Need

- macOS or Linux with standard network tools: `curl`, `dig`, `ping`, `traceroute`, `ss`, `ip`, `netcat`
- `tcpdump` (requires root or `sudo`)
- `openssl` for TLS inspection
- A pair of VMs for routing and firewall labs (GCP or AWS free-tier VMs work well)
- GCP Connectivity Tests for cloud path reasoning: https://cloud.google.com/network-intelligence-center/docs/connectivity-tests/concepts/overview

Helpful references:
- VPC overview (GCP): https://cloud.google.com/vpc/docs/overview
- AWS VPC security: https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Security.html

## Success Criteria

After completing all three labs you should be able to:

- measure and report DNS, TCP connect, TLS, and TTFB timing for any HTTP endpoint using only `curl`
- explain to an interviewer why an SSH connection hangs on large file transfers but works for small commands (MTU / PMTUD)
- distinguish a firewall drop from a routing miss using `tcpdump` evidence
- describe the complete packet-level sequence of a TLS 1.3 handshake
- explain why a service can be reachable on one VPC but not another when both have routes to the same subnet
