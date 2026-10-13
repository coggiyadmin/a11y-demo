// Product-neutral scoring for benchmark results.
//
// This module turns a pinned corpus plus schema-valid result files into
// comparison metrics. It deliberately does not produce one universal score.
// Every rate is published next to the numerator and denominator that produced
// it, and every lane that cannot be averaged with the others is kept apart.
//
// The invariant that shapes the whole file: an execution that errored, was
// blocked, reported an unsupported state, never observed its target, answered
// cannot-tell, or examined nothing is *not* evidence of correct behaviour. No
// code path here may convert one of those into a detection or a pass.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const SCORING_POLICY = 'cognium-a11y-scoring/1.1.0';
export const SCORE_FORMAT = 'cognium-a11y-score';
export const SCORE_FORMAT_VERSION = '1.0.0';

const EXECUTION_STATUSES = ['completed', 'blocked', 'unsupported', 'error'];
const OBSERVABILITY_STATES = ['observed', 'not-observed', 'unknown'];

// An execution whose status is anything but `completed` carries no verdict we
// are willing to read. Keeping this as a single predicate means the rule cannot
// drift apart between the recall path and the false-positive path.
const isReadable = (execution) => execution?.status === 'completed';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const digestOf = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

const rate = (numerator, denominator) =>
  denominator === 0 ? null : Number((numerator / denominator).toFixed(6));

const sortedBy = (rows, key) => [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));

/** Load the corpus manifest and flatten every family into one case index. */
export function loadCorpus(root) {
  const manifestFile = path.join(root, 'corpus-manifest.json');
  const manifestBytes = fs.readFileSync(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));

  const cases = new Map();
  for (const family of manifest.families) {
    const document = readJson(path.join(root, family.file));
    for (const fixture of document.cases) {
      cases.set(fixture.id, { ...fixture, family: family.id });
    }
  }

  return {
    manifest,
    manifest_sha256: `sha256:${crypto.createHash('sha256').update(manifestBytes).digest('hex')}`,
    cases,
    levels: criterionLevels(root),
  };
}

// --- ground-truth assertion extraction -------------------------------------

// The corpus states ground truth in three mutually exclusive shapes, so the
// scorer derives three independent assertion sets rather than one blended list.

function truePositiveAssertions(cases) {
  const assertions = [];
  for (const fixture of cases.values()) {
    for (const [criterion, minimum] of Object.entries(fixture.min_criteria ?? {})) {
      assertions.push({ case_id: fixture.id, family: fixture.family, criterion, minimum, fixture });
    }
  }
  return sortedBy(assertions, 'case_id');
}

function falsePositiveAssertions(cases) {
  const assertions = [];
  for (const fixture of cases.values()) {
    for (const criterion of fixture.must_not_report ?? []) {
      assertions.push({
        case_id: fixture.id,
        family: fixture.family,
        criterion,
        corrected_control: fixture.mode === 'safe',
        fixture,
      });
    }
  }
  return sortedBy(assertions, 'case_id');
}

function pipelineAssertions(cases) {
  const assertions = [];
  for (const fixture of cases.values()) {
    if (fixture.assertion?.expected_execution) {
      assertions.push({
        case_id: fixture.id,
        family: fixture.family,
        expected: fixture.assertion.expected_execution,
        fixture,
      });
    }
  }
  return sortedBy(assertions, 'case_id');
}

/** Cases whose evidence is a human judgement; never mixed into automated rates. */
const isHumanLane = (fixture) => fixture.requires_human === true || fixture.mode === 'guided';

/**
 * The criteria a run demonstrated it has a rule for.
 *
 * A product that emits any outcome for a criterion -- fail, pass, cannot-tell,
 * inapplicable -- has shown it evaluated that criterion. A product that emits
 * nothing for it has shown nothing, and crediting its silence as restraint is
 * the vacuous-pass error one layer up from where Tier P catches it.
 *
 * Derived from the run rather than declared, so it needs no extra disclosure
 * from the publisher and cannot be overstated.
 */
export function engineReachableCriteria(results) {
  const reachable = new Set();
  for (const result of results) {
    for (const execution of result.executions) {
      for (const outcome of execution.outcomes ?? []) reachable.add(outcome.criterion);
    }
  }
  return reachable;
}

/** WCAG level per criterion, so the AAA lane can be reported on its own. */
export function criterionLevels(root) {
  const file = path.join(root, 'wcag/criteria.json');
  if (!fs.existsSync(file)) return new Map();
  return new Map(readJson(file).criteria.map((row) => [row.num, row.level]));
}

// --- outcome aggregation ----------------------------------------------------

/**
 * Collapse every outcome an execution reported for one criterion.
 *
 * A product may map several native rules onto the same criterion, so findings
 * are summed across them and native identity is preserved. `examined` stays
 * null unless at least one contributing outcome reported a real count, which is
 * what keeps "examined nothing" distinguishable from "did not say".
 */
