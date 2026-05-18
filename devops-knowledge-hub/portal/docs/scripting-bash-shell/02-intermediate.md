---
title: "Intermediate"
sidebar_position: 2
---

# Intermediate: Bash & Shell Scripting

This section covers the patterns that separate ad-hoc one-liners from maintainable, production-grade scripts. Master these before writing automation that others depend on.

---

## Strict Mode — Always Use This

For any non-trivial script, start with:

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

What each flag does:

| Flag | Effect |
|---|---|
| `-e` | Exit immediately on any unhandled non-zero exit code |
| `-u` | Treat unset variables as errors (prevents `rm -rf $UNDEFINED/`) |
| `-o pipefail` | Propagate failures in pipes — without this, `false \| true` exits 0 |
| `IFS=$'\n\t'` | Safer word splitting — spaces in filenames won't split words |

Strict mode is not magic. You still need explicit error handling:

```bash
set -euo pipefail

# Allow optional commands that may legitimately fail
backup_old_config() {
    cp /etc/myapp/config.yaml /etc/myapp/config.yaml.bak || true
}

# Check for required tools before using them
if ! command -v kubectl &>/dev/null; then
    echo "kubectl not installed" >&2
    exit 1
fi
```

---

## Arrays

### Indexed Arrays

```bash
# Declare and populate
ENDPOINTS=(
    "http://payment:8080/health"
    "http://auth:8081/health"
    "http://inventory:8082/health"
)

# Access elements
echo "${ENDPOINTS[0]}"       # first element
echo "${ENDPOINTS[-1]}"      # last element
echo "${ENDPOINTS[@]}"       # all elements
echo "${#ENDPOINTS[@]}"      # count

# Iterate
for url in "${ENDPOINTS[@]}"; do
    echo "Checking $url"
done

# Append
ENDPOINTS+=("http://billing:8083/health")

# Slice
echo "${ENDPOINTS[@]:1:2}"   # 2 elements starting at index 1
```

### Associative Arrays (Maps)

```bash
declare -A status_map

status_map["payment"]="healthy"
status_map["auth"]="degraded"
status_map["inventory"]="healthy"

# Access
echo "${status_map["payment"]}"

# Iterate keys and values
for service in "${!status_map[@]}"; do
    echo "$service: ${status_map[$service]}"
done

# Check if key exists
if [[ -v status_map["billing"] ]]; then
    echo "billing status known"
fi
```

### mapfile — Read Array from Command

```bash
# Read all pod names into an array
mapfile -t pods < <(kubectl get pods -n prod --no-headers -o name)
echo "Pod count: ${#pods[@]}"

# Process each
for pod in "${pods[@]}"; do
    echo "Pod: $pod"
done
```

---

## String Manipulation

### Length and Substring

```bash
filename="backup-2025-01-15.tar.gz"

echo "${#filename}"              # length: 23
echo "${filename:7}"             # from index 7: 2025-01-15.tar.gz
echo "${filename:7:10}"          # 10 chars from index 7: 2025-01-15
```

### Prefix and Suffix Stripping

```bash
# Strip shortest prefix match
echo "${filename#backup-}"       # 2025-01-15.tar.gz

# Strip longest prefix match
echo "${filename##*/}"           # basename equivalent — strips path

# Strip shortest suffix match
echo "${filename%.tar.gz}"       # backup-2025-01-15

# Strip longest suffix match (greedy)
echo "${filename%%.*}"           # backup-2025-01-15  (stops at first dot)
```

Practical use — extracting host and port from `HOST:PORT`:

```bash
target="api.internal:8080"
host="${target%%:*}"    # api.internal
port="${target##*:}"    # 8080
```

### Substitution

```bash
# Replace first match
echo "${filename/-/_}"           # backup_2025-01-15.tar.gz

# Replace all matches
echo "${filename//-/_}"          # backup_2025_01_15.tar.gz

# Replace prefix
echo "${filename/#backup/archive}"  # archive-2025-01-15.tar.gz

# Replace suffix
echo "${filename/%.gz/.bz2}"    # backup-2025-01-15.tar.bz2
```

### Case Conversion (bash 4+)

```bash
env="PRODUCTION"
echo "${env,,}"    # lowercase: production
echo "${env^^}"    # uppercase: PRODUCTION
echo "${env^}"     # capitalize first: PRODUCTION (already caps)

lower="hello"
echo "${lower^}"   # Hello
```

### Pattern Matching in Strings

```bash
filename="backup-2025-01-15.tar.gz"

# Glob match
if [[ "$filename" == *.gz ]]; then
    echo "Compressed file"
fi

# Regex match — result in BASH_REMATCH
if [[ "$filename" =~ ^backup-([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
    echo "Date: ${BASH_REMATCH[1]}"   # 2025-01-15
fi
```

---

## Process Substitution

Process substitution (`<(cmd)` and `>(cmd)`) lets you treat command output as a file:

```bash
# Read from a command as if it were a file — avoids subshell for while loop
while IFS= read -r pod; do
    kubectl logs "$pod" --tail=20
done < <(kubectl get pods -n prod --no-headers -o name)

# Diff output of two commands without temporary files
diff <(kubectl get pods -n staging -o name | sort) \
     <(kubectl get pods -n prod -o name | sort)

# Send output to two sinks simultaneously (tee into processes)
curl -s https://api.example.com/data | tee >(wc -l >&2) | jq '.'
```

Key distinction: `$(cmd)` gives you the output as a string; `<(cmd)` gives you a file descriptor pointing at the output stream.

---

## Here-Documents and Here-Strings

### Here-Document

Embed multi-line strings directly in scripts:

