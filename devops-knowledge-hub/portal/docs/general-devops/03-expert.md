---
title: "Expert"
sidebar_position: 3
---

# General DevOps — Expert

This section covers the operating model for staff and principal engineers. The shift from senior to staff is a scope change: from "excellent individual contributor" to "technical multiplier." Your success is measured by the velocity and reliability improvement of the entire team, not your personal output.

---

## The Staff/Principal Engineer Operating Model

Senior engineers solve hard problems. Staff engineers change which problems the team faces in the first place.

### What Senior Interviewers Actually Test at Staff Level

From the SRE operating manual, interviewers at staff level want to see:

- **Reasoning from first principles under ambiguity** — not pattern-matching to the most recently read blog post
- **Blast-radius reduction before elegance** — safety before cleverness
- **Connection across layers** — symptom to OS, network, runtime, and control plane
- **Safe decisions with incomplete information** — operational courage combined with caution
- **Tradeoff articulation** — clear communication of what you gain and what you give up
- **Failure domain thinking** — framing problems in terms of which domain owns the failure

At staff level specifically:
- Platform judgment — what to centralise vs. what to leave to teams
- Strong defaults and guardrails — building the golden path
- Organisational coupling awareness — understanding how platform decisions constrain product teams
- Cost, complexity, and operator burden — senior engineers sometimes add complexity; staff engineers remove it

### Common Staff-Level Traps

Avoid these in interviews and in practice:

- Treating Kubernetes as *the system* instead of one layer of the system
- Assuming healthy averages mean healthy tail latency
- Confusing node capacity with safe *allocatable* capacity
- Assuming a load balancer health check proves real user health
- Treating retries as harmless (they can amplify outages)
- Proposing aggressive automation without blast-radius controls

---

## The Failure-Domain Habit

Always ask: where can this problem live?

```
single process
  -> single host
    -> single node pool
      -> single rack or zone
        -> single cluster
          -> region
            -> shared dependency
              -> control plane
                -> deploy or config domain
                  -> identity or policy domain
```

Naming the failure domain narrows the search space immediately and signals senior thinking. "It could be zone-specific" or "this feels like a shared dependency issue" frames the investigation correctly before any commands are run.

### Translating Symptoms to Stacks

Instead of "the app is slow," decompose:

```
DNS resolution slow?
  -> TCP connect latency?
    -> TLS handshake?
      -> Request queuing (thread pool saturation)?
        -> App CPU / GC pause?
          -> Lock contention?
            -> Database wait?
              -> Downstream retry storm?
```

Instead of "the cluster is broken," decompose:

```
Scheduler issue?
  -> Kubelet failure?
    -> CNI plugin?
      -> kube-proxy or dataplane?
        -> Container runtime?
          -> Node pressure (memory/disk)?
            -> Stale endpoints?
              -> Admission controller / auth issue?
```

This decomposition habit is the fastest way to sound and think at staff level.

---

## Technical Leadership

### Roadmap Planning

Staff engineers co-own technical roadmaps with their engineering manager. A good technical roadmap:

1. **Anchors to business outcomes**, not technology for its own sake
2. **Balances new capabilities with reliability and debt work** (the "20% rule": allocate 20% of capacity to toil reduction and tech debt)
3. **Sequences dependencies** — which infrastructure work unlocks which product work
4. **Quantifies risk** — this migration carries a 2-week delivery delay if we hit schema conflicts
5. **Has explicit success metrics** — we will know we are done when MTTR drops below 1 hour

### Quarterly Planning Rhythm

```
Month 1 of quarter:
  - Review DORA metrics from previous quarter
  - Identify top 3 reliability bets and top 3 product enablement bets
  - Propose roadmap to EM and PM with explicit tradeoffs

Month 2-3:
  - Execute, measure weekly
  - Surface blockers to EM weekly (not monthly)
  - Adjust scope based on learning, not on "we said we would"
```

---

## Architectural Decision Records (ADRs)

An ADR documents *why* a technical decision was made, not just *what* was decided. Future engineers reading code need the context to avoid re-litigating decisions with missing information.

### ADR Template

```markdown
# ADR-042: Use Postgres instead of DynamoDB for user preference storage

## Status
Accepted (2024-03-15)

## Context
The user preference service currently stores data in DynamoDB.
As the preferences model grows more relational (preferences depend
on organisation, role, and feature flags), query patterns require
joins and transactions that are awkward and expensive in DynamoDB.

## Decision
Migrate user preference storage to Postgres (RDS Aurora).

## Consequences
**Positive:**
- Natural JOIN support for organisation-scoped queries
- ACID transactions for preference updates
- Familiar query language for the team

**Negative:**
- Increased operational burden (backups, failover configuration)
- Schema migrations require coordination
- Loss of DynamoDB's automatic multi-region replication

## Alternatives Considered
- Single-table DynamoDB design: Too complex for current team skill set
- MongoDB: Rejected — adds operational complexity without clear benefit

## Review Date
2025-03-15 (revisit if data volume exceeds 100M rows)
```

**ADR culture signals:**
- Numbered sequentially so teams can reference "ADR-042" in conversation
- Stored in the repository alongside the code (not in Confluence or Notion, where they drift from reality)
- Updated with status changes (`Proposed -> Accepted -> Superseded`)

---

## Managing Technical Debt

Not all technical debt is equal. Mishandling debt leads to either paralysis (teams afraid to touch anything) or entropy (everything decays).

### Classifying Technical Debt

| Type | Description | Response |
|------|-------------|---------|
| **Intentional, time-limited** | "We used a monolith until scale bottlenecks appeared." | Track, schedule the migration, deliver on time |
| **Unintentional** | Discovered during work; better solution now clear | File immediately as a ticket with impact assessment |
| **Reckless** | "We did not have time for tests" | Retrospective + process change required |
| **Bit rot** | Dependencies unmaintained, code untouched for years | Regular audit; assess whether component should be deprecated |

