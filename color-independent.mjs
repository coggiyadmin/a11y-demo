// Colour-independent information fixtures.
//
// These failures are mostly invisible to a contrast-ratio check, which is why they
// need their own family. Contrast asks "is this text legible against its background".
// These ask a different question: "is colour the ONLY thing carrying this information".
// Two colours can each have ample contrast against the background and still be
// indistinguishable from each other.
//
// Every pair uses the same content and differs only in whether a second, non-colour
// channel is present — text, icon, shape, pattern or underline.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'color-independent');

const page = (title, body, head = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
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

const CASES = [
  {
    id: 'error_color_only', check: 'error-color-only',
    sc: ['1.4.1', '3.3.1'], needs: ['color-independent', 'nonvisual-access', 'language-clarity'],
    brokenNote: 'The only signal that this field is wrong is that its border and message '
      + 'turned red. Remove colour and the page says nothing is wrong.',
    broken: `<style>.bad{border:2px solid #d00}.msg{color:#d00}</style>
<form><label for="a1">Email</label><input id="a1" class="bad" value="not-an-email">
<p class="msg">not-an-email</p></form>`,
    correctNote: 'Colour is still used, but the error is also stated in text, carries an '
      + 'icon, and is programmatically associated with the field.',
    correct: `<style>.bad{border:2px solid #d00}.msg{color:#a00}</style>
<form><label for="a2">Email</label>
<input id="a2" class="bad" value="not-an-email" aria-invalid="true" aria-describedby="a2e">
<p class="msg" id="a2e"><span aria-hidden="true">⚠</span> Error: enter an address in the
format name@example.com.</p></form>`,
  },
  {
    id: 'status_color_only', check: 'error-color-only',
    sc: ['1.4.1'], needs: ['color-independent', 'nonvisual-access'],
    brokenNote: 'Flight status shown as coloured dots. The red and green signals can become '
      + 'indistinguishable when hue perception differs or colour is unavailable.',
    broken: `<style>.dot{display:inline-block;width:14px;height:14px;border-radius:50%}
.on{background:#2a2}.off{background:#d22}</style>
<ul><li><span class="dot on"></span> BA117</li><li><span class="dot off"></span> BA118</li></ul>`,
    correctNote: 'Shape and text carry the status; colour is redundant reinforcement.',
    correct: `<style>.dot{display:inline-block;width:14px;height:14px}
.on{background:#1a6b1a;border-radius:50%}.off{background:#a11;clip-path:polygon(50% 0,100% 100%,0 100%)}</style>
<ul><li><span class="dot on" aria-hidden="true"></span> BA117 — On time</li>
<li><span class="dot off" aria-hidden="true"></span> BA118 — Cancelled</li></ul>`,
  },
  {
    id: 'link_color_only', check: 'link-color-only',
    sc: ['1.4.1'], needs: ['color-independent', 'visual-clarity'],
    brokenNote: 'A link inside a paragraph, distinguished from surrounding text only by '
      + 'colour. WCAG needs a second cue, or 3:1 contrast against the surrounding text '
      + 'plus a cue on hover and focus.',
    broken: `<style>.ln{color:#2a6ebb;text-decoration:none}</style>
<p>Baggage limits are listed in the <a href="#f" class="ln">fare conditions</a> for your ticket.</p>`,
    correctNote: 'Underlined, so the link is identifiable without perceiving colour at all.',
    correct: `<style>.ln2{color:#1c4e7a;text-decoration:underline}</style>
<p>Baggage limits are listed in the <a href="#f" class="ln2">fare conditions</a> for your ticket.</p>`,
  },
  {
    id: 'chart_series_color_only', check: 'chart-series',
    sc: ['1.4.1'], needs: ['color-independent', 'nonvisual-access', 'language-clarity'],
    brokenNote: 'Two series separated only by hue, with a colour-keyed legend. Automation '
      + 'can flag the pattern; whether the series remain readable is a judgement call — '
      + 'this is a cannot-tell case, not an automatic fail.',
    broken: `<svg width="100%" viewBox="0 0 300 120" role="img" aria-label="Bookings by month">
<polyline fill="none" stroke="#c22" stroke-width="3" points="10,100 70,70 130,80 190,40 250,30"/>
<polyline fill="none" stroke="#2a2" stroke-width="3" points="10,110 70,95 130,60 190,75 250,55"/>
</svg>
<p><span style="color:#c22">■</span> Economy &nbsp; <span style="color:#2a2">■</span> Business</p>`,
    correctNote: 'Series differ by dash pattern and are directly labelled, and a data table '
      + 'gives the same information in text.',
    correct: `<svg width="100%" viewBox="0 0 300 120" role="img" aria-label="Bookings by month. Economy rises from 20 to 90. Business rises from 10 to 65.">
<polyline fill="none" stroke="#1c4e7a" stroke-width="3" points="10,100 70,70 130,80 190,40 250,30"/>
<polyline fill="none" stroke="#1a6b1a" stroke-width="3" stroke-dasharray="8 4" points="10,110 70,95 130,60 190,75 250,55"/>
<text x="255" y="30" font-size="11">Economy</text><text x="255" y="58" font-size="11">Business</text>
</svg>
<table><caption>Bookings by month</caption>
<thead><tr><th scope="col">Month</th><th scope="col">Economy</th><th scope="col">Business</th></tr></thead>
<tbody><tr><th scope="row">Jan</th><td>20</td><td>10</td></tr>
<tr><th scope="row">May</th><td>90</td><td>65</td></tr></tbody></table>`,
  },
  {
    id: 'selection_color_only', check: 'interactive-states',
    sc: ['1.4.1', '4.1.2'], needs: ['color-independent', 'nonvisual-access'],
    brokenNote: 'The selected seat class is shown by background colour alone — no text, '
      + 'no checkmark, no aria-pressed or aria-selected.',
    broken: `<style>.opt{border:1px solid #999}.sel{background:#2a6ebb;color:#fff}</style>
<div><span class="opt sel">Economy</span> <span class="opt">Business</span></div>`,
    correctNote: 'aria-pressed carries the state programmatically and a checkmark carries '
      + 'it visually, so neither colour nor sight alone is required.',
    correct: `<style>.opt{border:1px solid #767676}.sel{background:#1c4e7a;color:#fff}</style>
<button type="button" class="opt sel" aria-pressed="true"><span aria-hidden="true">✓ </span>Economy</button>
<button type="button" class="opt" aria-pressed="false">Business</button>`,
  },
  {
    id: 'placeholder_contrast', check: 'placeholder-contrast',
    sc: ['1.4.3'], needs: ['visual-clarity', 'contrast-adaptation', 'forgiving-interface'],
    brokenNote: 'Placeholder at #bbb on white is about 1.9:1 — below the 4.5:1 minimum — '
      + 'and here it is the only labelling the field has.',
    broken: `<style>.ph::placeholder{color:#bbb}</style>
<input class="ph" placeholder="Departure airport">`,
    correctNote: 'A real label, with placeholder text used only as an example and at a '
      + 'contrast that clears the minimum.',
    correct: `<style>.ph2::placeholder{color:#595959}</style>
<label for="dep">Departure airport</label>
<input id="dep" class="ph2" placeholder="e.g. London Heathrow">`,
  },
  {
    id: 'disabled_state', check: 'placeholder-contrast',
    sc: ['1.4.1'], needs: ['color-independent', 'contrast-adaptation', 'task-guidance'],
    brokenNote: 'A button that is unavailable looks greyed out but is not marked disabled, '
      + 'so the state exists only as a colour change.',
    broken: `<style>.gray{background:#ddd;color:#aaa;border:1px solid #ddd}</style>
<button type="button" class="gray">Continue</button>`,
    correctNote: 'Genuinely disabled, so the state is exposed, plus text explaining why.',
    correct: `<button type="button" disabled aria-describedby="why">Continue</button>
<p id="why">Select a departure date before continuing.</p>`,
  },
  {
    id: 'required_color_only', check: 'error-color-only',
    sc: ['1.4.1', '3.3.2'], needs: ['color-independent', 'nonvisual-access', 'language-clarity'],
    brokenNote: 'Required fields marked with a red asterisk whose meaning is never stated.',
    broken: `<style>.req{color:#d00}</style>
<form><label for="n1">Name <span class="req">*</span></label><input id="n1"></form>`,
    correctNote: 'The word "required" in the label, and the required attribute.',
    correct: `<form><label for="n2">Name (required)</label><input id="n2" required aria-required="true"></form>`,
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

// Colour transformations make "can you still tell them apart?" a question the harness
// can put to a screenshot rather than something a human has to take on trust.
// Matrices are the Machado/Viénot linear approximations in common use.
fs.writeFileSync(path.join(DIR, 'simulate.html'), page('Colour-independence simulation',
  `<p>Each fixture rendered through three colour-perception transformations and a
   monochrome transformation. Open a broken fixture in a filtered frame and ask whether
   the information survives. If it does not, colour was the only channel.</p>
<svg width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <filter id="transform-a"><feColorMatrix type="matrix" values="
    0.567 0.433 0     0 0
    0.558 0.442 0     0 0
    0     0.242 0.758 0 0
    0     0     0     1 0"/></filter>
  <filter id="transform-b"><feColorMatrix type="matrix" values="
    0.625 0.375 0     0 0
    0.70  0.30  0     0 0
    0     0.30  0.70  0 0
    0     0     0     1 0"/></filter>
  <filter id="transform-c"><feColorMatrix type="matrix" values="
    0.95  0.05  0     0 0
    0     0.433 0.567 0 0
    0     0.475 0.525 0 0
    0     0     0     1 0"/></filter>
  <filter id="monochrome"><feColorMatrix type="matrix" values="
    0.299 0.587 0.114 0 0
    0.299 0.587 0.114 0 0
    0.299 0.587 0.114 0 0
    0     0     0     1 0"/></filter>
</defs></svg>
<style>
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:1rem}
  .grid figure{margin:0}
  .grid iframe{height:16rem}
  .p{filter:url(#transform-a)} .d{filter:url(#transform-b)}
  .t{filter:url(#transform-c)} .a{filter:url(#monochrome)}
</style>
<div class="grid">
${['', 'p', 'd', 't', 'a'].map((f, i) => `  <figure>
    <figcaption>${['Unfiltered', 'Transformation A', 'Transformation B', 'Transformation C', 'Monochrome'][i]}</figcaption>
    <iframe class="${f}" src="./status_color_only.html" title="Status fixture, ${
      ['unfiltered', 'transformation A', 'transformation B', 'transformation C', 'monochrome'][i]}"></iframe>
  </figure>`).join('\n')}
</div>`));

const cases = [];
for (const c of CASES) {
  for (const [kind, body, note] of [['broken', c.broken, c.brokenNote], ['correct', c.correct, c.correctNote]]) {
    const file = kind === 'broken' ? `${c.id}.html` : `safe_${c.id}.html`;
    const header = `<!--\n  ${c.id} — ${kind}\n  WCAG: ${c.sc.join(', ')}\n  check: ${c.check}\n  needs: ${c.needs.join(', ')}\n  ${note}\n-->\n`;
    fs.writeFileSync(path.join(DIR, file), header + page(`${c.id} — ${kind}`, `<p>${note}</p><hr>${body}`));
    cases.push({
      id: `color-${kind === 'broken' ? c.id : 'safe_' + c.id}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `color-independent/${file}`,
      color_check: c.check,
      surface: 'web', journey: 'form-lifecycle', ui_state: kind === 'broken' ? 'invalid' : 'default',
      method: ['visual', 'runtime-dom'],
      input_at: ['pointer', 'keyboard'],
      user_needs: c.needs,
      min_criteria: kind === 'broken' ? Object.fromEntries(c.sc.map((s) => [s, 1])) : {},
      must_not_report: kind === 'broken' ? [] : c.sc,
      expected_outcome: kind === 'broken' ? 'fail' : 'pass',
      notes: note,
    });
  }
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('colour-independent information fixtures',
  `<p>Colour used as the only carrier of information. A contrast check catches none of
   these: two colours can each clear 4.5:1 against the background and still be
   indistinguishable from one another.</p>
   <p><a href="simulate.html">Simulation view</a> — the same fixture through three
   colour-perception transformations and a monochrome transformation.</p>
   <ul>${CASES.map((c) => `<li><a href="${c.id}.html">${c.id}</a> ·
     <a href="safe_${c.id}.html">corrected</a> — ${c.sc.join(', ')}</li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'color-independent.json'), JSON.stringify({
  description: 'Colour-independent information fixtures. Each pair holds content constant and differs only '
    + 'in whether a second, non-colour channel carries the information.',
  checks_covered: [...new Set(CASES.map((c) => c.check))],
  generated: new Date().toISOString().slice(0, 10),
  counts: { pairs: CASES.length, cases: cases.length },
  cases,
}, null, 2) + '\n');

console.log(`${CASES.length} pairs → ${cases.length} cases`);
console.log(`checks covered: ${[...new Set(CASES.map((c) => c.check))].join(', ')}`);
