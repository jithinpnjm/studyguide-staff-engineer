---
title: "Beginner"
sidebar_position: 1
---

# General DevOps — Beginner

DevOps is the practice of combining software development and IT operations to shorten the delivery cycle, increase deployment frequency, and produce more reliable software. The word "DevOps" was coined around 2009, catalysed by the landmark "10 Deploys A Day" talk at the Velocity Conference. It emerged from the convergence of Agile, Lean Startup, continuous integration, and infrastructure-as-code movements.

---

## Why DevOps Exists

Before DevOps, development teams wrote software and threw it over the wall to operations teams who deployed and maintained it. This handoff model created:

- Long release cycles (weeks to months between deployments)
- Blame culture when production failures occurred
- "Works on my machine" — environmental inconsistency
- Slow feedback loops between customer and developer
- High change failure rates due to large, infrequent batches

DevOps removes the wall. Development, QA, and operations work together on the same value stream with shared goals, shared tooling, and shared accountability.

---

## DevOps Culture and Principles

### The CAMS Framework

The four pillars of DevOps philosophy:

| Pillar | Meaning |
|--------|---------|
| **Culture** | People and process before tools. Fix the culture first. |
| **Automation** | Automate everything repeatable: testing, building, deploying, provisioning. |
| **Measurement** | You cannot improve what you cannot measure. Track deployment frequency, MTTR, change failure rate. |
| **Sharing** | Blameless postmortems, open documentation, shared tooling across teams. |

### The Three Ways (from The Phoenix Project)

1. **Systems Thinking** — Optimise for the whole value stream from development to customer, not for individual teams or components. A fast developer pushing to a slow deployment pipeline is not improvement.

2. **Amplify Feedback Loops** — Build feedback mechanisms (automated tests, monitoring, customer analytics) to learn quickly. Shorten the loop between action and consequence.

3. **Culture of Continual Experimentation and Learning** — Make it psychologically safe to experiment, fail small, and learn fast. Blameless postmortems are the operational expression of this principle.

---

## Software Development Life Cycle (SDLC)

The SDLC is the structured sequence of phases for planning, creating, testing, and delivering software:

```
Plan -> Design -> Develop -> Test -> Deploy -> Monitor -> (back to Plan)
```

DevOps compresses this cycle. Instead of six-month waterfall releases, elite teams run this loop daily or even multiple times per day. Each phase is automated as much as possible:

- **Plan**: Jira, Linear, GitHub Issues
- **Design**: ADRs, RFCs, draw.io
- **Develop**: VS Code, IntelliJ, GitHub Codespaces
- **Test**: JUnit, Pytest, Cypress, automated CI pipelines
- **Deploy**: Jenkins, GitHub Actions, ArgoCD
- **Monitor**: Prometheus, Grafana, Datadog, PagerDuty

---

## Agile and Scrum Basics

Agile is a development methodology; DevOps is how you reliably deliver that development to production. They are complementary.

| Dimension | Agile | DevOps |
|-----------|-------|--------|
| Focus | Iterative development in sprints | Collaboration across the full lifecycle |
| Scope | Code and testing | Development + operations + deployment + monitoring |
| Feedback | From stakeholders after each sprint | Continuous — from monitoring, users, and all systems |

**Scrum ceremonies** you will encounter in DevOps teams:
- **Sprint Planning** — define work for the next 1–2 weeks
- **Daily Standup** — 15-minute sync on progress and blockers
- **Sprint Review** — demonstrate completed work
- **Sprint Retrospective** — reflect and improve the process

In DevOps, retros should surface process improvements: flaky tests, slow pipelines, toil-heavy on-call rotations.

---

## Version Control Basics

Git is the standard version control system in modern software teams. For platform engineers, Git is not just source control — it is the audit trail for infrastructure, the trigger for CI/CD, and the fastest safe rollback tool.

### Core Concepts

