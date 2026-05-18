---
title: "Interview Questions"
sidebar_position: 4
---

# Interview Questions: Bash & Shell Scripting

20+ Q&A covering quoting, process substitution, strict mode, debugging, and common pitfalls. Calibrated for Staff Engineer and Senior SRE interviews.

---

## Fundamentals

**Q1: What does `set -euo pipefail` do and why does each part matter?**

`-e`: The script exits immediately on any unhandled non-zero exit code. Without it, errors silently pass and subsequent commands run with incorrect state.

`-u`: Treats unset variables as errors. Prevents catastrophic bugs like `rm -rf $UNDEFINED/` where an empty variable causes deletion of the root of the path.

`-o pipefail`: A pipeline's exit code is the exit code of the rightmost command that failed, not the last command. Without it, `false | true` exits 0 — a silent failure.

Together they make scripts fail fast and explicit. Strict mode is not magic: commands inside `if` conditions and those followed by `|| true` are still exempt from `-e`.

---

**Q2: Why is quoting variables so important? Give a concrete example where omitting quotes causes a bug.**

Word splitting and glob expansion happen on unquoted expansions. Example:

```bash
file="my report.txt"
rm $file       # passes two arguments: "my" and "report.txt"
rm "$file"     # passes one argument: "my report.txt"
```

Even more dangerous:

```bash
target=""
rm -rf $target/cache   # becomes: rm -rf /cache
rm -rf "${target:?}/cache"  # exits if target is empty
```

The rule: always quote variable expansions with `"$var"` unless you explicitly need word splitting or glob expansion.

---

**Q3: What is the difference between `$@` and `$*`?**

Both expand to all positional parameters. The difference appears when quoted:

- `"$@"` expands to individual quoted arguments — each argument is a separate word even if it contains spaces.
- `"$*"` expands to a single word with all arguments joined by the first character of `IFS` (space by default).

```bash
args=("hello world" "foo bar")

for a in "${args[@]}"; do echo "$a"; done
# hello world
# foo bar

for a in "${args[*]}"; do echo "$a"; done
# hello world foo bar
```

Always use `"$@"` when passing arguments through to another command.

---

**Q4: What is process substitution and when would you use it over a pipe?**

Process substitution (`<(cmd)`) makes a command's output look like a file descriptor. The key advantage over pipes: variables set inside a `while read` loop fed by a pipe run in a subshell and are lost. With process substitution, the loop runs in the current shell.

```bash
# WRONG: count is lost after the loop (pipe creates a subshell)
count=0
cat file.txt | while IFS= read -r line; do ((count++)); done
echo $count   # 0

# CORRECT: process substitution, no subshell
count=0
while IFS= read -r line; do ((count++)); done < <(cat file.txt)
echo $count   # correct
```

Also use `<()` for diffing two command outputs without temp files:
`diff <(kubectl get pods -n staging) <(kubectl get pods -n prod)`

---

**Q5: What is the difference between `[ ]`, `[[ ]]`, and `(( ))`?**

| Construct | Purpose | Notes |
|---|---|---|
| `[ ]` | POSIX test, available in all shells | Word splitting still applies; use quotes |
| `[[ ]]` | Bash extended test | No word splitting, supports `&&`, `||`, `=~` regex, `==` glob |
| `(( ))` | Arithmetic evaluation | Returns 0 if result is non-zero (true), 1 if zero (false) |

```bash
[[ "$a" == "$b" ]]    # string comparison
[[ $count -gt 5 ]]    # integer comparison in [[ ]]
(( count > 5 ))       # same, but in arithmetic context
(( count++ ))         # increment
```

Prefer `[[ ]]` for all conditionals in bash scripts.

---

**Q6: How do you handle errors in a pipeline? Why is `set -o pipefail` not always enough?**

`pipefail` propagates the exit code from any failing stage in a pipeline. But it only sets the exit code — it doesn't tell you which stage failed. For detailed error tracking:

```bash
set -o pipefail

# Check each stage
output=$(kubectl get pods -n prod 2>&1 | grep -v "Warning") || {
    echo "Pipeline failed" >&2
    exit 1
}

# PIPESTATUS holds exit codes of each pipeline stage
kubectl get pods | grep "Running" | wc -l
echo "Exit codes: ${PIPESTATUS[@]}"   # e.g., "0 0 0"
```

Also note: `set -e` does not abort on failed pipeline stages within `if` conditions, `&&`/`||` chains, or commands followed by `|| true`.

---

**Q7: Explain how `trap` works. When is it especially important?**

`trap CMD SIGNAL` registers a command to run when the shell receives a signal or exits. `EXIT` fires on every exit (normal, error, signal), making it the most useful:

```bash
TMPFILE=$(mktemp)
cleanup() { rm -f "$TMPFILE"; }
trap cleanup EXIT

# Even if the script fails mid-way, TMPFILE is cleaned up
```

