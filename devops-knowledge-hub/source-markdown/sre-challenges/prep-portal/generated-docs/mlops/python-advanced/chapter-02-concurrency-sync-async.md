---
title: "Chapter 02 Concurrency Sync Async"
description: "Generated from mlops/PYTHON/Advanced/chapter_02_concurrency_sync_async.ipynb"
slug: "/python-advanced/chapter-02-concurrency-sync-async"
---


<div className="notebook-meta">Source: <code>mlops/PYTHON/Advanced/chapter_02_concurrency_sync_async.ipynb</code></div>

# Chapter 2: Concurrency — Threading, Multiprocessing, and Async/Await

One of the most practical Python skills for a DevOps engineer is running things **at the same time**.
Think about what you do manually every day:
- Check the health of 20 servers simultaneously
- Download configs from 10 services in parallel
- Run a deploy and watch the logs at the same time

Without concurrency you'd wait for each one to finish before starting the next.
With concurrency, you do them all at once.

## Three models — pick the right one

| Model | Best for | Python tool |
|-------|----------|-------------|
| **Threading** | I/O-bound tasks (network, disk) — waiting, not computing | `ThreadPoolExecutor` |
| **Multiprocessing** | CPU-bound tasks (data crunching, image processing) | `ProcessPoolExecutor` |
| **Async/await** | Many concurrent I/O tasks, high control, single thread | `asyncio` |

> **The GIL**: Python has a Global Interpreter Lock — only one thread runs Python bytecode at a
> time. This means threads don't help for CPU work, but they work great for I/O because the GIL
> is released while waiting for I/O.

---
## 1. Sequential vs Concurrent — See the Difference

Let's start with a concrete comparison: checking health of 5 servers.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 3</div>

```python
import time, random

# Simulate an HTTP health check (takes 1-2 seconds of "network time")
def check_health(server: str) -> dict:
    delay = random.uniform(0.5, 1.5)
    time.sleep(delay)   # simulate network latency
    healthy = random.random() > 0.2   # 80% chance healthy
    return {"server": server, "healthy": healthy, "latency_ms": round(delay * 1000)}

servers = ["web-01", "web-02", "db-primary", "cache-01", "api-gateway"]

# --- SEQUENTIAL (the naive way) ---
random.seed(42)
print("=== Sequential health checks ===")
start = time.time()
results = [check_health(s) for s in servers]
elapsed = time.time() - start

for r in results:
    icon = "✓" if r["healthy"] else "✗"
    print(f"  {icon} {r['server']:15s} {r['latency_ms']}ms")
print(f"Total time: {elapsed:.2f}s  (waited for each server one by one)")
```

</div>

### What just happened?
We defined `check_health()` which simulates an HTTP health check — it uses `time.sleep()` to pretend it's waiting for a network response (0.5 to 1.5 seconds).

Then we called it **sequentially** in a list comprehension — one server at a time. The total time is roughly the *sum* of all individual delays.

This is how most beginners write code. For 5 servers averaging ~1 second each = ~5 seconds total. For 100 servers it would be ~100 seconds. That's why concurrency matters.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 5</div>

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- CONCURRENT with ThreadPoolExecutor ---
random.seed(42)
print("=== Concurrent health checks (ThreadPoolExecutor) ===")
start = time.time()

# ThreadPoolExecutor manages a pool of threads
# submit() starts a task in a thread and returns a Future
with ThreadPoolExecutor(max_workers=5) as executor:
    # Map server -> Future
    futures = {executor.submit(check_health, s): s for s in servers}

    results = []
    for future in as_completed(futures):   # as_completed yields futures as they FINISH
        server = futures[future]
        try:
            result = future.result()
            results.append(result)
        except Exception as e:
            results.append({"server": server, "healthy": False, "error": str(e)})

elapsed = time.time() - start
for r in results:
    icon = "✓" if r["healthy"] else "✗"
    print(f"  {icon} {r['server']:15s} {r.get('latency_ms', '?')}ms")
