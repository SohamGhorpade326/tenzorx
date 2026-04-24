# 🚀 Workstream AI - Complete Deployment Checklist

## Phase 0: Prerequisites (Do This First!)

### Local Machine Setup
- [ ] **Install AWS CLI**
  ```bash
  # Windows: choco install awscli
  # Mac: brew install awscli
  # Linux: curl https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip
  ```
  - Verify: `aws --version`

- [ ] **Install Terraform**
  ```bash
  # Windows: choco install terraform
  # Mac: brew install terraform
  # Linux: wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
  ```
  - Verify: `terraform --version`

- [ ] **Install Git**
  - Verify: `git --version`

- [ ] **Have AWS Account Ready**
  - [ ] Access Key ID (from AWS Console)
  - [ ] Secret Access Key

### AWS Account Preparation
- [ ] Go to AWS Console
- [ ] Navigate to EC2 → Key Pairs
- [ ] Create new key pair named `workstream-key`
- [ ] Download and save `.pem` file securely
- [ ] Save location: `/path/to/safe/location/workstream-key.pem`

---

## Phase 1: Configure Local Environment (15 minutes)

### Step 1.1: Configure AWS CLI
```bash
aws configure
```
- [ ] Enter Access Key ID
- [ ] Enter Secret Access Key
- [ ] Enter Region: `us-east-1` (or your preferred region)
- [ ] Enter Output Format: `json`

**Verify:**
```bash
aws sts get-caller-identity
```
- [ ] Should show your AWS account info

### Step 1.2: Verify SSH Key
```bash
ls -la workstream-key.pem
chmod 400 workstream-key.pem
```
- [ ] Key file exists
- [ ] Permissions are 400

### Step 1.3: Clone/Navigate to Project
```bash
cd Workstream-AI
```
- [ ] You're in the correct directory
- [ ] Can see `docker-compose.yml`, `terraform/` folder

---

## Phase 2: Prepare Terraform Configuration (10 minutes)

### Step 2.1: Navigate to Terraform Directory
```bash
cd Workstream-AI/terraform
pwd
```
- [ ] Currently in `terraform` directory
- [ ] Can see: `main.tf`, `ec2.tf`, `variables.tf`

### Step 2.2: Copy Terraform Variables
```bash
cp terraform.tfvars.example terraform.tfvars
```
- [ ] `terraform.tfvars` file created
- [ ] File is in current directory

### Step 2.3: Edit terraform.tfvars
```bash
# Use your preferred editor
nano terraform.tfvars
# or
code terraform.tfvars
# or
vim terraform.tfvars
```

**Update these values:**
- [ ] `key_pair_name = "workstream-key"`
- [ ] `aws_region = "us-east-1"` (or your region)
- [ ] `instance_type = "t3.medium"` (adjust if needed)
- [ ] Save file (Ctrl+X, then Y in nano)

**Example:**
```hcl
aws_region             = "us-east-1"
instance_type          = "t3.medium"
key_pair_name          = "workstream-key"
enable_detailed_monitoring = false
```

---

## Phase 3: Initialize Terraform (5 minutes)

### Step 3.1: Initialize
```bash
terraform init
```
- [ ] Output shows "Terraform has been successfully configured!"
- [ ] `.terraform` directory created
- [ ] `.terraform.lock.hcl` file created

### Step 3.2: Validate Configuration
```bash
terraform validate
```
- [ ] Output shows "Success! The configuration is valid."

### Step 3.3: Format Check
```bash
terraform fmt
```
- [ ] No errors shown

---

## Phase 4: Plan Deployment (5 minutes)

### Step 4.1: Create Plan
```bash
terraform plan
```
- [ ] Shows planned resource creations
- [ ] Look for: VPC, Subnet, Security Group, EC2, IAM Role
- [ ] No errors shown

### Step 4.2: Save Plan (Optional)
```bash
terraform plan -out=tfplan
```
- [ ] `tfplan` file created

---

## Phase 5: Deploy Infrastructure (15 minutes + wait time)