Critical uses:
- Temp file cleanup (always)
- Lock file release (prevents stuck locks after crash)
- Rollback on deployment failure
- Logging exit codes in CI/CD

Important: if you redefine trap inside a function, the function's trap overrides the script-level one only within that scope. Use `trap - SIGNAL` to clear a trap.

---

**Q8: What happens when you run a function in a subshell? How do variable changes propagate?**

They don't. A subshell is a fork of the current shell — it inherits all variables but changes don't propagate back.

```bash
x=1
modify() { x=2; }
modify
echo $x   # 2 — function runs in current shell, so change propagates

(modify)   # subshell
echo $x    # 1 — change is lost

# Pipes also create subshells
modify | cat
echo $x    # 1 — change is lost
```

This is the most common source of "why didn't my variable change?" bugs.

---

## Debugging and Troubleshooting

**Q9: How do you debug a bash script?**

Multiple approaches, ordered by intrusiveness:

1. **`shellcheck myscript.sh`** — static analysis before running. Catches quoting bugs, unset variables, common pitfalls. Always do this first.

2. **`bash -n myscript.sh`** — syntax check without executing.

3. **`bash -x myscript.sh`** — trace every command with expanded values. The `+` prefix shows depth.

4. **`set -x` / `set +x`** — enable/disable tracing around a specific section.

5. **`declare -p varname`** — print the type and value of a variable.

6. **`PS4='+ ${FUNCNAME[0]:+${FUNCNAME[0]}():}${LINENO}: '`** — add function name and line number to trace output.

```bash
# Targeted trace
set -x
suspicious_function
set +x

# Check variable
declare -p my_array
```

---

**Q10: How do you safely handle temporary files?**

```bash
TMPFILE=$(mktemp)
TMPDIR=$(mktemp -d)

trap 'rm -rf "$TMPFILE" "$TMPDIR"' EXIT INT TERM

# Use them safely
echo "data" > "$TMPFILE"
process "$TMPFILE"
```

Why `mktemp` over hardcoded paths:
- Creates a file with a random suffix — prevents collision and predictable-path attacks
- Returns the actual path — no guessing
- Respects `$TMPDIR`

Never use `/tmp/myscript.tmp` — race condition between creation check and creation.

---

**Q11: What is the difference between `exit` and `return` in bash?**

- `exit N`: exits the entire shell (script) with code N. If called inside a function, exits the whole script.
- `return N`: exits only the current function with code N. The calling script continues.

```bash
validate() {
    [[ -f "$1" ]] || return 1   # only exits the function
    return 0
}

if ! validate "/etc/hosts"; then
    echo "Validation failed"
    exit 1   # exits the script
fi
```

---

**Q12: How do you read a file line by line safely?**

```bash
while IFS= read -r line; do
    echo "Processing: $line"
done < file.txt
```

- `IFS=` prevents stripping of leading/trailing whitespace
- `-r` prevents backslash sequences from being interpreted
- Redirect from file (`< file.txt`) avoids a pipe-induced subshell

For a command's output:

```bash
while IFS= read -r pod; do
    kubectl logs "$pod"
done < <(kubectl get pods --no-headers -o name)
```

---

## Common Pitfalls

**Q13: What are the most dangerous bash pitfalls and how do you avoid them?**

1. **Unquoted variables**: `rm -rf $path` where `path` is empty → `rm -rf /`
   - Fix: always quote. Use `${var:?}` to fail on empty.

2. **Word splitting with filenames containing spaces**: scripts break on `file with spaces.txt`
   - Fix: always quote `"$filename"`. Use arrays for lists.

3. **Subshell variable scope**: variables in `cmd | while read` loops are lost
   - Fix: use process substitution `< <(cmd)`.

4. **`set -e` with `||` in conditions**: `if cmd || other; then` — `-e` doesn't fire here, which can be surprising
   - Fix: understand what `-e` exempts. Test edge cases.

5. **`pipefail` and intentional failures**: `grep | wc -l` fails if grep finds nothing
   - Fix: use `grep ... || true` or check `${PIPESTATUS[@]}`.

6. **Integer overflow**: bash arithmetic is 64-bit signed — careful with large numbers
   - Fix: use `bc` or `awk` for precision math.

---

**Q14: How do you pass arguments containing spaces to a command?**

Use `"$@"` to preserve argument boundaries:

```bash
# Correct: passes arguments individually
run_command() { "$@"; }
run_command grep "hello world" file.txt   # 3 args preserved

# Wrong: collapses to one string
run_command() { $*; }
```

For constructing command arrays:

```bash
cmd=(kubectl get pods -n "$NAMESPACE")
[[ "$VERBOSE" == true ]] && cmd+=(-v)
"${cmd[@]}"   # execute the array
```

---

**Q15: What is `eval` and why is it dangerous?**

`eval` parses its argument as bash code and executes it. It's dangerous because:

1. Any user-controlled input becomes arbitrary code execution
2. It defeats quoting — spaces and special chars in variables are re-interpreted

