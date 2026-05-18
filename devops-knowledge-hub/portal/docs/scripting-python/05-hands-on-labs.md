---
title: Hands-On Labs
sidebar_position: 5
---

# Python Hands-On Labs

Seven labs progressing from SRE fundamentals to capstone applications. Each lab includes operational context, starter code, implementation steps, and extension challenges.

---

## SRE Lab 1: HTTP Probe Utility

### Operational Context

Synthetic probes — scripts that actively make HTTP requests and report status — are one of the oldest monitoring primitives. Blackbox exporters, uptime monitors, and canary testers all implement the same core loop: make a request, record status code and latency, report health.

Build this tool when you need to verify a deployment is serving traffic, check service reachability from inside a Kubernetes pod without curl, or collect response time baselines before load testing.

The patterns here — explicit timeouts, structured output, meaningful exit codes, connection vs HTTP error separation — appear in every production probe implementation.

**Time estimate:** 30–45 minutes core. Extensions add 30–45 minutes.

### Starter Code

```python
#!/usr/bin/env python3
"""http_probe.py — HTTP health probe utility."""

import sys
import time
import argparse
import requests


def probe(url: str, timeout: float) -> bool:
    """Probe a single URL. Returns True on success (2xx), False on any failure."""
    try:
        start = time.monotonic()
        response = requests.get(url, timeout=timeout)
        latency_ms = int((time.monotonic() - start) * 1000)

        ok = 200 <= response.status_code < 300
        label = "[PASS]" if ok else "[FAIL]"
        print(f"{label} {url}  status={response.status_code}  "
              f"latency={latency_ms}ms  size={len(response.content)}B")
        return ok

    except requests.exceptions.Timeout:
        print(f"[FAIL] {url}  status=TIMEOUT  latency={int(timeout * 1000)}ms  size=0B")
        return False
    except requests.exceptions.ConnectionError as exc:
        print(f"[FAIL] {url}  status=CONNECTION_ERROR  detail={exc}  size=0B")
        return False
    except requests.exceptions.RequestException as exc:
        print(f"[FAIL] {url}  status=ERROR  detail={exc}  size=0B")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="HTTP health probe")
    parser.add_argument("urls", nargs="+", help="URLs to probe")
    parser.add_argument("--timeout", type=float, default=5.0,
                        help="Request timeout in seconds (default: 5)")
    args = parser.parse_args()

    failures = 0
    for url in args.urls:
        ok = probe(url, args.timeout)
        if not ok:
            failures += 1

    total = len(args.urls)
    passed = total - failures
    print(f"\nSummary: {passed}/{total} passed, {failures} failed")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
```

### Step-by-Step Build Guide

**Step 1 — Confirm the skeleton works**

```bash
python3 http_probe.py https://httpbin.org/get
# -> [PASS] https://httpbin.org/get  status=200  latency=312ms  size=347B
```

**Step 2 — Understand the timing choice**

Use `time.monotonic()` not `time.time()`. `time.time()` can go backward or jump forward during NTP sync or leap seconds. `time.monotonic()` always moves forward and is specifically designed for measuring elapsed durations.

**Step 3 — Understand the exception hierarchy**

Catch from most-specific to least-specific. `Timeout` is a subclass of `RequestException`, so catching only `RequestException` loses the ability to distinguish timeouts from connection errors. Both are important to report differently — a timeout means the service is reachable but slow; a `ConnectionError` means it is not reachable at all.

**Step 4 — Test failure modes**

```bash
python3 http_probe.py \
    https://httpbin.org/status/200 \
    https://httpbin.org/status/500 \
    https://localhost:19999/unreachable \
    --timeout 4

# Expected output:
# [PASS] https://httpbin.org/status/200      status=200  latency=318ms  size=0B
# [FAIL] https://httpbin.org/status/500      status=500  latency=301ms  size=0B
# [FAIL] https://localhost:19999/unreachable status=CONNECTION_ERROR     size=0B
#
# Summary: 1/3 passed, 2 failed
echo $?
# -> 1
```

**Step 5 — Verify exit codes work for CI**

Exit code 0 means all probes passed. Exit code 1 means at least one failed. This is what CI scripts, cron jobs, and deployment checks rely on. A probe tool that always exits 0 is worse than useless.

### Common Mistakes

- **Using `time.time()` instead of `time.monotonic()`** — time.time() can drift with NTP adjustments.
- **Swallowing the exception message** — `except Exception: print("error")` loses the detail you need during an incident. Always `print(f"error: {exc}")`.
- **Catching `BaseException`** — this traps `KeyboardInterrupt`. Use `except Exception` so Ctrl-C still works.
- **No timeout set** — `requests.get(url)` with no timeout can hang forever on a slow server.

