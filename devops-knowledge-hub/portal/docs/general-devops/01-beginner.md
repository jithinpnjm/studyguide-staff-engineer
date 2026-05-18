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
