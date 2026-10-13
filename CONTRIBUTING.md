# Contributing to a11y-benchmark

Read [GOVERNANCE.md](GOVERNANCE.md), [SECURITY.md](SECURITY.md) and the
[machine-readable contracts](schemas/README.md) before proposing a change.

Individuals, accessibility practitioners, researchers and companies—including
tool vendors—may contribute. A commercial relationship is not a disqualifier,
but it must be visible: disclose employment, sponsorship or another material
relationship when a proposal could affect evaluation of that product.

Useful contributions include:

- synthetic defect/control pairs and guided checks;
- corrections to ground truth with reproducible public evidence;
- native-surface fixtures, state drivers and product-neutral runners;
- schema, validation and reproducibility improvements; and
- standards mappings, documentation and research citations.

Vendor-specific result sets and private product adapters normally belong in a
separate repository. Use [PUBLISHING_RESULTS.md](PUBLISHING_RESULTS.md) to
publish a result and the **Published benchmark result** issue form to share it.
The corpus must not tune its ground truth to match one product's output.

## Contribution workflow

1. Open a fixture proposal or corpus-defect issue before a ground-truth,
   identifier or contract change. Describe the public source and measurement
   boundary without attaching production evidence.
2. Fork the repository and branch from the current default branch.
3. Change the generator as well as generated artifacts. Keep the pull request
   limited to one reviewable benchmark claim.
4. Run the checks below and include the exact commands/results in the pull
   request.
5. Complete the affiliation, compatibility, privacy and safety declarations in
   the pull-request template. Maintainers may request review by a standards,
   platform, assistive-technology or document-format specialist.

Every fixture is public. Use invented data only: reserved example domains,
fictional names and addresses, and non-routable identifiers. Never commit real
credentials, customer data, internal hostnames, private repository paths,
screenshots from production, local absolute paths, or media with identifying
metadata.

## Fixture contract

- Add a broken case and a narrowly matched negative control when meaningful.
- Put expected criteria in `min_criteria` or `must_not_report`; do not treat a
  safe page as globally conformant unless every applicable criterion was tested.
- Mark human judgement as `cannot-tell` and set `requires_human: true`.
- Record the surface, journey, state, method, input/AT and functional needs.
- Use a native artifact for non-web surfaces. If only a representation is
  possible, label it as a proxy rather than claiming native coverage.
- Edit the generator, regenerate its outputs and commit both.
- Treat every published case ID as permanent. Never reuse or silently change an
  ID's meaning.
- Update `CHANGELOG.md` for fixture, ground-truth or contract changes.

Run the local checks before opening a pull request:

```sh
npm ci --prefix check --ignore-scripts
node --test check/*.test.mjs
for generator in build.mjs delivery.mjs patterns.mjs taxonomy.mjs journeys.mjs scenarios.mjs media.mjs flash.mjs color-independent.mjs ui-states.mjs surfaces.mjs guided.mjs needs-index.mjs coverage.mjs space-coverage.mjs manifest.mjs; do
  node "$generator"
done
git diff --exit-code -I '"generated":'
```

The pull-request workflow regenerates every family and fails if committed
outputs, manifest counts or stable content digests have drifted.

## Contribution licence

Original project material is licensed under
[Apache License 2.0](LICENSE). Under section 5 of that license, an intentional
submission is contributed under Apache-2.0 unless the contributor explicitly
states otherwise. By opening a pull request, contributors confirm that they have
the right to submit the material and that its origin and any different licence
are clearly identified.

Do not copy examples, documentation, test cases or data from another project
merely because they are public. Record the source, applicable licence,
modifications and required notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Maintainers may decline material whose provenance or redistribution rights are
unclear.
