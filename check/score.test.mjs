import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { compareScores, loadCorpus, scoreResults, toCsv } from './scoring.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const CLI = path.join(ROOT, 'check/score.mjs');
const corpus = loadCorpus(ROOT);

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const repeatOne = () => readJson('schemas/examples/benchmark-result.repeat-1.json');
const repeatTwo = () => readJson('schemas/examples/benchmark-result.repeat-2.json');

const score = (results, options) => scoreResults(corpus, results, options);

/** Replace one execution in a cloned result, so each test states only its own change. */
function withExecution(result, caseId, patch) {
  const copy = structuredClone(result);
  const index = copy.executions.findIndex((execution) => execution.case_id === caseId);
  assert.notEqual(index, -1, `fixture execution not present: ${caseId}`);
  copy.executions[index] = { ...copy.executions[index], ...patch };
  return copy;
}

function recallFor(result, caseId, criterion) {
  const report = score([result]);
  return report.per_run[0].lanes.automated.true_positive_recall.detail.find(
    (row) => row.case_id === caseId && row.criterion === criterion,
  );
}

test('scorer reports recall and false positives with explicit denominators', () => {
  const report = score([repeatOne()]);
  const recall = report.lanes.automated.true_positive_recall;
  const falsePositive = report.lanes.automated.false_positive;

  // Derived rather than hardcoded: the denominator is every true-positive
  // assertion in the corpus, so it moves whenever fixtures are added.
  const assertions = manifestAssertionCount();
  assert.equal(recall.numerator, 4);
  assert.equal(recall.denominator, assertions);
  assert.equal(recall.denominator_attempted, 8);
  assert.equal(recall.rate, Number((4 / assertions).toFixed(6)));
  assert.equal(recall.rate_of_attempted, 0.5);

  // The corrected control was wrongly reported for 2.1.1 but not for 4.1.2.
  assert.equal(falsePositive.count, 1);
  assert.equal(falsePositive.corrected_control.count, 1);
  assert.ok(falsePositive.denominator > 0);

  // Per-assertion detail lives on each run; the pooled lane carries only the
  // counts, because a detail row is ambiguous once repeats are pooled.
  assert.equal(falsePositive.detail, undefined);
  assert.deepEqual(
    report.per_run[0].lanes.automated.false_positive.detail.map((row) => `${row.case_id}|${row.criterion}`),
    ['keyboard-safe_native_button|2.1.1'],
  );
});

test('the full-corpus denominator is the headline so a partial run cannot look complete', () => {
  const report = score([repeatOne()]);
  const recall = report.lanes.automated.true_positive_recall;
  assert.equal(recall.denominator, manifestAssertionCount());
  assert.ok(recall.missed.not_run > 0, 'unexecuted assertions must remain visible');
  assert.ok(recall.denominator > recall.denominator_attempted);
});

function manifestAssertionCount() {
  let total = 0;
  for (const fixture of corpus.cases.values()) {
    if (fixture.requires_human === true || fixture.mode === 'guided') continue;
    total += Object.keys(fixture.min_criteria ?? {}).length;
  }
  return total;
}

test('an errored execution is never credited as a detection', () => {
  const result = withExecution(repeatOne(), 'keyboard-div_button', {
    status: 'error',
    error: { code: 'navigation-failed', message: 'page did not load' },
  });
  const row = recallFor(result, 'keyboard-div_button', '2.1.1');
  assert.equal(row.detected, false);
  assert.equal(row.reason, 'execution_not_completed');
});

test('a blocked or unsupported execution is never credited as a detection', () => {
  for (const status of ['blocked', 'unsupported']) {
    const result = withExecution(repeatOne(), 'keyboard-div_button', { status });
    const row = recallFor(result, 'keyboard-div_button', '4.1.2');
    assert.equal(row.detected, false, `${status} must not count as a detection`);
    assert.equal(row.reason, 'execution_not_completed');
  }
});

test('a failure claimed against an explicitly unobserved target is not a detection', () => {
  const result = withExecution(repeatOne(), 'keyboard-div_button', { target_observability: 'not-observed' });
  const row = recallFor(result, 'keyboard-div_button', '2.1.1');
  assert.equal(row.detected, false);
  assert.equal(row.reason, 'target_not_observed');
});