| Concept | Meaning |
|---------|---------|
| Working Tree | Current files on your machine |
| Staging Area | Files queued for the next commit |
| Commit | Immutable snapshot of changes with a message |
| Branch | Named pointer to a commit |
| Remote | Shared copy of the repository (GitHub, GitLab) |
| Tag | Named marker for a specific commit (used for releases) |

### Daily Safe Workflow

```bash
git status                 # your cockpit panel — run constantly
git diff                   # see unstaged changes
git add file.py            # stage specific file
git diff --staged          # review what will be committed
git commit -m "Fix API timeout after EU region latency spike"
git push origin feature/my-feature
```

### Commit Messages That Matter

Weak:
```
update files
```

Strong:
```
Increase API timeout to 30s after dependency latency spikes in EU region

The payment service P99 latency exceeded 20s during peak hours,
causing 5% of checkout requests to fail with TimeoutError.
```

Explain *why* the change was made, not just *what* changed. Future you — and your team — will be grateful during incident investigation.

---

## Continuous Integration (CI) Basics

**Continuous Integration** means every code change is automatically built and tested when pushed to the repository. The goal: catch integration problems early, before they compound.

### A Basic CI Pipeline

```
Developer pushes code
    -> Git webhook fires
    -> CI system checks out code
    -> Install dependencies (npm install / mvn install)
    -> Run automated tests (unit, integration)
    -> Run static analysis (linting, type checks)
    -> Report pass/fail to the pull request
```

### GitHub Actions Example

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run tests
        run: pytest tests/ -v

      - name: Lint
        run: flake8 src/
```

**Key principle:** The CI pipeline must be fast (under 10 minutes ideally). Slow pipelines discourage frequent commits, which defeats the purpose.

---

## Deployment Basics

**Deployment** is the process of moving a tested artifact from the build system to a running environment.

### Environments

Most teams use a pipeline of environments:

```
Local (developer machine)
  -> Dev (shared dev environment)
    -> Staging (production-like testing)
      -> Production (live traffic)
```

Each promotion gate should be validated by automated tests or approval gates.

### Basic Deployment Commands

```bash
# Docker — build and run
docker build -t myapp:latest .
docker run -d -p 8080:80 myapp:latest

# Kubernetes — apply a deployment manifest
kubectl apply -f deployment.yaml
kubectl get pods                     # check pod status
kubectl rollout status deployment/myapp   # watch rollout progress

