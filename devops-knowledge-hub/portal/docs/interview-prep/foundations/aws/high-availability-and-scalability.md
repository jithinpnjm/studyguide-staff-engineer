---
title: "High Availability And Scalability"
sidebar_position: 8
---

# High Availability And Scalability

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

Scalability means handling more load. Availability means continuing to serve through failure. A system can scale and still be fragile, or be available at normal load but fail under spikes. AWS designs usually combine load balancing, autoscaling, multiple AZs, health checks, managed databases, queues, and observability.

Vertical scaling makes a node bigger. Horizontal scaling adds more nodes. Stateless services are easier to scale horizontally because any instance can serve any request. Stateful services require externalizing state: sessions to ElastiCache/DynamoDB, files to S3/EFS, relational data to RDS/Aurora, logs to CloudWatch/S3/OpenSearch.

The core request path:

```text
Route 53 -> CloudFront/WAF -> ALB -> target group -> app tasks/instances
         -> cache/database/queue/object storage
```

Failure modes:

- ALB healthy but all targets unhealthy
- app scales out but database connection limit is exhausted
- health check endpoint does not represent readiness
- one AZ has targets but no NAT or broken dependency
- autoscaling reacts too slowly because warmup is long

Senior answer:

```text
I design stateless compute across at least two AZs behind an ALB, use ASG/ECS/EKS
scaling with meaningful metrics, keep state in managed durable services, and verify
the architecture by testing AZ loss and dependency failure.
```

AWS docs:

- ELB target health checks: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
- EC2 Auto Scaling groups: https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scaling-groups.html
