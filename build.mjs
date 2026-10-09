// Generates the fixture corpus. Re-runnable: every page here is produced by this file,
// so a fixture is never hand-edited out of sync with the manifest.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);

const page = (title, body, { head = '', lang = 'en', viewport = 'width=device-width,initial-scale=1' } = {}) =>
  `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="${viewport}">
<title>${title}</title>
<link rel="stylesheet" href="../fixture.css">${head}
</head>
<body>
<main>
<h1>${title}</h1>
${body}
</main>
<p><a href="../index.html">Back to the index</a></p>
</body>
</html>`;

/** Each entry: the page, the criteria it is about, and whether a control SHOULD fire. */
const FIXTURES = [
  // ───────────────────────── keyboard: the div-instead-of-control family
  {
    dir: 'keyboard', file: 'div_button.html', expect: 'flag',
    sc: ['2.1.1', '4.1.2'], manual: ['#18', '#19'],
    title: 'Button that is a div',
    note: 'Visually a button, structurally a styled div. No tabindex, no role, no keyboard activation.',
    body: `<div class="btn" onclick="void 0">Search flights</div>
<p><a href="./safe_native_button.html">The correct version</a></p>`,
  },
  {
    dir: 'keyboard', file: 'safe_native_button.html', expect: 'clean',
    sc: ['2.1.1', '4.1.2'], manual: [],
    title: 'Button that is a button',
    note: 'Negative control for div_button.html. A control that flags this is a false positive.',
    body: `<button type="button">Search flights</button>`,
  },
  {
    dir: 'keyboard', file: 'div_text_field.html', expect: 'flag',
    sc: ['2.1.1', '1.3.1', '4.1.2'], manual: ['#4', '#5', '#6', '#7', '#8', '#9'],
    title: 'Text field that is a div',
    note: 'Origin and destination pickers built from nested divs. No input element, no programmatic relationship.',
    body: `<div class="field" onclick="void 0"><span class="lbl">From</span><div class="val">Delhi</div></div>
<div class="field" onclick="void 0"><span class="lbl">To</span><div class="val">Mumbai</div></div>
<p><a href="./safe_native_text_field.html">The correct version</a></p>`,
  },
  {
    dir: 'keyboard', file: 'safe_native_text_field.html', expect: 'clean',
    sc: ['2.1.1', '1.3.1', '4.1.2'], manual: [],
    title: 'Text field that is an input',
    note: 'Negative control for div_text_field.html.',
    body: `<p><label for="from">From</label> <input id="from" value="Delhi"></p>
<p><label for="to">To</label> <input id="to" value="Mumbai"></p>`,
  },
  {
    dir: 'keyboard', file: 'div_date_fields.html', expect: 'flag',
    sc: ['2.1.1'], manual: ['#10', '#11'],
    title: 'Date pickers that are divs',
    note: 'Departure and return, each a clickable div with no focusable control inside.',
    body: `<div class="field" onclick="void 0"><span class="lbl">Departure</span><div class="val">12 Oct</div></div>
<div class="field" onclick="void 0"><span class="lbl">Return</span><div class="val">19 Oct</div></div>`,
  },
  {
    dir: 'keyboard', file: 'div_travellers.html', expect: 'flag',
    sc: ['2.1.1'], manual: ['#12'],
    title: 'Travellers and class, nested clickable divs',
    note: 'A disclosure built from nested divs, none of them focusable.',
    body: `<div class="field" onclick="void 0"><div><div class="val">1 Traveller, Economy</div></div></div>`,
  },
  {
    dir: 'keyboard', file: 'div_checkbox.html', expect: 'flag',
    sc: ['2.1.1', '4.1.2'], manual: ['#13', '#14'],
    title: 'Checkbox that is a styled div',
    note: 'No native checkbox, no role, no checked state exposed.',
    body: `<div class="checkbox" onclick="void 0"><span class="box"></span> Travelling for work</div>
<p><a href="./safe_native_checkbox.html">The correct version</a></p>`,
  },
  {
    dir: 'keyboard', file: 'safe_native_checkbox.html', expect: 'clean',
    sc: ['2.1.1', '4.1.2'], manual: [],
    title: 'Checkbox that is a checkbox',
    note: 'Negative control for div_checkbox.html.',
    body: `<p><input type="checkbox" id="work"> <label for="work">Travelling for work</label></p>`,
  },
  {
    dir: 'keyboard', file: 'div_fare_cards.html', expect: 'flag',
    sc: ['2.1.1'], manual: ['#15', '#16', '#17'],
    title: 'Selectable cards that are divs',
    // Fare TYPES, not passenger categories. Sample content in a public repo should
    // not label groups of people — especially not in a page demonstrating broken code.
    note: 'Fare options presented as cards. Pointer-operable, not keyboard reachable.',
    body: `<div class="card" onclick="void 0">Flexible</div>
<div class="card" onclick="void 0">Standard</div>
<div class="card" onclick="void 0">Saver</div>`,
  },
  {
    dir: 'keyboard', file: 'role_tab_no_tablist.html', expect: 'flag',
    sc: ['2.1.1', '2.4.3', '4.1.2'], manual: ['#1', '#2', '#3'],
    title: 'role=tab on non-focusable divs, no tablist',
    note: 'The ARIA role is asserted without the structure or the keyboard behaviour that makes it true.',
    body: `<div>
  <div role="tab">Flights</div>
  <div role="tab">Hotels</div>
  <div role="tab">Buses</div>
</div>
<p><a href="./safe_roving_tabindex.html">The correct version</a></p>`,
  },
  {
    dir: 'keyboard', file: 'safe_roving_tabindex.html', expect: 'clean',
    sc: ['2.1.1', '2.4.3'], manual: [],
    title: 'Roving tabindex, APG-correct',
    note: 'tabindex="-1" here is CORRECT authoring: the APG tabs pattern keeps exactly one tab in '
      + 'the tab order and moves between them with arrow keys. A scanner that reports these as '
      + '"not keyboard reachable" is producing a false positive. See WAI-ARIA Authoring Practices, '
      + 'Tabs pattern, and the Keyboard Interaction section of the Grid pattern.',
    body: `<div role="tablist" aria-label="Travel modes">
  <button role="tab" tabindex="0"  aria-selected="true">Flights</button>
  <button role="tab" tabindex="-1" aria-selected="false">Hotels</button>
  <button role="tab" tabindex="-1" aria-selected="false">Buses</button>
</div>`,
  },
  {
    dir: 'keyboard', file: 'safe_custom_button.html', expect: 'clean',
    sc: ['2.1.1', '4.1.2'], manual: [],
    title: 'Div button done properly',
    note: 'A div CAN be a button: role, tabindex and key handling all present. Negative control.',
    body: `<div role="button" tabindex="0" onkeydown="void 0" onclick="void 0">Search flights</div>`,
  },
  {
    dir: 'keyboard', file: 'focus_not_visible.html', expect: 'flag',
    sc: ['2.4.7'], manual: ['#20'],
    title: 'Focus indicator suppressed',
    note: 'Focusable controls whose focus ring is removed in CSS.',
    body: `<style>.nofocus:focus{outline:none;box-shadow:none}</style>
<button class="nofocus">One</button> <button class="nofocus">Two</button>`,
  },
  {
    dir: 'keyboard', file: 'focus_obscured.html', expect: 'flag',
    sc: ['2.4.11'], manual: ['#21'],
    title: 'Focused control hidden behind a sticky bar',
    note: 'The control receives focus but a sticky footer covers it, so the focus indicator is not visible. 2.4.11 is new in WCAG 2.2.',
    body: `<style>.sticky{position:fixed;bottom:0;left:0;right:0;height:90px;background:#222;color:#fff}</style>
${Array.from({ length: 12 }, (_, i) => `<p><button>Control ${i + 1}</button></p>`).join('\n')}
<div class="sticky">Sticky footer that covers the last control</div>`,
  },

  // ───────────────────────── capture: can the scanner even see the page?
  {
    dir: 'capture', file: 'client_mounted.html', expect: 'flag',
    sc: ['2.1.1', '4.1.2'], manual: [],
    title: 'Widget mounted by script after load',
    note: 'The served HTML is a shell. Everything testable appears only after JS runs. '
      + 'Exercises whether the capture holds pre- or post-hydration markup.',
    body: `<div id="root"><p>Loading…</p></div>`,
    head: `
<script>
  addEventListener('DOMContentLoaded', () => {
    document.getElementById('root').innerHTML =
      '<div class="btn" onclick="void 0">Search flights</div>' +
      '<div role="tab">Flights</div>';
  });
</script>`,
  },
  {
    dir: 'capture', file: 'safe_server_rendered.html', expect: 'clean',
    sc: ['2.1.1', '4.1.2'], manual: [],
    title: 'Same widget, server-rendered and correct',
    note: 'Negative control for client_mounted.html: identical UI, present in the served bytes.',
    body: `<div role="tablist" aria-label="Travel modes"><button role="tab" aria-selected="true">Flights</button></div>
<button type="button">Search flights</button>`,
  },
  {
    dir: 'capture', file: 'link_heavy.html', expect: 'clean',
    sc: ['2.4.3'], manual: [],
    title: '450 native links',
    note: 'Every link is natively focusable, so a tab-order walk must report applicable > 0. '
      + 'If it reports 0 here, the walk is broken independently of page scale.',
    body: Array.from({ length: 450 }, (_, i) => `<a href="#p${i}">Product ${i}</a>`).join('\n'),
  },

  // ───────────────────────── static: what automation found that manual testing did not
  {
    dir: 'static', file: 'viewport_no_zoom.html', expect: 'flag',
    sc: ['1.4.4'], manual: [],
    title: 'Viewport blocks zoom',
    note: 'Found by automation, absent from the manual sheet. Flat AA failure.',
    body: `<p>This page caps zoom below 2x in its viewport meta.</p>`,
    viewport: 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no',
  },
  {
    dir: 'static', file: 'safe_viewport.html', expect: 'clean',
    sc: ['1.4.4'], manual: [],
    title: 'Viewport allows zoom',
    note: 'Negative control for viewport_no_zoom.html.',
    body: `<p>This page does not restrict zoom.</p>`,
  },
  {
    dir: 'static', file: 'img_no_alt.html', expect: 'flag',
    sc: ['1.1.1'], manual: [],
    title: 'Images with no accessible name',
    note: 'No alt, no aria-label, no declared decorative intent.',
    body: `<img src="../pixel.png"><img src="../pixel.png"><img src="../pixel.png">
<p><a href="./safe_img.html">The correct version</a></p>`,
  },
  {
    dir: 'static', file: 'safe_img.html', expect: 'clean',
    sc: ['1.1.1'], manual: [],
    title: 'Images named or declared decorative',
    note: 'Negative control for img_no_alt.html.',
    body: `<img src="../pixel.png" alt="Airline logo"><img src="../pixel.png" alt="" role="presentation">`,
  },
  {
    dir: 'static', file: 'anim_no_reduced_motion.html', expect: 'flag',
    sc: ['2.2.2'], manual: [],
    title: 'Indefinite animation with no reduced-motion guard',
    note: '2.2.2 allows 5s. These run forever and no prefers-reduced-motion rule turns them off.',
    body: `<style>
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{animation:spin 1s linear infinite}
.pulse{animation:pulse 2s ease-in-out infinite}
@keyframes pulse{50%{opacity:.4}}
</style>
<div class="spinner">spinning</div><div class="pulse">pulsing</div>`,
  },
  {
    dir: 'static', file: 'safe_anim_reduced_motion.html', expect: 'clean',
    sc: ['2.2.2'], manual: [],
    title: 'Animation guarded by prefers-reduced-motion',
    note: 'Negative control for anim_no_reduced_motion.html.',
    body: `<style>
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{animation:spin 1s linear infinite}
@media (prefers-reduced-motion: reduce){.spinner{animation:none}}
</style>
<div class="spinner">spinning</div>`,
  },
  {
    dir: 'static', file: 'field_no_visible_label.html', expect: 'flag',
    sc: ['3.3.2'], manual: [],
    title: 'Form fields with no visible label',
    note: 'Placeholder text is not a label.',
    body: `<input placeholder="Coupon code"><input placeholder="GST number">`,
  },
  {
    dir: 'static', file: 'lang_missing.html', expect: 'flag',
    sc: ['3.1.1'], manual: [],
    title: 'No language declared',
    note: 'The html element carries no lang attribute.',
    body: `<p>This page does not declare its language.</p>`,
    lang: '',
  },
];

