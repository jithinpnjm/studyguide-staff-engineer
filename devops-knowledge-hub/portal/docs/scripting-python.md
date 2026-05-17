---
title: "🐍 Python for DevOps"
sidebar_position: 15
description: "Zero to hero study guide for Python for DevOps — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

## Why Python for SRE?

Python is the de facto scripting language for SRE and DevOps: it ships on every Linux distro, has first-class SDKs for every cloud provider, rich libraries for HTTP/SSH/JSON/YAML, and async support for high-concurrency tooling. SREs use it for automation, tooling, runbook scripts, API integrations, and custom Prometheus exporters.

---

## Python Fundamentals SREs Actually Use

### Data Structures

```python
# Dict comprehension — build label map from k8s pods
label_map = {pod["name"]: pod["labels"] for pod in pods if pod["ready"]}

# Defaultdict — count events by type without KeyError
from collections import defaultdict
counts = defaultdict(int)
for event in events:
    counts[event["type"]] += 1

# Named tuple — lightweight struct for metrics
from collections import namedtuple
Metric = namedtuple("Metric", ["name", "value", "labels"])
m = Metric("http_requests_total", 42, {"method": "GET", "status": "200"})
```

### String Formatting

```python
# f-strings are fastest and most readable
service = "payment"
count = 1024
msg = f"Service {service!r} processed {count:,} requests"

# Format for log messages with alignment
print(f"{'SERVICE':<20} {'COUNT':>10} {'STATUS':>10}")
for svc, cnt, ok in services:
    print(f"{svc:<20} {cnt:>10,} {'OK' if ok else 'FAIL':>10}")
```

### Error Handling

```python
import logging
log = logging.getLogger(__name__)

def fetch_metrics(url: str, retries: int = 3) -> dict:
    import requests, time
    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=5)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.Timeout:
            log.warning("Timeout on attempt %d/%d", attempt + 1, retries)
            time.sleep(2 ** attempt)  # exponential backoff
        except requests.exceptions.HTTPError as e:
            if e.response.status_code >= 500:
                log.error("Server error %s", e)
                raise
            raise  # 4xx — don't retry
    raise RuntimeError(f"All {retries} attempts failed for {url}")
```

### Context Managers

```python
# Custom context manager for temp directory cleanup
from contextlib import contextmanager
import tempfile, shutil

@contextmanager
def temp_workspace():
    d = tempfile.mkdtemp()
    try:
        yield d
    finally:
        shutil.rmtree(d, ignore_errors=True)

with temp_workspace() as workspace:
    # do work; directory always cleaned up
    pass
```

---

## File and System Operations

```python
from pathlib import Path
import subprocess, shlex

# Modern path handling
config_path = Path.home() / ".config" / "myapp" / "config.yaml"
config_path.parent.mkdir(parents=True, exist_ok=True)

# Read/write with encoding
config_path.write_text("key: value\n", encoding="utf-8")
text = config_path.read_text()

# Glob patterns
log_files = sorted(Path("/var/log/nginx").glob("access.log.*"))

# Run subprocess safely (never shell=True with user input)
result = subprocess.run(
    ["kubectl", "get", "pods", "-n", "default", "-o", "json"],
    capture_output=True,
    text=True,
    check=True,       # raises CalledProcessError if non-zero
    timeout=30,
)
import json
pods = json.loads(result.stdout)
```

### Parallel Subprocess Execution

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess

def run_on_host(host: str, cmd: list[str]) -> tuple[str, str, int]:
    result = subprocess.run(
        ["ssh", f"user@{host}"] + cmd,
        capture_output=True, text=True, timeout=30
    )
    return host, result.stdout + result.stderr, result.returncode

hosts = ["node-1", "node-2", "node-3"]
cmd = ["df", "-h", "/"]

with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(run_on_host, h, cmd): h for h in hosts}
    for future in as_completed(futures):
        host, output, code = future.result()
        status = "OK" if code == 0 else "FAIL"
        print(f"[{status}] {host}: {output.strip()}")
```

---

## YAML / JSON Processing

```python
import yaml, json

# Load multi-document YAML (e.g., kubectl apply -f file.yaml)
with open("manifests.yaml") as f:
    docs = list(yaml.safe_load_all(f))

# Merge and write back
for doc in docs:
    if doc.get("kind") == "Deployment":
        doc["spec"]["replicas"] = 3

with open("manifests-out.yaml", "w") as f:
    yaml.dump_all(docs, f, default_flow_style=False)

# Pretty-print JSON for API responses
print(json.dumps({"status": "ok", "count": 42}, indent=2))
```

---

## HTTP Clients and REST APIs

```python
import httpx  # async-capable, preferred for SRE tooling

