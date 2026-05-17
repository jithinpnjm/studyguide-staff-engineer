---
title: "Ansible and Host Automation"
sidebar_position: 18
---

# Ansible and Host Automation

## What It Is and Why It Matters

Ansible is an agentless IT automation tool for configuration management, application deployment, and task orchestration. It connects to hosts via SSH, pushes configuration, and ensures state — no agent required on managed nodes.

Even in a Kubernetes-heavy environment, Ansible remains relevant: bare-metal nodes need configuration before Kubernetes can run on them, GPU drivers must be installed and maintained on hosts, Kafka and database clusters on VMs still need management, and there are always legacy systems that haven't been containerized.

Understanding Ansible — how it models state, how inventory works, how to write idempotent playbooks, and how to use it safely at scale — is a core platform engineering skill.

---

## Mental Model

Ansible operates on a **push model**: the control node (your machine or CI) runs playbooks that SSH into managed nodes and execute tasks. The key design principle is **idempotency**: running the same playbook twice produces the same result. Good Ansible is not a script — it's a declarative state description.

```
Ansible Control Node (laptop, CI runner, AWX)
    → SSH
    → Managed Node 1 (runs tasks, Python required)
    → Managed Node 2
    → Managed Node 3
```

No daemon, no agent. Ansible copies and executes a Python script on the target, cleans up after itself.

---

## Inventory

Inventory defines which hosts Ansible manages.

### Static Inventory

```ini
# hosts.ini
[web]
web1.example.com
web2.example.com

[db]
db1.example.com ansible_user=postgres

[kubernetes:children]  # group of groups
web
db

[web:vars]
nginx_port=80
environment=prod

[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/id_ed25519
```

### Dynamic Inventory

For cloud environments, use dynamic inventory plugins that query APIs:

```yaml
# aws_ec2.yml — AWS dynamic inventory
plugin: amazon.aws.aws_ec2
regions:
  - us-east-1
  - eu-west-1
filters:
  tag:Environment: prod
  instance-state-name: running
keyed_groups:
  - key: tags.Role
    prefix: role
  - key: placement.availability_zone
    prefix: az
hostnames:
  - private-ip-address   # use private IP for SSH
```

```bash
# Test dynamic inventory
ansible-inventory -i aws_ec2.yml --list

# Use it with a playbook
ansible-playbook -i aws_ec2.yml site.yml
```

---

## Playbooks

A playbook is a YAML file that defines what to do on which hosts.

### Basic Structure

```yaml
---
- name: Configure web servers
  hosts: web                     # inventory group
  become: true                   # sudo escalation
  gather_facts: true             # collect system info as facts

  vars:
    nginx_worker_processes: 4
    nginx_worker_connections: 4096

  pre_tasks:
    - name: Update apt cache
      ansible.builtin.apt:
        update_cache: true
        cache_valid_time: 3600   # don't update if cache is less than 1h old

  roles:
    - common
    - nginx

  tasks:
    - name: Ensure nginx is running
      ansible.builtin.systemd:
        name: nginx
        state: started
        enabled: true

    - name: Copy nginx config
      ansible.builtin.template:
        src: templates/nginx.conf.j2
        dest: /etc/nginx/nginx.conf
        owner: root
        group: root
        mode: '0644'
      notify: Reload nginx       # triggers handler on change

  handlers:
    - name: Reload nginx
      ansible.builtin.systemd:
        name: nginx
        state: reloaded
```

### Handlers

Handlers run once at the end of the play, only if notified. Used for service reloads/restarts after configuration changes.

```yaml
# Handler only runs if the template changed, not on every playbook run
tasks:
  - name: Copy nginx config
    ansible.builtin.template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
    notify: Reload nginx

handlers:
  - name: Reload nginx
    ansible.builtin.systemd:
      name: nginx
      state: reloaded
```

If multiple tasks notify the same handler, it still only runs once.

### Variables and Facts

