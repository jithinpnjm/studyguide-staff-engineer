---
title: "SRE and Platform Engineering Study Hub"
sidebar_position: 0
---

# SRE and Platform Engineering Study Hub

A comprehensive study library for Senior SRE, Platform Engineer, and DevOps roles. Covers Linux to Kubernetes, networking to GPU infrastructure, observability to system design — beginner to expert in every topic.

## How to Use

The portal is the best entry point:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/prep-portal
npm start
```

Then browse by topic from the home page or sidebar.

## Structure

```
foundations/       — comprehensive topic guides (beginner to expert in each doc)
nebius/            — 10-day sprint for Nebius AI Staff SRE interview
hands-on-labs/     — runnable exercises for each topic area
mock-interviews/   — practice scenarios and system design questions
```

## Foundations — Reading Order

The foundations docs each cover a topic from first principles to production depth. Start with whichever topics you need to strengthen.

**Systems and Linux:**
- [Linux and Network Administration](foundations/10-linux-and-network-administration.md)
- [Linux to Kubernetes Foundations](foundations/02-linux-kubernetes-foundations.md)
- [Linux Debug Playbook](foundations/05-linux-debug-playbook.md)
- [Bash and Shell Scripting](foundations/03-bash-and-shell-scripting.md)
- [Python for SRE](foundations/04-python-for-sre.md)

**Networking:**
- [Networking Fundamentals](foundations/01-networking-fundamentals.md)
- [Cloud Networking and Kubernetes Networking](foundations/11-cloud-networking-and-kubernetes-networking.md)
- [HTTP, APIs, and Reverse Proxy Paths](foundations/22-http-apis-and-reverse-proxy-paths.md)

**Kubernetes:**
- [Kubernetes Networking Deep Dive](foundations/06-kubernetes-networking-deep-dive.md)
- [Kubernetes GPU and AI Platforms](foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)
- [Docker and Container Runtime](foundations/13-docker-and-container-runtime.md)
- [YAML and Kubernetes Manifest Design](foundations/25-yaml-and-kubernetes-manifest-design.md)

**Observability:**
- [Observability, SLOs, and Incident Response](foundations/09-observability-slos-and-incident-response.md)
- [Prometheus, Grafana, and Alertmanager](foundations/19-prometheus-grafana-and-alertmanager.md)
- [Troubleshooting and Security Errors](foundations/26-devops-troubleshooting-and-security-errors.md)

**Cloud and Infrastructure:**
- [System Design and Cloud Architecture](foundations/07-system-design-cloud-architecture.md)
- [AWS Cloud Services and Platform Design](foundations/14-aws-cloud-services-and-platform-design.md)
- [Terraform and Infrastructure as Code](foundations/15-terraform-infrastructure-as-code.md)
- [Azure DevOps Crossover](foundations/23-azure-devops-crossover.md)

**CI/CD:**
- [CI/CD, Trusted Delivery, and Platform Security](foundations/08-cicd-trusted-delivery-and-platform-security.md)
- [Delivery Systems: Jenkins, GitHub Actions, ArgoCD](foundations/17-delivery-systems-jenkins-github-actions-and-argocd.md)
- [Git and Version Control](foundations/16-git-and-version-control-for-platform-engineers.md)
- [SonarQube and Code Quality Gates](foundations/24-sonarqube-and-code-quality-gates.md)

**Platforms and Services:**
- [Kafka and Event Streaming](foundations/20-kafka-and-event-streaming.md)
- [Ansible and Host Automation](foundations/18-ansible-and-host-automation.md)
- [SQL for SRE](foundations/21-sql-and-relational-data-for-sre.md)

## Nebius 10-Day Sprint

For a focused sprint before a specific interview, use the Nebius section:
- [Nebius Sprint Overview](nebius/README.md)
- Day 1–2: Company overview + Linux internals
- Day 3–5: Kubernetes + Cilium + GPU scheduling
- Day 6: GPU/AI infrastructure
- Day 7: System design
- Day 8: Coding and algorithms
- Day 9: Stress interview simulation
- Day 10: Full mock + review

## Senior-Level Answer Standards

For any question, aim to cover:

- Requirements and constraints
- Failure domains
- Observability and diagnostics
- Rollback and safe rollout
- Security and least privilege
- Capacity and cost tradeoffs
- How you would test and verify in production