### Debt Prioritisation Framework

Score debt by **impact** (incident frequency, developer hours lost, security risk) multiplied by **effort to fix** (complexity, risk). Focus on high-impact, medium-effort items first — the big wins without catastrophic risk.

```
Priority = (Incident Risk × Developer Hours Lost × Security Risk) / Effort
```

**Show the data.** Budget requests for debt reduction are more compelling with: "This component generated 40% of our P1 incidents last quarter. Four weeks of work eliminates the class of failure."

---

## Engineering Excellence Programs

Staff engineers often sponsor or run excellence programs that raise the entire team's floor:

### Production Readiness Reviews (PRRs)

A structured review before a new service goes to production:

- [ ] SLOs defined with error budgets
- [ ] Runbooks written and reviewed
- [ ] Alerting configured (not too noisy, not too silent)
- [ ] On-call rotation set up
- [ ] Capacity planning reviewed
- [ ] Load test run against staging
- [ ] Rollback procedure tested

A PRR gate prevents services from going to production before the team knows how to operate them.

### Architecture Reviews

Monthly reviews where teams present significant changes before implementation:

- **Scope**: Any change affecting more than one team, or with significant reliability/security implications
- **Duration**: 30–60 minutes
- **Output**: Written document capturing decisions and tradeoffs

### Golden Paths

Pre-configured service templates that embed best practices by default:

```
Service template includes by default:
  - CI/CD pipeline (GitHub Actions / Jenkins)
  - Prometheus metrics endpoint (/metrics)
  - Structured logging to stdout (JSON)
  - Health check endpoints (/health, /ready)
  - Dockerfile with non-root user
  - Kubernetes manifests with resource limits and probes
  - Runbook template in /docs/runbook.md
```

The goal: a developer clones the template and has production-grade observability, security, and deployment from day one. The golden path is the easy path.

---

## Chaos Engineering and Game Days

You cannot trust reliability until you have tested failure. Chaos engineering is the discipline of deliberately introducing failures in controlled ways to find weaknesses before they find you.

### Chaos Engineering Principles

1. **Define steady state** first — what does healthy look like in metrics before the experiment?
2. **Form a hypothesis** — "If the payment service goes down, checkout will degrade gracefully and retry successfully within 30 seconds"
3. **Introduce failure in a controlled scope** — start in staging; only graduate to production when confidence is high
4. **Observe the system** — does it behave as the hypothesis predicted?
5. **Fix gaps** and re-run

### Types of Chaos Experiments

| Experiment | What it tests |
|-----------|--------------|
| Kill a random pod | Pod recovery and traffic re-routing |
| Introduce 200ms latency on a dependency | Timeout propagation and circuit breakers |
| Drain a node | Rescheduling behaviour and PodDisruptionBudgets |
| Expire a TLS certificate | Certificate renewal automation |
| Throttle CPU of a service | Graceful degradation under resource pressure |
| Simulate zone outage | Multi-AZ failover |

### Game Days

A game day is a scheduled team exercise where engineers intentionally break production (or a production-like environment) and practice incident response:

```
Game Day Structure:
  09:00 - Brief: today's failure scenario (kept secret from responders)
  09:15 - Chaos begins: failure injected
  09:15-11:00 - Team responds as if it is a real incident
  11:00 - Debrief: what worked, what failed, what surprised us
  11:30 - Action items: runbook gaps, alert gaps, process gaps
```

Run game days quarterly. Rotate who plays incident commander, who plays responder, who plays chaos operator.

---

## SRE Toil Reduction

**Toil** is repetitive, manual, reactive work that does not improve the system — it just keeps it running. Toil scales with traffic (more users = more manual work), which makes it a growth ceiling.

### Identifying Toil

Toil characteristics:
- Manual
- Repetitive
- Automatable
- Tactical (reactive, not strategic)
- No enduring value beyond the moment
- Scales with service growth

Examples: manually rotating secrets, manually clearing log files, manually restarting a service that crashes weekly, manually approving deployment steps that always pass.

### Toil Budget

Google's SRE book recommends keeping toil below 50% of any engineer's time. Above 50%, the team has no capacity to improve the system — they are trapped in a maintenance spiral.

Track toil explicitly:
```
Monthly toil log:
  - Secret rotation: 3 hrs (automate with Vault + Kubernetes external-secrets)
  - Log cleanup: 1 hr (automate with logrotate + lifecycle policy)
  - Weekly restart of payment service: 2 hrs (fix memory leak)
  Total: 6 hrs/month = 15% of one engineer's time
```

### Toil Elimination Tactics

1. **Automate runbook steps** — if you can write the steps, you can script them
2. **Fix the root cause** — a service that crashes weekly has a bug; fix the bug instead of restarting it
3. **Self-healing systems** — liveness probes + Kubernetes auto-restarts replace manual intervention
4. **Infrastructure lifecycle policies** — S3 lifecycle for logs, automated certificate renewal (cert-manager), automated secret rotation

---

## Summary

The expert operating model requires:

1. **Failure-domain thinking** — framing every problem by where it can live in the system
2. **ADRs** — capturing architectural decisions with context so teams can learn from the past
3. **Technical debt classification** — distinguishing intentional debt from reckless debt and prioritising by impact
4. **Engineering excellence programs** — PRRs, architecture reviews, and golden paths raise the team's floor
5. **Chaos engineering and game days** — proactively discovering reliability gaps before users find them
6. **Toil reduction** — automating operational work to free the team for system improvement

The staff engineer's job is to make the entire team more effective, safer, and faster — not to be the smartest person in the room.
