---
title: "Interview Questions"
sidebar_position: 4
---

# General DevOps — Interview Questions

These questions are calibrated for staff engineer and senior engineer interviews. The answer structure follows the SRE operating manual template: clarify context, name failure domains, state evidence-based reasoning, and close with prevention.

---

## Staff Engineer vs Senior Engineer

**Q1: What is the difference between a senior engineer and a staff engineer?**

A senior engineer is an excellent individual contributor. They solve hard problems reliably, write high-quality code, mentor juniors, and are trusted to own significant features independently.

A staff engineer is a multiplier. Their scope extends beyond the team — they influence architecture across teams, shape the technical roadmap, identify systemic risks before they become incidents, and raise the engineering floor through platforms, golden paths, and standards. Where a senior engineer's success is measured by their output, a staff engineer's success is measured by the team's output.

Concrete differences:
- Senior: designs a service. Staff: designs the platform that makes future services easier and safer to build.
- Senior: fixes a class of bugs. Staff: eliminates the class of bugs system-wide through tooling and guardrails.
- Senior: writes the runbook. Staff: builds the system so the runbook is rarely needed.

---

**Q2: What does "scope" mean at staff level?**

Scope is the blast radius of your decisions. A senior engineer's scope is a service or a team. A staff engineer's scope is an org, a platform, or multiple teams. With larger scope comes responsibility for:

- Cross-team technical alignment (avoiding N solutions to the same problem)
- Architectural decisions that constrain future choices (so those choices must be made carefully)
- Platform investments that pay dividends for teams you will never directly work with

---

## DORA Metrics

**Q3: What are the DORA metrics and why do they matter?**

DORA (DevOps Research and Assessment) identified four metrics that reliably predict both software delivery performance and organisational performance:

| Metric | Definition | Elite benchmark |
|--------|-----------|----------------|
| Deployment Frequency | How often code reaches production | Multiple times/day |
| Lead Time for Changes | Commit to production | <1 hour |
| Change Failure Rate | % of deployments causing incidents | 0–5% |
| MTTR | Time to restore after incident | <1 hour |

They matter because they are validated. Unlike process metrics (story points delivered, PRs merged), DORA metrics correlate with business outcomes — teams in the elite tier report higher revenue growth, market share, and customer satisfaction.

**Q4: How would you improve a team's DORA metrics?**

Start by measuring all four. Teams often discover their mental model of the constraint is wrong.

If **deployment frequency is low**: find the bottleneck. Is it test confidence (increase coverage, parallelize test suite)? Feature completeness (implement feature flags to decouple deploy from release)? Manual approval steps (automate quality gates)?

If **lead time is long**: map the value stream. Find where code waits — in review queue, in slow CI, in manual staging testing. Attack the longest wait.

If **change failure rate is high**: invest in staging environment parity, integration testing, and canary deployments. High failure rate with high frequency is worse than either alone.

If **MTTR is long**: improve runbooks, alerting precision, and rollback automation. Practice with game days.

Never optimise one metric at the expense of others. Higher frequency with poor test coverage increases change failure rate.

---

## Toil and SRE Practices

**Q5: What is toil? Give examples.**

Toil is repetitive, manual, automatable operational work that scales linearly with service growth and produces no enduring value beyond the moment of execution.

Examples:
- Manually rotating database passwords every 90 days
- Manually clearing log files when a server fills up
- Restarting a service weekly because of a memory leak
- Manually approving deployment steps that always pass
- Copying metrics from one dashboard to a weekly report

Toil is not inherently wrong — some toil is unavoidable. But Google SRE recommends keeping toil below 50% of any engineer's time. Above that threshold, teams have no capacity to improve the system and are trapped in a maintenance treadmill.

**Q6: How do you reduce toil?**

Three strategies:

1. **Automate the runbook step** — if you can write it, you can script it. Manual restarts become liveness probes + Kubernetes auto-recovery. Manual secret rotation becomes Vault with automatic rotation.

2. **Fix the root cause** — a service that crashes weekly has a bug. Restarting it is toil; fixing the memory leak is engineering.

3. **Eliminate the need** — sometimes the toil exists because of a bad design decision. Architectural change removes the toil entirely.

Track toil monthly. Show the hours. Budget requests for automation work are much stronger with: "Manual secret rotation costs 3 engineer-hours per month. One week of work eliminates it permanently."

---

## Postmortem Culture

