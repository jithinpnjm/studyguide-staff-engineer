---
title: "Mock Interview 3: Platform, Cloud, CI/CD, and Security"
sidebar_position: 3
---

# Mock Interview 3: Platform, Cloud, CI/CD, and Security

## Format and Intent

This is a 60-minute platform engineering interview testing breadth across cloud, security, and delivery pipelines with staff-level depth on tradeoffs. The interviewer expects you to reason about what to centralize versus what to delegate, where blast radius sits, and how security and reliability interact — especially where one undermines the other if poorly designed.

Questions are intentionally open-ended. Strong candidates narrow them by stating assumptions and constraints. Weak candidates treat every question as an invitation to describe a technology instead of a decision.

**Suggested timing per question:** 5–7 minutes for design questions, 3–4 minutes for conceptual/behavioral questions.

---

## Question 1

**"Design a secure internal platform on GCP for services running mainly on GKE."**

**Time guidance:** 7–8 minutes. This is a scoping question before it is a design question.

**What a strong answer covers:**
- Clarifies scope: number of teams, trust tiers, compliance requirements (SOC 2? internal only?), and whether this is greenfield or migration.
- Identity and access: Workload Identity for pod-level GCP credentials (no service account key files), IAM with least privilege, separate GCP projects per environment (dev/staging/prod) for blast radius isolation.
- Network: VPC with private GKE clusters, no public node IPs, Cloud NAT for egress, Private Service Connect or VPC peering for managed services, network policies inside the cluster enforced by Cilium or Calico.
- Secret management: Secrets Manager or Vault, mounted at runtime via the CSI driver — not baked into images.
- Supply chain: Artifact Registry with Container Analysis for vulnerability scanning, Binary Authorization policy to block unscanned or unsigned images in prod.

**What a weak answer looks like:**
- "I'd use GKE with Cloud SQL and Pub/Sub." Names GCP services but does not address identity model, network segmentation, or secret handling.
- Treats this as a capacity design question rather than a security architecture question.

**Sample answer skeleton:**
> "My first constraints: private cluster (no public node or master IPs), Workload Identity for pod credentials (no key files in Secrets), and per-environment GCP projects so a misconfigured dev workload cannot reach prod. Network-wise: GKE inside a private VPC, Cloud NAT for outbound, Shared VPC if multiple projects need connectivity, and Cilium NetworkPolicies for east-west control inside the cluster. For secrets: Secrets Manager accessed via the CSI secrets driver, not via env vars in manifests. For the supply chain: Artifact Registry with binary scanning, and a Binary Authorization policy in prod that requires an attestation from the scanning pipeline before a pod can be scheduled. For audit: Cloud Audit Logs to BigQuery with 1-year retention."

---

## Question 2

**"What parts of that design would change in AWS, and what should stay conceptually the same?"**

**Time guidance:** 4–5 minutes. This tests portable principles versus vendor-specific mechanics.

**What a strong answer covers:**
- What stays the same: least privilege identity per workload, private network topology, secrets at runtime not in images, per-environment account isolation, signed/scanned artifact policy.
- What changes mechanically: IAM Roles for Service Accounts (IRSA) replaces Workload Identity; AWS Secrets Manager or Parameter Store replaces GCP Secrets Manager; ECR replaces Artifact Registry; security groups plus VPC CNI replace Cloud NAT and Cilium; EKS managed node groups replace GKE node pools.
- Important differences: AWS's multi-account model with AWS Organizations and SCPs is more mature than GCP's folder/project model for enforcing guardrails at scale; AWS PrivateLink for service connectivity.
- The candidate should emphasize that the principles (isolation, least privilege, runtime secrets, supply chain integrity) do not change, only the implementation APIs.

**What a weak answer looks like:**
- Lists AWS equivalents of GCP services without discussing why the principles are portable or where the gaps are.

**Sample answer skeleton:**
> "The conceptual model stays identical: workload identity, private networking, runtime secrets, per-environment isolation, and artifact integrity. The mechanics change. Workload Identity becomes IRSA — IAM roles annotated on Kubernetes service accounts, with the OIDC provider federation managed by EKS. Private cluster networking uses the VPC CNI and private API server endpoint. Secrets use Secrets Manager via the CSI driver or Parameter Store for simpler cases. Artifact supply chain uses ECR with image scanning and a Lambda-backed admission webhook if you want the equivalent of Binary Authorization. The one area where AWS is structurally different is isolation: I'd use AWS Organizations with SCPs to enforce guardrails across accounts, which is more powerful than GCP folder-level IAM."

---

## Question 3

**"How do you know what is running in production came from reviewed source?"**

**Time guidance:** 5 minutes. This is a supply chain security question with operational depth.

