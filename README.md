# a11y-demo

An accessibility fixture corpus: small pages with **known WCAG outcomes**, for
measuring what an automated accessibility scanner finds, what it misses, and
what it reports that is not there.

Engine-agnostic by design. Nothing here knows about any particular scanner.

## Why it exists

Most accessibility corpora test whether a *rule* is right. This one also tests
whether the scanner's **pipeline** — crawl, capture, hydrate, sample, walk —
ever hands that rule anything to judge.

That distinction is the point. A scanner can score full marks on a corpus of
isolated HTML snippets while being unable to observe a real single-page
application, because a snippet never stresses capture, hydration or sampling.
See [FOUNDATION.md](FOUNDATION.md) for the evidence and the two-tier design
that follows from it.

## Layout

```
wcag/criteria.json   WCAG 2.2 success criteria — slim index derived from W3C's published JSON
act/testcases.json   W3C ACT Task Force test cases (1,213 cases, 87 rules)
catalog.json         ground truth for the local fixtures — what a correct scanner should say
coverage.csv/.json   every WCAG 2.2 criterion x available ground truth
build.mjs            regenerates every fixture
coverage.mjs         regenerates the coverage files

keyboard/            matched defective/corrected controls for keyboard and focus behaviour
capture/             pages that stress capture and hydration rather than rule logic
static/              single-page defects readable from served HTML
delivery/            ONE constant defect, delivered eleven different ways
patterns/            APG component patterns as matched broken/correct pairs
taxonomy/            the enumerated test space
delivery.mjs         regenerates the delivery matrix
patterns.mjs         regenerates the pattern pairs
taxonomy.mjs         regenerates the taxonomy
space-coverage.mjs   coverage against the whole space, not just WCAG
```

### Component patterns

