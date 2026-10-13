# Scoring benchmark results

`check/score.mjs` is the reference scorer and regression runner. It reads the
corpus manifest plus one or more schema-valid result files and produces
comparison metrics.

It does not produce one universal score. There isn't one. Coverage,
conformance, severity and confidence answer different questions, and a single
number would hide the one thing this corpus exists to expose: whether the
machinery ever handed the controls anything to judge.

```sh
npm ci --prefix check --ignore-scripts

node check/score.mjs score   result.json [more.json ...] [--json out.json] [--csv out.csv] [--strict]
node check/score.mjs compare baseline candidate [--json out.json]
```

`compare` accepts either score files or raw result files, scoring the latter on
the fly.

## What it will not do

These are enforced in code and covered by tests in `check/score.test.mjs`.

- An execution whose status is `error`, `blocked` or `unsupported` carries no
  verdict. It is counted in the execution lane, never as a detection or a pass.
- A failure claimed against a target the runner recorded as `not-observed` is
  not a detection. `unknown` observability is treated as a disclosure gap
  rather than a miss — it is counted and reported, but it does not by itself
  void a detection, because the published policy names only `not-observed`.
- A failure reported with `examined_count: 0` is a vacuous report and earns no
  credit. This is the defect Tier P exists to catch; crediting it would reward
  the exact failure the corpus was built to expose.
- An `examined_count` of `null` means *the product did not say*. It is never
  read as zero, and the two are reported separately.
- A `cannot-tell` outcome is a miss with its own reason code, and is tallied in
  its own lane. It is never a detection and never a pass.
- Human-judgement cases (`requires_human`, `guided`) are excluded from the
  automated assertion sets entirely and reported as a separate lane.
- Wrappers and derived configurations are attributed to the engine they name
  and excluded from the independent-engine count. Two interfaces over one
  engine are one detection vote.
- Results declaring different corpus revisions or manifest digests are refused
  rather than pooled.

## Denominators

Three denominators, because one number cannot be honest on its own.

**Engine-reachable.** A product cannot produce a false positive for a criterion
it has no rule for, and reporting nothing is not the same as exercising
restraint. Every rate is therefore also published over the criteria the run
*demonstrably evaluates* — those it emitted any outcome for, pass, fail,
`cannot-tell` or `inapplicable`.

This matters more than it sounds. Measured against axe-core 4.14.0:

```
corrected-control assertions:          192
  ...axe could possibly violate:        34  (18%)
  ...axe structurally CANNOT violate:  158  (82%)
```

Scoring 0 false positives over 192 credits an engine for silence on 158
assertions it was never at risk of failing. The same distortion runs the other
way for recall: 6.8% over the whole corpus, **31.1%** over the criteria axe
actually implements — and the second figure is the one comparable to published
numbers for the same engine.

The reachable rate is published *beside* the whole-corpus rate, never instead
of it. The full denominator is what stops a narrow engine looking complete; the
reachable one is what makes the figure comparable. An engine that reports
nothing at all gets `null`, not a perfect score.

Recall is also reported twice over, and both numbers matter:

- `true_positive_recall` uses **every** true-positive assertion in the corpus.
  Cases a run never executed stay in the denominator as `missed.not_run`, so a
  partial run cannot look complete.
- `true_positive_recall_of_attempted` uses only assertions whose case the run
  actually executed, so a deliberately scoped run stays readable.

One assertion is one `(case_id, criterion)` pair. A `tp` case declaring
`min_criteria: {"2.1.1": 1, "4.1.2": 1}` contributes two assertions. A `safe`
case declaring `must_not_report: ["2.1.1", "4.1.2"]` contributes two
false-positive assertions.

Where a product maps several native rules onto one criterion, findings are
summed across them and every native rule identifier is preserved.

## Metrics