**What a strong answer covers:**
- Source-to-image traceability: CI builds are triggered from reviewed commits on protected branches; the image is tagged with the git SHA and built only by the CI system (not developer laptops).
- Image signing: use Cosign to sign images at build time with a key held in the CI system or via keyless signing with OIDC (Sigstore). The signature is stored in the registry alongside the image.
- Admission control: a ValidatingWebhookConfiguration in the cluster verifies the Cosign signature before allowing image scheduling. Images without a valid signature are rejected.
- SBOM generation: the build pipeline produces a Software Bill of Materials attached to the image, enabling vulnerability correlation against the production inventory.
- Audit trail: the registry's push logs tied to CI job IDs, combined with Kubernetes audit logs showing which image was admitted, provide end-to-end traceability.

**What a weak answer looks like:**
- "We use CI/CD to build images from source." Does not address signing, admission control, or how you prove it at runtime.

**Sample answer skeleton:**
> "The chain has four links. First, builds only run in CI on commits that passed code review on a protected branch — no developer can push an image directly to the production registry. Second, the CI pipeline signs the image with Cosign using keyless signing against our OIDC provider, so the signature attests to the CI job and commit that produced it. Third, in the production cluster, a Cosign admission webhook rejects any image that lacks a valid signature from our CI identity. Fourth, we attach an SBOM to every image at build time — this lets us query 'which production pods contain this vulnerable library' without guessing. The audit trail is: git commit, CI job ID, image digest, signature, and admission log entry."

---

## Question 4

**"How would you design a multi-tenant CI platform with different trust levels?"**

**Time guidance:** 6 minutes. Distinguish the trust levels first, then design for each.

**What a strong answer covers:**
- Defines trust tiers explicitly: external contributors (OSS repos), internal developers, platform team, production deploy agents — each with different privilege levels.
- Isolation model: namespace-level isolation for low-trust jobs, separate node pools with taints for medium-trust, entirely separate clusters for production deploy agents.
- Secrets: low-trust jobs have no access to production secrets. Secrets are injected at execution time by the CI platform only for jobs that have passed review gates.
- Network: CI job pods should not have broad egress to internal services. Network policies restrict CI workloads to only the registries and build caches they need.
- Ephemeral environments: each build runs in an ephemeral namespace that is deleted post-run to prevent state leakage between tenants.

**What a weak answer looks like:**
- "Use separate namespaces per team." Namespaces are not a strong isolation boundary in Kubernetes — this misses network, secrets, and node-level isolation.

**Sample answer skeleton:**
> "I'd model three trust tiers. Untrusted builds — PRs from forks or external contributors — run in ephemeral pods on a dedicated node pool with no egress beyond the build cache and registry. They get no secrets. Medium-trust builds — internal team CI — run in namespace-isolated jobs with access to non-production secrets via Vault dynamic credentials, network egress scoped to internal artifact stores. High-trust deploy jobs — production releases — run on a separate, hardened node pool with audited secret access, require a promotion approval gate, and are scoped to only the service account and namespace they deploy to. The separation is: node pool taints enforce workload placement, network policies enforce egress, and Vault policies enforce which secrets each tier can request. Ephemeral namespaces guarantee no state leaks between runs."

---

## Question 5

**"What are the most important default guardrails for product teams?"**

**Time guidance:** 4–5 minutes. Think about defaults that protect without blocking.

**What a strong answer covers:**
- Resource requests and limits via LimitRanges: prevents unbounded resource consumption by teams that omit them.
- NetworkPolicy default-deny: all pods start with no ingress/egress and teams declare what they need. Prevents lateral movement by default.
- Non-root enforcement via PodSecurityAdmission (restricted profile): containers cannot run as UID 0 by default, reducing privilege escalation risk.
- Image pull policy Always for mutable tags in non-dev environments: prevents stale cached image execution.
- Namespace-level ResourceQuotas: prevents one team from consuming all cluster capacity during an incident or misconfiguration.

**What a weak answer looks like:**
- Lists features without explaining the threat they address or the failure mode they prevent.

**Sample answer skeleton:**
> "I'd default five guardrails. One: LimitRanges that inject default CPU and memory requests/limits — this ensures scheduling works and prevents noisy-neighbor OOM kills. Two: PodSecurityAdmission at restricted, applied namespace-wide — no root containers, no privilege escalation, no host namespace sharing. Three: a default-deny NetworkPolicy in every namespace — teams declare the ports they need; unknown traffic is blocked. Four: ResourceQuotas per namespace so one team can't accidentally exhaust cluster capacity during a misconfiguration incident. Five: OPA/Kyverno policies that enforce image origin from the approved registry and deny images without a recent scan attestation. These are all applied by platform automation on namespace creation — teams don't need to remember them."

---

## Question 6

**"How would you implement break-glass access without undermining normal safety controls?"**

