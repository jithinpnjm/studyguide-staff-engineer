---
title: "Hands-On Labs"
sidebar_position: 5
---

# General DevOps — Hands-On Labs

Learning DevOps requires practice, not just reading. These labs are designed to produce reusable artefacts — an ADR, a postmortem, a DORA measurement — that you can reference in interviews or use in real teams. Work through them in order; each builds on the previous.

---

## Lab 1: Git Bisect Regression Hunt

**Learning goal:** Use binary search to find the commit that introduced a regression.

**Time:** 30–45 minutes

### Setup

```bash
# Create a demo repo
mkdir bisect-lab && cd bisect-lab
git init

# Create a test script
cat > test.sh << 'EOF'
#!/bin/bash
result=$(python3 -c "import math; print(int(math.sqrt(16)))")
if [ "$result" != "4" ]; then
  echo "FAIL: expected 4, got $result"
  exit 1
fi
echo "PASS"
EOF
chmod +x test.sh

# Commit the working state
git add test.sh && git commit -m "Add test: sqrt(16) == 4"
```

### Simulate a regression

```bash
# Make a series of commits, one of which breaks the test
for i in 1 2 3 4 5; do
  echo "# version $i" >> notes.txt
  git add notes.txt && git commit -m "chore: update notes v$i"
done

# Introduce a "bug" — corrupt the test
sed -i '' 's/print(int(math.sqrt(16)))/print(int(math.sqrt(15)))/' test.sh
git add test.sh && git commit -m "refactor: update math logic"

# More innocent commits after the bug
for i in 6 7; do
  echo "# version $i" >> notes.txt
  git add notes.txt && git commit -m "chore: update notes v$i"
done
```

### Hunt the regression

```bash
git bisect start
git bisect bad                    # current HEAD is broken
git bisect good HEAD~8            # this commit was good (before the bug)

# Git checks out the midpoint — run the test
./test.sh

# Tell git if this commit is good or bad
git bisect good   # or: git bisect bad

# Repeat until git identifies the breaking commit
# When found:
git bisect reset  # return to HEAD
```

### Automate with a script

```bash
git bisect start
git bisect bad
git bisect good HEAD~8
git bisect run ./test.sh   # git runs the test automatically at each step
git bisect reset
```

### Reflection questions

- How many commits did git check before finding the regression? (Binary search should need `log2(N)` checks)
- How would you use bisect in a real pipeline where the "test" is a full CI run?
- What does bisect assume about commits? (They must be independently buildable and testable)

---

## Lab 2: Writing an Architectural Decision Record

**Learning goal:** Practise capturing technical decisions with full context so future engineers understand why, not just what.

**Time:** 30 minutes

### Scenario

Your team is evaluating whether to use AWS SQS or Apache Kafka as the message broker for a new event-driven notification service. Write the ADR for whichever choice you would make.

### ADR Template

Create the file `docs/adr/ADR-007-message-broker-choice.md`:

```markdown
# ADR-007: Message Broker for Notification Service

## Status
<!-- Proposed | Accepted | Deprecated | Superseded by ADR-XXX -->
Proposed

## Date
<!-- YYYY-MM-DD -->

## Context
<!-- Describe the problem and the forces at play.
     What are the constraints? What does the team know? -->

The notification service must deliver events (user signups,
order confirmations, password resets) from the application backend
to downstream consumers (email sender, push notification service,
analytics pipeline). Expected volume: 5,000–50,000 events/hour at launch,
up to 500,000/hour at 18-month projection.

The team has:
- Strong familiarity with AWS services
- No current Kafka operational experience
- A target of 99.9% delivery reliability

## Decision
<!-- State the choice clearly. Explain why. -->


## Consequences
### Positive


### Negative


### Neutral


## Alternatives Considered
<!-- What did you reject, and why? -->


## Review Date
<!-- When should this decision be revisited? -->
```

### Fill in the ADR

Use this checklist to complete each section:

- **Decision**: State a clear choice. Avoid hedging ("we might use..."). Examples: "We will use AWS SQS" or "We will use Apache Kafka."
- **Consequences positive**: What does this choice make easier?
- **Consequences negative**: What does this choice make harder? What do you give up?
- **Alternatives considered**: Show you evaluated the other option. Name the reason for rejection.
- **Review date**: When should this be revisited? (Volume milestone? Team skill change? AWS region support?)

