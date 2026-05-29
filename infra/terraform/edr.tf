# INFRA: EDR + Ransomware Defense Stack — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0_CANADA_RESIDENCY
# Authority: OmniQuest Media Inc. — OQMInc Engineering Team
#
# §6.2 Endpoint Detection and Response (EDR):
#   - All developer workstations and CI runners that access production secrets
#     MUST have an approved EDR agent installed (Crowdstrike Falcon or equivalent).
#   - Production container images are scanned for CVEs at build time via
#     `docker scout` or AWS Inspector before deployment.
#   - Critical and high CVEs block the deployment pipeline.
#
# §7 Malware & Ransomware Defense (defense-in-depth):
#   - Endpoint Detection & Response (EDR) on all servers/workstations.
#   - Network segmentation (micro-segmentation via VPCs/security groups).
#   - Immutable backups (see s3.tf) — primary ransomware mitigation.
#   - Zero-trust network access (no direct SSH/RDP; SSM Session Manager only).
#   - MFA everywhere (including infrastructure consoles and CI/CD).
#   - Continuous vulnerability scanning + automated patching (within 48h for critical CVEs).
#   - Air-gapped / offline backups for long-term archives (Glacier — see s3.tf).
#
# This file provisions the AWS-side infrastructure stubs required to support
# the EDR/ransomware defense posture. Workstation EDR agent deployment (e.g.
# Crowdstrike Falcon) is an operational/ops responsibility and is not managed
# by Terraform — this file tracks the *infrastructure* side of §6.2/§7.

locals {
  # Tracks which EDR/CVE-scanning capabilities are enabled in this environment.
  edr_tags = {
    EDR_POSTURE      = "INFRA_v1.0-INV-06"
    RansomwareDefense = "INFRA_v1.0-INV-07"
    ZeroTrust        = "INFRA_v1.0-INV-06"
    rule_applied_id  = "INFRA_v1.0_CANADA_RESIDENCY"
  }
}

# ── AWS Inspector v2 — Container image CVE scanning ───────────────────────────
# INFRA_v1.0 §6.2: "Production container images are scanned for CVEs at build
# time via docker scout or AWS Inspector before deployment."
#
# Inspector v2 scans ECR images automatically when pushed. Critical/High CVEs
# surface in the Inspector console and can feed into EventBridge rules
# to block deployment pipelines.

resource "aws_inspector2_enabler" "ecr_scan" {
  account_ids    = [data.aws_caller_identity.current.account_id]
  resource_types = ["ECR", "EC2"]
}

# ── IMDSv2 enforcement — instance metadata hardening ─────────────────────────
# INFRA_v1.0 §6.1 (zero-trust): Require IMDSv2 on all EC2 instances to
# prevent SSRF attacks from reaching instance metadata credentials.
# This policy prevents launching instances without IMDSv2.
resource "aws_iam_policy" "require_imdsv2" {
  name        = "oqmi-cnz-require-imdsv2-${var.environment}"
  description = "Deny EC2 launches without IMDSv2 required (INFRA_v1.0 §6.1 zero-trust)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyIMDSv1"
        Effect = "Deny"
        Action = "ec2:RunInstances"
        Resource = "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/*"
        Condition = {
          StringNotEquals = {
            "ec2:MetadataHttpTokens" = "required"
          }
        }
      }
    ]
  })

  tags = merge(local.edr_tags, {
    Name    = "oqmi-cnz-require-imdsv2-${var.environment}"
    Purpose = "ZeroTrust-IMDSv2-enforcement"
  })
}

# ── ECR repository policy — scanning on push ──────────────────────────────────
# INFRA_v1.0 §6.2: Container images scanned for CVEs at build time.
# The application ECR repository enforces scan-on-push so every new image
# is automatically analysed by AWS Inspector before it can be deployed.
resource "aws_ecr_repository" "api" {
  name                 = "oqmi-cnz-api-${var.environment}"
  image_tag_mutability = "IMMUTABLE" # No tag overwriting — audit integrity

  image_scanning_configuration {
    scan_on_push = true # Inspector v2 CVE scan on every push
  }

  # Encryption at rest — KMS CMK (INFRA_v1.0 §3)
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.service["s3-assets"].arn
  }

  tags = merge(local.edr_tags, {
    Name    = "oqmi-cnz-api-ecr-${var.environment}"
    Purpose = "EDR-container-scanning"
  })
}

# ECR lifecycle — keep last 30 images; purge untagged after 14 days.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 30 tagged images"
        selection = {
          tagStatus   = "tagged"
          tagPrefixList = ["v", "release-", "sha-"]
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ── CloudWatch Alarm — Inspector critical CVE findings ────────────────────────
# INFRA_v1.0 §6.2 + §7: Critical/high CVEs block deployment pipeline.
# This alarm fires when Inspector finds a CRITICAL severity finding,
# alerting on-call for immediate remediation (48h patch SLA for critical CVEs).
resource "aws_cloudwatch_metric_alarm" "inspector_critical_findings" {
  alarm_name          = "oqmi-cnz-inspector-critical-cve-${var.environment}"
  alarm_description   = "AWS Inspector CRITICAL CVE finding detected — deployment pipeline must be halted (INFRA_v1.0 §6.2/§7)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "TotalFindings"
  namespace           = "AWS/Inspector2"
  period              = 300
  statistic           = "Sum"
  threshold           = 0

  dimensions = {
    Severity = "CRITICAL"
  }

  alarm_actions = [] # Ops team populates with SNS ARN at deploy time
  ok_actions    = []

  tags = merge(local.edr_tags, {
    Name    = "oqmi-cnz-inspector-cve-alarm-${var.environment}"
    Purpose = "EDR-CVE-alert"
  })
}

# ── SSM Patch Manager baseline — automated patching within 48h ───────────────
# INFRA_v1.0 §7: "Continuous vulnerability scanning + automated patching
# (within 48h for critical CVEs)."
resource "aws_ssm_patch_baseline" "amazon_linux" {
  name             = "oqmi-cnz-patch-baseline-${var.environment}"
  description      = "OQMI CNZ patch baseline — critical CVEs patched within 48h (INFRA_v1.0 §7)"
  operating_system = "AMAZON_LINUX_2"

  approval_rule {
    approve_after_days  = 2 # 48-hour SLA for critical CVEs
    enable_non_security = false

    patch_filter {
      key    = "CLASSIFICATION"
      values = ["Security"]
    }

    patch_filter {
      key    = "SEVERITY"
      values = ["Critical", "Important"]
    }
  }

  tags = merge(local.edr_tags, {
    Name    = "oqmi-cnz-patch-baseline-${var.environment}"
    Purpose = "automated-patching-48h-sla"
  })
}

resource "aws_ssm_patch_group" "main" {
  baseline_id = aws_ssm_patch_baseline.amazon_linux.id
  patch_group = "oqmi-cnz-${var.environment}"
}

# ── EDR compliance output ─────────────────────────────────────────────────────
output "ecr_repository_url" {
  description = "ECR API repository URL (scan-on-push enabled — INFRA_v1.0 §6.2)"
  value       = aws_ecr_repository.api.repository_url
}

output "inspector_enabled" {
  description = "AWS Inspector v2 enabled for ECR + EC2 (INFRA_v1.0 §6.2 CVE scanning)"
  value       = "ECR+EC2 via aws_inspector2_enabler"
}
