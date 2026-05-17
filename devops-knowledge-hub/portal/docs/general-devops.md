---
title: "🚀 General DevOps"
sidebar_position: 19
description: "Zero to hero study guide for General DevOps — concepts, tools, architecture, production operations, and interview prep."
---

## Why This Domain Matters

DevOps bridges the gap between development and operations teams by automating and integrating processes to improve collaboration, speed up software delivery, and maintain product reliability. Companies using DevOps report 60% faster deployment cycles and lower failure rates. Elite performers — like Google, Amazon, and Etsy — deploy tens, hundreds, or even thousands of times per day while maintaining world-class stability.

The origins of DevOps trace back to 2009, sparked by the landmark "10 Deploys A Day" talk at Velocity Conference. It emerged from the convergence of infrastructure-as-code, Agile operations, Lean Startup, and continuous integration movements. For a Staff/Principal engineer, DevOps mastery means improving the entire software delivery system — not just your own component.

---

## DevOps Culture & Principles

### The Core Principles

1. **Automation** — Reduce manual processes. Automate testing, integration, deployment, and infrastructure provisioning to increase speed and reduce human errors.
2. **Collaboration** — Bridge the gap between development, QA, and operations teams. A separate "ops team that receives tickets" is an anti-pattern.
3. **Continuous Integration/Continuous Deployment (CI/CD)** — Every code change is automatically tested and deployed to production environments.
4. **Monitoring and Feedback** — Continuously monitor applications in production to detect issues early and provide fast feedback to developers.
5. **Infrastructure as Code (IaC)** — Manage infrastructure using versioned code to ensure consistency across environments.
6. **Culture of Improvement** — Blameless post-mortems, frequent retrospectives, and psychological safety to experiment and learn.

### CAMS Framework

- **Culture** — People and process before tools. Fix the culture first.
- **Automation** — Automate everything that can be automated.
- **Measurement** — If you cannot measure it, you cannot improve it. Track DORA metrics.
- **Sharing** — Blameless post-mortems, open documentation, shared tooling.

### The Three Ways (Phoenix Project)

1. **Systems Thinking** — Optimize for the whole value stream from business to customer, not local optimizations. Etsy, Amazon, and Google achieved "tens of deploys a day" by thinking about the whole pipeline.
2. **Amplify Feedback Loops** — Build feedback mechanisms (tests, monitoring, customer data) to learn quickly. Shorten the loop from action to consequence.
3. **Culture of Continual Experimentation and Learning** — Blameless post-mortems, make it safe to fail small and learn fast.

### Agile vs. DevOps

| Dimension | Agile | DevOps |
|-----------|-------|--------|
| Focus | Iterative development (sprints) | Collaboration across the full lifecycle |
| Scope | Development process (code, test) | Development + operations + deployment + monitoring |
| Automation | Manual testing within sprints (automation encouraged) | Heavy automation for build, test, deploy |
| Feedback | From stakeholders after each sprint | Continuous — from monitoring, users, and all systems |
| Team | Dev teams, product owners | Dev + Ops + QA working together |

Agile is a methodology for how to develop software. DevOps is how you reliably move that software into production infrastructure. Both are complementary.

### DORA Metrics (Your North Star)

The four validated measures of software delivery performance:

| Metric | Elite | High | Medium | Low |
|--------|-------|------|--------|-----|
| Deployment Frequency | Multiple/day | 1/week to 1/day | 1/month to 1/week | <1/month |
| Lead Time for Changes | <1 hour | 1 day to 1 week | 1 week to 1 month | >6 months |
| Change Failure Rate | 0-5% | 0-15% | 16-30% | 16-30% |
| MTTR | <1 hour | <1 day | 1 day to 1 week | >6 months |

```python
# Measuring DORA metrics from your systems
# Deployment frequency: from deployment logs
deployments_this_week = count(deployments WHERE env='production' AND date > now-7d)

# Lead time: from commit timestamp to deployment timestamp
lead_time = deploy_time - commit_time

# Change failure rate:
failed_deployments / total_deployments  # over rolling 30 days

# MTTR: from incident created to resolved
mean(incident.resolved_at - incident.created_at)
```

Tools to track: LinearB, Jellyfish, Faros, or build your own using the GitHub API + your deployment system.

---

## Real-World Project Walkthroughs

### Project 1: Petshop Java App — DevSecOps Pipeline with Jenkins, Ansible, and Kubernetes

**Source:** Real-world blog project deploying `github.com/Aj7Ay/jpetstore-6.git`

**Architecture:** Ubuntu EC2 (T2 Large) → Jenkins → Docker + Kubernetes, with SonarQube, Trivy, OWASP, and Ansible

#### Step 1: Launch EC2 Instance

Launch an AWS T2 Large Ubuntu 22.04 instance. Open ports 8080 (Jenkins), 8090 (alternate Jenkins), and 9000 (SonarQube) in Security Group.

#### Step 2: Install Jenkins

```bash
# jenkins.sh
#!/bin/bash
sudo apt update -y
wget -O - https://packages.adoptium.net/artifactory/api/gpg/key/public | tee \
  /etc/apt/keyrings/adoptium.asc
echo "deb [signed-by=/etc/apt/keyrings/adoptium.asc] \
  https://packages.adoptium.net/artifactory/deb \
  $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" | \
  tee /etc/apt/sources.list.d/adoptium.list
sudo apt update -y
sudo apt install temurin-17-jdk -y
/usr/bin/java --version

curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update -y
sudo apt-get install jenkins -y
sudo systemctl start jenkins
sudo systemctl status jenkins

sudo chmod 777 jenkins.sh
./jenkins.sh
```

To run Jenkins on port 8090 instead of the default 8080:

```bash
sudo systemctl stop jenkins
cd /etc/default && sudo vi jenkins   # set HTTP_PORT=8090
cd /lib/systemd/system && sudo vi jenkins.service  # set Environments="Jenkins_port=8090"
sudo systemctl daemon-reload && sudo systemctl start jenkins
```

#### Step 3: Install Docker and Trivy

```bash
sudo apt-get install docker.io -y
sudo usermod -aG docker $USER

# Install Trivy
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main | \
  sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update && sudo apt-get install trivy -y
```

#### Step 4: Run SonarQube via Docker

