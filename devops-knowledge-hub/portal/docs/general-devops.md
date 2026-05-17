---
title: "🚀 General DevOps"
sidebar_position: 19
description: "Zero to hero study guide for General DevOps — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## 🎯 Why This Domain Matters

DevOps is not a job title, a tool, or a team — it's a set of practices that enable organizations to deliver value to customers faster and more reliably. For a Staff/Principal engineer, DevOps mastery means understanding how to improve the entire software delivery system, not just your own component. It requires influencing without authority, measuring what matters, and designing systems that make the right thing easy.

---

## 📋 Prerequisites & Mental Models

**DORA (DevOps Research and Assessment) metrics** — the four validated measures of software delivery performance:
- **Deployment Frequency** — how often you deploy to production
- **Lead Time for Changes** — time from code commit to production
- **Change Failure Rate** — percentage of deployments that cause incidents
- **Mean Time to Restore (MTTR)** — how long to recover from incidents

Elite performers: deploy multiple times per day, <1 hour lead time, <5% change failure rate, <1 hour MTTR. These correlate directly with organizational performance (profitability, market share, employee satisfaction).

**Team Topologies** — four team types: Stream-aligned (builds value), Platform (provides capabilities), Enabling (helps other teams), Complicated Subsystem (specialized deep expertise). Three interaction modes: Collaboration (close), X-as-a-Service (platform relationship), Facilitating (temporary upskilling).

**Conway's Law** — systems reflect the communication structure of the organizations that build them. Fix the org structure, the technical architecture follows. Inverse Conway Maneuver: design the org you want, then the system will follow.

---

## 🔷 Core Concepts

### DevOps Culture & Principles

**The Three Ways (Phoenix Project):**
1. **Systems Thinking** — optimize for the whole, not local optimizations; understand the entire value stream from business to customer
2. **Amplify Feedback Loops** — build feedback mechanisms (tests, monitoring, customer data) to learn quickly; shorten the loop from action to consequence
3. **Culture of Continual Experimentation and Learning** — blameless post-mortems, make it safe to fail small and learn fast

**Toil elimination** — toil is manual, repetitive, tactical work that scales linearly with service growth. SREs should spend <50% of time on toil. Identify toil: track time spent on manual tasks, automate the top sources, measure reduction. Toil that isn't eliminated grows to consume all available time.

**Blameless post-mortems:**
- Focus on system failures, not human failures
- Timeline reconstruction, not blame assignment
- Action items that prevent recurrence (process, tooling, monitoring)
- Share findings widely — learning should spread across the org

**Psychological safety** — teams that can speak up about problems, admit mistakes, and propose changes without fear deliver better outcomes. Staff engineers model this behavior: publicly acknowledge mistakes, celebrate near-misses, and make it easy to raise concerns.

### Version Control Best Practices

**Git workflows:**

**Trunk-based development (recommended):** everyone commits to main frequently. Feature flags hide unfinished work. Short-lived feature branches (<24h). Benefits: no integration hell, continuous integration is real.

**GitFlow (for release-versioned software):** main + develop + feature branches + release branches + hotfix branches. Complex, but appropriate for versioned products that need to maintain multiple release lines.

**Commit message conventions (Conventional Commits):**
```
feat: add Kafka consumer for order events
fix: prevent race condition in session store
docs: update deployment runbook for new region
chore: bump Go version to 1.22
perf: reduce database round trips in checkout flow
```

Benefits: automated changelog generation, semantic versioning automation, better git history.

**Branch protection rules:**
- Require PR reviews (2 reviewers for production code)
- Require status checks to pass (CI must be green)
- Require branches to be up to date before merge
- Block force pushes to main/release branches

### Docker & Containerization

**Dockerfile best practices:**
```dockerfile
# 1. Use specific base image digest
FROM python:3.12-slim@sha256:abc123...

# 2. Create non-root user early
RUN groupadd -r app && useradd -r -g app app

# 3. Install dependencies before copying source (better layer caching)
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy source
COPY --chown=app:app . .

# 5. Switch to non-root user
USER app

# 6. Use exec form (not shell form) for CMD/ENTRYPOINT
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Multi-stage build:**
```dockerfile
# Stage 1: Build
FROM golang:1.22 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/server ./cmd/server

