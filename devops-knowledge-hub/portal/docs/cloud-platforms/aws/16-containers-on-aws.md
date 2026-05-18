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

---

## ECS Concepts Reference

| Concept | Meaning |
|---|---|
| Cluster | Logical grouping of ECS capacity |
| Task definition | Container spec (image, CPU, memory, ports, env vars, volumes, roles) |
| Task | A running instance of a task definition |
| Service | Maintains desired count of tasks; integrates with ALB and auto scaling |
| Task execution role | Used by ECS/Fargate agent: pull image from ECR, write logs to CloudWatch |
| Task role | Used by application code inside the container to call AWS APIs |
| Launch type: EC2 | You manage the cluster EC2 instances |
| Launch type: Fargate | AWS manages underlying compute; you only manage task spec |

**Task role vs execution role — the most common confusion:**
```text
Execution role permissions (ECS agent):
  ecr:GetAuthorizationToken
  ecr:BatchGetImage
  logs:CreateLogStream
  logs:PutLogEvents
  secretsmanager:GetSecretValue (if injecting secrets)

Task role permissions (application code):
  s3:GetObject, s3:PutObject
  dynamodb:GetItem, dynamodb:PutItem
  kms:Decrypt
  sqs:SendMessage
  ... (whatever the app actually calls)
```

## ECS Launch Type Decision

| Criteria | EC2 Launch Type | Fargate |
|---|---|---|
| Cost model | Pay for EC2 instances (whether busy or idle) | Pay per task vCPU and memory |
| Operational burden | Manage AMI, patching, cluster capacity | AWS manages underlying compute |
| Daemon containers | Supported (one per host) | Not natively supported |
| GPU workloads | Supported | Not supported |
| Custom networking | More flexible ENI configuration | Each task gets own ENI (awsvpc mode) |
| Large clusters | More cost-efficient at scale | Easier to operate |

## EKS Key Concepts for SRE

| Kubernetes Concept | AWS Implementation |
|---|---|
| Pod networking | VPC CNI: each pod gets a real VPC IP from a subnet |
| Service type LoadBalancer | AWS Load Balancer Controller creates ALB/NLB |
| PersistentVolumeClaim | EBS CSI driver (single-AZ) or EFS CSI driver (multi-AZ) |
| ServiceAccount identity | IRSA (IAM Role for Service Accounts) or EKS Pod Identity |
| Node scaling | Managed node groups + Cluster Autoscaler, or Karpenter |
| Node OS/patching | Managed node groups: AWS manages; self-managed: you manage |

**VPC CNI IP exhaustion** is a real production risk. Each node allocates a pool of IP addresses from its subnet. If subnets are too small or nodes are too large, the cluster runs out of IP capacity. Plan subnet sizes based on maximum expected node count × max pods per node.

## ECR: Container Registry

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Create a repository
aws ecr create-repository --repository-name my-app

# Push image
docker tag my-app:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest

# Scan image for vulnerabilities
aws ecr start-image-scan \
  --repository-name my-app \
  --image-id imageTag=latest
```

## CLI: ECS Operations

```bash
# List running services in a cluster
aws ecs list-services --cluster my-cluster

# Check service events (useful for deployment failures)
aws ecs describe-services \
  --cluster my-cluster \
  --services my-service \
  --query "services[0].events[:5]"

# Force new deployment (trigger task replacement)
aws ecs update-service \
  --cluster my-cluster \
  --service my-service \
  --force-new-deployment

# Get task definition details
aws ecs describe-task-definition --task-definition my-task:5

# List stopped tasks with stopped reason
aws ecs list-tasks --cluster my-cluster --desired-status STOPPED
aws ecs describe-tasks --cluster my-cluster --tasks <task-arn> \
  --query "tasks[0].{Status:lastStatus,StopCode:stopCode,StopReason:stoppedReason}"
```

## Failure Modes and Fixes

| Failure | Root Cause | Fix |
|---|---|---|
| Tasks keep stopping with `CannotPullContainerError` | ECR not reachable: missing VPC endpoint or NAT; wrong execution role | Add ECR VPC endpoint or NAT; verify execution role has `ecr:*` permissions |
| App can't call AWS APIs from container | Task role not configured or misconfigured | Check task definition for `taskRoleArn`; verify role permissions |
| Service can't scale out (Fargate) | ENI capacity exhausted in subnet | Use larger subnets; check AWS account ENI limit |
| EKS pods can't get IPs | VPC CNI exhausted IPs in node subnet | Increase subnet CIDR; use prefix delegation mode on CNI |
| Deployment stuck, tasks never healthy | Health check path wrong or too strict | Check ALB target group health reason code; test health endpoint manually |
| EKS workload gets `AccessDenied` on AWS API | IRSA trust condition mismatch or service account not annotated | Verify annotation on service account; check OIDC subject in trust policy |

## Service Comparison: ECS vs EKS vs Fargate vs App Runner

| Service | Best For |
|---|---|
| ECS on EC2 | Containers on EC2 fleet; daemons; GPU; cost-optimized at scale |
| ECS on Fargate | Serverless containers; no cluster management; per-task billing |
| EKS | Kubernetes workloads; GitOps; multi-cloud portability; CRD ecosystem |
| App Runner | Simplest container deployment; auto-scaling; no VPC config needed for basic use |

## Interview Q&A

**Q: What is the difference between the ECS task execution role and the task role?**
A: The execution role is used by the ECS agent and Fargate runtime to pull the container image from ECR and write logs to CloudWatch. The task role is used by application code running inside the container to call AWS services. A common mistake is attaching S3 permissions to the execution role (where the app code can't use them) instead of the task role.

**Q: How does networking work for ECS Fargate tasks?**
A: Fargate uses `awsvpc` network mode. Each task gets its own ENI with a private IP from the subnet. This means you apply security groups directly to tasks. It also means each task consumes one IP, so subnet sizing must account for the maximum number of running tasks.

**Q: How do EKS pods get AWS IAM permissions?**
A: Through IRSA (IAM Roles for Service Accounts) or the newer EKS Pod Identity. The Kubernetes service account is annotated with an IAM role ARN. The IAM role has a trust policy that allows assumption by the cluster's OIDC provider for a specific service account name and namespace. The pod gets temporary credentials via a projected volume that the AWS SDK automatically uses.
