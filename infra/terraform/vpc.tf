# INFRA: VPC + Network Isolation — ChatNow.Zone IaC Bootstrap
# rule_applied_id: INFRA_v1.0
# §2 (Network Isolation): All compute, database, and cache resources must
# reside in a private VPC. Postgres (5432) and Redis (6379) NEVER on public
# interface. Only ALB is public-facing. Admin access via SSM Session Manager
# only — no SSH port (22) exposed (zero-trust posture — INFRA_v1.0 §6).

data "aws_availability_zones" "available" {
  state = "available"
}

# ── VPC ───────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "oqmi-cnz-vpc-${var.environment}" }
}

# VPC Flow Logs → CloudWatch (KMS encrypted) — INFRA_v1.0 §5.2
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/oqmi/cnz/${var.environment}/vpc-flow-logs"
  retention_in_days = 365 # 1-year retention for operational logs — INFRA_v1.0 §8
  kms_key_id        = aws_kms_key.service["cloudwatch"].arn
}

resource "aws_flow_log" "main" {
  vpc_id          = aws_vpc.main.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.vpc_flow_log.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn
}

resource "aws_iam_role" "vpc_flow_log" {
  name = "oqmi-cnz-vpc-flow-log-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "vpc_flow_log" {
  name = "oqmi-cnz-vpc-flow-log-policy-${var.environment}"
  role = aws_iam_role.vpc_flow_log.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "*"
    }]
  })
}

# ── Internet Gateway (ALB only) ───────────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "oqmi-cnz-igw-${var.environment}" }
}

