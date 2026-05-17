---
title: "Cloud Networking Drill 2: GCP VPC And Load Balancing Design"
sidebar_position: 2
---

# Cloud Networking Drill 2: GCP VPC And Load Balancing Design

## Production Context

Your team is migrating an ML inference service to GCP. The service receives public HTTPS
traffic from global clients, backs onto a GKE cluster, and talks to a Cloud SQL
PostgreSQL database. During the migration, a post-deploy health check passed but real
users in South-East Asia reported 40% packet loss. The US team saw nothing wrong.
Your architecture review needs to explain why, and how to prevent it.

---

## Prerequisites

- A GCP account (free tier is sufficient for CLI exercises)
- `gcloud` CLI installed and authenticated
- Basic familiarity with the GCP console
- For the GKE sections: a running GKE cluster or knowledge of GKE networking

---

## Beginner Section: GCP VPC Model And Request Path

### Step 1 — Understand GCP VPC as a global, flat network

GCP VPC is fundamentally different from AWS VPC:

| Dimension | GCP VPC | AWS VPC |
|-----------|---------|---------|
| Scope | Global (single VPC spans all regions) | Regional (one VPC per region) |
| Subnets | Regional (subnet lives in one region) | Availability-zone-specific |
| Routing | Routes are global by default | Routes are per-route-table, per-subnet |
| Peering | VPC peering is not transitive | VPC peering is not transitive either |

This means a single GCP VPC can have subnets in `us-central1`, `europe-west4`, and
`asia-northeast1` simultaneously. A VM in `us-central1` can reach a VM in
`asia-northeast1` using private IPs over Google's backbone — without VPN or peering.

```bash
# List VPCs in your project
gcloud compute networks list

# List subnets (note: regional, even though the VPC is global)
gcloud compute networks subnets list --network=default

# Expected output:
# NAME          REGION           NETWORK  RANGE          STACK_TYPE
# default       us-central1      default  10.128.0.0/20  IPV4_ONLY
# default       europe-west1     default  10.132.0.0/20  IPV4_ONLY
# default       asia-east1       default  10.140.0.0/20  IPV4_ONLY
```

The subnet ranges are different per region. A VM in `us-central1` gets an IP from
`10.128.0.0/20`. This matters for firewall rules: if you write a rule targeting a
specific subnet CIDR, it is region-specific even though the VPC is global.

### Step 2 — Map the full request path for a public HTTPS service

```
Internet client
      |
      | DNS: api.example.com → 34.107.xxx.xxx (Anycast, global)
      v
[Cloud Armor WAF]           ← DDoS protection, OWASP rules, geo-blocking
      |
      v
[Global HTTPS Load Balancer]  ← Terminates TLS, routes to regional backend
      |
      | (Google Front End → regional forwarding)
      v
[Backend Service]           ← Health-checked pool of instance groups or NEGs
      |
      v
[GKE Pods via NEG]          ← Traffic goes directly to pod IPs (not NodePort)
      |
      v
[Cloud SQL (private IP)]    ← Connected via Private IP, no public endpoint
```

Key GCP-specific components:

**Anycast IP**: The Global HTTPS LB's IP is an Anycast address advertised from
multiple Google PoPs worldwide. A client in Singapore connects to the nearest Google
PoP, which then routes traffic over Google's private backbone to the nearest healthy
backend. This is why a US-only backend deployment causes 40% packet loss in SEA —
the LB accepts the connection in Singapore but has no backend to serve it there.

**Network Endpoint Group (NEG)**: A NEG is a collection of backend endpoints.
For GKE, a "zonal NEG" maps to individual pod IPs directly, bypassing kube-proxy
entirely. This improves latency and enables precise health checking at the pod level.

### Step 3 — Inspect the backend health check (where the incident lives)

```bash
# List backend services
gcloud compute backend-services list --global

# Describe one backend service to see its health
gcloud compute backend-services get-health inference-api-backend --global
```

Expected output for a healthy backend:

```
---
backend: https://www.googleapis.com/compute/v1/.../instanceGroups/gke-cluster-pool-us-c1
status:
  healthStatus:
  - healthState: HEALTHY
    instance: https://.../instances/gke-node-001
    ipAddress: 10.128.0.12
    port: 80
```

