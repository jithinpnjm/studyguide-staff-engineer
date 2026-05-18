---
title: "Troubleshooting"
sidebar_position: 8
---

# Observability — Troubleshooting Runbooks

Structured runbooks for the most common observability platform failures. Each runbook includes diagnostic steps, root cause patterns, and fixes.

---

## Runbook 1: Prometheus Scrape Failures — Target Down

**Symptom:** `up{job="my-service"} == 0` in Prometheus. Alert fires: `TargetDown`.

### Diagnostic Steps

**Step 1: Confirm the target is down**

```promql
up{job="my-service"}
```

If this returns 0, Prometheus cannot reach the target.

**Step 2: Check the Prometheus UI**

Navigate to `Status -> Targets` in the Prometheus web UI. Look at the last scrape error for the failing target. Common errors:
- `connection refused` — port not open or service not running
- `context deadline exceeded` — scrape timeout
- `no such host` — DNS resolution failure
- `i/o timeout` — network policy blocking

**Step 3: Verify the application is running**

```bash
kubectl get pods -n <namespace> -l app=<service>
kubectl logs <pod-name> -n <namespace> --tail=50
```

**Step 4: Test the metrics endpoint directly**

```bash
kubectl exec -it <pod-name> -n <namespace> -- curl http://localhost:<port>/metrics
```

**Step 5: Check network policy**

```bash
kubectl get networkpolicy -n <namespace>
```

Prometheus must be permitted to reach the target on the metrics port.

**Step 6: Check service discovery labels**

Verify the pod has the correct labels for Prometheus service monitor or scrape config discovery:

```bash
kubectl get pod <pod-name> -n <namespace> --show-labels
```

### Root Cause Patterns

| Error | Root Cause | Fix |
|---|---|---|
| `connection refused` | App not running or wrong port | Fix app, correct port in scrape config |
| `context deadline exceeded` | Slow `/metrics` response | Reduce metrics complexity, increase scrape_timeout |
| `no such host` | DNS failure or wrong hostname | Fix service name or DNS config |
| `forbidden` | Auth required on /metrics | Add bearer token or remove auth from /metrics |
| NetworkPolicy | Firewall blocking Prometheus | Allow Prometheus namespace in NetworkPolicy |

---

## Runbook 2: Prometheus Scrape Failures — Too Many Samples

**Symptom:** Alert fires: `ScrapeTooManySamples` or `ScrapeSampleLimitExceeded`. The scrape is rejected.

### Diagnostic Steps

**Step 1: Check current sample count from the target**

```promql
scrape_samples_scraped{job="my-service"}
```

**Step 2: Compare to the configured limit**

The limit is set in the scrape config:

```yaml
scrape_configs:
  - job_name: 'my-service'
    sample_limit: 10000
```

**Step 3: Identify which metrics are large**

```bash
curl http://<service>:<port>/metrics | wc -l
curl http://<service>:<port>/metrics | awk -F'{' '{print $1}' | sort | uniq -c | sort -rn | head -20
```

**Step 4: Identify high-cardinality metrics**

Look for metrics with many label combinations in the output. Common culprits are histograms with high-cardinality labels or unbounded label values.

### Root Cause Patterns

| Cause | Fix |
|---|---|
| sample_limit too low | Increase limit after reviewing cardinality |
| High-cardinality label added | Remove or bound the label |
| Histogram with too many buckets | Reduce bucket count |
| New code exposing unbounded metrics | Fix the instrumentation |

---

## Runbook 3: Cardinality Explosion

**Symptom:** Prometheus memory usage is climbing rapidly. Queries are slow. Alerts evaluate slowly or time out. Grafana dashboards are loading slowly or showing timeouts.

### Diagnostic Steps

**Step 1: Check Prometheus memory**

```promql
process_resident_memory_bytes{job="prometheus"}
```

**Step 2: Find highest-cardinality metrics**

```promql
topk(10, count by (__name__)({__name__=~".+"}))
```

**Step 3: Check total time series count**

```promql
prometheus_tsdb_head_series
```

**Step 4: Find which job is the source**

```promql
count by (job)({__name__=~".+"})
```

**Step 5: Inspect the metric in question**

