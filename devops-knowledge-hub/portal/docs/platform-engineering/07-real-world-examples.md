---
title: "Real-World Examples"
sidebar_position: 7
---

# Platform Engineering — Real-World Examples

These scenarios are drawn from common situations in platform engineering. Each follows the senior answer template: failure domain, fastest signal, immediate mitigation, long-term prevention.

---

## Scenario 1: Shadow IT Emerging

### Situation

You are a platform engineer. You discover that the Android mobile team has been running its own AWS account for 18 months. They have 12 EC2 instances, 3 RDS databases, 2 S3 buckets, and a custom CI pipeline — none of which are visible to the platform team, security team, or finance team.

They did this because the golden path for backend services "didn't work for mobile backend workloads" and the platform team took 6 weeks to respond to their original request.

### Analysis

This is not a security incident to escalate punitively — it is a product failure. The mobile team had a legitimate need the platform failed to serve, so they solved it themselves. Punishing them damages trust and drives the next team to hide their shadow IT more carefully.

**Failure domains:**
- Platform responsiveness: 6-week response time is unacceptable
- Golden path coverage: mobile backend is a real use case not addressed
- Visibility: no process to discover unsanctioned cloud usage

**Fastest signal of the problem:** Cloud cost anomaly detection (unusual charges to a credit card not in the platform billing account), or a security audit.

### Resolution

Short-term:
1. Acknowledge the mobile team's frustration — they were right that the platform let them down
2. Inventory all their resources (security requires this)
3. Agree on a migration timeline that does not disrupt their service
4. Assign a platform engineer to support the migration

Long-term:
1. Add mobile backend to the platform roadmap; use the mobile team's implementation as the reference
2. Create a "non-standard workload" process with a 48-hour response SLA (not 6 weeks)
3. Deploy AWS Config rules to detect new accounts and resources not registered with the platform
4. Publish the roadmap publicly so teams can see when their use case is coming

**Key lesson:** Shadow IT is a symptom of platform failure. Measure shadow IT instances as a platform metric — the number should decrease over time as the platform gets better.

---

## Scenario 2: Teams Bypassing the Golden Path

### Situation

The data team has been deploying their Spark jobs using a custom bash script that SSH-es into EC2 instances and runs `spark-submit` directly. The platform golden path only supports containerized workloads on Kubernetes.

When Spark jobs crash, they create incidents that require the data team and on-call platform engineers to debug EC2-level issues that the platform doesn't monitor.

### Analysis

**Why they bypassed:**
- Containerizing Spark jobs was not straightforward (native Java, complex classpath)
- The platform team had no Spark expertise
- EC2 gave them direct control they felt comfortable with

**Problem created:**
- No observability: Prometheus doesn't scrape bare EC2 instances
- No RBAC: SSH key management is manual and not audited
- Incident response: platform on-call gets paged but has no tools to debug

### Resolution

Short-term:
1. Add observability to existing EC2 instances (node exporter + CloudWatch agent) — immediate incident response improvement
2. Document the current bash/EC2 pattern as a "supported off-ramp" so it is maintained and monitored, even if non-standard

Long-term:
1. Build a golden path for Spark on Kubernetes (Spark operator on EKS)
2. Involve the data team in designing the golden path — they have the domain knowledge
3. Provide a migration guide and migration support period (3-6 months)
4. When the Kubernetes Spark path is stable, deprecate the EC2 pattern

**Key lesson:** Don't force migration without providing a better alternative. Build the alternative with the team, not for the team.

---

## Scenario 3: Incident Caused by Unsupported Pattern

### Situation

A P1 incident: `checkout-service` is returning 502 errors. Investigation reveals:
- `checkout-service` is connecting directly to the payments team's internal PostgreSQL pod (bypassing the `payment-service` API)
- The payments team scaled down their PostgreSQL pod for maintenance (using a non-standard StatefulSet they manage themselves)
- No NetworkPolicy blocked the direct connection
- The checkout team didn't know they were making direct DB connections — a developer added it "to avoid latency" three months ago

