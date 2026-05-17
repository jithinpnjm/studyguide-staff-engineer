---
title: "Serverless"
sidebar_position: 17
---

# Serverless

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Serverless in the PDF includes Lambda, API Gateway, DynamoDB, Step Functions, Cognito, edge functions, and common architectures. Serverless exists to reduce server management for event-driven systems. It does not remove architecture. It moves architecture into limits, permissions, event contracts, retries, concurrency, and observability.

Lambda scales by concurrency. That is powerful but dangerous. A burst of events can create many concurrent executions, which can overwhelm databases or exhaust account concurrency. Reserved concurrency can protect a function or cap blast radius. Provisioned concurrency reduces cold start impact for latency-sensitive functions.

API Gateway adds managed API front door features: auth, throttling, routing, stages, usage plans, request validation, and integrations. Step Functions orchestrates workflows when a process needs retries, branches, waits, and long-running state. Cognito handles user identity for web/mobile apps, but authorization still needs careful design.

Failure modes:

- Lambda times out due to downstream dependency
- VPC Lambda lacks NAT/endpoints and cannot reach required service
- concurrency spike overwhelms RDS
- async retry duplicates side effects
- API Gateway throttling appears as app failure
- Step Functions workflow stuck due to unhandled state
