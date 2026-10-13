# Result publisher starter kit

Copy this directory into your own public repository, replace the adapter, and
you have a bundle that validates, scores and lists.

The kit exists because the hard part of publishing a benchmark result is not
running the product. It is writing down enough that someone else can reproduce
the run: the corpus revision, the manifest digest, the product version, the
engine lineage, the environment and the repetition count. Miss one and the
numbers are unreproducible. All six are pinned here by construction.

## Run it

```sh
npm ci --prefix ../check --ignore-scripts        # validation dependencies

node starter/run.mjs --out out/result.json       # writes one file per repeat
node check/validate-result.mjs out/result.repeat-1.json
node check/score.mjs score out/result.repeat-*.json --strict
```

Out of the box this uses `adapter.example.mjs`, which invents its findings so
the kit runs with no product installed. **Its numbers mean nothing.** It is
there to show the shape.

## Replace the adapter

Write a module exporting `evaluate({ testCase, corpusRoot })`, returning one
`execution` object per case exactly as
[`schemas/benchmark-result.schema.json`](../schemas/benchmark-result.schema.json)
defines it. Point `adapter` in `benchmark.config.json` at it.

The four rules that matter are documented at the top of
[`adapter.example.mjs`](adapter.example.mjs). In short:

- preserve native rule identity in `native_rule_id`;
- `examined_count: null` means *the product did not say*, `0` means *it
  examined nothing* — never substitute one for the other;
- a failure to load, reach a state or run a rule is `error`, `blocked` or
  `unsupported`, never a pass;
- `cannot-tell` is a real verdict; use it instead of guessing.

The scorer enforces all four. A bundle that breaks them scores worse, not
better, which is the intended incentive.

## What goes in the bundle

| File | Purpose |
|---|---|
| `result.repeat-N.json` | one schema-valid result per repetition |
| `method.md` | command, configuration, environment, state driver, mapping, lanes not covered |
| `adapter.*.mjs` | the mapping code, published so the mapping is auditable |
| `native-output/README.md` | raw output, or the digest policy and why it is not redistributed |
| `publication.json` | id, classification, corpus identity, supersession, contact |
| `LICENSE` | the licence for **your** bundle — pick one |

`example-result.repeat-1.json` and `-2.json` are committed as a worked example.
They carry a placeholder revision and manifest digest on purpose: a committed
example must not pin a live digest, because the manifest digest moves whenever
a generator stamps a new date and the example would rot. Your real bundle pins
both for real, and `run.mjs` reads them from the checkout rather than letting
you type them.

## Classification

`publication.json` carries a `classification`, and it is not a formality:

- `vendor-authored` — you make or sell the product
- `independent` — you do not
- `academic` — published research
- `maintainer-authored` — the corpus maintainers

Vendor evidence is real evidence and is listed as such. It is never presented
as independent reproduction. Set this honestly; the public index separates the
four and a reader will check.

## CI

Copy [`ci/validate.yml`](ci/validate.yml) to `.github/workflows/` in your
bundle repository. It validates every result file and runs the scorer with
`--strict`, so a bundle whose declared corpus identity does not match the
corpus it was scored against fails rather than warns.

## Publish and list

1. Push the bundle to a public repository and tag it, or archive it with a DOI.
   The URL must be immutable: a commit-pinned tree, a release asset, or a DOI.
   A link to a branch is not a published result — it changes under the reader.
2. Open a **Published benchmark result** issue on
   [`cogniumhq/a11y-benchmark`](https://github.com/cogniumhq/a11y-benchmark/issues/new?template=published-result.yml).
   A workflow checks the disclosure is complete and the URL is immutable, and
   comments with what it found.

Listing confirms format and disclosure only. It is **not** certification,
endorsement, a legal opinion, or a claim about any production website.

## Corrections

Never replace a published bundle in place. Publish a new immutable revision,
set `supersedes` to the id it replaces, and state the reason: corpus change,
product change, configuration correction, mapping correction or ground-truth
dispute. Superseded bundles stay listed and link forward to the correction.

If you believe the corpus itself is wrong, open a **Corpus defect** issue
before changing expected results downstream.
