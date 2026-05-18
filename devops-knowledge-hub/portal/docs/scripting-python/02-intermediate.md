---
title: "Intermediate"
sidebar_position: 2
---

# Intermediate Python for SRE

This layer covers patterns you need when building tools that go to production: structured exceptions, concurrent I/O, reusable classes, logging that operators can query, and the concurrency model that underpins most SRE automation.

---

## OOP for SRE Tooling

### Classes and Instances

```python
class ServiceChecker:
    """Checks the health of a set of services."""

    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout
        self._session = None

    def _get_session(self):
        import requests
        if self._session is None:
            self._session = requests.Session()
        return self._session

    def check(self, url: str) -> dict:
        import time
        session = self._get_session()
        start = time.monotonic()
        try:
            resp = session.get(url, timeout=self.timeout)
            return {
                "url": url,
                "ok": 200 <= resp.status_code < 300,
                "status": resp.status_code,
                "latency_ms": int((time.monotonic() - start) * 1000),
            }
        except Exception as exc:
            return {"url": url, "ok": False, "status": "ERROR", "detail": str(exc)}

    def close(self):
        if self._session:
            self._session.close()
```

### Inheritance

```python
class TimeoutChecker(ServiceChecker):
    """Adds per-check timeout tracking."""

    def check(self, url: str) -> dict:
        result = super().check(url)
        result["timed_out"] = result.get("detail", "").startswith("ConnectTimeout")
        return result
```

### Four Principles — Applied

| Principle | SRE Application |
|---|---|
| Encapsulation | `ServiceChecker` owns its session; callers don't manage it |
| Inheritance | `TimeoutChecker` extends without rewriting |
| Polymorphism | `check(url)` is the same interface regardless of subclass |
| Abstraction | Callers see `ok/latency_ms`, not raw `requests` internals |

---

## Dataclasses

Use `dataclasses` instead of plain dicts when a result has a fixed schema — it gives you type hints, a `__repr__`, and eliminates boilerplate.

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class CheckResult:
    target: str
    ok: bool
    latency_ms: float
    status_code: Optional[int] = None
    error: Optional[str] = None
    tags: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "target": self.target,
            "ok": self.ok,
            "latency_ms": self.latency_ms,
            "status_code": self.status_code,
            "error": self.error,
        }

# Usage
result = CheckResult(target="https://api/healthz", ok=True, latency_ms=42.0, status_code=200)
print(result)
# CheckResult(target='https://api/healthz', ok=True, latency_ms=42.0, ...)
```

---

## Decorators

### What They Are

A decorator is a function that wraps another function to add behaviour without modifying the original.

```python
import functools
import time
import logging

logger = logging.getLogger(__name__)

def timed(func):
    """Log how long the wrapped function takes."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.monotonic()
        result = func(*args, **kwargs)
        elapsed = time.monotonic() - start
        logger.info(f"{func.__name__} took {elapsed:.3f}s")
        return result
    return wrapper

def retry(max_attempts: int = 3, backoff: float = 1.0, exceptions=(Exception,)):
    """Retry decorator with exponential backoff."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as exc:
                    if attempt == max_attempts - 1:
                        raise
                    wait = backoff * (2 ** attempt)
                    logger.warning(f"{func.__name__} attempt {attempt+1} failed: {exc}. Retrying in {wait:.1f}s")
                    time.sleep(wait)
        return wrapper
    return decorator

@timed
@retry(max_attempts=3, backoff=0.5)
def fetch_config(url: str) -> dict:
    import requests
    return requests.get(url, timeout=10).json()
