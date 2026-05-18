---
title: "Beginner"
sidebar_position: 1
---

# Beginner: Bash & Shell Scripting

Bash is both an interactive shell and a scripting language. It mostly orchestrates other programs using the Unix philosophy: small tools that do one thing well, combined with pipes.

```
stdin  -> input
stdout -> normal output
stderr -> errors
exit code -> success/failure
```

---

## Mental Model: Bash Is a Toolbox

| Bash Concept | Analogy | Meaning |
|---|---|---|
| Shell | Workbench | Where commands are assembled |
| Command | Tool | Does one job |
| Pipe | Hose connector | Sends output into the next tool |
| Variable | Label | Stores a reusable value |
| Function | Tool bundle | Reusable operation |
| Exit Code | Status light | Success or failure |
| Trap | Cleanup hook | Runs on exit or interruption |
| Script | Procedure card | Repeatable automation |

---

## The Shebang

Every script starts with a shebang to declare the interpreter:

```bash
#!/usr/bin/env bash
echo "Hello, World!"
```

Using `/usr/bin/env bash` is preferred over `/bin/bash` because it finds `bash` from `PATH`, making scripts portable across environments where bash lives in different locations.

Make the script executable:

```bash
chmod +x myscript.sh
./myscript.sh
```

---

## Terminal Fluency

Navigation and file management:

```bash
pwd               # print working directory
ls -lah           # list with sizes and hidden files
cd /path          # change directory
mkdir demo        # create directory
touch file.txt    # create empty file
cp a b            # copy
mv a b            # move or rename
rm file.txt       # delete file
rm -rf dir/       # delete directory recursively
```

Reading files:

```bash
less file              # page through file
head -20 file          # first 20 lines
tail -50 file          # last 50 lines
tail -f /var/log/app.log   # live follow
```

Getting help:

```bash
man grep           # manual page
grep --help        # inline help
which kubectl      # locate a binary
type cd            # what kind of command is this
history            # command history
```

---

## Variables

Assign with `=` (no spaces around `=`):

```bash
name="cluster-a"
echo "$name"
```

Always quote variables unless you intentionally want word splitting or glob expansion.

Risky — word splitting and glob expansion can corrupt filenames with spaces:

```bash
echo $name
```

Safe:

```bash
echo "$name"
```

### Default Values and Guards

```bash
# Use default value if variable is unset or empty
PORT=${PORT:-8080}

# Exit immediately with a message if variable is unset
ENV=${APP_ENV:?APP_ENV must be set}

# Assign only if the variable is currently unset
: "${LOG_LEVEL:=info}"
```

### Command Substitution

Capture command output into a variable:

```bash
current_date=$(date +%Y-%m-%d)
pod_count=$(kubectl get pods -n prod --no-headers | wc -l)
now=$(date +%F-%H%M)
```

### Arithmetic

```bash
total=$((free_mem + used_mem))
percent=$(( used_mem * 100 / total_mem ))
count=0
((count++))
```

---

## Quoting Rules

Understanding quoting is one of the most important fundamentals:

| Quoting | Behavior |
|---|---|
| `"$var"` | Variable expands, spaces preserved |
| `'$var'` | No expansion, literal string |
| `$var` | Word splitting applies — dangerous with spaces |
| `"$(cmd)"` | Command substitution inside double quotes |

Example:

```bash
file="my file.txt"

# Wrong: passes two arguments "my" and "file.txt"
rm $file

# Right: passes one argument "my file.txt"
rm "$file"
```

---

## Exit Codes

Every command returns an exit code. `0` means success; any non-zero value means failure.

```bash
# Check exit code of last command
curl -sf https://example.com/health
echo $?    # 0 = success, non-zero = failure
```

Better pattern — test directly:

```bash
if curl -sf https://example.com/health; then
  echo healthy
else
  echo unhealthy
fi
```

Common exit codes:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Misuse of shell built-in |
| 126 | Command not executable |
| 127 | Command not found |
| 130 | Script terminated by Ctrl+C (128 + 2) |

---

## Conditional Statements

### Basic if-else

```bash
read num
if [ $num -gt 10 ]; then
    echo "Greater than 10"
else
    echo "10 or less"
fi
```

### Extended Test Syntax `[[ ]]`

`[[ ]]` is always preferred over `[ ]` in bash scripts — it handles edge cases better and supports regex:

```bash
# File tests
[[ -f /etc/passwd ]]     # regular file exists
[[ -d /var/log ]]        # directory exists
[[ -r /etc/secret ]]     # file is readable
[[ -w /tmp/out ]]        # file is writable
[[ -x /usr/bin/bash ]]   # file is executable
[[ -s /tmp/data.csv ]]   # file is non-empty
[[ -L /usr/bin/python ]] # is a symlink

# String tests
[[ -z "$var" ]]          # empty string
[[ -n "$var" ]]          # non-empty string
[[ "$a" == "$b" ]]       # string equal
[[ "$a" != "$b" ]]       # string not equal
[[ "$a" < "$b" ]]        # lexicographic less than

# Integer tests
[[ $count -eq 0 ]]       # equal
[[ $count -ne 0 ]]       # not equal
[[ $count -gt 5 ]]       # greater than
[[ $count -lt 5 ]]       # less than
[[ $count -le 100 ]]     # less than or equal
[[ $count -ge 100 ]]     # greater than or equal

# Compound conditions
[[ -f "$file" && -s "$file" ]]   # file exists AND non-empty
[[ "$env" == "prod" || "$env" == "production" ]]
```

