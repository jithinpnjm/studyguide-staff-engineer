---
title: "Troubleshooting"
sidebar_position: 8
---

# Platform Engineering — Troubleshooting

These are the recurring failure modes that show up in platform teams. Each section names the anti-pattern, the detection signals, and the recovery path. Use the senior answer template: failure domain, fastest signal, immediate mitigation, long-term prevention.

---

## 1. Golden Cage: Platform Abstractions That Don't Fit

### What it is

The golden path becomes a golden cage when teams cannot accomplish legitimate goals without violating the abstraction. The platform was built to reduce cognitive load — a cage increases it by forcing teams to work around limitations rather than through the platform.

Common signals a cage is forming:
- Teams ask for exceptions to platform policies more than twice per quarter
- Engineers describe the golden path as "the thing we have to pretend to use"
- Teams maintain parallel tooling (custom Helm charts, custom CI scripts) alongside the official golden path
- Backstage scaffolding is used for project creation only, then abandoned
- On-call incidents trace back to misuse of a platform abstraction, not the team's own code

### Detection

Measure these four signals quarterly:

| Signal | Healthy | Warning | Critical |
|---|---|---|---|
| Exception requests per team per quarter | 0–1 | 2–4 | 5+ |
| Golden path adherence (audit) | > 80% | 60–80% | < 60% |
| Off-path deployments discovered in CMDB audit | 0 | 1–3 | 4+ |
| Platform NPS (team survey) | > 30 | 10–30 | < 10 |

### Escape hatch design

Every platform capability should have an explicit escape hatch — a documented, supported path for teams with legitimate needs that differ from the golden path. An escape hatch is not a second-class citizen; it is part of the platform design.

Escape hatch pattern:
1. Team submits a "non-standard workload request" (a lightweight form, not a committee)
2. Platform team responds within 48 hours with one of: (a) the golden path can be extended to cover this, (b) an off-ramp exists — here is how to use it, (c) this is out of scope — here is why and what the alternative is
3. If the same request comes from 3 or more teams, it becomes a golden path addition

```
Escape hatch design checklist:
[ ] Non-standard workload is observable by the platform (same metrics pipeline)
[ ] Security controls still apply (same guardrails, different implementation)
[ ] Ownership is explicit (Backstage catalog entry required)
[ ] Lifecycle is agreed: review at 6 months, migrate or formalise
[ ] Cost is visible to the team (FinOps tagging enforced)
```

### Recovery

If you have discovered an existing golden cage:
1. Run 3–5 team interviews — understand what they cannot do, not why they broke the rule
2. Classify: is the gap a platform design problem or a user education problem?
3. For design problems: extend the golden path, add the escape hatch, or deprecate the capability that created the cage
4. For education problems: improve documentation, add interactive onboarding, pair with teams during adoption
5. Track platform NPS quarterly — the cage is resolved when teams stop asking for exceptions

---

## 2. Platform Team as Bottleneck

### What it is

The platform team becomes a service desk: every team capability requires a ticket, and the platform team is the critical path for every team's velocity. The team cannot work on improvements because they are fully occupied with requests.

### Symptoms

| Metric | Threshold that signals a problem |
|---|---|
| Ticket backlog (open platform tickets) | > 20 tickets |
| P50 ticket age | > 5 days |
| % of platform engineer time on tickets | > 60% |
| Teams waiting > 1 week for any capability | > 3 teams |
| New feature output (per sprint) | Near zero |

### Self-service maturity model

Assess where each capability sits:

| Level | Description | Example |
|---|---|---|
| 0 — Manual | Team files a ticket; platform team does the work | "Create a namespace for us" |
| 1 — Runbook | Team follows a documented procedure; platform team reviews | "Run this Terraform, ping us" |
| 2 — Self-serve (supervised) | Team uses a tool; platform team gets notified | Backstage template with Slack alert |
| 3 — Self-serve (autonomous) | Team acts independently; platform team sees metrics | Full scaffolder flow, no notification needed |
| 4 — Embedded | Capability is part of team workflow, invisible as "platform" | Auto-namespace on first commit |

