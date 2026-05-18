---
title: "Expert"
sidebar_position: 3
---

# Expert Python for SRE

This layer covers production-grade patterns: async I/O, type-safe protocol design, performance profiling, C extensions, and reliability primitives (circuit breaker, retry with jitter, graceful shutdown).

---

## async / await

### Why Async for SRE

Async is ideal for I/O-bound concurrency — checking 100 endpoints simultaneously without spawning 100 threads. The event loop multiplexes I/O on a single thread.

```python
import asyncio
import time
import httpx   # async-native HTTP client

async def probe(session: httpx.AsyncClient, url: str, timeout: float = 5.0) -> dict:
    start = time.monotonic()
    try:
        resp = await session.get(url, timeout=timeout)
        return {
            "url": url,
            "ok": 200 <= resp.status_code < 300,
            "status": resp.status_code,
            "latency_ms": int((time.monotonic() - start) * 1000),
        }
    except httpx.TimeoutException:
        return {"url": url, "ok": False, "status": "TIMEOUT", "latency_ms": int(timeout * 1000)}
    except httpx.ConnectError as exc:
        return {"url": url, "ok": False, "status": "CONN_ERROR", "detail": str(exc)}

async def probe_all(urls: list[str], timeout: float = 5.0) -> list[dict]:
    async with httpx.AsyncClient() as session:
        tasks = [probe(session, url, timeout) for url in urls]
        return await asyncio.gather(*tasks)

if __name__ == "__main__":
    urls = ["https://api/healthz", "https://cache/ping", "https://db/status"]
    results = asyncio.run(probe_all(urls))
    for r in results:
        print(f"{'OK' if r['ok'] else 'FAIL'}  {r['url']}  {r.get('latency_ms', 0)}ms")
```

### Async with Semaphore (Rate Limiting)

```python
async def probe_all_bounded(urls: list[str], concurrency: int = 20) -> list[dict]:
    sem = asyncio.Semaphore(concurrency)

    async def bounded_probe(session, url):
        async with sem:
            return await probe(session, url)

    async with httpx.AsyncClient() as session:
        tasks = [bounded_probe(session, url) for url in urls]
        return await asyncio.gather(*tasks)
```

### Async Context Manager

```python
class AsyncConnectionPool:
    def __init__(self, dsn: str, max_size: int = 10):
        self.dsn = dsn
        self.max_size = max_size
        self._pool = None

    async def __aenter__(self):
        import asyncpg
        self._pool = await asyncpg.create_pool(self.dsn, max_size=self.max_size)
        return self._pool

    async def __aexit__(self, *_):
        if self._pool:
            await self._pool.close()

async def main():
    async with AsyncConnectionPool("postgresql://user:pw@db/mydb") as pool:
        rows = await pool.fetch("SELECT id, name FROM services WHERE healthy = true")
        for row in rows:
            print(row["name"])
```

---

## Type Hints and Protocols

### Why Type Hints Matter for Ops Tools

- Static analysis with `mypy` catches bugs before runtime
- IDEs provide accurate autocomplete
- Code documents its own contracts

```python
from typing import Optional, Union, TypeVar, Generic
from collections.abc import Iterator, AsyncIterator

def parse_manifest(path: str) -> dict[str, object]:
    import yaml
    return yaml.safe_load(open(path).read())

def get_replicas(manifest: dict[str, object]) -> Optional[int]:
    spec = manifest.get("spec")
    if isinstance(spec, dict):
        return spec.get("replicas")
    return None
```

### Protocol Design

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Prober(Protocol):
    """Any object that can probe a target and return a result dict."""

    def probe(self, target: str) -> dict[str, object]: ...
    def close(self) -> None: ...

class HttpProber:
    def probe(self, target: str) -> dict[str, object]:
        import requests, time
        start = time.monotonic()
        resp = requests.get(target, timeout=5)
        return {"ok": resp.ok, "latency_ms": int((time.monotonic() - start) * 1000)}

    def close(self) -> None:
        pass

def run_checks(prober: Prober, targets: list[str]) -> list[dict]:
    """Works with any Prober implementation."""
    return [prober.probe(t) for t in targets]

# At runtime, check protocol conformance
assert isinstance(HttpProber(), Prober)
```

### TypeVar and Generic Classes

```python
from typing import TypeVar, Generic

T = TypeVar("T")

class RingBuffer(Generic[T]):
    """Fixed-size ring buffer for metric windows."""

    def __init__(self, maxsize: int):
        self._buf: list[T] = []
        self._maxsize = maxsize

    def push(self, item: T) -> None:
        if len(self._buf) >= self._maxsize:
            self._buf.pop(0)
        self._buf.append(item)

    def values(self) -> list[T]:
        return list(self._buf)

