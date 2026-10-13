// Example mapping code: native product output -> benchmark-result executions.
//
// Replace this file. Keep its shape.
//
// This example invents its findings so the starter kit runs with no product
// installed and produces a reproducible bundle. A real adapter runs the
// product against `corpusRoot/testCase.path` and maps what comes back.
//
// The mapping rules that matter, in the order they bite:
//
// 1. Preserve native rule identity. `native_rule_id` is the product's own id.
//    Mapping it to a criterion must not replace it, or nobody can trace a
//    finding back to the rule that produced it.
// 2. Never invent an examined count. If the product cannot say how many
//    elements a rule looked at, pass null. Null means "did not say"; 0 means
//    "examined nothing", and the scorer treats those very differently.
// 3. Never convert a failure to reach the target into a pass. If the page did
//    not load, the state was not reached, or the rule did not run, say so with
//    `status` and `target_observability` and leave the outcome out.
// 4. `cannot-tell` is a real verdict. Use it where the product genuinely cannot
//    decide rather than guessing pass or fail.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function describe() {
  return 'example-adapter (synthetic; replace with a real product adapter)';
}

/** Deterministic pseudo-randomness, so the example bundle is reproducible. */
function seeded(value) {
  const digest = crypto.createHash('sha256').update(value).digest();
  return digest[0] / 255;
}

/**
 * Evaluate one case.
 *
 * Returns a single `execution` object exactly as
 * `schemas/benchmark-result.schema.json` defines it.
 */
export async function evaluate({ testCase, corpusRoot }) {
  const file = path.join(corpusRoot, testCase.path);

  // A real adapter would drive the product here. This one reads the fixture so
  // the example still demonstrates an honest error path.
  let markup;
  try {
    markup = fs.readFileSync(file, 'utf8');
  } catch (error) {
    return {
      case_id: testCase.id,
      case_path: testCase.path,
      status: 'error',
      declared_state: testCase.ui_state ?? 'default',
      state_reached: false,
      target_observability: 'not-observed',
      outcomes: [],
      error: { code: 'fixture-unreadable', message: `could not read ${testCase.path}` },
    };
  }

  // Multi-page cases need a state driver. An adapter that cannot drive one must
  // report `blocked`, not quietly evaluate the entry page and call it done.
  if (testCase.scope === 'multi-page') {
    return {
      case_id: testCase.id,
      case_path: testCase.path,
      status: 'blocked',
      declared_state: testCase.ui_state ?? 'default',
      state_reached: false,
      target_observability: 'not-observed',
      outcomes: [],
    };
  }

  // The criteria this case is about. A real adapter maps from its own rules to
  // criteria; it does not read the corpus's expectations. This one does, purely
  // so the synthetic example produces a plausible mixture of hits and misses.
  const criteria = [...new Set([...Object.keys(testCase.min_criteria ?? {}), ...(testCase.must_not_report ?? [])])];
  const examined = markup.length > 0 ? Math.max(1, markup.split('<').length - 1) : 0;

  const outcomes = criteria.map((criterion) => {
    const roll = seeded(`${testCase.id}|${criterion}`);
    const shouldReport = Object.keys(testCase.min_criteria ?? {}).includes(criterion);

    // ~15% of the time the example declines to decide, to exercise the
    // cannot-tell lane rather than pretending to a verdict.
    if (roll > 0.85) {
      return {
        criterion,
        native_rule_id: `example.${criterion.replace(/\./g, '-')}`,
        verdict: 'cannot-tell',
        findings: 0,
        examined_count: examined,
        evidence: [{ type: 'manual-note', note: 'the example adapter declines to decide this case' }],
      };
    }

    return {
      criterion,
      native_rule_id: `example.${criterion.replace(/\./g, '-')}`,
      verdict: shouldReport ? 'fail' : 'pass',
      findings: shouldReport ? 1 : 0,
      examined_count: examined,
      evidence: [
        {
          type: 'digest',
          // The digest of the native output, so a party holding the artifact can
          // verify its identity without the bundle redistributing it.
          digest: `sha256:${crypto.createHash('sha256').update(markup).digest('hex')}`,
        },
      ],
    };
  });

  // No applicable criteria is `completed` with an inapplicable outcome, not an
  // empty pass. The schema requires at least one outcome on a completed run.
  if (outcomes.length === 0) {
    outcomes.push({
      criterion: '1.1.1',
      native_rule_id: 'example.applicability',
      verdict: 'inapplicable',
      findings: 0,
      examined_count: examined,
      evidence: [{ type: 'manual-note', note: 'no criterion under test applies to this fixture' }],
    });
  }

  return {
    case_id: testCase.id,
    case_path: testCase.path,
    status: 'completed',
    declared_state: testCase.ui_state ?? 'default',
    state_reached: true,
    target_observability: examined > 0 ? 'observed' : 'not-observed',
    outcomes,
  };
}