```bash
docker run -d --name sonar -p 9000:9000 sonarqube:lts-community
docker ps
# Access at: http://<EC2-PUBLIC-IP>:9000
# Default credentials: admin / admin (change on first login)
```

#### Step 5: Install Jenkins Plugins

Navigate to **Manage Jenkins → Plugins → Available** and install:
- JDK (Eclipse Temurin installer)
- SonarQube Scanner
- Maven Integration
- OWASP Dependency-Check
- Docker, Docker Pipeline, Docker Commons, Docker API, CloudBees Docker Build and Publish
- Sonar Quality Gates

#### Step 6: Jenkins Plugin Configuration

In **Manage Jenkins → Tools:**
- Add JDK installation (use AdoptOpenJDK 17)
- Add Maven installation
- Add SonarQube Scanner

In **Manage Jenkins → System:**
- Add SonarQube server: `http://localhost:9000` with authentication token

#### Step 7: Kubernetes Setup (kubeadm)

```bash
# On ALL nodes (master + workers)
sudo apt-get update
sudo apt install docker.io -y
sudo chmod 666 /var/run/docker.sock

sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
sudo mkdir -p -m 755 /etc/apt/keyrings

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | \
  sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] \
  https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | \
  sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt update
sudo apt install -y kubeadm=1.28.1-1.1 kubelet=1.28.1-1.1 kubectl=1.28.1-1.1
```

On master node only:
```bash
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

#### Step 8: Adding Ansible

```bash
sudo apt-add-repository ppa:ansible/ansible -y
sudo apt-get update -y
sudo apt-get install ansible -y
ansible --version
```

#### Jenkins Pipeline for Petshop (Declarative)

```groovy
pipeline {
    agent any
    tools {
        jdk 'jdk17'
        maven 'maven3'
    }
    environment {
        SCANNER_HOME = tool 'sonar-scanner'
    }
    stages {
        stage('Git Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Aj7Ay/jpetstore-6.git'
            }
        }
        stage('Compile') {
            steps {
                sh 'mvn compile'
            }
        }
        stage('Test') {
            steps {
                sh 'mvn test'
            }
        }
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonar') {
                    sh '''$SCANNER_HOME/bin/sonar-scanner \
                        -Dsonar.projectName=Petshop \
                        -Dsonar.java.binaries=. \
                        -Dsonar.projectKey=Petshop'''
                }
            }
        }
        stage('OWASP Dependency Check') {
            steps {
                dependencyCheck additionalArguments: '--scan ./ --format XML',
                    odcInstallation: 'DP-Check'
                dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
            }
        }
        stage('Build') {
            steps {
                sh 'mvn clean install -DskipTests=true'
            }
        }
        stage('Build & Tag Docker Image') {
            steps {
                script {
                    withDockerRegistry(credentialsId: 'docker', toolName: 'docker') {
                        sh 'docker build -t petshop .'
                        sh 'docker tag petshop yourrepo/petshop:latest'
                    }
                }
            }
        }
        stage('Trivy Image Scan') {
            steps {
                sh 'trivy image yourrepo/petshop:latest > trivy.txt'
            }
        }
        stage('Push Docker Image') {
            steps {
                script {
                    withDockerRegistry(credentialsId: 'docker', toolName: 'docker') {
                        sh 'docker push yourrepo/petshop:latest'
                    }
                }
            }
        }
        stage('Deploy to K8s') {
            steps {
                sh 'kubectl apply -f deployment.yaml'
            }
        }
    }
}
```

---

### Project 2: Production Blog App on EKS with Nexus, SonarQube, Trivy, and Monitoring

**Source:** `github.com/ougabriel/full-stack-blogging-app.git`

**Tools used:** Jenkins, SonarQube, Nexus, Trivy, Docker, Prometheus, Blackbox Exporter, Grafana, AWS EKS, Terraform

#### Infrastructure Overview

- **Jenkins server** — EC2 t3.medium for CI/CD orchestration
- **SonarQube server** — EC2 for static code analysis
- **Nexus server** — EC2 for artifact and Docker image storage
- **Monitoring server** — EC2 for Prometheus + Grafana + Blackbox Exporter
- **EKS cluster** — provisioned with Terraform, hosts the application

#### Step 1: Set Up Git Repository and Token

```bash
git clone https://github.com/ougabriel/full-stack-blogging-app.git
cd full-stack-blogging-app
```

Create a GitHub personal access token under **Settings → Developer Settings → Personal Access Tokens**. Add it to Jenkins credentials as a secret text with ID `github-token`.

#### Step 2: Install Jenkins on EC2

```bash
sudo apt update
sudo apt install openjdk-17-jre -y
java -version

sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key

echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | \
  sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt-get update
sudo apt-get install jenkins -y
sudo systemctl enable jenkins
sudo systemctl start jenkins

# Get the initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Access Jenkins at `http://<EC2-PUBLIC-IP>:8080`. Install suggested plugins.

#### Step 3: Jenkins Plugin List for this Project

Install in **Manage Jenkins → Plugins → Available**:
1. Docker, Docker Commons, Docker Pipeline, Docker API
2. CloudBees Docker Build and Publish
3. Maven Integration Pipeline, Maven Integration
4. Eclipse Temurin installer
5. SonarQube Scanner, Sonar Quality Gates, Quality Gates
6. Kubernetes, Kubernetes CLI
7. Nexus Artifact Uploader

#### Step 4: Provision EKS with Terraform

```hcl
# main.tf
provider "aws" {
  region = "us-east-1"
}

resource "aws_vpc" "dev_vpc" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "dev_subnet" {
  vpc_id            = aws_vpc.dev_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a"
}

resource "aws_eks_cluster" "dev_cluster" {
  name     = "dev-cluster"
  role_arn = aws_iam_role.eks_role.arn
  vpc_config {
    subnet_ids = [aws_subnet.dev_subnet.id]
  }
}
```

```bash
terraform init
terraform plan
terraform apply -auto-approve

# Configure kubectl to use the new cluster
aws eks update-kubeconfig --region us-east-1 --name dev-cluster
kubectl get nodes
```

#### Step 5: Deploy Kubernetes Manifests

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blogging-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blogging-app
  template:
    metadata:
      labels:
        app: blogging-app
    spec:
      containers:
      - name: blogging-app
        image: yourrepo/blogging-app:latest
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: blogging-app-svc
spec:
  type: LoadBalancer
  selector:
    app: blogging-app
  ports:
  - port: 80
    targetPort: 8080
