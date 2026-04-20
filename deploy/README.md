# Deployment (Docker + Terraform on AWS)

This repo deploys **three separate EC2 instances** (Ubuntu 22.04) via Terraform:

- **EC2 #1 (frontend)**: serves the Vite/React app on **HTTP 80**
- **EC2 #2 (video_onboarding)**: runs FastAPI on port **8004** (internal), exposed on **HTTP 80** via an Nginx reverse proxy
- **EC2 #3 (jenkins)**: runs Jenkins on **:8080** (restricted by security group)

Terraform uses the **default VPC** for a minimal setup.

## Local run (Docker)

### Run backend locally

```bash
docker compose -f deploy/video_onboarding/docker-compose.yml up -d --build
curl -sS http://localhost/health
```

### Run frontend locally

```bash
VITE_VIDEO_API_URL=http://localhost \
  docker compose -f deploy/frontend/docker-compose.yml up -d --build
```

Open:
- http://localhost/

### Windows note

On Windows you usually cannot bind both frontend and backend to port 80 simultaneously.
Use the local overrides:

- Backend: `-f deploy/video_onboarding/docker-compose.local.yml` (binds to `http://localhost:8084`)
- Frontend: `-f deploy/frontend/docker-compose.local.yml` (binds to `http://localhost:8081`)
- Jenkins: set `JENKINS_HTTP_PORT=8082` if 8080 is already used

## AWS deploy (Terraform)

### Prereqs

- An existing EC2 key pair (`key_name`)
- Your public IP CIDR (security groups), e.g. `203.0.113.10/32`
- A repo URL reachable from EC2 instances (public HTTPS is simplest)

### Terraform apply

```bash
cd infra/terraform
terraform init
terraform apply
```

Acceptance checks:

- `http://<frontend_public_ip>/`
- `http://<video_onboarding_public_ip>/health`
- `http://<jenkins_public_ip>:8080/` (restricted by `allowed_cidr`)

## Jenkins initial admin password

On the Jenkins host:

```bash
cd /opt/tenzorx/deploy/jenkins
sudo docker compose exec -T jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
