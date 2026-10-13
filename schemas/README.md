# Machine-readable contracts

These JSON Schemas are the public interoperability boundary for the corpus.
They do not make a conformance claim and they do not define one universal
accessibility score.

## Corpus manifest

`corpus-manifest.schema.json` describes `../corpus-manifest.json`. A runner
should pin the repository commit and the manifest bytes, then verify every
family's `content_sha256` before executing cases. Family digests exclude only
the top-level `generated` date so a no-op regeneration does not change corpus
identity.

## Benchmark result

`benchmark-result.schema.json` defines tool-neutral run evidence. It requires:

- a 40-character corpus revision and manifest digest;
- tool version, engine family, interface and independence classification;
- the declared state, whether it was reached and whether the target was
  observable;
- native rule identity, finding count and examined count;
- explicit `cannot-tell`, `unsupported`, `blocked` and `error` states;
- a declaration that the fixture input was public synthetic data.

Wrappers and derived configurations must name `wrapper_of`. Consumers must not
count two interfaces over the same engine as two independent detection votes.

The example files are validated in CI. `benchmark-result.invalid.json` is
deliberately invalid because it reports a wrapper without `wrapper_of` and an
error execution without error evidence. `benchmark-result.repeat-1.json` and
`benchmark-result.repeat-2.json` are two synthetic repeats of one fictional
product, used as the worked example in [SCORING.md](../SCORING.md).

Validate a third-party result before publication:

```sh
npm ci --prefix check --ignore-scripts
node check/validate-result.mjs path/to/result.json
```

Score a validated result against the corpus:

```sh
node check/score.mjs score path/to/result.json --strict
```

See [Publishing benchmark results](../PUBLISHING_RESULTS.md) for the required
method disclosure, metric boundaries, privacy rules and discoverability flow.
