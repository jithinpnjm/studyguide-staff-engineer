---
title: "Hands-On Labs"
sidebar_position: 5
---

# Hands-On SRE Python Labs

Three labs that build the core automation primitives used in real incident response: synthetic probes, log analysis, and Kubernetes event triage.

---

## Lab 1: HTTP Probe Utility

### Operational Context

Synthetic probes — scripts that actively make HTTP requests and report back — are one of the oldest and most reliable monitoring primitives. Blackbox exporters, uptime monitors, and canary testers all implement the same core loop: make a request, record status code and latency, report health.

You'll reach for something like this when you want to quickly verify that a new deployment is serving traffic, check whether a service is responding from inside a Kubernetes pod (without installing curl), or collect a quick baseline of response times before load testing.

The patterns here — explicit timeouts, structured output, meaningful exit codes, and connection vs HTTP error separation — appear in every production probe implementation.

**Prerequisites:** Python 3.8+, `pip install requests`  
**Time:** 30–45 minutes core + 30–45 minutes extensions

---

### Step 1 — Skeleton

Create `http_probe.py`:

```python
import sys
import time
import argparse
import requests


def probe(url: str, timeout_s: float) -> bool:
    """Probe a single URL. Returns True on success (2xx), False otherwise."""
    try:
        start = time.monotonic()
        response = requests.get(url, timeout=timeout_s)
        latency_ms = int((time.monotonic() - start) * 1000)
        ok = 200 <= response.status_code < 300
        status_label = "PASS" if ok else "FAIL"
        print(f"[{status_label}] {url}  status={response.status_code}  latency={latency_ms}ms  size={len(response.content)}B")
        return ok
    except requests.exceptions.Timeout:
        print(f"[FAIL] {url}  status=TIMEOUT  latency={int(timeout_s * 1000)}ms  size=0B")
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
    parser.add_argument(
        "--timeout", type=float, default=5.0,
        help="Request timeout in seconds (default: %(default)s)"
    )
    args = parser.parse_args()

    failures = 0
    for url in args.urls:
        if not probe(url, args.timeout):
            failures += 1

    total = len(args.urls)
    passed = total - failures
    print(f"\nSummary: {passed}/{total} passed, {failures} failed")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
```

---

### Step 2 — Test Basic Probing

```bash
python3 http_probe.py https://httpbin.org/get
# [PASS] https://httpbin.org/get  status=200  latency=312ms  size=347B

python3 http_probe.py https://httpbin.org/status/200 https://httpbin.org/status/500 --timeout 4
# [PASS] https://httpbin.org/status/200  status=200  latency=318ms  size=0B
# [FAIL] https://httpbin.org/status/500  status=500  latency=301ms  size=0B

echo $?   # → 1
```

---

### Step 3 — Key Concepts

**Why `time.monotonic()` not `time.time()`:** `time.time()` can go backward or jump forward due to NTP sync or leap seconds. `time.monotonic()` always moves forward — designed for measuring durations.

**Exception hierarchy matters:** `requests.exceptions.Timeout` is a subclass of `requests.exceptions.RequestException`. Catch specific exceptions first (most-specific to least-specific), or you lose the ability to distinguish timeouts from connection errors.

**Exit codes are mandatory:** A probe that always exits 0 is useless to cron, CI, and deployment scripts. Non-zero exit signals failure to the caller.

---

### Step 4 — Extension: Parallel Probes

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def main() -> int:
    parser = argparse.ArgumentParser(description="HTTP health probe (parallel)")
    parser.add_argument("urls", nargs="+")
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()

    failures = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(probe, url, args.timeout): url for url in args.urls}
        for future in as_completed(futures):
            if not future.result():
                failures += 1

    print(f"\nSummary: {len(args.urls) - failures}/{len(args.urls)} passed")
    return 0 if failures == 0 else 1
```

---

### Step 5 — Extension: JSON Output

```python
import json

def probe_json(url: str, timeout_s: float) -> dict:
    """Return probe result as a dict."""
    try:
        start = time.monotonic()
        response = requests.get(url, timeout=timeout_s)
        return {
            "url": url,
            "ok": 200 <= response.status_code < 300,
            "status_code": response.status_code,
            "latency_ms": int((time.monotonic() - start) * 1000),
            "size_bytes": len(response.content),
        }
    except requests.exceptions.Timeout:
        return {"url": url, "ok": False, "status_code": None, "error": "TIMEOUT"}
    except Exception as exc:
        return {"url": url, "ok": False, "status_code": None, "error": str(exc)}

# Usage with --output json flag
if args.output == "json":
    results = [probe_json(url, args.timeout) for url in args.urls]
    print(json.dumps(results, indent=2))