### Extension Challenges

1. **Parallel probes with ThreadPoolExecutor** — use `concurrent.futures.ThreadPoolExecutor` to probe all URLs concurrently. Reduces total probe time from `N × timeout` to approximately `max_latency`.
2. **Retry on failure** — add `--retries N` and retry each failing probe with exponential backoff before marking it failed.
3. **JSON output mode** — add `--output json` which prints a JSON array of probe results. Test with `python3 http_probe.py ... | jq .`
4. **Prometheus text format** — add `--output prometheus` which emits `probe_success{url="..."} 1` and `probe_duration_seconds{url="..."} 0.312`. This is how blackbox exporters work internally.
5. **Stdlib rewrite** — reimplement without `requests`, using only `urllib.request`. Important for distroless containers where you cannot install packages.

---

## SRE Lab 2: JSON Log Analyzer

### Operational Context

Structured logging — where each log line is a JSON object — is the standard in microservices. During an incident, the first question is: *which service is generating the most errors, and what kind?*

This lab builds that query as a Python script that reads NDJSON (newline-delimited JSON), handles malformed lines gracefully, and produces a summary you can paste into an incident channel in under 30 seconds.

Malformed line handling is not optional. Real log pipelines have encoding errors, truncated writes, lines from a different log format that snuck in, and null bytes from corruption. A script that crashes on the first malformed line adds to your cognitive load during an incident. A script that degrades gracefully — processing what it can, reporting what it skipped — is the one you trust.

**Time estimate:** 30–40 minutes core. Extensions add 30 minutes.

### Starter Code

```python
#!/usr/bin/env python3
"""json_log_analyzer.py — Analyze NDJSON log files for error patterns."""

import sys
import os
import json
from collections import Counter


def load_logs(path: str) -> list[dict]:
    """Read NDJSON file, skip malformed lines, return parsed records."""
    records = []
    errors = 0
    with open(path, encoding="utf-8", errors="replace") as f:
        for line_num, raw in enumerate(f, start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                records.append(json.loads(raw))
            except json.JSONDecodeError as exc:
                # Print to stderr so stdout output stays clean for parsing
                print(
                    f"[WARN] line {line_num}: malformed JSON ({exc.msg}): {raw[:60]}",
                    file=sys.stderr,
                )
                errors += 1
    print(
        f"[INFO] loaded {len(records)} records, {errors} malformed lines",
        file=sys.stderr,
    )
    return records


def error_type_summary(records: list[dict]) -> None:
    # .get() with default: not every record may have error_type
    counts = Counter(
        r.get("error_type", "(none)")
        for r in records
        if r.get("level") == "ERROR"
    )
    print("\n=== Top Error Types ===")
    for error_type, count in counts.most_common(10):
        print(f"  {error_type:<30} {count}")


def service_summary(records: list[dict]) -> None:
    counts = Counter(
        r.get("service", "(unknown)")
        for r in records
        if r.get("level") == "ERROR"
    )
    print("\n=== Errors by Service ===")
    for service, count in counts.most_common():
        print(f"  {service:<20} {count} errors")


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


if __name__ == "__main__":
    sys.exit(main())
```

### Step-by-Step Build Guide

**Step 1 — Understand NDJSON**

NDJSON means one complete JSON object per line. Each line is independently parseable. Unlike a JSON array, you do not need the whole file to start processing. This is why structured log pipelines use it.

```json
{"service":"payments","level":"ERROR","error_type":"timeout","trace_id":"abc-123","ts":"2026-04-09T10:00:01Z"}
{"service":"gateway","level":"ERROR","error_type":"upstream_502","trace_id":"def-456","ts":"2026-04-09T10:00:02Z"}
not-json
{"service":"worker"  <- truncated malformed line
```

**Step 2 — Create test data**

```python
import json, tempfile

sample_lines = [
    {"service": "payments", "level": "ERROR", "error_type": "timeout", "ts": "2026-04-09T10:00:01Z"},
    {"service": "payments", "level": "ERROR", "error_type": "timeout", "ts": "2026-04-09T10:00:02Z"},
    {"service": "gateway",  "level": "ERROR", "error_type": "upstream_502", "ts": "2026-04-09T10:00:03Z"},
    {"service": "auth",     "level": "INFO",  "message": "token issued"},
    {"service": "worker",   "level": "ERROR", "error_type": "db_conn"},
]

with open("/tmp/test-logs.ndjson", "w") as f:
    for record in sample_lines:
        f.write(json.dumps(record) + "\n")
    f.write("not-json-at-all\n")   # malformed line
```

**Step 3 — Run and verify output**

```bash
python3 json_log_analyzer.py /tmp/test-logs.ndjson
```