Every capability in the ticket queue is at level 0 or 1. The goal is to move everything to level 3 or 4.

### Recovery plan

```
Week 1:  Triage current tickets — categorise by capability type
Week 2:  Identify the highest-volume category — build self-serve for that one
Week 4:  Re-triage — measure how many tickets were eliminated
Week 6:  Repeat for the next highest-volume category
Quarter: Review — what percentage of previous ticket categories now have self-serve?
```

Priority order for automation investment (highest ticket volume first is always correct):

1. Namespace and project provisioning — Backstage scaffolder + Kyverno generate
2. CI pipeline setup — scaffolder creates `.github/workflows/` on project creation
3. Database and queue provisioning — Terraform module + scaffolder "add resource" template
4. Access and RBAC — OIDC group sync + documented self-serve RBAC request
5. Observability setup — scaffolder includes Grafana dashboard and alert templates

**Key measurement:** After each automation, track tickets in that category. Success = the category reaches zero new tickets within 30 days.

---

## 3. Shadow IT Emerging

### Why it happens

Shadow IT is a symptom of platform failure. Teams do not go around the platform out of malice — they go around it because they have a real need the platform does not serve and they cannot wait for the platform team to address it.

Common platform gaps that generate shadow IT:
- No support for a specific runtime (e.g., GPU workloads, Spark jobs, mobile backend patterns)
- Response time too slow (6-week ticket turnaround)
- Golden path has too many compliance requirements for early-stage experimentation
- Cost allocation is opaque — teams cannot see what they are spending

### Detection

Three detection channels:

**FinOps:** Cloud spend appearing in accounts or cost centres not registered with the platform. Set up AWS Config Rules or Azure Policy to alert on resources not tagged with required tags.

```bash
# AWS Config rule: detect untagged resources
aws configservice describe-config-rules \
  --config-rule-names required-tags
```

**CMDB / Backstage gaps:** Services discovered in production (via DNS, load balancer config, or security scanning) that have no Backstage catalog entry. Run a quarterly reconciliation between Backstage entities and actual cloud resources.

**Security scanning scope:** Services or endpoints appearing in vulnerability scan results that are not in the known service inventory.

### Constructive response

Do not escalate punitively. The team that built shadow IT had a legitimate need.

Response framework:
1. Acknowledge the platform gap that caused the team to go their own way — own the failure
2. Inventory the shadow resources (security requires this regardless)
3. Agree on a migration timeline that does not disrupt the team's service
4. Use the shadow implementation as the reference design for the new golden path capability
5. Add a "non-standard workload response time SLA" to the platform team charter (48 hours, not 6 weeks)

**Platform metric to track:** Number of shadow IT instances discovered per quarter. This should decrease as platform coverage improves. If it is increasing, the platform is falling behind.

---

## 4. Ivory Tower Platform — Built Without User Research

### What it is

The platform team designs and builds capabilities based on what they believe teams need, not what teams actually need. The result is technically sophisticated tooling with low adoption.

Signs of an ivory tower platform:
- Backstage scaffolder has 20 templates but teams default to copying old repos manually
- Golden path has features no team has used in 6 months
- Platform capabilities are documented but teams still ask basic "how do I" questions
- Platform NPS is low despite high investment
- The platform team is proud of their architecture; teams are indifferent to it

### Discovery framework

Run user research before building any new platform capability:

```
Phase 1 — Problem discovery (do not mention solutions)
  - What takes the most time in your current workflow?
  - What do you dread doing?
  - When did you last work around a platform limitation — what were you trying to do?

Phase 2 — Solution validation (prototype, not production)
  - Show a 10-minute prototype or mockup
  - Ask: does this solve the problem you described?
  - Ask: what would make you NOT use this?

Phase 3 — Adoption check (after launch)
  - Is the team using the capability?
  - What friction did they encounter?
  - What would they change?
```

Run Phase 1 with at least 3 teams before writing any code for a new platform capability.

### Dogfooding practice

The platform team should use their own platform for their own services. If the platform team's own CI pipelines, deployments, and observability do not run on the golden path, they will not discover friction that users encounter.