test('unknown observability is a disclosure gap, not an automatic miss', () => {
  // The published policy rejects `not-observed`, not `unknown`. A run that
  // declines to state observability still has to clear the zero-examined guard.
  const result = withExecution(repeatOne(), 'keyboard-div_button', { target_observability: 'unknown' });
  assert.equal(recallFor(result, 'keyboard-div_button', '2.1.1').detected, true);

  const report = score([result]);
  assert.ok(report.per_run[0].observability.unknown >= 2, 'the gap stays visible in the observability counts');

  // ... and an unknown-observability run that examined nothing is still refused.
  const vacuous = structuredClone(result);
  const execution = vacuous.executions.find((row) => row.case_id === 'keyboard-div_button');
  for (const outcome of execution.outcomes) outcome.examined_count = 0;
  assert.equal(recallFor(vacuous, 'keyboard-div_button', '2.1.1').reason, 'zero_examined_report');
});

test('a failure reported after examining nothing is a vacuous report, not a detection', () => {
  const result = structuredClone(repeatOne());
  const execution = result.executions.find((row) => row.case_id === 'keyboard-div_button');
  for (const outcome of execution.outcomes) outcome.examined_count = 0;

  const row = recallFor(result, 'keyboard-div_button', '2.1.1');
  assert.equal(row.detected, false);
  assert.equal(row.reason, 'zero_examined_report');
});

test('an unknown examined count is not read as zero and is reported separately', () => {
  const result = structuredClone(repeatOne());
  const execution = result.executions.find((row) => row.case_id === 'keyboard-div_button');
  for (const outcome of execution.outcomes) outcome.examined_count = null;

  // A null count is an absent measurement, not an examined-nothing signal, so
  // the detection still stands while the count stays visibly unknown.
  assert.equal(recallFor(result, 'keyboard-div_button', '2.1.1').detected, true);

  const report = score([result]);
  assert.ok(report.per_run[0].examined_counts.unknown >= 2);
  assert.notEqual(report.per_run[0].examined_counts.unknown, report.per_run[0].examined_counts.reported_zero);
});

test('a cannot-tell outcome is a miss and is also tracked in its own lane', () => {
  const row = recallFor(repeatTwo(), 'patterns-disclosure', '2.1.1');
  assert.equal(row.detected, false);
  assert.equal(row.reason, 'cannot_tell');

  const report = score([repeatTwo()]);
  assert.ok(report.per_run[0].cannot_tell.outcomes >= 1);
});

test('findings below the declared minimum do not satisfy the assertion', () => {
  const result = structuredClone(repeatOne());
  const execution = result.executions.find((row) => row.case_id === 'keyboard-div_button');
  // Raise the bar above what the run reported rather than editing the corpus.
  const fixture = corpus.cases.get('keyboard-div_button');
  assert.equal(fixture.min_criteria['2.1.1'], 1);
  execution.outcomes.find((outcome) => outcome.criterion === '2.1.1').findings = 0;

  const row = recallFor(result, 'keyboard-div_button', '2.1.1');
  assert.equal(row.detected, false);
  // Zero findings on a `fail` verdict reads as a non-failing report.
  assert.ok(['insufficient_findings', 'reported_non_failing_verdict'].includes(row.reason));
});

test('a pass verdict on a defective case is a miss, never a credit', () => {
  const result = structuredClone(repeatOne());
  const execution = result.executions.find((row) => row.case_id === 'keyboard-div_button');
  const outcome = execution.outcomes.find((row) => row.criterion === '2.1.1');
  outcome.verdict = 'pass';
  outcome.findings = 0;

  const row = recallFor(result, 'keyboard-div_button', '2.1.1');
  assert.equal(row.detected, false);
  assert.equal(row.reason, 'reported_non_failing_verdict');
});

test('findings from several native rules mapped to one criterion are summed', () => {
  const result = structuredClone(repeatOne());
  const execution = result.executions.find((row) => row.case_id === 'keyboard-div_button');
  const outcome = execution.outcomes.find((row) => row.criterion === '2.1.1');
  outcome.findings = 0;
  execution.outcomes.push({
    criterion: '2.1.1',
    native_rule_id: 'example-second-rule',
    verdict: 'fail',
    findings: 1,
    examined_count: 3,
    evidence: [{ type: 'manual-note', note: 'second rule mapped to the same criterion' }],
  });

  assert.equal(recallFor(result, 'keyboard-div_button', '2.1.1').detected, true);
});