```

```bash
kubectl apply -f deployment.yaml
kubectl get svc   # Get the LoadBalancer EXTERNAL-IP for DNS setup
```

#### Step 6: Monitoring Setup (Prometheus + Blackbox Exporter + Grafana)

Architecture: Instance 1 hosts the web app, Node Exporter, and Nginx. Instance 2 hosts Prometheus, Blackbox Exporter, and Alertmanager.

```bash
# On monitoring EC2 — install Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.49.0/prometheus-2.49.0.linux-amd64.tar.gz
tar -xzf prometheus-2.49.0.linux-amd64.tar.gz
cd prometheus-2.49.0.linux-amd64/

# prometheus.yml configuration
cat > prometheus.yml <<EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['<webserver-ip>:9100']

  - job_name: 'blackbox'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - http://your-blog-app-url
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: localhost:9115
EOF

./prometheus --config.file=prometheus.yml &
```

Alerting rules used in this project:

| Alert | Condition |
|-------|-----------|
| InstanceDown | instance unreachable > 1 minute |
| WebsiteDown | website down > 1 minute |
| HostOutOfMemory | available memory < 25% for > 5 minutes |
| HostOutOfDiskSpace | root filesystem < 50% available |
| HostHighCpuLoad | CPU load > 80% for > 5 minutes |
| ServiceUnavailable | node exporter unavailable > 2 minutes |
| HighMemoryUsage | memory usage > 90% for > 10 minutes |
| FileSystemFull | filesystem < 10% available > 5 minutes |

---

### Project 3: Multi-Tier Application — Local VMs with VirtualBox and Vagrant

**Source:** DevOps Shack — Complete DevOps Project: Multi-Tier Application Deployment Locally

This Java-based application relies on five key services: **MySQL, Memcache, RabbitMQ, Tomcat, and Nginx** — running together across multiple VMs.

```bash
# Install VirtualBox and Vagrant on Mac
brew install virtualbox vagrant

# Install vagrant-hostmanager plugin (updates /etc/hosts across all VMs)
vagrant plugin install vagrant-hostmanager

# Verify
VBoxManage --version
vagrant --version
```

The `vagrant-hostmanager` plugin is critical here: it automatically keeps `/etc/hosts` in sync across all newly created VMs so services can find each other by hostname.

---

### Project 4: 11-Microservice E-Commerce CI/CD on EKS

**Source:** DevOps Shack — 11 Microservice CI/CD Pipeline

**Microservices deployed:**
1. Ad Sense Service
2. Cart Service
3. Checkout Service
4. Currency Service
5. Email Service
6. Frontend Service
7. External Frontend (load balancing)
8. Payment Service
9. Product Catalogue Service
10. Recommendation Service

**Why microservices over a monolith:**
- **Scalability** — Cart Service scales independently during high traffic without touching other services
- **Resilience** — Failure of one service does not cascade
- **Development speed** — Teams work on different services in parallel
- **Technology diversity** — Product Catalogue can use NoSQL; Checkout can use relational DB for transaction consistency

#### IAM Setup for EKS

Create an IAM user with these policies:
- `AmazonEC2FullAccess`
- `AmazonEKS_CNI_Policy`
- `AmazonEKSClusterPolicy`
- `AmazonEKSWorkerNodePolicy`
- `AWSCloudFormationFullAccess`
- `IAMFullAccess`
- Custom inline policy (for EKS cluster creation)

Each microservice has its own `Jenkinsfile`. The pipeline for each follows:

```
Git Checkout → Maven Build → SonarQube Analysis → Trivy File Scan →
Docker Build → Trivy Image Scan → Push to Docker Hub → Deploy to EKS
```

---

### Project 5: DevSecOps — Deploying a Netflix Clone

**Source:** Task: DevSecOps CI/CD: Deploying a Secure Netflix Clone

**Infrastructure:** EC2 t2.x2large, 30GB storage, Ubuntu AMI, IAM role with Admin access

```bash
# Script 1: Java, Jenkins, Docker
# Script 2: Terraform, kubectl, AWS CLI

# Verify all tools
docker --version
aws --version
terraform --version
kubectl version

# Run SonarQube container
sudo chmod 777 /var/run/docker.sock
docker run -d --name sonar -p 9000:9000 sonarqube:lts-community

# Access Jenkins at EC2-ip:8080
sudo cat /var/lib/jenkins/secrets/initialAdminPassword

# Access SonarQube at EC2-ip:9000
# Default: admin/admin — change immediately
```

EKS setup via Jenkins pipeline using Terraform — the pipeline provisions the cluster, then deploys the Netflix clone app via Kubernetes manifests.

---

### Project 6: Ultimate Monitoring Setup (Prometheus + Node Exporter + Blackbox + Alertmanager)

**Source:** DevOps Shack — DevOps Ultimate Monitoring Project (Apr 2025)

**Component architecture:**

```
EC2 Instance 1:
  ├── Web Application (Nginx)
  └── Node Exporter (port 9100) — hardware & OS metrics

EC2 Instance 2:
  ├── Prometheus (port 9090) — metrics collection & querying
  ├── Blackbox Exporter (port 9115) — endpoint probing (uptime/response time)
  └── Alertmanager — manages alerts, routes to Gmail
```

**Gmail integration** for alerts: configured in Alertmanager to send email for InstanceDown, WebsiteDown, and high resource usage alerts.

```yaml
# prometheus.yml scrape config
scrape_configs:
  - job_name: 'myapp'
    static_configs:
      - targets: ['localhost:9090']
```

**Best practices from this project:**
1. Define clear objectives — identify which metrics matter before building dashboards
2. Set baselines and thresholds before setting alert rules
3. Use multiple exporters (Node Exporter + Blackbox) for full coverage
4. Avoid alert fatigue — every alert must be actionable
5. Use multiple notification channels (email + Slack)

---

## CI/CD Pipeline Patterns

### Jenkins Master/Agent Setup

```bash
# Jenkins Agent Machine Setup
sudo apt update
sudo apt install openjdk-17-jre -y
sudo apt-get install docker.io -y
docker --version
sudo usermod -aG docker $USER

