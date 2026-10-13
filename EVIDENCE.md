# Evidence maturity

A value named in a manifest is **represented**. It is not necessarily executed,
and it is certainly not verified. Reporting those as one number flatters the
corpus and tells a reader nothing about whether anything was ever run.

Every coverage report in this repository therefore uses four states.

| State | Means | Derived from |
|---|---|---|
| `represented` | at least one fixture names the value | the corpus |
| `executable` | a route to evidence exists — an automatable method, or a versioned human protocol | the corpus |
| `executed` | a current ledger record says a runner or protocol produced evidence | `evidence/ledger.json` |
| `verified` | a reviewer or an independent reproduction confirmed that evidence | `evidence/ledger.json` |

The states are strictly nested: nothing can be `executed` without being
`represented`, and nothing can be `verified` without being `executed`. The
first two are computed from the corpus and can never be asserted by hand. The
last two require a ledger record, and a value with no record stops at
`executable` no matter how many fixtures name it.

`independently_verified` is reported alongside `verified`, counting only
records whose `reproduction_class` is `independent` or `academic`. Vendor and
maintainer evidence is real evidence and is reported as such, but it is never
presented as independent reproduction.

## Where the states appear

- `space-coverage.json` — surfaces, journeys, UI states, functional needs,
  input/AT and methods, each with all four states plus
  `independently_verified`, `awaiting_execution` and `not_executable`.
- `needs-index.json` — the same vocabulary per functional need.
- `release-metadata.json` — `known_gaps.surfaces`, `known_gaps.methods` and
  `known_gaps.evidence` carry the states, so a release cannot publish
  representation alone.

## The current state

Nothing. The ledger is empty, so every represented value stops at `executable`,
and `space-coverage.json` says so:

```
dimension       repr  exec        run  verif / total   what is missing
surfaces          7     7    0      0 / 18     ios, android, desktop, pdf, word-processing, +6 more
journeys         25    25    0      0 / 25
ui-states        12    12    0      0 / 12
user-needs       23    23    0      0 / 23
input-at         12    12    0      0 / 12
methods          15    15    0      0 / 15
```

That is the honest picture and it is the reason this model exists. The previous
report showed `represented` only, which read as though 25 of 25 journeys were
covered.

## Recording evidence

Add a record to `evidence/ledger.json`, conforming to
[`schemas/evidence-ledger.schema.json`](schemas/evidence-ledger.schema.json).
A worked example with every case — executed, verified, superseded and expired —
is in [`evidence/examples/ledger.valid.json`](evidence/examples/ledger.valid.json).

A record must carry:

- the **runner or protocol**: kind, id, version, and protocol version for human
  lanes;
- the **environment**: OS, runtime, and browser or assistive technology with
  versions;
- the **result artifact**: type, SHA-256 digest and, where published, a URI;
- the **reproduction class**: `maintainer`, `vendor`, `independent` or
  `academic`, plus a named `reviewer` for anything claiming `verified`; and
- what it was **captured against**: the corpus content digest, and optionally
  the revision and scoring policy.

Only `executed` and `verified` are recordable. The schema rejects a record
claiming `represented` or `executable`, because those are facts about the
corpus rather than about a run.

## Expiry

Evidence describes a run against a particular set of assertions. When those
assertions change, the evidence no longer describes the current corpus.

**Ground-truth change expires a record automatically.** Each record pins the
`corpus_content_digest` — a digest over every family's `content_sha256` and
case count, sorted by family id. It is deliberately not the manifest's byte
digest, which moves whenever a generator stamps a new `generated` date and
would expire every record on a no-op regeneration.

**Harness and environment changes are retired explicitly.** The corpus cannot
detect that a product moved from 1.0.0 to 2.0.0, so a superseded record names
its replacement in `superseded_by`.

Either way the record stays in the ledger and is reported under
`stale_evidence` with its reason. Expired evidence stops counting; it does not
disappear.

## Getting the digest

```sh
node --input-type=module -e "
import fs from 'node:fs';
import { corpusContentDigest } from './corpus-identity.mjs';
console.log(corpusContentDigest(JSON.parse(fs.readFileSync('corpus-manifest.json', 'utf8'))));
"
```

## Boundaries

Execution evidence is not a conformance claim. A value reaching `verified`
means somebody ran something against that part of the test space and a reviewer
confirmed the run — not that the surface is accessible, nor that the corpus
covers it well. Representation gaps (`missing`) and execution gaps
(`awaiting_execution`) are both reported precisely so neither can be mistaken
for the other.