Stderr (info/warnings):
```
[WARN] line 6: malformed JSON (Expecting value): not-json-at-all
[INFO] loaded 5 records, 1 malformed lines
```

Stdout (the summary):
```
=== Top Error Types ===
  timeout                        2
  upstream_502                   1
  db_conn                        1

=== Errors by Service ===
  payments             2 errors
  gateway              1 errors
  worker               1 errors
```

**Step 4 — Key habits from this lab**

Always use `.get()` with defaults — `record["error_type"]` raises `KeyError` when the field is absent. Use `record.get("error_type", "(none)")`.

Always filter by level — `if r.get("level") == "ERROR"` prevents INFO/WARN records that happen to have an `error_type` field from inflating your error counts.

Print diagnostics to stderr, results to stdout — this allows `python3 json_log_analyzer.py file.ndjson | grep payments` to work without the INFO lines getting in the way.

### Common Mistakes

- **No try/except around json.loads** — one malformed line kills the whole script during an incident.
- **Counting all records instead of filtering by `level`** — inflates error counts with non-error records.
- **`open(path, "rb")`** — binary mode makes string comparisons fail silently. Use text mode.
- **`Counter(r["error_type"] ...)` without .get()** — raises KeyError when field is absent.

### Extension Challenges

1. **Filter by time window** — parse the `ts` field with `datetime.fromisoformat()` and accept `--from` / `--to` arguments to analyze only a time range.
2. **Trace ID grouping** — group all error records by `trace_id` to identify cascading failures across services.
3. **Error rate over time** — group ERROR records by minute and print a count-per-minute table showing whether errors are constant or spiking.
4. **CSV output** — add `--output csv` which writes the summary as a CSV using Python's `csv` standard library module.
5. **Multi-file support** — accept multiple file paths and aggregate results across all files.

---

## SRE Lab 3: Kubernetes Warning Event Summary

### Operational Context

`kubectl get events` is one of the first commands you run when a workload is misbehaving. The problem: in a cluster with dozens of namespaces and hundreds of pods, the raw event stream is overwhelming — thousands of Normal events mixed with the handful of Warning events that actually matter.

This lab builds a filter and aggregator that turns noisy raw events into an actionable incident summary in under 5 seconds. It reads the JSON output from kubectl, filters to Warning events only, groups by namespace and reason, and prints the top offenders. This is the kind of script an SRE writes once and runs on every incident bridge call.

**Time estimate:** 30–45 minutes core. Extensions add 30–40 minutes.

### Kubernetes Event Structure

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

Key fields: `type` (Warning/Normal), `reason` (BackOff, OOMKilling, FailedScheduling), `count` (how many times), `metadata.namespace`, `involvedObject.kind/name`.

### Starter Code

```python
#!/usr/bin/env python3
"""k8s_event_summary.py — Summarize Kubernetes Warning events from kubectl JSON.

Usage:
  kubectl get events -A -o json | python3 k8s_event_summary.py
  cat /tmp/k8s-events.json    | python3 k8s_event_summary.py
"""

import sys
import json
from collections import Counter


def get_warnings(items: list) -> list:
    return [item for item in items if item.get("type") == "Warning"]


def reason_summary(warnings: list) -> None:
    counts = Counter(w.get("reason", "Unknown") for w in warnings)
    print("\n=== Warning Events by Reason ===")
    for reason, count in counts.most_common(10):
        print(f"  {reason:<30} {count}")


def namespace_summary(warnings: list) -> None:
    def get_ns(event: dict) -> str:
        # metadata.namespace is preferred; fall back to involvedObject.namespace
        # empty string "" is falsy in Python, so the `or` chain handles it
        return (
            event.get("metadata", {}).get("namespace")
            or event.get("involvedObject", {}).get("namespace")
            or "(cluster-scoped)"
        )

    counts = Counter(get_ns(w) for w in warnings)
    print("\n=== Warning Events by Namespace ===")
    for ns, count in counts.most_common():
        print(f"  {ns:<30} {count}")


def top_events(warnings: list, n: int = 10) -> None:
    sorted_events = sorted(warnings, key=lambda w: w.get("count", 0), reverse=True)
    print(f"\n=== Top {n} Events by Occurrence Count ===")
    header = f"  {'NAMESPACE':<20} {'REASON':<20} {'OBJECT':<30} {'COUNT':>5}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for event in sorted_events[:n]:
        ns = event.get("metadata", {}).get("namespace", "")
        reason = event.get("reason", "")
        obj = event.get("involvedObject", {})
        obj_name = f"{obj.get('kind', '')}/{obj.get('name', '')}"
        count = event.get("count", 0)
        print(f"  {ns:<20} {reason:<20} {obj_name:<30} {count:>5}")


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print(
            "usage: kubectl get events -A -o json | python3 k8s_event_summary.py",
            file=sys.stderr,
        )
        return 1

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON from stdin: {exc}", file=sys.stderr)
        return 2

    # Always use .get("items", []) — some responses omit "items" entirely
    items = data.get("items", [])
    warnings = get_warnings(items)

    print(f"[INFO] {len(warnings)} Warning events out of {len(items)} total", file=sys.stderr)
    print(f"\nTotal events: {len(items)}  Warning events: {len(warnings)}")
    reason_summary(warnings)
    namespace_summary(warnings)
    top_events(warnings)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Step-by-Step Build Guide

**Step 1 — Create test fixture (if no live cluster)**

```python
#!/usr/bin/env python3
"""generate_test_events.py — generate a realistic EventList fixture."""
import json, random

