---
title: "Coding and Algorithms — Nebius Interview Prep"
sidebar_position: 5
---

# Coding and Algorithms — Nebius Interview Prep

> Nebius's coding stage is Stage 2: 2 LeetCode-style problems (Easy to Medium) + practical SRE automation tasks. The bar is clean code, not trick solutions. Python is the preferred language for most SRE candidates.

---

## Mental Model

Nebius is not a FAANG algorithms shop. They test coding because:
1. SREs write real code (automation tools, health checkers, data processors)
2. They want to see how you think and structure code under observation
3. They want to confirm you can handle basic data structures without fumbling

**What wins:** Clean, readable code with proper error handling and correct complexity analysis.
**What loses:** Over-engineering, syntax errors, or not talking through your approach.

---

## Part 1: SRE Automation — Python Scripts You Must Be Able to Write

These are the practical coding tasks that show up in Stage 1 and Stage 2.

### Script 1: HTTP Health Checker with Retry and Backoff

```python
#!/usr/bin/env python3
"""
HTTP health checker with exponential backoff and structured output.
Nebius-relevant: health checking API endpoints, service availability probing.
"""
import argparse
import json
import logging
import random
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)

@dataclass
class HealthResult:
    url: str
    status_code: Optional[int]
    latency_ms: float
    healthy: bool
    error: Optional[str] = None

def probe_url(url: str, timeout_s: float = 5.0) -> HealthResult:
    """Single HTTP probe attempt."""
    start = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=timeout_s) as resp:
            latency_ms = (time.monotonic() - start) * 1000
            healthy = 200 <= resp.status < 400
            return HealthResult(
                url=url,
                status_code=resp.status,
                latency_ms=latency_ms,
                healthy=healthy
            )
    except urllib.error.HTTPError as e:
        latency_ms = (time.monotonic() - start) * 1000
        return HealthResult(url=url, status_code=e.code,
                           latency_ms=latency_ms, healthy=False,
                           error=str(e))
    except Exception as e:
        latency_ms = (time.monotonic() - start) * 1000
        return HealthResult(url=url, status_code=None,
                           latency_ms=latency_ms, healthy=False,
                           error=str(e))

def check_with_retry(url: str, retries: int = 3,
                     base_delay_s: float = 1.0,
                     max_delay_s: float = 30.0,
                     timeout_s: float = 5.0) -> HealthResult:
    """Probe with exponential backoff + jitter."""
    last_result = None
    for attempt in range(retries + 1):
        result = probe_url(url, timeout_s)
        if result.healthy:
            return result
        last_result = result
        if attempt < retries:
            # Exponential backoff with full jitter
            delay = min(base_delay_s * (2 ** attempt), max_delay_s)
            jitter = random.uniform(0, delay)
            logging.warning(
                "Attempt %d/%d failed for %s (error=%s). Retrying in %.1fs",
                attempt + 1, retries + 1, url, result.error, jitter
            )
            time.sleep(jitter)
    return last_result

def main() -> int:
    parser = argparse.ArgumentParser(description="HTTP health checker")
    parser.add_argument("urls", nargs="+", help="URLs to check")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    results = []
    all_healthy = True

    for url in args.urls:
        result = check_with_retry(url, retries=args.retries,
                                  timeout_s=args.timeout)
        results.append(result)
        if not result.healthy:
            all_healthy = False
        if args.json:
            print(json.dumps({
                "url": result.url,
                "status": result.status_code,
                "latency_ms": round(result.latency_ms, 2),
                "healthy": result.healthy,
                "error": result.error
            }))
        else:
            status = "OK" if result.healthy else "FAIL"
            print(f"[{status}] {url} — {result.status_code} — {result.latency_ms:.1f}ms")

    return 0 if all_healthy else 1

if __name__ == "__main__":
    sys.exit(main())
```

**Key patterns to explain in interview:**
- `time.monotonic()` — not `time.time()`. Monotonic clock is not affected by system clock adjustments (NTP, leap seconds). Always use for latency measurement.
- Full jitter in backoff: `random.uniform(0, delay)` — distributes retry load across multiple clients. Without jitter, all clients retry at the same time and create thundering herd.
- `@dataclass` — clean result container without boilerplate `__init__`. Shows modern Python knowledge.
- Exit code 1 on failure — scripts are composable. CI/CD and monitoring systems rely on exit codes.

