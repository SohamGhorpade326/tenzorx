# Workstream AI - Quick Reference Guide

## 📋 Prerequisites Checklist

- [ ] AWS Account created
- [ ] AWS CLI installed and configure
- [ ] Terraform installed
- [ ] Git installed
- [ ] EC2 Key Pair created/downloade

---

## 🚀 Quick Start (5 Steps)

### Step 1: Configure AWS (Local Machine)
```bash
aws configure
# Enter your credentials
```

### Step 2: Prepare Terraform (Local Machine)
```bash
cd Workstream-AI/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your key_pair_name
```

### Step 3: Deploy Infrastructure (Local Machine)
```bash
terraform init
terraform apply
# Type 'yes' to confirm
```

### Step 4: Wait for Setup (~10 minutes)
The EC2 instance will automatically install Docker and start all services.

### Step 5: Access Application
```bash
# Get your IP from terraform output
terraform output instance_public_ip

# Access in browser
http://<your_ip>
```

---

## 📊 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Nginx | 80, 443 | http://localhost |
| Meeting Workflow | 8001 | http://localhost:8001 |
| Video Onboarding | 8004 | http://localhost:8004 |
| PostgreSQL | 5432 | localhost:5432 |

---

## 🔐 SSH Access

```bash
# Get SSH command
terraform output ssh_command

# Or manually
ssh -i /path/to/workstream-key.pem ubuntu@<public_ip>
```

---

## 🐳 Docker Commands (On EC2)

```bash
# View running containers
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml ps

# View logs
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml logs -f

# Restart services
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml restart

# View specific service logs
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml logs -f meeting-workflow

# Stop all services
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml stop

# Start all services
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml up -d

# View resource usage
sudo docker stats
```

---

## 📁 Project Structure

```
Workstream-AI/
├── frontend/                    # React/TypeScript app
│   ├── Dockerfile               # Frontend container
│   └── package.json
├── microservices/
│   ├── meetingworkflow/         # Meeting service
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── video_onboarding_service/ # Video service
│       ├── Dockerfile
│       └── requirements.txt
├── terraform/                   # Infrastructure as Code
│   ├── main.tf
│   ├── ec2.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── user_data.sh
├── docker-compose.yml           # Local/production compose file
├── nginx.conf                   # Reverse proxy config
├── .env.example                 # Environment variables template
├── deploy.sh                    # Automated deployment script
├── manage.sh                    # Service management script
└── DEPLOYMENT_GUIDE.md          # Detailed deployment guide
```

---

## 🛠️ Common Tasks

### View Instance Details
```bash
# Get all outputs
terraform output

# Get specific value
terraform output instance_public_ip
```

### Connect to Instance
```bash
ssh -i workstream-key.pem ubuntu@<public_ip>
```

### Check Service Status
```bash
sudo systemctl status workstream.service
```

### View Application Logs
```bash
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml logs -f
```

### Restart Application
```bash
sudo systemctl restart workstream.service
# Or
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml restart
```

### Update Application Code
```bash
cd /opt/workstream-ai
git pull origin main
sudo docker-compose up -d --build
```

### Backup Database
```bash
sudo docker-compose -f /opt/workstream-ai/docker-compose.yml exec db pg_dump \
  -U workstream_user workstream_db > backup.sql
```

---

## 🔍 Troubleshooting

### Container Won't Start
```bash
# Check logs
sudo docker-compose logs -f

# Restart services
sudo docker-compose restart
```

### Can't Connect to Instance
```bash
# Verify security group allows SSH (port 22)
aws ec2 describe-security-groups --group-ids <sg_id>

# Verify key permissions
chmod 400 workstream-key.pem
```

### Application Not Responding
```bash
# Check if containers are running
sudo docker-compose ps

# Check if ports are listening
sudo netstat -tuln | grep LISTEN

# Check CPU/Memory
sudo docker stats
```

### Database Connection Failed
```bash
# Check database is running
sudo docker-compose ps db

# Check database logs
sudo docker-compose logs db

# Test connection
sudo docker-compose exec db pg_isready -U workstream_user
```

---

## 💰 Cost Estimation

### Hourly Costs (Example: t3.medium in us-east-1)
- EC2: $0.0416/hour
- Storage: $0.08/GB/month ≈ $0.004/hour
- Data Transfer: $0.09/GB (outbound)

### Monthly Estimate
- **t3.small**: ~$10-15/month
- **t3.medium**: ~$30-40/month
- **t3.large**: ~$60-80/month

---

## 🛑 Cleanup

### Stop Services (Keep Infrastructure)
```bash
sudo docker-compose stop
```

### Destroy Infrastructure (Delete Everything)
```bash
cd Workstream-AI/terraform
terraform destroy
# Type 'yes' to confirm
```

---

## 📝 Environment Variables

### Key Variables in .env
```
DB_PASSWORD=YourSecurePassword
DATABASE_URL=postgresql://workstream_user:password@db:5432/workstream_db
ENVIRONMENT=production
LOG_LEVEL=info
VITE_API_URL=http://localhost:8000
VITE_VIDEO_API_URL=http://localhost:8004
```

---

## 🔗 Useful Links

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Hub](https://hub.docker.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## 📞 Support

### Check Service Health
```bash
curl http://<your_ip>/health
```

### View Metrics in CloudWatch
```bash
aws cloudwatch list-metrics --namespace AWS/EC2
```

### SSH Commands for Debugging
```bash
# On EC2 instance
cd /opt/workstream-ai

# Check service status
sudo systemctl status workstream.service

# View setup logs
sudo cat /var/log/workstream-setup.log

# View docker logs
sudo docker-compose logs -f

# Check disk space
df -h
du -sh /opt/workstream-ai
```

---

## ✅ Deployment Checklist

- [ ] Infrastructure deployed with Terraform
- [ ] All containers running (`docker-compose ps`)
- [ ] Application accessible in browser
- [ ] Database initialized
- [ ] Backups configured
- [ ] SSL certificate set up
- [ ] Domain DNS configured
- [ ] Monitoring alarms configured
- [ ] Team trained on management commands

---

## 📚 Additional Resources

See `DEPLOYMENT_GUIDE.md` for:
- Step-by-step setup instructions
- SSL certificate setup with Let's Encrypt
- Database backup and recovery procedures
- Performance optimization tips
- Security best practices
- Advanced troubleshooting