Dogfooding checklist:
- [ ] Platform team services are registered in Backstage
- [ ] Platform team CI runs on the same GitHub Actions templates they provide to teams
- [ ] Platform team deploys via ArgoCD the same way product teams do
- [ ] Platform team uses the same observability stack (same Grafana, same alert rules)
- [ ] Platform team has completed their own onboarding flow as a new user would experience it

---

## 5. Governance as Gatekeeper

### What it is

Approval loops inserted into the delivery path to ensure compliance, security, or architecture standards — but implemented as synchronous human gates that block delivery rather than as automated guardrails.

Examples:
- Architecture review board that must approve every new service before deployment
- Security team that manually reviews every new Docker image
- Change Advisory Board (CAB) that meets weekly and must approve production deployments

The result: teams batch changes to minimize the number of approval requests, increasing blast radius. Teams learn to route around the process. Lead time increases.

### Async-first governance patterns

| Old pattern | Async-first replacement |
|---|---|
| Architecture review board (sync meeting) | Architecture Decision Record (ADR) + async comment period (48 hours) |
| Manual security image review | Automated Trivy scanning in CI; gate on HIGH/CRITICAL; security team reviews reports weekly |
| CAB approval for production deploy | Pre-approved change types; CAB reviews automated audit log, not individual requests |
| RBAC access request → manual approval | Self-serve RBAC with automated policy enforcement and audit trail |
| Compliance sign-off per service | Compliance-as-code (OPA policies); audit shows which services pass |

### Governance gate audit

Run this audit on your current governance gates quarterly:

```
For each approval gate:
1. How long does it take to get approval? (P50 and P90)
2. What percentage of requests are approved without modification?
3. What is the actual risk being mitigated?
4. Can this be replaced with an automated check that provides equivalent assurance?
5. If not automated, can it be async (comment period) instead of synchronous (meeting)?
```

If P90 approval time > 2 days and approval rate > 90%, the gate is providing security theater, not security.

---

## 6. Platform Sprawl — Too Many Tools and Abstractions

### What it is

Over time, the platform accumulates tools that were each added for good reasons but collectively create an overwhelming surface area. Engineers must learn 12 different CLIs to deploy a single service.

Signs of sprawl:
- The platform team's own documentation links to 15+ different tools
- New engineers take 3+ months to feel confident with the full stack
- Different teams use different subsets of the platform (no consistent standard)
- Some platform tools have a single internal user
- Maintenance burden of tools exceeds value delivered

### Consolidation strategy

Run a capability audit:

```
For each platform tool or abstraction:
1. How many teams use it actively? (monthly active users)
2. What does it do that another tool does not already do?
3. What is the maintenance cost? (hours/month from platform team)
4. Is there a simpler tool that covers 80% of the use case?
```

Consolidation decision matrix:

| Usage | Maintenance cost | Decision |
|---|---|---|
| High | Low | Keep; invest further |
| High | High | Automate to reduce maintenance cost |
| Low | Low | Deprecate slowly; document alternatives |
| Low | High | Deprecate urgently; migrate active users |

### Migration path

When deprecating a tool:

1. Announce deprecation with a clear end-of-life date (minimum 6 months notice)
2. Identify all current users and workloads
3. Provide a migration guide before the announcement
4. Offer migration support — platform engineer pairs with each team during their migration
5. Set an automated reminder in the Backstage catalog: any entity using a deprecated tool gets a health check warning
6. Remove the tool only after all known users have migrated and the count of Backstage entities using the deprecated annotation reaches zero

---

## 7. Backstage Catalog Drift

### What it is

The Backstage catalog starts as the authoritative registry of all services, teams, and resources. Over time, it drifts: services are deployed without catalog entries, teams are reorganized without updating ownership, APIs are deprecated without marking them as such, resources point to owners who no longer exist.

A drifted catalog is worse than no catalog — it provides false confidence.

### Detection signals

```bash
# Find entities with no owner (group doesn't exist in the catalog)
kubectl get configmap -n backstage -o yaml | grep "owner:"

# Backstage catalog health check API — entities in Error state
curl -s https://backstage.internal/api/catalog/entities?filter=status.items.type=error

# Find components with lifecycle=production and no associated SLO
# (custom health check via Backstage plugin)
```