print(f"Total time: {elapsed:.2f}s  (all servers checked in parallel!)")
print(f"Speedup: ~{5 * 1.0 / elapsed:.1f}x")
```

</div>

### What just happened?
We ran the same 5 health checks in **parallel using threads**.

Key things to understand:
- `ThreadPoolExecutor(max_workers=5)` creates a pool of 5 threads ready to do work
- `executor.submit(check_health, s)` hands off one task to a thread — it starts **immediately** and returns a `Future` (a promise of a result)
- `as_completed(futures)` is a generator that **yields futures as they finish** — not in the order you submitted them, but in the order they complete
- `future.result()` gets the actual return value (or raises the exception if one occurred)

The total time is now roughly the *maximum* single delay (~1.5s) instead of the sum (~5s).

**The GIL note**: Python only runs one thread at a time (Global Interpreter Lock), BUT while a thread is sleeping/waiting for I/O, it releases the lock. So all 5 threads can be "waiting" simultaneously — that's the win.

**Key insight**: The sequential version takes ~5 seconds (sum of all waits).
The threaded version takes ~1.5 seconds (maximum single wait).

This is the I/O-bound sweet spot for threads: your code is mostly **waiting**, not computing.
Threads allow other work to run during those waits.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 8</div>

```python
# executor.map() — simpler when you just want results in order
from concurrent.futures import ThreadPoolExecutor

print("=== executor.map() — ordered results ===")
random.seed(99)
start = time.time()

with ThreadPoolExecutor(max_workers=5) as executor:
    # map() takes (function, iterable) — returns results in INPUT order
    results = list(executor.map(check_health, servers))

elapsed = time.time() - start
for r in results:
    print(f"  {r['server']:15s} healthy={r['healthy']} latency={r['latency_ms']}ms")
print(f"Time: {elapsed:.2f}s")

# Use map() when: you want results in original order and don't need per-future control
# Use submit()+as_completed() when: you want to process results as they arrive
```

</div>

### What just happened?
`executor.map(fn, iterable)` is a simpler version of `submit()` + `as_completed()`.

The difference:
- `map()` returns results **in the same order as the input** — server 1 result first, then server 2, etc.
- `as_completed()` returns results **as they finish** — fastest result first

Use `map()` when: you just want all results and order matters
Use `submit()` + `as_completed()` when: you want to process results the moment they're ready (e.g., update a dashboard live)

---
## 2. ProcessPoolExecutor — for CPU-Bound Work

Threads don't help when the work is CPU-intensive — the GIL prevents true parallelism.
For that, use **ProcessPoolExecutor**, which spawns real OS processes that each get a full CPU core.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 11</div>

```python
import math
from concurrent.futures import ProcessPoolExecutor

def is_prime(n: int) -> bool:
    """CPU-intensive primality check — pure computation, no I/O."""
    if n < 2: return False
    if n == 2: return True
    if n % 2 == 0: return False
    for i in range(3, int(math.sqrt(n)) + 1, 2):
        if n % i == 0: return False
    return True

def count_primes_in_range(start_end):
    start, end = start_end
    return sum(1 for n in range(start, end) if is_prime(n))

# Split work into chunks
ranges = [(i, i + 250_000) for i in range(0, 2_000_000, 250_000)]

print(f"Counting primes in 0..2,000,000 using {len(ranges)} chunks")

# Sequential
start = time.time()
total_seq = sum(count_primes_in_range(r) for r in ranges)
seq_time = time.time() - start
print(f"Sequential: {total_seq:,} primes in {seq_time:.2f}s")

# Parallel (ProcessPoolExecutor)
# NOTE: This code must be inside if __name__ == '__main__' in a script.
#       In Jupyter notebooks, this works fine as-is.
start = time.time()
with ProcessPoolExecutor() as executor:   # defaults to cpu_count() workers
    chunk_counts = list(executor.map(count_primes_in_range, ranges))
total_par = sum(chunk_counts)
par_time = time.time() - start
print(f"Parallel:   {total_par:,} primes in {par_time:.2f}s")
print(f"Speedup: {seq_time / par_time:.1f}x")
```

</div>

### What just happened?
We switched from threads to **processes**. Each process is a completely separate Python interpreter with its own GIL — so they truly run in parallel on multiple CPU cores.

`is_prime()` is pure computation — no sleeping, no I/O. Threads wouldn't help here because of the GIL. But with `ProcessPoolExecutor`, each chunk runs on a different core simultaneously.

The speedup depends on how many CPU cores your machine has. With 4 cores you'd expect roughly 4x speedup.

**Important note in the comment**: In a Python script, code that creates processes must be inside `if __name__ == '__main__':` — otherwise each new process would re-run the whole script creating more processes infinitely. In Jupyter notebooks this restriction doesn't apply.

---
## 3. asyncio — Single-Thread Concurrency

Threading uses OS threads — **asyncio** uses a single thread with an **event loop**.
The event loop runs coroutines, pausing them when they're waiting for I/O and running others.

**Why asyncio over threads?**
- Handles **thousands** of concurrent operations efficiently (threads have overhead per-thread)
- Explicit control — you know exactly where your code can pause (`await` points)
- Easier to reason about shared state (no race conditions — single thread)

**The vocabulary**:
- `coroutine`: a function defined with `async def` — can be paused
- `await`: pause this coroutine and give control back to the event loop
- `Task`: a scheduled coroutine running in the event loop
- `asyncio.gather()`: run multiple coroutines concurrently

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 14</div>

```python
import asyncio
import time