```yaml
# Variables from many sources (in order of precedence, last wins):
# role defaults < inventory vars < group_vars < host_vars < play vars < extra vars

# group_vars/web.yml
nginx_port: 80
max_connections: 1000

# host_vars/web1.example.com.yml
nginx_port: 8080       # overrides group var for this specific host

# In tasks: use Jinja2 template syntax
- name: Create nginx config
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf

# In template (nginx.conf.j2):
# worker_connections {{ nginx_worker_connections }};
# listen {{ nginx_port }};

# Facts — automatically gathered system information
- name: Show OS info
  debug:
    msg: "{{ ansible_distribution }} {{ ansible_distribution_version }}"

# Custom facts: create files in /etc/ansible/facts.d/*.fact on the managed node
# Ansible reads them automatically as ansible_local.*
```

### Conditionals and Loops

```yaml
tasks:
  # Conditional execution
  - name: Install specific packages on Ubuntu
    ansible.builtin.apt:
      name: "{{ item }}"
      state: present
    loop:
      - nginx
      - python3-pip
      - curl
    when: ansible_distribution == "Ubuntu"

  - name: Install specific packages on RHEL
    ansible.builtin.dnf:
      name: "{{ item }}"
      state: present
    loop:
      - nginx
      - python3-pip
    when: ansible_distribution in ["RedHat", "CentOS", "Rocky"]

  # Loop over dict
  - name: Create users
    ansible.builtin.user:
      name: "{{ item.name }}"
      groups: "{{ item.groups }}"
      state: present
    loop:
      - { name: alice, groups: sudo }
      - { name: bob, groups: developers }

  # Loop with until (retry)
  - name: Wait for service to start
    ansible.builtin.command: systemctl is-active myservice
    register: service_status
    until: service_status.rc == 0
    retries: 10
    delay: 3
```

### Error Handling

```yaml
tasks:
  - name: Run database migration
    ansible.builtin.command: python manage.py migrate
    register: migration_result
    failed_when: migration_result.rc != 0 and "already exists" not in migration_result.stderr

  - name: Always backup before proceeding
    ansible.builtin.command: pg_dump mydb > /backup/before-migration.sql
    ignore_errors: false   # fail the play if backup fails

  # Block with rescue/always
  - block:
      - name: Dangerous operation
        ansible.builtin.command: risky-command.sh

    rescue:
      - name: Recover from failure
        ansible.builtin.command: rollback.sh

    always:
      - name: Send notification regardless
        ansible.builtin.uri:
          url: "https://hooks.slack.com/services/..."
          method: POST
          body_format: json
          body: '{"text": "Deploy task completed (success or failure)"}'
```

---

## Roles

Roles are the standard way to organize and reuse Ansible code. A role is a directory with a defined structure:

```
roles/nginx/
├── defaults/main.yml     # default variable values (lowest precedence)
├── vars/main.yml         # role variables (higher precedence)
├── tasks/main.yml        # task list
├── handlers/main.yml     # handlers
├── templates/            # Jinja2 templates
│   └── nginx.conf.j2
├── files/                # static files
│   └── favicon.ico
├── meta/main.yml         # role metadata, dependencies
└── README.md
```

```yaml
# roles/nginx/tasks/main.yml
---
- name: Install nginx
  ansible.builtin.package:
    name: nginx
    state: present

- name: Copy nginx config
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: Reload nginx

- name: Enable and start nginx
  ansible.builtin.systemd:
    name: nginx
    state: started
    enabled: true

# roles/nginx/defaults/main.yml
---
nginx_worker_processes: auto
nginx_worker_connections: 1024
nginx_port: 80
```

Use roles in playbooks:
```yaml
- hosts: web
  roles:
    - common
    - nginx
    - { role: monitoring, when: install_monitoring | default(true) }
```

Ansible Galaxy: community-maintained roles. Install with `ansible-galaxy role install geerlingguy.nginx`.

---

## Ansible for Infrastructure Operations

### Rolling Updates

