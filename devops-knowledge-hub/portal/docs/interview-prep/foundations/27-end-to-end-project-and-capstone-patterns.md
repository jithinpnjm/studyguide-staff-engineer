---
title: "End-to-End Platform Engineering Patterns"
sidebar_position: 27
---

# End-to-End Platform Engineering Patterns

## What It Is and Why It Matters

Most platform engineering knowledge is taught tool by tool: Kubernetes here, Terraform there, Prometheus separately. In production, none of these tools operate in isolation. A real platform is a composition — Terraform provisions the cluster, Kubernetes runs the workloads, GitHub Actions pushes the images, ArgoCD deploys the manifests, Prometheus watches the metrics, and PagerDuty wakes you up at 3am when something breaks.

This guide walks through how those pieces connect. It covers three reference architectures: a web application platform, a data pipeline platform, and a machine learning inference platform. For each, it shows how the layers of infrastructure, deployment, observability, and security fit together — and where the common failure points are.

Understanding end-to-end composition matters because: you will be asked to design systems, debug cross-layer failures, and explain why specific choices were made. Being able to trace a request from DNS to database — or explain why a deployment failed at the ArgoCD sync rather than at the CI scan — is what separates a platform engineer from someone who knows individual tools.

---

## Mental Model: The Platform Stack

A production platform has five layers. Every tool you know lives in one of them:

```
┌─────────────────────────────────────────────────────┐
│ Layer 5: Observability                               │
│   Prometheus · Grafana · AlertManager · Loki        │
├─────────────────────────────────────────────────────┤
│ Layer 4: Application Delivery                        │
│   ArgoCD · Helm · Kustomize · Argo Rollouts         │
├─────────────────────────────────────────────────────┤
│ Layer 3: Build and Supply Chain                      │
│   GitHub Actions · Jenkins · Trivy · SonarQube      │
│   Cosign · SLSA                                     │
├─────────────────────────────────────────────────────┤
│ Layer 2: Compute and Orchestration                   │
│   Kubernetes (EKS/AKS/GKE) · Docker · containerd   │
├─────────────────────────────────────────────────────┤
│ Layer 1: Infrastructure                              │
│   Terraform · AWS/Azure/GCP · VPC · IAM · DNS      │
└─────────────────────────────────────────────────────┘
```

Changes flow downward: infrastructure changes require cluster changes; cluster changes affect deployment; deployment changes affect what observability sees. Failures often propagate upward: infrastructure misconfiguration causes deployment failures, which cause observability alerts.

The key insight: **understand each layer's contract with the layers above and below**. Terraform's output is the cluster endpoint. The cluster's contract with the deployment layer is the Kubernetes API. The deployment layer's contract with observability is the metrics endpoint. Breaking a layer's contract cascades.

---

## Reference Architecture 1: Web Application Platform

### Architecture Overview

```
Internet → Route 53 → ALB (AWS) → NGINX Ingress → Service → Pod
                                      ↑
                             TLS terminated at ALB
                             or at NGINX with cert-manager

Infrastructure:
  Terraform → VPC (3 AZ) → EKS cluster → node groups
            → RDS (Multi-AZ) → ElastiCache → S3 buckets
            → ACM certificate → Route 53 record

CI/CD:
  Developer push → GitHub Actions (build, test, scan, push to ECR)
                → ArgoCD (watches ECR tag → deploys to EKS)

Observability:
  Prometheus → scrapes pods, nodes, NGINX, RDS exporter
  Alertmanager → PagerDuty for P1/P2, Slack for P3
  Grafana → dashboards for SLO, infra, application
  Loki → log aggregation from all pods
```

### Terraform Layer