**Q7: What is a blameless postmortem and why does it matter?**

A blameless postmortem is a structured document produced after an incident that focuses on systemic causes rather than human blame. The premise: incidents are system failures. A human made a mistake because the system made the mistake easy to make.

It matters because:
- Blame-focused postmortems produce defensiveness. Engineers hide mistakes instead of surfacing them.
- Blameless postmortems produce learning. Teams surface near-misses, share information, and fix the underlying system.
- Psychological safety enables candour. Engineers who fear blame will not raise concerns before incidents occur.

A postmortem without action items is a narrative, not an improvement. Every postmortem should close with a minimum of three to five action items, each with an owner and a deadline, and a 30-day follow-up review.

**Q8: How do you run an effective incident postmortem?**

Structure:
1. **Timeline reconstruction** (not blame assignment) — what happened and when, in factual terms
2. **Impact assessment** — users affected, revenue impact, SLO burn
3. **Root cause analysis** — five whys or fishbone diagram to find the systemic cause, not the surface symptom
4. **Contributing factors** — what conditions made the incident possible
5. **Action items** — specific, ownable, measurable. "Improve monitoring" is not an action item. "Add alert for payment error rate >0.5% for >2 minutes" is.
6. **What went well** — reinforce good practices to replicate them

Hold the postmortem within 48 hours while memory is fresh. Distribute it widely. The learning should spread beyond the team that owned the incident.

---

## Technical Debt

**Q9: How do you prioritise technical debt?**

Classify debt before prioritising:

- **High-risk debt** (causing incidents or security risk): fix immediately, with urgency proportional to blast radius
- **High-friction debt** (slowing the team down daily): fix in a debt sprint or allocate 20% of each sprint
- **Low-risk, low-friction debt** (theoretical cleanliness): document and defer

Prioritise debt that has the highest incident risk per unit of fix effort. A component generating 40% of P1 incidents is a better investment than a "messy but stable" component generating zero incidents.

**Show the correlation.** When advocating for debt paydown, connect it to incident data: "This authentication module was involved in three of our five P1 incidents this quarter. Four weeks of refactoring eliminates the class of failure."

**Q10: How do you prevent reckless technical debt accumulation?**

Three practices:

1. **Definition of Done includes debt control** — PRs require tests, documentation, and observability. Work is not "done" until it is operable.

2. **ADRs document intentional shortcuts** — when taking a shortcut, write an ADR. "We are using this simpler approach knowing it will not scale beyond X. We plan to revisit when we reach Y." This prevents shortcuts from becoming invisible debt.

3. **20% rule** — reserve 20% of sprint capacity for reliability, debt reduction, and toil elimination. Non-negotiable. Frame it as investment, not cost.

---

## GitOps vs Push-Based Deployment

**Q11: What is the difference between GitOps and push-based deployment?**

**Push-based deployment:** The CI/CD system (Jenkins, GitHub Actions) directly pushes changes to the target environment via API calls or SSH.

```
CI: build -> test -> deploy
           (pipeline pushes to cluster)
```

**GitOps:** The desired state lives in Git. A reconciliation controller (ArgoCD, Flux) continuously compares Git state with cluster state and applies differences.

```
CI: build -> test -> update Git manifest
                          |
                   Controller detects drift
                          |
                   Controller applies to cluster
```

Key differences:

| Dimension | Push-based | GitOps |
|-----------|-----------|--------|
| Deployment trigger | Pipeline execution | Git commit |
| Source of truth | CI system | Git |
| Rollback | Re-run pipeline with old version | Revert Git commit |
| Drift detection | Manual | Continuous |
| Audit trail | Pipeline logs | Git history |
| Emergency access | Direct cluster access | Must commit to Git |

**Staff insight:** GitOps has a gotcha: manual cluster changes (emergency hotfixes) will be reverted by the controller if they are not committed to Git. This is a feature and a trap. Establish emergency runbooks that include committing hotfixes to Git before the controller reverts them.

**Q12: When would you choose GitOps over push-based deployment?**

GitOps is preferred when:
- Compliance requires an auditable, immutable record of every configuration change
- Multiple clusters need consistent configuration (one Git repo syncs to many clusters)
- Rollback speed is critical (reverting a Git commit is fast and predictable)
- The team is large enough that direct cluster access creates audit and security risk

Push-based is simpler for small teams with simple pipelines, or for deployments that are inherently stateful and hard to describe declaratively.

