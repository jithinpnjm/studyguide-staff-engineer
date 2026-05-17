---
title: "Linux Labs"
sidebar_position: 0
---

# Linux Labs

These labs focus on host-level reasoning: what is the system waiting on, where is the bottleneck, and how do Linux primitives connect to the container and Kubernetes behavior you see in production.

## Why This Track Matters Operationally

Senior SRE interviews test Linux depth because it is the substrate under everything else. A Kubernetes node is a Linux host. A container is a process in a namespace with a cgroup. If you cannot read `/proc`, interpret `top`, trace a file descriptor leak, or explain what a memory pressure signal means, you will struggle to triage real incidents. These labs simulate the diagnostic reasoning an on-call engineer needs.

## Prerequisites

- Comfortable with `ps`, `top`, `df`, `du`, `lsof`, `ss`, `netstat`, `dmesg`, `journalctl`
- Basic understanding of Linux process model: fork, exec, signals, exit codes
- Know what a file descriptor is and what happens when you run out of them
- Basic understanding of virtual memory: resident set, swap, OOM killer

Foundation reading: [../../foundations/02-linux-kubernetes-foundations.md](../../foundations/02-linux-kubernetes-foundations.md), [../../foundations/10-linux-and-network-administration.md](../../foundations/10-linux-and-network-administration.md)

## Labs

1. [lab-01-host-triage.md](lab-01-host-triage.md) — A host is under pressure. Triage it: identify what is consuming CPU, memory, and I/O. Explain what the system is waiting on and why. Focus: `top`, `vmstat`, `iostat`, `/proc/`, `dmesg`.
2. [lab-02-filesystem-and-io.md](lab-02-filesystem-and-io.md) — A filesystem is filling up. A write is slower than expected. Diagnose the root cause. Focus: `df`, `du`, `lsof`, `iostat`, `blktrace` concepts, deleted-but-held-open files.
3. [lab-03-processes-cgroups-namespaces.md](lab-03-processes-cgroups-namespaces.md) — Explore how Linux primitives underpin containers. Inspect cgroup limits, enter a network namespace, and trace how a container process hierarchy maps to the host. Focus: `/sys/fs/cgroup/`, `nsenter`, `unshare`, `ip netns`.

## Learning Progression

**Beginner:** you can read command output and identify the obvious symptom — "CPU is at 100%", "disk is full." You describe what you see.

**Intermediate:** you explain what the system is waiting on, not just what the metric shows. You connect CPU steal to noisy neighbor effects. You connect memory pressure to swap usage and OOM kill events. You trace a disk full event to a deleted but held-open file.

**Advanced:** you connect Linux primitives to container behavior without prompting. You explain how cgroup v2 memory limits interact with the OOM killer. You explain what PSI (pressure stall information) tells you that RSS does not. You can enter a container's namespace from the host and inspect its network state.

## How To Use These Labs

1. Read the scenario and write what you expect to find before running any commands.
2. Work through the host using the standard triage sequence: CPU, memory, disk, I/O, network.
3. Form a hypothesis early and test it with the minimum commands needed.
4. Explain your reasoning out loud as you go — this is what an interviewer is evaluating.
5. After the lab, revisit any command whose output surprised you and understand why.

## Tools You Need

- Any Linux VM (cloud VM on GCP or AWS free tier works well)
- A Linux container with sufficient tooling: `procps`, `sysstat`, `iproute2`, `lsof`, `strace`
- On macOS: most commands work but `/proc` is not available — use a VM for cgroup and namespace labs
- Install `sysstat` for `iostat` and `sar`: `apt-get install sysstat` or `yum install sysstat`

Helpful references:
- Linux namespaces: https://man7.org/linux/man-pages/man7/network_namespaces.7.html
- cgroup v2: https://docs.kernel.org/admin-guide/cgroup-v2.html
- PSI: https://docs.kernel.org/accounting/psi.html

## Success Criteria

After completing all three labs you should be able to:

- triage a degraded Linux host using a repeatable sequence in under 10 minutes
- identify a deleted-but-held-open file as the cause of a full filesystem and explain how to fix it without restarting the process
- explain what cgroup memory limits do to the Linux OOM killer behavior
- enter a running container's network namespace from the host and inspect its connections
- explain in an interview how you would diagnose a Kubernetes node that shows NotReady due to memory pressure
