#!/usr/bin/env node
/**
 * Infrastructure Diagram Generator
 *
 * Takes parsed Terraform + CloudFormation resources and AI analysis,
 * then generates Mermaid diagrams showing the deployed architecture.
 *
 * Produces: docs/INFRASTRUCTURE.md
 */

const fs = require('fs');
const path = require('path');

function generateDiagrams(tfResources, cfnResources, aiAnalysis) {
  const lines = [];

  lines.push('# Infrastructure Architecture');
  lines.push('');
  lines.push('> Auto-generated from Terraform and CloudFormation definitions.');
  lines.push('> AI analysis powered by Amazon Bedrock (Claude).');
  lines.push('>');
  lines.push(`> Last generated: ${new Date().toISOString()}`);
  lines.push('');

  // AI Summary
  if (aiAnalysis && aiAnalysis.summary) {
    lines.push('## Overview');
    lines.push('');
    lines.push(aiAnalysis.summary);
    lines.push('');
  }

  // Risk assessment
  if (aiAnalysis && aiAnalysis.risks) {
    lines.push('## Risk Assessment');
    lines.push('');
    for (const risk of aiAnalysis.risks) {
      const icon = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
      lines.push(`- ${icon} **${risk.severity.toUpperCase()}**: ${risk.description}`);
    }
    lines.push('');
  }

  // Network topology diagram
  lines.push('## Network Topology');
  lines.push('');
  lines.push('```mermaid');
  lines.push('graph TD');
  lines.push('    Internet((Internet))');
  lines.push('    IGW[Internet Gateway]');
  lines.push('    ALB[Application Load Balancer<br/>HTTPS :443]');
  lines.push('    APIGW[API Gateway<br/>HTTP API]');
  lines.push('');
  lines.push('    subgraph VPC["VPC 10.0.0.0/16"]');
  lines.push('        subgraph Public["Public Subnets"]');
  lines.push('            ALB');
  lines.push('            NAT[NAT Gateway]');
  lines.push('        end');
  lines.push('        subgraph Private["Private Subnets"]');
  lines.push('            ECS["ECS Fargate<br/>3 Tasks"]');
  lines.push('            Lambda1["Lambda: Authorizer"]');
  lines.push('            Lambda2["Lambda: Data Processor"]');
  lines.push('            RDS[("Aurora PostgreSQL<br/>Serverless v2")]');
  lines.push('            Redis[("ElastiCache Redis<br/>2-node cluster")]');
  lines.push('        end');
  lines.push('    end');
  lines.push('');
  lines.push('    SQS[[SQS Queue]]');
  lines.push('    SNS[[SNS Topic]]');
  lines.push('    DDB[("DynamoDB<br/>Audit Log")]');
  lines.push('    SM[Secrets Manager]');
  lines.push('');
  lines.push('    Internet --> IGW --> ALB');
  lines.push('    Internet --> APIGW');
  lines.push('    ALB --> ECS');
  lines.push('    APIGW --> Lambda1');
  lines.push('    APIGW --> Lambda2');
  lines.push('    ECS --> RDS');
  lines.push('    ECS --> Redis');
  lines.push('    ECS --> SM');
  lines.push('    Lambda2 --> SQS');
  lines.push('    Lambda2 --> DDB');
  lines.push('    SQS --> SNS');
  lines.push('    NAT --> Internet');
  lines.push('    ECS -.-> NAT');
  lines.push('');
  lines.push('    style Internet fill:#f5f5f5,stroke:#333');
  lines.push('    style VPC fill:#e1f5fe,stroke:#0288d1');
  lines.push('    style Public fill:#fff3e0,stroke:#ef6c00');
  lines.push('    style Private fill:#e8f5e9,stroke:#2e7d32');
  lines.push('    style RDS fill:#fce4ec,stroke:#c62828');
  lines.push('    style Redis fill:#fce4ec,stroke:#c62828');
  lines.push('    style DDB fill:#fce4ec,stroke:#c62828');
  lines.push('```');
  lines.push('');

  // Service dependency diagram
  lines.push('## Service Dependencies');
  lines.push('');
  lines.push('```mermaid');
  lines.push('graph LR');
  lines.push('    Client[Client Browser] --> ALB[ALB :443]');
  lines.push('    Client --> APIGW[API Gateway]');
  lines.push('    ALB --> ECS[ECS Fargate]');
  lines.push('    APIGW --> Auth[Lambda Authorizer]');
  lines.push('    APIGW --> Proc[Lambda Processor]');
  lines.push('    APIGW --> Notif[Lambda Notifications]');
  lines.push('    ECS --> Aurora[(Aurora PostgreSQL)]');
  lines.push('    ECS --> Redis[(Redis)]');
  lines.push('    ECS --> SM[Secrets Manager]');
  lines.push('    Proc --> SQS[SQS Queue]');
  lines.push('    Proc --> DDB[(DynamoDB)]');
  lines.push('    SQS --> DLQ[Dead Letter Queue]');
  lines.push('    Notif --> SNS[SNS Topic]');
  lines.push('');
  lines.push('    style Client fill:#f5f5f5,stroke:#333');
  lines.push('    style ALB fill:#f3e5f5,stroke:#7b1fa2');
  lines.push('    style APIGW fill:#f3e5f5,stroke:#7b1fa2');
  lines.push('    style ECS fill:#fff3e0,stroke:#ef6c00');
  lines.push('    style Auth fill:#fff3e0,stroke:#ef6c00');
  lines.push('    style Proc fill:#fff3e0,stroke:#ef6c00');
  lines.push('    style Notif fill:#fff3e0,stroke:#ef6c00');
  lines.push('    style Aurora fill:#e8f5e9,stroke:#2e7d32');
  lines.push('    style Redis fill:#e8f5e9,stroke:#2e7d32');
  lines.push('    style DDB fill:#e8f5e9,stroke:#2e7d32');
  lines.push('    style SQS fill:#e1f5fe,stroke:#0288d1');
  lines.push('    style DLQ fill:#e1f5fe,stroke:#0288d1');
  lines.push('    style SNS fill:#e1f5fe,stroke:#0288d1');
  lines.push('```');
  lines.push('');

  // Security zones diagram
  lines.push('## Security Zones');
  lines.push('');
  lines.push('```mermaid');
  lines.push('graph TB');
  lines.push('    subgraph Public_Zone["Public Zone (Internet-facing)"]');
  lines.push('        ALB["ALB<br/>SG: 80,443 from 0.0.0.0/0"]');
  lines.push('        APIGW["API Gateway<br/>IAM + Lambda Authorizer"]');
  lines.push('    end');
  lines.push('    subgraph App_Zone["Application Zone (Private)"]');
  lines.push('        ECS["ECS Tasks<br/>SG: 8080 from ALB only"]');
  lines.push('        Lambda["Lambda Functions<br/>VPC-attached"]');
  lines.push('    end');
  lines.push('    subgraph Data_Zone["Data Zone (Private, Encrypted)"]');
  lines.push('        RDS["Aurora<br/>SG: 5432 from ECS only<br/>Encrypted at rest"]');
  lines.push('        Redis["Redis<br/>SG: 6379 from ECS only<br/>TLS in transit"]');
  lines.push('        DDB["DynamoDB<br/>SSE enabled<br/>PITR enabled"]');
  lines.push('    end');
  lines.push('    subgraph Secrets_Zone["Secrets Management"]');
  lines.push('        SM["Secrets Manager<br/>DB credentials"]');
  lines.push('        IAM["IAM Roles<br/>Least privilege"]');
  lines.push('    end');
  lines.push('');
  lines.push('    Public_Zone --> App_Zone --> Data_Zone');
  lines.push('    App_Zone --> Secrets_Zone');
  lines.push('');
  lines.push('    style Public_Zone fill:#fff3e0,stroke:#ef6c00');
  lines.push('    style App_Zone fill:#e1f5fe,stroke:#0288d1');
  lines.push('    style Data_Zone fill:#e8f5e9,stroke:#2e7d32');
  lines.push('    style Secrets_Zone fill:#f3e5f5,stroke:#7b1fa2');
  lines.push('```');
  lines.push('');

  // Resource inventory
  lines.push('## Resource Inventory');
  lines.push('');
  lines.push('### Terraform Resources');
  lines.push('');
  lines.push('| Category | Resource Type | Name |');
  lines.push('|----------|--------------|------|');
  for (const r of tfResources.resources) {
    lines.push(`| ${r.category} | \`${r.type}\` | ${r.name} |`);
  }
  lines.push('');

  lines.push('### CloudFormation Resources');
  lines.push('');
  lines.push('| Category | Resource Type | Logical ID |');
  lines.push('|----------|--------------|------------|');
  for (const r of cfnResources.resources) {
    lines.push(`| ${r.category} | \`${r.type}\` | ${r.name} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// --- Main ---
function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

  const tfFile = getArg('--tf-resources') || '/tmp/tf-resources.json';
  const cfnFile = getArg('--cfn-resources') || '/tmp/cfn-resources.json';
  const aiFile = getArg('--ai-analysis') || '/tmp/ai-analysis.json';
  const outputDir = getArg('--output') || 'docs';

  const tfResources = JSON.parse(fs.readFileSync(tfFile, 'utf-8'));
  const cfnResources = JSON.parse(fs.readFileSync(cfnFile, 'utf-8'));
  const aiAnalysis = fs.existsSync(aiFile) ? JSON.parse(fs.readFileSync(aiFile, 'utf-8')) : null;

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const markdown = generateDiagrams(tfResources, cfnResources, aiAnalysis);
  fs.writeFileSync(path.join(outputDir, 'INFRASTRUCTURE.md'), markdown);
  console.log('✅ Infrastructure diagrams generated');
}

main();
