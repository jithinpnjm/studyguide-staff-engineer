---
title: "📊 Observability"
sidebar_position: 3
description: "Zero to hero study guide for Observability — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

Observability is the practice of understanding system internals from external outputs. The shift from monitoring (checking if things are up) to observability (understanding WHY things are behaving the way they are) enables engineers to debug distributed systems without guessing.

For Staff/Principal engineers: you design the observability platform that all teams build on. Getting this right means incidents are resolved in minutes, capacity planning is data-driven, and SLO conversations with the business are grounded in reality.

---

## Core Mental Models

**The three pillars — Metrics, Logs, Traces:**
- **Metrics:** numeric measurements over time. Efficient, alertable, aggregatable. Tell you WHAT is happening.
- **Logs:** timestamped event records. Tell you WHAT happened and show the sequence.
- **Traces:** end-to-end request flow across services. Tell you WHERE time was spent in a distributed system.

No single pillar is sufficient. A trace with no metrics misses the 1% of slow requests that manifest as a p99 alert. Metrics without logs tell you something is wrong but not why. Logs without traces can't show distributed causality.

**Proactive detection** — identify issues before they cause failures, not after users report them.

**Cardinality is the enemy of scale** — high-cardinality labels (user_id, request_id) on metrics explode storage and query time. Keep label cardinality bounded. Use traces for high-cardinality data.

---

## Prometheus

### What is Prometheus?

Prometheus is an open-source systems monitoring and alerting toolkit originally built at SoundCloud. Since its inception in 2012, it has been widely adopted across the industry. It joined the Cloud Native Computing Foundation in 2016 as the second hosted project after Kubernetes.

**Core characteristics:**
- Collects and stores metrics as time series data — each metric stored with a timestamp and optional key-value labels
- Pull model over HTTP — Prometheus scrapes metrics from target endpoints at configured intervals
- Multi-dimensional data model: metrics identified by metric name and key/value label pairs
- No reliance on distributed storage — single server nodes are autonomous
- PromQL: a flexible query language to leverage the multi-dimensional data model
- Supports service discovery and static configuration for target discovery

**What are metrics?**

Metrics are numerical measurements recorded over time. What to measure depends on the application:
- A web server measures requests per second and latency
- A database measures queries per second and cache hit rate
- A node measures CPU usage, memory, and disk I/O

### Prometheus Architecture

Prometheus scrapes metrics from instrumented jobs, either directly or via a Pushgateway for short-lived jobs. It stores all scraped samples locally and runs rules over this data to:
- Aggregate and record new time series from existing data (recording rules)
- Generate alerts when thresholds are breached (alerting rules)

Grafana or other API consumers visualize the collected data by querying Prometheus via PromQL.

### Installing Prometheus on AWS EC2 (Ubuntu)

**Prerequisites:**
- AWS EC2 instance running Ubuntu
- SSH access to the instance
- Security Group inbound rules: TCP 9090 (Prometheus), TCP 9100 (Node Exporter), TCP 3000 (Grafana)

**Step 1: Create a dedicated Prometheus user**
```bash
sudo useradd \
  --system \
  --no-create-home \
  --shell /bin/false prometheus

sudo mkdir /etc/prometheus
sudo mkdir /var/lib/prometheus
```

**Step 2: Download and extract Prometheus**
```bash
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz

tar -xvf prometheus-2.45.0.linux-amd64.tar.gz
```

**Step 3: Install binaries and config**
```bash
cd prometheus-2.45.0.linux-amd64

# Move binaries to PATH
sudo mv prometheus promtool /usr/local/bin/

# Move console libraries
sudo mv consoles/ console_libraries/ /etc/prometheus/

# Move default config
sudo mv prometheus.yml /etc/prometheus/prometheus.yml
```

**Step 4: Set ownership**
```bash
sudo chown -R prometheus:prometheus /etc/prometheus/ /var/lib/prometheus/
```

**Step 5: Verify installation**
```bash
prometheus --version
```

**Step 6: Create systemd service**
```bash
sudo vim /etc/systemd/system/prometheus.service
```

```ini
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=500
StartLimitBurst=5

[Service]
User=prometheus
Group=prometheus
Type=simple
Restart=on-failure
RestartSec=5s
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus/ \
  --web.console.templates=/etc/prometheus/consoles \
  --web.console.libraries=/etc/prometheus/console_libraries \
  --web.listen-address=0.0.0.0:9090

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus
sudo systemctl status prometheus
```