```hcl
# modules/eks-cluster/main.tf
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = false    # no public API endpoint in production
    security_group_ids      = [aws_security_group.cluster.id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "main"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 3
  }

  instance_types = ["m5.xlarge"]

  lifecycle {
    ignore_changes = [scaling_config[0].desired_size]   # let cluster autoscaler manage
  }
}

# IRSA for pods that need AWS access
resource "aws_iam_role" "app" {
  name = "${var.cluster_name}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub" = "system:serviceaccount:production:myapp"
        }
      }
    }]
  })
}
```

State organization — split by lifecycle:

```
terraform/
├── 00-bootstrap/        # S3 backend, DynamoDB, IAM for Terraform runner
├── 10-networking/       # VPC, subnets, NAT, TGW attachments
├── 20-security/         # KMS keys, security groups, IAM roles
├── 30-kubernetes/       # EKS cluster, node groups, IRSA roles
├── 40-databases/        # RDS, ElastiCache, parameter groups
└── 50-applications/     # ACM, Route 53, ALB, ECR repos
```

Each layer has its own `terraform.tfstate` in S3. Lower layers export values to SSM Parameter Store; upper layers read from SSM. This prevents a broken application layer from corrupting network state.

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  ECR_REGISTRY: 123456789.dkr.ecr.us-east-1.amazonaws.com
  IMAGE_NAME: myapp

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run unit tests
        run: |
          python -m pytest tests/unit/ --cov=src --cov-report=xml

      - name: SonarQube scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

      - name: Quality gate check
        uses: SonarSource/sonarqube-quality-gate-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC — no long-lived secrets)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-ecr
          aws-region: us-east-1

      - name: Build image
        run: |
          IMAGE_TAG="${{ github.sha }}"
          docker build -t ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} .
          docker tag ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} \
                     ${ECR_REGISTRY}/${IMAGE_NAME}:latest

      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          exit-code: 1
          severity: CRITICAL

      - name: Sign image (Cosign)
        run: |
          cosign sign --key awskms:///alias/cosign-key \
            ${ECR_REGISTRY}/${IMAGE_NAME}:${{ github.sha }}

      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS \
            --password-stdin ${ECR_REGISTRY}
          docker push ${ECR_REGISTRY}/${IMAGE_NAME}:${{ github.sha }}
          docker push ${ECR_REGISTRY}/${IMAGE_NAME}:latest

      - name: Update Kubernetes manifest
        run: |
          # Update the image tag in the GitOps repo
          git clone https://x-access-token:${{ secrets.GITOPS_TOKEN }}@github.com/org/k8s-manifests
          cd k8s-manifests
          yq -i ".spec.template.spec.containers[0].image = \"${ECR_REGISTRY}/${IMAGE_NAME}:${{ github.sha }}\"" \
            apps/myapp/deployment.yaml
          git config user.email "ci@company.com"
          git config user.name "CI Bot"
          git commit -am "ci: update myapp to ${{ github.sha }}"
          git push
```

ArgoCD then detects the manifest change and syncs automatically.

### Kubernetes Manifests

```yaml
# apps/myapp/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: myapp    # IRSA-annotated service account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      terminationGracePeriodSeconds: 60

      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: myapp

      containers:
        - name: myapp
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:abc123
          ports:
            - containerPort: 8080

          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "1000m"
              memory: "512Mi"

          startupProbe:
            httpGet:
              path: /health
              port: 8080
            failureThreshold: 30
            periodSeconds: 10

          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3

          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 15
            failureThreshold: 3

          env:
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: db-host
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: myapp-config
                  key: log-level
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
  namespace: production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: myapp
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

### Observability Stack

