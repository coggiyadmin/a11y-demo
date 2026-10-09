import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SELF = 'check/functional-language.test.mjs';
const BINARY = new Set(['.mp3', '.mp4', '.png']);
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
  .toString().split('\0').filter(Boolean);

const retiredLanguage = [
  'blind', 'deaf', 'hearing', 'color[- ]vision', 'colour[- ]vision', 'low vision',
  'motor', 'cognitive', 'speech', 'neurological', 'age-related', 'temporary',
  'situational', 'dyslexia', 'tremor', 'paralysis', 'photosens', 'vestibular',
  'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia',
];
const retiredPattern = new RegExp(retiredLanguage.join('|'), 'i');

const expectedNeeds = [
  'nonvisual-access', 'visual-clarity', 'color-independent', 'contrast-adaptation',
  'text-for-audio', 'adjustable-audio', 'text-and-tactile', 'alternative-input',
  'error-tolerant-pointer', 'hands-free-switch', 'low-effort-interaction',
  'non-voice-alternative', 'memory-support', 'focus-support', 'reading-support',
  'language-clarity', 'task-guidance', 'flash-safety', 'motion-safety',
  'combined-access', 'forgiving-interface', 'constrained-use',
  'environmental-resilience',
];

test('tracked public corpus uses functional language instead of condition labels', () => {
  const findings = [];
  for (const file of files) {
    if (file === SELF || BINARY.has(path.extname(file).toLowerCase())) continue;
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (retiredPattern.test(body)) findings.push(file);
  }
  assert.deepEqual(findings, []);
  assert.equal(files.some((file) => file.startsWith('color-vision')), false);
});

test('all represented needs retain stable functional identifiers', () => {
  const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy/user-needs.json'), 'utf8'));
  assert.deepEqual(taxonomy.values.map(({ id }) => id), expectedNeeds);
  assert.equal(taxonomy.values.every(({ label, group }) => label && group), true);
  assert.equal(taxonomy.values.length, 23);
});

test('input and colour taxonomies expose their functional names', () => {
  const input = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy/input-at.json'), 'utf8'));
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy/index.json'), 'utf8'));
  assert.equal(input.values.some(({ id }) => id === 'voice-control'), true);
  assert.equal(index.dimensions['color-independent-checks'], 8);
});
