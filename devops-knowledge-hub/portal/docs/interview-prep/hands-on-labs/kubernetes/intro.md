---
title: "Kubernetes Labs"
sidebar_position: 0
---

# Kubernetes Labs

These labs cover the operational Kubernetes skills that matter most in senior SRE and platform engineer interviews: object behavior, scheduling, service networking, rollout safety, and advanced platform design for GPU and AI workloads.

## Why This Track Matters Operationally

Kubernetes is the dominant compute platform for cloud-native services. Interviewers test whether you understand what actually happens when a pod fails to schedule, when a rollout gets stuck, or when a node goes under memory pressure — not just the theory. Labs 1-3 are hands-on command exercises. Labs 4-5 are architecture design reviews that simulate the kind of whiteboard question asked at senior and staff levels.

## Prerequisites

For labs 1-3:
- Comfortable with `kubectl get`, `describe`, `logs`, `exec`, and `apply`
- Understand what a Deployment, ReplicaSet, Pod, and Service are
- Know how Kubernetes DNS works for Service discovery
- Know what readiness and liveness probes do and when they trigger

For labs 4-5 (advanced design labs):
- Understand node pools, taints, tolerations, node affinity, and ResourceQuota
- Basic familiarity with Kubernetes operators and admission webhooks
- Some exposure to what Kubeflow Trainer, KServe, Kueue, and Istio are for

Foundation reading: [../../foundations/02-linux-kubernetes-foundations.md](../../foundations/02-linux-kubernetes-foundations.md), [../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md](../../foundations/12-kubernetes-gpu-ai-platforms-and-operators.md)

## Labs

### Hands-On Operational Labs

1. [lab-01-pod-service-debug.md](lab-01-pod-service-debug.md) — Debug a pod that is Running but not reachable through its Service. Diagnose label mismatches, selector gaps, and DNS resolution failures. Supporting manifests: `manifests/demo-app-bad-readiness.yaml`, `manifests/demo-service-mismatch.yaml`.
2. [lab-02-rollout-and-probes.md](lab-02-rollout-and-probes.md) — Fix a deployment whose rollout is stuck due to a misconfigured readiness probe. Understand rollout pause behavior and how to safely intervene. Supporting manifests: `manifests/demo-app-good-readiness.yaml`.
3. [lab-03-node-pressure-and-scheduling.md](lab-03-node-pressure-and-scheduling.md) — A pod is in Pending state due to node resource pressure. Diagnose the scheduling failure, understand eviction behavior, and fix the resource requests. Supporting manifests: `manifests/resource-pressure-pod.yaml`.

### Architecture Design Labs

4. [lab-04-gpu-ml-ai-platform-review.md](lab-04-gpu-ml-ai-platform-review.md) — Design a Kubernetes platform for GPU training jobs, inference services, batch workloads, and multi-tenant cost control. Reference answer available: `reference-answer-gpu-ml-ai-platform.md`.
5. [lab-05-operators-mesh-and-dr-review.md](lab-05-operators-mesh-and-dr-review.md) — Review a platform with many operators, admission policies, a proposed service mesh, and a claimed DR posture. Produce a critical written assessment.

## Supporting Manifests

- [manifests/demo-app-bad-readiness.yaml](manifests/demo-app-bad-readiness.yaml)
- [manifests/demo-app-good-readiness.yaml](manifests/demo-app-good-readiness.yaml)
- [manifests/demo-service-mismatch.yaml](manifests/demo-service-mismatch.yaml)
- [manifests/resource-pressure-pod.yaml](manifests/resource-pressure-pod.yaml)

## Learning Progression

**Beginner (labs 1-2):** you can apply manifests, describe resources, and read event output to identify the failure. You fix label mismatches and probe configuration.

**Intermediate (lab 3):** you understand scheduling constraints and node pressure signals. You can read Pending events and trace why the scheduler rejected a pod.

**Advanced (labs 4-5):** you design multi-workload platforms with isolation, quota, and admission policy. You review existing platforms critically, identify gaps in DR posture, and reason about mesh adoption tradeoffs.

## How To Use These Labs

1. For labs 1-3: apply the manifests, observe the broken state, and diagnose it — do not look at the lab's solution section until you have a hypothesis.
2. For labs 4-5: write a full structured answer before reviewing the rubric. These are design reviews, not command exercises.
3. Time yourself: labs 1-3 should take 30-45 minutes each. Labs 4-5 are 60-90 minute design exercises.
4. After each lab, identify which parts of your answer were weaker and reread the relevant foundation guide.
5. For labs 4-5, read your answer back as if you are the interviewer — does it have reasoning or just enumeration?

## Tools You Need

- `kubectl` installed: https://kubernetes.io/docs/tasks/tools/
- A local Kubernetes cluster:
  - `kind` (recommended): https://kind.sigs.k8s.io/docs/user/quick-start/
  - `minikube`: https://minikube.sigs.k8s.io/docs/commands/start/
- For GPU labs (4): a cluster with GPU nodes is not required — this is a design exercise
- Docker (required by kind): https://docs.docker.com/get-docker/

## Success Criteria

After completing all five labs you should be able to:

- diagnose a pod-service connectivity failure using only `kubectl` in under 10 minutes
- explain why a rollout is stuck and safely intervene without data loss
- read scheduler events and explain why a pod is Pending due to resource constraints
- design a GPU platform architecture with clear workload isolation, cost governance, and failure handling
- review a Kubernetes platform's DR posture and identify what "DR-ready" actually requires to be true

Helpful references:
- DNS for Services and Pods: https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
- Node pressure eviction: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
- GPU scheduling: https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/
- Operator pattern: https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
- NVIDIA device plugin: https://nvidia.github.io/k8s-device-plugin/
- Kueue: https://kueue.sigs.k8s.io/docs/tasks/
- Kubeflow Trainer: https://www.kubeflow.org/docs/components/trainer/overview/
- KServe: https://kserve.github.io/website/docs/admin-guide/overview
- Istio architecture: https://istio.io/latest/docs/ops/deployment/architecture/
- Istio ambient: https://istio.io/latest/docs/ambient/overview/
