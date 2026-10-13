// Derive evidence-ledger records from a published result bundle.
//
//   node ingest-results.mjs <bundle-directory> [--apply]
//
// The maturity model promotes a dimension value to `executed` only when the
// ledger says a runner produced evidence for it. Hand-authoring those records
// would make the ledger an assertion rather than a derivation, so this reads
// published bundles instead.
//
// Two rules decide what a result bundle is allowed to prove.
//
// 1. Trust runs one way. A bundle is evidence that something ran. It can never
//    assert `represented` or `executable`, which are facts about the corpus,
//    and the ledger schema rejects a record that tries.
//
// 2. A run proves only what it actually exercised. Executing a case tagged
//    `input_at: [keyboard, sr-nvda]` with an automated scanner does not mean a
//    screen-reader pairing was exercised; the fixture *names* those inputs, the
//    run did not necessarily use them. Promoting every dimension a case names
//    would reintroduce the represented-for-executed confusion one level down.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { corpusContentDigest } from './corpus-identity.mjs';
import { loadFixtureCases } from './fixture-families.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

export class IngestError extends Error {}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (buffer) => `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
// Slug one id segment. Segments are joined with "." and the ledger schema
// allows "-" and "." only between alphanumeric runs, so each part is trimmed
// independently and never truncated into a trailing separator.
const slug = (value, limit = 48) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, limit)
    .replace(/^-+|-+$/g, '');

/** Compose a record id from parts that are each already safe. */
const recordId = (...parts) => parts.map((part) => slug(part)).filter(Boolean).join('.');

// Which dimensions an automated result may promote, and why the rest may not.
export const PROMOTABLE = Object.freeze({
  surfaces: 'the artifact for this surface was actually processed',
  'ui-states': 'the run declared this state and reported reaching it',
  journeys: 'the run reached the declared state of a case on this journey',
});

export const NOT_PROMOTABLE = Object.freeze({
  'input-at':
    'a result file does not record which input modality was exercised. An automated run over a '
    + 'case tagged sr-nvda is not evidence that a screen-reader pairing was used.',
  methods:
    'the method a runner used is not derivable from the executions; the case names candidate '
    + 'methods, not the one taken.',
  'user-needs':
    'functional needs are mapped attributes of the criteria a case exercises, not something a run '
    + 'executes.',
});

const CLASSIFICATION = Object.freeze({
  'maintainer-authored': 'maintainer',
  'vendor-authored': 'vendor',
  independent: 'independent',
  academic: 'academic',
});

/**
 * Resolve the ground truth a bundle was captured against.
 *
 * The result schema pins a corpus revision, not a content digest, so the digest
 * is recomputed from the manifest as it stood at that revision. Reading it out
 * of git means no checkout is needed and the answer is exact.
 *
 * Fails closed: a revision this clone does not hold cannot be verified, and
 * guessing would silently attach evidence to the wrong ground truth.
 */
export function contentDigestAtRevision(revision, root = ROOT) {
  let manifest;
  try {
    manifest = execFileSync('git', ['show', `${revision}:corpus-manifest.json`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new IngestError(
      `corpus revision ${revision} is not in this clone, so the ground truth it was measured `
        + 'against cannot be verified. Fetch it and run again.',
    );
  }
  return corpusContentDigest(JSON.parse(manifest));
}

/**
 * The dimension values one result file demonstrably executed.
 *
 * Only completed executions count, and a state-bearing dimension additionally
 * requires the run to have reached the state it declared.
 */
export function executedValues(result, casesById) {
  const values = new Map(Object.keys(PROMOTABLE).map((dimension) => [dimension, new Set()]));

  for (const execution of result.executions) {
    if (execution.status !== 'completed') continue;
    const fixture = casesById.get(execution.case_id);
    if (!fixture) continue;

    if (fixture.surface) values.get('surfaces').add(fixture.surface);

    // A declared state that was not reached proves nothing about that state.
    if (execution.state_reached !== true) continue;
    if (execution.declared_state) values.get('ui-states').add(execution.declared_state);
    if (fixture.journey) values.get('journeys').add(fixture.journey);
  }

  return values;
}

/** Build ledger records for every tool in a bundle. */
export function recordsForBundle({ bundleDir, publication, casesById, contentDigest, today }) {
  const records = [];
  const reproduction = CLASSIFICATION[publication.classification];
  if (!reproduction) {
    throw new IngestError(
      `unknown publication classification "${publication.classification}"; expected one of `
        + Object.keys(CLASSIFICATION).join(', '),
    );
  }

  const resultFiles = fs
    .readdirSync(bundleDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(bundleDir, entry.name, 'result.json'))
    .filter((file) => fs.existsSync(file))
    .sort();

  for (const file of resultFiles) {
    const bytes = fs.readFileSync(file);
    const result = JSON.parse(bytes.toString('utf8'));
    const tool = result.run.tool;
    const toolSlug = slug(`${tool.name}-${tool.version}`);
    const digest = sha256(bytes);

    const environment = { os: result.run.environment.os, runtime: result.run.environment.runtime };
    if (result.run.environment.browser) environment.browser = result.run.environment.browser;
    if (result.run.environment.browser_version) {
      environment.browser_version = result.run.environment.browser_version;
    }

    for (const [dimension, values] of executedValues(result, casesById)) {
      for (const value of [...values].sort()) {
        records.push({
          id: recordId(publication.id, toolSlug, dimension, value),
          dimension,
          value,
          // Only ever `executed`. A bundle is a run, not a review; `verified`
          // requires a named reviewer and is not derivable from a result file.
          state: 'executed',
          runner: {
            kind: 'automated-harness',
            id: slug(tool.name),
            version: tool.version,
          },
          environment,
          artifact: {
            type: 'benchmark-result',
            uri: `${publication.contact?.issues ?? ''}`.replace(/\/issues$/, '')
              + `/tree/main/${path.relative(path.join(bundleDir, '../..'), file)}`,
            sha256: digest,
          },
          reproduction_class: reproduction,
          captured_against: {
            corpus_content_digest: contentDigest,
            corpus_revision: result.corpus.revision,
          },
          recorded_on: today,
          notes: `Derived from published bundle ${publication.id} by ingest-results.mjs.`,
        });
      }
    }
  }

  return records;
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const bundleDir = path.resolve(argv.find((value) => !value.startsWith('--')) ?? '');

  if (!argv.some((value) => !value.startsWith('--'))) {
    console.error('usage: node ingest-results.mjs <bundle-directory> [--apply]');
    process.exit(2);
  }

  const publicationFile = path.join(bundleDir, 'publication.json');
  if (!fs.existsSync(publicationFile)) {
    console.error(`no publication.json in ${bundleDir}`);
    process.exit(2);
  }

  const publication = readJson(publicationFile);
  const casesById = new Map(loadFixtureCases(ROOT).map((fixture) => [fixture.id, fixture]));
  const today = new Date().toISOString().slice(0, 10);

  let contentDigest;
  try {
    contentDigest = contentDigestAtRevision(publication.corpus.revision);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const records = recordsForBundle({ bundleDir, publication, casesById, contentDigest, today });
  const ledger = readJson(path.join(ROOT, 'evidence/ledger.json'));
  const current = corpusContentDigest(readJson(path.join(ROOT, 'corpus-manifest.json')));
  const stale = contentDigest !== current;

  const existing = new Set(ledger.records.map((record) => record.id));
  const added = records.filter((record) => !existing.has(record.id));

  console.log(`bundle           ${publication.id}`);
  console.log(`classification   ${publication.classification} -> ${CLASSIFICATION[publication.classification]}`);
  console.log(`corpus revision  ${publication.corpus.revision}`);
  console.log(`content digest   ${contentDigest}`);
  console.log(`current corpus   ${current}`);
  console.log(`records derived  ${records.length} (${added.length} new)`);

  const byDimension = records.reduce((totals, record) => {
    totals[record.dimension] = (totals[record.dimension] ?? 0) + 1;
    return totals;
  }, {});
  for (const [dimension, count] of Object.entries(byDimension)) {
    console.log(`  ${dimension.padEnd(12)} ${count}`);
  }

  console.log('\nnot promoted from this bundle:');
  for (const [dimension, reason] of Object.entries(NOT_PROMOTABLE)) {
    console.log(`  ${dimension.padEnd(12)} ${reason}`);
  }

  if (stale) {
    console.log(
      '\nThis bundle was captured against different ground truth than the corpus now holds.\n'
        + 'Its records are ingested and will be reported under stale_evidence, not as executed.\n'
        + 'Re-running the bundle against the current corpus is what would make them count.',
    );
  }

  if (!apply) {
    console.log('\n--apply not given; nothing written.');
    return;
  }

  ledger.records = [...ledger.records, ...added].sort((a, b) => a.id.localeCompare(b.id));
  ledger.generated = today;
  fs.writeFileSync(path.join(ROOT, 'evidence/ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`\nwrote ${added.length} record(s) to evidence/ledger.json`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
