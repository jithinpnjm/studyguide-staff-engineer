---
title: "Python Coding Practice"
sidebar_position: 5
---

# Python Coding Practice: SRE & DevOps Focus

Coding problems focused on patterns that appear in SRE interviews: data processing, API handling, error management, concurrency, and infrastructure automation. Problems range from LeetCode-style to production scenario coding.

---

## Data Structures & Algorithms (SRE Context)

### Problem 1: LRU Cache for Metric Rate Limiter

**Scenario:** Implement an LRU cache to track the last N unique metric names seen per service. If a new metric would exceed the cache size, evict the least recently used one.

**Difficulty:** Medium

```python
from collections import OrderedDict

class MetricLRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, metric: str) -> bool:
        """Return True if metric exists, move to end (most recently used)."""
        if metric not in self.cache:
            return False
        self.cache.move_to_end(metric)
        return True

    def put(self, metric: str) -> None:
        """Add metric, evicting LRU if at capacity."""
        if metric in self.cache:
            self.cache.move_to_end(metric)
            return
        if len(self.cache) >= self.capacity:
            self.cache.popitem(last=False)  # remove LRU (first item)
        self.cache[metric] = True

# Usage
cache = MetricLRUCache(3)
cache.put("http_requests_total")
cache.put("error_rate")
cache.put("latency_p99")
cache.put("cpu_usage")        # evicts http_requests_total (LRU)
assert not cache.get("http_requests_total")  # evicted
assert cache.get("latency_p99")              # still present
```

**Key concepts:** OrderedDict, O(1) get/put with move_to_end

---

### Problem 2: Sliding Window — Rate Limiter

**Scenario:** Implement a token bucket / sliding window rate limiter for API calls. Given a list of timestamps and a window size, determine if each request should be allowed (max N requests per window).

**Difficulty:** Medium

```python
from collections import deque
from time import time

class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window = window_seconds
        self.timestamps: deque = deque()

    def allow(self, timestamp: float = None) -> bool:
        now = timestamp or time()
        cutoff = now - self.window
        # Remove timestamps outside the window
        while self.timestamps and self.timestamps[0] < cutoff:
            self.timestamps.popleft()
        if len(self.timestamps) < self.max_requests:
            self.timestamps.append(now)
            return True
        return False

# Test
limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=1.0)
times = [0.0, 0.2, 0.5, 0.8, 1.1, 1.5]
for t in times:
    result = limiter.allow(t)
    print(f"t={t:.1f}: {'ALLOWED' if result else 'DENIED'}")
# 0.0: ALLOWED, 0.2: ALLOWED, 0.5: ALLOWED, 0.8: DENIED, 1.1: ALLOWED, 1.5: ALLOWED
```

---

### Problem 3: Parse and Sort Log Lines by Timestamp

**Scenario:** Given a list of log lines from multiple services (each starting with ISO timestamp), sort them chronologically and filter to errors only.

**Difficulty:** Easy-Medium

```python
from datetime import datetime
import re

log_lines = [
    "2026-05-18T10:05:01Z ERROR service=checkout msg=payment_timeout",
    "2026-05-18T10:04:50Z INFO service=api msg=request_received",
    "2026-05-18T10:05:03Z ERROR service=auth msg=token_expired",
    "2026-05-18T10:04:55Z WARN service=db msg=slow_query latency=450ms",
    "2026-05-18T10:05:00Z ERROR service=checkout msg=db_connection_failed",
]

def parse_log(line: str) -> dict:
    parts = line.split(' ', 3)
    return {
        "timestamp": datetime.fromisoformat(parts[0].rstrip('Z')),
        "level": parts[1],
        "rest": parts[2] if len(parts) > 2 else "",
    }

def filter_and_sort_errors(logs: list[str]) -> list[str]:
    parsed = [parse_log(l) for l in logs]
    errors = [p for p in parsed if p["level"] == "ERROR"]
    errors.sort(key=lambda x: x["timestamp"])
    return errors

errors = filter_and_sort_errors(log_lines)
for e in errors:
    print(f"{e['timestamp']} | {e['rest']}")
```

---

### Problem 4: Find the Longest Pod Outage

**Scenario:** Given a list of `(timestamp, status)` tuples for a pod's health, find the longest contiguous period where the pod was in `UNHEALTHY` state.

**Difficulty:** Medium

```python
def longest_outage(events: list[tuple[int, str]]) -> int:
    """
    events: list of (unix_timestamp, status) tuples
    status: 'HEALTHY' or 'UNHEALTHY'
    Returns: duration in seconds of longest UNHEALTHY period
    """
    max_duration = 0
    outage_start = None
    
    for ts, status in events:
        if status == "UNHEALTHY" and outage_start is None:
            outage_start = ts
        elif status == "HEALTHY" and outage_start is not None:
            duration = ts - outage_start
            max_duration = max(max_duration, duration)
            outage_start = None
    
    # Check if still in outage at end
    if outage_start is not None and events:
        max_duration = max(max_duration, events[-1][0] - outage_start)
    
    return max_duration

events = [
    (0, "HEALTHY"),
    (10, "UNHEALTHY"),
    (20, "UNHEALTHY"),
    (25, "HEALTHY"),
    (30, "UNHEALTHY"),
    (60, "HEALTHY"),
]
print(longest_outage(events))  # 30 (from t=30 to t=60)
```

