#!/usr/bin/env node
/**
 * Terraform Parser — Extracts resources, relationships, and metadata from .tf files.
 *
 * In production, you'd use `terraform show -json` against a real state file.
 * This script does lightweight regex parsing of HCL for the conceptual demo.
 *
 * Usage: node scripts/parse-terraform.js <terraform-dir>
 * Output: JSON to stdout with resources and their connections
 */

const fs = require('fs');
const path = require('path');

function parseTerraformDir(dir) {
  const resources = [];
  const connections = [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tf'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8').replace(/\r\n/g, '\n');
    parseResources(content, resources, connections);
  }

  return { resources, connections, source: 'terraform' };
}

function parseResources(content, resources, connections) {
  // Match resource blocks: resource "aws_type" "name" { ... }
  const resourceRe = /resource\s+"(\w+)"\s+"(\w+)"\s*\{/g;
  let match;

  while ((match = resourceRe.exec(content)) !== null) {
    const type = match[1];
    const name = match[2];
    const id = `${type}.${name}`;

    resources.push({
      id,
      type,
      name,
      provider: type.split('_')[0],
      category: categorizeResource(type),
    });

    // Find references to other resources within this block
    const blockContent = extractBlock(content, match.index + match[0].length);
    const refRe = /(aws_\w+)\.(\w+)\./g;
    let ref;
    while ((ref = refRe.exec(blockContent)) !== null) {
      const targetId = `${ref[1]}.${ref[2]}`;
      if (targetId !== id) {
        connections.push({ from: id, to: targetId, type: 'references' });
      }
    }
  }
}

function extractBlock(content, startIndex) {
  let depth = 1;
  let i = startIndex;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') depth--;
    i++;
  }
  return content.substring(startIndex, i);
}

function categorizeResource(type) {
  if (type.includes('vpc') || type.includes('subnet') || type.includes('gateway') ||
      type.includes('eip') || type.includes('route')) return 'networking';
  if (type.includes('security_group')) return 'security';
  if (type.includes('lb') || type.includes('listener') || type.includes('target_group')) return 'load_balancing';
  if (type.includes('ecs')) return 'compute';
  if (type.includes('rds') || type.includes('db_subnet')) return 'database';
  if (type.includes('elasticache')) return 'cache';
  if (type.includes('iam')) return 'iam';
  if (type.includes('secretsmanager')) return 'secrets';
  return 'other';
}

// --- Main ---
const dir = process.argv[2] || 'infra/terraform';
const result = parseTerraformDir(dir);
console.log(JSON.stringify(result, null, 2));
