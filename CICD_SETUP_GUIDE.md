# Complete CI/CD Setup with Jenkins and SonarQube

## Overview
This guide will walk you through setting up a complete CI/CD pipeline using Jenkins and SonarQube on a separate EC2 instance.

### Architecture
```
GitHub Repository
       ↓
   (Webhook)
       ↓
Jenkins Server (EC2)
   ├── SonarQube (Code Quality)
   ├── Build (Docker Images)
   ├── Test
   └── Deploy to Production EC2
```

---

## STEP 1: Prepare for Jenkins EC2 Setup

### 1.1 Update terraform variables file

Edit `terraform/terraform.tfvars` and add:

```hcl
jenkins_instance_type = "t3.xlarge"    # 4 CPU, 16GB RAM (required for Jenkins + SonarQube)
jenkins_volume_size   = 100            # 100GB storage
```

---

## STEP 2: Deploy Jenkins Infrastructure

Run these commands from your local machine:

```bash
# Navigate to terraform directory
cd Workstream-AI/terraform

# Initialize Terraform (if not already done)
terraform init

# Plan deployment (to see what will be created)
terraform plan

# Deploy Jenkins infrastructure
terraform apply

# Get the Jenkins server details
terraform output jenkins_url
terraform output sonarqube_url
terraform output jenkins_ssh_command
```

**Wait 5-10 minutes** for Jenkins and SonarQube to fully initialize.

---

## STEP 3: Access and Configure Jenkins

### 3.1 Get Jenkins Initial Admin Password

```bash
# SSH into Jenkins server
ssh -i /path/to/workstream-key.pem ubuntu@<jenkins_instance_ip>

# Get initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword

# Note: Copy this password
```

### 3.2 Configure Jenkins (via Web UI)

1. Open your browser: `http://<jenkins_instance_ip>:8080`
2. Paste the initial admin password
3. Click "Install suggested plugins"
4. Create first admin user
5. Save and finish

### 3.3 Install Required Jenkins Plugins

Go to **Manage Jenkins → Manage Plugins → Available**

Search and install:
- **GitHub Integration Plugin**
- **SonarQube Scanner**
- **Docker Pipeline**
- **Pipeline**
- **Git**
- **Credentials Binding**
- **Timestamper**

---

## STEP 4: Configure SonarQube

### 4.1 Access SonarQube

Open in browser: `http://<jenkins_instance_ip>:9000`

Default credentials:
- Username: `admin`
- Password: `admin`

### 4.2 Change SonarQube Password

1. Click user icon (top right) → My Account
2. Change password to something secure
3. Save

### 4.3 Generate SonarQube Token