```bash
curl http://prometheus:9090/api/v1/label/__name__/values | python3 -m json.tool | grep "my_metric"
curl "http://prometheus:9090/api/v1/series?match[]=my_metric_name" | python3 -m json.tool | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['data']))"
```

### Root Cause Patterns

| Cause | Fix |
|---|---|
| `user_id` or `request_id` in label | Remove from label, move to log/trace |
| Full URL with IDs as label | Normalize to route pattern |
| Unbounded error message as label | Move to log, use error_type label |
| Pod UID or IP in label | Remove, use pod name or namespace |
| Per-feature-flag label with many values | Limit cardinality or use gauge per flag |

### Mitigation Steps

1. Identify the offending metric and job.
2. Drop the metric at scrape time using metric_relabeling (temporary):

```yaml
metric_relabel_configs:
  - source_labels: [__name__]
    regex: 'high_cardinality_metric_name'
    action: drop
```

3. Fix the instrumentation in the application.
4. Re-enable the metric after the fix is deployed.

---

## Runbook 4: Alertmanager Not Firing

**Symptom:** An alert rule is in `FIRING` state in Prometheus, but no notification was received.

### Diagnostic Steps

**Step 1: Confirm the rule is firing in Prometheus**

Navigate to `Alerts` in the Prometheus UI. Confirm the alert shows as `FIRING`.

```promql
ALERTS{alertname="MyAlert", alertstate="firing"}
```

**Step 2: Check Alertmanager is receiving the alert**

Navigate to the Alertmanager UI (`/alerts`). Is the alert visible there?

If it is not visible, Prometheus is not sending to Alertmanager. Check:
- Alertmanager URL in Prometheus configuration
- Network connectivity between Prometheus and Alertmanager

**Step 3: Check for active silences**

Navigate to `Silences` in the Alertmanager UI. Is there a silence matching the alert labels?

```bash
curl http://alertmanager:9093/api/v2/silences | python3 -m json.tool
```

**Step 4: Check routing rules**

Verify the alert labels match a route in the Alertmanager configuration:

```bash
kubectl exec -it alertmanager-0 -n monitoring -- amtool config routes test --verify.receivers=pagerduty alertname=MyAlert severity=critical team=payments
```

**Step 5: Check receiver health**

Is the PagerDuty or Slack receiver returning errors? Check Alertmanager logs:

```bash
kubectl logs -n monitoring alertmanager-0 --tail=100 | grep "error\|failed"
```

**Step 6: Check for inhibit rules blocking the alert**

If an inhibit rule matches, the alert will be suppressed. Check:

```bash
amtool alert query --alertmanager.url=http://alertmanager:9093
```

Look for alerts with `inhibited: true`.

### Root Cause Patterns

| Cause | Fix |
|---|---|
| Active silence matching labels | Expire or delete the silence |
| Route does not match alert labels | Fix routing matchers |
| Inhibit rule matching the alert | Check source alert; fix inhibit scope |
| Receiver misconfigured | Fix API key, webhook URL, or endpoint |
| Alertmanager not receiving from Prometheus | Fix alertmanager URL in prometheus.yml |
| `for:` duration not yet elapsed | Wait, or check if rule has been firing long enough |

---

## Runbook 5: Grafana Dashboard Shows No Data

**Symptom:** Grafana panel shows "No data" or "Data source error".

### Diagnostic Steps

**Step 1: Check time range**

Is the dashboard time range set correctly? Common mistake: setting "Last 5 minutes" when data only exists for older time ranges.

**Step 2: Check datasource**

Click the datasource selector. Is the correct Prometheus or Loki instance selected? Is the datasource healthy?

Navigate to `Configuration -> Data Sources` in Grafana. Click `Test` on the datasource.

**Step 3: Test the query directly**

Open the panel editor and run the PromQL query in the query inspector. Check for errors or empty results.

**Step 4: Verify metric labels match**

```promql
# Check if the metric exists at all
http_requests_total
```

If it exists, verify the label selectors in the panel query match the actual labels:

```promql
# Wrong - label value does not exist
http_requests_total{service="payment-svc"}

# Correct - use the actual label value
http_requests_total{service="payment"}
```

