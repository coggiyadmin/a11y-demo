# Changelog

This project follows semantic versioning for tagged corpus releases. The
machine-readable manifest and schema versions are recorded with every release.

## Unreleased

No changes yet.

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
