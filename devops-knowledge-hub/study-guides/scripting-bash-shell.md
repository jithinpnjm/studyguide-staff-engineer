# Bash & Shell Scripting — Zero to Hero

## 🎯 Why This Domain Matters
Mastering shell scripting is fundamental to infrastructure engineering because it is the universal language of automation on Unix-like systems. It's the glue that binds together disparate tools, APIs, and system components into coherent, automated workflows.

**Business & Reliability Outcomes:**
*   **Reduced Mean Time to Recovery (MTTR):** Sophisticated, reliable scripts enable automated rollbacks, diagnostic data collection, and remediation actions during an incident, transforming a 30-minute manual process into a 30-second automated one.
*   **Increased Deployment Velocity:** The "Portable Pipeline Pattern," where CI/CD logic resides in shell scripts, decouples build/test/deploy logic from specific CI/CD vendors. This prevents vendor lock-in and allows for rapid migration, ensuring business continuity and cost control.
*   **Enhanced System Reliability:** Idempotent scripts for configuration management, startup, and health checks ensure systems converge to a known-good state, preventing configuration drift and "snowflake" servers that are impossible to manage at scale.
*   **Improved Developer Productivity:** Well-crafted scripts provide powerful, self-service tooling for developers, abstracting away complex infrastructure interactions for tasks like provisioning environments, running integration tests, or deploying applications.

**Why Staff Engineers Need Deep Expertise:**
A Senior Engineer can write a script that works. A Staff Engineer must write a script that is safe, robust, observable, and maintainable by others for years. Without this expertise, an organization accumulates a mountain of "script debt"—brittle, opaque, and dangerous automation. This debt manifests as:
*   **Silent Failures:** Scripts that fail without proper error handling can leave systems in inconsistent states, leading to subtle, time-bomb incidents.
*   **"Works on My Machine" Syndrome:** Scripts that aren't POSIX-compliant or don't manage their environment properly break when moved from a developer's laptop to a production server or a different Linux distribution.
*   **Security Vulnerabilities:** Improperly handled user input or secrets can lead to command injection, privilege escalation, or data leakage.
*   **Performance Bottlenecks:** Inefficient scripts that fork excessive processes (`grep`, `cut`, `sed` in a tight loop) can cripple a machine's performance, impacting production services.

## 📋 Prerequisites & Mental Models
**Prerequisites:**
*   Solid understanding of the Linux filesystem hierarchy, permissions, and process model.
*   Proficiency with core command-line utilities (`grep`, `find`, `sed`, `awk`, `curl`, `jq`).
*   Familiarity with standard I/O streams (stdin, stdout, stderr) and redirection (`>`, `>>`, `|`, `2>&1`).

**The Core Mental Model: The Shell as a Language for Composition**
Think of the shell not as a general-purpose programming language, but as a powerful meta-language for composing and orchestrating other programs. Its primary strength is "gluing together" highly-optimized, single-purpose C binaries (`grep`, `find`, etc.) via a simple, text-based interface (pipes).

Internalize the Unix Philosophy:
1.  **Write programs that do one thing and do it well.** Your scripts should orchestrate these tools, not reimplement their functionality.
2.  **Write programs to work together.** Expect the output of every program to become the input to another. This is the foundation of the `|` (pipe).
3.  **Write programs to handle text streams, because that is a universal interface.** This is why tools like `jq` (for JSON) and `yq` (for YAML) are essential extensions; they adapt structured data to the text-stream model.

A Staff Engineer doesn't just write a script; they compose a resilient workflow from a set of proven, independent components.

## 🔷 Core Concepts

### POSIX Portability vs. Bashisms
*   **Why it exists:** POSIX is a standard that defines a common shell environment. Writing to this standard ensures your script runs predictably on various Unix-like systems (e.g., Alpine Linux in a container, Ubuntu on a server, macOS on a laptop). Bash, while the de facto standard, has extensions (`[[ ... ]]`, `((...))`, `declare -A`) that are not in the POSIX spec.
*   **Real-world implication:** A script using Bash's `[[ "a" == "a" ]]` will fail in a minimal Docker container using `ash` (a POSIX-compliant shell) which requires `[ "a" = "a" ]`. For tooling intended for wide distribution or use in constrained environments (like minimal containers), sticking to POSIX is a deliberate architectural choice for robustness. For internal scripts where the environment is standardized on Bash, using its powerful extensions is often pragmatic.
*   **Best Practice:** Always start your scripts with `#!/usr/bin/env bash` or `#!/bin/sh`. Be explicit about your target interpreter. Use a linter like `shellcheck` which can warn you about non-POSIX constructs if you're targeting `sh`.

### Unofficial Bash Strict Mode: `set -euo pipefail`
This is the single most important practice for writing safe shell scripts. It's not a suggestion; it's a requirement for production-grade automation.
*   `set -e` (**errexit**): The script will exit immediately if any command fails (returns a non-zero exit code).
    *   **Why:** Prevents cascading failures. Without it, a failed command (e.g., `cd /nonexistent/dir`) is ignored, and subsequent commands (`rm -rf *`) run in the wrong context, potentially causing catastrophic damage.
*   `set -u` (**nounset**): The script will exit if it tries to use an uninitialized variable.
    *   **Why:** Catches typos and logic errors. A typo like `rm -rf "$DEST_DIRR"` (extra 'R') would expand to `rm -rf ""` if the variable is unset, potentially targeting the current directory. `set -u` prevents this by immediately halting execution. Use `${VAR:-default}` to provide a default value if a variable might be unset.