---

## Deployment Strategies

**Q13: When would you use blue-green vs canary vs rolling?**

| Strategy | Use when | Avoid when |
|----------|----------|-----------|
| **Blue-green** | Instant rollback is critical; full environment test before cutover | Cost doubles during switch; stateful apps with DB migration risk |
| **Canary** | Want real user traffic to validate change before full rollout; metrics can detect bad deployment automatically | A/B testing setup is too complex for the team; stateful sessions not sticky |
| **Rolling** | Zero-downtime with minimal infrastructure overhead; stateless services | Stateful apps where sessions must persist; schema changes incompatible with mixed versions |

**Q14: How do you handle database migrations during zero-downtime deployments?**

Use the expand-and-contract pattern:

1. **Expand**: Add the new column/table. Old code ignores it; new code uses it. Both versions run simultaneously.
2. **Migrate**: Backfill data in the new column. Monitor.
3. **Contract**: Remove old column once all services use the new schema. Old code is no longer running.

Never delete a column in the same deployment that stops using it. The old version is still serving traffic during a rolling update.

---

## On-Call and Incident Response

**Q15: How do you avoid on-call burnout?**

On-call burnout occurs when alert volume is high, incidents are frequent, and engineers feel they have no impact on improving the situation.

Structural fixes:
1. **Alert quality over quantity** — every page must be actionable and represent user impact. Noisy alerts are disabled or converted to tickets.
2. **Postmortem action items actually close** — engineers need to see that reporting incidents leads to improvement.
3. **On-call load limits** — if an engineer handles more than 2–3 significant incidents per shift, the team has a reliability problem that must be addressed before the next rotation.
4. **Rotation breadth** — spread on-call across enough engineers that no one is on-call more than once per three or four weeks.
5. **Compensation** — on-call carries extra burden; acknowledge it in sprint capacity planning and team agreements.

**Q16: What is alert fatigue and how do you fix it?**

Alert fatigue occurs when alert volume is so high that engineers stop trusting or responding to alerts promptly. The paradox: high alert volume reduces response quality, which increases MTTR for real incidents.

Fix it systematically:
- Audit every alert against the question: "Does this alert require human action right now?"
- Alerts that do not require immediate action become tickets (low-priority notification, not a page)
- Set alert thresholds based on user impact (SLO burn rate), not internal system metrics
- Review alert frequency monthly; suppress or fix the top three noisiest alerts

---

## Architecture and Design

**Q17: How do you approach a system design question at staff level?**

From the SRE operating manual — do not start with products. Start with constraints.

Use this order:
1. Users and traffic shape
2. SLOs and latency target
3. Consistency needs
4. Failure domains
5. Core data model
6. Request path
7. Observability and rollback
8. Security and access control
9. Cost and operational complexity

This structure signals senior thinking: you are reasoning from requirements, not from a mental library of services.

**Q18: What is a production readiness review and what should it include?**

A PRR is a structured review before a new service receives production traffic. It prevents the "deploy first, operate later" anti-pattern.

Core checklist:
- SLOs defined with error budgets
- Runbook written and reviewed by team members other than the author
- Alerting configured (user-impact-based, not noise)
- On-call rotation set up
- Capacity plan reviewed
- Load test against staging-at-scale
- Rollback procedure tested (not documented — tested)
- Dependency failure behaviour documented (what happens if downstream is down?)
- Data backup and restore procedure tested

---

## Quick-Answer Reference

| Question | Key answer |
|----------|-----------|
| What is toil? | Manual, repetitive, automatable work that scales with traffic |
| DORA metrics? | Deployment frequency, lead time, change failure rate, MTTR |
| Trunk-based vs GitFlow? | Trunk: shorter branches, faster integration. GitFlow: longer branches, scheduled releases |
| Canary vs blue-green? | Canary: gradual traffic shift. Blue-green: full environment switch |
| GitOps vs push-based? | GitOps: Git is source of truth, controller reconciles. Push: CI pushes directly |
| ADR purpose? | Document why a decision was made, not just what was decided |
| Blameless postmortem? | Focus on system causes, not human blame; produce actionable items |
| Error budget? | Allowed unreliability within SLO period; when depleted, reliability work takes priority |
| Feature flag use? | Separate deployment from release; enable gradual rollout and instant kill switch |
| Chaos engineering goal? | Find reliability gaps through controlled failure before users find them |
