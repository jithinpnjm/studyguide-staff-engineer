# Python Lab 1: HTTP Probe Utility

## Operational Context

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

## Prerequisites

- Python 3.8+
- `requests` library (`pip install requests`) or use `urllib.request` from the standard
  library (covered in extensions)
- Basic understanding of HTTP status codes and what `ConnectionError` vs `Timeout` means

## Time Estimate

30–45 minutes for the core probe. Extensions add 30–45 minutes.

---

## Step-by-Step Build Guide

### Step 1 — Confirm the skeleton

Open `starter/http_probe.py`. It reads URLs from `sys.argv[1:]`, validates they're present,
and has a TODO. Run it:

```bash
python3 starter/http_probe.py
# → usage: http_probe.py URL [URL...]

python3 starter/http_probe.py https://httpbin.org/get
# → TODO: probe URLs and print status, latency, and size
```

### Step 2 — Make a single request with timing

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

### Step 3 — Handle failures without crashing

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

### Step 4 — Add meaningful exit codes

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

### Step 5 — Add configurable timeout as a flag

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

### Step 6 — Format output for both humans and machines

Structure your output so each line is independently useful:

```
[PASS] https://api.internal/healthz  status=200  latency=14ms   size=23B
[FAIL] https://db.internal:5432/     status=CONNECTION_ERROR     size=0B
[PASS] https://cache.internal/ping   status=200  latency=3ms    size=4B
```

The `[PASS]` / `[FAIL]` prefix makes the result scannable. The key=value fields after it
are greppable: `grep FAIL output.txt` immediately shows you the failures.

---

## Sample Output

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

## Common Mistakes and How to Debug Them

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

## Extension Challenges

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