| Lane | Metric | Shape |
|---|---|---|
| automated | true-positive recall | numerator / denominator / rate, plus attempted |
| automated | miss reasons | `not_run`, `execution_not_completed`, `target_not_observed`, `criterion_not_reported`, `reported_non_failing_verdict`, `cannot_tell`, `insufficient_findings`, `zero_examined_report` |
| automated | false positives | count / denominator / rate, the corrected-control subset, and the engine-reachable denominator for each |
| automated | by WCAG level | recall and false positives per A / AA / AAA |
| pipeline | expectations honored | honored / denominator, with per-case violations |
| human | cannot-tell, unsupported, not run | counts only, never averaged |
| execution | completed, blocked, unsupported, error, not run | counts against the corpus size |
| execution | state reached, target observability | counts per state |
| execution | examined counts | positive / zero / unknown, kept distinct |

Breakdowns are produced by fixture family, by success criterion, by WCAG level
and by functional need.

The level breakdown exists because no shipping engine implements WCAG AAA. The
corpus asserts on AAA deliberately — it states what a correct tool *should*
report, not what today's tools do — but pooling those assertions into one rate
depresses the headline while carrying no discriminating information. They are
reported on their own line instead. `criteria_no_engine_reported` names every
criterion no engine in the comparison reported at all, so "nobody implements
this" is visible rather than inferred from a low rate. Repeat variance reports min, max, mean and standard deviation
across repeats, and names every assertion whose detection flipped between them.

## Worked example

Two synthetic repeats of one fictional product ship with the corpus:

- [`schemas/examples/benchmark-result.repeat-1.json`](schemas/examples/benchmark-result.repeat-1.json)
- [`schemas/examples/benchmark-result.repeat-2.json`](schemas/examples/benchmark-result.repeat-2.json)

They cover nine cases chosen to exercise every path above: two detections, a
false positive on a corrected control, a blocked multi-step journey, an
honestly-reported vacuous pass, an unsupported flow-anchored case, and a
human-lane `cannot-tell`. Between the repeats one assertion flips from `fail`
to `cannot-tell`, which is what makes the run unstable and the comparison
regress.

```console
$ node check/score.mjs score schemas/examples/benchmark-result.repeat-1.json \
                             schemas/examples/benchmark-result.repeat-2.json
corpus       cogniumhq/a11y-benchmark@000000000000
manifest     sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
policy       cognium-a11y-scoring/1.1.0
runs         2 (repeats 1, 2)
engines      1 independent

automated lane
  true-positive recall    7/414       1.7%  (whole corpus)
  ... of attempted        7/16       43.8%  (cases this run executed)
  ... engine-reachable    7/106       6.6%  (criteria this engine evaluates)
  false positives         2/384       0.5%
  corrected-control FP    2/384       0.5%
  ... engine-reachable    2/88        2.3%  (the only FP figure it could fail)

  note: 296 of 384 corrected-control
  assertions (77%) are criteria this engine never reported. It cannot produce a false
  positive on those, so the full-denominator rate credits silence.

by WCAG level
  A         recall 4/146       2.7%    FP 1/130       0.8%
  AA        recall 0/43        0.0%    FP 0/44        0.0%
  AAA       recall 0/18        0.0%    FP 0/18        0.0%

misses by reason
  not_run                    398
  execution_not_completed    8
  cannot_tell                1

pipeline-integrity lane
  expectations honored    6/16       37.5%

human lane (never averaged into the rates above)
  cases 15  executed 1  cannot-tell 1  not run 14

execution accounting (first repeat)
  completed 6  blocked 1  unsupported 1  error 1  not run 261
  observed 7  not-observed 1  unknown 1
  examined: positive 9  zero 1  unknown 1
  cannot-tell outcomes 1 across 1 case(s)

repeat variance
  true-positive rate  min 0.014493  max 0.019324  mean 0.016908  stddev 0.002416
  unstable assertions 1

warnings
  - result declares manifest sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa but the checked-out corpus manifest is sha256:a4e01bcd1281bfb1c1951657a815ad2da053e5e233c1d937dd7ed7227c03c9f0; ground truth may not be the ground truth the run was measured against

criteria no engine in this comparison reported at all (65)
  1.1.1, 1.2.1, 1.2.3, 1.2.4, 1.2.5, 1.3.1, 1.3.2, 1.3.4, 1.3.5, 1.3.6, 1.4.1, 1.4.10, 1.4.11, 1.4.12, 1.4.13, 1.4.2, 1.4.3, 1.4.4, 1.4.8, 2.1.2, 2.2.1, 2.2.2, 2.2.3, 2.2.5, 2.2.6, 2.3.1, 2.3.2, 2.3.3, 2.4.10, 2.4.11, 2.4.12, 2.4.13, 2.4.2, 2.4.3, 2.4.4, 2.4.5, 2.4.6, 2.4.7, 2.4.8, 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6, 2.5.7, 2.5.8, 3.1.1, 3.1.2, 3.1.4, 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.6, 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.5, 3.3.6, 3.3.7, 3.3.8, 3.3.9, 4.1.3

note: Not a WCAG conformance claim, certification or endorsement.
note: No single universal score is produced; every rate is published with its numerator and denominator.
note: error, blocked, unsupported, not-observed, cannot-tell and examined_count 0 are never credited as passes or detections.
```