# Roll back if something goes wrong
kubectl rollout undo deployment/myapp
```

### Deployment Frequency Goal

Teams just starting DevOps often deploy weekly. The goal is to deploy more frequently in smaller batches — this reduces risk per deployment and makes rollback much easier.

---

## On-Call Basics

Being on-call means you are responsible for responding to production alerts outside normal hours. Every engineer should eventually be on-call for the systems they build.

### On-Call Fundamentals

- **Alert routing**: Alerts flow from monitoring (Prometheus, Datadog) to an on-call system (PagerDuty, Opsgenie)
- **Runbooks**: Step-by-step guides for common problems. The first time you fix something, write the runbook for future responders
- **Escalation**: If you cannot resolve within 15–30 minutes, escalate to the next tier
- **Handoff**: End every on-call shift with a written summary of incidents handled

### First Steps During an Incident

1. Acknowledge the alert to stop repeated pages
2. Assess impact: who is affected, how many users, how severe
3. Check dashboards and logs for the most recent change
4. Communicate status in the incident channel
5. Mitigate first (rollback, scale up, disable feature flag) — diagnose after

### Blameless Culture

Incidents are system failures, not human failures. The goal of every postmortem is to answer: "What can we change about the system, tooling, or process so this class of failure cannot happen again?" Blame produces defensiveness; blameless analysis produces learning.

---

## Key Vocabulary

| Term | Definition |
|------|-----------|
| CI | Continuous Integration — automated build and test on every commit |
| CD | Continuous Delivery/Deployment — automated release to environments |
| IaC | Infrastructure as Code — managing infrastructure via versioned config files |
| SRE | Site Reliability Engineering — applying software engineering to operations |
| DORA | DevOps Research and Assessment — research group that defined the four key delivery metrics |
| Toil | Repetitive manual operational work that scales linearly with traffic |
| Runbook | Step-by-step operational procedure for a specific scenario |
| Postmortem | Structured document reviewing an incident: timeline, impact, causes, action items |
| SLO | Service Level Objective — reliability target (e.g., 99.9% availability) |
| Error Budget | The allowed amount of unreliability within an SLO period |

---

## Summary

DevOps is a cultural and technical movement that closes the gap between writing software and running it in production. The beginner journey starts with:

1. Understanding the CAMS principles and why DevOps exists
2. Learning Git as your version control foundation and audit trail
3. Setting up a basic CI pipeline to automate testing
4. Practicing safe deployment and rollback
5. Participating in on-call rotations with blameless postmortem culture

The goal is not to memorise tools — tools change. The goal is to internalise the feedback-loop mindset: measure, learn, improve.

---

## Monitoring and Observability Basics

Monitoring tells you when something is wrong. Observability tells you why. You need both.

### The Three Pillars

| Pillar | What it is | Example tools |
|--------|-----------|---------------|
| **Metrics** | Numeric measurements over time | Prometheus, Datadog, CloudWatch |
| **Logs** | Timestamped text records of events | Loki, Elasticsearch, CloudWatch Logs |
| **Traces** | End-to-end request paths across services | Jaeger, Zipkin, AWS X-Ray |

Each pillar answers a different question:
- Metrics: "Is the system healthy right now?" (error rate is 2%)
- Logs: "What happened at 14:32?" (specific error messages, stack traces)
- Traces: "Why is this request slow?" (which service in the chain is the bottleneck)

You need all three. Metrics alert you. Logs explain the event. Traces show you where in a distributed system the problem lives.

### The Four Golden Signals

Google SRE defined four signals that, if monitored, cover most production failure modes:

| Signal | What to measure | Example |
|--------|----------------|---------|
| **Latency** | Time to serve a request (distinguish success vs error latency) | P50, P95, P99 response time |
| **Traffic** | Demand on the system | Requests per second, messages per second |
| **Errors** | Rate of failed requests | HTTP 5xx rate, exception rate |
| **Saturation** | How full the system is | CPU %, memory %, queue depth |

A practical starting point: instrument every service with these four signals before adding anything else. If you only have one dashboard, make it these four.

### Alerting Principles

- Alert on symptoms, not causes. "Error rate > 1%" is a symptom. "CPU > 80%" is often not actionable.
- Every alert should have a runbook. If you cannot write a runbook for an alert, the alert is not ready.
- Alerts that fire and require no action are noise. Audit and remove them.

```yaml
# Prometheus alert example — symptom-based
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
  for: 5m
  labels:
    severity: page
  annotations:
    summary: "Error rate above 1% for 5 minutes"
    runbook: "https://wiki.example.com/runbooks/high-error-rate"
```

---

## On-Call and Incident Response Basics

### What On-Call Means

On-call means you are the first responder for production alerts during your shift. You are not expected to fix everything alone — you are expected to triage, communicate, and escalate appropriately.

### The Incident Lifecycle

```
Alert fires
  -> Acknowledge (stops repeated pages)
    -> Triage (what is broken, who is affected)
      -> Communicate (post in incident channel)
        -> Mitigate (stop the bleeding — rollback, scale, disable)
          -> Diagnose (find root cause)
            -> Resolve (permanent fix or tracked follow-up)
              -> Postmortem (document and prevent recurrence)