# async def makes this a coroutine
async def async_check_health(server: str) -> dict:
    """
    asyncio.sleep() is the async version of time.sleep().
    When we hit `await asyncio.sleep(delay)`, this coroutine PAUSES
    and the event loop runs other coroutines. When the sleep is done,
    this coroutine RESUMES.
    """
    delay = random.uniform(0.5, 1.5)
    await asyncio.sleep(delay)   # pause here, run other tasks
    healthy = random.random() > 0.2
    return {"server": server, "healthy": healthy, "latency_ms": round(delay * 1000)}

async def check_all_servers(servers: list) -> list:
    # asyncio.gather() runs all coroutines concurrently and waits for all to finish
    tasks = [async_check_health(s) for s in servers]
    return await asyncio.gather(*tasks)

# asyncio.run() is the entry point — creates the event loop, runs the coroutine
random.seed(42)
print("=== Async health checks (asyncio) ===")
start = time.time()
results = asyncio.run(check_all_servers(servers))
elapsed = time.time() - start

for r in results:
    icon = "✓" if r["healthy"] else "✗"
    print(f"  {icon} {r['server']:15s} {r['latency_ms']}ms")
print(f"Total time: {elapsed:.2f}s")
```

</div>

### What just happened?
This is your first look at `asyncio` — Python's built-in async framework.

Key vocabulary:
- `async def` — defines a **coroutine** (a function that can pause)
- `await asyncio.sleep(delay)` — pauses THIS coroutine and lets the event loop run other coroutines. Unlike `time.sleep()`, it does NOT block the whole program.
- `asyncio.gather(*tasks)` — runs multiple coroutines **concurrently** and waits for ALL of them to finish
- `asyncio.run(...)` — creates the event loop, runs your top-level coroutine, then shuts down

The event loop is like a smart scheduler: when one coroutine hits `await`, it pauses that one and runs another. Single-threaded, but still concurrent.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 16</div>

```python
# asyncio.create_task() — fire off tasks and do other work while waiting
import asyncio

async def deploy_service(name: str, duration: float) -> str:
    print(f"  [{name}] starting deploy...")
    await asyncio.sleep(duration)
    print(f"  [{name}] deploy complete!")
    return f"{name}: deployed"

async def monitor_loop(duration: float) -> None:
    """Runs alongside the deployments — this is where async shines."""
    for i in range(int(duration)):
        await asyncio.sleep(1)
        print(f"  [monitor] t={i+1}s: watching deployments...")

async def run_deployment_pipeline():
    print("Starting deployment pipeline...")
    start = time.time()

    # create_task() schedules a coroutine — it starts immediately in the background
    auth_task    = asyncio.create_task(deploy_service("auth-api",    2.0))
    user_task    = asyncio.create_task(deploy_service("user-svc",    1.5))
    payment_task = asyncio.create_task(deploy_service("payment-api", 3.0))
    monitor_task = asyncio.create_task(monitor_loop(3.5))

    # Await them — they've been running concurrently since create_task()
    results = await asyncio.gather(auth_task, user_task, payment_task)
    monitor_task.cancel()   # stop monitoring

    print(f"\nAll done in {time.time() - start:.2f}s")
    for r in results:
        print(f"  {r}")

asyncio.run(run_deployment_pipeline())
```

</div>

### What just happened?
`asyncio.create_task()` is different from just calling a coroutine — it **schedules** the coroutine to start running immediately in the background.

Without `create_task()`, coroutines only run when you `await` them (one at a time). With `create_task()`, they all start running right away and run concurrently.

Notice the output — all three deploys start almost simultaneously, and the monitor loop prints tick messages *between* deploy completions. That's real concurrency on a single thread.

`monitor_task.cancel()` stops the background monitor once the deploys are done — important to clean up tasks you no longer need.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 18</div>

```python
# Handling errors in asyncio.gather()
import asyncio

