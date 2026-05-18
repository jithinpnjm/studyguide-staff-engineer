---
title: "Expert"
sidebar_position: 3
---

# Expert: Advanced Bash Patterns

This section covers patterns used in serious production automation: argument parsing, parallel execution, atomic file operations, idempotency, performance profiling, and bash internals.

---

## getopts — Proper Argument Parsing

`getopts` is the POSIX-standard way to parse short options (`-n`, `-v`, `-f file`):

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<EOF
Usage: $0 [OPTIONS] ENVIRONMENT

Options:
  -n, --dry-run       Dry run (no changes)
  -t SECONDS          Timeout (default: 300)
  -v                  Verbose output
  -h                  Show this help

Examples:
  $0 -n staging
  $0 -t 60 -v prod
EOF
    exit 0
}

# Defaults
DRY_RUN=false
TIMEOUT=300
VERBOSE=false

while getopts ":nt:vh" opt; do
    case "$opt" in
        n) DRY_RUN=true ;;
        t) TIMEOUT="$OPTARG" ;;
        v) VERBOSE=true ;;
        h) usage ;;
        :) echo "Option -$OPTARG requires an argument." >&2; exit 1 ;;
        \?) echo "Invalid option: -$OPTARG" >&2; exit 1 ;;
    esac
done

shift $((OPTIND - 1))   # remove parsed options; $@ now has positional args

ENV="${1:?environment argument required}"
```

For long options (`--dry-run`, `--timeout`), use the `getopt` utility (note: different from `getopts`):

```bash
OPTS=$(getopt -o nt:vh --long dry-run,timeout:,verbose,help -n "$0" -- "$@")
eval set -- "$OPTS"

while true; do
    case "$1" in
        -n|--dry-run)  DRY_RUN=true; shift ;;
        -t|--timeout)  TIMEOUT="$2"; shift 2 ;;
        -v|--verbose)  VERBOSE=true; shift ;;
        -h|--help)     usage ;;
        --)            shift; break ;;
        *)             break ;;
    esac
done
```

---

## Parallel Execution

### Basic Parallel with `&` and `wait`

```bash
for host in app1 app2 app3 app4; do
    ssh "$host" "systemctl is-active myapp || systemctl restart myapp" &
done
wait   # blocks until all background jobs finish
```

### Parallel with Exit Code Collection

```bash
declare -A pids

for host in app1 app2 app3; do
    ssh "$host" uptime &
    pids["$host"]=$!
done

failed=()
for host in "${!pids[@]}"; do
    if ! wait "${pids[$host]}"; then
        failed+=("$host")
    fi
done

