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

## 📁 Source Documents

> 56 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[Kubernetes] 1741086805451](http://localhost:8765/api/documents/f217548f-2688-486b-ba63-17c67968dbdd/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1739350186567](http://localhost:8765/api/documents/9e2377fc-1bdf-43d5-81c5-7ae407558a4c/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1740038451939](http://localhost:8765/api/documents/4070e0f6-9123-4253-a78a-ae59b71daa6a/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1741057376527](http://localhost:8765/api/documents/f171ab3d-67cf-473a-9209-cdfd2b773bad/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1741158897242](http://localhost:8765/api/documents/0b96803b-b742-452f-b42f-5e5478c4f007/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1741289776765](http://localhost:8765/api/documents/eea43ff5-4aeb-4718-af8a-3da74746a4d5/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1741690657142](http://localhost:8765/api/documents/7beb91e7-529d-4483-b21d-2f8e235f55b8/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1742792006184](http://localhost:8765/api/documents/15c7de75-b84c-498f-9184-bc6dc560df47/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1742908693407](http://localhost:8765/api/documents/3434cf09-06e2-4bcc-a00a-011a799cb3c0/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1743480014957](http://localhost:8765/api/documents/c545703d-0988-4b1b-8500-6dcfa5b8a20f/view) | PDF | intermediate |
| [[Interview Ouestions > Devops] 1744087241476](http://localhost:8765/api/documents/de1827f4-4d38-45d2-a095-ec2b250a7a01/view) | PDF | intermediate |
| [[DevOps Project] 1737207662757](http://localhost:8765/api/documents/662d5092-18ce-4e74-a4a8-cfb4608f8110/view) | PDF | intermediate |
| [[DevOps Project] 1738955159666](http://localhost:8765/api/documents/390eab01-cde0-45bf-abe5-30d75548a680/view) | PDF | intermediate |
| [[DevOps Project] 1740654019583](http://localhost:8765/api/documents/fd9df949-acb0-4fff-95b3-0bf374a48a53/view) | PDF | intermediate |
| [[DevOps Project] 1740729611936](http://localhost:8765/api/documents/1f7c5e60-6e5a-4546-b2f8-dc7152d78e9c/view) | PDF | intermediate |
| [[DevOps Project] 1741098367133](http://localhost:8765/api/documents/c1d2139f-317e-477e-91d5-5c255206df0c/view) | PDF | intermediate |
| [[DevOps Project] 1741369679997](http://localhost:8765/api/documents/05ed8bde-59f1-4142-b368-0349cc406ba9/view) | PDF | intermediate |
| [[DevOps Project] 1741635839744](http://localhost:8765/api/documents/3aca18da-59e2-4624-b787-77340c37c6ab/view) | PDF | intermediate |
| [[DevOps Project] 1741756911094](http://localhost:8765/api/documents/69bb4ab5-36a0-4a73-adc8-1733453b7e87/view) | PDF | intermediate |
| [[DevOps Project] 1741790293486](http://localhost:8765/api/documents/95536531-1826-47d1-a4d4-9bdeda063434/view) | PDF | intermediate |
| [[DevOps Project] 1742311863484](http://localhost:8765/api/documents/709c45af-bbae-4055-b8d5-f62752335eef/view) | PDF | intermediate |
| [[DevOps Project] 1742966572145](http://localhost:8765/api/documents/c9c2b99c-8418-483b-88f9-a9fc1a654e57/view) | PDF | intermediate |
| [[DevOps Project] 1743266590512](http://localhost:8765/api/documents/c58117a6-57cd-43d4-86d1-3f107023b27e/view) | PDF | intermediate |
| [[DevOps Project] 1743334831320](http://localhost:8765/api/documents/9a0a0e93-65a5-427f-a546-259060a656c9/view) | PDF | intermediate |
| [[DevOps Project] 1743766195959](http://localhost:8765/api/documents/3a6f7841-7006-406e-b8e6-9674045cdaf7/view) | PDF | intermediate |
| [[Devops Basics] 1736914849295](http://localhost:8765/api/documents/5a76b696-1004-4d5f-8940-c44230532228/view) | JPG | intermediate |
| [[Devops Basics] 1737370337903](http://localhost:8765/api/documents/bc3c152b-588e-4065-a960-7407da1ce665/view) | PDF | intermediate |
| [[Devops Basics] 1738331990586](http://localhost:8765/api/documents/22e16ef8-fe08-4b6e-9d87-ed5897dbfec8/view) | JPG | intermediate |
| [[Devops Basics] 1739335485797](http://localhost:8765/api/documents/ee212ccf-fc6f-440e-9096-d6123feea37f/view) | PDF | intermediate |
| [[Devops Basics] 1740449948723](http://localhost:8765/api/documents/983f349d-e36c-4662-b661-8b33d305a784/view) | JPG | intermediate |
| [[Devops Basics] 1741064431881](http://localhost:8765/api/documents/5de999d0-64d6-4587-9d25-a9fb2ef59583/view) | PDF | intermediate |
| [[Devops Basics] 1741097780729](http://localhost:8765/api/documents/0cce284e-4841-4491-82e7-c6a2f51ca0df/view) | PDF | intermediate |
| [[Devops Basics] 1741145965555](http://localhost:8765/api/documents/bdb3f356-ec5c-48f4-9755-1884e6808307/view) | PDF | intermediate |
| [[Devops Basics] 1741161356897](http://localhost:8765/api/documents/b75a2293-9be5-43d1-ba06-e21456797b15/view) | PDF | intermediate |
| [[Devops Basics] 1741237198047](http://localhost:8765/api/documents/582f3497-1d4b-4939-8228-c8c11741c67b/view) | PDF | intermediate |
| [[Devops Basics] 1741340858440](http://localhost:8765/api/documents/07d7e349-fd15-49d0-9c7d-707e1344a201/view) | PDF | intermediate |
| [[Devops Basics] 1741345339087](http://localhost:8765/api/documents/32d051a4-3fed-43d5-9b9f-38329723200e/view) | PDF | intermediate |
| [[Devops Basics] 1741712739616](http://localhost:8765/api/documents/225b4056-aa56-46fa-b5e7-ce6b66523e04/view) | PDF | intermediate |
| [[Devops Basics] 1741842043430](http://localhost:8765/api/documents/0353c415-c220-49ef-ad7d-59c11ff83497/view) | PDF | intermediate |
| [[Devops Basics] 1742121097608](http://localhost:8765/api/documents/d141526b-e364-426d-9c89-c7cf87757102/view) | JPG | intermediate |
| [[Devops Basics] 1742212225327](http://localhost:8765/api/documents/eeb4c1b5-13f0-4c18-a171-4988e33c779b/view) | PDF | intermediate |
| [[Devops Basics] 1742385077227](http://localhost:8765/api/documents/80750ca5-0696-474b-9be3-b8d2a5708745/view) | PDF | intermediate |
| [[Devops Basics] 1742987096763](http://localhost:8765/api/documents/e502add0-b5f0-49b6-8cf3-a00e7ba586a6/view) | PDF | intermediate |
| [[Devops Basics] 1743017528482](http://localhost:8765/api/documents/7369639c-c231-4d6b-b8ce-70d6b5480b4a/view) | PDF | intermediate |
| [[Devops Basics] 1743136473717](http://localhost:8765/api/documents/50f1f332-fc1b-44d4-a063-ec8ae82749d7/view) | PDF | intermediate |
| [[Devops Basics] 1743212462526](http://localhost:8765/api/documents/4614cfb9-6798-49cf-974a-0a12ad8ffe2f/view) | PDF | intermediate |
| [[Devops Basics] 1743354678448](http://localhost:8765/api/documents/f09d6758-657a-433d-9f6e-5cfab889c7b1/view) | PDF | intermediate |
| [[Devops Basics] 1743491078937](http://localhost:8765/api/documents/432d457b-ebf8-434b-a044-e1b82456c662/view) | PDF | intermediate |
| [[Devops Basics] 1743572145128](http://localhost:8765/api/documents/acb00d11-1f59-4306-9880-64be3bd4cb59/view) | PDF | intermediate |
| [[Devops Basics] 1743733196853](http://localhost:8765/api/documents/69b66cd2-8b6c-4d5f-931a-991ac6ebd0b2/view) | PDF | intermediate |
| [[Devops Basics] 1743820734698](http://localhost:8765/api/documents/5c34dcd6-8e52-4cd0-9f57-8d80eea30c22/view) | PDF | intermediate |
| [[Devops Basics] 1743972148538](http://localhost:8765/api/documents/061deb0e-e494-4452-883f-b9839b25a5d4/view) | PDF | intermediate |
| [[Devops Basics] 1744281264972](http://localhost:8765/api/documents/3f51c742-309e-44fc-a0f9-bc7fe8c28ae3/view) | PDF | intermediate |
| [[Devops Basics] 1744792519484](http://localhost:8765/api/documents/81c2fcc1-4a06-4732-8445-c997833ffeb9/view) | PDF | intermediate |
| [[General Topics] 1737442589895](http://localhost:8765/api/documents/19a6699a-a598-49f6-a7d4-62b2f1954221/view) | JPG | intermediate |
| [[General Topics] 1738956549511](http://localhost:8765/api/documents/efc91eaf-5e71-4dbd-8950-ca44516c6ed0/view) | JPG | intermediate |


<AIChatWidget domain="general-devops" title="Ask AI about General DevOps" />

---

## [SRE] End-to-End Platform Engineering Patterns

## End-to-End Platform Engineering Patterns

### What It Is and Why It Matters

Most platform engineering knowledge is taught tool by tool: Kubernetes here, Terraform there, Prometheus separately. In production, none of these tools operate in isolation. A real platform is a composition — Terraform provisions the cluster, Kubernetes runs the workloads, GitHub Actions pushes the images, ArgoCD deploys the manifests, Prometheus watches the metrics, and PagerDuty wakes you up at 3am when something breaks.

This guide walks through how those pieces connect. It covers three reference architectures: a web application platform, a data pipeline platform, and a machine learning inference platform. For each, it shows how the layers of infrastructure, deployment, observability, and security fit together — and where the common failure points are.

Understanding end-to-end composition matters because: you will be asked to design systems, debug cross-layer failures, and explain why specific choices were made. Being able to trace a request from DNS to database — or explain why a deployment failed at the ArgoCD sync rather than at the CI scan — is what separates a platform engineer from someone who knows individual tools.

---

### Mental Model: The Platform Stack

A production platform has five layers. Every tool you know lives in one of them:

```
┌─────────────────────────────────────────────────────┐
│ Layer 5: Observability                               │
│   Prometheus · Grafana · AlertManager · Loki        │
├─────────────────────────────────────────────────────┤
│ Layer 4: Application Delivery                        │
│   ArgoCD · Helm · Kustomize · Argo Rollouts         │
├─────────────────────────────────────────────────────┤
│ Layer 3: Build and Supply Chain                      │
│   GitHub Actions · Jenkins · Trivy · SonarQube      │
│   Cosign · SLSA                                     │
├─────────────────────────────────────────────────────┤
│ Layer 2: Compute and Orchestration                   │
│   Kubernetes (EKS/AKS/GKE) · Docker · containerd   │
├─────────────────────────────────────────────────────┤
│ Layer 1: Infrastructure                              │
│   Terraform · AWS/Azure/GCP · VPC · IAM · DNS      │
└─────────────────────────────────────────────────────┘
```

Changes flow downward: infrastructure changes require cluster changes; cluster changes affect deployment; deployment changes affect what observability sees. Failures often propagate upward: infrastructure misconfiguration causes deployment failures, which cause observability alerts.

The key insight: **understand each layer's contract with the layers above and below**. Terraform's output is the cluster endpoint. The cluster's contract with the deployment layer is the Kubernetes API. The deployment layer's contract with observability is the metrics endpoint. Breaking a layer's contract cascades.

---

### Reference Architecture 1: Web Application Platform

#### Architecture Overview

```
Internet → Route 53 → ALB (AWS) → NGINX Ingress → Service → Pod
                                      ↑
                             TLS terminated at ALB
                             or at NGINX with cert-manager

Infrastructure:
  Terraform → VPC (3 AZ) → EKS cluster → node groups
            → RDS (Multi-AZ) → ElastiCache → S3 buckets
            → ACM certificate → Route 53 record

CI/CD:
  Developer push → GitHub Actions (build, test, scan, push to ECR)
                → ArgoCD (watches ECR tag → deploys to EKS)

Observability:
  Prometheus → scrapes pods, nodes, NGINX, RDS exporter
  Alertmanager → PagerDuty for P1/P2, Slack for P3
  Grafana → dashboards for SLO, infra, application
  Loki → log aggregation from all pods
```

#### Terraform Layer

```hcl
# modules/eks-cluster/main.tf
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = false    # no public API endpoint in production
    security_group_ids      = [aws_security_group.cluster.id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "main"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 3
  }

  instance_types = ["m5.xlarge"]

  lifecycle {
    ignore_changes = [scaling_config[0].desired_size]   # let cluster autoscaler manage
  }
}

# IRSA for pods that need AWS access
resource "aws_iam_role" "app" {
  name = "${var.cluster_name}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub" = "system:serviceaccount:production:myapp"
        }
      }
    }]
  })
}
```

State organization — split by lifecycle:

```
terraform/
├── 00-bootstrap/        # S3 backend, DynamoDB, IAM for Terraform runner
├── 10-networking/       # VPC, subnets, NAT, TGW attachments
├── 20-security/         # KMS keys, security groups, IAM roles
├── 30-kubernetes/       # EKS cluster, node groups, IRSA roles
├── 40-databases/        # RDS, ElastiCache, parameter groups
└── 50-applications/     # ACM, Route 53, ALB, ECR repos
```

Each layer has its own `terraform.tfstate` in S3. Lower layers export values to SSM Parameter Store; upper layers read from SSM. This prevents a broken application layer from corrupting network state.

#### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  ECR_REGISTRY: 123456789.dkr.ecr.us-east-1.amazonaws.com
  IMAGE_NAME: myapp

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run unit tests
        run: |
          python -m pytest tests/unit/ --cov=src --cov-report=xml

      - name: SonarQube scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

      - name: Quality gate check
        uses: SonarSource/sonarqube-quality-gate-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC — no long-lived secrets)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-ecr
          aws-region: us-east-1

      - name: Build image
        run: |
          IMAGE_TAG="${{ github.sha }}"
          docker build -t ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} .
          docker tag ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} \
                     ${ECR_REGISTRY}/${IMAGE_NAME}:latest

      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          exit-code: 1
          severity: CRITICAL

      - name: Sign image (Cosign)
        run: |
          cosign sign --key awskms:///alias/cosign-key \
            ${ECR_REGISTRY}/${IMAGE_NAME}:${{ github.sha }}

      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS \
            --password-stdin ${ECR_REGISTRY}
          docker push ${ECR_REGISTRY}/${IMAGE_NAME}:${{ github.sha }}
          docker push ${ECR_REGISTRY}/${IMAGE_NAME}:latest

      - name: Update Kubernetes manifest
        run: |
          # Update the image tag in the GitOps repo
          git clone https://x-access-token:${{ secrets.GITOPS_TOKEN }}@github.com/org/k8s-manifests
          cd k8s-manifests
          yq -i ".spec.template.spec.containers[0].image = \"${ECR_REGISTRY}/${IMAGE_NAME}:${{ github.sha }}\"" \
            apps/myapp/deployment.yaml
          git config user.email "ci@company.com"
          git config user.name "CI Bot"
          git commit -am "ci: update myapp to ${{ github.sha }}"
          git push
```

ArgoCD then detects the manifest change and syncs automatically.

#### Kubernetes Manifests

```yaml
# apps/myapp/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: myapp    # IRSA-annotated service account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      terminationGracePeriodSeconds: 60

      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: myapp

      containers:
        - name: myapp
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:abc123
          ports:
            - containerPort: 8080

          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "1000m"
              memory: "512Mi"

          startupProbe:
            httpGet:
              path: /health
              port: 8080
            failureThreshold: 30
            periodSeconds: 10

          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3

          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 15
            failureThreshold: 3

          env:
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: db-host
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: myapp-config
                  key: log-level
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
  namespace: production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: myapp
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

#### Observability Stack

```yaml
# prometheus/rules/myapp.yaml
groups:
  - name: myapp.slo
    rules:
      # SLI: request success rate
      - record: myapp:request_success_rate:5m
        expr: |
          sum(rate(http_requests_total{job="myapp",status!~"5.."}[5m]))
          /
          sum(rate(http_requests_total{job="myapp"}[5m]))

      # SLO: 99.9% availability
      # Error budget burn rate alert (multi-window)
      - alert: MyAppHighErrorBudgetBurn
        expr: |
          (
            myapp:request_success_rate:1h < (1 - 14 * (1 - 0.999))
          ) and (
            myapp:request_success_rate:5m < (1 - 14 * (1 - 0.999))
          )
        for: 2m
        labels:
          severity: page
        annotations:
          summary: "High error budget burn rate — paging on-call"
          runbook: "https://wiki/runbooks/myapp-high-error-rate"

      - alert: MyAppHighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{job="myapp"}[5m]))
            by (le)
          ) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p99 latency above 500ms"
```

---

### Reference Architecture 2: Data Pipeline Platform

#### Architecture Overview

```
Data Sources → Kafka (MSK) → Consumer Applications → PostgreSQL / S3 / Redshift
                  ↑
           Producers (microservices, CDC from RDS)

Infrastructure:
  Terraform → MSK cluster → EKS cluster → RDS (source) → S3 (lake)
            → Redshift (warehouse) → Airflow (orchestration on EKS)

Pipeline:
  RDS → Debezium (CDC) → Kafka → Flink/Spark Streaming
      → processed events → S3 parquet → Redshift Spectrum

CI/CD:
  Python pipeline code → GitHub Actions (test, build, push to ECR)
                      → ArgoCD (deploy consumer pods)
  dbt models → GitHub Actions (dbt run --profiles-dir)
             → schedule via Airflow DAG
```

#### Kafka Consumer Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-event-consumer
  namespace: pipelines
spec:
  replicas: 6    # match partition count for full parallelism
  selector:
    matchLabels:
      app: order-event-consumer
  template:
    spec:
      containers:
        - name: consumer
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/order-consumer:v1.2
          env:
            - name: KAFKA_BROKERS
              value: "b-1.msk.us-east-1.amazonaws.com:9092,b-2.msk.us-east-1.amazonaws.com:9092"
            - name: KAFKA_GROUP_ID
              value: "order-processor-v2"
            - name: KAFKA_TOPIC
              value: "orders.created"
            - name: KAFKA_AUTO_OFFSET_RESET
              value: "earliest"
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "1Gi"
```

Consumer lag monitoring:

```yaml
# prometheus/rules/kafka.yaml
- alert: KafkaConsumerHighLag
  expr: |
    kafka_consumer_group_lag{
      group="order-processor-v2",
      topic="orders.created"
    } > 10000
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Consumer lag {{ $value }} — pipeline is falling behind"
    runbook: "https://wiki/runbooks/kafka-consumer-lag"
```

#### Airflow on Kubernetes

```python
# dags/daily_warehouse_refresh.py
from airflow import DAG
from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator
from datetime import datetime, timedelta

with DAG(
    "daily_warehouse_refresh",
    schedule_interval="0 6 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=5)},
) as dag:

    dbt_run = KubernetesPodOperator(
        task_id="dbt_run",
        image="123456789.dkr.ecr.us-east-1.amazonaws.com/dbt:latest",
        cmds=["dbt", "run", "--profiles-dir", "/secrets", "--target", "prod"],
        namespace="pipelines",
        service_account_name="dbt-runner",    # IRSA for Redshift access
        secrets=[
            k8s.V1EnvFromSource(
                secret_ref=k8s.V1SecretEnvSource(name="redshift-credentials")
            )
        ],
        resources=k8s.V1ResourceRequirements(
            requests={"cpu": "1", "memory": "2Gi"},
            limits={"cpu": "2", "memory": "4Gi"},
        ),
        retries=2,
    )

    dbt_test = KubernetesPodOperator(
        task_id="dbt_test",
        image="123456789.dkr.ecr.us-east-1.amazonaws.com/dbt:latest",
        cmds=["dbt", "test", "--profiles-dir", "/secrets", "--target", "prod"],
        namespace="pipelines",
        service_account_name="dbt-runner",
    )

    dbt_run >> dbt_test
```

---

### Reference Architecture 3: ML Inference Platform

#### Architecture Overview

```
Model Training (offline) → S3 model artifacts
                               ↓
Model Serving → Triton Inference Server / TorchServe on GPU nodes (EKS)
                               ↓
API Gateway → NGINX Ingress → Service → Inference Pod
                               ↓
Observability → model latency p50/p95/p99, GPU utilization, batch queue depth

Infrastructure:
  Terraform → EKS + GPU node group (g4dn.xlarge)
            → S3 for model artifacts
            → ECR for serving containers
            → Redis for request batching
```

#### GPU Node Configuration

```hcl
# terraform/30-kubernetes/gpu-nodes.tf
resource "aws_eks_node_group" "gpu" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "gpu"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = 0
    max_size     = 10
    min_size     = 0
  }

  instance_types = ["g4dn.xlarge"]

  taint {
    key    = "nvidia.com/gpu"
    value  = "present"
    effect = "NO_SCHEDULE"
  }

  labels = {
    "hardware"                     = "gpu"
    "nvidia.com/gpu"               = "present"
  }
}
```

```yaml
# Inference deployment with GPU request
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inference-server
  namespace: ml-serving
spec:
  replicas: 2
  template:
    spec:
      tolerations:
        - key: "nvidia.com/gpu"
          operator: "Exists"
          effect: "NoSchedule"
      nodeSelector:
        hardware: gpu

      initContainers:
        - name: model-downloader
          image: amazon/aws-cli:latest
          command: ["aws", "s3", "sync", "s3://models-bucket/v3/", "/models/"]
          volumeMounts:
            - name: model-storage
              mountPath: /models

      containers:
        - name: inference
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/inference:v3
          resources:
            limits:
              nvidia.com/gpu: "1"
              memory: "8Gi"
            requests:
              nvidia.com/gpu: "1"
              memory: "8Gi"
          volumeMounts:
            - name: model-storage
              mountPath: /models

      volumes:
        - name: model-storage
          emptyDir: {}
```

HPA on custom metrics (GPU queue depth via Prometheus adapter):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: inference-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: inference-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: External
      external:
        metric:
          name: inference_queue_depth
        target:
          type: AverageValue
          averageValue: "50"   # scale when avg queue depth exceeds 50 requests
```

---

### Cross-Cutting Patterns

#### Secret Management Pattern

Never store secrets in Git. The two common patterns:

**External Secrets Operator (ESO)** — pulls secrets from AWS Secrets Manager at deploy time:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secrets
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: myapp-secrets    # creates this Kubernetes Secret
    creationPolicy: Owner
  data:
    - secretKey: db-password
      remoteRef:
        key: production/myapp/database
        property: password
    - secretKey: api-key
      remoteRef:
        key: production/myapp/api-credentials
        property: key
```

**Vault Agent Injector** — injects secrets as files into pods via sidecar:

```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "myapp"
  vault.hashicorp.com/agent-inject-secret-config: "secret/data/myapp/config"
  vault.hashicorp.com/agent-inject-template-config: |
    {{- with secret "secret/data/myapp/config" -}}
    export DB_PASSWORD="{{ .Data.data.db_password }}"
    {{- end }}
```

#### Namespace and RBAC Pattern

```yaml
# namespace per team, not per application
apiVersion: v1
kind: Namespace
metadata:
  name: platform-team
  labels:
    team: platform
    environment: production
---
# Team can manage their deployments but not cluster-wide resources
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: platform-team-deploy
  namespace: platform-team
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: edit        # can create/update/delete most resources, not RBAC
subjects:
  - kind: Group
    name: platform-team
    apiGroup: rbac.authorization.k8s.io
---
# CI service account can only update deployments
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ci-deploy
  namespace: platform-team
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "patch", "update"]
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "create", "update", "patch"]
```

#### Multi-Environment Promotion Pattern

```
feature-branch → PR → CI runs (test, scan, quality gate)
                    ↓
main branch → CI builds image, tags with git sha
                    ↓
            → updates dev overlay (Kustomize)
                    ↓
ArgoCD auto-syncs dev environment
                    ↓
            (manual promotion) developer runs:
            ./scripts/promote.sh dev staging abc123
                    ↓
            → updates staging overlay
                    ↓
ArgoCD auto-syncs staging
                    ↓
            (approval gate) change request approved
                    ↓
            → updates production overlay
                    ↓
ArgoCD syncs production (manual sync or auto with approval)
```

Kustomize overlay structure:

```
k8s/
├── base/
│   ├── deployment.yaml      # image: myapp:latest (placeholder)
│   ├── service.yaml
│   ├── configmap.yaml
│   └── kustomization.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml   # sets replicas: 1, image tag, dev config
    │   └── patches/
    │       └── deployment-patch.yaml
    ├── staging/
    │   ├── kustomization.yaml   # sets replicas: 2, staging image tag
    │   └── patches/
    └── production/
        ├── kustomization.yaml   # sets replicas: 3+, prod image tag
        └── patches/
```

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

resources:
  - ../../base

images:
  - name: myapp
    newName: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp
    newTag: "abc123def456"   # updated by CI

patches:
  - path: patches/deployment-patch.yaml

configMapGenerator:
  - name: myapp-config
    literals:
      - log-level=warn
      - environment=production
```

#### Canary Deployment Pattern

```yaml
# Argo Rollouts canary strategy
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: myapp-canary
      stableService: myapp-stable
      trafficRouting:
        nginx:
          stableIngress: myapp-ingress
      steps:
        - setWeight: 5       # 5% traffic to canary
        - pause: {duration: 5m}
        - analysis:
            templates:
              - templateName: error-rate-check
        - setWeight: 20
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100
      analysisRunMetadata:
        labels:
          app: myapp
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
spec:
  metrics:
    - name: error-rate
      interval: 1m
      successCondition: result[0] < 0.01   # less than 1% error rate
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{app="myapp-canary",status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total{app="myapp-canary"}[5m]))
```

---

### Debugging End-to-End Failures

#### Deployment Failure Trace

When a deployment fails, trace through each layer:

```
1. Check the CI pipeline
   → GitHub Actions: did the build pass? Did Trivy block it?
   → ArgoCD: is the application in Sync error state?

2. Check the Kubernetes layer
   → kubectl rollout status deployment/myapp -n production
   → kubectl get events -n production --sort-by=.metadata.creationTimestamp
   → kubectl describe pod <failing-pod> -n production

3. Check the image
   → kubectl get pods -n production -o jsonpath='{..image}'
   → Is the image digest what CI pushed?
   → kubectl describe pod → Events: ImagePullBackOff? OOMKilled? CrashLoopBackOff?

4. Check logs
   → kubectl logs deployment/myapp -n production --previous
   → Is there a panic/fatal? DB connection refused? Missing env var?

5. Check the dependencies
   → Can the pod reach the database? kubectl exec -it <pod> -- nc -zv db-host 5432
   → Can the pod reach AWS services? Is the IRSA role correct?
   → Is the Secret referenced in env properly created?
```

#### Traffic Not Reaching Pod

```
1. Check DNS
   → nslookup myapp.production.svc.cluster.local from a debug pod
   → Should resolve to ClusterIP

2. Check Service endpoints
   → kubectl get endpoints myapp -n production
   → Empty endpoints = selector doesn't match pod labels

3. Check NetworkPolicy
   → kubectl get networkpolicies -n production
   → Is ingress allowed from the ingress controller namespace?

4. Check the Ingress
   → kubectl describe ingress myapp -n production
   → Check the NGINX controller logs: kubectl logs -n ingress-nginx deploy/ingress-nginx-controller

5. Check TLS
   → kubectl get certificate -n production
   → Is cert-manager Ready? Is the secret created?
   → openssl s_client -connect myapp.example.com:443 -servername myapp.example.com
```

#### Observability Gap Diagnosis

When you get an alert but can't find the cause:

```bash
# Is Prometheus scraping this pod?
kubectl exec -n monitoring prometheus-0 -- \
  wget -qO- "localhost:9090/api/v1/targets" | jq '.data.activeTargets[] | select(.labels.job=="myapp")'

# What metrics is the pod actually exposing?
kubectl exec -n production -it $(kubectl get pod -n production -l app=myapp -o name | head -1) \
  -- wget -qO- localhost:8080/metrics | head -50

# Is the alert rule evaluating correctly?
kubectl exec -n monitoring prometheus-0 -- \
  wget -qO- "localhost:9090/api/v1/query?query=myapp:request_success_rate:5m"
```

---

### Common Failure Modes

**"Deployment succeeded but old code is still running":** ArgoCD shows synced but pods have old image. Check if the `imagePullPolicy` is `IfNotPresent` (won't pull if tag exists) and you're reusing the `latest` tag. Fix: always use immutable tags (git SHA). Force rollout with `kubectl rollout restart deployment/myapp`.

**"Works in staging, fails in production":** Most common causes:
- Different secret values (staging DB vs prod DB credentials)
- Different resource limits (prod limits hit, staging never does)
- Different replica counts (race condition only visible under load)
- Missing permissions (IRSA role in staging has `*`, production has least privilege)
- NetworkPolicy in production blocking a dependency that staging allows

**"CI passes, ArgoCD won't sync":** ArgoCD may refuse to sync if it detects a diff it doesn't understand — e.g., an operator mutates the resource. Fix: add `ignoreDifferences` in the ArgoCD Application spec for fields managed by operators (replicas managed by HPA, fields injected by admission webhooks).

**"Terraform plan shows no changes but infrastructure drifted":** Someone made a manual change via the AWS console. `terraform plan` won't detect it if the change is on a resource attribute Terraform doesn't manage. Fix: use `terraform plan --detailed-exitcode` in CI to detect drift. For resources you want Terraform to own completely, add `lifecycle { ignore_changes = [] }` nowhere — instead, lock down console access via IAM.

**"New service can't reach the database":** Common causes in order:
1. Secret not created in correct namespace
2. IRSA role missing RDS permission
3. Security group rule missing (pod CIDR not allowed on DB SG)
4. NetworkPolicy blocking egress from the pod namespace
5. RDS parameter group requiring SSL (app not configured for SSL)

**"Alert firing but SLO dashboard shows OK":** Recording rule and alert rule use different time windows or label selectors. Alert fires on 5m window, SLO dashboard uses 1h window. Temporarily elevated error rate clears from the longer window. This is correct behavior — the alert caught a spike, the SLO absorbed it within budget. Check error budget remaining on the SLO dashboard.

---

### Key Questions and Answers

**Q: How do you design a CI/CD pipeline for a new microservice from scratch?**

Start with the contract: what has to be true before code reaches production? For a typical web service: all tests pass, no critical CVEs in the image, quality gate passes (coverage, no new vulnerabilities), image is signed, deployment succeeds, smoke test passes. Work backward from there. Pipeline stages: `test → scan → build → sign → push → update-manifest → deploy → verify`. Separate CI (test/build/push) from CD (deploy/verify). CI runs on every PR; CD triggers on main. Keep CI fast (under 5 minutes) by running tests in parallel and caching dependencies. Use OIDC for all cloud credentials — no stored secrets in CI.

**Q: A pod is restarting every few minutes. How do you diagnose it?**

Check the restart count: `kubectl get pods`. Check the last exit code: `kubectl describe pod` — look at the Last State section. Exit 137 is OOMKilled (increase memory limit or fix a memory leak). Exit 1 is application crash (check logs: `kubectl logs --previous`). Exit 143 is SIGTERM during graceful shutdown (check if `terminationGracePeriodSeconds` is long enough). CrashLoopBackOff means Kubernetes is applying exponential backoff. To see what happened before the crash: `kubectl logs <pod> --previous`. If the pod can't start at all: check `kubectl describe` for events — missing ConfigMap/Secret, image pull error, or readiness probe failing before startup completes.

**Q: How do you roll back a bad deployment safely?**

For Kubernetes: `kubectl rollout undo deployment/myapp -n production` reverts to the previous revision. This changes the pod template back to the previous image. Verify: `kubectl rollout status deployment/myapp` then check error rates. For GitOps with ArgoCD: revert the commit in the manifest repo, ArgoCD syncs automatically. Rollback is just another forward commit. For database schema changes: you need to have applied them in a backwards-compatible way (additive only, never remove columns in the same deploy as removing code that uses them). If a bad schema migration ran: restore from the pre-deployment snapshot (which means you had one — pre-deployment RDS snapshots are not optional for production).

**Q: What does a good SLO look like end to end?**

An SLO needs: a defined SLI (what you're measuring), a threshold (99.9%), a window (rolling 30 days), an error budget (0.1% of 30 days = 43 minutes), burn rate alerts (fast burn: 14x for 1h, slow burn: 3x for 6h), a runbook per alert, and a process for what happens when the budget is exhausted (freeze deployments, focus on reliability). The SLI should measure user-facing success, not internal health checks. "Successful requests / total requests" is better than "CPU below 80%". Track your error budget burn rate weekly — if you're consuming budget faster than planned, you have a reliability problem, not just a metrics problem.

**Q: How do you handle secrets rotation without downtime?**

Use External Secrets Operator or Vault Agent with a refresh interval. The rotation flow: new secret version created in AWS Secrets Manager → ESO detects new version (on next refresh cycle) → creates new Kubernetes Secret version → pods need to pick up new secret. For environment variables: pods must restart to pick up new Secret values. For file mounts: kubelet automatically updates the mounted file when the Secret changes (within a few minutes), without pod restart. For zero-downtime rotation: use file-mounted secrets, not environment variable secrets. Alternatively: rotate the secret, trigger a rolling restart, old pods die with old secret, new pods start with new secret.

---

### Points to Remember

- Platform engineering = infrastructure + deployment + observability + security, composed
- Terraform state should be split by lifecycle layer — networking separate from compute separate from applications
- CI contract: test → scan (Trivy + SonarQube) → build → sign → push → trigger CD
- CD contract: ArgoCD watches GitOps repo, syncs to cluster, verifies rollout
- IRSA/Workload Identity: pods authenticate to cloud services without stored credentials
- Kustomize overlays: base manifest + environment-specific patches; image tag updated by CI
- Canary deployment: send fraction of traffic, analyze metrics, proceed or roll back automatically
- Multi-window burn rate alerts: fast (14x/1h) pages, slow (3x/6h) tickets
- Rollback = merge revert commit to GitOps repo, ArgoCD syncs
- Schema migrations must be backwards-compatible — deploy code before schema removal, not after
- Secrets must be file-mounted (not env vars) for zero-downtime rotation
- Debug order: CI logs → ArgoCD events → pod events → pod logs → dependency connectivity

### What to Study Next

- [CI/CD and Trusted Delivery](./08-cicd-trusted-delivery-and-platform-security) — supply chain security in depth
- [Delivery Systems: Jenkins, GitHub Actions, ArgoCD](./17-delivery-systems-jenkins-github-actions-and-argocd) — individual tool patterns
- [Kubernetes Manifest Design](./25-yaml-and-kubernetes-manifest-design) — manifest patterns referenced here
- [Observability, SLOs and Incident Response](./09-observability-slos-and-incident-response) — SLO design in depth
- [Terraform Infrastructure as Code](./15-terraform-infrastructure-as-code) — IaC patterns in detail

---

## [SRE] MLOps Overview

# MLOps Workspace

This area is intentionally separate from the interview-prep system.

Use it for:

- Python learning and scripting practice
- notebook-based MLOps study
- MLflow experiments
- small runnable Python application patterns

## Structure

- `PYTHON/Basics/`
  Core Python notebooks from syntax through functions, OOP, files, exceptions, logging, NumPy, and pandas.
- `PYTHON/Advanced/`
  Advanced Python notebooks covering patterns, concurrency, HTTP APIs, Pydantic, FastAPI, SQLAlchemy, testing, and capstones.
- `PYTHON/Advanced/deployment_control_center/`
  A runnable FastAPI project extracted from the advanced capstone.
- `mlflow/`
  MLflow notebooks and local experiment material.

## Recommended Reading Order

1. `PYTHON/Basics/`
2. `PYTHON/Advanced/`
3. `PYTHON/Advanced/deployment_control_center/`
4. `mlflow/`

## Python Notebook Workflow

Create one local environment for the Python notebook track:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/mlops
python3 -m venv .venv
source .venv/bin/activate
pip install -r PYTHON/requirements.txt
python -m ipykernel install --user --name sre-challenges-mlops --display-name "SRE Challenges MLOps"
jupyter lab
```

Open notebooks from:

- `PYTHON/Basics/`
- `PYTHON/Advanced/`

## Deployment Control Center

This is the clearest runnable Python project in the MLOps area.

Run it with:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/mlops/PYTHON/Advanced/deployment_control_center
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Useful endpoints:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/health`

Run tests with:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/mlops/PYTHON/Advanced/deployment_control_center
source .venv/bin/activate
pytest -q
```

## MLflow Study Area

Install dependencies and start MLflow locally:

```bash
cd /Users/jithinpjoseph/Documents/GitHub/SRE-Challenges/mlops/mlflow
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mlflow ui --backend-store-uri sqlite:///mlflow.db
```

Then open:

- `http://127.0.0.1:5000`

Suggested notebook order:

1. `00_study_guide.ipynb`
2. `getstarted.ipynb`
3. `01_iris_classification.ipynb`

## Notes

- Keep `mlops/` independent from `interview-prep/`.
- Treat this area as a practical Python and MLOps workspace.
- The portal now has a dedicated MLOps page to help you navigate this content cleanly.
