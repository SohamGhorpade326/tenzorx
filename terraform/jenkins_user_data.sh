#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Java (required for Jenkins)
apt-get install -y default-jdk git curl wget gnupg2

# Install Docker
apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
systemctl start docker
systemctl enable docker

# Install Jenkins with proper GPG key handling
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | apt-key add -
echo "deb https://pkg.jenkins.io/debian-stable binary/" > /etc/apt/sources.list.d/jenkins.list
apt-get update
apt-get install -y jenkins

# Add jenkins to docker group
usermod -aG docker jenkins

# Start Jenkins
systemctl daemon-reload
systemctl start jenkins
systemctl enable jenkins

# Wait for Jenkins to start
sleep 30

# Create Docker network for SonarQube
docker network create sonar-network || true

# Run SonarQube with PostgreSQL database
docker run -d \
  --name sonarqube-db \
  --network sonar-network \
  -e POSTGRES_USER=sonar \
  -e POSTGRES_PASSWORD=sonar \
  -e POSTGRES_DB=sonarqube \
  -v sonarqube_db_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Wait for database to be ready
sleep 15

# Run SonarQube
docker run -d \
  --name sonarqube \
  --network sonar-network \
  -p 9000:9000 \
  -e SONAR_JDBC_URL=jdbc:postgresql://sonarqube-db:5432/sonarqube \
  -e SONAR_JDBC_USERNAME=sonar \
  -e SONAR_JDBC_PASSWORD=sonar \
  -e SONAR_JAVA_OPTS="-Xmx1g -Xms256m" \
  -v sonarqube_data:/opt/sonarqube/data \
  -v sonarqube_logs:/opt/sonarqube/logs \
  sonarqube:latest

echo "Jenkins and SonarQube setup complete!"
echo "Jenkins will be available at: http://<instance_ip>:8080"
echo "SonarQube will be available at: http://<instance_ip>:9000"
