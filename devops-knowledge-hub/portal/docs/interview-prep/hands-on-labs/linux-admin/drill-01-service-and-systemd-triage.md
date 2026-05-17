---
title: "Linux Admin Drill 1: Service and systemd Triage"
sidebar_position: 99
---

# Linux Admin Drill 1: Service and systemd Triage

## Why This Matters In Production

A deploy is pushed. Someone in Slack says "service looks unhealthy." You SSH to the host. What is the first command? If you do not have a reflexive answer, this drill is for you. systemd is the init system on every production Linux host you will encounter (Ubuntu, RHEL, Debian, Amazon Linux). Being able to distinguish "failed to start" from "started but crashed" from "running but misbehaving" in under two minutes is a baseline SRE skill.

## Prerequisites

- Knows what a systemd unit file is
- Has used `systemctl status` at least once
- Understands the difference between stdout and the journal

## Time Estimate

40 minutes. Run through it once reading everything, then repeat from scratch without the guidance to confirm retention.

---

## Scenario

You are an on-call SRE. It is 23:10. The deploy pipeline finished 4 minutes ago. A monitoring alert fires: `appserver on app-worker-02 is not responding on port 8080`. You SSH to the host. Begin.

---

## Part 1 — Beginner: Step-By-Step Triage

### Step 1 — Check Unit State: systemctl status

```bash
$ systemctl status appserver.service
● appserver.service - Application Server
     Loaded: loaded (/etc/systemd/system/appserver.service; enabled; vendor preset: enabled)
     Active: failed (Result: exit-code) since Wed 2026-04-09 23:06:41 UTC; 3min 42s ago
    Process: 28914 ExecStart=/usr/bin/appserver --config /etc/appserver/config.yaml (code=exited, status=1/FAILURE)
   Main PID: 28914 (code=exited, status=1/FAILURE)
        CPU: 412ms

Apr 09 23:06:41 app-worker-02 appserver[28914]: FATAL: cannot open config file: /etc/appserver/config.yaml: no such file or directory
Apr 09 23:06:41 app-worker-02 systemd[1]: appserver.service: Main process exited, code=exited, status=1/FAILURE
Apr 09 23:06:41 app-worker-02 systemd[1]: appserver.service: Failed with result 'exit-code'.
Apr 09 23:06:41 app-worker-02 appserver[28914]: FATAL: cannot open config file: /etc/appserver/config.yaml: no such file or directory
Apr 09 23:06:41 app-worker-02 systemd[1]: Failed to start Application Server.
```

**How to read the unit state:**

- `Loaded` line: is the unit file present and enabled? `enabled` means it will start on boot. `disabled` means it will not. `masked` means it is blocked from starting entirely.
- `Active` line: this is the lifecycle state. The five important states are:
  - `active (running)` — process is alive and the service considers itself healthy
  - `active (exited)` — process ran and exited cleanly (normal for oneshot services)
  - `failed (Result: exit-code)` — process exited with nonzero status
  - `failed (Result: signal)` — process was killed by a signal (often SIGSEGV or SIGKILL)
  - `activating` — start is in progress (may be stuck waiting for a dependency)
- `Process:` line: shows the last PID and exit code. `status=1/FAILURE` is a generic failure. `status=137` means SIGKILL (128+9). `status=139` means SIGSEGV (128+11).

**Diagnosis from this output:** The config file is missing. The service never started. The deploy likely forgot to install or render the config file.

---

### Step 2 — Pull Structured Logs: journalctl -u

