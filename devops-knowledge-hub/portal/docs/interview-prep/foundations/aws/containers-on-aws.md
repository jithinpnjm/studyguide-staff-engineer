---
title: "Containers On AWS"
sidebar_position: 16
---

# Containers On AWS

> Source spine: `AWS Certified Solutions Architect Slides v47.pdf`. Teaching style: Senior SRE / Platform Engineering handbook.

The PDF covers Docker, ECR, ECS, Fargate, ECS IAM roles, load balancer integration, ECS scaling, EKS, node types, volumes, App Runner, and migration tools. The senior view is that containers separate packaging from scheduling. AWS then gives you multiple schedulers.

ECS is AWS-native and simpler. It is a good fit when you want container orchestration without Kubernetes complexity. EKS is Kubernetes. It is powerful when you need Kubernetes APIs, controllers, ecosystem tools, CRDs, GitOps workflows, or multi-cloud-ish operating models. Fargate removes node management but changes cost, debugging, daemon, and networking assumptions.

For ECS, task role vs execution role is critical. The execution role lets ECS pull images and write logs. The task role is what application code uses to call AWS APIs. Mixing them up causes real production failures.

For EKS, connect Kubernetes concepts to AWS:

```text
Pod networking -> VPC CNI, ENIs, subnet IP capacity
Service LoadBalancer -> AWS load balancer controller / ELB
PersistentVolume -> EBS or EFS CSI driver
ServiceAccount identity -> IAM role mapping
Node scaling -> managed node groups, Cluster Autoscaler, or Karpenter
```

AWS docs:

- ECS task role: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
- ECS task execution role: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html
