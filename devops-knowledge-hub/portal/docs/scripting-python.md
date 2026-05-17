---
title: "🐍 Python for DevOps"
sidebar_position: 15
description: "Zero to hero study guide for Python for DevOps — concepts, tools, architecture, production operations, and interview prep."
---

## Why Python for DevOps and SRE?

Python has established itself as one of the most widely used languages in DevOps, with a JetBrains survey reporting that 38% of Python usage is in DevOps, automation, and system administration. It plays a crucial role in infrastructure automation, CI/CD pipelines, cloud management, and system administration.

**Why Python is dominant in DevOps:**

- **Versatility and Simplicity** — Python's easy-to-read syntax allows DevOps engineers to write efficient automation scripts without a steep learning curve.
- **Cross-Platform Support** — Python runs seamlessly on Linux, Windows, and macOS, making it an ideal choice for managing diverse IT environments.
- **Rich Ecosystem of Libraries** — Python offers specialized libraries like `boto3` for AWS automation, `paramiko` for SSH-based tasks, and `subprocess` for shell scripting.
- **Integration with DevOps Tools** — Many DevOps tools such as Ansible, Kubernetes, and Jenkins support Python for scripting and plugin development.

**Python helps DevOps teams with:**

- **Scripting** — Automating repetitive tasks like log management, server provisioning, and software deployment.
- **Automation** — Streamlining infrastructure provisioning, configuration management, and CI/CD workflows.
- **Platform Engineering** — Developing custom tools and internal platforms for DevOps teams to enhance efficiency.

---

## Setting Up Python

### Install on Linux (Debian/Ubuntu)

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3 python3-pip -y

# Verify installation
python3 --version
pip3 --version
```

### Install on Linux (Red Hat/CentOS)

```bash
sudo yum install python3 python3-pip -y
```

### Install on Windows

Download from python.org, check "Add Python to PATH" during installation, then verify:

```
python --version
pip --version
```

### Virtual Environments

```bash
# Create a virtual environment (Linux)
python3 -m venv myenv
source myenv/bin/activate
deactivate

# Create a virtual environment (Windows)
python -m venv myenv
myenv\Scripts\activate
deactivate
```

### Install Essential Libraries

```bash
pip install numpy pandas matplotlib
pip install requests paramiko docker pyyaml psutil

# Upgrade pip
python3 -m pip install --upgrade pip   # Linux
python -m pip install --upgrade pip    # Windows
```

---

## Python Fundamentals

### Basic Data Types

Python's basic data types are:

- **Integer** — represents whole numbers
- **Float** — represents decimal numbers
- **String** — represents a sequence of characters
- **Boolean** — represents either `True` or `False`
- **List** — represents an ordered, mutable collection of elements

```python
# Data type examples
x = 8           # int
y = 89.56       # float
name = "Noor"   # string

print(type(x))       # <class 'int'>
print(type(y))       # <class 'float'>
print(type(name))    # <class 'str'>

# Convert string to integer
num_str = "10"
num_int = int(num_str)

# Check data type
num = 10
print(type(num))     # <class 'int'>

# Typecasting
x = 89
y = 12.89
z = '234'
x1 = float(x)   # 89.0
y1 = int(y)     # 12
z1 = int(z)     # 234
```

### Data Structures

```python
# List — ordered, mutable
x1 = ["apple", "banana", "cherry"]
print(type(x1))   # <class 'list'>

# Tuple — ordered, immutable
x2 = ("apple", "banana", "cherry")
print(type(x2))   # <class 'tuple'>

# Dictionary — key-value pairs
x = {"name": "noor", "age": 36}
print(type(x))    # <class 'dict'>

# Set — unordered, unique elements
x = {"apple", "banana", "cherry"}

# Create empty dictionary
empty_dict = {}
empty_dict = dict()
```

**List vs Tuple:** A list is mutable, which means you can modify its elements, while a tuple is immutable, meaning its elements cannot be changed after creation.

### Variables and Assignment

```python
# Variable naming rules
thisvar = 3
this_var = 89
_thisvar = 90
thisVar = 45
THISVAR = 83

# Multiple assignment
a, b, c = 'noor', 'aina', 'rehmat'
print(a, b, c)    # noor aina rehmat

