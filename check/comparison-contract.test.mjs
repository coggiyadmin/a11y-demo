import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadFixtureCases } from '../fixture-families.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const COMPARISON = path.join(ROOT, 'comparison');
const suite = JSON.parse(fs.readFileSync(path.join(COMPARISON, 'suite.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(path.join(COMPARISON, 'results.json'), 'utf8'));
const cognium = JSON.parse(fs.readFileSync(path.join(COMPARISON, 'cognium-results.json'), 'utf8'));
const fixtureById = new Map(loadFixtureCases(ROOT).map((fixture) => [fixture.id, fixture]));

test('comparison suite names unique, definite fixture cases', () => {
  assert.equal(new Set(suite.case_ids).size, suite.case_ids.length);
  for (const id of suite.case_ids) {
    const fixture = fixtureById.get(id);
    assert.ok(fixture, `unknown comparison fixture: ${id}`);
    assert.ok(['tp', 'safe'].includes(fixture.mode), `${id} must have definite ground truth`);
    assert.notEqual(fixture.expected_outcome, 'cannot-tell');
  }
});

test('committed comparison snapshot covers the declared suite for every tool', () => {
  assert.equal(snapshot.schema_version, 1);
  assert.deepEqual(snapshot.cases.map(({ id }) => id), suite.case_ids);
  assert.deepEqual(snapshot.tool_order, ['cognium', 'axe', 'pa11y-htmlcs', 'ibm', 'lighthouse']);
  for (const id of snapshot.tool_order) {
    const tool = snapshot.tools[id];
    assert.ok(tool.version);
    assert.deepEqual(tool.cases.map((row) => row.id), suite.case_ids);
    assert.equal(tool.cases.some((row) => row.status === 'error'), false, `${id} has scan errors`);
    for (const row of tool.cases) {
      assert.equal(row.expected_criteria.every((criterion) => /^\d+\.\d+\.\d+$/.test(criterion)), true);
      assert.equal(row.matched_expected_criteria.every((criterion) =>
        row.expected_criteria.includes(criterion) && row.found_criteria.includes(criterion)), true);
    }
  }
});

test('Cognium import covers the suite without raw or local evidence', () => {
  assert.equal(cognium.schema_version, 1);
  assert.deepEqual(cognium.cases.map(({ id }) => id), suite.case_ids);
  assert.equal(cognium.capture.fixture_pages, suite.case_ids.length);
  assert.equal(cognium.capture.capture_misses, 0);
  assert.equal(cognium.capture.run_errors, 0);
  assert.equal(cognium.capture.reproduced_pages, cognium.capture.hydrated_pages);
  const text = JSON.stringify(cognium);
  assert.doesNotMatch(text, /https?:\/\//);
  assert.doesNotMatch(text, /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)/);
  assert.doesNotMatch(text, /(?:selector|record|replay|evidence)/i);
});

test('comparison snapshot contains no external target or local path', () => {
  const text = JSON.stringify(snapshot);
  assert.equal(snapshot.privacy.hosted_services, false);
  assert.equal(snapshot.privacy.repository_content_uploaded, false);
  assert.equal(snapshot.privacy.cognium_export_contains_raw_evidence, false);
  assert.doesNotMatch(text, /https?:\/\//);
  assert.doesNotMatch(text, /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)/);
});
