---
title: "Foundations: Git Premium Teaching Guide For SRE And Platform Engineers"
sidebar_position: 16
---

# Foundations: Git Premium Teaching Guide For SRE And Platform Engineers

Git is more than source control. For platform teams it is the audit trail for infrastructure, the trigger for CI/CD, the source of truth for GitOps, and the fastest safe rollback tool when change goes wrong.

This guide teaches Git from first principles to production-grade operational use.

---

# How To Use This Module

Study in layers:

1. **Beginner Layer** — repos, commits, branches, remotes.
2. **Intermediate Layer** — merges, rebases, PR workflow, conflicts.
3. **Advanced Layer** — reflog, bisect, tags, history surgery.
4. **Production SRE Layer** — IaC review, rollback, GitOps discipline.
5. **Interview Layer** — explain tradeoffs calmly and clearly.

---

# Memory Palace: Engineering Control Room

| Concept | Analogy | Meaning |
|---|---|---|
| Working Tree | Draft desk | Current files |
| Staging Area | Approval tray | Next snapshot contents |
| Commit | Timestamped change record | Immutable history point |
| Branch | Route marker | Named pointer |
| Remote | Shared control room | Team repository |
| Tag | Milestone marker | Release point |
| Reflog | Security camera | HEAD movement history |

---

# Beginner Layer: What Git Really Stores

Git stores snapshots, not only patches.

```text
working tree -> index -> commit graph -> remote
```

A branch is usually just a movable pointer to a commit.

Cheap branches enable safer experimentation.

---

# Beginner Layer: Daily Safe Workflow

```bash
git status
git diff
git add file
git diff --staged
git commit -m "Clear message"
git push
```

Use `git status` constantly. It is your cockpit panel.

---

# Beginner Layer: Commit Messages That Matter

Weak:

```text
update files
```

Strong:

```text
Increase API timeout after dependency latency spikes in EU region
```

Explain intent, not only mechanics.

---

# Intermediate Layer: Branching Model

Good names:

- feature/add-labs
- fix/pages-build
- docs/networking-refresh
- hotfix/prod-timeout

Keep branches focused and short-lived when possible.

---

# Intermediate Layer: Pull Requests

A good PR explains:

- what changed
- why it changed
- how it was tested
- blast radius
- rollback plan

For infrastructure PRs, blast radius matters as much as code quality.

---

# Intermediate Layer: Merge vs Rebase

## Merge

Preserves exact branch history.

Best when:

- many contributors touched branch
- integration history matters

## Rebase

Replays commits on new base.

Best when:

- cleaning local feature branch
- keeping history linear

Rule:

> Do not rewrite shared public history casually.

---

# Intermediate Layer: Conflict Resolution

Conflict markers mean Git needs a human decision.

```text
<<<<<<<
=======
>>>>>>>
```

Correct approach:

1. Understand both changes.
2. Edit intentionally.
3. Re-test.
4. Continue merge/rebase.

---

# Advanced Layer: Safe Undo Options

## Restore file

```bash
git restore file
```

## Unstage

```bash
git restore --staged file
```

## Revert shared history safely

```bash
git revert SHA
```

## Reset local history

```bash
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
```

Use reset carefully. Prefer revert on shared branches.

---

# Advanced Layer: Reflog = Recovery Superpower

```bash
git reflog
git switch -c rescue HEAD@{3}
```

Use after:

- bad rebase
- accidental reset
- detached HEAD confusion
- lost local commits

Many “lost” commits are recoverable.

---

# Advanced Layer: Git Bisect

Use binary search to find the breaking commit.

```bash
git bisect start
git bisect bad
git bisect good v1.0.0
```

Excellent for regressions where many commits landed.

---

# Advanced Layer: Tags And Releases

Use annotated tags for real releases.

```bash
git tag -a v2.1.0 -m "Release"
git push origin v2.1.0
```

Useful for:

- deployments
- rollback anchors
- changelog generation
- audit history

---

# Production SRE Layer: Git For Infrastructure

Git often controls:

- Terraform
- Kubernetes manifests
- Helm charts
- CI workflows
- dashboards as code
- runbooks
- alert rules

Change quality in Git directly affects production risk.

---

# Production SRE Layer: GitOps Discipline

```text
Git desired state -> controller syncs runtime
```

Meaning:

- manual cluster edits may be reverted
- emergency changes must be backported to Git
- drift becomes visible

If it is not in Git, it may not persist.

---

# Production SRE Layer: Real Incidents

## Bad Config Merged To Main

Action:

- revert quickly
- validate recovery
- inspect review/test gaps

## Secret Committed

Action:

- rotate secret immediately
- revoke old credential
- scrub history if needed
- audit exposure

History cleanup alone does not un-leak a secret.

## Force Push Broke Shared Branch

Action:

- stop more pushes
- inspect reflog / remote refs
- restore known good state carefully

## GitOps Reverted Manual Hotfix

Cause:

Desired state in Git differed from cluster.

Fix:

Commit the hotfix properly.

---

# Production SRE Layer: Troubleshooting Flow

## CI Fails After Merge

Check:

- missing files in commit
- merge conflict logic bug
- environment assumptions

## Unsure What Changed

Use:

```bash
git log --oneline --graph
git show SHA
git diff old..new
```

## Need Fast Rollback

Prefer:

```bash
git revert SHA
```

---

# Interview Layer: Strong Answers

## Why is revert safer than reset on main?

> Revert preserves shared history and creates an explicit undo commit.

## When use rebase?

> For local branch cleanup before review, not for rewriting shared team history casually.

## How find breaking commit?

> Use logs for timing and `git bisect` for systematic isolation.

## Why is Git critical for SRE?

> It governs infrastructure changes, deployment automation, rollback speed, and auditability.

---

# Labs

## Beginner

1. Create repo.
2. Make commits.
3. Create branch.
4. Open PR.

## Intermediate

1. Resolve conflict.
2. Rebase feature branch.
3. Tag release.

## Advanced

1. Recover commit with reflog.
2. Find regression with bisect.
3. Simulate bad deploy then revert.
4. Practice GitOps rollback.

---

# Memory Review

- Why are branches cheap?
- Why prefer revert on main?
- What does reflog save?
- Why can GitOps undo manual fixes?
- Why should commit messages explain intent?

---

# Senior Summary

> I treat Git as the operational control plane for software and infrastructure. I use protected branches, clear PR reviews, safe rollback via revert, clean local history via rebase, and reflog/bisect for recovery and debugging. Good Git hygiene directly reduces production risk.
