output "frontend_public_ip" {
  value       = aws_eip.frontend.public_ip
  description = "Frontend EC2 public IP."
}

output "video_onboarding_public_ip" {
  value       = aws_eip.video_onboarding.public_ip
  description = "Video onboarding EC2 public IP (Nginx on port 80)."
}

output "jenkins_public_ip" {
  value       = aws_eip.jenkins.public_ip
  description = "Jenkins EC2 public IP."
}

output "frontend_url" {
  value       = "http://${aws_eip.frontend.public_ip}/"
  description = "Frontend URL (HTTP 80)."
}

output "video_onboarding_health_url" {
  value       = "http://${aws_eip.video_onboarding.public_ip}/health"
  description = "Backend health URL (HTTP 80 via Nginx reverse proxy)."
}

output "jenkins_url" {
  value       = "http://${aws_eip.jenkins.public_ip}:8080/"
  description = "Jenkins URL (restricted by allowed_cidr)."
}
