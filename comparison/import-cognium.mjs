import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadFixtureCases } from '../fixture-families.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const source = option('--source');
const output = path.resolve(option('--out', path.join(HERE, 'cognium-results.json')));
if (!source) {
  console.error('usage: node import-cognium.mjs --source <Cognium report directory> [--out <file>]');
  process.exit(2);
}

const sourceDir = path.resolve(source);
const report = JSON.parse(fs.readFileSync(path.join(sourceDir, 'report.json'), 'utf8'));
const graph = JSON.parse(fs.readFileSync(path.join(sourceDir, 'proofgraph-all-pages.json'), 'utf8'));
const suite = JSON.parse(fs.readFileSync(path.join(HERE, 'suite.json'), 'utf8'));
const fixtureById = new Map(loadFixtureCases(ROOT).map((fixture) => [fixture.id, fixture]));
const cases = suite.case_ids.map((id) => {
  const fixture = fixtureById.get(id);
  assert.ok(fixture, `unknown comparison fixture: ${id}`);
  return fixture;
});

assert.equal(report.counts?.['run-errors'], 0, 'Cognium report has run errors');
assert.equal(report.counts?.['outside-the-proofgraph'], 0, 'Cognium report has records outside the proofgraph');
assert.equal(report.hydration?.failed, 0, 'Cognium report has page-build failures');
assert.equal(report.hydration?.['capture-misses'], 0, 'Cognium report has incomplete capture dependencies');
assert.equal(report.hydration?.reproduced, report.hydration?.pages, 'Cognium report has non-reproducible pages');

const nodesByPage = new Map();
for (const node of graph.nodes || []) {
  const criterion = /^wcag@2\.2:(\d+\.\d+\.\d+)$/.exec(String(node.obligation || ''))?.[1];
  const page = node.anchorSet?.type === 'product' ? node.anchorSet.content : null;
  if (!criterion || !page || page === 'site') continue;
  const nodes = nodesByPage.get(page) || [];
  nodes.push({ ...node, criterion });
  nodesByPage.set(page, nodes);
}

const normalizedCases = cases.map((testCase) => {
  const nodes = nodesByPage.get(testCase.path) || [];
  assert.ok(nodes.length, `Cognium proofgraph has no WCAG nodes for ${testCase.path}`);

  const grouped = new Map();
  const reviewRecords = new Set();
  for (const node of nodes) {
    for (const recordId of node.records || []) {
      const witness = graph.witnesses?.[recordId];
      if (!witness) continue;
      if (witness.verdict === 'abstain') reviewRecords.add(recordId);
      if (witness.verdict !== 'deviation') continue;

      const rule = witness.control || 'unknown-control';
      const item = grouped.get(rule) || {
        rule,
        criteria: new Set(),
        records: new Map(),
      };
      item.criteria.add(node.criterion);
      if (!item.records.has(recordId)) {
        const count = Array.isArray(witness.failing) && witness.failing.length
          ? witness.failing.length
          : Math.max(1, Number(witness.counts?.deviations) || 0);
        item.records.set(recordId, count);
      }
      grouped.set(rule, item);
    }
  }

  const findings = [...grouped.values()].map((item) => ({
    rule: item.rule,
    count: [...item.records.values()].reduce((sum, count) => sum + count, 0),
    criteria: [...item.criteria].sort(),
  })).sort((a, b) => a.rule.localeCompare(b.rule));

  return {
    id: testCase.id,
    path: testCase.path,
    automated_findings: findings.reduce((sum, finding) => sum + finding.count, 0),
    manual_review_items: reviewRecords.size,
    found_criteria: [...new Set(findings.flatMap((finding) => finding.criteria))].sort(),
    findings,
  };
});

const lock = report['derived-from']?.lock || {};
const packVersions = Object.entries(lock.packs || {}).map(([id, version]) => `${id}@${version}`);
const exported = {
  schema_version: 1,
  product: 'Cognium',
  version: packVersions.join(' + ') || 'unversioned',
  generated: report.generated,
  source_view: 'all declared comparison pages, as built in the browser',
  capture: {
    digest: report.pin,
    fixture_pages: cases.length,
    hydrated_pages: report.hydration.pages,
    support_pages: Math.max(0, report.hydration.pages - cases.length),
    capture_misses: report.hydration['capture-misses'],
    reproduced_pages: report.hydration.reproduced,
    run_errors: report.counts['run-errors'],
  },
  environment: {
    browser: `Chromium ${report.environment?.chromium}`,
    platform: report.environment?.platform,
    viewport: report.environment?.viewport,
  },
  versions: {
    packs: lock.packs || {},
    catalogs: lock.catalogs || {},
    drivers: lock.drivers || {},
    datasets: lock.datasets || {},
  },
  cases: normalizedCases,
};

fs.writeFileSync(output, `${JSON.stringify(exported, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, output)} from a sanitized Cognium all-pages proofgraph`);
