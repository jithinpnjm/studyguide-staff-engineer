---
title: "Real-World Examples"
sidebar_position: 7
---

# Real-World Python SRE Examples

Eight complete, production-influenced scripts covering the scenarios SREs actually encounter: Kubernetes monitoring, alerting, log analysis, metric publishing, config drift detection, secret management, parallel fleet operations, and canary validation.

---

## 1. Kubernetes Warning Event Monitor

Reads `kubectl get events` JSON and surfaces the Warning events that matter during an incident.

```python
#!/usr/bin/env python3
"""
k8s_event_monitor.py — summarize Kubernetes Warning events
Usage: kubectl get events -A -o json | python3 k8s_event_monitor.py
"""
import json
import sys
from collections import Counter


def get_namespace(event: dict) -> str:
    return (
        event.get("metadata", {}).get("namespace")
        or event.get("involvedObject", {}).get("namespace")
        or "(cluster-scoped)"
    )


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("usage: kubectl get events -A -o json | python3 k8s_event_monitor.py",
              file=sys.stderr)
        return 1

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"invalid JSON: {exc}", file=sys.stderr)
        return 2

    items = data.get("items", [])
    warnings = [i for i in items if i.get("type") == "Warning"]

    print(f"Total events: {len(items)}  Warning: {len(warnings)}", file=sys.stderr)
    if not warnings:
        print("No warning events found.")
        return 0

    # By reason
    reason_counts = Counter(w.get("reason", "Unknown") for w in warnings)
    print("\n=== Warning Events by Reason ===")
    for reason, count in reason_counts.most_common(10):
        print(f"  {reason:<30} {count}")

    # By namespace
    ns_counts = Counter(get_namespace(w) for w in warnings)
    print("\n=== Warning Events by Namespace ===")
    for ns, count in ns_counts.most_common():
        print(f"  {ns:<30} {count}")

    # Top events by count
    sorted_events = sorted(warnings, key=lambda w: w.get("count", 0), reverse=True)
    print("\n=== Top Events by Occurrence ===")
    print(f"  {'NAMESPACE':<20} {'REASON':<20} {'OBJECT':<35} {'COUNT':>5}")
    print("  " + "-" * 82)
    for event in sorted_events[:10]:
        ns = event.get("metadata", {}).get("namespace", "")
        reason = event.get("reason", "")
        obj = event.get("involvedObject", {})
        obj_ref = f"{obj.get('kind','')}/{obj.get('name','')}"
        count = event.get("count", 0)
        print(f"  {ns:<20} {reason:<20} {obj_ref:<35} {count:>5}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## 2. Alert Webhook Receiver

A minimal Flask/http.server webhook endpoint that receives Alertmanager POST payloads, logs them as JSON, and forwards critical alerts to Slack.

```python
#!/usr/bin/env python3
"""
alert_receiver.py — minimal Alertmanager webhook receiver
pip install requests
"""
import json
import logging
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("alert-receiver")

SLACK_WEBHOOK = os.environ.get("SLACK_WEBHOOK_URL", "")


