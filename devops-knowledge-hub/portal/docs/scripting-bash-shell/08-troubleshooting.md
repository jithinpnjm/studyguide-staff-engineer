---
title: "Troubleshooting"
sidebar_position: 8
---

# Troubleshooting: Bash & Shell Scripting

Ten runbooks for the bugs that consistently trip up SREs in production scripts. Each section covers how to diagnose the symptom, what actually causes it, and the correct fix.

---

## 1. Word Splitting and Glob Expansion Bugs (Unquoted Variables)

### Symptom

Script works on simple input, breaks silently on filenames with spaces or special characters. Commands receive extra arguments you didn't pass.

```bash
# Bug: file with spaces is split into two arguments
file="my report.pdf"
rm $file          # rm tries to delete "my" and "report.pdf" separately

# Bug: glob expands unexpectedly
pattern="*.log"
ls $pattern       # shell expands *.log here, not in ls
```

### Diagnosis

Run with `set -x` to see what the shell actually passes to each command:

```bash
set -x
file="my report.pdf"
rm $file
# output: + rm my report.pdf   <- two separate args
set +x
```

Check if IFS has been modified:

```bash
declare -p IFS    # default is ' \t\n'
```

### Fix

Always double-quote variable expansions. Use `[[ ]]` instead of `[ ]` to avoid word splitting in conditionals.

```bash
# Correct
file="my report.pdf"
rm "$file"            # single argument, space preserved

# Correct: array for multiple values
files=("report one.pdf" "report two.pdf")
rm "${files[@]}"      # each element is a separate, quoted argument

# Correct: preserve IFS when reading
while IFS= read -r line; do
    process "$line"
done < input.txt

# Correct: prevent glob expansion when it is not wanted
pattern='*.log'
ls "$pattern"         # literal *.log passed to ls
# Or use -- with set -f / set +f:
set -f
ls $pattern           # no glob expansion
set +f
```

**Rule of thumb**: quote every `$variable` and `${expression}` unless you explicitly need word splitting. The only safe exceptions are arithmetic contexts `(( ))` and `[[ ]]` with `==` or `=~`.

---

## 2. Unbound Variable Errors (`set -u` Failures)

### Symptom

Script exits unexpectedly with `unbound variable` after adding `set -u`. Optional variables that should be empty now crash the script.

```bash
set -euo pipefail
echo "$OPTIONAL_VAR"   # exits: OPTIONAL_VAR: unbound variable
```

### Diagnosis

Find every variable reference that may be unset:

```bash
# Grep for bare $VAR references
grep -n '\$[A-Z_][A-Z0-9_]*' script.sh | grep -v ':-\|:=\|:?\|:+'

# Check which variable triggered the error
bash -x script.sh 2>&1 | grep "unbound"
```

### Fix

Use the correct parameter expansion form for each case:

```bash
# Optional var with empty default
val="${OPTIONAL_VAR:-}"

# Optional var with non-empty default
val="${OPTIONAL_VAR:-default_value}"

# Required var — exit with message if unset
val="${REQUIRED_VAR:?REQUIRED_VAR must be set}"

# Assign default and export
: "${PORT:=8080}"
export PORT

# Conditional use — check before use
if [[ -n "${OPTIONAL_VAR:-}" ]]; then
    do_something "$OPTIONAL_VAR"
fi

# Positional args — safe access
arg1="${1:-}"
arg2="${2:-default}"

# Arrays — check length before indexing
if [[ ${#arr[@]} -gt 0 ]]; then
    echo "${arr[0]}"
fi
```

**Pattern for scripts that accept optional flags:**

```bash
#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${DRY_RUN:-false}"
NAMESPACE="${NAMESPACE:-default}"
TIMEOUT="${TIMEOUT:-30}"
```

Define all optional variables at the top with defaults so `set -u` never fires unexpectedly.

---

## 3. Exit Code Not Propagating Through Pipes (pipefail, PIPESTATUS)

### Symptom

A command in a pipeline fails, but the script continues because the last command in the pipe succeeded. `set -e` does not catch it.

```bash
# Bug: grep exits 1 if no match, but tee exits 0, so || never triggers
grep "ERROR" app.log | tee errors.txt || echo "no errors found"
# prints nothing — the grep failure is swallowed

# Bug: pg_dump fails, but gzip succeeds with empty input
pg_dump mydb | gzip > backup.sql.gz   # backup is a valid empty gzip file
```

### Diagnosis

Inspect `$PIPESTATUS` — it is an array of exit codes from each command in the most recent pipeline:

```bash
grep "ERROR" app.log | tee errors.txt
echo "${PIPESTATUS[@]}"   # e.g., "1 0" — grep failed, tee succeeded
```

### Fix

Add `set -o pipefail` to your script header. With pipefail, the pipeline exit code is the exit code of the last command that failed (rightmost non-zero), not the last command.

```bash
#!/usr/bin/env bash
set -euo pipefail    # pipefail is the key addition

# Now this correctly fails if pg_dump fails:
pg_dump mydb | gzip > backup.sql.gz

# For fine-grained control, read PIPESTATUS immediately after the pipeline:
grep "ERROR" app.log | tee errors.txt
grep_exit="${PIPESTATUS[0]}"
tee_exit="${PIPESTATUS[1]}"

if [[ $grep_exit -eq 1 ]]; then
    echo "No errors found"
elif [[ $grep_exit -ne 0 ]]; then
    echo "grep failed with exit $grep_exit" >&2
    exit 1
fi

# Alternative: capture and test separately
errors=$(grep "ERROR" app.log 2>/dev/null) || true
if [[ -z "$errors" ]]; then
    echo "No errors"
fi
```

**Caveat**: `pipefail` can break scripts that intentionally use `grep` or `head` in pipelines where "no match" is a valid result. Suppress those with `|| true`:

```bash
matched=$(grep "pattern" file.txt || true)
```

---

## 4. Subshell Scope Problems (Variables Set Inside Loops/Subshells Lost)

### Symptom

A variable modified inside a loop or subshell has its old value after the loop finishes. Counter never increments. Collected results are always empty.

```bash
# Bug: pipe creates a subshell — count stays 0 in parent
count=0
grep "ERROR" app.log | while IFS= read -r line; do
    (( count++ ))
done
echo "Errors: $count"   # always prints 0
```

### Diagnosis

Any command after `|` runs in a subshell. The subshell inherits a copy of the parent's variables, but mutations do not propagate back.

```bash
# Confirm with echo $$
echo "parent PID: $$"
echo "subshell PID: $(echo $$)"    # same PID — $$ is special
echo "subshell PID: $BASHPID"      # actual subshell PID — different
```

Also triggered by:
- `var=$(command)` — command runs in subshell (intentional, but vars set inside are lost)
- `( commands )` — explicit subshell
- `cmd | while read` — pipe + while loop

### Fix

Use process substitution `< <(cmd)` to avoid the pipe subshell:

```bash
# Fix: process substitution keeps the while loop in the parent shell
count=0
while IFS= read -r line; do
    (( count++ ))
done < <(grep "ERROR" app.log)
echo "Errors: $count"   # correct

# Fix: accumulate into an array
results=()
while IFS= read -r item; do
    results+=("$item")
done < <(kubectl get pods --no-headers -o name)
echo "Found ${#results[@]} pods"

# Fix: mapfile (bash 4+) — reads all lines into array
mapfile -t pods < <(kubectl get pods --no-headers -o name)

# Fix: if you need the pipe, use a temp file
grep "ERROR" app.log > /tmp/errors.txt
count=$(wc -l < /tmp/errors.txt)
```

---

## 5. Trap Not Firing / Firing at Wrong Time

### Symptom

Cleanup function does not run when the script exits. Temp files are not deleted. Or `ERR` trap fires too eagerly and masks the real exit code.

```bash
# Bug: trap defined after the command that might fail
cmd_that_might_fail
trap cleanup EXIT   # too late if the above already exited

# Bug: ERR trap fires inside functions and masks the return code
set -e
trap 'echo "error on line $LINENO"' ERR
some_function() { false; }   # ERR fires inside the function
```

### Diagnosis

```bash
trap -p           # show all active traps
trap -p EXIT      # show just EXIT trap
trap -p ERR       # show ERR trap

# Check if a trap is inherited into a subshell
( trap -p EXIT )  # traps are NOT inherited into subshells by default
```

### Fix

**Always define traps at the top of the script**, before any code that can fail:

```bash
#!/usr/bin/env bash
set -euo pipefail

TMPFILE=""

cleanup() {
    local exit_code=$?
    [[ -n "$TMPFILE" ]] && rm -f "$TMPFILE"
    if [[ $exit_code -ne 0 ]]; then
        echo "[ERROR] Script failed on line ${BASH_LINENO[0]}" >&2
    fi
    exit "$exit_code"
}
trap cleanup EXIT        # always runs on exit
trap cleanup INT TERM    # also on signals

TMPFILE=$(mktemp)
# ... rest of script ...
```

