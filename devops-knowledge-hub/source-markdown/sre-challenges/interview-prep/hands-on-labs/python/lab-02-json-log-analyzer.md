# Python Lab 2: JSON Log Analyzer

## Operational Context

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

## Prerequisites

- Python 3.8+
- `json` module (standard library — no install needed)
- `collections.Counter` (standard library)
- Sample data: `../shared/data/sample-json-logs.ndjson`

## Time Estimate

30–40 minutes for the core analyzer. Extensions add 30 minutes.

---

## Step-by-Step Build Guide

### Step 1 — Understand the data format

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

### Step 2 — Read the file and print raw lines first

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

### Step 3 — Add JSON parsing with per-line error handling

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

### Step 4 — Count errors by error_type

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

### Step 5 — Count errors by service

```python
def service_summary(records: list[dict]) -> None:
    counts = Counter(r.get("service", "(unknown)") for r in records if r.get("level") == "ERROR")
    print("\n=== Errors by Service ===")
    for service, count in counts.most_common():
        print(f"  {service:<20} {count} errors")
```

### Step 6 — Wire everything together

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

### Step 7 — Handle missing fields defensively

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

## Sample Output

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

## Common Mistakes and How to Debug Them

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

## Why Defensive Parsing Matters in Incident Tooling

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

## Extension Challenges

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
