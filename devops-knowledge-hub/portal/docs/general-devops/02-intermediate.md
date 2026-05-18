---
title: "Intermediate"
sidebar_position: 2
---

# General DevOps — Intermediate

This section covers the practices that separate teams deploying weekly from teams deploying daily. The topics here — branching strategy, merge discipline, versioning, DORA metrics, deployment patterns, and postmortems — form the operating backbone of a high-performing engineering organisation.

---

## Git Branching Strategies

Choosing a branching strategy is a team agreement that determines how code flows from developer to production. Each strategy has tradeoffs in safety, speed, and operational complexity.

### Trunk-Based Development

The simplest high-performing strategy. All developers commit directly to `main` (trunk) or use very short-lived branches (less than one day of work).

```
main: A -> B -> C -> D -> E (deploys continuously)
              \-> feature (merged same day)
```

**Why it works at scale:**
- Small changes are easier to review and safer to roll back
- Merge conflicts are rare because branches are short-lived
- CI runs continuously on main; broken state is visible immediately
- Feature flags allow incomplete features to be deployed but hidden

**When to use:** Teams with high test coverage, feature flag infrastructure, and continuous deployment pipelines. Google, Facebook, and Etsy use trunk-based development.

**Risk:** Requires discipline. Without feature flags, incomplete work can break production.

### GitFlow

A branch-heavy model for teams with scheduled release cycles:

```
main (released versions, tagged)
develop (integration branch)
  feature/checkout-redesign  (from develop, merged to develop)
  feature/payment-v2         (from develop, merged to develop)
release/1.4.0                (from develop, merged to main + develop)
hotfix/prod-timeout          (from main, merged to main + develop)
```

**When to use:** Open source projects with external contributors, software with formal versioning (mobile apps, packaged software), teams that cannot deploy continuously.

**Risk:** Long-lived branches accumulate drift. Large merges create conflict storms. Slows down delivery compared to trunk-based.

### Ship / Show / Ask

A lightweight PR workflow for trunk-based teams that matches change risk to review overhead:

| Category | What it means | Example |
|----------|--------------|---------|
| **Ship** | Merge directly to main without review | Fix a typo, update documentation |
| **Show** | Open a PR but merge immediately; notify team asynchronously | Refactor a small function |
| **Ask** | Open a PR and wait for review before merging | New feature, infrastructure change, security-sensitive code |

This respects that not all changes carry the same risk and removes unnecessary ceremony from low-risk changes.

---

## Merge Strategies

### Merge Commit

```bash
git merge feature/checkout-redesign
```

Preserves exact branch history. Creates a merge commit that shows the integration point. Best when many contributors touched the branch and integration history matters for traceability.

### Rebase and Merge

```bash
git rebase main
git merge --ff-only feature/checkout-redesign
```

Replays commits on top of main, creating a linear history. Cleaner `git log`, easier to bisect regressions. Best for cleaning local feature branches before review.

**Rule:** Never rewrite shared public history. Rebase is for local branches only.

### Squash and Merge

Collapses all commits on a branch into one before merging. Keeps main history clean. Loses granular commit history.

**When to use:** When PR commits are messy work-in-progress commits that add noise to main history. When you want one revertable unit per feature.

### Resolving Merge Conflicts

Conflict markers mean Git needs a human decision:

```text
<<<<<<< HEAD
return timeout_seconds = 10
=======
return timeout_seconds = 30
>>>>>>> feature/fix-eu-timeout
```

Correct approach:
1. Understand both changes and why they differ
2. Edit to the intended outcome (not just "pick one side")
3. Re-run tests to confirm the resolution is correct
4. Complete the merge or rebase

---

## Tagging and Versioning

### Semantic Versioning (SemVer)

```
MAJOR.MINOR.PATCH
  2.4.1
```

- **MAJOR**: Breaking changes that require consumer updates
- **MINOR**: Backwards-compatible new features
- **PATCH**: Backwards-compatible bug fixes

### Git Tags for Releases

```bash
# Create annotated tag (preferred for releases)
git tag -a v2.4.1 -m "Release v2.4.1 — fix EU payment timeout"
git push origin v2.4.1

# List tags
git tag -l

# Tag an older commit
git tag -a v2.3.0 abc1234 -m "Backfill release tag"

# Delete a tag (careful — coordinate with team)
git tag -d v2.4.1
git push origin :refs/tags/v2.4.1
```

Tags serve as rollback anchors. When a bad release is deployed, `git revert v2.4.0..HEAD` or redeploying the image tagged `v2.4.0` is significantly faster than hunting through commits.

---

## DORA Metrics

The four metrics validated by the DevOps Research and Assessment (DORA) organisation as predictors of software delivery performance and organisational performance:

| Metric | What it measures | Elite | High | Medium | Low |
|--------|-----------------|-------|------|--------|-----|
| **Deployment Frequency** | How often code reaches production | Multiple/day | 1/week–1/day | 1/month–1/week | <1/month |
| **Lead Time for Changes** | Commit to production | <1 hour | 1 day–1 week | 1 week–1 month | >6 months |
| **Change Failure Rate** | % of deployments causing incidents | 0–5% | 0–15% | 16–30% | 16–30% |
| **MTTR** | Time to restore service after incident | <1 hour | <1 day | 1 day–1 week | >6 months |

### Measuring DORA

```python
# Deployment frequency: count from deployment logs
deployments_this_week = count(
    deployments WHERE env='production' AND date > now() - interval '7 days'
)

# Lead time: commit timestamp to deployment timestamp
lead_time = deploy_timestamp - commit_timestamp

# Change failure rate: over rolling 30 days
change_failure_rate = failed_deployments / total_deployments

# MTTR: from incident created to resolved
mttr = mean(incident.resolved_at - incident.created_at)
```