**Step 5: Check target scrape health**

```promql
up{job="my-service"}
```

If `up == 0`, the target is not being scraped (see Runbook 1).

**Step 6: Check for missing recording rules**

If the panel uses a recording rule (e.g., `service:error_ratio:5m`), verify the rule exists and is evaluating:

```promql
service:error_ratio:5m
```

### Root Cause Patterns

| Cause | Fix |
|---|---|
| Wrong time range | Adjust time range to cover available data |
| Datasource misconfigured or unreachable | Fix datasource URL or credentials |
| Label selector mismatch | Match exact label values from `/metrics` |
| Recording rule not defined | Add recording rule to rules file |
| Target not scraped (up=0) | Fix scrape issue (see Runbook 1) |
| Query typo | Use Prometheus UI to validate query |

---

## Runbook 6: SLO Burn Rate Alert False Positive

**Symptom:** A burn-rate alert fires but on investigation there is no real user impact. Error budget dashboard shows a sudden consumption that looks suspicious.

### Diagnostic Steps

**Step 1: Verify the error rate**

```promql
# Check actual error rate over the alert window
sum(rate(http_requests_total{status=~"5.."}[1h])) by (service)
/
sum(rate(http_requests_total[1h])) by (service)
```

**Step 2: Check request volume**

A very low request volume means a small number of errors can produce a high error ratio:

```promql
sum(rate(http_requests_total[5m])) by (service)
```

If request rate is near zero, a 1-error spike creates 100% error rate mathematically but is not meaningful.

**Step 3: Check for status code classification errors**

Are 4xx errors being counted as 5xx? Check the metric labels:

```promql
sum by (status) (rate(http_requests_total[5m]))
```

**Step 4: Check for scrape gaps**

A scrape gap creates counter resets which can appear as a spike:

```promql
changes(up{job="my-service"}[1h])
```

If `changes` is high, the target was unstable and counter resets may be causing false spikes.

**Step 5: Check for clock skew or recording rule issues**

If the SLO uses recording rules, verify the recording rule interval matches the alert window.

### Root Cause Patterns

| Cause | Fix |
|---|---|
| Low traffic amplifying error ratio | Add minimum request volume guard to alert expr |
| 4xx misclassified as SLO failure | Review SLI definition, filter to 5xx only |
| Counter reset from pod restart | Use `increase()` with care, or filter by `resets()` |
| Scrape gaps | Fix target stability |
| Recording rule misconfigured | Align recording rule interval with alert window |

Improved alert with minimum traffic guard:

```promql
(
  sum(rate(http_requests_total{status=~"5.."}[1h])) by (service)
  /
  sum(rate(http_requests_total[1h])) by (service)
  > (14.4 * 0.001)
)
and
sum(rate(http_requests_total[5m])) by (service) > 10
```

---

## Runbook 7: Log Ingestion Lag in Loki

**Symptom:** Grafana Loki panels show no recent logs. Tailing shows logs from 10+ minutes ago. Alerts based on log queries are not firing when they should be.

### Diagnostic Steps

**Step 1: Check Loki ingester metrics**

```promql
# Check ingestion rate
sum(rate(loki_ingester_chunk_encode_time_seconds_count[5m]))

# Check chunk flush lag
loki_ingester_chunks_flushed_total
```

**Step 2: Check the log collector (Promtail/Fluent Bit/Vector)**

```bash
kubectl logs -n logging promtail-<pod> --tail=100 | grep "error\|warn\|lag\|drop"
```

**Step 3: Check collector queue depth**

For Promtail:

```promql
promtail_sent_entries_total
promtail_dropped_entries_total
```

If `promtail_dropped_entries_total` is increasing, logs are being dropped before reaching Loki.

**Step 4: Check Loki distributor and ingester health**

```bash
kubectl get pods -n logging -l app=loki
```

Are any ingester pods in a crash loop or pending state?

**Step 5: Check Loki rate limits**

Loki enforces per-tenant ingestion rate limits. If exceeded, logs are dropped:

```bash
kubectl logs -n logging loki-0 --tail=100 | grep "rate limit\|ingestion limit"
```

