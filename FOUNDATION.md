# Foundation

What this corpus is grounded in, and — more importantly — what the existing
foundations **cannot** test.

## The sources

| Source | What it gives | Licence |
|---|---|---|
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | 86 live success criteria (+1 obsolete: 4.1.1 Parsing, removed in 2.2) | W3C Software and Document |
| [ACT Rules](https://www.w3.org/WAI/standards-guidelines/act/rules/) | 87 rules, **1,213 test cases** with expected outcomes | W3C Software and Document — reuse with attribution permitted |
| [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) | Authoring patterns — what *correct* widget markup looks like | W3C Software and Document |
| [WCAG-EM](https://www.w3.org/TR/WCAG-EM/) | Evaluation methodology — how a sample licenses a site-level claim | W3C |

`wcag/criteria.json` vendors a slim index of the first (number, name, level,
placement only). Normative text stays at the source.

## The ACT corpus

1,213 cases over 87 rules, covering **38 success criteria**:

```
passed        472     the rule should NOT report
failed        393     the rule SHOULD report
inapplicable  348     the rule does not apply — the false-positive guard
```

That `inapplicable` third is the valuable part. Most home-grown corpora are
all-positive and therefore measure recall while saying nothing about false
positives.

### Against WCAG 2.2

Measured from `coverage.json`:

```
WCAG 2.2 live criteria        86
  ACT ground truth available  38
  local fixtures only          3
  both                         8
  neither                     45
```

Criteria where ACT supplies ready-made cases nobody has to author include
2.4.9 Link Purpose (103 cases), 1.4.6 Contrast Enhanced (69), 1.4.12 Text
Spacing (62) and 2.5.3 Label in Name (41). Criteria with **no** ACT cases,
which any corpus must author by hand, include 2.4.3 Focus Order, 2.4.11 Focus
Not Obscured, 1.4.13 Content on Hover or Focus, 2.5.8 Target Size, 3.2.2 On
Input, 3.3.2 Labels or Instructions, 3.3.7 Redundant Entry and 4.1.3 Status
Messages.

## The finding that shapes this corpus

**A scanner can score 100% on an ACT-only corpus while being effectively blind
to a real site.**

Every ACT test case is a standalone HTML file of a few hundred bytes —
server-rendered, single page. The three sampled while writing this were 206,
331 and 218 bytes. Such a page is *trivially capturable*: it needs no
hydration, it is the only page so sampling is moot, and its elements reach the
rule under test by construction.

That makes ACT cases structurally incapable of expressing a whole class of
failure that has nothing to do with rule logic:

| failure mode | can an ACT case express it? |
|---|---|
| a keyboard/tab-order walk returns nothing on a page full of focusable elements | **no** |
| a control reports `pass` having examined zero elements — a *vacuous pass* | **no** |
| a page sampler selects pages the capture does not actually hold | **no** |
| the URL the scan was pointed at never enters the evaluated set | **no** |
| the UI under test is client-rendered and the capture holds only the shell | **no** |
| criteria whose rules are anchored to a declared user flow never run at all | **no** |

Each of these was observed in practice while building this corpus, on a
production single-page booking flow where a hand audit found keyboard defects
that an automated scan of the same URL did not reproduce — not one of them
because a rule was wrong.

So ACT measures whether a rule's *logic* is right. It says nothing about
whether the machinery ever hands that rule anything to judge. Those are
different failure modes, and in that comparison only the second kind occurred.

## Two tiers, therefore

### Tier R — rule correctness

ACT's 1,213 cases, used as-is with attribution. Asserts: *given this element
on a page that is trivially capturable, does the control reach the right
verdict?* Catches logic errors and false positives. Necessary, not sufficient.

### Tier P — pipeline integrity

Authored here, because nothing upstream covers it. Asserts: *does the scanner's
capture → hydrate → sample → walk machinery deliver elements to the controls
at all?*

The assertion is of a **different kind**, and this is the crux: a Tier P case
asserts on the control's `applicable` count, not on its findings. The failure
signature is a control reporting `pass` while having examined nothing — a
vacuous pass. Tier R can never produce that signature, which is precisely why
a green Tier R run proved nothing.

Planned Tier P cases, each traceable to an observed failure:

| case | asserts | shape | status |
|---|---|---|---|
| `capture/link_heavy` | a keyboard walk reports a non-zero examined-count on 450 native links | one page | shipped |
| `capture/client_mounted` | post-hydration DOM reaches the rules | one page + JS | shipped |
| `capture/safe_server_rendered` | the same UI, server-rendered, as the negative control | one page | shipped |
| `deep_site` | every page a sampler selects is one the capture holds | multi-page | **not yet built** |
| `entry_not_sampled` | the URL the scan was pointed at appears in the evaluated set | multi-page | **not yet built** |
| `vacuous_pass` | `pass` on an examined-count of 0 is distinguishable from a real pass | any | **not yet built** |
| `no_declared_flow` | flow-anchored criteria are reported as un-run, not as passed | one page | **not yet built** |

`deep_site` and `entry_not_sampled` need a multi-page fixture *site* rather
than isolated pages — a structural requirement the single-page corpora above
do not have, and the reason this repo ships a linked site rather than a flat
directory of snippets.

## Open questions

1. Should Tier R vendor the ACT HTML, or fetch it at test time? Vendoring pins
   the corpus and survives upstream drift; fetching stays current. Pinning with a
   content digest is the usual answer for a corpus meant to be a regression gate.
2. 45 criteria have neither ACT cases nor a local fixture. Many are genuinely
   not machine-testable (1.2.x media quality, 3.3.x error-message usefulness).
   Someone should mark which are *manual-only by nature* versus *not yet
   automated*, because reporting them as uncovered conflates the two.
3. Tier P assertions read a scanner's internal counters (`applicable`). That
   couples the tier to an engine's report shape. Worth defining a minimal
   interchange — criterion, verdict, examined-count — so Tier P stays portable.