```

### Class-Based Decorator

```python
class RateLimiter:
    """Limits calls to N per second."""

    def __init__(self, calls_per_second: float):
        self._min_interval = 1.0 / calls_per_second
        self._last_call = 0.0

    def __call__(self, func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            now = time.monotonic()
            wait = self._min_interval - (now - self._last_call)
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.monotonic()
            return func(*args, **kwargs)
        return wrapper

@RateLimiter(calls_per_second=2)
def call_external_api(endpoint: str) -> dict:
    import requests
    return requests.get(endpoint, timeout=5).json()
```

---

## Context Managers

Context managers implement the `with` protocol — `__enter__` / `__exit__`. They guarantee cleanup even when exceptions occur.

```python
import contextlib
import time
import logging

logger = logging.getLogger(__name__)

@contextlib.contextmanager
def timer(label: str):
    """Time a block of code."""
    start = time.monotonic()
    try:
        yield
    finally:
        elapsed = time.monotonic() - start
        logger.info(f"{label}: {elapsed:.3f}s")

# Usage
with timer("pod_scan"):
    pods = fetch_all_pods()

@contextlib.contextmanager
def temp_kubeconfig(config_data: dict):
    """Write a temp kubeconfig and set KUBECONFIG env var."""
    import tempfile, os, yaml
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        yaml.dump(config_data, f)
        fname = f.name
    old = os.environ.get("KUBECONFIG")
    os.environ["KUBECONFIG"] = fname
    try:
        yield fname
    finally:
        os.environ.pop("KUBECONFIG", None)
        if old:
            os.environ["KUBECONFIG"] = old
        os.unlink(fname)
```

### Class-Based Context Manager

```python
class ManagedConnection:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.conn = None

    def __enter__(self):
        import socket
        self.conn = socket.create_connection((self.host, self.port), timeout=5)
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            self.conn.close()
        return False   # do not suppress exceptions

with ManagedConnection("db.internal", 5432) as conn:
    conn.sendall(b"ping")
```

---

## Generators

Generators produce values lazily — essential for processing large log files or event streams without loading everything into memory.

```python
from typing import Generator

def parse_error_lines(path: str) -> Generator[dict, None, None]:
    """Yield parsed error records from a NDJSON log file one at a time."""
    import json
    with open(path, encoding="utf-8", errors="replace") as f:
        for line_num, raw in enumerate(f, start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                record = json.loads(raw)
                if record.get("level") == "ERROR":
                    yield record
            except json.JSONDecodeError:
                continue   # skip malformed lines

# Memory-efficient: only one record in memory at a time
for record in parse_error_lines("/var/log/app.ndjson"):
    print(record.get("service"), record.get("message"))

# Generator expressions
error_services = (r["service"] for r in parse_error_lines("/var/log/app.ndjson") if "service" in r)
```

---

## concurrent.futures

Use `ThreadPoolExecutor` for parallel I/O-bound tasks (HTTP checks, kubectl calls). Use `ProcessPoolExecutor` for CPU-bound work.

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess

def run_on_host(host: str, cmd: list) -> tuple:
    """SSH into host and run command. Returns (host, output, returncode)."""
    result = subprocess.run(
        ["ssh", "-o", "StrictHostKeyChecking=no", f"user@{host}"] + cmd,
        capture_output=True, text=True, timeout=30,
    )
    return host, result.stdout + result.stderr, result.returncode

hosts = ["node-1", "node-2", "node-3", "node-4"]
cmd = ["df", "-h", "/"]

with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(run_on_host, h, cmd): h for h in hosts}
    for future in as_completed(futures):
        host = futures[future]
        try:
            _, output, code = future.result()
            status = "OK" if code == 0 else "FAIL"
            print(f"[{status}] {host}: {output.strip()}")
        except Exception as exc:
            print(f"[ERROR] {host}: {exc}")
```

### Parallel HTTP Health Checks

```python
import requests
import time

def probe(url: str, timeout: float = 5.0) -> CheckResult:
    start = time.monotonic()
    try:
        resp = requests.get(url, timeout=timeout)
        return CheckResult(
            target=url, ok=200 <= resp.status_code < 300,
            latency_ms=int((time.monotonic() - start) * 1000),
            status_code=resp.status_code,
        )
    except Exception as exc:
        return CheckResult(target=url, ok=False, latency_ms=0, error=str(exc))

urls = ["https://api/healthz", "https://cache/ping", "https://db/status"]

with ThreadPoolExecutor(max_workers=len(urls)) as pool:
    results = list(pool.map(probe, urls))

for r in results:
    icon = "OK" if r.ok else "FAIL"
    print(f"[{icon}] {r.target}  {r.latency_ms}ms")
```

---

## Logging Module

### Structured Logging for Production

```python
import logging
import sys

def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )

# Per-module loggers (preferred over root logger)
logger = logging.getLogger(__name__)
logger.info("starting health check")
logger.warning("service degraded: %s", service_name)
logger.error("probe failed", exc_info=True)   # includes traceback
```

### JSON Formatter for Log Aggregators

```python
import json
import datetime
import logging

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "ts":     datetime.datetime.utcnow().isoformat() + "Z",
            "level":  record.levelname,
            "logger": record.name,
            "msg":    record.getMessage(),
            "file":   f"{record.filename}:{record.lineno}",
        })

def get_json_logger(name: str) -> logging.Logger:
    log = logging.getLogger(name)
    if not log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        log.addHandler(handler)
        log.setLevel(logging.INFO)
    return log

log = get_json_logger("sre-tool")
log.info("Server started")
# → {"ts":"2026-01-01T10:00:00Z","level":"INFO","logger":"sre-tool","msg":"Server started","file":"tool.py:42"}
```

**Logs should answer:**
- What happened?
- When?
- Against what target?
- What action was taken?

---

## Advanced Error Handling Patterns

### Custom Exceptions

```python
class ProbeError(Exception):
    """Base class for all probe errors."""

class TimeoutError(ProbeError):
    """Raised when a probe exceeds its timeout."""
    def __init__(self, url: str, timeout_s: float):
        super().__init__(f"{url} timed out after {timeout_s}s")
        self.url = url
        self.timeout_s = timeout_s

class ConnectionError(ProbeError):
    """Raised when a connection cannot be established."""
```

### Exception Chaining

```python
try:
    data = fetch_config(url)
except requests.exceptions.RequestException as exc:
    raise RuntimeError(f"Failed to load config from {url}") from exc
# The original exception is preserved as __cause__
```

### Context Variables for Error Enrichment

```python
import contextlib

_current_target = None

@contextlib.contextmanager
def checking(target: str):
    global _current_target
    _current_target = target
    try:
        yield
    except Exception as exc:
        raise type(exc)(f"[{target}] {exc}") from exc
    finally:
        _current_target = None

with checking("payments-service"):
    response = requests.get("https://payments/healthz", timeout=5)
```

---

## YAML / JSON Processing — Advanced Patterns

```python
import yaml, json

# Load multi-document YAML (kubectl manifests)
with open("manifests.yaml") as f:
    docs = list(yaml.safe_load_all(f))

# Modify replicas in all Deployments
for doc in docs:
    if doc and doc.get("kind") == "Deployment":
        doc["spec"]["replicas"] = 3

# Write back
with open("manifests-out.yaml", "w") as f:
    yaml.dump_all(docs, f, default_flow_style=False)

# Merge two configs (shallow merge)
base = yaml.safe_load(Path("base.yaml").read_text())
override = yaml.safe_load(Path("override.yaml").read_text())
merged = {**base, **override}
```

---

## SSH Automation with Paramiko

```python
import paramiko

def run_remote(host: str, user: str, key_path: str, command: str) -> str:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, key_filename=key_path, timeout=10)
        _, stdout, stderr = client.exec_command(command, timeout=30)
        out = stdout.read().decode()
        err = stderr.read().decode()
        if err:
            raise RuntimeError(f"stderr: {err}")
        return out
    finally:
        client.close()

output = run_remote("node-1.internal", "ops", "~/.ssh/id_rsa", "uptime")
print(output)
```

---

## Docker SDK Integration

```python
import docker

client = docker.from_env()

# List running containers
for container in client.containers.list():
    print(container.name, container.status)

# Get container stats
stats = container.stats(stream=False)
cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
            stats["precpu_stats"]["cpu_usage"]["total_usage"]

# Restart unhealthy containers
for container in client.containers.list():
    if container.attrs["State"]["Health"]["Status"] == "unhealthy":
        container.restart()
```

---

## SQLite for Operational Databases

```python
import sqlite3
from contextlib import closing

DB_PATH = "/var/lib/sre-tool/state.db"

def init_db(path: str) -> None:
    with closing(sqlite3.connect(path)) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS probe_results (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                ts        TEXT NOT NULL,
                url       TEXT NOT NULL,
                ok        INTEGER NOT NULL,
                latency   REAL,
                status    INTEGER
            )
        """)
        conn.commit()

def record_result(path: str, result: CheckResult) -> None:
    import datetime
    with closing(sqlite3.connect(path)) as conn:
        conn.execute(
            "INSERT INTO probe_results (ts, url, ok, latency, status) VALUES (?, ?, ?, ?, ?)",
            (datetime.datetime.utcnow().isoformat(), result.target,
             int(result.ok), result.latency_ms, result.status_code)
        )
        conn.commit()
```