```yaml
# prometheus/rules/myapp.yaml
groups:
  - name: myapp.slo
    rules:
      # SLI: request success rate
      - record: myapp:request_success_rate:5m
        expr: |
          sum(rate(http_requests_total{job="myapp",status!~"5.."}[5m]))
          /
          sum(rate(http_requests_total{job="myapp"}[5m]))

      # SLO: 99.9% availability
      # Error budget burn rate alert (multi-window)
      - alert: MyAppHighErrorBudgetBurn
        expr: |
          (
            myapp:request_success_rate:1h < (1 - 14 * (1 - 0.999))
          ) and (
            myapp:request_success_rate:5m < (1 - 14 * (1 - 0.999))
          )
        for: 2m
        labels:
          severity: page
        annotations:
          summary: "High error budget burn rate — paging on-call"
          runbook: "https://wiki/runbooks/myapp-high-error-rate"

      - alert: MyAppHighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{job="myapp"}[5m]))
            by (le)
          ) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p99 latency above 500ms"
```

---

## Reference Architecture 2: Data Pipeline Platform

### Architecture Overview

```
Data Sources → Kafka (MSK) → Consumer Applications → PostgreSQL / S3 / Redshift
                  ↑
           Producers (microservices, CDC from RDS)

Infrastructure:
  Terraform → MSK cluster → EKS cluster → RDS (source) → S3 (lake)
            → Redshift (warehouse) → Airflow (orchestration on EKS)

Pipeline:
  RDS → Debezium (CDC) → Kafka → Flink/Spark Streaming
      → processed events → S3 parquet → Redshift Spectrum

CI/CD:
  Python pipeline code → GitHub Actions (test, build, push to ECR)
                      → ArgoCD (deploy consumer pods)
  dbt models → GitHub Actions (dbt run --profiles-dir)
             → schedule via Airflow DAG
```

### Kafka Consumer Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-event-consumer
  namespace: pipelines
spec:
  replicas: 6    # match partition count for full parallelism
  selector:
    matchLabels:
      app: order-event-consumer
  template:
    spec:
      containers:
        - name: consumer
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/order-consumer:v1.2
          env:
            - name: KAFKA_BROKERS
              value: "b-1.msk.us-east-1.amazonaws.com:9092,b-2.msk.us-east-1.amazonaws.com:9092"
            - name: KAFKA_GROUP_ID
              value: "order-processor-v2"
            - name: KAFKA_TOPIC
              value: "orders.created"
            - name: KAFKA_AUTO_OFFSET_RESET
              value: "earliest"
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "1Gi"
```

Consumer lag monitoring:

```yaml
# prometheus/rules/kafka.yaml
- alert: KafkaConsumerHighLag
  expr: |
    kafka_consumer_group_lag{
      group="order-processor-v2",
      topic="orders.created"
    } > 10000
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Consumer lag {{ $value }} — pipeline is falling behind"
    runbook: "https://wiki/runbooks/kafka-consumer-lag"
```

### Airflow on Kubernetes

```python
# dags/daily_warehouse_refresh.py
from airflow import DAG
from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator
from datetime import datetime, timedelta

with DAG(
    "daily_warehouse_refresh",
    schedule_interval="0 6 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=5)},
) as dag:

    dbt_run = KubernetesPodOperator(
        task_id="dbt_run",
        image="123456789.dkr.ecr.us-east-1.amazonaws.com/dbt:latest",
        cmds=["dbt", "run", "--profiles-dir", "/secrets", "--target", "prod"],
        namespace="pipelines",
        service_account_name="dbt-runner",    # IRSA for Redshift access
        secrets=[
            k8s.V1EnvFromSource(
                secret_ref=k8s.V1SecretEnvSource(name="redshift-credentials")
            )
        ],
        resources=k8s.V1ResourceRequirements(
            requests={"cpu": "1", "memory": "2Gi"},
            limits={"cpu": "2", "memory": "4Gi"},
        ),
        retries=2,
    )

    dbt_test = KubernetesPodOperator(
        task_id="dbt_test",
        image="123456789.dkr.ecr.us-east-1.amazonaws.com/dbt:latest",
        cmds=["dbt", "test", "--profiles-dir", "/secrets", "--target", "prod"],
        namespace="pipelines",
        service_account_name="dbt-runner",
    )

    dbt_run >> dbt_test
