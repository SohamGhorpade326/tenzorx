# Workstream AI - DevOps & Deployment Documentation

Welcome to the complete DevOps setup for Workstream AI. This document explains the containerization and deployment infrastructure.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Files Included](#files-included)
4. [Quick Start](#quick-start)
5. [Detailed Setup](#detailed-setup)
6. [File Descriptions](#file-descriptions)
7. [Directory Structure](#directory-structure)

---

## Overview

Workstream AI is now a fully containerized, scalable application ready for cloud deployment. The project includes:

- **3 Microservices**: Frontend, Meeting Workflow, Video Onboarding
- **Database**: PostgreSQL
- **Reverse Proxy**: Nginx
- **Infrastructure**: Terraform for AWS EC2
- **Container Orchestration**: Docker & Docker Compose

### Key Features

✅ **Containerized**: All services run in Docker containers
✅ **Scalable**: Easy to scale services horizontally
✅ **Infrastructure as Code**: Entire AWS setup automated with Terraform
✅ **Monitoring**: CloudWatch alarms and health checks
✅ **Automated Deployment**: Scripts to automate setup process
✅ **Production Ready**: SSL support, reverse proxy, security groups
✅ **Database**: PostgreSQL with automatic initialization
✅ **Management Tools**: Scripts to manage containers and services

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      AWS Account                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              VPC (10.0.0.0/16)                       │ │
│  │  ┌────────────────────────────────────────────────┐  │ │
│  │  │    Public Subnet (10.0.1.0/24)                 │  │ │
│  │  │  ┌──────────────────────────────────────────┐  │  │ │
│  │  │  │  EC2 Instance (t3.medium)                │  │  │ │
│  │  │  │  ┌────────────────────────────────────┐  │  │  │ │
│  │  │  │  │   Docker Container Runtime        │  │  │  │ │
│  │  │  │  │  ┌──────────────────────────────┐ │  │  │  │ │
│  │  │  │  │  │  Frontend (React/Node)       │ │  │  │  │ │
│  │  │  │  │  │  Port: 3000                  │ │  │  │  │ │
│  │  │  │  │  └──────────────────────────────┘ │  │  │  │ │
│  │  │  │  │  ┌──────────────────────────────┐ │  │  │  │ │
│  │  │  │  │  │  Meeting Workflow (FastAPI)  │ │  │  │  │ │
│  │  │  │  │  │  Port: 8001                  │ │  │  │  │ │
│  │  │  │  │  └──────────────────────────────┘ │  │  │  │ │
│  │  │  │  │  ┌──────────────────────────────┐ │  │  │  │ │
│  │  │  │  │  │  Video Onboarding (FastAPI)  │ │  │  │  │ │
│  │  │  │  │  │  Port: 8004                  │ │  │  │  │ │
│  │  │  │  │  └──────────────────────────────┘ │  │  │  │ │
│  │  │  │  │  ┌──────────────────────────────┐ │  │  │  │ │
│  │  │  │  │  │  PostgreSQL Database         │ │  │  │  │ │
│  │  │  │  │  │  Port: 5432                  │ │  │  │  │ │
│  │  │  │  │  └──────────────────────────────┘ │  │  │  │ │
│  │  │  │  │  ┌──────────────────────────────┐ │  │  │  │ │
│  │  │  │  │  │  Nginx Reverse Proxy         │ │  │  │  │ │
│  │  │  │  │  │  Ports: 80, 443              │ │  │  │  │ │
│  │  │  │  │  └──────────────────────────────┘ │  │  │  │ │
│  │  │  │  └────────────────────────────────────┘  │  │  │ │
│  │  │  │                                          │  │  │ │
│  │  │  │  Elastic IP: <public_ip>                 │  │  │ │
│  │  │  │  Security Group: Allow 22, 80, 443      │  │  │ │
│  │  │  └──────────────────────────────────────────┘  │  │ │
│  │  │                                                 │  │ │
│  │  │  Internet Gateway                              │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Browser Request
    ↓
Internet (Port 80/443)
    ↓
AWS Security Group (Allow 80, 443)
    ↓
Nginx Reverse Proxy (Port 80/443)
    ↓
    ├─→ Frontend (Port 3000) - React App
    ├─→ Meeting Workflow (Port 8001) - API
    └─→ Video Onboarding (Port 8004) - API
        ↓
        Database (PostgreSQL:5432)
```

---

## Files Included

### Core Docker Files

| File | Purpose |
|------|---------|
| `frontend/Dockerfile` | Multi-stage React/Node build |
| `microservices/meetingworkflow/Dockerfile` | FastAPI Meeting service |
| `microservices/video_onboarding_service/Dockerfile` | FastAPI Video service |
| `docker-compose.yml` | Orchestrates all 5 containers |
| `.dockerignore` | Excludes unnecessary files from Docker build |
| `nginx.conf` | Reverse proxy configuration |

### Infrastructure Files (Terraform)

| File | Purpose |
|------|---------|
| `terraform/main.tf` | Terraform provider configuration |
| `terraform/ec2.tf` | EC2 instance, VPC, networking, security |
| `terraform/variables.tf` | Input variables for Terraform |
| `terraform/outputs.tf` | Terraform output values |
| `terraform/user_data.sh` | EC2 initialization script |
| `terraform/terraform.tfvars.example` | Example variables file |

### Configuration & Documentation

| File | Purpose |
|------|---------|
| `.env.example` | Environment variables template |
| `DEPLOYMENT_GUIDE.md` | Complete 14-step deployment guide |
| `QUICK_REFERENCE.md` | Quick command reference |
| `DEVOPS_README.md` | This file |

### Helper Scripts

| File | Purpose |
|------|---------|
| `deploy.sh` | Automated deployment script (run locally) |
| `manage.sh` | Container management tool (run on EC2) |

---

## Quick Start

### For the Impatient (5 minutes)

```bash
# 1. Clone and navigate
cd Workstream-AI

# 2. Prepare Terraform
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars - set key_pair_name

# 3. Deploy
terraform init
terraform apply

# 4. Get your IP
terraform output instance_public_ip

# 5. Access
# Open browser: http://<your_ip>
```

### With Automated Script

```bash
# Run automated deployment
bash deploy.sh

# Follow the interactive prompts
# Script will:
# - Check prerequisites
# - Configure AWS
# - Create EC2 key pair
# - Deploy with Terraform
# - Wait for services
# - Show access URLs
```

---

## Detailed Setup

### Phase 1: Local Preparation (15 minutes)

1. **Install Prerequisites**
   ```bash
   # AWS CLI
   aws --version
   
   # Terraform
   terraform --version
   
   # Git
   git --version
   ```

2. **Configure AWS**
   ```bash
   aws configure
   # Enter your credentials
   ```

3. **Create EC2 Key Pair**
   ```bash
   aws ec2 create-key-pair --key-name workstream-key \
     --query 'KeyMaterial' --output text > workstream-key.pem
   chmod 400 workstream-key.pem
   ```

### Phase 2: Infrastructure Deployment (10-15 minutes)

4. **Prepare Terraform**
   ```bash
   cd Workstream-AI/terraform
   terraform init
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars
   ```

5. **Deploy Infrastructure**
   ```bash
   terraform plan    # Review changes
   terraform apply   # Deploy
   ```

6. **Save Output**
   ```bash
   terraform output > deployment_info.txt
   ```

### Phase 3: Verification (5-10 minutes)

7. **Connect to Instance**
   ```bash
   ssh -i workstream-key.pem ubuntu@<public_ip>
   ```

8. **Verify Services**
   ```bash
   sudo docker-compose -f /opt/workstream-ai/docker-compose.yml ps
   sudo docker-compose logs -f
   ```

9. **Test Application**
   ```bash
   curl http://localhost/health
   ```

### Phase 4: Post-Deployment (30+ minutes)

10. **Configure SSL** (Optional but recommended)
    ```bash
    sudo certbot certonly --standalone -d yourdomain.com
    # Update nginx.conf with certificate paths
    ```

11. **Set Domain DNS**
    - Point your domain to the Elastic IP

12. **Configure Backups**
    ```bash
    # Automated backup script
    sudo crontab -e
    # Add: 0 2 * * * /opt/workstream-ai/backup.sh
    ```

---

## File Descriptions

### Dockerfile - Frontend

```dockerfile
FROM node:18-alpine AS builder    # Build stage
FROM node:18-alpine               # Runtime stage
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

**Purpose**: 
- Multi-stage build reduces image size
- First stage builds React app
- Second stage serves production build
- Uses lightweight Alpine Linux

**Build Time**: ~2-3 minutes
**Image Size**: ~500MB

### Dockerfile - Python Services

```dockerfile
FROM python:3.11-slim             # Lightweight Python
RUN apt-get install -y gcc ffmpeg # System dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8001 or 8004
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

**Purpose**:
- FastAPI services for business logic
- Includes ffmpeg for video processing
- Auto-reloads on errors

**Build Time**: ~1-2 minutes
**Image Size**: ~1.2GB (with ffmpeg)

### docker-compose.yml

Defines 5 services:
1. **frontend** - React application (port 3000)
2. **meeting-workflow** - Meeting scheduler (port 8001)
3. **video-onboarding** - Video service (port 8004)
4. **db** - PostgreSQL database (port 5432)
5. **nginx** - Reverse proxy (port 80, 443)

Features:
- Health checks for each container
- Volume mounts for data persistence
- Network isolation
- Environment variable injection
- Auto-restart on failure

### nginx.conf

Reverse proxy configuration:
- Routes `/` to frontend
- Routes `/api/meeting/` to meeting-workflow
- Routes `/api/video-onboarding/` to video-onboarding
- Handles SSL/TLS termination
- Rate limiting: 10 req/s general, 30 req/s API
- Gzip compression enabled
- WebSocket support

### Terraform Configuration

#### ec2.tf
- Creates VPC with public subnet
- Internet Gateway for public access
- Security Group (ports 22, 80, 443)
- EC2 instance with auto-initialization
- Elastic IP for static addressing
- CloudWatch alarms for CPU and disk

#### variables.tf
- `aws_region` - AWS region (default: us-east-1)
- `instance_type` - EC2 type (default: t3.medium)
- `key_pair_name` - SSH key pair
- `root_volume_size` - Disk size (default: 50GB)

#### outputs.tf
- `instance_public_ip` - IP address
- `ssh_command` - Ready-to-use SSH command
- `application_url` - Application endpoint

#### user_data.sh
- Runs on EC2 startup
- Installs Docker, Terraform, Git
- Clones repository
- Creates systemd service
- Starts Docker Compose

---

## Directory Structure

```
Workstream-AI/
│
├── 📂 frontend/                          # React Frontend
│   ├── Dockerfile                        # Frontend container
│   ├── package.json
│   ├── vite.config.ts
│   ├── 📂 src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── 📂 components/
│   └── 📂 public/
│
├── 📂 microservices/                     # Backend Services
│   ├── 📂 meetingworkflow/
│   │   ├── Dockerfile                   # Meeting service
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   ├── config.py
│   │   ├── scheduler.py
│   │   ├── 📂 agents/
│   │   ├── 📂 models/
│   │   └── 📂 db/
│   │
│   └── 📂 video_onboarding_service/
│       ├── Dockerfile                   # Video service
│       ├── main.py
│       ├── requirements.txt
│       ├── config.py
│       ├── 📂 api/
│       ├── 📂 models/
│       ├── 📂 db/
│       └── 📂 uploads/
│
├── 📂 terraform/                         # Infrastructure as Code
│   ├── main.tf                           # Provider config
│   ├── ec2.tf                            # EC2 resources
│   ├── variables.tf                      # Input variables
│   ├── outputs.tf                        # Output values
│   ├── user_data.sh                      # EC2 initialization
│   └── terraform.tfvars.example          # Example variables
│
├── 📂 uploads/                           # Video uploads
│
├── docker-compose.yml                    # Container orchestration
├── nginx.conf                            # Reverse proxy config
├── .dockerignore                         # Docker build exclusions
├── .env.example                          # Environment variables
│
├── DEPLOYMENT_GUIDE.md                   # 14-step guide
├── QUICK_REFERENCE.md                    # Commands reference
├── DEVOPS_README.md                      # This file
│
├── deploy.sh                             # Deployment script
└── manage.sh                             # Management script
```

---

## Common Tasks

### Deploy for First Time
```bash
cd terraform
terraform init
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars
terraform apply
```

### Update Application Code
```bash
# SSH to instance
ssh -i workstream-key.pem ubuntu@<ip>

cd /opt/workstream-ai
git pull origin main
sudo docker-compose up -d --build
```

### View Logs
```bash
# All services
sudo docker-compose logs -f

# Specific service
sudo docker-compose logs -f frontend
```

### Restart Services
```bash
sudo docker-compose restart
```

### Backup Database
```bash
sudo docker-compose exec db pg_dump \
  -U workstream_user workstream_db > backup.sql
```

### Destroy Infrastructure
```bash
cd terraform
terraform destroy
```

---

## Environment Variables

Create `.env` file based on `.env.example`:

```bash
# Database
DB_PASSWORD=SecurePassword123!
DATABASE_URL=postgresql://workstream_user:password@db:5432/workstream_db

# Application
ENVIRONMENT=production
LOG_LEVEL=info

# Frontend URLs
VITE_API_URL=http://localhost:8000
VITE_VIDEO_API_URL=http://localhost:8004
```

---

## Cost Breakdown

### AWS Monthly Costs (Approximate)

| Service | Size | Cost |
|---------|------|------|
| EC2 t3.medium | 1 instance | $30 |
| EBS Storage | 50GB | $5 |
| Data Transfer | 1GB/month | $0.09 |
| CloudWatch | Monitoring | $1 |
| **Total** | | **~$36** |

### Pricing by Instance Type
- **t3.small**: ~$10/month (dev/test)
- **t3.medium**: ~$30/month (small prod)
- **t3.large**: ~$60/month (medium prod)

---

## Monitoring & Alerts

### CloudWatch Alarms Included
- CPU utilization > 80%
- Disk space > 85%
- Instance status checks

### View Metrics
```bash
aws cloudwatch list-metrics --namespace AWS/EC2 \
  --dimensions Name=InstanceId,Value=<instance_id>
```

### Set up Notifications
```bash
# Create SNS topic
aws sns create-topic --name workstream-alerts

# Create alarm with notification
aws cloudwatch put-metric-alarm \
  --alarm-name high-cpu \
  --alarm-actions arn:aws:sns:us-east-1:...:workstream-alerts
```

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| SSH fails | Check security group, key permissions |
| Containers won't start | SSH to instance, check `docker-compose logs` |
| High CPU | Scale up instance type in terraform.tfvars |
| Database error | Check if db container is running: `docker-compose ps` |
| HTTPS not working | Ensure SSL cert paths in nginx.conf are correct |
| Port already in use | Change port in docker-compose.yml |

---

## Next Steps

1. ✅ Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for common commands
2. ✅ Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed setup
3. ✅ Run `deploy.sh` for automated deployment
4. ✅ Use `manage.sh` on EC2 for container management
5. ✅ Configure monitoring and backups
6. ✅ Set up CI/CD for automatic deployments

---

## Support

### Documentation
- [AWS EC2 Docs](https://docs.aws.amazon.com/ec2/)
- [Terraform Docs](https://www.terraform.io/docs)
- [Docker Docs](https://docs.docker.com/)

### Common Commands

```bash
# SSH Access
ssh -i workstream-key.pem ubuntu@<public_ip>

# View Status
sudo docker-compose ps

# View Logs
sudo docker-compose logs -f

# Restart
sudo docker-compose restart

# Stop
sudo docker-compose stop

# Start
sudo docker-compose up -d
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial DevOps setup |
| 1.1 | 2026 | Added management scripts |

---

## License

Same as main Workstream AI project

---

**Last Updated**: April 2026
**Status**: Production Ready ✅