```yaml
- name: Rolling update of web servers
  hosts: web
  serial: 1                    # update one host at a time
  max_fail_percentage: 10      # abort if more than 10% of hosts fail

  tasks:
    - name: Remove from load balancer
      ansible.builtin.uri:
        url: "http://lb.internal/backend/{{ inventory_hostname }}/disable"
        method: POST

    - name: Update application
      ansible.builtin.apt:
        name: myapp
        state: latest

    - name: Restart service
      ansible.builtin.systemd:
        name: myapp
        state: restarted

    - name: Wait for service to be healthy
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/health"
        status_code: 200
      register: health_check
      until: health_check.status == 200
      retries: 10
      delay: 5

    - name: Re-add to load balancer
      ansible.builtin.uri:
        url: "http://lb.internal/backend/{{ inventory_hostname }}/enable"
        method: POST
```

### Kubernetes Node Configuration

```yaml
- name: Configure GPU nodes for Kubernetes
  hosts: gpu_nodes
  become: true

  tasks:
    - name: Install NVIDIA GPU drivers
      ansible.builtin.apt:
        name: nvidia-driver-535
        state: present
      notify: Reboot if needed

    - name: Load NVIDIA kernel modules
      ansible.builtin.modprobe:
        name: "{{ item }}"
        state: present
      loop:
        - nvidia
        - nvidia_uvm
        - nvidia_modeset

    - name: Configure containerd for NVIDIA runtime
      ansible.builtin.template:
        src: containerd-config.toml.j2
        dest: /etc/containerd/config.toml
      notify: Restart containerd

    - name: Set kernel parameters for high-performance networking
      ansible.posix.sysctl:
        name: "{{ item.key }}"
        value: "{{ item.value }}"
        state: present
        sysctl_set: true
      loop:
        - { key: net.core.somaxconn, value: 65535 }
        - { key: net.ipv4.tcp_max_syn_backlog, value: 65535 }
        - { key: vm.nr_hugepages, value: 1024 }

  handlers:
    - name: Restart containerd
      ansible.builtin.systemd:
        name: containerd
        state: restarted

    - name: Reboot if needed
      ansible.builtin.reboot:
        reboot_timeout: 600
```

---

## Ansible Vault

Vault encrypts sensitive data in playbooks and variable files:

```bash
# Create encrypted file
ansible-vault create group_vars/all/secrets.yml

# Edit encrypted file
ansible-vault edit group_vars/all/secrets.yml

# Encrypt existing file
ansible-vault encrypt group_vars/all/existing-secrets.yml

# Encrypt a single value (inline)
ansible-vault encrypt_string 'supersecretpassword' --name 'db_password'
# Output:
# db_password: !vault |
#   $ANSIBLE_VAULT;1.1;AES256
#   61386563...

# Run playbook with vault password
ansible-playbook site.yml --ask-vault-pass
# Or use password file (for CI)
ansible-playbook site.yml --vault-password-file ~/.vault-pass

# Or use environment variable
ANSIBLE_VAULT_PASSWORD_FILE=~/.vault-pass ansible-playbook site.yml
```

In the secrets file:
```yaml
# group_vars/all/secrets.yml (encrypted with vault)
db_password: "{{ vault_db_password }}"   # reference the vault variable
vault_db_password: supersecretpassword   # actual secret
```

---

## Ansible Tower / AWX

AWX is the open-source version of Ansible Automation Platform (formerly Ansible Tower). It provides:
- Web UI for running playbooks
- RBAC (who can run what against which hosts)
- Job scheduling
- Audit logging (who ran what, when, output)
- Credentials management (encrypted, no one can read secrets after entry)
- Dynamic inventory integration

AWX is the right choice when multiple teams need to run automation, and you need audit trails and access control.

---

## Common Failure Modes

**Non-idempotent tasks:** Using `command:` or `shell:` without `creates:` or `changed_when:` causes tasks to report "changed" on every run, even when nothing changed. Fix: use declarative modules (`file:`, `copy:`, `template:`, `service:`) instead of commands where possible. When using `command:`, always set `changed_when` appropriately.