# Enable SSH key auth on agent
sudo vim /etc/ssh/sshd_config
# Uncomment: PubkeyAuthentication yes
# Uncomment: AuthorizedKeysFile .ssh/authorized_keys
sudo service sshd reload
```

In Jenkins UI: **Manage Jenkins → Nodes → New Node**
- Number of executors: 2
- Remote root directory: `/root/jenkins1`
- Launch Method: Launch agents via SSH
- Host: Jenkins-Agent private IP
- Credentials: SSH Username with private key (kind: SSH)
- Host Key Verification Strategy: Non Verifying (dev only)

Set the Built-in node executors to 0 so all builds run on agents.

### Webhook-Triggered Pipelines

Webhooks enable event-driven CI/CD without polling. The flow:

1. Developer pushes code to GitHub/GitLab/Bitbucket
2. Webhook sends HTTP POST to the CI/CD tool endpoint
3. Pipeline execution starts immediately — pulls latest code
4. Automated tests run (unit, integration, security)
5. If tests pass, deploy to staging or production

**Setting up a GitHub webhook for Jenkins:**

1. Go to GitHub repo → **Settings → Webhooks → Add webhook**
2. Payload URL: `http://jenkins-server:8080/github-webhook/`
3. Content type: `application/json`
4. Choose events: Push, Pull Request
5. Save

In Jenkins: **Build Triggers → GitHub hook trigger for GITScm polling**

**GitLab webhook setup:**
1. GitLab repo → **Settings → Integrations**
2. Add webhook URL pointing to Jenkins
3. Choose triggers (Push, Merge events)

### GitHub Actions CI Pipeline

```yaml
name: CI Pipeline
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Install dependencies
        run: mvn install -DskipTests=true

      - name: Run tests
        run: mvn test

      - name: SonarQube Scan
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        run: mvn sonar:sonar -Dsonar.host.url=${{ secrets.SONAR_HOST_URL }}

      - name: Trivy Image Scan
        run: |
          docker build -t myapp:${{ github.sha }} .
          trivy image myapp:${{ github.sha }}

      - name: Push to Registry
        run: |
          docker tag myapp:${{ github.sha }} myrepo/myapp:${{ github.sha }}
          docker push myrepo/myapp:${{ github.sha }}
```

### Typical CI/CD Pipeline Stages

1. **Source Stage** — Code committed to version control, webhook fires
2. **Build Stage** — Code compiled (`mvn compile`, `npm install`, `docker build`)
3. **Test Stage** — Unit tests, integration tests, SAST
4. **Security Stage** — SonarQube, Trivy, OWASP Dependency-Check
5. **Artifact Stage** — Push image to Nexus/ECR/Docker Hub
6. **Deploy Stage** — Deploy to Kubernetes/ECS, run smoke tests
7. **Monitor Stage** — Prometheus metrics, health checks, alerts

### Deployment Strategies

#### Blue-Green Deployment

Maintain two identical environments. Blue serves live traffic; Green is idle.

1. Deploy new version to Green
2. Run automated + manual tests on Green
3. Switch load balancer from Blue to Green (traffic cut-over)
4. Monitor Green for issues
5. If issues: instantly revert traffic to Blue

**Advantages:** Zero downtime, instant rollback, safe real-world testing  
**Disadvantage:** Double infrastructure cost

#### Canary Deployment

Release to a small percentage of users first:

```
100% → Blue (stable)
  ↓ canary release
5% → Green (new version)   ← monitor for errors
95% → Blue (stable)
  ↓ promote if healthy
100% → Green
```

#### Rolling Update (Kubernetes default)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # can have 1 extra pod above desired count
      maxUnavailable: 0  # no pods unavailable during update
```

#### Rollback Commands

```bash
# Kubernetes rollback
kubectl rollout history deployment/myapp
kubectl rollout undo deployment/myapp
kubectl rollout undo deployment/myapp --to-revision=3

# GitLab CI rollback using Docker image tag
docker pull myrepo/myapp:previous-tag
kubectl set image deployment/myapp myapp=myrepo/myapp:previous-tag

# Helm rollback
helm rollback my-release 2
```

### GitLab CI/CD Rollback Best Practices

From the PDFs on GitLab pipeline management:

**Infrastructure code (Terraform, CloudFormation):**
- Maintain Git branches: `main`, `staging`, `rollback-<version>`
- Use Terraform state locking (AWS S3 + DynamoDB)
- Store state files in a remote backend

```hcl
# S3 + DynamoDB backend for state locking
terraform {
  backend "s3" {
    bucket         = "my-tf-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-lock"
    encrypt        = true
  }
}
```

**Application code rollback flow:**
1. Tag every release in Git (`git tag -a v1.2.3 -m "Release"`)
2. Build artifacts by tag (Docker image tagged with git SHA + version)
3. Automate rollback on pipeline failure (health check → auto-rollback)
4. Post-deployment validation before marking deployment successful

---

## Container and Orchestration in Practice

### Docker Commands (Daily Use)

```bash
# Image management
docker build -t myapp:latest .
docker tag myapp:latest myrepo/myapp:latest
docker push myrepo/myapp:latest
docker pull myrepo/myapp:latest
docker images                    # list all images
docker rmi myrepo/myapp:latest  # remove image

# Container management
docker run -d -p 8080:80 myimage        # detached with port mapping
docker run -d -p 3000:3000 myapp        # run app
docker ps                               # running containers
docker ps -a                            # all containers including stopped
docker exec -it <container-id> bash     # open shell in container
docker logs <container-id>              # view logs
docker stop <container-id>             # stop container
docker rm <container-id>               # remove stopped container

# Cleanup
docker system prune -a                 # remove all unused images, containers, networks
```

### Kubernetes Commands (Daily Use)

```bash
# Pod management
kubectl get pods                               # list pods in current namespace
kubectl get pods --all-namespaces              # all namespaces
kubectl describe pod <pod-name>                # detailed pod info
kubectl logs <pod-name>                        # pod logs
kubectl exec -it <pod-name> -- bash            # shell into pod
kubectl delete pod <pod-name>                  # delete pod

# Resource inspection
kubectl top pod --all-namespaces               # resource usage by pod
kubectl top nodes                              # resource usage by node
kubectl get nodes                              # node status

# Deployments
kubectl apply -f deployment.yaml               # create/update from file
kubectl rollout status deployment/myapp        # check rollout progress
kubectl rollout history deployment/myapp       # deployment history
kubectl rollout undo deployment/myapp          # rollback

