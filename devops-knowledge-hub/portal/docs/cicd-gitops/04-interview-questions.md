---
title: "Interview Questions"
sidebar_position: 4
---

# CI/CD & GitOps — Interview Questions

Use these questions to practice both tool knowledge and staff-level reasoning. Strong answers explain tradeoffs, blast radius, rollback, and operational failure modes. Weak answers list product features.

---

## Beginner Questions

### What is CI/CD?

CI validates changes automatically. CD promotes validated artifacts to environments. Continuous Delivery keeps every change deployable with optional approval. Continuous Deployment pushes every validated change to production automatically.

### What is the difference between build and release pipelines?

A build pipeline compiles, tests, packages, and publishes artifacts. A release pipeline promotes those artifacts to environments. In modern YAML pipelines these may be in one file, but the responsibilities should still be separate.

### What is an artifact?

A versioned output from CI: container image, JAR, binary, package, Helm chart, or static build. It should be immutable and traceable to a commit.

### Why build once and promote many?

Because staging must test the same artifact that production will run. Rebuilding per environment breaks reproducibility and makes rollback uncertain.

### What is GitOps?

GitOps uses Git as the desired-state source. A controller such as ArgoCD or Flux compares Git with the cluster and reconciles differences.

### What is the difference between push-based CD and pull-based GitOps?

Push-based CD lets an external pipeline write to the cluster. Pull-based GitOps has an in-cluster controller pull desired state from Git. Pull-based delivery reduces the need for direct cluster write access from CI and gives drift visibility.

---

## Git And Version Control

### What is the difference between merge and rebase?

Merge preserves branch history and may create a merge commit. Rebase replays local commits on top of another branch to create a cleaner linear history. Rebase local branches; do not casually rewrite shared history.

### Why is revert safer than reset on main?

Revert creates an explicit undo commit while preserving shared history. Reset moves history and can break collaborators if used on shared branches.

### How do you recover a lost local commit?

Use reflog.

```bash
git reflog
git switch -c rescue HEAD@{3}
```

### How do you find the commit that introduced a regression?

Use timing from logs first, then `git bisect` for systematic search.

```bash
git bisect start
git bisect bad
git bisect good v1.0.0
```

### What should a good infrastructure PR include?

What changed, why it changed, how it was tested, blast radius, rollback plan, and screenshots or plan output when useful.

---

## Jenkins Questions

### Explain Jenkins controller-agent architecture.

The controller schedules jobs, manages configuration, and coordinates pipelines. Agents execute build steps in workspaces. In production, builds should run on agents, not on the controller.

### How do you scale Jenkins?

Use ephemeral agents, often Kubernetes pod agents or cloud VM agents. Monitor queue time, agent startup latency, disk pressure, and plugin health. Keep the controller small and stable.

### What are common Jenkins failure modes?

Plugin incompatibility, credential ID mismatch, agent disk full, agent pod Pending, controller overload, shared library breaking many jobs, and stale workspaces.

### How do you manage Jenkins plugins safely?

Maintain approved plugin versions, test upgrades in staging, keep a rollback path, avoid unnecessary plugins, and version shared pipeline libraries.

---

## GitHub Actions Questions

### What are workflow, job, step, runner, and action?

A workflow is the YAML automation file. A job is a group of steps. A step is a command or action invocation. A runner executes the job. An action is reusable logic.

### When do you use self-hosted runners?

Use them for private network access, custom hardware, special toolchains, or compliance requirements. Use isolation and cleanup because persistent runners can leak state between builds.

### How do you structure a monorepo workflow?

Use path filters, service ownership, dependency graph detection, and reusable workflows. Be careful with shared libraries because a shared change can require more services to test.

### Why should production deployment jobs be separated from normal CI jobs?

They have different risk, permissions, audit requirements, and approval needs. CI validates; production promotion changes customer-facing runtime state.

---

## Azure DevOps Questions

### What are the core Azure DevOps components?

Azure Repos, Azure Pipelines, Azure Artifacts, Azure Boards, and Azure Test Plans.

### What is a service connection?

A configured connection that lets a pipeline interact with an external system such as Azure, Kubernetes, Docker registry, GitHub, or SonarQube. It should be scoped narrowly.

### How do you implement approvals in Azure Pipelines?

Use Environments and configure approvals and checks before deployment jobs run.

### How do you cache dependencies in Azure Pipelines?

Use `Cache@2` keyed by operating system and dependency file.

```yaml
- task: Cache@2
  inputs:
    key: 'maven | "$(Agent.OS)" | pom.xml'
    path: $(Pipeline.Workspace)/.m2
    restoreKeys: |
      maven | "$(Agent.OS)"
      maven
```

### How do you rollback in Azure Pipelines?