### Step 5.1: Apply Configuration
```bash
terraform apply
```
- [ ] Review resources to be created
- [ ] Type: `yes` when prompted
- [ ] Deployment starts...

### Step 5.2: Wait for Completion
- [ ] Watch for: "Apply complete!"
- [ ] Typical time: 5-10 minutes
- [ ] Be patient! ☕

### Step 5.3: Capture Outputs
```bash
terraform output
```
- [ ] Copy these values to safe location:
  - [ ] `instance_id` (e.g., i-0abc123def456...)
  - [ ] `instance_public_ip` (e.g., 203.0.113.42)
  - [ ] `instance_public_dns` (e.g., ec2-203-0-113-42.compute...)
  - [ ] `ssh_command` (e.g., ssh -i /path/to/key.pem ubuntu@203.0.113.42)

**Save to file:**
```bash
terraform output > ../deployment_info.txt
cat ../deployment_info.txt
```
- [ ] File saved with all information

---

## Phase 6: Verify EC2 Instance (5 minutes)

### Step 6.1: Check Instance in AWS Console
- [ ] Go to AWS Console → EC2 → Instances
- [ ] Find instance with public IP
- [ ] Status should show: "Running"
- [ ] Status Checks should show: "Passed" (may take 1 minute)

### Step 6.2: Wait for Setup Script
- [ ] Scripts running on instance (takes ~2-5 minutes)
- [ ] Services starting automatically
- [ ] Docker being installed

---

## Phase 7: Connect to Instance (5 minutes)

### Step 7.1: SSH Connection
```bash
ssh -i /path/to/workstream-key.pem ubuntu@<public_ip>
```

**Example:**
```bash
ssh -i ./workstream-key.pem ubuntu@203.0.113.42
```

**On Windows (PowerShell):**
```powershell
ssh -i "C:\Users\YourName\workstream-key.pem" ubuntu@203.0.113.42
```

- [ ] Successfully connected to instance
- [ ] Shell prompt shows: `ubuntu@ip-10-...~$`

### Step 7.2: Verify Setup
Once connected:
```bash
# Check Docker
docker --version
docker-compose --version

# Check services (wait a moment if first time)
sleep 30
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml ps
```

- [ ] Docker installed
- [ ] Docker-compose installed
- [ ] Containers are running (should see 5 containers)

---

## Phase 8: Verify Application Services (10 minutes)

### Step 8.1: Check Container Status
```bash
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml ps
```

Expected output:
```
NAME                    STATUS
workstream-frontend     Up 2 minutes
workstream-meeting...   Up 2 minutes
workstream-video...     Up 2 minutes
workstream-db          Up 2 minutes
workstream-nginx       Up 2 minutes
```

- [ ] All 5 containers show "Up"
- [ ] No containers showing "Exited"

### Step 8.2: Check Service Logs
```bash
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml logs --tail=50
```

- [ ] No critical errors shown
- [ ] Services logging normally

### Step 8.3: Test Individual Services
```bash
# Test frontend
curl http://localhost:3000

# Test API endpoints
curl http://localhost:8001/health
curl http://localhost:8004/health

# Test database
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml exec db pg_isready -U workstream_user
```

- [ ] Frontend responds
- [ ] Meeting API responds
- [ ] Video API responds
- [ ] Database is ready

---

## Phase 9: Access Application (5 minutes)

### Step 9.1: Get Public IP
```bash
# From your local machine, in terraform directory
terraform output instance_public_ip
```

Or use the IP from Phase 5.3

### Step 9.2: Open in Browser
```
http://<your_public_ip>:3000
```

Example:
```
http://203.0.113.42:3000
```

- [ ] Frontend loads
- [ ] No connection errors

### Step 9.3: Test API Endpoints
```
http://203.0.113.42:8001     # Meeting API
http://203.0.113.42:8004     # Video API
```

- [ ] APIs accessible
- [ ] No port errors

---

## Phase 10: Configure Environment Variables (Optional)

### Step 10.1: Update .env (on EC2)
```bash
ssh -i workstream-key.pem ubuntu@<public_ip>

cd /opt/workstream-ai
sudo nano .env
```

