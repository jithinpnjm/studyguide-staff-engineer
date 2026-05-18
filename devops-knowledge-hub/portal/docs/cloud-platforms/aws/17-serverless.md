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

---

## Lambda: Key Configuration and Limits

| Setting | Range / Notes | Operational Impact |
|---|---|---|
| Memory | 128 MB – 10,240 MB | CPU scales proportionally with memory |
| Timeout | 1 sec – 15 minutes | Set to max reasonable time; downstream timeouts must be shorter |
| Ephemeral storage `/tmp` | 512 MB – 10,240 MB | Use for temp files; not shared between invocations |
| Concurrency | Default 1000/account per Region | Burst spike can hit account limit; use reserved concurrency to isolate functions |
| Reserved concurrency | Set per function | Guarantees capacity; also caps max concurrency (blast radius control) |
| Provisioned concurrency | Pre-warmed environments | Eliminates cold start for latency-sensitive functions; costs more |
| Package size | 50 MB zipped / 250 MB unzipped | Use Lambda layers for shared dependencies; container image up to 10 GB |

## Lambda Concurrency: Critical Concept

```text
Total account concurrency limit (e.g. 1000):
  Function A: reserved 200 -> guaranteed 200, max 200
  Function B: reserved 300 -> guaranteed 300, max 300
  All other functions: share remaining 500

Reserved concurrency = 0 -> function is THROTTLED (disabled)
No reserved concurrency -> shares unreserved pool
```

**Production pattern:** Give critical business functions reserved concurrency. Cap background/batch functions so they cannot starve user-facing functions.

## Lambda Networking: VPC vs Non-VPC

| Aspect | Non-VPC Lambda | VPC Lambda |
|---|---|---|
| Default internet access | Yes (AWS managed NAT) | No — needs NAT Gateway or VPC endpoints |
| Can access VPC resources (RDS, ElastiCache) | No | Yes |
| Cold start impact | Minimal | Slightly higher (ENI setup, reduced with Hyperplane ENI) |
| Best for | Public APIs, S3, DynamoDB, SQS | RDS, ElastiCache, private endpoints |

**VPC Lambda checklist:** subnet has route to NAT GW (for internet) OR VPC endpoints for required AWS services, security group allows outbound on required ports.

## API Gateway Types

| Type | Use Case |
|---|---|
| REST API | Full-featured: stages, usage plans, caching, request/response transformation |
| HTTP API | Simpler, lower cost, faster: Lambda, JWT auth; no full REST features |
| WebSocket API | Bidirectional real-time: chat, notifications, live data |
| Private API | Accessible only within VPC via interface endpoint |

**REST API vs HTTP API decision:** HTTP API is cheaper and lower latency for simple Lambda + JWT integrations. Use REST API when you need caching, request validation, WAF integration, usage plans, or API keys.

## Step Functions: Workflow Patterns

```text
Standard Workflow: long-running (up to 1 year), async, exactly-once execution
Express Workflow: high-volume, short-duration (<5 min), at-least-once

Good for:
  - Multi-step order processing
  - Human approval loops
  - ETL pipeline orchestration
  - Retry with exponential backoff built into state machine
```

## CLI: Common Lambda Operations

```bash
# Invoke a Lambda function synchronously
aws lambda invoke \
  --function-name my-function \
  --payload '{"key":"value"}' \
  --cli-binary-format raw-in-base64-out \
  output.json && cat output.json

# Get function configuration (check timeout, memory, role, VPC)
aws lambda get-function-configuration --function-name my-function

# Check concurrency settings
aws lambda get-function-concurrency --function-name my-function

# View recent invocation errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/my-function \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-1H +%s)000

# Update function memory and timeout
aws lambda update-function-configuration \
  --function-name my-function \
  --timeout 60 \
  --memory-size 512

# Put a concurrency reservation
aws lambda put-function-concurrency \
  --function-name my-function \
  --reserved-concurrent-executions 100
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| Lambda times out | Downstream (DB, HTTP) takes longer than Lambda timeout | Shorten downstream timeout; increase Lambda timeout; add circuit breaker |
| VPC Lambda can't reach Secrets Manager | No interface endpoint and no NAT | Add VPC endpoint for Secrets Manager or NAT Gateway |
| Concurrency spike exhausts DB connections | Lambda creates a new connection per invocation | Add RDS Proxy; pool connections outside the handler |
| Async Lambda retry causes duplicate side effects | Lambda retries failed async invocations up to 2x | Make handlers idempotent; use DLQ to capture final failures |
| API Gateway returns 429 | Account/stage/usage plan throttle limit hit | Increase burst/rate limits; use SQS buffer for async workloads |
| Cold start latency too high | No provisioned concurrency; large deployment package | Use provisioned concurrency for SLA-sensitive paths; slim package with layers |

## Serverless Architecture Pattern

```text
CloudFront (CDN + WAF)
  -> S3 (static frontend)
  -> API Gateway HTTP API
     -> Lambda (business logic)
        -> DynamoDB (serverless NoSQL)
        -> SQS (async work queue)
        -> EventBridge (scheduled triggers)
```

This architecture has no servers to manage. It scales to zero at idle and scales automatically under load — but concurrency, timeout, cold starts, and downstream connection limits still require design decisions.

## Interview Q&A

**Q: How does Lambda concurrency work and why does it matter for reliability?**
A: Each invocation runs in its own isolated environment. If 1,000 events fire simultaneously, Lambda may start 1,000 concurrent executions. Without reserved concurrency, a burst can consume the entire account limit (default 1,000/Region), throttling all other functions. Reserved concurrency on a function guarantees capacity and also caps its blast radius. Provisioned concurrency keeps environments pre-warmed to eliminate cold start latency.

**Q: Why does a VPC Lambda sometimes time out calling AWS services?**
A: VPC Lambda does not have automatic internet access. It must go through NAT Gateway (for internet) or VPC endpoints (for AWS services). Without these, calls to Secrets Manager, S3, SSM, or any AWS API silently time out because there is no route to reach the AWS service endpoint. Check VPC endpoints first, then NAT Gateway configuration.

**Q: When would you choose Step Functions over SQS for orchestration?**
A: Step Functions when you need visible workflow state, branching logic, built-in retry/backoff per state, wait states, parallel execution, and human approval steps. SQS when you only need simple task buffering between producers and consumers with no complex orchestration logic.