16 patterns from the [ARIA Authoring Practices
Guide](https://www.w3.org/WAI/ARIA/apg/patterns/), each as a broken implementation
and an APG-correct one: disclosure, accordion, tabs, modal dialog, combobox, menu
button, switch, alert/status, data table, tooltip, breadcrumb, slider, listbox,
form errors, required fields, media captions.

Custom widgets are where scanners are weakest and where products actually break —
a native `<button>` is hard to get wrong, a div-based combobox is hard to get
right. The **correct** half of each pair is the load-bearing one: any scanner can
flag everything, only an accurate one leaves APG-conformant markup alone.

### Flight-search regression shapes

The `keyboard/` and `patterns/` families include a reusable regression slice
derived from 21 findings in a human review of a production flight-search flow.
The public corpus retains only synthetic interface shapes and declared ground
truth; it does not retain the production URL, page content, screenshots,
selectors or session data.

The 21 review rows reduce to nine distinct scenarios. Each scenario has one
known-defect fixture and one corrected control:

| Scenario | Known-defect fixture | Corrected control | Criteria |
|---|---|---|---|
| Travel-mode tabs | `keyboard/role_tab_no_tablist.html` | `patterns/safe_tabs.html` | 2.1.1, 2.4.3, 4.1.2 |
| Route fields | `keyboard/div_text_field.html` | `keyboard/safe_native_text_field.html` | 1.3.1, 2.1.1, 4.1.2 |
| Date controls | `keyboard/div_date_fields.html` | `keyboard/safe_native_date_fields.html` | 2.1.1 |
| Traveller disclosure | `keyboard/div_travellers.html` | `keyboard/safe_native_travellers.html` | 2.1.1 |
| Checkbox selection | `keyboard/div_checkbox.html` | `keyboard/safe_native_checkbox.html` | 2.1.1, 4.1.2 |
| Fare-option cards | `keyboard/div_fare_cards.html` | `keyboard/safe_native_fare_options.html` | 2.1.1 |
| Search action | `keyboard/div_button.html` | `keyboard/safe_native_button.html` | 2.1.1, 4.1.2 |
| Focus indicator | `keyboard/focus_not_visible.html` | `keyboard/safe_focus_visible.html` | 2.4.7 |
| Focus obstruction | `keyboard/focus_obscured.html` | `keyboard/safe_focus_not_obscured.html` | 2.4.11 |

The private comparison repository owns row-level traceability and tool results.
This repository owns only the executable fixtures and expected outcomes.

### The delivery matrix

Accessibility defects live in the rendered DOM, not in the server language — PHP,
ASP and a static file all emit HTML, and the same bad markup is equally bad from
any of them. What varies for a *scanner* is how the content reaches the browser.

So every page in `delivery/` carries the **same two defects** — a div acting as a
button (2.1.1) and an image with no accessible name (1.1.1) — and differs only in
delivery: server-rendered, injected on DOMContentLoaded, injected on a timer,
inside a same-origin iframe, inside `srcdoc`, inside a sandboxed iframe, two
iframes deep, in an open shadow root, in a closed shadow root, in a custom
element, and server-rendered-then-replaced-by-script.

Holding the defect constant is the whole point. A scanner that reports
`server_html` and not `shadow_dom_open` has not found a rule bug; it has a
delivery coverage gap, and the matrix names which one.

`closed` shadow roots are deliberately included. `element.shadowRoot` returns
null there, so script cannot see in — but the content is still in the
accessibility tree and still reaches users, and real design systems ship closed
roots. It is the hardest row and a fair one.

## Display conditions are a test axis

A scan fixes one display condition — viewport, colour scheme, scale, motion
preference — and reports as if the answer generalised. It does not. Several
criteria are **defined** against a condition a single config cannot create:
1.4.10 Reflow is specified at 320px, 1.3.4 needs portrait, 2.5.8 is about touch,
1.4.1 and 1.4.11 need forced colours.

```sh
docker compose run --rm configs     # six conditions, reports only what CHANGES
```

`check/configs.mjs` measures the same pages under six conditions and prints only
the observations that differ. A fixture that reads the same everywhere is
condition-independent; one that flips is **undetectable at every condition except
where it flips**.

The sharpest result so far:

```
reduced-motion
   static/anim_no_reduced_motion.html    running_animations: 2 → 0
   static/safe_anim_reduced_motion.html  running_animations: 1 → 0
```

With `prefers-reduced-motion: reduce` active, a page whose defect is an unguarded
infinite animation reports **zero running animations** — identical to the page
that guards it correctly. Any checker running in that state cannot tell them
apart, so 2.2.2 and 2.3.x are unobservable, not merely unchecked.

It also fails loudly rather than quietly: a condition that could not load its
pages aborts the comparison. An earlier run had three of six conditions dead with
`ERR_NAME_NOT_RESOLVED` and reported their silence as "nothing changes" — which
is the same shape of error as counting a control that examined nothing as a pass.

## Functional needs are the primary index

Every rule maps to the functional needs it serves
(`taxonomy/criterion-needs.json`), and a fixture inherits needs from the criteria
it exercises. This is the index that matters for product decisions, because one
requirement usually serves several groups at once:

```
4.1.2  Name, Role, Value   13 needs
2.1.1  Keyboard            13 needs
1.3.1  Info and Rel'ships  13 needs
1.4.1  Use of Colour       12 needs
```

Keyboard access alone supports non-visual operation, alternative input, switch
access and voice-control workflows. A criterion-first report cannot show that one
fix improves many functional needs; `node needs-index.mjs` can.

Mapping rules rather than fixtures is deliberate — hand-annotating every case
drifts, and the rule-level mapping stays the single source of truth.

### Journeys

`journeys/` holds nine multi-page tasks — booking, sign-in, consistent help,
a destructive action, cookie consent, navigation, signup, checkout and session
recovery — each as a broken and a correct variant of the same task, step for
step.

This family exists because **some criteria cannot be tested on a single page by
definition**. 3.2.3 Consistent Navigation, 3.2.4 Consistent Identification,
3.2.6 Consistent Help and 3.3.7 Redundant Entry are statements about the
relationship *between* pages. A corpus of isolated pages cannot express them —
not because the rule is hard, but because the unit of test is wrong.

Every step is individually clean apart from the journey-level defect. That is
the point: a page-by-page scan can report every page as fine while the task is
unusable. In the booking journey the navigation order changes between steps, the
email given in step 1 is asked for again in step 2, and the card is charged with
no review — and no single page is wrong.

A journey case is a **set** of pages with an entry point, not one page, so the
case records `entry` and `steps` rather than a single path.

### Flash and seizure thresholds

> **Seizure warning.** `flash/` can produce flashing light. **Nothing flashes on
> load.** Every fixture needs an explicit button press, stops itself after 3
> seconds, and does nothing at all under `prefers-reduced-motion`.

This family is different from the rest of the corpus. Everywhere else the worst
case of a bad fixture is a wrong measurement; here it is a seizure. So the
gating is not a convenience and must not be removed. The keyframes and timings
stay in the document while dormant, so **the defect is detectable without ever
playing it** — a scanner reading styles or the animation API finds it with the
page sitting still.

Covers 2.3.1 (A), 2.3.2 (AAA) and 2.3.3 (AAA): a 10Hz full-width flash, a
saturated-red flash at 6Hz, a small-area 8Hz flash, exactly three flashes in one
second, and parallax on interaction with no reduced-motion guard.

`three_flashes_exactly` is the pair worth noting — it **passes 2.3.1 and fails
2.3.2**. A corpus that only tests Level A never distinguishes the two.

`flash_small_area` expects **cannot-tell**, and the reason is substantive. 2.3.1
is not simply "faster than 3Hz": content also passes if it stays under the
general and red flash thresholds, and the general threshold is defined over a
proportion of the **visual field** — which depends on screen size and viewing
distance, something a page cannot know. A tool can measure frequency and the
fraction of the viewport. It cannot measure the visual field. Guessing either
way would be wrong.

### Media and captions

`media/` covers captions, transcripts, audio description, live captioning and
sound-only signalling. The media files are real — a 1-second black H.264 clip
and silent MP3s, all under 2KB, emitted by the generator rather than committed
as loose binaries.

That is not fussiness. They were once references to files that did not exist,
and a `<video autoplay>` pointing at a missing source makes the browser wait out
its load timeout on every scan — about 20 seconds per page on one engine, on
three fixtures, every run. **A fixture must not be pathological for the tools
under test.** With real files those pages now load in roughly half a second. Two of the eight pairs are deliberately **cannot-tell**
rather than fail — `captions_present_but_poor` ships a real, parseable caption
track that says only `[inaudible]` across the whole runtime, identifies no
speaker and is not synchronised. A presence check passes it. That is the point:
presence of a track is not conformance, and the honest automated outcome is
"examined, needs a person", not "pass".

### UI states

`ui-states/` holds one journey — choosing a seat — constant across ten states:
loading, empty, invalid, corrected, submitted, error, offline,
permission-denied, timed-out and busy. Holding the journey constant makes any
difference attributable to the state rather than to different content.

Three of these cannot be reached by following links — `timed-out`,
`permission-denied` and `offline` have to be driven. A corpus that only tests
crawlable pages never tests them at all, which is why a form can be perfectly
labelled when blank and still lose focus on submit and announce nothing when
validation fails.

### Colour-independent information

`color-independent/` holds eight pairs covering the checks a contrast test cannot
reach: error and status by colour alone, red/green pairings, chart series
separated only by hue, links distinguished only by colour, placeholder and
disabled contrast, and selection state by colour alone.

Contrast ratio does not catch any of these. Two colours can each clear 4.5:1
against the background and still be indistinguishable from each other.

`color-independent/simulate.html` renders a fixture through three colour-perception
transformations and a monochrome transformation, so "can you still tell?" is a
question you can put to a screenshot rather than take on trust.

## The test space

`taxonomy/` enumerates the space this corpus is a slice of:

```
surface x user need x journey x UI state x input/AT x standard
```

18 surfaces · 23 functional user needs · 25 journeys · 12 UI states · 12 input/AT
pairings · 15 validation methods · 5 outcomes · 13 standards.

It is written down so representation and later execution evidence can be
measured against an explicit scope. Run
`node space-coverage.mjs` for the current representation picture:

```
surfaces      7 / 18     journeys   25 / 25     ui-states  12 / 12
user-needs   23 / 23     input-at   12 / 12     methods    14 / 15
```

**Read those with care.** These are representation counts, not executed test
coverage. A value is represented when at least one manifest names it. A guided
screen-reader prompt therefore represents that pairing but does not verify it;
verification needs a person, the named AT and recorded evidence.

The 64,800 figure is the product of four applicability axes — surface, journey,
UI state and input/AT. Functional needs and standards are mapped attributes,
not independent Cartesian axes. Even within those four axes, most combinations
are inapplicable; coverage must be calculated over a declared, risk-based test
plan rather than treating every mathematical combination as required.

Two things are deliberately not complete, and should stay that way:

**`surfaces 7 / 18`.** PDF, native iOS/Android, desktop, office documents,
kiosk, hardware and immersive surfaces need different artefact formats and
different parsers. An HTML file pretending to be a PDF measures nothing, so
they are enumerated as gaps rather than faked.

**`methods 14 / 15` — `regression` is not represented by a fixture.** Regression is a
method applied *to* a corpus — pin a baseline, re-run, diff — not a property
any individual case can have. Tagging a case with it to reach 15/15 would be
exactly the flattering-denominator problem this report exists to avoid.

Two notes that matter more than the numbers:

**Outcomes are five, not two.** `pass`, `fail`, `inapplicable`, `cannot-tell`,
`not-tested`. `cannot-tell` and `not-tested` are results, not failures to hide —
collapsing either into `pass` is exactly how a scanner that examined nothing
looks healthy.

**Conformance, severity, confidence and coverage are separate axes.** A high
automated conformance score over low coverage says almost nothing, and averaging
them into one figure destroys the information.

**Three methods cannot be automated at all** — guided manual review, AT testing
and user task testing. No fixture corpus can cover them; they need people. A
representation figure that quietly presents them as executed is not a coverage figure. W3C is explicit
that [automated tools cannot validate every
requirement](https://www.w3.org/WAI/test-evaluate/tools/selecting/).

## Accessible scaffolding

Corpus rule: **the only accessibility defect on a page is the one it declares.**

If the chrome contributes its own — small tap targets, low contrast, a missing
focus ring — a scanner reports that too, and the result is no longer
attributable to the fixture. That is a measurement error, not a finding.

`fixture.css` therefore satisfies 1.4.3 (16.6:1 body text), 1.4.4, 1.4.10
(reflows to 320px), 2.4.7 and 2.5.8 (24x24 minimum targets with spacing), and
honours `prefers-reduced-motion`. Pages are responsive by construction: relative
units, `clamp()` type, fluid iframes, no fixed pixel widths.

This was not cosmetic. Before the stylesheet was written,
`capture/link_heavy.html` — 450 links, a fixture about *tab order* — tripped a
target-size control because the links were small and tightly packed. That
finding was real, and entirely an artefact of the scaffolding.

Every fixture family has a generator, so a page does not need to drift out of
sync with its ground truth. Edit the generator, regenerate the outputs and let
the pull-request workflow verify that the committed artifacts match.

## Ground truth

`catalog.json` carries only what a **correct** scanner should report. It
deliberately contains no measured results: if truth and measurement live in the
same file, a regression can be hidden by editing the truth to match the engine.
Record measured behaviour in a separate baseline file and diff against it.

Cases come in pairs wherever it is meaningful:

| mode | meaning |
|---|---|
| `tp` | a scanner **should** report the listed criteria |
| `safe` | a scanner **must not** report the criteria in `must_not_report` — flagging one of those criteria is a false positive |

210 local cases: 106 `tp`, 95 negative controls and 9 guided checks. The first
30 are the keyboard, capture and static catalog; the remaining cases
live in ten additional family manifests loaded through `fixture-families.mjs`.

The negative controls matter more than the positives. `keyboard/safe_roving_tabindex.html`
is APG-correct markup in which `tabindex="-1"` is the *right* answer; a scanner
that calls it "not keyboard reachable" is wrong, and corpora without such cases
cannot tell a sensitive scanner from an inaccurate one.

## Coverage

WCAG 2.2 has 86 live success criteria (4.1.1 Parsing was removed in 2.2 and is
retained in the index with `in_2_2: false`).

```
ACT only                     17
local fixtures only          28
ACT + local                  21
neither                      20
```

Regenerate with `node coverage.mjs`. If `act/testcases.json` is absent the ACT
columns come back empty and the command tells you how to fetch it.

## Running it locally (Docker)

The pipeline-tier fixtures need a *served* site and a *real* browser, so the
corpus ships both, pinned.

```sh
docker compose up -d corpus      # serves the fixtures on http://localhost:8080
docker compose run --rm browser  # measures them with a pinned Chromium
docker compose down
```

`corpus` is a Node Alpine image running `serve.mjs` — about forty lines of
`node:http`, no dependencies. Point any scanner at `http://localhost:8080/`.

`browser` runs `check/reference.mjs` against every case in the eleven family
manifests and writes `check/reference.json`: per fixture, the number of tab stops a real browser
finds, how many elements are natively focusable, how many are pointer-operable
but not keyboard reachable, and how much of the page exists only after script
runs (measured by loading twice, with JavaScript off and on).

It then runs `check/scenario-interactions.mjs`, which executes the five A/AA
interaction contracts: visual versus DOM sequence, pointer-down cancellation,
focus and input context changes, and actionable error suggestions.

Those are **facts about the pages, not judgements about any scanner** — which is
what makes them usable as a reference. For example:

```
capture/link_heavy          451 tab stops, 451 focusable
keyboard/safe_roving_tabindex 2 tab stops,   4 focusable
capture/client_mounted        1 element exists only after script runs
```

A scanner that reports examining 0 elements on `link_heavy` is provably wrong,
and now there is a number to say so with. The roving-tabindex row is the
counterpart: 4 focusable but only 2 tab stops is the *correct* result, so a
scanner flagging those as unreachable is equally provably wrong.

The browser image is pinned deliberately — a Chromium upgrade changes focus and
layout behaviour, which would move the reference numbers without any fixture
changing.

## Using it

Point any scanner at the directory, or at a single fixture, and compare its
output to `catalog.json`. Two numbers are worth reporting separately:

- **recall** — of the `tp` cases, how many listed criteria were reported
- **false positives** — any finding on a `safe` case; the ceiling is zero

A third is worth recording for pipeline-tier cases: the **examined count** — how
many elements the rule actually looked at. A rule that reports "pass" having
examined nothing has not passed; it has not run. Counting that as a pass is how
an incomplete scanner looks healthy.

## Provenance and licences

- **WCAG 2.2** — <https://www.w3.org/TR/WCAG22/>. `wcag/criteria.json` is a
  mechanically derived index (criterion number, name, level, placement). The
  normative text is at the source. W3C Software and Document License.
- **ACT Rules test cases** — <https://www.w3.org/WAI/standards-guidelines/act/rules/>,
  by the W3C ACT Task Force, redistributed under the
  [W3C Software and Document Notice and License](https://www.w3.org/copyright/software-license-2023/),
  which permits reuse with attribution. `act/testcases.json` is an unmodified
  copy of the published catalogue.
- **WAI-ARIA Authoring Practices** — <https://www.w3.org/WAI/ARIA/apg/>, the
  basis for the negative controls.

Fixtures in `keyboard/`, `capture/` and `static/` are original, written for this
repository. They reproduce *shapes* commonly found in production interfaces —
a div acting as a button, a client-mounted widget — and are not copies of any
particular site.

## Status

Active fixture corpus. The capture and delivery families will continue to grow,
but the repository already contains matched controls, multi-page journeys,
state-driven cases and explicit manual-review outcomes. Treat every coverage
number as a description of this corpus, never as a statement of WCAG conformance
or universal scanner quality.