Redeploy the previous artifact, swap application slots where applicable, or use Kubernetes rollback for deployments.

```bash
kubectl rollout undo deployment/myapp -n production
```

---

## ArgoCD And GitOps Questions

### What does OutOfSync mean?

The cluster actual state differs from the desired state in Git. It may be caused by manual edits, controller-mutated fields, failed sync, or drift.

### What is `prune`?

When enabled, ArgoCD deletes cluster resources that were removed from Git.

### What is `selfHeal`?

When enabled, ArgoCD repairs cluster drift by applying Git state again.

### How do you debug a stuck ArgoCD sync?

```bash
argocd app get myapp
argocd app diff myapp
kubectl get events -n myapp --sort-by=.lastTimestamp
kubectl describe deploy myapp -n myapp
```

Check manifest validity, permissions, image pull, readiness, admission policies, and namespace existence.

### Why might GitOps revert a manual hotfix?

Because the manual runtime state differs from Git desired state. With self-heal enabled, the controller restores Git state. The durable fix must be committed to Git.

---

## Security And Trust Questions

### How do you know production came from reviewed source?

Trace the chain: protected branch commit, pull request review, CI run, artifact digest, scan result, signature or attestation, GitOps promotion commit, and deployment revision.

### Why are mutable tags risky?

The same tag can point to different content over time. That breaks auditability and rollback certainty.

### What is an SBOM?

A Software Bill of Materials lists components and dependencies inside an artifact. It helps answer which running services contain a vulnerable library.

### How do you design a multi-tenant CI platform?

Separate trust tiers. External PRs get no privileged context. Internal CI gets scoped resources. Production promotion runs on more controlled workers with explicit approval and audit.

---

## Staff-Level Design Questions

### Design a CI/CD pipeline for 30 microservices.

Strong answer:

- Decide monorepo vs polyrepo based on team and dependency structure.
- Use reusable workflow or shared pipeline library.
- Use selective builds so one small change does not rebuild everything.
- Build immutable images tagged by SHA.
- Scan artifacts and publish metadata.
- Update GitOps environment overlays.
- Use ArgoCD for deployment.
- Use canary rollout for high-risk services.
- Track delivery SLIs: queue time, build duration, deploy duration, rollback duration, flaky-test rate.

### How do you ensure a deployment does not break production?

Use layered defense: tests, static analysis, artifact checks, staging smoke tests, progressive rollout, SLO-based monitoring, and rollback drills. Database changes use expand-contract migration, not breaking one-step schema changes.

### A pipeline is technically correct but teams bypass it. What do you do?

Diagnose friction first. If the compliant path is slow or confusing, enforcement alone creates resentment and shadow pipelines. Improve ergonomics, then enforce at high-risk promotion gates.

### What signals show the delivery platform is becoming a reliability risk?

- CI infra failures rising
- P95 queue time rising
- P95 deployment duration rising
- Teams creating shadow pipelines
- Rollbacks increasing without deployment volume increasing
- Platform appears as contributing factor in incidents

---

## Pressure Follow-Ups

### Where is the blast radius?

Name the teams, services, environments, clusters, and users affected if this pipeline or policy fails incorrectly.

### What would you centralize?

Centralize shared templates, artifact policy, runner baseline, observability interface, and production promotion controls.

### What would you leave to teams?

Service-level test design, application-specific rollout metrics, domain-specific deployment timing, and non-production experimentation.

### What is the rollback story?

For every release, know whether rollback is Git revert, Argo rollback, image digest rollback, slot swap, or database-compatible forward fix.

---

## Platform and Security Design Q&A (Staff Level)

These questions are drawn from mock interview format — each requires a multi-minute answer covering tradeoffs, failure modes, and blast radius.

### How do you design a secure internal platform for GKE?

Strong answer structure:
- Start with constraints: number of teams, trust tiers, compliance requirements (SOC 2, PCI), greenfield vs migration.
- Identity model: Workload Identity for pod-level GCP credentials — no service account key files. IAM with least privilege. Separate GCP projects per environment (dev, staging, production) for blast-radius isolation.
- Network: Private GKE clusters (no public node IPs), Cloud NAT for egress, VPC network policies enforced by Cilium or Calico for east-west control.
- Secrets: Google Secret Manager accessed via the CSI secrets driver — not baked into images, not env vars in manifests.
- Supply chain: Artifact Registry with Container Analysis for vulnerability scanning, Binary Authorization policy in production requiring an attestation from the scanning pipeline before pod scheduling.
- Audit: Cloud Audit Logs to BigQuery with 1-year retention.

### How do you know what is running in production came from reviewed source?

