# INFRA: Outputs — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0

output "vpc_id" {
  description = "VPC ID (ca-central-1)"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (ALB only)"
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "Private application subnet IDs"
  value       = aws_subnet.private_app[*].id
}

output "private_db_subnet_ids" {
  description = "Private DB subnet IDs (Postgres + Redis)"
  value       = aws_subnet.private_db[*].id
}

output "rds_endpoint" {
  description = "RDS Postgres endpoint (private)"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint (private)"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "alb_dns_name" {
  description = "ALB DNS name (public-facing entry point)"
  value       = aws_lb.main.dns_name
}

output "worm_bucket_id" {
  description = "S3 WORM bucket name (ca-central-1)"
  value       = aws_s3_bucket.worm.id
}

output "worm_dr_bucket_id" {
  description = "S3 WORM DR bucket name (ca-west-1)"
  value       = aws_s3_bucket.worm_dr.id
}

output "audit_exports_bucket_id" {
  description = "Audit exports S3 bucket name (ca-central-1)"
  value       = aws_s3_bucket.audit_exports.id
}

output "kms_rds_arn" {
  description = "KMS CMK ARN for RDS encryption"
  value       = aws_kms_key.service["rds"].arn
  sensitive   = true
}

output "kms_s3_worm_arn" {
  description = "KMS CMK ARN for S3 WORM bucket"
  value       = aws_kms_key.service["s3-worm"].arn
  sensitive   = true
}

output "ssm_vpc_endpoint_id" {
  description = "SSM VPC endpoint ID (SSM-only admin access — no SSH)"
  value       = aws_vpc_endpoint.ssm.id
}

output "data_residency_region" {
  description = "Confirmed primary data residency region (INFRA_v1.0-INV-01)"
  value       = var.aws_region # Always ca-central-1 (validated by variable constraint)
}

output "dr_region" {
  description = "Confirmed DR region (INFRA_v1.0 §11)"
  value       = var.dr_region # Always ca-west-1 (validated by variable constraint)
}

output "webcam_service_scaling_profiles" {
  description = "Production scaling profiles for webcam streaming + live-room services"
  value       = local.webcam_service_profiles
}

output "webcam_observability_hooks" {
  description = "Prometheus/Grafana hook pointers for webcam services"
  value = {
    prometheus_parameter = aws_ssm_parameter.webcam_prometheus_hook.name
    grafana_parameter    = aws_ssm_parameter.webcam_grafana_hook.name
    prometheus_job_name  = local.webcam_observability_hooks.prometheus_job_name
    grafana_dashboard    = local.webcam_observability_hooks.grafana_dashboard_uid
  }
}
