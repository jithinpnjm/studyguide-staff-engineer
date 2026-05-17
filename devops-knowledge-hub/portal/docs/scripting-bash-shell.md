---
title: "💻 Bash & Shell Scripting"
sidebar_position: 16
description: "Zero to hero study guide for Bash & Shell Scripting — concepts, tools, architecture, production operations, and interview prep."
---

## What is Shell Scripting?

Shell scripting automates tasks in Unix/Linux by using shell commands. It is the backbone of server automation, CI/CD pipelines, cron jobs, Docker entrypoints, and Kubernetes init containers.

**Why use shell scripting?**

- Automate repetitive tasks
- Manage system operations efficiently
- Schedule tasks using cron jobs

---

## Getting Started: The Shebang

Every script starts with `#!/bin/bash` to declare the interpreter:

```bash
#!/bin/bash
echo "Hello, World!"
```

Output:
```
Hello, World!
```

---

## Variables

```bash
#!/bin/bash
name="John Doe"
echo "Hello, $name"
```

Output:
```
Hello, John Doe
```

### Reading Input from User

```bash
#!/bin/bash
echo "Enter your name: "
read name
echo "Hello, $name"
```

Input: `Alice`
Output: `Hello, Alice`

### Default Values and Required Variables

```bash
# Default value if unset
PORT=${PORT:-8080}

# Exit with message if unset
ENV=${APP_ENV:?APP_ENV must be set}

# Command substitution
current_date=$(date +%Y-%m-%d)
pod_count=$(kubectl get pods -n prod --no-headers | wc -l)

# Arithmetic
total=$((free_mem + used_mem))
percent=$(( used_mem * 100 / total_mem ))
```

---

## Conditional Statements (if-else)

```bash
#!/bin/bash
read num
if [ $num -gt 10 ]; then
    echo "Greater than 10"
else
    echo "10 or less"
fi
```

Input: `12`
Output: `Greater than 10`

### Extended Test Syntax `[[ ]]`

`[[ ]]` is always preferred over `[ ]` in bash scripts:

```bash
# File tests
[[ -f /etc/passwd ]]     # regular file exists
[[ -d /var/log ]]        # directory exists
[[ -r /etc/secret ]]     # file is readable
[[ -s /tmp/data.csv ]]   # file is non-empty
[[ -L /usr/bin/python ]] # is symlink

# String tests
[[ -z "$var" ]]          # empty string
[[ -n "$var" ]]          # non-empty string
[[ "$a" == "$b" ]]       # string equal
[[ "$a" != "$b" ]]       # string not equal

# Integer tests
[[ $count -eq 0 ]]       # equal
[[ $count -gt 5 ]]       # greater than
[[ $count -le 100 ]]     # less than or equal

# Compound conditions
[[ -f "$file" && -s "$file" ]]   # file exists AND non-empty
[[ "$env" == "prod" || "$env" == "production" ]]
```

---

## Loops

### For Loop

```bash
#!/bin/bash
for i in {1..5}; do
    echo "Iteration $i"
done
```

Output:
```
Iteration 1
Iteration 2
Iteration 3
Iteration 4
Iteration 5
```

### While Loop

```bash
#!/bin/bash
count=1
while [ $count -le 3 ]; do
    echo "Count: $count"
    ((count++))
done
```

Output:
```
Count: 1
Count: 2
Count: 3
```

### C-style For Loop

```bash
for ((i=0; i<10; i++)); do
    echo "Iteration $i"
done
```

### Reading Lines Safely

```bash
# Safe pattern — no subshell per line
while IFS= read -r line; do
    echo "Processing: $line"
done < <(kubectl get pods -n prod --no-headers -o custom-columns="NAME:.metadata.name")
```

### Until Loop

```bash
until kubectl rollout status deployment/payment -n prod; do
    echo "Waiting for rollout..."
    sleep 5
done
```

---

## Functions

### Defining Functions

```bash
#!/bin/bash
function greet() {
    echo "Hello, $1!"
}
greet "Alice"
```

Output: `Hello, Alice!`

### Common Utility Functions