```bash
cat <<EOF
Server: ${HOSTNAME}
Environment: ${ENV}
Timestamp: $(date -u)
EOF

# Suppressing indentation with <<-
    cat <<-EOF
        This line will have tabs stripped from the front
    EOF

# Prevent variable expansion with quoted delimiter
cat <<'EOF'
This $VARIABLE will not be expanded
Use literal dollar signs here
EOF
```

Practical use — generating config files:

```bash
cat > /etc/myapp/config.yaml <<EOF
server:
  host: ${HOST:-0.0.0.0}
  port: ${PORT:-8080}
environment: ${ENV}
EOF
```

### Here-String

Feed a single string to a command:

```bash
grep "error" <<< "$log_line"

# Parse JSON without a file
jq '.status' <<< '{"status": "ok", "code": 200}'
```

---

## Traps and Cleanup

Traps register functions to run when the script receives a signal or exits:

```bash
#!/usr/bin/env bash
set -euo pipefail

TMPFILE=$(mktemp)
LOCKFILE="/var/run/myscript.lock"

cleanup() {
    local exit_code=$?
    echo "Cleaning up (exit code: $exit_code)" >&2
    rm -f "$TMPFILE" "$LOCKFILE"
    exit "$exit_code"
}

trap cleanup EXIT INT TERM

# Main work
echo "Work in progress..." > "$TMPFILE"
```

Signal reference:

| Signal | When fired |
|---|---|
| `EXIT` | Script exits for any reason |
| `INT` | Ctrl+C |
| `TERM` | `kill PID` (graceful termination) |
| `ERR` | Any command fails (with `set -e`) |

Use traps for:
- Temp file cleanup
- Lock file release
- Rollback hooks
- Signal handling in long-running scripts

---

## Script Structure Patterns

### Standard Production Script Layout

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────
NAMESPACE="${NAMESPACE:?NAMESPACE required}"
IMAGE="${IMAGE:?IMAGE required}"
DRY_RUN="${DRY_RUN:-false}"
TIMEOUT="${TIMEOUT:-300}"

# ── Helpers ────────────────────────────────────────────────────────────
log()  { printf '[%s] INFO  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
warn() { printf '[%s] WARN  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }
die()  { printf '[%s] ERROR %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; exit 1; }

require() { command -v "$1" >/dev/null || die "missing required command: $1"; }

# ── Cleanup ────────────────────────────────────────────────────────────
cleanup() { log "Done (exit $?)"; }
trap cleanup EXIT

# ── Preflight checks ───────────────────────────────────────────────────
require kubectl
require jq

# ── Main logic ─────────────────────────────────────────────────────────
main() {
    log "Starting..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run — no changes will be made"
        return 0
    fi

    # real work here
}

main "$@"
```

### Pipes and Text Processing

The pipe (`|`) feeds stdout of one command to stdin of the next:

```bash
grep -E 'ERROR|WARN' app.log
awk '{print $1}' access.log
sed -n '1,20p' file
sort file | uniq -c | sort -rn
cut -d: -f1 /etc/passwd
```

Mental model:

```
command output -> filter -> transform -> summarize
```

### JSON and APIs

Modern operations use JSON everywhere. Use `jq` instead of fragile grep/sed parsing:

```bash
kubectl get pods -o json | jq '.items[].metadata.name'
curl -s https://api.example.com/status | jq '.status'

# Extract nested value
curl -s https://api.example.com/health | jq -r '.services.database.status'

# Filter array
kubectl get pods -o json | jq '.items[] | select(.status.phase == "Failed") | .metadata.name'
```

---

## Redirection

```bash
# stdout to file
command > output.txt

# stderr to file
command 2> errors.txt

# both stdout and stderr to file
command > output.txt 2>&1
command &> output.txt    # bash shorthand

# append
command >> output.txt

# discard output
command > /dev/null
command &> /dev/null

# stderr to stdout (for piping errors)
command 2>&1 | grep "error"

# redirect stderr to a log while printing stdout
command 2>errors.log

# swap stdout and stderr
command 3>&1 1>&2 2>&3
```

---

## Subshells and Variable Scope

Variables set inside a subshell do not propagate back to the parent:

```bash
x=1
(x=2; echo "inside subshell: $x")
echo "outside: $x"    # still 1

# This is why while read loops in pipelines lose variables
count=0
cat file.txt | while IFS= read -r line; do
    ((count++))    # this count stays in the subshell
done
echo $count    # 0, not what you expected!

# Fix: use process substitution to avoid the subshell
count=0
while IFS= read -r line; do
    ((count++))
done < <(cat file.txt)
echo $count    # correct count
```

---

## Background Processes

```bash
# Run in background
./script.sh &
bg_pid=$!

# Wait for a specific background job
wait $bg_pid
echo "Exit code: $?"

# Wait for all background jobs
wait

# Run commands in parallel and wait
for host in app1 app2 app3; do
    ssh "$host" uptime &
done
wait   # waits for all background jobs
```

---

## Debugging

```bash
# Trace execution line by line
set -x
some_tricky_function
set +x

# Run script with trace from outside
bash -x myscript.sh

# Lint with shellcheck before running
shellcheck myscript.sh

# Inspect variable type and value
declare -p my_array

# Print specific variable
echo "DEBUG: var=${var}" >&2

# Check what a command will do before running it
echo kubectl set image deployment/myapp myapp="$IMAGE" -n "$NAMESPACE"
```

---

## Key Takeaways

- `set -euo pipefail` is non-negotiable for production scripts
- Use arrays with `"${arr[@]}"` — never omit the quotes
- Use `mapfile` to read command output into arrays
- Use `<()` process substitution to avoid subshell variable scope issues
- Use `trap cleanup EXIT` for guaranteed cleanup
- Structure scripts: config at top, helpers next, main at bottom
- Use `jq` for JSON — never grep/sed JSON