Tools to track DORA: LinearB, Jellyfish, Faros, or build your own using GitHub API + deployment system.

**Staff-level insight:** DORA metrics are a diagnostic tool, not a goal. Optimising deployment frequency without improving test coverage increases change failure rate. Track all four together.

---

## Change Management

Not all changes carry the same risk. Classify changes before deploying:

| Category | Risk | Examples | Process |
|----------|------|---------|---------|
| Standard | Low, pre-approved | Dependency patch, config update | Automated deployment |
| Normal | Medium, needs review | New feature, refactor | PR review + staging test |
| Emergency | High urgency | Production outage hotfix | Expedited review, postmortem required |
| Major | High risk, planned | Database schema change, new region | Full change plan, rehearsal |

**Change Freeze Windows:** Avoid deployments during high-risk periods (Black Friday, major product launches, holiday periods). Use feature flags to pre-stage changes without activating them.

---

## Feature Flags

Feature flags (also called feature toggles) separate deployment from release. Code ships to production but remains hidden behind a flag that can be toggled without a redeployment.

### Types of Feature Flags

| Type | Lifetime | Use case |
|------|----------|---------|
| Release toggle | Days to weeks | Hide incomplete feature until ready |
| Experiment toggle | Days to weeks | A/B testing |
| Ops toggle | Months | Kill switch for expensive or risky feature |
| Permission toggle | Long-lived | Beta access for specific users |

### Example (Python)

```python
from featureflags import get_flag

def process_checkout(cart):
    if get_flag("new_payment_provider", user_id=cart.user_id):
        return new_payment_provider.charge(cart)
    else:
        return legacy_payment_provider.charge(cart)
```

**Critical rule:** Clean up flags after features are fully released. Stale flags accumulate as technical debt and create a combinatorial explosion of untested states.

---

## Blue-Green Deployments

Maintain two identical environments. Blue serves live traffic; Green is idle.

```
Load Balancer
    |
    +---> Blue (v1, serving 100% traffic)
    |
    +---> Green (idle)

Step 1: Deploy v2 to Green
Step 2: Run smoke tests on Green
Step 3: Switch load balancer: Blue -> Green (Green now serving 100%)
Step 4: Monitor
Step 5: If healthy: decommission Blue or keep for fast rollback
         If unhealthy: switch load balancer back to Blue (seconds)
```

**Advantages:** Zero downtime, instant rollback, real-world testing before full traffic  
**Disadvantage:** Double infrastructure cost during transition

---

## Canary Deployments

Release the new version to a small percentage of users first. Expand if healthy; rollback if error rate rises.

```
Start:    100% -> v1 (stable)

Canary:     5% -> v2 (new version)   <- monitor error rate, latency
           95% -> v1

Promote:   50% -> v2
           50% -> v1

Full:     100% -> v2
```

Canary deployments work best when you can measure user impact automatically (error rate, latency, business conversion). Tools: Argo Rollouts, Flagger, AWS CodeDeploy, Kubernetes traffic splitting.

**Staff insight:** Define rollback criteria before the canary starts, not during it. "If error rate on v2 exceeds 2% for 5 minutes, auto-rollback" is a good policy.

---

## Rolling Updates

Kubernetes default strategy. Replaces pods one by one:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 1 extra pod above desired count during update
      maxUnavailable: 0  # zero pods unavailable during update
```

Best for stateless services where any pod can serve any request. Not suitable for stateful workloads where ordered startup/shutdown matters (use StatefulSet).

---

## Postmortems

A postmortem is a structured document produced after every significant incident. The goal is systemic learning, not blame assignment.

### Blameless Postmortem Structure

```markdown
## Incident: Payment service 30% error rate (2024-11-15)

### Impact
- Duration: 23 minutes (14:32 – 14:55 UTC)
- Users affected: ~12,000 checkout attempts
- Revenue impact: estimated $45,000 lost revenue

### Timeline
- 14:30 Deploy of v2.4.1 to production completed
- 14:32 Error rate alert fired (threshold: 1%)
- 14:35 On-call engineer acknowledged
- 14:40 Root cause identified: new payment SDK missing environment variable
- 14:43 Rollback initiated
- 14:55 Error rate returned to baseline

### Root Cause
The new payment SDK requires PAYMENT_REGION env var. The variable
was configured in staging but not in the production deployment manifest.
CI tests used mocked payment calls and did not catch the missing variable.

### Contributing Factors
- No integration test against real payment provider in staging
- Deployment manifest review did not include environment variable diff

### Action Items
| Action | Owner | Due |
|--------|-------|-----|
| Add payment provider smoke test to staging pipeline | @alice | 2024-11-22 |
| Add env var diff check to deployment checklist | @bob | 2024-11-20 |
| Alert on missing critical env vars at startup | @carol | 2024-11-29 |
```

**Key postmortem principles:**
- Complete within 48 hours while memory is fresh
- Focus on system failures, not human mistakes
- Minimum five action items; each must have an owner and deadline
- Share findings widely — learning should spread across the org
- Review action item completion 30 days later

---

## Summary

The practices in this section form the operating model for teams moving from good to elite:

- **Branching strategy** determines your merge complexity and integration risk
- **DORA metrics** provide an evidence-based view of delivery performance
- **Feature flags** separate deployment risk from release risk
- **Canary and blue-green deployments** reduce the blast radius of each change
- **Postmortems** convert incidents into systemic improvements

Each of these practices compounds. A team with trunk-based development, feature flags, and canary deployments can safely deploy ten times per day. A team with none of these would be terrified to deploy weekly.