if [[ ${#failed[@]} -gt 0 ]]; then
    echo "Failed hosts: ${failed[*]}" >&2
    exit 1
fi
```

### Concurrency Limiting with a Semaphore Pattern

Unbounded parallel SSH can cause an incident on large fleets:

```bash
MAX_PARALLEL=5
active=0

for host in "${hosts[@]}"; do
    check_host "$host" &
    ((active++))
    if [[ $active -ge $MAX_PARALLEL ]]; then
        wait -n 2>/dev/null || true   # wait for any one job to finish
        ((active--))
    fi
done
wait
```

### Using `xargs -P` for Parallel Execution

```bash
# Run health check on 10 hosts in parallel, 5 at a time
printf '%s\n' "${hosts[@]}" | xargs -P 5 -I{} bash -c 'check_host "{}"'

# Parallel file processing
find /data -name "*.log" | xargs -P 8 -I{} gzip {}
```

---

## Coprocesses (coproc)

A coprocess runs a background command with bidirectional pipes:

```bash
# Start a coprocess that reads/writes
coproc PROC { while IFS= read -r line; do echo "processed: $line"; done; }

# Send to coprocess stdin
echo "hello" >&"${PROC[1]}"

# Read from coprocess stdout
IFS= read -r response <&"${PROC[0]}"
echo "Response: $response"

# Close and wait
exec {PROC[1]}>&-
wait $PROC_PID
```

Practical use — maintaining a persistent connection to a service rather than reconnecting for each request.

---

## Performance Profiling

### Time Individual Commands

```bash
time kubectl get pods -A --no-headers | wc -l
```

### Built-in PS4 Tracing with Timestamps

```bash
#!/usr/bin/env bash
# Profile with microsecond timestamps
PS4='+ $(date +%s%N | cut -b1-13) ${FUNCNAME[0]:+${FUNCNAME[0]}():}line ${LINENO}: '
set -x

# ... your code ...
```

### Measuring Script Sections

```bash
start=$(date +%s%3N)   # milliseconds since epoch

do_expensive_work

end=$(date +%s%3N)
elapsed=$(( end - start ))
echo "Elapsed: ${elapsed}ms"
```

### Avoid Forks in Hot Loops

Every `$(cmd)` spawns a subshell (fork + exec). In tight loops, this adds up:

```bash
# Slow: spawns a subshell per iteration
for file in *.log; do
    size=$(stat -c%s "$file")
    echo "$file: $size bytes"
done

# Faster: use awk or stat directly on all files at once
stat -c "%n: %s bytes" *.log

# Slow: multiple greps
grep "ERROR" app.log | grep "timeout" | grep "payment"

# Faster: single awk pass
awk '/ERROR/ && /timeout/ && /payment/' app.log
```

### Use `mapfile` Instead of Looping with `read`

```bash
# Slow: spawns a subshell per iteration via pipe
while IFS= read -r line; do process "$line"; done < <(cat bigfile.txt)

# Faster for small-medium files: read all at once
mapfile -t lines < bigfile.txt
for line in "${lines[@]}"; do process "$line"; done
```

---

## Idempotent Script Patterns

Idempotent scripts can run multiple times safely — critical for cron jobs and automation:

```bash
# mkdir -p is idempotent (won't fail if dir exists)
mkdir -p /opt/app/config

# cp -n won't overwrite existing files
cp -n /etc/defaults/config /opt/app/config/

# Use conditional checks before actions
if [[ ! -f /opt/app/config/settings.yaml ]]; then
    install_default_config
fi

# Kubernetes resources are idempotent with apply
kubectl apply -f deployment.yaml    # safe to run repeatedly
# vs kubectl create (fails if already exists)

# Idempotent user creation
if ! id "appuser" &>/dev/null; then
    useradd -r -s /bin/false appuser
fi
```

---

## Atomic File Writes

Writing directly to a destination file risks leaving a partial file if the script is interrupted. Write to a temp file then atomically rename:

```bash
# Non-atomic — dangerous if interrupted
echo "config content" > /etc/myapp/config.yaml

# Atomic — rename is atomic on the same filesystem
tmpfile=$(mktemp /etc/myapp/config.yaml.XXXXXX)
echo "config content" > "$tmpfile"
mv -f "$tmpfile" /etc/myapp/config.yaml
```

Full pattern with cleanup:

```bash
write_config_atomically() {
    local dest="$1"
    local tmpfile
    tmpfile=$(mktemp "${dest}.XXXXXX")

    trap "rm -f '$tmpfile'" RETURN

    # Write to temp file
    generate_config > "$tmpfile"

    # Validate before committing
    if ! validate_config "$tmpfile"; then
        echo "Config validation failed" >&2
        return 1
    fi

    # Atomic commit
    mv -f "$tmpfile" "$dest"
    echo "Config written to $dest"
}
```

---

## Lock Files — Prevent Concurrent Runs

```bash
LOCKFILE="/var/run/myscript.lock"

acquire_lock() {
    # mkdir is atomic — only one process succeeds
    if ! mkdir "$LOCKFILE" 2>/dev/null; then
        local pid
        pid=$(cat "$LOCKFILE/pid" 2>/dev/null || echo "unknown")
        echo "Script already running (PID: $pid)" >&2
        exit 1
    fi
    echo $$ > "$LOCKFILE/pid"
}

release_lock() {
    rm -rf "$LOCKFILE"
}

trap release_lock EXIT INT TERM

acquire_lock
# ... main work ...
```

Using `flock` for advisory locking (simpler):

```bash
exec 9>/var/run/myscript.lock
if ! flock -n 9; then
    echo "Another instance is running" >&2
    exit 1
fi

# Lock is automatically released when the script exits (fd 9 closes)
```

---

## Safe Destructive Operations

Most shell disasters are unquoted variable or empty-path disasters:

```bash
# DANGEROUS: if $target is empty, this becomes rm -rf /cache
target=""
rm -rf $target/cache

# SAFE: ${var:?} causes script to exit if var is empty or unset
rm -rf "${target:?target must be set}/cache"

# SAFE: explicit validation before destructive action
[[ -n "${target:-}" ]] || { echo "target is empty" >&2; exit 1; }
rm -rf "${target}/cache"

# SAFE: use a dry-run flag during development
if [[ "${DRY_RUN:-false}" == "true" ]]; then
    echo "Would run: rm -rf ${target}/cache"
else
    rm -rf "${target}/cache"
fi
```

---

## Bash Internals

### Shell Execution Model

```bash
# fork + exec: creates a new process
ls -la

# built-in: no fork (runs in current shell)
cd /tmp
echo hello
[[ -f file ]]

# source: runs in current shell without fork
source ./functions.sh
. ./functions.sh    # same thing

# eval: parses and executes a string as bash code — dangerous with untrusted input
eval "echo $var"   # avoid unless absolutely necessary
```

### BASH_SOURCE, FUNCNAME, LINENO

```bash
# Self-check if being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"   # running as script
else
    echo "Sourced — functions now available"
fi

# Debug helpers
log_with_location() {
    echo "[${BASH_SOURCE[1]}:${BASH_LINENO[0]}:${FUNCNAME[1]}] $*"
}
```

### IFS Gotchas

```bash
# Default IFS is space, tab, newline
# Changing IFS affects word splitting everywhere

# Safe pattern: change locally with local IFS
parse_csv_line() {
    local IFS=","
    read -ra fields <<< "$1"
    echo "Field 1: ${fields[0]}"
    echo "Field 2: ${fields[1]}"
}

# IFS in for loop
IFS=$'\n'
for line in $(cat file.txt); do
    echo "$line"
done
unset IFS   # restore default
```

### Nameref — Passing Variables by Reference

```bash
# bash 4.3+
set_var() {
    local -n ref="$1"   # nameref: ref is an alias for the named variable
    ref="new value"
}

my_var="original"
set_var my_var
echo "$my_var"   # new value
```

---

## Advanced Retry Pattern

Full production-grade retry with exponential backoff, capped sleep, and exit code preservation:

```bash
retry() {
    local max_attempts="${1:-3}"
    local base_sleep="${2:-1}"
    local max_sleep="${3:-30}"
    shift 3

    local attempt=1
    local last_exit=1

    while [[ $attempt -le $max_attempts ]]; do
        echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [attempt $attempt/$max_attempts] running: $*"
        if "$@"; then
            echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] succeeded on attempt $attempt"
            return 0
        fi
        last_exit=$?

        if [[ $attempt -lt $max_attempts ]]; then
            local sleep_time=$(( base_sleep * (2 ** (attempt - 1)) ))
            [[ $sleep_time -gt $max_sleep ]] && sleep_time=$max_sleep
            # Add jitter to spread retriers
            sleep_time=$(( sleep_time + RANDOM % 3 ))
            echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] failed (exit $last_exit), sleeping ${sleep_time}s"
            sleep "$sleep_time"
        fi
        ((attempt++))
    done

    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] all $max_attempts attempts failed" >&2
    return "$last_exit"
}

