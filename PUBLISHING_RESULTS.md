# Publishing benchmark results

Organizations, tool vendors, auditors, researchers and community projects may
publish results produced with this corpus. Publication does not require
maintainer approval, but a result is reproducible only when readers can identify
the corpus, product, engine, configuration, environment and execution outcome.

The corpus repository contains fixtures and ground truth, not measured product
results. Publish result bundles in a separate public repository, archive or
research artifact. This separation prevents a product result from changing the
truth it is measured against.

Human-guided, assistive-technology interoperability and user-task evaluations
follow the versioned contracts in [protocols/](protocols/README.md). Publish
those result files as separate lanes; do not insert them into automated
executions or average them into automated recall and false-positive metrics.

## Minimum publication bundle

A publishable bundle contains:

1. `result.json`, conforming to
   [`schemas/benchmark-result.schema.json`](schemas/benchmark-result.schema.json);
2. a method note naming the command, configuration, enabled rules, state driver,
   sampling policy, mapping logic and any manual decisions;
3. the exact corpus release or 40-character commit SHA and the SHA-256 digest of
   `corpus-manifest.json`;
4. the product name, exact version/build, interface and underlying engine family;
5. the operating system, runtime, browser/version, viewport and relevant user
   preferences;
6. every completed, blocked, unsupported and errored execution, including cases
   that produced no findings;
7. raw product output and mapping code when redistribution permits it, or a
   digest and explanation when it does not; and
8. a license for the published bundle and a contact or issue tracker for
   corrections.

Do not publish access tokens, license keys, customer targets, production
captures, private selectors, personal information or internal paths. The corpus
uses public synthetic inputs; a conforming run does not need private evidence.

## Reproducible workflow

1. Check out a tagged release or full commit SHA. Do not describe a run against
   a moving default branch as a stable benchmark.
2. Record the manifest identity before running:

   ```sh
   git rev-parse HEAD
   node -e "const fs=require('node:fs'),c=require('node:crypto');const b=fs.readFileSync('corpus-manifest.json');console.log('sha256:'+c.createHash('sha256').update(b).digest('hex'))"
   ```

3. Run the product with a documented configuration. Reach every declared state
   before evaluating it and record whether the target was observable.
4. Preserve native rule identifiers. Map them to criteria without replacing the
   native identity.
5. Encode the run using the result schema and validate it:

   ```sh
   npm ci --prefix check --ignore-scripts
   node check/validate-result.mjs path/to/result.json
   ```

6. Publish the bundle at an immutable revision or archived DOI. Optionally open
   a **Published benchmark result** issue in this repository so others can find
   it. Maintainer acknowledgement confirms only that the disclosure is complete
   and schema-valid; it is not certification or endorsement.

## Metrics that may be compared

Report denominators and counts, not only percentages:

- true-positive recall for the declared criterion assertions on `tp` cases;
- false-positive count and rate for the declared `must_not_report` assertions on
  corrected controls;
- execution completeness: completed, blocked, unsupported and error counts;
- state reach and target observability;
- examined counts for pipeline-integrity cases, with zero distinguished from an
  unknown count;
- `cannot-tell`, manual, assistive-technology and user-task outcomes as separate
  lanes; and
- results by fixture family, criterion and functional need so gaps remain
  visible.

`check/score.mjs` implements exactly these metrics and is the reference
scoring policy. Use it, or reproduce its denominators and lane separation
faithfully:

```sh
node check/score.mjs score result.json --json score.json --csv score.csv --strict
node check/score.mjs compare previous-score.json score.json
```

Quote the `scoring_policy` string from its output alongside any metric you
publish. [SCORING.md](SCORING.md) documents every metric, denominator and
refusal.

Do not collapse coverage, conformance, severity and confidence into one score.
Do not turn `unsupported`, `error`, `not-observed`, `cannot-tell` or an examined
count of zero into a pass. A benchmark result is not a WCAG conformance claim,
legal opinion, product certification or guarantee about production websites.

## Comparing multiple products

Use the same pinned corpus revision, environment, display conditions, state
driver, evidence policy and scoring implementation. Disclose product-specific
tuning and rerun all products when the corpus or scoring code changes.

Interfaces backed by the same engine are useful interoperability measurements,
but they are not independent detection votes. Set `independence` and
`wrapper_of` honestly. Vendor-authored, independently reproduced and
maintainer-authored results must be labeled separately.

If a tool cannot expose examined counts or raw evidence, publish `null` or an
explicit limitation rather than estimating. If licensing prevents raw-output
publication, publish its digest, the transformation code and the smallest
reproducible summary allowed by the product terms.

## Corrections and updates

Never replace a published bundle silently. Publish a new immutable revision and
link it to the superseded result with the reason: corpus change, product change,
configuration correction, mapping correction or ground-truth dispute. If the
corpus itself appears wrong, open a **Corpus defect** issue before changing the
expected result in downstream scoring.