function aggregateCriterion(execution, criterion) {
  const outcomes = (execution?.outcomes ?? []).filter((outcome) => outcome.criterion === criterion);
  if (outcomes.length === 0) return null;

  let findings = 0;
  let examined = null;
  const verdicts = new Set();
  const nativeRules = [];

  for (const outcome of outcomes) {
    verdicts.add(outcome.verdict);
    nativeRules.push(outcome.native_rule_id);
    if (outcome.verdict === 'fail') findings += outcome.findings;
    if (Number.isInteger(outcome.examined_count)) {
      examined = (examined ?? 0) + outcome.examined_count;
    }
  }

  return { findings, examined, verdicts, native_rules: nativeRules.sort() };
}

// --- lane: automated true-positive recall -----------------------------------

function scoreRecall(assertions, executionsById, reachable) {
  const missed = {
    not_run: 0,
    execution_not_completed: 0,
    target_not_observed: 0,
    criterion_not_reported: 0,
    reported_non_failing_verdict: 0,
    cannot_tell: 0,
    insufficient_findings: 0,
    zero_examined_report: 0,
  };
  const detail = [];
  let detected = 0;
  let attempted = 0;
  let reachableDenominator = 0;
  let reachableDetected = 0;

  for (const assertion of assertions) {
    const execution = executionsById.get(assertion.case_id);
    let reason = null;

    if (!execution) {
      reason = 'not_run';
    } else {
      attempted += 1;
      if (!isReadable(execution)) {
        reason = 'execution_not_completed';
      } else if (execution.target_observability === 'not-observed') {
        // An explicit not-observed is the runner stating it never reached the
        // target, so a failure claimed against it is not evidence of anything.
        //
        // `unknown` is deliberately not rejected here: it is a disclosure gap,
        // not a statement that the target was missed, and the published policy
        // names only `not-observed`. It stays visible in the observability
        // counts, and the zero-examined guard below still catches the vacuous
        // case regardless of what observability was declared.
        reason = 'target_not_observed';
      } else {
        const aggregate = aggregateCriterion(execution, assertion.criterion);
        if (!aggregate) {
          reason = 'criterion_not_reported';
        } else if (aggregate.verdicts.has('cannot-tell') && !aggregate.verdicts.has('fail')) {
          reason = 'cannot_tell';
        } else if (!aggregate.verdicts.has('fail')) {
          reason = 'reported_non_failing_verdict';
        } else if (aggregate.examined === 0) {
          // A failure reported while having examined nothing is a vacuous
          // report; crediting it would reward the exact defect Tier P exists
          // to expose.
          reason = 'zero_examined_report';
        } else if (aggregate.findings < assertion.minimum) {
          reason = 'insufficient_findings';
        }
      }
    }

    const engineReachable = reachable.has(assertion.criterion);
    if (engineReachable) reachableDenominator += 1;

    if (reason) {
      missed[reason] += 1;
      detail.push({
        case_id: assertion.case_id,
        criterion: assertion.criterion,
        detected: false,
        reason,
        engine_reachable: engineReachable,
      });
    } else {
      detected += 1;
      if (engineReachable) reachableDetected += 1;
      detail.push({
        case_id: assertion.case_id,
        criterion: assertion.criterion,
        detected: true,
        reason: null,
        engine_reachable: engineReachable,
      });
    }
  }

  return {
    numerator: detected,
    denominator: assertions.length,
    rate: rate(detected, assertions.length),
    denominator_attempted: attempted,
    rate_of_attempted: rate(detected, attempted),
    // Assertions over criteria the run showed it evaluates at all. Published
    // beside the whole-corpus rate, never instead of it: the full denominator
    // is what stops a narrow engine looking complete, and this one is what
    // makes the figure comparable to a published number for the same engine.
    denominator_engine_reachable: reachableDenominator,
    rate_engine_reachable: rate(reachableDetected, reachableDenominator),
    engine_unreachable: assertions.length - reachableDenominator,
    missed,
    detail,
  };
}

// --- lane: corrected-control false positives --------------------------------