# Services
kubectl get svc                                # list services
kubectl describe svc <service-name>

# Debugging
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl describe pod <pod-name>  # look for Events section
```

### Common Kubernetes Error Patterns

| Error | Cause | Solution |
|-------|-------|----------|
| `ImagePullBackOff` | Wrong image name/tag, private registry missing creds | Check image name, add registry credentials as K8s Secret |
| `CrashLoopBackOff` | App crashes on startup | `kubectl logs <pod>` — missing env vars, DB connectivity |
| `Pending` pod | Insufficient resources, no matching nodes | Check node resources, PVC binding |
| `OOMKilled` | Container exceeded memory limit | Increase memory limit or optimize app |
| `RBAC: Access Denied` | Service account lacks permissions | Check RoleBinding, ClusterRoleBinding |
| `Node Not Ready` | Node has issues | `kubectl describe node <name>`, check kubelet |

### LAMP Stack on Linux (Traditional Web Server Pattern)

Understanding the traditional stack is essential for DevOps engineers managing legacy systems.

**LAMP = Linux + Apache + MySQL + PHP**

```bash
# Install Apache
sudo yum -y install httpd
sudo systemctl start httpd
sudo systemctl enable httpd

# Verify config before starting
httpd -t          # check httpd.conf syntax

# Key file locations
# Config:       /etc/httpd/conf/httpd.conf
# Document root: /var/www/html
# Logs:         /var/log/httpd/error_log, access_log
# Ports:        80 (HTTP), 443 (HTTPS)

# Troubleshooting Apache
systemctl status httpd
netstat -ntpl | grep 80
ps -ef | grep httpd
```

### Essential DevOps Port Reference

| Service | Port | Purpose |
|---------|------|---------|
| HTTP | 80 | Web traffic |
| HTTPS | 443 | Secure web traffic |
| Jenkins | 8080 | CI/CD dashboard |
| SonarQube | 9000 | Code analysis |
| Nexus Repository | 8081 | Artifact management |
| Docker Registry | 5000 | Private Docker registry |
| Prometheus | 9090 | Metrics |
| Grafana | 3000 | Dashboards |
| Kibana | 5601 | Log analysis |
| Elasticsearch | 9200 | Search/analytics |
| Kubernetes API | 6443 | Cluster control plane |
| Kubelet API | 10250 | Node-API communication |
| etcd | 2379-2380 | K8s key-value store |
| Node Exporter | 9100 | Host metrics |
| Blackbox Exporter | 9115 | Endpoint probing |
| MySQL | 3306 | Database |
| PostgreSQL | 5432 | Database |
| MongoDB | 27017 | NoSQL database |
| SSH | 22 | Remote access |

```bash
# Debugging commands for any port
curl -I http://your-server-ip:8080       # Check Jenkins
curl http://your-server-ip:9090          # Check Prometheus
curl http://your-server-ip:3000          # Check Grafana
netstat -tulnp | grep :80               # Check if port 80 is in use
kubectl cluster-info                     # Verify Kubernetes API server
```

---

## Security in DevOps (DevSecOps)

### The DevSecOps Pipeline

Security must be integrated at every stage — not bolted on at the end.

```
Pre-commit:   secret scanning (gitleaks), linting
PR:           SAST (SonarQube/Semgrep), dependency check (OWASP/Snyk)
Build:        container scan (Trivy), image signing (Cosign)
Deploy:       policy check (Kyverno/OPA), environment validation
Runtime:      behavior monitoring (Falco), threat detection (GuardDuty)
```

### Trivy — Container Vulnerability Scanning

Trivy is an open-source security scanner by Aqua Security. It scans:
- Container images
- Filesystems
- Git repositories
- Kubernetes configurations
- OS packages and software dependencies
- Known CVEs, secrets, software licenses

```bash
# Scan a Docker image
trivy image nginx:latest

# Scan with timeout (for slow networks)
trivy image --timeout 10m nginx:latest

# Scan and output to file
trivy image yourrepo/petshop:latest > trivy-report.txt

# Scan filesystem
trivy fs /path/to/project

# Update vulnerability database
trivy image --download-db-only
```

**Common Trivy errors and fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `FATAL: unable to authenticate to Docker Hub` | Expired Docker Hub creds | `docker login` before scanning |
| `failed to scan image: timeout while fetching layers` | Network latency | Use `--timeout` flag |
| `unsupported media type` | Unsupported image format | Use `docker save` to convert to tar |
| `UNKNOWN` severity | Outdated vulnerability database | `trivy image --download-db-only` |
| `insufficient permissions to scan directories` | Missing file read permissions | Ensure user has read permissions |

### SonarQube — Static Code Analysis

SonarQube performs SAST (Static Application Security Testing) and code quality analysis.

```bash
# Run SonarQube via Docker (for local/CI use)
docker run -d --name sonar -p 9000:9000 sonarqube:lts-community

# Run SonarQube scanner in CI pipeline
sonar-scanner \
  -Dsonar.projectKey=my-project \
  -Dsonar.sources=. \
  -Dsonar.host.url=http://sonarqube:9000 \
  -Dsonar.login=${SONAR_TOKEN}

# Maven project analysis
mvn sonar:sonar \
  -Dsonar.host.url=http://sonarqube:9000 \
  -Dsonar.login=${SONAR_TOKEN}
```

In the Petshop and Blog app projects, SonarQube is configured with a quality gate — if code quality drops below the gate threshold, the pipeline fails and the image is never pushed.

### OWASP Dependency-Check

```bash
# Jenkins pipeline stage
stage('OWASP Dependency Check') {
    steps {
        dependencyCheck additionalArguments: '--scan ./ --format XML',
            odcInstallation: 'DP-Check'
        dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
    }
}
```

OWASP also provides:
- **OWASP Top 10** — most critical web application security risks
- **OWASP ZAP** — dynamic application security testing (DAST)

```bash
# OWASP ZAP quick scan
zap-cli quick-scan http://your-app-url
```

**Common OWASP ZAP errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `ZAP unable to start proxy server` | Port conflict (default 8080) | Change proxy port in ZAP settings |
| `ZAP crashes during large-scale scan` | Insufficient JVM memory | Increase JVM heap size |
| `Active scan hangs at 0%` | Server blocking ZAP requests | Add headers to mimic legitimate traffic |
| `ZAP reports incorrect vulnerabilities` | Misconfigured context/baseline | Adjust scan rules, verify manually |

### SSL/TLS Certificate Management in DevOps

```bash
# Let's Encrypt (Certbot) for free certificates
certbot --nginx -d yourdomain.com
certbot renew --dry-run   # test auto-renewal

