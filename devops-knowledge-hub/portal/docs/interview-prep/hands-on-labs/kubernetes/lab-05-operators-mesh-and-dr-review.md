---
title: "Kubernetes Lab 5: Operators, Mesh, Policy, And Disaster Recovery Review"
sidebar_position: 99
---

# Kubernetes Lab 5: Operators, Mesh, Policy, And Disaster Recovery Review

## Scenario

A platform team has been running Kubernetes for two years. They have accumulated 11 operators, enforce admission policy using Kyverno, are debating whether to add Istio, and claim the cluster is "DR-ready." A new staff engineer joins and is asked to review the platform.

Your job is to review it critically and produce a written assessment.

## Prerequisites

Before attempting this lab, you should be comfortable with:

- What a Kubernetes controller and operator are, and how they interact with the API server
- Kubernetes admission webhooks — what validating and mutating webhooks do
- etcd as the cluster state store — backup, restore, and quorum behavior
- What a service mesh does and how sidecar injection works
- Concepts of multi-cluster failover versus in-cluster redundancy

Foundation reading: [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md), [../../foundations/02-linux-kubernetes-foundations.md](../../foundations/02-linux-kubernetes-foundations.md)

## Time Estimate

60-90 minutes for a written design review. 20-30 minutes additional for pressure questions.

---

## How To Think About This

Before writing anything, decompose the platform into its risk layers. Most interview answers for this scenario are too abstract — "operators add complexity" without saying what kind, or "DR requires multi-cluster" without explaining what multi-cluster actually solves.

**Layer 1: Operator risk taxonomy**
Ask: what can a broken operator do to the cluster? What is the failure blast radius of each category of operator?

**Layer 2: Admission policy as reliability surface**
Ask: a Kyverno policy that blocks a deployment is an outage. How do you design policy so it helps rather than causes incidents?

**Layer 3: Service mesh decision**
Ask: what specific problem are you solving with a mesh? What overhead does it add? Are there paths where it actively makes things worse?

**Layer 4: etcd, cluster, and application recovery are three different things**
Ask: most "DR plans" conflate these. Can you restore etcd without losing a specific stateful application? Can you fail over an application without rebuilding the cluster?

**Layer 5: What DR-ready actually means**
Ask: is the DR plan documented? Has it been tested? How long is the RTO? Do the SLAs match the stated recovery target?

---

## Building Blocks

These are the tools and concepts relevant to this design. You do not need to use all of them.

| Component | What it does |
|---|---|
| Kubernetes controller | Reconciliation loop that watches resources and drives toward desired state |
| Operator | A controller that encodes domain-specific operational logic for a custom resource |
| Validating admission webhook | Allows or denies API requests before they are persisted |
| Mutating admission webhook | Modifies API requests before they are persisted |
| Kyverno | Policy engine for Kubernetes — enforce, audit, or mutate resource definitions |
| OPA/Gatekeeper | Alternative policy engine using Rego for more complex policy logic |
| Istio (sidecar mode) | Service mesh with per-pod sidecar proxies; adds mTLS, traffic control, telemetry |
| Istio (ambient mode) | Service mesh without per-pod sidecars; uses node-level proxies |
| Cilium | eBPF-based CNI that can provide mesh-like capabilities without sidecars |
| etcd | The key-value store that holds all Kubernetes cluster state |
| Velero | Kubernetes backup tool — snapshots object state and persistent volumes |
| Cluster API | Declarative cluster lifecycle management — useful for DR and recreation |
| PodDisruptionBudget | Guarantees minimum pod availability during voluntary disruptions |
| ValidatingWebhookConfiguration | Kubernetes object that registers an admission webhook |

---

## Beginner Starter Skeleton

This gives you approximately 30% of a complete answer. Use it to get started, then extend it.

**Operator risk starting point:**

Not all operators carry the same risk. A useful starting taxonomy:

- operators that only manage their own CRDs and don't touch core Kubernetes objects — low blast radius
- operators with mutating webhooks or cluster-level RBAC — higher blast radius
- operators that patch Pods or Nodes directly — highest blast radius; a bug here can affect every workload

**Admission policy failure mode to address first:**

A failing webhook is not the same as a rejecting webhook. If a Kyverno policy is set to `Fail` mode and the Kyverno pods are unavailable, the API server will reject all requests that need to pass that webhook — including deployments, scaling, and self-healing.

```yaml
# Webhook timeout and failure policy example
webhooks:
  - name: validate.kyverno.svc
    failurePolicy: Ignore   # or Fail — this choice has large operational consequences
    timeoutSeconds: 10
```

**Service mesh decision starting point:**

A service mesh gives you mTLS, traffic observability, and fine-grained routing control. The cost is operational complexity, sidecar injection risk, and increased blast radius for any mesh control plane failure. You should only adopt it when you have a specific unmet need that cannot be addressed with existing tooling.

**DR separation starting point:**

DR for this cluster requires three separate answers:
- etcd backup and restore
- cluster rebuild (control plane)
- application-level recovery (stateful data, not just object definitions)

These are not the same problem. Conflating them is how teams claim DR-readiness without actually having it.

---

## Tasks

Complete these in order. Write your answer as a design review document.

**Task 1: Operator risk model**

The platform runs 11 operators. Categorize them by risk class using the taxonomy from the skeleton. For each risk category:
- describe what a failure in that category looks like at runtime
- describe what Kubernetes behavior changes when that operator is unhealthy
- describe how you would detect a failure quickly

Address specifically: can a broken operator prevent healthy pods from being scheduled or from passing admission?

**Task 2: Admission policy strategy**

