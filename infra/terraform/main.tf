provider "aws" {
  region = "eu-west-1"
}

# VPC pour isoler l'infrastructure bancaire
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "djembe-bank-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false # Pour la haute disponibilité
}

# Cluster EKS pour les microservices
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.15.3"

  cluster_name    = "djembe-bank"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    api = {
      min_size     = 2
      max_size     = 10
      desired_size = 3
      instance_types = ["t3.large"]
    }
  }
}

# RDS pour le stockage multi-tenant
resource "aws_db_instance" "main" {
  identifier           = "djembe-bank-db"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.r6g.xlarge"
  allocated_storage     = 500
  storage_encrypted    = true
  db_name              = "djembe_bank"
  username             = "admin"
  password             = var.db_password
  multi_az             = true
  backup_retention_period = 30
}