*   `set -o pipefail`: The exit code of a pipeline (e.g., `command1 | command2`) is the exit code of the *last* command in the pipeline to fail, not just the final command.
    *   **Why:** Unmasks hidden failures. In `grep "error" logs.txt | wc -l`, if `grep` fails (e.g., `logs.txt` is unreadable), the pipeline would still succeed because `wc -l` successfully counts zero lines. `pipefail` ensures the `grep` failure is propagated, causing the script to exit if `set -e` is also active.

### Signal Trapping for Graceful Shutdown
*   **Why it exists:** Scripts performing critical operations (e.g., database backups, file transfers) can be interrupted by signals like `SIGINT` (Ctrl+C) or `SIGTERM` (from `kill`). Without a trap, the script dies instantly, leaving behind temporary files, lock files, or incomplete state.
*   **Real-world implication:** A `trap` allows you to define a cleanup function that executes before the script exits. This is essential for atomicity and preventing resource leaks.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Create a temporary directory for our work
TMP_DIR=$(mktemp -d)

# Define the cleanup function
cleanup() {
  echo "Caught signal, cleaning up..."
  rm -rf "${TMP_DIR}"
  # Kill any background jobs started by this script
  # The 'jobs -p' command lists the PIDs of background jobs.
  # The '|| true' prevents the script from exiting if there are no jobs to kill.
  kill $(jobs -p) 2>/dev/null || true
  echo "Cleanup complete."
}

# Set the trap. It will call the 'cleanup' function on EXIT, SIGINT, SIGTERM.
# EXIT is a pseudo-signal that fires on any script exit, normal or abnormal.
trap cleanup EXIT SIGINT SIGTERM

# --- Main script logic ---
echo "Doing work in ${TMP_DIR}"
sleep 30 # Simulate a long-running task
echo "Work complete."
```

### Idempotency: The Cornerstone of Reliable Automation
*   **Why it exists:** Idempotency means an operation can be applied multiple times without changing the result beyond the initial application. In infrastructure, this means a script can be re-run on a system without causing errors or unintended side effects if the desired state is already present.
*   **Real-world implication:** Non-idempotent scripts are a primary source of configuration drift. For example, a script with `echo "CONFIG_VAR=true" >> /etc/config` will add a new line on every run. An idempotent version would check first: `grep -qxF "CONFIG_VAR=true" /etc/config || echo "CONFIG_VAR=true" >> /etc/config`. This "check-then-act" pattern is fundamental.

**Common Idempotent Patterns:**
*   **File/Directory Creation:** `mkdir -p /path/to/dir` (the `-p` makes it idempotent).
*   **Configuration Lines:** `grep -q 'pattern' file || echo 'line' >> file`
*   **Symlinks:** `ln -sf /source/path /target/path` (the `-f` forces overwrite, making it idempotent).
*   **State/Lock Files:** Create a lock file to ensure only one instance of a script runs, or a "done" file to prevent re-running a completed one-off task.

```bash
#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="/var/run/my-script.lock"

# Use a file descriptor for locking to be robust
exec 200>"${LOCK_FILE}"
flock -n 200 || { echo "Script is already running."; exit 1; }

# Trap to ensure the lock is released on exit
trap 'rm -f "${LOCK_FILE}"' EXIT

echo "Script started, lock acquired."
# ... main logic ...
sleep 10
echo "Script finished."
```

### Performance: Built-ins vs. Forking
*   **Why it exists:** Every time you call an external command (`grep`, `cut`, `basename`), the shell performs a `fork()` and `exec()` system call. This creates a new process, which has significant overhead (memory allocation, context switching). Bash has built-in capabilities, like parameter expansion, that operate entirely within the shell's process and are orders of magnitude faster.
*   **Real-world implication:** In a loop processing thousands of files, using external commands can turn a 5-second script into a 5-minute script.

**Example: File path manipulation**
```bash
# SLOW: Forks 3 external processes per file
for file in /path/to/some/*.txt; do
  basename=$(basename "$file" .txt)
  dirname=$(dirname "$file")
  extension=$(echo "$file" | cut -d. -f2)
done

# FAST: Uses built-in parameter expansion, zero forks
for file in /path/to/some/*.txt; do
  basename="${file##*/}"      # Remove everything up to the last '/'
  basename="${basename%.*}"   # Remove everything after the last '.'
  dirname="${file%/*}"        # Remove everything after the last '/'
  extension="${file##*.}"     # Remove everything up to the last '.'
done
```

## 🛠️ Tools & Ecosystem

*   **ShellCheck (Linter):**
    *   **What it solves:** Catches common bugs, style issues, and portability problems before they become production incidents. It's like a compiler's static analysis for shell scripts.
    *   **When to use it:** Always. Integrate it into your CI/CD pipeline and your editor. There is no reason not to use it.
    *   **When NOT to use it:** Never.
*   **Bats-core (Unit Testing Framework):**
    *   **What it solves:** Provides a TAP-compliant framework for writing unit tests for your shell scripts. It allows you to mock commands, assert on output and exit codes, and structure tests in a familiar `setup/teardown` and `@test` format.
    *   **When to use it:** For any script that contains complex logic, especially shared library scripts or critical automation. It gives you the confidence to refactor and add features without breaking existing functionality.
    *   **When NOT to use it:**