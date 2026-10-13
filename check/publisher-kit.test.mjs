import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { immutability, parseIssueForm, renderComment, verify, REQUIRED_FIELDS } from './verify-published-result.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// --- the kit ships what a bundle needs --------------------------------------

test('the starter kit contains every file a publishable bundle needs', () => {
  for (const file of [
    'starter/README.md',
    'starter/run.mjs',
    'starter/adapter.example.mjs',
    'starter/benchmark.config.json',
    'starter/method.md',
    'starter/publication.json',
    'starter/native-output/README.md',
    'starter/LICENSE',
    'starter/ci/validate.yml',
    'starter/example-result.repeat-1.json',
    'starter/example-result.repeat-2.json',
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `${file} is missing from the starter kit`);
  }
});

test('the starter config pins everything a reproduction needs', () => {
  const config = readJson('starter/benchmark.config.json');

  assert.equal(config.corpus.repository, 'cogniumhq/a11y-benchmark');
  assert.ok(config.tool.name && config.tool.version, 'product name and version');
  assert.ok(config.tool.engine_family, 'engine family');
  assert.ok(config.tool.tool_surface, 'interface');
  assert.ok(config.tool.independence, 'engine lineage');
  assert.ok(config.environment.os && config.environment.runtime, 'environment');
  assert.ok(config.repeat >= 1, 'repetitions');
  assert.ok(config.cases.ids.length > 1, 'the example must be multi-case');
});

test('the example bundle is multi-case and covers more than one lane', () => {
  const result = readJson('starter/example-result.repeat-1.json');
  assert.ok(result.executions.length >= 5, 'a single-case example would not show the shape');

  const statuses = new Set(result.executions.map((row) => row.status));
  // The example has to demonstrate the honest non-pass states, not just happy paths.
  assert.ok(statuses.has('completed'));
  assert.ok(statuses.has('unsupported'), 'a human-judgement case must be reported unsupported');
  assert.ok(statuses.has('blocked'), 'a multi-page case with no state driver must be blocked');

  const cases = new Set(result.executions.map((row) => row.case_id));
  assert.ok([...cases].some((id) => id.startsWith('guided-')), 'the human lane must appear');
  assert.ok([...cases].some((id) => id.startsWith('pipeline-')), 'the pipeline lane must appear');
});

test('the committed example uses a placeholder corpus identity', () => {
  // Pinning a live digest here would rot: the manifest digest moves whenever a
  // generator stamps a new date.
  for (const repeat of [1, 2]) {
    const result = readJson(`starter/example-result.repeat-${repeat}.json`);
    assert.equal(result.corpus.revision, '0'.repeat(40));
    assert.equal(result.corpus.manifest_sha256, `sha256:${'a'.repeat(64)}`);
    assert.equal(result.run.repeat, repeat);
  }
});

test('the example never reports a human-judgement case as passed', () => {
  for (const repeat of [1, 2]) {
    const result = readJson(`starter/example-result.repeat-${repeat}.json`);
    for (const execution of result.executions) {
      if (!execution.case_id.startsWith('guided-')) continue;
      assert.equal(execution.status, 'unsupported');
      assert.deepEqual(execution.outcomes, []);
    }
  }
});

test('the method note, disclosure and licence say what they must', () => {
  const method = readText('starter/method.md');
  for (const heading of ['Corpus identity', 'Environment', 'State driver', 'Mapping', 'Raw evidence']) {
    assert.ok(method.includes(heading), `method.md is missing ${heading}`);
  }
  assert.match(method, /repetitions/i);

  const disclosure = readText('starter/native-output/README.md');
  assert.match(disclosure, /digest/i, 'the raw-output placeholder must explain the digest policy');
  assert.match(disclosure, /credentials/i, 'it must say what may never be published');
  // The prose wraps, so match across the line break rather than pinning layout.
  assert.match(disclosure, /not\s+independent\s+reproduction/i);

  const licence = readText('starter/LICENSE');
  assert.match(licence, /your published bundle needs its own licence/i);
});

test('the starter CI template runs both validation and the scorer', () => {
  const workflow = readText('starter/ci/validate.yml');
  assert.match(workflow, /validate-result\.mjs/);
  assert.match(workflow, /score\.mjs score/);
  assert.match(workflow, /--strict/, 'a published bundle must fail, not warn, on a corpus-identity mismatch');
  assert.ok(!/ref:\s*(main|master)\s*$/m.test(workflow), 'the corpus must be pinned, not tracked by branch');
});

