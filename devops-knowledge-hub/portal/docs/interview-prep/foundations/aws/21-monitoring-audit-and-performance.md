---
title: "Monitoring, Audit, And Performance"
sidebar_position: 21
---

# Monitoring, Audit, And Performance

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF covers CloudWatch, CloudTrail, EventBridge, Config, Insights tools, alarms, logs, and container/Lambda visibility. The senior model is to separate telemetry questions:

```text
CloudWatch metrics/logs: what is happening operationally?
CloudTrail: who called which AWS API?
Config: how did resource configuration change?
VPC Flow Logs: what network flows happened?
EventBridge: how do we react to events?
```

Failure mode: a production route table changes and the app loses connectivity. CloudWatch shows errors, but CloudTrail tells who changed the route table. Config shows before/after configuration. VPC Flow Logs show rejected or missing traffic patterns. You need all layers.
