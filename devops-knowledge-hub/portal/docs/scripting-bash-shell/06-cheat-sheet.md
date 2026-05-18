---
title: "Cheat Sheet"
sidebar_position: 6
---

# Cheat Sheet: Bash & Shell Scripting

Quick reference for syntax, special variables, string operations, file tests, and common patterns.

---

## Script Header

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

---

## Special Variables

| Variable | Meaning |
|---|---|
| `$0` | Script name / path |
| `$1` ... `$9` | Positional arguments |
| `${10}` | Positional arg 10+ (need braces) |
| `$#` | Number of arguments |
| `$@` | All arguments as separate words |
| `$*` | All arguments joined into one word |
| `$?` | Exit code of last command |
| `$$` | PID of current shell |
| `$!` | PID of last background command |
| `$_` | Last argument of last command |
| `$-` | Current shell options (`himBH`) |
| `$LINENO` | Current line number |
| `$FUNCNAME` | Current function name (array) |
| `$BASH_SOURCE` | Source file of current code (array) |
| `$BASH_REMATCH` | Regex match groups from `=~` |
| `$PIPESTATUS` | Array of exit codes from last pipeline |
| `$RANDOM` | Random integer 0–32767 |
| `$SECONDS` | Seconds since shell started |

---

## Variable Expansion

| Syntax | Meaning |
|---|---|
| `${var}` | Value of var (braces for disambiguation) |
| `${var:-default}` | Value, or `default` if unset or empty |
| `${var:=default}` | Value, or assign and return `default` if unset |
| `${var:?msg}` | Value, or exit with `msg` if unset or empty |
| `${var:+other}` | `other` if var is set and non-empty; empty otherwise |
| `${#var}` | Length of string |
| `${var:offset}` | Substring from offset |
| `${var:offset:len}` | Substring from offset, length len |
| `${var#pattern}` | Strip shortest prefix match |
| `${var##pattern}` | Strip longest prefix match |
| `${var%pattern}` | Strip shortest suffix match |
| `${var%%pattern}` | Strip longest suffix match |
| `${var/pat/rep}` | Replace first match |
| `${var//pat/rep}` | Replace all matches |
| `${var/#pat/rep}` | Replace prefix match |
| `${var/%pat/rep}` | Replace suffix match |
| `${var,,}` | Lowercase (bash 4+) |
| `${var^^}` | Uppercase (bash 4+) |
| `${var^}` | Capitalize first character |
| `${!var}` | Indirect reference (value of variable named by var) |
| `${!prefix@}` | All variable names matching prefix |

---

## String Operations Quick Reference

```bash
s="hello-world-2025"

# Length
echo ${#s}                    # 16

# Substring
echo ${s:6}                   # world-2025
echo ${s:6:5}                 # world

# Strip prefix
echo ${s#hello-}              # world-2025
echo ${s##*-}                 # 2025 (greedy)

# Strip suffix
echo ${s%-*}                  # hello-world (greedy)
echo ${s%%-*}                 # hello (greedy)

# Replace
echo ${s/world/universe}      # hello-universe-2025
echo ${s//-/_}                # hello_world_2025

# Case
echo ${s^^}                   # HELLO-WORLD-2025
echo ${s,,}                   # hello-world-2025

# Extract host/port from HOST:PORT
target="api.internal:8080"
host="${target%%:*}"          # api.internal
port="${target##*:}"          # 8080
```

---

## File Tests

```bash
[[ -e path ]]    # exists (any type)
[[ -f path ]]    # regular file
[[ -d path ]]    # directory
[[ -L path ]]    # symlink
[[ -r path ]]    # readable
[[ -w path ]]    # writable
[[ -x path ]]    # executable
[[ -s path ]]    # non-empty file
[[ -p path ]]    # named pipe (FIFO)
[[ -S path ]]    # socket
[[ -b path ]]    # block device
[[ -c path ]]    # character device

# Compare files
[[ file1 -nt file2 ]]   # file1 newer than file2
[[ file1 -ot file2 ]]   # file1 older than file2
[[ file1 -ef file2 ]]   # same file (hard link or same inode)
```

---

## Integer Comparisons

| Operator | Meaning |
|---|---|
| `-eq` | Equal |
| `-ne` | Not equal |
| `-gt` | Greater than |
| `-lt` | Less than |
| `-ge` | Greater than or equal |
| `-le` | Less than or equal |

```bash
[[ $count -eq 0 ]]
[[ $count -gt 5 ]]
(( count > 5 ))      # arithmetic context — same result
```

---

## Arithmetic

```bash
(( x = 5 + 3 ))       # assignment in arithmetic
(( x++ ))             # increment
(( x-- ))             # decrement
(( x *= 2 ))          # multiply-assign
result=$(( a + b ))   # capture result

# Powers and modulo
(( squared = x ** 2 ))
(( rem = 17 % 5 ))

# Hex/octal
(( hex = 0xFF ))
(( oct = 0777 ))

# Comparison returns exit code
if (( x > 10 )); then echo "big"; fi
```

---

## Arrays

```bash
# Declare
arr=(one two three)
declare -a arr=()

# Access
echo "${arr[0]}"        # first element
echo "${arr[-1]}"       # last element
echo "${arr[@]}"        # all elements
echo "${#arr[@]}"       # count
echo "${!arr[@]}"       # indices

# Modify
arr+=(four)             # append
arr[1]="TWO"            # set by index
unset 'arr[2]'          # delete element

# Iterate
for item in "${arr[@]}"; do echo "$item"; done

# Slice
echo "${arr[@]:1:2}"    # 2 elements from index 1

# Associative array
declare -A map
map[key]="value"
echo "${map[key]}"
for k in "${!map[@]}"; do echo "$k=${map[$k]}"; done

# mapfile
mapfile -t lines < file.txt
mapfile -t pods < <(kubectl get pods --no-headers -o name)
```

