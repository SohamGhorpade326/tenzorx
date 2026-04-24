variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
  
  validation {
    condition     = contains(["t3.small", "t3.medium", "t3.large", "t3.xlarge", "m5.large", "m5.xlarge"], var.instance_type)
    error_message = "Instance type must be a valid t3 or m5 type."
  }
}

variable "root_volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 50
}

variable "instance_name" {
  description = "Name tag for EC2 instance"
  type        = string
  default     = "workstream-ai-server"
}

variable "key_pair_name" {
  description = "AWS EC2 Key Pair name for SSH access"
  type        = string
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed for SSH"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Change to your IP for better security
}

variable "allowed_http_cidrs" {
  description = "CIDR blocks allowed for HTTP"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_https_cidrs" {
  description = "CIDR blocks allowed for HTTPS"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
