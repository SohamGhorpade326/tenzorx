variable "aws_region" {
  type        = string
  description = "AWS region to deploy into (e.g., us-east-1)."
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type for all three instances."
  default     = "t3.small"
}

variable "allowed_cidr" {
  type        = string
  description = "CIDR allowed to access the instances (HTTP/SSH/Jenkins). Use your public IP CIDR like x.x.x.x/32."
}

variable "key_name" {
  type        = string
  description = "Existing EC2 key pair name for SSH access."
}

variable "ami_id" {
  type        = string
  description = "Optional AMI ID override. Leave empty to use the latest Ubuntu 22.04 LTS."
  default     = ""
}

variable "repo_url" {
  type        = string
  description = "Git URL for this repository (must be reachable from the EC2 instances)."
}

variable "repo_ref" {
  type        = string
  description = "Git branch or tag to deploy."
  default     = "main"
}

variable "tags" {
  type        = map(string)
  description = "Extra tags to apply to AWS resources."
  default     = {}
}
