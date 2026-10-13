import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const FAMILIES = [
  ['core', 'catalog.json'],
  ['delivery', 'delivery.json'],
  ['patterns', 'patterns.json'],
  ['journeys', 'journeys.json'],
  ['scenarios', 'scenarios.json'],
  ['media', 'media.json'],
  ['flash', 'flash.json'],
  ['color-independent', 'color-independent.json'],
  ['ui-states', 'ui-states.json'],
  ['surfaces', 'surfaces.json'],
  ['guided', 'guided.json'],
];

function canonicalContentDigest(document) {
  const copy = structuredClone(document);
  delete copy.generated;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex')}`;
}

const families = FAMILIES.map(([id, file]) => {
  const document = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  if (!Array.isArray(document.cases)) throw new Error(`${file} must expose a cases array`);

  return {
    id,
    file,
    case_count: document.cases.length,
    content_sha256: canonicalContentDigest(document),
  };
});

const manifest = {
  $schema: './schemas/corpus-manifest.schema.json',
  format: 'cognium-a11y-corpus-manifest',
  format_version: '1.0.0',
  corpus: {
    id: 'cogniumhq/a11y-demo',
    default_branch: 'master',
  },
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    families: families.length,
    cases: families.reduce((sum, family) => sum + family.case_count, 0),
  },
  digest_policy: 'SHA-256 of parsed family JSON with the top-level generated field removed, serialized with JSON.stringify.',
  families,
};

fs.writeFileSync(path.join(ROOT, 'corpus-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${manifest.counts.cases} cases across ${manifest.counts.families} families written to corpus-manifest.json`);