### case Statement

```bash
case "$ENV" in
  prod|production)
    echo "Production environment"
    ;;
  staging)
    echo "Staging environment"
    ;;
  *)
    echo "Unknown environment: $ENV"
    exit 1
    ;;
esac
```

---

## Loops

### For Loop — Range

```bash
for i in {1..5}; do
    echo "Iteration $i"
done
```

### For Loop — List

```bash
for service in payment auth inventory; do
    echo "Checking $service"
done
```

### For Loop — C-style

```bash
for ((i=0; i<10; i++)); do
    echo "Iteration $i"
done
```

### While Loop

```bash
count=1
while [[ $count -le 3 ]]; do
    echo "Count: $count"
    ((count++))
done
```

### Until Loop

```bash
until kubectl rollout status deployment/payment -n prod; do
    echo "Waiting for rollout..."
    sleep 5
done
```

### Reading Lines Safely

The safest pattern for reading lines from a file or command output:

```bash
# From a file — no subshell per line
while IFS= read -r line; do
    echo "Processing: $line"
done < file.txt

# From a command — process substitution avoids a subshell
while IFS= read -r line; do
    echo "Processing: $line"
done < <(kubectl get pods -n prod --no-headers -o custom-columns="NAME:.metadata.name")
```

`IFS=` prevents stripping of leading/trailing whitespace. `-r` prevents backslash interpretation.

---

## Functions

### Defining Functions

```bash
greet() {
    echo "Hello, $1!"
}
greet "Alice"   # Hello, Alice!
```

Both `function greet()` and `greet()` work. The second form is POSIX-compatible.

### Returning Values

Functions return 0 for success and non-zero for failure via `return`. To return a string, print it and capture with `$()`:

```bash
is_healthy() {
    local url="$1"
    curl -sf --max-time 5 "$url/health" &>/dev/null
}

if is_healthy "http://payment:8080"; then
    echo "Payment service is healthy"
else
    echo "Payment service health check failed" >&2
    exit 1
fi
```

### Common Utility Functions for SRE Scripts

```bash
log()  { printf '[%s] INFO  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
warn() { printf '[%s] WARN  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }
die()  { printf '[%s] ERROR %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; exit 1; }

require_env() {
    local var="$1"
    [[ -n "${!var:-}" ]] || die "Required env var $var is not set"
}

require() {
    command -v "$1" >/dev/null || die "missing required command: $1"
}

# Usage
require kubectl
require jq
require_env DATABASE_URL
require_env API_KEY
log "Starting deployment"
```

---

## Reading Input

```bash
echo "Enter your name: "
read name
echo "Hello, $name"
```

Read with a prompt (no separate echo needed):

```bash
read -p "Enter environment [staging/prod]: " env
```

Read silently for passwords:

```bash
read -s -p "Enter password: " password
echo ""
```

---

## Command Line Arguments

```bash
echo "Script name: $0"
echo "First arg:   $1"
echo "Second arg:  $2"
echo "All args:    $@"
echo "Arg count:   $#"
```

Run: `./script.sh Alice Bob`

```
Script name: ./script.sh
First arg:   Alice
Second arg:  Bob
All args:    Alice Bob
Arg count:   2
```

Check required arguments:

```bash
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 HOST PORT" >&2
    exit 1
fi
host="$1"
port="$2"
```

---

## Environment Variables

```bash
echo $HOME       # home directory
echo $PATH       # command search path
echo $USER       # current user
echo $SHELL      # current shell
echo $PWD        # current directory (same as pwd)
echo $HOSTNAME   # machine hostname
```

Export a variable so subprocesses can see it:

```bash
export MY_VAR="value"
```

---

## Basic Scheduling (cron)

```bash
crontab -e   # edit your crontab

# Format: minute hour day-of-month month day-of-week command
0 6 * * *     /opt/scripts/backup.sh          # 6 AM daily
*/5 * * * *   /opt/scripts/health-check.sh    # every 5 minutes
0 2 * * 0     /opt/scripts/weekly-cleanup.sh  # 2 AM every Sunday
```

---

## Simple Script Template

A minimal production-ready script:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage
usage() {
    echo "Usage: $0 <environment>"
    exit 1
}

[[ $# -lt 1 ]] && usage

ENV="$1"

log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

log "Starting for environment: $ENV"

# Your logic here

log "Done"
```

---

## Key Takeaways for Beginners

- Always start scripts with `#!/usr/bin/env bash`
- Always quote variables: `"$var"`, not `$var`
- Use `[[ ]]` not `[ ]` for conditionals
- Test exit codes — don't assume commands succeed
- Write to stderr for errors: `echo "error" >&2`
- Use functions to make scripts readable
- Use `IFS= read -r` when reading lines