function scoreFalsePositives(assertions, executionsById, reachable) {
  const detail = [];
  let falsePositives = 0;
  let controlFalsePositives = 0;
  let controlDenominator = 0;
  let controlReachableDenominator = 0;
  let reachableDenominator = 0;
  let attempted = 0;

  for (const assertion of assertions) {
    const engineReachable = reachable.has(assertion.criterion);
    if (assertion.corrected_control) controlDenominator += 1;
    if (engineReachable) {
      reachableDenominator += 1;
      if (assertion.corrected_control) controlReachableDenominator += 1;
    }

    const execution = executionsById.get(assertion.case_id);
    if (!execution) continue;
    attempted += 1;

    // Only a completed execution can produce a false positive. An errored run
    // reporting a spurious failure is an execution defect, counted in the
    // execution lane rather than smuggled in here.
    if (!isReadable(execution)) continue;

    const aggregate = aggregateCriterion(execution, assertion.criterion);
    if (!aggregate || !aggregate.verdicts.has('fail') || aggregate.findings === 0) continue;

    falsePositives += 1;
    if (assertion.corrected_control) controlFalsePositives += 1;
    detail.push({
      case_id: assertion.case_id,
      criterion: assertion.criterion,
      findings: aggregate.findings,
      corrected_control: assertion.corrected_control,
      native_rules: aggregate.native_rules,
    });
  }

  return {
    count: falsePositives,
    denominator: assertions.length,
    rate: rate(falsePositives, assertions.length),
    denominator_attempted: attempted,
    // A product cannot produce a false positive for a criterion it has no rule
    // for. Scoring restraint it never had to exercise reads silence as success
    // -- the exact error this corpus exists to expose -- so the reachable
    // denominator is published beside the full one.
    denominator_engine_reachable: reachableDenominator,
    rate_engine_reachable: rate(falsePositives, reachableDenominator),
    engine_unreachable: assertions.length - reachableDenominator,
    corrected_control: {
      count: controlFalsePositives,
      denominator: controlDenominator,
      rate: rate(controlFalsePositives, controlDenominator),
      denominator_engine_reachable: controlReachableDenominator,
      rate_engine_reachable: rate(controlFalsePositives, controlReachableDenominator),
      engine_unreachable: controlDenominator - controlReachableDenominator,
    },
    detail,
  };
}

// --- lane: pipeline integrity -----------------------------------------------

function examinedSatisfies(expected, actual) {
  const { operator, value } = expected ?? {};
  if (operator === 'unavailable') return { ok: actual === null || actual === undefined, observed: actual ?? null };
  if (actual === null || actual === undefined) return { ok: false, observed: null };
  if (operator === 'equals') return { ok: actual === value, observed: actual };
  if (operator === 'at-least') return { ok: actual >= value, observed: actual };
  if (operator === 'at-most') return { ok: actual <= value, observed: actual };
  return { ok: false, observed: actual };
}

function scorePipeline(assertions, executionsById) {
  const detail = [];
  let honored = 0;
  let notRun = 0;

  for (const assertion of assertions) {
    const execution = executionsById.get(assertion.case_id);
    if (!execution) {
      notRun += 1;
      detail.push({ case_id: assertion.case_id, honored: false, violations: ['not_run'] });
      continue;
    }

    const expected = assertion.expected;
    const violations = [];

    if (expected.status && execution.status !== expected.status) {
      violations.push(`status expected ${expected.status}, got ${execution.status}`);
    }
    if (typeof expected.state_reached === 'boolean' && execution.state_reached !== expected.state_reached) {
      violations.push(`state_reached expected ${expected.state_reached}, got ${execution.state_reached}`);
    }
    if (expected.target_observability && execution.target_observability !== expected.target_observability) {
      violations.push(
        `target_observability expected ${expected.target_observability}, got ${execution.target_observability}`,
      );
    }
    if (expected.error?.required) {
      if (!execution.error) violations.push(`error expected with code ${expected.error.code}, none reported`);
      else if (expected.error.code && execution.error.code !== expected.error.code) {
        violations.push(`error code expected ${expected.error.code}, got ${execution.error.code}`);
      }
    }

    // The examined-count boundary is asserted over every outcome the execution
    // produced, because a pipeline case asserts on what the machinery handed
    // the controls rather than on any single criterion.
    const counts = (execution.outcomes ?? []).map((outcome) =>
      Number.isInteger(outcome.examined_count) ? outcome.examined_count : null,
    );
    const known = counts.filter((count) => count !== null);
    const observedExamined = known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
    const examined = examinedSatisfies(expected.examined_count, observedExamined);
    if (!examined.ok) {
      violations.push(
        `examined_count expected ${JSON.stringify(expected.examined_count)}, got ${JSON.stringify(examined.observed)}`,
      );
    }

    for (const forbidden of expected.forbidden_verdicts ?? []) {
      const reported = (execution.outcomes ?? []).filter((outcome) => outcome.verdict === forbidden);
      if (reported.length > 0) {
        violations.push(`forbidden verdict ${forbidden} reported ${reported.length} time(s)`);
      }
    }

    if (violations.length === 0) honored += 1;
    detail.push({ case_id: assertion.case_id, honored: violations.length === 0, violations });
  }

  return {
    honored,
    denominator: assertions.length,
    rate: rate(honored, assertions.length),
    not_run: notRun,
    detail,
  };
}

// --- lane: human-judgement cases --------------------------------------------

