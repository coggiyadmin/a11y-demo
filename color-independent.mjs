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
    // #55: the broken page used to mark nothing as in error -- no aria-invalid, no
    // :invalid, no description -- so no error state was conveyed by colour or
    // otherwise. Now the field IS in error and marked aria-invalid, and the only
    // visual sign is a red border beside a grey one of near-equal lightness
    // (1.13:1): F81 under 1.4.1. No text describes the error, so 3.3.1 fails too.
    id: 'error_color_only', check: 'error-color-only',
    sc: ['1.4.1', '3.3.1'], needs: ['color-independent', 'nonvisual-access', 'language-clarity'],
    brokenNote: 'The email field is in error (aria-invalid="true"), and the only thing that shows '
      + 'it is a red border where the valid field has a grey one of almost the same lightness '
      + '(1.13:1). No text says what is wrong. Remove colour and the page says nothing is wrong.',
    broken: `<style>.in{border:2px solid #767676}.in.bad{border-color:#d00}</style>
<form><p><label for="n1">Name</label><input id="n1" class="in" value="Alex Example"></p>
<p><label for="a1">Email</label><input id="a1" class="in bad" value="not-an-email" aria-invalid="true"></p></form>`,
    correctNote: 'The same red border, plus an error stated in text, an icon, and the message '
      + 'associated with the field.',
    correct: `<style>.in{border:2px solid #767676}.in.bad{border-color:#d00}.msg{color:#a00}</style>
<form><p><label for="n2">Name</label><input id="n2" class="in" value="Alex Example"></p>
<p><label for="a2">Email</label><input id="a2" class="in bad" value="not-an-email" aria-invalid="true" aria-describedby="a2e"></p>
<p class="msg" id="a2e"><span aria-hidden="true">⚠</span> Error: enter an address in the
format name@example.com.</p></form>`,
  },
  {
    // #55: each dot used to sit beside different text with no key, so nothing said
    // what the colours meant. Now the status of each flight is told ONLY by hue:
    // a red and a green of near-equal lightness (1.10:1), keyed by a legend that is
    // itself colour-only. G14/G182 are absent and the hues differ in nothing else.
    id: 'status_color_only', check: 'error-color-only',
    sc: ['1.4.1'], needs: ['color-independent', 'nonvisual-access'],
    brokenNote: 'Flight status is shown only by the colour of a dot, red or green, with the two '
      + 'colours at almost the same lightness (1.10:1). The key is colour too. Where hue cannot '
      + 'be told apart, every flight looks the same.',
    broken: `<style>.dot{display:inline-block;width:14px;height:14px;border-radius:50%}
.on{background:#2e7d32}.off{background:#c62828}</style>
<p>Key: <span class="dot on"></span> on time · <span class="dot off"></span> cancelled</p>
<ul><li><span class="dot on"></span> BA117 to Paris, 08:40</li>
<li><span class="dot off"></span> BA118 to Rome, 09:15</li>
<li><span class="dot on"></span> BA119 to Madrid, 10:05</li></ul>`,
    correctNote: 'The same colours, plus shape and the status in words, so colour is redundant '
      + 'reinforcement.',
    correct: `<style>.dot{display:inline-block;width:14px;height:14px}
.on{background:#2e7d32;border-radius:50%}.off{background:#c62828;clip-path:polygon(50% 0,100% 100%,0 100%)}</style>
<p>Key: <span class="dot on" aria-hidden="true"></span> on time · <span class="dot off" aria-hidden="true"></span> cancelled</p>
<ul><li><span class="dot on" aria-hidden="true"></span> BA117 to Paris, 08:40 — On time</li>
<li><span class="dot off" aria-hidden="true"></span> BA118 to Rome, 09:15 — Cancelled</li>
<li><span class="dot on" aria-hidden="true"></span> BA119 to Madrid, 10:05 — On time</li></ul>`,
  },
  {
    // #55: the link used to be 3.35:1 against its surrounding text. F73's note and
    // the WCAG 2.2 edition of G183 accept a 3:1 lightness difference as the cue, so
    // that page passed. It is now 2.21:1 against the text with no underline, weight
    // or other cue in any state -- and still 7.88:1 against the background, so the
    // pair does not also fail 1.4.3 or 1.4.6.
    id: 'link_color_only', check: 'link-color-only',
    sc: ['1.4.1'], needs: ['color-independent', 'visual-clarity'],
    brokenNote: 'A link inside a paragraph, told apart from the surrounding text only by hue: '
      + '2.21:1 against the text, below the 3:1 that G183 and F73 accept, with no underline '
      + 'or other non-colour cue.',
    broken: `<style>.ln,.ln:hover{color:#1d4f9e;text-decoration:none}</style>
<p>Baggage limits are listed in the <a href="#f" class="ln">fare conditions</a> for your ticket.</p>`,
    correctNote: 'The same colour, underlined, so the link is identifiable without perceiving '
      + 'colour at all.',
    correct: `<style>.ln2{color:#1d4f9e;text-decoration:underline}</style>
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
    // #55: the selected option used to be 5.2:1 against the page (a lightness
    // difference, which 1.4.1 accepts) on spans that were not UI components. The
    // options are now real toggle buttons, and selected differs from unselected
    // only in hue: light blue against light grey, 1.22:1, same border, same text.
    // The state is also not exposed (no aria-pressed), which is the 4.1.2 half.
    id: 'selection_color_only', check: 'interactive-states',
    sc: ['1.4.1', '4.1.2'], needs: ['color-independent', 'nonvisual-access'],
    brokenNote: 'Two toggle buttons for seat class. The selected one differs only in fill hue, '
      + 'light blue against light grey at 1.22:1, with the same border and text — and no '
      + 'aria-pressed, so the state is not exposed either.',
    broken: `<style>.opt{background:#e6e6e6;color:#1a1a1a;border:1px solid #767676}.opt.sel{background:#bcd3f5}</style>
<div><button type="button" class="opt sel" onclick="document.querySelectorAll('.opt').forEach(function(b){b.classList.toggle('sel',b===this)},this)">Economy</button>
<button type="button" class="opt" onclick="document.querySelectorAll('.opt').forEach(function(b){b.classList.toggle('sel',b===this)},this)">Business</button></div>`,
    correctNote: 'The same fills, plus aria-pressed carrying the state programmatically and a '
      + 'checkmark carrying it visually.',
    correct: `<style>.opt{background:#e6e6e6;color:#1a1a1a;border:1px solid #767676}.opt[aria-pressed="true"]{background:#bcd3f5}.opt .tick{visibility:hidden}.opt[aria-pressed="true"] .tick{visibility:visible}</style>
<div><button type="button" class="opt" aria-pressed="true" onclick="document.querySelectorAll('.opt').forEach(function(b){b.setAttribute('aria-pressed',String(b===this))},this)"><span class="tick" aria-hidden="true">✓ </span>Economy</button>
<button type="button" class="opt" aria-pressed="false" onclick="document.querySelectorAll('.opt').forEach(function(b){b.setAttribute('aria-pressed',String(b===this))},this)"><span class="tick" aria-hidden="true">✓ </span>Business</button></div>`,
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
    // #55: this used to be one grey, enabled button with nothing to compare it with:
    // a 1.4.3 contrast defect, not a 1.4.1 one. Now a row of seats where the taken
    // ones differ from the free ones only in fill hue (1.05:1, same border, same
    // text). They ARE disabled, so the state is exposed and 4.1.2 is not in play,
    // and inactive controls are exempt from 1.4.3: the pair isolates 1.4.1.
    id: 'disabled_state', check: 'placeholder-contrast',
    sc: ['1.4.1'], needs: ['color-independent', 'contrast-adaptation', 'task-guidance'],
    brokenNote: 'A row of seats where the taken ones are unavailable (disabled) but look different '
      + 'only by fill hue — peach instead of blue at 1.05:1, same border and text. The key '
      + 'names the colours, so where hue cannot be told apart every seat looks free.',
    broken: `<style>.seat{background:#cfe0f7;color:#1a1a1a;border:1px solid #767676}.seat.taken{background:#f7d2bd}</style>
<p>Blue seats are free; peach seats are taken.</p>
<p><button type="button" class="seat">12A</button><button type="button" class="seat taken" disabled>12B</button><button type="button" class="seat taken" disabled>12C</button><button type="button" class="seat">12D</button></p>`,
    correctNote: 'The same seats and colours, plus a crossed-out label and the word "taken", so '
      + 'unavailability does not depend on hue.',
    correct: `<style>.seat{background:#cfe0f7;color:#1a1a1a;border:1px solid #767676}.seat.taken{background:#f7d2bd;text-decoration:line-through}</style>
<p>Free seats show their number; taken seats are crossed out and marked "taken".</p>
<p><button type="button" class="seat">12A</button><button type="button" class="seat taken" disabled>12B taken</button><button type="button" class="seat taken" disabled>12C taken</button><button type="button" class="seat">12D</button></p>`,
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
