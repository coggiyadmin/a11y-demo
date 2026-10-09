// Zero-dependency static server for the corpus.
//
// Why a server and not file:// — a file:// page has no origin, and relative URLs,
// stylesheets and scripts behave differently under it than over HTTP. A fixture
// evaluated that way describes a page no visitor ever sees.
//
// usage: node serve.mjs [--port 8080] [--host 0.0.0.0]
import { createServer } from 'node:http';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', process.env.PORT || 8080));
const HOST = arg('--host', process.env.HOST || '0.0.0.0');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.vtt': 'text/vtt; charset=utf-8',
};

const PUBLIC_DIRECTORIES = new Set([
  'act', 'capture', 'color-independent', 'delivery', 'flash', 'guided', 'journeys',
  'keyboard', 'media', 'patterns', 'scenarios', 'static', 'surfaces', 'taxonomy',
  'ui-states', 'wcag',
]);

const PUBLIC_ROOT_FILES = new Set([
  'index.html', 'fixture.css', 'pixel.png', 'catalog.json', 'coverage.csv',
  'coverage.json', 'needs-index.json', 'space-coverage.json', 'delivery.json',
  'patterns.json', 'color-independent.json', 'media.json', 'ui-states.json',
  'journeys.json', 'scenarios.json', 'surfaces.json', 'guided.json', 'flash.json',
]);

const text = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
};

const relativeTo = (root, target) => relative(root, target).split(sep).join('/');
const escapes = (rel) => rel === '..' || rel.startsWith('../') || isAbsolute(rel);

export function createCorpusHandler(root = ROOT) {
  const publicRoot = realpathSync(root);

  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD');
      text(res, 405, 'method not allowed');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://corpus.invalid').pathname);
    } catch {
      text(res, 400, 'bad request');
      return;
    }

    let candidate = resolve(publicRoot, `.${pathname.startsWith('/') ? pathname : `/${pathname}`}`);
    const requestedRelative = relativeTo(publicRoot, candidate);
    if (escapes(requestedRelative)) { text(res, 403, 'forbidden'); return; }

    if (existsSync(candidate) && statSync(candidate).isDirectory()) candidate = join(candidate, 'index.html');
    if (!existsSync(candidate) || !statSync(candidate).isFile()) { text(res, 404, 'not found'); return; }

    // Resolve symlinks before checking containment so a future fixture cannot point
    // outside the corpus. Dot paths are never public, even when they exist.
    const real = realpathSync(candidate);
    const rel = relativeTo(publicRoot, real);
    if (escapes(rel) || rel.split('/').some((part) => part.startsWith('.'))) {
      text(res, 403, 'forbidden');
      return;
    }

    const [top] = rel.split('/');
    const type = TYPES[extname(real).toLowerCase()];
    const allowed = PUBLIC_ROOT_FILES.has(rel) || PUBLIC_DIRECTORIES.has(top);
    if (!allowed || !type) { text(res, 404, 'not found'); return; }

    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(real).on('error', () => res.destroy()).pipe(res);
  };
}

export function startCorpusServer({ root = ROOT, host = HOST, port = PORT } = {}) {
  const server = createServer(createCorpusHandler(root));
  return server.listen(port, host, () => {
    const address = server.address();
    const boundPort = typeof address === 'object' && address ? address.port : port;
    console.log(`corpus served on http://${host}:${boundPort}/  (root: ${root})`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startCorpusServer();
}
