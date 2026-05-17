---
title: "Azure DevOps Crossover for Platform Engineers"
sidebar_position: 23
---

# Azure DevOps Crossover for Platform Engineers

## What It Is and Why It Matters

Azure DevOps is Microsoft's integrated DevOps platform. It combines five services: Boards (work tracking), Repos (Git hosting), Pipelines (CI/CD), Artifacts (package registry), and Test Plans (testing management).

If you come from GitHub Actions or Jenkins, Azure DevOps uses the same fundamental patterns — pipelines triggered by events, stages with jobs and steps, environments for approvals, service connections for credentials. The vocabulary differs but the concepts translate directly.

Understanding Azure DevOps matters because: many enterprise organizations run on it (especially Microsoft/.NET shops), it integrates natively with Azure cloud services, and job descriptions often list it as a requirement even when GitHub Actions would work equally well.

---

## Mental Model: Mapping to GitHub Actions

| GitHub Actions | Azure DevOps Pipelines |
|----------------|----------------------|
| Workflow | Pipeline |
| Job | Job |
| Step | Step (task) |
| Runner (GitHub-hosted) | Microsoft-hosted agent |
| Self-hosted runner | Self-hosted agent |
| Environment | Environment (with approvals) |
| Secret | Variable / Secret Variable |
| `on: push` | trigger: |
| Service container | Service container |
| `uses: actions/checkout@v4` | `checkout` built-in task |
| `uses: docker/build-push-action` | `Docker@2` task |

---

## Azure Pipelines Core Syntax