# Assign same value
a = b = c = 'noor'

# Unpack from list
f = ['noor', 'Has', 'bet', 'kam']
a, b, c, d = f

# String concatenation
x = "Python "
y = "is "
z = "great language."
print(x + y + z)   # Python is great language.
```

### Global vs Local Variables

```python
a = 90   # global

def function():
    b = 89   # local
    print('value of a and b is:', a, b)

function()

# Make local variable global
def function2():
    global b
    b = 89
    print('value of a and b is:', a, b)
```

### Control Flow

```python
# if-else
x = 10
if x > 0:
    print("Positive")
else:
    print("Negative")

# for loop
for i in range(5):
    print(i)

# while loop
x = 5
while x > 0:
    print(x)
    x -= 1
```

### Functions

```python
# User-defined function
def function_name(parameters):
    return value

# Lambda function (anonymous, one-line)
square = lambda x: x**2
print(square(4))   # 16

# Inbuilt functions
print("Hello World!")
print(type(10))
```

### OOP in Python

Object-Oriented Programming (OOP) uses objects to represent real-world entities. In Python, OOP is implemented through classes and objects. Classes are blueprints for creating objects, and objects are instances of a class.

**Four principles of OOP:**

- **Encapsulation** — bundling of data and methods that operate on that data within a single unit (class)
- **Inheritance** — ability of a class to inherit properties and methods from its parent class
- **Polymorphism** — ability of an object to take on different forms or behaviors based on the context
- **Abstraction** — representing essential features and hiding unnecessary details to simplify complexity

---

## Python for DevOps — Core Commands

### 1. File Operations

```python
# Read a file
with open('file.txt', 'r') as file:
    content = file.read()
    print(content)

# Write to a file
with open('output.txt', 'w') as file:
    file.write('Hello, DevOps!')

# Read a file (another pattern)
with open("file.txt", "r") as f:
    content = f.read()
    print(content)
```

### 2. Environment Variables

```python
import os

# Get an environment variable
db_user = os.getenv('DB_USER')
print(db_user)

# Set an environment variable
os.environ['NEW_VAR'] = 'value'
```

### 3. Subprocess Management

```python
import subprocess

# Run shell commands
result = subprocess.run(['ls', '-l'], capture_output=True, text=True)
print(result.stdout)
```

### 4. API Requests

```python
import requests

# Make a GET request
response = requests.get('https://api.example.com/data')
print(response.json())
```

### 5. JSON Handling

```python
import json

# Read JSON from a file
with open('data.json', 'r') as file:
    data = json.load(file)
    print(data)

# Write JSON to a file
data = {'name': 'DevOps', 'type': 'Workflow'}
with open('output.json', 'w') as file:
    json.dump(data, file, indent=4)
```

### 6. Logging

```python
import logging

# Basic logging setup
logging.basicConfig(level=logging.INFO)
logging.info('This is an informational message')
```

### 7. Working with Databases

```python
import sqlite3

conn = sqlite3.connect('example.db')
cursor = conn.cursor()
cursor.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)')
conn.commit()
conn.close()
```

### 8. SSH Automation with Paramiko

```python
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('hostname', username='user', password='password')

stdin, stdout, stderr = ssh.exec_command('ls')
print(stdout.read().decode())
ssh.close()
```

### 9. Error Handling

```python
try:
    # code that may raise an exception
    risky_code()
except Exception as e:
    print(f'Error occurred: {e}')
```

### 10. Docker Integration

```python
import docker

client = docker.from_env()
containers = client.containers.list()
for container in containers:
    print(container.name)
```

### 11. Working with YAML Files

```python
import yaml

# Read a YAML file
with open('config.yaml', 'r') as file:
    config = yaml.safe_load(file)
    print(config)

# Write to a YAML file
data = {'name': 'DevOps', 'version': '1.0'}
with open('output.yaml', 'w') as file:
    yaml.dump(data, file)
```

### 12. Parsing Command-Line Arguments

```python
import argparse

parser = argparse.ArgumentParser(description='Process some integers.')
parser.add_argument('--num', type=int, help='an integer for the accumulator')

args = parser.parse_args()
print(args.num)
```

### 13. Monitoring System Resources

```python
import psutil

