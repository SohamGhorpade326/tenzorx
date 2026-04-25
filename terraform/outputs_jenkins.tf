output "jenkins_instance_id" {
  description = "Jenkins EC2 Instance ID"
  value       = aws_instance.jenkins.id
}

output "jenkins_instance_ip" {
  description = "Jenkins EC2 Instance Public IP"
  value       = aws_eip.jenkins.public_ip
}

output "jenkins_url" {
  description = "Jenkins Web UI URL"
  value       = "http://${aws_eip.jenkins.public_ip}:8080"
}

output "sonarqube_url" {
  description = "SonarQube URL"
  value       = "http://${aws_eip.jenkins.public_ip}:9000"
}

output "jenkins_ssh_command" {
  description = "SSH command to connect to Jenkins server"
  value       = "ssh -i /path/to/workstream-key.pem ubuntu@${aws_eip.jenkins.public_ip}"
}