Prometheus is now accessible at `http://<EC2-public-ip>:9090`

### Prometheus Configuration — prometheus.yml

The core configuration file defines scrape jobs (which targets to scrape and how often):

```yaml
global:
  scrape_interval: 15s       # How often to scrape targets
  evaluation_interval: 15s  # How often to evaluate rules

rule_files:
  - "alert_rules.yml"
  - "recording_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

scrape_configs:
  # Prometheus scrapes itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Node Exporter — host-level metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  # cAdvisor — Docker container metrics
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['localhost:8080']

  # Kubernetes pod discovery
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        target_label: __address__
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
```

---

## Node Exporter

Node Exporter exposes host-level metrics (CPU, memory, disk, network) for Prometheus to scrape.

**Install Node Exporter:**
```bash
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.0/node_exporter-1.6.0.linux-amd64.tar.gz
tar xvf node_exporter-1.6.0.linux-amd64.tar.gz
sudo cp node_exporter-1.6.0.linux-amd64/node_exporter /usr/local/bin/

# Create systemd service
sudo vim /etc/systemd/system/node_exporter.service
```

```ini
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=prometheus
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

Node Exporter metrics are available at `http://localhost:9100/metrics`

---

## cAdvisor — Container Monitoring

cAdvisor (Container Advisor) collects resource usage and performance statistics for running Docker containers. It exposes metrics that Prometheus can scrape.

**Install cAdvisor with Docker:**
```bash
# Install Docker
sudo apt update && sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker

# Create sample containers to monitor
sudo docker run -d --name container1 nginx
sudo docker run -d --name container2 httpd
sudo docker ps

# Run cAdvisor
sudo docker run -d \
  --name=cadvisor \
  --volume=/:/rootfs:ro \
  --volume=/var/run:/var/run:rw \
  --volume=/sys:/sys:ro \
  --volume=/var/lib/docker/:/var/lib/docker:ro \
  --publish=8080:8080 \
  gcr.io/cadvisor/cadvisor
```

cAdvisor metrics are available at `http://localhost:8080/metrics`

**Key cAdvisor metrics:**
- `container_cpu_usage_seconds_total` — CPU time consumed by container
- `container_memory_usage_bytes` — current memory usage
- `container_network_receive_bytes_total` — bytes received over network
- `container_fs_usage_bytes` — bytes used on container filesystem

---

## PromQL — Prometheus Query Language

PromQL is the query language used to select and aggregate time series data in Prometheus. Grafana dashboards and alert rules both use PromQL.

### Metric Types

| Type | Description | Example |
|------|-------------|---------|
| Counter | Monotonically increasing value | `http_requests_total` |
| Gauge | Value that can go up or down | `memory_usage_bytes` |
| Histogram | Distribution of observations in buckets | `http_request_duration_seconds` |
| Summary | Similar to histogram with pre-calculated quantiles | `rpc_duration_seconds` |

### Basic PromQL Queries

```promql
# Current CPU usage rate (per second, over 5 minutes)
rate(node_cpu_seconds_total{mode="idle"}[5m])

# Available memory in MB
node_memory_MemAvailable_bytes / 1024 / 1024

# HTTP request rate per second
rate(http_requests_total[5m])

# HTTP error rate (5xx errors)
rate(http_requests_total{status=~"5.."}[5m])

# 95th percentile request latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Pod CPU usage across all containers
rate(container_cpu_usage_seconds_total{container!=""}[5m])

# Pod memory usage
container_memory_usage_bytes{container!=""}

# Disk usage percentage
(node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes * 100

# Number of running pods per namespace
count by (namespace) (kube_pod_info)

# Pods not in Running state
kube_pod_status_phase{phase!="Running"}
```

### Aggregation Operators

```promql
# Sum CPU usage across all nodes
sum(rate(node_cpu_seconds_total[5m]))

# Average memory usage by job
avg by (job) (node_memory_MemAvailable_bytes)

# Max request latency across all instances
max by (service) (http_request_duration_seconds)

# Count of HTTP requests per status code
sum by (status) (rate(http_requests_total[5m]))
```

---

## Alertmanager

Alertmanager handles alerts sent by Prometheus. It deduplicates, groups, and routes alerts to the correct receiver (PagerDuty, Slack, email, etc.).