function scoreHumanLane(cases, executionsById) {
  const humanCases = [...cases.values()].filter(isHumanLane);
  const tally = { cannot_tell: 0, unsupported: 0, other_verdict: 0, not_run: 0, executed: 0 };

  for (const fixture of sortedBy(humanCases, 'id')) {
    const execution = executionsById.get(fixture.id);
    if (!execution) {
      tally.not_run += 1;
      continue;
    }
    tally.executed += 1;
    const verdicts = new Set((execution.outcomes ?? []).map((outcome) => outcome.verdict));
    if (verdicts.has('cannot-tell')) tally.cannot_tell += 1;
    else if (verdicts.has('unsupported')) tally.unsupported += 1;
    else if (verdicts.size > 0) tally.other_verdict += 1;
  }

  return {
    denominator: humanCases.length,
    note: 'Human-judgement evidence. Never averaged into automated recall or false-positive rates.',
    ...tally,
  };
}

// --- execution, observability and examined-count accounting -----------------

function scoreExecutions(cases, executions, executionsById) {
  const status = Object.fromEntries(EXECUTION_STATUSES.map((value) => [value, 0]));
  const observability = Object.fromEntries(OBSERVABILITY_STATES.map((value) => [value, 0]));
  const state = { reached: 0, not_reached: 0 };
  const examined = { reported_positive: 0, reported_zero: 0, unknown: 0, outcomes: 0 };
  const cannotTell = { outcomes: 0, cases: new Set() };

  for (const execution of executions) {
    if (Object.hasOwn(status, execution.status)) status[execution.status] += 1;
    if (Object.hasOwn(observability, execution.target_observability)) observability[execution.target_observability] += 1;
    if (execution.state_reached) state.reached += 1;
    else state.not_reached += 1;

    for (const outcome of execution.outcomes ?? []) {
      examined.outcomes += 1;
      if (outcome.examined_count === null || outcome.examined_count === undefined) examined.unknown += 1;
      else if (outcome.examined_count === 0) examined.reported_zero += 1;
      else examined.reported_positive += 1;

      if (outcome.verdict === 'cannot-tell') {
        cannotTell.outcomes += 1;
        cannotTell.cases.add(execution.case_id);
      }
    }
  }

  return {
    executions: {
      total: executions.length,
      corpus_cases: cases.size,
      not_run: Math.max(0, cases.size - executionsById.size),
      ...status,
    },
    state,
    observability,
    examined_counts: {
      ...examined,
      note: 'reported_zero and unknown are distinct. An unknown count is never read as zero, and neither can become a pass.',
    },
    cannot_tell: {
      outcomes: cannotTell.outcomes,
      cases: cannotTell.cases.size,
      note: 'Reported as its own lane. A cannot-tell is never credited as a detection or a pass.',
    },
  };
}

// --- breakdowns -------------------------------------------------------------

function breakdown(keyFor, recallAssertions, recallDetail, fpAssertions, fpDetail) {
  const groups = new Map();
  const ensure = (key) => {
    if (!groups.has(key)) {
      groups.set(key, { group: key, tp_detected: 0, tp_denominator: 0, fp_count: 0, fp_denominator: 0 });
    }
    return groups.get(key);
  };

  const detectedKeys = new Map(recallDetail.map((row) => [`${row.case_id}|${row.criterion}`, row.detected]));
  for (const assertion of recallAssertions) {
    for (const key of keyFor(assertion)) {
      const group = ensure(key);
      group.tp_denominator += 1;
      if (detectedKeys.get(`${assertion.case_id}|${assertion.criterion}`)) group.tp_detected += 1;
    }
  }

  const flagged = new Set(fpDetail.map((row) => `${row.case_id}|${row.criterion}`));
  for (const assertion of fpAssertions) {
    for (const key of keyFor(assertion)) {
      const group = ensure(key);
      group.fp_denominator += 1;
      if (flagged.has(`${assertion.case_id}|${assertion.criterion}`)) group.fp_count += 1;
    }
  }

  return sortedBy(
    [...groups.values()].map((group) => ({
      ...group,
      tp_rate: rate(group.tp_detected, group.tp_denominator),
      fp_rate: rate(group.fp_count, group.fp_denominator),
    })),
    'group',
  );
}

// --- engine lineage ---------------------------------------------------------

/**
 * Independence accounting.
 *
 * Two interfaces over one engine are one detection vote, not two. Anything
 * declaring itself a wrapper or derived configuration is attributed to the
 * engine it names and excluded from the independent-engine count.
 */
function scoreEngines(tools) {
  const independent = new Set();
  const derived = [];

  for (const tool of tools) {
    if (tool.independence === 'independent-engine') independent.add(tool.engine_family);
    else derived.push({ tool: tool.name, independence: tool.independence, attributed_to: tool.wrapper_of ?? tool.engine_family });
  }

  return {
    independent_engines: [...independent].sort(),
    independent_engine_count: independent.size,
    derived: sortedBy(derived, 'tool'),
    note: 'Wrappers and derived configurations are attributed to their underlying engine and are not counted as independent detection votes.',
  };
}

// --- repeat variance --------------------------------------------------------