Expected output during the incident (SEA region missing):

```
---
backend: https://.../instanceGroups/gke-cluster-pool-us-c1
status:
  healthStatus:
  - healthState: HEALTHY
    instance: ...
    ipAddress: 10.128.0.12

# No asia-southeast1 backend listed at all — it was never added to the backend service
```

The backend service was only configured with a `us-central1` NEG. The Global LB
accepted connections from Singapore (nearest PoP) but had no healthy backend in that
region. 40% of requests failed because the LB sometimes chose the only backend
(us-central1) — successful — and sometimes tried to find a closer backend — failed.
The actual split depended on LB routing algorithm behaviour with no regional backend.

### Step 4 — Understand internal versus external load balancing

GCP offers multiple load balancer types. Choosing the wrong one is a common design error:

| LB Type | Scope | Use case |
|---------|-------|---------|
| Global HTTPS LB | Global, external | Public HTTPS with Anycast, CDN, Cloud Armor |
| Regional HTTPS LB | Regional, external | Regional public HTTPS, lower cost |
| Internal HTTPS LB (L7) | Regional, internal | East-west microservice traffic within VPC |
| Internal TCP/UDP LB (L4) | Regional, internal | Internal stateful TCP, private endpoints |
| Network LB (pass-through) | Regional, external | High-performance TCP/UDP, preserve source IP |

For the ML platform:
- External inference API → Global HTTPS LB (with Cloud Armor)
- Service mesh internal traffic → Internal HTTPS LB or Istio
- Database connection → Cloud SQL Private IP (no LB needed; direct private connectivity)

### Step 5 — Cloud NAT and private egress

Private GKE nodes (recommended) have no public IPs. They need Cloud NAT for outbound
internet access (pulling images from Docker Hub, reaching external APIs):

```bash
# Create a Cloud Router (required by Cloud NAT)
gcloud compute routers create ml-router \
  --network=ml-vpc \
  --region=us-central1

# Create Cloud NAT on that router
gcloud compute routers nats create ml-nat \
  --router=ml-router \
  --region=us-central1 \
  --auto-allocate-nat-external-ips \
  --nat-all-subnet-ip-ranges
```

Cloud NAT is regional — you need one per region where you have private nodes.
A GKE cluster spanning `us-central1` and `asia-southeast1` needs two Cloud NAT
configurations if both regions have private nodes.

For GCP-native services (GCS, Pub/Sub, BigQuery), use Private Google Access instead
of Cloud NAT — traffic goes through Google's backbone, not the internet:

```bash
# Enable Private Google Access on a subnet
gcloud compute networks subnets update ml-subnet \
  --region=us-central1 \
  --enable-private-ip-google-access
```

### Step 6 — Firewall rules: GCP's stateful model

GCP firewall rules are attached to the VPC (not to subnets or instances), and use
target tags or service accounts to identify which VMs they apply to:

```bash
# List firewall rules on the VPC
gcloud compute firewall-rules list --filter="network:ml-vpc"

# Example output:
# NAME                          NETWORK  DIRECTION  PRIORITY  ALLOW
# allow-internal                ml-vpc   INGRESS    1000      all:0.0.0.0/0 → tag:internal
# allow-health-check            ml-vpc   INGRESS    1000      tcp:8080 → tag:gke-node (from 130.211.0.0/22,35.191.0.0/16)
# deny-all-ingress              ml-vpc   INGRESS    65534     all:0.0.0.0/0 → all
```

Health check rule: `130.211.0.0/22` and `35.191.0.0/16` are Google's health-checker
source ranges. Without this rule, the Global HTTPS LB health checks fail and all
backends are marked unhealthy — even when pods are running correctly.

---

## Intermediate Section: Design Review Without Hints

You are given this GKE cluster creation command:

```bash
gcloud container clusters create ml-inference \
  --zone=us-central1-a \
  --num-nodes=3 \
  --enable-ip-alias \
  --no-enable-master-authorized-networks
```

Questions without hints:

1. What is `--enable-ip-alias` and why is it required for NEG-based load balancing?
2. What exposure does `--no-enable-master-authorized-networks` create, and what is the
   more secure default?
3. The cluster is created in a single zone (`us-central1-a`). What happens if that zone
   has an outage? What command creates a regionally redundant cluster?