The 1.7% headline is correct and deliberate: the example executes 9 of 266
cases, so 388 of 404 assertions are `not_run`. The attempted rate of 43.8% is
the one that describes the product's behaviour on what it actually ran. A real
published result should run the whole corpus so the two converge.

The example uses a placeholder revision and manifest digest, which is why the
corpus-identity warning appears. A real result pins both, and publishers should
run with `--strict` so a mismatch fails rather than warns.

### Regression

```console
$ node check/score.mjs compare schemas/examples/benchmark-result.repeat-1.json \
                               schemas/examples/benchmark-result.repeat-2.json
corpus cogniumhq/a11y-benchmark@000000000000

metric                                  baseline    candidate   delta
true_positive_rate                      0.019802    0.014851    -0.004951
true_positive_detected                  4           3           -1
false_positive_rate                     0.005348    0.005348    0
false_positive_count                    1           1           0
corrected_control_false_positive_rate   0.005348    0.005348    0
pipeline_rate                           0.375       0.375       0

newly missed   1
  - patterns-disclosure 2.1.1
newly detected 0

REGRESSED
  - true-positive recall fell by 0.004951
```

`newly_missed` and `newly_detected` are reported at assertion level, so an
unchanged headline rate cannot hide an equal number of assertions moving in
each direction.

Exit codes: `0` no regression, `1` regression, `2` the two runs are not
comparable.

### Compatibility

`compare` refuses outright when the two runs differ in scoring policy, corpus
repository, corpus revision or manifest digest. A delta measured across two
ground truths is not a regression signal.

## CSV output

`--csv` writes one row per metric. Every row carries the corpus identity and
the scoring policy alongside its own numerator and denominator, so a row
remains interpretable after it has been pasted into a spreadsheet and separated
from its header context.

```
corpus_repository,corpus_revision,manifest_sha256,scoring_policy,lane,metric,group_kind,group,numerator,denominator,value
cogniumhq/a11y-benchmark,0000...,sha256:aaaa...,cognium-a11y-scoring/1.0.0,automated,true_positive_recall,overall,,4,202,0.019802
cogniumhq/a11y-benchmark,0000...,sha256:aaaa...,cognium-a11y-scoring/1.0.0,automated,false_positive,overall,,1,187,0.005348
cogniumhq/a11y-benchmark,0000...,sha256:aaaa...,cognium-a11y-scoring/1.0.0,pipeline,expected_execution_honored,overall,,3,8,0.375
```

`group_kind` is `overall`, `run`, `by_family`, `by_criterion` or
`by_functional_need`.

## Scoring policy identity

The scorer stamps every report with `cognium-a11y-scoring/1.0.0`. Changing how
a metric is computed requires bumping that string, which in turn makes
`compare` refuse to measure a delta across the change. Publish the policy
string alongside any result you quote.

## Boundaries

A benchmark result is not a WCAG conformance claim, a legal opinion, a product
certification or a guarantee about production websites. See
[PUBLISHING_RESULTS.md](PUBLISHING_RESULTS.md) for the disclosure a publishable
bundle requires.