function variance(values) {
  if (values.length === 0) return null;
  const numeric = values.filter((value) => typeof value === 'number');
  if (numeric.length === 0) return null;
  const mean = numeric.reduce((a, b) => a + b, 0) / numeric.length;
  const spread = numeric.reduce((total, value) => total + (value - mean) ** 2, 0) / numeric.length;
  return {
    min: Number(Math.min(...numeric).toFixed(6)),
    max: Number(Math.max(...numeric).toFixed(6)),
    mean: Number(mean.toFixed(6)),
    stddev: Number(Math.sqrt(spread).toFixed(6)),
  };
}

function scoreRepeats(perRun) {
  const unstable = new Map();
  for (const run of perRun) {
    for (const row of run.lanes.automated.true_positive_recall.detail) {
      const key = `${row.case_id}|${row.criterion}`;
      if (!unstable.has(key)) unstable.set(key, new Set());
      unstable.get(key).add(row.detected);
    }
  }

  const flapping = [...unstable.entries()]
    .filter(([, outcomes]) => outcomes.size > 1)
    .map(([key]) => {
      const [case_id, criterion] = key.split('|');
      return { case_id, criterion };
    });

  return {
    runs: perRun.length,
    repeats: perRun.map((run) => run.run.repeat).sort((a, b) => a - b),
    true_positive_rate: variance(perRun.map((run) => run.lanes.automated.true_positive_recall.rate)),
    false_positive_rate: variance(perRun.map((run) => run.lanes.automated.false_positive.rate)),
    pipeline_rate: variance(perRun.map((run) => run.lanes.pipeline.rate)),
    unstable_assertions: sortedBy(flapping, 'case_id'),
    note: 'An assertion whose detection flips between repeats is not a stable measurement.',
  };
}

// --- top level --------------------------------------------------------------

function scoreSingleRun(corpus, result, assertionSets, reachable) {
  const executions = result.executions;
  const executionsById = new Map();
  const duplicates = [];
  const unknownCases = [];

  for (const execution of executions) {
    if (executionsById.has(execution.case_id)) duplicates.push(execution.case_id);
    executionsById.set(execution.case_id, execution);
    if (!corpus.cases.has(execution.case_id)) unknownCases.push(execution.case_id);
  }

  const recall = scoreRecall(assertionSets.truePositive, executionsById, reachable);
  const falsePositive = scoreFalsePositives(assertionSets.falsePositive, executionsById, reachable);
  const pipeline = scorePipeline(assertionSets.pipeline, executionsById);
  const human = scoreHumanLane(corpus.cases, executionsById);
  const accounting = scoreExecutions(corpus.cases, executions, executionsById);

  return {
    run: {
      id: result.run.id,
      repeat: result.run.repeat,
      started_at: result.run.started_at,
      completed_at: result.run.completed_at,
      environment_digest: digestOf(result.run.environment),
    },
    tool: result.run.tool,
    lanes: {
      automated: { true_positive_recall: recall, false_positive: falsePositive },
      pipeline,
      human,
    },
    ...accounting,
    anomalies: {
      duplicate_case_ids: [...new Set(duplicates)].sort(),
      unknown_case_ids: [...new Set(unknownCases)].sort(),
    },
  };
}