test('pipeline expectations are honoured only when every boundary matches', () => {
  const report = score([repeatOne()]);
  const honoured = new Map(report.per_run[0].lanes.pipeline.detail.map((row) => [row.case_id, row]));

  assert.equal(honoured.get('pipeline-vacuous_pass').honored, true);
  assert.equal(honoured.get('pipeline-no_declared_flow').honored, true);
  assert.equal(honoured.get('pipeline-observed_pass-control').honored, true);
  assert.equal(honoured.get('pipeline-deep_site-mismatch').violations[0], 'not_run');
});

test('converting a vacuous pass into a pass is caught as a pipeline violation', () => {
  const result = withExecution(repeatOne(), 'pipeline-vacuous_pass', {
    status: 'completed',
    outcomes: [
      {
        criterion: '2.1.1',
        native_rule_id: 'example-keyboard-control',
        verdict: 'pass',
        findings: 0,
        examined_count: 0,
        evidence: [{ type: 'manual-note', note: 'claimed a pass having examined nothing' }],
      },
    ],
  });

  const report = score([result]);
  const row = report.per_run[0].lanes.pipeline.detail.find((entry) => entry.case_id === 'pipeline-vacuous_pass');
  assert.equal(row.honored, false);
  assert.ok(row.violations.some((violation) => violation.includes('forbidden verdict pass')));
  assert.ok(row.violations.some((violation) => violation.includes('status expected error')));
});

test('a missing required error code is a pipeline violation', () => {
  const result = withExecution(repeatOne(), 'pipeline-vacuous_pass', {
    error: { code: 'something-else', message: 'wrong code' },
  });
  const report = score([result]);
  const row = report.per_run[0].lanes.pipeline.detail.find((entry) => entry.case_id === 'pipeline-vacuous_pass');
  assert.equal(row.honored, false);
  assert.ok(row.violations.some((violation) => violation.includes('error code expected zero-examined')));
});

test('human-judgement cases stay out of the automated rates', () => {
  const report = score([repeatOne()]);
  const automated = report.per_run[0].lanes.automated;

  // The guided case was executed and reported cannot-tell, yet it must appear
  // in neither automated assertion set nor move either rate.
  assert.equal(automated.true_positive_recall.detail.some((row) => row.case_id.startsWith('guided-')), false);
  assert.equal(automated.false_positive.detail.some((row) => row.case_id.startsWith('guided-')), false);

  assert.equal(report.lanes.human.cannot_tell, 1);
  assert.equal(report.lanes.human.executed, 1);
  assert.ok(report.lanes.human.denominator >= 9);
});

test('wrappers and derived configurations are not counted as independent engines', () => {
  const independent = repeatOne();
  const wrapper = structuredClone(repeatOne());
  wrapper.run.id = 'example-wrapper';
  wrapper.run.tool = {
    name: 'Example wrapper',
    version: '1.0.0',
    engine_family: 'Example engine',
    tool_surface: 'GitHub Action',
    independence: 'wrapper',
    wrapper_of: 'Example engine 2.0.0',
  };

  const report = score([independent, wrapper]);
  assert.equal(report.engines.independent_engine_count, 1);
  assert.deepEqual(report.engines.independent_engines, ['Example engine']);
  assert.deepEqual(
    report.engines.derived.map((row) => row.tool),
    ['Example wrapper'],
  );
});

test('results from different corpus revisions cannot be pooled', () => {
  const other = structuredClone(repeatTwo());
  other.corpus.revision = 'b'.repeat(40);

  const report = score([repeatOne(), other]);
  assert.ok(report.errors.length > 0);
  assert.match(report.errors[0], /different corpus revisions/);
});

test('a corpus-identity mismatch warns by default and fails under --strict', () => {
  const lenient = score([repeatOne()]);
  assert.ok(lenient.warnings.some((warning) => warning.includes('ground truth may not be')));
  assert.equal(lenient.errors.length, 0);

  const strict = score([repeatOne()], { strict: true });
  assert.ok(strict.errors.some((error) => error.includes('ground truth may not be')));
});

