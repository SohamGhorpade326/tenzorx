variable "jenkins_instance_type" {
  description = "EC2 instance type for Jenkins server"
  type        = string
  default     = "t3.large"
}

variable "jenkins_volume_size" {
  description = "EBS volume size for Jenkins server in GB"
  type        = number
  default     = 100
}