```bash
# Dangerous: if filename contains "; rm -rf /"
eval "cat $filename"

# Safe alternative: use arrays
cat "$filename"
```

The rare legitimate use: dynamically naming variables when `nameref` (`local -n`) is unavailable (bash < 4.3).

---

**Q16: How do you prevent a script from running if another instance is already running?**

Use `flock` or atomic `mkdir`:

```bash
# flock approach (requires Linux)
exec 9>/var/run/myscript.lock
flock -n 9 || { echo "Already running"; exit 1; }

# mkdir approach (portable, atomic)
LOCKDIR="/tmp/myscript.lock"
mkdir "$LOCKDIR" 2>/dev/null || { echo "Already running"; exit 1; }
trap "rmdir '$LOCKDIR'" EXIT
```

---

**Q17: When would you choose bash over Python for a script?**

Use Bash when:
- Chaining Unix commands together (pipes, redirects)
- Quick operational automation — restart a service, rotate a log
- Working directly with the filesystem and processes
- Deployment glue code — run kubectl, trigger a webhook, check a rollout
- The script is under ~50 lines and unlikely to grow

Use Python when:
- Complex data structures are needed (dicts with multiple fields, typed data)
- Making authenticated API calls with SDKs
- Error handling needs try/catch with specific exception types
- The script will be tested, packaged, and maintained long-term
- You need concurrent I/O without subshell complexity
- You're parsing JSON/YAML beyond simple `jq` queries

Senior engineers know when bash has become a liability — usually when they start adding `awk`, `sed`, and `grep` together with nested arrays and complex logic.

---

**Q18: How do you write a production deployment script?**

Minimum requirements:

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Validate required inputs early
: "${NAMESPACE:?required}" "${IMAGE:?required}"

# 2. Validate required tools
command -v kubectl >/dev/null || { echo "kubectl required" >&2; exit 1; }

# 3. Structured logging
log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# 4. Cleanup on exit
trap 'log "Script exited with code $?"' EXIT

# 5. Dry-run mode
[[ "${DRY_RUN:-false}" == "true" ]] && { log "Dry run — no changes"; exit 0; }

# 6. The actual deployment
kubectl set image deployment/myapp myapp="$IMAGE" -n "$NAMESPACE"

# 7. Wait for rollout with timeout
kubectl rollout status deployment/myapp -n "$NAMESPACE" --timeout=300s

# 8. Verify
log "Deployment successful"
```

---

**Q19: How do you safely delete files matching a pattern?**

```bash
# Dangerous: if glob expands to nothing, rm fails or removes wrong files
rm -rf /var/log/app/*.log

# Safe: nullglob handles empty matches
shopt -s nullglob
files=(/var/log/app/*.log)
if [[ ${#files[@]} -eq 0 ]]; then
    echo "No files to delete"
else
    rm -f "${files[@]}"
fi
shopt -u nullglob

# Safe with find
find /var/log/app -name "*.log" -mtime +30 -delete

# Dry run first
find /var/log/app -name "*.log" -mtime +30 -print   # verify before adding -delete
```

---

**Q20: How do you handle commands that may legitimately fail in a script with `set -e`?**

Four patterns:

```bash
# 1. Use || true to suppress failure
grep "pattern" file.txt || true

# 2. Use if to branch on result (exempt from -e)
if grep "pattern" file.txt; then
    echo "found"
fi

# 3. Use command substitution with assignment (exempt from -e)
result=$(grep "pattern" file.txt) || true

# 4. Temporarily disable -e
set +e
grep "pattern" file.txt
result=$?
set -e
```

Pattern 2 (using `if`) is the cleanest and most readable.

---

**Q21: What is the difference between sourcing a script and executing it?**

- **Executing** (`bash script.sh` or `./script.sh`): runs in a child process. Variable changes, `cd`, and `exit` do not affect the calling shell.
- **Sourcing** (`. script.sh` or `source script.sh`): runs in the current shell. All changes — variable assignments, `cd`, exported functions — affect the current shell.

```bash
# This is why you source virtualenvs
source venv/bin/activate    # modifies current shell's PATH

# But execute deploy scripts
./deploy.sh                 # child process, isolated
```

Test if your script is being sourced:

```bash
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"   # being executed
fi
# if sourced, functions are available but main doesn't run
```

---

**Q22: How do you write safe, retry-able health checks in bash?**

```bash
wait_healthy() {
    local url="$1"
    local max_attempts="${2:-10}"
    local sleep_secs="${3:-5}"
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf --max-time 5 "$url" &>/dev/null; then
            echo "Healthy: $url"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts failed, retrying in ${sleep_secs}s..."
        sleep "$sleep_secs"
        ((attempt++))
    done

    echo "Service not healthy after $max_attempts attempts: $url" >&2
    return 1
}
```

Key principles:
- Bound the number of retries (never infinite)
- Sleep between attempts (don't hammer a recovering service)
- Use a real HTTP check (`curl -sf`) not just TCP
- Return meaningful exit codes