The chain has four links:
1. Builds only run in CI on commits that passed code review on a protected branch.
2. The CI pipeline signs the image with Cosign using keyless signing against the OIDC provider, attesting to the CI job and commit that produced it.
3. In the production cluster, a Cosign admission webhook rejects any image without a valid signature from the CI identity.
4. An SBOM is attached to every image at build time — enabling the query "which production pods contain this vulnerable library?"

Audit trail: git commit → CI job ID → image digest → signature → admission log entry.

### How would you design a multi-tenant CI platform with different trust levels?

Three tiers:
- Untrusted (PRs from forks, external contributors): ephemeral pods on a dedicated node pool with no egress beyond build cache and registry. No secrets.
- Medium-trust (internal team CI): namespace-isolated jobs, access to non-production secrets via Vault dynamic credentials, network egress scoped to internal artifact stores.
- High-trust production deploy: separate hardened node pool, audited secret access, requires a promotion approval gate, scoped to only the service account and namespace being deployed to.

The separation: node pool taints enforce workload placement, network policies enforce egress, Vault policies enforce which secrets each tier can request. Ephemeral namespaces guarantee no state leaks between runs.

### What are the most important default guardrails for product teams?

Five defaults that protect without blocking:
1. LimitRanges injecting default CPU and memory requests/limits — prevents unbounded scheduling and noisy-neighbor OOM kills.
2. PodSecurityAdmission at restricted profile, namespace-wide — no root containers, no privilege escalation, no host namespace sharing.
3. Default-deny NetworkPolicy in every namespace — teams declare the ports they need; unknown traffic is blocked.
4. ResourceQuotas per namespace — one team cannot exhaust cluster capacity during a misconfiguration incident.
5. OPA/Kyverno policies enforcing image origin from approved registries and denying images without recent scan attestation.

These are applied by platform automation on namespace creation.

### How do you implement break-glass access without undermining safety controls?

Break-glass access must leave a louder audit trail than normal access, not a quieter one:
- Dedicated service account per cluster stored in Vault under a break-glass policy.
- Checking it out requires MFA plus a required justification field.
- Creates an immediate PagerDuty alert to security on-call.
- Credential is valid for 4 hours.
- All API actions are tagged in the Kubernetes audit log with the break-glass credential (distinct from normal service account tokens).
- After the incident, the break-glass key is rotated and the session record is reviewed within 24 hours.

### What signals tell you your delivery platform is becoming a reliability risk?

Five signals:
1. Build success rate trending downward (infra error failures, not app failures).
2. P95 deploy duration increasing — a deployment that took 5 minutes now takes 25 means accumulated hidden debt.
3. Rollback frequency increasing without corresponding deployment frequency increase.
4. Teams building shadow pipelines — the strongest signal the official path has failed to meet their needs.
5. Platform team appears as a contributing factor in production incident post-mortems.

### Describe a platform incident where a security action caused a reliability incident.

A worked example: a security scan flagged a long-lived service account key committed six weeks prior. The platform team revoked it at 14:00. Within 4 minutes, 40% of production pods began failing auth to Cloud Storage — the key had been distributed as a Kubernetes Secret across 6 clusters as part of a legacy integration not in the platform's inventory. The security team revoked without checking blast radius. Service was restored using Workload Identity in 22 minutes. Systemic fix: credential inventory requiring all credentials to be registered with their consuming services, so any rotation runs through a blast-radius check first.

### How do you design a CI/CD pipeline for a new microservice from scratch?

Start with the contract: what must be true before code reaches production? For a typical web service: all tests pass, no critical CVEs in the image, quality gate passes (coverage threshold, no new vulnerabilities), image is signed, deployment succeeds, smoke test passes. Work backward. Pipeline stages: `test → scan → build → sign → push → update-manifest → deploy → verify`. Separate CI (test/build/push) from CD (deploy/verify). CI runs on every PR; CD triggers on main. Keep CI under 5 minutes by running tests in parallel and caching dependencies. Use OIDC for all cloud credentials — no stored secrets.

### How do you handle secrets rotation without downtime?

Use External Secrets Operator or Vault Agent with a refresh interval. Rotation flow: new secret version created in AWS Secrets Manager → ESO detects new version on next refresh cycle → creates new Kubernetes Secret version. For env vars: pods must restart to pick up new values. For file mounts: kubelet automatically updates the mounted file without pod restart. For zero-downtime rotation: use file-mounted secrets, not env var secrets. Alternatively: rotate the secret, trigger a rolling restart — old pods die with old secret, new pods start with new secret.

### A pod is restarting every few minutes. How do you diagnose it?

```bash
# Step 1: check restart count and current state
kubectl get pods -n production

# Step 2: check last exit code and state
kubectl describe pod <pod-name> -n production
# look at: "Last State", "Exit Code", "Reason"

# Step 3: exit code interpretation
# 137 = OOMKilled (increase memory limit or fix leak)
# 1   = application crash (check logs)
# 143 = SIGTERM during graceful shutdown (check terminationGracePeriodSeconds)

# Step 4: view logs from before the crash
kubectl logs <pod> -n production --previous

# Step 5: if pod cannot start
# check Events section in describe for missing Secret/ConfigMap, image pull error,
# or readiness probe failing before startup completes
```

