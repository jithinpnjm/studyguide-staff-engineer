---
title: "Troubleshooting"
sidebar_position: 8
---

# MLOps — Troubleshooting

## Runbook 1: MLflow Tracking Server Unreachable

**Symptoms**:
- `mlflow.start_run()` raises `MlflowException: Failed to connect to tracking server`
- `requests.exceptions.ConnectionError` when logging metrics
- Training scripts finish but no runs appear in the MLflow UI
- `mlflow ui` shows empty experiment list

**Diagnostic steps**:

```bash
# Step 1: Check if the tracking server process is running
ps aux | grep mlflow
# or
systemctl status mlflow  # if running as a service

# Step 2: Verify port is listening
ss -tlnp | grep 5000
# or
netstat -tlnp | grep 5000

# Step 3: Curl the health endpoint
curl -v http://localhost:5000/health
curl -v http://mlflow-server:5000/api/2.0/mlflow/experiments/list

# Step 4: Check if environment variable is set correctly
echo $MLFLOW_TRACKING_URI
# Should match what your training script uses

# Step 5: From within Kubernetes
kubectl get pods -n mlflow
kubectl describe pod -n mlflow <mlflow-pod>
kubectl logs -n mlflow <mlflow-pod> --tail=50

# Step 6: Test connectivity from training pod
kubectl exec -it <training-pod> -- curl http://mlflow-service.mlflow.svc.cluster.local:5000/health
```

**Common causes and fixes**:

| Cause | Fix |
|---|---|
| Wrong MLFLOW_TRACKING_URI | Set env var or call `mlflow.set_tracking_uri()` at the top of script |
| Server process crashed | Restart the server; check logs for the crash reason |
| Database connection failed | Check PostgreSQL connectivity; verify credentials in server config |
| Network policy blocking | Check K8s NetworkPolicy; ensure training namespace can reach mlflow namespace |
| Port mismatch | Confirm server started on expected port; check Service definition in K8s |
| HTTPS/TLS mismatch | If server is HTTPS, client URI must start with https:// |

**If using SQLite (local)**:

```bash
# Verify the DB file exists and is not corrupted
sqlite3 mlflow.db ".tables"
# Should show: alembic_version experiments metrics params runs tags

# If corrupted, recover from backup or restart fresh
cp mlflow.db mlflow.db.backup
mlflow db upgrade sqlite:///mlflow.db  # run schema migrations
```

---

## Runbook 2: Model Registry Permission Denied

**Symptoms**:
- `MlflowException: PERMISSION_DENIED: User does not have permission to...`
- Cannot transition model version stage
- Cannot register a new model
- `403 Forbidden` from MLflow API

**Diagnostic steps**:

```bash
# Step 1: Identify the auth model in use
# Check the MLflow server startup command for --app-name flag
kubectl describe deploy -n mlflow mlflow-server | grep -A5 "args"
# Look for: --app-name basic-auth  or  --app-name databricks-auth

# Step 2: Check current user's permissions
curl -u username:password http://mlflow-server:5000/api/2.0/mlflow/registered-models/list

# Step 3: For Databricks MLflow, check workspace permissions
# Users need "Can Manage" on the registered model for stage transitions

# Step 4: In open-source MLflow with basic-auth plugin
# Check the admin panel or sqlite auth db
sqlite3 /mlflow/auth.db "SELECT * FROM users WHERE username='your-user';"
sqlite3 /mlflow/auth.db "SELECT * FROM registered_model_permissions WHERE user_id=...;"
```

**Common causes and fixes**:

| Cause | Fix |
|---|---|
| User lacks `MANAGE` permission on model | Admin grants permission via MLflow UI or API |
| Service account token expired (Databricks) | Rotate the personal access token |
| Wrong credentials in environment | Update `MLFLOW_TRACKING_USERNAME` and `MLFLOW_TRACKING_PASSWORD` |
| CI/CD job using wrong identity | Check the service account or IAM role used by the CI runner |
| Model name mismatch | Ensure the model being registered matches the name in permissions |

**Granting permissions via MLflow API (basic-auth)**:

```python
from mlflow.server.auth.client import AuthServiceClient

auth_client = AuthServiceClient("http://mlflow-server:5000")
auth_client.create_registered_model_permission(
    name="MyModel",
    username="ci-service-account",
    permission="MANAGE",  # READ, EDIT, MANAGE, MANAGE_VERSIONS
)
```

---

## Runbook 3: GPU Not Allocated to Pod

**Symptoms**:
- Pod status is `Pending` indefinitely
- `kubectl describe pod` shows: `0/3 nodes are available: 3 Insufficient nvidia.com/gpu`
- `nvidia-smi` fails inside the pod
- Training job never starts

