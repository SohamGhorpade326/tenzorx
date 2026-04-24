# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "workstream-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "workstream-igw"
  }
}

# Public Subnet
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "workstream-public-subnet"
  }
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.main.id
  }

  tags = {
    Name = "workstream-rt"
  }
}

# Route Table Association
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security Group
resource "aws_security_group" "workstream" {
  name        = "workstream-sg"
  description = "Security group for Workstream AI"
  vpc_id      = aws_vpc.main.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_http_cidrs
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_https_cidrs
  }

  # Internal Docker network
  ingress {
    from_port   = 3000
    to_port     = 8004
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  # Egress - Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "workstream-sg"
  }
}

# Elastic IP
resource "aws_eip" "workstream" {
  domain = "vpc"

  tags = {
    Name = "workstream-eip"
  }

  depends_on = [aws_internet_gateway.main]
}

# EC2 Instance
resource "aws_instance" "workstream" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.workstream.id]
  key_name               = var.key_pair_name
  iam_instance_profile   = aws_iam_instance_profile.workstream.name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    delete_on_termination = true
    encrypted             = true
  }

  monitoring = var.enable_detailed_monitoring

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    github_repo = "https://github.com/SohamGhorpade326/tenzorx.git"
  }))

  tags = merge(
    {
      Name = var.instance_name
    },
    var.tags
  )

  lifecycle {
    ignore_changes = [ami]
  }
}

# Associate Elastic IP
resource "aws_eip_association" "workstream" {
  instance_id      = aws_instance.workstream.id
  allocation_id    = aws_eip.workstream.id
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cpu" {
  alarm_name          = "workstream-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Alert when CPU exceeds 80%"

  dimensions = {
    InstanceId = aws_instance.workstream.id
  }
}

resource "aws_cloudwatch_metric_alarm" "disk" {
  alarm_name          = "workstream-high-disk"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DiskSpaceUtilization"
  namespace           = "CWAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "Alert when disk usage exceeds 85%"

  dimensions = {
    InstanceId = aws_instance.workstream.id
  }
}

# Data source for Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# IAM Role for EC2
resource "aws_iam_role" "workstream" {
  name = "workstream-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for CloudWatch and SSM
resource "aws_iam_role_policy" "workstream" {
  name = "workstream-policy"
  role = aws_iam_role.workstream.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2messages:AcknowledgeMessage",
          "ec2messages:DeleteMessage",
          "ec2messages:FailMessage",
          "ec2messages:GetMessages",
          "ssm:UpdateInstanceInformation"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "workstream" {
  name = "workstream-instance-profile"
  role = aws_iam_role.workstream.name
}
