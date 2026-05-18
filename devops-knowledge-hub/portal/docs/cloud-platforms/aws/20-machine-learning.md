---
title: "Machine Learning"
sidebar_position: 20
---

# Machine Learning

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The ML services in the PDF are mostly recognition-level for SAA: Rekognition, Transcribe, Polly, Translate, Lex, Comprehend, SageMaker, Kendra, Personalize, Textract. For SRE interviews, the key is not model theory. The key is platform thinking: IAM, data privacy, cost, latency, retry behavior, batch vs online inference, monitoring, and failure fallback.

Example: an app using Textract for document processing should not synchronously block the user request for a long processing pipeline. A better design accepts upload to S3, emits an event, processes asynchronously, stores status, and notifies the user.

---

## AWS ML Service Reference

| Service | What It Does | SRE Concern |
|---|---|---|
| Rekognition | Image/video analysis (objects, faces, text, moderation) | Latency per call; cost per image; results storage |
| Transcribe | Speech-to-text | Async jobs for long audio; real-time streaming for live |
| Polly | Text-to-speech | Cache generated audio in S3 to avoid per-request cost |
| Translate | Language translation | Per-character pricing; cache common translations |
| Comprehend | NLP (sentiment, entities, key phrases, PII detection) | Async batch for large volumes; rate limits |
| Textract | Extract text/tables/forms from documents | Async API for long documents; results parsing logic |
| Lex | Conversational AI (chatbots) | Intent fulfillment Lambda; fallback handling |
| Kendra | Enterprise intelligent search | Index build time; connector management; query cost |
| Personalize | Recommendations | Data pipeline for training; real-time vs batch inference |
| SageMaker AI | Full ML lifecycle: build, train, deploy | Model versioning, endpoint scaling, data governance |

## SRE Perspective on ML Systems

ML services still require the same operational discipline as any other service:

```text
IAM:         Model execution roles; data access permissions; endpoint invocation
Networking:  SageMaker endpoints in VPC or public; data in private S3
Data:        Training data governance; PII handling; data lineage
Cost:        SageMaker endpoint hours can be expensive at rest; use auto-scaling
Monitoring:  Model accuracy drift; prediction latency; input data drift
Rollback:    Blue/green deployment for model updates; canary traffic routing
```

## Async vs Sync Inference Pattern

```text
Synchronous (real-time inference):
  User request -> API Gateway -> Lambda -> Rekognition/Textract
  Good for: small files, fast turnaround (<30s), user-facing results

Asynchronous (batch/async inference):
  User uploads file to S3
  -> S3 event -> SQS -> Lambda -> Textract async job
  -> Job completion -> SNS notification
  -> Lambda stores results in DynamoDB
  -> User polls status endpoint
  Good for: large files, long processing, document analysis
```

**Never block a user HTTP request on a long ML processing job.** Return a job ID immediately and let the user poll for results or receive a notification.

## SageMaker: Key Operational Concepts

| Concept | Meaning | SRE Impact |
|---|---|---|
| Training job | One-time job to build a model | GPU instance cost; spot training for batch |
| Model | Trained artifact stored in S3 | Versioning; artifact governance |
| Endpoint config | Which model version + instance type | Deploy without downtime via blue/green |
| Endpoint | Deployed inference service | Costs per hour running; auto-scaling available |
| Batch Transform | Offline inference for large datasets | No always-on endpoint needed |
| Pipelines | MLOps workflow automation | Reproducible training + deployment |
| Model Monitor | Detect data/model drift in production | Alert on prediction distribution changes |

## Cost Watch Points

```text
High ML costs usually from:
  - SageMaker endpoints running 24/7 with low utilization
    Fix: enable endpoint auto-scaling; use serverless inference for low traffic
  - Rekognition/Transcribe billed per API call on large volume without caching
    Fix: cache results in S3/DynamoDB; batch process instead of real-time
  - SageMaker training on expensive GPU instances without spot
    Fix: use Managed Spot Training for training jobs (up to 90% savings)
```

## Interview Q&A

**Q: How would you architect a document processing system using Textract that doesn't block users?**
A: Accept the document upload to S3 (presigned URL or direct API). Return a job ID to the user immediately. Trigger async processing: S3 event -> SQS -> Lambda calls `StartDocumentAnalysis` API. Lambda polls or sets up SNS callback when Textract completes. Store results in DynamoDB. User polls a status endpoint or receives webhook notification. This pattern decouples upload acknowledgment from processing completion.

**Q: What SRE concerns apply to SageMaker inference endpoints?**
A: Cost (endpoints bill per hour whether serving traffic or not), scaling (configure auto-scaling on invocations per instance metric), model updates (use blue/green or canary deployment via endpoint config update), monitoring (SageMaker Model Monitor for input data drift and prediction distribution), networking (VPC-deployed endpoints need proper security groups and VPC endpoints), and IAM (endpoint invocation policy for callers).

**Q: Why would you use Rekognition's async API instead of synchronous?**
A: Synchronous Rekognition is for images and short videos where response time is fast. Async API is required for longer videos (StartLabelDetection, GetLabelDetection pattern) because processing takes time. For high-volume image processing, batch processing with async APIs and SQS for coordination is more cost-efficient and resilient than synchronous inline processing.