**Diagnostic steps**:

```bash
# Step 1: Check pod scheduling reason
kubectl describe pod <pod-name> | grep -A20 "Events:"
# Look for: "Insufficient nvidia.com/gpu" or "didn't match node selector"

# Step 2: Check allocatable GPU resources on all nodes
kubectl get nodes -o custom-columns="NAME:.metadata.name,GPU:.status.allocatable.nvidia\.com/gpu"
# If column is empty or "0", GPUs are not advertised

# Step 3: Check how many GPUs are already allocated
kubectl describe node <gpu-node> | grep -A15 "Allocated resources:"
# Look for: nvidia.com/gpu  used/total

# Step 4: Check GPU Operator health
kubectl get pods -n gpu-operator
# All pods should be Running or Completed
# Look for CrashLoopBackOff in: nvidia-driver-daemonset, nvidia-device-plugin

# Step 5: Check device plugin logs
kubectl logs -n gpu-operator ds/nvidia-device-plugin-daemonset

# Step 6: Check node labels
kubectl get nodes --show-labels | grep nvidia

# Step 7: Verify the device plugin is advertising the resource
kubectl describe node <gpu-node> | grep -E "nvidia.com|Allocatable" -A20
```

**Common causes and fixes**:

| Cause | Diagnostic | Fix |
|---|---|---|
| All GPUs in use | `kubectl describe node` shows all GPUs allocated | Wait for other jobs to finish; or increase cluster GPU capacity |
| Device plugin DaemonSet not running | `kubectl get pods -n gpu-operator` shows pod not running | `kubectl rollout restart ds/nvidia-device-plugin-daemonset -n gpu-operator` |
| Driver not installed | `nvidia-smi` fails on node | GPU Operator reinstall; check operator pod logs |
| Wrong nodeSelector | Pod has `nodeSelector.nvidia.com/gpu.product: WRONG-GPU` | Correct the nodeSelector to match available GPU type |
| Missing toleration | Pod requires GPU node but GPU nodes are tainted | Add toleration matching the GPU node taint |
| GPU Operator not deployed | No pods in gpu-operator namespace | Deploy GPU Operator via Helm |

**Fix nodeSelector mismatch**:

```bash
# Check what GPU products are available
kubectl get nodes -L nvidia.com/gpu.product

# Fix the pod spec to use available GPU type
kubectl patch pod <pod> -p '{"spec": {"nodeSelector": {"nvidia.com/gpu.product": "NVIDIA-A100-80GB"}}}'
# Note: most pod spec fields cannot be patched after creation — edit the Deployment/Job instead
```

**If device plugin is running but GPUs not advertised**:

```bash
# Trigger re-registration
kubectl rollout restart ds/nvidia-device-plugin-daemonset -n gpu-operator

# Verify after restart
kubectl describe node <gpu-node> | grep nvidia.com/gpu
```

---

## Runbook 4: Inference Service OOMKilled

**Symptoms**:
- Pods repeatedly restart with `OOMKilled` exit code
- `kubectl describe pod <pod>` shows: `Last State: Terminated — Reason: OOMKilled`
- Prometheus shows: `kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}`
- Serving latency spikes and then drops as pod restarts

**Diagnostic steps**:

```bash
# Step 1: Confirm OOMKilled
kubectl describe pod <pod-name> | grep -A5 "Last State"
# Reason: OOMKilled

# Step 2: Check current memory limits
kubectl describe pod <pod-name> | grep -A10 "Limits:"

# Step 3: Check memory usage before OOM
# If you have metrics:
kubectl top pod <pod-name>

# In Prometheus:
# container_memory_working_set_bytes{pod="<pod>", container="model-server"}

# Step 4: Check if it's CPU memory or GPU memory
# CPU OOMKilled: killed by Linux OOM killer (shows in pod status)
# GPU OOM: torch.cuda.OutOfMemoryError inside logs (pod may not crash)
kubectl logs <pod-name> --previous | grep -i "out of memory\|OOM\|cuda"
```

**Common causes and fixes**:

| Cause | Diagnostic | Fix |
|---|---|---|
| Memory limit too low for model size | `kubectl describe pod` limits vs model file size | Increase memory limit in deployment spec |
| Memory leak in serving code | Memory grows over time, OOM after N requests | Fix the leak (check for growing lists, unclosed file handles); restart periodically as mitigation |
| Large batch requests consuming too much RAM | Memory spikes on large input batches | Add input validation to limit batch size per request |
| Multiple concurrent requests during scale-up | Memory peaks when pod first starts and all warm-up requests arrive | Add readiness probe that ensures model is loaded before receiving traffic |
| Model loaded multiple times | Import side effects loading model on import + explicit load | Ensure model loads only once (module-level singleton or startup event) |

