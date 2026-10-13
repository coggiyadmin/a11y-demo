# Adjudicating ground truth

An assertion that no engine reports is not thereby wrong. It is also not
thereby right. It is a question, and until this file existed the question was
re-asked on every run and never settled — which is how a corpus ends up
asserting things nobody has checked.

## The problem, measured

Two independent engines were run over every HTML fixture at
`corpus-manifest.json` as committed:

| Engine | Criteria it evaluated | True-positive detection |
|---|---|---|
| axe-core 4.14.0 | 17 (12 A, 5 AA) | 14/202 — 6.9% |
| HTML_CodeSniffer 2.5.1 | 47 (27 A, 20 AA) | 10/202 — 5.0% |
| **union** | | **14/202 — 6.9%** |

HTML_CodeSniffer found nothing axe did not. The two disagreed on four
assertions, all axe-only. HTML_CodeSniffer produced the single false positive
of the run; axe produced none.

**193 assertions were reported by no engine.** That is the backlog this file
exists to work through.

Two caveats on those numbers, because they change how much weight they carry:

- HTML_CodeSniffer was invoked with the `WCAG2AA` standard, so its silence on
  AAA is a configuration choice of ours, not an engine limitation.
- Both ran over `file://` with no state driver. Anything needing a reached
  state, a served origin or a hydrated DOM was never going to be detected, and
  that is a property of the harness rather than of the engines.

## The four outcomes

| Outcome | Means |
|---|---|
| `correct-unimplemented` | the assertion is right; tools could implement it and do not |
| `correct-manual-only` | the assertion is right; no tool can decide it |
| `correct-pipeline-dependent` | a tool could decide it, but only after reaching a state these engines never drove |
| `wrong` | the assertion is incorrect; the fixture or its ground truth must change |

Only a reviewer assigns one. `adjudicate.mjs` finds the questions and never
answers them: the schema will not accept a decision without a named reviewer
and a public source, and `wrong` additionally requires saying what should
change.

## Two rules

**An assertion is never changed to match current tool behaviour alone.** If
every engine misses something the standard requires, that is a finding about
the engines. Weakening the assertion would make the corpus track the tools
instead of the standard, which inverts the point of having a corpus.

**Two engines agreeing on silence flags a question; it does not settle one.**
Each decision records `engines_consulted`, so a `wrong` reached on two engines
is visibly weaker evidence than one reached on eight.

## Expiry is scoped to the family

A decision pins the `content_sha256` of the family its case belongs to, not the
whole-corpus digest.

That is a deliberate correction. The evidence ledger keys expiry on the corpus
content digest, and adding the `aaa` and `native` families expired all 72 of its
records at once — including records about fixtures that had not changed at all.
Correct by the letter of the rule, far too blunt in practice. A decision about
one fixture should not be invalidated by an unrelated addition elsewhere, so
adjudication expires per family instead.

## Running it

```sh
node adjudicate.mjs result-one.json result-two.json
```

Exit `1` while questions remain open, so a growing backlog is visible rather
than silently accumulating.

The result files are ordinary
[benchmark results](schemas/benchmark-result.schema.json). They are **not**
committed here: product results live in a separate repository so a measurement
cannot change the truth it is measured against. What is committed is the
decisions, which are part of the ground truth.

## Current state

```
assertions no engine reported   193
  already reviewed               46
  awaiting review               147
```

Reviewed so far:

- **13 `correct-unimplemented`** — the `aaa` family. Neither engine evaluated a
  single AAA criterion anywhere on the corpus.
- **33 `correct-pipeline-dependent`** — the `patterns` family. APG widget
  defects live in keyboard behaviour and in state these engines never drove;
  axe documents that it does not test hidden regions and that activating them
  requires a harness. These must be re-adjudicated once a state driver joins
  the baseline.

The remaining 147 are an honest backlog. **96 of them were evaluated by an
engine that then declined to report them**, which is a stronger signal than
silence from an engine that never looked, and is where review should start.

## External sources assessed

### GOV.UK accessibility tool audit

[`alphagov/accessibility-tool-audit`](https://github.com/alphagov/accessibility-tool-audit)
— 142 deliberately introduced barriers, later extended by 52 cases covering
WCAG 2.0/2.1/2.2 including AAA, each run through 13 tools with per-tool
detection published. MIT, Crown Copyright.

**Worth ingesting as a cross-check tier, not as fixtures.** Its value here is
not more barriers; it is that somebody else already published *per-tool
detection results*. That is precisely the second opinion this corpus lacks: an
assertion our engines miss, which the GDS audit shows some tool detecting, is
evidence the assertion is implementable and our harness is the limitation.

Cross-checked against its own retest: axe-core and pa11y together detect 44% of
the GDS cases, against the 6.9% union measured here. The gap is mostly fixture
difficulty — delivery variants, APG patterns and UI states have no counterpart
there — but it is large enough that it should be explained by evidence rather
than assumed.

A pinned snapshot already exists locally under
`conformis/datasets/govuk-a11y-tool-audit` at commit `e9e4611`.

### W3C ARIA-AT

[`w3c/aria-at`](https://github.com/w3c/aria-at) — an interoperability test
suite for assistive technologies, written as assertions about expected screen
reader behaviour over APG patterns, executed manually against named
AT/browser pairings.

**Ingest rather than re-derive.** The `protocols/` lane in this repository
carries the same idea — a versioned script, a named pairing, recorded evidence
— and ARIA-AT already has the assertions, the review process and the published
results. Re-deriving them here would duplicate work and produce a second,
weaker answer to a question the W3C community group is answering properly.

The sensible shape is for our AT lane to reference ARIA-AT assertions rather
than restate them, and for `patterns/` to map onto the APG patterns ARIA-AT
already covers. That mapping is the prerequisite and does not exist yet.

Both assessments are recommendations. Neither has been implemented, and
`space-coverage.json` continues to report the AT lane as unexecuted.
