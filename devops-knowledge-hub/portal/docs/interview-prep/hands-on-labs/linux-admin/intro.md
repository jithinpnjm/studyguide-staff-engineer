---
title: "Linux Admin Drills"
sidebar_position: 0
---

# Linux Admin Drills

These drills build Linux administration command fluency through deliberate repetition. They are designed for senior confidence — the kind that comes from having solved these problems enough times that you do not need to look things up under pressure.

## Why This Track Matters Operationally

SRE and platform engineer interviews often include live Linux administration scenarios: a service that will not start, a disk that is unexpectedly full, a port that is in use, a zombie process that cannot be killed. The ability to move through these quickly and correctly, without hesitation, is a visible signal of experience. These drills simulate that pattern.

## Prerequisites

- Completed the Linux labs or already comfortable with host-level triage
- Familiar with `systemctl`, `journalctl`, `mount`, `lsblk`, `fdisk`, `ps`, `kill`, `ss`, `lsof`
- Understand how systemd unit files work and what `WantedBy`, `After`, and `Restart=` mean

Foundation reading: [../../foundations/02-linux-kubernetes-foundations.md](../../foundations/02-linux-kubernetes-foundations.md), [../../foundations/10-linux-and-network-administration.md](../../foundations/10-linux-and-network-administration.md)

## Drills

1. [drill-01-service-and-systemd-triage.md](drill-01-service-and-systemd-triage.md) — Diagnose and recover a failed systemd service. Read unit files, interpret journal output, repair startup failures. Focus: `systemctl`, `journalctl`, unit file syntax.
2. [drill-02-filesystem-and-storage-admin.md](drill-02-filesystem-and-storage-admin.md) — Resize a filesystem, add a mount point, recover from a full disk. Focus: `df`, `du`, `lsblk`, `fdisk`, `mkfs`, `mount`, `fstab`.
3. [drill-03-process-socket-and-network-admin.md](drill-03-process-socket-and-network-admin.md) — Find what is using a port, kill processes safely, diagnose socket state. Focus: `ss`, `lsof`, `fuser`, `kill`, `netstat`, TIME_WAIT behavior.
4. [drill-04-command-mastery-checklist.md](drill-04-command-mastery-checklist.md) — A structured checklist of 40+ commands you should be able to use without looking up syntax. Use it to identify gaps and practice them.

## Learning Progression

**Beginner:** you know what each command does from reading. You can run them with basic flags.

**Intermediate:** you can use these commands to diagnose a real problem — not just run them, but interpret what the output is telling you and take the correct next action.

**Advanced:** you move through administration tasks without hesitation and can explain what each step does and what the alternatives are. You know when to use `ss` versus `lsof`, when `SIGTERM` is insufficient, and how `fstab` entries interact with boot dependencies.

## How To Use These Drills

1. Do each drill as a timed exercise — set a 20-minute limit and see how far you get.
2. Do not read the solution before completing your attempt.
3. After each drill, note every command you hesitated on and practice it again in isolation.
4. Attach each command to a class of problem, not just a syntax pattern. Ask: "when would I reach for this during an incident?"
5. Repeat drill 4 (command mastery checklist) weekly until you can go through it without stopping.

## Tools You Need

- A Linux host or VM — cloud free tier works well
- `systemd`-based Linux: Ubuntu 20.04+, Debian 11+, RHEL/CentOS 8+
- Install `sysstat` (`apt install sysstat`) for `iostat` and `sar`
- For storage drills: a VM where you can safely create and destroy partitions or use loop devices

## Success Criteria

After completing all four drills you should be able to:

- recover a crashed systemd service from a cold journal in under 5 minutes
- diagnose a full disk, identify the culprit file or process, and remediate it without rebooting
- find what process is holding a port, assess whether it is safe to kill, and recover the port
- go through the command mastery checklist without hesitation on more than 90% of commands
- explain the systemd service lifecycle to an interviewer: start, stop, restart, failed, activating, deactivating
