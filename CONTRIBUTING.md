# Contributing fixtures

Read [GOVERNANCE.md](GOVERNANCE.md), [SECURITY.md](SECURITY.md) and the
[machine-readable contracts](schemas/README.md) before proposing a change.

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