**SSH timeout on large inventory:** Running against 500 hosts sequentially is slow. Fix: increase `forks` in `ansible.cfg` (default is 5 — try 50 for large inventories). Use `serial: 10%` for rolling updates.

**Missing privilege escalation:** Task needs sudo but `become: true` is missing. Fix: add at playbook level for playbooks that need root, or at task level for specific tasks. Check `become_user` when tasks need to run as a non-root user other than root.

**Variable precedence surprises:** A variable set in `host_vars` overrides the same variable in `group_vars`, which overrides `defaults`. When a variable isn't what you expect, add a debug task and print it. Use `--extra-vars` only for CI overrides, never for secrets.

**Vault password not available in CI:** Playbook fails with vault decryption error. Fix: store vault password in CI secrets (GitHub Actions secret, Vault), reference via `--vault-password-file` pointing to a file written from the CI secret.

---

## Key Questions and Answers

**Q: What makes Ansible different from a shell script for configuration management?**

Idempotency. A shell script typically runs commands regardless of current state — if nginx is already installed, `apt install nginx` will run again (harmless but noise). Ansible modules check current state first: the `apt` module checks if the package is installed, the `template` module checks if the file content matches. If state already matches desired state, the task reports "ok" (not changed) and does nothing. This makes playbooks safe to run repeatedly, which is essential for automated remediation and drift correction.

**Q: How do you safely update 100 web servers without downtime?**

Use `serial` with a rolling strategy: remove host from load balancer, update it, verify health, re-add to load balancer. Set `serial: 1` for cautious one-by-one, `serial: 10%` for faster updates. Set `max_fail_percentage: 10` to abort if too many hosts fail. Use `delegate_to` for the load balancer operations. Add a health check loop with `until`/`retries` before re-adding to the load balancer.

**Q: Ansible vs Terraform — when do you use each?**

Terraform provisions infrastructure (creates VMs, VPCs, databases) and manages their lifecycle. Ansible configures the systems Terraform creates (installs packages, writes config files, deploys services). They complement each other: Terraform creates an EC2 instance, Ansible configures it. For purely cloud-managed resources (RDS, S3), Terraform is the better tool. For OS-level configuration, software installation, and service management, Ansible is the right tool. Never use Ansible to create AWS resources (use Terraform); never use Terraform to configure OS-level state (use Ansible).

**Q: What is the Ansible vault and when do you use it?**

Ansible Vault encrypts sensitive data (passwords, API keys, certificates) stored in variable files or playbooks. Without vault, secrets in git are exposed. With vault, the file is encrypted with a symmetric key (the vault password). The vault password itself is stored outside git (CI secrets, secrets manager, password file not committed). Use vault for any variable that's a secret — database passwords, API tokens, TLS private keys. The convention is to use a `vault_` prefix for the actual secret and a plain variable name that references it, so you can see what variables exist without needing vault access.

---

## Points to Remember

- Ansible is agentless: push model via SSH, requires Python on managed nodes
- Idempotency: running the same playbook twice must produce the same result
- Use declarative modules over `command:`/`shell:` for idempotency
- Handlers run once at the end of the play, only when notified
- `serial` controls rolling update batch size; `max_fail_percentage` sets abort threshold
- Variables: host_vars override group_vars override defaults (higher specificity wins)
- Ansible Vault encrypts secrets in git; vault password stored outside git
- Roles are the unit of reuse — directory structure with tasks, handlers, templates, vars
- `forks` in ansible.cfg controls parallelism (default 5, increase for large fleets)
- AWX/Tower provides RBAC, audit logging, and web UI for team use
- Ansible for OS configuration; Terraform for infrastructure provisioning

## What to Study Next

- [Terraform and Infrastructure as Code](./terraform-infrastructure-as-code) — provision the infrastructure Ansible configures
- [CI/CD and Trusted Delivery](./cicd-trusted-delivery-and-platform-security) — integrate Ansible runs into CI/CD pipelines
- [Linux and Network Administration](./linux-and-network-administration) — understanding what Ansible is configuring
