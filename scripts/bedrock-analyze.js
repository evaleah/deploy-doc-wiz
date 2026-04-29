#!/usr/bin/env node
/**
 * Amazon Bedrock Integration — AI-Enriched Infrastructure Analysis
 *
 * Sends parsed IaC resources + git diff to Amazon Bedrock (Claude) and gets back:
 *   - A human-readable summary of the infrastructure
 *   - Change impact analysis (for PRs)
 *   - Risk assessment
 *   - Suggested diagram annotations
 *
 * Usage: node scripts/bedrock-analyze.js --tf-resources <file> --cfn-resources <file> [--diff <file>] --output <file>
 *
 * Required env: AWS credentials with bedrock:InvokeModel permission
 * Set USE_SIMULATED=true to skip the real API call and use sample output.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const fs = require('fs');

const REGION = process.env.AWS_REGION || 'us-east-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

async function analyzeWithBedrock(tfResources, cfnResources, diff) {
  const prompt = buildPrompt(tfResources, cfnResources, diff);

  const systemPrompt = `You are an AWS infrastructure analyst. Analyze the provided infrastructure-as-code resources and produce a JSON response with these exact keys:
- "summary": A markdown-formatted overview of the infrastructure (2-3 paragraphs)
- "risks": An array of objects with "severity" (high/medium/low/info) and "description" (string)
- "annotations": An object mapping resource IDs to short description strings
- "change_impact": If a diff is provided, an object with "affected_services" (array), "blast_radius" (low/medium/high), "requires_downtime" (boolean), "recommendation" (string). If no diff, set to null.

Be specific about AWS service interactions and security implications. Return ONLY valid JSON, no markdown fences.`;

  const client = new BedrockRuntimeClient({ region: REGION });

  console.log(`Calling Bedrock (${MODEL_ID}) in ${REGION}...`);
  console.log(`Prompt size: ${prompt.length} characters`);

  const response = await client.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      system: systemPrompt
    })
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  const text = result.content[0].text;

  console.log(`Response tokens: ${result.usage?.output_tokens || 'unknown'}`);

  // Parse the JSON from the response — handle potential markdown fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const analysis = JSON.parse(cleaned);
  analysis.timestamp = new Date().toISOString();
  analysis.model = MODEL_ID;
  analysis.region = REGION;
  return analysis;
}

function getSimulatedResponse(diff) {
  return {
    summary: `This infrastructure deploys a **3-tier web application** on AWS:\n\n` +
      `- **Frontend**: Application Load Balancer with HTTPS termination (TLS 1.3)\n` +
      `- **Application**: ECS Fargate cluster running 3 tasks behind the ALB\n` +
      `- **Data**: Aurora PostgreSQL Serverless v2 (encrypted) + ElastiCache Redis\n` +
      `- **APIs**: API Gateway HTTP API with Lambda backends (authorizer, data processor, notifications)\n` +
      `- **Async**: SQS queue with DLQ for background processing, SNS for notifications\n` +
      `- **Audit**: DynamoDB table with point-in-time recovery for audit logging\n\n` +
      `The architecture follows AWS Well-Architected principles with multi-AZ deployment, ` +
      `encryption at rest and in transit, and least-privilege IAM roles.`,
    risks: [
      { severity: 'medium', description: 'ALB security group allows inbound from 0.0.0.0/0 on port 80 — consider redirecting HTTP to HTTPS and restricting to CloudFront IPs if using a CDN.' },
      { severity: 'low', description: 'ECS task definition uses :latest tag — pin to a specific image digest for reproducible deployments.' },
      { severity: 'low', description: 'RDS deletion_protection is enabled (good), but no automated backup window is explicitly configured.' },
      { severity: 'info', description: 'ElastiCache transit encryption is enabled — ensure application clients support TLS connections.' },
    ],
    annotations: {
      'aws_lb.app': 'Internet-facing ALB, HTTPS only (TLS 1.3)',
      'aws_ecs_service.app': '3 Fargate tasks, private subnets, auto-scaling recommended',
      'aws_rds_cluster.main': 'Aurora Serverless v2, 0.5–8 ACU, encrypted',
      'aws_elasticache_replication_group.main': 'Redis 7.0, 2-node replication, encrypted',
    },
    change_impact: diff ? {
      affected_services: ['ECS', 'RDS'],
      blast_radius: 'medium',
      requires_downtime: false,
      recommendation: 'Deploy during low-traffic window. ECS will perform rolling update.'
    } : null,
    timestamp: new Date().toISOString(),
    model: 'simulated',
    region: 'simulated'
  };
}

function buildPrompt(tfResources, cfnResources, diff) {
  let prompt = `Analyze the following AWS infrastructure defined in Terraform and CloudFormation.\n\n`;

  prompt += `## Terraform Resources (${tfResources.resources.length} resources)\n`;
  prompt += JSON.stringify(tfResources.resources.map(r => ({
    type: r.type, name: r.name, category: r.category
  })), null, 2);

  prompt += `\n\n## Terraform Connections\n`;
  prompt += JSON.stringify(tfResources.connections, null, 2);

  prompt += `\n\n## CloudFormation Resources (${cfnResources.resources.length} resources)\n`;
  prompt += JSON.stringify(cfnResources.resources.map(r => ({
    type: r.type, name: r.name, category: r.category
  })), null, 2);

  prompt += `\n\n## CloudFormation Connections\n`;
  prompt += JSON.stringify(cfnResources.connections, null, 2);

  if (diff) {
    prompt += `\n\n## Infrastructure Changes (Git Diff)\n\`\`\`\n${diff}\n\`\`\``;
    prompt += `\n\nAnalyze the impact of these changes on the running infrastructure.`;
  }

  prompt += `\n\nProvide your analysis as JSON with keys: summary, risks[], annotations{}, change_impact{}`;
  return prompt;
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

  const tfFile = getArg('--tf-resources') || '/tmp/tf-resources.json';
  const cfnFile = getArg('--cfn-resources') || '/tmp/cfn-resources.json';
  const diffFile = getArg('--diff');
  const outputFile = getArg('--output') || '/tmp/ai-analysis.json';
  const useSimulated = process.env.USE_SIMULATED === 'true';

  const tfResources = JSON.parse(fs.readFileSync(tfFile, 'utf-8'));
  const cfnResources = JSON.parse(fs.readFileSync(cfnFile, 'utf-8'));
  const diff = diffFile && fs.existsSync(diffFile) ? fs.readFileSync(diffFile, 'utf-8') : null;

  let analysis;
  if (useSimulated) {
    console.log('Using simulated response (USE_SIMULATED=true)');
    analysis = getSimulatedResponse(diff);
  } else {
    try {
      analysis = await analyzeWithBedrock(tfResources, cfnResources, diff);
    } catch (err) {
      console.error('Bedrock call failed:', err.message);
      console.log('Falling back to simulated response...');
      analysis = getSimulatedResponse(diff);
      analysis.error = err.message;
      analysis.model = 'simulated (fallback)';
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
  console.log(`✅ AI analysis complete: ${outputFile} (model: ${analysis.model})`);
}

main().catch(console.error);
