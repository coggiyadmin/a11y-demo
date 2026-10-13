import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const TAG = `v${VERSION}`;
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('release version is synchronized across citation, changelog and notes', () => {
  assert.equal(VERSION, '0.1.0');
  assert.match(read('CITATION.cff'), /^version: 0\.1\.0$/m);
  assert.match(read('CITATION.cff'), /^date-released: 2026-10-13$/m);
  assert.match(read('CHANGELOG.md'), /^## \[0\.1\.0\] - 2026-10-13$/m);
  assert.equal(fs.existsSync(path.join(ROOT, 'releases', `${TAG}.md`)), true);
});

test('release notes disclose scope, gaps and claim boundaries', () => {
  const notes = read(`releases/${TAG}.md`);
  assert.match(notes, /226 public synthetic cases/);
  assert.match(notes, /11 fixture families/);
  assert.match(notes, /Four documented pipeline-integrity cases remain planned/);
  assert.match(notes, /Twenty WCAG criteria without ACT or local ground truth/);
  assert.match(notes, /Seven of eighteen surfaces are represented/);
  assert.match(notes, /not WCAG certification/);
});

test('release workflow requires an annotated version-matched tag', () => {
  const workflow = read('.github/workflows/release.yml');
  assert.match(workflow, /git cat-file -t "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /"v\$\(tr -d '\\n' < VERSION\)"/);
  assert.match(workflow, /node --test check\/\*\.test\.mjs/);
  assert.match(workflow, /gh release create/);
});

test('release builder emits reproducible metadata and valid checksums', () => {
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-benchmark-release-'));
  const output = path.join(scratchRoot, 'assets');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'release.mjs'), output], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    const expectedFiles = [
      'CITATION.cff',
      'LICENSE',
      'SHA256SUMS',
      'THIRD_PARTY_NOTICES.md',
      'benchmark-result.schema.json',
      'corpus-manifest.json',
      'corpus-manifest.schema.json',
      'release-metadata.json',
    ];
    assert.deepEqual(fs.readdirSync(output).sort(), expectedFiles);

    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'release-metadata.json'), 'utf8'));
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(metadata.format, 'cognium-a11y-release-metadata');
    assert.equal(metadata.format_version, '1.0.0');
    assert.equal(metadata.release.version, VERSION);
    assert.equal(metadata.release.tag, TAG);
    assert.equal(metadata.release.revision, head);
    assert.deepEqual(metadata.corpus.counts, { families: 11, cases: 226 });
    assert.equal(metadata.corpus.format_version, '1.0.0');
    assert.equal(metadata.contracts.benchmark_result, '1.0.0');
    assert.equal(metadata.known_gaps.wcag_without_ground_truth, 20);
    assert.deepEqual(metadata.known_gaps.surfaces.represented, 7);
    assert.deepEqual(metadata.known_gaps.surfaces.total, 18);
    assert.deepEqual(metadata.known_gaps.pipeline_cases_planned, [
      'deep_site',
      'entry_not_sampled',
      'vacuous_pass',
      'no_declared_flow',
    ]);
    assert.equal(
      metadata.corpus.manifest_sha256,
      `sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'corpus-manifest.json'))).digest('hex')}`,
    );

    const checksumLines = fs.readFileSync(path.join(output, 'SHA256SUMS'), 'utf8').trim().split('\n');
    assert.equal(checksumLines.length, expectedFiles.length - 1);
    for (const line of checksumLines) {
      const match = line.match(/^([a-f0-9]{64})  ([^/]+)$/);
      assert.ok(match, `invalid checksum line: ${line}`);
      assert.equal(sha256(path.join(output, match[2])), match[1], `${match[2]} checksum mismatch`);
    }
  } finally {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  }
});