test('a case id absent from the manifest is surfaced as a warning', () => {
  const result = structuredClone(repeatOne());
  result.executions.push({
    case_id: 'not-a-real-case',
    case_path: 'nowhere.html',
    status: 'completed',
    declared_state: 'default',
    state_reached: true,
    target_observability: 'observed',
    outcomes: [
      {
        criterion: '1.1.1',
        native_rule_id: 'example',
        verdict: 'pass',
        findings: 0,
        examined_count: 1,
        evidence: [{ type: 'manual-note', note: 'invented case' }],
      },
    ],
  });

  const report = score([result]);
  assert.ok(report.warnings.some((warning) => warning.includes('not-a-real-case')));
  assert.deepEqual(report.per_run[0].anomalies.unknown_case_ids, ['not-a-real-case']);
});

test('repeat variance reports spread and names unstable assertions', () => {
  const report = score([repeatOne(), repeatTwo()]);
  assert.equal(report.repeat_variance.runs, 2);
  assert.deepEqual(report.repeat_variance.repeats, [1, 2]);
  assert.ok(report.repeat_variance.true_positive_rate.stddev > 0);
  assert.deepEqual(report.repeat_variance.unstable_assertions, [{ case_id: 'patterns-disclosure', criterion: '2.1.1' }]);
});

test('breakdowns are produced by family, criterion and functional need', () => {
  const report = score([repeatOne()]);
  const families = report.breakdowns.by_family.map((row) => row.group);
  assert.ok(families.includes('core'));
  assert.ok(families.includes('patterns'));

  const criteria = report.breakdowns.by_criterion.map((row) => row.group);
  assert.ok(criteria.includes('2.1.1'));

  const needs = report.breakdowns.by_functional_need.map((row) => row.group);
  assert.ok(needs.includes('nonvisual-access'));

  for (const group of [...report.breakdowns.by_family, ...report.breakdowns.by_criterion]) {
    assert.ok(group.tp_denominator >= group.tp_detected, `${group.group} numerator exceeds its denominator`);
  }
});

test('scoring is deterministic for identical input', () => {
  const first = JSON.stringify(score([repeatOne(), repeatTwo()]));
  const second = JSON.stringify(score([repeatOne(), repeatTwo()]));
  assert.equal(first, second);
  assert.equal(toCsv(score([repeatOne()])), toCsv(score([repeatOne()])));
});

test('CSV rows carry corpus identity and a denominator for every metric', () => {
  const csv = toCsv(score([repeatOne()]));
  const [header, ...rows] = csv.trim().split('\n');
  assert.equal(
    header,
    'corpus_repository,corpus_revision,manifest_sha256,scoring_policy,lane,metric,group_kind,group,numerator,denominator,value',
  );
  assert.ok(rows.length > 10);

  for (const row of rows) {
    const columns = row.split(',');
    assert.equal(columns[0], 'cogniumhq/a11y-benchmark');
    assert.equal(columns[1], '0'.repeat(40));
    assert.equal(columns[3], 'cognium-a11y-scoring/1.0.0');
    assert.notEqual(columns[9], '', `row has no denominator: ${row}`);
  }
});

test('regression comparison refuses runs measured against different corpora', () => {
  const baseline = score([repeatOne()]);
  const candidate = structuredClone(baseline);
  candidate.corpus.revision = 'c'.repeat(40);

  const comparison = compareScores(baseline, candidate);
  assert.equal(comparison.comparable, false);
  assert.ok(comparison.blockers.some((blocker) => blocker.includes('corpus revision differs')));
  assert.match(comparison.hint, /one pinned corpus revision/);
});

test('regression comparison refuses runs scored under different policies', () => {
  const baseline = score([repeatOne()]);
  const candidate = structuredClone(baseline);
  candidate.scoring_policy = 'cognium-a11y-scoring/2.0.0';

  const comparison = compareScores(baseline, candidate);
  assert.equal(comparison.comparable, false);
  assert.ok(comparison.blockers.some((blocker) => blocker.includes('scoring_policy differs')));
});

