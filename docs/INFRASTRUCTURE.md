# Infrastructure Architecture

> Auto-generated from Terraform and CloudFormation definitions.
> AI analysis powered by Amazon Bedrock (Claude).
>
> Last generated: 2026-05-05T19:05:40.026Z

## Overview

This infrastructure deploys a **3-tier web application** on AWS:

- **Frontend**: Application Load Balancer with HTTPS termination (TLS 1.3)
- **Application**: ECS Fargate cluster running 3 tasks behind the ALB
- **Data**: Aurora PostgreSQL Serverless v2 (encrypted) + ElastiCache Redis
- **APIs**: API Gateway HTTP API with Lambda backends (authorizer, data processor, notifications)
- **Async**: SQS queue with DLQ for background processing, SNS for notifications
- **Audit**: DynamoDB table with point-in-time recovery for audit logging

The architecture follows AWS Well-Architected principles with multi-AZ deployment, encryption at rest and in transit, and least-privilege IAM roles.

## Risk Assessment

- 🟡 **MEDIUM**: ALB security group allows inbound from 0.0.0.0/0 on port 80 — consider redirecting HTTP to HTTPS and restricting to CloudFront IPs if using a CDN.
- 🟢 **LOW**: ECS task definition uses :latest tag — pin to a specific image digest for reproducible deployments.
- 🟢 **LOW**: RDS deletion_protection is enabled (good), but no automated backup window is explicitly configured.
- 🟢 **INFO**: ElastiCache transit encryption is enabled — ensure application clients support TLS connections.

## Network Topology

```mermaid
graph TD
    Internet((Internet))
    IGW[Internet Gateway]
    ALB[Application Load Balancer<br/>HTTPS :443]
    APIGW[API Gateway<br/>HTTP API]

    subgraph VPC["VPC 10.0.0.0/16"]
        subgraph Public["Public Subnets"]
            ALB
            NAT[NAT Gateway]
        end
        subgraph Private["Private Subnets"]
            ECS["ECS Fargate<br/>3 Tasks"]
            Lambda1["Lambda: Authorizer"]
            Lambda2["Lambda: Data Processor"]
            RDS[("Aurora PostgreSQL<br/>Serverless v2")]
            Redis[("ElastiCache Redis<br/>2-node cluster")]
        end
    end

    SQS[[SQS Queue]]
    SNS[[SNS Topic]]
    DDB[("DynamoDB<br/>Audit Log")]
    SM[Secrets Manager]

    Internet --> IGW --> ALB
    Internet --> APIGW
    ALB --> ECS
    APIGW --> Lambda1
    APIGW --> Lambda2
    ECS --> RDS
    ECS --> Redis
    ECS --> SM
    Lambda2 --> SQS
    Lambda2 --> DDB
    SQS --> SNS
    NAT --> Internet
    ECS -.-> NAT

    style Internet fill:#f5f5f5,stroke:#333
    style VPC fill:#e1f5fe,stroke:#0288d1
    style Public fill:#fff3e0,stroke:#ef6c00
    style Private fill:#e8f5e9,stroke:#2e7d32
    style RDS fill:#fce4ec,stroke:#c62828
    style Redis fill:#fce4ec,stroke:#c62828
    style DDB fill:#fce4ec,stroke:#c62828
```

## Service Dependencies

```mermaid
graph LR
    Client[Client Browser] --> ALB[ALB :443]
    Client --> APIGW[API Gateway]
    ALB --> ECS[ECS Fargate]
    APIGW --> Auth[Lambda Authorizer]
    APIGW --> Proc[Lambda Processor]
    APIGW --> Notif[Lambda Notifications]
    ECS --> Aurora[(Aurora PostgreSQL)]
    ECS --> Redis[(Redis)]
    ECS --> SM[Secrets Manager]
    Proc --> SQS[SQS Queue]
    Proc --> DDB[(DynamoDB)]
    SQS --> DLQ[Dead Letter Queue]
    Notif --> SNS[SNS Topic]

    style Client fill:#f5f5f5,stroke:#333
    style ALB fill:#f3e5f5,stroke:#7b1fa2
    style APIGW fill:#f3e5f5,stroke:#7b1fa2
    style ECS fill:#fff3e0,stroke:#ef6c00
    style Auth fill:#fff3e0,stroke:#ef6c00
    style Proc fill:#fff3e0,stroke:#ef6c00
    style Notif fill:#fff3e0,stroke:#ef6c00
    style Aurora fill:#e8f5e9,stroke:#2e7d32
    style Redis fill:#e8f5e9,stroke:#2e7d32
    style DDB fill:#e8f5e9,stroke:#2e7d32
    style SQS fill:#e1f5fe,stroke:#0288d1
    style DLQ fill:#e1f5fe,stroke:#0288d1
    style SNS fill:#e1f5fe,stroke:#0288d1
```

