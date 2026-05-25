# INFRA: Webcam service hardening — streaming + live-room
# rule_applied_id: INFRA_v1.0-INV-01
# §2: Production workloads remain in Canadian regions only (ca-central-1 primary).
# §6: Observability hooks for rapid detection and triage.

locals {
  webcam_service_profiles = {
    streaming = {
      service_name             = var.webcam_streaming_service_name
      min_replicas             = 2
      max_replicas             = 20
      cpu_scale_out_threshold  = 65
      memory_scale_out_trigger = 75
    }
    live_room = {
      service_name             = var.webcam_live_room_service_name
      min_replicas             = 2
      max_replicas             = 12
      cpu_scale_out_threshold  = 60
      memory_scale_out_trigger = 70
    }
  }

  webcam_observability_hooks = {
    prometheus_job_name   = "webcam-services"
    grafana_dashboard_uid = "cnz-webcam-core"
  }
}

resource "aws_cloudwatch_metric_alarm" "webcam_cpu_high" {
  for_each = local.webcam_service_profiles

  alarm_name          = "oqmi-cnz-${each.key}-cpu-high-${var.environment}"
  alarm_description   = "Scale-out signal for ${each.key} workload in ${var.aws_region}; min=${each.value.min_replicas}, max=${each.value.max_replicas}"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  period              = 60
  statistic           = "Average"
  threshold           = each.value.cpu_scale_out_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.webcam_ecs_cluster_name
    ServiceName = each.value.service_name
  }

  tags = {
    ServicePlane     = "webcam"
    DataResidency    = "Canada"
    Observability    = "enabled"
    PolicyRef        = "INFRA_v1.0"
    rule_applied_id  = "INFRA_v1.0_CANADA_RESIDENCY"
    target_min_tasks = tostring(each.value.min_replicas)
    target_max_tasks = tostring(each.value.max_replicas)
  }
}

resource "aws_cloudwatch_metric_alarm" "webcam_memory_high" {
  for_each = local.webcam_service_profiles

  alarm_name          = "oqmi-cnz-${each.key}-memory-high-${var.environment}"
  alarm_description   = "Memory pressure signal for ${each.key} workload in ${var.aws_region}"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  period              = 60
  statistic           = "Average"
  threshold           = each.value.memory_scale_out_trigger
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.webcam_ecs_cluster_name
    ServiceName = each.value.service_name
  }

  tags = {
    ServicePlane    = "webcam"
    DataResidency   = "Canada"
    Observability   = "enabled"
    PolicyRef       = "INFRA_v1.0"
    rule_applied_id = "INFRA_v1.0_CANADA_RESIDENCY"
  }
}

resource "aws_ssm_parameter" "webcam_prometheus_hook" {
  name        = "/chatnowzone/${var.environment}/webcam/prometheus/hook"
  description = "Prometheus scrape hook for streaming + live-room services (Canada-only scope)"
  type        = "String"
  overwrite   = true
  value = jsonencode({
    rule_applied_id = "INFRA_v1.0_CANADA_RESIDENCY"
    region          = var.aws_region
    cluster_name    = var.webcam_ecs_cluster_name
    job_name        = local.webcam_observability_hooks.prometheus_job_name
    targets = [
      var.webcam_streaming_service_name,
      var.webcam_live_room_service_name,
    ]
  })

  tags = {
    ServicePlane    = "webcam"
    Observability   = "prometheus"
    DataResidency   = "Canada"
    PolicyRef       = "INFRA_v1.0"
    rule_applied_id = "INFRA_v1.0_CANADA_RESIDENCY"
  }
}

resource "aws_ssm_parameter" "webcam_grafana_hook" {
  name        = "/chatnowzone/${var.environment}/webcam/grafana/hook"
  description = "Grafana dashboard hook for webcam production services"
  type        = "String"
  overwrite   = true
  value = jsonencode({
    rule_applied_id = "INFRA_v1.0_CANADA_RESIDENCY"
    region          = var.aws_region
    dashboard_uid   = local.webcam_observability_hooks.grafana_dashboard_uid
    cluster_name    = var.webcam_ecs_cluster_name
    services = [
      var.webcam_streaming_service_name,
      var.webcam_live_room_service_name,
    ]
  })

  tags = {
    ServicePlane    = "webcam"
    Observability   = "grafana"
    DataResidency   = "Canada"
    PolicyRef       = "INFRA_v1.0"
    rule_applied_id = "INFRA_v1.0_CANADA_RESIDENCY"
  }
}