**Alertmanager configuration:**
```yaml
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10m
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: pagerduty
    - match:
        severity: warning
      receiver: slack

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        title: '{{ .CommonAnnotations.summary }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: YOUR_PAGERDUTY_KEY

  - name: 'slack'
    slack_configs:
      - channel: '#alerts-warning'
        text: '{{ .CommonAnnotations.description }}'

inhibit_rules:
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ['alertname', 'cluster']
```

### Alert Rules

Alert rules are defined in YAML and reference PromQL expressions:

```yaml
# alert_rules.yml
groups:
  - name: infrastructure
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is above 80% for 5 minutes. Current: {{ $value }}%"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage above 85%. Current: {{ $value }}%"

      - alert: DiskSpaceLow
        expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes * 100 > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Disk space low on {{ $labels.instance }}"
          description: "Disk {{ $labels.mountpoint }} is {{ $value }}% full"

      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[5m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod {{ $labels.pod }} is crash looping"
          description: "Pod {{ $labels.namespace }}/{{ $labels.pod }} has restarted {{ $value }} times in 5 minutes"
```

---

## Grafana

### Installing Grafana

**On Ubuntu:**
```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

Grafana is accessible at `http://<server-ip>:3000` (default login: `admin` / `admin`)

**On Docker:**
```bash
docker run -d \
  --name=grafana \
  -p 3000:3000 \
  -v grafana-storage:/var/lib/grafana \
  grafana/grafana-oss
```

### Adding Prometheus as a Data Source

1. Open Grafana at `http://localhost:3000`
2. Go to Configuration → Data Sources → Add data source
3. Select Prometheus
4. Set URL: `http://localhost:9090`
5. Click Save & Test

**Via Grafana API:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Prometheus","type":"prometheus","url":"http://localhost:9090","access":"proxy"}' \
  http://admin:admin@localhost:3000/api/datasources
```

### Building Dashboards

Grafana dashboards consist of panels, each containing a PromQL query and a visualization type (graph, gauge, table, stat).

**Key dashboard features:**
- **Variables/Templates:** make dashboards reusable across environments by parameterizing labels like `instance`, `namespace`, `job`
- **Annotations:** mark events (deployments, incidents) on time series graphs to correlate with metric changes
- **Alerting:** Grafana can send alerts directly (in addition to or instead of Alertmanager)

**Common dashboard panels:**
```promql
# Request rate panel
sum(rate(http_requests_total[5m])) by (service)

# Error rate (%) panel
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# p99 latency panel
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))

# Node CPU usage panel
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Kubernetes pod count panel
count by (namespace) (kube_pod_status_phase{phase="Running"})
```

**Importing pre-built dashboards:** Grafana.com hosts hundreds of community dashboards. Import by ID:
- Node Exporter Full: dashboard ID `1860`
- Kubernetes cluster monitoring: dashboard ID `315`
- Docker / cAdvisor: dashboard ID `14282`

---

## Kubernetes Monitoring with Prometheus

### Deploying Prometheus in Kubernetes (kube-prometheus-stack)

The `kube-prometheus-stack` Helm chart deploys Prometheus, Alertmanager, Grafana, and all required exporters:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring

helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=your-secure-password \
  --set prometheus.prometheusSpec.retention=15d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi
```

**Access services:**
```bash
# Port-forward Prometheus
kubectl port-forward svc/kube-prometheus-stack-prometheus 9090:9090 -n monitoring

# Port-forward Grafana
kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring

# Port-forward Alertmanager
kubectl port-forward svc/kube-prometheus-stack-alertmanager 9093:9093 -n monitoring
```

### kube-state-metrics and cAdvisor

**kube-state-metrics:** Generates metrics about Kubernetes object states (pod phase, deployment replicas, node conditions). These are the `kube_*` metrics.

**cAdvisor:** Built into the Kubelet, exposes per-container resource usage metrics (`container_*` metrics).

**Key Kubernetes metrics to monitor:**
```promql
# Deployment replica status
kube_deployment_status_replicas_available / kube_deployment_spec_replicas

# Pod OOM kills
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}

# CPU throttling
rate(container_cpu_throttled_seconds_total[5m]) / rate(container_cpu_usage_seconds_total[5m])

# Persistent volume usage
kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100

# API server request latency
histogram_quantile(0.99, rate(apiserver_request_duration_seconds_bucket[5m]))
```

### ServiceMonitor — Scraping Application Metrics