function pool(perRun, assertionSets, corpus, { reachable, levels }) {
  const sum = (pick) => perRun.reduce((total, run) => total + pick(run), 0);

  const tpNumerator = sum((run) => run.lanes.automated.true_positive_recall.numerator);
  const tpDenominator = sum((run) => run.lanes.automated.true_positive_recall.denominator);
  const tpAttempted = sum((run) => run.lanes.automated.true_positive_recall.denominator_attempted);
  const tpReachable = sum((run) => run.lanes.automated.true_positive_recall.denominator_engine_reachable);
  const tpReachableHit = perRun.reduce(
    (total, run) =>
      total + run.lanes.automated.true_positive_recall.detail.filter((row) => row.detected && row.engine_reachable).length,
    0,
  );
  const fpReachable = sum((run) => run.lanes.automated.false_positive.denominator_engine_reachable);
  const controlReachable = sum((run) => run.lanes.automated.false_positive.corrected_control.denominator_engine_reachable);
  const fpCount = sum((run) => run.lanes.automated.false_positive.count);
  const fpDenominator = sum((run) => run.lanes.automated.false_positive.denominator);
  const controlCount = sum((run) => run.lanes.automated.false_positive.corrected_control.count);
  const controlDenominator = sum((run) => run.lanes.automated.false_positive.corrected_control.denominator);
  const pipelineHonored = sum((run) => run.lanes.pipeline.honored);
  const pipelineDenominator = sum((run) => run.lanes.pipeline.denominator);

  const missedKeys = Object.keys(perRun[0].lanes.automated.true_positive_recall.missed);
  const missed = Object.fromEntries(
    missedKeys.map((key) => [key, sum((run) => run.lanes.automated.true_positive_recall.missed[key])]),
  );

  // Breakdowns are computed from the first run so the grouping stays readable;
  // pooled rates above already carry every repeat.
  const first = perRun[0];
  const recallDetail = first.lanes.automated.true_positive_recall.detail;
  const fpDetail = first.lanes.automated.false_positive.detail;

  return {
    lanes: {
      automated: {
        true_positive_recall: {
          numerator: tpNumerator,
          denominator: tpDenominator,
          rate: rate(tpNumerator, tpDenominator),
          // The full-corpus denominator is the headline, so a partial run
          // cannot look complete. The attempted denominator is published
          // beside it so a deliberately scoped run stays readable.
          denominator_attempted: tpAttempted,
          rate_of_attempted: rate(tpNumerator, tpAttempted),
          denominator_engine_reachable: tpReachable,
          rate_engine_reachable: rate(tpReachableHit, tpReachable),
          engine_unreachable: tpDenominator - tpReachable,
          missed,
        },
        false_positive: {
          count: fpCount,
          denominator: fpDenominator,
          rate: rate(fpCount, fpDenominator),
          denominator_engine_reachable: fpReachable,
          rate_engine_reachable: rate(fpCount, fpReachable),
          engine_unreachable: fpDenominator - fpReachable,
          corrected_control: {
            count: controlCount,
            denominator: controlDenominator,
            rate: rate(controlCount, controlDenominator),
            denominator_engine_reachable: controlReachable,
            rate_engine_reachable: rate(controlCount, controlReachable),
            engine_unreachable: controlDenominator - controlReachable,
          },
        },
      },
      pipeline: {
        honored: pipelineHonored,
        denominator: pipelineDenominator,
        rate: rate(pipelineHonored, pipelineDenominator),
      },
      human: first.lanes.human,
    },
    breakdowns: {
      by_family: breakdown(
        (assertion) => [assertion.family],
        assertionSets.truePositive,
        recallDetail,
        assertionSets.falsePositive,
        fpDetail,
      ),
      by_criterion: breakdown(
        (assertion) => [assertion.criterion],
        assertionSets.truePositive,
        recallDetail,
        assertionSets.falsePositive,
        fpDetail,
      ),
      by_functional_need: breakdown(
        (assertion) => assertion.fixture.user_needs ?? [],
        assertionSets.truePositive,
        recallDetail,
        assertionSets.falsePositive,
        fpDetail,
      ),
      // WCAG level matters for comparability: no shipping engine implements
      // AAA, so pooling AAA assertions into one rate depresses the headline
      // while carrying no discriminating information.
      by_level: breakdown(
        (assertion) => [levels.get(assertion.criterion) ?? 'unknown'],
        assertionSets.truePositive,
        recallDetail,
        assertionSets.falsePositive,
        fpDetail,
      ),
    },
    // Criteria the corpus asserts on that no run in this comparison reported at
    // all. Published so "nobody implements this" is visible rather than
    // inferred from a low rate.
    criteria_no_engine_reported: [
      ...new Set(
        [...assertionSets.truePositive, ...assertionSets.falsePositive]
          .map((assertion) => assertion.criterion)
          .filter((criterion) => !reachable.has(criterion)),
      ),
    ].sort(),
    corpus_cases: corpus.cases.size,
  };
}

/**
 * Score one or more result files against the corpus.
 *
 * All inputs must declare the same corpus revision and manifest digest; mixing
 * revisions would silently compare against two different ground truths.
 */