## Security Zones

```mermaid
graph TB
    subgraph Public_Zone["Public Zone (Internet-facing)"]
        ALB["ALB<br/>SG: 80,443 from 0.0.0.0/0"]
        APIGW["API Gateway<br/>IAM + Lambda Authorizer"]
    end
    subgraph App_Zone["Application Zone (Private)"]
        ECS["ECS Tasks<br/>SG: 8080 from ALB only"]
        Lambda["Lambda Functions<br/>VPC-attached"]
    end
    subgraph Data_Zone["Data Zone (Private, Encrypted)"]
        RDS["Aurora<br/>SG: 5432 from ECS only<br/>Encrypted at rest"]
        Redis["Redis<br/>SG: 6379 from ECS only<br/>TLS in transit"]
        DDB["DynamoDB<br/>SSE enabled<br/>PITR enabled"]
    end
    subgraph Secrets_Zone["Secrets Management"]
        SM["Secrets Manager<br/>DB credentials"]
        IAM["IAM Roles<br/>Least privilege"]
    end

    Public_Zone --> App_Zone --> Data_Zone
    App_Zone --> Secrets_Zone

    style Public_Zone fill:#fff3e0,stroke:#ef6c00
    style App_Zone fill:#e1f5fe,stroke:#0288d1
    style Data_Zone fill:#e8f5e9,stroke:#2e7d32
    style Secrets_Zone fill:#f3e5f5,stroke:#7b1fa2
```

## Resource Inventory

### Terraform Resources

| Category | Resource Type | Name |
|----------|--------------|------|
| networking | `aws_vpc` | main |
| networking | `aws_subnet` | public_a |
| networking | `aws_subnet` | public_b |
| networking | `aws_subnet` | private_a |
| networking | `aws_subnet` | private_b |
| networking | `aws_internet_gateway` | igw |
| networking | `aws_nat_gateway` | nat |
| networking | `aws_eip` | nat |
| security | `aws_security_group` | alb_sg |
| security | `aws_security_group` | ecs_sg |
| security | `aws_security_group` | rds_sg |
| security | `aws_security_group` | redis_sg |
| load_balancing | `aws_lb` | app |
| load_balancing | `aws_lb_target_group` | app |
| load_balancing | `aws_lb_listener` | https |
| compute | `aws_ecs_cluster` | main |
| compute | `aws_ecs_task_definition` | app |
| compute | `aws_ecs_service` | app |
| database | `aws_rds_cluster` | main |
| database | `aws_rds_cluster_instance` | main |
| networking | `aws_db_subnet_group` | main |
| other | `random_password` | db |
| secrets | `aws_secretsmanager_secret` | db_password |
| secrets | `aws_secretsmanager_secret_version` | db_password |
| cache | `aws_elasticache_replication_group` | main |
| networking | `aws_elasticache_subnet_group` | main |
| iam | `aws_iam_role` | ecs_execution |
| iam | `aws_iam_role` | ecs_task |

### CloudFormation Resources

| Category | Resource Type | Logical ID |
|----------|--------------|------------|
| api | `AWS::ApiGatewayV2::Api` | ApiGateway |
| api | `AWS::ApiGatewayV2::Stage` | ApiStage |
| compute | `AWS::Lambda::Function` | AuthorizerFunction |
| compute | `AWS::Lambda::Function` | DataProcessorFunction |
| compute | `AWS::Lambda::Function` | NotificationFunction |
| messaging | `AWS::SQS::Queue` | ProcessingQueue |
| messaging | `AWS::SQS::Queue` | DeadLetterQueue |
| messaging | `AWS::SNS::Topic` | NotificationTopic |
| database | `AWS::DynamoDB::Table` | AuditTable |
| security | `AWS::EC2::SecurityGroup` | LambdaSecurityGroup |
| iam | `AWS::IAM::Role` | LambdaExecutionRole |
| monitoring | `AWS::Logs::LogGroup` | ApiLogGroup |