---

## API Handling & HTTP Patterns

### Problem 5: Retry with Exponential Backoff

**Scenario:** Write a decorator that adds retry logic with exponential backoff and jitter to any function that might fail with a transient error.

```python
import time
import random
import functools
from typing import Callable, Type, Tuple

def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
):
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt == max_retries:
                        break
                    # Exponential backoff with jitter
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    jitter = random.uniform(0, delay * 0.1)
                    sleep_time = delay + jitter
                    print(f"Attempt {attempt+1} failed: {e}. Retrying in {sleep_time:.1f}s...")
                    time.sleep(sleep_time)
            raise last_exception
        return wrapper
    return decorator

# Usage
import requests

@retry_with_backoff(max_retries=3, base_delay=1.0, exceptions=(requests.RequestException,))
def fetch_service_health(url: str) -> dict:
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    return response.json()
```

---

### Problem 6: Async HTTP Health Checker

**Scenario:** Write an async function that checks the health of multiple services in parallel and returns a report of which are healthy vs. unhealthy.

```python
import asyncio
import aiohttp
from dataclasses import dataclass

@dataclass
class HealthResult:
    service: str
    url: str
    healthy: bool
    status_code: int | None
    latency_ms: float
    error: str | None = None

async def check_service(session: aiohttp.ClientSession, service: str, url: str) -> HealthResult:
    import time
    start = time.monotonic()
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
            latency_ms = (time.monotonic() - start) * 1000
            return HealthResult(
                service=service,
                url=url,
                healthy=200 <= resp.status < 300,
                status_code=resp.status,
                latency_ms=round(latency_ms, 1),
            )
    except Exception as e:
        latency_ms = (time.monotonic() - start) * 1000
        return HealthResult(
            service=service,
            url=url,
            healthy=False,
            status_code=None,
            latency_ms=round(latency_ms, 1),
            error=str(e),
        )

async def check_all_services(services: dict[str, str]) -> list[HealthResult]:
    async with aiohttp.ClientSession() as session:
        tasks = [
            check_service(session, name, url)
            for name, url in services.items()
        ]
        return await asyncio.gather(*tasks)

# Usage
services = {
    "checkout": "https://httpbin.org/status/200",
    "payments": "https://httpbin.org/status/503",
    "auth": "https://httpbin.org/status/200",
}

async def main():
    results = await check_all_services(services)
    for r in results:
        status = "✓ HEALTHY" if r.healthy else "✗ UNHEALTHY"
        print(f"{status} {r.service} ({r.latency_ms}ms) - {r.status_code or r.error}")

asyncio.run(main())
```

---

### Problem 7: Parse Kubernetes Events JSON

**Scenario:** Given the JSON output of `kubectl get events -A -o json`, extract and group Warning events by reason and namespace. Return the top 5 most frequent warning reasons.

```python
import json
import sys
from collections import Counter

def summarize_k8s_warnings(events_json: str) -> list[dict]:
    """
    Parse kubectl get events -o json output and return top warning reasons.
    Usage: kubectl get events -A -o json | python3 script.py
    """
    data = json.loads(events_json)
    items = data.get("items", [])
    
    warnings = [
        item for item in items
        if item.get("type") == "Warning"
    ]
    
    # Group by namespace + reason
    counter = Counter()
    for event in warnings:
        namespace = event.get("metadata", {}).get("namespace", "unknown")
        reason = event.get("reason", "Unknown")
        obj_name = event.get("involvedObject", {}).get("name", "?")
        count = event.get("count", 1)
        counter[(namespace, reason)] += count
    
    # Top 5 most frequent
    results = []
    for (namespace, reason), total in counter.most_common(5):
        results.append({
            "namespace": namespace,
            "reason": reason,
            "count": total,
        })
    return results

# Sample output format:
# [
#   {"namespace": "payments", "reason": "OOMKilled", "count": 15},
#   {"namespace": "checkout", "reason": "BackOff", "count": 8},
# ]
```

---

## Error Handling Patterns

### Problem 8: Circuit Breaker

**Scenario:** Implement a circuit breaker that opens after N consecutive failures, stays open for a timeout period, then allows a single test request in half-open state.