export function scoreResults(corpus, results, { strict = false } = {}) {
  const errors = [];
  const warnings = [];

  if (results.length === 0) errors.push('no result files supplied');

  const revisions = new Set(results.map((result) => result.corpus.revision));
  const manifests = new Set(results.map((result) => result.corpus.manifest_sha256));
  const repositories = new Set(results.map((result) => result.corpus.repository));

  if (revisions.size > 1) {
    errors.push(`result files declare ${revisions.size} different corpus revisions: ${[...revisions].sort().join(', ')}`);
  }
  if (manifests.size > 1) {
    errors.push(`result files declare ${manifests.size} different manifest digests; they cannot be pooled`);
  }
  if (repositories.size > 1) {
    errors.push(`result files declare different corpora: ${[...repositories].sort().join(', ')}`);
  }
  if (errors.length > 0) return { errors, warnings };

  const declaredManifest = [...manifests][0];
  if (declaredManifest !== corpus.manifest_sha256) {
    const message =
      `result declares manifest ${declaredManifest} but the checked-out corpus manifest is ${corpus.manifest_sha256}; ` +
      'ground truth may not be the ground truth the run was measured against';
    if (strict) errors.push(message);
    else warnings.push(message);
  }
  if (errors.length > 0) return { errors, warnings };

  const assertionSets = {
    truePositive: truePositiveAssertions(corpus.cases).filter((assertion) => !isHumanLane(assertion.fixture)),
    falsePositive: falsePositiveAssertions(corpus.cases).filter((assertion) => !isHumanLane(assertion.fixture)),
    pipeline: pipelineAssertions(corpus.cases),
  };

  const reachable = engineReachableCriteria(results);
  const levels = corpus.levels ?? new Map();

  const perRun = results
    .map((result) => scoreSingleRun(corpus, result, assertionSets, reachable))
    .sort((a, b) => a.run.repeat - b.run.repeat || a.run.id.localeCompare(b.run.id));

  for (const run of perRun) {
    for (const unknown of run.anomalies.unknown_case_ids) {
      warnings.push(`run ${run.run.id} reports case_id ${unknown}, which is not in the corpus manifest`);
    }
    for (const duplicate of run.anomalies.duplicate_case_ids) {
      warnings.push(`run ${run.run.id} reports case_id ${duplicate} more than once; the last execution was used`);
    }
  }

  const environments = new Set(perRun.map((run) => run.run.environment_digest));
  if (environments.size > 1) {
    warnings.push(`pooled runs span ${environments.size} different environments; repeat variance may reflect the environment`);
  }

  const pooled = pool(perRun, assertionSets, corpus, { reachable, levels });
  const tools = perRun.map((run) => run.tool);

  return {
    format: SCORE_FORMAT,
    format_version: SCORE_FORMAT_VERSION,
    scoring_policy: SCORING_POLICY,
    corpus: {
      repository: [...repositories][0],
      revision: [...revisions][0],
      manifest_sha256: declaredManifest,
      families: corpus.manifest.counts.families,
      cases: corpus.manifest.counts.cases,
    },
    engines: scoreEngines(tools),
    ...pooled,
    repeat_variance: scoreRepeats(perRun),
    per_run: perRun,
    errors,
    warnings,
    boundaries: [
      'Not a WCAG conformance claim, certification or endorsement.',
      'No single universal score is produced; every rate is published with its numerator and denominator.',
      'error, blocked, unsupported, not-observed, cannot-tell and examined_count 0 are never credited as passes or detections.',
    ],
  };
}

// --- regression comparison --------------------------------------------------

const COMPARABLE = [
  ['scoring_policy', (score) => score.scoring_policy],
  ['corpus repository', (score) => score.corpus.repository],
  ['corpus revision', (score) => score.corpus.revision],
  ['corpus manifest digest', (score) => score.corpus.manifest_sha256],
];

/**
 * Compare two scores. Refuses when the two runs are not measuring the same
 * thing, because a delta across corpus revisions or scoring policies is not a
 * regression signal.
 */
export function compareScores(baseline, candidate) {
  const blockers = [];
  for (const [label, pick] of COMPARABLE) {
    const before = pick(baseline);
    const after = pick(candidate);
    if (before !== after) blockers.push(`${label} differs: baseline ${before}, candidate ${after}`);
  }

  if (blockers.length > 0) {
    return {
      comparable: false,
      blockers,
      hint: 'Re-run both products against one pinned corpus revision with one scoring policy before comparing.',
    };
  }

  const delta = (before, after) => ({
    baseline: before,
    candidate: after,
    delta: before === null || after === null ? null : Number((after - before).toFixed(6)),
  });

  const metrics = {
    true_positive_rate: delta(
      baseline.lanes.automated.true_positive_recall.rate,
      candidate.lanes.automated.true_positive_recall.rate,
    ),
    true_positive_detected: delta(
      baseline.lanes.automated.true_positive_recall.numerator,
      candidate.lanes.automated.true_positive_recall.numerator,
    ),
    false_positive_rate: delta(baseline.lanes.automated.false_positive.rate, candidate.lanes.automated.false_positive.rate),
    false_positive_count: delta(
      baseline.lanes.automated.false_positive.count,
      candidate.lanes.automated.false_positive.count,
    ),
    corrected_control_false_positive_rate: delta(
      baseline.lanes.automated.false_positive.corrected_control.rate,
      candidate.lanes.automated.false_positive.corrected_control.rate,
    ),
    pipeline_rate: delta(baseline.lanes.pipeline.rate, candidate.lanes.pipeline.rate),
  };

  const regressions = [];
  if (metrics.true_positive_rate.delta !== null && metrics.true_positive_rate.delta < 0) {
    regressions.push(`true-positive recall fell by ${Math.abs(metrics.true_positive_rate.delta)}`);
  }
  if (metrics.false_positive_rate.delta !== null && metrics.false_positive_rate.delta > 0) {
    regressions.push(`false-positive rate rose by ${metrics.false_positive_rate.delta}`);
  }
  if (metrics.pipeline_rate.delta !== null && metrics.pipeline_rate.delta < 0) {
    regressions.push(`pipeline-integrity honouring fell by ${Math.abs(metrics.pipeline_rate.delta)}`);
  }

  // Assertion-level movement, so a flat headline rate cannot hide an equal
  // number of newly-detected and newly-missed assertions.
  const statusOf = (score) =>
    new Map(
      score.per_run[0].lanes.automated.true_positive_recall.detail.map((row) => [
        `${row.case_id}|${row.criterion}`,
        row.detected,
      ]),
    );
  const before = statusOf(baseline);
  const after = statusOf(candidate);
  const newlyMissed = [];
  const newlyDetected = [];
  for (const [key, detected] of after) {
    if (!before.has(key)) continue;
    const [case_id, criterion] = key.split('|');
    if (before.get(key) && !detected) newlyMissed.push({ case_id, criterion });
    if (!before.get(key) && detected) newlyDetected.push({ case_id, criterion });
  }

  return {
    comparable: true,
    scoring_policy: baseline.scoring_policy,
    corpus: baseline.corpus,
    baseline_tool: baseline.per_run[0].tool,
    candidate_tool: candidate.per_run[0].tool,
    metrics,
    newly_missed: sortedBy(newlyMissed, 'case_id'),
    newly_detected: sortedBy(newlyDetected, 'case_id'),
    regressions,
    regressed: regressions.length > 0 || newlyMissed.length > 0,
  };
}