**Step 6: Check storage backend latency**

If Loki writes to object storage (S3/GCS), storage latency increases flush time:

```promql
loki_boltdb_shipper_request_duration_seconds{operation="PUT"}
```

### Root Cause Patterns

| Cause | Fix |
|---|---|
| Collector crashed or backpressured | Restart collector, increase memory limit |
| Loki rate limit exceeded | Increase limits or reduce log volume |
| High-cardinality labels in Loki | Remove or bound label values |
| Storage backend slow | Check object storage health |
| Loki ingester OOMKilled | Increase memory, reduce chunk target size |
| Clock skew between collector and Loki | Ensure NTP sync |

---

## Runbook 8: High-Cardinality Metric Explosion

**Symptom:** Prometheus memory growing rapidly. New metric was recently deployed. `prometheus_tsdb_head_series` exceeds millions.

This is a focused runbook for the operational response when cardinality has already exploded (not just prevention).

### Immediate Mitigation

**Step 1: Identify the offending metric and label**

```promql
topk(5, count by (__name__)({__name__=~".+"}))
```

```promql
# For a specific metric, count unique label combinations
count(http_requests_total) by (service)
```

**Step 2: Drop the metric at scrape time immediately**

Add a metric_relabel_config to the scrape job to drop the metric until the code is fixed:

```yaml
scrape_configs:
  - job_name: 'my-service'
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'exploding_metric_name'
        action: drop
```

Reload Prometheus configuration:

```bash
curl -X POST http://prometheus:9090/-/reload
```

**Step 3: Verify cardinality is dropping**

```promql
prometheus_tsdb_head_series
```

This should start decreasing as old series expire (default: 5 minute stale timeout).

**Step 4: Fix the instrumentation**

In the application code, either:
- Remove the high-cardinality label entirely
- Bound it to a fixed set of values (e.g., normalize URLs to route templates)
- Move the value to logs or traces instead

**Step 5: Deploy the fix and remove the drop rule**

Once the fixed code is deployed and confirmed:
- Remove the `drop` relabeling rule
- Reload Prometheus configuration

### Prevention Checklist

```text
metric naming review in PR process
cardinality test in CI (expose /metrics, count unique series)
label value governance (no user IDs, request IDs, UUIDs, raw URLs)
Prometheus cardinality dashboard visible to all engineers
sample_limit set on scrape configs as a guardrail
```

---

## Runbook 9: Production Troubleshooting Flows By Symptom

Use these flows when an incident is in progress and you need to narrow the blast radius quickly. Each flow starts with the symptom, not a hypothesis.

### Traffic Drop

Request rate has fallen significantly. Users cannot reach the service.

Check in this order:

1. Load balancer health and target groups
2. DNS resolution — `dig service.example.com`
3. Recent deploy markers on the dashboard
4. Upstream routing changes (Ingress, Service selector)

```promql
# Confirm traffic drop
sum(rate(http_requests_total[5m])) by (service)

# Check per-region split
sum(rate(http_requests_total[5m])) by (service, region)
```

If the drop is region-specific, suspect DNS or LB routing. If global, suspect the deploy or a dependency.

---

### Error Spike

Error rate has risen sharply. Users are seeing failures.

Check in this order:

1. Latest deploy — rollback candidate if error started exactly at deploy time
2. Dependency errors — downstream service returning 5xx
3. Auth changes — token rotation, cert expiry
4. Saturation — CPU, connection pool, queue depth

```promql
# Error ratio per service
sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
/
sum(rate(http_requests_total[5m])) by (service)

# Identify which service started first
sum(rate(http_requests_total{status=~"5.."}[2m])) by (service)
```

If errors are in a downstream dependency, the upstream is a victim — focus on the real source.

---

### Latency Increase

Requests are succeeding but slowly. p99 is rising while error rate looks normal.

Check in this order:

1. p95/p99 split by service — is it one service or all?
2. Traces — find the slow span in the call chain
3. Queue depth — is a buffer growing?
4. Database latency — `SELECT` or write throughput degraded?

```promql
# p99 latency per service
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
)

# Queue depth
queue_depth{service="checkout"}
```

Average latency can mask p99 pain — always inspect tail latency first.