print(f"CPU Usage: {psutil.cpu_percent()}%")
print(f"Memory Usage: {psutil.virtual_memory().percent}%")
```

---

## CI/CD and Infrastructure Automation

Python plays a vital role in CI/CD, infrastructure provisioning, and configuration management. While many open-source tools like Terraform, Ansible, Jenkins, and Kubernetes are available, Python extends their capabilities by enabling custom automation where native functionality is insufficient.

**Why Python for CI/CD and Infrastructure Automation:**

- **Bridges gaps in native DevOps tools** — Python can enhance existing DevOps tools by adding custom scripts for deployment automation.
- **API-driven automation** — Python scripts can fetch secrets, interact with cloud APIs, and manage deployments dynamically.
- **Configuration management** — Custom Python modules can extend tools like Ansible when default modules are unavailable.

### Automating Secret Retrieval in CI/CD Pipelines

Before a deployment, Python can fetch authentication tokens from an API or a secret manager:

```python
import requests

def get_auth_token():
    url = "https://api.example.com/get-token"
    response = requests.get(url)
    return response.json().get("token")

auth_token = get_auth_token()
```

### Parallel Subprocess Execution

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess

def run_on_host(host: str, cmd: list) -> tuple:
    result = subprocess.run(
        ["ssh", f"user@{host}"] + cmd,
        capture_output=True, text=True, timeout=30
    )
    return host, result.stdout + result.stderr, result.returncode

hosts = ["node-1", "node-2", "node-3"]
cmd = ["df", "-h", "/"]

with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(run_on_host, h, cmd): h for h in hosts}
    for future in as_completed(futures):
        host, output, code = future.result()
        status = "OK" if code == 0 else "FAIL"
        print(f"[{status}] {host}: {output.strip()}")
```

---

## YAML / JSON Processing

```python
import yaml, json

# Load multi-document YAML (e.g., kubectl apply -f file.yaml)
with open("manifests.yaml") as f:
    docs = list(yaml.safe_load_all(f))

# Modify and write back
for doc in docs:
    if doc.get("kind") == "Deployment":
        doc["spec"]["replicas"] = 3

with open("manifests-out.yaml", "w") as f:
    yaml.dump_all(docs, f, default_flow_style=False)

# Pretty-print JSON
print(json.dumps({"status": "ok", "count": 42}, indent=2))
```

---

## AWS SDK (boto3)

```python
import boto3

# EC2: find instances missing required tag
ec2 = boto3.resource("ec2", region_name="us-east-1")
untagged = []
for instance in ec2.instances.filter(Filters=[{"Name": "instance-state-name", "Values": ["running"]}]):
    tags = {t["Key"]: t["Value"] for t in (instance.tags or [])}
    if "Team" not in tags:
        untagged.append(instance.id)
print(f"Untagged running instances: {untagged}")

# SSM Parameter Store — read secrets
ssm = boto3.client("ssm", region_name="us-east-1")
param = ssm.get_parameter(Name="/prod/payment/db_password", WithDecryption=True)
password = param["Parameter"]["Value"]
```

---

## Kubernetes Client

```python
from kubernetes import client, config

config.load_kube_config()  # or load_incluster_config() inside a pod
v1 = client.CoreV1Api()
apps = client.AppsV1Api()

# List pods with filtering
pods = v1.list_namespaced_pod(
    namespace="production",
    label_selector="app=payment",
    field_selector="status.phase=Running",
)
for pod in pods.items:
    print(pod.metadata.name, pod.status.phase)

# Scale a deployment
apps.patch_namespaced_deployment_scale(
    name="payment",
    namespace="production",
    body={"spec": {"replicas": 5}},
)
```

---

## Custom Prometheus Exporter

```python
from prometheus_client import start_http_server, Gauge, Counter, Histogram
import time, random

REQUEST_LATENCY = Histogram("myapp_request_duration_seconds", "Request latency", ["endpoint"])
ACTIVE_CONNECTIONS = Gauge("myapp_active_connections", "Active connections", ["region"])
ERRORS = Counter("myapp_errors_total", "Total errors", ["type"])

def collect_metrics():
    ACTIVE_CONNECTIONS.labels(region="us-east-1").set(random.randint(10, 100))
    ACTIVE_CONNECTIONS.labels(region="eu-west-1").set(random.randint(5, 50))

if __name__ == "__main__":
    start_http_server(8080)   # exposes /metrics
    while True:
        collect_metrics()
        time.sleep(15)
```

