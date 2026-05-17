---
title: "Start Here: Canonical SRE Learning Roadmap"
sidebar_position: 99
---

# Start Here: Canonical SRE Learning Roadmap

This is the single source of truth for the study site.

Use this roadmap as the default path. The goal is not to memorize isolated interview answers. The goal is to build SRE and platform engineering fluency from first principles to production-level reasoning.

The site now uses a **memory palace** approach: every major platform layer is tied to a relatable real-world scene so you can recall concepts under interview or incident pressure.

---

## The Full Memory Path

Walk through the site like a story:

| Phase | Technical focus | Memory palace | What you learn to recall |
|---|---|---|---|
| 1 | Linux host fundamentals | Hospital | CPU, memory, disk, processes, permissions, systemd, logs |
| 1 | Networking | Hotel guest journey | DNS, routing, TCP, TLS, load balancers, firewalls |
| 2 | Kubernetes | City operations center | pods, services, nodes, scheduler, CNI, CoreDNS, policies |
| 3 | Observability and incidents | Emergency command room | SLIs, SLOs, alerts, dashboards, timelines, mitigation |
| 4 | Cloud architecture | Airport / city grid | regions, zones, routes, gateways, capacity, blast radius |
| 4 | CI/CD and GitOps | Factory assembly line | source, build, scan, approve, deploy, rollback |
| 5 | Automation | Hospital playbook desk | repeatable safe operations, scripts, idempotency |
| 6 | Staff synthesis | Operating review board | tradeoffs, failure modes, platform maturity |

Read [Study Memory Palace](memory-palace.md) before deep study. Use [How To Use Each Module](module-template.md) as the standard pattern for reading each page.

---

## How To Study Each Phase

For every phase, repeat this loop:

1. **Read for the mental model.** What system are you operating?
2. **Attach it to the memory palace.** What real-world scene helps you remember it?
3. **Trace the request or failure path.** Follow packets, processes, pods, alerts, deployments, or state changes end to end.
4. **Do one hands-on drill.** Run commands, inspect output, break something, and fix it.
5. **Explain it out loud.** Turn the topic into a senior interview answer.
6. **Write one operational note.** Capture symptoms, likely causes, commands, and remediation.

---

## Phase 1: Linux, Networking, And Host Fundamentals

Start here. These topics are the base layer for almost everything else in SRE.

Memory hooks:

- **Linux host = hospital**: doctors, beds, storage rooms, badges, incident logs.
- **Networking = hotel guest journey**: directory lookup, room number, hallway, door, guard, secure conversation.

Read in this order:

1. [Linux and network administration](foundations/10-linux-and-network-administration.md)
2. [Networking fundamentals](foundations/01-networking-fundamentals.md)
3. [Linux and Kubernetes foundations](foundations/02-linux-kubernetes-foundations.md)
4. [Linux debug playbook](foundations/05-linux-debug-playbook.md)

Exit criteria:

- You can troubleshoot CPU, memory, disk, DNS, port, and connectivity problems without guessing.
- You can explain packet flow from a process on one host to a service on another host.
- You can read common Linux command output and decide what to check next.

Practice:

- [Linux labs](hands-on-labs/linux/)
- [Linux admin labs](hands-on-labs/linux-admin/)
- [Networking labs](hands-on-labs/networking/)

---

## Phase 2: Kubernetes And Containers

Kubernetes is easier when you understand the host first.

Memory hook:

- **Kubernetes = city operations center**: buildings are nodes, apartments are pods, city directory is DNS, roads are CNI, public phone numbers are Services.

Read in this order:

1. [Kubernetes networking deep dive](foundations/06-kubernetes-networking-deep-dive.md)
2. [Cloud networking and Kubernetes networking](foundations/11-cloud-networking-and-kubernetes-networking.md)
3. [Docker and container runtime](foundations/13-docker-and-container-runtime.md)
4. [YAML and Kubernetes manifest design](foundations/25-yaml-and-kubernetes-manifest-design.md)
5. [Kubernetes GPU, AI platforms, and operators](foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)

Exit criteria:

- You can debug Pending, CrashLoopBackOff, ImagePullBackOff, DNS, service routing, ingress, and node-pressure failures.
- You can explain the difference between container image, container runtime, pod sandbox, process isolation, and workload scheduling.
- You can read a manifest and identify missing resources, probes, labels, security context, rollout strategy, and operational risks.

Practice:

- [Kubernetes labs](hands-on-labs/kubernetes/)
- [Cloud networking labs](hands-on-labs/cloud-networking/)

---

## Phase 3: Observability, SLOs, And Incident Response

Now learn how to see and control production systems.

Memory hook:

- **Observability = emergency command room**: vital signs, alarms, incident commander, patient stabilization, postmortem review.

Read in this order:

1. [Observability, SLOs, and incident response](foundations/09-observability-slos-and-incident-response.md)
2. [Prometheus, Grafana, and Alertmanager](foundations/19-prometheus-grafana-and-alertmanager.md)
3. [DevOps troubleshooting and security errors](foundations/26-devops-troubleshooting-and-security-errors.md)

Exit criteria:

- You can write useful PromQL for latency, errors, saturation, traffic, availability, and burn rate.
- You can explain a clean incident timeline.
- You can propose dashboards and alerts for a service without over-instrumenting it.

---

## Phase 4: Cloud Architecture, Infrastructure, And Delivery

This phase connects systems thinking with production delivery.

Memory hooks:

- **Cloud architecture = airport / city grid**: routes, gates, zones, backup paths, security boundaries.
- **CI/CD = factory assembly line**: source, build, test, scan, approve, ship, rollback.

Read in this order:

1. [System design and cloud architecture](foundations/07-system-design-cloud-architecture.md)
2. [AWS cloud services and platform design](foundations/14-aws-cloud-services-and-platform-design.md)
3. [Terraform infrastructure as code](foundations/15-terraform-infrastructure-as-code.md)
4. [CI/CD trusted delivery and platform security](foundations/08-cicd-trusted-delivery-and-platform-security.md)
5. [Delivery systems: Jenkins, GitHub Actions, and ArgoCD](foundations/17-delivery-systems-jenkins-github-actions-and-argocd.md)
6. [Git and version control for platform engineers](foundations/16-git-and-version-control-for-platform-engineers.md)

Exit criteria:

- You can design a platform from load balancer to compute, storage, network, observability, security, delivery, and disaster recovery.
- You can explain tradeoffs instead of listing services.
- You can identify blast radius and failure modes in an architecture.

---

## Phase 5: Automation, Data, And Platform Services

This phase teaches the supporting tools SREs use to operate platforms at scale.

Memory hook:

- **Automation = hospital playbook desk**: standard procedures, safety checks, repeatable operations, rollback notes.

Read in this order:

1. [Bash and shell scripting](foundations/03-bash-and-shell-scripting.md)
2. [Python for SRE](foundations/04-python-for-sre.md)
3. [Ansible and host automation](foundations/18-ansible-and-host-automation.md)
4. [Kafka and event streaming](foundations/20-kafka-and-event-streaming.md)
5. [SQL and relational data for SRE](foundations/21-sql-and-relational-data-for-sre.md)
6. [HTTP, APIs, and reverse proxy paths](foundations/22-http-apis-and-reverse-proxy-paths.md)
7. [Azure DevOps crossover](foundations/23-azure-devops-crossover.md)
8. [SonarQube and code quality gates](foundations/24-sonarqube-and-code-quality-gates.md)

Exit criteria:

- You can automate routine checks without making production more dangerous.
- You can debug common API, proxy, queue, SQL, and automation failures.
- You can explain the operational tradeoff behind each tool.

---

## Phase 6: Synthesis, Capstone, And Staff-Level Reasoning

Finish here after you have enough depth in the earlier phases.

Memory hook:

- **Staff synthesis = operating review board**: assumptions, tradeoffs, failure modes, cost, security, operability, rollout, and long-term ownership.

Read in this order:

1. [End-to-end project and capstone patterns](foundations/27-end-to-end-project-and-capstone-patterns.md)
2. [Senior/staff operating manual](foundations/00-senior-staff-operating-manual.md)
3. [Reference answer: GCP public platform](hands-on-labs/cloud-design/reference-answer-gcp-public-platform.md)
4. [Reference answer: GPU ML/AI platform](hands-on-labs/kubernetes/reference-answer-gpu-ml-ai-platform.md)

Exit criteria:

- You can produce an end-to-end design with assumptions, architecture, data flow, failure modes, observability, rollout, and tradeoffs.
- You can identify what junior, mid-level, senior, and staff-level answers each include.
- You can explain not only what you would build, but how you would operate it for months.

---

## Optional Track: Nebius AI Sprint

Use this only if preparing for a Nebius AI Staff SRE interview. It is intentionally specific and should not be the default learning path.

- [Nebius sprint overview](nebius/README.md)
- [Company, stack, and interview guide](nebius/00-company-stack-interview-guide.md)
- [Linux deep dive](nebius/01-linux-deep-dive.md)
- [Kubernetes and Cilium production](nebius/02-kubernetes-cilium-production.md)
- [GPU AI infrastructure](nebius/03-gpu-ai-infrastructure.md)
- [System design](nebius/04-system-design.md)
- [Coding and algorithms](nebius/05-coding-algorithms.md)
- [Stress interview and incident response](nebius/06-stress-interview-incident-response.md)

---

## Daily Study Rule

Every session should include:

- **One concept read** from a foundation guide.
- **One memory-palace recall** without notes.
- **One practical drill** from a lab or command sequence.
- **One spoken or written answer** explaining what you learned.

Read, remember, practice, explain, repeat.
