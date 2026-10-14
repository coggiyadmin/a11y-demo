import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import { corpusContentDigest } from '../corpus-identity.mjs';
import {
  IngestError,
  NOT_PROMOTABLE,
  PROMOTABLE,
  contentDigestAtRevision,
  executedValues,
  recordsForBundle,
} from '../ingest-results.mjs';
import { loadFixtureCases } from '../fixture-families.mjs';
import { loadLedger, loadMaturity } from '../maturity.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const casesById = new Map(loadFixtureCases(ROOT).map((fixture) => [fixture.id, fixture]));

const execution = (overrides = {}) => ({
  case_id: 'patterns-disclosure',
  case_path: 'patterns/disclosure.html',
  status: 'completed',
  declared_state: 'default',
  state_reached: true,
  target_observability: 'observed',
  outcomes: [
    {
      criterion: '2.1.1',
      native_rule_id: 'x',
      verdict: 'fail',
      findings: 1,
      examined_count: 2,
      evidence: [{ type: 'manual-note', note: 'n' }],
    },
  ],
  ...overrides,
});

const resultWith = (executions) => ({
  format: 'cognium-a11y-benchmark-result',
  format_version: '1.0.0',
  corpus: { repository: 'cogniumhq/a11y-benchmark', revision: 'a'.repeat(40), manifest_sha256: `sha256:${'b'.repeat(64)}` },
  run: {
    id: 'r', started_at: '2026-10-13T09:00:00Z', completed_at: '2026-10-13T09:01:00Z', repeat: 1,
    tool: { name: 'Example', version: '1.0.0', engine_family: 'Example', tool_surface: 'CLI', independence: 'independent-engine' },
    environment: { os: 'Linux', runtime: 'Node.js 22' },
    privacy: { fixture_data: 'public-synthetic', raw_evidence_published: false },
  },
  executions,
});

// --- what a run is allowed to prove -----------------------------------------

test('a completed execution promotes the surface it processed', () => {
  const values = executedValues(resultWith([execution()]), casesById);
  assert.ok(values.get('surfaces').has('web'));
  assert.ok(values.get('ui-states').has('default'));
});

test('an execution that did not complete promotes nothing', () => {
  for (const status of ['error', 'blocked', 'unsupported']) {
    const values = executedValues(resultWith([execution({ status, outcomes: [], error: status === 'error' ? { code: 'x', message: 'y' } : undefined })]), casesById);
    for (const dimension of Object.keys(PROMOTABLE)) {
      assert.equal(values.get(dimension).size, 0, `${status} promoted ${dimension}`);
    }
  }
});

test('a state that was declared but not reached does not promote that state', () => {
  // The surface was still processed, so it is promoted; the state was not.
  const values = executedValues(resultWith([execution({ state_reached: false })]), casesById);
  assert.ok(values.get('surfaces').has('web'));
  assert.equal(values.get('ui-states').size, 0);
  assert.equal(values.get('journeys').size, 0);
});

test('an automated run never promotes input modality, method or functional need', () => {
  // The decisive rule: a case tagged sr-nvda, executed by a scanner, is not
  // evidence that a screen-reader pairing was exercised.
  const fixture = casesById.get('patterns-disclosure');
  const values = executedValues(resultWith([execution()]), casesById);

  assert.deepEqual([...values.keys()].sort(), Object.keys(PROMOTABLE).sort());
  for (const dimension of Object.keys(NOT_PROMOTABLE)) {
    assert.equal(values.has(dimension), false, `${dimension} must never be promoted from a result file`);
  }
  // ...even though the fixture itself names them.
  assert.ok(fixture.min_criteria, 'the fixture carries attributes the run did not exercise');
});

test('an execution for a case outside the corpus promotes nothing', () => {
  const values = executedValues(resultWith([execution({ case_id: 'not-a-case' })]), casesById);
  for (const dimension of Object.keys(PROMOTABLE)) assert.equal(values.get(dimension).size, 0);
});

// --- ground-truth resolution ------------------------------------------------