latency_window: RingBuffer[float] = RingBuffer(60)
latency_window.push(42.5)
```

---

## Performance Profiling

### cProfile — CPU Profiling

```python
import cProfile
import pstats
import io

def profile_function(func, *args, **kwargs):
    pr = cProfile.Profile()
    pr.enable()
    result = func(*args, **kwargs)
    pr.disable()

    s = io.StringIO()
    ps = pstats.Stats(pr, stream=s).sort_stats("cumulative")
    ps.print_stats(20)   # top 20 functions by cumulative time
    print(s.getvalue())
    return result

# CLI profiling
# python3 -m cProfile -s cumulative my_tool.py --arg value
```

### memory_profiler — Memory Usage

```python
# Install: pip install memory-profiler
# Annotate functions to track line-by-line memory

from memory_profiler import profile

@profile
def parse_large_log(path: str) -> list:
    records = []
    with open(path) as f:
        for line in f:
            records.append(json.loads(line))   # memory grows here
    return records

# Better: streaming approach avoids holding all records
@profile
def stream_parse_log(path: str):
    with open(path) as f:
        for line in f:
            yield json.loads(line)   # constant memory
```

### tracemalloc — Built-in Memory Tracing

```python
import tracemalloc

tracemalloc.start()
# ... run code ...
snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics("lineno")
for stat in top_stats[:10]:
    print(stat)
```

---

## C Extensions via ctypes

Use `ctypes` when you need to call a system library or a compiled C function without writing a full extension module.

```python
import ctypes
import ctypes.util

# Load a shared library
libc = ctypes.CDLL(ctypes.util.find_library("c"))

# Call getpid()
libc.getpid.restype = ctypes.c_int
pid = libc.getpid()
print(f"PID: {pid}")

# struct example — read system load average
class LoadAvg(ctypes.Structure):
    _fields_ = [("load1", ctypes.c_double),
                ("load5", ctypes.c_double),
                ("load15", ctypes.c_double)]

# Safer alternative: use psutil which wraps these for you
import psutil
load1, load5, load15 = psutil.getloadavg()
print(f"Load: {load1:.2f} {load5:.2f} {load15:.2f}")
```

---

## Production Patterns

### Retry with Exponential Backoff and Jitter

```python
import time
import random
import logging
from typing import Callable, TypeVar, Type

R = TypeVar("R")
logger = logging.getLogger(__name__)

def retry_with_backoff(
    func: Callable[..., R],
    *args,
    max_attempts: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
    retryable: tuple[Type[Exception], ...] = (Exception,),
    **kwargs,
) -> R:
    """
    Retry func with exponential backoff and optional jitter.

    Bad retries amplify incidents. Jitter prevents thundering herd.
    Only retry transient errors — not 4xx responses.
    """
    last_exc = None
    for attempt in range(max_attempts):
        try:
            return func(*args, **kwargs)
        except retryable as exc:
            last_exc = exc
            if attempt == max_attempts - 1:
                break
            delay = min(base_delay * (2 ** attempt), max_delay)
            if jitter:
                delay *= (0.5 + random.random() * 0.5)
            logger.warning(
                "Attempt %d/%d failed: %s. Retrying in %.1fs",
                attempt + 1, max_attempts, exc, delay,
            )
            time.sleep(delay)
    raise RuntimeError(f"All {max_attempts} attempts failed") from last_exc

# Usage
import requests
response = retry_with_backoff(
    requests.get,
    "https://api.internal/config",
    timeout=10,
    retryable=(requests.exceptions.RequestException,),
)
```

### Circuit Breaker

A circuit breaker prevents cascading failures by stopping calls to a failing dependency after a threshold is exceeded, then probing periodically to detect recovery.

```python
import time
import threading
from enum import Enum, auto

class State(Enum):
    CLOSED = auto()    # normal operation — calls pass through
    OPEN = auto()      # failing — calls rejected immediately
    HALF_OPEN = auto() # recovery probe — one call allowed through

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        expected_exception: type = Exception,
    ):
        self._lock = threading.Lock()
        self._state = State.CLOSED
        self._failure_count = 0
        self._threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._opened_at: float = 0.0
        self._expected = expected_exception

    def call(self, func, *args, **kwargs):
        with self._lock:
            if self._state == State.OPEN:
                if time.monotonic() - self._opened_at >= self._recovery_timeout:
                    self._state = State.HALF_OPEN
                else:
                    raise RuntimeError("Circuit is OPEN — call rejected")

        try:
            result = func(*args, **kwargs)
            with self._lock:
                if self._state == State.HALF_OPEN:
                    self._state = State.CLOSED
                    self._failure_count = 0
            return result
        except self._expected as exc:
            with self._lock:
                self._failure_count += 1
                if self._failure_count >= self._threshold or self._state == State.HALF_OPEN:
                    self._state = State.OPEN
                    self._opened_at = time.monotonic()
            raise

