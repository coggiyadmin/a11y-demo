# Changelog

This project follows semantic versioning for tagged corpus releases. The
machine-readable manifest and schema versions are recorded with every release.

## Unreleased

### Added

- Canonical `corpus-manifest.json` with stable content digests for 226 cases in
  11 fixture families.
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

### Changed

- CI installs pinned validation dependencies and validates published contracts.
- The canonical repository is now `cogniumhq/a11y-benchmark`.
- README corpus totals now match the 226-case manifest.
