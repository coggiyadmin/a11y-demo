# Evaluation methodology

## Reviewer preparation

Before collecting publishable evidence, a reviewer must:

1. read the selected protocol and its fixture ground truth;
2. demonstrate normal operation of the recorded product and input method on a
   calibration fixture;
3. distinguish `cannot-tell` from `not-tested` and explain why neither is pass;
4. rehearse the protocol's reset and stop procedures; and
5. complete one practice record that is excluded from published metrics.

Product-specific interoperability work should be performed by someone familiar
with the normal commands and workflow of that exact pairing. User-task sessions
need a trained facilitator. Familiarity is recorded as a role qualification,
not personal biography.

## Session control

Pin the corpus revision and digest before testing. Use only public synthetic
fixtures. Record the protocol ID/version, fixture IDs, product/version, browser
and version, platform and version, settings and input method. Run broken and
corrected fixtures as separate sessions, reset state between them and retain
errors, blockers and stops.

Every step has one outcome and supporting observation. Evidence should be the
smallest public-synthetic note, trace, transcript, screenshot, recording or
digest needed to reproduce the decision. A missing observation is not repaired
by an overall task-completion claim.

## Safety and privacy

The protocols prohibit participant data and production evidence. Do not publish
names, contact details, account information, voiceprints, health information,
raw participant recordings, customer pages, private selectors, credentials or
internal paths. Consent administration stays outside the public bundle.

Apply every protocol-specific stop condition. A stop is not a failed review:
record the triggering observation, preserve already completed steps and mark
unattempted steps `not-tested`. Never continue solely to improve a completion
percentage.

## Independent review

When double review is requested, two qualified reviewers receive the same
protocol, fixture revision, task prompt and environment definition. They work
independently and cannot see the other result before both records are frozen.

Compare decisions by stable step ID. Report:

- number of compared decisions;
- exact agreement count and raw agreement;
- Cohen's kappa with the categories actually used; and
- every disagreement with both original outcomes.

Do not force consensus. A disagreement can remain `unresolved`, be
`documented-separate`, or be `adjudicated` by a third qualified reviewer. Even
after adjudication, preserve both independent inputs and identify the rule or
evidence used. Never rewrite an original review to make the agreement number
higher.

Agreement measures reproducibility of the protocol, not correctness of either
reviewer. With small samples, publish the counts and contingency table rather
than presenting kappa alone.

## Metric separation

Publish these lanes independently:

- automated rule and pipeline results;
- human-guided results;
- product-pairing interoperability results; and
- user-task results.

Do not average them into a universal score. A human result may identify a
barrier that automation cannot decide, but it must not inflate automated recall
or change a zero-examined, unsupported, error, not-observed or `cannot-tell`
execution into pass.

## Corrections

Published results are immutable. If protocol application, evidence or an
outcome is corrected, publish a new record that references the superseded one
and states the reason. A changed protocol version, fixture revision, product,
environment or ground truth requires a new review rather than reuse of the old
decision.