**Fix: increase memory limit**:

```yaml
# In your Deployment spec
containers:
  - name: model-server
    resources:
      requests:
        memory: "4Gi"
        cpu: "2"
      limits:
        memory: "8Gi"   # increase this
        cpu: "4"
```

**Fix: add request size validation**:

```python
from fastapi import HTTPException
from pydantic import BaseModel, validator

class PredictRequest(BaseModel):
    features: list[list[float]]

    @validator("features")
    def validate_batch_size(cls, v):
        if len(v) > 100:
            raise ValueError("Batch size exceeds maximum of 100 samples")
        if len(v) == 0:
            raise ValueError("At least one sample required")
        return v
```

---

## Runbook 5: Model Loading Slow (Large Artifacts)

**Symptoms**:
- Pod readiness probe fails for 2–5 minutes after startup
- First request after deployment takes 3+ minutes
- `kubectl get pods` shows pod in `Running` state but not `READY` for a long time
- Logs show: `Loading model from s3://artifacts/model/...` taking a long time

**Root cause**: the model artifact (weights file) is large (1GB+) and is downloaded from object storage every time a pod starts.

**Diagnostic steps**:

```bash
# Check model artifact size
aws s3 ls s3://mlflow-artifacts/model/ --recursive --human-readable | grep model
# or
mlflow artifacts list --run-id <run-id> --artifact-path model

# Check pod startup time from Prometheus
kube_pod_start_time
# Compare with when pod becomes ready

# Time the model load in test
time python -c "import mlflow.sklearn; mlflow.sklearn.load_model('models:/MyModel/Production')"
```

**Solutions**:

**Option 1: Use an init container to pre-download**

```yaml
# In Deployment spec
initContainers:
  - name: model-downloader
    image: amazon/aws-cli:latest
    command:
      - aws
      - s3
      - cp
      - s3://mlflow-artifacts/models/production/model.pkl
      - /model/model.pkl
    volumeMounts:
      - name: model-volume
        mountPath: /model
containers:
  - name: model-server
    env:
      - name: MODEL_PATH
        value: /model/model.pkl   # load from local path, not S3
    volumeMounts:
      - name: model-volume
        mountPath: /model
volumes:
  - name: model-volume
    emptyDir: {}
```

**Option 2: Bake model into Docker image**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# Download model at image build time
ARG MODEL_URI
RUN mlflow models download -m $MODEL_URI -d /app/model
# Build: docker build --build-arg MODEL_URI=models:/MyModel/Production .
```

**Option 3: Node-level model cache (best for frequently updated models)**

```yaml
# Mount node-local storage to avoid S3 download on every pod start
volumes:
  - name: model-cache
    hostPath:
      path: /mnt/model-cache
      type: DirectoryOrCreate
```

Add a DaemonSet that pre-syncs model artifacts to node local storage on promotion events.

**Option 4: Extend readiness probe timeout**

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 120   # wait 2 minutes before first check
  periodSeconds: 10
  failureThreshold: 30       # allow 5 more minutes of retries
```

---

## Runbook 6: Experiment Metrics Not Logging

**Symptoms**:
- Training script runs successfully (no Python errors)
- Run appears in MLflow UI but shows no metrics or parameters
- `mlflow.log_metric` call doesn't raise an error but metric is absent
- Metrics are `NaN` or missing in `search_runs()` output

**Diagnostic steps**:

```python
# Step 1: Verify tracking URI is set before starting run
import mlflow
print(mlflow.get_tracking_uri())
# Should show your server, not "mlruns/" (the default local path)
# If it shows "mlruns/", your set_tracking_uri() call is after start_run()

# Step 2: Print active run ID
with mlflow.start_run() as run:
    print(f"Active run: {run.info.run_id}")
    mlflow.log_metric("accuracy", 0.95)

# Step 3: Query the run immediately after
run_id = run.info.run_id
run_data = mlflow.get_run(run_id)
print(run_data.data.metrics)  # should show {"accuracy": 0.95}
```

**Common causes and fixes**:

| Cause | Symptom | Fix |
|---|---|---|
| `set_tracking_uri()` called after `start_run()` | Metrics go to default `mlruns/` folder | Move `set_tracking_uri()` to before any MLflow call |
| `set_experiment()` called inside the `with` block | Run goes to Default experiment | Call `set_experiment()` before `start_run()` |
| Logging NaN value | Metric missing in UI | Add `if not math.isnan(value)` guard before logging |
| Exception inside `with` block before `log_metric` | Run exists but has no metrics | Check for exceptions being swallowed; use try/except carefully |
| Using `mlflow.log_metric` outside of an active run | Silent failure | Ensure you're inside a `with mlflow.start_run():` block |