```

---

## Reference Architecture 3: ML Inference Platform

### Architecture Overview

```
Model Training (offline) → S3 model artifacts
                               ↓
Model Serving → Triton Inference Server / TorchServe on GPU nodes (EKS)
                               ↓
API Gateway → NGINX Ingress → Service → Inference Pod
                               ↓
Observability → model latency p50/p95/p99, GPU utilization, batch queue depth

Infrastructure:
  Terraform → EKS + GPU node group (g4dn.xlarge)
            → S3 for model artifacts
            → ECR for serving containers
            → Redis for request batching
```

### GPU Node Configuration

```hcl
# terraform/30-kubernetes/gpu-nodes.tf
resource "aws_eks_node_group" "gpu" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "gpu"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = 0
    max_size     = 10
    min_size     = 0
  }

  instance_types = ["g4dn.xlarge"]

  taint {
    key    = "nvidia.com/gpu"
    value  = "present"
    effect = "NO_SCHEDULE"
  }

  labels = {
    "hardware"                     = "gpu"
    "nvidia.com/gpu"               = "present"
  }
}
```

```yaml
# Inference deployment with GPU request
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inference-server
  namespace: ml-serving
spec:
  replicas: 2
  template:
    spec:
      tolerations:
        - key: "nvidia.com/gpu"
          operator: "Exists"
          effect: "NoSchedule"
      nodeSelector:
        hardware: gpu

      initContainers:
        - name: model-downloader
          image: amazon/aws-cli:latest
          command: ["aws", "s3", "sync", "s3://models-bucket/v3/", "/models/"]
          volumeMounts:
            - name: model-storage
              mountPath: /models

      containers:
        - name: inference
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/inference:v3
          resources:
            limits:
              nvidia.com/gpu: "1"
              memory: "8Gi"
            requests:
              nvidia.com/gpu: "1"
              memory: "8Gi"
          volumeMounts:
            - name: model-storage
              mountPath: /models

      volumes:
        - name: model-storage
          emptyDir: {}
```

HPA on custom metrics (GPU queue depth via Prometheus adapter):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: inference-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: inference-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: External
      external:
        metric:
          name: inference_queue_depth
        target:
          type: AverageValue
          averageValue: "50"   # scale when avg queue depth exceeds 50 requests
```

---

## Cross-Cutting Patterns

### Secret Management Pattern

Never store secrets in Git. The two common patterns:

**External Secrets Operator (ESO)** — pulls secrets from AWS Secrets Manager at deploy time:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secrets
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: myapp-secrets    # creates this Kubernetes Secret
    creationPolicy: Owner
  data:
    - secretKey: db-password
      remoteRef:
        key: production/myapp/database
        property: password
    - secretKey: api-key
      remoteRef:
        key: production/myapp/api-credentials
        property: key
```

**Vault Agent Injector** — injects secrets as files into pods via sidecar:

```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "myapp"
  vault.hashicorp.com/agent-inject-secret-config: "secret/data/myapp/config"
  vault.hashicorp.com/agent-inject-template-config: |
    {{- with secret "secret/data/myapp/config" -}}
    export DB_PASSWORD="{{ .Data.data.db_password }}"
    {{- end }}
```

### Namespace and RBAC Pattern

```yaml
# namespace per team, not per application
apiVersion: v1
kind: Namespace
metadata:
  name: platform-team
  labels:
    team: platform
    environment: production
---
# Team can manage their deployments but not cluster-wide resources
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: platform-team-deploy
  namespace: platform-team
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: edit        # can create/update/delete most resources, not RBAC
subjects:
  - kind: Group
    name: platform-team
    apiGroup: rbac.authorization.k8s.io
---
# CI service account can only update deployments
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ci-deploy
  namespace: platform-team
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "patch", "update"]
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "create", "update", "patch"]
```

### Multi-Environment Promotion Pattern

```
feature-branch → PR → CI runs (test, scan, quality gate)
                    ↓
