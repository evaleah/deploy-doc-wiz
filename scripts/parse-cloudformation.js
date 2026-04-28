#!/usr/bin/env node
/**
 * CloudFormation Parser — Extracts resources and relationships from CFN templates.
 *
 * Parses YAML/JSON CloudFormation templates and outputs a normalized resource graph.
 *
 * Usage: node scripts/parse-cloudformation.js <cfn-dir>
 * Output: JSON to stdout
 */

const fs = require('fs');
const path = require('path');

function parseCfnDir(dir) {
  const resources = [];
  const connections = [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    parseCfnTemplate(content, file, resources, connections);
  }

  return { resources, connections, source: 'cloudformation' };
}

function parseCfnTemplate(content, filename, resources, connections) {
  // Normalize line endings
  content = content.replace(/\r\n/g, '\n');

  // Find the Resources section
  const resourceIdx = content.indexOf('\nResources:');
  if (resourceIdx === -1) return;

  // Find the end of Resources (next top-level key or end of file)
  const afterResources = content.substring(resourceIdx + '\nResources:'.length);
  const nextSection = afterResources.search(/\n[A-Z]\w+:/);
  const resourceBlock = nextSection >= 0 ? afterResources.substring(0, nextSection) : afterResources;

  const lines = resourceBlock.split('\n');
  let currentResource = null;

  for (const line of lines) {
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    // Match resource logical ID (2-space indent, starts with uppercase)
    const resourceMatch = line.match(/^  ([A-Z]\w+):\s*$/);
    if (resourceMatch) {
      currentResource = resourceMatch[1];
      continue;
    }

    // Match Type property
    const typeMatch = line.match(/^\s+Type:\s+(.+)$/);
    if (typeMatch && currentResource) {
      const type = typeMatch[1].trim();
      resources.push({
        id: currentResource,
        type: type,
        name: currentResource,
        provider: 'aws',
        category: categorizeCfnResource(type),
        template: filename,
      });
    }

    // Match !Ref references
    const refRe = /!Ref\s+(\w+)/g;
    let refMatch;
    while ((refMatch = refRe.exec(line)) !== null) {
      if (currentResource && refMatch[1] !== currentResource) {
        connections.push({ from: currentResource, to: refMatch[1], type: 'ref' });
      }
    }

    // Match !GetAtt references
    const attRe = /!GetAtt\s+(\w+)\./g;
    let attMatch;
    while ((attMatch = attRe.exec(line)) !== null) {
      if (currentResource && attMatch[1] !== currentResource) {
        connections.push({ from: currentResource, to: attMatch[1], type: 'getatt' });
      }
    }
  }
}

function categorizeCfnResource(type) {
  if (type.includes('Lambda')) return 'compute';
  if (type.includes('ApiGateway')) return 'api';
  if (type.includes('SQS')) return 'messaging';
  if (type.includes('SNS')) return 'messaging';
  if (type.includes('DynamoDB')) return 'database';
  if (type.includes('IAM')) return 'iam';
  if (type.includes('SecurityGroup')) return 'security';
  if (type.includes('Logs')) return 'monitoring';
  return 'other';
}

// --- Main ---
const dir = process.argv[2] || 'infra/cloudformation';
const result = parseCfnDir(dir);
console.log(JSON.stringify(result, null, 2));
