# Changelog

This project follows semantic versioning for tagged corpus releases. The
machine-readable manifest and schema versions are recorded with every release.

## Unreleased

### Added

- `check/score.mjs`, a product-neutral reference scorer and regression runner
  producing true-positive recall, corrected-control false-positive,
  pipeline-integrity, execution-state, observability and examined-count metrics
  with explicit numerators and denominators, plus breakdowns by family,
  criterion and functional need and repeat-to-repeat variance.
- `check/scoring.mjs`, the scoring library behind the CLI, stamped with the
  `cognium-a11y-scoring/1.0.0` policy identifier.
- JSON and CSV outputs that carry corpus identity and a denominator on every
  row, and a regression comparison that refuses runs measured against a
  different corpus revision, manifest digest or scoring policy.
- Two synthetic result repeats under `schemas/examples/` as the worked example,
  exercising detection, false positives, blocked and unsupported executions, a
  vacuous pass, a human-lane `cannot-tell` and an unstable assertion.
- `SCORING.md` documenting every metric, denominator and refusal.
- An evidence-maturity model: every enumerated dimension value is reported as
  `represented`, `executable`, `executed` or `verified`, with
  `independently_verified` counted separately from vendor and maintainer
  evidence.
- `evidence/ledger.json` and `schemas/evidence-ledger.schema.json`, recording
  the runner or protocol, environment, result artifact, reproduction class and
  reviewer behind each executed or verified value.
- `corpus-identity.mjs`, deriving a ground-truth digest that is stable across a
  no-op regeneration, so evidence expires when the corpus changes and not when
  a date is restamped.
- `EVIDENCE.md` documenting the states, the ledger and the expiry rules.
- A reviewed evidence-lane classification for the twenty WCAG AAA criteria that
  had no ground truth, in `wcag/aaa-classification.json`, each with its public
  W3C Understanding source and the rationale for its lane.
- `aaa.mjs` and the `aaa` fixture family: thirteen matched broken/corrected
  pairs covering the AAA criteria decidable from markup or by driving the page.
- Six further guided checks covering the AAA criteria that need a human
  judgement, carrying `inapplicable` alongside `cannot-tell` where the criterion
  is applicability-dependent.
- `sources.json` and `schemas/sources.schema.json`, recording the url, licence,
  required notice, transform and upstream SHA-256 of every standards-derived
  input.
- `refresh-sources.mjs`, a reviewed refresh that reports added, removed and
  changed ACT rule and test-case ids with their expected outcomes, changed WCAG
  transformed fields, and the local fixtures each change affects.
- A scheduled `Refresh standards sources` workflow that regenerates, runs the
  contract tests and opens a reviewable pull request. It never pushes to the
  default branch and never merges itself.
- `starter/`, a copy-and-fill publisher kit: a runner that pins corpus revision,
  manifest digest, product version, engine lineage, environment and repetitions
  by construction, example mapping code, a method note, a raw-output disclosure,
  a licence, a `publication.json` the public index can ingest, and a CI workflow
  running validation and the scorer with `--strict`.
- A committed multi-case example bundle demonstrating the honest non-pass
  states: `completed`, `blocked` for an undriven multi-page case, and
  `unsupported` for a human-judgement case.
- `check/verify-published-result.mjs` and a `Verify published result disclosure`
  workflow, checking a submission mechanically: required fields, a full
  40-character revision, a well-formed manifest digest, a wrapper that names its
  engine, a stated publisher relationship, and an immutable bundle URL.
- `surface-contracts.json`: native artifact format, parser or execution harness,
  applicable standard, evidence fields and the simulable/physical boundary for
  all eleven unrepresented surfaces.
- `native/`, the first real non-web artifacts: deterministic PDF and Office Open
  XML byte streams with matched controls, pinned by SHA-256 and reproducible
  from the committed `native.mjs`.
- `check/pdf-structure.mjs` and `check/ooxml-structure.mjs`, the harnesses the
  PDF and word-processing contracts name. The PDF reader resolves objects
  through the cross-reference table, so a document with bad offsets is reported
  broken rather than read anyway.

- `ingest-results.mjs`, deriving evidence-ledger records from published result
  bundles instead of hand-authoring them. It promotes only what a run actually
  exercised — surfaces, and the states it reached — and never input modality,
  method or functional need, because a result file does not record those.
  Ground truth is resolved by recomputing the content digest from the manifest
  at the bundle's declared revision, read out of git; an unknown revision fails
  closed.

### Changed

- The evidence ledger now holds 72 records ingested from the published
  `functional-scenarios-wave1` bundle. All 72 are expired: they measured the
  234-case corpus, and the `aaa` and `native` families moved the content
  digest. Coverage reports the stale count and the reason rather than reading
  as though no evidence had ever been produced.
- Release metadata records the current scoring policy identifier, and
  `known_gaps` now carries every maturity state instead of representation
  alone.
- `space-coverage.json` and `needs-index.json` report the shared maturity
  vocabulary; representation no longer stands in for execution.
- CI validates and scores the published result examples.
- README coverage figures corrected: `methods` is 15/15 represented, not 14/15,
  since the pipeline family names `regression`.
- Coverage now reports `manual only` as its own category, separating criteria
  that no tool can decide from criteria nobody has built a fixture for yet. No
  WCAG 2.2 criterion reports `NONE` any longer.
- Guided cases carry `guided_criteria`, so a human-judgement check counts as
  coverage without ever becoming an assertion a tool is expected to report.
- Generators run families, then the manifest, then the reports that consume it.
- Proxy representations are labelled: coverage reports `represented_natively`
  and `proxy_only` beside `represented`, and release metadata carries both, so
  a proxy can never be presented as native coverage of the surface it resembles.

## [0.1.0] - 2026-10-13

### Added

- Canonical `corpus-manifest.json` with stable content digests for 234 cases in
  12 fixture families.
- JSON Schema contracts for the corpus manifest and benchmark-result
  interchange format.
- Valid and intentionally invalid result examples enforced by CI.
- Engine-lineage, state-reach, observability, explicit error and privacy fields
  in the public result contract.
- Governance, security, support, citation and third-party attribution policies.
- Structured fixture-proposal and corpus-defect issue forms.
- Apache-2.0 licensing for original project material with explicit W3C
  third-party boundaries and notices.
- Third-party contribution and result-publication guidance, a schema-validation
  CLI and a published-result issue form.
- Deterministic release metadata and SHA-256 checksum assets.
- A tag-gated release publisher, full-history privacy audit and release runbook.
- Four broken/control pipeline-integrity pairs that test sampling, entry
  evaluation, non-vacuous passes and declared flows.
- Eight versioned human and assistive-technology protocols with result and
  independent double-review schemas.

### Changed

- CI installs pinned validation dependencies and validates published contracts.
- The canonical repository is now `cogniumhq/a11y-benchmark`.
- README and release totals now match the 234-case manifest.

[Unreleased]: https://github.com/cogniumhq/a11y-benchmark/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cogniumhq/a11y-benchmark/releases/tag/v0.1.0