**Signal-specific guidance:**

```bash
# EXIT — runs on any exit (normal, error, signal)
trap cleanup EXIT

# ERR — runs when a command returns non-zero (with set -e)
# Avoid ERR trap with functions — it fires inside functions too
# Use EXIT instead and capture exit code there

# SIGTERM — sent by systemd / kubernetes before pod kill
trap 'echo "SIGTERM received — draining"; exit 0' TERM

# Stack traps (add to existing instead of replacing)
trap_add() {
    local sig="$1"; shift
    local existing
    existing=$(trap -p "$sig" | awk -F"'" '{print $2}')
    trap "${existing:+$existing; }$*" "$sig"
}
trap_add EXIT "rm -f /tmp/lock.$$"
trap_add EXIT "log 'done'"
```

**Traps and subshells**: traps are NOT inherited into subshells. Functions that run in the same shell DO inherit them.

---

## 6. Script Hangs Waiting for Input (Reads from stdin Unexpectedly)

### Symptom

Script hangs indefinitely. No output. The process is waiting for keyboard input when none is expected. Common in cron jobs and CI pipelines.

```bash
# Bug: kubectl, ssh, or a wrapped tool reads from stdin
kubectl exec pod -- bash    # opens interactive shell, waits for input

# Bug: read with no stdin redirect in a background task
read -r line                # blocks waiting for terminal input
```

### Diagnosis

```bash
# Find what the hanging process has open on fd 0 (stdin)
ls -la /proc/$PID/fd/0
# Or with lsof:
lsof -p $PID | grep -E "^COMMAND|stdin|0r"

# On macOS (no /proc):
lsof -p $PID | head -20

# strace the process to see what syscall it is blocked on:
strace -p $PID -e trace=read,write
# Look for: read(0, ...   <-- blocked reading fd 0 (stdin)

# With bash tracing — add before the hanging command:
set -x
```

### Fix

```bash
# Redirect stdin from /dev/null for non-interactive tools
kubectl exec pod -- bash < /dev/null
ssh host command < /dev/null

# Add -n flag to ssh for non-interactive commands
ssh -n host "df -h /"

# For scripts running in cron or background, redirect stdin globally
exec < /dev/null

# Use -T to disable pseudo-TTY allocation in ssh
ssh -T -n host "systemctl is-active myapp"

# For read in a pipeline or background script, always specify the source
while IFS= read -r line; do
    process "$line"
done < input.txt          # always explicit, never rely on inherited stdin

# kubectl commands that don't need interactive: add --
kubectl exec pod -- df -h /   # non-interactive command, not shell
```

**Cron-specific**: cron provides stdin connected to `/dev/null` by default on most systems, but interactive tools like `ssh` may still allocate a PTY and wait. Always test cron scripts with `< /dev/null` appended.

---

## 7. Regex Not Matching as Expected (`=~` Operator, ERE vs BRE, Locale Issues)

### Symptom

`[[ "$string" =~ $pattern ]]` does not match when it should. Or it matches when it should not. Works in one locale, fails in another.

```bash
# Bug: regex quoted — quotes prevent regex interpretation
pattern="[0-9]+"
[[ "abc123" =~ "$pattern" ]]   # matches the literal string [0-9]+, not digits

# Bug: using BRE syntax in =~ (which expects ERE)
[[ "abc" =~ a\(b\)c ]]        # BRE grouping — not valid in ERE
```

### Diagnosis

```bash
# Check locale — affects character classes
locale | grep LC_

# Test the pattern interactively
string="Error: code 404"
pattern='^Error: code ([0-9]+)$'
[[ "$string" =~ $pattern ]] && echo "match: ${BASH_REMATCH[1]}" || echo "no match"

# Print what BASH_REMATCH captured
declare -p BASH_REMATCH

# Test with grep -E (ERE) to validate the regex separately from bash
echo "$string" | grep -E "$pattern"
```

### Fix

```bash
# Never quote the pattern variable in =~
pattern='^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
[[ "$ip" =~ $pattern ]]      # correct — no quotes around $pattern

# Use ERE syntax (=~ uses extended regex, like grep -E)
# ERE grouping: ( )     NOT: \( \)
# ERE alternation: |    NOT: \|
# ERE one-or-more: +    NOT: \+
# ERE zero-or-one: ?    NOT: \?

# Capture groups
[[ "2026-05-17" =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})$ ]]
year="${BASH_REMATCH[1]}"
month="${BASH_REMATCH[2]}"
day="${BASH_REMATCH[3]}"

# Locale-independent matching — fix character class issues
LC_ALL=C [[ "$str" =~ [[:alpha:]] ]]    # use POSIX classes

# For complex regex, prefer grep -P (PCRE) or Python
if echo "$string" | grep -qP '(?<=Error: )\d+'; then
    echo "matched"
fi

# Inline literal pattern (no variable) — works fine
[[ "$str" =~ ^[0-9]+$ ]]
```

