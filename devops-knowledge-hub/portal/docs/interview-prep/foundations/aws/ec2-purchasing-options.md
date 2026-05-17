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