# Usage
retry 5 1 30 curl -sf "https://api.example.com/health"
retry 3 2 10 kubectl rollout status deployment/myapp -n prod
```

---

## Production Script Checklist

Before any script touches production:

```bash
# 1. Strict mode at the top
set -euo pipefail

# 2. Validate required env vars early
: "${NAMESPACE:?required}" "${IMAGE:?required}"

# 3. Validate required tools
command -v kubectl >/dev/null || { echo "kubectl required" >&2; exit 1; }

# 4. Trap for cleanup
trap 'echo "Exit: $?"' EXIT

# 5. Dry-run mode
[[ "${DRY_RUN:-false}" == "true" ]] && { echo "Dry run"; exit 0; }

# 6. Idempotency — check before acting
kubectl get deployment/myapp -n "$NAMESPACE" &>/dev/null || kubectl create ...

# 7. Atomic writes for config files
tmpfile=$(mktemp); trap "rm -f $tmpfile" EXIT; generate > "$tmpfile"; mv "$tmpfile" /dest

# 8. Bounded retries with backoff
retry 3 2 30 kubectl apply -f manifest.yaml

# 9. Verify after action
kubectl rollout status deployment/myapp -n "$NAMESPACE" --timeout=300s

# 10. Emit structured output for log aggregation
printf '{"event":"deploy","image":"%s","namespace":"%s","timestamp":"%s"}\n' \
    "$IMAGE" "$NAMESPACE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```
