---
title: "Interview Questions"
sidebar_position: 4
---

# Platform Engineering — Interview Questions

These questions reflect what staff and senior engineers face in platform engineering interviews. For each, the answer demonstrates first-principles reasoning, tradeoff awareness, and operational experience — not just product name-dropping.

---

## Foundational Concepts

### 1. What is an Internal Developer Platform, and how does it differ from DevOps tooling?

An IDP is a self-service layer that abstracts infrastructure complexity from product teams. DevOps tooling (CI pipelines, deployment scripts) requires teams to understand and configure the tooling themselves. An IDP wraps that tooling in opinionated golden paths so teams consume capabilities without becoming infrastructure experts.

The difference: DevOps tooling gives teams the ingredients. An IDP gives teams the meal — pre-built, tested, and maintained by a platform team that treats internal developers as customers.

An IDP typically includes: service catalog, self-service provisioning, GitOps delivery, secret management, shared observability, policy enforcement, and cost visibility — all integrated.

---

### 2. What is the difference between a platform team and an enablement team?

Both are in the Team Topologies model, but they operate differently:

| Platform Team | Enabling Team |
|---|---|
| Permanent — provides durable self-service capabilities | Temporary — exists to help teams adopt a practice or tool |
| X-as-a-Service interaction mode | Collaboration or facilitating interaction mode |
| Goal: teams never need to ask for help | Goal: teams become self-sufficient, then enabling team moves on |
| Maintains a product (the platform) | Does not maintain a product |

A platform team builds Backstage and the golden paths. An enabling team might temporarily embed with a product team to help them migrate to the new platform, then move on.

---

### 3. How do you measure platform success?

Never measure platform success by platform uptime alone. Measure developer outcomes:

**Primary metrics:**
- DORA metrics org-wide (deployment frequency, lead time, change failure rate, MTTR) — improving DORA means the platform is enabling faster, safer delivery
- Time-to-first-deploy for a new service (target: < 1 business day)
- Platform support ticket volume per developer per month (should decrease over time)
- Developer NPS (quarterly survey)

**Secondary metrics:**
- Platform SLO compliance (is the platform itself reliable?)
- Golden path adoption rate (what % of services use the golden path vs rolling their own?)
- Template success rate in Backstage scaffolder

**Signal to watch:** if support ticket volume is not declining, the golden paths are not working — something is still confusing or broken in the self-service experience.

---

### 4. What are the tradeoffs of golden paths?

Golden paths reduce cognitive load and enforce standards, but they have real costs:

**Benefits:**
- Consistency — security, observability, and compliance baked in
- Speed — teams don't reinvent the wheel
- Leverage — a fix in the golden path benefits all teams
- Easier incident response — everyone uses the same patterns

**Costs:**
- Innovation friction — teams with legitimate non-standard needs are slowed down
- Maintenance burden — the platform team must maintain and evolve the paths
- "Golden cage" risk — paths that are too opinionated prevent teams from doing what they need
- Adoption requires trust — teams must believe the platform team will respond to their feedback

The right balance: make the golden path excellent for 80% of use cases, provide a documented off-ramp for the 20%, and make off-ramp teams responsible for their own maintenance.

---

### 5. Make vs buy for platform capabilities — how do you decide?

Framework:

1. **Is this a differentiator?** If the capability is not unique to your organization, buy or use open source.
2. **What is the total cost of ownership?** Build cost includes initial development plus ongoing maintenance, security patches, and evolution. Buy cost includes licensing, integration, and lock-in risk.
3. **Does a good-enough solution exist?** Backstage, ArgoCD, Vault, and ESO solve real problems. Building alternatives is usually not justified.
4. **What is the integration complexity?** Sometimes the integration work to make an off-the-shelf solution fit your environment costs more than building a targeted solution.