Catalog drift indicators:
- Entities with `owner: group:unknown` or owner groups that have 0 members
- Components in `lifecycle: production` with no annotations linking to monitoring
- Templates that have not been used in 90+ days (may be stale)
- Catalog API returning 404 for services you know are running in production

### Sync automation

The catalog should never require manual entry for services that exist in production. Automate the source of truth:

1. **Scaffolder as entry point:** Every new service is created via Backstage scaffolder; the `catalog-info.yaml` is generated automatically and committed to the repo.

2. **Discovery plugins:** Use Backstage's GitHub discovery plugin to automatically ingest any repo containing a `catalog-info.yaml`. Teams that add the file get automatic registration.

3. **Ownership enforcement:** Add a GitHub Action check that fails PRs if the `catalog-info.yaml` is deleted or the owner field is removed.

4. **Quarterly audit:** Script that lists all services in production (from Kubernetes namespaces, load balancer config, or DNS) and compares against Backstage entities. Services not in the catalog go to a triage queue.

### Ownership enforcement

```yaml
# .github/workflows/catalog-lint.yaml
name: Catalog Lint
on: [pull_request]
jobs:
  validate-catalog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate catalog-info.yaml
        run: |
          if [ -f catalog-info.yaml ]; then
            # Check required fields are present
            python3 scripts/validate-catalog.py catalog-info.yaml
          else
            echo "::warning::No catalog-info.yaml found. Service will not appear in Backstage."
          fi
```

---

## 8. Golden Path Adoption Dropping

### What it is

Adoption was initially high (early teams were enthusiastic adopters), but new teams are not adopting the golden path, or existing teams are drifting away from it.

### Diagnosis

**Quantitative signals:**

| Metric | How to measure |
|---|---|
| New services using golden path template | Backstage scaffolder usage per month |
| Services passing golden path compliance check | Kyverno PolicyReport — compliant entities / total entities |
| Teams using golden path CI vs custom CI | GitHub Actions workflow file analysis |
| Golden path feature usage rate | Which scaffolded capabilities are kept vs deleted post-creation |

**Qualitative signals (team interviews):**

Run 20-minute interviews with 1 engineer from 5 different teams. Ask:
- Walk me through how you deploy a new service. Where does it feel slow or painful?
- Have you ever modified the golden path template? What did you change and why?
- What does the golden path not support that you needed in the last 3 months?
- If you could change one thing about the platform, what would it be?

### Improvement cycle

```
Month 1: Measure adoption baseline + run 5 team interviews
Month 2: Identify top 3 friction points from interviews
Month 3: Fix the top friction point; release an updated template
Month 4: Measure adoption again — did the fix increase adoption?
Month 5: Fix the second friction point
Month 6: Re-run team interviews
```

Never release a golden path update without testing it with at least one real team before general release. Changes to the golden path can break existing consumers.

---

## 9. Platform SLO Breach

### What it is

A platform capability falls below its SLO, and product teams are impacted. The platform team is now in an incident that affects multiple downstream teams simultaneously.

### Immediate response

Platform SLO breaches are different from product service breaches: the blast radius is N teams, not 1.

```
First 5 minutes:
1. Confirm the breach: check the platform SLO dashboard
2. Identify affected teams: who is using the failing capability?
3. Post in #platform-incidents immediately — do not wait until you know the root cause
   Template: "[DEGRADED] Backstage scaffolder is failing template runs. 
   Investigating. Workaround: use manual catalog-info.yaml creation. ETA: 20 min."
4. Assign an incident lead (separate from the engineer debugging)

First 30 minutes:
5. Apply fastest mitigation — rollback, disable, fail-safe
6. Update affected teams with status every 15 minutes
7. Do not attempt deep root cause during the incident — stabilise first

After recovery:
8. Post resolution message with summary
9. Initiate postmortem within 24 hours
10. Share postmortem with all affected teams, not just the platform team
```

### Escalation matrix