### ADR Peer Review Checklist

After writing, review against:

- [ ] Future engineer can understand the decision without the meeting that preceded it
- [ ] Constraints and context are stated explicitly, not assumed
- [ ] Negative consequences are honest — no "this is perfect" ADRs
- [ ] Alternatives section shows genuine evaluation
- [ ] Review date exists so the decision does not calcify

---

## Lab 3: Postmortem Template Practice

**Learning goal:** Practice writing a structured postmortem from an incident scenario.

**Time:** 45 minutes

### Scenario

**Incident:** The checkout service experienced a 15% error rate from 14:30 to 15:12 UTC on a Tuesday. Engineers traced it to a new release of the payment SDK that changed the timeout default from 30 seconds to 5 seconds. The staging environment used mocked payment calls and did not catch the regression. MTTR was 42 minutes.

Write the postmortem using the template below.

### Postmortem Template

```markdown
# Postmortem: Checkout 15% Error Rate (YYYY-MM-DD)

## Severity
<!-- P1 / P2 / P3 -->

## Status
<!-- Draft | In Review | Complete -->

## Summary
<!-- 2–3 sentences: what happened, how long, what was affected -->

## Impact
| Dimension | Value |
|-----------|-------|
| Duration | |
| Users affected | |
| Error rate peak | |
| Revenue impact (estimated) | |
| SLO burn | |

## Timeline
<!-- Factual, not blame-assigning. Use UTC timestamps. -->

| Time (UTC) | Event |
|-----------|-------|
| | Deploy of v2.4.1 completed |
| | Error rate alert fired |
| | On-call acknowledged alert |
| | Root cause identified |
| | Rollback initiated |
| | Error rate returned to baseline |
| | Incident closed |

## Root Cause
<!-- What was the actual cause? Drill past the surface symptom. -->

## Contributing Factors
<!-- What conditions made this possible? -->
<!-- Use "without X, this incident would not have occurred" format -->

1.
2.
3.

## What Went Well
<!-- Reinforce good practices to repeat them -->

1.
2.

## What Went Poorly
<!-- Honest assessment without blame -->

1.
2.

## Action Items
| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| | | P1 | | Open |
| | | P2 | | Open |
| | | P2 | | Open |

## Lessons Learned
<!-- What should the team take away? -->

## Review Date
<!-- 30 days from incident: check action item completion -->
```

### Reflection questions

After completing the postmortem:

- Are your action items specific and ownable? Can you tell if each one is done or not done?
- Did you find the systemic cause or did you stop at the surface symptom (e.g., "the SDK changed" vs "we had no integration test against real dependencies")?
- Would a new engineer reading this understand what happened and what changed as a result?

---

## Lab 4: DORA Metrics Calculation Exercise

**Learning goal:** Calculate DORA metrics from raw deployment and incident data.

**Time:** 20 minutes

### Input Data

Your team's data for the last 30 days:

**Deployments to production:**
```
2024-11-01 09:15 - v1.4.0 - clean
2024-11-03 14:20 - v1.4.1 - caused incident (P2)
2024-11-05 11:00 - v1.4.2 - clean
2024-11-08 16:30 - v1.4.3 - clean
2024-11-12 10:00 - v1.4.4 - caused incident (P1)
2024-11-15 09:00 - v1.4.5 - clean
2024-11-18 14:00 - v1.4.6 - clean
2024-11-20 11:30 - v1.4.7 - clean
2024-11-25 10:00 - v1.4.8 - clean
2024-11-28 15:00 - v1.4.9 - caused incident (P2)
```

**Incident data:**
```
Incident A: opened 2024-11-03 14:45, resolved 2024-11-03 16:10 (caused by v1.4.1)
Incident B: opened 2024-11-12 10:20, resolved 2024-11-12 13:45 (caused by v1.4.4)
Incident C: opened 2024-11-28 15:30, resolved 2024-11-28 17:00 (caused by v1.4.9)
```

**Lead time data (commit to deploy):**
```
v1.4.0: 18 hours
v1.4.1: 6 hours
v1.4.2: 2 hours
v1.4.3: 24 hours
v1.4.4: 4 hours
v1.4.5: 8 hours
v1.4.6: 3 hours
v1.4.7: 1 hour
v1.4.8: 6 hours
v1.4.9: 2 hours
```