# Check certificate expiry
openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Enforce TLS in Nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    add_header Strict-Transport-Security "max-age=31536000" always;
}
```

Store certificates securely: AWS Certificate Manager (ACM) for AWS-managed certs, or Azure Key Vault for Azure environments. Integrate expiry alerts into Prometheus.

### Prowler — AWS Security Auditing

```bash
# Install and configure
pip install prowler
aws configure   # needs SecurityAudit managed policy

# Run checks
prowler aws
prowler aws --region us-east-1
```

**Common Prowler errors:**

| Error | Fix |
|-------|-----|
| `Access Denied on AWS API calls` | Attach `SecurityAudit` AWS managed policy |
| `Missing AWS CLI or credentials` | Install AWS CLI, run `aws configure` |
| `Failed to execute check: invalid region` | Use `--region` with a valid region |

### Secrets Management

```bash
# NEVER store secrets in ConfigMaps
# Kubernetes Secrets (base64 encoded)
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=secretpassword

# Reference in pod spec
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: password
```

For production: use AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault. Rotate secrets automatically and audit access.

---

## Interview Q&A

### Fundamentals

**Q: What is DevOps?**
DevOps is a set of practices that combines software development (Dev) and IT operations (Ops) to shorten the systems development life cycle and provide continuous delivery with high software quality. It emphasizes automation, collaboration, CI/CD, and monitoring.

**Q: What are the key benefits of DevOps?**
- Faster time to market (shorter development cycles)
- Improved collaboration between dev, QA, and ops
- Enhanced software quality through automated testing
- Increased deployment frequency
- Better scalability and availability
- Faster recovery from failures (low MTTR)
- Reduced costs through automation

**Q: What does CAMS stand for?**
Culture, Automation, Measurement, Sharing. The four pillars of DevOps philosophy as defined in the early DevOps community.

**Q: What are the three important DevOps KPIs?**
Deployment frequency, lead time for changes, and mean time to recover (MTTR). These directly correlate with organizational performance and customer satisfaction.

**Q: What is the difference between Continuous Delivery and Continuous Deployment?**
- **Continuous Delivery** — every successful build can be deployed to production at any time, but requires a human approval gate before deployment
- **Continuous Deployment** — every successful build is automatically deployed to production with no human gate. Requires high test confidence and robust rollback

### CI/CD

**Q: Describe a typical CI/CD pipeline.**
Source Stage (code commit) → Build Stage (compile, package) → Test Stage (unit, integration, SAST) → Security Stage (Trivy, OWASP) → Artifact Stage (push to Nexus/ECR) → Deploy Stage (K8s apply) → Monitor Stage (Prometheus, health checks).

**Q: What is the purpose of a build server in CI/CD?**
A build server automates the process of building, testing, and deploying code. It ensures every code change is built and tested in a consistent environment, reducing integration issues and eliminating "works on my machine" problems.

**Q: How do you handle rollback in a CI/CD pipeline?**
Tag every Docker image with the Git commit SHA. On deployment failure: trigger `kubectl rollout undo deployment/myapp` or `helm rollback`. For infrastructure: use Terraform state with version control and apply the last known good state. Automate health checks post-deployment; if health check fails, trigger automatic rollback.

**Q: How do you secure a CI/CD pipeline?**
- Secrets management via Vault or AWS Secrets Manager (never hardcode)
- Scan for vulnerabilities in code and containers (Trivy, Snyk, SonarQube)
- Enable multi-step approvals for production deployments
- Use signed artifacts to prevent tampering
- Role-based access control on Jenkins/GitLab
- Audit logging of all pipeline activities

### Containers and Kubernetes

**Q: What types of applications have you deployed?**
Web applications (Java Spring Boot, Node.js), microservices architectures, databases (MySQL, MongoDB), message brokers (Apache Kafka), monitoring tools (Prometheus, Grafana), CI/CD pipelines (Jenkins), and containerized applications using Docker on Kubernetes.

**Q: How do you find which pod is consuming the most resources?**
```bash
kubectl top pod --all-namespaces   # CPU and memory by pod
kubectl top nodes                   # CPU and memory by node
kubectl describe pod <pod-name>     # detailed resource usage
```

**Q: What is the difference between a Deployment and a StatefulSet?**
- **Deployment** — stateless applications. Pods are interchangeable, can be scheduled on any node
- **StatefulSet** — stateful applications (databases, Kafka). Pods have stable network identity, ordered deployment/scaling, and persistent storage per pod

**Q: How do you configure Prometheus and Grafana for Kubernetes monitoring?**
1. Deploy Prometheus using Helm or custom YAML
2. Set up Kubernetes service discovery in prometheus.yml
3. Deploy Grafana, configure Prometheus as data source
4. Import Kubernetes monitoring dashboards (e.g., Dashboard ID 315 or 6417)
5. Configure alerting rules in Prometheus Alertmanager

**Q: What is the difference between Observability and Monitoring?**
- **Monitoring** — collects predefined metrics and logs (CPU usage, request count). Tells you *what* is happening
- **Observability** — logs + metrics + traces. Tells you *why* something happened. Tools: OpenTelemetry, Grafana, Jaeger

### Infrastructure and Cloud

**Q: What is the difference between EC2, ECS, and EKS in AWS?**
- **EC2** — raw virtual machines. You manage OS, runtime, scaling
- **ECS** — AWS-managed container orchestration. Simpler than K8s, tightly integrated with AWS
- **EKS** — managed Kubernetes. Industry-standard K8s API, portable across clouds

**Q: What is the difference between ALB and NLB?**
- **ALB (Application Load Balancer)** — Layer 7 (HTTP/HTTPS). Supports path-based routing, host-based routing, header-based routing. Best for microservices
- **NLB (Network Load Balancer)** — Layer 4 (TCP/UDP). Extremely low latency, static IP. Best for high-performance workloads

**Q: How do you integrate an S3 bucket with an EC2 instance?**
1. Attach an IAM Role with S3 access to the EC2 instance
2. Install AWS CLI: `sudo apt install awscli`
3. No need to `aws configure` — the IAM role provides credentials automatically
4. Access S3: `aws s3 cp s3://my-bucket/file.txt .` or mount with s3fs

