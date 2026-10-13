import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const pipeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline.json'), 'utf8'));
const cases = pipeline.cases;

const byId = (id) => cases.find((testCase) => testCase.id === id);
const isSubset = (subset, superset) => subset.every((value) => superset.includes(value));

test('pipeline family contains four broken/control pairs with unique IDs', () => {
  assert.equal(pipeline.format, 'cognium-a11y-pipeline-cases');
  assert.equal(pipeline.format_version, '1.0.0');
  assert.equal(cases.length, 8);
  assert.equal(new Set(cases.map(({ id }) => id)).size, 8);
  assert.deepEqual([...new Set(cases.map(({ pair }) => pair))].sort(), [
    'deep_site',
    'entry_not_sampled',
    'no_declared_flow',
    'vacuous_pass',
  ]);
  for (const pair of new Set(cases.map(({ pair }) => pair))) {
    assert.equal(cases.filter((testCase) => testCase.pair === pair && testCase.mode === 'tp').length, 1);
    assert.equal(cases.filter((testCase) => testCase.pair === pair && testCase.mode === 'safe').length, 1);
  }
});

test('every fixture path exists and every multi-page case declares entry and steps', () => {
  for (const testCase of cases) {
    assert.equal(fs.existsSync(path.join(ROOT, testCase.path)), true, `${testCase.id} path`);
    if (testCase.scope === 'multi-page') {
      assert.equal(typeof testCase.entry, 'string', `${testCase.id} entry`);
      assert.equal(Array.isArray(testCase.steps), true, `${testCase.id} steps`);
      assert.ok(testCase.steps.length > 1, `${testCase.id} step count`);
      assert.equal(testCase.steps.includes(testCase.entry), true, `${testCase.id} entry is a step`);
      for (const step of testCase.steps) {
        assert.equal(fs.existsSync(path.join(ROOT, step)), true, `${testCase.id} missing ${step}`);
      }
    }
  }
});

test('expected state, observability, examined count and error boundaries are explicit', () => {
  const statuses = new Set(['completed', 'error', 'blocked', 'unsupported']);
  const observability = new Set(['observed', 'not-observed', 'unknown']);
  const operators = new Set(['equals', 'at-least', 'unavailable']);
  for (const testCase of cases) {
    const expected = testCase.assertion.expected_execution;
    assert.equal(statuses.has(expected.status), true, `${testCase.id} status`);
    assert.equal(typeof expected.declared_state, 'string', `${testCase.id} declared state`);
    assert.equal(typeof expected.state_reached, 'boolean', `${testCase.id} state reached`);
    assert.equal(observability.has(expected.target_observability), true, `${testCase.id} observability`);
    assert.equal(operators.has(expected.examined_count.operator), true, `${testCase.id} examined boundary`);
    if (expected.examined_count.operator !== 'unavailable') {
      assert.equal(Number.isInteger(expected.examined_count.value), true, `${testCase.id} examined value`);
    }
    assert.equal(typeof expected.error.required, 'boolean', `${testCase.id} error boundary`);
    assert.equal(expected.error.required, expected.error.code !== null, `${testCase.id} error code`);
  }
});

test('deep-site sampling fails when any selected page is absent from capture or evaluation', () => {
  const broken = byId('pipeline-deep_site-mismatch');
  const control = byId('pipeline-deep_site-control');
  assert.equal(isSubset(broken.assertion.inputs.sampled_pages, broken.assertion.inputs.captured_pages), false);
  assert.equal(isSubset(broken.assertion.inputs.sampled_pages, broken.assertion.inputs.evaluated_pages), false);
  assert.equal(broken.assertion.expected_execution.status, 'error');
  assert.equal(isSubset(control.assertion.inputs.sampled_pages, control.assertion.inputs.captured_pages), true);
  assert.equal(isSubset(control.assertion.inputs.sampled_pages, control.assertion.inputs.evaluated_pages), true);
  assert.equal(control.assertion.expected_execution.status, 'completed');
});

test('the requested entry must be present in the evaluated set', () => {
  const broken = byId('pipeline-entry_not_sampled');
  const control = byId('pipeline-entry_sampled-control');
  assert.equal(broken.assertion.inputs.evaluated_pages.includes(broken.assertion.inputs.requested_entry), false);
  assert.equal(broken.assertion.expected_execution.status, 'error');
  assert.equal(control.assertion.inputs.evaluated_pages.includes(control.assertion.inputs.requested_entry), true);
  assert.equal(control.assertion.expected_execution.status, 'completed');
});

test('a zero-examined pass is rejected while an observed pass remains completed', () => {
  const broken = byId('pipeline-vacuous_pass');
  const control = byId('pipeline-observed_pass-control');
  assert.deepEqual(broken.assertion.inputs, { reported_verdict: 'pass', reported_examined_count: 0 });
  assert.equal(broken.assertion.expected_execution.status, 'error');
  assert.equal(broken.assertion.expected_execution.error.code, 'zero-examined');
  assert.equal(control.assertion.inputs.reported_examined_count, 3);
  assert.equal(control.assertion.expected_execution.status, 'completed');
});

test('flow criteria cannot pass until a flow and its steps are declared', () => {
  const broken = byId('pipeline-no_declared_flow');
  const control = byId('pipeline-declared_flow-control');
  assert.equal(broken.assertion.inputs.flow_declared, false);
  assert.deepEqual(broken.assertion.inputs.declared_steps, []);
  assert.equal(broken.assertion.expected_execution.status, 'unsupported');
  assert.equal(control.assertion.inputs.flow_declared, true);
  assert.equal(control.assertion.inputs.declared_steps.length, 2);
  assert.equal(control.assertion.expected_execution.status, 'completed');
});

test('no broken pipeline state can be credited as pass', () => {
  for (const testCase of cases.filter(({ mode }) => mode === 'tp')) {
    const expected = testCase.assertion.expected_execution;
    assert.notEqual(expected.status, 'completed', `${testCase.id} completed`);
    assert.equal(expected.forbidden_verdicts.includes('pass'), true, `${testCase.id} pass boundary`);
  }
});