**Rule**: never quote a regex pattern used with `=~`. Store it in a variable without quotes, and reference the variable without quotes.

---

## 8. Cron Job Works Manually but Fails in Cron

### Symptom

Script runs successfully when executed from the terminal. The exact same script fails when run by cron — silently or with `command not found`, missing files, or wrong output directory.

### Diagnosis Checklist

```bash
# 1. Cron's PATH is minimal — check what cron sees
* * * * * env > /tmp/cron_env.txt 2>&1
# Then inspect /tmp/cron_env.txt — PATH is typically just /usr/bin:/bin

# 2. Capture cron's stderr by redirecting output in crontab
* * * * * /path/to/script.sh >> /tmp/cron.log 2>&1

# 3. Working directory — cron starts in $HOME, not the script directory
* * * * * cd /opt/app && ./script.sh >> /tmp/cron.log 2>&1

# 4. Simulate cron environment manually
env -i HOME=/root PATH=/usr/bin:/bin SHELL=/bin/sh USER=root bash -l /path/to/script.sh

# 5. Test with the same user cron will use
sudo -u cronuser env -i HOME=/home/cronuser PATH=/usr/bin:/bin bash /path/to/script.sh
```

### Fix

```bash
#!/usr/bin/env bash
set -euo pipefail

# Fix 1: Explicit PATH at the top of every cron script
PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PATH

# Fix 2: Set explicit working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Fix 3: Use absolute paths for all commands and files
KUBECTL="/usr/local/bin/kubectl"
LOGFILE="/var/log/myapp/cron.log"
CONFIG="/etc/myapp/config.yaml"

# Fix 4: Load environment variables explicitly
# (cron does not source ~/.bashrc or ~/.profile)
if [[ -f /etc/myapp/env ]]; then
    # shellcheck source=/dev/null
    source /etc/myapp/env
fi

# Fix 5: Redirect output in the crontab entry
# 0 * * * * /opt/scripts/cleanup.sh >> /var/log/cleanup.log 2>&1

# Fix 6: Use MAILTO in crontab to receive error emails
# MAILTO=ops@example.com
```

**Common culprits by category:**

| Symptom in Cron | Likely Cause | Fix |
|---|---|---|
| `command not found` | PATH missing `/usr/local/bin` | Set explicit PATH |
| File not found | Relative path from wrong CWD | Use absolute paths |
| Auth failure | Missing env vars (KUBECONFIG, AWS_PROFILE) | Export explicitly |
| `source` fails | Non-login, non-interactive shell | Source files explicitly |
| Works as root, fails as user | Permission or PATH difference | Test with `sudo -u user` |

---

## 9. Here-Doc Indentation Issues (Tab vs Space with `<<-`)

### Symptom

`<<-` here-doc does not strip leading whitespace. The `EOF` delimiter is not found and the script waits for more input, or syntax errors are reported.

```bash
# Bug: spaces used for indentation but <<- only strips tabs
    cat <<-EOF
        This text still has spaces
    EOF   # "EOF" preceded by spaces — not recognized as delimiter
```

### Diagnosis

```bash
# Make whitespace visible
cat -A script.sh | grep -E "(EOF|heredoc)"
# Tabs show as ^I, spaces show as spaces

# Or use cat -A to see all characters
cat -A <<'SHOW'
	tab-indented line
  space-indented line
SHOW
```

### Fix

```bash
# <<- strips only leading TABS (not spaces)
# The delimiter must also be tab-indented (or at column 0)

# Correct: use actual tab characters (^I) for indentation
main() {
	cat <<-EOF
	Line one
	Line two
	EOF
}

# Correct: heredoc delimiter at column 0, body indented with tabs
if true; then
	result=$(cat <<-EOF
	key: value
	other: data
	EOF
	)
fi

# Alternative: avoid <<- entirely — use regular << with no indentation
generate_manifest() {
    cat << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: $APP_NAME
data:
  key: $VALUE
EOF
}

# Alternative: use printf for multi-line content that needs indentation in code
generate_manifest() {
    printf 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: %s\n' "$APP_NAME"
}

# Alternative: use a variable with embedded newlines
manifest="apiVersion: v1
kind: ConfigMap
metadata:
  name: ${APP_NAME}"
echo "$manifest" | kubectl apply -f -
```

