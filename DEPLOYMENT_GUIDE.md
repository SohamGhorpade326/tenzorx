# Complete DevOps Deployment Guide - Workstream AI

## Overview
This guide will walk you through deploying the Workstream AI application on AWS EC2 using Docker, Docker Compose, and Terraform.

### Architecture
```
┌─────────────────────────────────────────────────────┐
│                    AWS EC2 Instance                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │          Docker Container Platform           │  │
│  ├──────────────────────────────────────────────┤  │
│  │                                              │  │
│  │  ┌─────────────┐  ┌─────────────┐           │  │
│  │  │   Frontend  │  │   Nginx     │           │  │
│  │  │   (Port 3)  │  │(80, 443)    │           │  │
│  │  └─────────────┘  └─────────────┘           │  │
│  │         ↓                ↓                   │  │
│  │  ┌─────────────────────────────────┐        │  │
│  │  │  Meeting Workflow (Port 8001)   │        │  │
│  │  │  Video Onboarding (Port 8004)   │        │  │
│  │  └─────────────────────────────────┘        │  │
│  │         ↓                                    │  │
│  │  ┌──────────────────────┐                   │  │
│  │  │   PostgreSQL DB      │                   │  │
│  │  │   (Port 5432)        │                   │  │
│  │  └──────────────────────┘                   │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Local Machine (Windows/Mac/Linux)
- AWS Account with admin/EC2 access
- AWS CLI installed and configured
- Terraform 1.0+ installed
- Git installed
- SSH client (built-in on Mac/Linux, PuTTY or Windows Terminal on Windows)

### AWS Requirements
1. AWS Access Key ID and Secret Access Key
2. EC2 Key Pair created in your AWS region
3. Sufficient EC2 quota in your region

---

## STEP 1: Prepare Your Local Environment

### 1.1 Install AWS CLI

```bash
# Windows (using Chocolatey)
choco install awscli

# Mac (using Homebrew)
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 1.2 Configure AWS Credentials

```bash
aws configure
# Enter your Access Key ID
# Enter your Secret Access Key
# Enter region: us-east-1
# Enter output format: json
```

### 1.3 Install Terraform

```bash
# Windows (using Chocolatey)
choco install terraform

# Mac (using Homebrew)
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

Verify installation:
```bash
terraform --version
aws --version
```

---

## STEP 2: Create EC2 Key Pair in AWS

### 2.1 Create Key Pair via AWS Console

1. Go to **AWS Console → EC2 → Key Pairs**
2. Click **Create Key Pair**
3. Name: `workstream-key`
4. Key Pair Type: `RSA`
5. File Format: `.pem` (for Linux/Mac) or `.ppk` (for Windows PuTTY)
6. Download and save securely

### 2.2 Alternative: Create via AWS CLI

```bash
aws ec2 create-key-pair \
  --key-name workstream-key \
  --query 'KeyMaterial' \
  --output text > workstream-key.pem

# Set permissions (Linux/Mac)
chmod 400 workstream-key.pem
```

---

## STEP 3: Prepare Terraform Configuration

### 3.1 Navigate to Terraform Directory

```bash
cd Workstream-AI/terraform
```

### 3.2 Copy and Configure terraform.tfvars

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
# Change:
# - key_pair_name = "workstream-key"
# - instance_type = "t3.medium" (or "t3.large" for better performance)
```

### 3.3 Initialize Terraform

```bash
terraform init
```

Expected output:
```
Terraform has been successfully configured!
```

---

## STEP 4: Deploy Infrastructure with Terraform

### 4.1 Plan the Deployment

```bash
terraform plan
```

Review the resources that will be created:
- VPC and Subnets
- Security Groups
- EC2 Instance
- Elastic IP
- IAM Roles

### 4.2 Apply the Terraform Configuration

```bash
terraform apply
```

When prompted, type: `yes`

This will create:
- EC2 instance (t3.medium)
- VPC with networking
- Security groups (ports 22, 80, 443)
- Elastic IP
- CloudWatch alarms

**Wait for completion** (~5-10 minutes)

### 4.3 Get Output Information

```bash
terraform output
```

You'll see:
- `instance_id`: Your EC2 instance ID
- `instance_public_ip`: IP address of your server
- `ssh_command`: SSH command to connect
- `application_url`: URL to access your application

**Save these values!**

---

## STEP 5: Connect to EC2 Instance

### 5.1 Via SSH (Linux/Mac)

```bash
# Navigate to where you saved workstream-key.pem
cd /path/to/key/directory

# Connect to instance
ssh -i workstream-key.pem ubuntu@<your_instance_public_ip>
```

### 5.2 Via SSH (Windows PowerShell)

```powershell
# If using .pem key with SSH built-in
ssh -i "C:\path\to\workstream-key.pem" ubuntu@<your_instance_public_ip>
```

### 5.3 Via Windows PuTTY

