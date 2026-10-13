import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import { corpusContentDigest } from '../corpus-identity.mjs';
import {
  DIMENSIONS,
  MATURITY_STATES,
  casesWithInheritedNeeds,
  computeMaturity,
  loadLedger,
  loadMaturity,
  partitionLedger,
} from '../maturity.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

const manifest = readJson('corpus-manifest.json');
const contentDigest = corpusContentDigest(manifest);
const cases = casesWithInheritedNeeds(ROOT);

const score = (records) =>
  computeMaturity({ root: ROOT, cases, ledger: { records }, contentDigest });

const dimensionNamed = (report, name) => report.dimensions.find((row) => row.dimension === name);

/** A minimal well-formed record, so each test states only what it is varying. */
function record(overrides = {}) {
  return {
    id: 'test.record',
    dimension: 'surfaces',
    value: 'web',
    state: 'executed',
    runner: { kind: 'automated-harness', id: 'test-harness', version: '1.0.0' },
    environment: { os: 'Linux', runtime: 'Node.js 22' },
    artifact: { type: 'benchmark-result', sha256: `sha256:${'1'.repeat(64)}` },
    reproduction_class: 'maintainer',
    captured_against: { corpus_content_digest: contentDigest },
    recorded_on: '2026-10-13',
    ...overrides,
  };
}

function validator(schemaFile) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
  ajv.addFormat('date-time', (value) => Number.isFinite(Date.parse(value)));
  return ajv.compile(readJson(schemaFile));
}

// --- schema and committed data ----------------------------------------------

test('the committed evidence ledger satisfies its schema', () => {
  const validate = validator('schemas/evidence-ledger.schema.json');
  const ledger = readJson('evidence/ledger.json');
  assert.equal(validate(ledger), true, JSON.stringify(validate.errors, null, 2));
});

test('the example evidence ledger satisfies its schema', () => {
  const validate = validator('schemas/evidence-ledger.schema.json');
  assert.equal(
    validate(readJson('evidence/examples/ledger.valid.json')),
    true,
    'the worked example must stay valid',
  );
});

test('a verified record without a reviewer is rejected by the schema', () => {
  const validate = validator('schemas/evidence-ledger.schema.json');
  const ledger = readJson('evidence/ledger.json');
  ledger.records = [record({ state: 'verified' })];

  assert.equal(validate(ledger), false, 'a verification must name who confirmed it');
  const missing = (validate.errors ?? [])
    .filter((error) => error.keyword === 'required')
    .map((error) => error.params.missingProperty);
  assert.ok(missing.includes('reviewer'));
});

test('the ledger cannot assert represented or executable directly', () => {
  const validate = validator('schemas/evidence-ledger.schema.json');
  for (const state of ['represented', 'executable']) {
    const ledger = readJson('evidence/ledger.json');
    ledger.records = [record({ state })];
    assert.equal(validate(ledger), false, `${state} is derived from the corpus and must not be assertable`);
  }
});

// --- the core guard ---------------------------------------------------------

test('a represented value is never reported as executed or verified without evidence', () => {
  const report = score([]);

  for (const dimension of report.dimensions) {
    assert.equal(dimension.executed, 0, `${dimension.dimension} claims execution with an empty ledger`);
    assert.equal(dimension.verified, 0, `${dimension.dimension} claims verification with an empty ledger`);
    assert.equal(dimension.independently_verified, 0);

    for (const row of dimension.values) {
      assert.equal(row.executed, false);
      assert.equal(row.verified, false);
      assert.ok(['missing', 'represented', 'executable'].includes(row.state), `unexpected state ${row.state}`);
    }
  }
});

test('the committed corpus currently has no execution evidence at all', () => {
  // This is the honest state the issue asked the reports to stop hiding. If it
  // ever changes, the ledger gained a record and this expectation should be
  // updated deliberately rather than drift.
  const live = loadMaturity(ROOT);
  assert.equal(loadLedger(ROOT).records.length, 0);
  assert.equal(live.evidence_counts.current, 0);
  for (const dimension of live.dimensions) {
    assert.equal(dimension.executed, 0);
    assert.equal(dimension.verified, 0);
  }
});