cb = CircuitBreaker(failure_threshold=3, recovery_timeout=60.0)

def call_payments_api(payload):
    return cb.call(requests.post, "https://payments/charge", json=payload, timeout=5)
```

### Graceful Shutdown

```python
import signal
import sys
import threading
import logging

logger = logging.getLogger(__name__)

class GracefulShutdown:
    """Signal handler that allows in-flight work to complete."""

    def __init__(self, timeout: float = 30.0):
        self._stop_event = threading.Event()
        self._timeout = timeout
        signal.signal(signal.SIGTERM, self._handle)
        signal.signal(signal.SIGINT, self._handle)

    def _handle(self, signum, frame):
        logger.info("Received signal %d — shutting down gracefully", signum)
        self._stop_event.set()

    @property
    def should_stop(self) -> bool:
        return self._stop_event.is_set()

    def wait(self) -> None:
        self._stop_event.wait(timeout=self._timeout)

# Usage in a long-running loop
shutdown = GracefulShutdown(timeout=30)

while not shutdown.should_stop:
    collect_metrics()
    time.sleep(15)

logger.info("Worker stopped cleanly")
```

---

## Async Patterns at Scale

### async Graceful Shutdown

```python
import asyncio
import signal

async def main():
    loop = asyncio.get_running_loop()
    stop = loop.create_future()

    def _signal_handler():
        stop.set_result(None)

    loop.add_signal_handler(signal.SIGTERM, _signal_handler)
    loop.add_signal_handler(signal.SIGINT, _signal_handler)

    # Start background tasks
    task = asyncio.create_task(probe_loop())

    await stop   # wait for signal

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    print("Shutdown complete")

asyncio.run(main())
```

### Task Groups (Python 3.11+)

```python
import asyncio

async def probe_all_grouped(urls: list[str]) -> list[dict]:
    results = []
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(probe(session, url)) for url in urls]
    # All tasks done here — exceptions propagate together
    return [t.result() for t in tasks]
```

---

## Production Prometheus Exporter

```python
from prometheus_client import (
    start_http_server, Gauge, Counter, Histogram, REGISTRY
)
import time
import random

# Define metrics at module level (they register globally)
REQUEST_LATENCY = Histogram(
    "myapp_request_duration_seconds",
    "Request latency in seconds",
    ["endpoint", "method"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)
ACTIVE_CONNECTIONS = Gauge("myapp_active_connections", "Active connections", ["region"])
ERRORS = Counter("myapp_errors_total", "Total errors", ["type", "service"])

def collect_metrics():
    ACTIVE_CONNECTIONS.labels(region="us-east-1").set(random.randint(10, 100))
    ACTIVE_CONNECTIONS.labels(region="eu-west-1").set(random.randint(5, 50))
    with REQUEST_LATENCY.labels(endpoint="/api/v1/data", method="GET").time():
        time.sleep(random.uniform(0.01, 0.5))

if __name__ == "__main__":
    start_http_server(8080)
    while True:
        collect_metrics()
        time.sleep(15)
```

---

## Performance Optimization Patterns

### Avoid Repeated Attribute Lookups

```python
# Slow — Python looks up `result.append` on every iteration
for item in big_list:
    result.append(transform(item))

# Fast — bind the method once
append = result.append
for item in big_list:
    append(transform(item))

# Fastest — list comprehension (avoids Python loop overhead)
result = [transform(item) for item in big_list]
```

### Use `__slots__` for High-Frequency Objects

```python
class MetricPoint:
    __slots__ = ("ts", "value", "labels")   # saves ~50% memory vs dict-based

    def __init__(self, ts: float, value: float, labels: dict):
        self.ts = ts
        self.value = value
        self.labels = labels
```

### LRU Cache for Expensive Lookups

```python
from functools import lru_cache

@lru_cache(maxsize=256)
def resolve_service_owner(service_name: str) -> str:
    """Cached reverse lookup against the service registry API."""
    resp = requests.get(f"https://registry/services/{service_name}", timeout=5)
    return resp.json().get("owner", "unknown")
```

---

## Packaging a Tool for Internal Distribution

```python
# pyproject.toml
[build-system]
requires = ["setuptools>=67"]
build-backend = "setuptools.backends.legacy:build"

[project]
name = "sre-probe"
version = "1.0.0"
requires-python = ">=3.10"
dependencies = ["requests>=2.31", "pyyaml>=6.0"]

[project.scripts]
sre-probe = "sre_probe.cli:main"
```

```bash
# Install editable for development
pip install -e .

# Build and distribute internally
python -m build
pip install dist/sre_probe-1.0.0-py3-none-any.whl
```