1. Download PuTTY: https://www.putty.org/
2. Convert .pem to .ppk using PuTTYGen
3. Open PuTTY → Session
4. Host: `ubuntu@<your_instance_public_ip>`
5. Connection → SSH → Auth → Browse to .ppk file
6. Click Open

---

## STEP 6: Verify Server Setup

Once connected to your EC2 instance:

```bash
# Check Docker installation
docker --version
docker-compose --version

# Check Terraform installation
terraform --version

# Check service status
sudo systemctl status workstream.service

# View service logs
sudo tail -f /var/log/workstream-setup.log
```

---

## STEP 7: Verify Application Deployment

### 7.1 Check Running Containers

```bash
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml ps
```

Expected output: All containers running (postgres, frontend, meeting-workflow, video-onboarding, nginx)

### 7.2 Check Logs

```bash
# View all logs
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml logs -f

# View specific service logs
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml logs -f frontend
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml logs -f meeting-workflow
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml logs -f video-onboarding
```

### 7.3 Verify Ports

```bash
# Check listening ports
sudo netstat -tuln | grep LISTEN

# Expected ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 5432 (DB)
```

---

## STEP 8: Access Your Application

### 8.1 Via Web Browser

```
http://<your_instance_public_ip>
https://<your_instance_public_ip>
```

### 8.2 Via API

**Frontend:** `http://<your_instance_public_ip>:3000`
**Meeting Workflow:** `http://<your_instance_public_ip>:8001`
**Video Onboarding:** `http://<your_instance_public_ip>:8004`

---

## STEP 9: SSL Certificate Setup (HTTPS)

### 9.1 Using Let's Encrypt with Certbot

```bash
# SSH into your instance
ssh -i workstream-key.pem ubuntu@<your_instance_public_ip>

# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Request certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --non-interactive

# Update nginx.conf with certificate paths
sudo nano /opt/workstream-ai/nginx.conf
# Update these lines:
# ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Restart nginx
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml restart nginx
```

---

## STEP 10: Database Setup

### 10.1 Initialize Database Schema

```bash
# Connect to PostgreSQL container
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml exec db psql \
  -U workstream_user \
  -d workstream_db

# Run SQL commands to initialize schema
# (Update with your schema from db/schema.sql)
```

### 10.2 Seed Data (Optional)

```bash
# If you have seed data
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml exec db psql \
  -U workstream_user \
  -d workstream_db \
  -f /docker-entrypoint-initdb.d/seed_data.sql
```

---

## STEP 11: Monitoring and Health Checks

### 11.1 View CloudWatch Metrics

```bash
# From local machine
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=<your_instance_id> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### 11.2 Health Check Endpoint

```bash
curl http://<your_instance_public_ip>/health
# Expected response: healthy
```

### 11.3 Monitor Container Health

```bash
# SSH into instance
ssh -i workstream-key.pem ubuntu@<your_instance_public_ip>

# View container status
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml ps

# View resource usage
sudo docker stats
```

---

## STEP 12: Backup and Recovery

### 12.1 Backup Database

```bash
# SSH into instance
ssh -i workstream-key.pem ubuntu@<your_instance_public_ip>

# Backup PostgreSQL
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml exec db pg_dump \
  -U workstream_user \
  workstream_db > workstream_backup_$(date +%Y%m%d_%H%M%S).sql

# Copy to local machine
scp -i workstream-key.pem ubuntu@<your_instance_public_ip>:~/workstream_backup_*.sql ./backups/
```

### 12.2 Restore Database

```bash
# Copy backup to instance
scp -i workstream-key.pem ./backups/workstream_backup_*.sql ubuntu@<your_instance_public_ip>:~/

# SSH into instance
ssh -i workstream-key.pem ubuntu@<your_instance_public_ip>

# Restore database
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml exec db psql \
  -U workstream_user \
  workstream_db < ~/workstream_backup_*.sql
```

---

## STEP 13: Common Management Commands

### 13.1 Restart Services

```bash
# Restart all services
sudo systemctl restart workstream.service

# Or manually with docker-compose
cd /opt/workstream-ai
sudo docker-compose restart

# Restart specific service
sudo docker-compose restart frontend
sudo docker-compose restart meeting-workflow
sudo docker-compose restart video-onboarding
```

### 13.2 Update Application Code

```bash
# SSH into instance
ssh -i workstream-key.pem ubuntu@<your_instance_public_ip>

cd /opt/workstream-ai

# Pull latest code
git pull origin main

# Rebuild and restart
sudo docker-compose up -d --build
```

### 13.3 View Logs

```bash
# All containers
sudo docker-compose logs -f

# Last 100 lines with timestamps
sudo docker-compose logs --tail=100 -t

# Specific service
sudo docker-compose logs -f meeting-workflow
```

### 13.4 Stop Services

```bash
# Stop all containers (don't remove)
sudo docker-compose stop

# Stop and remove containers
sudo docker-compose down