Typical decisions:
- Service catalog: Backstage (buy/open source) — do not build your own
- Secret management: Vault or cloud-native (AWS Secrets Manager + ESO) — do not build your own
- CI/CD: GitHub Actions, Jenkins — do not build your own
- Scaffolder templates: build your own on top of Backstage — this is where your org's opinions live
- Terraform modules: build your own — this is core platform IP

---

### 6. What are the biggest challenges in Backstage adoption?

Backstage is powerful but adoption is not automatic:

**Challenge 1: Catalog completeness.** Backstage is only valuable when the catalog is accurate. If teams don't register their services, or if registrations go stale, the catalog becomes untrustworthy. Solution: automated discovery (GitHub org scanning for `catalog-info.yaml`), enforcement that new services from the scaffolder are registered, and clear ownership policy.

**Challenge 2: Plugin maintenance.** Backstage requires engineering investment to build and maintain plugins. Organizations underestimate this. Solution: start with core plugins (catalog, scaffolder, TechDocs, Kubernetes) before building custom plugins.

**Challenge 3: Authentication and permissions.** Backstage's permission system is complex to configure correctly. Getting RBAC wrong means either too-open (anyone can trigger scaffolder templates for any team) or too-restrictive (developers can't find services they need to see).

**Challenge 4: SSO integration.** Most enterprise environments require Backstage to integrate with existing identity providers. This is non-trivial and often blocks adoption.

**Challenge 5: Cultural adoption.** Engineers must believe the catalog is worth maintaining. This requires platform team credibility and visible value (e.g., Grafana dashboards linked from catalog cards).

---

### 7. How do you handle teams that bypass the golden path?

First, understand why. Teams bypass golden paths for one of three reasons:

1. **The path doesn't support their legitimate need.** Solution: extend the golden path or provide a documented off-ramp.
2. **The path is too slow or painful.** Solution: improve the path. This is feedback, not rebellion.
3. **The team doesn't trust the platform.** Solution: reliability work, communication, and demonstrating that the platform team responds to feedback.

Do not use policy to block bypass without understanding the root cause. Blocking without understanding creates adversarial relationships and drives shadow IT.

For teams that successfully bypass: document what they built. If it's better than the golden path, absorb it into the golden path. Give the team credit.

---

### 8. How does a platform team avoid becoming a bottleneck?

The bottleneck pattern: every team needs something from the platform team, so the platform team becomes a queue.

Prevention strategies:

1. **Self-service first.** Every capability that can be self-served should be. A team should never need to file a ticket to get a namespace, a database, or a secret.

2. **Async communication.** Platform team handles requests via GitHub issues, not Slack DMs. This creates a public backlog, sets expectations, and doesn't interrupt flow.

3. **Office hours, not interruptions.** Scheduled time for platform questions keeps the platform team focused. Slack channels for self-service, office hours for complex design questions.

4. **Documentation and runbooks.** Most "platform team tickets" are questions that should be answered in documentation. Treat every recurring question as a documentation gap.

5. **X-as-a-Service interaction model.** The platform exposes stable APIs (Backstage templates, Terraform modules). Teams consume them without coordination.

---

### 9. How do you design SLOs for a platform team?

Platform SLOs should measure what developers experience, not internal health:

**Step 1: Identify the user journeys.** What do developers do with the platform?
- Deploy a service
- Create a new service
- Rotate a secret
- Investigate an incident

**Step 2: Define SLIs for each journey.**
- Deploy: fraction of ArgoCD sync operations that succeed within 5 minutes
- Create: fraction of scaffolder template runs that complete successfully
- Secrets: fraction of ESO secret refreshes that complete within 30 seconds
- Investigation: Backstage catalog API availability

**Step 3: Set targets based on consequence.**
- ArgoCD sync failures block deployments: 99.5% success rate
- Scaffolder runs are occasional but high-impact: 98% success rate
- Backstage catalog availability: 99.9% (teams check it constantly)

