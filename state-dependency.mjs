// Why a case needs its page driven before the defect exists.
//
// `method: ["interaction"]` is a claim that the delivered page does not yet
// contain the defect. 53 cases made that claim while shipping a page that
// already rendered the state they were about, which turned a real engine gap
// into an apparent harness limitation and produced a wrong diagnosis.
//
// A purely syntactic detector cannot settle this. A fixture whose defect is a
// sticky bar covering a focused control has no script, no handler and no
// `:focus` rule -- the dependency is on focus being driven, which is invisible
// in the markup. So the reason is declared rather than inferred, and the test
// checks the declared reason against the artifact wherever that is mechanically
// possible.

export const DEPENDENCY_REASONS = Object.freeze({
  script: 'a script changes the page after load',
  handler: 'an inline event handler changes the page',
  'css-state': 'the defect lives in an interaction pseudo-class such as :focus or :hover',
  focus: 'the defect exists only while a control has focus, with no markup that says so',
  hidden: 'the content carrying the defect is hidden until something reveals it',
  'media-query': 'the defect appears only under a display preference such as a dark or forced-colors scheme',
  steps: 'the case is a multi-page walk and the defect is not on the entry page',
  temporal: 'confirming the case requires waiting, so it cannot be settled from one snapshot',
  'runner-behaviour': 'the assertion is about what the runner does, not about page content',
});

const SIGNALS = {
  script: /<script[\s>]/i,
  handler: /\son(?:click|input|change|focus|blur|submit|pointerdown|mousedown|keydown|keyup|toggle)\s*=/i,
  'css-state': /:(?:focus|focus-visible|focus-within|hover|active|target|checked)\b/i,
  hidden: /\shidden(?:\s|>|=)/i,
  'media-query': /@media[^{]*\((?:prefers-|forced-colors)/i,
};

/**
 * Reasons an artifact mechanically demonstrates.
 *
 * `focus`, `temporal`, `steps` and `runner-behaviour` are absent by design:
 * nothing in the markup proves them, so they are declared and reviewed rather
 * than detected.
 */
export function detectedReasons(html) {
  return Object.entries(SIGNALS)
    .filter(([, pattern]) => pattern.test(html))
    .map(([reason]) => reason);
}

/** Does this case claim its page must be driven? */
export const claimsInteraction = (testCase) =>
  (testCase.method ?? []).some((method) => method === 'interaction' || method === 'state-exploration');

/**
 * Validate one case's claim against its artifact.
 *
 * A declared reason that the markup can demonstrate must be demonstrated. A
 * declared reason the markup cannot speak to is accepted as a reviewed
 * statement. A claim with no reason at all is the defect this guards against.
 */
export function validateClaim(testCase, html) {
  const declared = testCase.state_dependency ?? null;

  if (!claimsInteraction(testCase)) {
    return declared
      ? { ok: false, problem: `declares state_dependency "${declared}" but claims no interaction method` }
      : { ok: true };
  }

  // A multi-page walk justifies itself from the case, not the markup: the
  // defect may sit on a later step the entry page cannot show.
  const walks = testCase.scope === 'multi-page' || (testCase.steps ?? []).length > 0;
  if (walks && (!declared || declared === 'steps')) return { ok: true, reason: 'steps' };

  if (!declared) {
    const detected = detectedReasons(html);
    return {
      ok: false,
      problem: detected.length > 0
        ? `claims interaction with no state_dependency; the artifact suggests ${detected.join(', ')}`
        : 'claims interaction with no state_dependency, and the artifact shows no sign it needs driving',
    };
  }

  if (!Object.hasOwn(DEPENDENCY_REASONS, declared)) {
    return { ok: false, problem: `unknown state_dependency "${declared}"` };
  }

  if (Object.hasOwn(SIGNALS, declared) && !SIGNALS[declared].test(html)) {
    return { ok: false, problem: `declares state_dependency "${declared}" but the artifact contains no such signal` };
  }

  return { ok: true };
}

/**
 * The interaction methods an artifact justifies, for a generator to splat in.
 *
 * Returns `state-exploration` as well when the page changes itself after load,
 * because exploring to the changed state is then a distinct capability.
 */
export function interactionMethods(html) {
  const reasons = detectedReasons(html);
  if (reasons.length === 0) return [];
  const methods = ['interaction'];
  if (reasons.includes('script') || reasons.includes('handler') || reasons.includes('hidden')) {
    methods.push('state-exploration');
  }
  return methods;
}

/** The `state_dependency` field for a generated case, or nothing. */
export function stateDependency(html) {
  const reasons = detectedReasons(html);
  return reasons.length > 0 ? { state_dependency: reasons[0] } : {};
}
