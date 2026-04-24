#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install Docker Compose (standalone)
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install Terraform
apt-get install -y unzip wget
cd /tmp
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
mv terraform /usr/local/bin/
rm terraform_1.6.0_linux_amd64.zip

# Install git
apt-get install -y git

# Install CloudWatch agent for monitoring
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

# Create application directory
mkdir -p /opt/workstream-ai
cd /opt/workstream-ai

# Clone repository
git clone ${github_repo} .

# Create .env file
cat > .env << 'ENVEOF'
DB_PASSWORD=SecurePassword123!
DATABASE_URL=postgresql://workstream_user:SecurePassword123!@db:5432/workstream_db
ENVIRONMENT=production
LOG_LEVEL=info
VITE_API_URL=http://localhost:8000
VITE_VIDEO_API_URL=http://localhost:8004
ENVEOF

# Set permissions
chown -R ubuntu:ubuntu /opt/workstream-ai

# Create systemd service for docker-compose
cat > /etc/systemd/system/workstream.service << 'SERVICEEOF'
[Unit]
Description=Workstream AI Docker Compose
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/opt/workstream-ai
ExecStart=/usr/local/bin/docker-compose -f docker-compose.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.yml down
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start service
systemctl daemon-reload
systemctl enable workstream.service
systemctl start workstream.service

# Wait for services to start
sleep 30

# Log output
echo "Setup completed at $(date)" > /var/log/workstream-setup.log