reasons = ["BackOff", "OOMKilling", "FailedScheduling", "Unhealthy", "EvictionThresholdMet"]
namespaces = ["production", "staging", "kube-system", "monitoring"]
kinds = ["Pod", "Node", "Deployment"]

items = []
for i in range(60):
    event_type = "Warning" if random.random() > 0.25 else "Normal"
    ns = random.choice(namespaces)
    items.append({
        "type": event_type,
        "reason": random.choice(reasons),
        "message": "Synthetic test event",
        "count": random.randint(1, 50),
        "metadata": {"namespace": ns},
        "involvedObject": {
            "kind": random.choice(kinds),
            "name": f"pod-{i:04d}",
            "namespace": ns,
        },
        "lastTimestamp": f"2026-04-09T10:{i:02d}:00Z",
    })

data = {"apiVersion": "v1", "kind": "EventList", "items": items}
with open("/tmp/test-events.json", "w") as f:
    json.dump(data, f)
print(f"Generated {len(items)} events")
```

**Step 2 — Run against test data**

```bash
python3 generate_test_events.py
cat /tmp/test-events.json | python3 k8s_event_summary.py
```

Expected output:
```
Total events: 60  Warning events: 45

=== Warning Events by Reason ===
  BackOff                        12
  OOMKilling                      9
  FailedScheduling                8
  ...
```

**Step 3 — Run against a real cluster**

```bash
kubectl get events -A -o json | python3 k8s_event_summary.py
```

**Step 4 — Why this helps during incidents**

Without this script: `kubectl get events -A` returns hundreds of lines; Normal events (PulledImage, SuccessfulCreate) drown out Warnings; you have to grep manually and lose count context.

With this script: you see immediately that `production` has 29 Warning events and `BackOff` is the top reason; you see which specific pod is crashing most (highest count); you can paste the output directly into the incident channel. The whole analysis takes 5 seconds.

### Common Mistakes

- **`data["items"]`** — some Kubernetes versions or error responses omit `items`. Always use `.get("items", [])`.
- **`w["reason"]`** — events are not guaranteed to have all fields. Use `.get("reason", "Unknown")`.
- **Namespace is None even though it looks present** — some cluster-scoped resources have `metadata.namespace` as empty string `""`, not absent. The `or` chain handles this because `""` is falsy.

### Extension Challenges

1. **Generate a comprehensive fixture** — write a generator that creates 50+ events with varied namespaces, reasons, and pod names for repeatable testing.
2. **Filter by time window** — parse `lastTimestamp` and accept `--since 30m` to show only recent events.
3. **Filter by namespace** — accept `-n NAMESPACE` to match `kubectl -n` behavior.
4. **Detect CrashLoopBackOff** — add a dedicated section listing all pods in CrashLoopBackOff (reason=BackOff, message containing "restarting failed container"), sorted by restart count.
5. **Watch mode** — add `--watch` which re-runs every 30 seconds, clearing the terminal between runs with `print("\033[2J\033[H", end="")`.

---

## Capstone Lab A: Deployment Control Center

### Overview

The Deployment Control Center is a realistic internal platform tool that integrates all seven advanced Python chapters. It is not a toy — this is the kind of system a platform engineering team would actually build and operate.

### Architecture

```
HTTP POST /deployments (FastAPI — Chapter 5)
  -> Pydantic validates request and settings (Chapter 4)
     -> run_deployment() orchestrates (Chapter 1: dataclass, Protocol, decorator, context manager)
        -> SimulatedDeployClient fans out (Chapter 2: asyncio, Semaphore, retry decorator)
           -> httpx would hit real K8s / ECS API (Chapter 3)
              -> SQLAlchemy saves DeploymentRow (Chapter 6)
                 -> pytest verifies each layer (Chapter 7)
```

### Key Components

**1. Contract layer (Pydantic)**

```python
from pydantic import BaseModel, Field, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr
from enum import Enum