def post_to_slack(text: str) -> None:
    if not SLACK_WEBHOOK:
        logger.warning("SLACK_WEBHOOK_URL not set — skipping Slack notification")
        return
    try:
        resp = requests.post(SLACK_WEBHOOK, json={"text": text}, timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        logger.error("Slack post failed: %s", exc)


class AlertHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        logger.info("received alert payload: %s", json.dumps(payload))

        for alert in payload.get("alerts", []):
            status = alert.get("status", "unknown")
            name = alert.get("labels", {}).get("alertname", "unknown")
            severity = alert.get("labels", {}).get("severity", "info")
            summary = alert.get("annotations", {}).get("summary", "")

            logger.info("alert: name=%s status=%s severity=%s", name, status, severity)

            if severity == "critical" and status == "firing":
                msg = f":red_circle: *{name}* [{status}] — {summary}"
                post_to_slack(msg)

        self.send_response(200)
        self.end_headers()

    def log_message(self, fmt, *args):
        pass   # suppress default HTTP access log (we use our own logger)


def main() -> int:
    port = int(os.environ.get("PORT", "9093"))
    server = HTTPServer(("0.0.0.0", port), AlertHandler)
    logger.info("Alert receiver listening on :%d", port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## 3. Structured Log Parser

Parses NDJSON application logs from multiple files, aggregates error statistics, and outputs a ranked incident summary.

```python
#!/usr/bin/env python3
"""
log_parser.py — NDJSON log analyzer for incident triage
Usage: python3 log_parser.py /var/log/app/*.ndjson
"""
import argparse
import json
import os
import sys
from collections import Counter, defaultdict


def load_logs(path: str) -> tuple[list, int]:
    records, bad = [], 0
    with open(path, encoding="utf-8", errors="replace") as f:
        for line_num, raw in enumerate(f, start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                records.append(json.loads(raw))
            except json.JSONDecodeError:
                bad += 1
    return records, bad


def summarize(all_records: list[dict]) -> None:
    error_records = [r for r in all_records if r.get("level") == "ERROR"]
    total = len(all_records)
    errors = len(error_records)
    error_rate = (errors / total * 100) if total else 0

    print(f"\nTotal records : {total}")
    print(f"Error records : {errors} ({error_rate:.1f}%)")

    print("\n=== Top Error Types ===")
    type_counts = Counter(r.get("error_type", "(none)") for r in error_records)
    for t, c in type_counts.most_common(10):
        print(f"  {t:<35} {c}")

    print("\n=== Errors by Service ===")
    svc_counts = Counter(r.get("service", "(unknown)") for r in error_records)
    for s, c in svc_counts.most_common():
        print(f"  {s:<25} {c}")

    # Trace ID grouping — find cascading failures
    traces = defaultdict(list)
    for r in error_records:
        if tid := r.get("trace_id"):
            traces[tid].append(r)

    if traces:
        print("\n=== Top Traces by Error Count ===")
        sorted_traces = sorted(traces.items(), key=lambda x: len(x[1]), reverse=True)
        for tid, events in sorted_traces[:5]:
            services = {e.get("service") for e in events}
            print(f"  {tid}  errors={len(events)}  services={', '.join(services)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="NDJSON log analyzer")
    parser.add_argument("files", nargs="+", help="Log files to analyze")
    args = parser.parse_args()

    all_records = []
    total_bad = 0

    for path in args.files:
        if not os.path.isfile(path):
            print(f"[WARN] not found: {path}", file=sys.stderr)
            continue
        records, bad = load_logs(path)
        print(f"[INFO] {path}: {len(records)} records, {bad} malformed", file=sys.stderr)
        all_records.extend(records)
        total_bad += bad

    if total_bad:
        print(f"[WARN] Total malformed lines: {total_bad}", file=sys.stderr)

    summarize(all_records)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## 4. Metric Publisher to Prometheus Pushgateway

Collects system and application metrics and pushes them to the Prometheus Pushgateway for batch job observability.

```python
#!/usr/bin/env python3
"""
metric_pusher.py — push metrics to Prometheus Pushgateway
pip install requests psutil
"""
import argparse
import os
import platform
import sys
import time

import psutil
import requests


def build_metric_lines(job: str, instance: str) -> str:
    """Build Prometheus text-format metric lines."""
    lines = []
    labels = f'job="{job}",instance="{instance}"'

    # CPU
    cpu_pct = psutil.cpu_percent(interval=1)
    lines.append(f'node_cpu_usage_percent{{{labels}}} {cpu_pct}')

    # Memory
    mem = psutil.virtual_memory()
    lines.append(f'node_memory_usage_percent{{{labels}}} {mem.percent}')
    lines.append(f'node_memory_available_bytes{{{labels}}} {mem.available}')

    # Disk
    disk = psutil.disk_usage("/")
    lines.append(f'node_disk_usage_percent{{{labels}}} {disk.percent}')

    # Load average
    load1, load5, load15 = psutil.getloadavg()
    lines.append(f'node_load1{{{labels}}} {load1}')
    lines.append(f'node_load5{{{labels}}} {load5}')

    return "\n".join(lines) + "\n"


def push(gateway_url: str, job: str, instance: str) -> None:
    metrics = build_metric_lines(job, instance)
    url = f"{gateway_url}/metrics/job/{job}/instance/{instance}"
    resp = requests.put(url, data=metrics, timeout=10,
                        headers={"Content-Type": "text/plain"})
    resp.raise_for_status()


def main() -> int:
    parser = argparse.ArgumentParser(description="Push metrics to Pushgateway")
    parser.add_argument("--gateway", default=os.environ.get("PUSHGATEWAY_URL", "http://localhost:9091"))
    parser.add_argument("--job", default="node-metrics")
    parser.add_argument("--instance", default=platform.node())
    parser.add_argument("--interval", type=float, default=30.0, help="Push interval in seconds")
    parser.add_argument("--once", action="store_true", help="Push once and exit")
    args = parser.parse_args()

    print(f"Pushing to {args.gateway} (job={args.job}, instance={args.instance})")

    while True:
        try:
            push(args.gateway, args.job, args.instance)
            print(f"Pushed at {time.strftime('%H:%M:%S')}")
        except Exception as exc:
            print(f"Push failed: {exc}", file=sys.stderr)

        if args.once:
            break
        time.sleep(args.interval)

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## 5. Config Drift Checker

Compares deployed Kubernetes Deployment image tags against a desired state manifest and reports drift — useful for detecting unapproved image changes.

```python
#!/usr/bin/env python3
"""
config_drift.py — detect image tag drift in Kubernetes Deployments
pip install kubernetes pyyaml
Usage: python3 config_drift.py --desired desired-state.yaml [--namespace production]
"""
import argparse
import sys
import yaml


def load_desired(path: str) -> dict[str, str]:
    """Load desired image map: {deployment_name: image_tag}"""
    with open(path) as f:
        config = yaml.safe_load(f)
    return {item["name"]: item["image"] for item in config.get("deployments", [])}


def get_actual(namespace: str) -> dict[str, str]:
    """Read current images from the cluster."""
    from kubernetes import client, config as k8s_config
    k8s_config.load_kube_config()
    apps = client.AppsV1Api()
    result = {}
    deploys = apps.list_namespaced_deployment(namespace=namespace)
    for deploy in deploys.items:
        name = deploy.metadata.name
        containers = deploy.spec.template.spec.containers
        if containers:
            result[name] = containers[0].image
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Kubernetes config drift detector")
    parser.add_argument("--desired", required=True, help="Desired state YAML file")
    parser.add_argument("--namespace", default="production")
    args = parser.parse_args()

    desired = load_desired(args.desired)
    try:
        actual = get_actual(args.namespace)
    except Exception as exc:
        print(f"Failed to query cluster: {exc}", file=sys.stderr)
        return 2

    drift_found = False
    print(f"\nConfig drift report — namespace: {args.namespace}")
    print(f"{'DEPLOYMENT':<35} {'DESIRED':<50} {'ACTUAL':<50} STATUS")
    print("-" * 145)

    for name, desired_image in desired.items():
        actual_image = actual.get(name, "(not deployed)")
        if actual_image == desired_image:
            status = "OK"
        else:
            status = "DRIFT"
            drift_found = True
        print(f"{name:<35} {desired_image:<50} {actual_image:<50} {status}")

    # Report deployments in cluster not in desired state
    for name in actual:
        if name not in desired:
            print(f"{name:<35} {'(not in desired)':<50} {actual[name]:<50} UNMANAGED")

    if drift_found:
        print("\nDrift detected — review and align before next deployment.")
        return 1

    print("\nNo drift detected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Example desired-state.yaml:**
```yaml
deployments:
  - name: payments
    image: registry.internal/payments:v2.3.1
  - name: gateway
    image: registry.internal/gateway:v1.8.0
  - name: worker
    image: registry.internal/worker:v3.0.2
```

---

## 6. Parallel Fleet Disk Check

Runs `df -h /` across a fleet of hosts via SSH in parallel and reports hosts above a disk usage threshold.

```python
#!/usr/bin/env python3
"""
fleet_disk_check.py — parallel disk usage check across SSH hosts
pip install paramiko
Usage: python3 fleet_disk_check.py --hosts nodes.txt --threshold 85
"""
import argparse
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import paramiko


def check_host(host: str, user: str, key_path: str, threshold: int) -> dict:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, key_filename=key_path, timeout=10)
        _, stdout, _ = client.exec_command("df -BG / | tail -1 | awk '{print $5}'", timeout=15)
        pct_str = stdout.read().decode().strip().rstrip("%")
        pct = int(pct_str)
        return {
            "host": host,
            "disk_pct": pct,
            "ok": pct < threshold,
            "error": None,
        }
    except Exception as exc:
        return {"host": host, "disk_pct": None, "ok": False, "error": str(exc)}
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Fleet disk checker")
    parser.add_argument("--hosts", required=True, help="File with one hostname per line")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--key", default="~/.ssh/id_rsa")
    parser.add_argument("--threshold", type=int, default=85, help="Alert threshold %")
    parser.add_argument("--workers", type=int, default=20)
    args = parser.parse_args()

    with open(args.hosts) as f:
        hosts = [line.strip() for line in f if line.strip()]

    alerts = []
    results = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(check_host, h, args.user, args.key, args.threshold): h
            for h in hosts
        }
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            if not result["ok"]:
                alerts.append(result)

    # Print summary
    results.sort(key=lambda r: (r["disk_pct"] or -1), reverse=True)
    for r in results:
        icon = "ALERT" if not r["ok"] else "OK   "
        pct = f"{r['disk_pct']}%" if r["disk_pct"] is not None else r["error"]
        print(f"[{icon}] {r['host']:<40} {pct}")

    if alerts:
        print(f"\n{len(alerts)} hosts above {args.threshold}% disk usage")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## 7. AWS Untagged Resource Auditor