test('states are strictly nested: nothing is executed without being represented', () => {
  const report = score([record(), record({ id: 'test.second', dimension: 'journeys', value: 'sr-task' })]);

  for (const dimension of report.dimensions) {
    assert.ok(dimension.represented >= dimension.executable, `${dimension.dimension} executable exceeds represented`);
    assert.ok(dimension.executed >= dimension.verified, `${dimension.dimension} verified exceeds executed`);
    assert.ok(dimension.verified >= dimension.independently_verified);
    assert.ok(dimension.represented <= dimension.total);

    for (const row of dimension.values) {
      if (row.executed) assert.equal(row.represented, true, `${row.value} executed without being represented`);
      if (row.verified) assert.equal(row.executed, true, `${row.value} verified without being executed`);
      if (row.independently_verified) assert.equal(row.verified, true);
    }
  }
});

// --- promotion --------------------------------------------------------------

test('a current record promotes a value to executed', () => {
  const report = score([record()]);
  const surfaces = dimensionNamed(report, 'surfaces');
  const web = surfaces.values.find((row) => row.value === 'web');

  assert.equal(web.state, 'executed');
  assert.equal(web.executed, true);
  assert.equal(web.verified, false);
  assert.equal(surfaces.executed, 1);
  assert.equal(surfaces.verified, 0);
  assert.deepEqual(web.evidence.map((entry) => entry.id), ['test.record']);
});

test('verified requires a reviewed record, and independence requires a third party', () => {
  const vendor = score([record({ state: 'verified', reviewer: 'Vendor QA', reproduction_class: 'vendor' })]);
  const vendorWeb = dimensionNamed(vendor, 'surfaces').values.find((row) => row.value === 'web');
  assert.equal(vendorWeb.verified, true);
  assert.equal(vendorWeb.independently_verified, false, 'vendor evidence is not independent reproduction');
  assert.equal(dimensionNamed(vendor, 'surfaces').independently_verified, 0);

  const independent = score([
    record({ state: 'verified', reviewer: 'Third party', reproduction_class: 'independent' }),
  ]);
  const independentWeb = dimensionNamed(independent, 'surfaces').values.find((row) => row.value === 'web');
  assert.equal(independentWeb.independently_verified, true);
});

test('vendor and independent evidence are counted separately in the public report', () => {
  const report = score([
    record({ id: 'test.vendor', reproduction_class: 'vendor' }),
    record({ id: 'test.independent', dimension: 'journeys', value: 'sr-task', reproduction_class: 'independent' }),
  ]);

  assert.equal(report.evidence_counts.vendor_evidence, 1);
  assert.equal(report.evidence_counts.independent_reproduction, 1);
  assert.deepEqual(report.evidence_counts.by_reproduction_class, { vendor: 1, independent: 1 });
});

// --- expiry and supersession ------------------------------------------------

test('evidence captured against different ground truth expires automatically', () => {
  const stale = record({
    state: 'verified',
    reviewer: 'Third party',
    reproduction_class: 'independent',
    captured_against: { corpus_content_digest: `sha256:${'9'.repeat(64)}` },
  });

  const report = score([stale]);
  const web = dimensionNamed(report, 'surfaces').values.find((row) => row.value === 'web');

  assert.equal(web.executed, false, 'expired evidence must not count');
  assert.equal(web.verified, false);
  assert.equal(report.evidence_counts.current, 0);
  assert.equal(report.evidence_counts.stale, 1);
  assert.equal(report.stale_evidence[0].stale_reason, 'captured against different ground truth');
});

test('a superseded record is retired even when the corpus has not changed', () => {
  const report = score([record({ superseded_by: 'test.replacement' })]);
  const web = dimensionNamed(report, 'surfaces').values.find((row) => row.value === 'web');

  assert.equal(web.executed, false);
  assert.equal(report.stale_evidence[0].stale_reason, 'superseded by test.replacement');
});

test('expired evidence stays visible rather than disappearing', () => {
  const report = score([
    record({ id: 'test.expired', captured_against: { corpus_content_digest: `sha256:${'9'.repeat(64)}` } }),
    record({ id: 'test.retired', dimension: 'journeys', value: 'sr-task', superseded_by: 'test.other' }),
  ]);

  assert.equal(report.stale_evidence.length, 2);
  assert.deepEqual(report.stale_evidence.map((row) => row.id).sort(), ['test.expired', 'test.retired']);
  assert.equal(report.evidence_counts.records, 2);
});

test('the content digest ignores a regeneration date but tracks a ground-truth change', () => {
  const sameDay = corpusContentDigest(manifest);
  assert.equal(sameDay, contentDigest);

  const restamped = structuredClone(manifest);
  restamped.generated = '2099-01-01';
  assert.equal(corpusContentDigest(restamped), contentDigest, 'a no-op regeneration must not expire evidence');

  const changed = structuredClone(manifest);
  changed.families[0].content_sha256 = `sha256:${'f'.repeat(64)}`;
  assert.notEqual(corpusContentDigest(changed), contentDigest, 'changed ground truth must expire evidence');

  const reordered = structuredClone(manifest);
  reordered.families.reverse();
  assert.equal(corpusContentDigest(reordered), contentDigest, 'manifest ordering must not change identity');
});

