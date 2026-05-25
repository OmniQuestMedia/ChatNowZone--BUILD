# INFRA: Variables — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0
# All region variables are constrained to Canadian AWS regions.

variable "aws_region" {
  description = "Primary AWS region — MUST be ca-central-1 (Canada residency invariant INFRA_v1.0-INV-01)"
  type        = string
  default     = "ca-central-1"

  validation {
    condition     = var.aws_region == "ca-central-1"
    error_message = "Primary region must be ca-central-1. No production workload may execute outside Canadian AWS regions (INFRA_v1.0 §2)."
  }
}

variable "dr_region" {
  description = "DR region — MUST be ca-west-1 (Canadian DR — INFRA_v1.0 §11)"
  type        = string
  default     = "ca-west-1"

  validation {
    condition     = var.dr_region == "ca-west-1"
    error_message = "DR region must be ca-west-1. No production data may be stored outside Canadian regions (INFRA_v1.0 §2)."
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the primary VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (ALB only — no application workloads)"
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for private application subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "private_db_subnet_cidrs" {
  description = "CIDR blocks for private database subnets (Postgres + Redis — never public)"
  type        = list(string)
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "rds_instance_class" {
  description = "RDS Postgres instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_db_name" {
  description = "Postgres database name"
  type        = string
  default     = "chatnowzone"
}

variable "rds_username" {
  description = "Postgres master username (fetched from Secrets Manager at apply time)"
  type        = string
  default     = "cnz_admin"
}

variable "elasticache_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.small"
}

variable "worm_retention_days" {
  description = "S3 Object Lock COMPLIANCE retention — INFRA_v1.0 §3.2 mandates minimum 90 days"
  type        = number
  default     = 90

  validation {
    condition     = var.worm_retention_days >= 90
    error_message = "WORM_RETENTION_DAYS must be >= 90 (INFRA_v1.0 §3.2 — WORM_RETENTION_DAYS: 90)."
  }
}

variable "certificate_arn" {
  description = "ACM certificate ARN for ALB HTTPS listener (must be in ca-central-1)"
  type        = string
  default     = ""
}

variable "webcam_ecs_cluster_name" {
  description = "ECS cluster hosting webcam workloads (streaming + live-room) in ca-central-1"
  type        = string
  default     = "chatnowzone-webcam-prod"

  validation {
    condition     = length(trimspace(var.webcam_ecs_cluster_name)) > 0
    error_message = "webcam_ecs_cluster_name must be non-empty."
  }
}

variable "webcam_streaming_service_name" {
  description = "ECS service name for the streaming workload"
  type        = string
  default     = "chatnowzone-streaming"

  validation {
    condition     = length(trimspace(var.webcam_streaming_service_name)) > 0
    error_message = "webcam_streaming_service_name must be non-empty."
  }
}

variable "webcam_live_room_service_name" {
  description = "ECS service name for the live-room orchestration workload"
  type        = string
  default     = "chatnowzone-live-room"

  validation {
    condition     = length(trimspace(var.webcam_live_room_service_name)) > 0
    error_message = "webcam_live_room_service_name must be non-empty."
  }
}