The platform uses Kyverno. Audit the design:
- which policies should be in `Enforce` mode and which should be in `Audit` mode?
- what is your policy for `failurePolicy: Fail` versus `failurePolicy: Ignore`?
- how do you safely roll out a new policy without risking an outage?
- what happens to existing workloads when Kyverno itself is restarted or upgraded?

Describe at least one concrete scenario where a well-intentioned policy caused an incident and how you would prevent it.

**Task 3: Service mesh decision framework**

The team wants to add Istio. Write a decision framework:
- what specific requirements would justify adopting a service mesh?
- what overhead does Istio sidecar mode add to every pod startup, restart, and upgrade?
- under what circumstances would you recommend ambient mode or Cilium instead?
- what does the mesh control plane failure look like, and how do you design for it?

State whether you would recommend adopting Istio in this scenario given what you know, and explain why.

**Task 4: etcd backup and restore**

Describe your etcd backup strategy:
- what is the minimum backup frequency for a production cluster?
- what does a restore procedure look like at a high level?
- what data is NOT in etcd that you still need to recover a functional cluster?
- how do you verify that a backup is actually restorable before you need it?

**Task 5: Stateful workload recovery**

The cluster runs stateful workloads. Describe:
- the difference between recovering the Kubernetes object definitions and recovering the actual data
- how Velero fits into the picture and where it falls short
- what a recovery playbook for a specific stateful application would contain that a generic etcd restore does not

**Task 6: What DR-ready actually requires**

The team says the cluster is "DR-ready." Write a checklist of what that claim would actually require to be true. Include:
- documentation and test frequency requirements
- RTO and RPO defined for each workload class
- separation between cluster-level and application-level recovery
- the difference between passive DR (can you recover?) and active DR (can you fail over?)

Be specific about what common "DR-ready" claims are actually false confidence.

---

## What A Beginner Answer Looks Like

A beginner answer identifies that operators add complexity and that admission policies can block deployments. It mentions etcd backups. It says a service mesh gives you mTLS and observability. It may recommend Istio without a clear requirement. It does not distinguish etcd recovery from application data recovery. It does not address `failurePolicy` behavior or webhook availability as a reliability concern. It does not define what RTO and RPO would look like for different workload classes.

## What An Intermediate Answer Looks Like

An intermediate answer categorizes operator risk by blast radius and identifies mutating webhooks as particularly dangerous. It explains the `failurePolicy: Fail` trap clearly. It distinguishes service mesh adoption requirements from nice-to-have features. It correctly separates etcd backup from application data backup. It recognizes that Velero snapshots object definitions and PV data but does not capture in-memory application state. It may still be vague about DR testing cadence and RTO/RPO definitions.

## What A Strong Answer Looks Like

A strong answer includes everything in the intermediate answer and adds:
- a specific operator health monitoring strategy — not just "watch logs," but probing CRD reconciliation lag and webhook response time as platform signals
- concrete policy rollout stages: audit mode first, enforce on new namespaces, enforce broadly only after validation
- an honest assessment of mesh overhead per pod: startup latency, sidecar memory budget, certificate rotation events
- a distinction between ambient mode mesh (no sidecar, node-proxy) and sidecar mode mesh, and when ambient is preferable
- a DR test protocol that includes actual restore drills, not just "we have backups"
- separate RTO and RPO statements for the control plane, for stateless services, and for stateful applications
- recognition that multi-cluster does not solve DR unless you have active-active data replication or accept data loss on failover

---

## Interviewer Pressure Questions

These are questions a strong interviewer will ask after your initial answer. Prepare a response for each.

1. You said operators with mutating webhooks are high risk. One of the 11 operators is a certificate manager with a mutating webhook. How do you safely upgrade it without downtime?
2. You recommended `failurePolicy: Ignore` for non-critical policies. What is the security exposure if the Kyverno pod crashes during a deployment event?
3. The team adopted Istio. An engineer pushed a DestinationRule that routed all traffic for a service to a non-existent subset. The service went down. How did this happen and how do you prevent it?
4. You described etcd backup and restore. etcd is restored successfully, but the cluster is still not functional. What are the three most likely causes?
5. A DR drill reveals the restore procedure takes 4 hours but the SLA says 1 hour RTO. What do you do?
6. The platform has 11 operators. Three of them are rarely used. What do you do with them?

---

## Deliverable Guidance

Your answer should include:

- a written operator risk classification (can be a table with each category, blast radius, and detection method)
- a written policy governance section covering failurePolicy, rollout stages, and a concrete incident example
- a service mesh recommendation with explicit reasoning — adopt, defer, or use alternative
- a separation of recovery concerns: etcd, cluster, application data (these must be treated as three different problems)
- a DR-readiness checklist with at least six concrete criteria beyond "we have backups"

Avoid hand-wavy phrases like "multi-cluster solves this" or "we would add monitoring." Every recommendation should have a reason and a failure mode.

---

## What To Study Next

- [lab-04-gpu-ml-ai-platform-review.md](lab-04-gpu-ml-ai-platform-review.md) — if you have not done it, GPU platform design
- [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md) — operators and admission depth
- [../../foundations/09-observability-slos-and-incident-response.md](../../foundations/09-observability-slos-and-incident-response.md) — SLO design and incident management
- Kubernetes operator pattern: https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
- Kubernetes policies: https://kubernetes.io/docs/concepts/policy
- Operating etcd clusters: https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/
- Istio architecture: https://istio.io/latest/docs/ops/deployment/architecture/
- Istio ambient overview: https://istio.io/latest/docs/ambient/overview/