---

### Script 2: JSON Log Analyzer

```python
#!/usr/bin/env python3
"""
Analyze newline-delimited JSON logs.
Nebius-relevant: analyzing training logs, inference request logs, health check logs.
"""
import argparse
import collections
import json
import sys
from pathlib import Path
from typing import Iterator

def parse_log_lines(source) -> Iterator[dict]:
    """Yield parsed log entries, skip malformed lines."""
    for i, line in enumerate(source, 1):
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError as e:
            # Log but don't crash — partial log files are common
            print(f"Warning: line {i} is not valid JSON: {e}", file=sys.stderr)

def analyze_logs(entries: Iterator[dict]) -> dict:
    """Compute summary statistics from log entries."""
    error_counts = collections.Counter()
    level_counts = collections.Counter()
    latency_values = []
    total = 0

    for entry in entries:
        total += 1
        level = entry.get("level", entry.get("severity", "unknown")).upper()
        level_counts[level] += 1

        # Count errors by type
        if level in ("ERROR", "CRITICAL", "FATAL"):
            error_type = entry.get("error_type",
                                   entry.get("exception",
                                   entry.get("msg", "unknown")))
            # Truncate long messages for grouping
            error_key = str(error_type)[:80]
            error_counts[error_key] += 1

        # Collect latency if present
        for lat_key in ("latency_ms", "duration_ms", "response_time_ms"):
            if lat_key in entry:
                try:
                    latency_values.append(float(entry[lat_key]))
                except (ValueError, TypeError):
                    pass
                break

    result = {
        "total_lines": total,
        "by_level": dict(level_counts.most_common()),
        "top_errors": dict(error_counts.most_common(10)),
    }

    if latency_values:
        latency_values.sort()
        n = len(latency_values)
        result["latency"] = {
            "count": n,
            "p50_ms": round(latency_values[n // 2], 2),
            "p95_ms": round(latency_values[int(n * 0.95)], 2),
            "p99_ms": round(latency_values[int(n * 0.99)], 2),
            "max_ms": round(latency_values[-1], 2),
        }

    return result

def main() -> int:
    parser = argparse.ArgumentParser(description="JSON log analyzer")
    parser.add_argument("logfile", nargs="?", help="Log file (default: stdin)")
    args = parser.parse_args()

    if args.logfile:
        source = Path(args.logfile).open()
    else:
        source = sys.stdin

    with source if hasattr(source, '__enter__') else open(args.logfile) as f:
        entries = parse_log_lines(f)
        summary = analyze_logs(entries)

    print(json.dumps(summary, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**Key patterns:**
- Generator (`yield`) — processes huge log files without loading all into memory
- `collections.Counter` — for frequency counting, has `.most_common(n)` built in
- Graceful handling of malformed lines — real log files are always slightly broken
- Works with both file and stdin — composable with `cat`, `kubectl logs`, `docker logs`

---

### Script 3: Kubernetes Pod Resource Reporter

```python
#!/usr/bin/env python3
"""
Report GPU and CPU resource usage per namespace.
Nebius-relevant: GPU quota monitoring, cost attribution, capacity planning.
"""
import json
import subprocess
import sys
from collections import defaultdict

def kubectl(*args) -> dict:
    """Run kubectl and return parsed JSON output."""
    cmd = ["kubectl"] + list(args) + ["-o", "json"]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)

def parse_resource(value: str) -> float:
    """Convert Kubernetes resource string to float (CPU=cores, memory=bytes, GPU=count)."""
    if not value:
        return 0.0
    # CPU: "100m" = 0.1 cores, "2" = 2 cores
    if value.endswith("m"):
        return float(value[:-1]) / 1000
    # Memory: "128Mi", "2Gi", "1Ti"
    suffixes = {"Ki": 2**10, "Mi": 2**20, "Gi": 2**30, "Ti": 2**40,
                "K": 1000, "M": 10**6, "G": 10**9, "T": 10**12}
    for suffix, multiplier in suffixes.items():
        if value.endswith(suffix):
            return float(value[:-len(suffix)]) * multiplier
    return float(value)