1. Go to **Administration → Security → Users**
2. Click on `admin` user
3. Scroll down to **Tokens**
4. Generate new token named `jenkins-token`
5. **Copy the token** (you'll need it for Jenkins)

---

## STEP 5: Configure Jenkins Credentials

### 5.1 Add GitHub Credentials

1. Go to **Manage Jenkins → Manage Credentials**
2. Click **global** under Stores scoped to Jenkins
3. Click **Add Credentials** (left sidebar)
4. Fill in:
   - Kind: **Username with password**
   - Username: `your_github_username`
   - Password: `your_github_personal_access_token` (create at github.com → Settings → Developer settings → Personal access tokens)
   - ID: `github-credentials`
   - Click **Create**

### 5.2 Add SonarQube Token

1. Click **Add Credentials** again
2. Fill in:
   - Kind: **Secret text**
   - Secret: `<paste_sonarqube_token_from_step_4.3>`
   - ID: `sonarqube-token`
   - Click **Create**

### 5.3 Add EC2 Private Key

1. Click **Add Credentials** again
2. Fill in:
   - Kind: **SSH Username with private key**
   - Username: `ubuntu`
   - Private Key: Paste your workstream-key.pem content
   - ID: `ec2-deploy-key`
   - Click **Create**

---

## STEP 6: Create Jenkins Pipeline Job

### 6.1 Create New Pipeline Job

1. Click **New Item**
2. Enter name: `Workstream-AI-Pipeline`
3. Select **Pipeline**
4. Click **OK**

### 6.2 Configure Pipeline

Fill in the following:

**General Tab:**
- Check: **GitHub project**
- Project URL: `https://github.com/SohamGhorpade326/tenzorx`

**Build Triggers Tab:**
- Check: **GitHub hook trigger for GITScm polling**

**Pipeline Tab:**
- Definition: **Pipeline script from SCM**
- SCM: **Git**
- Repository URL: `https://github.com/SohamGhorpade326/tenzorx.git`
- Credentials: Select `github-credentials`
- Branch Specifier: `*/main`
- Script Path: `Jenkinsfile`

Click **Save**

---

## STEP 7: Configure GitHub Webhook

### 7.1 On GitHub

1. Go to your repository: `https://github.com/SohamGhorpade326/tenzorx`
2. Click **Settings** → **Webhooks** → **Add webhook**
3. Fill in:
   - Payload URL: `http://<jenkins_instance_ip>:8080/github-webhook/`
   - Content type: `application/json`
   - Events: Select **Just the push event**
   - Active: Check the box
4. Click **Add webhook**

### 7.2 Test Webhook (Optional)

1. Go back to Webhooks list
2. Click on your newly created webhook
3. Click **Test** → **Send latest** (under Recent Deliveries)
4. You should see a green checkmark

---

## STEP 8: Update Jenkinsfile with Your Settings

Edit `Workstream-AI/Jenkinsfile` and update:

```groovy
environment {
    DOCKER_REGISTRY = "docker.io"
    GITHUB_REPO = "SohamGhorpade326/tenzorx"
    SONARQUBE_SERVER = "http://localhost:9000"
    SONARQUBE_TOKEN = credentials('sonarqube-token')  // Jenkins will use this
}
```

In the **Deploy to Production** stage, update the path to your EC2 key:

```groovy
ssh -i /home/ubuntu/workstream-key.pem ubuntu@${PROD_IP} << 'EOF'
```

---

## STEP 9: Test the Pipeline

### 9.1 Manual Trigger (First Test)

1. Go to Jenkins dashboard
2. Click on `Workstream-AI-Pipeline`
3. Click **Build Now**
4. Watch the build progress in **Console Output**

### 9.2 Trigger via GitHub Push

Push a commit to your repo:

```bash
git add .
git commit -m "Test CI/CD pipeline"
git push origin main
```

Jenkins should automatically trigger the pipeline!

---

## STEP 10: Monitor and Manage

### 10.1 View Build Logs

```bash
# SSH to Jenkins server
ssh -i /path/to/workstream-key.pem ubuntu@<jenkins_instance_ip>

# View Jenkins logs
sudo tail -f /var/log/jenkins/jenkins.log

# View Docker logs
docker logs -f sonarqube
```

### 10.2 View SonarQube Results

1. After a build completes, go to SonarQube
2. Your project should appear: `workstream-ai`
3. Review code quality metrics, bugs, vulnerabilities, etc.

---

## Common Commands on Jenkins Server

```bash
# SSH into Jenkins
ssh -i /path/to/workstream-key.pem ubuntu@<jenkins_instance_ip>

# Check Jenkins status
sudo systemctl status jenkins

# Restart Jenkins
sudo systemctl restart jenkins

# Check Docker containers
docker ps

# View SonarQube logs
docker logs -f sonarqube

# View SonarQube DB logs
docker logs -f sonarqube-db

# Stop all services
docker stop sonarqube sonarqube-db

# Start all services
docker start sonarqube sonarqube-db
```

---

## Troubleshooting

### Jenkins Not Starting
```bash
sudo systemctl status jenkins
sudo tail -f /var/log/jenkins/jenkins.log
```

### SonarQube Not Accessible
```bash
docker logs sonarqube
docker logs sonarqube-db
```

### GitHub Webhook Not Triggering
1. Check Jenkins URL is publicly accessible
2. Verify webhook in GitHub settings (Settings → Webhooks)
3. Check Recent Deliveries for errors

### Docker Build Failures
```bash
# Check Jenkins user has docker permissions
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

---

## Next Steps

1. **Configure Notifications**: Set up email/Slack notifications for builds
2. **Add More Stages**: Add security scanning, performance tests, etc.
3. **Configure Rollback**: Add automatic rollback on failed deployments
4. **Set Up Monitoring**: Configure CloudWatch alerts and dashboards
5. **Configure Backup**: Set up automated backups for Jenkins and SonarQube data

---

## Cost Optimization

The setup uses:
- **Jenkins EC2**: t3.xlarge (~$0.12/hour) with 100GB storage
- **Production EC2**: t3.large (~$0.10/hour) with 100GB storage
- **Total**: ~$0.22/hour (~$160/month)

To reduce costs:
- Use t3.medium for Jenkins (~$0.04/hour) if you don't have many builds
- Use spot instances (~60% discount)
- Stop instances when not in use

---

## Security Best Practices

✅ **Done:**
- Firewall configured (Security Groups)
- Jenkins behind authentication

❌ **TODO:**
- Enable HTTPS/SSL certificates
- Configure Jenkins secret scanning
- Use AWS Secrets Manager for sensitive data
- Enable MFA for GitHub account
- Regular backups of Jenkins configuration

---

## Jenkins Pipeline Stages Explanation

| Stage | Purpose |
|-------|---------|
| **Checkout** | Clone repository from GitHub |
| **Build** | Build Docker images for all services |
| **SonarQube Analysis** | Analyze code quality, security, coverage |
| **Unit Tests** | Run automated tests |
| **Push to Registry** | Push images to Docker registry (optional) |
| **Deploy** | Deploy to production EC2 (only on main branch) |

---

## Support

For issues, check:
1. Jenkins logs: `/var/log/jenkins/jenkins.log`
2. SonarQube logs: `docker logs sonarqube`
3. GitHub webhook deliveries
4. EC2 Security Groups