| Capability down | Duration | Action |
|---|---|---|
| Backstage UI | < 15 min | Platform engineer investigates |
| Backstage UI | > 15 min | Page platform on-call lead |
| ArgoCD sync failing | Any | Immediate — all deployments blocked; page platform lead + VP Eng |
| ESO secret refresh failing | > 30 min | Page platform on-call; notify security team |
| CI pipeline builds failing | > 15 min | Page platform on-call; post in #engineering |
| Cluster API unavailable | Any | P1 incident; escalate to CTO if > 30 min |

### Platform incident communications template

```
[STATUS UPDATE - T+15min]
Component: Backstage Scaffolder
Status: INVESTIGATING
Impact: Template runs are failing with "GitHub API rate limit exceeded"
Affected teams: Any team trying to create new services
Workaround: Manually create catalog-info.yaml and push to repo — template is here: [link]
ETA: Rate limit resets at 14:00 UTC (35 minutes from now)
Next update: 13:50 UTC
— Platform Team
```

---

## 10. New Platform Team Forming — First 90 Days

### The core mistake to avoid

New platform teams often start by building before understanding. They pick a tool (Backstage, Terraform modules, ArgoCD) and start configuring it before they know what problems they are solving. The result is a technically correct installation with no adoption.

### First 30 days: understand before building

```
Week 1–2: Stakeholder interviews
  - Interview 5–8 stream-aligned teams
  - Question: what are the top 3 things that slow you down most?
  - Question: what do you do that you wish someone else handled?
  - Question: what have you built that you would rather not maintain?
  - Do NOT propose solutions in these interviews

Week 3–4: Audit current state
  - List all tools teams use to deploy, monitor, and secure services
  - Map the value stream: from code commit to production, what are all the steps and who owns each?
  - Identify the longest delays and the most manual steps
  - Count incidents that trace back to platform/infrastructure failures
```

### First 60 days: deliver one thing well

Pick the single highest-impact, lowest-complexity capability from the interview findings. Build it. Ship it. Measure adoption.

Do not build five things at once. A platform team that ships one excellent capability in 60 days builds more trust than a team that announces a grand vision and delivers nothing for 6 months.

Good candidates for first delivery:
- Standardized CI pipeline template that reduces per-team setup time from days to minutes
- Namespace provisioning via Backstage scaffolder (eliminates the most common ticket type)
- Shared observability onboarding (Prometheus + Grafana setup that teams can self-serve)

### First 90 days: measure and plan the roadmap

```
Month 3 deliverables:
[ ] One platform capability shipped and in use by 3+ teams
[ ] Platform team mission statement written and shared
[ ] Quarterly team health survey baseline established (SPACE metrics)
[ ] Platform roadmap published (6-month horizon) with team input
[ ] On-call rotation established for platform capabilities
[ ] Backstage instance running with catalog entries for all known services
[ ] Postmortem template and process defined
[ ] Platform SLOs defined (even if error budgets are not yet enforced)
```

### Avoid these first-90-day traps

| Trap | Why it happens | Prevention |
|---|---|---|
| Building a platform no one asked for | Starting with tools, not problems | Interviews before code |
| Promising too much too soon | Excitement + pressure to show value | Ship small, ship fast, measure |
| Creating a bottleneck immediately | Taking ownership of too many capabilities | Build self-serve from day one |
| Ignoring existing tools | "We know better than what they built" | Integrate before replacing |
| No feedback loop | Building in isolation | Office hours every 2 weeks from month 1 |
| Treating teams as passive consumers | "We know what they need" | Co-design every capability with a partner team |

### Platform team health metrics (track from day 1)

| Metric | Target (mature) | How to measure |
|---|---|---|
| Golden path adoption rate | > 80% of new services | Scaffolder usage / total new services |
| Ticket volume trend | Decreasing month-over-month | JIRA/Linear ticket count |
| Platform NPS (team survey) | > 30 | Quarterly survey |
| P50 ticket resolution time | < 2 days | Ticket system |
| Platform SLO compliance | > 99% per component | Prometheus + Grafana |
| Shadow IT discoveries | Decreasing | Quarterly CMDB audit |
| Team cognitive load (survey) | Decreasing | SPACE survey — Efficiency dimension |
