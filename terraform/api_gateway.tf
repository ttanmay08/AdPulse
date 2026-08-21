resource "aws_apigatewayv2_api" "query_api" {
  name          = "${var.project_name}-query-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "query_lambda" {
  api_id                 = aws_apigatewayv2_api.query_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.query.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each  = toset(["roas-by-channel", "roas-by-campaign", "underperformers", "rolling-roas", "wow-efficiency"])
  api_id    = aws_apigatewayv2_api.query_api.id
  route_key = "GET /${each.value}"
  target    = "integrations/${aws_apigatewayv2_integration.query_lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.query_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId  = "$context.requestId"
      routeKey   = "$context.routeKey"
      status     = "$context.status"
      errorMessage = "$context.error.message"
      responseLatency = "$context.responseLatency"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-query-api"
  retention_in_days = 7
}

resource "aws_lambda_permission" "allow_apigw_invoke_query" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.query_api.execution_arn}/*/*"
}