Finds EC2 instances missing a required tag (`Team`) and either reports or optionally stops them.

```python
#!/usr/bin/env python3
"""
tag_auditor.py — find EC2 instances missing required tags
pip install boto3
Usage: python3 tag_auditor.py --region us-east-1 --required-tag Team
"""
import argparse
import sys
import boto3


def get_untagged(region: str, required_tag: str) -> list[dict]:
    ec2 = boto3.resource("ec2", region_name=region)
    untagged = []
    for instance in ec2.instances.filter(
        Filters=[{"Name": "instance-state-name", "Values": ["running"]}]
    ):
        tags = {t["Key"]: t["Value"] for t in (instance.tags or [])}
        if required_tag not in tags:
            untagged.append({
                "id": instance.id,
                "type": instance.instance_type,
                "name": tags.get("Name", "(no name)"),
                "launch_time": instance.launch_time.isoformat(),
            })
    return untagged


def main() -> int:
    parser = argparse.ArgumentParser(description="EC2 tag auditor")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--required-tag", default="Team")
    parser.add_argument("--stop", action="store_true", help="Stop untagged instances")
    args = parser.parse_args()

    print(f"Scanning {args.region} for instances missing tag: {args.required_tag}")
    untagged = get_untagged(args.region, args.required_tag)

    if not untagged:
        print("All running instances are properly tagged.")
        return 0

    print(f"\nFound {len(untagged)} untagged instances:")
    for inst in untagged:
        print(f"  {inst['id']:<20} {inst['type']:<15} {inst['name']}")

    if args.stop:
        ids = [i["id"] for i in untagged]
        ec2 = boto3.client("ec2", region_name=args.region)
        ec2.stop_instances(InstanceIds=ids)
        print(f"\nStopped {len(ids)} instances.")

    return 1


if __name__ == "__main__":
    sys.exit(main())
```

