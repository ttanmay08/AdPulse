variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short name used as a prefix on all resources"
  type        = string
  default     = "adpulse"
}

variable "db_name" {
  description = "Postgres database name"
  type        = string
  default     = "adpulse"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "adpulse_admin"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "Postgres engine version"
  type        = string
  default     = "16.15"
}

variable "db_allocated_storage" {
  description = "RDS storage in GB"
  type        = number
  default     = 20
}

variable "raw_csv_key" {
  description = "S3 key the load Lambda watches for (prefix/suffix filter)"
  type        = string
  default     = "raw/global_ads_performance_dataset.csv"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the two private subnets (RDS + Lambda ENIs)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "AZs for the private subnets"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}