# Sync client with connection pooling
with httpx.Client(base_url="https://api.example.com", timeout=10) as client:
    resp = client.get("/v1/services", params={"env": "prod"})
    resp.raise_for_status()
    services = resp.json()

# Async client for concurrent API calls
import asyncio

async def fetch_all(urls: list[str]) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
    results = []
    for url, resp in zip(urls, responses):
        if isinstance(resp, Exception):
            print(f"Error fetching {url}: {resp}")
        else:
            results.append(resp.json())
    return results
```

### Prometheus HTTP API

```python
import httpx

PROMETHEUS = "http://prometheus.monitoring.svc:9090"

def query_prometheus(promql: str) -> list:
    resp = httpx.get(f"{PROMETHEUS}/api/v1/query", params={"query": promql})
    resp.raise_for_status()
    data = resp.json()
    if data["status"] != "success":
        raise RuntimeError(data.get("error", "unknown error"))
    return data["data"]["result"]

# Get services with error rate > 5%
results = query_prometheus(
    'sum by (service) (rate(http_requests_total{status=~"5.."}[5m])) / '
    'sum by (service) (rate(http_requests_total[5m])) > 0.05'
)
for r in results:
    svc = r["metric"]["service"]
    rate = float(r["value"][1])
    print(f"{svc}: {rate:.1%} error rate")
```

---

## Kubernetes Client

```python
from kubernetes import client, config

config.load_kube_config()  # or load_incluster_config() inside a pod
v1 = client.CoreV1Api()
apps = client.AppsV1Api()

# List pods with filtering
pods = v1.list_namespaced_pod(
    namespace="production",
    label_selector="app=payment",
    field_selector="status.phase=Running",
)
for pod in pods.items:
    print(pod.metadata.name, pod.status.phase)

# Scale a deployment
apps.patch_namespaced_deployment_scale(
    name="payment",
    namespace="production",
    body={"spec": {"replicas": 5}},
)

# Watch for pod events
from kubernetes import watch
w = watch.Watch()
for event in w.stream(v1.list_namespaced_pod, namespace="default", timeout_seconds=60):
    etype = event["type"]   # ADDED, MODIFIED, DELETED
    pod_name = event["object"].metadata.name
    print(f"{etype}: {pod_name}")
    if etype == "DELETED":
        w.stop()
```

---

## AWS SDK (boto3)

```python
import boto3

# EC2: find instances missing required tag
ec2 = boto3.resource("ec2", region_name="us-east-1")
untagged = []
for instance in ec2.instances.filter(Filters=[{"Name": "instance-state-name", "Values": ["running"]}]):
    tags = {t["Key"]: t["Value"] for t in (instance.tags or [])}
    if "Team" not in tags:
        untagged.append(instance.id)
print(f"Untagged running instances: {untagged}")

# S3: list objects older than 90 days
import datetime
s3 = boto3.client("s3")
cutoff = datetime.datetime.now(tz=datetime.timezone.utc) - datetime.timedelta(days=90)
paginator = s3.get_paginator("list_objects_v2")
old_keys = []
for page in paginator.paginate(Bucket="my-bucket", Prefix="logs/"):
    for obj in page.get("Contents", []):
        if obj["LastModified"] < cutoff:
            old_keys.append(obj["Key"])
print(f"Old objects: {len(old_keys)}")

# SSM Parameter Store — read secrets
ssm = boto3.client("ssm", region_name="us-east-1")
param = ssm.get_parameter(Name="/prod/payment/db_password", WithDecryption=True)
password = param["Parameter"]["Value"]
```

---

## Async Python for SRE Tooling

```python
import asyncio
import httpx

async def check_endpoint(client: httpx.AsyncClient, name: str, url: str) -> dict:
    try:
        resp = await client.get(url, timeout=5)
        return {"name": name, "status": resp.status_code, "ok": resp.status_code == 200}
    except Exception as e:
        return {"name": name, "status": -1, "ok": False, "error": str(e)}

async def health_check_all(endpoints: dict[str, str]) -> list[dict]:
    async with httpx.AsyncClient() as client:
        tasks = [check_endpoint(client, name, url) for name, url in endpoints.items()]
        return await asyncio.gather(*tasks)

endpoints = {
    "payment": "https://payment.internal/health",
    "auth": "https://auth.internal/health",
    "inventory": "https://inventory.internal/health",
}

results = asyncio.run(health_check_all(endpoints))
for r in results:
    icon = "OK" if r["ok"] else "FAIL"
    print(f"[{icon}] {r['name']}: {r['status']}")
