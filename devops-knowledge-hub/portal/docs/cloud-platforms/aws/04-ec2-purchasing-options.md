---
title: "EC2 Purchasing Options"
sidebar_position: 4
---

# EC2 Purchasing Options

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF covers On-Demand, Reserved Instances, Savings Plans, Spot, Dedicated Hosts, Dedicated Instances, and Capacity Reservations. The real learning is that compute pricing is an availability and risk decision, not just finance.

On-Demand is flexible and expensive. Reserved Instances and Savings Plans reduce cost for predictable usage but introduce commitment. Spot is cheap but interruptible, so it is excellent for stateless, batch, CI, rendering, data processing, and fault-tolerant worker pools. It is dangerous for singleton stateful services unless the app is designed for interruption. Dedicated Hosts solve licensing and compliance constraints. Capacity Reservations solve the problem of "will AWS have capacity for me during a regional event or launch?"

Senior framing:

```text
I split capacity into baseline and elastic layers. Critical baseline uses On-Demand
or committed capacity. Interruptible overflow uses Spot when the workload can retry.
For disaster scenarios or fixed launch windows, I consider Capacity Reservations.
```

---

## Purchasing Options Comparison

| Option | Cost | Commitment | Interruption Risk | Best For |
|---|---|---|---|---|
| On-Demand | Highest | None | None | Unpredictable workloads, short-term, testing |
| Reserved Instances (1yr/3yr) | Up to 72% off | 1 or 3 years | None | Steady predictable long-running compute |
| Savings Plans (Compute/EC2) | Up to 66-72% off | 1 or 3 years ($/hr commitment) | None | Flexible commitment that adapts to instance changes |
| Spot | Up to 90% off | None | Yes (2 min warning) | Fault-tolerant, stateless, batch, CI/CD |
| Dedicated Hosts | Higher | Optional 1/3yr | None | Software licensing (per-socket/core), compliance |
| Dedicated Instances | Higher | None | None | Physical isolation from other AWS customers |
| Capacity Reservations | On-Demand price | None (can cancel) | None | Guaranteed capacity in a specific AZ |

## Reserved Instances vs Savings Plans

| Aspect | Reserved Instances | Savings Plans |
|---|---|---|
| Flexibility | Specific instance family, Region, OS | Compute SP: any family, Region, OS; EC2 SP: specific family/Region |
| Discount depth | Up to 72% | Up to 66-72% depending on plan |
| Exchange/modify | Convertible RIs can be exchanged | Automatic — commitment is a $/hr spend |
| Good for | Known instance types and sizes | Evolving infrastructure where type or Region may change |

**Practical guidance:** Savings Plans are simpler for most teams. Reserved Instances still make sense for specific large workloads with known instance requirements.

## Spot Instances: Design for Interruption

Spot instances can be interrupted with a 2-minute termination notice from AWS. Design requirements:

- **Stateless or externalized state**: no local state that cannot be reconstructed
- **Checkpointing**: batch jobs checkpoint progress so they can resume after interruption
- **Graceful shutdown**: handle `SIGTERM` on 2-minute warning to flush state and drain connections
- **Diversify**: use multiple instance types and AZs via Spot Fleet or ASG with mixed instances

```bash
# Launch a Spot instance
aws ec2 run-instances \
  --instance-type m5.xlarge \
  --instance-market-options '{"MarketType":"spot","SpotOptions":{"MaxPrice":"0.10","SpotInstanceType":"one-time"}}' \
  --image-id ami-0abcdef1234567890 \
  --subnet-id subnet-12345678

# Check Spot interruption notice from instance metadata (runs inside instance)
curl http://169.254.169.254/latest/meta-data/spot/termination-time
# Returns 404 normally; returns timestamp if interruption is imminent
```

## Production Capacity Strategy

```text
Critical always-on services (API, app servers):
  -> On-Demand baseline + Savings Plan commitment

Predictable batch or data processing:
  -> Reserved Instances or Savings Plan

Overflow / burst / CI builds / stateless workers:
  -> Spot instances via mixed-instance ASG

Compliance/licensing workloads:
  -> Dedicated Hosts with optional RI

DR standby or launch event:
  -> Capacity Reservations (zonal, pay on-demand rate)
```

## Interview Q&A

**Q: When would you use Spot instances and what must the workload support?**
A: Spot when the workload is fault-tolerant and can be interrupted: batch processing, CI/CD build agents, container workers, rendering, ML training with checkpointing. The workload must handle `SIGTERM` gracefully, checkpoint progress, and be stateless or use external storage. Never use Spot for singleton stateful services, databases, or anything where interruption causes an outage.

**Q: What is the difference between Reserved Instances and Savings Plans?**
A: Both offer discounts for commitment. Reserved Instances commit to specific instance families, Regions, and OS. Savings Plans commit to a dollar-per-hour spend amount but apply automatically across compatible usage. Savings Plans are generally more flexible for teams that change instance types over time.

**Q: What is a Capacity Reservation and when is it useful?**
A: A Capacity Reservation reserves EC2 capacity in a specific AZ and instance type without a long-term commitment. You pay On-Demand rates whether you use it or not. It is useful when you need guaranteed capacity during regional launch events, disaster recovery drills, or when AWS capacity in a popular AZ could be constrained during a crisis.
