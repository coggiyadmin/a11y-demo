import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { SCORING_POLICY } from './check/scoring.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const tag = `v${version}`;
const outputArgument = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`VERSION must contain a semantic version, received: ${version}`);
}

if (!outputArgument || process.argv.length !== 3) {
  console.error('usage: node release.mjs path/to/new-output-directory');
  process.exit(2);
}

const output = path.resolve(outputArgument);
if (output === ROOT || output.startsWith(`${ROOT}${path.sep}`) || fs.existsSync(output)) {
  throw new Error('release output must be a new directory outside the repository root');
}

const read = (file) => fs.readFileSync(path.join(ROOT, file));
const readText = (file) => read(file).toString('utf8');
const readJson = (file) => JSON.parse(readText(file));
const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const citation = readText('CITATION.cff');
const releaseDate = citation.match(/^date-released:\s*(\d{4}-\d{2}-\d{2})$/m)?.[1];
if (!citation.includes(`version: ${version}`) || !releaseDate) {
  throw new Error('CITATION.cff must contain the VERSION and a date-released value');
}

const changelog = readText('CHANGELOG.md');
if (!changelog.includes(`## [${version}] - ${releaseDate}`)) {
  throw new Error('CHANGELOG.md must contain a dated heading for VERSION');
}

const notesPath = `releases/${tag}.md`;
if (!fs.existsSync(path.join(ROOT, notesPath))) {
  throw new Error(`missing release notes: ${notesPath}`);
}

const manifest = readJson('corpus-manifest.json');
const resultExample = readJson('schemas/examples/benchmark-result.valid.json');
const humanProtocols = readJson('protocols/protocols.json');
const humanResultExample = readJson('protocols/examples/result.valid.json');
const doubleReviewExample = readJson('protocols/examples/double-review.json');
const pipeline = readJson('pipeline.json');
const coverage = readJson('coverage.json');
const spaceCoverage = readJson('space-coverage.json');
const surfaces = spaceCoverage.dimensions.find((dimension) => dimension.dimension === 'surfaces');
const methods = spaceCoverage.dimensions.find((dimension) => dimension.dimension === 'methods');

fs.mkdirSync(output, { recursive: true });

const assets = [
  ['corpus-manifest.json', 'corpus-manifest.json'],
  ['schemas/corpus-manifest.schema.json', 'corpus-manifest.schema.json'],
  ['schemas/benchmark-result.schema.json', 'benchmark-result.schema.json'],
  ['protocols/protocols.json', 'protocols.json'],
  ['protocols/protocols.schema.json', 'protocols.schema.json'],
  ['protocols/result.schema.json', 'human-result.schema.json'],
  ['protocols/double-review.schema.json', 'double-review.schema.json'],
  ['CITATION.cff', 'CITATION.cff'],
  ['LICENSE', 'LICENSE'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
];

for (const [source, name] of assets) {
  fs.copyFileSync(path.join(ROOT, source), path.join(output, name));
}

const metadata = {
  format: 'cognium-a11y-release-metadata',
  format_version: '1.0.0',
  release: {
    version,
    tag,
    repository: manifest.corpus.id,
    revision: git('rev-parse', 'HEAD'),
    commit_time: git('show', '-s', '--format=%cI', 'HEAD'),
  },
  corpus: {
    manifest: 'corpus-manifest.json',
    manifest_sha256: `sha256:${sha256(read('corpus-manifest.json'))}`,
    format_version: manifest.format_version,
    counts: manifest.counts,
  },
  contracts: {
    corpus_manifest: manifest.format_version,
    benchmark_result: resultExample.format_version,
    human_protocols: humanProtocols.format_version,
    human_result: humanResultExample.format_version,
    double_review: doubleReviewExample.format_version,
    // Results quote this string; recording it here lets a reader tell which
    // scoring policy was current when the snapshot was cut.
    scoring_policy: SCORING_POLICY,
  },
  included: {
    pipeline_integrity: {
      cases: pipeline.cases.length,
      pairs: new Set(pipeline.cases.map(({ pair }) => pair)).size,
    },
    human_protocols: {
      protocols: humanProtocols.protocols.length,
    },
  },
  known_gaps: {
    wcag_without_ground_truth: coverage.filter((row) => row.ground_truth === 'NONE').length,
    surfaces: surfaces
      ? { represented: surfaces.represented, total: surfaces.total, missing: surfaces.missing }
      : null,
    methods: methods
      ? { represented: methods.represented, total: methods.total, missing: methods.missing }
      : null,
  },
  limitations: [
    'A benchmark result is not a WCAG conformance claim or product certification.',
    'Represented dimensions are not necessarily executed or independently verified.',
    'Manual, assistive-technology and user-task outcomes remain separate from automated results.',
  ],
};

fs.writeFileSync(
  path.join(output, 'release-metadata.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
);

const checksumFiles = fs.readdirSync(output).sort();
const checksums = checksumFiles.map((name) => `${sha256(fs.readFileSync(path.join(output, name)))}  ${name}`);
fs.writeFileSync(path.join(output, 'SHA256SUMS'), `${checksums.join('\n')}\n`);

console.log(`release assets for ${tag}: ${output}`);
console.log(`${manifest.counts.cases} cases across ${manifest.counts.families} families`);
