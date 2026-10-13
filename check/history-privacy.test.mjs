import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const BINARY = new Set(['.mp3', '.mp4', '.png']);
const MAX_BUFFER = 256 * 1024 * 1024;

const objectLines = execFileSync('git', ['rev-list', '--objects', '--all'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: MAX_BUFFER,
}).split(/\r?\n/).filter(Boolean);

const objectIds = [];
const pathsByObject = new Map();
for (const line of objectLines) {
  const separator = line.indexOf(' ');
  const objectId = separator === -1 ? line : line.slice(0, separator);
  const objectPath = separator === -1 ? null : line.slice(separator + 1);
  objectIds.push(objectId);
  if (objectPath) {
    const paths = pathsByObject.get(objectId) ?? [];
    paths.push(objectPath);
    pathsByObject.set(objectId, paths);
  }
}

const batch = execFileSync('git', ['cat-file', '--batch'], {
  cwd: ROOT,
  input: `${objectIds.join('\n')}\n`,
  maxBuffer: MAX_BUFFER,
});

const blobs = [];
let cursor = 0;
for (const requestedObject of objectIds) {
  const headerEnd = batch.indexOf(0x0a, cursor);
  assert.notEqual(headerEnd, -1, `missing cat-file header for ${requestedObject}`);
  const header = batch.subarray(cursor, headerEnd).toString('utf8');
  const [objectId, type, sizeText] = header.split(' ');
  const size = Number(sizeText);
  assert.equal(Number.isSafeInteger(size), true, `invalid cat-file size: ${header}`);

  const contentStart = headerEnd + 1;
  const contentEnd = contentStart + size;
  const content = batch.subarray(contentStart, contentEnd);
  assert.equal(batch[contentEnd], 0x0a, `missing cat-file delimiter for ${objectId}`);
  cursor = contentEnd + 1;

  if (type === 'blob') {
    blobs.push({ objectId, paths: pathsByObject.get(objectId) ?? [], content });
  }
}
assert.equal(cursor, batch.length, 'unparsed data remained in git cat-file output');

const detectors = [
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ['credentialed URL', /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s/:@]+:[^\s@/]+@/g],
  ['absolute home path', /(?:\/Users\/[^/\s]+|\/home\/[^/\s]+|[A-Z]:\\Users\\[^\\\s]+)/g],
];

const privatePath = /(^|\/)(?:\.env(?:\..+)?|id_(?:rsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx|jks|keystore|kdbx|sqlite|sqlite3|db))$/i;
const isTextBlob = ({ paths, content }) =>
  !content.includes(0x00)
  && !paths.some((file) => BINARY.has(path.extname(file).toLowerCase()));

test('all reachable historical paths exclude common private files', () => {
  const unsafe = objectLines
    .map((line) => line.slice(line.indexOf(' ') + 1))
    .filter((file) => file && privatePath.test(file) && !file.endsWith('.env.example'));
  assert.deepEqual([...new Set(unsafe)].sort(), []);
});

test('all reachable historical text blobs exclude credentials and home paths', () => {
  const findings = [];
  for (const blob of blobs.filter(isTextBlob)) {
    const body = blob.content.toString('utf8');
    for (const [name, pattern] of detectors) {
      pattern.lastIndex = 0;
      if (pattern.test(body)) {
        findings.push(`${blob.objectId} (${blob.paths.join(', ') || 'unpathed'}): ${name}`);
      }
    }
  }
  assert.deepEqual(findings, []);
});

test('all reachable historical text emails use reserved example domains', () => {
  const findings = [];
  const email = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
  for (const blob of blobs.filter(isTextBlob)) {
    const body = blob.content.toString('utf8');
    for (const match of body.matchAll(email)) {
      if (!['example.com', 'example.org', 'example.net'].includes(match[1].toLowerCase())) {
        findings.push(`${blob.objectId} (${blob.paths.join(', ') || 'unpathed'}): non-example email domain`);
      }
    }
  }
  assert.deepEqual(findings, []);
});
