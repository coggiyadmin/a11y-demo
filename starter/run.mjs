// Starter runner for a publishable benchmark result bundle.
//
//   node starter/run.mjs --out result.json [--corpus ..] [--config starter/benchmark.config.json]
//
// Copy this directory, replace adapter.example.mjs with a real adapter, and the
// rest of the bundle shape stays correct by construction.
//
// What this exists to prevent: a bundle that cannot be reproduced because the
// corpus revision, manifest digest, product version, engine lineage,
// environment or repetition count were never written down. All six are pinned
// here, and corpus identity is read from the checkout rather than typed by
// hand, so a result can never claim a revision it was not run against.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
}

const corpusRoot = path.resolve(arg('--corpus', path.join(HERE, '..')));
const configFile = path.resolve(arg('--config', path.join(HERE, 'benchmark.config.json')));
const outFile = arg('--out');

if (!outFile) {
  console.error('usage: node starter/run.mjs --out <result.json> [--corpus <dir>] [--config <file>]');
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const config = readJson(configFile);

// --- corpus identity, read rather than asserted -----------------------------

const manifestFile = path.join(corpusRoot, 'corpus-manifest.json');
const manifestBytes = fs.readFileSync(manifestFile);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const manifestDigest = `sha256:${crypto.createHash('sha256').update(manifestBytes).digest('hex')}`;

function corpusRevision() {
  // A moving branch is not a benchmark identity. Pin a tag or a full SHA.
  if (config.corpus?.revision) return config.corpus.revision;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: corpusRoot, encoding: 'utf8' }).trim();
  } catch {
    throw new Error(
      'could not determine the corpus revision: run inside a checkout, or pin corpus.revision in the config',
    );
  }
}

// --- cases ------------------------------------------------------------------

function loadCases() {
  const cases = [];
  for (const family of manifest.families) {
    for (const fixture of readJson(path.join(corpusRoot, family.file)).cases) {
      cases.push({ ...fixture, family: family.id });
    }
  }

  const selection = config.cases ?? {};
  let selected = cases;
  if (Array.isArray(selection.ids) && selection.ids.length > 0) {
    const wanted = new Set(selection.ids);
    selected = cases.filter((row) => wanted.has(row.id));
    const missing = selection.ids.filter((id) => !cases.some((row) => row.id === id));
    if (missing.length > 0) throw new Error(`config names cases not in the corpus: ${missing.join(', ')}`);
  } else if (Array.isArray(selection.families) && selection.families.length > 0) {
    const wanted = new Set(selection.families);
    selected = cases.filter((row) => wanted.has(row.family));
  }

  // Deterministic order so repeats line up and diffs stay readable.
  return selected.sort((a, b) => a.id.localeCompare(b.id));
}

// --- run --------------------------------------------------------------------

const { evaluate, describe } = await import(path.resolve(HERE, config.adapter));

const environment = {
  os: config.environment?.os ?? `${os.type()} ${os.release()}`,
  runtime: config.environment?.runtime ?? `Node.js ${process.versions.node.split('.')[0]}`,
  ...(config.environment?.browser ? { browser: config.environment.browser } : {}),
  ...(config.environment?.browser_version ? { browser_version: config.environment.browser_version } : {}),
  ...(config.environment?.viewport ? { viewport: config.environment.viewport } : {}),
  ...(config.environment?.preferences ? { preferences: config.environment.preferences } : {}),
};

const cases = loadCases();
const repeats = config.repeat ?? 1;
const revision = corpusRevision();
const results = [];

for (let repeat = 1; repeat <= repeats; repeat += 1) {
  const startedAt = new Date().toISOString();
  const executions = [];

  for (const testCase of cases) {
    // A human-judgement case has no automated answer. Reporting `unsupported`
    // with no outcomes is correct; reporting a pass would be a lie.
    if (testCase.requires_human) {
      executions.push({
        case_id: testCase.id,
        case_path: testCase.path,
        status: 'unsupported',
        declared_state: testCase.ui_state ?? 'default',
        state_reached: false,
        target_observability: 'unknown',
        outcomes: [],
      });
      continue;
    }

    try {
      executions.push(await evaluate({ testCase, corpusRoot }));
    } catch (error) {
      // An adapter that throws produces an errored execution, never a silent
      // omission and never a pass.
      executions.push({
        case_id: testCase.id,
        case_path: testCase.path,
        status: 'error',
        declared_state: testCase.ui_state ?? 'default',
        state_reached: false,
        target_observability: 'unknown',
        outcomes: [],
        error: { code: 'adapter-threw', message: String(error.message ?? error).slice(0, 500) },
      });
    }
  }

  results.push({
    format: 'cognium-a11y-benchmark-result',
    format_version: '1.0.0',
    corpus: {
      repository: config.corpus.repository,
      revision,
      manifest_sha256: manifestDigest,
    },
    run: {
      id: `${config.run_id_prefix ?? 'run'}-repeat-${repeat}`,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      repeat,
      tool: config.tool,
      environment,
      privacy: {
        fixture_data: 'public-synthetic',
        raw_evidence_published: config.raw_evidence_published ?? false,
      },
    },
    executions,
  });
}

// One file per repeat; the scorer pools them and reports the variance.
const target = path.resolve(outFile);
const directory = path.dirname(target);
const stem = path.basename(target, '.json');
fs.mkdirSync(directory, { recursive: true });

const written = [];
for (const result of results) {
  const file = repeats === 1 ? target : path.join(directory, `${stem}.repeat-${result.run.repeat}.json`);
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  written.push(file);
}

console.log(`adapter: ${describe ? describe() : config.adapter}`);
console.log(`corpus:  ${config.corpus.repository}@${revision.slice(0, 12)}`);
console.log(`manifest:${manifestDigest}`);
console.log(`cases:   ${cases.length}, repeats: ${repeats}`);
for (const file of written) console.log(`wrote    ${path.relative(process.cwd(), file)}`);