---

## 8. Canary Deployment Validator

After a canary deployment, validates that the new version responds correctly and latency is within bounds before promoting to full rollout.

```python
#!/usr/bin/env python3
"""
canary_validator.py — validate a canary deployment before promotion
pip install requests
Usage: python3 canary_validator.py --canary https://canary.internal --stable https://api.internal
"""
import argparse
import sys
import time
import statistics
import requests


def measure(url: str, count: int = 10, timeout: float = 5.0) -> dict:
    latencies = []
    errors = 0
    for _ in range(count):
        try:
            start = time.monotonic()
            resp = requests.get(url, timeout=timeout)
            elapsed = (time.monotonic() - start) * 1000
            if resp.ok:
                latencies.append(elapsed)
            else:
                errors += 1
        except Exception:
            errors += 1
    return {
        "url": url,
        "requests": count,
        "errors": errors,
        "success_rate": (count - errors) / count,
        "p50_ms": statistics.median(latencies) if latencies else None,
        "p95_ms": (sorted(latencies)[int(len(latencies) * 0.95)] if len(latencies) >= 2 else None),
        "mean_ms": (statistics.mean(latencies) if latencies else None),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Canary deployment validator")
    parser.add_argument("--canary", required=True)
    parser.add_argument("--stable", required=True)
    parser.add_argument("--requests", type=int, default=20)
    parser.add_argument("--max-error-rate", type=float, default=0.01, help="Max error rate (0–1)")
    parser.add_argument("--max-latency-ms", type=float, default=500.0)
    args = parser.parse_args()

    print(f"Measuring canary: {args.canary}")
    canary = measure(args.canary, count=args.requests)

    print(f"Measuring stable: {args.stable}")
    stable = measure(args.stable, count=args.requests)

    # Report
    for label, result in [("STABLE", stable), ("CANARY", canary)]:
        print(f"\n[{label}] {result['url']}")
        print(f"  Success rate: {result['success_rate']:.1%}")
        print(f"  p50 latency:  {result['p50_ms']:.1f}ms" if result['p50_ms'] else "  p50: N/A")
        print(f"  p95 latency:  {result['p95_ms']:.1f}ms" if result['p95_ms'] else "  p95: N/A")

    # Validation
    failures = []
    error_rate = 1 - canary["success_rate"]
    if error_rate > args.max_error_rate:
        failures.append(f"Canary error rate {error_rate:.1%} > {args.max_error_rate:.1%}")
    if canary["p95_ms"] and canary["p95_ms"] > args.max_latency_ms:
        failures.append(f"Canary p95 {canary['p95_ms']:.0f}ms > {args.max_latency_ms:.0f}ms limit")
    if stable["p95_ms"] and canary["p95_ms"] and canary["p95_ms"] > stable["p95_ms"] * 1.5:
        failures.append(f"Canary p95 is >1.5x stable p95")

    if failures:
        print("\nValidation FAILED:")
        for f in failures:
            print(f"  - {f}")
        print("\nDo NOT promote. Roll back canary.")
        return 1

    print("\nValidation PASSED — safe to promote canary to 100%.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```