async def risky_task(name: str, fail: bool) -> str:
    await asyncio.sleep(0.1)
    if fail:
        raise ValueError(f"{name} failed during deployment")
    return f"{name}: success"

async def safe_gather_demo():
    tasks = [
        risky_task("auth-api",     fail=False),
        risky_task("user-svc",     fail=True),   # this one fails
        risky_task("payment-api",  fail=False),
        risky_task("feature-flag", fail=True),   # this one too
    ]

    # return_exceptions=True: exceptions become results instead of propagating
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for name, result in zip(["auth-api", "user-svc", "payment-api", "feature-flag"], results):
        if isinstance(result, Exception):
            print(f"  FAILED  {name}: {result}")
        else:
            print(f"  OK      {name}: {result}")

asyncio.run(safe_gather_demo())
```

</div>

### What just happened?
By default, if any coroutine in `asyncio.gather()` raises an exception, the whole gather fails immediately and other results are lost.

`return_exceptions=True` changes this: exceptions become **regular return values** instead of propagating. So you get back a list where some items are results and some are `Exception` objects.

We check `isinstance(result, Exception)` to tell them apart. This is the safe pattern for production code where you expect some tasks might fail (network errors, timeouts, etc.) and you want to handle each failure individually rather than losing all results.

---
## 4. Real-World: Async HTTP with httpx

The most common async use case: making many HTTP requests in parallel.
`httpx` is the modern async HTTP library (like `requests`, but async-capable).

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 21</div>

```python
# Install: pip install httpx
# We'll simulate the HTTP calls since we might not have internet in this notebook
import asyncio, time, random
from typing import List, Dict, Any

# ── Simulated async HTTP client ────────────────────────────────────────────
class AsyncHTTPClient:
    """Simulates httpx.AsyncClient for this demo.
    In real code, replace this with:

        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
    """
    async def get(self, url: str) -> Dict[str, Any]:
        await asyncio.sleep(random.uniform(0.1, 0.5))   # simulate network
        if random.random() < 0.1:
            raise ConnectionError(f"Request to {url} failed")
        return {
            "url": url,
            "status": 200,
            "body": {"data": f"response from {url.split('/')[-1]}"},
        }

# ── Real async API poller ──────────────────────────────────────────────────
async def fetch_with_retry(client, url: str, retries: int = 3) -> Dict[str, Any]:
    for attempt in range(1, retries + 1):
        try:
            return await client.get(url)
        except ConnectionError as e:
            print(f"    Retry {attempt}/{retries} for {url}: {e}")
            if attempt == retries:
                return {"url": url, "status": 0, "error": str(e)}
            await asyncio.sleep(0.1 * attempt)   # exponential back-off

async def poll_all_endpoints(endpoints: List[str]) -> List[Dict[str, Any]]:
    results = []
    async with AsyncHTTPClient() as client:   # using as context manager
        tasks = [fetch_with_retry(client, ep) for ep in endpoints]
        results = await asyncio.gather(*tasks)
    return results

# Make AsyncHTTPClient a proper async context manager
class AsyncHTTPClient:
    async def __aenter__(self): return self
    async def __aexit__(self, *_): pass

    async def get(self, url: str) -> Dict[str, Any]:
        await asyncio.sleep(random.uniform(0.05, 0.3))
        if random.random() < 0.08:
            raise ConnectionError(f"Timeout: {url}")
        return {"url": url, "status": 200, "data": url.split("/")[-1]}

# Run it
endpoints = [
    "https://api.example.com/services/auth",
    "https://api.example.com/services/users",
    "https://api.example.com/services/payments",
    "https://api.example.com/services/notifications",
    "https://api.example.com/services/analytics",
    "https://api.example.com/metrics/cpu",
    "https://api.example.com/metrics/memory",
    "https://api.example.com/metrics/disk",
]

random.seed(123)
print(f"Polling {len(endpoints)} endpoints concurrently...")
start = time.time()
results = asyncio.run(poll_all_endpoints(endpoints))
elapsed = time.time() - start

ok = [r for r in results if r.get("status") == 200]
failed = [r for r in results if r.get("status") != 200]
print(f"Done in {elapsed:.2f}s | OK: {len(ok)} | Failed: {len(failed)}")
for r in results:
    status = r.get("status", "ERR")
    icon = "✓" if status == 200 else "✗"
    print(f"  {icon} {r['url'].split('/')[-1]:20s} HTTP {status}")