```

---

## Custom Prometheus Exporter

```python
from prometheus_client import start_http_server, Gauge, Counter, Histogram
import time, random

# Metrics
REQUEST_LATENCY = Histogram("myapp_request_duration_seconds", "Request latency", ["endpoint"])
ACTIVE_CONNECTIONS = Gauge("myapp_active_connections", "Active connections", ["region"])
ERRORS = Counter("myapp_errors_total", "Total errors", ["type"])

def collect_metrics():
    # Simulates fetching real data from your service
    ACTIVE_CONNECTIONS.labels(region="us-east-1").set(random.randint(10, 100))
    ACTIVE_CONNECTIONS.labels(region="eu-west-1").set(random.randint(5, 50))

if __name__ == "__main__":
    start_http_server(8080)   # exposes /metrics
    while True:
        collect_metrics()
        time.sleep(15)
```

```yaml
# Prometheus scrape config
scrape_configs:
  - job_name: myapp-exporter
    static_configs:
      - targets: ["myapp-exporter:8080"]
```

---

## Configuration Management

```python
from dataclasses import dataclass, field
import os

@dataclass
class Config:
    db_url: str = field(default_factory=lambda: os.environ["DATABASE_URL"])
    api_key: str = field(default_factory=lambda: os.environ["API_KEY"])
    workers: int = int(os.getenv("WORKERS", "4"))
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    allowed_hosts: list[str] = field(
        default_factory=lambda: os.getenv("ALLOWED_HOSTS", "").split(",")
    )

config = Config()
```

---

## Logging Best Practices

```python
import logging, sys

def configure_logging(level: str = "INFO"):
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )

# Use structured logging for production (JSON logs)
import json, datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "ts": datetime.datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        })

log = logging.getLogger("myapp")
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
log.addHandler(handler)
log.info("Server started")
# → {"ts":"2025-01-15T10:00:00Z","level":"INFO","logger":"myapp","msg":"Server started"}
```

---

## Testing SRE Scripts

```python
import pytest
from unittest.mock import patch, MagicMock

def scale_deployment(namespace: str, name: str, replicas: int):
    from kubernetes import client
    apps = client.AppsV1Api()
    apps.patch_namespaced_deployment_scale(
        name=name, namespace=namespace,
        body={"spec": {"replicas": replicas}},
    )

@patch("kubernetes.client.AppsV1Api")
def test_scale_deployment(mock_api_class):
    mock_api = MagicMock()
    mock_api_class.return_value = mock_api

    scale_deployment("default", "payment", 3)

    mock_api.patch_namespaced_deployment_scale.assert_called_once_with(
        name="payment",
        namespace="default",
        body={"spec": {"replicas": 3}},
    )

# Parametrized tests for validation logic
@pytest.mark.parametrize("replicas,valid", [
    (0, False),
    (1, True),
    (100, True),
    (-1, False),
])
def test_replicas_validation(replicas, valid):
    assert (replicas > 0) == valid
```

---

## Performance and Profiling

```python
# cProfile for CPU profiling
import cProfile, pstats

with cProfile.Profile() as pr:
    run_heavy_function()

stats = pstats.Stats(pr)
stats.sort_stats("cumulative")
stats.print_stats(10)  # top 10 functions

# Memory profiling with memory_profiler
from memory_profiler import profile

@profile
def load_large_dataset():
    data = []
    for i in range(1_000_000):
        data.append({"id": i, "value": i * 2})
    return data
```

---

## Interview Prep

**"How do you handle secrets in Python scripts?"**
Never hardcode. Read from environment variables (`os.environ`), inject via Vault agent sidecar, or use cloud-native secret managers (AWS SSM, GCP Secret Manager) via SDK. Use `python-dotenv` for local dev only.

**"How do you make a Python script production-safe?"**
Structured JSON logging, explicit timeout on all network calls, exponential backoff with jitter on retries, graceful SIGTERM handling, Prometheus metrics for monitoring, and linting/type-checking in CI (ruff, mypy).

**"Sync vs async — when to use which?"**
Async (`asyncio` + `httpx`) for I/O-bound concurrency (checking 100 endpoints simultaneously). `ThreadPoolExecutor` for blocking I/O libraries that don't support async. `ProcessPoolExecutor`/`multiprocessing` for CPU-bound work. Never mix blocking calls into an async event loop.

**"How do you test scripts that shell out?"**
Mock `subprocess.run` with `unittest.mock.patch`. For integration tests, use a temp directory with a known fake binary on `PATH`, or spin up a container with the real dependency.



---
