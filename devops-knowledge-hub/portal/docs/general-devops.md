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