# Stop and remove with volumes (be careful!)
sudo docker-compose down -v
```

---

## STEP 14: Cleanup (Optional)

### 14.1 Destroy Terraform Resources

```bash
# From your local machine, in terraform directory
cd Workstream-AI/terraform

# Destroy all AWS resources
terraform destroy

# When prompted, type: yes
```

This will delete:
- EC2 instance
- VPC and networking
- Security groups
- Elastic IP
- IAM roles

### 14.2 Remove Local Terraform State

```bash
# Remove local state files
rm -rf .terraform
rm terraform.tfstate*
rm .terraform.lock.hcl
```

---

## Troubleshooting Guide

### Issue: SSH Connection Refused

**Solution:**
```bash
# Verify key permissions
chmod 400 workstream-key.pem

# Verify security group allows port 22
aws ec2 describe-security-groups \
  --group-ids <your_security_group_id> \
  --query 'SecurityGroups[0].IpPermissions'
```

### Issue: Docker Containers Not Running

**Solution:**
```bash
# SSH into instance
ssh -i workstream-key.pem ubuntu@<your_instance_public_ip>

# Check service status
sudo systemctl status workstream.service

# View setup logs
sudo cat /var/log/workstream-setup.log

# Manually start docker-compose
cd /opt/workstream-ai
sudo docker-compose up -d
```

### Issue: Database Connection Errors

**Solution:**
```bash
# Verify database container is running
sudo docker ps | grep postgres

# Check database logs
sudo docker-compose logs db

# Test connection
sudo docker-compose exec db pg_isready -U workstream_user
```

### Issue: High CPU/Memory Usage

**Solution:**
```bash
# Check resource usage
sudo docker stats

# Upgrade instance type
# 1. In terraform.tfvars, change instance_type = "t3.large"
# 2. Run: terraform apply
```

### Issue: Certificate Renewal

```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Or manually
sudo certbot certonly --standalone \
  --force-renewal \
  -d yourdomain.com
```

---

## Performance Optimization Tips

### 1. Instance Sizing
- **Development:** t3.small
- **Production Low Traffic:** t3.medium
- **Production Medium Traffic:** t3.large
- **Production High Traffic:** m5.xlarge or higher

### 2. Database Optimization
```bash
# Check database connections
sudo docker-compose exec db psql -U workstream_user -d workstream_db -c "SELECT count(*) FROM pg_stat_activity;"

# View slow queries (if logging enabled)
sudo docker-compose exec db psql -U workstream_user -d workstream_db -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### 3. Enable CloudWatch Detailed Monitoring
```bash
# In terraform.tfvars
enable_detailed_monitoring = true

# Apply changes
terraform apply
```

### 4. Configure Auto-Scaling (Advanced)
```bash
# Edit terraform/ec2.tf to add Auto Scaling Group
# See Terraform AWS documentation for ASG configuration
```

---

## Security Best Practices

### 1. Restrict SSH Access
```bash
# In terraform.tfvars
allowed_ssh_cidrs = ["YOUR_IP/32"]  # Instead of 0.0.0.0/0
```

### 2. Keep Instances Updated
```bash
# SSH into instance
ssh -i workstream-key.pem ubuntu@<your_instance_public_ip>

# Update packages
sudo apt-get update
sudo apt-get upgrade -y

# Reboot if needed
sudo reboot
```

### 3. Use Secrets Management
```bash
# Store sensitive data in AWS Secrets Manager
aws secretsmanager create-secret \
  --name workstream/db-password \
  --secret-string "YourSecurePassword123!"

# Reference in terraform for dynamic configuration
```

### 4. Enable VPC Flow Logs
```bash
# AWS Console → VPC → Flow logs → Create flow log
# Monitor network traffic to instances
```

---

## Next Steps

1. ✅ Deploy infrastructure with Terraform
2. ✅ Access application in browser
3. ✅ Configure SSL certificate
4. ✅ Set up monitoring and alerts
5. ✅ Configure backups and recovery
6. ✅ Document your domain DNS pointing to Elastic IP
7. ✅ Set up CI/CD pipeline for updates
8. ✅ Implement auto-scaling (optional)

---

## Support and Resources

### Useful Links
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Getting Help
1. Check logs: `sudo docker-compose logs -f`
2. Review Terraform state: `terraform state list`
3. Check AWS CloudWatch: AWS Console → CloudWatch → Alarms
4. SSH into instance and debug directly

---

## Cost Estimation (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| EC2 t3.medium (730 hrs) | On-Demand | ~$30 |
| EBS Storage (50GB) | gp3 | ~$5 |
| Data Transfer | Out (1GB) | ~$0.09 |
| CloudWatch | Monitoring | ~$1 |
| **Total Estimate** | | **~$36** |

*Prices vary by region. This is for us-east-1.*

---

## Document Version
- **Version:** 1.0
- **Created:** 2024
- **Last Updated:** April 2026
- **Author:** DevOps Team
