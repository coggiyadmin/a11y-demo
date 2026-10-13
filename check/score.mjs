// Reference scorer and regression runner.
//
//   node check/score.mjs score   result.json [more.json ...] [--json out] [--csv out] [--strict]
//   node check/score.mjs compare baseline.json candidate.json [--json out]
//
// `score` reads the corpus manifest plus schema-valid result files and prints
// comparison metrics. `compare` takes two scores (or two result files, which it
// scores first) and reports the regression delta, refusing to compare runs that
// were not measured against the same corpus revision and scoring policy.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import { SCORE_FORMAT, compareScores, loadCorpus, scoreResults, toCsv } from './scoring.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const USAGE = `usage:
  node check/score.mjs score   <result.json> [result.json ...] [--json <file>] [--csv <file>] [--strict]
  node check/score.mjs compare <baseline> <candidate> [--json <file>]

score    pool one or more repeats of a run into comparison metrics
compare  report the regression delta between two runs

options:
  --json <file>  write the full machine-readable report to <file>
  --csv <file>   write metric rows to <file>; every row carries its denominator
  --strict       treat a corpus-identity mismatch as an error rather than a warning`;

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const positional = [];
  const options = { json: null, csv: null, strict: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--strict') options.strict = true;
    else if (arg === '--json' || arg === '--csv') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`${arg} requires a file path\n\n${USAGE}`);
      options[arg.slice(2)] = value;
      index += 1;
    } else if (arg.startsWith('--')) fail(`unknown option: ${arg}\n\n${USAGE}`);
    else positional.push(arg);
  }

  return { positional, options };
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`could not read ${file}: ${error.message}`);
  }
};

function resultValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat('date-time', (value) => Number.isFinite(Date.parse(value)));
  return ajv.compile(readJson(path.join(ROOT, 'schemas/benchmark-result.schema.json')));
}

/**
 * Only schema-valid evidence is scored. An invalid file is reported with the
 * instance path and message so the publisher can fix it, never silently
 * dropped or partially scored.
 */
function loadResults(files) {
  const validate = resultValidator();
  const results = [];
  const problems = [];

  for (const file of files) {
    const document = readJson(file);
    if (!validate(document)) {
      problems.push(
        `invalid benchmark result: ${file}\n` +
          (validate.errors ?? []).map((error) => `  - ${error.instancePath || '/'} ${error.message}`).join('\n'),
      );
      continue;
    }
    results.push(document);
  }

  if (problems.length > 0) fail(problems.join('\n\n'), 1);
  return results;
}

const percent = (value) => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);

function reportScore(score) {
  const lines = [];
  const recall = score.lanes.automated.true_positive_recall;
  const fp = score.lanes.automated.false_positive;

  lines.push(`corpus       ${score.corpus.repository}@${score.corpus.revision.slice(0, 12)}`);
  lines.push(`manifest     ${score.corpus.manifest_sha256}`);
  lines.push(`policy       ${score.scoring_policy}`);
  lines.push(`runs         ${score.repeat_variance.runs} (repeats ${score.repeat_variance.repeats.join(', ')})`);
  lines.push(
    `engines      ${score.engines.independent_engine_count} independent` +
      (score.engines.derived.length > 0 ? `, ${score.engines.derived.length} derived/wrapper (not counted)` : ''),
  );
  lines.push('');
  const laneRow = (label, numerator, denominator, value, suffix = '') =>
    `  ${label.padEnd(24)}${`${numerator}/${denominator}`.padEnd(10)}${percent(value).padStart(6)}${suffix}`;

  lines.push('automated lane');
  lines.push(laneRow('true-positive recall', recall.numerator, recall.denominator, recall.rate, '  (whole corpus)'));
  lines.push(
    laneRow(
      '... of attempted',
      recall.numerator,
      recall.denominator_attempted,
      recall.rate_of_attempted,
      '  (cases this run executed)',
    ),
  );
  lines.push(
    laneRow(
      '... engine-reachable',
      recall.numerator,
      recall.denominator_engine_reachable,
      recall.rate_engine_reachable,
      '  (criteria this engine evaluates)',
    ),
  );
  lines.push(laneRow('false positives', fp.count, fp.denominator, fp.rate));
  lines.push(
    laneRow('corrected-control FP', fp.corrected_control.count, fp.corrected_control.denominator, fp.corrected_control.rate),
  );
  lines.push(
    laneRow(
      '... engine-reachable',
      fp.corrected_control.count,
      fp.corrected_control.denominator_engine_reachable,
      fp.corrected_control.rate_engine_reachable,
      '  (the only FP figure it could fail)',
    ),
  );

  if (fp.corrected_control.engine_unreachable > 0) {
    const share = Math.round((100 * fp.corrected_control.engine_unreachable) / fp.corrected_control.denominator);
    lines.push('');
    lines.push(
      `  note: ${fp.corrected_control.engine_unreachable} of ${fp.corrected_control.denominator} corrected-control`,
    );
    lines.push(
      `  assertions (${share}%) are criteria this engine never reported. It cannot produce a false`,
    );
    lines.push('  positive on those, so the full-denominator rate credits silence.');
  }

  const byLevel = score.breakdowns?.by_level ?? [];
  if (byLevel.length > 0) {
    lines.push('');
    lines.push('by WCAG level');
    for (const row of byLevel) {
      lines.push(
        `  ${String(row.group).padEnd(10)}recall ${String(`${row.tp_detected}/${row.tp_denominator}`).padEnd(10)}${percent(row.tp_rate).padStart(6)}` +
          `    FP ${String(`${row.fp_count}/${row.fp_denominator}`).padEnd(10)}${percent(row.fp_rate).padStart(6)}`,
      );
    }
  }
  lines.push('');
  lines.push('misses by reason');
  for (const [reason, count] of Object.entries(recall.missed)) {
    if (count > 0) lines.push(`  ${reason.padEnd(26)} ${count}`);
  }
  lines.push('');
  lines.push('pipeline-integrity lane');
  lines.push(
    laneRow('expectations honored', score.lanes.pipeline.honored, score.lanes.pipeline.denominator, score.lanes.pipeline.rate),
  );
  lines.push('');
  lines.push('human lane (never averaged into the rates above)');
  lines.push(
    `  cases ${score.lanes.human.denominator}  executed ${score.lanes.human.executed}  cannot-tell ${score.lanes.human.cannot_tell}  not run ${score.lanes.human.not_run}`,
  );
  lines.push('');

  const first = score.per_run[0];
  lines.push('execution accounting (first repeat)');
  lines.push(
    `  completed ${first.executions.completed}  blocked ${first.executions.blocked}  unsupported ${first.executions.unsupported}  error ${first.executions.error}  not run ${first.executions.not_run}`,
  );
  lines.push(
    `  observed ${first.observability.observed}  not-observed ${first.observability['not-observed']}  unknown ${first.observability.unknown}`,
  );
  lines.push(
    `  examined: positive ${first.examined_counts.reported_positive}  zero ${first.examined_counts.reported_zero}  unknown ${first.examined_counts.unknown}`,
  );
  lines.push(`  cannot-tell outcomes ${first.cannot_tell.outcomes} across ${first.cannot_tell.cases} case(s)`);

  if (score.repeat_variance.runs > 1) {
    lines.push('');
    lines.push('repeat variance');
    const tp = score.repeat_variance.true_positive_rate;
    if (tp) lines.push(`  true-positive rate  min ${tp.min}  max ${tp.max}  mean ${tp.mean}  stddev ${tp.stddev}`);
    lines.push(`  unstable assertions ${score.repeat_variance.unstable_assertions.length}`);
  }

  if (score.warnings.length > 0) {
    lines.push('');
    lines.push('warnings');
    for (const warning of score.warnings) lines.push(`  - ${warning}`);
  }

  const unimplemented = score.criteria_no_engine_reported ?? [];
  if (unimplemented.length > 0) {
    lines.push('');
    lines.push(`criteria no engine in this comparison reported at all (${unimplemented.length})`);
    lines.push(`  ${unimplemented.join(', ')}`);
  }

  lines.push('');
  for (const boundary of score.boundaries) lines.push(`note: ${boundary}`);

  return lines.join('\n');
}

function reportComparison(comparison) {
  if (!comparison.comparable) {
    return ['runs are not comparable', ...comparison.blockers.map((b) => `  - ${b}`), '', comparison.hint].join('\n');
  }

  const lines = [`corpus ${comparison.corpus.repository}@${comparison.corpus.revision.slice(0, 12)}`, ''];
  lines.push('metric                                  baseline    candidate   delta');
  for (const [metric, value] of Object.entries(comparison.metrics)) {
    const format = (input) => (input === null ? 'n/a' : String(input));
    lines.push(
      `${metric.padEnd(40)}${format(value.baseline).padEnd(12)}${format(value.candidate).padEnd(12)}${format(value.delta)}`,
    );
  }

  lines.push('');
  lines.push(`newly missed   ${comparison.newly_missed.length}`);
  for (const row of comparison.newly_missed.slice(0, 20)) lines.push(`  - ${row.case_id} ${row.criterion}`);
  if (comparison.newly_missed.length > 20) lines.push(`  ... ${comparison.newly_missed.length - 20} more`);
  lines.push(`newly detected ${comparison.newly_detected.length}`);

  lines.push('');
  lines.push(comparison.regressed ? 'REGRESSED' : 'no regression');
  for (const regression of comparison.regressions) lines.push(`  - ${regression}`);

  return lines.join('\n');
}

/** Accept either a score file or a raw result file, scoring the latter on the fly. */
function asScore(corpus, file, options) {
  const document = readJson(file);
  if (document.format === SCORE_FORMAT) return document;
  const score = scoreResults(corpus, loadResults([file]), options);
  if (score.errors.length > 0) fail(score.errors.map((error) => `- ${error}`).join('\n'), 1);
  return score;
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    process.exit(command ? 0 : 2);
  }

  const { positional, options } = parseArgs(rest);
  const corpus = loadCorpus(ROOT);

  if (command === 'score') {
    if (positional.length === 0) fail(`score requires at least one result file\n\n${USAGE}`);
    const score = scoreResults(corpus, loadResults(positional), { strict: options.strict });
    if (score.errors.length > 0) fail(score.errors.map((error) => `- ${error}`).join('\n'), 1);

    if (options.json) fs.writeFileSync(options.json, `${JSON.stringify(score, null, 2)}\n`);
    if (options.csv) fs.writeFileSync(options.csv, toCsv(score));
    console.log(reportScore(score));
    process.exit(0);
  }

  if (command === 'compare') {
    if (positional.length !== 2) fail(`compare requires exactly two files\n\n${USAGE}`);
    const baseline = asScore(corpus, positional[0], { strict: options.strict });
    const candidate = asScore(corpus, positional[1], { strict: options.strict });
    const comparison = compareScores(baseline, candidate);

    if (options.json) fs.writeFileSync(options.json, `${JSON.stringify(comparison, null, 2)}\n`);
    console.log(reportComparison(comparison));
    // Exit 1 on an incomparable pair or a regression so CI can gate on it.
    process.exit(comparison.comparable ? (comparison.regressed ? 1 : 0) : 2);
  }

  fail(`unknown command: ${command}\n\n${USAGE}`);
}

main();
