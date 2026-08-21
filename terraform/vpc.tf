# Minimal VPC: two private subnets only. No NAT gateway, no internet gateway —
# the load Lambda reaches S3 through a free VPC gateway endpoint, and both
# Lambdas reach RDS over the VPC's local route. Nothing in this stack needs
# outbound internet access, so there's nothing to pay a NAT gateway for.

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${var.project_name}-private-${count.index}" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = { Name = "${var.project_name}-s3-endpoint" }
}

# Both Lambdas fetch the RDS master password from Secrets Manager at cold
# start. Secrets Manager's API is a public endpoint, and this VPC has no NAT/
# internet gateway (by design — nothing else needs one), so without this
# interface endpoint that call has no route out and hangs until the Lambda
# times out.
resource "aws_security_group" "secretsmanager_endpoint" {
  name        = "${var.project_name}-secretsmanager-endpoint-sg"
  description = "Allow HTTPS from Lambdas to the Secrets Manager interface endpoint"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTPS from Lambdas"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-secretsmanager-endpoint-sg" }
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.secretsmanager_endpoint.id]
  private_dns_enabled = true

  tags = { Name = "${var.project_name}-secretsmanager-endpoint" }
}

resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-sg"
  description = "Lambda ENIs: outbound to RDS and the S3 gateway endpoint"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "All outbound (RDS 5432 + S3 endpoint 443)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-lambda-sg" }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "RDS Postgres: inbound 5432 from the Lambda SG only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from Lambdas"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-rds-sg" }
}