```bash
$ journalctl -u appserver.service -n 50 --no-pager
-- Logs begin at Mon 2026-04-07 00:00:12 UTC, end at Wed 2026-04-09 23:10:04 UTC. --
Apr 09 23:06:35 app-worker-02 systemd[1]: Starting Application Server...
Apr 09 23:06:35 app-worker-02 appserver[28914]: INFO: starting appserver v2.14.1
Apr 09 23:06:35 app-worker-02 appserver[28914]: INFO: loading configuration from /etc/appserver/config.yaml
Apr 09 23:06:35 app-worker-02 appserver[28914]: FATAL: cannot open config file: /etc/appserver/config.yaml: no such file or directory
Apr 09 23:06:41 app-worker-02 systemd[1]: appserver.service: Main process exited, code=exited, status=1/FAILURE
Apr 09 23:06:41 app-worker-02 systemd[1]: Failed to start Application Server.
Apr 09 23:06:41 app-worker-02 systemd[1]: appserver.service: Scheduled restart job, restart counter is at 3/5.
Apr 09 23:06:46 app-worker-02 systemd[1]: Stopped Application Server.
Apr 09 23:06:46 app-worker-02 systemd[1]: appserver.service: Start request repeated too quickly.
Apr 09 23:06:46 app-worker-02 systemd[1]: appserver.service: Failed with result 'start-limit-hit'.
Apr 09 23:06:46 app-worker-02 systemd[1]: Failed to start Application Server.
```

**What to read:**
- The log shows the exact sequence: started, tried to read config, failed, systemd retried, hit the restart limit.
- `restart counter is at 3/5` — systemd will retry failing services per the `Restart=` and `StartLimitBurst=` config. Once it hits `start-limit-hit`, it stops retrying. The service will not come back on its own.
- `StartLimitIntervalSec` and `StartLimitBurst` in the unit file define the retry window.
- The application exit at 23:06:35 and the failure at 23:06:41 differ by 6 seconds — the `RestartSec=` delay between attempts.

**Time window filtering (important habit):**
```bash
# Only logs from the last deploy window:
$ journalctl -u appserver.service --since "2026-04-09 23:00:00" --until "2026-04-09 23:10:00"

# Only errors from this service:
$ journalctl -u appserver.service -p err --since "1 hour ago"
```

---

### Step 3 — Check if It Is Listening: ss -lntp

```bash
$ ss -lntp | grep -E "State|8080|8443"
State    Recv-Q   Send-Q   Local Address:Port   Peer Address:Port   Process
```

**Empty output means nothing is listening on port 8080.** The service never got far enough to bind. This confirms the config failure — the application did not reach the port-binding step.

A healthy service would show:
```bash
LISTEN   0    128   0.0.0.0:8080   0.0.0.0:*   users:(("appserver",pid=28914,fd=9))
```

---

### Step 4 — Inspect Unit File Metadata: systemctl show

```bash
$ systemctl show appserver.service --property=ExecStart,Restart,RestartSec,StartLimitBurst,StartLimitIntervalSec,Environment,EnvironmentFile
ExecStart={ path=/usr/bin/appserver ; argv[]=/usr/bin/appserver --config /etc/appserver/config.yaml ; ... }
Restart=on-failure
RestartSec=5s
StartLimitBurst=5
StartLimitIntervalSec=30s
Environment=LOG_LEVEL=info APP_PORT=8080
EnvironmentFile=/etc/appserver/env (ignore_errors=no)
```

**What to check here:**
- `EnvironmentFile` — if this file is missing and `ignore_errors=no`, the service will fail to start even if the binary exists.
- `Restart=on-failure` — it retries on nonzero exit, but not on clean exit (exit code 0).
- `StartLimitBurst=5` in `StartLimitIntervalSec=30s` — 5 restarts within 30 seconds will trip the `start-limit-hit` brake.

---

### Step 5 — List All Services With State: systemctl list-units

```bash
$ systemctl list-units --type=service --state=failed
  UNIT                   LOAD   ACTIVE SUB    DESCRIPTION
● appserver.service      loaded failed failed Application Server
● filebeat.service       loaded failed failed Filebeat log shipper

LOAD   = Reflects whether the unit definition was properly loaded.
ACTIVE = The high-level unit activation state.
SUB    = The low-level unit activation state.

2 loaded units listed.
```

**Multiple failures are informative:** filebeat is also failing. If filebeat depends on appserver or if both depend on a shared environment file, a single misconfigured file can cascade.

---

## Part 2 — Intermediate: Directed Questions