**Step 4: Error budget process.** When a platform component burns through error budget, freeze feature work and focus on reliability. Same as SRE error budget process.

---

### 10. What is a "thinnest viable platform" and why does it matter?

The thinnest viable platform is the minimal set of capabilities that meaningfully reduces cognitive load for product teams. It matters because:

1. **Over-built platforms don't get used.** A platform with 50 capabilities but poor documentation and reliability is worse than a platform with 5 excellent ones.

2. **Building too early creates waste.** Platform teams often build for hypothetical scale before teams need it. This is engineering time that could have improved existing capabilities.

3. **Feedback requires usage.** You learn what the platform needs to be by watching teams use it. A platform built in isolation will miss real pain points.

Starting thin also establishes the habit of shipping: the platform team ships a capability, gets feedback, improves it. This is the product discipline that distinguishes mature platform teams.

---

### 11. How do you approach non-standard infrastructure requests?

Non-standard requests are teams asking for something the golden path doesn't provide.

Triage framework:
1. **Is this a capability gap?** If multiple teams ask for the same thing, add it to the platform roadmap.
2. **Is this a one-off legitimate need?** Document an off-ramp: the team can do this themselves, but they own the maintenance.
3. **Is this a security or compliance concern?** Escalate to security. Some requests are denied regardless of business need.
4. **Is this a "nice to have" that adds complexity?** Decline graciously, explain the cost, offer alternatives.

Never silently reject. Explain the reasoning. If the team's need is valid and you can't serve it now, put it on the roadmap and tell them when.

---

### 12. What are the hardest multi-tenancy problems in Kubernetes?

1. **Noisy neighbor.** One team's pod consumes all node CPU. Solution: ResourceQuotas + LimitRanges + PriorityClasses.

2. **Cross-namespace secrets.** A team wants to read a secret from another namespace. Solution: External Secrets Operator with namespace-scoped ClusterSecretStore access, not direct cross-namespace secret access.

3. **Shared ingress controller.** One team's misconfigured Ingress can crash the shared NGINX controller. Solution: per-team IngressClass or separate ingress controllers with namespace isolation.

4. **Control plane saturation.** Too many CRDs, too many objects, etcd latency. Solution: cluster segmentation — compliance workloads on dedicated clusters, development workloads on shared clusters.

5. **RBAC complexity at scale.** 50 teams × 3 environments × multiple roles = hundreds of RoleBindings that are impossible to audit manually. Solution: GitOps-managed RBAC with automated audit checks.

---

### 13. How do you handle the platform team's relationship with the security team?

Platform and security teams have natural tension: platform teams optimize for developer speed; security teams optimize for risk reduction. The resolution: make security part of the golden path, not a gate at the end.

Practical patterns:
- Image scanning (Trivy) in CI — security checks happen before code merges, not after
- Admission policies (Kyverno/Gatekeeper) — security requirements enforced automatically, not by security review
- IRSA/Workload Identity — pods authenticate to cloud services without stored credentials
- Secret management — ESO + Vault, no secrets in environment variables or Git
- Vulnerability response SLA in platform SLOs — the platform team commits to patching base images within N days of a critical CVE

When security requirements change, the platform team updates the golden path — all teams benefit immediately without per-team work.

---

### 14. What does a mature platform team look like organizationally?

Roles on a mature platform team:

| Role | Responsibility |
|---|---|
| Platform engineers | Build and operate platform capabilities |
| Platform product manager | Owns roadmap, prioritization, developer interviews |
| Developer advocate / DX engineer | Advocates for developers within the platform team, writes documentation, runs onboarding |
| Platform SRE | Owns platform SLOs, incident response for platform components |

Without a product manager, the platform gets built for engineers, not developers. Without a DX role, golden paths have poor documentation and low adoption. Without an SRE function, platform reliability is reactive.

---

### 15. How do you evolve a golden path without breaking teams that depend on it?

Golden path evolution follows a software product lifecycle:

