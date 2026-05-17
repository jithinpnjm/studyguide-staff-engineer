---
title: "Machine Learning"
sidebar_position: 20
---

# Machine Learning

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The ML services in the PDF are mostly recognition-level for SAA: Rekognition, Transcribe, Polly, Translate, Lex, Comprehend, SageMaker, Kendra, Personalize, Textract. For SRE interviews, the key is not model theory. The key is platform thinking: IAM, data privacy, cost, latency, retry behavior, batch vs online inference, monitoring, and failure fallback.

Example: an app using Textract for document processing should not synchronously block the user request for a long processing pipeline. A better design accepts upload to S3, emits an event, processes asynchronously, stores status, and notifies the user.
