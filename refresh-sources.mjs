// Reviewed refresh of the standards-derived inputs.
//
//   node refresh-sources.mjs --check            report drift, write nothing
//   node refresh-sources.mjs --apply            re-derive the vendored snapshots
//   node refresh-sources.mjs --check --offline --from <dir>   use local copies
//
// Three rules shape this file.
//
// 1. A refresh must never silently change benchmark identity. Every run reports
//    what moved -- rule ids, test-case ids, expected outcomes, transformed
//    fields -- and which local fixtures are affected, so a reviewer can see the
//    consequence before accepting it.
// 2. It fails closed. An upstream that has been removed, or whose licence
//    string has changed, stops the run. It does not get quietly re-vendored
//    under terms nobody checked.
// 3. It never pushes. The workflow opens a pull request; a person merges it.
//
// Releases keep referencing the immutable snapshot committed here, not live
// upstream content.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadFixtureCases } from './fixture-families.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

export const SOURCES_FILE = 'sources.json';

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const today = () => new Date().toISOString().slice(0, 10);

// --- transforms -------------------------------------------------------------
//
// Each vendored file is a mechanical reduction of an upstream document. The
// transform lives here so a refresh reproduces it exactly; if a transform and
// its committed output ever disagree, that is drift worth failing on.

export function transformWcag(upstream, previous) {
  const criteria = [];
  for (const principle of upstream.principles) {
    for (const guideline of principle.guidelines) {
      for (const criterion of guideline.successcriteria) {
        criteria.push({
          num: criterion.num,
          handle: criterion.handle,
          // Upstream carries an empty string for a criterion with no level --
          // only 4.1.1, which 2.2 removed. Normalise it to null: absence of a
          // level is not a level named "". Without this the transform fails to
          // reproduce the committed index and every refresh reports a change
          // that upstream never made.
          level: criterion.level === '' ? null : criterion.level,
          principle: principle.handle,
          principle_num: principle.num,
          guideline: guideline.handle,
          guideline_num: guideline.num,
          versions: criterion.versions,
          // 4.1.1 Parsing was removed in 2.2 and is kept with in_2_2 false so
          // the index still explains the gap in the numbering.
          in_2_2: criterion.versions.includes('2.2'),
        });
      }
    }
  }

  const counts = {
    total: criteria.length,
    in_2_2: criteria.filter((row) => row.in_2_2).length,
    A: criteria.filter((row) => row.in_2_2 && row.level === 'A').length,
    AA: criteria.filter((row) => row.in_2_2 && row.level === 'AA').length,
    AAA: criteria.filter((row) => row.in_2_2 && row.level === 'AAA').length,
  };

  return {
    source: previous.source,
    source_url: previous.source_url,
    source_data: previous.source_data,
    license: previous.license,
    note: previous.note,
    extracted: today(),
    counts,
    criteria,
  };
}

export function transformAct(upstream) {
  // The ACT catalogue is vendored as published. Reducing it would discard the
  // expected outcomes the corpus measures against.
  return upstream;
}

const TRANSFORMS = { wcag: transformWcag, act: transformAct };

// --- diffs ------------------------------------------------------------------

const keyBy = (rows, pick) => new Map(rows.map((row) => [pick(row), row]));

/** Added, removed and changed criteria, restricted to the transformed fields. */
export function diffWcag(before, after) {
  const was = keyBy(before.criteria, (row) => row.num);
  const now = keyBy(after.criteria, (row) => row.num);

  const added = [...now.keys()].filter((num) => !was.has(num)).sort();
  const removed = [...was.keys()].filter((num) => !now.has(num)).sort();
  const changed = [];

  for (const [num, current] of now) {
    const previous = was.get(num);
    if (!previous) continue;
    const fields = Object.keys(current).filter(
      (field) => JSON.stringify(current[field]) !== JSON.stringify(previous[field]),
    );
    if (fields.length > 0) {
      changed.push({
        num,
        fields: fields.map((field) => ({
          field,
          from: previous[field],
          to: current[field],
        })),
      });
    }
  }

  return { added, removed, changed: changed.sort((a, b) => a.num.localeCompare(b.num)) };
}

