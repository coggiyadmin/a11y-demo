import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertLicenceUnchanged,
  diffAct,
  diffWcag,
  fixtureImpact,
  renderReport,
  transformWcag,
} from '../refresh-sources.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const sources = readJson('sources.json');

// Every test here runs offline against small synthetic documents. The refresher
// itself talks to the network; its logic does not have to.

const upstreamWcag = (overrides = {}) => ({
  principles: [
    {
      num: '1',
      handle: 'Perceivable',
      guidelines: [
        {
          num: '1.1',
          handle: 'Text Alternatives',
          successcriteria: [
            { num: '1.1.1', handle: 'Non-text Content', level: 'A', versions: ['2.0', '2.1', '2.2'] },
            { num: '1.1.9', handle: 'Retired Thing', level: '', versions: ['2.0'] },
          ],
        },
      ],
    },
  ],
  ...overrides,
});

const previousWcag = {
  source: 'src',
  source_url: 'url',
  source_data: 'data',
  license: 'licence',
  note: 'note',
  extracted: '2026-01-01',
  counts: {},
  criteria: [],
};

const testcase = (overrides = {}) => ({
  ruleId: 'abc123',
  ruleName: 'A rule',
  ruleAccessibilityRequirements: { 'wcag21:2.1.1': {} },
  expected: 'failed',
  testcaseId: 'case-1',
  ...overrides,
});

function validator(schemaFile) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
  return ajv.compile(readJson(schemaFile));
}

// --- the committed manifest -------------------------------------------------

test('the committed sources manifest satisfies its schema', () => {
  const validate = validator('schemas/sources.schema.json');
  assert.equal(validate(sources), true, JSON.stringify(validate.errors, null, 2));
});

test('every source records a url, licence, notice and upstream digest', () => {
  assert.ok(sources.sources.length >= 3);

  for (const source of sources.sources) {
    assert.match(source.url, /^https:\/\//, `${source.id} has no https url`);
    assert.match(source.upstream.sha256, /^sha256:[a-f0-9]{64}$/, `${source.id} has no digest`);
    assert.match(source.upstream.fetched, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(source.license.name && source.license.url, `${source.id} has no licence`);
    assert.equal(source.license.notice, 'THIRD_PARTY_NOTICES.md');
    assert.ok(source.transform.length > 20, `${source.id} does not describe its transform`);
  }
});

test('every vendored snapshot named by the manifest exists', () => {
  for (const source of sources.sources) {
    if (source.watch_only) {
      assert.equal(source.vendored, null, `${source.id} is watch-only and must vendor nothing`);
      assert.ok(source.informs.length > 0, `${source.id} must name what it informs`);
      continue;
    }
    assert.equal(fs.existsSync(path.join(ROOT, source.vendored)), true, `${source.vendored} is missing`);
  }
});

test('the required W3C notices are preserved and reference each source', () => {
  const notices = fs.readFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  for (const source of sources.sources) {
    assert.ok(notices.includes(source.license.url), `${source.id} licence url missing from the notices`);
  }
  // The modification statement the W3C document licence requires.
  assert.match(notices, /W3C Document License/i);
  assert.match(notices, /W3C Software and Document/i);
});

// --- transform --------------------------------------------------------------

test('the WCAG transform keeps only the documented fields', () => {
  const result = transformWcag(upstreamWcag(), previousWcag);
  assert.deepEqual(Object.keys(result.criteria[0]), [
    'num', 'handle', 'level', 'principle', 'principle_num', 'guideline', 'guideline_num', 'versions', 'in_2_2',
  ]);
  assert.equal(result.criteria[0].principle, 'Perceivable');
  assert.equal(result.criteria[0].guideline_num, '1.1');
});

test('a criterion with no level is normalised to null, not an empty string', () => {
  // Upstream uses "" for 4.1.1, which 2.2 removed. Passing that through made
  // every refresh report a change upstream never made.
  const result = transformWcag(upstreamWcag(), previousWcag);
  const retired = result.criteria.find((row) => row.num === '1.1.9');
  assert.equal(retired.level, null);
  assert.equal(retired.in_2_2, false);
});

test('the transform reproduces the committed WCAG index exactly', () => {
  // The decisive property: if the transform and the committed snapshot ever
  // disagree, a refresh reports drift that upstream did not cause.
  const committed = readJson('wcag/criteria.json');
  const counts = committed.counts;
  assert.equal(counts.total, committed.criteria.length);
  assert.equal(counts.in_2_2, committed.criteria.filter((row) => row.in_2_2).length);
  for (const level of ['A', 'AA', 'AAA']) {
    assert.equal(counts[level], committed.criteria.filter((row) => row.in_2_2 && row.level === level).length);
  }

  const retired = committed.criteria.filter((row) => !row.in_2_2);
  assert.deepEqual(retired.map((row) => row.num), ['4.1.1']);
  assert.equal(retired[0].level, null);
});

test('counts are recomputed from the transformed criteria', () => {
  const result = transformWcag(upstreamWcag(), previousWcag);
  assert.deepEqual(result.counts, { total: 2, in_2_2: 1, A: 1, AA: 0, AAA: 0 });
});

// --- diffs ------------------------------------------------------------------

test('the WCAG diff reports added, removed and changed criteria by field', () => {
  const before = transformWcag(upstreamWcag(), previousWcag);

  const moved = upstreamWcag();
  moved.principles[0].guidelines[0].successcriteria[0].level = 'AA';
  moved.principles[0].guidelines[0].successcriteria.push({
    num: '1.1.2', handle: 'New Thing', level: 'A', versions: ['2.2'],
  });
  moved.principles[0].guidelines[0].successcriteria.splice(1, 1);

  const diff = diffWcag(before, transformWcag(moved, previousWcag));
  assert.deepEqual(diff.added, ['1.1.2']);
  assert.deepEqual(diff.removed, ['1.1.9']);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0].num, '1.1.1');
  assert.deepEqual(diff.changed[0].fields, [{ field: 'level', from: 'A', to: 'AA' }]);
});

