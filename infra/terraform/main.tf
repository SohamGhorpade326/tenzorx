provider "aws" {
  region = var.aws_region
}

# Using the default VPC for a minimal, working setup.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Latest Ubuntu 22.04 LTS (Jammy)
data "aws_ami" "ubuntu_2204" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  ami_id            = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu_2204.id
  default_subnet_id = data.aws_subnets.default.ids[0]

  name_prefix = "tenzorx"
  common_tags = merge(var.tags, {
    Project = "tenzorx"
  })
}

resource "aws_eip" "frontend" {
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-frontend-eip" })
}

resource "aws_eip" "video_onboarding" {
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-video-onboarding-eip" })
}

resource "aws_eip" "jenkins" {
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-jenkins-eip" })
}

resource "aws_security_group" "frontend" {
  name        = "${local.name_prefix}-frontend-sg"
  description = "Frontend: HTTP 80 + SSH 22"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-frontend-sg" })
}

resource "aws_security_group" "video_onboarding" {
  name        = "${local.name_prefix}-video-onboarding-sg"
  description = "Video onboarding: HTTP 80 + SSH 22 (do not expose 8004)"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-video-onboarding-sg" })
}

resource "aws_security_group" "jenkins" {
  name        = "${local.name_prefix}-jenkins-sg"
  description = "Jenkins: 8080 + SSH 22"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Jenkins UI"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-jenkins-sg" })
}

resource "aws_instance" "frontend" {
  ami                         = local.ami_id
  instance_type               = var.instance_type
  subnet_id                   = local.default_subnet_id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.frontend.id]
  key_name                    = var.key_name

  user_data = templatefile("${path.module}/user_data/frontend.sh.tftpl", {
    repo_url    = var.repo_url
    repo_ref    = var.repo_ref
    backend_url = "http://${aws_eip.video_onboarding.public_ip}"
  })

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-frontend-ec2" })
}

resource "aws_instance" "video_onboarding" {
  ami                         = local.ami_id
  instance_type               = var.instance_type
  subnet_id                   = local.default_subnet_id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.video_onboarding.id]
  key_name                    = var.key_name

  user_data = templatefile("${path.module}/user_data/video_onboarding.sh.tftpl", {
    repo_url     = var.repo_url
    repo_ref     = var.repo_ref
    frontend_url = "http://${aws_eip.frontend.public_ip}"
  })

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-video-onboarding-ec2" })
}

resource "aws_instance" "jenkins" {
  ami                         = local.ami_id
  instance_type               = var.instance_type
  subnet_id                   = local.default_subnet_id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.jenkins.id]
  key_name                    = var.key_name

  user_data = templatefile("${path.module}/user_data/jenkins.sh.tftpl", {
    repo_url = var.repo_url
    repo_ref = var.repo_ref
  })

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-jenkins-ec2" })
}

resource "aws_eip_association" "frontend" {
  allocation_id = aws_eip.frontend.id
  instance_id   = aws_instance.frontend.id
}

resource "aws_eip_association" "video_onboarding" {
  allocation_id = aws_eip.video_onboarding.id
  instance_id   = aws_instance.video_onboarding.id
}

resource "aws_eip_association" "jenkins" {
  allocation_id = aws_eip.jenkins.id
  instance_id   = aws_instance.jenkins.id
}
