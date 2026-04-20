pipeline {
  agent any

  options {
    timestamps()
  }

  parameters {
    string(name: 'FRONTEND_HOST', defaultValue: '', description: 'Frontend EC2 public IP (Terraform output frontend_public_ip)')
    string(name: 'BACKEND_HOST', defaultValue: '', description: 'Video onboarding EC2 public IP (Terraform output video_onboarding_public_ip)')
    string(name: 'SSH_USER', defaultValue: 'ubuntu', description: 'SSH username')
    string(name: 'SSH_CREDENTIALS_ID', defaultValue: '', description: 'Jenkins credentials ID for the EC2 SSH private key')
    string(name: 'REPO_REF', defaultValue: 'main', description: 'Git ref to deploy on the EC2 instances')
  }

  environment {
    FRONTEND_IMAGE = "tenzorx-frontend:${env.BUILD_NUMBER}"
    BACKEND_IMAGE  = "tenzorx-video-onboarding:${env.BUILD_NUMBER}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Security: gitleaks') {
      steps {
        sh '''
          docker run --rm -v "$PWD:/repo" -w /repo gitleaks/gitleaks:latest \
            detect --source . --redact --no-banner
        '''
      }
    }

    stage('Security: npm audit (frontend)') {
      steps {
        sh '''
          docker run --rm -v "$PWD/frontend:/app" -w /app node:20-alpine sh -lc "npm ci && npm audit --audit-level=high"
        '''
      }
    }

    stage('Security: bandit (backend)') {
      steps {
        sh '''
          docker run --rm -v "$PWD/microservices/video_onboarding_service:/app" -w /app python:3.11-slim sh -lc \
            "pip install --no-cache-dir bandit && bandit -r . -ll"
        '''
      }
    }

    stage('Build Docker images') {
      steps {
        sh '''
          docker build -t "$FRONTEND_IMAGE" -f frontend/Dockerfile frontend
          docker build -t "$BACKEND_IMAGE" -f microservices/video_onboarding_service/Dockerfile microservices/video_onboarding_service
        '''
      }
    }

    stage('Security: trivy image scan') {
      steps {
        sh '''
          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "$HOME/.cache:/root/.cache" \
            aquasec/trivy:0.52.0 image --exit-code 1 --severity HIGH,CRITICAL "$FRONTEND_IMAGE"

          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "$HOME/.cache:/root/.cache" \
            aquasec/trivy:0.52.0 image --exit-code 1 --severity HIGH,CRITICAL "$BACKEND_IMAGE"
        '''
      }
    }

    stage('Deploy (SSH)') {
      when {
        expression {
          return params.SSH_CREDENTIALS_ID?.trim() && params.FRONTEND_HOST?.trim() && params.BACKEND_HOST?.trim()
        }
      }
      steps {
        sshagent(credentials: [params.SSH_CREDENTIALS_ID]) {
          sh '''
            set -eux

            for HOST in "$FRONTEND_HOST" "$BACKEND_HOST"; do
              ssh -o StrictHostKeyChecking=no "$SSH_USER@$HOST" "sudo mkdir -p /opt/tenzorx && sudo chown -R $SSH_USER:$SSH_USER /opt/tenzorx || true"
            done

            ssh -o StrictHostKeyChecking=no "$SSH_USER@$FRONTEND_HOST" \
              "cd /opt/tenzorx && (git fetch --all --prune || true) && (git checkout $REPO_REF || true) && (git pull || true) && cd deploy/frontend && sudo docker compose up -d --build"

            ssh -o StrictHostKeyChecking=no "$SSH_USER@$BACKEND_HOST" \
              "cd /opt/tenzorx && (git fetch --all --prune || true) && (git checkout $REPO_REF || true) && (git pull || true) && cd deploy/video_onboarding && sudo docker compose up -d --build"
          '''
        }
      }
    }
  }

  post {
    always {
      sh 'docker images | head -n 50 || true'
    }
  }
}
