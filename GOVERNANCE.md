# Governance

`cogniumhq/a11y-benchmark` is a public, product-neutral accessibility fixture corpus.
Its maintainers protect the integrity of expected outcomes, stable identifiers,
public synthetic data, and machine-readable contracts. The repository does not
certify products or publish private comparison results.

## Roles

- **Maintainers** review changes, publish releases, resolve disputed ground
  truth and protect compatibility and safety policies.
- **Contributors** propose fixtures, controls, documentation, schemas, runners
  or corrections through issues and pull requests.
- **Reviewers** may provide criterion, platform, assistive-technology,
  document-format, research or implementation expertise without becoming a
  maintainer.

Tool vendors are welcome to contribute. They must disclose a material
affiliation when proposing or reviewing cases that affect their product.

## Decision principles

1. Expected outcomes must be traceable to a public standard, documented
   platform contract or reviewed functional task.
2. A known defect should have a narrowly matched corrected control when that is
   technically and ethically possible.
3. Human judgement remains `cannot-tell`; lack of a finding is never silently
   converted into conformance.
4. Scanner interfaces that share an engine disclose their lineage and do not
   count as independent detection votes.
5. Existing case IDs are permanent. A retired ID remains reserved and points to
   its replacement or retirement rationale.
6. Every fixture is public synthetic data. Production captures and personal,
   customer, credential, session or internal-system data are prohibited.
7. Safety gates for motion, flash, media and destructive interactions are part
   of the fixture contract and cannot be weakened for convenience.

## Change classes

| Change | Minimum evidence | Compatibility treatment |
|---|---|---|
| Correct documentation or implementation without changing ground truth | Reproduction and tests | Patch |
| Add a fixture, optional field or additive schema capability | Source citation, paired control when meaningful, generated artifacts and tests | Minor |
| Change expected ground truth, remove/rename a case, or make a schema incompatible | Public design issue, migration note, before/after evidence and maintainer review | Major |
| Security, privacy or safety correction | Private report when disclosure would increase risk; regression test | Expedited patch |

All pull requests require passing CI and maintainer review. A breaking contract
change also requires a public design issue and a migration plan before merge.

## Releases and compatibility

Releases use semantic version tags:

- **MAJOR** for incompatible schema or case-identity changes;
- **MINOR** for additive fixtures, fields and capabilities;
- **PATCH** for corrections that preserve published contracts.

A release records the corpus commit, `corpus-manifest.json` digest, schema
versions and change log. Consumers should pin a full commit SHA and verify the
manifest before comparing runs. The default branch is development state, not an
immutable benchmark release.

Schema versions evolve independently. A release may contain several schema
versions during a documented deprecation period. Deprecated fields remain for
at least one minor release unless keeping them would create a security, privacy
or safety risk.

## Ground-truth disputes

Open an issue naming the case ID, criterion or platform contract, browser or
runtime state, and reproducible evidence. A finding count from one product is
not sufficient evidence by itself. Maintainers may mark a case disputed or
`cannot-tell` while review is active; disputed cases are excluded from headline
metrics until resolved.

## Project boundaries

This repository owns public fixtures, source attribution, expected outcomes,
schemas and examples. Product credentials, raw production evidence, private
selectors, customer traceability and competitive result history belong in a
separately controlled benchmark environment.