# Stage 2: Minimal runtime
FROM scratch
COPY --from=builder /bin/server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["/server"]
```

Result: final image is only the binary (~5-15MB vs ~800MB Go builder image).

**Docker Compose for local development:**
```yaml
version: '3.8'
services:
  api:
    build: .
    ports: ["8080:8080"]
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/myapp
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - .:/app  # for hot reload in development
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: myapp
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "user"]
      interval: 5s
```

### SRE Practices

**SLI → SLO → SLA chain:**
- SLI: the measurement (e.g., "fraction of requests completing in <200ms")
- SLO: the target (e.g., "99.5% of requests complete in <200ms over 30 days")
- SLA: contractual commitment with consequences (typically 1-2% below SLO)

**Error budget calculation:**
- 99.9% SLO = 0.1% error budget = 43.2 minutes/month of allowed downtime
- 99.99% = 0.01% = 4.32 minutes/month
- Error budget burn rate: 1x = burning at sustainable rate; 14x = will exhaust in 2.1 days

**Incident management:**

Level 1 (P1): production outage, data loss risk, security breach → page immediately
Level 2 (P2): significant degradation, partial outage → respond within 15 min
Level 3 (P3): minor issues, non-critical alerts → business hours response
Level 4 (P4): tickets, improvements → backlog

**Incident Commander role:** one person coordinates the response. Others gather data, implement fixes, handle comms. IC avoids doing technical work — they coordinate.

**Runbooks:** document the expected response for every alert. Format:
```markdown
## Alert: HighErrorRate
**What it means:** >1% of requests returning 5xx
**Immediate check:** kubectl get pods -n prod (any CrashLoopBackOff?)
**Steps:**
1. Check recent deployments: kubectl rollout history deployment/api
2. If bad deploy: kubectl rollout undo deployment/api
3. Check DB: psql -c "SELECT count(*) FROM pg_stat_activity WHERE state='idle in transaction'"
**Escalation:** If not resolved in 30 minutes, page @backend-lead
```

### Agile & DevOps Intersection

**Continuous Integration** — every developer integrates to main at least daily. Every integration is verified by automated build and test. Goal: find integration bugs early and cheaply.

**Continuous Delivery** — every successful CI build can be deployed to production at any time. Deployment requires human approval (for regulated environments) or is automatic (true CD).

**Continuous Deployment** — every successful CI build is automatically deployed to production. No human gate. Requires high test coverage and confidence in rollback.

**Sprint planning for reliability work:**
- Budget 20-30% of sprint capacity for reliability and toil reduction
- Treat reliability work as product features — user stories, acceptance criteria, definition of done
- Track tech debt explicitly — debt that isn't tracked doesn't get repaid

### DevOps Toolchain

**Source:** Git (GitHub, GitLab, Bitbucket, Azure Repos)
**CI/CD:** Jenkins, GitHub Actions, Azure DevOps, GitLab CI, CircleCI, Tekton
**Artifact:** Docker Registry (ECR, GCR, ACR, Harbor), Nexus, npm, PyPI
**Configuration:** Ansible, Chef, Puppet
**IaC:** Terraform, Pulumi, AWS CDK
**Container orchestration:** Kubernetes, ECS
**Monitoring:** Prometheus, Grafana, Datadog, New Relic
**Logging:** ELK Stack, Loki, Splunk
**Incident management:** PagerDuty, Opsgenie, VictorOps
**Communication:** Slack, Teams, Zoom

---

## 🛠️ Tools & Projects

### Common DevOps Project Architectures

**Microservices on Kubernetes:**
```
GitHub → GitHub Actions CI → ECR (images) → ArgoCD → EKS
                                           → Staging (auto-deploy)
                                           → Production (manual approve)