```

</div>

### What just happened?
This simulates what you'd do with the real `httpx` library (which we covered in Chapter 3).

The `AsyncHTTPClient` uses `async with` — an **async context manager** (just like regular `with`, but for async code). The `__aenter__` and `__aexit__` methods are the async versions of `__enter__` and `__exit__`.

`fetch_with_retry()` combines two async patterns:
1. **Retry loop**: try up to 3 times before giving up
2. **Exponential back-off**: `await asyncio.sleep(0.1 * attempt)` — wait a bit longer each retry

The key insight: all 8 endpoints are fetched **at the same time**. In real code with `httpx.AsyncClient`, this means 8 real HTTP requests fly out simultaneously.

---
## 5. Real-World: Parallel File Processor

Another common pattern: process a large number of files in parallel.
CPU-bound (parsing) → ProcessPoolExecutor. I/O-bound (reading) → ThreadPoolExecutor.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 24</div>

```python
import os, json, tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# ── Create sample log files ────────────────────────────────────────────────
def create_sample_logs(directory: str, count: int) -> List[Path]:
    """Generate fake application log files for our demo."""
    paths = []
    for i in range(count):
        path = Path(directory) / f"service_{i:03d}.log"
        lines = []
        for j in range(random.randint(50, 200)):
            level = random.choice(["INFO", "INFO", "INFO", "WARN", "ERROR"])
            msg = random.choice([
                "Request processed successfully",
                "Cache miss, fetching from DB",
                "High memory usage detected",
                "Connection timeout",
                "Retrying failed request",
            ])
            lines.append(f"2025-01-15 {j:02d}:00:00 [{level}] {msg}")
        path.write_text("\n".join(lines))
        paths.append(path)
    return paths

# ── Parse a single log file (I/O-bound) ───────────────────────────────────
def parse_log_file(path: Path) -> Dict[str, Any]:
    """Count log levels and collect error messages from a log file."""
    counts = {"INFO": 0, "WARN": 0, "ERROR": 0}
    errors = []
    for line in path.read_text().splitlines():
        for level in counts:
            if f"[{level}]" in line:
                counts[level] += 1
                if level == "ERROR":
                    errors.append(line.strip())
    return {
        "file": path.name,
        "total_lines": sum(counts.values()),
        "counts": counts,
        "errors": errors[:3],  # keep first 3 errors
    }

# ── Run with ThreadPoolExecutor (reading files = I/O bound) ───────────────
random.seed(55)
with tempfile.TemporaryDirectory(prefix="logs_") as tmpdir:
    print(f"Creating 20 log files...")
    log_files = create_sample_logs(tmpdir, 20)

    # Sequential
    start = time.time()
    seq_results = [parse_log_file(p) for p in log_files]
    seq_time = time.time() - start

    # Parallel
    start = time.time()
    with ThreadPoolExecutor(max_workers=8) as ex:
        par_results = list(ex.map(parse_log_file, log_files))
    par_time = time.time() - start

    total_errors = sum(r["counts"]["ERROR"] for r in par_results)
    total_lines  = sum(r["total_lines"] for r in par_results)
    print(f"Processed {len(log_files)} files, {total_lines:,} lines, {total_errors} errors")
    print(f"Sequential: {seq_time:.3f}s  |  Parallel: {par_time:.3f}s")

    # Show files with errors
    files_with_errors = [r for r in par_results if r["counts"]["ERROR"] > 0]
    print(f"\n{len(files_with_errors)} files had errors:")
    for r in sorted(files_with_errors, key=lambda x: x['counts']['ERROR'], reverse=True)[:5]:
        print(f"  {r['file']}: {r['counts']['ERROR']} errors")
