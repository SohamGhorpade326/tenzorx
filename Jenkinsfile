pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = "docker.io"
        GITHUB_REPO = "SohamGhorpade326/tenzorx"
        SONARQUBE_SERVER = "http://localhost:9000"
        SONARQUBE_TOKEN = credentials('sonarqube-token')
    }

    stages {
        stage('Checkout') {
            steps {
                echo '🔄 Checking out code from GitHub...'
                checkout scm
            }
        }

        stage('Build') {
            steps {
                echo '🔨 Building Docker images...'
                script {
                    sh '''
                        # Build frontend
                        docker build -t workstream-ai-frontend:${BUILD_NUMBER} ./frontend
                        
                        # Build meeting workflow
                        docker build -t workstream-ai-meeting-workflow:${BUILD_NUMBER} ./microservices/meetingworkflow
                        
                        # Build video onboarding
                        docker build -t workstream-ai-video-onboarding:${BUILD_NUMBER} ./microservices/video_onboarding_service
                    '''
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo '🔍 Running SonarQube code quality analysis...'
                script {
                    sh '''
                        # Run SonarQube analysis using the official scanner container
                        docker run --rm \
                            --network host \
                            -v "$PWD:/usr/src" \
                            -w /usr/src \
                            sonarsource/sonar-scanner-cli:latest \
                            -Dsonar.projectKey=workstream-ai \
                            -Dsonar.projectName="Workstream AI" \
                            -Dsonar.host.url=${SONARQUBE_SERVER} \
                            -Dsonar.sources=. \
                            -Dsonar.inclusions=frontend/src/**/*,microservices/meetingworkflow/**/*.py,microservices/video_onboarding_service/**/*.py \
                            -Dsonar.exclusions=frontend/dist,frontend/node_modules,frontend/public,frontend/venv,microservices/**/venv,microservices/**/__pycache__,**/dist,**/node_modules \
                            -Dsonar.token=${SONARQUBE_TOKEN}
                    '''
                }
            }
        }

        stage('Unit Tests') {
            steps {
                echo '✅ Running unit tests...'
                script {
                    sh '''
                        docker run --rm \
                            -v "$PWD/microservices/video_onboarding_service:/app" \
                            -w /app \
                            python:3.11-slim \
                            sh -lc 'pip install --no-cache-dir pytest -r requirements.txt && pytest -q tests'
                    '''
                }
            }
        }

        stage('Push to Registry') {
            steps {
                echo '📦 Pushing Docker images to registry...'
                script {
                    sh '''
                        # Tag images
                        docker tag workstream-ai-frontend:${BUILD_NUMBER} workstream-ai-frontend:latest
                        docker tag workstream-ai-meeting-workflow:${BUILD_NUMBER} workstream-ai-meeting-workflow:latest
                        docker tag workstream-ai-video-onboarding:${BUILD_NUMBER} workstream-ai-video-onboarding:latest
                        
                        # Note: Uncomment and configure Docker registry credentials if needed
                        # docker login -u ${DOCKER_USER} -p ${DOCKER_PASSWORD}
                        # docker push workstream-ai-frontend:${BUILD_NUMBER}
                        # docker push workstream-ai-meeting-workflow:${BUILD_NUMBER}
                        # docker push workstream-ai-video-onboarding:${BUILD_NUMBER}
                    '''
                }
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                echo '🚀 Deploying to production EC2 instance...'
                script {
                    sh '''
                        # Get production instance IP from terraform
                        PROD_IP=$(cd terraform && terraform output -raw instance_public_ip)
                        
                        # Deploy using SSH
                        ssh -i /path/to/workstream-key.pem ubuntu@${PROD_IP} << 'EOF'
                            cd /opt/workstream-ai
                            sudo docker-compose -f docker-compose.yml pull
                            sudo docker-compose -f docker-compose.yml up -d
                            sudo docker-compose -f docker-compose.yml ps
                        EOF
                    '''
                }
            }
        }
    }

    post {
        always {
            echo '🧹 Cleaning up...'
            cleanWs()
        }
        success {
            echo '✅ Pipeline succeeded!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}