**Time guidance:** 5 minutes. Break-glass is an incident tool, not an escape hatch from process.

**What a strong answer covers:**
- Break-glass accounts are pre-provisioned, stored in a secure vault, and time-limited: access grants expire after a fixed window (e.g., 4 hours) with no renewal without explicit re-justification.
- Every use generates an immutable audit log entry: who accessed it, when, from which IP, and what justification was provided.
- Alert on every use: break-glass access should immediately notify the security team and the on-call SRE manager, even if it was legitimate. No silent break-glass use.
- Post-use review: the access session produces a record that feeds into a mandatory post-incident review. Was it necessary? Could normal access paths have handled it?
- Normal controls are not bypassed silently: break-glass bypasses approval workflows but does not disable audit logging, MFA, or network access controls.

**What a weak answer looks like:**
- "We have a shared admin password in a password manager." No auditability, no time limits, no alerting.

**Sample answer skeleton:**
> "Break-glass access is an emergency override that must leave a louder audit trail than normal access, not a quieter one. Implementation: a dedicated service account per cluster stored in Vault under a break-glass policy. Checking it out requires MFA, a required justification field, and creates an immediate PagerDuty alert to the security on-call. The credential is valid for 4 hours. All API actions taken during the break-glass session are tagged in the Kubernetes audit log with the break-glass credential, which is distinct from normal service account tokens. After the incident, the break-glass key is rotated and the session record is reviewed within 24 hours. The review asks: what was done, was it necessary, and what process change prevents the need next time."

---

## Question 7

**"A policy is technically correct but teams constantly bypass it. What do you do?"**

**Time guidance:** 4 minutes. This is behavioral with platform design implications.

**What a strong answer covers:**
- Diagnoses why before reacting: is the bypass happening because the policy is too restrictive, because the tooling makes compliance harder than non-compliance, or because teams don't understand the risk?
- Measures the bypass rate and its impact: is this causing actual security or reliability incidents, or is it theoretical risk?
- Engages teams as partners: holds office hours or interviews with the engineering teams to understand the friction point.
- Makes the correct path easier than the bypass: if teams bypass because the approved secret manager is slow and the env var is fast, fix the secret manager's performance.
- Enforces selectively at high-risk chokepoints (production deploy) while giving flexibility in lower-risk environments, rather than applying maximum friction everywhere.

**What a weak answer looks like:**
- "We'd enforce it harder with OPA and reject all non-compliant workloads." Does not address why teams bypass, and risks adversarial relationship.

**Sample answer skeleton:**
> "Before I tighten enforcement, I want to understand the bypass pattern. Are teams bypassing in dev only, or in production? Is the bypass creating actual risk — are secrets ending up in logs, or is it a theoretical concern? I'd start by running a 30-minute interview with two or three of the teams who bypass most frequently. Usually the answer is: the compliant path has a 10-minute setup overhead and the non-compliant path takes 30 seconds. The fix is ergonomic: make the correct path as fast as the bypass. If I can't fix the ergonomics immediately, I'd enforce the policy only at the production promotion gate — teams have flexibility in dev, but production requires compliance. That creates the right incentive without blocking development velocity."

---

## Question 8

**"How do you balance platform standardization with cloud-native advantages?"**

**Time guidance:** 4–5 minutes. This is a philosophical tradeoff question — give a concrete framework.

**What a strong answer covers:**
- Standardization reduces cognitive load, enables centralized security and compliance enforcement, and makes on-call rotation possible across services.
- Over-standardization blocks teams from using managed services that would reduce their operational burden — forcing teams to run their own database when Cloud SQL would work creates more operational risk, not less.
- The right model is opinionated defaults with an escape valve: the platform provides a golden path (standard k8s deployment, standard ingress, standard metrics pipeline) that works for 80% of use cases without configuration. Teams can opt out with justification.
- Standardize on interfaces, not implementations: standardize on how services expose health endpoints, metrics, and traces. Don't mandate which framework or language.
- Escape valve has a cost: teams that opt out own their operational burden for the deviation. Platform team will not debug or on-call for non-standard configurations.

**What a weak answer looks like:**
- "Standardization is important but teams need flexibility." True but says nothing about how to make that tradeoff operationally.

**Sample answer skeleton:**
> "I use the golden path model: the platform provides a default stack that handles 80% of cases with minimal configuration — standard Helm chart conventions, standard sidecars, standard alert rules pre-baked. This is the path of least resistance. For the 20% of cases where a team needs something different — say, a stateful workload that needs a specific storage class, or a latency-sensitive service that can't tolerate a sidecar — they can deviate, but they own the operational burden of the deviation and must document the justification. What I always standardize regardless of deviation: the observability interface (how you expose metrics, logs, and traces), the identity interface (what service account you use), and the admission policy (what the cluster will accept). These are the seams where cross-cutting concerns live. The implementations can vary."