The `ServiceMonitor` CRD (from kube-prometheus-stack) tells Prometheus which Kubernetes services to scrape:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  selector:
    matchLabels:
      app: my-app
  namespaceSelector:
    matchNames:
      - production
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```

The target application service must expose a `/metrics` endpoint and have port `metrics` defined:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  selector:
    app: my-app
  ports:
    - name: metrics
      port: 8080
      targetPort: 8080
```

---

## Loki — Log Aggregation

Loki is a log aggregation system designed to work alongside Prometheus. It is horizontally scalable, highly available, and uses the same label-based indexing approach as Prometheus.

**Key difference from Elasticsearch:** Loki only indexes log labels (metadata) — not the log content itself. This makes it far more cost-efficient. Log content is searched with regex at query time.

### Loki + Promtail Setup

Promtail is the log collection agent that ships logs to Loki.

**Docker Compose stack (Loki + Promtail + Grafana):**
```yaml
version: "3"
services:
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/config.yml
    command: -config.file=/etc/loki/config.yml

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/log:/var/log:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

**Promtail configuration:**
```yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          __path__: /var/log/*.log

  - job_name: docker
    static_configs:
      - targets:
          - localhost
        labels:
          job: docker
          __path__: /var/lib/docker/containers/*/*log
    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
      - labels:
          stream:
```

**Querying logs in Grafana with LogQL:**
```logql
# All logs from a job
{job="varlogs"}

# Filter for ERROR logs
{job="docker"} |= "ERROR"

# Parse structured logs
{app="my-app"} | json | level="error"

# Log rate over time
rate({job="docker"} |= "error" [5m])

# Count errors by app
sum by (app) (count_over_time({job="docker"} |= "error" [5m]))
```

---

## Exporters and Instrumentation

Prometheus uses a pull model — applications must expose metrics at a `/metrics` HTTP endpoint, or you use an exporter that translates existing data into the Prometheus format.

**Popular exporters:**

| Exporter | Metrics collected | Port |
|----------|-----------------|------|
| Node Exporter | CPU, memory, disk, network on Linux hosts | 9100 |
| cAdvisor | Docker container resource usage | 8080 |
| Blackbox Exporter | HTTP, TCP, DNS, ICMP probe results | 9115 |
| MySQL Exporter | MySQL database metrics | 9104 |
| PostgreSQL Exporter | PostgreSQL database metrics | 9187 |
| Redis Exporter | Redis metrics | 9121 |
| JMX Exporter | JVM metrics (Java apps) | 5556 |
| Elasticsearch Exporter | Elasticsearch cluster metrics | 9114 |

**Blackbox Exporter — probing HTTP endpoints:**
```yaml
# blackbox.yml
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: [200]
      method: GET
      tls_config:
        insecure_skip_verify: false
```

```yaml
# prometheus.yml scrape config for blackbox
- job_name: 'blackbox'
  metrics_path: /probe
  params:
    module: [http_2xx]
  static_configs:
    - targets:
        - https://api.example.com/health
        - https://api.example.com/ready
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - source_labels: [__param_target]
      target_label: instance
    - target_label: __address__
      replacement: blackbox-exporter:9115
```

---

## Monitoring AWS with CloudWatch and Prometheus

**CloudWatch integration with Prometheus:** The `yet-another-cloudwatch-exporter` (YACE) pulls AWS CloudWatch metrics into Prometheus format, allowing unified dashboards in Grafana.

**Deploy YACE:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: yace
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: yace
  template:
    metadata:
      labels:
        app: yace
    spec:
      containers:
        - name: yace
          image: ghcr.io/nerdswords/yet-another-cloudwatch-exporter:v0.55.0
          args:
            - -config.file=/config/config.yml
          volumeMounts:
            - name: config
              mountPath: /config
      volumes:
        - name: config
          configMap:
            name: yace-config
```

---

## Scaling and Performance

**High cardinality:** Having many unique label value combinations (e.g., per-user metrics) causes metric explosion. Avoid labels with unbounded values. Use traces or logs for per-request data.

**Recording rules:** Pre-compute expensive PromQL queries and store as new metrics. Reduces dashboard load time:
```yaml
groups:
  - name: recording_rules
    rules:
      - record: job:http_requests_total:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))

      - record: job:http_errors:rate5m
        expr: sum by (job) (rate(http_requests_total{status=~"5.."}[5m]))
```

**Remote storage:** For long-term retention, ship metrics to Thanos, Cortex, or Victoria Metrics. This enables:
- Retention beyond local disk capacity
- Global query view across multiple Prometheus servers
- High availability with deduplication

