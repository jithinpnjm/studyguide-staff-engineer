---
title: "Interview Questions"
sidebar_position: 4
---

# MLOps — Interview Questions

## Q1: What problem does MLflow solve, and how does it compare to alternatives?

**A:** MLflow solves the reproducibility and traceability problem in ML experimentation. Before MLflow, data scientists worked with notebooks and saved model files with no systematic record of what parameters produced what results — identical to software development before Git.

MLflow provides: experiment tracking (log params/metrics/artifacts per run), a model registry (versioned, staged model storage), model packaging (consistent deployment format), and serving utilities.

**Alternatives comparison:**

| Tool | Strength | Weakness |
|---|---|---|
| MLflow | Open source, any framework, self-hostable | UI is dated, registry is basic |
| Weights & Biases | Superior visualization, team features | SaaS cost, vendor lock-in |
| Neptune.ai | Strong collaboration features | Managed only |
| Vertex AI Experiments | Deep GCP integration | GCP-only |
| SageMaker Experiments | Deep AWS integration | AWS-only |

Choose MLflow when you need: framework-agnostic tracking, self-hosted control, and open standards. Choose W&B when visualization depth and team collaboration matter more than cost.

---

## Q2: How would you design an experiment tracking system from scratch?

**A:** The core requirements are: capture inputs (hyperparameters, data version, code version), outputs (metrics, artifacts), and context (who ran it, when, from where). At minimum:

**Storage layer**: Parameters and metrics go into a relational database (PostgreSQL). Artifacts (model files, plots) go into object storage (S3, GCS). The DB stores metadata with the S3 paths.

**API layer**: A REST API that training scripts call. Endpoints: `POST /runs` (start), `PUT /runs/{id}/params`, `PUT /runs/{id}/metrics`, `PUT /runs/{id}/artifacts`, `PATCH /runs/{id}` (finish).

**SDK layer**: A thin Python client that wraps the API and handles context management (`with start_run(): ...`).

**UI layer**: Read-only views — experiment list, run comparison table, metric charts.

Key design decisions:
- Use a context manager pattern so runs close automatically even on exception
- Support step-based metrics (loss curves, not just final values)
- Store artifact content-addressed (SHA256 hash) to deduplicate identical files
- Tag every run with Git commit SHA automatically from the SDK

This is essentially what MLflow does. The insight is that it's not architecturally complex — the complexity is in building enough integrations that people actually use it.

---

## Q3: Walk through the Model Registry workflow from training to production.

**A:** The full lifecycle:

1. **Training produces a run artifact**: The training script calls `mlflow.sklearn.log_model(model, "model")` inside a run. The model is saved to the artifact store with a URI like `runs:/abc123/model`.

2. **Register the model**: The CI/CD pipeline or the data scientist calls `mlflow.register_model("runs:/abc123/model", "MyModelName")`. This creates a version (v1) in the None/Development stage.

3. **Promote to Staging**: After automated evaluation passes (metrics above threshold), the CI job calls `client.transition_model_version_stage("MyModelName", 1, "Staging")`. Integration tests run against the Staging model.

4. **Promote to Production**: After integration tests pass and approval is recorded, `transition_model_version_stage("MyModelName", 1, "Production")` runs. The serving code loads models by stage, so it automatically picks up the new version.

5. **Archive old version**: The previous Production version moves to Archived automatically if you pass `archive_existing_versions=True`.

The serving code always loads by stage name, never by version number:
```python
model = mlflow.sklearn.load_model("models:/MyModelName/Production")
```

This decouples deployment from promotion — the serving container does not need to be redeployed when a new model version is promoted to Production.

---

## Q4: How do you detect data drift in a production ML system?

**A:** Data drift = the statistical distribution of input features in production differs from the distribution seen during training. There are multiple detection approaches:

**Statistical tests** (per-feature):
- Continuous features: KS test (Kolmogorov-Smirnov), Jensen-Shannon divergence
- Categorical features: chi-square test, Jensen-Shannon divergence
- Univariate drift doesn't catch multivariate correlations changing

**Population Stability Index (PSI)**: Widely used in credit/banking. PSI < 0.1 = no drift, 0.1–0.2 = moderate, > 0.2 = significant. Good for score distributions.

**Model-based drift detection**: Train a binary classifier to distinguish training data from production data. If the classifier achieves high AUC, the distributions are distinguishable — drift is present. Implemented in Evidently AI as the "Domain Classifier" test.

**Practical implementation**:
1. Store feature statistics at training time (mean, std, percentiles, value distributions)
2. Compute the same statistics over rolling windows of production data
3. Compare using chosen tests, generate a drift report
4. Alert if drift score exceeds threshold; trigger retraining pipeline if sustained

