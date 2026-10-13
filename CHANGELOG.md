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

### Changed

- Release metadata records the current scoring policy identifier, and
  `known_gaps` now carries every maturity state instead of representation
  alone.
- `space-coverage.json` and `needs-index.json` report the shared maturity
  vocabulary; representation no longer stands in for execution.
- CI validates and scores the published result examples.
- README coverage figures corrected: `methods` is 15/15 represented, not 14/15,
  since the pipeline family names `regression`.

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