**Fix: correct ordering**:

```python
import mlflow

# CORRECT ORDER:
mlflow.set_tracking_uri("http://mlflow-server:5000")  # 1. set URI first
mlflow.set_experiment("my-experiment")                # 2. set experiment
with mlflow.start_run():                               # 3. start run
    mlflow.log_param("lr", 0.01)                      # 4. log inside run
    mlflow.log_metric("accuracy", 0.95)
```

**Fix: handle NaN metrics**:

```python
import math

def safe_log_metric(key: str, value: float):
    if value is None or math.isnan(value) or math.isinf(value):
        print(f"Warning: skipping invalid metric {key}={value}")
        return
    mlflow.log_metric(key, value)
```

---

## Runbook 7: Kubeflow Pipeline Step Failing

**Symptoms**:
- Pipeline run shows a step in `Failed` state
- Other downstream steps show `Skipped`
- Kubeflow UI shows error message in the failed step
- `kubectl get pods -n kubeflow` shows a completed pod in `Error` state

**Diagnostic steps**:

```bash
# Step 1: Find the failed pod
kubectl get pods -n kubeflow-user-namespace | grep pipeline

# Step 2: Get pod logs
kubectl logs -n kubeflow-user-namespace <failed-pod-name>

# Step 3: Check pod exit code
kubectl describe pod -n kubeflow-user-namespace <failed-pod-name> | grep -A5 "Exit Code"

# Step 4: Check the pipeline run in UI
# Kubeflow Pipelines UI → Runs → Click on failed run → Click on failed step → View logs

# Step 5: Check if it's an image pull issue
kubectl describe pod -n kubeflow-user-namespace <failed-pod-name> | grep -A10 "Events"
# Look for: ImagePullBackOff, ErrImagePull, or OOMKilled
```

**Common causes and fixes**:

| Cause | Signs | Fix |
|---|---|---|
| Python exception in step code | Non-zero exit code, exception traceback in logs | Fix the bug in the step component code |
| ImagePullBackOff | Event shows `Failed to pull image` | Check image name/tag; verify registry credentials if private |
| Out of memory | OOMKilled exit code | Increase `ResourceSpec` memory limit in component definition |
| Missing artifact from previous step | `FileNotFoundError` for input path | Ensure previous step outputs match current step inputs exactly |
| Dependency not in base image | `ModuleNotFoundError` | Add package to `packages_to_install` in `@component()` decorator |
| Permission denied writing output | `PermissionError` on output path | Check volume mounts and PVC permissions |

**Fix: add packages to component**:

```python
@component(
    base_image="python:3.11-slim",
    packages_to_install=["scikit-learn==1.3.0", "mlflow", "pandas", "numpy"],
)
def train_step(input_data: Input[Dataset], model_output: Output[Model]):
    # now sklearn is available
    from sklearn.ensemble import RandomForestClassifier
    ...
```

**Fix: increase memory for a heavy step**:

```python
@pipeline(name="my-pipeline")
def my_pipeline():
    train_task = train_step(data=prepare_task.output)
    train_task.set_memory_limit("16Gi")
    train_task.set_cpu_limit("8")
    train_task.set_gpu_limit(1)
    train_task.add_node_selector_constraint("nvidia.com/gpu.product", "NVIDIA-A100-80GB")
```

**If the error is in artifact passing**:

```python
# Make sure output path matches what you actually write
@component(base_image="python:3.11")
def produce_step(output_file: Output[Dataset]):
    import pandas as pd
    df = pd.DataFrame(...)
    # output_file.path is the path KFP expects you to write to
    df.to_csv(output_file.path, index=False)  # CORRECT
    # df.to_csv("output.csv")  # WRONG — KFP won't find this
```

---

## Quick Diagnosis Table

| Symptom | First Check | Likely Cause |
|---|---|---|
| MLflow run not appearing | `echo $MLFLOW_TRACKING_URI` | Wrong tracking URI |
| Metrics missing from run | Log order: URI → experiment → run → log | `set_tracking_uri` called after `start_run` |
| Stage transition fails | Registry permissions | User lacks MANAGE permission |
| Pod stuck Pending | `kubectl describe pod` Events | Insufficient GPU, wrong nodeSelector |
| nvidia-smi fails in pod | GPU Operator pods status | Driver/toolkit not installed |
| OOMKilled serving pod | Memory limits vs model size | Memory limit too low |
| Model load slow on startup | Model artifact size | Download from S3 on every start |
| Pipeline step failed | `kubectl logs <failed-pod>` | Exception, OOM, missing dependency |
| Feature drift alert | PSI score > 0.2 | Distribution shift in production data |
| Latency spike | P50 vs P99 distribution | Cache miss, feature store issue, cold start |