- [ ] Database credentials updated
- [ ] API URLs configured
- [ ] File saved

### Step 10.2: Restart Services
```bash
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml restart
```

- [ ] Services restarted successfully

---

## Phase 11: Set Up SSL Certificate (RECOMMENDED)

### Step 11.1: SSH to Instance
```bash
ssh -i workstream-key.pem ubuntu@<public_ip>
```

### Step 11.2: Install Certbot
```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

- [ ] Certbot installed

### Step 11.3: Obtain Certificate (if you have a domain)
```bash
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --non-interactive
```

- [ ] Certificate obtained
- [ ] Certificate path shown (e.g., `/etc/letsencrypt/live/yourdomain.com/`)

### Step 11.4: Update Nginx Config
```bash
cd /opt/workstream-ai
sudo nano nginx.conf
```

Update these lines:
```nginx
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

- [ ] Paths updated in nginx.conf
- [ ] File saved

### Step 11.5: Restart Nginx
```bash
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml restart nginx
```

- [ ] Nginx restarted
- [ ] HTTPS now working

---

## Phase 12: Configure Domain (if applicable)

### Step 12.1: Get Elastic IP
```bash
# From local machine, in terraform directory
terraform output instance_public_ip
```

- [ ] Have your public IP

### Step 12.2: Update Domain DNS
- [ ] Go to your domain registrar (GoDaddy, Namecheap, etc.)
- [ ] Create/update A record
  - [ ] Name: `@` (or your subdomain)
  - [ ] Type: `A`
  - [ ] Value: `<your_public_ip>`
- [ ] Save changes
- [ ] Wait 15-30 minutes for DNS propagation

### Step 12.3: Test Domain Access
```bash
# Wait for DNS to propagate
nslookup yourdomain.com

# Access via domain
https://yourdomain.com
```

- [ ] Domain resolves to your IP
- [ ] Site accessible via domain

---

## Phase 13: Set Up Backups (IMPORTANT)

### Step 13.1: SSH to Instance
```bash
ssh -i workstream-key.pem ubuntu@<public_ip>
```

### Step 13.2: Create Backup Script
```bash
cd /opt/workstream-ai
sudo nano backup.sh
```

**Add this content:**
```bash
#!/bin/bash
BACKUP_DIR="/opt/workstream-ai/backups"
mkdir -p $BACKUP_DIR
FILENAME="$BACKUP_DIR/workstream_$(date +%Y%m%d_%H%M%S).sql"
sudo docker-compose exec -T db pg_dump \
  -U workstream_user workstream_db > $FILENAME
echo "Backup completed: $FILENAME"
```

- [ ] Script created
- [ ] File saved

### Step 13.3: Make Executable
```bash
sudo chmod +x backup.sh
```

- [ ] Script is executable

### Step 13.4: Set Up Cron Job (Daily Backup at 2 AM)
```bash
sudo crontab -e
```

**Add this line:**
```
0 2 * * * /opt/workstream-ai/backup.sh >> /var/log/backup.log 2>&1
```

- [ ] Cron job added
- [ ] File saved

### Step 13.5: Test Backup
```bash
sudo ./backup.sh
ls -lh backups/
```

- [ ] Backup file created
- [ ] Size > 0 bytes

---

## Phase 14: Monitoring & Alerts (RECOMMENDED)

### Step 14.1: Check CloudWatch Alarms
- [ ] Go to AWS Console → CloudWatch → Alarms
- [ ] Look for: `workstream-high-cpu`, `workstream-high-disk`
- [ ] Both alarms should be visible

### Step 14.2: Monitor Logs
- [ ] Go to CloudWatch → Log Groups (if configured)
- [ ] Monitor application logs

### Step 14.3: View Metrics
```bash
# From local machine
aws cloudwatch list-metrics --namespace AWS/EC2 \
  --dimensions Name=InstanceId,Value=<instance_id>
```

- [ ] Metrics visible in CloudWatch

---

## Final Verification Checklist