```bash
# Log and error helpers
die() {
    echo "[ERROR] $*" >&2
    exit 1
}

require_env() {
    local var="$1"
    [[ -n "${!var:-}" ]] || die "Required env var $var is not set"
}

log() {
    echo "[$(date +%T)] $*"
}

# Usage
require_env DATABASE_URL
require_env API_KEY
log "Starting deployment"
```

### Returning Values

Functions return 0 (success) or non-zero (failure):

```bash
is_healthy() {
    local url="$1"
    curl -sf --max-time 5 "$url/health" &>/dev/null
}

if is_healthy "http://payment:8080"; then
    log "Payment service is healthy"
else
    die "Payment service health check failed"
fi
```

---

## String Operations

```bash
#!/bin/bash
str="Welcome to Linux"

# Substring (from position 11)
echo "Substring: ${str:11}"      # Linux

# String replacement
echo ${str/Linux/Unix}           # Welcome to Unix
```

Output:
```
Substring: Linux
Welcome to Unix
```

### Concatenation

```bash
#!/bin/bash
str1="Hello"
str2="World"
concat="$str1 $str2"
echo "$concat"
```

Output: `Hello World`

### More String Manipulations

```bash
filename="backup-2025-01-15.tar.gz"

# Strip prefix/suffix
echo "${filename#backup-}"      # 2025-01-15.tar.gz
echo "${filename%.tar.gz}"      # backup-2025-01-15

# Replace
echo "${filename/-/_}"          # backup_2025-01-15.tar.gz  (first match)
echo "${filename//-/_}"         # backup_2025_01_15.tar.gz  (all matches)

# Case conversion (bash 4+)
env="PRODUCTION"
echo "${env,,}"                 # production
echo "${env^}"                  # Production

# Length
echo "${#filename}"             # 23

# Check if string contains substring
if [[ "$filename" == *".gz" ]]; then
    echo "Compressed file"
fi

# Regex match
if [[ "$filename" =~ ^backup-([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
    echo "Date: ${BASH_REMATCH[1]}"
fi
```

---

## Command Line Arguments

```bash
#!/bin/bash
echo "First arg: $1"
echo "Second arg: $2"
```

Command: `./script.sh Alice Bob`

Output:
```
First arg: Alice
Second arg: Bob
```

---

## Error Handling

### set -e (exit on error)

```bash
#!/bin/bash
set -e
echo "This will execute"
ls non_existent_file
echo "This will not execute"
```

Output:
```
ls: cannot access 'non_existent_file': No such file or directory
```

### Strict Mode — Always Use This

```bash
#!/usr/bin/env bash
set -euo pipefail

# set -e  → exit on any error
# set -u  → treat unset variables as errors
# set -o pipefail → catch errors in pipes
```

Allow optional commands that may fail:

```bash
set -euo pipefail

backup_old_config() {
    cp /etc/myapp/config.yaml /etc/myapp/config.yaml.bak || true
}

if ! command -v kubectl &>/dev/null; then
    echo "kubectl not installed" >&2
    exit 1
fi
```

### Trap for Cleanup

```bash
cleanup() {
    local exit_code=$?
    echo "Cleaning up (exit code: $exit_code)"
    rm -f "$TMPFILE"
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

TMPFILE=$(mktemp)
```

### Retry Logic

```bash
retry() {
    local retries="$1"
    local delay="$2"
    shift 2
    local attempt=1
    while true; do
        "$@" && return 0
        if [[ $attempt -ge $retries ]]; then
            echo "Command failed after $retries attempts: $*" >&2
            return 1
        fi
        echo "Attempt $attempt failed, retrying in ${delay}s..."
        sleep "$delay"
        delay=$((delay * 2))   # exponential backoff
        ((attempt++))
    done
}

# Usage
retry 3 2 curl -sf "https://api.example.com/health"
```

---

## Debugging

### set -x (debug mode)

```bash
#!/bin/bash
set -x
echo "Debugging Mode"
set +x
```

Output:
```
+ echo 'Debugging Mode'
Debugging Mode
```

### Other debugging techniques

```bash
# Trace a specific section only
set -x
some_tricky_function
set +x

# Run script with trace from outside
bash -x myscript.sh

# Lint with shellcheck
shellcheck myscript.sh

# Print variable state
declare -p my_array    # shows type and value
```