**Q: What are Terraform workspaces?**
Terraform workspaces allow multiple environments (dev, staging, prod) within the same Terraform configuration.

```bash
terraform workspace new dev
terraform workspace new prod
terraform workspace select dev
terraform workspace list
```

**Q: How do you set up a Docker Hub private registry and integrate it with CI/CD?**
1. Create private repository on Docker Hub
2. Add Docker Hub credentials to Jenkins as a Username/Password credential
3. In Jenkinsfile, use `withDockerRegistry(credentialsId: 'docker-hub-creds')` block
4. `docker build`, `docker tag`, `docker push` inside the block
5. In CD pipeline, `docker pull` from the private registry

**Q: How does an end-user request reach the application?**
1. DNS Resolution → domain resolves to IP (Route 53, Cloudflare)
2. Load Balancer → directs traffic (ALB/NLB)
3. Web Server → processes request (Nginx, Apache)
4. Application Layer → runs business logic (Node.js, Python, Java)
5. Database and Storage → retrieves/stores data (RDS, S3)
6. Response back to user via the same route

### Scenario-Based Questions

**Q: How do you deploy 10 applications at a time?**
- Use Kubernetes to run multiple applications as pods in a cluster (namespaces for isolation)
- Docker Compose works well for local environments with multiple containers
- Terraform/Ansible can automate deployments across multiple instances in parallel
- AWS ECS/Fargate helps manage multiple containerized applications

**Q: How do you improve a team's deployment frequency from weekly to daily?**
Decompose the bottlenecks: feature completeness (feature flags hide unfinished work), test confidence (increase coverage, shorten test suite runtime), deployment risk (implement canary deployments), and approval bottlenecks (replace manual approval with automated quality gates). Attack the constraint, measure improvement with DORA metrics.

**Q: Application crashes after deployment — what do you do?**
1. `kubectl logs <pod-name>` or `docker logs <container-id>` — check for error messages
2. Look for: missing environment variables, database connection failures, missing dependencies
3. If the issue is clear: fix and redeploy
4. If unclear: `kubectl rollout undo deployment/myapp` to restore previous version
5. Investigate the root cause in a staging environment before re-deploying

**Q: High CPU or memory usage — what do you do?**
1. `kubectl top pod --all-namespaces` and `kubectl top nodes`
2. Use Prometheus + Grafana to identify which process/pod is consuming resources
3. If a specific pod: check for memory leaks, optimize code, or increase resource limits
4. If systemic: consider horizontal pod autoscaling (HPA)

**Q: CI/CD pipeline fails — what do you do?**
1. Check pipeline logs in Jenkins/GitLab/GitHub Actions for the failing stage
2. Common causes: syntax error, missing dependency, incorrect environment variable, credentials expired
3. Reproduce locally: run the same commands on your machine
4. Fix, commit, and push — the webhook will retrigger the pipeline

---

## Staff/Principal Level Patterns

### Platform Engineering

**Internal Developer Platform (IDP)** — self-service infrastructure so developers can provision environments, deploy applications, and access secrets without raising tickets.

Core capabilities:
- **Golden paths** — opinionated templates that scaffold a new service in minutes with CI/CD, monitoring, and secrets management pre-configured
- **Self-service environments** — developers provision dev/feature environments without needing ops involvement
- **Paved roads** — the easy path is the correct path; pre-configured security and observability are built in
- **Backstage** — open-source service catalog + plugin ecosystem for the IDP UI

Platform team as product team: developers are the customers, platform capabilities are the product, developer NPS / developer experience is the success metric.

### GitOps Repository Patterns

Three-repository strategy (from the Ultimate Corporate Mega DevOps Project):

```
Repo 1: CI Project Repository
  └── Source code + Jenkinsfiles/GitHub Actions workflows

Repo 2: CD Project Repository
  └── Kubernetes deployment manifests (deployment.yaml, service.yaml)
  └── Kustomize overlays (staging, prod)

Repo 3: Terraform Repository
  └── EKS cluster definition
  └── VPC, IAM, networking
```

**Kustomize overlay pattern:**

```
base/
  deployment.yaml      # environment-agnostic base
  service.yaml
  kustomization.yaml

overlays/
  staging/
    kustomization.yaml  # patches: lower replicas, test image tag
    config-patch.yaml
  production/
    kustomization.yaml  # patches: prod replicas, resource requests, node affinity
    config-patch.yaml
```

### Four-Phase Enterprise DevOps Project (Ultimate Corporate Mega DevOps)

**Phase 1 — Infrastructure Setup:**
- EKS cluster with RBAC service accounts for Jenkins (namespace-scoped for pods/services, cluster-scoped for PVCs/ConfigMaps)
- Jenkins, SonarQube, Nexus, Prometheus, Grafana all deployed inside EKS

**Phase 2 — Git Repository Setup:**
- Three-repo strategy (CI, CD, Terraform)
- Branch protection rules, required PR reviews, required status checks

**Phase 3 — CI/CD Pipelines:**
- CI pipeline: build, test, SonarQube quality gate, Trivy scan, push artifact to Nexus
- CD pipeline: pull artifact from Nexus, deploy to EKS via `kubectl apply`, run smoke tests

**Phase 4 — Monitoring and Observability:**
- Prometheus scrapes Node Exporter and application metrics
- Grafana dashboards for infrastructure and application health
- Alertmanager routes alerts to Slack and email

### Zero Downtime Deployment Checklist

From the DevOps Shack guide on Zero Downtime Deployment:

- [ ] Application is stateless (or has proper session management for stateful)
- [ ] Deployment strategy chosen: Rolling, Blue-Green, or Canary
- [ ] Health checks configured (liveness + readiness probes)
- [ ] Database changes are backward-compatible (expand-and-contract pattern)
- [ ] Load balancer health check interval tuned
- [ ] Rollback procedure documented and tested
- [ ] Monitoring dashboards ready to observe deployment
- [ ] Alert thresholds set for the deployment window