### How do you roll back a bad deployment safely?

For Kubernetes: `kubectl rollout undo deployment/myapp -n production` reverts to the previous ReplicaSet template. Verify: `kubectl rollout status deployment/myapp -n production`, then check error rates. For GitOps: revert the manifest commit in the GitOps repo — ArgoCD syncs automatically. For database schema changes: you need backward-compatible migrations applied before this point. If a bad schema migration ran, restore from a pre-deployment snapshot. Pre-deployment database snapshots are not optional for production.

### What does a good SLO look like end to end?

An SLO needs: an SLI (what you measure — successful requests/total requests), a threshold (99.9%), a window (rolling 30 days), an error budget (0.1% of 30 days = 43 minutes), burn rate alerts (fast burn: 14x for 1h, slow burn: 3x for 6h), a runbook per alert, and a process for when the budget is exhausted (freeze deployments, focus on reliability). The SLI should measure user-facing success, not internal health. Track error budget burn weekly — if consuming budget faster than planned, that is a reliability problem.

### Why is a policy technically correct but teams bypass it?

Before enforcing harder, diagnose: is the bypass in dev only or in production? Is it creating actual risk? Run interviews with teams who bypass most frequently. Usually the answer: the compliant path has a 10-minute setup overhead and the non-compliant path takes 30 seconds. Fix: make the correct path as fast as the bypass. If ergonomics cannot be fixed immediately, enforce at the production promotion gate only — teams have flexibility in dev but production requires compliance. That creates the right incentive without blocking development velocity.

---

## Pipeline Design Questions With Worked Answers

### Design a delivery system for a fintech with 50 product teams.

Key decisions:

1. Monorepo vs polyrepo: at 50 teams, polyrepo with a shared pipeline template library reduces blast radius when the platform changes. Each team owns their pipeline YAML; the platform team owns the reusable building blocks.

2. Artifact trust: every image gets a SHA tag, a Trivy scan, and a Cosign signature. No image enters production without a valid signature from the CI system. Admission webhook enforces this at the cluster level.

3. Secret management: Vault with namespace-scoped policies. Teams request dynamic short-lived database credentials rather than static passwords. CI jobs use OIDC, not stored API keys.

4. Progressive delivery: default canary rollout with Argo Rollouts for all payment-path services. Canary gate queries Prometheus for error rate and latency. Non-critical services use rolling update.

5. Compliance: every deployment generates a provenance attestation (SLSA 2 minimum). SBOM attached to every production image. ArgoCD project RBAC controls who can sync to production. All production syncs go to an immutable audit log.

6. Platform SLIs: deployment frequency, lead time for changes, change failure rate, MTTR, build success rate, P95 deploy duration.

### What happens when a CI pipeline is the source of a production incident?

Investigation path:
1. Identify what changed in the pipeline recently (shared library update, runner image update, workflow YAML change).
2. Determine which builds were affected and what artifacts they produced.
3. Check whether any anomalous builds were promoted before the problem was discovered.
4. If a pipeline change pushed a bad artifact: roll back using the previous artifact digest from the registry.
5. If the pipeline exposed secrets: rotate immediately, audit which jobs ran in the affected window.
6. Systemic fix: treat pipeline code as production code — version it, test it against a canary service before broad rollout, keep rollback paths.

### How do you validate that a database migration is safe before running it in production?

1. Run the migration in staging first, with production-like data volume.
2. Time the migration — long-running DDL locks tables and may cause production timeouts.
3. Check backward compatibility: can the previous application version run against the migrated schema? If not, the deploy cannot safely roll back.
4. Use expand-contract pattern for destructive changes: add the new column, deploy code that writes both, backfill, remove the old column only after old code is fully retired.
5. Take an RDS snapshot before applying to production.
6. Have a tested rollback script (restore snapshot or reverse migration) ready.

---

## Scoring Rubric Reference (Staff Level)

| Level | Indicators |
|---|---|
| Strong | Frames answers around tradeoffs and failure modes. Distinguishes centralized controls from team autonomy with reasoning. Names specific tools, APIs, and policies. Addresses blast radius before features. Includes rollback and auditability unprompted. |
| Medium | Correct on the technology layer but generic on tradeoffs. Can name tools but cannot explain the design decision behind choosing them. Treats security and reliability as separate concerns. |
| Weak | Describes technology without design decisions. Cannot explain what breaks first. Does not address blast radius, rollback, or auditability. Treats the question as a feature list. |