class Environment(str, Enum):
    DEV = "dev"; STAGING = "staging"; PROD = "prod"

class DeploymentRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')  # reject unknown fields strictly
    service_name: str = Field(..., pattern=r'^[a-z][a-z0-9-]{1,49}$')
    image_tag: str = Field(..., min_length=1)
    environment: Environment
    replicas: int = Field(default=1, ge=1, le=20)
    requested_by: str = Field(..., min_length=1)

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='CONTROL_', extra='ignore')
    api_name: str = 'deployment-control-center'
    max_concurrency: int = 3
    default_timeout_seconds: int = 5
    auth_token: SecretStr = SecretStr('demo-token')
```

**2. Domain objects (Chapter 1 patterns)**

```python
from dataclasses import dataclass, field
from typing import Protocol
from functools import wraps
import asyncio

@dataclass
class DeploymentRecord:
    id: str
    service_name: str
    image_tag: str
    environment: Environment
    replicas: int
    requested_by: str
    status: str = 'pending'
    events: list[str] = field(default_factory=list)   # audit trail

class DeployBackend(Protocol):
    async def deploy(self, record: DeploymentRecord) -> dict: ...

def retry_async(max_attempts: int = 3, delay: float = 0.1):
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if attempt < max_attempts:
                        await asyncio.sleep(delay * attempt)
            raise last_exc
        return wrapper
    return decorator
```

**3. Async backend with bounded concurrency (Chapter 2)**

```python
import random

class SimulatedDeployClient:
    def __init__(self, max_concurrency: int = 3):
        self.semaphore = asyncio.Semaphore(max_concurrency)

    @retry_async(max_attempts=3, delay=0.05)
    async def deploy(self, record: DeploymentRecord) -> dict:
        async with self.semaphore:   # only max_concurrency deploys run at once
            await asyncio.sleep(random.uniform(0.1, 0.3))
            if random.random() < 0.15:
                raise ConnectionError(f'transient failure for {record.service_name}')
            return {
                'deployment_id': record.id,
                'service_name': record.service_name,
                'status': 'running',
                'environment': record.environment.value,
            }
```

**4. Orchestration layer (thin controller, fat service)**

```python
import uuid

async def run_deployment(req: DeploymentRequest, backend: DeployBackend) -> DeploymentRecord:
    record = DeploymentRecord(
        id=str(uuid.uuid4()),
        service_name=req.service_name,
        image_tag=req.image_tag,
        environment=req.environment,
        replicas=req.replicas,
        requested_by=req.requested_by,
    )
    record.events.append('request_validated')
    result = await backend.deploy(record)
    record.status = result['status']
    record.events.append('deployment_started')
    return record

async def rollout_many(service_names: list[str]) -> list[DeploymentRecord]:
    """Fan out to many services concurrently."""
    requests_list = [
        DeploymentRequest(service_name=name, image_tag='v9.9.9',
                          environment=Environment.STAGING, replicas=2,
                          requested_by='ops-bot')
        for name in service_names
    ]
    client = SimulatedDeployClient(max_concurrency=3)
    tasks = [run_deployment(req, client) for req in requests_list]
    return await asyncio.gather(*tasks)

# Run it
records = asyncio.run(rollout_many(['auth-api', 'user-svc', 'payment-api', 'analytics']))
for r in records:
    print(r.service_name, r.status, r.events)
```

**5. FastAPI route (Chapter 5)**

```python
from fastapi import FastAPI, Depends
from typing import Annotated

app = FastAPI(title='Deployment Control Center')

def get_settings() -> AppSettings:
    return AppSettings()

@app.post('/deployments')
async def create_deployment(
    req: DeploymentRequest,
    settings: Annotated[AppSettings, Depends(get_settings)],
):
    backend = SimulatedDeployClient(max_concurrency=settings.max_concurrency)
    record = await run_deployment(req, backend)
    return record   # FastAPI serializes dataclass to JSON automatically
