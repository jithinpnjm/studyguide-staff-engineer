# Python Lab 3: Kubernetes Warning Event Summary

## Operational Context

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

## Prerequisites

- Python 3.8+
- `json`, `sys`, `collections` — all standard library
- Either a real Kubernetes cluster or the sample data provided (see Step 1)
- Understanding of what a Kubernetes Event is (what `reason`, `type`, and `involvedObject` mean)

## Time Estimate

30–45 minutes for the core script. Extensions add 30–40 minutes.

---

## Background: Kubernetes Event Structure

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

## Step-by-Step Build Guide

### Step 1 — Create sample test data (if you don't have a cluster)

If you don't have a live cluster, create a test fixture file. Save this as
`/tmp/test-events.json` and pipe it in during testing:

```bash
kubectl get events -A -o json > /tmp/k8s-events.json 2>/dev/null || \
  echo "No cluster — using sample fixture"
```

For this lab, the sample fixture is assumed to represent a cluster with CrashLoopBackOff,
OOMKilling, and FailedScheduling events spread across multiple namespaces. You will generate
this as part of the extension challenge, or your instructor will provide it.

### Step 2 — Confirm the skeleton reads stdin

Open `starter/k8s_event_summary.py`. It reads all of stdin, checks it's not empty, and
parses it as JSON. Run it:

```bash
echo '{"kind":"EventList","items":[]}' | python3 starter/k8s_event_summary.py
# → TODO: summarize warning events from 0 items
```

The skeleton already handles empty stdin. Your job is to replace the TODO with real logic.

### Step 3 — Filter to Warning events only

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

### Step 4 — Count by reason

```python
from collections import Counter

def reason_summary(warnings: list) -> None:
    counts = Counter(w.get("reason", "Unknown") for w in warnings)
    print("\n=== Warning Events by Reason ===")
    for reason, count in counts.most_common(10):
        print(f"  {reason:<30} {count}")
```

### Step 5 — Count by namespace

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

### Step 6 — Show the most impactful events

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

### Step 7 — Wire everything together

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

## Sample Output

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

## Common Mistakes and How to Debug Them

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

## How This Helps in a Real Cluster Incident

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

## Extension Challenges

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
