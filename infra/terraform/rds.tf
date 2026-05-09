# INFRA: RDS Postgres (private) — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0
# §3: Postgres at rest — AWS RDS with storage encryption via KMS CMK.
# §3: Postgres in transit — TLS 1.2+ required; ssl_mode=require enforced.
# §2: Postgres (port 5432) NEVER exposed on a public interface; private subnet only.
# §11: Automated daily snapshots; cross-region copy to ca-west-1; 35-day retention.

resource "aws_db_instance" "postgres" {
  identifier        = "oqmi-cnz-postgres-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.3"
  instance_class    = var.rds_instance_class
  allocated_storage = 100
  storage_type      = "gp3"

  # Encryption at rest — KMS CMK (INFRA_v1.0 §3)
  storage_encrypted = true
  kms_key_id        = aws_kms_key.service["rds"].arn

  db_name  = var.rds_db_name
  username = var.rds_username
  # Password injected from Secrets Manager at apply time; never hardcoded.
  # manage_master_user_password uses RDS-native Secrets Manager integration.
  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.service["secrets"].arn

  # Private subnet — no public access (INFRA_v1.0 §2)
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false # INVARIANT — never expose on public interface

  # TLS enforcement — ssl_mode=require (INFRA_v1.0 §3)
  parameter_group_name = aws_db_parameter_group.postgres.name

  # Backups — 35-day retention (INFRA_v1.0 §11)
  backup_retention_period   = 35
  backup_window             = "03:00-04:00" # 03:00-04:00 UTC (low-traffic window)
  maintenance_window        = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot     = true
  delete_automated_backups  = false
  deletion_protection       = var.environment == "prod" ? true : false
  skip_final_snapshot       = var.environment == "prod" ? false : true
  final_snapshot_identifier = var.environment == "prod" ? "oqmi-cnz-postgres-final-${var.environment}" : null

  # Performance Insights (encrypted)
  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.service["rds"].arn
  performance_insights_retention_period = 7

  # Enhanced monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Multi-AZ for production HA
  multi_az = var.environment == "prod" ? true : false

  tags = {
    Name      = "oqmi-cnz-postgres-${var.environment}"
    FIZZone   = "true"
    PolicyRef = "INFRA_v1.0"
  }
}

# Parameter group — enforce TLS (INFRA_v1.0 §3: ssl_mode=require)
resource "aws_db_parameter_group" "postgres" {
  name   = "oqmi-cnz-postgres16-${var.environment}"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1" # ssl_mode=require — INFRA_v1.0 §3
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  tags = { PolicyRef = "INFRA_v1.0" }
}

# Cross-region snapshot copy to ca-west-1 (DR — INFRA_v1.0 §11)
# "Automated daily snapshots; cross-region copy to ca-west-1; 35-day retention"
resource "aws_db_instance_automated_backups_replication" "postgres_dr" {
  source_db_instance_arn = aws_db_instance.postgres.arn
  provider               = aws.dr
  retention_period       = 35
  kms_key_id             = aws_kms_key.dr_s3_worm.arn
}

# RDS Enhanced Monitoring IAM role
resource "aws_iam_role" "rds_monitoring" {
  name = "oqmi-cnz-rds-monitoring-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
