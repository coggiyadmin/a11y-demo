// Reconcile a multi-engine baseline against reviewed ground-truth decisions.
//
//   node adjudicate.mjs <result.json> [more-results.json ...]
//
// An assertion that no engine reports is not thereby wrong, and not thereby
// right. It is a question. Without somewhere to record the answer, the question
// is re-asked on every run and never settled -- which is how a corpus ends up
// asserting things nobody has checked.
//
// This reads result files, finds the assertions every engine stayed silent on,
// and reports them against `adjudication.json`: already reviewed, awaiting
// review, or reviewed against ground truth that has since changed.
//
// It deliberately does not decide anything. A decision needs a person and a
// public source, and the schema will not accept one without both.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCorpus } from './check/scoring.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export const ADJUDICATION_FILE = 'adjudication.json';

/**
 * Which true-positive assertions no supplied run reported as a failure.
 *
 * `reported` is deliberately narrow: an engine that emitted a pass or an
 * inapplicable for the criterion evaluated it and decided against reporting,
 * which is a different fact and is tracked separately as `evaluated`.
 */
export function silentAssertions(corpus, results) {
  const reported = new Set();
  const evaluated = new Set();

  for (const result of results) {
    for (const execution of result.executions) {
      for (const outcome of execution.outcomes ?? []) {
        const key = `${execution.case_id}|${outcome.criterion}`;
        evaluated.add(key);
        if (outcome.verdict === 'fail' && outcome.findings > 0) reported.add(key);
      }
    }
  }

  const silent = [];
  for (const fixture of corpus.cases.values()) {
    if (fixture.requires_human === true || fixture.mode === 'guided') continue;
    for (const criterion of Object.keys(fixture.min_criteria ?? {})) {
      const key = `${fixture.id}|${criterion}`;
      if (reported.has(key)) continue;
      silent.push({
        case_id: fixture.id,
        criterion,
        family: fixture.family,
        // An engine that evaluated the criterion and did not report it is a
        // stronger signal than one that never looked.
        evaluated_by_some_engine: evaluated.has(key),
      });
    }
  }

  return silent.sort((a, b) => a.case_id.localeCompare(b.case_id) || a.criterion.localeCompare(b.criterion));
}

/**
 * Split decisions into those that still describe their family and those that
 * do not.
 *
 * Scoped per family on purpose. The evidence ledger keys expiry on the whole
 * corpus digest, and adding two families expired all 72 of its records at once;
 * a decision about one fixture should not be invalidated by an unrelated
 * addition elsewhere.
 */
export function partitionDecisions(adjudication, manifest) {
  const digests = new Map(manifest.families.map((family) => [family.id, family.content_sha256]));
  const current = new Map();
  const stale = [];

  for (const decision of adjudication.decisions ?? []) {
    const live = digests.get(decision.family);
    if (live && live === decision.family_sha256) {
      current.set(`${decision.case_id}|${decision.criterion}`, decision);
    } else {
      stale.push({
        ...decision,
        stale_reason: live
          ? `family ${decision.family} changed since review`
          : `family ${decision.family} no longer exists`,
      });
    }
  }

  return { current, stale };
}

export function reconcile({ corpus, manifest, adjudication, results }) {
  const silent = silentAssertions(corpus, results);
  const { current, stale } = partitionDecisions(adjudication, manifest);

  const adjudicated = [];
  const awaiting = [];

  for (const assertion of silent) {
    const decision = current.get(`${assertion.case_id}|${assertion.criterion}`);
    if (decision) adjudicated.push({ ...assertion, outcome: decision.outcome, source: decision.source });
    else awaiting.push(assertion);
  }

  // A decision that no longer corresponds to a silent assertion is worth
  // surfacing: either an engine now reports it, or the case changed.
  const silentKeys = new Set(silent.map((row) => `${row.case_id}|${row.criterion}`));
  const superseded = [...current.values()].filter(
    (decision) => !silentKeys.has(`${decision.case_id}|${decision.criterion}`),
  );

  return { silent, adjudicated, awaiting, stale, superseded };
}

function render(report, results) {
  const lines = [];
  const engines = [...new Set(results.map((result) => `${result.run.tool.name} ${result.run.tool.version}`))].sort();

  lines.push(`engines consulted   ${engines.length}`);
  for (const engine of engines) lines.push(`  ${engine}`);
  lines.push('');
  lines.push(`assertions no engine reported   ${report.silent.length}`);
  lines.push(`  already reviewed              ${report.adjudicated.length}`);
  lines.push(`  awaiting review               ${report.awaiting.length}`);
  lines.push('');

  if (report.adjudicated.length > 0) {
    const byOutcome = report.adjudicated.reduce((totals, row) => {
      totals[row.outcome] = (totals[row.outcome] ?? 0) + 1;
      return totals;
    }, {});
    lines.push('reviewed outcomes');
    for (const [outcome, count] of Object.entries(byOutcome).sort()) {
      lines.push(`  ${outcome.padEnd(28)} ${count}`);
    }
    lines.push('');
  }

  if (report.awaiting.length > 0) {
    const byFamily = report.awaiting.reduce((totals, row) => {
      totals[row.family] = (totals[row.family] ?? 0) + 1;
      return totals;
    }, {});
    lines.push('awaiting review, by family');
    for (const [family, count] of Object.entries(byFamily).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${family.padEnd(20)} ${count}`);
    }

    const looked = report.awaiting.filter((row) => row.evaluated_by_some_engine);
    if (looked.length > 0) {
      lines.push('');
      lines.push(`  ${looked.length} of these were evaluated by an engine that then did not report them,`);
      lines.push('  which is a stronger signal than silence from an engine that never looked.');
      for (const row of looked.slice(0, 10)) lines.push(`    ${row.case_id} ${row.criterion}`);
      if (looked.length > 10) lines.push(`    ... ${looked.length - 10} more`);
    }
    lines.push('');
  }

  if (report.stale.length > 0) {
    lines.push(`decisions whose family changed since review   ${report.stale.length}`);
    for (const row of report.stale.slice(0, 10)) {
      lines.push(`  ${row.case_id} ${row.criterion} — ${row.stale_reason}`);
    }
    lines.push('');
  }

  if (report.superseded.length > 0) {
    lines.push(`reviewed assertions an engine now reports   ${report.superseded.length}`);
    for (const row of report.superseded.slice(0, 10)) lines.push(`  ${row.case_id} ${row.criterion}`);
    lines.push('  Re-review: the reason for the original decision may no longer hold.');
    lines.push('');
  }

  lines.push('Two engines agreeing on silence flags a question. It does not settle one.');
  lines.push('A decision needs a reviewer and a public source; see adjudication.json.');

  return lines.join('\n');
}

function main() {
  const files = process.argv.slice(2).filter((value) => !value.startsWith('--'));
  if (files.length === 0) {
    console.error('usage: node adjudicate.mjs <result.json> [more-results.json ...]');
    process.exit(2);
  }

  const corpus = loadCorpus(ROOT);
  const manifest = readJson(path.join(ROOT, 'corpus-manifest.json'));
  const adjudication = readJson(path.join(ROOT, ADJUDICATION_FILE));
  const results = files.map((file) => readJson(path.resolve(file)));

  const report = reconcile({ corpus, manifest, adjudication, results });
  console.log(render(report, results));

  // Non-zero while questions remain open, so a review backlog is visible to CI
  // rather than silently accumulating.
  process.exit(report.awaiting.length > 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