---

## Question 9

**"What signals tell you your delivery platform itself is becoming a reliability risk?"**

**Time guidance:** 4 minutes. The platform is usually the last thing teams think to instrument.

**What a strong answer covers:**
- CI build success rate trending downward: flaky infra causes flaky builds, which causes teams to re-run and lose confidence.
- Mean time to deploy increasing: if a deployment that used to take 5 minutes now takes 25, the platform is accumulating hidden debt.
- Rollback frequency increasing without corresponding deploy frequency increase: teams are deploying but reverting more, which may indicate the validation pipeline is failing to catch regressions.
- Teams building shadow pipelines: a strong signal that the official platform is not trusted or not fast enough.
- Incident involvement of the platform team: if SREs or developers raise platform bugs during production incidents, the platform has become a reliability dependency in the wrong direction.

**What a weak answer looks like:**
- "I'd monitor the CI pipeline." Too vague — no specific signals, no trend analysis.

**Sample answer skeleton:**
> "I'd track five platform-specific SLIs. First: build success rate — if the rate of 'infra error' build failures exceeds 2%, the platform is unreliable. Second: P95 deploy duration — this should be stable or decreasing; a 20% increase over a quarter is a signal. Third: rollback rate per deployment — if this climbs, validation is insufficient or the platform is introducing regressions. Fourth: the number of teams that have created their own pipelines outside the standard one — this is a behavioral signal that the platform has failed to meet their needs. Fifth: platform team involvement in production incidents — if we appear in three post-incident reviews in a month as a contributing factor, we are a reliability risk."

---

## Question 10

**"Describe a platform incident that starts as a security concern and turns into a reliability incident."**

**Time guidance:** 6 minutes. Use a real or realistic scenario. Show the causal chain.

**What a strong answer covers:**
- The scenario has a clear moment where a security action (revocation, rotation, policy change) causes a reliability impact that was not anticipated.
- The candidate explains the failure chain, not just the endpoints.
- Names the detection and response timeline, with specific tools and signals.
- Explains what the platform team should have done differently to prevent the reliability impact.
- Ends with a systemic change (not just "we fixed the secret").

**What a weak answer looks like:**
- "A credential leaked and we had to rotate it, which caused downtime." No causal chain, no platform design lesson.

**Sample answer skeleton:**
> "A security scan flagged a long-lived service account key that had been committed to a repository six weeks prior. The correct response was to revoke it immediately. The platform team revoked the key at 14:00. Within 4 minutes, 40% of production pods began failing auth to Cloud Storage — the key had been distributed as a Kubernetes Secret across 6 clusters as part of a legacy integration that wasn't in the platform's inventory. The security team had revoked it without checking blast radius. We restored service by issuing a new short-lived key via Workload Identity, but the incident lasted 22 minutes. The systemic fix: credential inventory — all credentials in the platform must be registered with their consuming services, so that any rotation or revocation runs through a blast-radius check first. And Workload Identity for everything new, so there's nothing long-lived to revoke."

---

## Interviewer Follow-Up Pressure Questions

These are injected mid-answer to test depth. Prepare a 60-second response to each:

- **"Where is the real blast radius?"** — Which teams, services, or environments would be affected if this policy fires incorrectly or this component fails?
- **"What would you centralize?"** — Name the specific responsibilities that belong to the platform team, with a reason.
- **"What would you leave to teams?"** — Name what decentralization enables and what risk it accepts.
- **"What is the rollback story?"** — For a policy change, a platform upgrade, or a security control: how do you revert it, and what is the recovery time?
- **"What does auditability mean in practice?"** — Not just "we have logs." Who reads them, how frequently, and what action do they trigger?

---

## Scoring Rubric

| Level | Indicators |
|-------|-----------|
| Strong | Frames answers around tradeoffs and failure modes. Distinguishes centralized controls from team autonomy with reasoning. Names specific tools, APIs, and policies. Addresses blast radius before features. Includes rollback and auditability unprompted. |
| Medium | Correct on the technology layer but generic on tradeoffs. Can name tools but cannot explain the design decision behind choosing them. Treats security and reliability as separate concerns. |
| Weak | Describes technology without design decisions. Cannot explain what breaks first. Does not address blast radius, rollback, or auditability. Treats the question as a feature list rather than a system design problem. |

---

## Self-Debrief Template

After each practice run, write one sentence per item:

1. On Q1, did you state isolation model and identity model before naming GCP services?
2. Which answer treated security and reliability as if they were independent?
3. Did you address blast radius on at least 3 of the 10 questions?
4. Where did you describe a technology instead of a decision?
5. Which question exposed a gap in your knowledge of a specific tool or mechanism?
6. What is one platform principle you articulated clearly, and one you would strengthen before the next run?
