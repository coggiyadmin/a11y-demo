# Contributing fixtures

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

Run the local checks before opening a pull request:

```sh
node --test check/repository-privacy.test.mjs check/server-security.test.mjs
```

The pull-request workflow regenerates every family and fails if committed
outputs have drifted.
