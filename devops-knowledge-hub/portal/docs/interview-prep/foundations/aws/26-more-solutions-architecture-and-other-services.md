---
title: "More Solutions Architecture And Other Services"
sidebar_position: 26
---

# More Solutions Architecture And Other Services

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF's later architecture sections connect services into patterns: Lambda/SNS/SQS fanout, S3 events, EventBridge API call reactions, API Gateway service integrations, caching, IP blocking, HPC, HA EC2, CloudFormation, SES, Pinpoint, Systems Manager, Cost Explorer, Outposts, Batch, AppFlow, Amplify, and schedulers.

For interviews, explain patterns:

- Fanout: SNS to multiple SQS queues isolates consumers.
- S3 event processing: object upload triggers async workflow.
- API Gateway service integration: API calls AWS service without custom compute.
- IP blocking: WAF for HTTP, NACL/Network Firewall for network boundaries, SG for resource access.
- HPC: placement groups, high-network instances, FSx for Lustre, Batch.
- Systems Manager: operational access without opening SSH.
- CloudFormation: repeatable infrastructure with change sets and drift awareness.
- Cost Explorer/Anomaly Detection: cost as an operational signal.
