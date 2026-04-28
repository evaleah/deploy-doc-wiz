# DeployIQ — AI-Powered Infrastructure Intelligence

A conceptual demo showing two capabilities built on **GitHub Actions + Amazon Bedrock + Wiz**:

1. **Automatic infrastructure diagrams** — Push Terraform/CloudFormation changes → AI generates architecture diagrams and risk assessments
2. **AI deployment troubleshooting** — Deployment fails → AI diagnoses root cause using logs + Wiz security findings → Creates GitHub Issue with remediation plan

## Live Demo

Open `docs/index.html` in a browser to see both scenarios in action with simulated outputs.

## Scenario 1: Infrastructure Diagram Generation

**Trigger:** Push to `main` that changes `infra/` files

**Pipeline:**
```
Git Push → Parse Terraform + CFN → Amazon Bedrock analysis → Generate Mermaid diagrams → Commit to repo
```

**What it produces:**
- Network topology diagram (VPC, subnets, ALB, ECS, RDS, etc.)
- Security zones diagram (public/app/data zone boundaries)
- Service dependency graph
- AI-generated summary and risk assessment
- PR comments with change impact analysis

## Scenario 2: Deployment Failure Troubleshooting

**Trigger:** Deployment workflow fails (or manual trigger)

**Pipeline:**
```
Deploy Fails → Collect ECS/CFN/CloudWatch logs → Fetch Wiz vulns + runtime findings → Bedrock agentic diagnosis → GitHub Issue
```

**What it produces:**
- Root cause analysis correlating logs with Wiz findings
- Step-by-step remediation plan
- Related Wiz vulnerability findings (CVEs, misconfigurations)
- Wiz runtime findings (anomalous network, resource abuse, drift)
- Deployment log excerpts

## Architecture

```
GitHub Actions
├── infra-diagram-gen.yml      # Scenario 1: diagram generation
└── deploy-troubleshoot.yml    # Scenario 2: failure troubleshooting

scripts/
├── parse-terraform.js         # Extract resources from .tf files
├── parse-cloudformation.js    # Extract resources from CFN templates
├── generate-infra-diagrams.js # Produce Mermaid diagrams
├── bedrock-analyze.js         # Bedrock: infrastructure analysis
├── bedrock-troubleshoot.js    # Bedrock: agentic failure diagnosis
├── wiz-fetch-vulnerabilities.js  # Wiz API: vulnerability findings
└── wiz-fetch-runtime.js       # Wiz API: runtime security findings

infra/
├── terraform/main.tf          # Sample: 3-tier app (VPC, ECS, RDS, Redis)
└── cloudformation/api-gateway.yaml  # Sample: API GW + Lambda + SQS + DynamoDB

docs/
├── index.html                 # Interactive demo page
└── INFRASTRUCTURE.md          # Generated architecture diagrams
```

## Key Integration Points

### Amazon Bedrock (Claude)
- **Model:** `anthropic.claude-3-5-sonnet-20241022-v2:0`
- **Scenario 1:** Analyzes IaC resources + git diff → produces summary, risks, annotations
- **Scenario 2:** Agentic loop — AI can request additional context (task definitions, SG rules) until it has enough to diagnose

### Wiz API
- **Vulnerabilities:** GraphQL query for CRITICAL/HIGH CVEs in container images and infrastructure
- **Runtime findings:** Anomalous network activity, resource abuse, sensitive file access, drift detection
- **Correlation:** Bedrock cross-references Wiz findings with deployment errors to identify security-related root causes

### GitHub Actions
- **Diagram workflow:** Triggers on IaC changes, commits diagrams back, posts PR comments
- **Troubleshoot workflow:** Triggers on deployment failure, creates Issues with diagnosis

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `AWS_ROLE_ARN` | IAM role for Bedrock + CloudWatch + ECS access |
| `WIZ_CLIENT_ID` | Wiz service account client ID |
| `WIZ_CLIENT_SECRET` | Wiz service account client secret |
| `WIZ_API_URL` | Wiz API endpoint |
| `WIZ_PROJECT_ID` | Wiz project identifier |

## Making It Real

This is a conceptual demo with simulated API responses. To make it production-ready:

1. **Bedrock:** Uncomment the `BedrockRuntimeClient` calls in `bedrock-analyze.js` and `bedrock-troubleshoot.js`. Add `@aws-sdk/client-bedrock-runtime` as a dependency.
2. **Wiz:** Uncomment the `fetch()` calls in `wiz-fetch-*.js`. The GraphQL queries are production-ready.
3. **Terraform parsing:** Replace regex parsing with `terraform show -json` against real state for accurate resource graphs.
4. **Log collection:** Add `collect-ecs-logs.js`, `collect-cfn-events.js`, `collect-cloudwatch-errors.js` scripts using the AWS SDK.
5. **IAM:** Create a role with permissions for `bedrock:InvokeModel`, `ecs:Describe*`, `logs:GetLogEvents`, `cloudformation:DescribeStackEvents`.
