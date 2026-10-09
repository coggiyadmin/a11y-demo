import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const scenarios = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios.json'), 'utf8')).cases;
const criteria = ['1.3.2', '2.5.2', '3.2.1', '3.2.2', '3.3.3'];
const read = (name) => fs.readFileSync(path.join(ROOT, 'scenarios', name), 'utf8');

test('every remaining A/AA gap has one broken and one corrected scenario', () => {
  for (const criterion of criteria) {
    const broken = scenarios.filter((entry) => Object.hasOwn(entry.min_criteria, criterion));
    const corrected = scenarios.filter((entry) => entry.must_not_report.includes(criterion));
    assert.equal(broken.length, 1, `${criterion} must have one broken fixture`);
    assert.equal(corrected.length, 1, `${criterion} must have one corrected fixture`);
    assert.equal(broken[0].expected_outcome, 'fail');
    assert.equal(corrected[0].expected_outcome, 'pass');
  }
});

test('meaningful sequence differs in DOM order rather than labels or semantics', () => {
  assert.match(read('meaningful_sequence.html'), /order:\s*[123]/);
  assert.doesNotMatch(read('safe_meaningful_sequence.html'), /order:\s*[123]/);
});

test('pointer cancellation commits on release and supports reversal', () => {
  assert.match(read('pointer_cancellation.html'), /onpointerdown=/);
  const corrected = read('safe_pointer_cancellation.html');
  assert.doesNotMatch(corrected, /onpointerdown=/);
  assert.match(corrected, /onclick=/);
  assert.match(corrected, /Undo cancellation/);
});

test('focus and input do not change context until explicit activation', () => {
  assert.match(read('change_on_focus.html'), /onfocus=/);
  assert.doesNotMatch(read('safe_change_on_focus.html'), /onfocus=/);
  assert.match(read('change_on_input.html'), /onchange=/);
  const corrected = read('safe_change_on_input.html');
  assert.doesNotMatch(corrected, /onchange=/);
  assert.match(corrected, /Apply destination/);
});

test('the corrected input error provides a usable suggestion', () => {
  assert.match(read('error_suggestion.html'), />Date is invalid\.<\/p>/);
  assert.match(read('safe_error_suggestion.html'), /DD\/MM\/YYYY/);
});
