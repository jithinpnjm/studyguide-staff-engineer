---
title: "Reference Answer: GCP Public Platform"
sidebar_position: 99
---

# Reference Answer: GCP Public Platform

Use this as a quality bar, not as something to memorize word for word.

It is intentionally opinionated and concise enough to be deliverable in an interview, while still covering senior-level concerns.

## 1. Requirements And Assumptions

I would first clarify these assumptions:

- global customer traffic, mostly read-heavy with some write APIs
- p99 latency matters for the API tier
- availability target is high enough that zonal loss must be tolerated without major user impact
- full regional failover may be required for critical paths, but data correctness matters more than instant global failover for all writes
- security requires internet-facing protection, strong workload identity, private data access, auditability, and safe delivery

I would also split the system into:

- edge and traffic-control layers
- stateless request-serving layers
- stateful persistence layers
- asynchronous processing layers
- observability and delivery-control layers

## 2. High-Level Architecture

I would design the public path roughly like this:

1. public DNS resolves the API hostname
2. traffic hits Cloud CDN only for cacheable paths
3. requests pass through Cloud Armor and external HTTP(S) load balancing
4. traffic routes to a regional stateless API tier running on GKE or Cloud Run
5. the API checks cache first for read-heavy paths
6. write or uncached reads use a private relational database such as Cloud SQL, ideally through private networking
7. non-critical or async follow-up work is published to Pub/Sub
8. worker services consume from Pub/Sub and update downstream systems
9. observability captures metrics, logs, traces, and deployment events

For this scenario, I would probably prefer GKE if:

- there are many services
- I need strong rollout control and platform standardization
- some services are latency-sensitive or need richer runtime tuning

I would prefer Cloud Run if:

- the API is simpler, stateless, and traffic elasticity matters more than cluster-level control

## 3. Network And Security Boundaries

I would explicitly separate:

- public entry: DNS, CDN, external LB, WAF
- private application networking: service-to-service traffic
- private data networking: database and sensitive internal dependencies

Security model:

- only the edge is public
- app and worker tiers use private networking
- database has no public exposure
- workloads use workload identity instead of static credentials
- secrets come from managed secret storage, not CI variables baked into images
- east-west traffic is authenticated and controlled with least privilege

At the edge:

- Cloud Armor enforces WAF, rate limiting, and abuse controls
- TLS terminates at the HTTPS load balancer, with re-encryption internally if required by policy

## 4. Stateless Versus Stateful Split

I would call out the stateful core early, because that defines most HA complexity.

Stateless:

- API serving layer
- gateway or ingress layer
- async workers if they do not own durable state

Stateful:

- relational database
- cache only if persistence or warm state matters operationally
- message backlog in Pub/Sub

This matters because:

- stateless tiers are easy to scale and replace across zones
- stateful tiers dominate failover, backup, consistency, and real recovery time

## 5. Availability And Failure Domains

### Zonal Failure

I would spread stateless serving capacity across at least three zones in the primary region.

If one zone degrades:

- load balancer and platform health should stop sending new traffic there
- remaining zones absorb traffic
- autoscaling must leave headroom to avoid cascading overload

### Regional Failure

For critical APIs, I would keep a secondary region with warm or active capability, depending on business need.

The key question is the database:

- if writes require strong correctness, I would avoid pretending multi-region failover is instant and risk-free
- I would define which APIs can fail over read-only, which can queue writes, and which must degrade rather than split-brain

Senior point:

- application failover is easy compared with state failover

## 6. Latency Strategy

I would explicitly budget latency across:

- DNS
- TLS handshake
- CDN or edge processing
- load balancer
- API service processing
- cache lookup
- database or downstream dependency

Ways I would protect p99:

- cache only where correctness allows
- avoid unnecessary cross-zone hops on hot paths
- keep database connectivity private and efficient
- use connection pooling carefully
- move non-critical work off the synchronous path into Pub/Sub
- avoid aggressive retries on already stressed dependencies

## 7. Observability

I would require:

- RED or golden-signal metrics for APIs
- infrastructure and saturation metrics
- structured logs with correlation IDs
- distributed tracing across edge, API, cache, and DB calls
- deployment event markers
- SLOs for availability and latency
- synthetic checks from user-relevant regions

For incident response, dashboards should show:

- request rate
- error rate
- p50, p95, p99 latency
- zone or region breakdown
- dependency latency
- rollout correlation

## 8. Delivery And Operational Safety

I would design delivery so that:

- immutable images are built once
- artifacts are identified by digest
- provenance or attestations are generated
- deploy policy verifies trusted artifacts
- rollout is progressive, not instant fleet-wide
- rollback is fast and well-practiced

For GCP, a strong pattern would be:

- Cloud Build
- Artifact Registry
- Binary Authorization
- Cloud Deploy or equivalent staged rollout

## 9. Incident Example: Zonal Degradation

If one zone is partially degraded but not fully down:

- I would first confirm whether user impact is real or only health-check-visible
- if real, I would reduce or remove traffic to that zone
- I would compare dependency behavior by zone, especially DB and cache latency
- I would watch whether remaining zones have enough capacity to absorb traffic without causing a second failure
- I would communicate user impact, affected geography or traffic slice, mitigation steps, and next update time

The key risk here is shallow health signaling. A zone can look healthy enough for platform checks while still being bad for real request latency.

## 10. Tradeoffs I Would State Explicitly

- GKE gives stronger platform control; Cloud Run gives lower operational overhead
- CDN improves latency and origin protection, but can complicate cache correctness and invalidation
- active-active across regions sounds attractive, but state consistency may make selective degradation safer than naive full failover
- more security layers help, but only if identity, observability, and break-glass paths stay usable

## 11. What I Would Keep Simple

I would avoid:

- over-engineered multi-region writes unless the business truly needs them
- pretending every service needs both GKE and Cloud Run support
- overusing synchronous dependencies in the hot path
- building a huge custom platform contract before service teams can succeed

I would keep the initial design opinionated:

- one primary serving model
- one standard observability stack
- one trusted-delivery path
- clear public/private boundaries

That usually gives better reliability than a highly flexible but weakly governed platform.