```

### What to Build

1. Run the fan-out demo (`rollout_many`) and observe how the semaphore limits concurrency to 3 while all 4 services deploy concurrently within that limit.
2. Increase the failure rate in `SimulatedDeployClient` (`random.random() < 0.50`) and observe the retry decorator catching transient failures.
3. Wire in the FastAPI route and test with `httpx` or curl.
4. Add SQLAlchemy persistence: after `run_deployment` succeeds, write a `DeploymentRow` to SQLite. Query the rows to show deployment history.
5. Write pytest tests for `run_deployment` using a `SilentDeployClient` mock.

### Extension Challenges

**Add rollback support:** Add a `rollback` method to the Protocol and `SimulatedDeployClient`. Update `run_deployment` so that if `backend.deploy()` fails after all retries, it calls `backend.rollback()`, sets `record.status = "rolled_back"`, and appends `"rollback_triggered"` to `record.events`.

**Persist to SQLite:**

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime

class Base(DeclarativeBase):
    pass

class DeploymentRow(Base):
    __tablename__ = 'deployments'
    id:           Mapped[str]      = mapped_column(String(36), primary_key=True)
    service_name: Mapped[str]      = mapped_column(String(100))
    image_tag:    Mapped[str]      = mapped_column(String(100))
    environment:  Mapped[str]      = mapped_column(String(20))
    status:       Mapped[str]      = mapped_column(String(20))
    requested_by: Mapped[str]      = mapped_column(String(100))
    created_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

---

## Capstone Lab B: Incident Response Bot

### Overview

The Incident Response Bot monitors health of multiple services concurrently, creates structured incidents when services go down, tracks incident lifecycle (detected → acknowledged → resolved), and sends alert notifications via a pluggable notifier interface.

### Architecture

```
HealthChecker.check_all(services)         <- asyncio + Semaphore
  -> detect DOWN/DEGRADED status
     -> IncidentManager.process(results)
        -> AlertNotifier.notify(incident, event)  <- Protocol: Slack, PagerDuty, Console
           -> FastAPI /incidents exposes status    <- Chapter 5
              -> SQLAlchemy stores history         <- Chapter 6
                 -> SilentNotifier in tests        <- Chapter 7
```

### Core Types

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Protocol, runtime_checkable

class ServiceStatus(str, Enum):
    HEALTHY = 'healthy'; DEGRADED = 'degraded'; DOWN = 'down'; UNKNOWN = 'unknown'

class IncidentSeverity(str, Enum):
    LOW = 'low'; MEDIUM = 'medium'; HIGH = 'high'; CRITICAL = 'critical'

class IncidentState(str, Enum):
    DETECTED = 'detected'; ACKNOWLEDGED = 'acknowledged'; RESOLVED = 'resolved'

@dataclass(frozen=True)   # immutable, hashable, safe to share across async tasks
class ServiceConfig:
    name: str
    health_url: str
    team: str
    severity: IncidentSeverity = IncidentSeverity.HIGH
    failure_threshold: int = 2   # consecutive failures before alerting

@dataclass
class Incident:
    id: str
    service_name: str
    severity: IncidentSeverity
    state: IncidentState
    detected_at: datetime
    description: str
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    timeline: List[str] = field(default_factory=list)

    @property
    def duration_seconds(self) -> float:
        end = self.resolved_at or datetime.utcnow()
        return (end - self.detected_at).total_seconds()

    def acknowledge(self, by: str) -> None:
        self.state = IncidentState.ACKNOWLEDGED
        self.acknowledged_by = by
        self.acknowledged_at = datetime.utcnow()
        self.timeline.append(f'Acknowledged by {by}')

    def resolve(self) -> None:
        self.state = IncidentState.RESOLVED
        self.resolved_at = datetime.utcnow()
        self.timeline.append(f'Resolved at {self.resolved_at.strftime("%H:%M:%S")}')
```

### Alert Routing with Protocol

```python
@runtime_checkable
class AlertNotifier(Protocol):
    async def notify(self, incident: Incident, event: str) -> None: ...

class ConsoleNotifier:
    async def notify(self, incident: Incident, event: str) -> None:
        icons = {'detected': '[!!]', 'acknowledged': '[..]', 'resolved': '[OK]'}
        icon = icons.get(event, '[--]')
        print(f'  {icon} {event.upper():12s} {incident.service_name:20s} {incident.severity.value}')

class SilentNotifier:
    """For testing - captures calls without sending anything."""
    def __init__(self): self.calls: list[dict] = []
    async def notify(self, incident: Incident, event: str) -> None:
        self.calls.append({'event': event, 'service': incident.service_name})

# Slack webhook integration
class SlackNotifier:
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def notify(self, incident: Incident, event: str) -> None:
        import httpx
        color = {"detected": "danger", "acknowledged": "warning", "resolved": "good"}.get(event, "danger")
        payload = {
            "text": f"[{event.upper()}] {incident.service_name} ({incident.severity.value})",
            "attachments": [{
                "color": color,
                "text": incident.description,
                "fields": [
                    {"title": "Service", "value": incident.service_name, "short": True},
                    {"title": "Severity", "value": incident.severity.value, "short": True},
                    {"title": "Duration", "value": f"{incident.duration_seconds:.0f}s", "short": True},
                ]
            }]
        }
        async with httpx.AsyncClient() as client:
            await client.post(self.webhook_url, json=payload, timeout=5.0)
```