---

### Alert Storm

Many alerts firing simultaneously, making it hard to identify the real cause.

Check in this order:

1. Is there a root dependency causing fan-out? (database, message broker, external API)
2. Are duplicate rules firing on the same symptom?
3. Are thresholds too tight on high-frequency signals?
4. Are inhibit rules configured for parent/child alert relationships?

```promql
# Find alerts that all started at the same time
ALERTS{alertstate="firing"} offset 5m
```

Alert storms usually point to one root failure amplifying across many symptom alerts. Find the root signal, not the loudest alert.

---

## Runbook 10: Real Incident Patterns

Common production scenarios and how to interpret them.

### CPU High, Users Fine

Do not page on CPU alone. High CPU without user impact is not an incident.

Observe:
- Is error rate or latency elevated? If not, monitor.
- Is this trending toward saturation? Set a watch.
- Is there a specific process consuming abnormally?

```bash
ps aux --sort=-%cpu | head
pidstat -u 1 5
```

Premature action on CPU noise creates unnecessary incidents.

---

### Errors After Deploy

If error rate rose exactly when a deploy completed, rollback is often the fastest safe mitigation — even before full root cause analysis.

Decision rule:

```text
high confidence deploy caused it -> rollback immediately
uncertain -> collect 5 min of data, then decide
```

After rollback, verify error rate returns to baseline before marking resolved.

---

### Users Slow, Metrics Fine

This is the hardest pattern. Average latency looks normal but users report slowness.

Check:

- p99 and p999 latency — averages hide tail pain
- Region or datacenter split — is a subset of traffic affected?
- Traces — find which span is slow for affected requests
- Synthetic probes — are external checks also slow?

```promql
# p999 often reveals what p99 hides
histogram_quantile(0.999,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
)
```

---

### Nightly Noisy Alerts

Alerts that fire predictably at low-traffic hours (nights, weekends) are usually misconfigured thresholds — not real incidents.

Fix the alert, not the people:
- Add minimum traffic guard: `and sum(rate(...[5m])) > 100`
- Adjust thresholds for expected low-traffic behavior
- Use time-of-day routing to reduce paging when risk is lower

---

### Dependency Brownout

Your service is internally healthy but users are failing because a downstream service is degraded.

Symptoms:
- Your error rate is elevated
- Your internal metrics look normal (CPU, memory, disk)
- Errors cluster around requests that call a specific dependency

Check:

```promql
# Errors by target dependency
sum(rate(http_requests_total{status=~"5..", upstream="payment-api"}[5m]))
```

```bash
# Check dependency reachability from within a pod
kubectl exec -it <pod> -n <ns> -- curl -vk https://payment-api/health
```

Do not page the wrong team. Confirm which service is the root cause before escalating.

---

## Quick Diagnostic Reference

| Problem | First Check | Tool |
|---|---|---|
| Target down | `up{job="x"} == 0` | Prometheus UI / Status > Targets |
| Alert not firing | Alert visible in Alertmanager? | Alertmanager UI |
| Alert silenced | Active silences matching labels? | Alertmanager UI / amtool |
| No data in Grafana | Datasource healthy? Query correct? | Grafana panel editor |
| High Prometheus memory | `prometheus_tsdb_head_series` | Prometheus metrics |
| Cardinality explosion | `topk(10, count by(__name__)(...))` | PromQL |
| Log ingestion lag | Collector logs and Loki ingester metrics | kubectl logs |
| SLO burn rate false positive | Check traffic volume and counter resets | PromQL |
| Alert storm | Root cause inhibit rules configured? | Alertmanager config |
| Dashboard slow | Recording rules missing? High-cardinality queries? | Grafana query inspector |
| Traffic drop | LB + DNS + deploy markers + upstream routing | PromQL + dig |
| Error spike | Latest deploy + dependencies + auth + saturation | PromQL + traces |
| Latency increase | p99 + traces + queue depth + DB latency | histogram_quantile |
| Users slow, metrics fine | p999 + region split + traces + synthetics | PromQL + Jaeger/Tempo |
| Dependency brownout | Upstream service health + per-upstream error rate | PromQL + curl |
