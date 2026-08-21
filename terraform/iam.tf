data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ---- load Lambda (S3 -> RDS) --------------------------------------------

resource "aws_iam_role" "load_lambda" {
  name               = "${var.project_name}-load-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "load_lambda_basic" {
  role       = aws_iam_role.load_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "load_lambda_vpc" {
  role       = aws_iam_role.load_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "load_lambda_inline" {
  statement {
    sid       = "ReadRawCsv"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.raw.arn}/raw/*"]
  }

  statement {
    sid       = "ReadDbSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_db_instance.main.master_user_secret[0].secret_arn]
  }
}

resource "aws_iam_role_policy" "load_lambda_inline" {
  name   = "${var.project_name}-load-lambda-policy"
  role   = aws_iam_role.load_lambda.id
  policy = data.aws_iam_policy_document.load_lambda_inline.json
}

# ---- query Lambda (API Gateway -> RDS, read-only) ------------------------

resource "aws_iam_role" "query_lambda" {
  name               = "${var.project_name}-query-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "query_lambda_basic" {
  role       = aws_iam_role.query_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "query_lambda_vpc" {
  role       = aws_iam_role.query_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "query_lambda_inline" {
  statement {
    sid       = "ReadDbSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_db_instance.main.master_user_secret[0].secret_arn]
  }
}

resource "aws_iam_role_policy" "query_lambda_inline" {
  name   = "${var.project_name}-query-lambda-policy"
  role   = aws_iam_role.query_lambda.id
  policy = data.aws_iam_policy_document.query_lambda_inline.json
}
