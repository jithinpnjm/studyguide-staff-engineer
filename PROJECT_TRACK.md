# DevOps Knowledge Hub — Project Tracking

Last updated: 2026-05-18 (session 2)

## Project Overview

Enriching the devops-knowledge-hub portal with content from:
1. SRE-Challenges/interview-prep/foundations/ (AUTHORITATIVE — always use first)
2. SRE-Challenges/interview-prep/hands-on-labs/
3. SRE-Challenges/interview-prep/mock-interviews/
4. SRE-Challenges/interview-prep/foundations/aws/
5. PDFs in devops-knowledge-hub/source-pdfs/ (secondary, read with pdfplumber)
6. Web search for system design examples (when explicitly requested)

## Guiding Principles

- SRE docs are authoritative — never skip them when enriching domain guides
- PDF consolidated guides (consolidated_guides/) were Gemini-generated with quality issues — use as secondary only
- No data loss: always enrich, never replace good content
- No duplication: check what's already in portal files before adding

---

## Topic Enrichment Status

### ✅ COMPLETED

#### kubernetes-containers
- 08-troubleshooting.md: +271 lines — added 9 new scenarios (Pod Terminating, ContainerCreating, Sandbox failures, Namespace stuck, Certs expired, EXTERNAL-IP pending, Volume permission, Pod Unknown)
- 03-expert.md: +24 lines — Added Required Ports table
- 02-intermediate.md: +34 lines — Added OOM Score Adjustment section

#### general-devops
- 02-intermediate.md: +93 lines — Progressive Delivery, Artifact Strategy, OIDC federation, CI/CD Testing table
- 03-expert.md: +112 lines — Trusted Supply Chain (SBOM/Cosign/SLSA), Senior Signals by Domain
- 04-interview-questions.md: +44 lines — 4 new Q&A (build-once, mutable tags, SBOM, signing)
- 06-cheat-sheet.md: +32 lines — Incident Mitigation Priority Order, Anti-Patterns table
- 08-troubleshooting.md: +99 lines — 2 new scenarios (Works In Dev/Fails In Prod, Login Broken)

#### observability
- 08-troubleshooting.md: +195 lines — Runbook 9 (symptom-based flows: traffic drop, error spike, latency increase, alert storm), Runbook 10 (real incident patterns: CPU high/users fine, errors after deploy, users slow metrics fine, nightly noisy, dependency brownout), updated quick-reference table
- 03-expert.md: +126 lines — Cost optimization (metric/log/trace tiers, log sampling, PII scrubbing), Advanced PromQL (without, on, subqueries, predict_linear, absent, topk)