**Federation:** Prometheus can scrape another Prometheus instance, enabling hierarchical setups:
```yaml
scrape_configs:
  - job_name: 'federate'
    honor_labels: true
    metrics_path: '/federate'
    params:
      'match[]':
        - '{job="prometheus"}'
        - '{__name__=~"job:.*"}'
    static_configs:
      - targets:
          - 'source-prometheus:9090'
```

---

## Security for Monitoring Stack

- Run Prometheus with a dedicated system user (not root)
- Enable Grafana authentication — disable anonymous access in production
- Use TLS for Prometheus, Alertmanager, and Grafana endpoints
- Restrict Prometheus scrape access to internal network only
- Rotate Grafana API keys and Alertmanager receiver credentials regularly
- Apply Kubernetes RBAC to limit who can access `kubectl port-forward` to monitoring pods

**Grafana authentication hardening:**
```ini
# grafana.ini
[auth.anonymous]
enabled = false

[auth]
disable_login_form = false

[security]
admin_password = use-a-strong-password-from-vault
secret_key = use-a-randomly-generated-key
cookie_secure = true
```

---

## Interview Preparation

**Common observability interview questions:**

1. **Explain the difference between a Counter and a Gauge in Prometheus.**
   - Counter: monotonically increasing — only goes up (or resets to 0 on restart). Use `rate()` to get per-second rate. Example: `http_requests_total`.
   - Gauge: can go up or down. Represents a current value. Example: `memory_usage_bytes`, `active_connections`. Do not use `rate()` on gauges.

2. **How do you calculate the error rate of an HTTP service in PromQL?**
   ```promql
   sum(rate(http_requests_total{status=~"5.."}[5m])) /
   sum(rate(http_requests_total[5m])) * 100
   ```

3. **What is the pull model in Prometheus and what are its implications?**
   - Prometheus initiates the scrape — it reaches out to each target's `/metrics` endpoint
   - Implication: Prometheus must have network access to all targets
   - Short-lived jobs (cron, batch) can't be scraped reliably — use Pushgateway
   - Service discovery (Kubernetes, Consul) keeps the target list dynamic without manual config changes

4. **Why is high cardinality a problem in Prometheus?**
   - Each unique combination of label values is a separate time series stored in memory and on disk
   - A metric with labels `{user_id, request_id}` can produce millions of unique series
   - This exhausts memory (Prometheus is an in-memory database), slows queries, and increases storage cost
   - Solution: keep labels bounded — use trace IDs and user IDs in distributed tracing systems (Jaeger, Tempo), not in metrics

5. **What is the difference between Loki and Elasticsearch for log management?**
   - Loki only indexes labels (metadata), not log content — dramatically lower storage and indexing cost
   - Elasticsearch indexes all log content — enables full-text search but is expensive at scale
   - Loki uses LogQL for log queries; Elasticsearch uses Lucene query syntax (via Kibana)
   - Loki integrates natively with Prometheus label model — same labels for logs and metrics enables correlation

6. **How do you monitor a Kubernetes cluster with Prometheus?**
   - Deploy `kube-prometheus-stack` via Helm — includes Prometheus, Alertmanager, Grafana, kube-state-metrics, Node Exporter
   - `kube-state-metrics` exposes object state metrics (`kube_pod_status_phase`, `kube_deployment_status_replicas_available`)
   - cAdvisor (built into Kubelet) exposes container resource usage
   - Use `ServiceMonitor` CRDs to configure scraping of application metrics
   - Import Grafana dashboards 315 (cluster overview) and 1860 (node exporter)

7. **Walk me through setting up an alert for pod OOM kills.**
   ```yaml
   - alert: PodOOMKilled
     expr: kube_pod_container_status_last_terminated_reason{reason="OOMKilled"} == 1
     for: 0m
     labels:
       severity: critical
     annotations:
       summary: "Pod {{ $labels.pod }} OOM killed"
       description: "Container {{ $labels.container }} in pod {{ $labels.namespace }}/{{ $labels.pod }} was OOM killed."
   ```
   Route to PagerDuty via Alertmanager for immediate response. Investigate with `kubectl top pod` and set proper resource limits.

8. **What is a recording rule and when should you use one?**
   - A recording rule pre-computes a PromQL expression and stores the result as a new metric
   - Use when: dashboard panels use expensive aggregation queries that slow load time, or when the same complex query is used in multiple alert rules
   - Example: pre-compute `job:http_requests_total:rate5m` so dashboards query the pre-computed metric instead of re-computing across thousands of series
