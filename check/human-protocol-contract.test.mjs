import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const registry = readJson('protocols/protocols.json');
const resultExample = readJson('protocols/examples/result.valid.json');
const doubleReview = readJson('protocols/examples/double-review.json');

function validate(schemaFile, value) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat('date-time', (candidate) => Number.isFinite(Date.parse(candidate)));
  const validator = ajv.compile(readJson(schemaFile));
  return { valid: validator(value), errors: validator.errors };
}

const allFixtureIds = new Set([
  'catalog.json',
  'delivery.json',
  'patterns.json',
  'journeys.json',
  'scenarios.json',
  'media.json',
  'flash.json',
  'color-independent.json',
  'ui-states.json',
  'surfaces.json',
  'guided.json',
].flatMap((file) => readJson(file).cases.map(({ id }) => id)));

test('protocol registry and example records satisfy their published schemas', () => {
  for (const [schema, value] of [
    ['protocols/protocols.schema.json', registry],
    ['protocols/result.schema.json', resultExample],
    ['protocols/double-review.schema.json', doubleReview],
  ]) {
    const outcome = validate(schema, value);
    assert.equal(outcome.valid, true, `${schema}: ${JSON.stringify(outcome.errors, null, 2)}`);
  }
});

test('registry covers every planned evaluation lane and required result vocabulary', () => {
  assert.deepEqual(registry.result_vocabulary, [
    'pass',
    'fail',
    'inapplicable',
    'cannot-tell',
    'not-tested',
  ]);
  assert.deepEqual(new Set(registry.protocols.map(({ lane }) => lane)), new Set([
    'human-guided',
    'at-interoperability',
    'user-task',
  ]));
  assert.deepEqual(new Set(registry.protocols.map(({ id }) => id)), new Set([
    'screen-reader-task',
    'keyboard-task',
    'switch-task',
    'voice-operation-task',
    'caption-transcript-review',
    'zoom-display-adaptation',
    'comprehension-review',
    'user-task-completion',
  ]));
});

test('every protocol is complete, references public fixtures and records the full environment', () => {
  const requiredEnvironment = new Set([
    'tool',
    'tool_version',
    'browser',
    'browser_version',
    'platform',
    'platform_version',
    'settings',
    'input_method',
  ]);
  for (const protocol of registry.protocols) {
    assert.ok(protocol.prerequisites.length > 0, `${protocol.id} prerequisites`);
    assert.ok(protocol.steps.length > 0, `${protocol.id} steps`);
    assert.ok(protocol.expected_observations.length > 0, `${protocol.id} observations`);
    assert.ok(protocol.stop_conditions.length > 0, `${protocol.id} stop conditions`);
    assert.ok(protocol.evidence_requirements.length > 0, `${protocol.id} evidence`);
    assert.deepEqual(new Set(protocol.environment.required_fields), requiredEnvironment, `${protocol.id} environment`);
    for (const fixtureId of protocol.fixture_ids) {
      assert.equal(allFixtureIds.has(fixtureId), true, `${protocol.id} missing fixture ${fixtureId}`);
    }
    assert.equal(new Set(protocol.steps.map(({ id }) => id)).size, protocol.steps.length, `${protocol.id} step IDs`);
  }
});

test('screen-reader environments name the four required product families without generalizing results', () => {
  const protocol = registry.protocols.find(({ id }) => id === 'screen-reader-task');
  assert.deepEqual(new Set(protocol.environment.pairing_options.map(({ tool }) => tool)), new Set([
    'JAWS',
    'NVDA',
    'VoiceOver',
    'TalkBack',
  ]));
  assert.equal(protocol.environment.pairing_options.every(({ scope_note }) => scope_note.length > 20), true);
});

test('privacy and metric boundaries reject participant, production and automated result mixing', () => {
  assert.deepEqual(registry.privacy, {
    fixture_data: 'public-synthetic-only',
    participant_data: 'prohibited',
    production_evidence: 'prohibited',
  });
  assert.equal(resultExample.privacy.participant_data_included, false);
  assert.equal(resultExample.privacy.production_evidence_included, false);
  assert.equal(resultExample.metrics.automated_results_included, false);

  const unsafe = structuredClone(resultExample);
  unsafe.privacy.participant_data_included = true;
  assert.equal(validate('protocols/result.schema.json', unsafe).valid, false);
});

test('result example uses declared protocol steps and preserves not-tested', () => {
  const protocol = registry.protocols.find(({ id }) => id === resultExample.protocol.id);
  const stepIds = new Set(protocol.steps.map(({ id }) => id));
  assert.equal(resultExample.outcomes.every(({ step_id: stepId }) => stepIds.has(stepId)), true);
  assert.equal(resultExample.outcomes.some(({ outcome }) => outcome === 'not-tested'), true);
});

test('human-result CLI accepts public synthetic evidence and rejects a privacy violation', () => {
  const cli = path.join(ROOT, 'check/validate-human-result.mjs');
  const valid = spawnSync(process.execPath, [cli, path.join(ROOT, 'protocols/examples/result.valid.json')], {
    encoding: 'utf8',
  });
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /valid human evaluation result/);

  const invalid = spawnSync(process.execPath, [cli, path.join(ROOT, 'protocols/examples/result.invalid.json')], {
    encoding: 'utf8',
  });
  assert.equal(invalid.status, 1, invalid.stderr);
  assert.match(invalid.stderr, /invalid human evaluation result/);
  assert.match(invalid.stderr, /participant_data_included/);
});

test('double review reports reproducible agreement without forcing consensus', () => {
  const [reviewA, reviewB] = doubleReview.reviews;
  assert.equal(reviewA.independent, true);
  assert.equal(reviewB.independent, true);
  assert.equal(doubleReview.comparison.forced_consensus, false);

  const decisionsA = new Map(reviewA.decisions.map(({ step_id: stepId, outcome }) => [stepId, outcome]));
  const decisionsB = new Map(reviewB.decisions.map(({ step_id: stepId, outcome }) => [stepId, outcome]));
  assert.deepEqual([...decisionsA.keys()], [...decisionsB.keys()]);
  const stepIds = [...decisionsA.keys()];
  const agreementCount = stepIds.filter((stepId) => decisionsA.get(stepId) === decisionsB.get(stepId)).length;
  const rawAgreement = agreementCount / stepIds.length;

  const categories = new Set([...decisionsA.values(), ...decisionsB.values()]);
  const expectedAgreement = [...categories].reduce((sum, category) => {
    const countA = [...decisionsA.values()].filter((outcome) => outcome === category).length;
    const countB = [...decisionsB.values()].filter((outcome) => outcome === category).length;
    return sum + (countA / stepIds.length) * (countB / stepIds.length);
  }, 0);
  const kappa = (rawAgreement - expectedAgreement) / (1 - expectedAgreement);

  assert.equal(doubleReview.comparison.decision_count, stepIds.length);
  assert.equal(doubleReview.comparison.agreement_count, agreementCount);
  assert.equal(doubleReview.comparison.raw_agreement, rawAgreement);
  assert.equal(doubleReview.comparison.cohen_kappa, Number(kappa.toFixed(6)));
  assert.deepEqual(doubleReview.comparison.disagreements, [{
    step_id: 'sample-04',
    reviewer_a: 'pass',
    reviewer_b: 'fail',
    resolution: 'unresolved',
  }]);
});
