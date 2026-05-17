---
title: "Bash Lab 2: Access Log Summary"
sidebar_position: 2
---

# Bash Lab 2: Access Log Summary

## Operational Context

During an incident the first question is almost always "what is the error rate?" and the
second is "which endpoint and which client?". Dashboards are great when they're already
configured — but when you're triaging a new service, a degraded environment, or a log file
someone dropped into a support ticket, you need to be able to extract this signal yourself
in under two minutes.

`awk`, `sort`, and `uniq -c` together form a log analysis toolkit that every SRE should be
able to use fluently. This lab builds a reusable script that produces the three most
operationally useful summaries from an NGINX access log: request volume by endpoint, error
rate by status code, and top offending clients.

The patterns here transfer directly to Apache logs, HAProxy logs, Envoy access logs (with
minor format adjustments), and any other space-delimited access log.

## Prerequisites

- `awk`, `sort`, `uniq` — standard on every Linux system
- Familiarity with NGINX combined log format (covered in Step 1)
- Sample data: `../shared/logs/sample-nginx-access.log`

## Time Estimate

25–40 minutes for the core script. Extensions add 20–30 minutes.

---

## Step-by-Step Build Guide

### Step 1 — Understand the log format before writing a single line of awk

Never assume field positions. Print the first two lines of the log and count fields manually:

```bash
head -2 ../shared/logs/sample-nginx-access.log
```

NGINX combined log format:

```
$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
```

Field positions when split on spaces (awk `$N` notation):

| Field | awk | Example value |
|-------|-----|---------------|
| Client IP | `$1` | `10.0.0.11` |
| Timestamp | `$4 $5` | `[08/Apr/2026:10:00:01 +0000]` |
| HTTP method | `$6` | `"GET` |
| Request path | `$7` | `/api/v1/orders` |
| Protocol | `$8` | `HTTP/1.1"` |
| Status code | `$9` | `200` |
| Bytes sent | `$10` | `512` |

Verify your field mapping before trusting any counts:

```bash
awk '{print $9}' ../shared/logs/sample-nginx-access.log | head -5
```

If you see numbers like 200, 404, 500, your field position is correct.

### Step 2 — Count requests per status code

This is the fastest health check. Start here:

```bash
awk '{print $9}' ../shared/logs/sample-nginx-access.log \
  | sort \
  | uniq -c \
  | sort -rn
```

Wrap this in your script as a function:

```bash
status_summary() {
    local log_file="$1"
    echo "=== Requests by Status Code ==="
    awk '{print $9}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | awk '{printf "  %-6s %s\n", $2, $1}'
}
```

The final `awk` reformats the output so status code comes first (more readable):
`200    41` instead of `41 200`.

### Step 3 — Count requests per endpoint (top 10)

```bash
endpoint_summary() {
    local log_file="$1"
    echo "=== Top Endpoints by Request Count ==="
    awk '{print $7}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | head -10 \
        | awk '{printf "  %-40s %s\n", $2, $1}'
}
```

Test this. If you see query strings cluttering the output (`/api/v1/search?q=foo`), you can
strip them with: `awk '{split($7, a, "?"); print a[1]}'`

### Step 4 — Find IPs generating 5xx errors

This is the "who is hammering the broken endpoint" query:

```bash
error_clients() {
    local log_file="$1"
    echo "=== Top IPs with 5xx Responses ==="
    awk '$9 ~ /^5/ {print $1}' "$log_file" \
        | sort | uniq -c | sort -rn \
        | head -10 \
        | awk '{printf "  %-20s %s errors\n", $2, $1}'
}
```

The `$9 ~ /^5/` pattern means "status code starts with 5". This matches 500, 502, 503, 504.

### Step 5 — Wire everything together with a separator

```bash
main() {
    local log_file="${1:-}"
    if [[ -z "$log_file" ]]; then
        echo "usage: $0 LOG_FILE" >&2
        exit 1
    fi
    if [[ ! -f "$log_file" ]]; then
        echo "error: file not found: $log_file" >&2
        exit 1
    fi

    local total
    total=$(wc -l < "$log_file")
    echo "Log: $log_file  (${total} lines)"
    echo ""
    status_summary "$log_file"
    echo ""
    endpoint_summary "$log_file"
    echo ""
    error_clients "$log_file"
}

main "$@"
```

### Step 6 — Add a file-not-found check

You added `[[ ! -f "$log_file" ]]` above. Test it:

```bash
bash log_summary.sh /nonexistent.log
# → error: file not found: /nonexistent.log
echo $?  # → 1
```

This matters in automation: if the script silently produces empty output when the log
doesn't exist, the caller can't tell whether there were zero errors or whether the file
was missing.

---

## Sample Output

```
Log: ../shared/logs/sample-nginx-access.log  (62 lines)

=== Requests by Status Code ===
  200    28
  404    12
  500     9
  502     7
  503     6

=== Top Endpoints by Request Count ===
  /api/v1/orders                           18
  /api/v1/users                            14
  /healthz                                  9
  /api/v1/products                          8
  /api/v1/search                            7
  /api/v1/auth/login                        6

=== Top IPs with 5xx Responses ===
  10.0.0.13            8 errors
  10.0.0.17            4 errors
  10.0.0.12            3 errors
```

---

## Common Mistakes and How to Debug Them

**Status codes are printing as 0 or blank**

Field positions shift if the log format is different. Some NGINX configs log a dash for
`$remote_user` differently, or include `$request_time`. Always print the raw field and
inspect it before counting:

```bash
awk '{print NR, $9}' sample-nginx-access.log | head -5
```

**`uniq -c` produces wrong counts**

`uniq -c` only collapses *consecutive* identical lines. If you forget to `sort` before
`uniq -c`, you get per-run counts instead of totals. The pipeline must be:
`... | sort | uniq -c | sort -rn`.

**Empty output for 5xx queries**

Check whether any 5xx lines actually exist:

```bash
grep ' 5[0-9][0-9] ' ../shared/logs/sample-nginx-access.log | wc -l
```

If this returns 0 but you expected errors, your test data may not have any 5xx entries.

**`awk` treating quoted strings as multiple fields**

The `"GET /path HTTP/1.1"` portion in the log is one semantic field but is split by awk
because of the spaces inside the quotes. Field `$6` is `"GET`, `$7` is `/path`, `$8` is
`HTTP/1.1"`. This is expected and is why the endpoint is in `$7`, not `$6`. If your logs
have URLs with spaces (unusual but possible), you'll need a more careful parser.

**Script exits on empty file**

If the log file is empty, `wc -l` returns 0 and awk produces no output — this is fine. But
if you have `set -e` and a pipeline returns non-zero due to an empty result, you may get
unexpected exits. Test: `bash log_summary.sh /dev/null`

---

## Extension Challenges

1. **Error rate percentage**: For each status class (2xx, 3xx, 4xx, 5xx), print the count
   and percentage of total requests. Use `awk` to compute both in one pass.

2. **Time-window filter**: Accept optional `--from` and `--to` arguments in `HH:MM` format
   and only analyze log lines within that window. NGINX timestamps are in the format
   `08/Apr/2026:10:00:01`.

3. **Response-size analysis**: Print the top 5 endpoints by total bytes transferred. This
   reveals bandwidth consumers that may not have the highest request count.

4. **Slow request detection**: NGINX can log `$request_time`. If your sample log included
   this field, find all requests that took more than 1 second and print the endpoint and time.

5. **Alert threshold**: Add a `--max-error-rate` flag. If the 5xx percentage exceeds the
   threshold, print a warning line to stderr and exit with code 2. This makes the script
   usable in a CI or alerting pipeline.
