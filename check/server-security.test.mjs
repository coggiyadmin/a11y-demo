import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { startCorpusServer } from '../serve.mjs';

let server;
let port;

before(async () => {
  server = startCorpusServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  port = server.address().port;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves fixture documents and HEAD responses', async () => {
  const get = await request('/index.html');
  assert.equal(get.status, 200);
  assert.match(get.body.toString(), /Accessibility fixture corpus/);

  const head = await request('/index.html', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
});

test('does not expose repository metadata or source files', async () => {
  assert.equal((await request('/.git/config')).status, 403);
  assert.equal((await request('/serve.mjs')).status, 404);
  assert.equal((await request('/Dockerfile')).status, 404);
});

test('rejects traversal and malformed URL encoding without terminating', async () => {
  assert.notEqual((await request('/%2e%2e/%2e%2e/etc/passwd')).status, 200);
  assert.equal((await request('/%')).status, 400);
  assert.equal((await request('/index.html')).status, 200);
});

test('rejects methods that can change state', async () => {
  assert.equal((await request('/index.html', 'POST')).status, 405);
});