test('the content digest is resolved from the manifest at the declared revision', () => {
  // Read HEAD's manifest independently rather than the working tree: an
  // uncommitted manifest change is normal during development and must not
  // fail a test about git plumbing.
  const committed = execFileSync('git', ['show', 'HEAD:corpus-manifest.json'], {
    cwd: ROOT, encoding: 'utf8',
  });
  const digest = contentDigestAtRevision('HEAD');
  assert.match(digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(digest, corpusContentDigest(JSON.parse(committed)));
});

test('the content digest is revision-sensitive', () => {
  // v0.1.0 held 234 cases; master holds more. If the digest did not move
  // between them it would not be expiring anything.
  const old = contentDigestAtRevision('0105c659d9fe7e85119c190910b2c53985f83374');
  assert.notEqual(old, contentDigestAtRevision('HEAD'));
});

test('an unknown revision fails closed rather than guessing', () => {
  assert.throws(() => contentDigestAtRevision('f'.repeat(40)), IngestError);
  assert.throws(() => contentDigestAtRevision('f'.repeat(40)), /cannot be verified/);
});

// --- records ----------------------------------------------------------------

function bundle(classification = 'maintainer-authored') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-bundle-'));
  fs.mkdirSync(path.join(dir, 'example'));
  fs.writeFileSync(path.join(dir, 'example/result.json'), JSON.stringify(resultWith([execution()])));
  fs.writeFileSync(
    path.join(dir, 'publication.json'),
    JSON.stringify({ id: 'test-bundle', classification, corpus: { revision: 'a'.repeat(40) }, contact: { issues: 'https://example.org/r/issues' } }),
  );
  return dir;
}

test('derived records satisfy the ledger schema', () => {
  const dir = bundle();
  try {
    const records = recordsForBundle({
      bundleDir: dir,
      publication: readJsonAt(path.join(dir, 'publication.json')),
      casesById,
      contentDigest: `sha256:${'c'.repeat(64)}`,
      today: '2026-10-13',
    });
    assert.ok(records.length > 0);

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
    const ledger = readJson('evidence/ledger.json');
    const validate = ajv.compile(readJson('schemas/evidence-ledger.schema.json'));
    assert.equal(validate({ ...ledger, records }), true, JSON.stringify(validate.errors?.slice(0, 2), null, 2));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function readJsonAt(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('a derived record is only ever executed, never verified', () => {
  // A bundle is a run, not a review. `verified` needs a named reviewer and is
  // not derivable from a result file.
  const dir = bundle();
  try {
    const records = recordsForBundle({
      bundleDir: dir, publication: readJsonAt(path.join(dir, 'publication.json')),
      casesById, contentDigest: `sha256:${'c'.repeat(64)}`, today: '2026-10-13',
    });
    for (const record of records) {
      assert.equal(record.state, 'executed');
      assert.equal(record.reviewer, undefined);
      assert.equal(record.runner.kind, 'automated-harness');
      assert.ok(record.artifact.sha256.startsWith('sha256:'));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the publication classification decides reproduction class, not the tool', () => {
  for (const [classification, expected] of [
    ['maintainer-authored', 'maintainer'],
    ['vendor-authored', 'vendor'],
    ['independent', 'independent'],
    ['academic', 'academic'],
  ]) {
    const dir = bundle(classification);
    try {
      const records = recordsForBundle({
        bundleDir: dir, publication: readJsonAt(path.join(dir, 'publication.json')),
        casesById, contentDigest: `sha256:${'c'.repeat(64)}`, today: '2026-10-13',
      });
      assert.ok(records.every((record) => record.reproduction_class === expected));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('an unrecognised classification is refused', () => {
  const dir = bundle('self-certified');
  try {
    assert.throws(
      () => recordsForBundle({
        bundleDir: dir, publication: readJsonAt(path.join(dir, 'publication.json')),
        casesById, contentDigest: `sha256:${'c'.repeat(64)}`, today: '2026-10-13',
      }),
      /unknown publication classification/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('record ids are unique and schema-shaped', () => {
  const ledger = loadLedger(ROOT);
  const ids = ledger.records.map((record) => record.id);
  assert.equal(new Set(ids).size, ids.length, 'ingested records must not collide');
  for (const id of ids) assert.match(id, /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/);
});

// --- the committed ledger ---------------------------------------------------

test('the ingested evidence is attributed to the ground truth it was captured against', () => {
  const ledger = loadLedger(ROOT);
  assert.ok(ledger.records.length > 0);

  const atRevision = new Map();
  for (const record of ledger.records) {
    atRevision.set(record.captured_against.corpus_revision, record.captured_against.corpus_content_digest);
  }
  for (const [revision, digest] of atRevision) {
    assert.equal(digest, contentDigestAtRevision(revision), `${revision} digest does not match the manifest at that revision`);
  }
});

test('ingestion cannot promote a value the corpus does not represent', () => {
  // Trust runs one way: a bundle proves something ran, never that the corpus
  // contains a fixture for it.
  const live = loadMaturity(ROOT);
  for (const dimension of live.dimensions) {
    for (const row of dimension.values) {
      if (row.executed) assert.equal(row.represented, true, `${row.value} executed without being represented`);
    }
  }
});
