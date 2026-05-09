# INFRA: S3 Buckets with Object Lock + KMS — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0
# §3: S3 encryption — SSE-KMS mandatory.
# §3: S3 Object Lock — COMPLIANCE mode, 7-year (2555 days) retention for audit/legal.
#     Minimum 90 days (WORM_RETENTION_DAYS: 90) for all WORM buckets.
# §3: S3 public access — ALL public access blocked.
# §11: Cross-region replication to ca-west-1 (DR — 3-2-1 backup rule).
# §5.2: VPC Flow Logs exported to ca-central-1 S3 WORM bucket.

# ── IAM role for S3 cross-region replication (primary → DR) ──────────────────
resource "aws_iam_role" "s3_replication" {
  name = "oqmi-cnz-s3-replication-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  name = "oqmi-cnz-s3-replication-policy-${var.environment}"
  role = aws_iam_role.s3_replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.worm.arn,
          aws_s3_bucket.audit_exports.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = [
          "${aws_s3_bucket.worm.arn}/*",
          "${aws_s3_bucket.audit_exports.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = [
          "${aws_s3_bucket.worm_dr.arn}/*",
          "${aws_s3_bucket.audit_exports_dr.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.service["s3-worm"].arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Encrypt"
        ]
        Resource = aws_kms_key.dr_s3_worm.arn
      }
    ]
  })
}

# ── WORM bucket — ca-central-1 (primary) ─────────────────────────────────────
# Naming convention: oqmi-cnz-worm-<environment> (INFRA_v1.0 §3.2)
resource "aws_s3_bucket" "worm" {
  bucket = "oqmi-cnz-worm-${var.environment}"

  # S3_OBJECT_LOCK must be enabled at bucket creation (cannot be added later)
  object_lock_enabled = true

  tags = {
    Name            = "oqmi-cnz-worm-${var.environment}"
    PolicyRef       = "INFRA_v1.0"
    S3_OBJECT_LOCK  = "COMPLIANCE"
    # WORM_RETENTION_DAYS declared for ship-gate INFRA-2 check
    WORM_RETENTION_DAYS = tostring(var.worm_retention_days)
    DataClass       = "Audit-Financial-Legal"
    Region          = "ca-central-1"
  }
}

# Block all public access — INFRA_v1.0 §3
resource "aws_s3_bucket_public_access_block" "worm" {
  bucket                  = aws_s3_bucket.worm.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versioning required for Object Lock
resource "aws_s3_bucket_versioning" "worm" {
  bucket = aws_s3_bucket.worm.id
  versioning_configuration { status = "Enabled" }
}

# SSE-KMS encryption (INFRA_v1.0 §3 — SSE-S3 not permitted)
resource "aws_s3_bucket_server_side_encryption_configuration" "worm" {
  bucket = aws_s3_bucket.worm.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.service["s3-worm"].arn
    }
    bucket_key_enabled = true
  }
}

# Object Lock — COMPLIANCE mode, minimum 90 days (WORM_RETENTION_DAYS: 90)
# INFRA_v1.0 §3.2: "COMPLIANCE mode, 7-year retention" for audit/legal.
resource "aws_s3_bucket_object_lock_configuration" "worm" {
  bucket = aws_s3_bucket.worm.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.worm_retention_days # >= 90; policy default is 90
    }
  }
}

# Cross-region replication → ca-west-1 DR bucket (INFRA_v1.0 §11: 3-2-1 rule)
resource "aws_s3_bucket_replication_configuration" "worm" {
  bucket = aws_s3_bucket.worm.id
  role   = aws_iam_role.s3_replication.arn

  rule {
    id     = "replicate-to-ca-west-1-dr"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.worm_dr.arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.dr_s3_worm.arn
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects { status = "Enabled" }
    }
  }

  depends_on = [aws_s3_bucket_versioning.worm]
}