### Calculate

```python
# 1. Deployment Frequency
# 10 deployments over 30 days = ? per week
deployments = 10
days = 30
frequency_per_week = (deployments / days) * 7
print(f"Deployment frequency: {frequency_per_week:.1f} per week")

# 2. Lead Time for Changes (mean)
lead_times_hours = [18, 6, 2, 24, 4, 8, 3, 1, 6, 2]
mean_lead_time = sum(lead_times_hours) / len(lead_times_hours)
print(f"Mean lead time: {mean_lead_time:.1f} hours")

# 3. Change Failure Rate
failed = 3   # v1.4.1, v1.4.4, v1.4.9
total = 10
cfr = (failed / total) * 100
print(f"Change failure rate: {cfr:.0f}%")

# 4. MTTR (mean time to restore)
# Incident A: 16:10 - 14:45 = 85 minutes
# Incident B: 13:45 - 10:20 = 205 minutes
# Incident C: 17:00 - 15:30 = 90 minutes
mttr_minutes = [(85 + 205 + 90) / 3]
print(f"MTTR: {mttr_minutes[0]:.0f} minutes = {mttr_minutes[0]/60:.1f} hours")
```

### Classify Your Performance

| Metric | Your Value | Elite | High | Medium | Low |
|--------|-----------|-------|------|--------|-----|
| Deployment Frequency | | Multiple/day | 1/day–1/week | 1/month–1/week | <1/month |
| Lead Time | | <1 hr | 1 day–1 wk | 1 wk–1 mo | >6 mo |
| Change Failure Rate | | 0–5% | 0–15% | 16–30% | >30% |
| MTTR | | <1 hr | <1 day | 1–7 days | >6 mo |

### Analysis questions

- Which metric is your biggest opportunity for improvement?
- A 30% change failure rate means one in three deployments caused an incident. What would you investigate first?
- If you could only improve one metric this quarter, which would have the most downstream impact on the others?

---

## Lab 5: Feature Flag Kill Switch Exercise

**Learning goal:** Understand how feature flags enable safe deployment of risky features.

**Time:** 20 minutes

### Scenario

You are deploying a new checkout flow that replaces the payment form. You want to:
1. Deploy the code to all environments (feature hidden by default)
2. Enable for 5% of users (canary)
3. Roll back instantly if error rate rises

### Implementation Sketch

```python
# Simple in-memory feature flag (for local testing)
import random

FEATURE_FLAGS = {
    "new_checkout_flow": {
        "enabled": True,
        "rollout_percentage": 5,  # 5% of users
    }
}

def is_feature_enabled(flag_name: str, user_id: str) -> bool:
    """Returns True if the feature is enabled for this user."""
    flag = FEATURE_FLAGS.get(flag_name)
    if not flag or not flag["enabled"]:
        return False
    
    # Deterministic bucketing: same user always gets same result
    bucket = int(user_id[-4:], 16) % 100  # last 4 chars of user_id as hex
    return bucket < flag["rollout_percentage"]


# Usage
def process_checkout(cart, user_id):
    if is_feature_enabled("new_checkout_flow", user_id):
        return new_checkout_handler(cart)
    else:
        return legacy_checkout_handler(cart)
```

### Kill switch test

```python
# Simulate enabling and disabling at runtime
def kill_switch(flag_name: str):
    """Instantly disable a feature without redeployment."""
    if flag_name in FEATURE_FLAGS:
        FEATURE_FLAGS[flag_name]["enabled"] = False
        print(f"Feature '{flag_name}' disabled — all users revert to default")

# In a real incident:
kill_switch("new_checkout_flow")
```

### Reflection

- What happens if the flag store (database, config service) goes down?
- How do you ensure feature flag cleanup so flags do not accumulate indefinitely?
- Why is deterministic user bucketing (same user, same experience) important for user experience?

---

## Summary

| Lab | Skill developed | Real-world application |
|-----|----------------|----------------------|
| Git bisect | Binary search debugging | Regression hunting in production |
| ADR writing | Technical decision documentation | Architecture alignment, future context |
| Postmortem | Incident retrospective | Learning from failures, action items |
| DORA calculation | Delivery metrics | Team performance baseline |
| Feature flag | Risk-controlled deployment | Safe progressive rollout |