// ───────────────────────── write
fs.rmSync(path.join(ROOT, 'keyboard'), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, 'capture'), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, 'static'), { recursive: true, force: true });

for (const f of FIXTURES) {
  const dir = path.join(ROOT, f.dir);
  fs.mkdirSync(dir, { recursive: true });
  const comment = `<!--\n  ${f.title}\n  WCAG: ${f.sc.join(', ')}\n  Expectation: ${f.expect === 'flag' ? 'a control SHOULD report this' : 'NO control should report this (negative control)'}\n  ${f.note}\n-->\n`;
  const opts = {};
  if (f.head) opts.head = f.head;
  if (f.lang !== undefined) opts.lang = f.lang;
  if (f.viewport) opts.viewport = f.viewport;
  fs.writeFileSync(path.join(dir, f.file), comment + page(f.title, f.body, opts));
}

// a 1x1 png so the img fixtures reference something real
fs.writeFileSync(path.join(ROOT, 'pixel.png'), Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'));

fs.writeFileSync(path.join(ROOT, 'fixture.css'),
  `/* Fixture scaffolding. Responsive and accessible ON PURPOSE.
   *
   * Corpus rule: the ONLY accessibility defect on a page is the one it declares.
   * If the chrome contributes its own — small tap targets, low contrast, a missing
   * focus ring — a scanner reports it, and the result is no longer attributable to
   * the fixture. That is a measurement error, not a finding.
   *
   * So this stylesheet deliberately satisfies:
   *   1.4.3  body text at 16.6:1 on white, muted text at 5.7:1
   *   1.4.4  relative units throughout, no maximum-scale
   *   1.4.10 reflows to 320px with no horizontal scroll
   *   2.4.7  a visible focus indicator that does not rely on colour alone
   *   2.5.8  every link and control at least 24x24 CSS px with spacing
   */
:root {
  --ink: #1a1a1a;        /* 16.6:1 on white */
  --muted: #595959;      /*  5.7:1 on white */
  --accent: #30556e;     /*  7.5:1 on white */
  --line: #c9c9c9;
  --bg: #fff;
}
* { box-sizing: border-box; }
/* Long unbroken tokens — the fixture ids are things like
   authoring_generates_bad_markup — overflow their box at 320px without the box
   itself being wide, so the document scrolls while every element measures under
   the viewport. overflow-wrap is what actually fixes 1.4.10 here. */
body, h1, h2, h3, p, li, td, th, code { overflow-wrap: anywhere; }
body {
  font: 100%/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--ink);
  background: var(--bg);
  margin: 0 auto;
  padding: 1.5rem clamp(1rem, 4vw, 2rem);
  max-width: 70ch;
}
h1 { font-size: clamp(1.4rem, 1.1rem + 1.5vw, 2rem); line-height: 1.25; }
h2 { font-size: clamp(1.1rem, 1rem + 0.6vw, 1.4rem); margin-top: 2rem; }
p, li { max-width: 70ch; }
img { max-width: 100%; height: auto; }

/* 1.4.10 Reflow: wide content scrolls inside its OWN container, never the page.
   Measured at 320px, the pre blocks in surfaces/ pushed the document 239px wide —
   a reflow defect in fixtures that declare no such thing, and on two of them a
   negative control. Scaffolding must not generate defects, and that rule only
   holds at every display condition, not the one it happened to be written at. */
pre { overflow-x: auto; max-width: 100%; }
/* and the code inside it wraps rather than scrolls: at 320px a scroll container
   still left a 377px child, and wrapping is the better answer for 1.4.10 anyway —
   no horizontal scrolling at all beats scrolling in a sub-region. */
pre code { white-space: pre-wrap; word-break: break-word; display: block; max-width: 100%; }
table { display: block; overflow-x: auto; max-width: 100%; }

/* 2.5.8: 24x24 minimum with spacing, for every interactive thing including the
   450 links in capture/link_heavy.html — which otherwise trips a target-size
   control and contaminates a fixture that is about tab order. */
a, button, input, select, textarea, summary,
.btn, .card, .field, .checkbox, [role="tab"], [role="button"] {
  min-height: 24px;
  min-width: 24px;
  display: inline-block;
  padding: 0.35rem 0.5rem;
  margin: 0.15rem 0.2rem 0.15rem 0;
  line-height: 1.5;
}
a { color: var(--accent); }

/* 2.4.7: visible focus, not colour-alone, and never removed.
   Fixtures that are ABOUT focus visibility override this locally. */
:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

/* the defect shapes. Styled to look interactive, which is the whole point —
   they must be visually convincing while being structurally wrong. */
.btn { background: var(--accent); color: #fff; border-radius: 4px; cursor: pointer; }
.field { border: 1px solid var(--line); display: block; cursor: pointer; padding: 0.5rem; }
.field .lbl { color: var(--muted); font-size: 0.85em; display: block; }
.card { border: 1px solid var(--line); border-radius: 4px; cursor: pointer; }
.checkbox { cursor: pointer; display: block; }
.checkbox .box { display: inline-block; width: 16px; height: 16px; border: 1px solid var(--muted); vertical-align: -3px; margin-right: 0.4rem; }
[role="tab"] { border-bottom: 3px solid transparent; cursor: pointer; }

/* iframes in the delivery matrix: fluid, never a fixed pixel width */
iframe { width: 100%; max-width: 40rem; min-height: 10rem; border: 1px solid var(--line); }

@media (max-width: 30rem) {
  body { padding: 1rem; }
  .field, .card, .btn { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`);

// index so a crawler reaches every fixture from one entry point
const groups = [...new Set(FIXTURES.map((f) => f.dir))];

// per-group index too: a server maps /keyboard/ to /keyboard/index.html, and
// without one that URL 404s — which makes the group un-crawlable as a subject
// in its own right.
for (const g of groups) {
  const list = FIXTURES.filter((f) => f.dir === g);
  fs.writeFileSync(path.join(ROOT, g, 'index.html'),
    page(`${g} fixtures`, `<ul>${list.map((f) =>
      `<li><a href="${f.file}">${f.title}</a> — ${f.sc.join(', ')} — <strong>${
        f.expect === 'flag' ? 'should flag' : 'must not flag'}</strong></li>`).join('\n')}</ul>`));
}
// delivery/ is generated by delivery.mjs, not here, but the root index must link
// to it or a crawler never reaches those pages — they were silently absent from a
// whole scan until this link existed.
const EXTRA_GROUPS = [
  { dir: 'delivery', blurb: 'the same defect delivered many different ways — server HTML, '
      + 'client-rendered, iframes, shadow DOM, web components' },
  { dir: 'patterns', blurb: 'ARIA Authoring Practices component patterns as matched '
      + 'broken/correct pairs — dialogs, combobox, tabs, menus, tables and more' },
  { dir: 'color-independent', blurb: 'colour used as the only carrier of information, with a '
      + 'simulation view through colour-perception and monochrome transformations' },
  { dir: 'media', blurb: 'captions, transcripts, audio description and sound-only signalling '
      + '\u2014 including cases whose honest outcome is cannot-tell, not pass' },
  { dir: 'ui-states', blurb: 'one journey across loading, empty, invalid, corrected, submitted, '
      + 'error, offline, permission-denied, timed-out and busy' },
  { dir: 'journeys', blurb: 'multi-page tasks \u2014 carrying the criteria that cannot be tested '
      + 'on a single page at all: consistent navigation, identification, help, redundant entry' },
  { dir: 'scenarios', blurb: 'remaining scenario types at their honest unit \u2014 overlays, async, '
      + 'paging, theming, orientation, RTL, touch targets, voice control, dragging' },
  { dir: 'surfaces', blurb: 'beyond a plain web page \u2014 HTML email, EPUB metadata, an authoring '
      + 'tool and its output (ATAG 2.0), and a conversational interface' },
  { dir: 'guided', blurb: 'questions automation cannot answer, with the fixture to ask them '
      + 'against and a slot for evidence \u2014 every one expects cannot-tell' },
  { dir: 'flash', blurb: 'flash and seizure thresholds \u2014 SEIZURE WARNING: these can produce '
      + 'flashing light. Nothing flashes on load; each needs a button press and stops after 3s' },
];

fs.writeFileSync(path.join(ROOT, 'index.html'), page('Accessibility fixture corpus',
  EXTRA_GROUPS.filter((e) => fs.existsSync(path.join(ROOT, e.dir, 'index.html')))
    .map((e) => `<h2>${e.dir}</h2><p>${e.blurb}</p>
      <ul><li><a href="${e.dir}/index.html">${e.dir} fixtures</a></li></ul>`).join('\n')
  + groups.map((g) => `
<h2>${g}</h2>
<ul>${FIXTURES.filter((f) => f.dir === g).map((f) =>
  `<li><a href="${g}/${f.file}">${f.title}</a> — ${f.sc.join(', ')} — <strong>${f.expect === 'flag' ? 'should flag' : 'must not flag'}</strong></li>`).join('\n')}</ul>`).join('\n'))
  .replace('<link rel="stylesheet" href="../fixture.css">', '<link rel="stylesheet" href="fixture.css">'));

// Catalog is GROUND TRUTH only — what a correct scanner should say. It deliberately
// carries no measured verdicts; `check/reference.mjs` produces browser facts separately,
// so a regression can never be hidden by editing the truth to match the engine.
//
// Shape deliberately mirrors the expected-findings convention used by security
// test corpora: cases carry ground truth, a separate measured baseline carries engine
// behaviour, and the two are never merged.
fs.writeFileSync(path.join(ROOT, 'catalog.json'), JSON.stringify({
  description: 'Ground truth for the a11y-demo fixture corpus. Each case names the WCAG '
    + 'success criteria a correct scanner should report (min_criteria) or, for a negative '
    + 'control, the criteria it must NOT report (expected-clean). Browser reference facts '
    + 'live in check/reference.json, never here.',
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  scoring: {
    recall: 'sum(criteria reported on tp cases) / sum(min_criteria) across mode=tp',
    fp_rate: 'a finding for a criterion listed in must_not_report on a mode=safe case is a false positive; other criteria require their own ground truth',
    verdict_legend: {
      'expected-fire': 'a control SHOULD report this criterion on this page',
      'expected-fn': 'known miss at the current baseline — a pinned recall gap, NOT a test failure',
      'expected-clean': 'negative control — 0 findings of the listed criteria',
      'control-absent': 'the pack ships no control for this criterion; excluded from recall math',
    },
  },
  counts: {
    total: FIXTURES.length,
    tp: FIXTURES.filter((f) => f.expect === 'flag').length,
    safe: FIXTURES.filter((f) => f.expect === 'clean').length,
  },
  cases: FIXTURES.map((f) => ({
    id: `${f.dir}-${f.file.replace(/\.html$/, '')}`,
    mode: f.expect === 'flag' ? 'tp' : 'safe',
    path: `${f.dir}/${f.file}`,
    min_criteria: f.expect === 'flag' ? Object.fromEntries(f.sc.map((s) => [s, 1])) : {},
    must_not_report: f.expect === 'clean' ? f.sc : [],
    derived_from_manual_rows: f.manual,
    notes: f.note,
  })),
}, null, 2) + '\n');

console.log(`${FIXTURES.length} fixtures — ${FIXTURES.filter((f) => f.expect === 'flag').length} should flag, ${FIXTURES.filter((f) => f.expect === 'clean').length} must not flag`);
for (const g of groups) console.log(`  ${g}/  ${FIXTURES.filter((f) => f.dir === g).length}`);