Prometheus → Grafana (dashboards)
CloudWatch → PagerDuty (alerts)
```

**Serverless event-driven:**
```
API Gateway → Lambda → DynamoDB
EventBridge (scheduled events) → Lambda (batch jobs)
SQS → Lambda (queue processing)
S3 events → Lambda (file processing)
```

**Monolith to microservices migration:**
Start with the strangler fig pattern: route specific capabilities from the monolith to new services one at a time. The monolith shrinks as services grow. Never "rewrite everything at once."

---

## 🏗️ Architecture Patterns

### Platform Engineering Model

**Internal Developer Platform (IDP):** self-service infrastructure for developers. Core capabilities:
- **Golden paths:** opinionated templates for new services (scaffold new service in 5 minutes with CI/CD, monitoring, and secrets management preconfigured)
- **Self-service environments:** developers provision dev/feature environments without tickets
- **Paved roads:** the easy thing is the right thing (pre-configured security, observability)
- **Backstage:** service catalog + plugin ecosystem for IDP UI

Platform team as product team: developers are the customers, platform capabilities are the product, developer experience is the success metric.

### GitOps Repository Patterns

**App of Apps (ArgoCD):** one ArgoCD Application manages multiple ArgoCD Applications. Useful for managing 50+ microservices.

**Kustomize overlay pattern:**
```
base/
  deployment.yaml      # base config, environment-agnostic
  service.yaml
  kustomization.yaml

overlays/
  staging/
    kustomization.yaml  # patches: different replicas, resources
    config-patch.yaml
  production/
    kustomization.yaml  # patches: prod replicas, resources, node affinity
    config-patch.yaml
```

### Feature Flags

Separate deployment from release. Deploy code behind a flag (off). Turn on the flag to release (with the ability to instantly turn it off). Tools: LaunchDarkly, Flagsmith, Unleash, AWS AppConfig.

Use for:
- Gradual rollout (turn on for 1% → 10% → 100% of users)
- A/B testing (split traffic between variants)
- Kill switches (instantly disable a broken feature without deployment)
- Trunk-based development (hide work-in-progress features)

---

## ⚙️ Production Operations

### Change Management

**Pre-production checklist:**
- [ ] Change reviewed by 2+ engineers
- [ ] Rollback procedure documented and tested
- [ ] Monitoring and alerting in place
- [ ] Load test if significant traffic change expected
- [ ] Stakeholders notified (if user-visible change)
- [ ] Maintenance window scheduled if downtime expected

**Deployment windows:** high-traffic prod → avoid peak hours. Business-critical → agree with product team. Always have rollback ready before deploying.

### On-Call Best Practices

**Rotations:** weekly or biweekly. Fair distribution. Primary + secondary coverage. Mandatory handoff notes.

**On-call compensation:** additional pay or time off. Not tracking on-call burden = burning out engineers.

**Reducing on-call burden:** automate runbooks → auto-remediation, fix alert fatigue (>10 alerts/shift is too many), eliminate flaky alerts, track and reduce MTTD.

**Alert ownership:** every alert must have an owner (team), a runbook, and a review date. Alerts without owners get silenced.

---

## 📊 Observability & Debugging

### DORA Metrics Measurement

```python
# Deployment frequency: from deployment logs
deployments_this_week = count(deployments WHERE env='production' AND date > now-7d)

# Lead time: from commit timestamp to deployment timestamp
lead_time = deploy_time - commit_time

# Change failure rate:
failed_deployments / total_deployments  # over rolling 30 days