/** Added, removed and changed rules, test cases and expected outcomes. */
export function diffAct(before, after) {
  const caseKey = (row) => `${row.ruleId}|${row.testcaseId ?? row.url ?? row.testcaseTitle}`;
  const was = keyBy(before.testcases, caseKey);
  const now = keyBy(after.testcases, caseKey);

  const rulesBefore = new Set(before.testcases.map((row) => row.ruleId));
  const rulesAfter = new Set(after.testcases.map((row) => row.ruleId));

  const outcomeChanges = [];
  for (const [key, current] of now) {
    const previous = was.get(key);
    if (!previous) continue;
    if (previous.expected !== current.expected) {
      outcomeChanges.push({
        rule_id: current.ruleId,
        testcase: key.split('|')[1],
        from: previous.expected,
        to: current.expected,
      });
    }
  }

  const criteriaOf = (row) =>
    Object.keys(row.ruleAccessibilityRequirements ?? {})
      .map((requirement) => requirement.match(/^wcag2\d:(.+)$/)?.[1])
      .filter(Boolean);

  const affectedCriteria = new Set();
  for (const key of [...now.keys(), ...was.keys()]) {
    const current = now.get(key);
    const previous = was.get(key);
    if (current && previous && current.expected === previous.expected) continue;
    for (const criterion of criteriaOf(current ?? previous)) affectedCriteria.add(criterion);
  }

  return {
    rules_added: [...rulesAfter].filter((id) => !rulesBefore.has(id)).sort(),
    rules_removed: [...rulesBefore].filter((id) => !rulesAfter.has(id)).sort(),
    testcases_added: [...now.keys()].filter((key) => !was.has(key)).sort(),
    testcases_removed: [...was.keys()].filter((key) => !now.has(key)).sort(),
    expected_outcome_changes: outcomeChanges.sort((a, b) => a.rule_id.localeCompare(b.rule_id)),
    affected_criteria: [...affectedCriteria].sort(),
    counts: { before: before.testcases.length, after: after.testcases.length },
  };
}

/**
 * Which local fixtures assert a criterion that moved.
 *
 * A standards refresh that changes a criterion the corpus asserts on is not a
 * dependency bump; it can invalidate ground truth. Naming the fixtures makes
 * that reviewable instead of implicit.
 */
export function fixtureImpact(criteria, cases) {
  const affected = new Set(criteria);
  if (affected.size === 0) return [];

  const impacted = [];
  for (const testCase of cases) {
    const asserted = [
      ...Object.keys(testCase.min_criteria ?? {}),
      ...(testCase.must_not_report ?? []),
      ...(testCase.guided_criteria ?? []),
    ];
    const hits = asserted.filter((criterion) => affected.has(criterion));
    if (hits.length > 0) impacted.push({ id: testCase.id, path: testCase.path, criteria: [...new Set(hits)].sort() });
  }

  return impacted.sort((a, b) => a.id.localeCompare(b.id));
}

// --- fetching ---------------------------------------------------------------

export class RefreshError extends Error {}

async function fetchSource(source, { offline, from }) {
  if (offline) {
    const file = path.join(from, `${source.id}.json`);
    if (!fs.existsSync(file)) throw new RefreshError(`offline copy missing for ${source.id}: ${file}`);
    const body = fs.readFileSync(file, 'utf8');
    return { body, status: 200 };
  }

  const response = await fetch(source.url, { redirect: 'follow' });
  // Upstream gone is a stop, not a reason to keep the old copy silently.
  if (response.status === 404 || response.status === 410) {
    throw new RefreshError(
      `${source.id}: upstream returned ${response.status} for ${source.url}. ` +
        'The source may have moved or been withdrawn. Resolve this by hand; the refresh will not proceed.',
    );
  }
  if (!response.ok) throw new RefreshError(`${source.id}: upstream returned ${response.status} for ${source.url}`);
  return { body: await response.text(), status: response.status };
}