// --- CSV --------------------------------------------------------------------

const CSV_COLUMNS = [
  'corpus_repository',
  'corpus_revision',
  'manifest_sha256',
  'scoring_policy',
  'lane',
  'metric',
  'group_kind',
  'group',
  'numerator',
  'denominator',
  'value',
];

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Flatten a score into rows that always carry their denominator and corpus identity. */
export function toCsv(score) {
  const identity = [score.corpus.repository, score.corpus.revision, score.corpus.manifest_sha256, score.scoring_policy];
  const rows = [];
  const push = (lane, metric, groupKind, group, numerator, denominator, value) =>
    rows.push([...identity, lane, metric, groupKind, group, numerator, denominator, value]);

  const recall = score.lanes.automated.true_positive_recall;
  const fp = score.lanes.automated.false_positive;

  push('automated', 'true_positive_recall', 'overall', '', recall.numerator, recall.denominator, recall.rate);
  push(
    'automated',
    'true_positive_recall_of_attempted',
    'overall',
    '',
    recall.numerator,
    recall.denominator_attempted,
    recall.rate_of_attempted,
  );
  push(
    'automated',
    'true_positive_recall_engine_reachable',
    'overall',
    '',
    recall.numerator,
    recall.denominator_engine_reachable,
    recall.rate_engine_reachable,
  );
  push(
    'automated',
    'false_positive_engine_reachable',
    'overall',
    '',
    fp.count,
    fp.denominator_engine_reachable,
    fp.rate_engine_reachable,
  );
  push(
    'automated',
    'corrected_control_false_positive_engine_reachable',
    'overall',
    '',
    fp.corrected_control.count,
    fp.corrected_control.denominator_engine_reachable,
    fp.corrected_control.rate_engine_reachable,
  );
  push('automated', 'false_positive', 'overall', '', fp.count, fp.denominator, fp.rate);
  push(
    'automated',
    'corrected_control_false_positive',
    'overall',
    '',
    fp.corrected_control.count,
    fp.corrected_control.denominator,
    fp.corrected_control.rate,
  );
  push('pipeline', 'expected_execution_honored', 'overall', '', score.lanes.pipeline.honored, score.lanes.pipeline.denominator, score.lanes.pipeline.rate);

  for (const [reason, count] of Object.entries(recall.missed)) {
    push('automated', `missed_${reason}`, 'overall', '', count, recall.denominator, rate(count, recall.denominator));
  }

  const human = score.lanes.human;
  for (const key of ['executed', 'cannot_tell', 'unsupported', 'other_verdict', 'not_run']) {
    push('human', `human_${key}`, 'overall', '', human[key], human.denominator, rate(human[key], human.denominator));
  }

  for (const run of score.per_run) {
    for (const [metric, value] of Object.entries(run.executions)) {
      if (metric === 'corpus_cases') continue;
      push('execution', `execution_${metric}`, 'run', run.run.id, value, run.executions.corpus_cases, null);
    }
    for (const [metric, value] of Object.entries(run.observability)) {
      push('execution', `observability_${metric}`, 'run', run.run.id, value, run.executions.total, rate(value, run.executions.total));
    }
    for (const metric of ['reported_positive', 'reported_zero', 'unknown']) {
      push(
        'execution',
        `examined_${metric}`,
        'run',
        run.run.id,
        run.examined_counts[metric],
        run.examined_counts.outcomes,
        rate(run.examined_counts[metric], run.examined_counts.outcomes),
      );
    }
  }

  for (const [kind, groups] of Object.entries(score.breakdowns)) {
    for (const group of groups) {
      push('automated', 'true_positive_recall', kind, group.group, group.tp_detected, group.tp_denominator, group.tp_rate);
      push('automated', 'false_positive', kind, group.group, group.fp_count, group.fp_denominator, group.fp_rate);
    }
  }

  return [CSV_COLUMNS.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n') + '\n';
}
