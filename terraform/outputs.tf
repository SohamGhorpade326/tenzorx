output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.workstream.id
}

output "instance_public_ip" {
  description = "Public IP address of the instance"
  value       = aws_eip.workstream.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the instance"
  value       = aws_instance.workstream.public_dns
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.workstream.id
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "subnet_id" {
  description = "ID of the public subnet"
  value       = aws_subnet.public.id
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i /path/to/key.pem ubuntu@${aws_eip.workstream.public_ip}"
}

output "application_url" {
  description = "URL to access the application"
  value       = "https://${aws_eip.workstream.public_ip}"
}