### Application Access
- [ ] Frontend loads: `http://<ip>:3000`
- [ ] Meeting API responds: `http://<ip>:8001/health`
- [ ] Video API responds: `http://<ip>:8004/health`
- [ ] Nginx proxy works: `http://<ip>/`

### Services Running
- [ ] 5 containers running: `docker-compose ps`
- [ ] No errors in logs: `docker-compose logs`
- [ ] Database initialized: `docker-compose exec db pg_isready`

### Infrastructure
- [ ] EC2 instance running
- [ ] Security group allows 22, 80, 443
- [ ] Elastic IP assigned
- [ ] DNS records correct (if domain configured)

### Backups & Recovery
- [ ] Database backups automated
- [ ] Backup script tested
- [ ] Cron job configured

### Monitoring
- [ ] CloudWatch alarms created
- [ ] Instance metrics visible
- [ ] Log groups configured

---

## 🎉 Deployment Complete!

### Access Your Application
```
Frontend:     http://<your_ip>:3000
Meeting API:  http://<your_ip>:8001
Video API:    http://<your_ip>:8004
```

### SSH Access
```bash
ssh -i workstream-key.pem ubuntu@<your_ip>
```

### Management Commands
```bash
# View status
sudo docker-compose ps

# View logs
sudo docker-compose logs -f

# Restart services
sudo docker-compose restart

# Stop services
sudo docker-compose stop

# Start services
sudo docker-compose up -d

# Backup database
sudo ./backup.sh

# View backups
ls -lh backups/
```

---

## 📚 Documentation

- [ ] Read [DEVOPS_README.md](DEVOPS_README.md) - Overview & architecture
- [ ] Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Command reference
- [ ] Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Detailed guide

---

## 🆘 Troubleshooting

### Can't Connect via SSH
```bash
# Check security group
aws ec2 describe-security-groups --group-ids <sg_id>

# Check key permissions
chmod 400 workstream-key.pem

# Try with verbose output
ssh -v -i workstream-key.pem ubuntu@<ip>
```

### Containers Not Running
```bash
# Check status
sudo docker-compose ps

# View logs
sudo docker-compose logs -f

# Restart
sudo docker-compose restart
```

### Application Not Responding
```bash
# Check if service is running
curl -v http://localhost:3000

# Check ports
sudo netstat -tuln | grep LISTEN

# Check logs
sudo docker-compose logs
```

### High CPU/Memory Usage
```bash
# View resource usage
sudo docker stats

# Stop non-essential services
sudo docker-compose stop <service_name>

# Upgrade instance type in terraform.tfvars and reapply
terraform apply
```

---

## 🗑️ Cleanup (When Ready to Destroy)

### Delete Everything
```bash
cd Workstream-AI/terraform
terraform destroy
# Type: yes when prompted
```

This will delete:
- [ ] EC2 instance
- [ ] VPC and networking
- [ ] Security groups
- [ ] Elastic IP
- [ ] IAM roles

---

## 📝 Important Notes

- ⚠️ **Save your deployment info** (IP, domain, backup location)
- ⚠️ **Keep backups** in a safe location
- ⚠️ **Rotate credentials** regularly
- ⚠️ **Monitor costs** in AWS Console
- ⚠️ **Update Docker images** periodically

---

## 📞 Support Resources

- [AWS EC2 Docs](https://docs.aws.amazon.com/ec2/)
- [Terraform Docs](https://www.terraform.io/docs/)
- [Docker Docs](https://docs.docker.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

**Status**: ✅ Ready to Deploy
**Version**: 1.0
**Last Updated**: April 2026

---

## 🎯 Next Steps After Deployment

1. ✅ Configure monitoring alerts
2. ✅ Set up automated backups
3. ✅ Configure SSL/HTTPS
4. ✅ Set up CI/CD pipeline
5. ✅ Enable auto-scaling
6. ✅ Configure CDN (CloudFront)
7. ✅ Set up performance monitoring
8. ✅ Implement disaster recovery plan

---

**Congratulations on deploying Workstream AI! 🚀**
