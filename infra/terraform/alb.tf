# INFRA: Application Load Balancer — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0
# §2: ALB is the ONLY public-facing entry point; all traffic terminates TLS at ALB.
# §2: Egress — outbound traffic via NAT Gateway; no public IPs on service instances.

resource "aws_lb" "main" {
  name               = "oqmi-cnz-alb-${var.environment}"
  internal           = false # ALB is public-facing (only public-facing resource)
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # Access logs → S3 WORM bucket for audit trail
  access_logs {
    bucket  = aws_s3_bucket.worm.bucket
    prefix  = "alb-access-logs/${var.environment}"
    enabled = true
  }

  # Drop invalid HTTP headers (security hardening)
  drop_invalid_header_fields = true

  # Deletion protection for production
  enable_deletion_protection = var.environment == "prod" ? true : false

  tags = {
    Name      = "oqmi-cnz-alb-${var.environment}"
    PolicyRef = "INFRA_v1.0"
    Public    = "true" # Only public-facing resource — ALB only
  }
}

# HTTP → HTTPS redirect (all traffic terminates TLS at ALB — INFRA_v1.0 §2)
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener — TLS termination at ALB (INFRA_v1.0 §2)
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # TLS 1.2+ (INFRA_v1.0 §3)
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# Target group — forwards to NestJS containers in private subnet
resource "aws_lb_target_group" "app" {
  name        = "oqmi-cnz-app-tg-${var.environment}"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/healthz"
    protocol            = "HTTP"
    matcher             = "200"
  }

  tags = { Name = "oqmi-cnz-app-tg-${var.environment}" }
}