test('the kit documents classification honestly', () => {
  const readme = readText('starter/README.md');
  for (const value of ['vendor-authored', 'independent', 'academic', 'maintainer-authored']) {
    assert.ok(readme.includes(value), `${value} must be documented`);
  }
  assert.match(readme, /never\s+presented\s+as\s+independent\s+reproduction/i);
  assert.match(readme, /not\*\*\s+certification/i);
  assert.match(readme, /supersedes/i, 'corrections must be documented');
});

// --- the runner -------------------------------------------------------------

test('the runner produces schema-valid results against the live corpus', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-starter-'));
  try {
    const run = spawnSync(
      process.execPath,
      [path.join(ROOT, 'starter/run.mjs'), '--out', path.join(directory, 'result.json')],
      { encoding: 'utf8', cwd: ROOT },
    );
    assert.equal(run.status, 0, run.stderr);

    const files = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort();
    assert.deepEqual(files, ['result.repeat-1.json', 'result.repeat-2.json']);

    for (const file of files) {
      const validated = spawnSync(
        process.execPath,
        [path.join(ROOT, 'check/validate-result.mjs'), path.join(directory, file)],
        { encoding: 'utf8' },
      );
      assert.equal(validated.status, 0, validated.stderr);
    }

    // Corpus identity is read from the checkout, so --strict must pass.
    const scored = spawnSync(
      process.execPath,
      [
        path.join(ROOT, 'check/score.mjs'),
        'score',
        ...files.map((file) => path.join(directory, file)),
        '--strict',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(scored.status, 0, scored.stderr);
    assert.match(scored.stdout, /true-positive recall/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the runner refuses a config naming cases outside the corpus', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-starter-'));
  try {
    const config = readJson('starter/benchmark.config.json');
    config.cases = { ids: ['not-a-real-case'] };
    const configFile = path.join(directory, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify(config));
    // The adapter path is resolved relative to the starter directory, so it
    // still resolves from the scratch config.
    config.adapter = path.join(ROOT, 'starter/adapter.example.mjs');
    fs.writeFileSync(configFile, JSON.stringify(config));

    const run = spawnSync(
      process.execPath,
      [path.join(ROOT, 'starter/run.mjs'), '--out', path.join(directory, 'r.json'), '--config', configFile],
      { encoding: 'utf8', cwd: ROOT },
    );
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /not in the corpus/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

// --- issue verification -----------------------------------------------------

const issue = (overrides = {}) => {
  const fields = {
    'Publisher and relationship': 'Example Labs — independent reproduction',
    'Immutable result bundle URL': 'https://github.com/example/results/tree/' + '0'.repeat(40),
    'Corpus revision': 'a'.repeat(40),
    'Corpus manifest digest': `sha256:${'b'.repeat(64)}`,
    'Product and engine lineage': 'Example product 1.0.0, CLI, Example engine, independent-engine',
    'Method and limitations': 'Two repeats, Chromium 140, no state driver, mapping code published.',
    ...overrides,
  };
  return Object.entries(fields)
    .filter(([, value]) => value !== null)
    .map(([label, value]) => `### ${label}\n\n${value}\n`)
    .join('\n');
};

test('a complete submission with a commit-pinned bundle passes', () => {
  const verdict = verify(issue());
  assert.equal(verdict.ok, true, verdict.problems.join('; '));
  assert.equal(verdict.classification, 'independent');
  assert.equal(verdict.bundle.kind, 'commit-pinned');
});

test('the issue form fields and the verifier agree', () => {
  const form = readText('.github/ISSUE_TEMPLATE/published-result.yml');
  for (const field of REQUIRED_FIELDS) {
    assert.ok(form.includes(field), `the issue form has no field labelled "${field}"`);
  }
});

test('every required field is enforced', () => {
  for (const field of REQUIRED_FIELDS) {
    const verdict = verify(issue({ [field]: null }));
    assert.equal(verdict.ok, false, `${field} was not required`);
    assert.ok(verdict.problems.some((problem) => problem.includes(field)));
  }
});

test('an unanswered field is treated as missing', () => {
  const verdict = verify(issue({ 'Method and limitations': '_No response_' }));
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((problem) => problem.includes('Method and limitations')));
});

test('a short or tagged corpus revision is rejected', () => {
  for (const revision of ['v0.1.0', 'abc1234', 'z'.repeat(40)]) {
    const verdict = verify(issue({ 'Corpus revision': revision }));
    assert.equal(verdict.ok, false, `${revision} was accepted`);
    assert.ok(verdict.problems.some((problem) => problem.includes('40-character')));
  }
});

test('a malformed manifest digest is rejected', () => {
  const verdict = verify(issue({ 'Corpus manifest digest': 'b'.repeat(64) }));
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((problem) => problem.includes('sha256:')));
});

test('a branch URL is not an immutable bundle', () => {
  for (const url of [
    'https://github.com/example/results/tree/main',
    'https://github.com/example/results/tree/master/results',
    'https://github.com/example/results',
  ]) {
    const verdict = verify(issue({ 'Immutable result bundle URL': url }));
    assert.equal(verdict.ok, false, `${url} was accepted as immutable`);
    assert.ok(verdict.problems.some((problem) => problem.includes('not immutable')));
  }
});

test('DOIs, archives and release assets are accepted as immutable', () => {
  const accepted = {
    'https://doi.org/10.5281/zenodo.1234567': 'doi',
    'https://zenodo.org/records/1234567': 'zenodo-record',
    'https://archive.softwareheritage.org/swh:1:dir:abc': 'software-heritage',
    'https://github.com/example/results/releases/download/v1/bundle.zip': 'release-asset',
  };

  for (const [url, kind] of Object.entries(accepted)) {
    const result = immutability(url);
    assert.equal(result.immutable, true, `${url} was rejected`);
    assert.equal(result.kind, kind);
  }
});

test('a tagged archive is accepted but carries the moving-tag caveat', () => {
  const result = immutability('https://github.com/example/results/releases/tag/v1.0.0');
  assert.equal(result.immutable, true);
  assert.match(result.caveat, /tag can be moved/);

  const verdict = verify(issue({ 'Immutable result bundle URL': 'https://github.com/example/results/releases/tag/v1.0.0' }));
  assert.equal(verdict.ok, true);
  assert.ok(verdict.notes.some((note) => note.includes('tag can be moved')));
});

test('a non-https or unparseable URL is rejected', () => {
  assert.equal(immutability('http://example.org/bundle').immutable, false);
  assert.equal(immutability('not a url').immutable, false);
  assert.equal(immutability('https://files.example.org/bundle.zip').immutable, false);
});

test('a publisher who does not state their relationship is rejected', () => {
  const verdict = verify(issue({ 'Publisher and relationship': 'Example Labs' }));
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((problem) => problem.includes('vendor-authored')));
});

test('every classification the index distinguishes is recognised', () => {
  for (const [relationship, expected] of [
    ['Example Inc — vendor-authored', 'vendor'],
    ['Example Labs — independent reproduction', 'independent'],
    ['Example University — academic study', 'academic'],
    ['A community project', 'community'],
    ['The maintainer team', 'maintainer'],
  ]) {
    const verdict = verify(issue({ 'Publisher and relationship': relationship }));
    assert.equal(verdict.classification, expected, `${relationship} classified as ${verdict.classification}`);
  }
});

test('a wrapper that does not name its engine is rejected', () => {
  const verdict = verify(
    issue({ 'Product and engine lineage': 'Example Action 1.0.0, GitHub Action, wrapper of something' }),
  );
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((problem) => problem.includes('wrapper_of')));
});