main branch → CI builds image, tags with git sha
                    ↓
            → updates dev overlay (Kustomize)
                    ↓
ArgoCD auto-syncs dev environment
                    ↓
            (manual promotion) developer runs:
            ./scripts/promote.sh dev staging abc123
                    ↓
            → updates staging overlay
                    ↓
ArgoCD auto-syncs staging
                    ↓
            (approval gate) change request approved
                    ↓
            → updates production overlay
                    ↓
ArgoCD syncs production (manual sync or auto with approval)
```

Kustomize overlay structure:

```
k8s/
├── base/
│   ├── deployment.yaml      # image: myapp:latest (placeholder)
│   ├── service.yaml
│   ├── configmap.yaml
│   └── kustomization.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml   # sets replicas: 1, image tag, dev config
    │   └── patches/
    │       └── deployment-patch.yaml
    ├── staging/
    │   ├── kustomization.yaml   # sets replicas: 2, staging image tag
    │   └── patches/
    └── production/
        ├── kustomization.yaml   # sets replicas: 3+, prod image tag
        └── patches/
```

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

resources:
  - ../../base

images:
  - name: myapp
    newName: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp
    newTag: "abc123def456"   # updated by CI

patches:
  - path: patches/deployment-patch.yaml

configMapGenerator:
  - name: myapp-config
    literals:
      - log-level=warn
      - environment=production
```

### Canary Deployment Pattern

```yaml
# Argo Rollouts canary strategy
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: myapp-canary
      stableService: myapp-stable
      trafficRouting:
        nginx:
          stableIngress: myapp-ingress
      steps:
        - setWeight: 5       # 5% traffic to canary
        - pause: {duration: 5m}
        - analysis:
            templates:
              - templateName: error-rate-check
        - setWeight: 20
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100
      analysisRunMetadata:
        labels:
          app: myapp
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
spec:
  metrics:
    - name: error-rate
      interval: 1m
      successCondition: result[0] < 0.01   # less than 1% error rate
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{app="myapp-canary",status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total{app="myapp-canary"}[5m]))
```

---

## Debugging End-to-End Failures

### Deployment Failure Trace

When a deployment fails, trace through each layer:

```
1. Check the CI pipeline
   → GitHub Actions: did the build pass? Did Trivy block it?
   → ArgoCD: is the application in Sync error state?

2. Check the Kubernetes layer
   → kubectl rollout status deployment/myapp -n production
   → kubectl get events -n production --sort-by=.metadata.creationTimestamp
   → kubectl describe pod <failing-pod> -n production

3. Check the image
   → kubectl get pods -n production -o jsonpath='{..image}'
   → Is the image digest what CI pushed?
   → kubectl describe pod → Events: ImagePullBackOff? OOMKilled? CrashLoopBackOff?

4. Check logs
   → kubectl logs deployment/myapp -n production --previous
   → Is there a panic/fatal? DB connection refused? Missing env var?

5. Check the dependencies
   → Can the pod reach the database? kubectl exec -it <pod> -- nc -zv db-host 5432
   → Can the pod reach AWS services? Is the IRSA role correct?
   → Is the Secret referenced in env properly created?
```

### Traffic Not Reaching Pod

```
1. Check DNS
   → nslookup myapp.production.svc.cluster.local from a debug pod
   → Should resolve to ClusterIP

2. Check Service endpoints
   → kubectl get endpoints myapp -n production
   → Empty endpoints = selector doesn't match pod labels

3. Check NetworkPolicy
   → kubectl get networkpolicies -n production
   → Is ingress allowed from the ingress controller namespace?

4. Check the Ingress
   → kubectl describe ingress myapp -n production
   → Check the NGINX controller logs: kubectl logs -n ingress-nginx deploy/ingress-nginx-controller

5. Check TLS
   → kubectl get certificate -n production
   → Is cert-manager Ready? Is the secret created?
   → openssl s_client -connect myapp.example.com:443 -servername myapp.example.com
```

