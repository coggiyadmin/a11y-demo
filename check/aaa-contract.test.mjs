import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const classification = readJson('wcag/aaa-classification.json');
const aaa = readJson('aaa.json');
const guided = readJson('guided.json');
const coverage = readJson('coverage.json');
const wcag = readJson('wcag/criteria.json').criteria;

const LANES = ['automated-static', 'stateful-interaction', 'guided-manual'];

// The twenty criteria this work was about: every live WCAG 2.2 AAA criterion
// that had neither ACT cases nor a local fixture when the issue was filed.
const CLASSIFIED = classification.criteria;

test('every classified criterion is a live WCAG 2.2 AAA criterion', () => {
  assert.equal(CLASSIFIED.length, 20);

  const live = new Map(wcag.filter((row) => row.in_2_2).map((row) => [row.num, row]));
  for (const entry of CLASSIFIED) {
    const criterion = live.get(entry.sc);
    assert.ok(criterion, `${entry.sc} is not a live WCAG 2.2 criterion`);
    assert.equal(criterion.level, 'AAA', `${entry.sc} is not AAA`);
    assert.equal(entry.level, 'AAA');
  }

  const ids = CLASSIFIED.map((entry) => entry.sc);
  assert.equal(new Set(ids).size, ids.length, 'a criterion is classified twice');
});

test('every criterion has a reviewed lane, a public source and a rationale', () => {
  for (const entry of CLASSIFIED) {
    assert.ok(LANES.includes(entry.lane), `${entry.sc} has an unknown lane: ${entry.lane}`);
    assert.match(
      entry.source,
      /^https:\/\/www\.w3\.org\/WAI\/WCAG22\/Understanding\/[a-z0-9-]+\.html$/,
      `${entry.sc} has no public W3C source`,
    );
    assert.ok(entry.rationale && entry.rationale.length > 60, `${entry.sc} has no substantive rationale`);
  }
});

test('no AAA criterion is left without ground truth', () => {
  // The state this work existed to change: 20 criteria reporting NONE.
  const without = coverage.filter((row) => row.ground_truth === 'NONE');
  assert.deepEqual(without, [], 'a criterion still has no ground truth of any kind');

  const byCriterion = new Map(coverage.map((row) => [row.sc, row]));
  for (const entry of CLASSIFIED) {
    const row = byCriterion.get(entry.sc);
    assert.ok(row, `${entry.sc} missing from the coverage report`);
    assert.notEqual(row.ground_truth, 'NONE', `${entry.sc} still reports NONE`);
  }
});

test('coverage distinguishes manual-only from not-yet-built', () => {
  // Conflating these two was the reporting defect. A guided check is coverage
  // of a different kind, not an absence.
  const manualOnly = coverage.filter((row) => row.ground_truth === 'manual only');
  assert.ok(manualOnly.length > 0, 'the manual-only category must be reachable');

  for (const row of manualOnly) {
    assert.ok(row.guided.length > 0, `${row.sc} is manual-only but names no guided fixture`);
    assert.equal(row.local_tp, '', `${row.sc} is manual-only but has an automated assertion`);
  }

  const guidedCriteria = new Set(CLASSIFIED.filter((e) => e.lane === 'guided-manual').map((e) => e.sc));
  for (const sc of guidedCriteria) {
    const row = coverage.find((entry) => entry.sc === sc);
    assert.ok(
      ['manual only', 'ACT', 'ACT + local', 'local only'].includes(row.ground_truth),
      `${sc} should be covered, got ${row.ground_truth}`,
    );
  }
});

test('automatable and stateful criteria each have a matched broken and corrected pair', () => {
  const byId = new Map(aaa.cases.map((row) => [row.id, row]));

  for (const entry of CLASSIFIED.filter((row) => row.lane !== 'guided-manual')) {
    assert.ok(entry.evidence, `${entry.sc} has no evidence fixture`);
    assert.ok(entry.control, `${entry.sc} has no corrected control`);
    assert.equal(fs.existsSync(path.join(ROOT, entry.evidence)), true, `${entry.evidence} does not exist`);
    assert.equal(fs.existsSync(path.join(ROOT, entry.control)), true, `${entry.control} does not exist`);

    const stem = path.basename(entry.evidence, '.html');
    const broken = byId.get(`aaa-${stem}`);
    const corrected = byId.get(`aaa-safe_${stem}`);

    assert.ok(broken, `${entry.sc} has no broken case`);
    assert.ok(corrected, `${entry.sc} has no corrected case`);

    // The pair isolates exactly one criterion in each direction.
    assert.deepEqual(Object.keys(broken.min_criteria), [entry.sc]);
    assert.equal(broken.mode, 'tp');
    assert.deepEqual(corrected.must_not_report, [entry.sc]);
    assert.equal(corrected.mode, 'safe');
    assert.deepEqual(corrected.min_criteria, {});
  }
});