Run these and interpret without guided explanation:

```bash
systemctl list-dependencies appserver.service
systemctl show appserver.service --property=After,Requires,Wants
journalctl -p warning --since "30 minutes ago" --no-pager | tail -30
journalctl -k --since "30 minutes ago" | grep -iE "oom|kill|error"
```

Questions to answer:
1. What is the difference between `Requires=` and `Wants=` in a unit file?
2. A service shows `Active: active (running)` but the health check fails. Systemd says it is fine. Why?
3. How do you safely restart a service without triggering the start-limit-hit brake?
4. A service is masked. How is that different from disabled? How do you unmask it?
5. `ExecStartPre=` fails with exit code 1. What happens to the main `ExecStart=`?

---

## Part 3 — Advanced / Stretch

**Scenario extension:** The config file is present (you confirmed `ls -la /etc/appserver/config.yaml` shows it exists). But the service still fails with "no such file or directory." How is this possible?

Investigate:
```bash
# Check if the service runs in a restricted filesystem namespace:
systemctl show appserver.service --property=PrivateTmp,ProtectSystem,ReadWritePaths,BindPaths

# Check if the path exists in the service's mount namespace:
nsenter --target $(systemctl show appserver.service --property=MainPID --value) --mount -- ls /etc/appserver/

# Look for SELinux or AppArmor denials:
ausearch -m AVC -ts recent 2>/dev/null | tail -10
journalctl -k | grep -i "apparmor.*DENIED" | tail -5
```

**Reasoning exercises:**
- `ProtectSystem=strict` makes the entire filesystem read-only except for paths listed in `ReadWritePaths`. A config file at `/etc/appserver/` would be visible but not writable.
- `PrivateTmp=true` gives the service its own `/tmp` and `/var/tmp`. Files left in host `/tmp` are not visible to the service.
- A service running as a non-root user with `DynamicUser=true` has an ephemeral UID. Files owned by a previous run's UID may not be readable.

---

## Sample Incident Note

```
[23:14 UTC] appserver on app-worker-02 down post-deploy — config file missing.

systemctl status: failed (exit-code), service has hit start-limit-hit after 5 retries.
journal: FATAL: cannot open config file /etc/appserver/config.yaml — no such file or directory.
ss -lntp: nothing listening on 8080 — app never reached bind phase.
Confirmed: /etc/appserver/config.yaml does not exist on host. Deploy ran at 23:06.

Root cause: config file not deployed by pipeline. Binary deployed without its config.
Immediate action: copy config from app-worker-01 (healthy host) after comparing content.
After file is placed: systemctl reset-failed appserver && systemctl start appserver.
Service will not auto-restart until reset-failed clears the start-limit-hit state.

Impact: appserver on app-worker-02 has been down 8 minutes. Load balancer is routing
traffic to remaining 3 healthy nodes. No user-visible SLA breach at this time.
```

---

## Common Mistakes

- **Running `systemctl restart` without clearing `start-limit-hit`.** The restart will fail immediately. Use `systemctl reset-failed <unit>` first.
- **Reading only the last line of `journalctl`.** The actual error is almost always a few lines up, before systemd's own messaging.
- **Confusing unit state with application health.** `active (running)` means the process is alive. It does not mean the application is serving requests. Separate health checks are needed.
- **Forgetting the `--no-pager` flag** in scripts or when piping `journalctl` output.
- **Not checking `systemctl show` for `EnvironmentFile`.** If an environment file is absent, the service may fail silently or with a confusing error.
- **Using `kill` or `pkill` instead of `systemctl stop`.** Killing the process directly leaves systemd in an inconsistent state and may trigger unexpected restart behavior.

---

## What To Study Next

- Foundation doc: 10-linux-and-network-administration.md, systemd section
- Practice writing a unit file from scratch including `After=`, `Requires=`, `ExecStartPre=`, and `Restart=`
- `man systemd.unit` and `man systemd.service` — the authoritative reference
- Drill 02: Filesystem and Storage — the next most common cause of service failures after config errors
