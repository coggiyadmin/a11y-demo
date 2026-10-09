import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const BINARY = new Set(['.mp3', '.mp4', '.png']);

const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
  .toString().split('\0').filter(Boolean);

const detectors = [
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ['credentialed URL', /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s/:@]+:[^\s@/]+@/g],
  ['absolute home path', /(?:\/Users\/[^/\s]+|\/home\/[^/\s]+|[A-Z]:\\Users\\[^\\\s]+)/g],
];

test('tracked paths exclude common private files', () => {
  const unsafe = files.filter((file) =>
    /(^|\/)(?:\.env(?:\..+)?|id_(?:rsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx|jks|keystore|kdbx|sqlite|sqlite3|db))$/i.test(file)
    && !file.endsWith('.env.example'));
  assert.deepEqual(unsafe, []);
});

test('tracked text contains no high-confidence credential or home-path patterns', () => {
  const findings = [];
  for (const file of files) {
    if (BINARY.has(path.extname(file).toLowerCase())) continue;
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const [name, pattern] of detectors) {
      pattern.lastIndex = 0;
      if (pattern.test(body)) findings.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(findings, []);
});

test('fixture email addresses use reserved example domains', () => {
  const findings = [];
  const email = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
  for (const file of files) {
    if (BINARY.has(path.extname(file).toLowerCase())) continue;
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of body.matchAll(email)) {
      if (!['example.com', 'example.org', 'example.net'].includes(match[1].toLowerCase())) {
        findings.push(`${file}: non-example email domain`);
      }
    }
  }
  assert.deepEqual(findings, []);
});

test('commit authors use privacy-preserving GitHub addresses', () => {
  const emails = execFileSync('git', ['log', '--all', '--format=%ae'], { cwd: ROOT })
    .toString().split(/\r?\n/).filter(Boolean);
  assert.ok(emails.length > 0);
  assert.deepEqual(emails.filter((email) => !email.endsWith('@users.noreply.github.com')), []);
});