### Observability Gap Diagnosis

When you get an alert but can't find the cause:

```bash
# Is Prometheus scraping this pod?
kubectl exec -n monitoring prometheus-0 -- \
  wget -qO- "localhost:9090/api/v1/targets" | jq '.data.activeTargets[] | select(.labels.job=="myapp")'

# What metrics is the pod actually exposing?
kubectl exec -n production -it $(kubectl get pod -n production -l app=myapp -o name | head -1) \
  -- wget -qO- localhost:8080/metrics | head -50

# Is the alert rule evaluating correctly?
kubectl exec -n monitoring prometheus-0 -- \
  wget -qO- "localhost:9090/api/v1/query?query=myapp:request_success_rate:5m"
```

---

## Common Failure Modes

**"Deployment succeeded but old code is still running":** ArgoCD shows synced but pods have old image. Check if the `imagePullPolicy` is `IfNotPresent` (won't pull if tag exists) and you're reusing the `latest` tag. Fix: always use immutable tags (git SHA). Force rollout with `kubectl rollout restart deployment/myapp`.

**"Works in staging, fails in production":** Most common causes:
- Different secret values (staging DB vs prod DB credentials)
- Different resource limits (prod limits hit, staging never does)
- Different replica counts (race condition only visible under load)
- Missing permissions (IRSA role in staging has `*`, production has least privilege)
- NetworkPolicy in production blocking a dependency that staging allows

**"CI passes, ArgoCD won't sync":** ArgoCD may refuse to sync if it detects a diff it doesn't understand — e.g., an operator mutates the resource. Fix: add `ignoreDifferences` in the ArgoCD Application spec for fields managed by operators (replicas managed by HPA, fields injected by admission webhooks).

**"Terraform plan shows no changes but infrastructure drifted":** Someone made a manual change via the AWS console. `terraform plan` won't detect it if the change is on a resource attribute Terraform doesn't manage. Fix: use `terraform plan --detailed-exitcode` in CI to detect drift. For resources you want Terraform to own completely, add `lifecycle { ignore_changes = [] }` nowhere — instead, lock down console access via IAM.

**"New service can't reach the database":** Common causes in order:
1. Secret not created in correct namespace
2. IRSA role missing RDS permission
3. Security group rule missing (pod CIDR not allowed on DB SG)
4. NetworkPolicy blocking egress from the pod namespace
5. RDS parameter group requiring SSL (app not configured for SSL)

**"Alert firing but SLO dashboard shows OK":** Recording rule and alert rule use different time windows or label selectors. Alert fires on 5m window, SLO dashboard uses 1h window. Temporarily elevated error rate clears from the longer window. This is correct behavior — the alert caught a spike, the SLO absorbed it within budget. Check error budget remaining on the SLO dashboard.

---

## Key Questions and Answers

**Q: How do you design a CI/CD pipeline for a new microservice from scratch?**

Start with the contract: what has to be true before code reaches production? For a typical web service: all tests pass, no critical CVEs in the image, quality gate passes (coverage, no new vulnerabilities), image is signed, deployment succeeds, smoke test passes. Work backward from there. Pipeline stages: `test → scan → build → sign → push → update-manifest → deploy → verify`. Separate CI (test/build/push) from CD (deploy/verify). CI runs on every PR; CD triggers on main. Keep CI fast (under 5 minutes) by running tests in parallel and caching dependencies. Use OIDC for all cloud credentials — no stored secrets in CI.

**Q: A pod is restarting every few minutes. How do you diagnose it?**

Check the restart count: `kubectl get pods`. Check the last exit code: `kubectl describe pod` — look at the Last State section. Exit 137 is OOMKilled (increase memory limit or fix a memory leak). Exit 1 is application crash (check logs: `kubectl logs --previous`). Exit 143 is SIGTERM during graceful shutdown (check if `terminationGracePeriodSeconds` is long enough). CrashLoopBackOff means Kubernetes is applying exponential backoff. To see what happened before the crash: `kubectl logs <pod> --previous`. If the pod can't start at all: check `kubectl describe` for events — missing ConfigMap/Secret, image pull error, or readiness probe failing before startup completes.

**Q: How do you roll back a bad deployment safely?**

For Kubernetes: `kubectl rollout undo deployment/myapp -n production` reverts to the previous revision. This changes the pod template back to the previous image. Verify: `kubectl rollout status deployment/myapp` then check error rates. For GitOps with ArgoCD: revert the commit in the manifest repo, ArgoCD syncs automatically. Rollback is just another forward commit. For database schema changes: you need to have applied them in a backwards-compatible way (additive only, never remove columns in the same deploy as removing code that uses them). If a bad schema migration ran: restore from the pre-deployment snapshot (which means you had one — pre-deployment RDS snapshots are not optional for production).

**Q: What does a good SLO look like end to end?**

An SLO needs: a defined SLI (what you're measuring), a threshold (99.9%), a window (rolling 30 days), an error budget (0.1% of 30 days = 43 minutes), burn rate alerts (fast burn: 14x for 1h, slow burn: 3x for 6h), a runbook per alert, and a process for what happens when the budget is exhausted (freeze deployments, focus on reliability). The SLI should measure user-facing success, not internal health checks. "Successful requests / total requests" is better than "CPU below 80%". Track your error budget burn rate weekly — if you're consuming budget faster than planned, you have a reliability problem, not just a metrics problem.

**Q: How do you handle secrets rotation without downtime?**

Use External Secrets Operator or Vault Agent with a refresh interval. The rotation flow: new secret version created in AWS Secrets Manager → ESO detects new version (on next refresh cycle) → creates new Kubernetes Secret version → pods need to pick up new secret. For environment variables: pods must restart to pick up new Secret values. For file mounts: kubelet automatically updates the mounted file when the Secret changes (within a few minutes), without pod restart. For zero-downtime rotation: use file-mounted secrets, not environment variable secrets. Alternatively: rotate the secret, trigger a rolling restart, old pods die with old secret, new pods start with new secret.

---

## Points to Remember

- Platform engineering = infrastructure + deployment + observability + security, composed
- Terraform state should be split by lifecycle layer — networking separate from compute separate from applications
- CI contract: test → scan (Trivy + SonarQube) → build → sign → push → trigger CD
- CD contract: ArgoCD watches GitOps repo, syncs to cluster, verifies rollout
- IRSA/Workload Identity: pods authenticate to cloud services without stored credentials
- Kustomize overlays: base manifest + environment-specific patches; image tag updated by CI
- Canary deployment: send fraction of traffic, analyze metrics, proceed or roll back automatically
- Multi-window burn rate alerts: fast (14x/1h) pages, slow (3x/6h) tickets
- Rollback = merge revert commit to GitOps repo, ArgoCD syncs
- Schema migrations must be backwards-compatible — deploy code before schema removal, not after
- Secrets must be file-mounted (not env vars) for zero-downtime rotation
- Debug order: CI logs → ArgoCD events → pod events → pod logs → dependency connectivity

## What to Study Next

- [CI/CD and Trusted Delivery](./08-cicd-trusted-delivery-and-platform-security) — supply chain security in depth
- [Delivery Systems: Jenkins, GitHub Actions, ArgoCD](./17-delivery-systems-jenkins-github-actions-and-argocd) — individual tool patterns
- [Kubernetes Manifest Design](./25-yaml-and-kubernetes-manifest-design) — manifest patterns referenced here
- [Observability, SLOs and Incident Response](./09-observability-slos-and-incident-response) — SLO design in depth
- [Terraform Infrastructure as Code](./15-terraform-infrastructure-as-code) — IaC patterns in detail