### Basic Pipeline

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - 'release/*'
  paths:
    exclude:
      - docs/*
      - '*.md'

pr:
  branches:
    include:
      - main

variables:
  IMAGE_REPO: 'myregistry.azurecr.io/myapp'
  DOCKER_TAG: '$(Build.BuildId)'

pool:
  vmImage: 'ubuntu-latest'      # Microsoft-hosted agent

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        steps:
          - checkout: self       # clone the repo
            fetchDepth: 0        # full clone for git history

          - task: UsePythonVersion@0
            inputs:
              versionSpec: '3.11'
              addToPath: true

          - script: |
              pip install -r requirements.txt
              pytest tests/ --junitxml=test-results.xml
            displayName: 'Run tests'

          - task: PublishTestResults@2
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: 'test-results.xml'
            condition: always()   # run even if previous step failed

          - task: Docker@2
            displayName: 'Build and push image'
            inputs:
              containerRegistry: 'my-acr-service-connection'
              repository: 'myapp'
              command: 'buildAndPush'
              tags: |
                $(DOCKER_TAG)
                latest

  - stage: DeployStaging
    displayName: 'Deploy to Staging'
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployToStaging
        environment: 'staging'   # requires approval if environment has it configured
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@0
                  displayName: 'Deploy to Kubernetes'
                  inputs:
                    action: 'deploy'
                    kubernetesServiceConnection: 'staging-k8s-connection'
                    namespace: 'staging'
                    manifests: 'k8s/deployment.yaml'
                    containers: '$(IMAGE_REPO):$(DOCKER_TAG)'

  - stage: DeployProduction
    displayName: 'Deploy to Production'
    dependsOn: DeployStaging
    jobs:
      - deployment: DeployToProd
        environment: 'production'   # requires manual approval
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@0
                  inputs:
                    action: 'deploy'
                    kubernetesServiceConnection: 'prod-k8s-connection'
                    namespace: 'production'
                    manifests: 'k8s/deployment.yaml'
                    containers: '$(IMAGE_REPO):$(DOCKER_TAG)'
```

### Variable Groups and Secrets

Variables are the equivalent of GitHub Actions secrets. Secret variables are masked in logs:

```yaml
# Variable group (defined in Azure DevOps Library)
variables:
  - group: 'production-credentials'    # links to a Library variable group
  - name: 'BUILD_CONFIG'
    value: 'Release'

# Reference in steps
- script: echo "Database: $(DB_HOST)"   # $(variable-name) syntax
```

Variable types:
- **Pipeline variables**: defined in YAML, visible in source
- **Secret variables**: defined in Library or Environment, masked in logs
- **Variable groups**: reusable collections linked to Azure Key Vault

### Service Connections

Service connections are credentials stored in Azure DevOps for connecting to external services:

```yaml
# Use ACR service connection for Docker
- task: Docker@2
  inputs:
    containerRegistry: 'myacr-service-connection'   # name of the service connection
    ...

# Use Kubernetes service connection
- task: KubernetesManifest@0
  inputs:
    kubernetesServiceConnection: 'prod-aks-connection'
    ...

# Use Azure Resource Manager connection (for Azure resources)
- task: AzureCLI@2
  inputs:
    azureSubscription: 'my-azure-subscription-connection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      az aks get-credentials --name my-cluster --resource-group my-rg
```

Service connection types:
- Docker Registry (ACR, Docker Hub)
- Kubernetes (AKS or generic kubeconfig)
- Azure Resource Manager (ARM) — for managing Azure resources
- GitHub — for triggering builds from GitHub repos
- SSH — for connections to VMs

### Environments and Approvals

Environments in Azure DevOps provide deployment tracking and approval gates:

```yaml
jobs:
  - deployment: DeployProduction
    environment:
      name: 'production'
      resourceType: Kubernetes   # can scope to specific K8s namespace
      tags: 'prod'
```

In the Azure DevOps UI → Environments → production:
- Add approval check (specific users/groups must approve before deploy proceeds)
- Add branch control (only deploys from `main` branch)
- Add business hours check (only deploy during business hours)
- Deployment history visible per environment

---

## Azure Repos

Azure Repos is Azure DevOps's Git hosting. It works identically to GitHub or GitLab at the Git protocol level.

```bash
# Clone
git clone https://dev.azure.com/org/project/_git/myrepo

# Branch policies (configured in UI, equivalent to GitHub branch protection):
# - Require pull request reviews
# - Require minimum reviewer count
# - Require linked work items
# - Require successful build before merge
# - Comment resolution policy
```

Cross-repository triggers — trigger pipeline B when pipeline A succeeds or when repository B changes:

```yaml
resources:
  repositories:
    - repository: k8s-manifests
      type: git
      name: org/k8s-manifests
      trigger:
        branches:
          include: [main]
```

---

## Azure Artifacts

Azure Artifacts is a package registry supporting npm, NuGet, Maven, Python (pip), and Universal Packages:

```yaml
# Publish a Python package
- task: TwineAuthenticate@1
  inputs:
    artifactFeed: 'myproject/myfeed'

- script: |
    pip install twine build
    python -m build
    twine upload -r "myfeed" dist/*
```

Upstream sources: configure a feed to proxy requests to npmjs.com or PyPI, caching packages internally. Useful for air-gapped environments.

---

## Azure DevOps vs GitHub Actions Tradeoffs

| Aspect | Azure DevOps Pipelines | GitHub Actions |
|--------|----------------------|----------------|
| Source code hosting | Azure Repos or GitHub | GitHub |
| YAML schema | More verbose, explicit stages | Concise, nested jobs |
| Approval gates | Native, configurable per environment | Via environment protection rules |
| Self-hosted agents | Agent pools, VMSS scaling | Runner groups |
| Azure integration | First-class (service connections) | Via OIDC |
| Marketplace | Azure DevOps Extensions | GitHub Marketplace |
| RBAC | Project + organization hierarchy | Organization → repo level |
| Cost model | Per agent minute | Per runner minute |

Choose Azure DevOps when: deep Azure integration is needed, your organization is heavily invested in the Microsoft ecosystem, you need the work tracking (Boards) integrated with deployments, or regulatory compliance requires the enterprise audit features.

Choose GitHub Actions when: your code is on GitHub, you want simpler YAML, your team already uses GitHub for collaboration, or you prefer the larger open-source community ecosystem.

---

## Azure Container Registry (ACR)

ACR is Azure's managed Docker registry, used with Azure DevOps Pipelines:

```bash
# Authenticate to ACR
az acr login --name myregistry

# Or use service principal
docker login myregistry.azurecr.io \
  --username <service-principal-id> \
  --password <service-principal-secret>

# Push image
docker tag myapp:latest myregistry.azurecr.io/myapp:v1.0
docker push myregistry.azurecr.io/myapp:v1.0

# List images
az acr repository list --name myregistry

# Geo-replication
az acr replication create --registry myregistry --location eastus
az acr replication create --registry myregistry --location westeurope
# Images replicated across regions for low-latency pulls
```

ACR tasks: build images in the cloud directly from source code without a CI agent:

```bash
# Build and push in the cloud
az acr build --registry myregistry --image myapp:latest .
```

---

## Azure Kubernetes Service (AKS)

AKS is Azure's managed Kubernetes. Key differences from AWS EKS:

| Aspect | AKS | EKS |
|--------|-----|-----|
| Control plane cost | Free | $0.10/hr (~$72/month) |
| Node identity | Azure Managed Identity | IAM IRSA (OIDC) |
| Networking | Azure CNI or Kubenet | VPC CNI |
| Load balancer | Azure Load Balancer | AWS ALB/NLB |
| Storage CSI | Azure Disk, Azure Files | EBS, EFS |
| Node autoscaler | Cluster Autoscaler built-in | Karpenter or CA |
| Managed node upgrades | Node surge upgrades | Managed node groups |

```bash
# Get credentials
az aks get-credentials --resource-group myRG --name myCluster

# Node pool management
az aks nodepool add \
  --resource-group myRG \
  --cluster-name myCluster \
  --name gpupool \
  --node-vm-size Standard_NC6s_v3 \
  --node-count 1 \
  --labels hardware=gpu

# Upgrade cluster
az aks get-upgrades --resource-group myRG --name myCluster
az aks upgrade --resource-group myRG --name myCluster --kubernetes-version 1.28.5
```

**Workload Identity** (AKS equivalent of IRSA):

```yaml
# Service account annotation for Azure Workload Identity
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  annotations:
    azure.workload.identity/client-id: "<managed-identity-client-id>"
```

The pod gets a federated token that Azure AD validates — no credentials stored in the pod.

---

## Common Failure Modes

**Service connection expired:** Azure DevOps service connections using service principals expire. Pipelines start failing with `401 Unauthorized`. Fix: rotate the service principal secret and update the service connection.

**Agent offline:** Self-hosted agents go offline (VM stopped, agent service crashed). Pipelines queue but never start. Fix: check agent pool in Azure DevOps, restart the agent service on the VM.

**Approval gate blocking deploy:** Pipeline is waiting in production environment for approval, but the approver hasn't been notified. Fix: configure email/Teams notifications for pending approvals. Add a timeout to prevent indefinite blocking.

**Variable group not linked:** Pipeline references a variable group that exists in a different project or isn't linked. Variables resolve as empty strings. Fix: ensure the variable group is created in the same project and linked to the pipeline.

**Branch policy blocking PR:** PR can't be completed because a required reviewer hasn't approved, or the build is failing. Fix: check the branch policies for the target branch, address each required check.

---

## Key Questions and Answers

**Q: What are the key differences between Azure DevOps Pipelines and GitHub Actions?**

Both are YAML-based event-driven CI/CD systems. Azure DevOps is more verbose and explicit — stages, jobs, and steps are always declared. GitHub Actions is more concise — jobs can reference reusable workflows and actions more easily. Azure DevOps has deeper integration with Azure cloud (service connections for ARM, AKS, ACR are first-class). GitHub Actions has deeper integration with GitHub (OIDC to any cloud is straightforward, larger marketplace). For approval gates: Azure DevOps environments have richer approval policies (business hours, branch control, required reviewers). GitHub Actions environments have simpler required reviewers. Choose based on your source control host and primary cloud provider.

**Q: How do you handle secrets in Azure DevOps Pipelines?**

Define secret variables in the pipeline (marked as "Keep this value secret") or in Library variable groups. Secret variables are masked in pipeline logs. For production, use variable groups linked to Azure Key Vault — secrets are pulled from Key Vault at runtime and never stored in Azure DevOps. Reference in YAML with `$(variable-name)`. Never echo or print secrets in script steps. Use the `AzureKeyVault@2` task for explicit Key Vault integration.

**Q: How does Azure Workload Identity compare to AWS IRSA?**

Both allow pods to authenticate to cloud APIs without static credentials. IRSA uses OIDC tokens issued by the EKS cluster's OIDC provider, validated against an IAM role trust policy. Azure Workload Identity uses federated credentials — the pod gets a federated token, and Azure AD validates it against a managed identity. Both result in short-lived credentials that auto-rotate. The difference is naming and the specific federation mechanism. The conceptual model is identical: pod service account → short-lived federated token → cloud IAM role → permissions.

---

## Points to Remember

- Azure DevOps = Boards + Repos + Pipelines + Artifacts + Test Plans
- Pipeline syntax: stages contain jobs; jobs contain steps; stages can have conditions and dependencies
- Service connections: stored credentials for external systems (ACR, AKS, Azure, GitHub)
- Environments: provide deployment history, approval gates, and traceability
- Variable groups: reusable secret/variable collections, can link to Azure Key Vault
- ACR: Azure Container Registry, with geo-replication for multi-region
- AKS control plane is free (vs EKS which charges ~$72/month)
- Workload Identity: pods authenticate to Azure without credentials, same concept as IRSA
- Azure DevOps RBAC: Organization → Project → Team → Resource level hierarchy
- Branch policies in Azure Repos = branch protection rules in GitHub

## What to Study Next

- [CI/CD and Trusted Delivery](./cicd-trusted-delivery-and-platform-security) — security patterns applicable to all CI/CD
- [Delivery Systems: Jenkins, GitHub Actions, ArgoCD](./delivery-systems-jenkins-github-actions-and-argocd) — compare with other delivery tools
- [AWS Cloud Services and Platform Design](./aws-cloud-services-and-platform-design) — AWS equivalent patterns