```

---

### Common Mistakes

| Mistake | Fix |
|---|---|
| `requests` not installed | `pip install requests` |
| Using `time.time()` for duration | Use `time.monotonic()` |
| `except Exception: print("error")` | Always include `exc`: `except Exception as exc: print(exc)` |
| Catching `BaseException` | Traps `KeyboardInterrupt` — use `Exception` |
| Probing 50 URLs sequentially | Use `ThreadPoolExecutor` for parallel probes |

---

## Lab 2: JSON Log Analyzer

### Operational Context

Structured logging — where each log line is a JSON object — is now the standard in microservices. During an incident, the first thing you want to know is: which service is generating the most errors, and what kind?

This lab builds that query as a Python script that reads newline-delimited JSON (NDJSON), handles malformed lines gracefully, and produces a summary you can paste into an incident channel in under 30 seconds.

Malformed line handling is not optional. Real log pipelines have encoding errors, truncated writes, and lines from different log formats. A script that crashes on the first malformed line is worse than useless during an incident.

**Prerequisites:** Python 3.8+, standard library only  
**Time:** 30–40 minutes core + 30 minutes extensions

---

### Step 1 — Understand the Data Format

NDJSON (newline-delimited JSON): one complete JSON object per line.

```json
{"service":"payments","level":"ERROR","error_type":"timeout","message":"downstream request timed out","trace_id":"abc-123","ts":"2026-04-09T10:00:01Z"}
{"service":"gateway","level":"ERROR","error_type":"upstream_502","message":"bad gateway","trace_id":"def-456","ts":"2026-04-09T10:00:02Z"}
not-json
{"service":"worker"  <- truncated malformed line
```

The file intentionally contains malformed lines. Your parser must handle them.

---

### Step 2 — Full Implementation

```python
import json
import os
import sys
from collections import Counter


def load_logs(path: str) -> list:
    """Load NDJSON log file, skipping and reporting malformed lines."""
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
                # Send warnings to stderr so stdout stays clean
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


def error_type_summary(records: list) -> None:
    """Count errors by error_type."""
    counts = Counter(
        r.get("error_type", "(none)")
        for r in records
        if r.get("level") == "ERROR"
    )
    print("\n=== Top Error Types ===")
    for error_type, count in counts.most_common(10):
        print(f"  {error_type:<30} {count}")


def service_summary(records: list) -> None:
    """Count errors by service."""
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

---

### Step 3 — Create Sample Data

```bash
cat > /tmp/sample-logs.ndjson <<'EOF'
{"service":"payments","level":"ERROR","error_type":"timeout","ts":"2026-04-09T10:00:01Z"}
{"service":"gateway","level":"ERROR","error_type":"upstream_502","ts":"2026-04-09T10:00:02Z"}
{"service":"payments","level":"ERROR","error_type":"timeout","ts":"2026-04-09T10:00:03Z"}
{"service":"worker","level":"INFO","msg":"job complete","ts":"2026-04-09T10:00:04Z"}
not-json
{"service":"payments","level":"ERROR","error_type":"db_conn","ts":"2026-04-09T10:00:05Z"}
EOF
```

```bash
python3 json_log_analyzer.py /tmp/sample-logs.ndjson
```

Expected stderr:
```
[WARN] line 5: malformed JSON (Expecting value): not-json
[INFO] loaded 5 records, 1 malformed lines
```

Expected stdout:
```
=== Top Error Types ===
  timeout                        2
  upstream_502                   1
  db_conn                        1

=== Errors by Service ===
  payments             3 errors
  gateway              1 errors
```

---

### Step 4 — Key Concepts

**Always use `.get()` for dict access in incident tooling.** Not every log record will have every field. A payments log might have `error_type`. A worker log might only have `message` and `level`. `record["error_type"]` raises `KeyError`; `record.get("error_type", "unknown")` does not.

**Separate stdout and stderr.** Warnings and info go to `stderr`. The actionable summary goes to `stdout`. This lets callers pipe the summary while keeping the noise separate: `python3 analyzer.py logs.ndjson 2>/dev/null | grep "payments"`.

**Defensive parsing is not optional.** When you're running this at 2am during an incident, the log file was written by a system that was also failing. Truncated lines, binary data, and encoding errors are all real.

---

### Step 5 — Extension: Time Window Filtering

```python
import datetime

def filter_by_time(records: list, minutes: int = 60) -> list:
    """Return only records from the last N minutes."""
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes)
    filtered = []
    for r in records:
        ts_str = r.get("ts", "")
        try:
            ts = datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            if ts >= cutoff:
                filtered.append(r)
        except ValueError:
            filtered.append(r)   # include records with unparseable timestamps
    return filtered
```

---

### Common Mistakes

| Mistake | Fix |
|---|---|
| Crash on first malformed line | Wrap `json.loads` in `try/except json.JSONDecodeError` |
| Counter key is `None` | Use `r.get("error_type", "(none)")` not `r.get("error_type")` |
| Counting all levels, not just ERROR | Filter: `if r.get("level") == "ERROR"` |
| Opening file in binary mode `"rb"` | Use text mode (default) for JSON parsing |
| Crash on non-UTF-8 bytes | `open(path, encoding="utf-8", errors="replace")` |

---

## Lab 3: Kubernetes Warning Event Summary

### Operational Context

`kubectl get events` is one of the first commands you run when a workload is misbehaving. In a cluster with dozens of namespaces and hundreds of pods, the raw event stream is overwhelming — thousands of lines of Normal events mixed with the handful of Warning events that actually matter.

This lab builds a filter and aggregator that turns the noisy raw event list into an actionable incident summary in under 5 seconds.

**Prerequisites:** Python 3.8+, standard library only, kubectl access or sample data  
**Time:** 30–45 minutes core + 30–40 minutes extensions

---

### Step 1 — Kubernetes Event Structure

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

Key fields: `type` (Normal vs Warning), `reason`, `count`, `metadata.namespace`, `involvedObject`.

---

### Step 2 — Full Implementation

```python
import json
import sys
from collections import Counter


def get_warnings(items: list) -> list:
    """Filter to Warning events only."""
    return [item for item in items if item.get("type") == "Warning"]


def reason_summary(warnings: list) -> None:
    """Count warnings by reason."""
    counts = Counter(w.get("reason", "Unknown") for w in warnings)
    print("\n=== Warning Events by Reason ===")
    for reason, count in counts.most_common(10):
        print(f"  {reason:<30} {count}")


def namespace_summary(warnings: list) -> None:
    """Count warnings by namespace."""
    def get_ns(event: dict) -> str:
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
    """Show highest-count individual events."""
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

    items = data.get("items", [])   # use .get — never data["items"]
    warnings = get_warnings(items)

    print(f"[INFO] {len(warnings)} Warning events out of {len(items)} total", file=sys.stderr)
    print(f"Total events: {len(items)}  Warning events: {len(warnings)}")
    reason_summary(warnings)
    namespace_summary(warnings)
    top_events(warnings)

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

### Step 3 — Run Against a Live Cluster

```bash
kubectl get events -A -o json | python3 k8s_event_summary.py
```

### Step 4 — Run Against Sample Data

```bash
# Generate sample fixture
python3 -c "
import json, random, sys

reasons = ['BackOff','OOMKilling','FailedScheduling','Unhealthy','EvictionThresholdMet']
namespaces = ['production','staging','kube-system','monitoring']

items = []
for i in range(50):
    is_warning = random.random() > 0.3
    items.append({
        'type': 'Warning' if is_warning else 'Normal',
        'reason': random.choice(reasons) if is_warning else 'Pulled',
        'count': random.randint(1, 50),
        'metadata': {'namespace': random.choice(namespaces)},
        'involvedObject': {
            'kind': 'Pod',
            'name': f'pod-{i:04d}',
            'namespace': random.choice(namespaces),
        },
    })

print(json.dumps({'kind': 'EventList', 'apiVersion': 'v1', 'items': items}))
" | python3 k8s_event_summary.py
```

---

### Step 5 — Sample Output

```
Total events: 312  Warning events: 47

=== Warning Events by Reason ===
  BackOff                        18
  OOMKilling                      9
  FailedScheduling                8
  Unhealthy                       7
  EvictionThresholdMet            3

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
```

---

### Step 6 — Extension: CrashLoopBackOff Detector

```python
def crashloop_summary(warnings: list) -> None:
    """List pods in CrashLoopBackOff, sorted by count."""
    crashloops = [
        w for w in warnings
        if w.get("reason") == "BackOff"
        and "restarting failed container" in w.get("message", "").lower()
    ]
    if not crashloops:
        print("\nNo CrashLoopBackOff events found.")
        return

    crashloops.sort(key=lambda w: w.get("count", 0), reverse=True)
    print(f"\n=== CrashLoopBackOff Pods ({len(crashloops)} total) ===")
    for event in crashloops:
        obj = event.get("involvedObject", {})
        ns = event.get("metadata", {}).get("namespace", "")
        pod = obj.get("name", "")
        count = event.get("count", 0)
        print(f"  {ns}/{pod}  restarts={count}")
```

---

### Common Mistakes

| Mistake | Fix |
|---|---|
| `data["items"]` KeyError | Always `data.get("items", [])` |
| `w["reason"]` KeyError | Always `w.get("reason", "Unknown")` |
| `metadata.namespace` is `""` (falsy) | Use `or` chain to fall back to `involvedObject.namespace` |
| No Warning events on healthy cluster | Generate sample data for testing |
| stdin consumed before script runs | Save to file first: `kubectl ... > /tmp/events.json && cat ... \| python3 ...` |

---

## Lab Extension: stdlib-only HTTP Probe

When you cannot install packages (distroless containers, restricted build systems), use `urllib.request`:

```python
import urllib.request
import urllib.error
import time

def probe_stdlib(url: str, timeout: float = 5.0) -> dict:
    start = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            body = resp.read()
            return {
                "url": url,
                "ok": 200 <= resp.status < 300,
                "status": resp.status,
                "latency_ms": int((time.monotonic() - start) * 1000),
                "size_bytes": len(body),
            }
    except urllib.error.HTTPError as exc:
        return {"url": url, "ok": False, "status": exc.code, "latency_ms": 0}
    except urllib.error.URLError as exc:
        return {"url": url, "ok": False, "status": "URL_ERROR", "detail": str(exc.reason)}
    except TimeoutError:
        return {"url": url, "ok": False, "status": "TIMEOUT", "latency_ms": int(timeout * 1000)}
```