4. How would you enable Workload Identity (GKE's IAM-for-pods) and why is it better
   than mounting service account keys?

---

## Advanced / Stretch

**Scenario A — Global LB latency routing vs load balancing**

The Global HTTPS LB routes to the backend with the lowest latency by default. If you
have backends in `us-central1` and `asia-southeast1`, and the `asia-southeast1` backend
becomes unhealthy, traffic fails over to `us-central1`. Explain: what does the client
in Singapore experience during failover? How long does it take? What GCP metric would
you alert on to detect cross-region spillover before users notice?

**Scenario B — GKE Private Cluster and master authorised networks**

With a private GKE cluster:
- Nodes have no public IPs
- The control plane endpoint can be made private-only

Draw the access path for:
  a) A developer running `kubectl apply` from their laptop
  b) A CI/CD pipeline (Cloud Build) running `kubectl apply`
  c) A GKE node calling the Kubernetes API (kubelet → API server)

For each, explain what network path is used and what IAM or network control gates it.

**Scenario C — Cloud SQL with private IP and connection pooling**

Cloud SQL with private IP does not use standard DNS routing — it uses a private service
access peering connection. Explain:
- What `gcloud services vpc-peerings connect` does
- Why you cannot connect to Cloud SQL via its private IP from a peered VPC (peering
  is not transitive, and private service access uses a separate peering)
- How Cloud SQL Auth Proxy solves the connection and credential management problem

---

## Sample Architecture Explanation (Interview-Ready)

```
GCP HTTPS request path for the ML inference platform:

1. DNS: api.example.com resolves to a Google Anycast IP. Client in Singapore hits
   the nearest Google PoP (Changi or equivalent).

2. Global HTTPS Load Balancer: terminates TLS. Cloud Armor filters for OWASP top-10
   and rate limits per IP. The LB selects the closest healthy backend service.

3. Backend Service with Zonal NEGs: NEGs are registered per region. For a global
   deployment, we register NEGs in us-central1, europe-west4, and asia-southeast1.
   Traffic from Singapore goes to the asia-southeast1 NEG, reaching GKE pods directly
   by pod IP, bypassing kube-proxy.

4. GKE pods: running in a private cluster (no public IPs). Pods call Cloud SQL via
   private IP within the same VPC. Pods call GCS via Private Google Access (no NAT
   needed). For external APIs (if any), traffic exits via Cloud NAT in each region.

5. Failure path: if a regional backend is unhealthy (0 healthy NEG endpoints), the
   Global LB spills over to the next-closest healthy region. We alert on the metric
   loadbalancing.googleapis.com/https/backend_latency with a threshold that catches
   cross-region routing before users see significant degradation.

The mistake in the original incident: only a us-central1 NEG was added to the backend
service. The LB accepted connections globally but had no local backend outside the US.
Fix: added asia-southeast1 and europe-west4 NEGs to the backend service.
```

---

## Common Mistakes

- **Deploying to a single zone.** GCP zones within a region are independent failure
  domains. A regional GKE cluster with nodes in all three zones of a region survives
  a single zone outage.
- **Not adding health check firewall rules.** The Global LB uses specific source IPs
  for health checks. Forgetting those firewall rules marks all backends unhealthy and
  causes total outage even when pods are running.
- **Treating Cloud NAT as a replacement for Private Google Access.** Cloud NAT sends
  traffic to the internet. Private Google Access routes to Google APIs internally.
  Use Private Google Access for GCS, Pub/Sub, and other Google services.
- **Expecting VPC peering to be transitive.** GCP peering (like AWS peering) is not
  transitive. VPC A peered to VPC B and VPC B peered to VPC C does not let A reach C.
  Use Shared VPC or a hub-and-spoke model if you need that connectivity.

---

## What To Study Next

- GCP Global vs Regional HTTPS Load Balancers: when to use each
- Network Endpoint Groups: zonal NEG vs serverless NEG vs internet NEG
- Cloud Armor: WAF rules, adaptive protection, rate limiting
- GKE networking: VPC-native clusters, Dataplane V2 (eBPF), NetworkPolicy
- Private Service Connect: exposing services across VPCs without peering
- VPC Flow Logs and Firewall Rules Logging for network observability