Tools: Evidently AI (Python, excellent for reports), WhyLogs (lightweight logging), Arize AI (SaaS), Fiddler (SaaS).

---

## Q5: Explain GPU scheduling in Kubernetes. What can go wrong?

**A:** Kubernetes exposes GPUs as extended resources via the NVIDIA device plugin DaemonSet. When the plugin runs on a GPU node, it advertises `nvidia.com/gpu: N` to the kubelet. The scheduler uses these counts to place Pods.

**The stack that must all work**: hardware present → driver loaded → container toolkit installed → device plugin running → kubelet advertises allocatable GPUs → scheduler places Pod → runtime injects GPU into container.

**Common failure modes**:

- **Pod Pending "Insufficient nvidia.com/gpu"**: not enough free GPUs. Check: `kubectl describe node <node> | grep nvidia.com/gpu`, verify allocatable vs allocated.

- **nvidia-smi fails inside the Pod**: driver version mismatch between host driver and container CUDA version. The container CUDA version must be <= host driver version. Or the container runtime is not injecting device files.

- **GPU shows as allocatable but CUDA fails**: the nvidia-container-toolkit is not installed or not configured. Check `nvidia-container-runtime --version` on the node.

- **GPU Operator components in CrashLoop**: often a driver installation failure. Check: `kubectl logs -n gpu-operator ds/nvidia-driver-daemonset`.

- **Training slow despite GPUs allocated**: topology problem — workers on different NUMA domains or different nodes with no NVLink. Check `nvidia-smi topo -m`. Or the data pipeline is the bottleneck, not the GPU.

**Senior answer**: treat GPU unavailability as a five-layer problem: hardware → driver → runtime → device plugin → workload. Isolate which layer failed before fixing.

---

## Q6: Online inference vs batch inference — when to use each?

**A:**

| Dimension | Online (Real-time) | Batch |
|---|---|---|
| Latency | Milliseconds to seconds | Minutes to hours |
| Trigger | Per request | Scheduled or event-driven |
| Throughput | Limited by serving capacity | High (optimized for bulk) |
| Cost | Higher per prediction (always-on) | Lower per prediction |
| Staleness | Fresh at prediction time | Stale by batch interval |
| Complexity | Serving infrastructure, scaling | ETL pipeline, storage |

**Use online when**: a user or system needs a prediction before they can continue (recommendation at page load, fraud check before transaction, ML-powered search ranking).

**Use batch when**: predictions can be pre-computed and stored (email risk scores computed nightly, product embedding updates computed weekly, customer segment predictions for a marketing campaign).

**Hybrid pattern**: near-real-time streaming (Kafka + Flink) where predictions are pre-computed on a stream and cached, allowing low-latency lookups without real-time model inference.

The key question: does the user need a prediction that depends on data that only exists at request time? If yes, online. If the features can be computed ahead of time, batch is almost always cheaper and simpler.

---

## Q7: What are the tradeoffs of a feature store?

**A:** Feature stores solve training/serving skew — when the same feature is computed differently at training time vs serving time.

**Benefits**:
- Consistency: one definition used everywhere
- Reuse: features built by one team are available to all models
- Point-in-time correctness: historical features retrieved for the exact timestamp of each training label (no data leakage)
- Online serving: low-latency feature retrieval from Redis/Cassandra
- Governance: lineage, discovery, ownership

**Costs**:
- Significant infrastructure: offline store (S3 + a query engine), online store (Redis), sync jobs, SDK integration
- Engineering investment: writing feature definitions, materialization jobs, keeping in sync
- Latency: a feature store lookup in the critical path adds network RTT
- Operational complexity: yet another system to monitor and operate

**When to use**: at scale, when multiple models share features, or when training/serving skew has already caused production issues. For small teams with one or two models, a shared feature computation library in the serving code is often enough.

**When not to use**: early-stage ML, single model, features are simple transformations that are trivial to recompute identically in training and serving.

---

## Q8: What is the MLOps maturity model?

**A:** The MLOps maturity model describes how sophisticated an organization's ML operations are. Microsoft and Google have published similar frameworks:

**Level 0 — Manual**: Data scientists train models in notebooks. Models are deployed manually (copy the pkl file). No versioning, no tracking, no monitoring. Every deployment is bespoke. Retraining requires manual effort.

**Level 1 — ML Pipeline Automation**: Training is automated as a pipeline (triggered on schedule or data arrival). Experiments are tracked (MLflow or equivalent). Model registry exists. Basic monitoring in place. Models are still deployed semi-manually, but training is reproducible.

**Level 2 — CI/CD for ML**: Full automation of train → evaluate → register → deploy. Automated testing gates (model quality comparison before promotion). Monitoring triggers automatic retraining when drift is detected. Multiple models and experiments managed consistently. Canary deployments and rollback are automated.