```python
import time
from enum import Enum
from threading import Lock

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, rejecting calls
    HALF_OPEN = "half_open"  # Testing if recovered

class CircuitBreakerOpen(Exception):
    pass

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        timeout: float = 30.0,
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: float = 0
        self._lock = Lock()

    def call(self, func, *args, **kwargs):
        with self._lock:
            if self.state == CircuitState.OPEN:
                if time.monotonic() - self.last_failure_time > self.timeout:
                    self.state = CircuitState.HALF_OPEN
                else:
                    raise CircuitBreakerOpen(
                        f"Circuit open. Retry after {self.timeout}s"
                    )
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        with self._lock:
            self.failure_count = 0
            self.state = CircuitState.CLOSED

    def _on_failure(self):
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.monotonic()
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN

# Usage
def flaky_service_call(url: str) -> dict:
    import requests
    response = requests.get(url, timeout=2)
    response.raise_for_status()
    return response.json()

cb = CircuitBreaker(failure_threshold=3, timeout=10.0)

try:
    result = cb.call(flaky_service_call, "https://api.example.com/data")
except CircuitBreakerOpen as e:
    print(f"Service unavailable: {e}")
    # Return cached/default data
```

---

### Problem 9: Structured Error Response for APIs

**Scenario:** Write an error handling middleware pattern for FastAPI that converts exceptions into structured JSON error responses with request ID tracking.

```python
import uuid
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
app = FastAPI()

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.warning(
        "HTTP error",
        extra={
            "request_id": request_id,
            "status_code": exc.status_code,
            "detail": exc.detail,
            "path": str(request.url),
        }
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "request_id": request_id,
            }
        },
        headers={"X-Request-ID": request_id},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "Unhandled exception",
        exc_info=True,
        extra={"request_id": request_id}
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": 500,
                "message": "Internal server error",
                "request_id": request_id,
            }
        },
    )
```

---

### Problem 10: Parse and Validate Config with Error Accumulation

**Scenario:** Parse a service configuration dict and collect all validation errors rather than failing on the first one.

```python
from dataclasses import dataclass, field
from typing import Any

@dataclass
class ValidationError:
    field: str
    message: str

@dataclass
class ServiceConfig:
    name: str
    port: int
    replicas: int
    image: str
    timeout_seconds: float

def validate_service_config(config: dict[str, Any]) -> tuple[ServiceConfig | None, list[ValidationError]]:
    errors = []
    
    # Validate name
    name = config.get("name", "")
    if not name or not isinstance(name, str):
        errors.append(ValidationError("name", "must be a non-empty string"))
    elif not name.replace("-", "").replace("_", "").isalnum():
        errors.append(ValidationError("name", "must contain only alphanumeric chars, hyphens, underscores"))
    
    # Validate port
    port = config.get("port")
    if port is None:
        errors.append(ValidationError("port", "required"))
    elif not isinstance(port, int) or not (1 <= port <= 65535):
        errors.append(ValidationError("port", "must be integer between 1 and 65535"))
    
    # Validate replicas
    replicas = config.get("replicas", 1)
    if not isinstance(replicas, int) or replicas < 1:
        errors.append(ValidationError("replicas", "must be positive integer"))
    elif replicas > 100:
        errors.append(ValidationError("replicas", "cannot exceed 100"))
    
    # Validate image
    image = config.get("image", "")
    if not image:
        errors.append(ValidationError("image", "required"))
    elif ":" not in image:
        errors.append(ValidationError("image", "must include a tag (e.g., myapp:v1.2.3)"))
    elif image.endswith(":latest"):
        errors.append(ValidationError("image", "mutable 'latest' tag not allowed in production"))
    
    # Validate timeout
    timeout = config.get("timeout_seconds", 30)
    if not isinstance(timeout, (int, float)) or timeout <= 0:
        errors.append(ValidationError("timeout_seconds", "must be positive number"))
    
    if errors:
        return None, errors
    
    return ServiceConfig(
        name=name,
        port=port,
        replicas=replicas,
        image=image,
        timeout_seconds=float(timeout),
    ), []

# Test
bad_config = {
    "name": "checkout",
    "port": 99999,
    "image": "myapp:latest",
    "timeout_seconds": -1,
}

result, errors = validate_service_config(bad_config)
if errors:
    print("Validation failed:")
    for err in errors:
        print(f"  {err.field}: {err.message}")
```

---

## Quick Reference: Common Interview Patterns

| Pattern | When to Use | Key Data Structure |
|---|---|---|
| Sliding window | Rate limiting, log aggregation | deque |
| LRU cache | Caching with eviction | OrderedDict |
| Producer-consumer | Async job processing | asyncio.Queue |
| Circuit breaker | Fault tolerance | State machine + timer |
| Retry with backoff | Transient failures | Decorator + sleep |
| Validation accumulator | Config/input validation | List of errors |
| Event grouping | Log/metric aggregation | Counter, defaultdict |
| Binary search | Threshold finding in sorted data | bisect |

---

## Common SRE Coding Interview Topics

1. **Concurrency** — threading, asyncio, concurrent.futures, race conditions
2. **Error handling** — custom exceptions, retry logic, circuit breakers
3. **Parsing** — JSON, YAML, log files, structured data
4. **HTTP clients** — requests, aiohttp, timeouts, retries
5. **Data aggregation** — Counter, groupby, time-series windowing
6. **Config management** — validation, defaults, schema checking
7. **Kubernetes automation** — kubectl output parsing, watch loops
8. **Metrics processing** — PromQL patterns, time-series math
9. **CLI tools** — argparse, click, structured output
10. **Testing** — unittest, pytest, mocking external services
