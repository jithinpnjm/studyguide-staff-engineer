---
title: "Beginner"
sidebar_position: 1
---

# Platform Engineering — Beginner

## What Is Platform Engineering?

Platform engineering is the discipline of building and operating **Internal Developer Platforms (IDPs)** — the shared infrastructure, tooling, and workflows that product teams use to build, ship, and run software. The platform team's customer is the internal developer, not the end user.

The core loop:

```
Developers self-serve → Platform team builds capabilities → Feedback improves the platform
```

The goal is to reduce **cognitive load**: developers should not need to become Kubernetes, Terraform, or secrets management experts to ship features. They walk a **golden path** and the hard parts are already solved.

---

## Platform Engineering vs SRE vs DevOps

These disciplines overlap but have different primary focuses:

| Dimension | DevOps | SRE | Platform Engineering |
|---|---|---|---|
| Primary focus | Culture + CI/CD pipeline | Reliability, SLOs, incident response | Self-service infrastructure for developers |
| Who benefits | Dev and Ops teams | End users (uptime) | Internal developers |
| Key output | Fast, automated delivery | Reliable production systems | Internal Developer Platform |
| Success metric | Deployment frequency, lead time | Error budget, MTTR | Developer experience, time-to-first-deploy |
| Team type | Cross-functional embedding | Embedded or centralized | Centralized enabling team |

In practice, a platform team practices SRE principles on the platform itself (writes SLOs, responds to incidents) and enables DevOps practices for the rest of the organization (by building the pipelines and self-service tooling that make CI/CD possible).

**Key distinction:** SRE asks "is production reliable?" Platform engineering asks "can developers self-serve without asking the platform team for help?"

---

## Internal Developer Platform (IDP) Concepts

An IDP is not a single tool — it is a composition of capabilities that developers access through a unified interface:

| Capability | What It Does | Example Tools |
|---|---|---|
| Service catalog | Register, discover, and understand services | Backstage, Port, Cortex |
| Self-service provisioning | Create infrastructure without filing tickets | Backstage scaffolder, Terraform modules |
| GitOps delivery | Declarative, auditable deployment pipeline | ArgoCD, Flux |
| Secret management | Secure secrets injection at runtime | Vault, External Secrets Operator |
| Observability stack | Metrics, logs, traces out of the box | Prometheus, Grafana, Loki, Tempo |
| Policy enforcement | Automated guardrails for security + compliance | OPA/Gatekeeper, Kyverno |
| Cost visibility | Spend per team, per service | OpenCost, Kubecost |

The platform team does not run all of these tools — it curates and integrates them into a coherent experience.

---

## Golden Paths and Paved Roads

A **golden path** is an opinionated, pre-built, supported route to accomplish a common task. The idea: make the right thing the easiest thing.

Examples of golden paths:
- "Start a new microservice" — runs a Backstage template, creates a repo, sets up CI, provisions Kubernetes namespace, registers in catalog, adds Grafana dashboard
- "Add a database" — runs a Terraform module with sensible defaults (backup enabled, encryption on, multi-AZ in prod)
- "Deploy to production" — push to main, CI runs tests + scan, ArgoCD deploys, rollback available in one command

**Golden path vs guardrail:**
- Golden path = the easy way that just works
- Guardrail = a policy that prevents dangerous deviations (e.g., blocking containers running as root)

Do not use guardrails to block developers; use them to catch the things that genuinely cannot be allowed (security violations, missing resource limits). Everything else should have a golden path.

**Paved road** is a synonym for golden path, more commonly used to emphasize that the road exists but developers can go off-road if they accept responsibility for maintenance.

---

## Developer Experience (DX)

Developer experience measures how easy it is for developers to accomplish their goals using the platform. Poor DX manifests as:

- Long onboarding times ("I've been trying to get my service running for three days")
- Many tickets to the platform team ("Can you create a namespace for us?")
- Shadow IT ("We use our own AWS account because the platform is too slow")
- Inconsistent practices ("Each team does secrets differently")

Good DX means:
- A new engineer can deploy their first service to staging within one business day
- Common tasks (new service, new database, rollback) have documented self-service paths
- The platform is discoverable — developers can find answers in the catalog without asking

