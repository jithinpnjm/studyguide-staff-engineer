# Python Labs

These labs build the Python scripting skills that appear regularly in SRE platform work and technical interviews. The focus is not on data science or web frameworks — it is on automation, observability tooling, and operational scripting.

## Why This Track Matters Operationally

Python is the second language of SRE automation. It is the natural choice when Bash becomes unwieldy: structured data, HTTP clients, Kubernetes API access, and JSON log analysis all benefit from Python's standard library. Interviewers for platform and SRE roles frequently ask candidates to write small Python tools on a whiteboard or live coding environment.

## Prerequisites

- Python 3.9 or later installed
- Comfortable with functions, list comprehensions, dictionaries, and file I/O
- Basic understanding of HTTP and JSON
- Know how to use `argparse`, `requests`, `json`, and `datetime` from the standard library

Foundation reading: [../../foundations/04-python-for-sre.md](../../foundations/04-python-for-sre.md)

## Labs

1. [lab-01-http-probe.md](lab-01-http-probe.md) — Write an HTTP probe that checks multiple endpoints, measures response time, detects failures, and outputs a structured report. Focus: `requests`, timeout handling, retry logic, output formatting.
2. [lab-02-json-log-analyzer.md](lab-02-json-log-analyzer.md) — Parse a stream of JSON log lines, aggregate by error type and service, and produce a summary with counts and rates. Focus: `json`, `collections.Counter`, time-bucketed analysis.
3. [lab-03-k8s-event-summary.md](lab-03-k8s-event-summary.md) — Process Kubernetes event output and produce a structured summary of warning events, counts per resource, and timeline. Focus: parsing kubectl output, grouping, and filtering.

## Starter Files

- [starter/http_probe.py](starter/http_probe.py)
- [starter/json_log_analyzer.py](starter/json_log_analyzer.py)
- [starter/k8s_event_summary.py](starter/k8s_event_summary.py)

## Learning Progression

**Beginner:** scripts that parse input and produce output in the success case. Correct for well-formed data.

**Intermediate:** scripts that handle malformed input, missing fields, network timeouts, and partial data. Output that is still useful when input is incomplete.

**Advanced:** scripts that are parameterized via CLI flags, handle concurrent probing, produce machine-readable output (JSON) and human-readable output, and are safe to pipe into other tools.

## How To Use These Labs

1. Read the lab scenario and the starter file. Note what is missing from the starter.
2. Write the extension without looking up finished examples first.
3. Test with malformed input — a JSON file with missing fields, an HTTP endpoint that returns 500, kubectl output with unexpected spacing.
4. Time yourself: a lab-01-level task should take under 25 minutes in an interview setting.
5. Verify that your output is clean enough to be piped into `jq` or another tool.

## Tools You Need

- Python 3.9+: https://docs.python.org/3/
- `pip install requests` for HTTP labs
- `virtualenv` or `uv` for isolated environments
- A local Kubernetes cluster with `kubectl` for lab 3 — or use the included sample event files
- Cloud shell or any Linux VM works as an alternative

Install `uv` for fast environment management:
```
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv && uv pip install requests
```

## Success Criteria

After completing all three labs you should be able to:

- write an HTTP probe with retry and timeout logic from scratch in under 30 minutes
- parse a multi-field JSON log stream and produce an aggregated summary without looking up Counter syntax
- take raw kubectl event output and produce a useful grouped summary in Python
- handle missing and malformed fields gracefully without crashing or silently ignoring errors
- explain in an interview how you would extend each tool to run as a Kubernetes CronJob