**Level 3 — MLOps Platform**: Self-service ML platform. Data scientists can deploy models without involving infrastructure teams. Feature store provides consistent features. Governance and lineage are automatic. Costs and resource usage are tracked per team/model.

For an interview: know what level the company is at and what the next level requires. Most teams are at Level 0 or 1 — moving to Level 2 is the most common practical challenge.

---

## Q9: How would you handle model rollback?

**A:** Model rollback is simpler than application rollback if the serving code is decoupled from the model artifact.

**If using MLflow registry by stage**: the serving code loads `models:/MyModel/Production`. Rolling back means transitioning the previous version back to Production:
```python
client.transition_model_version_stage("MyModel", version=3, stage="Archived")
client.transition_model_version_stage("MyModel", version=2, stage="Production")
```
No serving pod restart required if the serving code polls for model version changes.

**If using a model URI pinned in config**: update the config (ConfigMap in Kubernetes) to point to the previous model version URI, then rolling-restart the serving pods.

**If the model is baked into the container image**: use Kubernetes rolling update to roll back to the previous image tag (`kubectl rollout undo deployment/model-serving`).

**Key operational rule**: always keep at least two versions in the registry — the current Production and the previous Production (now Archived). This guarantees an immediate rollback target.

**The harder problem**: if a model was in production for a week and made wrong predictions, you need to decide whether to retroactively correct those predictions (if downstream systems stored them) and whether to notify affected users.

---

## Q10: How does feature drift differ from label drift?

**A:**
- **Feature drift** (data drift): the distribution of input features changes. Example: user age distribution shifts as the product attracts older users. The model sees inputs it wasn't trained on. Fix: retrain on current data, or add re-weighting.

- **Label drift** (prior probability shift): the distribution of the target variable changes, even if features look similar. Example: fraud rate drops from 2% to 0.5% after a security fix. The model predicts fraud too aggressively because it was trained on 2% fraud rate.

- **Concept drift**: the relationship between features and labels changes. Example: the same user behavior that predicted churn before now predicts premium upgrade because the product changed. Requires retraining — no amount of input normalization fixes it.

Detection:
- Feature drift: statistical tests on feature distributions (no ground truth needed, detectable immediately)
- Label drift: requires ground truth labels (delayed by feedback loop)
- Concept drift: requires ground truth labels and model performance tracking over time

---

## Q11: Describe your approach to monitoring an ML model in production.

**A:** Three layers:

**Infrastructure monitoring** (same as any service): request rate, latency (p50/p95/p99), error rate, pod CPU/memory, GPU utilization. Standard Prometheus + Grafana.

**Input monitoring** (feature drift): compare incoming feature distributions against training distributions. Run nightly or per rolling window. Alert if PSI or KS statistic exceeds threshold. No ground truth required — detectable immediately.

**Output monitoring** (prediction quality): track prediction distribution (are we suddenly predicting all class 0?). When ground truth arrives (delayed feedback), compute accuracy/F1 on recent predictions. Alert if performance drops below SLO.

**Business metric correlation**: correlate model predictions with downstream business outcomes (did a churn prediction lead to correct intervention?). This is the ultimate measure of model value.

For each alert, define: what is the response? Input drift → investigate, possibly retrain. Output quality degradation → immediate rollback + investigation. Infrastructure alert → standard on-call SRE response.

---

## Q12: What is the cold start problem in ML inference and how do you mitigate it?

**A:** Cold start in ML inference is the latency spike when a serving pod starts up and must load a model from disk or object storage before it can serve predictions. Large models (multi-GB transformer models) can take minutes to load.

Symptoms: when Kubernetes scales up new inference pods during a traffic spike, those pods take minutes to become ready. The latency spike happens before the new pods help with load.

Mitigations:
- **Minimum replica count**: never scale to zero for latency-sensitive models. Keep at least 2 pods warm at all times.
- **Pre-loading on node**: cache model artifacts on node-local storage (hostPath or local PV) so pods load from disk rather than object storage.
- **Readiness probe**: configure readiness probe on the actual model prediction endpoint, not just the HTTP port. Pod only joins the load balancer after the model is loaded.
- **Separate model download from startup**: use an init container to download the model artifact before the serving container starts. The serving container loads from a local path.
- **Predictive autoscaling**: scale out based on leading indicators (queue depth, time of day) rather than waiting for CPU/request-rate to spike.

Production rule from the Kubernetes GPU guide: do not scale critical inference to zero unless cold-start latency is acceptable to users.

---

## Q13: How does gang scheduling work and why does it matter for distributed training?

**A:** Gang scheduling means a job's Pods all start simultaneously or none start. Without it:

1. Job requests 8 Pods, each needing 1 GPU
2. 6 GPUs are free, so 6 Pods start
3. 2 Pods are Pending (waiting for GPUs)
4. The 6 started Pods initialize, then wait for the missing 2
5. 6 GPUs are occupied but doing no useful work — wasted