---

## Loops

```bash
# Range
for i in {1..10}; do echo "$i"; done
for i in {0..100..10}; do echo "$i"; done  # with step

# List
for item in a b c; do echo "$item"; done

# C-style
for ((i=0; i<10; i++)); do echo "$i"; done

# Array
for item in "${arr[@]}"; do echo "$item"; done

# While
while [[ $count -lt 10 ]]; do ((count++)); done

# Until
until kubectl rollout status deployment/app; do sleep 5; done

# Lines from file
while IFS= read -r line; do echo "$line"; done < file.txt

# Lines from command (no subshell)
while IFS= read -r line; do echo "$line"; done < <(cmd)

# Break and continue
for i in {1..10}; do
    [[ $i -eq 5 ]] && break     # exit loop
    [[ $i -eq 3 ]] && continue  # skip this iteration
    echo "$i"
done
```

---

## Functions

```bash
# Define
myfunc() {
    local arg1="$1"
    local arg2="${2:-default}"
    echo "args: $arg1 $arg2"
    return 0
}

# Call
myfunc "hello" "world"

# Capture return value (string)
result=$(myfunc "hello")

# Test exit code
if myfunc "hello"; then echo "success"; fi

# Recursive
factorial() {
    local n=$1
    (( n <= 1 )) && echo 1 && return
    echo $(( n * $(factorial $((n-1))) ))
}
```

---

## Redirection

```bash
cmd > file           # stdout to file (overwrite)
cmd >> file          # stdout to file (append)
cmd 2> file          # stderr to file
cmd 2>&1             # stderr to stdout
cmd &> file          # both stdout+stderr to file
cmd > file 2>&1      # same (portable)
cmd 2>/dev/null      # discard stderr
cmd &>/dev/null      # discard all output
cmd < file           # stdin from file
cmd <<< "string"     # here-string as stdin
cmd << EOF           # here-doc as stdin
data
EOF
cmd1 | cmd2          # pipe stdout to stdin
tee file             # copy stdin to file AND stdout
```

---

## Process Substitution

```bash
diff <(sort file1) <(sort file2)
while IFS= read -r line; do ...; done < <(cmd)
cmd | tee >(wc -l >&2)
```

---

## Trap

```bash
cleanup() { rm -f "$TMPFILE"; }
trap cleanup EXIT INT TERM ERR

# Reset a trap
trap - EXIT

# List traps
trap -l         # list signal names
trap -p         # show current trap commands
```

---

## Process Management

```bash
# Background
cmd &
bg_pid=$!
wait $bg_pid     # wait for specific PID
wait             # wait for all background jobs

# Kill
kill $pid         # SIGTERM (graceful)
kill -9 $pid      # SIGKILL (force)
kill -0 $pid      # test if process exists (no signal sent)

# Job control
jobs              # list background jobs
fg %1             # bring job 1 to foreground
bg %1             # send job 1 to background

# Check if running
if kill -0 "$pid" 2>/dev/null; then echo "running"; fi

# Parallel with limit
for host in "${hosts[@]}"; do
    check "$host" &
    # Limit parallelism
    while [[ $(jobs -r | wc -l) -ge 5 ]]; do sleep 0.1; done
done
wait
```

---

## Common Patterns

```bash
# Require env var
: "${MYVAR:?MYVAR must be set}"

# Require command
command -v jq >/dev/null || { echo "jq required" >&2; exit 1; }

# Timestamp
date -u '+%Y-%m-%dT%H:%M:%SZ'
date +%s%3N   # milliseconds since epoch

# Temp file
TMPFILE=$(mktemp)
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPFILE" "$TMPDIR"' EXIT

# Atomic write
tmp=$(mktemp "${dest}.XXXXXX")
generate_content > "$tmp"
mv -f "$tmp" "$dest"

# Lock file
exec 9>/var/run/script.lock
flock -n 9 || { echo "already running" >&2; exit 1; }

# Retry loop
for i in 1 2 3; do
    cmd && break
    sleep $((i * 2))
done

# Dry-run guard
[[ "${DRY_RUN:-false}" == "true" ]] && { echo "dry run"; exit 0; }

# Check if sourced vs executed
[[ "${BASH_SOURCE[0]}" == "${0}" ]] && main "$@"

# Self-referencing script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

---

## Debugging

```bash
set -x          # trace on
set +x          # trace off
bash -x s.sh    # trace from outside
bash -n s.sh    # syntax check only
shellcheck s.sh # static analysis

declare -p var  # print type and value
echo "${var@Q}" # print safely quoted

# Custom PS4 with function and line
PS4='+ ${FUNCNAME[0]:+${FUNCNAME[0]}():}line ${LINENO}: '
```

---

## Key One-Liners

```bash
# Count HTTP status codes in nginx log
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Top disk users
du -sh /var/* 2>/dev/null | sort -rh | head -10

# Find large files
find /var/log -type f -size +100M -printf '%s %p\n' 2>/dev/null | sort -rn | head -10

# Test TCP port
timeout 3 bash -c "echo > /dev/tcp/hostname/8080" && echo open || echo closed

# Watch pods
watch -n 5 'kubectl get pods -A'

# Socket connection states
ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c

# Find processes listening on a port
ss -tlnp | grep ':8080'

# Delete failed pods
kubectl get pods -A --field-selector=status.phase=Failed -o name | xargs kubectl delete

# Get all container images in cluster
kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u
```