### Async Health Checker

```python
import asyncio, random, time
from typing import Dict

class HealthChecker:
    def __init__(self, max_concurrent: int = 5):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._failure_counts: Dict[str, int] = {}

    async def _check_one(self, svc: ServiceConfig) -> tuple:
        async with self._semaphore:
            await asyncio.sleep(random.uniform(0.05, 0.25))   # simulate HTTP latency
            roll = random.random()
            if roll < 0.10:
                status = ServiceStatus.DOWN
            elif roll < 0.18:
                status = ServiceStatus.DEGRADED
            else:
                status = ServiceStatus.HEALTHY

            if status == ServiceStatus.HEALTHY:
                self._failure_counts[svc.name] = 0
            else:
                self._failure_counts[svc.name] = self._failure_counts.get(svc.name, 0) + 1

            return svc.name, status

    async def check_all(self, services: list[ServiceConfig]) -> Dict[str, ServiceStatus]:
        tasks = [self._check_one(s) for s in services]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        statuses = {}
        for svc, result in zip(services, results):
            if isinstance(result, Exception):
                statuses[svc.name] = ServiceStatus.UNKNOWN
            else:
                name, status = result
                statuses[name] = status
        return statuses

    def should_alert(self, svc: ServiceConfig) -> bool:
        return self._failure_counts.get(svc.name, 0) >= svc.failure_threshold
```

### What to Build

1. Wire `HealthChecker`, `IncidentManager`, and `ConsoleNotifier` into a monitor loop that checks all services every 5 seconds.
2. Replace `ConsoleNotifier` with `SlackNotifier` using a real Slack incoming webhook URL.
3. Add a FastAPI `/incidents` endpoint that returns open incidents as a JSON list.
4. Add an `/incidents/{id}/acknowledge` endpoint that accepts a JSON body `{"by": "username"}`.
5. Write a pytest test that uses `SilentNotifier` to verify that detecting a down service creates an incident and calls `notify("detected")`.

### Test Pattern

```python
import pytest
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_incident_created_on_down_service():
    notifier = SilentNotifier()
    manager = IncidentManager(notifier)
    svc = ServiceConfig("auth-api", "https://auth/health", "platform",
                        failure_threshold=1)  # alert after first failure
    svc_map = {"auth-api": svc}
    checker = HealthChecker()

    # Force failure count to threshold
    checker._failure_counts["auth-api"] = 1
    statuses = {"auth-api": ServiceStatus.DOWN}

    await manager.process(statuses, svc_map, checker)

    assert len(manager._open) == 1
    assert "auth-api" in manager._open
    assert len(notifier.calls) == 1
    assert notifier.calls[0]["event"] == "detected"
```

---

## Mini Lab: FastAPI Health Endpoint with Pydantic and SQLAlchemy Async

**Goal:** Build a `/health` endpoint backed by a real async database ping, with Pydantic response models and proper dependency injection.

**Time estimate:** 20–30 minutes.

### Starter Code

```python
# app/main.py
from fastapi import FastAPI, Depends
from pydantic import BaseModel, Field, computed_field
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
import time

DATABASE_URL = "sqlite+aiosqlite:///./health_demo.db"
engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class ComponentHealth(BaseModel):
    name: str
    status: str   # "healthy" | "degraded" | "down"
    latency_ms: Optional[float] = None
    detail: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    components: list[ComponentHealth] = Field(default_factory=list)

    @computed_field
    @property
    def healthy(self) -> bool:
        return self.status == "healthy"

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def check_db(db: AsyncSession) -> ComponentHealth:
    try:
        start = time.monotonic()
        await db.execute(text("SELECT 1"))
        latency = (time.monotonic() - start) * 1000
        return ComponentHealth(name="database", status="healthy", latency_ms=round(latency, 2))
    except Exception as e:
        return ComponentHealth(name="database", status="down", detail=str(e))

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))   # warm up pool
    yield
    await engine.dispose()

app = FastAPI(title="Health Demo", lifespan=lifespan)

@app.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    db_component = await check_db(db)
    components = [db_component]
    overall = "healthy" if all(c.status == "healthy" for c in components) else "degraded"
    return HealthResponse(status=overall, components=components)

@app.get("/health/live")
async def liveness():
    """Kubernetes liveness probe — always returns 200 if the process is running."""
    return {"status": "alive"}

@app.get("/health/ready", response_model=HealthResponse)
async def readiness(db: AsyncSession = Depends(get_db)):
    """Kubernetes readiness probe — returns 503 if the DB is down."""
    from fastapi import HTTPException
    response = await health_check(db)
    if not response.healthy:
        raise HTTPException(status_code=503, detail="Service not ready")
    return response
```

