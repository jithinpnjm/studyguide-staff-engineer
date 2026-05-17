---
title: "4-Week Study Roadmap"
sidebar_position: 4
---

# 4-Week Study Roadmap

This roadmap assumes 60 to 90 minutes per day. If you have more time, add practice scenario repetitions rather than trying to read everything at once.

---

## Week 1: Linux, Networking, and Kubernetes Fundamentals

Goal: become confident with host triage, packet flow, and Kubernetes core behavior.

### Day 1 — Linux and networking base

- Read [foundations/10-linux-and-network-administration.md](foundations/10-linux-and-network-administration.md)
- Read [foundations/01-networking-fundamentals.md](foundations/01-networking-fundamentals.md)
- Practice: describe TCP handshake, what TIME_WAIT means operationally, and how NAT changes packet flow

### Day 2 — Linux debugging

- Read [foundations/05-linux-debug-playbook.md](foundations/05-linux-debug-playbook.md)
- Work through [hands-on-labs/linux/lab-01-host-triage.md](hands-on-labs/linux/lab-01-host-triage.md)
- Practice: walk a slow service scenario from uptime to strace without notes

### Day 3 — Linux to Kubernetes

- Read [foundations/02-linux-kubernetes-foundations.md](foundations/02-linux-kubernetes-foundations.md)
- Work through [hands-on-labs/linux/lab-03-processes-cgroups-namespaces.md](hands-on-labs/linux/lab-03-processes-cgroups-namespaces.md)
- Practice: explain how Linux namespaces and cgroups map to a running pod

### Day 4 — Kubernetes networking

- Read [foundations/06-kubernetes-networking-deep-dive.md](foundations/06-kubernetes-networking-deep-dive.md)
- Read [foundations/11-cloud-networking-and-kubernetes-networking.md](foundations/11-cloud-networking-and-kubernetes-networking.md)
- Work through [hands-on-labs/cloud-networking/drill-04-kubernetes-cloud-networking-path.md](hands-on-labs/cloud-networking/drill-04-kubernetes-cloud-networking-path.md)
- Practice: trace a packet from an external client to a pod, naming each hop

### Day 5 — Containers and manifest design

- Read [foundations/13-docker-and-container-runtime.md](foundations/13-docker-and-container-runtime.md)
- Read [foundations/25-yaml-and-kubernetes-manifest-design.md](foundations/25-yaml-and-kubernetes-manifest-design.md)
- Work through [hands-on-labs/kubernetes/lab-01-pod-service-debug.md](hands-on-labs/kubernetes/lab-01-pod-service-debug.md)
- Practice: write a production-quality Deployment manifest with probes, resource limits, and PDB from memory

### Day 6 — Networking labs

- Work through [hands-on-labs/networking/lab-01-http-dns-flow.md](hands-on-labs/networking/lab-01-http-dns-flow.md)
- Work through [hands-on-labs/linux-admin/drill-03-process-socket-and-network-admin.md](hands-on-labs/linux-admin/drill-03-process-socket-and-network-admin.md)
- Practice: diagnose a "service not reachable" scenario by checking DNS, endpoints, and NetworkPolicy

### Day 7 — Practice scenario 1

- Run [mock-interviews/01-nebius-linux-kubernetes-troubleshooting.md](mock-interviews/01-nebius-linux-kubernetes-troubleshooting.md)
- Keep it to 45 minutes; answer without notes first
- Write down the exact gaps — those are Week 2 targets

---

## Week 2: Observability, Incident Response, and Debugging Depth

Goal: become strong at production debugging, SLO design, and alert triage.

### Day 8 — Observability and SLOs

- Read [foundations/09-observability-slos-and-incident-response.md](foundations/09-observability-slos-and-incident-response.md)
- Practice: design an SLO for a customer-facing API — define the SLI, threshold, error budget, and burn rate alerts

### Day 9 — Prometheus and Grafana

- Read [foundations/19-prometheus-grafana-and-alertmanager.md](foundations/19-prometheus-grafana-and-alertmanager.md)
- Practice: write PromQL for error rate, p99 latency, and a burn rate alert rule without reference

### Day 10 — Kubernetes rollouts and scheduling

- Work through [hands-on-labs/kubernetes/lab-02-rollout-and-probes.md](hands-on-labs/kubernetes/lab-02-rollout-and-probes.md)
- Work through [hands-on-labs/kubernetes/lab-03-node-pressure-and-scheduling.md](hands-on-labs/kubernetes/lab-03-node-pressure-and-scheduling.md)
- Practice: explain how kubelet handles OOMKilled, evictions, and probe failures during a bad rollout

### Day 11 — Structured troubleshooting

- Read [foundations/26-devops-troubleshooting-and-security-errors.md](foundations/26-devops-troubleshooting-and-security-errors.md)
- Work through [hands-on-labs/linux-admin/drill-01-service-and-systemd-triage.md](hands-on-labs/linux-admin/drill-01-service-and-systemd-triage.md)
- Practice: run the orient → hypothesis → test → interpret framework against a CrashLoopBackOff scenario

### Day 12 — CI/CD and delivery

- Read [foundations/08-cicd-trusted-delivery-and-platform-security.md](foundations/08-cicd-trusted-delivery-and-platform-security.md)
- Read [foundations/17-delivery-systems-jenkins-github-actions-and-argocd.md](foundations/17-delivery-systems-jenkins-github-actions-and-argocd.md)
- Practice: describe a secure path from code commit to production, including image signing and policy gates

### Day 13 — Linux admin depth