test('the ACT diff reports rule and test-case movement and outcome changes', () => {
  const before = { testcases: [testcase(), testcase({ testcaseId: 'case-2', expected: 'passed' })] };
  const after = {
    testcases: [
      testcase({ expected: 'inapplicable' }),
      testcase({ ruleId: 'new999', testcaseId: 'case-9' }),
    ],
  };

  const diff = diffAct(before, after);
  assert.deepEqual(diff.rules_added, ['new999']);
  assert.deepEqual(diff.rules_removed, []);
  assert.deepEqual(diff.testcases_added, ['new999|case-9']);
  assert.deepEqual(diff.testcases_removed, ['abc123|case-2']);
  assert.deepEqual(diff.expected_outcome_changes, [
    { rule_id: 'abc123', testcase: 'case-1', from: 'failed', to: 'inapplicable' },
  ]);
  assert.deepEqual(diff.counts, { before: 2, after: 2 });
  assert.ok(diff.affected_criteria.includes('2.1.1'));
});

test('an unchanged ACT catalogue reports no movement at all', () => {
  const same = { testcases: [testcase(), testcase({ testcaseId: 'case-2' })] };
  const diff = diffAct(same, structuredClone(same));
  assert.deepEqual(diff.rules_added, []);
  assert.deepEqual(diff.rules_removed, []);
  assert.deepEqual(diff.testcases_added, []);
  assert.deepEqual(diff.testcases_removed, []);
  assert.deepEqual(diff.expected_outcome_changes, []);
  assert.deepEqual(diff.affected_criteria, []);
});

// --- fixture impact ---------------------------------------------------------

test('fixture impact names the local cases that assert a moved criterion', () => {
  const cases = [
    { id: 'a', path: 'a.html', min_criteria: { '2.1.1': 1 }, must_not_report: [] },
    { id: 'b', path: 'b.html', min_criteria: {}, must_not_report: ['2.1.1'] },
    { id: 'c', path: 'c.html', min_criteria: { '1.1.1': 1 }, must_not_report: [] },
    { id: 'd', path: 'd.html', min_criteria: {}, must_not_report: [], guided_criteria: ['2.1.1'] },
  ];

  const impact = fixtureImpact(['2.1.1'], cases);
  assert.deepEqual(impact.map((row) => row.id), ['a', 'b', 'd']);
  assert.deepEqual(impact[0].criteria, ['2.1.1']);
});