/**
 * Licence check.
 *
 * The vendored ACT catalogue states its own licence. If that string moves, the
 * terms under which the corpus redistributes it may have changed, and no
 * automated run is allowed to accept that.
 */
export function assertLicenceUnchanged(source, upstream) {
  const declared = source.license.upstream_field;
  if (!declared) return;

  const actual = declared.split('.').reduce((value, key) => value?.[key], upstream);
  if (actual === undefined) {
    throw new RefreshError(
      `${source.id}: expected a licence at '${declared}' in the upstream document and found none. ` +
        'Failing closed rather than re-vendoring under unknown terms.',
    );
  }
  if (actual !== source.license.upstream_value) {
    throw new RefreshError(
      `${source.id}: upstream licence changed from '${source.license.upstream_value}' to '${actual}'. ` +
        'A maintainer must review the terms before this source is refreshed.',
    );
  }
}

// --- main -------------------------------------------------------------------

export async function refresh({ apply = false, offline = false, from = null } = {}) {
  const manifest = readJson(SOURCES_FILE);
  const cases = loadFixtureCases(ROOT);
  const report = { generated: today(), changed: false, sources: [], errors: [] };

  for (const source of manifest.sources) {
    const entry = { id: source.id, url: source.url, changed: false };

    let fetched;
    try {
      fetched = await fetchSource(source, { offline, from });
    } catch (error) {
      // Fail closed: record and stop, never fall back to the stale copy.
      report.errors.push(`${source.id}: ${error.message}`);
      entry.error = error.message;
      report.sources.push(entry);
      continue;
    }

    const digest = sha256(fetched.body);
    entry.upstream_sha256 = digest;
    entry.previous_sha256 = source.upstream.sha256;
    entry.changed = digest !== source.upstream.sha256;

    if (source.watch_only) {
      // Nothing is vendored from this source, so the only honest signal is
      // "upstream moved, review the fixtures it informed".
      entry.watch_only = true;
      entry.review = source.informs ?? [];
      if (entry.changed) report.changed = true;
      if (apply) {
        source.upstream.sha256 = digest;
        source.upstream.fetched = today();
      }
      report.sources.push(entry);
      continue;
    }

    let upstream;
    try {
      upstream = JSON.parse(fetched.body);
      assertLicenceUnchanged(source, upstream);
    } catch (error) {
      report.errors.push(`${source.id}: ${error.message}`);
      entry.error = error.message;
      report.sources.push(entry);
      continue;
    }

    const previous = readJson(source.vendored);
    const next = TRANSFORMS[source.kind](upstream, previous);

    if (source.kind === 'wcag') {
      const diff = diffWcag(previous, next);
      entry.diff = diff;
      entry.transformed_fields_changed = diff.changed.length;
      const moved = [...diff.added, ...diff.removed, ...diff.changed.map((row) => row.num)];
      entry.fixture_impact = fixtureImpact(moved, cases);
      entry.changed =
        entry.changed || diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
    } else {
      const diff = diffAct(previous, next);
      entry.diff = diff;
      entry.fixture_impact = fixtureImpact(diff.affected_criteria, cases);
    }

    if (entry.changed) report.changed = true;

    if (apply && entry.changed) {
      fs.writeFileSync(path.join(ROOT, source.vendored), `${JSON.stringify(next, null, 2)}\n`);
      source.upstream.sha256 = digest;
      source.upstream.fetched = today();
      if (source.kind === 'wcag') source.upstream.counts = next.counts;
      else source.upstream.counts = { testcases: next.testcases.length };
    }

    report.sources.push(entry);
  }

  if (apply && report.errors.length === 0) {
    manifest.generated = today();
    fs.writeFileSync(path.join(ROOT, SOURCES_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return report;
}

export function renderReport(report) {
  const lines = [];
  lines.push(report.changed ? '# Standards source refresh' : '# Standards sources unchanged');
  lines.push('');

  for (const source of report.sources) {
    lines.push(`## ${source.id}`);
    lines.push('');
    lines.push(`- url: ${source.url}`);
    if (source.error) {
      lines.push(`- **failed closed:** ${source.error}`);
      lines.push('');
      continue;
    }
    lines.push(`- upstream digest: \`${source.upstream_sha256}\``);
    lines.push(`- previously: \`${source.previous_sha256}\``);
    lines.push(`- changed: ${source.changed ? 'yes' : 'no'}`);

    if (source.watch_only) {
      lines.push('- not vendored; a change here means the fixtures it informed need review');
      if (source.changed && source.review.length > 0) {
        lines.push(`- review: ${source.review.join(', ')}`);
      }
      lines.push('');
      continue;
    }

    const diff = source.diff ?? {};
    if (diff.added) lines.push(`- criteria added: ${diff.added.length ? diff.added.join(', ') : 'none'}`);
    if (diff.removed) lines.push(`- criteria removed: ${diff.removed.length ? diff.removed.join(', ') : 'none'}`);
    if (diff.changed) {
      lines.push(`- transformed fields changed: ${diff.changed.length}`);
      for (const row of diff.changed.slice(0, 20)) {
        for (const field of row.fields) {
          lines.push(`  - ${row.num} \`${field.field}\`: ${JSON.stringify(field.from)} → ${JSON.stringify(field.to)}`);
        }
      }
    }
    if (diff.rules_added) {
      lines.push(`- rules added: ${diff.rules_added.length ? diff.rules_added.join(', ') : 'none'}`);
      lines.push(`- rules removed: ${diff.rules_removed.length ? diff.rules_removed.join(', ') : 'none'}`);
      lines.push(`- test cases: ${diff.counts.before} → ${diff.counts.after} (+${diff.testcases_added.length} / -${diff.testcases_removed.length})`);
      lines.push(`- expected-outcome changes: ${diff.expected_outcome_changes.length}`);
      for (const row of diff.expected_outcome_changes.slice(0, 20)) {
        lines.push(`  - ${row.rule_id} ${row.testcase}: ${row.from} → ${row.to}`);
      }
    }

    const impact = source.fixture_impact ?? [];
    lines.push(`- local fixtures affected: ${impact.length}`);
    for (const row of impact.slice(0, 30)) lines.push(`  - ${row.id} (${row.criteria.join(', ')})`);
    if (impact.length > 30) lines.push(`  - ... ${impact.length - 30} more`);
    lines.push('');
  }

  if (report.errors.length > 0) {
    lines.push('## Failed closed');
    lines.push('');
    for (const error of report.errors) lines.push(`- ${error}`);
    lines.push('');
    lines.push('No source was refreshed. A maintainer must resolve these by hand.');
  }

  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const offline = argv.includes('--offline');
  const fromIndex = argv.indexOf('--from');
  const from = fromIndex > -1 ? path.resolve(argv[fromIndex + 1]) : null;
  const outIndex = argv.indexOf('--report');
  const out = outIndex > -1 ? argv[outIndex + 1] : null;

  if (!apply && !argv.includes('--check')) {
    console.error('usage: node refresh-sources.mjs (--check | --apply) [--offline --from <dir>] [--report <file>]');
    process.exit(2);
  }

  const report = await refresh({ apply, offline, from });
  const rendered = renderReport(report);
  if (out) fs.writeFileSync(out, `${rendered}\n`);
  console.log(rendered);

  // 2 = failed closed, 1 = upstream moved, 0 = nothing to do.
  if (report.errors.length > 0) process.exit(2);
  process.exit(report.changed ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