- Work through [hands-on-labs/linux-admin/drill-02-filesystem-and-storage-admin.md](hands-on-labs/linux-admin/drill-02-filesystem-and-storage-admin.md)
- Work through [hands-on-labs/linux/lab-02-filesystem-and-io.md](hands-on-labs/linux/lab-02-filesystem-and-io.md)
- Practice: diagnose a disk-full scenario including deleted-but-open file handles and inode exhaustion

### Day 14 — Practice scenario 2

- Run [mock-interviews/02-distributed-systems-and-resilience.md](mock-interviews/02-distributed-systems-and-resilience.md)
- Keep answers structured: hypothesis, evidence, action, outcome
- Score yourself on clarity, tradeoff reasoning, and failure mode coverage

---

## Week 3: Cloud, Infrastructure, and System Design

Goal: design production-grade systems and reason through cross-layer tradeoffs.

### Day 15 — System design and cloud architecture

- Read [foundations/07-system-design-cloud-architecture.md](foundations/07-system-design-cloud-architecture.md)
- Read [foundations/14-aws-cloud-services-and-platform-design.md](foundations/14-aws-cloud-services-and-platform-design.md)
- Practice: sketch a multi-AZ web application with VPC design, EKS, RDS Multi-AZ, and Route 53

### Day 16 — Terraform and IaC

- Read [foundations/15-terraform-infrastructure-as-code.md](foundations/15-terraform-infrastructure-as-code.md)
- Practice: describe how you structure Terraform state across infrastructure layers and why

### Day 17 — Cloud design labs

- Work through [hands-on-labs/cloud-design/lab-01-gcp-public-platform.md](hands-on-labs/cloud-design/lab-01-gcp-public-platform.md)
- Read [hands-on-labs/cloud-design/reference-answer-gcp-public-platform.md](hands-on-labs/cloud-design/reference-answer-gcp-public-platform.md)
- Compare your answer to the reference; identify gaps in failure domain reasoning

### Day 18 — GPU and AI platform

- Read [foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)
- Work through [hands-on-labs/kubernetes/lab-04-gpu-ml-ai-platform-review.md](hands-on-labs/kubernetes/lab-04-gpu-ml-ai-platform-review.md)
- Read [hands-on-labs/kubernetes/reference-answer-gpu-ml-ai-platform.md](hands-on-labs/kubernetes/reference-answer-gpu-ml-ai-platform.md)

### Day 19 — Platform services

- Read [foundations/20-kafka-and-event-streaming.md](foundations/20-kafka-and-event-streaming.md)
- Read [foundations/22-http-apis-and-reverse-proxy-paths.md](foundations/22-http-apis-and-reverse-proxy-paths.md)
- Practice: explain how consumer lag develops and how you diagnose it; describe NGINX upstream config and rate limiting

### Day 20 — End-to-end composition

- Read [foundations/27-end-to-end-project-and-capstone-patterns.md](foundations/27-end-to-end-project-and-capstone-patterns.md)
- Practice: trace a deployment failure from CI log to pod event to log line, naming each tool at each step

### Day 21 — Practice scenario 3

- Run [mock-interviews/03-platform-cloud-and-security.md](mock-interviews/03-platform-cloud-and-security.md)
- Follow up with a written architecture summary in under one page
- Record what you were confident about and what you hedged on

---

## Week 4: Depth, Gaps, and Targeted Repair

Goal: convert knowledge into confident, precise execution — including areas you've been avoiding.

### Day 22 — Remaining foundations

Pick two you haven't read:
- [foundations/18-ansible-and-host-automation.md](foundations/18-ansible-and-host-automation.md)
- [foundations/21-sql-and-relational-data-for-sre.md](foundations/21-sql-and-relational-data-for-sre.md)
- [foundations/16-git-and-version-control-for-platform-engineers.md](foundations/16-git-and-version-control-for-platform-engineers.md)
- [foundations/23-azure-devops-crossover.md](foundations/23-azure-devops-crossover.md)
- [foundations/24-sonarqube-and-code-quality-gates.md](foundations/24-sonarqube-and-code-quality-gates.md)

### Day 23 — Redo weak scenarios

- Revisit the mock interview where you struggled most
- Answer the hardest questions again — without notes, in senior-level language
- Add tradeoffs and failure modes to every answer

### Day 24 — Scripting depth

- Read [foundations/03-bash-and-shell-scripting.md](foundations/03-bash-and-shell-scripting.md) or [foundations/04-python-for-sre.md](foundations/04-python-for-sre.md)
- Work through [hands-on-labs/bash/lab-03-retry-and-guardrails.md](hands-on-labs/bash/lab-03-retry-and-guardrails.md)
- Work through [hands-on-labs/python/lab-03-k8s-event-summary.md](hands-on-labs/python/lab-03-k8s-event-summary.md)

### Day 25 — Mixed mock

- Run one 60-minute mixed scenario drawing from all three mock interview files
- Practice staying structured under pressure: state the hypothesis, name the command, interpret the output

### Day 26 — Cheat sheets

Build short recall sheets for:
- Linux debugging flow (60-second system check)
- Kubernetes pod-to-packet path
- SLO and burn rate alert design
- Deployment rollout and rollback procedure
- Terraform state layer strategy

### Day 27 — Final system design drill

- Work through [hands-on-labs/cloud-design/lab-04-low-latency-multi-region-control-plane.md](hands-on-labs/cloud-design/lab-04-low-latency-multi-region-control-plane.md)
- Focus on failure domains, latency tradeoffs, and multi-region consistency

### Day 28 — Review and calibrate

- Read [foundations/00-senior-staff-operating-manual.md](foundations/00-senior-staff-operating-manual.md)
- Run one final mock scenario
- Prioritize calm execution over last-minute breadth