# MTTR: from incident created to resolved
mean(incident.resolved_at - incident.created_at)
```

Tools: LinearB, Jellyfish, Faros, or build your own from GitHub API + deployment system.

---

## 🔐 Security Considerations

**DevSecOps integration points:**
- Pre-commit: secret scanning (gitleaks), linting
- PR: SAST (Semgrep/SonarQube), dependency check (Snyk)
- Build: container scan (Trivy), image signing (Cosign)
- Deploy: policy check (Kyverno/OPA), environment validation
- Runtime: behavior monitoring (Falco), threat detection (GuardDuty)

**Separation of duties:** the person who writes code should not be the only person who approves and deploys it. PRs require reviewers. Production deployments require approval from another team member.

---

## 🎓 Staff/Principal Engineer Perspective

### Influencing Without Authority

Staff engineers often lead cross-team initiatives without formal authority. Effective patterns:
- **Write RFCs (Request for Comments):** document proposals, gather feedback, build consensus
- **Demonstrate with prototypes:** show don't tell — working demo beats architecture diagram
- **Align with business goals:** frame technical improvements in terms of DORA metrics, incident reduction, or cost savings
- **Build relationships first:** technical influence is built on trust, which requires relationships
- **Make the right thing easy:** create golden paths and templates that make best practices the default

### Technical Debt Management

Not all technical debt is equal. Categorize:
- **Intentional, time-limited:** "we'll use a monorepo until we hit scale bottlenecks" — tracked, scheduled for revisit
- **Unintentional:** discovered during work — file immediately as tech debt tickets with impact assessment
- **Reckless:** "we didn't have time for tests" — requires retrospective and process change

Track tech debt with explicit tickets. Sprint 20% on debt repayment. Show correlation between debt reduction and incident reduction to justify investment.

### Career Growth in DevOps

**Senior → Staff transition:** move from "excellent individual contributor" to "multiplier." Scope shifts from component to system. Success measured by team/org improvement, not personal output.

**Key Staff skills:**
- Design reviews that prevent future incidents
- Architectural decision records (ADRs) that document rationale
- Mentoring that raises the engineering floor
- Incident response that generates systemic improvements

---

## 💥 Failure Modes & Incident Patterns

**Configuration drift:** manual changes to production accumulate. Scheduled `terraform plan` detects drift. GitOps self-healing remediates it. Audit trails show what changed and when.

**Alert fatigue → missed P1:** too many non-actionable alerts → engineers stop paying attention → real incident missed. Monthly alert audit: tune or remove any alert that fired >3x in the past month without requiring action.

**Deployment freezes from lack of confidence:** teams afraid to deploy because they don't know what will happen. Fix: improve test coverage, implement canary deployments, improve observability so teams can see the effect of their changes.

**Knowledge silos → bus factor 1:** only one person knows how to deploy service X. Runbooks, pair deployments, cross-training, and rotation reduce this.

---

## 💼 Interview & Design Review Prep

**"How do you improve a team's deployment frequency from weekly to daily?"**
Decompose: what blocks daily deployments? Feature completeness (feature flags), test confidence (more coverage, shorter suite), deployment risk (canary rollout), approval bottlenecks (automated checks replace manual). Attack the constraint, measure the improvement.

**"Tell me about a significant incident and what you changed afterward"**
Blameless post-mortem format: timeline, contributing factors (not root cause — there are always multiple), five action items (monitoring, process, code), follow-up review 30 days later to check completion. What systemic change prevented recurrence?

**"How do you balance reliability work with feature development?"**
Error budget policy: when error budget is healthy, features take priority. When budget is depleted, reliability takes priority. This removes the tension — the budget makes the decision automatically.

---

## 📚 Key Takeaways

1. **DORA metrics are your north star** — measure deployment frequency, lead time, change failure rate, MTTR consistently
2. **Toil is a technical debt that accrues interest** — every manual task you don't automate gets more expensive each time
3. **Blameless culture is a prerequisite for learning** — blame-focused post-mortems produce defensive behavior, not systemic fixes
4. **Feature flags separate deployment from release** — deploy safely, release gradually, kill switches eliminate rollback delay
5. **Conway's Law is real** — architecture follows org structure; fix the org to fix the architecture
6. **Platform teams exist to multiply developer velocity** — measure success by developer experience, not platform features
7. **Error budget policy aligns product and engineering** — removes the "reliability vs features" political argument
8. **Runbooks must be tested** — untested runbooks fail when needed; quarterly game days validate them
9. **Psychological safety drives better outcomes** — create it by modeling vulnerability and rewarding candor
10. **Tech debt must be tracked explicitly** — untracked debt doesn't get repaid; it just slows everything down
11. **DORA shows elite is achievable** — multiple deploys/day, <1h lead time is not theoretical; it's what elite teams do
12. **GitOps for infrastructure** — same review/approval/audit as code; no manual console changes in production
13. **Golden paths are better than mandates** — make the right thing easy, don't just prohibit the wrong thing
14. **Incidents are learning opportunities** — the org that learns fastest from incidents outpaces the org that has none
15. **Staff impact is measured in team outcomes** — your success is their success; optimize for multiplying others



---