**User impact:** Checkout is down. Revenue impact starts immediately.

### Immediate Response (SRE protocol)

Apply the senior template: mitigate before diagnosing.

```
1. Fastest mitigation: restart checkout-service with the DB connection disabled
   → Find the code path, toggle a feature flag if available
   → Or: roll back checkout-service to the version before the direct DB connection was added

2. Fastest signal: checkout-service logs showing connection refused to payments-db
   → kubectl logs deployment/checkout-service -n checkout | grep "connection refused"

3. Communicate: "Checkout is degraded. Team is investigating. ETA for update: 15 minutes"
```

### Root Cause and Prevention

**Immediate causes:**
1. Direct database access across team namespaces (architectural violation)
2. No NetworkPolicy blocking cross-namespace database access
3. No code review process that catches cross-team DB connections

**Platform failures:**
1. NetworkPolicy did not block the connection — the default-deny policy was either absent or misconfigured
2. No catalog dependency tracking (Backstage didn't show checkout as depending on payments-db)

**Long-term prevention:**
1. Enforce default-deny NetworkPolicy on all team namespaces via Kyverno generate policy
2. Add a `backstage.io/external-db-dependency` annotation pattern and validate in PRs
3. Code review checklist: flag any direct DB connections to another team's database
4. Run a quarterly audit of cross-namespace traffic logs to find existing violations

**Key lesson:** Platform guardrails that should have blocked this pattern didn't exist. The postmortem generates platform requirements, not just team-level action items.

---

## Scenario 4: Platform Team as Bottleneck

### Situation

The platform team has 30 open tickets. Teams are waiting:
- 8 tickets for new namespace provisioning (waiting: 1-2 weeks each)
- 5 tickets for database creation
- 7 tickets for new CI pipeline setup
- 6 tickets requesting access to the shared Grafana
- 4 tickets for adding new Backstage catalog entries

The platform team has 4 engineers. They are fully occupied with tickets and cannot work on platform improvements.

### Analysis

This is the classic platform bottleneck anti-pattern. The platform team is operating as a service desk, not a product team. Every capability in the ticket queue should be self-service.

**Failure domain:** Platform architecture, not capacity.

**Fastest signal:** Rising ticket backlog, increasing ticket age (P50 > 5 days).

### Resolution

Immediate (while bottleneck exists):
1. Triage tickets into: "can be self-served now" vs "requires platform work"
2. For anything that can be self-served: write a runbook and link from the ticket
3. Temporarily prioritize automation over feature work — nothing ships until the bottleneck is resolved

Engineering investments (in priority order):
1. **Namespace provisioning** → Backstage scaffolder template + Kyverno generate policy (2 weeks work, eliminates 8+ tickets/month)
2. **CI pipeline setup** → Backstage scaffolder creates `.github/workflows/` automatically (1 week work)
3. **Database creation** → Terraform module + Backstage scaffolder "add database" template (3 weeks work)
4. **Grafana access** → RBAC policy allowing all authenticated users read access to dashboards (1 day work)
5. **Catalog entries** → Documentation and automated validation in scaffold flow (1 week work)

**Measurement:** After each automation, track tickets in that category. Success = that category hits zero.

**Key lesson:** A platform team that is 80%+ on tickets is not a platform team — it is a service desk. Automation is the only sustainable exit from a ticket bottleneck.

---

## Scenario 5: Noisy Neighbor in Kubernetes

### Situation

The search team deploys a new indexing job that runs a batch reindex every night. The job consumes all available CPU on 3 nodes, causing the payment service (on the same cluster) to receive throttling and respond with increased p99 latency.

Payments team pages on-call at 2am. The root cause takes 2 hours to identify.

### Analysis

**Failure domain:** Shared compute resources — no isolation between search indexing workload and payment service.

**Fastest signal:** Payment service p99 latency spike, correlated with search indexing job start time.

### Resolution

Immediate:
1. Scale down the indexing job to reduce CPU consumption: `kubectl scale deployment search-indexer --replicas=1 -n search`
2. Payment service latency recovers

Short-term:
1. Add ResourceQuota to the search namespace (caps total CPU request to 8 cores)
2. Add a PriorityClass to the payment service (higher priority than search indexer)

```yaml
# PriorityClass for critical services
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: critical-service
value: 1000
globalDefault: false
description: "For services that handle user-facing critical paths"
---
# PriorityClass for batch workloads
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: batch-workload
value: 100
description: "For batch jobs that can be preempted"
```

Long-term:
1. Platform policy: batch jobs run on a dedicated node pool with taints (no user-facing services on batch nodes)
2. Automate ResourceQuota provisioning when namespace is created
3. Grafana dashboard: CPU consumption per namespace vs quota (visible to all teams)

**Key lesson:** Noisy neighbor incidents are platform design failures. The platform should prevent them through ResourceQuotas and node pool isolation, not rely on teams to self-police.

---

## Scenario 6: Secret Rotation Causes Downtime

### Situation

The security team rotates the production database password for the payment service as part of a quarterly rotation. They update the secret in AWS Secrets Manager.

Within 5 minutes, payment service pods start failing with `authentication failed for user "payments"` errors. The secret rotation caused downtime because the service read the secret from environment variables (set at pod startup), not from a file mount.

### Analysis

**Failure domain:** Secret delivery mechanism — environment variables vs file mounts.

**Fastest signal:** Application error logs: DB authentication failure, correlated with secret rotation event in AWS CloudTrail.

### Resolution

Immediate:
1. Roll the old secret back in AWS Secrets Manager (if possible) to restore service
2. Or: trigger a rolling restart of payment service pods to pick up new secret: `kubectl rollout restart deployment/payment-service -n payments`

Root cause: the service uses `envFrom: secretRef:` which reads secret values at pod startup. The secret value changed, but running pods still have the old value in their environment.

Long-term fix:
```yaml
# WRONG: environment variable — requires pod restart on secret change
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: password

# RIGHT: file mount — kubelet updates the file without pod restart
volumeMounts:
  - name: db-credentials
    mountPath: /secrets/db
    readOnly: true
volumes:
  - name: db-credentials
    secret:
      secretName: db-credentials
```

Application reads `/secrets/db/password` and re-reads the file on each connection or on a refresh interval. ESO refreshInterval keeps the Kubernetes Secret up to date; kubelet updates the mounted file automatically.

**Key lesson:** Add "use file-mounted secrets" to the golden path skeleton. Make environment variable secret references a Kyverno policy violation in production namespaces.

---

## Scenario 7: Platform Upgrade Breaks Multiple Teams

### Situation

The platform team upgrades the shared NGINX Ingress controller from v1.9 to v1.11. After the upgrade, 4 teams report that their services are returning 404 errors for specific paths.

Root cause: v1.11 changed the behavior of `nginx.ingress.kubernetes.io/rewrite-target` for paths with capture groups. Teams that used the old syntax now have incorrect rewrites.

### Analysis

**Failure domain:** Shared platform component — a change to one component broke multiple consumers.

**Key failure:** The platform team did not test the upgrade against consumer Ingress resources before rolling out to production.

### Resolution

Immediate:
1. Roll back to v1.9: `helm rollback ingress-nginx -n ingress-nginx`
2. Verify all 4 teams' services are restored

Long-term:
1. Pre-upgrade testing: run a regression test suite against all Ingress resources in the cluster before upgrading
2. Canary upgrade process: upgrade ingress controller on one namespace's Ingress resources first, monitor for 24 hours, then proceed
3. Change notification: communicate NGINX upgrades to all teams 2 weeks in advance with a test checklist
4. Deprecation warnings: when using deprecated annotations, surface warnings in Backstage catalog health checks

**Key lesson:** Shared platform components are dependencies of every team. Platform upgrades require the same care as any breaking change in a shared library: test against consumers, communicate in advance, provide migration guidance.

---

## Scenario 8: Observability Gap During Incident

### Situation

The fraud detection service is returning increased false positives. The on-call engineer can see error rates going up in Grafana, but cannot determine why. The service has:
- Request rate: normal
- Error rate: increasing
- p99 latency: elevated but not critical
- No traces (tracing was never set up)
- No structured logging (logs are plain text with no correlation IDs)

The team spends 3 hours debugging before finding a misconfigured ML model threshold that was deployed 4 hours earlier.

### Analysis

**Failure domain:** Observability — specifically, lack of distributed tracing and structured logging.

**The platform failure:** The golden path did not include a tracing setup or a structured logging requirement. Each team's observability is incomplete.

### Resolution

Immediate: The platform team writes a new Backstage scaffolder template that includes:

1. **Structured logging with correlation IDs:**
```python
# Included in the golden-path skeleton
import structlog, uuid

log = structlog.get_logger()

def get_logger_with_trace(request):
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
    return log.bind(trace_id=trace_id, service="fraud-detection")
```

2. **OpenTelemetry instrumentation (auto-instrumented via sidecar):**
```yaml
# Platform default: OpenTelemetry collector sidecar
- name: otel-collector
  image: otel/opentelemetry-collector-contrib:latest
  args: ["--config=/conf/otel-config.yaml"]
  volumeMounts:
    - name: otel-config
      mountPath: /conf
```

3. **Deployment correlation in dashboards:**
- All Grafana dashboards include deployment markers (vertical lines when a new version deployed)
- Annotations sourced from ArgoCD sync events

Long-term: Platform SLO for observability coverage — every production service must have traces enabled (measured via the Backstage catalog health check that validates the `otel-collector` sidecar is present).

**Key lesson:** Observability is a platform capability, not a team responsibility. Incomplete observability is a platform gap, exposed by incidents.

---

## Scenario 9: Multi-Cluster Fleet Drift

### Situation

Your organization runs 8 Kubernetes clusters across 3 regions. The platform team uses ArgoCD ApplicationSets to deploy platform services (ingress, cert-manager, ESO, observability). After a cluster upgrade to Kubernetes 1.29, the cert-manager version on that cluster is incompatible with the new API version and stops issuing certificates. Three other clusters also need the upgrade but haven't been updated yet.

You discover the drift when a developer reports their HTTPS certificate has expired.

### Analysis

**Failure domain:** Configuration drift across fleet — clusters are not at identical versions.

**Fastest signal:** Backstage catalog health check shows cert-manager in `Degraded` state on the upgraded cluster. (This would be the signal if health checks were configured; in this case, it was discovered via user report.)

### Resolution

Immediate:
1. Manually update cert-manager to a compatible version on the affected cluster
2. Verify certificate issuance is restored

Long-term:
1. Add cert-manager compatibility check to the cluster upgrade runbook
2. Use ArgoCD's ApplicationSet matrix generator to enforce consistent versions across all clusters
3. Add a Prometheus alert for cert-manager issuance failures across all clusters
4. Implement automated canary upgrade process: upgrade one non-production cluster, wait 48 hours, then proceed with others

**Fleet version drift detection:**

```bash
# Script to detect version drift across all clusters
#!/bin/bash
for cluster in $(argocd cluster list -o name); do
  argocd app list --cluster $cluster -o json | \
    jq -r '.[] | select(.metadata.name | startswith("cert-manager")) |
    "\(.metadata.name): \(.spec.source.targetRevision)"'
done
```

**Key lesson:** Fleet management requires explicit drift detection. "ArgoCD is managing it" is not sufficient — ApplicationSets can diverge if overrides exist or if cluster upgrades change compatibility requirements.