With gang scheduling (Kueue or Volcano):
1. Job requests 8 Pods
2. Scheduler waits until all 8 GPUs are simultaneously available
3. All 8 Pods start together
4. Training proceeds immediately

Why it matters: GPU time is expensive. Partial allocation wastes 100% of the allocated GPUs because PyTorch DDP / NCCL collective operations require all workers to synchronize. One missing worker blocks all others.

Kueue (newer, CNCF project) and Volcano (older, widely deployed) both implement this. For large training clusters, gang scheduling is required infrastructure — without it, utilization numbers look fine on paper but actual training throughput is terrible.

---

## Q14: What is ONNX and why does it matter for model serving?

**A:** ONNX (Open Neural Network Exchange) is an open format for representing ML models. It allows models trained in one framework (PyTorch, TensorFlow, sklearn) to be exported to a common format that can be loaded by optimized inference runtimes.

Why it matters: PyTorch and TensorFlow are excellent for training but not optimized for inference. ONNX Runtime and TensorRT can run ONNX models significantly faster — especially with hardware optimization (quantization, layer fusion, kernel autotune).

```python
# Export a PyTorch model to ONNX
import torch
model.eval()
dummy_input = torch.randn(1, 4)  # batch of 1, 4 features
torch.onnx.export(model, dummy_input, "model.onnx", opset_version=17)

# Run inference with ONNX Runtime
import onnxruntime as ort
session = ort.InferenceSession("model.onnx", providers=["CUDAExecutionProvider"])
outputs = session.run(None, {"input": features.numpy()})
```

Triton Inference Server natively supports ONNX, making the path: train in PyTorch → export to ONNX → serve via Triton with GPU-optimized inference.

---

## Q15: How would you implement a model quality gate in CI/CD?

**A:** A quality gate is an automated check that blocks model promotion if the new model doesn't meet criteria compared to the current production model.

Implementation:
```python
# In CI/CD pipeline, after training completes
import mlflow
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Get new model metrics (from the training run)
new_run = client.get_run(new_run_id)
new_accuracy = new_run.data.metrics["accuracy"]
new_f1 = new_run.data.metrics["f1_score"]

# Get current production model metrics
prod_versions = client.get_latest_versions("MyModel", stages=["Production"])
if prod_versions:
    prod_run = client.get_run(prod_versions[0].run_id)
    prod_accuracy = prod_run.data.metrics["accuracy"]

    # Quality gate: new model must be at least as good as production
    if new_accuracy < prod_accuracy - 0.02:  # allow 2% tolerance
        print(f"BLOCK: accuracy {new_accuracy:.4f} vs production {prod_accuracy:.4f}")
        sys.exit(1)

    if new_f1 < 0.90:  # absolute minimum threshold
        print(f"BLOCK: F1 {new_f1:.4f} below minimum 0.90")
        sys.exit(1)

print("PASS: quality gate passed, promoting to Staging")
```

Additional gates to consider: inference latency benchmark, model size (too large = serving cost), fairness checks (performance across demographic subgroups), security scan on model dependencies.

---

## Additional Questions (Quick Answer Format)

**Q: What is the difference between mlflow.log_metric and mlflow.log_param?**
A: `log_param` records an input (hyperparameter, configuration choice) — it does not change during a run. `log_metric` records an output (accuracy, loss) — it can be logged multiple times with a step counter to create a time series.

**Q: How do you serve two model versions simultaneously for A/B testing?**
A: Load both models at startup, route traffic based on a percentage (random number < threshold), log the variant with each prediction. Both models run in the same process or in separate pods with a routing proxy in front.

**Q: What causes training/serving skew and how do you prevent it?**
A: Computing features differently in training code vs serving code. Prevention: save the sklearn Pipeline (preprocessor + model together) so preprocessing is always applied identically. Or use a feature store.

**Q: What is the difference between a Pod OOMKilled and a CUDA OOM?**
A: Pod OOMKilled is the Linux OOM killer terminating the process because it exceeded cgroup memory limits — appears in `kubectl describe pod` as `OOMKilled`. CUDA OOM is the GPU runtime running out of GPU VRAM — appears as a Python exception `torch.cuda.OutOfMemoryError` inside the container. Two different memory limits, two different failure modes.

**Q: When would you use Kubeflow vs Airflow for ML pipelines?**
A: Kubeflow is Kubernetes-native — each step is a containerized job, tight integration with Kubernetes RBAC and secrets. Use it when your ML workloads are already Kubernetes-centric and you need GPU scheduling. Airflow is a general DAG orchestrator — use it when you have heterogeneous tasks (SQL, Python, API calls) and your team already operates Airflow.
