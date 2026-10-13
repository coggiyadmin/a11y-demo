# Method note

Replace every field below. A reader must be able to re-run this without asking
you anything.

## What was run

- **Product**: Example product 0.0.0
- **Interface**: CLI
- **Engine family**: Example engine
- **Independence**: `independent-engine`
  (a wrapper or derived configuration must set `wrapper_of` instead)
- **Command**: `node starter/run.mjs --out result.json`
- **Configuration**: `benchmark.config.json`, unmodified. No rules were enabled
  or disabled beyond the product default.
- **Adapter / mapping code**: [`adapter.example.mjs`](adapter.example.mjs),
  published in this bundle.

## Corpus identity

- **Repository**: `cogniumhq/a11y-benchmark`
- **Revision**: the full 40-character commit SHA, read from the checkout by
  `run.mjs` rather than typed by hand
- **Manifest digest**: SHA-256 of `corpus-manifest.json`, computed at run time
- **Cases selected**: 10 of the corpus, named explicitly in the config
- **Repetitions**: 2, published as separate result files

A moving default branch is not a benchmark identity. Pin a tag or a full SHA.

## Environment

- OS, runtime, browser and browser version as recorded in `run.environment`
- Viewport 1280x720
- Preferences: reduced motion off, light colour scheme

## State driver

The example adapter has none, so every `multi-page` case is reported
`blocked` rather than evaluated at its entry page. A real submission should say
which driver reached which declared state, and which states it could not reach.

## Mapping

Native rule identifiers are preserved in `native_rule_id` and mapped to
criteria without being replaced. Where the product cannot say how many elements
a rule examined, `examined_count` is `null` — never `0`, which means something
different.

## Lanes not covered

- Human-judgement cases are reported `unsupported`, not passed.
- Assistive-technology and user-task evaluation were not performed. Those
  follow the protocols in [`protocols/`](../protocols/README.md) and are
  published as separate lanes, never averaged into automated metrics.

## Known limitations

The example adapter invents its findings so the kit runs with no product
installed. Its numbers mean nothing. Delete this paragraph when you replace it.

## Raw evidence

See [`native-output/README.md`](native-output/README.md).