```

</div>

### What just happened?
We created 20 fake log files and parsed them in parallel using `ThreadPoolExecutor`.

File reading is **I/O-bound** (disk reads, not CPU work), so threads are the right tool here — not processes.

The comparison between sequential and parallel times shows the speedup from using 8 worker threads. Even for disk I/O, parallelism helps because the OS can service multiple read requests simultaneously.

`executor.map(parse_log_file, log_files)` is clean here because we want results in the same order as the input files — easier to match back to filenames.

---
## 6. Mixing Sync and Async — Common Patterns

Sometimes you have sync code that needs to call async code, or async code that needs to
call a blocking sync function. Here's how to handle both.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 27</div>

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

# ── Run sync blocking function from async code ────────────────────────────
# Problem: time.sleep() blocks the event loop — everything stops!
# Solution: run_in_executor() runs it in a thread, event loop stays free

def slow_sync_db_query(query: str) -> dict:
    """Simulates a synchronous, blocking database call."""
    time.sleep(0.2)   # blocks!
    return {"query": query, "rows": random.randint(1, 100)}

async def run_queries_concurrently(queries: List[str]) -> List[dict]:
    loop = asyncio.get_event_loop()
    # run_in_executor() delegates the blocking call to a thread pool
    # The event loop is free to run other things while the thread waits
    tasks = [
        loop.run_in_executor(None, slow_sync_db_query, q)
        for q in queries
    ]
    return await asyncio.gather(*tasks)

queries = [
    "SELECT * FROM deployments WHERE status='pending'",
    "SELECT * FROM services WHERE healthy=false",
    "SELECT * FROM metrics WHERE timestamp > NOW() - INTERVAL '1h'",
]

start = time.time()
results = asyncio.run(run_queries_concurrently(queries))
elapsed = time.time() - start
print(f"3 DB queries (each 0.2s) ran concurrently in {elapsed:.2f}s")
for r in results:
    print(f"  {r['query'][:50]:50s} -> {r['rows']} rows")
```

</div>

### What just happened?
`loop.run_in_executor(None, slow_sync_db_query, q)` is the bridge between sync and async worlds.

The problem: `time.sleep()` (and any blocking sync function) **blocks the event loop** — no other coroutines can run while it's sleeping.

The solution: `run_in_executor()` runs the blocking function in a **thread pool** behind the scenes, freeing the event loop to do other work. From the async code's perspective, it looks like a regular `await`.

`None` means "use the default thread pool executor". You can pass a custom `ThreadPoolExecutor` if you want to control the thread count.

Result: 3 queries that each take 0.2s run in ~0.2s total instead of ~0.6s.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 29</div>

```python
# ── Timeout with asyncio.wait_for() ──────────────────────────────────────
import asyncio

async def slow_operation(name: str, duration: float) -> str:
    await asyncio.sleep(duration)
    return f"{name} completed"

async def with_timeout_demo():
    print("Operations with 1-second timeout:")

    operations = [
        ("fast-task",   0.3),
        ("medium-task", 0.8),
        ("slow-task",   2.0),   # This will timeout
    ]

    for name, duration in operations:
        try:
            result = await asyncio.wait_for(
                slow_operation(name, duration),
                timeout=1.0
            )
            print(f"  OK      {result}")
        except asyncio.TimeoutError:
            print(f"  TIMEOUT {name} (took > 1.0s)")

asyncio.run(with_timeout_demo())
```

</div>

### What just happened?
`asyncio.wait_for(coroutine, timeout=1.0)` adds a **deadline** to any async operation.

If the coroutine finishes before the timeout → returns the result normally.
If the timeout expires → cancels the coroutine and raises `asyncio.TimeoutError`.

This is critical for production code. Without timeouts:
- A stuck network request could hang your service forever
- A slow database query could block a request indefinitely

Always set timeouts on external calls. The pattern `try/except asyncio.TimeoutError` lets you handle slow operations gracefully.

---
## Summary — When to Use What

```
Task is CPU-heavy (calculations, parsing, compression)?
  └─ ProcessPoolExecutor

Task is I/O-bound (network, files, databases)?
  ├─ Many concurrent tasks, need efficiency? → asyncio + await
  └─ Simpler code OK, or calling sync libraries? → ThreadPoolExecutor
```

| | Threading | Multiprocessing | Asyncio |
|--|-----------|-----------------|---------|
| **Real parallelism** | No (GIL) | Yes | No (single thread) |
| **Best for** | I/O-bound | CPU-bound | High-concurrency I/O |
| **Overhead per task** | Medium | High (process spawn) | Very low |
| **Shared state** | Tricky (locks) | Hard (separate memory) | Easy (single thread) |
| **Code complexity** | Low | Low | Medium |

## Key Functions Cheat Sheet

