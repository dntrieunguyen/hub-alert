# Hub Alert Ansible Deployment Playbook

Ansible playbook to automate the bare-metal deployment of [Hub Alert](https://github.com/dntrieunguyen/hub-alert) with Redis cache, Browserless headless browser, and Caddy 2 reverse proxy.

Requires `sudo` permissions on the target server.

---

## 📋 Architecture Overview

This automation configures:
- **Hub Alert Engine & Collector Service**: Configured via systemd service (`rsshub.service`).
- **Redis Server**: High-performance caching layer for feed ingestion and deduplication.
- **Browserless Container**: Headless Chrome instance for dynamic web scraping.
- **Caddy 2**: Reverse proxy providing automatic TLS/SSL certificates and HTTP/2 support.

---

## 🚀 Usage

### 1. Requirements
- Target OS: `Ubuntu 20.04` or higher
- [Install Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) on your local/control machine.

### 2. Configure Environment
Inspect and adjust the environment configuration file:
- `rsshub.env`: Define environment variables (Port, Redis, Collector settings, AI API keys, Google Chat webhooks).
- `rsshub.Caddyfile`: Configure your custom domain and SSL settings.

### 3. Run Playbook

Execute the deployment playbook against your target host:

```bash
sudo ansible-playbook rsshub.yaml
```

---

## 🛠️ Local Testing & Development

You can test the deployment locally using Vagrant:

1. Install [Vagrant](https://www.vagrantup.com/downloads) and [VirtualBox](https://www.virtualbox.org/).
2. Run the test script to provision a local test VM and apply the playbook:

```bash
./try.sh
ansible-playbook rsshub.yaml
```
