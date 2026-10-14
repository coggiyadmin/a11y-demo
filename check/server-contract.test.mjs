import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { test, after } from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadFixtureCases } from '../fixture-families.mjs';
import { startCorpusServer } from '../serve.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

const server = startCorpusServer({ root: ROOT, host: '127.0.0.1', port: 0 });
if (!server.listening) await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

after(() => server.close());

// The server already has a security test proving it refuses what it should
// refuse. Nothing proved it serves what it should serve, so an allow-list that
// fell behind three new families passed every check and left 38 fixtures --
// including every pipeline-integrity case -- unreachable since v0.1.0.

test('every fixture in the corpus manifest is actually servable', async () => {
  const cases = loadFixtureCases(ROOT);
  assert.ok(cases.length > 0);

  const unreachable = [];
  for (const fixture of cases) {
    const response = await fetch(`${base}/${fixture.path}`, { method: 'HEAD' });
    if (response.status !== 200) {
      unreachable.push(`${fixture.id} (${fixture.path}) -> HTTP ${response.status}`);
    }
  }

  assert.deepEqual(unreachable, [], `${unreachable.length} fixtures cannot be served`);
});

test('multi-page fixtures can serve every declared step', async () => {
  // A multi-page case is only usable if the whole walk is reachable, not just
  // its entry page.
  const unreachable = [];
  for (const fixture of loadFixtureCases(ROOT)) {
    for (const step of fixture.steps ?? []) {
      const response = await fetch(`${base}/${step}`, { method: 'HEAD' });
      if (response.status !== 200) unreachable.push(`${fixture.id} step ${step} -> HTTP ${response.status}`);
    }
  }
  assert.deepEqual(unreachable, []);
});

test('the pipeline family is servable, because it cannot be tested any other way', async () => {
  // FOUNDATION.md: the pipeline-tier fixtures need a served site and a real
  // browser, which is precisely why the corpus ships a server.
  const pipeline = loadFixtureCases(ROOT).filter((fixture) => fixture.fixture_family === 'pipeline');
  assert.ok(pipeline.length > 0);

  for (const fixture of pipeline) {
    const response = await fetch(`${base}/${fixture.path}`);
    assert.equal(response.status, 200, `${fixture.id} is unservable`);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  }
});

test('native artifacts are retrievable with their real media type', async () => {
  const expected = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  const native = loadFixtureCases(ROOT).filter((fixture) => fixture.fixture_family === 'native');
  assert.ok(native.length > 0);

  for (const fixture of native) {
    const response = await fetch(`${base}/${fixture.path}`);
    assert.equal(response.status, 200, `${fixture.id} is unservable`);
    const extension = fixture.path.slice(fixture.path.lastIndexOf('.'));
    assert.equal(response.headers.get('content-type'), expected[extension], `${fixture.id} media type`);
  }
});

test('every family manifest the corpus publishes is retrievable', async () => {
  for (const family of readJson('corpus-manifest.json').families) {
    const response = await fetch(`${base}/${family.file}`, { method: 'HEAD' });
    assert.equal(response.status, 200, `${family.file} is unservable`);
  }
});

test('serving more did not start serving the repository', async () => {
  // Widening the allow-list must not widen it to source or metadata.
  for (const forbidden of [
    '.git/config',
    'package-lock.json',
    'serve.mjs',
    'build.mjs',
    'check/scoring.mjs',
    'CHANGELOG.md',
    'native.mjs',
    'adjudicate.mjs',
  ]) {
    const response = await fetch(`${base}/${forbidden}`, { method: 'HEAD' });
    // 403 for dotfiles, 404 for everything else outside the allow-list. The
    // contract is that it is not served, not which refusal code is used.
    assert.notEqual(response.status, 200, `${forbidden} must not be served`);
  }
});

test('a path outside the corpus is still refused', async () => {
  for (const traversal of ['../package.json', '..%2f..%2fetc%2fpasswd', 'aaa/../../serve.mjs']) {
    const response = await fetch(`${base}/${traversal}`, { method: 'HEAD' });
    assert.notEqual(response.status, 200, `${traversal} must not resolve`);
  }
});
