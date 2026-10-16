# Changelog

This project follows semantic versioning for tagged corpus releases. The
machine-readable manifest and schema versions are recorded with every release.

## Unreleased

### Fixed

- Three scenario pages did not contain their declared defect (#54):
  - `scenario-overlay_focus_trap` (2.4.3): the "popover" was an unpositioned
    block visible at load that its button did not change. It is now a
    positioned layer the button opens, placed at the end of the DOM with focus
    left on the trigger, so the next Tab passes every control behind it (F85),
    and Close drops focus to the document. Close is now a real button, so the
    page no longer also fails 2.1.1 and 4.1.2. The corrected page inserts the
    popover after its trigger, moves focus in, and returns it on Escape or
    Close.
  - `scenario-dragging_required` (2.5.7): `draggable="true"` items with no
    listener could not be dragged at all. The handles now reorder the list by
    dragging and from the keyboard, so only a single-pointer path is missing.
    The corrected page adds Up and Down buttons.
  - `scenario-motion_actuation` (2.5.4): "shake to undo" existed only as text.
    A `devicemotion` listener now undoes the last change, with no control and
    no way to turn it off. The corrected page adds both.
- `check/scenario-interactions.mjs` drives all three pairs.

### Added

- `scenario-swipe_required` and its corrected control (2.5.1). A fare card
  changed by a horizontal swipe, whose direction decides the result: a real
  path-based gesture. The arrow keys also work, so 2.1.1 holds; only the
  corrected page has a single-pointer path (Previous and Next buttons). It
  keeps Pointer Gestures from losing its only ground truth when 2.5.1 moves off
  `dragging_required` (#54).

### Changed (ground truth)

- `scenario-dragging_required` no longer asserts 2.5.1. Pointer Gestures covers
  path-based and multipoint gestures; its Understanding document places
  dragging under 2.5.7. **Migration:** a 2.5.1 report on this page was
  previously a detection and is now unasserted (#54).

### Added

- An undeclared-findings lane in `adjudication.json`, recording criteria
  engines report on a broken page but not on its control. A pair isolates one
  criterion; agreement here means it measures more than one. 43 findings across
  23 pairs reviewed: 21 one-defect-several-criteria, 15 weak evidence, 6
  intentional, 1 genuine confound (#48).
- `undeclaredFindings()` in `adjudicate.mjs`, so the scan is repeatable from
  any baseline rather than a one-off. It drops criteria a tool reports on more
  than half the corpus as that tool's own baseline, and never concludes a
  property of a pair from a single engine.

### Fixed

- `serve.mjs` could not serve 38 of 270 fixtures. Its directory allow-list
  omitted `pipeline`, `aaa` and `native`, and its media-type table omitted
  `.pdf` and `.docx`, so those paths returned 404. Every pipeline-integrity
  case was unservable, and had been since v0.1.0 — the Tier P cases that exist
  precisely because they need a served site. Found by a six-engine baseline run
  in which three adapters reported 34 `HTTP 404` errors each (#44).
- `check/server-contract.test.mjs` now asserts that every path in the corpus
  manifest, and every declared multi-page step, returns 200. The existing
  server test proved the server refuses what it should refuse; nothing proved
  it serves what it should serve, which is how an allow-list fell three
  families behind without failing a check.
- `surface-epub_no_metadata` was a confounded pair. It is meant to isolate
  missing EPUB package metadata (1.3.1), but its broken page also carried an
  image with no alternative that its control had. All six engines in a baseline
  run detected that undeclared 1.1.1 defect and nothing on the control, while
  the declared 1.3.1 went unreported by everyone. The broken page now carries
  the same alternative as its control, so the pair differs only in the metadata
  and the chapter heading — both 1.3.1 (#48).
- Three adjudication decisions corrected. An earlier blanket decision treated
  the whole `patterns` family as `correct-pipeline-dependent`; per-case review
  against six engines shows `patterns-table` is `correct-manual-only` and
  `patterns-breadcrumb` and `patterns-media-captions` are
  `correct-unimplemented`, none of which depend on state at all.
- `check/ingest-contract.test.mjs` compared the working-tree manifest against
  HEAD, so any uncommitted manifest change failed a test about git plumbing. It
  now reads HEAD's manifest independently, and additionally asserts the digest
  is revision-sensitive.

### Added

- Reviewed outcomes for the 13 static-parse assertions that six engines missed,
  each with a public source: eight `correct-unimplemented`, three
  `correct-pipeline-dependent`, two `correct-manual-only` (#47).

### Fixed

- 53 fixtures declared `interaction` or `state-exploration` while shipping a
  page already rendered in the state they were about, with no script and no
  event handler. That metadata produced a wrong diagnosis: of 60 known-defect
  cases no engine detected, 40 are pre-rendered, so they looked like a harness
  limitation when the engines had seen the defect exactly as intended. Cases
  claiming interaction fell from 100 to 47, and each now declares *why* via
  `state_dependency` (#51).
- `ui-states.mjs` and `scenarios.mjs` blanket-assigned `interaction` to every
  case in their family. Both now derive it from the generated artifact.

### Added

- `state-dependency.mjs` and `check/state-dependency.test.mjs`. A reason the
  markup can demonstrate must be demonstrated; `focus`, `temporal`,
  `runner-behaviour` and `steps` leave no trace by design and are declared by
  hand, and a test asserts detection never invents one.

### Fixed

- Scoring credited an engine for silence. The corrected-control false-positive
  rate counted every assertion in its denominator, including criteria the
  engine has no rule for, so a product implementing nothing scored a perfect
  0%. Measured against axe-core 4.14.0, 82% of that denominator was
  unviolatable by construction. Every rate is now also published over the
  criteria a run demonstrably evaluates, beside the whole-corpus figure rather
  than instead of it (#37).
- WCAG AAA assertions were pooled into one recall denominator although no
  shipping engine implements AAA, depressing the headline while carrying no
  discriminating information. Recall and false positives are now broken out by
  WCAG level, and `criteria_no_engine_reported` names criteria no engine in a
  comparison reported at all (#38).

- `adjudication.json` and `schemas/adjudication.schema.json`, recording
  reviewed decisions about assertions no engine reports: one of
  `correct-unimplemented`, `correct-manual-only`, `correct-pipeline-dependent`
  or `wrong`, each with a named reviewer and a public source. Decisions expire
  per fixture family rather than per corpus, so an unrelated addition does not
  invalidate unrelated review (#40).
- `adjudicate.mjs`, reconciling a multi-engine baseline against those
  decisions. It finds questions and never answers them; exit 1 while a review
  backlog remains.
- `ADJUDICATION.md`, with the measured two-engine baseline, the four outcomes,
  and assessments of the GOV.UK accessibility tool audit and W3C ARIA-AT as
  external cross-check sources.

### Changed

- The scoring policy is `cognium-a11y-scoring/1.1.0`. `compare` refuses to
  measure a delta across the change, which is the intended behaviour.

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
