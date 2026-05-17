---
title: "Hands-On Labs"
sidebar_position: 0
---

# Hands-On Labs

This area converts the interview prep foundation guides into practice. Reading about systems is not the same as reasoning through them under pressure. These labs are structured so you can work through them alone or use them as a simulation with a reviewer.

## What These Labs Cover

The labs span the core domains a senior SRE or platform engineer interview will test:

- Linux host behavior, process inspection, filesystem and memory troubleshooting
- Network traffic paths, DNS, TLS timing, routing, and packet capture
- Kubernetes object behavior, scheduling, service networking, and GPU platform design
- Bash scripting for automation, health checks, and guardrails
- Python scripting for probes, log analysis, and Kubernetes event processing
- Cloud architecture design for GCP and AWS platforms
- Cloud VPC and networking design decisions

Most labs are paper-plus-command exercises. The cloud design and Kubernetes architecture labs are written design reviews — you produce a written answer and have it reviewed.

## Lab Tracks

| Track | Focus | Labs |
|---|---|---|
| [linux/](linux/README.md) | Host triage, filesystem, processes, cgroups | 3 labs |
| [linux-admin/](linux-admin/README.md) | systemd, storage admin, command mastery drills | 4 drills |
| [networking/](networking/README.md) | DNS, HTTP, SSH, routing, packet capture | 3 labs |
| [bash/](bash/README.md) | Health check scripts, log parsing, retry logic | 3 labs |
| [python/](python/README.md) | HTTP probes, JSON log analysis, K8s event processing | 3 labs |
| [kubernetes/](kubernetes/README.md) | Pod/service debug, rollouts, scheduling, GPU/AI design | 5 labs |
| [cloud-design/](cloud-design/README.md) | GCP and AWS architecture reviews | 4 labs |
| [cloud-networking/](cloud-networking/README.md) | VPC design, load balancing, routing drills | 4 drills |

## Prerequisites

Before starting any lab, you need a working local environment. Minimum setup:

- macOS or Linux shell
- Python 3 with `pip` or `uv`
- Docker: https://docs.docker.com/get-docker/
- `kubectl`: https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/
- A local Kubernetes cluster (`kind` or `minikube`):
  - kind: https://kind.sigs.k8s.io/docs/user/quick-start/
  - minikube: https://minikube.sigs.k8s.io/docs/commands/start/

For cloud design labs you do not need a running cloud account, but access to a free-tier GCP or AWS account helps you verify networking behavior.

## Suggested Progression

**Week 1 — fundamentals**
1. Linux Lab 1: host triage
2. Networking Lab 1: HTTP and DNS flow
3. Bash Lab 1: health check script
4. Linux Lab 2: filesystem and I/O

**Week 2 — depth**
5. Networking Lab 2: SSH latency
6. Python Lab 1: HTTP probe
7. Kubernetes Lab 1: pod and service debug
8. Linux Lab 3: processes, cgroups, namespaces

**Week 3 — platform reasoning**
9. Kubernetes Lab 2: rollouts and probes
10. Kubernetes Lab 3: node pressure and scheduling
11. Python Lab 2 and 3: log analysis, K8s events
12. Linux Admin drills 1-4

**Week 4 — architecture**
13. Cloud Design Lab 1: GCP public platform
14. Cloud Design Lab 2: private internal platform
15. Kubernetes Lab 4: GPU and AI platform design
16. Kubernetes Lab 5: operators, mesh, and DR
17. Cloud Networking drills 1-4

## How To Work A Lab

1. Read the scenario. Do not start writing commands or design immediately.
2. Write down what you expect to happen before you do anything.
3. Run the minimum to confirm or disprove your theory.
4. Note what surprised you and why.
5. Check your answer against the rubric or reference answer if one exists.

For design review labs, write your answer as a structured document, not a bullet list. An interviewer wants reasoning, not enumeration.

## If A Lab Feels Hard

Use the matching foundation guide first. The labs are calibrated to be genuinely difficult at the intermediate and advanced levels — that is intentional.

- Networking: [../foundations/01-networking-fundamentals.md](../foundations/01-networking-fundamentals.md)
- Linux and Kubernetes: [../foundations/02-linux-kubernetes-foundations.md](../foundations/02-linux-kubernetes-foundations.md)
- Bash: [../foundations/03-bash-and-shell-scripting.md](../foundations/03-bash-and-shell-scripting.md)
- Python: [../foundations/04-python-for-sre.md](../foundations/04-python-for-sre.md)
- GPU and operators: [../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)
- Observability: [../foundations/09-observability-slos-and-incident-response.md](../foundations/09-observability-slos-and-incident-response.md)
- Cloud architecture: [../foundations/07-system-design-cloud-architecture.md](../foundations/07-system-design-cloud-architecture.md)