---

## Regular Expressions, Pipes, and Redirection

```bash
# Regular expressions
grep "error" logfile.txt
sed 's/Linux/Unix/g' file.txt
awk '{print $1}' file.txt

# Pipe and redirection
ls -l | grep "txt"
echo "Hello" > file.txt
cat file.txt >> newfile.txt
```

---

## Subshell and Background Processes

```bash
# Subshell example
#!/bin/bash
(cd /tmp && ls)

# Background and foreground
./script.sh &
fg
```

---

## Environmental Variables

```bash
echo $HOME
echo $PATH
```

---

## Scheduling Jobs (cron)

```bash
crontab -e
# Run script at 6:00 AM every day
0 6 * * * /path/to/script.sh
```

---

## Process Management

```bash
# List processes
ps aux | grep bash

# Kill by PID
kill -9 PID

# Check port is listening
if ss -tlnp | grep -q ":8080 "; then
    echo "Port 8080 is open"
fi
```

---

## Linux Command Reference

### File and Directory Management

```bash
# 1. ls — list directory contents
ls -la Directory

# 2. cd — change directory
cd /home

# 3. pwd — print current directory
pwd

# 4. mkdir — create directory
mkdir /home/Directory

# 5. rmdir — remove empty directory
rmdir /home/Directory

# 6. rm — delete files and directories
rm -rf /home/Directory

# 7. cp — copy files or directories
cp -r Directory /backup/

# 8. mv — move or rename files
mv file /home/Directory/

# 9. touch — create empty file
touch /home/Directory/newfile

# 10. cat — display file contents
cat file

# 11. head — show first few lines
head -n 5 file

# 12. tail — show last few lines; live follow
tail -n 5 file
tail -f /var/log/syslog

# 13. find — search for files
find /home -type f -name "*.sh"

# 14. du — disk usage
du -sh Directory
du -h Directory

# 15. df — disk space usage
df -h

# 16. stat — detailed file status
stat file

# 17. tree — directory structure
tree /home
```

### File Permissions and Ownership

```bash
# chmod — change file permissions
chmod 755 file
chmod +x script.sh

# chown — change file ownership
chown root file

# chgrp — change group ownership
chgrp admin file

# umask — set default permissions
umask 022
```

### Essential Linux Hacks

```bash
# CDPATH — define base directory for cd
export CDPATH=/home/user/projects

# Toggle between directories
cd -

# Push/pop directory stack
pushd /tmp
popd

# Grep with regular expressions
grep -E "error|warning" logfile.txt
grep -c "ERROR" /var/log/app.log

# Find files modified recently
find /var/log -name "*.log" -newer /tmp/yesterday -type f

# xargs — build commands from output
find /tmp -name "*.tmp" | xargs rm -f

# Sort and unique
sort file.txt | uniq -c | sort -rn

# AWK — extract field
awk -F',' '{print $3}' data.csv
awk -F',' '{sum += $2} END {print sum}' metrics.csv

# sed — find and replace
sed 's/Linux/Unix/g' file.txt
```

---

## Real-World Example: Backup Script

```bash
#!/bin/bash

backup_dir="/backup"

mkdir -p $backup_dir

tar -czf $backup_dir/backup_$(date +%F).tar.gz /home/user/

echo "Backup completed!"
```

---

## Working with Files and Processes

```bash
# Watch a log file for errors
tail -f /var/log/app.log | grep --line-buffered "FATAL" | while IFS= read -r line; do
    echo "FATAL: $line"
    # send alert here
done

# Disk usage — top 10 directories
du -sh /var/* 2>/dev/null | sort -rh | head -10
```

---

## Kubernetes Bash Patterns

```bash
# Wait for deployment rollout
wait_for_rollout() {
    local ns="$1"
    local deploy="$2"
    local timeout="${3:-300}"
    kubectl rollout status deployment/"$deploy" -n "$ns" --timeout="${timeout}s"
}

# Get pod logs from all replicas
get_all_logs() {
    local ns="$1"
    local selector="$2"
    kubectl get pods -n "$ns" -l "$selector" --no-headers -o name | while IFS= read -r pod; do
        echo "=== $pod ==="
        kubectl logs -n "$ns" "$pod" --tail=50
    done
}

# Restart all pods in namespace
kubectl rollout restart deployment -n "$NAMESPACE"

# Delete stuck terminating pods
kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed -o name | \
    xargs -r kubectl delete -n "$NAMESPACE" --force --grace-period=0
```

