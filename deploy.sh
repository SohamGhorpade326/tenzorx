#!/bin/bash
# Quick Deployment Script - Run from local machine
# This script automates the entire deployment process

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Workstream AI - Quick Deployment Script               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Install it first: https://aws.amazon.com/cli/"
    exit 1
fi
print_success "AWS CLI installed"

if ! command -v terraform &> /dev/null; then
    print_error "Terraform not found. Install it first: https://www.terraform.io/"
    exit 1
fi
print_success "Terraform installed"

if ! command -v git &> /dev/null; then
    print_error "Git not found. Install it first: https://git-scm.com/"
    exit 1
fi
print_success "Git installed"

# Verify AWS credentials
print_status "Verifying AWS credentials..."
if aws sts get-caller-identity > /dev/null 2>&1; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    print_success "AWS credentials verified (Account: $ACCOUNT_ID)"
else
    print_error "AWS credentials not configured. Run: aws configure"
    exit 1
fi

echo ""
print_status "Configuration Setup"
echo "────────────────────────────────────────────────────────────"

# Get key pair name
read -p "Enter EC2 Key Pair name (existing or new): " KEY_PAIR_NAME

# Check if key pair exists
if aws ec2 describe-key-pairs --key-names "$KEY_PAIR_NAME" > /dev/null 2>&1; then
    print_success "Key pair '$KEY_PAIR_NAME' found"
else
    print_warning "Key pair '$KEY_PAIR_NAME' not found in AWS"
    read -p "Create new key pair? (y/n): " CREATE_KEY
    if [[ "$CREATE_KEY" == "y" ]]; then
        aws ec2 create-key-pair \
            --key-name "$KEY_PAIR_NAME" \
            --query 'KeyMaterial' \
            --output text > "${KEY_PAIR_NAME}.pem"
        chmod 400 "${KEY_PAIR_NAME}.pem"
        print_success "Key pair created and saved to ${KEY_PAIR_NAME}.pem"
    else
        print_error "Cannot proceed without key pair"
        exit 1
    fi
fi

# Get region
read -p "Enter AWS region [us-east-1]: " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}
print_success "Region set to: $AWS_REGION"

# Get instance type
echo ""
echo "Instance Type Options:"
echo "  t3.small   - Development/Testing ($10/month)"
echo "  t3.medium  - Small Production ($30/month)"
echo "  t3.large   - Medium Production ($60/month)"
read -p "Select instance type [t3.medium]: " INSTANCE_TYPE
INSTANCE_TYPE=${INSTANCE_TYPE:-t3.medium}
print_success "Instance type: $INSTANCE_TYPE"

echo ""
print_status "Preparing Terraform..."
echo "────────────────────────────────────────────────────────────"

cd Workstream-AI/terraform

# Create terraform.tfvars
cat > terraform.tfvars << EOF
aws_region             = "$AWS_REGION"
environment            = "production"
instance_type          = "$INSTANCE_TYPE"
root_volume_size       = 50
instance_name          = "workstream-ai-server"
key_pair_name          = "$KEY_PAIR_NAME"
enable_detailed_monitoring = false

tags = {
  Team       = "Engineering"
  CostCenter = "Engineering"
  DeployedAt = "$(date '+%Y-%m-%d')"
}
EOF

print_success "terraform.tfvars created"

# Initialize Terraform
print_status "Initializing Terraform..."
terraform init -upgrade > /dev/null
print_success "Terraform initialized"

echo ""
print_status "Infrastructure Planning..."
echo "────────────────────────────────────────────────────────────"

# Plan deployment
if terraform plan -out=tfplan > /dev/null; then
    print_success "Infrastructure plan created"
else
    print_error "Terraform plan failed"
    exit 1
fi

echo ""
echo "Summary of resources that will be created:"
echo "  • VPC (10.0.0.0/16)"
echo "  • Public Subnet (10.0.1.0/24)"
echo "  • Internet Gateway"
echo "  • Security Group (SSH, HTTP, HTTPS)"
echo "  • EC2 Instance ($INSTANCE_TYPE)"
echo "  • Elastic IP"
echo "  • IAM Role & Instance Profile"
echo "  • CloudWatch Alarms"
echo ""

read -p "Proceed with deployment? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

echo ""
print_status "Deploying Infrastructure..."
echo "────────────────────────────────────────────────────────────"

# Apply Terraform
if terraform apply tfplan; then
    print_success "Infrastructure deployed successfully!"
else
    print_error "Terraform apply failed"
    exit 1
fi

echo ""
print_success "Deployment Summary:"
echo "────────────────────────────────────────────────────────────"

# Get outputs
INSTANCE_ID=$(terraform output -raw instance_id)
PUBLIC_IP=$(terraform output -raw instance_public_ip)
PUBLIC_DNS=$(terraform output -raw instance_public_dns)
SSH_CMD=$(terraform output -raw ssh_command)

echo "Instance ID:     $INSTANCE_ID"
echo "Public IP:       $PUBLIC_IP"
echo "Public DNS:      $PUBLIC_DNS"
echo ""
echo "SSH Command:"
echo "  $SSH_CMD"
echo ""

# Save outputs to file
cat > deployment_info.txt << EOF
Workstream AI Deployment Info
Generated: $(date)

Instance ID:     $INSTANCE_ID
Public IP:       $PUBLIC_IP
Public DNS:      $PUBLIC_DNS
Region:          $AWS_REGION
Instance Type:   $INSTANCE_TYPE

SSH Command:
$SSH_CMD

Key File:        $KEY_PAIR_NAME.pem

Application URLs:
- Frontend:      http://$PUBLIC_IP:3000
- Meeting API:   http://$PUBLIC_IP:8001
- Video API:     http://$PUBLIC_IP:8004

Next Steps:
1. Wait 5-10 minutes for Docker services to start
2. Connect via SSH and check: sudo docker-compose ps
3. Access application at: http://$PUBLIC_IP
4. Configure domain DNS if you have one
5. Set up SSL certificate with Let's Encrypt
EOF

print_success "Deployment info saved to deployment_info.txt"

echo ""
print_status "Waiting for services to start (this may take 5-10 minutes)..."
echo "────────────────────────────────────────────────────────────"

WAIT_TIME=0
MAX_WAIT=600  # 10 minutes

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if curl -s "http://$PUBLIC_IP/health" > /dev/null 2>&1; then
        print_success "Application is online!"
        break
    fi
    
    WAIT_TIME=$((WAIT_TIME + 30))
    PROGRESS=$((WAIT_TIME / 60))
    echo "  Waiting... (${PROGRESS} minutes elapsed)"
    sleep 30
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    print_warning "Services are still starting. Check status with:"
    echo "  $SSH_CMD"
    echo "  sudo docker-compose -f /opt/workstream-ai/docker-compose.yml ps"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              Deployment Complete! 🎉                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Access your application:"
echo "  URL:     http://$PUBLIC_IP"
echo "  SSH:     $SSH_CMD"
echo ""
echo "Next steps:"
echo "  1. Connect to your instance and verify services"
echo "  2. Set up your domain and SSL certificate"
echo "  3. Configure environment variables"
echo "  4. Review logs: docker-compose logs -f"
echo ""
echo "For detailed guide: see DEPLOYMENT_GUIDE.md"
echo ""