test('regression comparison reports deltas and names newly missed assertions', () => {
  const baseline = score([repeatOne()]);
  const candidate = score([repeatTwo()]);
  const comparison = compareScores(baseline, candidate);

  assert.equal(comparison.comparable, true);
  assert.equal(comparison.metrics.true_positive_detected.baseline, 4);
  assert.equal(comparison.metrics.true_positive_detected.candidate, 3);
  assert.ok(comparison.metrics.true_positive_rate.delta < 0);
  assert.deepEqual(comparison.newly_missed, [{ case_id: 'patterns-disclosure', criterion: '2.1.1' }]);
  assert.deepEqual(comparison.newly_detected, []);
  assert.equal(comparison.regressed, true);
});

test('an unchanged run compares as no regression', () => {
  const baseline = score([repeatOne()]);
  const comparison = compareScores(baseline, score([repeatOne()]));
  assert.equal(comparison.regressed, false);
  assert.deepEqual(comparison.regressions, []);
});

test('a rising false-positive rate is reported as a regression', () => {
  const worse = structuredClone(repeatOne());
  const control = worse.executions.find((row) => row.case_id === 'patterns-safe_disclosure');
  control.outcomes.find((row) => row.criterion === '4.1.2').verdict = 'fail';
  control.outcomes.find((row) => row.criterion === '4.1.2').findings = 1;

  const comparison = compareScores(score([repeatOne()]), score([worse]));
  assert.equal(comparison.regressed, true);
  assert.ok(comparison.regressions.some((regression) => regression.includes('false-positive rate rose')));
});

// --- CLI --------------------------------------------------------------------

const run = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

test('CLI scores the published example and reports every lane', () => {
  const result = run([
    'score',
    path.join(ROOT, 'schemas/examples/benchmark-result.repeat-1.json'),
    path.join(ROOT, 'schemas/examples/benchmark-result.repeat-2.json'),
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /true-positive recall/);
  assert.match(result.stdout, /corrected-control FP/);
  assert.match(result.stdout, /pipeline-integrity lane/);
  assert.match(result.stdout, /human lane \(never averaged/);
  assert.match(result.stdout, /repeat variance/);
  assert.match(result.stdout, /never credited as passes or detections/);
});

test('CLI rejects schema-invalid evidence with an actionable message', () => {
  const result = run(['score', path.join(ROOT, 'schemas/examples/benchmark-result.invalid.json')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid benchmark result/);
  assert.match(result.stderr, /wrapper_of/);
});

test('CLI writes JSON and CSV outputs that preserve denominators', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-score-'));
  const jsonFile = path.join(directory, 'score.json');
  const csvFile = path.join(directory, 'score.csv');

  try {
    const result = run([
      'score',
      path.join(ROOT, 'schemas/examples/benchmark-result.repeat-1.json'),
      '--json',
      jsonFile,
      '--csv',
      csvFile,
    ]);
    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    assert.equal(report.format, 'cognium-a11y-score');
    assert.equal(report.lanes.automated.true_positive_recall.denominator, manifestAssertionCount());
    assert.match(fs.readFileSync(csvFile, 'utf8'), /^corpus_repository,/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('CLI exits non-zero on a regression and zero on a clean comparison', () => {
  const regressed = run([
    'compare',
    path.join(ROOT, 'schemas/examples/benchmark-result.repeat-1.json'),
    path.join(ROOT, 'schemas/examples/benchmark-result.repeat-2.json'),
  ]);
  assert.equal(regressed.status, 1);
  assert.match(regressed.stdout, /REGRESSED/);
  assert.match(regressed.stdout, /patterns-disclosure 2\.1\.1/);

  const clean = run([
    'compare',
    path.join(ROOT, 'schemas/examples/benchmark-result.repeat-1.json'),
    path.join(ROOT, 'schemas/examples/benchmark-result.repeat-1.json'),
  ]);
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /no regression/);
});

test('CLI reports usage for an unknown command or option', () => {
  const unknownCommand = run(['explain']);
  assert.equal(unknownCommand.status, 2);
  assert.match(unknownCommand.stderr, /unknown command: explain/);

  const unknownOption = run(['score', '--wat']);
  assert.equal(unknownOption.status, 2);
  assert.match(unknownOption.stderr, /unknown option: --wat/);
});