# ── WORM DR bucket — ca-west-1 (passive standby — INFRA_v1.0 §11) ─────────────
resource "aws_s3_bucket" "worm_dr" {
  provider = aws.dr
  bucket   = "oqmi-cnz-worm-dr-${var.environment}"

  object_lock_enabled = true

  tags = {
    Name            = "oqmi-cnz-worm-dr-${var.environment}"
    PolicyRef       = "INFRA_v1.0"
    S3_OBJECT_LOCK  = "COMPLIANCE"
    WORM_RETENTION_DAYS = tostring(var.worm_retention_days)
    Role            = "DisasterRecovery"
    Region          = "ca-west-1"
  }
}

resource "aws_s3_bucket_public_access_block" "worm_dr" {
  provider                = aws.dr
  bucket                  = aws_s3_bucket.worm_dr.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "worm_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.worm_dr.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "worm_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.worm_dr.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.dr_s3_worm.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "worm_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.worm_dr.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.worm_retention_days
    }
  }
}

# ── Audit export bucket — ca-central-1 ───────────────────────────────────────
# ImmutableAuditService exports (AUDIT_EXPORT_ENABLED — INFRA_v1.0 §3.4)
resource "aws_s3_bucket" "audit_exports" {
  bucket = "oqmi-cnz-audit-exports-${var.environment}"

  object_lock_enabled = true

  tags = {
    Name           = "oqmi-cnz-audit-exports-${var.environment}"
    PolicyRef      = "INFRA_v1.0"
    S3_OBJECT_LOCK = "COMPLIANCE"
    DataClass      = "Audit"
  }
}

resource "aws_s3_bucket_public_access_block" "audit_exports" {
  bucket                  = aws_s3_bucket.audit_exports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "audit_exports" {
  bucket = aws_s3_bucket.audit_exports.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_exports" {
  bucket = aws_s3_bucket.audit_exports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.service["s3-worm"].arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_exports" {
  bucket = aws_s3_bucket.audit_exports.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.worm_retention_days
    }
  }
}

# Lifecycle — transition to Glacier after 365 days (7-year financial retention)
resource "aws_s3_bucket_lifecycle_configuration" "audit_exports" {
  bucket = aws_s3_bucket.audit_exports.id

  rule {
    id     = "archive-after-1-year"
    status = "Enabled"

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555 # 7 years — INFRA_v1.0 §8 (7-year minimum for financial/consent logs)
    }
  }
}

# Cross-region replication for audit exports → ca-west-1 (INFRA_v1.0 §11)
resource "aws_s3_bucket_replication_configuration" "audit_exports" {
  bucket = aws_s3_bucket.audit_exports.id
  role   = aws_iam_role.s3_replication.arn

  rule {
    id     = "audit-replicate-to-ca-west-1-dr"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.audit_exports_dr.arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.dr_s3_worm.arn
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects { status = "Enabled" }
    }
  }

  depends_on = [aws_s3_bucket_versioning.audit_exports]
}

# ── Audit exports DR bucket — ca-west-1 ──────────────────────────────────────
resource "aws_s3_bucket" "audit_exports_dr" {
  provider = aws.dr
  bucket   = "oqmi-cnz-audit-exports-dr-${var.environment}"

  object_lock_enabled = true

  tags = {
    Name           = "oqmi-cnz-audit-exports-dr-${var.environment}"
    PolicyRef      = "INFRA_v1.0"
    S3_OBJECT_LOCK = "COMPLIANCE"
    Role           = "DisasterRecovery"
    Region         = "ca-west-1"
  }
}

resource "aws_s3_bucket_public_access_block" "audit_exports_dr" {
  provider                = aws.dr
  bucket                  = aws_s3_bucket.audit_exports_dr.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "audit_exports_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.audit_exports_dr.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_exports_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.audit_exports_dr.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.dr_s3_worm.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_exports_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.audit_exports_dr.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.worm_retention_days
    }
  }
}

# ── Assets bucket — ca-central-1 (media, presigned URLs only) ────────────────
resource "aws_s3_bucket" "assets" {
  bucket = "oqmi-cnz-assets-${var.environment}"

  tags = {
    Name      = "oqmi-cnz-assets-${var.environment}"
    PolicyRef = "INFRA_v1.0"
    DataClass = "Media"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.service["s3-assets"].arn
    }
    bucket_key_enabled = true
  }
}

# Assets lifecycle — expire temp uploads after 7 days
resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    id     = "expire-temp-uploads"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = 7
    }
  }
}