```yaml
# Prometheus scrape config
scrape_configs:
  - job_name: myapp-exporter
    static_configs:
      - targets: ["myapp-exporter:8080"]
```

---

## Logging Best Practices

```python
import logging, sys

def configure_logging(level: str = "INFO"):
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )

# Structured JSON logging for production
import json, datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "ts": datetime.datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        })

log = logging.getLogger("myapp")
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
log.addHandler(handler)
log.info("Server started")
# → {"ts":"2025-01-15T10:00:00Z","level":"INFO","logger":"myapp","msg":"Server started"}
```

---

## Basic Programs Reference

These are canonical Python programs that appear in interviews and onboarding:

```python
# Program 1 — Hello Python
print("Hello Python")

# Program 2 — Arithmetic operations
num1 = float(input("Enter the first number for addition: "))
num2 = float(input("Enter the second number for addition: "))
sum_result = num1 + num2
print(f"sum: {num1} + {num2} = {sum_result}")

num3 = float(input("Enter the dividend for division: "))
num4 = float(input("Enter the divisor for division: "))
if num4 == 0:
    print("Error: Division by zero is not allowed.")
else:
    div_result = num3 / num4
    print(f"Division: {num3} / {num4} = {div_result}")

# Program 3 — Area of a triangle
base = float(input("Enter the length of the base of the triangle: "))
height = float(input("Enter the height of the triangle: "))
area = 0.5 * base * height
print(f"The area of the triangle is: {area}")

# Program 4 — Swap two variables
a = input("Enter the value of the first variable (a): ")
b = input("Enter the value of the second variable (b): ")
print(f"Original values: a = {a}, b = {b}")
temp = a
a = b
b = temp
print(f"Swapped values: a = {a}, b = {b}")

# Program 5 — Random number
import random
print(f"Random number: {random.randint(1, 100)}")

# Program 6 — Km to miles
kilometers = float(input("Enter distance in kilometers: "))
conversion_factor = 0.621371
miles = kilometers * conversion_factor
print(f"{kilometers} kilometers is equal to {miles} miles")
```

---

## Interview Prep

**"What are the basic data types in Python?"**
Integer (whole numbers), Float (decimal numbers), String (sequence of characters), Boolean (True or False), List (ordered collection). Use `type()` to check the data type of any variable.

**"What is the difference between a list and a tuple?"**
A list is mutable — you can modify its elements after creation. A tuple is immutable — its elements cannot be changed after creation. Lists use `[]`, tuples use `()`.

**"How do you handle secrets in Python scripts?"**
Never hardcode. Read from environment variables (`os.environ`), inject via Vault agent sidecar, or use cloud-native secret managers (AWS SSM, GCP Secret Manager) via SDK. Use `python-dotenv` for local dev only.

**"How do you make a Python script production-safe?"**
Structured JSON logging, explicit timeout on all network calls, exponential backoff with jitter on retries, graceful SIGTERM handling, Prometheus metrics for monitoring, and linting/type-checking in CI (ruff, mypy).

**"What is OOPS and how is it implemented in Python?"**
Object-Oriented Programming uses objects to represent real-world entities. In Python it is implemented through classes and objects. Classes are blueprints; objects are instances. The four principles are: Encapsulation, Inheritance, Polymorphism, and Abstraction.

**"What Python libraries are most used in DevOps?"**
`boto3` (AWS), `paramiko` (SSH), `subprocess` (shell commands), `requests` (HTTP), `yaml` (YAML files), `docker` (Docker API), `psutil` (system resources), `kubernetes` (Kubernetes API), `argparse` (CLI arguments).

**"Sync vs async — when to use which?"**
Async (`asyncio` + `httpx`) for I/O-bound concurrency (checking 100 endpoints simultaneously). `ThreadPoolExecutor` for blocking I/O libraries that don't support async. `ProcessPoolExecutor` for CPU-bound work.

---