def get_pod_resources() -> dict:
    """Aggregate resource requests by namespace."""
    pods_data = kubectl("get", "pods", "--all-namespaces")
    by_namespace = defaultdict(lambda: defaultdict(float))

    for pod in pods_data.get("items", []):
        ns = pod["metadata"]["namespace"]
        phase = pod.get("status", {}).get("phase", "")
        if phase not in ("Running", "Pending"):
            continue

        for container in pod.get("spec", {}).get("containers", []):
            requests = container.get("resources", {}).get("requests", {})
            by_namespace[ns]["cpu"] += parse_resource(requests.get("cpu", "0"))
            by_namespace[ns]["memory_gb"] += parse_resource(
                requests.get("memory", "0")) / 2**30
            by_namespace[ns]["gpus"] += parse_resource(
                requests.get("nvidia.com/gpu", "0"))

    return dict(by_namespace)

def main() -> int:
    try:
        resources = get_pod_resources()
    except subprocess.CalledProcessError as e:
        print(f"kubectl error: {e.stderr}", file=sys.stderr)
        return 1

    if not resources:
        print("No resources found.")
        return 0

    # Print table
    print(f"{'NAMESPACE':<30} {'CPU':>8} {'MEMORY(GB)':>12} {'GPUS':>6}")
    print("-" * 60)

    total = defaultdict(float)
    for ns in sorted(resources):
        r = resources[ns]
        print(f"{ns:<30} {r['cpu']:>8.2f} {r['memory_gb']:>12.1f} {r['gpus']:>6.0f}")
        for k, v in r.items():
            total[k] += v

    print("-" * 60)
    print(f"{'TOTAL':<30} {total['cpu']:>8.2f} {total['memory_gb']:>12.1f} {total['gpus']:>6.0f}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

---

### Script 4: Retry Decorator (Common Interview Pattern)

```python
import functools
import logging
import random
import time
from typing import Callable, Tuple, Type

def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    jitter: bool = True
):
    """
    Decorator for retrying a function with exponential backoff.
    
    Usage:
        @retry(max_attempts=5, exceptions=(IOError, TimeoutError))
        def call_api():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt == max_attempts - 1:
                        break
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    if jitter:
                        delay = random.uniform(0, delay)
                    logging.warning(
                        "%s: attempt %d/%d failed (%s). Retrying in %.1fs",
                        func.__name__, attempt + 1, max_attempts, e, delay
                    )
                    time.sleep(delay)
            raise last_exc
        return wrapper
    return decorator

# Example usage
@retry(max_attempts=4, base_delay=2.0, exceptions=(ConnectionError, TimeoutError))
def fetch_model_weights(model_id: str) -> bytes:
    """Fetch model weights from object storage."""
    # ... implementation
    pass
```

---

## Part 2: Algorithms — What Nebius Actually Tests

Confirmed from real candidate reports. These are Easy to Medium LeetCode problems. Focus on clean implementation, not memorized solutions.

### Pattern 1: Dynamic Programming

**Pascal's Triangle (LeetCode 118 — Easy)**
```python
def generate(numRows: int) -> list[list[int]]:
    """
    Generate first numRows of Pascal's Triangle.
    Each element = sum of two elements above it.
    
    Time: O(n²)  Space: O(n²)
    """
    if numRows == 0:
        return []
    
    triangle = [[1]]
    
    for row_idx in range(1, numRows):
        prev = triangle[row_idx - 1]
        # First and last element are always 1
        row = [1]
        # Middle elements = sum of two above
        for j in range(1, row_idx):
            row.append(prev[j-1] + prev[j])
        row.append(1)
        triangle.append(row)
    
    return triangle

# Test
assert generate(5) == [[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]
```

**Minimum Path Sum (LeetCode 64 — Medium)**
```python
def minPathSum(grid: list[list[int]]) -> int:
    """
    Find path from top-left to bottom-right with minimum sum.
    Can only move right or down.
    
    Key insight: dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + grid[i][j]
    Optimize space: modify grid in-place.
    
    Time: O(m*n)  Space: O(1) with in-place modification
    """
    m, n = len(grid), len(grid[0])
    
    # First row: can only come from left
    for j in range(1, n):
        grid[0][j] += grid[0][j-1]
    
    # First column: can only come from above
    for i in range(1, m):
        grid[i][0] += grid[i-1][0]
    
    # Fill rest: take minimum of above and left
    for i in range(1, m):
        for j in range(1, n):
            grid[i][j] += min(grid[i-1][j], grid[i][j-1])
    
    return grid[m-1][n-1]
```

**Interview tip for DP:** Always state the recurrence relation first: "dp[i][j] represents X, and it equals Y because Z." This shows you understand the problem, not just the code.

---

### Pattern 2: Hash Maps

**Isomorphic Strings (LeetCode 205 — Easy)**
```python
def isIsomorphic(s: str, t: str) -> bool:
    """
    Two strings are isomorphic if characters can be replaced consistently.
    'egg' and 'add' are isomorphic: e→a, g→d
    'foo' and 'bar' are not: o maps to both 'a' and 'r'
    
    Key: bidirectional mapping required (s→t and t→s)
    
    Time: O(n)  Space: O(1) — bounded by character set size (256)
    """
    s_to_t = {}
    t_to_s = {}
    
    for cs, ct in zip(s, t):
        if cs in s_to_t:
            if s_to_t[cs] != ct:
                return False  # s char mapped to different t char
        else:
            s_to_t[cs] = ct
        
        if ct in t_to_s:
            if t_to_s[ct] != cs:
                return False  # t char mapped to different s char
        else:
            t_to_s[ct] = cs
    
    return True

# Test cases
assert isIsomorphic("egg", "add") == True
assert isIsomorphic("foo", "bar") == False
assert isIsomorphic("paper", "title") == True
```

---

### Pattern 3: Greedy + Sorting

**Maximum Units on a Truck (LeetCode 1710 — Easy)**
```python
def maximumUnits(boxTypes: list[list[int]], truckSize: int) -> int:
    """
    boxTypes[i] = [numberOfBoxes, numberOfUnitsPerBox]
    Maximize units loaded on truck of given size.
    
    Greedy: always load the box type with most units per box first.
    
    Time: O(n log n) for sort  Space: O(1)
    """
    # Sort by units per box, descending
    boxTypes.sort(key=lambda x: x[1], reverse=True)
    
    total_units = 0
    remaining_capacity = truckSize
    
    for num_boxes, units_per_box in boxTypes:
        if remaining_capacity <= 0:
            break
        # Take as many of this box type as possible
        boxes_taken = min(num_boxes, remaining_capacity)
        total_units += boxes_taken * units_per_box
        remaining_capacity -= boxes_taken
    
    return total_units

# Test
assert maximumUnits([[1,3],[2,2],[3,1]], 4) == 8  # take 1×3 + 2×2 + 1×1
assert maximumUnits([[5,10],[2,5],[4,7],[3,9]], 10) == 91
```

---

### Pattern 4: String Manipulation

**Custom Sort String (LeetCode 791 — Medium)**
```python
def customSortString(order: str, s: str) -> str:
    """
    Sort s such that characters appear in the order specified by 'order'.
    Characters not in order can appear in any position.
    
    Approach: count chars in s, rebuild in order's sequence.
    
    Time: O(n + k) where k=len(order)  Space: O(n)
    """
    # Count characters in s
    count = collections.Counter(s)
    
    result = []
    # First: characters in order, in order
    for c in order:
        result.append(c * count.pop(c, 0))
    
    # Then: remaining characters (not in order)
    for c, cnt in count.items():
        result.append(c * cnt)
    
    return "".join(result)

import collections
# Test
assert customSortString("cba", "abcd") in ["cbad", "cbda"]  # c before b before a, d anywhere
```

---

## Part 3: How to Perform in a Live Coding Interview

### Before Writing Code
1. Repeat the problem back: "So I need to X, given Y, and return Z?"
2. Clarify edge cases: "What if the input is empty? Can values be negative?"
3. State your approach: "I'll use a hash map for O(1) lookup. The time complexity will be O(n)."
4. Only then code

### While Coding
- Talk through what you're doing: "I'm sorting here because I want to greedily pick the highest-value boxes first."
- If you get stuck: "I'm going to stub this function and come back to it."
- Test with the example first: run through the example by hand before submitting

### When Done
- Test with edge cases: empty input, single element, all same value
- State complexity: "Time is O(n log n) for the sort, space is O(n) for the result."
- Ask: "Should I optimize for space? I could do this in O(1) with an in-place approach."

### Common Mistakes to Avoid
- Not handling empty input
- Off-by-one in array indexing
- Assuming int when float is possible
- Mutating input without flagging it
- Not discussing complexity at the end

---

## Part 4: Python for SRE — Patterns You Must Know

### subprocess — Running Shell Commands Safely
```python
import subprocess

# SAFE: list form prevents shell injection
result = subprocess.run(
    ["kubectl", "get", "pods", "-n", namespace],
    capture_output=True,
    text=True,
    check=True          # raises CalledProcessError on non-zero exit
)
print(result.stdout)

# UNSAFE: never use shell=True with user input
# subprocess.run(f"kubectl get pods -n {namespace}", shell=True)  # injection risk!

# Capture both stdout and stderr
result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
if result.returncode != 0:
    logging.error("Command failed: %s", result.stderr.decode())
```

### pathlib — Modern File Operations
```python
from pathlib import Path

# Create directory tree
checkpoint_dir = Path("/checkpoints") / "job-123" / "step-1000"
checkpoint_dir.mkdir(parents=True, exist_ok=True)

# Iterate files matching pattern
for log_file in Path("/var/log").glob("**/*.log"):
    print(log_file)

# Read / write safely
config = Path("/etc/myapp/config.json").read_text()
Path("/tmp/output.json").write_text(json.dumps(data))

# Check existence without exception
if not (checkpoint_dir / "model.pt").exists():
    raise FileNotFoundError(f"Checkpoint not found: {checkpoint_dir}")
```

### context managers — Resource Safety
```python
# Always use context managers for file I/O
with open("/path/to/file") as f:
    data = f.read()

# Custom context manager for temporary resources
from contextlib import contextmanager

@contextmanager
def temp_gpu_allocation(gpu_id: int):
    """Allocate GPU and ensure cleanup on exit."""
    allocate_gpu(gpu_id)
    try:
        yield gpu_id
    finally:
        release_gpu(gpu_id)  # always runs, even on exception

with temp_gpu_allocation(0) as gpu:
    run_inference(gpu)
```

### argparse — CLI Tools
```python
import argparse

def parse_args():
    parser = argparse.ArgumentParser(
        description="GPU cluster health checker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --nodes 10 --threshold 0.95
  %(prog)s --dry-run --verbose
"""
    )
    parser.add_argument("--nodes", type=int, default=10,
                       help="Number of nodes to check (default: 10)")
    parser.add_argument("--threshold", type=float, default=0.95,
                       help="Health threshold 0.0-1.0 (default: 0.95)")
    parser.add_argument("--dry-run", action="store_true",
                       help="Check without making changes")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()
```

---

## Points to Remember

- `time.monotonic()` for latency measurement, not `time.time()`
- Full jitter backoff prevents thundering herd
- Generators (`yield`) for large file processing — don't load everything into memory
- `subprocess.run()` with list args (not shell=True) to avoid injection
- `collections.Counter` and `collections.defaultdict` — interview favorites
- State your approach before coding, complexity at the end
- Edge cases: empty input, single element, duplicates, negative numbers
- Exit code 1 on failure — scripts must be composable

## What to Study Next

- [06-stress-interview-incident-response.md](/docs/nebius/stress-interview-incident-response) — apply coding skills to live incident debugging
- LeetCode practice: Pascal's Triangle, Minimum Path Sum, Maximum Units on a Truck, Isomorphic Strings, Custom Sort String
- Python docs: `collections`, `pathlib`, `subprocess`, `argparse`, `contextlib`
