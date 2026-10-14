import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadFixtureCases } from '../fixture-families.mjs';
import {
  DEPENDENCY_REASONS,
  claimsInteraction,
  detectedReasons,
  validateClaim,
} from '../state-dependency.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const cases = loadFixtureCases(ROOT).filter((row) => row.path.endsWith('.html'));
const html = (row) => fs.readFileSync(path.join(ROOT, row.path), 'utf8');

// `method: ["interaction"]` claims the delivered page does not yet contain the
// defect. 53 cases claimed it while shipping a page already rendered in the
// state they were about, which made a real engine gap look like a harness
// limitation.

test('no case claims interaction without a reason', () => {
  const unjustified = [];
  for (const row of cases) {
    const verdict = validateClaim(row, html(row));
    if (!verdict.ok) unjustified.push(`${row.id}: ${verdict.problem}`);
  }
  assert.deepEqual(unjustified, []);
});

test('a declared reason the markup can show must actually be shown', () => {
  for (const row of cases) {
    const declared = row.state_dependency;
    if (!declared || !['script', 'handler', 'css-state', 'hidden', 'media-query'].includes(declared)) continue;
    assert.ok(
      detectedReasons(html(row)).includes(declared),
      `${row.id} declares ${declared} but the artifact shows no such signal`,
    );
  }
});

test('every declared reason is one the vocabulary defines', () => {
  for (const row of cases) {
    if (!row.state_dependency) continue;
    assert.ok(
      Object.hasOwn(DEPENDENCY_REASONS, row.state_dependency),
      `${row.id} declares unknown reason ${row.state_dependency}`,
    );
  }
});

test('a reason is only declared by a case that claims interaction', () => {
  for (const row of cases) {
    if (!row.state_dependency) continue;
    assert.equal(
      claimsInteraction(row) || row.scope === 'multi-page' || (row.steps ?? []).length > 0,
      true,
      `${row.id} declares a dependency but claims no interaction method`,
    );
  }
});

test('a page already rendered in its state does not claim interaction', () => {
  // The defect this guards against, stated as an assertion.
  const overclaiming = cases.filter((row) => {
    if (!claimsInteraction(row)) return false;
    if (row.scope === 'multi-page' || (row.steps ?? []).length > 0) return false;
    if (row.state_dependency && !['script', 'handler', 'css-state', 'hidden', 'media-query'].includes(row.state_dependency)) {
      return false; // focus, temporal and runner-behaviour leave no trace by design
    }
    return detectedReasons(html(row)).length === 0;
  });
  assert.deepEqual(overclaiming.map((row) => row.id), []);
});

test('reasons the markup cannot show are declared by hand, never guessed', () => {
  // focus, temporal and runner-behaviour exist precisely because nothing in the
  // artifact proves them. Detection must never invent one.
  for (const row of cases) {
    const detected = detectedReasons(html(row));
    for (const invisible of ['focus', 'temporal', 'runner-behaviour', 'steps']) {
      assert.equal(detected.includes(invisible), false, `${invisible} must not be detectable`);
    }
  }
});

test('the interaction claim shrank to what the corpus can justify', () => {
  const claiming = cases.filter(claimsInteraction).length;
  assert.ok(claiming > 0, 'genuinely dynamic cases still claim interaction');
  assert.ok(claiming < cases.length / 2, 'interaction is no longer the default for most of the corpus');
});

test('dropping interaction never left a case with an empty method list', () => {
  // The `catalog` family predates method tagging and carries no `method` field
  // at all, which is a separate gap. The invariant here is narrower: a case
  // that declares methods must still declare at least one.
  for (const row of cases) {
    if (!Object.hasOwn(row, 'method')) continue;
    assert.ok(row.method.length > 0, `${row.id} was left with an empty method list`);
  }
});

// --- the validator itself ---------------------------------------------------

const fixture = (overrides = {}) => ({ id: 'test', method: ['runtime-dom'], ...overrides });

test('a claim backed by a script is accepted', () => {
  const verdict = validateClaim(fixture({ method: ['interaction'] }), '<script>x()</script>');
  assert.equal(verdict.ok, false, 'a signal alone is not a declaration');
  assert.match(verdict.problem, /no state_dependency/);

  const declared = validateClaim(
    fixture({ method: ['interaction'], state_dependency: 'script' }),
    '<script>x()</script>',
  );
  assert.equal(declared.ok, true);
});

test('a declared signal the artifact lacks is rejected', () => {
  const verdict = validateClaim(
    fixture({ method: ['interaction'], state_dependency: 'script' }),
    '<p>static</p>',
  );
  assert.equal(verdict.ok, false);
  assert.match(verdict.problem, /contains no such signal/);
});

test('an invisible reason is accepted on its own word', () => {
  for (const reason of ['focus', 'temporal', 'runner-behaviour']) {
    const verdict = validateClaim(fixture({ method: ['interaction'], state_dependency: reason }), '<p>static</p>');
    assert.equal(verdict.ok, true, `${reason} must be accepted as a reviewed statement`);
  }
});

test('a multi-page walk justifies itself', () => {
  const verdict = validateClaim(fixture({ method: ['interaction'], steps: ['a.html', 'b.html'] }), '<p>static</p>');
  assert.equal(verdict.ok, true);
  assert.equal(verdict.reason, 'steps');
});

test('declaring a reason without claiming interaction is rejected', () => {
  const verdict = validateClaim(fixture({ state_dependency: 'script' }), '<script>x()</script>');
  assert.equal(verdict.ok, false);
  assert.match(verdict.problem, /claims no interaction method/);
});

test('an unknown reason is rejected', () => {
  const verdict = validateClaim(fixture({ method: ['interaction'], state_dependency: 'vibes' }), '<p>x</p>');
  assert.equal(verdict.ok, false);
  assert.match(verdict.problem, /unknown state_dependency/);
});
