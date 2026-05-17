---
title: "Integration And Messaging: SQS, SNS, Kinesis, MQ"
sidebar_position: 15
---

# Integration And Messaging: SQS, SNS, Kinesis, MQ

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

SQS is a queue for work buffering. SNS is pub/sub fanout. Kinesis Data Streams is ordered streaming for real-time processing. Firehose is managed delivery into destinations. Amazon MQ is managed ActiveMQ/RabbitMQ for compatibility.

The operational reason to use messaging is failure isolation. Without a queue, a slow downstream service blocks the user path. With a queue, the app accepts work and workers process at sustainable speed. This changes the reliability model from synchronous success to durable acceptance plus asynchronous completion.

Failure modes:

- visibility timeout too short causes duplicate processing
- no DLQ means poison messages loop forever
- queue depth grows because downstream database is slow
- FIFO message group creates unexpected bottleneck
- Kinesis shard count limits throughput
- consumer retries overwhelm downstream

AWS docs:

- SQS visibility timeout: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