test('a wrapper that names wrapper_of is accepted', () => {
  const verdict = verify(
    issue({ 'Product and engine lineage': 'Example Action 1.0.0, GitHub Action, wrapper, wrapper_of: axe-core 4.14.0' }),
  );
  assert.equal(verdict.ok, true, verdict.problems.join('; '));
});

test('the comment states the listing boundary either way', () => {
  for (const verdict of [verify(issue()), verify(issue({ 'Corpus revision': 'short' }))]) {
    const comment = renderComment(verdict);
    assert.match(comment, /format and disclosure only/i);
    assert.match(comment, /not certification, endorsement/i);
  }

  assert.match(renderComment(verify(issue())), /Disclosure looks complete/);
  assert.match(renderComment(verify(issue({ 'Corpus revision': 'short' }))), /not listable yet/);
});

test('the issue-form parser reads headings of any depth', () => {
  const fields = parseIssueForm('## A\n\nfirst\n\n### B\n\nsecond\n');
  assert.equal(fields.get('A'), 'first');
  assert.equal(fields.get('B'), 'second');
});

test('the verification CLI exits non-zero on an incomplete submission', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-issue-'));
  try {
    const good = path.join(directory, 'good.md');
    const bad = path.join(directory, 'bad.md');
    fs.writeFileSync(good, issue());
    fs.writeFileSync(bad, issue({ 'Immutable result bundle URL': 'https://github.com/example/results/tree/main' }));

    const cli = path.join(ROOT, 'check/verify-published-result.mjs');
    const ok = spawnSync(process.execPath, [cli, good], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /Disclosure looks complete/);

    const failed = spawnSync(process.execPath, [cli, bad], { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /not immutable/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the published-result workflow comments without write access to the repository', () => {
  const workflow = readText('.github/workflows/published-result.yml');
  assert.match(workflow, /issues:\s*write/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /verify-published-result\.mjs/);
  assert.ok(!/contents:\s*write/.test(workflow), 'verifying an issue never needs repository write access');
});
