# INFRA: KMS Customer-Managed Keys — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0
# §3: KMS CMK per service; automatic annual rotation enabled (INFRA_v1.0 §3).
# §7: No production workload outside Canadian AWS regions.
#
# All KMS keys are created in ca-central-1. No cross-region key sharing.

locals {
  kms_services = ["rds", "elasticache", "s3-worm", "s3-assets", "cloudwatch", "secrets"]
}

resource "aws_kms_key" "service" {
  for_each = toset(local.kms_services)

  description             = "OQMI ChatNowZone ${each.key} CMK — ${var.environment} (INFRA_v1.0)"
  deletion_window_in_days = 30
  enable_key_rotation     = true # Annual rotation — INFRA_v1.0 §3

  # Key policy: only the account root and designated IAM roles may use the key.
  # Least-privilege — no wildcard principals (INFRA_v1.0 §6).
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccountManagement"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
          }
        }
      }
    ]
  })

  tags = {
    Service      = each.key
    RotationDays = "365"
    PolicyRef    = "INFRA_v1.0"
  }
}

resource "aws_kms_alias" "service" {
  for_each = toset(local.kms_services)

  name          = "alias/oqmi-cnz-${each.key}-${var.environment}"
  target_key_id = aws_kms_key.service[each.key].key_id
}

# ── DR KMS key — ca-west-1 (for S3 cross-region replication destination) ─────
resource "aws_kms_key" "dr_s3_worm" {
  provider = aws.dr

  description             = "OQMI ChatNowZone S3 WORM DR CMK — ${var.environment} ca-west-1 (INFRA_v1.0)"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccountManagement"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Service      = "s3-worm-dr"
    Region       = "ca-west-1"
    RotationDays = "365"
    PolicyRef    = "INFRA_v1.0"
  }
}

resource "aws_kms_alias" "dr_s3_worm" {
  provider = aws.dr

  name          = "alias/oqmi-cnz-s3-worm-dr-${var.environment}"
  target_key_id = aws_kms_key.dr_s3_worm.key_id
}

data "aws_caller_identity" "current" {}