**Why zero downtime matters:**
- 3 AM in New York is prime time in Asia — there is no safe deployment window anymore
- Even minutes of downtime during a flash sale can mean thousands in lost revenue
- SLA penalties for downtime in B2B environments
- User trust, once lost, is expensive to regain

### SRE Practices

**SLI → SLO → SLA chain:**
- **SLI** — the measurement: "fraction of requests completing in <200ms"
- **SLO** — the target: "99.5% of requests complete in <200ms over 30 days"
- **SLA** — contractual commitment with consequences: typically 1-2% below SLO

**Error budget:**
- 99.9% SLO = 0.1% error budget = 43.2 minutes/month of allowed downtime
- 99.99% = 4.32 minutes/month
- When error budget is healthy, features take priority. When depleted, reliability work takes priority — this removes the political argument between product and engineering.

**Blameless post-mortems:**
- Focus on system failures, not human failures
- Timeline reconstruction, not blame assignment
- Five action items minimum (process, tooling, monitoring)
- Share findings widely — learning should spread across the org
- Follow-up review 30 days later to check action item completion

### Technical Debt Management

Not all tech debt is equal:

- **Intentional, time-limited** — "We'll use a monolith until we hit scale bottlenecks." Tracked, scheduled for revisit.
- **Unintentional** — discovered during work. File immediately as a ticket with impact assessment.
- **Reckless** — "We didn't have time for tests." Requires retrospective and process change.

Track debt with explicit tickets. Budget 20% of sprint capacity for debt repayment. Show correlation between debt reduction and incident reduction to justify the investment.

### Career Path in DevOps

| Level | Years | Roles |
|-------|-------|-------|
| Entry | 0-2 | Junior DevOps Engineer, System Administrator |
| Mid | 3-6 | DevOps Engineer, CI/CD Engineer, Cloud Engineer |
| Senior | 7-10+ | Lead DevOps Engineer, SRE, Cloud Architect |
| Leadership | — | DevOps Manager, Head of DevOps, CTO (startups) |

**Senior → Staff transition:** Move from "excellent individual contributor" to "multiplier." Scope shifts from component to system. Success measured by team and org improvement, not personal output.

Key Staff skills:
- Design reviews that prevent future incidents
- Architectural Decision Records (ADRs) that document rationale
- Mentoring that raises the engineering floor
- Incident response that generates systemic improvements (not just fixes)

**Relevant certifications:**
- AWS Certified DevOps Engineer Professional
- Google Professional DevOps Engineer
- Azure DevOps Expert
- CKA/CKAD (Kubernetes)

---

## Troubleshooting Reference

### Common DevOps Troubleshooting Scenarios

**1. Application crashes after deployment**
Check `kubectl logs` or `docker logs`. Look for missing dependencies, incorrect environment variables, or database connection issues. Roll back first, investigate second.

**2. High CPU or memory usage**
Use Prometheus/Grafana to identify which process/pod. Consider autoscaling, code optimization, or resource limit adjustment.

**3. Deployment fails in CI/CD pipeline**
Read the pipeline log for the exact failing command. Run the same command locally to reproduce. Common causes: syntax errors, missing environment variables, expired credentials.

**4. Network connectivity issues**
```bash
ping target-host              # ICMP connectivity
curl -I http://target:port   # HTTP connectivity
netstat -tulnp | grep :8080  # Port in use check
kubectl exec -it pod -- nslookup service-name  # DNS in cluster
```

**5. Container fails to start**
```bash
docker logs <container-id>   # see startup error
# Check: ports already in use, volume permissions, environment variables
```

**6. Slow application performance**
Use New Relic, Datadog, or Prometheus to find bottlenecks. Optimize slow database queries, enable caching, verify load balancing is distributing traffic evenly.

**7. Security vulnerabilities found by scanner**
Update dependencies immediately (`npm audit fix`, `mvn versions:use-latest-versions`). Apply OS security patches. Use RBAC to restrict access. Re-scan after patching to confirm resolution.

### Git Error Reference

| Error | Fix |
|-------|-----|
| `fatal: not a git repository` | Run `git init` or `cd` to correct directory |
| `error: failed to push some refs` | Pull first: `git pull --rebase origin main`, then push |
| `Permission denied (publickey)` | Add SSH public key to GitHub; check `~/.ssh/config` |
| `Merge conflict in [file]` | `git status` → edit conflict markers → `git add` → `git commit` |
| `Detached HEAD state` | `git checkout -b new-branch` to save work, or `git checkout main` |
| `Large file exceeds limit` | Use Git LFS; remove from history with `git-filter-repo` |
| `fatal: remote origin already exists` | `git remote set-url origin <new-url>` |

### Jenkins Error Reference

| Error | Fix |
|-------|-----|
| `Jenkins service not starting` | Check Java version, port conflicts, disk space |
| `Build stuck in the queue` | Check agent availability, executors, label match |
| `Plugins fail to load` | Compatible version conflict — check plugin manager logs |
| `Pipeline script syntax error` | Validate Jenkinsfile syntax using Jenkins pipeline linter |
| `Build fails: missing environment variables` | Check Jenkins credentials, environment injector plugin |
| `Out of disk space` | Clean workspace: `docker system prune`, remove old builds |

---

## Key Takeaways

1. **Real projects beat theory** — The Petshop, Blog app on EKS, Netflix clone, and 11-microservice projects all follow the same pattern: Jenkins + SonarQube + Trivy + Docker + Kubernetes. Master this stack.
2. **DORA metrics are your north star** — Deploy frequency, lead time, change failure rate, MTTR. Track them; improve them.
3. **Security is not optional** — Trivy, SonarQube, and OWASP Dependency-Check belong in every pipeline. Shift left.
4. **Blameless culture enables learning** — Blame-focused post-mortems produce defensiveness, not systemic fixes.
5. **Feature flags separate deployment from release** — Deploy safely, release gradually, kill switches eliminate rollback delay.
6. **Zero downtime is achievable** — Blue-Green, Canary, Rolling Updates + proper health checks = no downtime.
7. **Platform teams multiply developer velocity** — Golden paths and self-service environments reduce friction. Measure developer NPS.
8. **Error budget policy removes politics** — When budget is healthy, features. When depleted, reliability. The budget decides.
9. **Runbooks must be tested** — Untested runbooks fail when you need them most. Quarterly game days.
10. **Staff impact is measured in team outcomes** — Your success is the team's velocity and reliability improvement, not your personal output.