**Key DX metrics to track:**
- Time from repo creation to first production deploy
- Number of platform team tickets per developer per month (should decrease over time)
- Developer NPS survey scores (quarterly)
- Onboarding time to first PR in production

---

## Backstage Basics

Backstage is an open-source CNCF project originally created by Spotify. It is the most widely adopted IDP framework and provides three core capabilities:

### Software Catalog

A centralized registry of all services, libraries, data pipelines, websites, and APIs. Each entity registers itself via a `catalog-info.yaml` file committed to its own repository:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-service
  description: "Handles all payment processing for checkout"
  annotations:
    github.com/project-slug: myorg/payment-service
    prometheus.io/rule: payment_errors_total
    pagerduty.com/integration-key: abc123
spec:
  type: service
  lifecycle: production
  owner: payments-team
  system: checkout
  dependsOn:
    - resource:default/payments-db
    - component:default/fraud-detection-service
```

The catalog gives you a searchable inventory of everything running in your organization, with ownership, dependencies, and runbook links.

### Scaffolder (Software Templates)

The scaffolder lets developers self-serve new projects by running a template. A template can:
- Create a new GitHub repository from a skeleton
- Add CI/CD workflow files
- Create Kubernetes namespace and RBAC
- Register the new service in the catalog
- Create a Grafana dashboard and PagerDuty service

```yaml
# Simplified Backstage scaffolder template
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: python-service
  title: Python Microservice
spec:
  parameters:
    - title: Service Details
      properties:
        name:
          title: Service Name
          type: string
        owner:
          title: Owning Team
          type: string

  steps:
    - id: fetch-base
      name: Fetch Base Template
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: ${{ parameters.name }}
          owner: ${{ parameters.owner }}

    - id: publish
      name: Publish to GitHub
      action: publish:github
      input:
        repoUrl: github.com?repo=${{ parameters.name }}&owner=myorg

    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: /catalog-info.yaml
```

### TechDocs

Backstage TechDocs renders markdown documentation stored alongside code (`docs/` directory) and makes it searchable in the catalog. This makes documentation part of the service — it updates when the service updates, and it lives next to the code that it documents.

---

## The Developer Self-Service Flow

When a golden path is working well, a developer creating a new service does this:

```
1. Developer opens Backstage, clicks "Create New Service"
2. Fills in form: service name, team, language, database needed?
3. Template runs:
   → Creates GitHub repo with app skeleton + CI workflow
   → Provisions Kubernetes namespace with RBAC
   → Creates Terraform module call if database requested
   → Registers ArgoCD Application for GitOps deployment
   → Registers service in Backstage catalog
   → Creates Grafana dashboard from template
   → Creates PagerDuty service and links to team
4. Developer pushes first commit
5. CI runs (test, scan, build, push image)
6. ArgoCD syncs to staging automatically
7. Developer has a running service in staging in < 30 minutes
```

This flow represents a mature platform. Most organizations start by manually implementing pieces of this and gradually automate them.

---

## Key Vocabulary

| Term | Definition |
|---|---|
| IDP | Internal Developer Platform — the self-service layer for developers |
| Golden path | Opinionated, pre-built, supported route for a common task |
| Scaffolder | Tool that generates a new project from a template (Backstage feature) |
| Catalog | Registry of all services, APIs, and data entities in an organization |
| Cognitive load | Mental effort required to understand and work with a system |
| Enabling team | A team that helps other teams level up (platform team is an enabling team) |
| Stream-aligned team | A product team aligned to a business domain or user journey |
| Guardrail | Automated policy that prevents dangerous practices |
| Paved road | Synonym for golden path |
| Self-service | Developer can complete a task without filing a ticket to another team |

---

## Summary

Platform engineering sits at the intersection of infrastructure, developer tooling, and product thinking. The platform team:

1. Builds and operates IDPs (Backstage, ArgoCD, Vault, etc.)
2. Creates golden paths so developers can self-serve common tasks
3. Enforces guardrails through policy-as-code
4. Measures success by developer experience metrics — not infrastructure uptime alone

The mindset shift from classic ops to platform engineering: **stop being a service desk, start being a product team** whose product is the internal developer platform.
