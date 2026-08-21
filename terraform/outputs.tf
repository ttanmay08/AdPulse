output "raw_bucket_name" {
  value = aws_s3_bucket.raw.bucket
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "rds_secret_arn" {
  value = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "api_endpoint" {
  value = aws_apigatewayv2_stage.default.invoke_url
}
