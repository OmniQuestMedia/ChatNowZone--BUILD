# INFRA: Phase 1 — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0
# Authority: OmniQuest Media Inc. — OQMInc Engineering Team
#
# Canada-only data residency (PIPEDA invariant — INFRA_v1.0-INV-01).
# Primary region: ca-central-1 (Montreal).
# DR region:      ca-west-1  (Calgary) — passive standby only.
# No production workload may execute outside Canadian AWS regions.

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  # Remote state in the WORM S3 bucket (bootstrapped separately by ops).
  # Uncomment after the state bucket has been provisioned.
  # backend "s3" {
  #   bucket         = "oqmi-cnz-tfstate-prod"
  #   key            = "chatnowzone/prod/terraform.tfstate"
  #   region         = "ca-central-1"
  #   encrypt        = true
  #   kms_key_id     = "alias/oqmi-cnz-tfstate-cmk"
  #   dynamodb_table = "oqmi-cnz-tfstate-lock"
  # }
}

# ── Primary provider — ca-central-1 (Montreal) ────────────────────────────────
provider "aws" {
  region = var.aws_region # must resolve to ca-central-1

  default_tags {
    tags = {
      Project         = "ChatNowZone"
      Environment     = var.environment
      ManagedBy       = "Terraform"
      DataResidency   = "Canada"
      PolicyRef       = "INFRA_v1.0"
      ComplianceOwner = "OmniQuestMediaInc"
      # Mandatory residency tag — INFRA_v1.0 §1 (Canada-only invariant INFRA_v1.0-INV-01)
      rule_applied_id = "INFRA_v1.0_CANADA_RESIDENCY"
    }
  }
}

# ── DR provider — ca-west-1 (Calgary) — passive standby only ─────────────────
provider "aws" {
  alias  = "dr"
  region = var.dr_region # must resolve to ca-west-1

  default_tags {
    tags = {
      Project         = "ChatNowZone"
      Environment     = "${var.environment}-dr"
      ManagedBy       = "Terraform"
      DataResidency   = "Canada"
      PolicyRef       = "INFRA_v1.0"
      Role            = "DisasterRecovery"
      # Mandatory residency tag — INFRA_v1.0 §1
      rule_applied_id = "INFRA_v1.0_CANADA_RESIDENCY"
    }
  }
}