#### linux-systems
- 08-troubleshooting.md: +58 lines — Kubernetes Node Triage section (kubelet, crictl, node-to-cluster symptom table), Command Interpretation Table (10 commands with Answers/Bad Signs)
- 02-intermediate.md: +100 lines — Kernel Module Management (lsmod, modprobe, persistence), Memory Pressure PSI (/proc/pressure/*, cgroup v2), Kubernetes Node From Linux Perspective (crictl, node rescue sequence)
- 01-beginner.md: +34 lines — Load Average vs CPU (key distinction, interpretation table, D-state explanation)

---

### 🔄 IN PROGRESS / PARTIALLY DONE

#### infrastructure-as-code
- 02-intermediate.md: +190 lines — Terraform three-reality model (desired/recorded/actual), plan symbol table (+/~/−/−+/<=), force-replace trigger table, for_each vs count deep dive, Ansible rolling update with LB integration (serial/max_fail_percentage/pre_post tasks), Ansible GPU node configuration playbook (NVIDIA driver, kernel modules, containerd runtime, sysctl)

#### interview-prep
- 06-system-design-examples.md: Created — 9 end-to-end system design examples (K8s × 3, AWS × 4, GCP × 3), each with full architecture diagram, tradeoff table, SRE concern, services used; cross-cloud comparison table; 25-question interview bank

---

#### cicd-gitops
- SRE doc 08-cicd-trusted-delivery-and-platform-security.md reviewed
- PDF scan done — existing portal already covers Jenkins, ArgoCD, SonarQube extensively
- Status: Low gap, minimal enrichment needed
- TODO: Check 08-troubleshooting.md for missing Jenkins/GitOps failure scenarios

#### interview-prep (NEW SECTION)
- ✅ _category_.json created
- ✅ 01-linux-kubernetes-troubleshooting.md (Mock Interview 1 — 251 lines)
- ✅ 02-distributed-systems-resilience.md (Mock Interview 2 — 258 lines)
- ✅ 03-platform-cloud-security.md (Mock Interview 3 — 254 lines)
- ✅ 04-system-design-foundations.md (from SRE foundations/07-system-design-cloud-architecture.md)
- ✅ 05-python-coding-practice.md (LeetCode-style: 10 problems covering rate limiting, API, circuit breaker, error handling)
- 🔄 06-system-design-examples.md — web research in progress (background agent running)

#### cloud-platforms/aws (NEW SUBDIRECTORY)
- ✅ _category_.json created
- ✅ 27 AWS TopicWise files created (01-getting-started through 27-well-architected)

#### scripting-python/python-basics (NEW SUBDIRECTORY)
- ✅ _category_.json created
- ✅ 36 Python basics chapters copied from SRE prep-portal generated-docs

#### scripting-python/python-advanced (NEW SUBDIRECTORY)
- ✅ _category_.json created
- ✅ 9 Python advanced chapters + capstones copied from SRE prep-portal generated-docs

#### mlops
- ✅ 05-hands-on-labs.md: +85 lines — GPU/AI Platform Architecture Review lab (Lab 6)

---

### ⏳ NOT STARTED — Remaining Topics

#### infrastructure-as-code
- ✅ SRE docs applied (session 2)
- TODO: Check 08-troubleshooting.md and 04-interview-questions.md for remaining gaps from SRE incident stories

#### networking-service-mesh
- ✅ 02-intermediate.md: +145 lines — Service types deep comparison (ClusterIP/NodePort/LoadBalancer/ExternalName/Headless), ExternalTrafficPolicy (Cluster vs Local, source IP), headless services, topology-aware routing/hints, ndots:5 trap with mitigation, CoreDNS tuning (cache, max_concurrent, autopath)
- ✅ 08-troubleshooting.md: +215 lines — curl timing breakdown table (namelookup/connect/appconnect/TTFB), NGINX log analysis (jq, grep patterns, error messages), systematic packet-path debugging method (8-step), K8s networking command interpretation table, real incident patterns (selector mismatch, DNS namespace block, conntrack exhaustion, Ingress 502)
- TODO: 03-expert.md and 04-interview-questions.md gap check

#### aws-deep-dive
- SRE source: 14-aws-cloud-services-and-platform-design.md + aws/ subdirectory (27 files)
- AWS TopicWise already added to cloud-platforms/aws/
- TODO: Check aws-deep-dive portal files for gaps vs SRE 14-aws doc

#### scripting-bash-shell
- SRE source: 03-bash-and-shell-scripting.md
- PDF dir: devops-knowledge-hub/source-pdfs/scripting-bash-shell/
- Hands-on labs: SRE-Challenges/interview-prep/hands-on-labs/bash/ (3 labs)
- TODO: Read SRE bash doc, read PDFs, enrich portal

#### databases-storage
- ✅ 02-intermediate.md: +80 lines — Kafka DLQ consumer pattern (retry counter, poison message handling), cooperative-sticky partition assignment, common Kafka failure modes (rebalance storm, under-replicated, disk full), 4 Kafka interview Q&As (ordering, slow consumer, broker failure, Kafka vs SQS)
- TODO: Check 03-expert.md for remaining gaps

#### cloud-platforms
- ✅ AWS TopicWise subdirectory created (27 files)
- TODO: Check GCP content in SRE repo; existing cloud-platforms 8 files have ~6182 lines, may need gap analysis

#### security-devsecops
- ✅ 08-troubleshooting.md: +103 lines — Command packs by symptom (web service down, auth failure, TLS/cert, secret failure, rollout failure), anti-patterns table (8 patterns with why), senior incident response pattern (layer isolation, mitigation priority order, interview answer shape)

#### aiops
- ✅ 08-troubleshooting.md: +111 lines — GPU platform troubleshooting section: command interpretation table (nvidia-smi/topo/DCGM/Kueue), 5 failure scenarios (GPU not visible, Pod pending, CUDA fails, training slow, inference latency high), 4 real incident patterns (missing after upgrade, idle job, cold start outage, hardware failure), 4 interview Q&As with senior answer shape

#### platform-engineering
- ✅ 03-expert.md: +126 lines — Staff Engineer Operating Manual: what interviewers test, senior answer template (6-step), failure domain habit (9-scope table), symptom stack (app slow / cluster broken), mentor-mode good/better/great examples, system design order (9 constraints-first steps), 7 common staff traps table, senior signals by domain (Linux/Networking/K8s/Reliability), four-line self-check

#### system-design (interview-prep)
- ✅ Foundations added from SRE doc (04-system-design-foundations.md)
- 🔄 Real-world examples from web research (background agent running for K8s/AWS/GCP examples)
- TODO: When agent completes, create 06-system-design-examples.md

---

## PDF Reading Strategy

PDFs are in: devops-knowledge-hub/source-pdfs/<topic>/
Tool: pdfplumber (installed as pip3 install pdfplumber)

Noise to filter from PDFs:
- Social media handles (LinkedIn, YouTube, Instagram, Twitter)
- Course promotion text ("Click here for DevSecOps course")
- Author name spam (DevOps Shack, Shivam Agnihotri, Aditya Jaiswal, etc.)
- Page numbers alone
- Lines < 10 chars

Priority PDF topics to read (content not well-covered by SRE docs):
1. scripting-bash-shell/ — bash scripting patterns
2. databases-storage/ — SQL patterns, Kafka configuration
3. networking-service-mesh/ — service mesh deep dives
4. security-devsecops/ — security patterns and hardening

---

## Files Added This Session

| File | Type | Lines |
|---|---|---|
| interview-prep/_category_.json | config | new |
| interview-prep/01-linux-kubernetes-troubleshooting.md | mock interview | 252 |
| interview-prep/02-distributed-systems-resilience.md | mock interview | 258 |
| interview-prep/03-platform-cloud-security.md | mock interview | 254 |
| interview-prep/04-system-design-foundations.md | study guide | 413 |
| interview-prep/05-python-coding-practice.md | coding practice | ~250 |
| cloud-platforms/aws/_category_.json | config | new |
| cloud-platforms/aws/01-*.md ... 27-*.md | AWS TopicWise | 27 files |
| scripting-python/python-basics/_category_.json | config | new |
| scripting-python/python-basics/chapter-01 ... 36 | Python basics | 36 files |
| scripting-python/python-advanced/_category_.json | config | new |
| scripting-python/python-advanced/chapter-01 ... 09 | Python advanced | 9 files |
| mlops/05-hands-on-labs.md | enriched +85 lines | GPU lab |

---

## Next Steps (Priority Order)

1. ✅ 06-system-design-examples.md — DONE (session 2)
2. ✅ infrastructure-as-code — DONE (session 2)
3. ✅ networking-service-mesh — DONE (session 2)
4. ✅ scripting-bash-shell — portal already complete
5. ✅ databases-storage — DONE (session 2)
6. ✅ security-devsecops — DONE (session 2)
7. ✅ aiops — DONE (session 2: GPU troubleshooting)
8. ✅ platform-engineering — DONE (session 2: Staff Engineer Operating Manual)
9. ✅ cicd-gitops — DONE (session 3: 5 real incident stories, troubleshooting flows, 4 interview Q&As)
10. ✅ aws-deep-dive — DONE (session 3: 5 SRE incident playbooks, interview-ready explanations, cost engineering top-items)

---

## ALL MAJOR TOPICS COMPLETE ✅

Session 3 total: +321 lines across 2 files
Grand total across all sessions: 3,820+ lines added to 28 portal files

### Optional remaining work (low priority)
- PDF consolidation for scripting-bash-shell, databases-storage, networking-service-mesh (Gemini-generated, noisy secondary sources)
- cicd-gitops PDF review for Jenkins-specific scenarios (portal already has extensive Jenkins coverage)
