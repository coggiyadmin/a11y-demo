// Zero-dependency static server for the corpus.
//
// Why a server and not file:// — a file:// page has no origin, and relative URLs,
// stylesheets and scripts behave differently under it than over HTTP. A fixture
// evaluated that way describes a page no visitor ever sees.
//
// usage: node serve.mjs [--port 8080] [--host 0.0.0.0]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', process.env.PORT || 8080));
const HOST = arg('--host', process.env.HOST || '0.0.0.0');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

createServer((req, res) => {
  // strip query, decode, and refuse anything that escapes ROOT
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  let p = normalize(join(ROOT, raw));
  if (!p.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
  res.writeHead(200, {
    'content-type': TYPES[extname(p)] || 'application/octet-stream',
    // the corpus must be read fresh every run; a cached fixture is a stale test
    'cache-control': 'no-store',
  });
  createReadStream(p).pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`corpus served on http://${HOST}:${PORT}/  (root: ${ROOT})`);
});