---

## Script Templates

### Deployment Script

```bash
#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:?NAMESPACE required}"
IMAGE="${IMAGE:?IMAGE required}"
DRY_RUN="${DRY_RUN:-false}"

log()  { echo "[$(date +%T)] INFO  $*"; }
warn() { echo "[$(date +%T)] WARN  $*" >&2; }
die()  { echo "[$(date +%T)] ERROR $*" >&2; exit 1; }

cleanup() { log "Done (exit $?)"; }
trap cleanup EXIT

main() {
    log "Deploying $IMAGE to namespace $NAMESPACE"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run — skipping actual deploy"
        return 0
    fi

    kubectl set image deployment/myapp \
        myapp="$IMAGE" \
        -n "$NAMESPACE"

    kubectl rollout status deployment/myapp \
        -n "$NAMESPACE" \
        --timeout=300s

    log "Deployment successful"
}

main "$@"
```

### Health Check Script

```bash
#!/usr/bin/env bash
set -euo pipefail

ENDPOINTS=(
    "http://payment:8080/health"
    "http://auth:8081/health"
    "http://inventory:8082/health"
)

FAILED=()

for url in "${ENDPOINTS[@]}"; do
    if curl -sf --max-time 5 "$url" &>/dev/null; then
        echo "[OK]   $url"
    else
        echo "[FAIL] $url"
        FAILED+=("$url")
    fi
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo "Failed endpoints: ${FAILED[*]}" >&2
    exit 1
fi

echo "All ${#ENDPOINTS[@]} endpoints healthy"
```

---

## Common One-Liners

```bash
# Delete all failed pods
kubectl get pods -A --field-selector=status.phase=Failed -o name | xargs kubectl delete

# Follow logs from pods matching label
kubectl get pods -l app=payment -o name | head -1 | xargs kubectl logs -f

# Get all container images in cluster
kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u

# Find large files
find / -xdev -type f -size +100M -printf '%s %p\n' 2>/dev/null | sort -rn | head -10

# Count HTTP status codes in nginx access log
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Test if TCP port is open
timeout 3 bash -c "cat < /dev/null > /dev/tcp/hostname/8080" && echo open || echo closed
```

---

## Performance Tips

```bash
# GOOD: process substitution, no extra subshell
while IFS= read -r line; do
    echo "Processing: $line"
done < file.txt

# GOOD: use mapfile to read array from command output
mapfile -t pods < <(kubectl get pods -n prod --no-headers -o name)
echo "Pod count: ${#pods[@]}"
```

---

## Interview Prep

**"What does `set -euo pipefail` do?"**
`-e`: exit on any non-zero exit code. `-u`: error on unset variables. `-o pipefail`: propagate pipe failures (without it, `false | true` exits 0). Together they make scripts fail fast and explicit.

**"How do you safely handle user input in a script?"**
Never use `eval` or pass user input directly to `rm`. Use `--` to separate options from arguments (`rm -- "$file"`). Validate with regex before using in commands. Use `printf '%q'` if you must construct command strings.

**"How do you write a production deployment script?"**
Strict mode (`set -euo pipefail`), trap for cleanup on exit, logging with timestamps to stdout, required env var validation, dry-run mode, rollout status wait with timeout, and smoke test before exit 0.

**"Bash vs Python for automation — when do you choose which?"**
Bash for gluing Unix tools, simple file ops, and one-liners under 50 lines. Python once you need data structures, retry logic, async I/O, SDK clients, or anything that will grow. If you're adding `awk`, `sed`, and `grep` in the same script, consider Python.

**"How do you debug a bash script?"**
Use `set -x` to trace execution line by line, or run `bash -x myscript.sh` from outside. Use `shellcheck myscript.sh` to catch common mistakes before running. Use `declare -p` to inspect variable state.

---
