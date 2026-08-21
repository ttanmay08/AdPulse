locals {
  lambda_build_dir = "${path.module}/../lambda/build"
  db_env = {
    DB_HOST       = aws_db_instance.main.address
    DB_PORT       = tostring(aws_db_instance.main.port)
    DB_NAME       = var.db_name
    DB_USER       = var.db_username
    DB_SECRET_ARN = aws_db_instance.main.master_user_secret[0].secret_arn
  }
}

# ---- load Lambda: S3 upload -> clean -> RDS ------------------------------

resource "aws_cloudwatch_log_group" "load" {
  name              = "/aws/lambda/${var.project_name}-load"
  retention_in_days = 7
}

resource "aws_lambda_function" "load" {
  function_name = "${var.project_name}-load"
  filename      = "${local.lambda_build_dir}/load_function.zip"
  source_code_hash = filebase64sha256("${local.lambda_build_dir}/load_function.zip")

  role    = aws_iam_role.load_lambda.arn
  handler = "handler.handler"
  runtime = "python3.12"
  timeout = 90
  memory_size = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = local.db_env
  }

  depends_on = [aws_cloudwatch_log_group.load]
}

resource "aws_lambda_permission" "allow_s3_invoke_load" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.load.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.raw.arn
}

# ---- query Lambda: API Gateway -> RDS (read-only) -------------------------

resource "aws_cloudwatch_log_group" "query" {
  name              = "/aws/lambda/${var.project_name}-query"
  retention_in_days = 7
}

resource "aws_lambda_function" "query" {
  function_name = "${var.project_name}-query"
  filename      = "${local.lambda_build_dir}/query_function.zip"
  source_code_hash = filebase64sha256("${local.lambda_build_dir}/query_function.zip")

  role    = aws_iam_role.query_lambda.arn
  handler = "handler.handler"
  runtime = "python3.12"
  timeout = 29 # HTTP API Lambda-proxy integration hard-caps at 30s anyway
  memory_size = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = local.db_env
  }

  depends_on = [aws_cloudwatch_log_group.query]
}