**Editor setting**: if you use `<<-`, configure your editor to indent with real tab characters (`\t`) inside heredocs, or switch to the plain `<<` form and keep the delimiter at column 0.

---

## 10. Performance: Script Running Slow — Profiling with PS4+EPOCHREALTIME

### Symptom

A script that processes thousands of records, polls an endpoint, or processes files takes far longer than expected. No obvious bottleneck.

### Profiling Setup

Bash provides `EPOCHREALTIME` (bash 5+) for sub-second timestamps. Combined with a custom `PS4`, you get per-command timing:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Enable timing trace
PS4='+ $(printf "%.6f" "$EPOCHREALTIME") ${BASH_SOURCE[0]}:${LINENO}: '
exec 3>&2 2>/tmp/bash_trace.$$.log
set -x

# ... your script here ...

set +x
exec 2>&3 3>&-
```

Then analyze:

```bash
# Sort by slowest lines
awk '{print $1, $0}' /tmp/bash_trace.$$.log | sort -rn | head -20

# Find commands taking more than 0.1s
awk '
  NR>1 {
    split(prev, a, " ");
    split($0, b, " ");
    diff = b[1] - a[1];
    if (diff > 0.1) printf "%.3fs  %s\n", diff, prev
  }
  {prev=$0}
' /tmp/bash_trace.$$.log | sort -rn | head -20
```

### Common Performance Bottlenecks and Fixes

**1. Subprocess per iteration (the most common bash slow-down)**

```bash
# Bug: forks a subshell for every line — extremely slow at scale
while IFS= read -r line; do
    count=$(echo "$line" | wc -c)    # forks echo + wc per line
    echo "$count"
done < bigfile.txt

# Fix: use bash builtins — no subprocess
while IFS= read -r line; do
    echo "${#line}"                  # built-in string length, zero forks
done < bigfile.txt

# Fix: replace the whole loop with awk
awk '{print length($0)}' bigfile.txt
```

**2. Reading a file with `cat` in a loop**

```bash
# Bug: reads the file repeatedly
for item in "${items[@]}"; do
    if grep -q "$item" config.txt; then   # re-reads config.txt each iteration
        do_something
    fi
done

# Fix: read config.txt once
mapfile -t config_lines < config.txt
declare -A config_set
for line in "${config_lines[@]}"; do
    config_set["$line"]=1
done

for item in "${items[@]}"; do
    if [[ -v config_set["$item"] ]]; then
        do_something
    fi
done
```

**3. External tool inside a loop that can be batched**

```bash
# Bug: one kubectl call per pod name
for pod in "${pods[@]}"; do
    kubectl get pod "$pod" -o json     # N API calls
done

# Fix: one call to get all
kubectl get pods -o json | jq '.items[]'
```

**4. Unnecessary subshells from `$( )`**

```bash
# Bug: date called thousands of times
for i in "${items[@]}"; do
    ts=$(date +%s)    # forks a process each iteration
    log "$ts $i"
done

# Fix: use $SECONDS or $EPOCHREALTIME (builtins, no fork)
start=$SECONDS
for i in "${items[@]}"; do
    elapsed=$(( SECONDS - start ))
    log "$elapsed $i"
done
```

**5. Serial processing of independent work**

```bash
# Bug: checks 100 hosts one at a time
for host in "${hosts[@]}"; do
    check_host "$host"
done

# Fix: background + wait with concurrency limit
max_jobs=10
for host in "${hosts[@]}"; do
    check_host "$host" &
    while [[ $(jobs -r | wc -l) -ge $max_jobs ]]; do
        sleep 0.05
    done
done
wait
```

### Quick Performance Reference

| Pattern | Cost | Better Alternative |
|---|---|---|
| `$(cmd)` in loop | Fork per iteration | Bash builtin or batch the command |
| `grep` per line | Fork per line | Single `awk` or `grep` over whole file |
| `cat file \| cmd` | Useless fork | `cmd < file` (UUOC) |
| Serial SSH to N hosts | Linear time | Background + `wait` |
| `wc -l < <(cmd)` | Subprocess | Count in `awk '{c++} END{print c}'` |
| `date` in tight loop | Fork per call | `$EPOCHREALTIME` or `$SECONDS` |
