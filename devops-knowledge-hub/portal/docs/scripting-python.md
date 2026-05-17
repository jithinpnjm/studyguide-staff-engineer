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

## 📁 Source Documents

> 11 documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
| [[Python] 1740664864114](http://localhost:8765/api/documents/974d8978-e45e-47e7-96b1-a07438cfe2ff/view) | PDF | intermediate |
| [[Python] 1741038570892](http://localhost:8765/api/documents/73209711-f738-4d94-849d-343332e35466/view) | PDF | beginner |
| [[Python] 1741239986744](http://localhost:8765/api/documents/6fff2590-ca5d-4f4e-9adf-e48af9e74efc/view) | GIF | beginner |
| [[Python] 1741253261354](http://localhost:8765/api/documents/ac976e53-5c2a-4785-8726-0ff6821eb217/view) | PDF | beginner |
| [[Python] 1741281074429](http://localhost:8765/api/documents/ce3b65fb-f3e2-48d3-acc5-0fec444c4761/view) | PDF | beginner |
| [[Python] 1741324724561](http://localhost:8765/api/documents/3e48cc59-e5be-4777-8d9b-f953a3ccaab9/view) | PDF | intermediate |
| [[Python] 1741333023890](http://localhost:8765/api/documents/f0243b07-94e5-4077-9d17-8c6de8583d5d/view) | PDF | beginner |
| [[Python] 1741666147747](http://localhost:8765/api/documents/cce7cb8b-2da7-472f-8d07-29c34c79cc4c/view) | PDF | beginner |
| [[Python] 1743595344907](http://localhost:8765/api/documents/ecaf9ff5-baf4-49e6-8512-e1fa9538c092/view) | PDF | intermediate |
| [[Interview Ouestions > Python] 1741948994647](http://localhost:8765/api/documents/b781e107-1783-4c8e-8a28-1fad606a2754/view) | PDF | intermediate |
| [[Interview Ouestions > Python] 1742192621363](http://localhost:8765/api/documents/22187a94-3403-4cbe-b400-2f373854cad0/view) | PDF | intermediate |


<AIChatWidget domain="scripting-python" title="Ask AI about Python for DevOps" />

---

## [SRE] Foundations: Python Premium Teaching Guide For SRE And Platform Engineers

## Foundations: Python Premium Teaching Guide For SRE And Platform Engineers

Python is the language you reach for when Bash becomes too fragile.

For SRE work, Python is less about algorithms and more about reliable automation: tools that call APIs, parse structured data, inspect systems, retry safely, log clearly, and fail predictably.

---

## How To Use This Module

Study in layers:

1. **Beginner Layer** — syntax, data structures, files, functions.
2. **Intermediate Layer** — JSON/YAML, subprocess, HTTP APIs, logging, exceptions.
3. **Advanced Layer** — retries, concurrency, CLIs, tests, packaging, type hints.
4. **Production SRE Layer** — Kubernetes/cloud automation, health tools, incident scripts.
5. **Interview Layer** — explain when Python beats Bash and how to build maintainable ops tools.

---

## Memory Palace: Operations Workshop

| Python Concept | Workshop Analogy | Meaning |
|---|---|---|
| Script | Procedure card | Repeatable automation |
| Function | Specialized tool | Reusable logic |
| Module | Toolbox drawer | Related code grouped |
| Exception | Alarm light | Failure path |
| Logger | Audit camera | What happened |
| CLI | Control panel | Operator interface |
| Test | Safety check | Prevent regressions |
| Package | Tool kit shipment | Reusable distribution |

---

## Beginner Layer: Why Python For SRE

Use Python when you need:

- structured data handling
- API integration
- complex branching logic
- maintainable automation
- tests
- retries and timeouts
- reusable internal tools

Use Bash when you are mostly chaining commands.

Use Python when logic becomes a program.

---

## Beginner Layer: Core Syntax

```python
service = "checkout"
replicas = 3
healthy = True
latency_ms = 245.7
```

Strings and f-strings:

```python
namespace = "prod"
pod = "api-7d9f"
print(f"Checking {namespace}/{pod}")
```

---

## Beginner Layer: Data Structures

Lists:

```python
pods = ["api-1", "api-2"]
pods.append("api-3")
```

Dictionaries:

```python
status = {"api-1": "Running", "api-2": "CrashLoopBackOff"}
print(status.get("api-3", "Unknown"))
```

Sets:

```python
expected = {"a", "b", "c"}
actual = {"a", "b"}
missing = expected - actual
```

Comprehension:

```python
healthy = [n for n, s in status.items() if s == "Running"]
```

---

## Beginner Layer: Functions

```python
def is_healthy(code: int) -> bool:
    return 200 <= code < 300
```

Good operational tools are built from small testable functions.

---

## Intermediate Layer: Files And Paths

```python
from pathlib import Path

path = Path("/var/log/app.log")
if path.exists():
    print(path.read_text()[:500])
```

Prefer `pathlib` over fragile string path handling.

---

## Intermediate Layer: JSON And YAML

```python
import json
raw = '{"service":"api","replicas":3}'
data = json.loads(raw)
```

```python
import yaml
manifest = yaml.safe_load(Path("deployment.yaml").read_text())
print(manifest["kind"])
```

Use real parsers, not regex hacks.

---

## Intermediate Layer: Exceptions And Exit Codes

```python
import sys
from pathlib import Path

try:
    data = Path("config.json").read_text()
except FileNotFoundError:
    print("config missing")
    sys.exit(1)
```

Rules:

- catch specific exceptions
- add useful context
- exit non-zero on failure
- never silently swallow errors

---

## Intermediate Layer: Logging Like An Operator

```python
import logging
logging.basicConfig(level=logging.INFO,
 format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)
logger.info("starting check")
```

Logs should answer:

- what happened?
- when?
- against what target?
- what action was taken?

---

## Intermediate Layer: Running Commands Safely

```python
import subprocess

result = subprocess.run(
    ["kubectl", "get", "pods", "-A", "-o", "json"],
    capture_output=True,
    text=True,
    timeout=30,
    check=True,
)
```

Prefer argument lists.

Avoid `shell=True` unless fully controlled.

---

## Intermediate Layer: HTTP APIs With Timeouts

```python
import urllib.request
with urllib.request.urlopen("https://example.com", timeout=5) as resp:
    print(resp.status)
```

Every network call needs a timeout.

---

## Advanced Layer: Retries With Backoff

```python
import time
for attempt in range(3):
    try:
        break
    except Exception:
        time.sleep(2 ** attempt)
```

Better production retries use:

- max attempts
- jitter
- timeout per attempt
- retry only transient errors

Bad retries amplify incidents.

---

## Advanced Layer: Concurrency

Use threads for many network checks.

```python
from concurrent.futures import ThreadPoolExecutor
```

Use processes for CPU-heavy tasks.

Do not create unlimited workers.

---

## Advanced Layer: Dataclasses And Types

```python
from dataclasses import dataclass

@dataclass
class CheckResult:
    target: str
    ok: bool
    latency_ms: float
```

Type hints help readability and tooling.

---

## Advanced Layer: Building CLIs

```python
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("url")
args = parser.parse_args()
```

Good CLIs include:

- help text
- sane defaults
- clear exit codes
- readable output

---

## Advanced Layer: Testing

```python
def is_success(code: int) -> bool:
    return 200 <= code < 300

def test_is_success():
    assert is_success(200)
```

Use tests when tools can affect production.

---

## Production SRE Layer: Real Incidents

### Bash Script Became Unmaintainable

Symptoms:

- nested conditions
- JSON parsed with grep
- no tests

Fix:

Rewrite as Python CLI with modules and tests.

### Health Checker Hung During Incident

Cause:

- no timeout

Fix:

Every network call gets timeout and bounded retries.

### Need Fast Kubernetes Audit

Python can summarize pod states, restarts, image drift, or namespace health quickly.

```python
import json, subprocess
raw = subprocess.run([
 "kubectl","get","pods","-A","-o","json"
], capture_output=True, text=True).stdout
data = json.loads(raw)
print(len(data["items"]))
```

---

## Production SRE Layer: Tool Design Principles

Build tools that are:

- idempotent where possible
- timeout aware
- observable with logs
- safe by default
- configurable
- testable
- easy to run in CI/CD

---

## Bash Vs Python Judgment

| Use Bash | Use Python |
|---|---|
| command chaining | complex logic |
| one-liners | reusable tool |
| text streams | JSON/YAML/API data |
| quick runbooks | tests/packaging |
| shell-native ops | structured errors |

Senior engineers know when Bash has become technical debt.

---

## Interview Layer: Strong Answers

### When replace Bash with Python?

> When workflows need structure, parsing, retries, tests, maintainability, or reusable interfaces.

### Why are timeouts mandatory?

> A tool that can hang forever is dangerous during incidents and automation runs.

### Why avoid `shell=True`?

> It increases injection and quoting risks and makes argument handling less safe.

### What makes an ops tool production-grade?

> Clear logging, explicit failures, timeouts, retries, tests, and safe defaults.

---

## Labs

### Beginner

1. Read file and count errors.
2. Parse JSON.
3. Write simple CLI.

### Intermediate

1. Call HTTP endpoint with timeout.
2. Run kubectl and parse JSON.
3. Summarize pod states.

### Advanced

1. Add retry/backoff.
2. Parallel health checks.
3. Add tests.
4. Package as installable CLI.

---

## Memory Review

- Why is Python better than Bash for JSON-heavy work?
- Why should every network call have a timeout?
- Why is shell=True risky?
- What makes retries dangerous?
- What makes an SRE tool maintainable?

---

## Senior Summary

> I use Python when operational automation needs structure: APIs, structured parsing, retries, timeouts, tests, and maintainability. I design tools with clear logging, explicit failures, safe subprocess usage, and predictable exit codes so they integrate cleanly with CI/CD and incident workflows.

---

## [SRE] Python Lab 1: HTTP Probe Utility

## Python Lab 1: HTTP Probe Utility

### Operational Context

Synthetic probes — scripts that actively make HTTP requests and report back — are one of the
oldest and most reliable monitoring primitives. Blackbox exporters, uptime monitors, and
canary testers all implement the same core loop: make a request, record status code and
latency, report health.

This lab builds that core loop as a standalone CLI tool. You'll reach for something like this
when you want to quickly verify that a new deployment is serving traffic, check whether a
service is responding from inside a Kubernetes pod (without installing curl), or collect a
quick baseline of response times before load testing.

The patterns here — explicit timeouts, structured output, meaningful exit codes, and
connection vs HTTP error separation — appear in every production probe implementation.

### Prerequisites

- Python 3.8+
- `requests` library (`pip install requests`) or use `urllib.request` from the standard
  library (covered in extensions)
- Basic understanding of HTTP status codes and what `ConnectionError` vs `Timeout` means

### Time Estimate

30–45 minutes for the core probe. Extensions add 30–45 minutes.

---

### Step-by-Step Build Guide

#### Step 1 — Confirm the skeleton

Open `starter/http_probe.py`. It reads URLs from `sys.argv[1:]`, validates they're present,
and has a TODO. Run it:

```bash
python3 starter/http_probe.py
# → usage: http_probe.py URL [URL...]

python3 starter/http_probe.py https://httpbin.org/get
# → TODO: probe URLs and print status, latency, and size
```

#### Step 2 — Make a single request with timing

Replace the TODO with a real HTTP call. Import what you need at the top:

```python
import time
import requests
```

Inside `main`, iterate over URLs and probe each one:

```python
for url in urls:
    start = time.monotonic()
    response = requests.get(url, timeout=5)
    latency_ms = int((time.monotonic() - start) * 1000)
    print(f"{url}  status={response.status_code}  latency={latency_ms}ms  size={len(response.content)}B")
```

`time.monotonic()` is used instead of `time.time()` because it is not affected by system
clock adjustments. Always use it for measuring durations.

Test with a real URL:

```bash
python3 http_probe.py https://httpbin.org/get
# → https://httpbin.org/get  status=200  latency=312ms  size=347B
```

#### Step 3 — Handle failures without crashing

Right now, if the URL is unreachable or times out, the script raises an unhandled exception
and prints a Python traceback. That's not acceptable in an operational tool — the output
should always be structured and the script should continue checking remaining URLs.

Wrap the request in a try/except:

```python
try:
    start = time.monotonic()
    response = requests.get(url, timeout=5)
    latency_ms = int((time.monotonic() - start) * 1000)
    # ... print success ...
except requests.exceptions.Timeout:
    print(f"{url}  status=TIMEOUT  latency={timeout_s * 1000}ms  size=0B")
except requests.exceptions.ConnectionError as exc:
    print(f"{url}  status=CONNECTION_ERROR  detail={exc}  size=0B")
except requests.exceptions.RequestException as exc:
    print(f"{url}  status=ERROR  detail={exc}  size=0B")
```

Test with a bad URL:

```bash
python3 http_probe.py https://localhost:19999/does-not-exist
# → https://localhost:19999/does-not-exist  status=CONNECTION_ERROR  ...
```

The key insight: catch specific exceptions from most-specific to least-specific. `Timeout`
is a subclass of `RequestException`, so if you only catch `RequestException`, you lose the
ability to distinguish timeouts from connection errors.

#### Step 4 — Add meaningful exit codes

An HTTP probe is useless if it always exits 0. The caller (cron, deployment script, CI)
needs to know whether all probes passed. Track failures:

```python
def main() -> int:
    urls = sys.argv[1:]
    if not urls:
        print(f"usage: {sys.argv[0]} URL [URL...]", file=sys.stderr)
        return 1

    failures = 0
    for url in urls:
        ok = probe(url)   # returns True on success, False on failure
        if not ok:
            failures += 1

    return 0 if failures == 0 else 1
```

Extract your probe logic into a `probe(url: str) -> bool` function that returns `True` on
success (2xx status code) and `False` on any error.

What counts as failure? Decide and document it: connection errors and timeouts are clearly
failures. 5xx responses are failures. 4xx responses: depends on whether the URL is expected
to exist — for a health check endpoint, 404 is a failure.

#### Step 5 — Add configurable timeout as a flag

Hardcoding `timeout=5` is fine for a prototype but becomes a problem when you're probing
services with known slow startup. Add `--timeout` as a command-line argument:

```python
import argparse

parser = argparse.ArgumentParser(description="HTTP health probe")
parser.add_argument("urls", nargs="+", help="URLs to probe")
parser.add_argument("--timeout", type=float, default=5.0,
                    help="Request timeout in seconds (default: 5)")
args = parser.parse_args()
```

Pass `args.timeout` into your probe function.

#### Step 6 — Format output for both humans and machines

Structure your output so each line is independently useful:

```
[PASS] https://api.internal/healthz  status=200  latency=14ms   size=23B
[FAIL] https://db.internal:5432/     status=CONNECTION_ERROR     size=0B
[PASS] https://cache.internal/ping   status=200  latency=3ms    size=4B
```

The `[PASS]` / `[FAIL]` prefix makes the result scannable. The key=value fields after it
are greppable: `grep FAIL output.txt` immediately shows you the failures.

---

### Sample Output

```bash
python3 http_probe.py \
    https://httpbin.org/status/200 \
    https://httpbin.org/status/500 \
    https://localhost:19999/unreachable \
    --timeout 4
```

```
[PASS] https://httpbin.org/status/200      status=200  latency=318ms  size=0B
[FAIL] https://httpbin.org/status/500      status=500  latency=301ms  size=0B
[FAIL] https://localhost:19999/unreachable status=CONNECTION_ERROR     size=0B

Summary: 1/3 passed, 2 failed
```

Exit code:
```bash
echo $?
# → 1
```

---

### Common Mistakes and How to Debug Them

**`requests` is not installed**

```
ModuleNotFoundError: No module named 'requests'
```

Fix: `pip install requests` or `pip3 install requests`. If you can't install it, use
`urllib.request` from the standard library — the Extension section covers this.

**Using `time.time()` instead of `time.monotonic()`**

`time.time()` can go backward or jump forward if the system clock is adjusted (NTP sync,
leap second). `time.monotonic()` always moves forward and is specifically designed for
measuring elapsed time. Always use `time.monotonic()` for duration measurements.

**Swallowing the exception and losing the error message**

```python
except Exception:
    print("error")  # bad: no detail
```

Always include the exception in the output: `except Exception as exc: print(f"error: {exc}")`.
When probing a failing service during an incident, the error message tells you *why* it's
failing, not just *that* it failed.

**Catching `KeyboardInterrupt` in a broad except**

`except Exception` does not catch `KeyboardInterrupt` (which inherits from `BaseException`),
so Ctrl-C still works. If you write `except BaseException`, you'll trap Ctrl-C and the user
won't be able to interrupt the script. Use `except Exception` for operational errors.

**Timeout is per-request but the user expects total time**

If you probe 20 URLs with a 5-second timeout each, the worst case is 100 seconds. For large
URL lists, add a note in the output about total elapsed time, or implement parallel probing
(see extensions).

---

### Extension Challenges

1. **Parallel probes with `concurrent.futures`**: Use `ThreadPoolExecutor` to probe all URLs
   concurrently. Print results as they complete. This reduces total probe time from
   `N × timeout` to approximately `1 × timeout` for a list of N URLs.

2. **Retry on failure**: Integrate the retry pattern from Bash Lab 3. Add `--retries N` and
   retry each probe up to N times with exponential backoff before marking it failed.

3. **Rewrite using `urllib.request`**: Reimplement the probe without `requests`, using only
   the Python standard library. This is important for environments where you can't install
   packages (distroless containers, restricted build systems).

4. **JSON output mode**: Add `--output json` which prints a JSON array of probe results
   instead of the human-readable format. Test with `python3 http_probe.py ... | jq .`

5. **Prometheus text format output**: Add `--output prometheus` which emits metrics in
   Prometheus text format (`probe_success{url="..."} 1`, `probe_duration_seconds{...} 0.312`).
   This is how blackbox exporters work internally.

---

## [SRE] Python Lab 2: JSON Log Analyzer

## Python Lab 2: JSON Log Analyzer

### Operational Context

Structured logging — where each log line is a JSON object — is now the standard in
microservices. The reason: structured logs are machine-parseable. You can filter by any
field, aggregate by `error_type`, join on `trace_id`, and group by `service` without writing
bespoke text parsers for each log format.

During an incident, the first thing you want to know is: *which service is generating the
most errors, and what kind?* This lab builds that query as a Python script that reads
newline-delimited JSON (NDJSON), handles malformed lines gracefully, and produces a summary
you can paste into an incident channel in under 30 seconds.

Malformed line handling is not optional. Real log pipelines have encoding errors, truncated
writes, multi-line log entries that got concatenated, and lines from a different log format
that snuck into the file. A script that crashes on the first malformed line is worse than
useless during an incident — it becomes one more thing you have to debug.

### Prerequisites

- Python 3.8+
- `json` module (standard library — no install needed)
- `collections.Counter` (standard library)
- Sample data: `../shared/data/sample-json-logs.ndjson`

### Time Estimate

30–40 minutes for the core analyzer. Extensions add 30 minutes.

---

### Step-by-Step Build Guide

#### Step 1 — Understand the data format

NDJSON (newline-delimited JSON) means one complete JSON object per line. Each line is
independently parseable — unlike a JSON array where you need the full file to parse anything.

Open `../shared/data/sample-json-logs.ndjson` and look at a few lines:

```json
{"service":"payments","level":"ERROR","error_type":"timeout","message":"downstream request timed out","trace_id":"abc-123","ts":"2026-04-09T10:00:01Z"}
{"service":"gateway","level":"ERROR","error_type":"upstream_502","message":"bad gateway","trace_id":"def-456","ts":"2026-04-09T10:00:02Z"}
not-json
{"service":"worker"  <- truncated malformed line
```

The file intentionally contains 2–3 malformed lines. Your parser must handle them.

#### Step 2 — Read the file and print raw lines first

Before parsing anything, confirm you can read the file:

```python
def load_logs(path: str):
    with open(path) as f:
        for line_num, raw in enumerate(f, start=1):
            raw = raw.strip()
            if not raw:
                continue  # skip blank lines
            print(f"line {line_num}: {raw[:80]}")
```

Run this. Count the lines. Note which ones look malformed.

#### Step 3 — Add JSON parsing with per-line error handling

Replace the `print` with a `json.loads` call, wrapped in a try/except:

```python
def load_logs(path: str) -> list[dict]:
    records = []
    errors = 0
    with open(path) as f:
        for line_num, raw in enumerate(f, start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                records.append(json.loads(raw))
            except json.JSONDecodeError as exc:
                # Print to stderr so stdout output stays clean
                print(f"[WARN] line {line_num}: malformed JSON ({exc.msg}): {raw[:60]}", file=sys.stderr)
                errors += 1
    print(f"[INFO] loaded {len(records)} records, {errors} malformed lines", file=sys.stderr)
    return records
```

Key decisions:
- Malformed lines go to stderr as warnings, not stdout
- We count them separately so the summary can report them
- We continue processing rather than raising an exception

#### Step 4 — Count errors by error_type

Use `collections.Counter` — it's designed exactly for this:

```python
from collections import Counter

def error_type_summary(records: list[dict]) -> None:
    # Use .get() with a default — not every record may have error_type
    counts = Counter(r.get("error_type", "(none)") for r in records if r.get("level") == "ERROR")
    print("\n=== Top Error Types ===")
    for error_type, count in counts.most_common(10):
        print(f"  {error_type:<30} {count}")
```

`most_common(10)` returns the 10 most frequent entries, sorted descending — exactly what
you want for an incident summary.

#### Step 5 — Count errors by service

```python
def service_summary(records: list[dict]) -> None:
    counts = Counter(r.get("service", "(unknown)") for r in records if r.get("level") == "ERROR")
    print("\n=== Errors by Service ===")
    for service, count in counts.most_common():
        print(f"  {service:<20} {count} errors")
```

#### Step 6 — Wire everything together

```python
def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else ""
    if not path:
        print(f"usage: {sys.argv[0]} LOG_FILE", file=sys.stderr)
        return 1
    if not os.path.isfile(path):
        print(f"error: file not found: {path}", file=sys.stderr)
        return 1

    records = load_logs(path)
    error_type_summary(records)
    service_summary(records)
    return 0
```

Note: `import os` is needed for `os.path.isfile`.

#### Step 7 — Handle missing fields defensively

Not every log record will have every field. A payments log might have `error_type`.
A worker log might only have `message` and `level`. Use `.get()` everywhere:

```python
# Bad — raises KeyError if field is missing
record["error_type"]

# Good — returns None (or your default) if field is absent
record.get("error_type")
record.get("error_type", "unknown")
```

This is the single most important habit for incident tooling: never assume a log record
has all the fields you expect.

---

### Sample Output

```bash
python3 json_log_analyzer.py ../shared/data/sample-json-logs.ndjson
```

Stderr (info/warnings):
```
[WARN] line 18: malformed JSON (Expecting value): not-json
[WARN] line 31: malformed JSON (Expecting ',' delimiter): {"service":"worker"  
[INFO] loaded 40 records, 2 malformed lines
```

Stdout (the summary):
```
=== Top Error Types ===
  timeout                        11
  db_conn                         8
  upstream_502                    7
  dns_failure                     4
  oom_kill                        3
  auth_expired                    2

=== Errors by Service ===
  payments             14 errors
  gateway              10 errors
  worker                6 errors
  inventory             5 errors
  auth                  3 errors
```

---

### Common Mistakes and How to Debug Them

**The script crashes on the first malformed line**

If you use `json.loads(line)` without try/except, any malformed line raises
`json.JSONDecodeError` and kills the script. The fix is in Step 3. Test by running against a
file with `not-json` in it.

**`Counter` key is `None` instead of a string**

If you write `Counter(r["error_type"] for r in records)` and some records have no
`error_type` field, you'll get a `KeyError`. If you write `r.get("error_type")`, you'll get
`None` as a key in your counter. Use `r.get("error_type", "(none)")` to give it a printable
default.

**Counting all records instead of just ERROR level**

The `records` list contains all levels (INFO, WARN, ERROR, DEBUG). If you count without
filtering on `level == "ERROR"`, your `error_type` counts will be inflated by non-error
records that happen to have an `error_type` field. Always filter: `if r.get("level") == "ERROR"`.

**File opened in binary mode**

`open(path, "rb")` reads bytes. `json.loads` in Python 3 can handle bytes, but your `.strip()`
returns a bytes object and string comparisons fail silently. Use `open(path)` (text mode,
default) unless you have a specific reason for binary.

**Encoding errors when the log contains non-UTF-8 bytes**

Some log aggregators inject byte sequences that aren't valid UTF-8. Fix:
`open(path, encoding="utf-8", errors="replace")`. The `errors="replace"` parameter
substitutes the Unicode replacement character for undecodable bytes rather than raising
`UnicodeDecodeError`.

---

### Why Defensive Parsing Matters in Incident Tooling

When you're running this script at 2am during an incident, the log file was written by a
system that was *also failing*. It may have:

- Truncated lines (the write happened mid-line when the process was killed)
- Lines from a different service that got routed to the same log destination
- Binary data from a corrupted log rotation
- Null bytes from a memory corruption bug

An analyzer that crashes on any of these doesn't help you. It adds to your cognitive load.
Defensive parsing means your tool degrades gracefully: it processes what it can, reports what
it skipped, and gives you a useful summary even from a partially corrupted file.

---

### Extension Challenges

1. **Filter by time window**: Parse the `ts` field as a datetime and accept `--from` /
   `--to` arguments to analyze only a time range. Use `datetime.fromisoformat()`.

2. **Trace ID grouping**: For records with a `trace_id` field, group all error records by
   trace ID and show which traces had the most errors. This helps identify cascading failures
   across services.

3. **Error rate over time**: Group ERROR records by minute (parse `ts`, truncate to minute)
   and print a count-per-minute table. This reveals whether errors are constant or spiking.

4. **CSV output**: Add `--output csv` which writes the summary as a CSV file that can be
   opened in a spreadsheet. Use Python's `csv` module from the standard library.

5. **Multi-file support**: Accept multiple file paths and aggregate the results across all
   files. This is how you analyze a distributed system where each replica writes to its own
   log file.

---

## [SRE] Python Lab 3: Kubernetes Warning Event Summary

## Python Lab 3: Kubernetes Warning Event Summary

### Operational Context

`kubectl get events` is one of the first commands you run when a workload is misbehaving.
The problem: in a cluster with dozens of namespaces and hundreds of pods, the raw event
stream is overwhelming — thousands of lines of Normal events mixed with the handful of
Warning events that actually matter.

This lab builds a filter and aggregator that turns the noisy raw event list into an
actionable incident summary in under 5 seconds. It reads the JSON output from kubectl,
filters to Warning events only, groups them by namespace and reason, and prints the top
offenders. This is the kind of script an SRE writes once and runs every time they open an
incident bridge.

The patterns here — reading stdin as structured data, defensive field access, grouping with
Counter — are identical to what production incident response tooling does.

### Prerequisites

- Python 3.8+
- `json`, `sys`, `collections` — all standard library
- Either a real Kubernetes cluster or the sample data provided (see Step 1)
- Understanding of what a Kubernetes Event is (what `reason`, `type`, and `involvedObject` mean)

### Time Estimate

30–45 minutes for the core script. Extensions add 30–40 minutes.

---

### Background: Kubernetes Event Structure

When kubectl outputs events as JSON (`kubectl get events -A -o json`), the response is a
Kubernetes List object:

```json
{
  "apiVersion": "v1",
  "kind": "EventList",
  "items": [
    {
      "type": "Warning",
      "reason": "BackOff",
      "message": "Back-off restarting failed container",
      "count": 14,
      "metadata": { "namespace": "production" },
      "involvedObject": {
        "kind": "Pod",
        "name": "payments-6b9d4f-xk2p8",
        "namespace": "production"
      },
      "firstTimestamp": "2026-04-09T10:00:00Z",
      "lastTimestamp": "2026-04-09T10:14:22Z"
    }
  ]
}
```

Key fields:
- `type`: Either `"Normal"` or `"Warning"` — you only want `"Warning"`
- `reason`: Why the event happened (`BackOff`, `OOMKilling`, `FailedScheduling`, etc.)
- `count`: How many times this event was reported
- `message`: Human-readable description
- `metadata.namespace`: Which namespace the event is in
- `involvedObject.kind` / `.name`: What resource the event is about

---

### Step-by-Step Build Guide

#### Step 1 — Create sample test data (if you don't have a cluster)

If you don't have a live cluster, create a test fixture file. Save this as
`/tmp/test-events.json` and pipe it in during testing:

```bash
kubectl get events -A -o json > /tmp/k8s-events.json 2>/dev/null || \
  echo "No cluster — using sample fixture"
```

For this lab, the sample fixture is assumed to represent a cluster with CrashLoopBackOff,
OOMKilling, and FailedScheduling events spread across multiple namespaces. You will generate
this as part of the extension challenge, or your instructor will provide it.

#### Step 2 — Confirm the skeleton reads stdin

Open `starter/k8s_event_summary.py`. It reads all of stdin, checks it's not empty, and
parses it as JSON. Run it:

```bash
echo '{"kind":"EventList","items":[]}' | python3 starter/k8s_event_summary.py
# → TODO: summarize warning events from 0 items
```

The skeleton already handles empty stdin. Your job is to replace the TODO with real logic.

#### Step 3 — Filter to Warning events only

Add a function that extracts only the events you care about:

```python
def get_warnings(items: list) -> list:
    warnings = []
    for item in items:
        if item.get("type") == "Warning":
            warnings.append(item)
    return warnings
```

Or as a list comprehension:

```python
warnings = [item for item in items if item.get("type") == "Warning"]
```

After filtering, print the count to stderr to confirm it's working:

```python
print(f"[INFO] {len(warnings)} Warning events out of {len(items)} total", file=sys.stderr)
```

#### Step 4 — Count by reason

```python
from collections import Counter

def reason_summary(warnings: list) -> None:
    counts = Counter(w.get("reason", "Unknown") for w in warnings)
    print("\n=== Warning Events by Reason ===")
    for reason, count in counts.most_common(10):
        print(f"  {reason:<30} {count}")
```

#### Step 5 — Count by namespace

```python
def namespace_summary(warnings: list) -> None:
    # namespace can be in metadata.namespace or involvedObject.namespace
    def get_ns(event):
        return (event.get("metadata", {}).get("namespace")
                or event.get("involvedObject", {}).get("namespace")
                or "(cluster-scoped)")

    counts = Counter(get_ns(w) for w in warnings)
    print("\n=== Warning Events by Namespace ===")
    for ns, count in counts.most_common():
        print(f"  {ns:<30} {count}")
```

The `or` chain is important: `metadata.namespace` is preferred, but if it's missing or empty,
fall back to `involvedObject.namespace`. If both are absent, the event is cluster-scoped.

#### Step 6 — Show the most impactful events

A Warning event with `count=1` is less urgent than one with `count=47`. Add a summary of the
highest-count individual events:

```python
def top_events(warnings: list, n: int = 10) -> None:
    # Sort by count descending, use 0 as default if count is missing
    sorted_events = sorted(warnings, key=lambda w: w.get("count", 0), reverse=True)
    print(f"\n=== Top {n} Events by Occurrence Count ===")
    header = f"  {'NAMESPACE':<20} {'REASON':<20} {'OBJECT':<30} {'COUNT':>5}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for event in sorted_events[:n]:
        ns = event.get("metadata", {}).get("namespace", "")
        reason = event.get("reason", "")
        obj = event.get("involvedObject", {})
        obj_name = f"{obj.get('kind','')}/{obj.get('name','')}"
        count = event.get("count", 0)
        print(f"  {ns:<20} {reason:<20} {obj_name:<30} {count:>5}")
```

#### Step 7 — Wire everything together

```python
def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("usage: kubectl get events -A -o json | python3 k8s_event_summary.py",
              file=sys.stderr)
        return 1

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON from stdin: {exc}", file=sys.stderr)
        return 2

    items = data.get("items", [])
    warnings = get_warnings(items)

    print(f"Total events: {len(items)}  Warning events: {len(warnings)}")
    reason_summary(warnings)
    namespace_summary(warnings)
    top_events(warnings)

    return 0
```

---

### Sample Output

```bash
kubectl get events -A -o json | python3 k8s_event_summary.py
```

Stderr:
```
[INFO] 47 Warning events out of 312 total
```

Stdout:
```
Total events: 312  Warning events: 47

=== Warning Events by Reason ===
  BackOff                        18
  OOMKilling                      9
  FailedScheduling                8
  Unhealthy                       7
  EvictionThresholdMet            3
  NodeNotReady                    2

=== Warning Events by Namespace ===
  production                     29
  staging                        12
  kube-system                     4
  monitoring                      2

=== Top 10 Events by Occurrence Count ===
  NAMESPACE            REASON               OBJECT                         COUNT
  -----------------------------------------------------------------------
  production           BackOff              Pod/payments-6b9d4f-xk2p8        47
  production           OOMKilling           Pod/worker-7c8d9f-m3n4p          31
  staging              BackOff              Pod/api-5f6g7h-k9l0m              18
  production           FailedScheduling     Pod/ml-inference-8h9i0j-x1y2z    15
  kube-system          Unhealthy            Pod/coredns-6d4e5f-a1b2c           9
```

---

### Common Mistakes and How to Debug Them

**`data["items"]` raises KeyError on an empty cluster**

An empty cluster returns `{"kind":"EventList","items":[]}` — `items` is present but empty.
However, some Kubernetes versions or error responses omit `items` entirely. Always use
`.get("items", [])`, never `data["items"]`.

**`w["reason"]` raises KeyError for some events**

Events are not guaranteed to have all fields populated. Synthetic or custom events may omit
`reason`. Always use `.get("reason", "Unknown")`.

**Namespace is None even though it looks present**

Some cluster-scoped resources (ClusterRoles, Nodes) have events where `metadata.namespace`
is an empty string `""`, not absent. The `or` chain in Step 5 handles this: `""` is falsy
in Python, so it falls through to the next option.

**All events show as Normal, no Warnings**

Check whether your test data actually has Warning events. On a healthy cluster, you may have
zero. Test with: `python3 -c "import json,sys; d=json.load(sys.stdin); print(set(i.get('type') for i in d.get('items',[])))" < your-events.json`

**stdin is consumed before the script reads it**

If you pipe kubectl output through another command first (like `tee`), stdin is already consumed.
The script only reads stdin once. If you need to debug the raw data, save it to a file first:
`kubectl get events -A -o json > /tmp/events.json && cat /tmp/events.json | python3 k8s_event_summary.py`

---

### How This Helps in a Real Cluster Incident

Without this script:
- `kubectl get events -A` returns hundreds of lines
- Normal events (PulledImage, SuccessfulCreate) drown out the Warnings
- You have to grep manually and lose count context

With this script:
- You see immediately that `production` has 29 Warning events and `BackOff` is the top reason
- You see which specific pod is crashing most (highest count)
- You can paste the output directly into the incident channel
- The whole analysis takes 5 seconds, not 5 minutes

This is the value of scripted analysis: turning raw data into actionable signal instantly,
even under pressure.

---

### Extension Challenges

1. **Create a test fixture**: Write a small script that generates a realistic `EventList` JSON
   file with 50+ events, varied namespaces, and a mix of Warning and Normal types. Use this
   as your test data so you don't need a live cluster.

2. **Filter by time window**: Parse `lastTimestamp` and accept `--since 30m` to show only
   events from the last 30 minutes. Use `datetime.fromisoformat()` and
   `datetime.now(timezone.utc)`.

3. **Filter by namespace**: Accept `-n NAMESPACE` to show only events from one namespace.
   This matches the `kubectl -n` flag behaviour.

4. **Detect CrashLoopBackOff specifically**: Add a dedicated section that lists all pods in
   CrashLoopBackOff (reason=`BackOff` with message containing "restarting failed container"),
   sorted by restart count. This is the most common first-responder query.

5. **Watch mode**: Add `--watch` which re-runs the analysis every 30 seconds, clearing the
   terminal between runs (`print("\033[2J\033[H", end="")`). This gives a live view of the
   warning event landscape during an incident.