test('no moved criteria means no fixture impact', () => {
  assert.deepEqual(fixtureImpact([], [{ id: 'a', path: 'a.html', min_criteria: { '2.1.1': 1 } }]), []);
});

test('fixture impact reaches the real corpus', () => {
  // A refresh touching 2.1.1 must surface real fixtures, not an empty list.
  const cases = readJson('catalog.json').cases;
  const impact = fixtureImpact(['2.1.1'], cases);
  assert.ok(impact.length > 0, 'the corpus asserts on 2.1.1 and the impact report must say so');
});

// --- failing closed ---------------------------------------------------------

test('a changed upstream licence stops the refresh', () => {
  const source = sources.sources.find((row) => row.id === 'act-testcases');
  assert.ok(source.license.upstream_field, 'the ACT source must assert its licence');

  assert.throws(
    () => assertLicenceUnchanged(source, { license: 'https://example.com/new-terms' }),
    /licence changed/i,
  );
});

test('a missing upstream licence stops the refresh', () => {
  const source = sources.sources.find((row) => row.id === 'act-testcases');
  assert.throws(() => assertLicenceUnchanged(source, {}), /failing closed/i);
});

test('an unchanged upstream licence passes', () => {
  const source = sources.sources.find((row) => row.id === 'act-testcases');
  assert.doesNotThrow(() => assertLicenceUnchanged(source, { license: source.license.upstream_value }));
});

test('a source declaring no upstream licence field is not checked', () => {
  const source = sources.sources.find((row) => row.id === 'wcag22');
  assert.equal(source.license.upstream_field, undefined);
  assert.doesNotThrow(() => assertLicenceUnchanged(source, {}));
});

test('the committed ACT snapshot still declares the licence the manifest expects', () => {
  const source = sources.sources.find((row) => row.id === 'act-testcases');
  const vendored = readJson(source.vendored);
  assert.equal(vendored.license, source.license.upstream_value);
});

// --- reporting --------------------------------------------------------------

test('the report names every source and surfaces a failure prominently', () => {
  const rendered = renderReport({
    generated: '2026-10-13',
    changed: true,
    sources: [
      { id: 'wcag22', url: 'https://example.org/a', changed: false, upstream_sha256: 'sha256:x', previous_sha256: 'sha256:x', diff: { added: [], removed: [], changed: [] }, fixture_impact: [] },
      { id: 'gone', url: 'https://example.org/b', error: 'upstream returned 410' },
    ],
    errors: ['gone: upstream returned 410'],
  });

  assert.match(rendered, /## wcag22/);
  assert.match(rendered, /## gone/);
  assert.match(rendered, /\*\*failed closed:\*\* upstream returned 410/);
  assert.match(rendered, /## Failed closed/);
  assert.match(rendered, /No source was refreshed/);
});

test('the report states when nothing moved', () => {
  const rendered = renderReport({ generated: '2026-10-13', changed: false, sources: [], errors: [] });
  assert.match(rendered, /Standards sources unchanged/);
});

// --- workflow guarantees ----------------------------------------------------

test('the refresh workflow opens a pull request and never pushes to the default branch', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/refresh-sources.yml'), 'utf8');

  assert.match(workflow, /schedule:/, 'the refresh must be scheduled');
  assert.match(workflow, /create-pull-request|gh pr create/, 'the refresh must open a pull request');
  assert.ok(!/git push origin (master|main)\b/.test(workflow), 'the refresh must never push to the default branch');
  assert.ok(!/--auto-merge|gh pr merge/.test(workflow), 'the refresh must never merge itself');
  assert.match(workflow, /refresh-sources\.mjs --apply/);
  // Regenerate and test, so a refresh that breaks the corpus cannot land green.
  assert.match(workflow, /node --test check\/\*\.test\.mjs/);
});

test('releases reference the committed snapshot rather than live upstream', () => {
  assert.match(sources.policy.identity, /immutable snapshot|never live upstream/i);
  assert.match(sources.policy.fail_closed, /404|410|licence|license/i);
  assert.match(sources.policy.refresh, /pull request/i);
  assert.match(sources.policy.notices, /THIRD_PARTY_NOTICES\.md/);
});
