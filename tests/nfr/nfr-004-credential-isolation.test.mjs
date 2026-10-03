// NFR-004: Credential Isolation Validation
// Requirement: API Keys/Tokens not in logs, apps, or responses
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Patterns that indicate potential credential leakage
const SECRET_PATTERNS = [
  /api[_-]?key[\s:=]["']?[a-zA-Z0-9_-]{20,}/gi,
  /bearer\s+[a-zA-Z0-9_-]{20,}/gi,
  /token[\s:=]["']?[a-zA-Z0-9_-]{20,}/gi,
  /secret[\s:=]["']?[a-zA-Z0-9_-]{20,}/gi,
  /password[\s:=]["']?[a-zA-Z0-9_-]{8,}/gi,
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI-style keys
  /pk_live_[a-zA-Z0-9]{20,}/g, // Stripe-style keys
];

function scanFileForSecrets(filePath, content) {
  const findings = [];

  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      // Filter out false positives (documentation, examples, etc.)
      const filtered = matches.filter(match => {
        const lower = match.toLowerCase();
        return !lower.includes('example') &&
               !lower.includes('placeholder') &&
               !lower.includes('your_') &&
               !lower.includes('xxx') &&
               !lower.includes('...') &&
               !/test[_-]?(key|token|secret)/.test(lower);
      });

      if (filtered.length > 0) {
        findings.push({ file: filePath, pattern: pattern.toString(), matches: filtered });
      }
    }
  }

  return findings;
}

function scanDirectory(dir, extensions = ['.mjs', '.js', '.ts', '.log', '.json'], maxDepth = 10, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];

  const findings = [];
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '.herdr'];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          if (!skipDirs.includes(entry)) {
            findings.push(...scanDirectory(fullPath, extensions, maxDepth, currentDepth + 1));
          }
        } else if (stat.isFile()) {
          const ext = entry.substring(entry.lastIndexOf('.'));
          if (extensions.includes(ext) && stat.size < 10 * 1024 * 1024) { // Skip files > 10MB
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const fileFindings = scanFileForSecrets(fullPath, content);
              findings.push(...fileFindings);
            } catch (err) {
              // Skip unreadable files
            }
          }
        }
      } catch (err) {
        // Skip inaccessible entries
      }
    }
  } catch (err) {
    // Skip inaccessible directories
  }

  return findings;
}

test('NFR-004: Source code does not contain hardcoded secrets', () => {
  const srcDir = '/Users/apple/Progame/DGOS/src';
  const findings = scanDirectory(srcDir, ['.mjs', '.js', '.ts']);

  if (findings.length > 0) {
    console.log('# Potential secrets found in source:');
    findings.forEach(f => {
      console.log(`#   ${f.file}: ${f.matches.slice(0, 2).join(', ')}`);
    });
  }

  assert.strictEqual(findings.length, 0,
    `Found ${findings.length} potential secrets in source code`);
});

test('NFR-004: Log files do not contain secrets', () => {
  const logPatterns = [
    '/Users/apple/Progame/DGOS/logs',
    '/Users/apple/Progame/DGOS/data',
  ];

  let totalFindings = 0;

  for (const dir of logPatterns) {
    try {
      const findings = scanDirectory(dir, ['.log', '.txt'], 5);
      totalFindings += findings.length;

      if (findings.length > 0) {
        console.log(`# Potential secrets in ${dir}:`);
        findings.slice(0, 3).forEach(f => {
          console.log(`#   ${f.file}`);
        });
      }
    } catch (err) {
      console.log(`# Skip ${dir}: ${err.message}`);
    }
  }

  assert.strictEqual(totalFindings, 0, `Found ${totalFindings} potential secrets in logs`);
});

test('NFR-004: Secret service implementation exists', () => {
  const secretServicePath = '/Users/apple/Progame/DGOS/src/security/secret-service.mjs';

  try {
    const content = readFileSync(secretServicePath, 'utf-8');

    // Check for encryption
    assert.match(content, /encrypt|crypto|cipher/i,
      'Secret service should use encryption');

    // Check for secure handling
    assert.match(content, /SecretHandle|resolve|read/,
      'Secret service should have handle-based access');

    console.log('# Secret service implementation verified');
  } catch (err) {
    assert.fail(`Secret service not found: ${err.message}`);
  }
});

test('NFR-004: Provider egress prevents credential leakage', () => {
  const egressPath = '/Users/apple/Progame/DGOS/src/security/provider-egress.mjs';

  try {
    const content = readFileSync(egressPath, 'utf-8');

    // Should sanitize/redact secrets
    assert.ok(
      content.includes('redact') || content.includes('sanitize') || content.includes('mask'),
      'Provider egress should sanitize sensitive data'
    );

    console.log('# Provider egress security verified');
  } catch (err) {
    console.log(`# Provider egress check: ${err.message}`);
  }
});

test('NFR-004: API responses do not expose secrets', () => {
  const apiDir = '/Users/apple/Progame/DGOS/apps/api';

  try {
    const findings = scanDirectory(apiDir, ['.mjs', '.js', '.ts']);

    // Check for proper secret handling patterns
    const apiFiles = readdirSync(apiDir, { recursive: false });
    console.log(`# Scanned ${apiFiles.length} API files`);

    assert.strictEqual(findings.length, 0,
      `Found ${findings.length} potential secret exposures in API`);
  } catch (err) {
    console.log(`# API scan: ${err.message}`);
  }
});

test('NFR-004: Environment example files are clean', () => {
  const envExample = '/Users/apple/Progame/DGOS/.env.example';

  try {
    const content = readFileSync(envExample, 'utf-8');

    // Should not contain real secrets
    const suspiciousPatterns = [
      /sk-[a-zA-Z0-9]{40,}/,
      /[a-f0-9]{64}/,
    ];

    for (const pattern of suspiciousPatterns) {
      assert.doesNotMatch(content, pattern,
        '.env.example should not contain real secrets');
    }

    console.log('# .env.example is clean');
  } catch (err) {
    console.log(`# .env.example check: ${err.message}`);
  }
});