```

**Mitigate before you diagnose.** Restoring service for users is more important than understanding why it broke. You can investigate after the bleeding stops.

### Incident Severity Levels

| Severity | Definition | Response time |
|----------|-----------|---------------|
| P1 / SEV1 | Complete outage or data loss | Immediate, all hands |
| P2 / SEV2 | Major feature broken, significant user impact | Within 15 minutes |
| P3 / SEV3 | Degraded performance, partial impact | Within 1 hour |
| P4 / SEV4 | Minor issue, workaround available | Next business day |

### Escalation

Escalate when:
- You cannot identify the cause within 15–30 minutes
- The incident crosses team boundaries
- You need access or knowledge you do not have
- MTTR is approaching an SLA breach

Escalating is not failure. Holding an incident alone past the point where you need help is.

### The Postmortem

A postmortem is a structured document written after every significant incident. It is blameless by design — the goal is system improvement, not assigning fault.

Minimum postmortem structure:
1. **Summary** — one paragraph: what broke, when, how long, impact
2. **Timeline** — chronological events from first symptom to resolution
3. **Root cause** — the underlying condition that made the failure possible
4. **Contributing factors** — what made it worse or harder to detect
5. **Action items** — specific, assigned, time-bounded follow-up tasks

Write the postmortem within 24–48 hours while the details are fresh.

---

## DevOps Toolchain Overview

Every phase of the SDLC has a corresponding set of tools. Knowing the landscape helps you understand where a tool fits and why it exists.

| SDLC Phase | Purpose | Common Tools |
|------------|---------|-------------|
| **Plan** | Track work, manage backlog | Jira, Linear, GitHub Issues, Confluence |
| **Code** | Write and review code | Git, GitHub, GitLab, VS Code, IntelliJ |
| **Build** | Compile, package, resolve dependencies | Maven, Gradle, npm, pip, Docker |
| **Test** | Automated quality gates | pytest, JUnit, Cypress, Selenium, k6 |
| **Release** | Version, tag, publish artifacts | GitHub Releases, Nexus, JFrog Artifactory |
| **Deploy** | Move artifacts to environments | Jenkins, GitHub Actions, ArgoCD, Spinnaker |
| **Operate** | Run and manage infrastructure | Kubernetes, Terraform, Ansible, Helm |
| **Monitor** | Observe system health | Prometheus, Grafana, Datadog, PagerDuty |

### The Golden Path

A "golden path" is a pre-built, opinionated toolchain that a platform team provides to application teams. Instead of every team choosing their own CI system, container base image, and deployment method, the platform team provides one well-supported path. Teams can deviate, but the golden path is the default.

Benefits: faster onboarding, consistent security posture, shared operational knowledge.

---

## Key DevOps Concepts Glossary

| Term | Definition |
|------|-----------|
| **Toil** | Repetitive, manual operational work that scales linearly with traffic and provides no lasting value. Automating toil is a core SRE practice. |
| **SLO** | Service Level Objective — a reliability target expressed as a percentage (e.g., 99.9% of requests succeed within 200ms over 30 days). |
| **Error Budget** | The allowed amount of unreliability within an SLO period. A 99.9% SLO gives 43.8 minutes/month of error budget. When it is exhausted, new deployments stop. |
| **MTTR** | Mean Time To Recovery — average time from incident start to service restoration. A key DORA metric. |
| **DORA** | DevOps Research and Assessment — the research program that identified deployment frequency, lead time, change failure rate, and MTTR as the four key delivery metrics. |
| **Golden Path** | A pre-built, opinionated toolchain provided by a platform team to reduce cognitive load for application teams. |
| **IDP** | Internal Developer Platform — the collection of tools, workflows, and self-service capabilities a platform team builds for application developers. |
| **GitOps** | A deployment model where Git is the single source of truth for infrastructure and application state. A controller (e.g., ArgoCD) continuously reconciles cluster state to match Git. |
| **Canary** | A deployment strategy where a small percentage of traffic is routed to the new version before full rollout. Named after the canary-in-a-coal-mine concept. |
| **Blue-Green** | A deployment strategy that maintains two identical environments (blue = current, green = new). Traffic switches instantly between them, enabling zero-downtime rollback. |
| **Feature Flag** | A runtime toggle that enables or disables a feature without a code deployment. Decouples release from deployment. |
| **Runbook** | A step-by-step operational procedure for a specific scenario (e.g., "how to restart the payment service"). The first time you fix something, write the runbook. |
| **Postmortem** | A structured blameless document written after an incident. Covers timeline, root cause, contributing factors, and action items. |
| **SRE** | Site Reliability Engineering — a discipline that applies software engineering principles to operations. SREs define SLOs, manage error budgets, and reduce toil through automation. |
| **Platform Engineering** | The practice of building and maintaining the internal developer platform — the tooling, pipelines, and infrastructure that application teams use to build and deploy software. |

---

## Infrastructure as Code Basics

Infrastructure as Code (IaC) means managing servers, networks, databases, and other infrastructure through versioned configuration files rather than manual clicks in a console.

### Why IaC Matters

Without IaC:
- Environments drift — staging and production diverge over time through manual changes
- Rebuilding an environment requires tribal knowledge
- No audit trail for infrastructure changes
- Disaster recovery is slow and error-prone

With IaC:
- Every infrastructure change is a Git commit — reviewable, reversible, auditable
- Environments are reproducible: `terraform apply` recreates the same state
- Onboarding is faster — new engineers read the code to understand the infrastructure

### Terraform Basics

Terraform is the most widely used IaC tool. It uses a declarative language (HCL) to describe the desired state of infrastructure.

```hcl
# main.tf — provision an EC2 instance
provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  tags = {
    Name        = "web-server"
    Environment = "staging"
  }
}
```

```bash
terraform init      # download providers
terraform plan      # preview changes (always run before apply)
terraform apply     # apply changes
terraform destroy   # tear down resources
```

**Key principle:** Always run `terraform plan` before `terraform apply`. Review the diff — especially any resources marked for destruction.

### IaC Best Practices for Beginners

- Store state remotely (S3 + DynamoDB for AWS) — never commit `.tfstate` to Git
- Use modules to avoid repeating the same resource blocks
- Tag every resource with environment, owner, and cost centre
- Treat IaC PRs the same as application code PRs — require review

---

## Containers and Docker Basics

Containers package an application and its dependencies into a portable, isolated unit. Docker is the most common tool for building and running containers.

### Why Containers

Before containers, "works on my machine" was a real problem. Containers solve it by bundling the application, runtime, libraries, and configuration into a single image that runs identically everywhere.

### Dockerfile Basics

```dockerfile
# Start from an official base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy and install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ .

# Run as non-root user (security best practice)
RUN useradd -m appuser
USER appuser

# Expose port and define entrypoint
EXPOSE 8080
CMD ["python", "app.py"]
```

```bash
docker build -t myapp:1.0.0 .          # build image
docker run -p 8080:8080 myapp:1.0.0    # run container
docker ps                               # list running containers
docker logs <container-id>             # view logs
docker exec -it <container-id> bash    # shell into container
docker stop <container-id>             # stop container
```

### Container Exit Codes

| Exit Code | Meaning | Common Cause |
|-----------|---------|-------------|
| 0 | Success | Normal exit |
| 1 | Application error | Unhandled exception, config error |
| 127 | Command not found | Wrong CMD in Dockerfile, missing binary |
| 137 | OOM killed (SIGKILL) | Container exceeded memory limit |
| 143 | Graceful shutdown (SIGTERM) | Kubernetes pod termination |

---

## What to Learn Next

After mastering the beginner concepts, the natural progression is:

1. **Intermediate DevOps** — CI/CD pipelines in depth, Kubernetes fundamentals, IaC with Terraform, Docker in production
2. **Kubernetes** — Pod lifecycle, Services, Ingress, ConfigMaps, Secrets, RBAC, Helm
3. **Observability** — Prometheus and Grafana in depth, log aggregation with Loki, distributed tracing
4. **Security (DevSecOps)** — Shift-left security, container scanning, secret management, RBAC
5. **SRE Practices** — SLO design, error budget policy, chaos engineering, capacity planning

The cheat sheet (`06-cheat-sheet.md`) and real-world examples (`07-real-world-examples.md`) in this section are good companions as you progress.