test('human-judgement criteria get a guided check and never a fabricated assertion', () => {
  const guidedByCriterion = new Map();
  for (const row of guided.cases) {
    for (const sc of row.guided_criteria ?? []) {
      if (!guidedByCriterion.has(sc)) guidedByCriterion.set(sc, []);
      guidedByCriterion.get(sc).push(row);
    }
  }

  for (const entry of CLASSIFIED.filter((row) => row.lane === 'guided-manual')) {
    assert.equal(entry.control, null, `${entry.sc} is human-judgement and must have no control`);

    const checks = guidedByCriterion.get(entry.sc) ?? [];
    assert.ok(checks.length > 0, `${entry.sc} has no guided check`);

    for (const check of checks) {
      assert.equal(check.requires_human, true);
      assert.equal(check.expected_outcome, 'cannot-tell');
      // The decisive guard: a human-judgement criterion must never appear as
      // something a tool is expected to report.
      assert.deepEqual(check.min_criteria, {}, `${entry.sc} fabricated an automated assertion`);
      assert.deepEqual(check.must_not_report, []);
      assert.ok(check.question && check.question.endsWith('?'));
    }

    // And no AAA fixture pair claims it either.
    assert.equal(
      aaa.cases.some((row) => Object.keys(row.min_criteria).includes(entry.sc)),
      false,
      `${entry.sc} needs a human judgement but has an automated fixture`,
    );
  }
});

test('applicability-dependent criteria keep inapplicable as a correct outcome', () => {
  const dependent = CLASSIFIED.filter((entry) => entry.applicability);
  assert.ok(dependent.length > 0);

  for (const entry of dependent) {
    assert.ok(entry.applicability.startsWith('inapplicable'), `${entry.sc} applicability is not phrased as a state`);
  }

  // Guided checks for those criteria accept inapplicable alongside cannot-tell.
  const guidedDependent = dependent.filter((entry) => entry.lane === 'guided-manual');
  for (const entry of guidedDependent) {
    const check = guided.cases.find((row) => (row.guided_criteria ?? []).includes(entry.sc));
    assert.ok(check, `${entry.sc} has no guided check`);
    assert.deepEqual(
      check.acceptable_outcomes,
      ['cannot-tell', 'inapplicable'],
      `${entry.sc} must accept inapplicable`,
    );
    assert.ok(readText(check.path).includes('When this does not apply'));
  }
});

test('no AAA material claims whole-site conformance', () => {
  for (const [label, document] of [['aaa.json', aaa], ['classification', classification]]) {
    assert.ok(document.boundary, `${label} must carry a boundary statement`);
    assert.match(document.boundary, /not.*conformance|conformance.*not/i);
  }

  assert.match(aaa.boundary, /not a sampled site/i);
  assert.match(classification.boundary, /not conformance/i);

  const indexPage = readText('aaa/index.html');
  assert.match(indexPage, /single-purpose fixtures, not a sampled site/i);
  assert.match(indexPage, /would still say nothing about whether any real site conforms at AAA/i);
});

test('every AAA fixture declares its lane and a taxonomy-valid shape', () => {
  const vocabulary = (name) =>
    new Set(readJson(`taxonomy/${name}.json`).values.map((value) => value.id));
  const journeys = vocabulary('journeys');
  const uiStates = vocabulary('ui-states');
  const inputs = vocabulary('input-at');
  const needs = vocabulary('user-needs');
  const methods = vocabulary('methods');
  const surfaces = vocabulary('surfaces');

  for (const row of aaa.cases) {
    assert.ok(LANES.includes(row.lane), `${row.id} has no lane`);
    assert.ok(surfaces.has(row.surface), `${row.id} surface ${row.surface}`);
    assert.ok(journeys.has(row.journey), `${row.id} journey ${row.journey}`);
    assert.ok(uiStates.has(row.ui_state), `${row.id} ui_state ${row.ui_state}`);
    for (const value of row.input_at) assert.ok(inputs.has(value), `${row.id} input ${value}`);
    for (const value of row.method) assert.ok(methods.has(value), `${row.id} method ${value}`);
    for (const value of row.user_needs) assert.ok(needs.has(value), `${row.id} need ${value}`);
    assert.equal(fs.existsSync(path.join(ROOT, row.path)), true, `${row.id} path missing`);
  }
});

test('each AAA fixture states the criterion and lane it is for', () => {
  for (const row of aaa.cases) {
    const body = readText(row.path);
    const entry = CLASSIFIED.find((candidate) => candidate.evidence === row.path || candidate.control === row.path);
    assert.ok(entry, `${row.path} is not referenced by the classification`);
    assert.ok(body.includes(`WCAG ${entry.sc} ${entry.name} (AAA)`), `${row.path} does not name its criterion`);
    assert.ok(body.includes(`lane: ${entry.lane}`), `${row.path} does not name its lane`);
    assert.ok(body.includes(entry.source), `${row.path} does not cite its public source`);
  }
});

test('the corrected control differs from the broken page', () => {
  for (const entry of CLASSIFIED.filter((row) => row.control)) {
    const broken = readText(entry.evidence);
    const corrected = readText(entry.control);
    assert.notEqual(broken, corrected, `${entry.sc} control is identical to the broken page`);
  }
});

test('AAA criteria inherit functional needs like every other criterion', () => {
  const mapped = new Set(readJson('taxonomy/criterion-needs.json').values.map((row) => row.sc));
  for (const entry of CLASSIFIED) {
    assert.ok(mapped.has(entry.sc), `${entry.sc} has no functional-need mapping`);
  }
});

test('the classification counts match the entries', () => {
  assert.equal(classification.counts.criteria, CLASSIFIED.length);

  const tallied = CLASSIFIED.reduce((totals, entry) => {
    totals[entry.lane] = (totals[entry.lane] ?? 0) + 1;
    return totals;
  }, {});
  assert.deepEqual(classification.counts.by_lane, tallied);

  const pairs = CLASSIFIED.filter((entry) => entry.control).length;
  assert.equal(aaa.counts.pairs, pairs);
  assert.equal(aaa.counts.cases, aaa.cases.length);
  assert.equal(aaa.cases.length, pairs * 2);
});