```python
# Threading (I/O-bound)
from concurrent.futures import ThreadPoolExecutor, as_completed
with ThreadPoolExecutor(max_workers=10) as ex:
    futures = {ex.submit(fn, arg): arg for arg in items}
    for f in as_completed(futures):
        result = f.result()

# Multiprocessing (CPU-bound)
from concurrent.futures import ProcessPoolExecutor
with ProcessPoolExecutor() as ex:
    results = list(ex.map(cpu_fn, items))

# Async (many concurrent I/O)
import asyncio
async def main():
    results = await asyncio.gather(*[async_fn(x) for x in items])
asyncio.run(main())
```

## Next Chapter
**Chapter 3: Real-World HTTP & APIs** — building robust API clients with `requests` and `httpx`,
error handling, retries, authentication, and consuming public APIs.

---
## Add-on: Bounded Concurrency and Backpressure

One of the most useful real-world lessons is this:

**concurrency is not the same as "spawn everything at once".**

In production systems, you often need limits:
- to avoid exhausting file descriptors
- to avoid hammering an API
- to avoid overloading a database
- to keep memory growth under control

That is where semaphores and queues become very practical.

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 33</div>

```python
import asyncio
import random
import time

async def bounded_health_check(server: str, semaphore: asyncio.Semaphore) -> dict:
    async with semaphore:
        started = time.time()
        await asyncio.sleep(random.uniform(0.1, 0.4))
        return {
            'server': server,
            'healthy': random.random() > 0.15,
            'elapsed_ms': round((time.time() - started) * 1000),
        }

async def run_bounded_demo(servers: list[str], limit: int) -> list[dict]:
    semaphore = asyncio.Semaphore(limit)
    tasks = [bounded_health_check(server, semaphore) for server in servers]
    return await asyncio.gather(*tasks)

servers = [f'svc-{i:02d}' for i in range(1, 11)]
random.seed(11)
start = time.time()
results = asyncio.run(run_bounded_demo(servers, limit=3))
print(f'Checked {len(results)} servers with concurrency limit=3 in {time.time() - start:.2f}s')
for item in results[:5]:
    print(item)
```

</div>

<div className="notebook-cell notebook-cell--code">
<div className="notebook-cell__label notebook-cell__label--code">Code Example 34</div>

```python
from queue import Queue
from threading import Thread

work_queue: Queue[str] = Queue()
results: list[str] = []

for job in ['build-image', 'run-tests', 'scan-image', 'push-image', 'deploy-staging']:
    work_queue.put(job)


def worker(worker_id: int) -> None:
    while not work_queue.empty():
        try:
            job = work_queue.get_nowait()
        except Exception:
            return
        time.sleep(0.1)
        results.append(f'worker-{worker_id} finished {job}')
        work_queue.task_done()

threads = [Thread(target=worker, args=(i,)) for i in range(1, 3)]
for thread in threads:
    thread.start()
for thread in threads:
    thread.join()

for line in results:
    print(line)
```

</div>

### Why this add-on matters

Interviewers often ask about threads vs async, but strong answers usually mention **control**, not only speed.

Useful phrases to remember:
- "I use a semaphore when I need to cap fan-out."
- "A queue helps decouple producers from workers."
- "Concurrency without limits can become a reliability problem."

That is the kind of answer that sounds operationally mature.

---
## Practice Questions

---

### Question 1 — Threading

You have a list of 10 URLs to check (use `time.sleep(random.uniform(0.2, 0.8))` to simulate each check).

Write a function `check_all_urls(urls: list) -> dict` that:
- Uses `ThreadPoolExecutor` to check all URLs concurrently
- Returns a dict like `{"https://example.com": "ok", "https://slow.com": "timeout"}`
- Marks a URL as `"timeout"` if its simulated check takes longer than 0.5s (hint: use `future.result(timeout=0.5)` — it raises `TimeoutError`)
- Prints total time taken

Compare the time against doing it sequentially.

---

### Question 2 — Async/Await

Write an async function `deploy_with_health_check(service: str, deploy_time: float) -> dict` that:
1. Prints `"Deploying {service}..."`
2. Waits `deploy_time` seconds (use `asyncio.sleep`)
3. Prints `"Running health check for {service}..."`
4. Waits 0.2 seconds
5. Returns `{"service": service, "status": "healthy"}`

Then write an async `main()` that deploys these three services **concurrently** using `asyncio.gather`:
- `auth-api` (deploy time 1.5s)
- `user-svc` (deploy time 0.8s)
- `payment-api` (deploy time 2.0s)

Print all results and the total time. The whole thing should take ~2 seconds, not ~4.5 seconds.