# ── Public subnets — ALB only; no application or DB workloads ─────────────────
resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  # No auto-public IPs for instances; only ALB has an EIP
  map_public_ip_on_launch = false

  tags = { Name = "oqmi-cnz-public-${count.index}-${var.environment}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "oqmi-cnz-public-rt-${var.environment}" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── NAT Gateway (one per AZ for HA egress from private subnets) ───────────────
resource "aws_eip" "nat" {
  count  = length(var.public_subnet_cidrs)
  domain = "vpc"
  tags   = { Name = "oqmi-cnz-nat-eip-${count.index}-${var.environment}" }
}

resource "aws_nat_gateway" "main" {
  count         = length(var.public_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = { Name = "oqmi-cnz-nat-${count.index}-${var.environment}" }
}

# ── Private application subnets ───────────────────────────────────────────────
resource "aws_subnet" "private_app" {
  count             = length(var.private_app_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_app_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "oqmi-cnz-private-app-${count.index}-${var.environment}" }
}

resource "aws_route_table" "private_app" {
  count  = length(var.private_app_subnet_cidrs)
  vpc_id = aws_vpc.main.id
  tags   = { Name = "oqmi-cnz-private-app-rt-${count.index}-${var.environment}" }
}

resource "aws_route" "private_app_nat" {
  count                  = length(var.private_app_subnet_cidrs)
  route_table_id         = aws_route_table.private_app[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[count.index].id
}

resource "aws_route_table_association" "private_app" {
  count          = length(var.private_app_subnet_cidrs)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

# ── Private DB subnets — Postgres + Redis; NO NAT route (fully isolated) ──────
# INFRA_v1.0 §5.2: "No NAT Gateway route for Postgres or Redis subnets"
resource "aws_subnet" "private_db" {
  count             = length(var.private_db_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_db_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "oqmi-cnz-private-db-${count.index}-${var.environment}" }
}

resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.main.id
  # No default route — DB subnets have no internet access (fully isolated)
  tags = { Name = "oqmi-cnz-private-db-rt-${var.environment}" }
}

resource "aws_route_table_association" "private_db" {
  count          = length(var.private_db_subnet_cidrs)
  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private_db.id
}

# ── DB Subnet Group (shared by RDS + ElastiCache) ─────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "oqmi-cnz-db-${var.environment}"
  subnet_ids = aws_subnet.private_db[*].id
  tags       = { Name = "oqmi-cnz-db-subnet-group-${var.environment}" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "oqmi-cnz-cache-${var.environment}"
  subnet_ids = aws_subnet.private_db[*].id
  tags       = { Name = "oqmi-cnz-cache-subnet-group-${var.environment}" }
}

# ── Security Groups ───────────────────────────────────────────────────────────
# ALB SG: only 443 inbound from internet. No HTTP (redirect at ALB).
resource "aws_security_group" "alb" {
  name        = "oqmi-cnz-alb-${var.environment}"
  description = "ALB — HTTPS only ingress (INFRA_v1.0 §2)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect (ALB redirects to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All egress to app tier"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = { Name = "oqmi-cnz-alb-sg-${var.environment}" }
}

# App SG: accepts only from ALB. No SSH port (22) — SSM Session Manager only.
# INFRA_v1.0 §2 (zero-trust): "Admin access via SSM Session Manager only;
# no SSH port exposed."
resource "aws_security_group" "app" {
  name        = "oqmi-cnz-app-${var.environment}"
  description = "App tier — inbound from ALB only; SSM-only admin (no SSH — INFRA_v1.0 §6)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "App port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All egress (NAT Gateway routes to internet; DB SG for Postgres/Redis)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # INVARIANT: SSH port 22 is NEVER opened here (INFRA_v1.0 §2, §6 — SSM-only access)

  tags = {
    Name       = "oqmi-cnz-app-sg-${var.environment}"
    SSMOnly    = "true"
    NoSSHPort  = "true"
  }
}

# RDS SG: accepts only from app SG on Postgres port 5432. Never public.
# INFRA_v1.0 §2: "Postgres (port 5432) NEVER exposed on a public interface"
resource "aws_security_group" "rds" {
  name        = "oqmi-cnz-rds-${var.environment}"
  description = "RDS Postgres — inbound from app tier only on 5432 (INFRA_v1.0 §2)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from app tier only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name         = "oqmi-cnz-rds-sg-${var.environment}"
    Port5432     = "private-only"
  }
}

# ElastiCache SG: accepts only from app SG on Redis port 6379. Never public.
# INFRA_v1.0 §2: "Redis (port 6379) NEVER exposed on a public interface"
resource "aws_security_group" "elasticache" {
  name        = "oqmi-cnz-cache-${var.environment}"
  description = "ElastiCache Redis — inbound from app tier only on 6379 (INFRA_v1.0 §2)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from app tier only"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name        = "oqmi-cnz-cache-sg-${var.environment}"
    Port6379    = "private-only"
  }
}

# NATS SG: accepts only from app SG on NATS port 4222. Never public.
# INFRA_v1.0 §9: "NATS (port 4222) — Private subnet only; no public listener"
resource "aws_security_group" "nats" {
  name        = "oqmi-cnz-nats-${var.environment}"
  description = "NATS JetStream — inbound from app tier only on 4222 (INFRA_v1.0 §9)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "NATS from app tier only"
    from_port       = 4222
    to_port         = 4222
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name      = "oqmi-cnz-nats-sg-${var.environment}"
    Port4222  = "private-only"
  }
}

# ── SSM VPC Endpoints (SSM-only admin access — no SSH bastion) ────────────────
# INFRA_v1.0 §2: "Admin access via SSM Session Manager only; no SSH port exposed"
# SSM endpoints allow Systems Manager to reach instances without internet access.
resource "aws_vpc_endpoint" "ssm" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ssm"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private_app[*].id
  security_group_ids  = [aws_security_group.app.id]
  private_dns_enabled = true
  tags                = { Name = "oqmi-cnz-ssm-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "ssmmessages" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ssmmessages"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private_app[*].id
  security_group_ids  = [aws_security_group.app.id]
  private_dns_enabled = true
  tags                = { Name = "oqmi-cnz-ssmmessages-endpoint-${var.environment}" }
}

resource "aws_vpc_endpoint" "ec2messages" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ec2messages"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private_app[*].id
  security_group_ids  = [aws_security_group.app.id]
  private_dns_enabled = true
  tags                = { Name = "oqmi-cnz-ec2messages-endpoint-${var.environment}" }
}
