# Human and assistive-technology protocols

These protocols make guided review repeatable without describing human
judgement as automated truth. They operate only on the repository's public
synthetic fixtures and keep three evidence lanes separate:

- `human-guided` for structured review of content, media and display behavior;
- `at-interoperability` for a recorded product, platform, browser and input
  pairing; and
- `user-task` for completion evidence on a declared synthetic task.

The canonical registry is [`protocols.json`](protocols.json), validated by
[`protocols.schema.json`](protocols.schema.json). A single review uses
[`result.schema.json`](result.schema.json). Independent review comparisons use
[`double-review.schema.json`](double-review.schema.json).

## Outcome vocabulary

Every step uses exactly one outcome:

| Outcome | Meaning |
|---|---|
| `pass` | The expected observation was confirmed with the required evidence. |
| `fail` | A reproducible barrier prevented or materially altered the expected observation. |
| `inapplicable` | The requirement does not apply to the declared fixture state. |
| `cannot-tell` | The step was examined, but the available evidence cannot settle the outcome. |
| `not-tested` | The step was not examined, including steps after a safety stop or blocker. |

`cannot-tell` and `not-tested` are never passes. A result from one product,
browser, platform, settings or input pairing does not transfer to another.

## Running a protocol

1. Pin a corpus release or full commit and record the manifest digest.
2. Select one protocol and one declared fixture variant.
3. Complete its prerequisites and record every required environment field.
4. Perform steps in order, applying all stop conditions.
5. Store one outcome, observation and evidence entry per attempted step.
6. Validate the result with the published schema:

   ```sh
   npm ci --prefix check --ignore-scripts
   node check/validate-human-result.mjs path/to/result.json
   ```

7. If independent review is required, reviewers work separately before the
   agreement comparison is generated.

See [methodology.md](methodology.md) for training, disagreement handling,
agreement reporting, safety, privacy and publication rules. The examples show a
[valid result](examples/result.valid.json) and a
[double review with an unresolved disagreement](examples/double-review.json).

Human, interoperability and user-task results are reported beside—not averaged
into—automated recall, false-positive or execution metrics. They may explain an
automated gap; they do not silently change its denominator.
