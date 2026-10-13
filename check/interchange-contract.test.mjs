import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const manifest = readJson('corpus-manifest.json');

function validator(schemaFile) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
  ajv.addFormat('date-time', (value) => Number.isFinite(Date.parse(value)));
  return ajv.compile(readJson(schemaFile));
}

function canonicalContentDigest(document) {
  const copy = structuredClone(document);
  delete copy.generated;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex')}`;
}

test('corpus manifest satisfies its published JSON Schema', () => {
  const validate = validator('schemas/corpus-manifest.schema.json');
  assert.equal(validate(manifest), true, JSON.stringify(validate.errors, null, 2));
});

test('manifest counts and family digests match committed corpus data', () => {
  let caseCount = 0;
  const familyIds = new Set();

  for (const family of manifest.families) {
    assert.equal(familyIds.has(family.id), false, `duplicate family id: ${family.id}`);
    familyIds.add(family.id);

    const document = readJson(family.file);
    assert.ok(Array.isArray(document.cases), `${family.file} must expose cases`);
    assert.equal(family.case_count, document.cases.length, `${family.file} count drift`);
    assert.equal(family.content_sha256, canonicalContentDigest(document), `${family.file} digest drift`);
    caseCount += document.cases.length;
  }

  assert.equal(manifest.counts.families, manifest.families.length);
  assert.equal(manifest.counts.cases, caseCount);
});

test('case identifiers are globally unique and fixture paths exist', () => {
  const ids = new Set();
  for (const family of manifest.families) {
    for (const fixture of readJson(family.file).cases) {
      assert.equal(typeof fixture.id, 'string', `${family.file} has a case without an id`);
      assert.equal(ids.has(fixture.id), false, `duplicate case id: ${fixture.id}`);
      ids.add(fixture.id);

      assert.equal(typeof fixture.path, 'string', `${fixture.id} has no path`);
      assert.equal(fs.existsSync(path.join(ROOT, fixture.path)), true, `${fixture.id} path does not exist: ${fixture.path}`);
    }
  }
  assert.equal(ids.size, manifest.counts.cases);
});

test('valid benchmark result example satisfies the interchange schema', () => {
  const validate = validator('schemas/benchmark-result.schema.json');
  const example = readJson('schemas/examples/benchmark-result.valid.json');
  assert.equal(validate(example), true, JSON.stringify(validate.errors, null, 2));
});

test('invalid benchmark result example fails lineage and error-evidence requirements', () => {
  const validate = validator('schemas/benchmark-result.schema.json');
  const example = readJson('schemas/examples/benchmark-result.invalid.json');
  assert.equal(validate(example), false);
  const missing = validate.errors.filter((error) => error.keyword === 'required').map((error) => error.params.missingProperty);
  assert.ok(missing.includes('wrapper_of'));
  assert.ok(missing.includes('error'));
});
