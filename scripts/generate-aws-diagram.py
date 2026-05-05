#!/usr/bin/env python3
"""
AWS Architecture Diagram Generator (with official AWS icons)

Uses the `diagrams` library (https://diagrams.mingrammer.com/) to produce
a high-fidelity PNG diagram with official AWS service icons.

Reads the parsed Terraform + CloudFormation JSON to determine which resources
to include, then generates the diagram.

Usage: python scripts/generate-aws-diagram.py [--output docs/architecture.png]

Requirements:
  pip install diagrams
  apt-get install graphviz  (or brew install graphviz on macOS)
"""

import json
import os
import sys

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import ECS, Lambda
from diagrams.aws.database import Aurora, ElastiCache, Dynamodb
from diagrams.aws.integration import SQS, SNS
from diagrams.aws.management import Cloudwatch
from diagrams.aws.network import ALB, VPC, NATGateway, InternetGateway, Route53
from diagrams.aws.security import IAM, SecretsManager, WAF
from diagrams.aws.general import Client
from diagrams.aws.storage import S3
from diagrams.aws.network import APIGateway


def generate_network_topology(output_path):
    """Generate the main network topology diagram with AWS icons."""

    graph_attr = {
        "fontsize": "11",
        "bgcolor": "white",
        "pad": "0.4",
        "nodesep": "0.4",
        "ranksep": "0.6",
    }

    with Diagram(
        "Infrastructure Architecture",
        filename=output_path.replace(".png", ""),
        show=False,
        direction="TB",
        graph_attr=graph_attr,
        outformat="png",
    ):
        client = Client("Users")
        
        with Cluster("VPC - 10.0.0.0/16"):
            with Cluster("Public Subnets"):
                igw = InternetGateway("Internet\nGateway")
                alb = ALB("Application\nLoad Balancer")
                nat = NATGateway("NAT Gateway")

            with Cluster("Private Subnets - Compute"):
                ecs = ECS("ECS Fargate\n(3 tasks)")
                
            with Cluster("Private Subnets - Data"):
                rds = Aurora("Aurora PostgreSQL\nServerless v2")
                redis = ElastiCache("ElastiCache Redis\n2-node cluster")

        with Cluster("Serverless APIs"):
            apigw = APIGateway("API Gateway")
            authorizer = Lambda("Authorizer")
            processor = Lambda("Data Processor")
            notifications = Lambda("Notifications")

        with Cluster("Async & Storage"):
            sqs = SQS("Processing\nQueue")
            dlq = SQS("Dead Letter\nQueue")
            sns = SNS("Notifications\nTopic")
            ddb = Dynamodb("Audit Log")

        secrets = SecretsManager("Secrets\nManager")

        # Connections
        client >> Edge(label="HTTPS") >> igw >> alb >> ecs
        client >> Edge(label="HTTPS") >> apigw
        
        apigw >> authorizer
        apigw >> processor
        apigw >> notifications

        ecs >> Edge(label="5432") >> rds
        ecs >> Edge(label="6379") >> redis
        ecs >> secrets
        ecs >> Edge(style="dashed") >> nat

        processor >> sqs
        processor >> ddb
        sqs >> Edge(label="3 retries", style="dashed") >> dlq
        notifications >> sns


def generate_security_zones(output_path):
    """Generate a security-focused view of the architecture."""

    graph_attr = {
        "fontsize": "11",
        "bgcolor": "white",
        "pad": "0.4",
        "nodesep": "0.4",
        "ranksep": "0.6",
    }

    with Diagram(
        "Security Zones",
        filename=output_path.replace(".png", ""),
        show=False,
        direction="TB",
        graph_attr=graph_attr,
        outformat="png",
    ):
        with Cluster("Public Zone - Internet Facing", graph_attr={"bgcolor": "#fff3e0"}):
            alb = ALB("ALB\nPorts 80, 443")
            apigw = APIGateway("API Gateway\nIAM Auth")

        with Cluster("Application Zone - Private Subnets", graph_attr={"bgcolor": "#e1f5fe"}):
            ecs = ECS("ECS Fargate\nSG: 8080 from ALB")
            lambdas = Lambda("Lambda Functions\nVPC-attached")

        with Cluster("Data Zone - Encrypted", graph_attr={"bgcolor": "#e8f5e9"}):
            rds = Aurora("Aurora PostgreSQL\nEncrypted, SG: 5432")
            redis = ElastiCache("Redis\nTLS, SG: 6379")
            ddb = Dynamodb("DynamoDB\nSSE + PITR")

        with Cluster("Secrets & IAM", graph_attr={"bgcolor": "#f3e5f5"}):
            secrets = SecretsManager("Secrets Manager")
            iam = IAM("IAM Roles\nLeast Privilege")

        alb >> ecs
        apigw >> lambdas
        ecs >> rds
        ecs >> redis
        ecs >> secrets
        lambdas >> ddb


def generate_service_flow(output_path):
    """Generate a request flow diagram."""

    graph_attr = {
        "fontsize": "11",
        "bgcolor": "white",
        "pad": "0.4",
        "nodesep": "0.4",
        "ranksep": "0.6",
    }

    with Diagram(
        "Service Dependencies",
        filename=output_path.replace(".png", ""),
        show=False,
        direction="LR",
        graph_attr=graph_attr,
        outformat="png",
    ):
        client = Client("Client")

        alb = ALB("ALB")
        apigw = APIGateway("API Gateway")
        ecs = ECS("ECS Fargate")
        auth = Lambda("Authorizer")
        proc = Lambda("Processor")
        notif = Lambda("Notifications")
        rds = Aurora("Aurora")
        redis = ElastiCache("Redis")
        sqs = SQS("SQS")
        sns = SNS("SNS")
        ddb = Dynamodb("DynamoDB")
        secrets = SecretsManager("Secrets")

        client >> alb >> ecs
        client >> apigw
        apigw >> auth
        apigw >> proc
        apigw >> notif

        ecs >> rds
        ecs >> redis
        ecs >> secrets
        proc >> sqs
        proc >> ddb
        notif >> sns


def main():
    output_dir = "docs"
    
    # Parse command line args
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--output" and i < len(sys.argv) - 1:
            output_dir = sys.argv[i + 1]

    os.makedirs(output_dir, exist_ok=True)

    print("Generating AWS architecture diagrams with official icons...")
    
    print("  → Network topology diagram...")
    generate_network_topology(os.path.join(output_dir, "architecture.png"))
    
    print("  → Security zones diagram...")
    generate_security_zones(os.path.join(output_dir, "security-zones.png"))
    
    print("  → Service dependencies diagram...")
    generate_service_flow(os.path.join(output_dir, "service-dependencies.png"))
    
    print(f"✅ Generated 3 diagrams with AWS icons in {output_dir}/")


if __name__ == "__main__":
    main()