test('partitionLedger separates current from stale without dropping records', () => {
  const records = [record(), record({ id: 'test.b', superseded_by: 'test.c' })];
  const { current, stale } = partitionLedger({ records }, contentDigest);
  assert.equal(current.length + stale.length, records.length);
});

// --- shared vocabulary ------------------------------------------------------

test('every coverage report uses the same maturity vocabulary', () => {
  const spaceCoverage = readJson('space-coverage.json');
  const needsIndex = readJson('needs-index.json');

  assert.deepEqual(spaceCoverage.maturity_states, MATURITY_STATES);
  assert.deepEqual(needsIndex.maturity_states, MATURITY_STATES);

  // Journey, UI-state, input/AT, method, surface and functional-need reports.
  const reported = spaceCoverage.dimensions.map((row) => row.dimension).sort();
  assert.deepEqual(reported, Object.keys(DIMENSIONS).sort());

  for (const dimension of spaceCoverage.dimensions) {
    for (const state of MATURITY_STATES) {
      assert.equal(typeof dimension[state], 'number', `${dimension.dimension} is missing ${state}`);
    }
    assert.equal(typeof dimension.independently_verified, 'number');
  }

  for (const need of needsIndex.needs) {
    assert.ok(MATURITY_STATES.includes(need.maturity) || need.maturity === 'missing');
    assert.equal(typeof need.executed, 'boolean');
    assert.equal(typeof need.independently_verified, 'boolean');
  }
});

test('the generated space coverage agrees with a freshly computed one', () => {
  const committed = readJson('space-coverage.json');
  const live = loadMaturity(ROOT);

  assert.equal(committed.corpus_content_digest, live.contentDigest);
  for (const dimension of live.dimensions) {
    const row = committed.dimensions.find((entry) => entry.dimension === dimension.dimension);
    assert.ok(row, `${dimension.dimension} missing from space-coverage.json`);
    for (const state of MATURITY_STATES) {
      assert.equal(row[state], dimension[state], `${dimension.dimension}.${state} drifted`);
    }
  }
});

test('a value no fixture names stays missing and is listed as a gap', () => {
  const report = score([]);
  const surfaces = dimensionNamed(report, 'surfaces');

  assert.ok(surfaces.missing.includes('ios'));
  const ios = surfaces.values.find((row) => row.value === 'ios');
  assert.equal(ios.state, 'missing');
  assert.equal(ios.represented, false);
  assert.equal(ios.cases, 0);
});

test('evidence for an unrepresented value still cannot make it represented', () => {
  // A ledger entry is evidence that something ran, not evidence that the corpus
  // contains a fixture for it. The two must not be conflatable.
  const report = score([record({ id: 'test.ios', dimension: 'surfaces', value: 'ios' })]);
  const ios = dimensionNamed(report, 'surfaces').values.find((row) => row.value === 'ios');

  assert.equal(ios.represented, false);
  assert.equal(ios.cases, 0);
  assert.ok(dimensionNamed(report, 'surfaces').missing.includes('ios'));
});

test('methods coverable only by a human protocol are executable, not automatable', () => {
  const report = score([]);
  const methods = dimensionNamed(report, 'methods');

  for (const id of ['guided-manual', 'at-testing', 'user-testing']) {
    const row = methods.values.find((entry) => entry.value === id);
    assert.equal(row.executable, true, `${id} has a versioned protocol and is executable by a person`);
    assert.equal(row.executed, false, 'executable is still not executed');
  }

  const notAutomatable = readJson('taxonomy/methods.json').values
    .filter((method) => method.automatable === false)
    .map((method) => method.id);
  assert.deepEqual(notAutomatable.sort(), ['at-testing', 'guided-manual', 'user-testing']);
});

test('awaiting_execution names every executable value with no evidence yet', () => {
  const report = score([record()]);
  const surfaces = dimensionNamed(report, 'surfaces');

  assert.equal(surfaces.awaiting_execution.includes('web'), false, 'web has evidence');
  assert.ok(surfaces.awaiting_execution.length > 0, 'the remaining represented surfaces are still awaiting evidence');
  for (const value of surfaces.awaiting_execution) {
    const row = surfaces.values.find((entry) => entry.value === value);
    assert.equal(row.executable, true);
    assert.equal(row.executed, false);
  }
});