**Run and test:**

```bash
pip install fastapi uvicorn[standard] sqlalchemy aiosqlite pydantic
uvicorn app.main:app --reload --port 8000

curl http://localhost:8000/health | jq .
curl http://localhost:8000/health/ready
```

**What to build next:**
- Add a Redis component check using `aioredis.ping()`.
- Add a `disk_usage` component that checks whether `/` has more than 90% usage.
- Write a pytest test with `AsyncClient` that verifies the `/health` response structure.

---

## Mini Lab: pytest with Async Fixtures and Mocking

**Goal:** Write a complete test suite for a service function that calls an external API and a database.

**Time estimate:** 20–30 minutes.

### The Function Under Test

```python
# app/services.py
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Deployment

async def fetch_and_save_deployment_status(
    deployment_id: str,
    status_api_url: str,
    db: AsyncSession,
) -> dict:
    """Fetch deployment status from external API and update DB record."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{status_api_url}/deployments/{deployment_id}")
        resp.raise_for_status()
        status_data = resp.json()

    dep = await db.get(Deployment, deployment_id)
    if dep is None:
        raise ValueError(f"Deployment {deployment_id} not found in DB")

    dep.status = status_data.get("status", "unknown")
    await db.commit()
    return {"id": deployment_id, "status": dep.status}
```

### Test Suite

```python
# tests/test_services.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models import Base, Deployment
from app.services import fetch_and_save_deployment_status
import uuid

# --- Fixtures ---

@pytest.fixture(scope="session")
async def engine():
    e = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with e.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield e
    await e.dispose()

@pytest.fixture
async def db(engine):
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def sample_deployment(db: AsyncSession) -> Deployment:
    dep = Deployment(
        id=str(uuid.uuid4()),
        service_id=1,
        image_tag="v1.0.0",
        status="pending",
        deployed_by="test",
    )
    db.add(dep)
    await db.commit()
    await db.refresh(dep)
    return dep

# --- Tests ---

@pytest.mark.asyncio
async def test_fetches_status_and_updates_db(db, sample_deployment):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"status": "running"}

    with patch("app.services.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        result = await fetch_and_save_deployment_status(
            deployment_id=sample_deployment.id,
            status_api_url="https://api.example.com",
            db=db,
        )

    assert result["status"] == "running"
    assert result["id"] == sample_deployment.id

    # Verify DB was updated
    updated = await db.get(Deployment, sample_deployment.id)
    assert updated.status == "running"

@pytest.mark.asyncio
async def test_raises_when_deployment_not_found(db):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"status": "running"}

    with patch("app.services.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        with pytest.raises(ValueError, match="not found in DB"):
            await fetch_and_save_deployment_status(
                deployment_id="nonexistent-id",
                status_api_url="https://api.example.com",
                db=db,
            )

@pytest.mark.asyncio
async def test_propagates_http_error(db, sample_deployment):
    import httpx

    with patch("app.services.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError("404", request=None, response=MagicMock(status_code=404))
        )
        mock_client_class.return_value = mock_client

        with pytest.raises(httpx.HTTPStatusError):
            await fetch_and_save_deployment_status(
                deployment_id=sample_deployment.id,
                status_api_url="https://api.example.com",
                db=db,
            )

@pytest.mark.parametrize("api_status,expected_db_status", [
    ("running", "running"),
    ("failed", "failed"),
    ("success", "success"),
    ("unknown_status", "unknown_status"),
])
@pytest.mark.asyncio
async def test_status_mapping(db, sample_deployment, api_status, expected_db_status):
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"status": api_status}

    with patch("app.services.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        result = await fetch_and_save_deployment_status(
            deployment_id=sample_deployment.id,
            status_api_url="https://api.example.com",
            db=db,
        )

    assert result["status"] == expected_db_status
```

**Run the tests:**

```bash
pip install pytest pytest-asyncio aiosqlite
pytest tests/test_services.py -v --asyncio-mode=auto

# Expected output:
# test_fetches_status_and_updates_db PASSED
# test_raises_when_deployment_not_found PASSED
# test_propagates_http_error PASSED
# test_status_mapping[running-running] PASSED
# test_status_mapping[failed-failed] PASSED
# test_status_mapping[success-success] PASSED
# test_status_mapping[unknown_status-unknown_status] PASSED
```

**Key lessons from this test suite:**
- `AsyncMock` is required for any async function you mock — `MagicMock` will not work.
- Async context managers (`async with httpx.AsyncClient() as client`) need both `__aenter__` and `__aexit__` mocked.
- Each test gets its own `db` fixture that rolls back after the test — tests are fully isolated.
- `pytest.mark.parametrize` eliminates four near-identical tests and replaces them with a table.