1. **Versioned templates.** Backstage scaffolder templates are versioned. New templates don't break existing services.
2. **Migration windows.** When a golden path changes significantly, provide a migration guide and a deprecation date (minimum 6 months).
3. **Automation for migrations.** Write scripts that migrate existing services to the new path where possible.
4. **Compatibility testing.** Before releasing a new version, test it against a sample of existing services.
5. **Communicate clearly.** Announce changes on the platform changelog, in developer newsletters, and in office hours.

Treat breaking changes to a golden path the same way a library treats breaking API changes: semantic versioning, deprecation warnings, and migration support.

---

### 16. What is "platform engineering" vs "infrastructure engineering"?

Infrastructure engineering builds and operates the underlying systems: clusters, networks, databases, storage. Platform engineering builds the developer experience layer on top of infrastructure.

Infrastructure asks: "Is the cluster healthy?"
Platform engineering asks: "Can developers self-serve on the cluster without understanding how it works?"

In many organizations these overlap — platform engineers do both. The distinction matters for focus: platform engineers should spend most of their time on the developer-facing layer, not on operational toil for the underlying infrastructure.

---

### 17. How do you get buy-in for platform investment from leadership?

Frame platform investment in terms of business outcomes, not technical capabilities:

- "Our current onboarding time for a new service is 3 days. We can reduce this to 4 hours with the scaffolder template. At 20 new services per quarter, that's 50+ engineering days saved."
- "Shadow IT is increasing. Teams are spinning up their own AWS accounts because the platform is too slow. This creates security risk and compliance gaps."
- "Change failure rate is 15% (DORA low performer). Platform-enforced testing and rollback capabilities will move us toward < 5% (DORA elite)."

DORA metrics are the most compelling framing for leadership: they directly correlate with business agility and competitive advantage.

---

### 18. What's the difference between Flux and ArgoCD?

Both are GitOps-native continuous delivery tools, but with different philosophies:

| | ArgoCD | Flux |
|---|---|---|
| UI | Rich dashboard | Minimal (CLI-first) |
| Onboarding | Easier — UI-driven setup | Steeper — more CLI and YAML |
| Multi-cluster | ApplicationSets, powerful fleet management | Strong native multi-cluster support |
| GitOps purity | Good | Stronger — everything through Git |
| Extensibility | Plugin model for UI | Controller composition model |
| Multi-tenancy | Good with projects and RBAC | Requires more manual RBAC setup |

Choose ArgoCD when developer usability and a rich UI are important. Choose Flux when GitOps purity and composable controllers are priorities. Both are production-ready CNCF graduated projects.

---

### 19. How do you prevent the "golden cage" anti-pattern?

The golden cage is when golden paths become so opinionated that teams feel trapped — they can't do legitimate things without fighting the platform.

Prevention:
1. **Regular user research.** Talk to teams. Watch them work. Find where they fight the path.
2. **Off-ramp documentation.** Every golden path has a documented "advanced" escape hatch.
3. **Feedback loops.** Platform team reviews all off-path patterns. Some become features; all become data.
4. **Version and evolve.** Golden paths must evolve as practices evolve. A golden path from 3 years ago is often a golden cage.
5. **Team ownership.** Teams own their services. The platform provides defaults; teams can override them (with documented consequences).

---

### 20. What operational signals indicate a platform team is succeeding?

Positive signals:
- Platform support ticket volume is declining quarter-over-quarter
- Teams are creating new services via the scaffolder (adoption rate increasing)
- DORA metrics across the org are trending toward elite
- Developer NPS is improving
- Platform SLOs are being met consistently
- Shadow IT instances are being decommissioned (teams migrating back to the platform)

Warning signals:
- Teams routinely bypass golden paths
- Platform team is always "too busy" (bottleneck)
- Developers don't know what the platform offers
- Platform SLOs are consistently missed
- The platform team hasn't shipped a user-visible improvement in 60+ days
