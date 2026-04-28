#!/usr/bin/env node
/**
 * Amazon Bedrock Integration — Agentic Deployment Troubleshooting
 *
 * Takes deployment failure context (ECS logs, CFN events, CloudWatch errors)
 * plus Wiz security findings, and uses Bedrock (Claude) to produce a
 * structured diagnosis with root cause analysis and remediation steps.
 *
 * The "agentic" aspect: the AI can request additional context in a loop,
 * e.g., "I need the ECS task definition" or "Show me the security group rules",
 * and the script fetches that data and feeds it back until the AI has enough
 * context to produce a diagnosis.
 *
 * Usage: node scripts/bedrock-troubleshoot.js [options]
 */

const fs = require('fs');

async function troubleshoot(context) {
  // --- Build the agentic prompt ---
  const systemPrompt = `You are an expert AWS deployment troubleshooter. You have access to:
1. ECS deployment events and task logs
2. CloudFormation stack events
3. CloudWatch error logs
4. Wiz vulnerability scan results
5. Wiz runtime security findings
6. The infrastructure-as-code definitions

Analyze all available context to determine the root cause of the deployment failure.
Cross-reference Wiz findings with the deployment errors — security issues often cause deployment failures.
Produce a structured diagnosis with actionable remediation steps.

If a Wiz finding is directly related to the deployment failure, highlight it prominently.`;

  // --- In production: agentic loop with Bedrock ---
  /*
  const client = new BedrockRuntimeClient({ region: 'us-east-1' });
  let messages = [{ role: 'user', content: buildInitialPrompt(context) }];
  let diagnosis = null;

  // Agentic loop — AI can request more context
  for (let i = 0; i < 5; i++) {
    const response = await client.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        system: systemPrompt,
        messages
      })
    }));

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const text = result.content[0].text;

    // Check if AI needs more context
    if (text.includes('NEED_MORE_CONTEXT:')) {
      const requested = text.match(/NEED_MORE_CONTEXT:\s*(.+)/)[1];
      const additionalContext = await fetchAdditionalContext(requested);
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `Here is the requested context:\n${additionalContext}` });
      continue;
    }

    diagnosis = JSON.parse(text);
    break;
  }
  return diagnosis;
  */

  // --- Simulated diagnosis for conceptual demo ---
  return {
    deployment_id: 'ecs-deploy-2026-04-28-1423',
    timestamp: new Date().toISOString(),
    severity: 'high',
    short_summary: 'ECS tasks failing health checks — container OOM + Wiz CVE in base image',

    root_cause: `The deployment failure has **two contributing factors**:\n\n` +
      `1. **Primary**: ECS tasks are being killed by OOM (Out of Memory). The task definition ` +
      `allocates 1024 MB but the application's memory usage has grown to ~1.8 GB after the latest ` +
      `code changes added an in-memory caching layer.\n\n` +
      `2. **Contributing**: Wiz detected **CVE-2026-1234** (Critical) in the base Docker image ` +
      `(\`node:20-slim\`). While this CVE doesn't directly cause the OOM, it represents a ` +
      `security risk that should be addressed in the same fix cycle. The Wiz runtime sensor ` +
      `also flagged unusual outbound network connections from the container, which may indicate ` +
      `the vulnerability is being probed.`,

    recommended_fix: `Increase ECS task memory to 2048 MB and update the base Docker image to ` +
      `patch CVE-2026-1234. Consider moving the in-memory cache to ElastiCache Redis (already ` +
      `provisioned in the infrastructure) instead of in-process caching.`,

    remediation_steps: [
      'Update `infra/terraform/main.tf`: Change ECS task definition `memory` from `"1024"` to `"2048"`',
      'Update `Dockerfile`: Change base image from `node:20-slim` to `node:20.12-slim` (patched)',
      'Run `terraform plan` to verify the change only affects the task definition',
      'Deploy with `terraform apply` — ECS will perform a rolling update (no downtime)',
      'Monitor CloudWatch metrics for 30 minutes to confirm memory usage stabilizes',
      'Consider refactoring the in-memory cache to use the existing ElastiCache Redis cluster',
      'Re-run Wiz scan to confirm CVE-2026-1234 is resolved in the new image',
    ],

    wiz_findings: [
      {
        severity: 'critical',
        title: 'CVE-2026-1234: Remote code execution in Node.js HTTP parser',
        resource: 'ECR image: lilly-portal:latest',
        recommendation: 'Update base image to node:20.12-slim or later'
      },
      {
        severity: 'medium',
        title: 'Container running as root user',
        resource: 'ECS Task: lilly-portal-task',
        recommendation: 'Add USER directive to Dockerfile to run as non-root'
      },
      {
        severity: 'low',
        title: 'S3 bucket allows public read access',
        resource: 'S3: lilly-portal-assets',
        recommendation: 'Review bucket policy — may be intentional for static assets'
      }
    ],

    wiz_runtime: [
      {
        type: 'Anomalous Network Activity',
        detail: 'Outbound connection to 198.51.100.42:4444 from container lilly-portal-app',
        risk: 'high',
        action: 'Investigate immediately — may indicate exploitation of CVE-2026-1234'
      },
      {
        type: 'Excessive Resource Usage',
        detail: 'Container memory usage at 95% of limit (973MB / 1024MB)',
        risk: 'high',
        action: 'Increase memory limit or optimize application memory usage'
      },
      {
        type: 'Sensitive File Access',
        detail: 'Process accessed /etc/shadow inside container',
        risk: 'medium',
        action: 'Review container security context — should not need access to shadow file'
      }
    ],

    log_excerpts:
      `[2026-04-28T14:23:15Z] service lilly-portal-service was unable to place a task.\n` +
      `[2026-04-28T14:23:16Z] Reason: Task failed ELB health checks in target-group lilly-portal-tg\n` +
      `[2026-04-28T14:23:18Z] Container killed: OOMKilled (memory limit 1024MB exceeded)\n` +
      `[2026-04-28T14:23:18Z] Exit code: 137 (SIGKILL)\n` +
      `[2026-04-28T14:23:20Z] service lilly-portal-service rolling back to previous task definition\n` +
      `[2026-04-28T14:23:22Z] Rollback complete. Running task count: 3 (previous version)`
  };
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

  const outputFile = getArg('--output') || '/tmp/diagnosis.json';

  // In production, these would be real files from previous workflow steps
  const context = {
    ecsContext: safeReadJson(getArg('--ecs-context')),
    cfnContext: safeReadJson(getArg('--cfn-context')),
    cwErrors: safeReadJson(getArg('--cw-errors')),
    wizVulns: safeReadJson(getArg('--wiz-vulns')),
    wizRuntime: safeReadJson(getArg('--wiz-runtime')),
  };

  const diagnosis = await troubleshoot(context);
  fs.writeFileSync(outputFile, JSON.stringify(diagnosis, null, 2));
  console.log('✅ Diagnosis complete:', outputFile);
}

function safeReadJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

main().catch(console.error);
