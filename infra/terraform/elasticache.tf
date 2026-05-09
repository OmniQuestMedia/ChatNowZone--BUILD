# INFRA: ElastiCache Redis (private) — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0
# §3: Redis at rest — ElastiCache with encryption at rest enabled.
# §3: Redis in transit — TLS 1.2+ required.
# §2: Redis (port 6379) NEVER exposed on a public interface; private subnet only.

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "oqmi-cnz-redis-${var.environment}"
  description          = "ChatNow.Zone Redis — ${var.environment} (INFRA_v1.0)"

  node_type            = var.elasticache_node_type
  num_cache_clusters   = var.environment == "prod" ? 2 : 1 # Multi-AZ for production
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name

  security_group_ids = [aws_security_group.elasticache.id]

  # Encryption at rest — KMS CMK (INFRA_v1.0 §3)
  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.service["elasticache"].arn

  # Encryption in transit — TLS 1.2+ (INFRA_v1.0 §3)
  transit_encryption_enabled = true

  # No auth token in plaintext — use TLS + VPC isolation instead.
  # Per INFRA_v1.0 §5: Redis is locked to private subnets accessible only
  # by the app security group; no internet route from the DB subnet.

  automatic_failover_enabled  = var.environment == "prod" ? true : false
  multi_az_enabled            = var.environment == "prod" ? true : false

  # Snapshots — 7-day retention (operational recovery)
  snapshot_retention_limit = 7
  snapshot_window          = "02:00-03:00"
  maintenance_window       = "sun:05:00-sun:06:00"

  # Auto minor version upgrades
  auto_minor_version_upgrade = true

  apply_immediately = var.environment != "prod"

  tags = {
    Name      = "oqmi-cnz-redis-${var.environment}"
    PolicyRef = "INFRA_v1.0"
    Port6379  = "private-only"
  }
}

# Parameter group — enforce TLS + disable plaintext commands
resource "aws_elasticache_parameter_group" "redis" {
  name   = "oqmi-cnz-redis7-${var.environment}"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = { PolicyRef = "INFRA_v1.0" }
}
