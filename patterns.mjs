// APG component patterns, as correct/broken pairs.
//
// Custom widgets are where automated scanners are weakest and where real products
// break: a native <button> is hard to get wrong, a div-based combobox is hard to
// get right. Each pattern here ships BOTH a correct implementation following the
// ARIA Authoring Practices Guide and a broken one, so a scanner is measured on
// discrimination rather than on sensitivity alone.
//
// The correct versions are the load-bearing half. Any scanner can flag everything;
// only an accurate one leaves the APG-conformant version alone.
//
//   https://www.w3.org/WAI/ARIA/apg/patterns/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'patterns');

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

/**
 * Each pattern: a broken implementation and an APG-correct one.
 * `needs` names the functional user needs the broken version blocks — taxonomy/user-needs.json.
 */
const PATTERNS = [
  {
    id: 'disclosure', apg: 'disclosure',
    sc: ['4.1.2', '2.1.1'], needs: ['vision-blind', 'motor-dexterity'],
    brokenNote: 'A div toggles visibility with no role, no aria-expanded and no keyboard access. '
      + 'A screen reader announces nothing about state; a keyboard cannot reach it.',
    broken: `<div class="btn" onclick="var p=document.getElementById('d1');p.hidden=!p.hidden">Baggage rules</div>
<div id="d1" hidden><p>One cabin bag up to 7kg.</p></div>`,
    correctNote: 'Native button, aria-expanded reflecting state, aria-controls to the region.',
    correct: `<button type="button" aria-expanded="false" aria-controls="d2"
  onclick="var b=this,p=document.getElementById('d2');var o=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!o));p.hidden=o">Baggage rules</button>
<div id="d2" hidden><p>One cabin bag up to 7kg.</p></div>`,
  },
  {
    id: 'accordion', apg: 'accordion',
    sc: ['4.1.2', '1.3.1'], needs: ['vision-blind', 'cognitive-executive'],
    brokenNote: 'Headings are divs, panels have no relationship to their triggers, no expanded state.',
    broken: `<div class="field" onclick="void 0">Fares</div><div><p>Economy, Premium.</p></div>
<div class="field" onclick="void 0">Changes</div><div><p>Free within 24h.</p></div>`,
    correctNote: 'Heading-wrapped buttons, aria-expanded, aria-controls, region labelled by its trigger.',
    correct: `<h2><button type="button" aria-expanded="true" aria-controls="p1" id="t1">Fares</button></h2>
<div id="p1" role="region" aria-labelledby="t1"><p>Economy, Premium.</p></div>
<h2><button type="button" aria-expanded="false" aria-controls="p2" id="t2">Changes</button></h2>
<div id="p2" role="region" aria-labelledby="t2" hidden><p>Free within 24h.</p></div>`,
  },
  {
    id: 'tabs', apg: 'tabs',
    sc: ['4.1.2', '2.1.1', '2.4.3'], needs: ['vision-blind', 'motor-dexterity'],
    brokenNote: 'role=tab asserted on non-focusable divs with no tablist, no tabpanel and no selected state.',
    broken: `<div><div role="tab">Flights</div><div role="tab">Hotels</div></div>
<div><p>Flight results.</p></div>`,
    correctNote: 'tablist/tab/tabpanel with roving tabindex, aria-selected and aria-controls.',
    correct: `<div role="tablist" aria-label="Travel modes">
  <button role="tab" id="tb1" aria-selected="true" aria-controls="tp1" tabindex="0">Flights</button>
  <button role="tab" id="tb2" aria-selected="false" aria-controls="tp2" tabindex="-1">Hotels</button>
</div>
<div role="tabpanel" id="tp1" aria-labelledby="tb1"><p>Flight results.</p></div>
<div role="tabpanel" id="tp2" aria-labelledby="tb2" hidden><p>Hotel results.</p></div>`,
  },
  {
    id: 'dialog', apg: 'dialog-modal',
    sc: ['4.1.2', '2.1.1', '2.4.3'], needs: ['vision-blind', 'motor-dexterity', 'cognitive-attention'],
    brokenNote: 'A styled div overlay: no dialog role, no accessible name, background not inert, '
      + 'focus never moved in and never restored on close.',
    broken: `<div class="btn" onclick="document.getElementById('m1').hidden=false">Change seat</div>
<div id="m1" hidden style="border:2px solid #30556e;padding:1rem">
  <p>Select a seat.</p><div class="btn" onclick="document.getElementById('m1').hidden=true">Close</div>
</div>`,
    correctNote: 'Native <dialog> with showModal(): dialog role, accessible name, inert background, '
      + 'focus moved in by the platform and restored on close.',
    correct: `<button type="button" onclick="document.getElementById('m2').showModal()">Change seat</button>
<dialog id="m2" aria-labelledby="m2t">
  <h2 id="m2t">Select a seat</h2>
  <form method="dialog"><button type="submit">Close</button></form>
</dialog>`,
  },
  {
    id: 'combobox', apg: 'combobox',
    sc: ['4.1.2', '2.1.1'], needs: ['vision-blind', 'motor-dexterity', 'cognitive-memory'],
    brokenNote: 'A div that opens a div list. No combobox role, no expanded state, no active option, '
      + 'no relationship between input and list.',
    broken: `<div class="field" onclick="document.getElementById('l1').hidden=false">Choose airport</div>
<div id="l1" hidden><div onclick="void 0">LHR</div><div onclick="void 0">JFK</div></div>`,
    correctNote: 'Input with role=combobox, aria-expanded, aria-controls, and a listbox of options.',
    correct: `<label for="cb">Choose airport</label>
<input id="cb" role="combobox" aria-expanded="false" aria-controls="l2" aria-autocomplete="list">
<ul id="l2" role="listbox" aria-label="Airports" hidden>
  <li role="option" id="o1" aria-selected="false">LHR</li>
  <li role="option" id="o2" aria-selected="false">JFK</li>
</ul>`,
  },
  {
    id: 'menu', apg: 'menu-button',
    sc: ['4.1.2', '2.1.1'], needs: ['vision-blind', 'motor-dexterity'],
    brokenNote: 'Div trigger, div items, no menu semantics and no keyboard model.',
    broken: `<div class="btn" onclick="document.getElementById('mn1').hidden=false">Account</div>
<div id="mn1" hidden><div onclick="void 0">Profile</div><div onclick="void 0">Sign out</div></div>`,
    correctNote: 'Button with aria-haspopup and aria-expanded, menu with menuitems.',
    correct: `<button type="button" aria-haspopup="true" aria-expanded="false" aria-controls="mn2">Account</button>
<ul id="mn2" role="menu" aria-label="Account" hidden>
  <li role="menuitem" tabindex="-1">Profile</li>
  <li role="menuitem" tabindex="-1">Sign out</li>
</ul>`,
  },
  {
    id: 'switch', apg: 'switch',
    sc: ['4.1.2', '2.1.1'], needs: ['vision-blind', 'motor-dexterity'],
    brokenNote: 'A toggle whose on/off state is conveyed only by colour and position.',
    broken: `<div class="card" onclick="this.style.background=this.style.background?'':'#30556e'">Seat alerts</div>`,
    correctNote: 'role=switch with aria-checked, or a native checkbox.',
    correct: `<button type="button" role="switch" aria-checked="false"
  onclick="this.setAttribute('aria-checked', this.getAttribute('aria-checked')==='true'?'false':'true')">Seat alerts</button>`,
  },
  {
    id: 'alert', apg: 'alert',
    sc: ['4.1.3'], needs: ['vision-blind', 'cognitive-attention'],
    brokenNote: 'A status message injected with no live region, so it is never announced.',
    broken: `<button type="button" onclick="document.getElementById('s1').textContent='Seat saved.'">Save</button>
<div id="s1"></div>`,
    correctNote: 'role=status (polite) present in the DOM before the text changes.',
    correct: `<button type="button" onclick="document.getElementById('s2').textContent='Seat saved.'">Save</button>
<div id="s2" role="status" aria-live="polite"></div>`,
  },
  {
    id: 'table', apg: 'table',
    sc: ['1.3.1'], needs: ['vision-blind', 'cognitive-memory'],
    brokenNote: 'A layout of divs presenting tabular data, with no table semantics or header association.',
    broken: `<div><div><span>Flight</span><span>Depart</span></div>
<div><span>BA117</span><span>08:40</span></div></div>`,
    correctNote: 'Real table with a caption and scoped headers.',
    correct: `<table><caption>Departures</caption>
<thead><tr><th scope="col">Flight</th><th scope="col">Depart</th></tr></thead>
<tbody><tr><th scope="row">BA117</th><td>08:40</td></tr></tbody></table>`,
  },
  {
    id: 'tooltip', apg: 'tooltip',
    sc: ['4.1.2', '1.4.13'], needs: ['vision-blind', 'vision-low', 'motor-tremor'],
    brokenNote: 'title-only hint on a non-focusable div: unreachable by keyboard, not dismissible, '
      + 'and not associated with any control.',
    broken: `<div class="field" title="Fare rules apply">Fare info</div>`,
    correctNote: 'Focusable control with aria-describedby pointing at a tooltip element.',
    correct: `<button type="button" aria-describedby="tt1">Fare info</button>
<span id="tt1" role="tooltip">Fare rules apply</span>`,
  },
  {
    id: 'breadcrumb', apg: 'breadcrumb',
    sc: ['1.3.1', '4.1.2'], needs: ['vision-blind', 'cognitive-executive'],
    brokenNote: 'Separator characters as text, no nav landmark, current page not identified.',
    broken: `<div>Home &gt; Flights &gt; Booking</div>`,
    correctNote: 'nav landmark, ordered list, aria-current on the current page.',
    correct: `<nav aria-label="Breadcrumb"><ol>
  <li><a href="#home">Home</a></li>
  <li><a href="#flights">Flights</a></li>
  <li><a href="#booking" aria-current="page">Booking</a></li>
</ol></nav>`,
  },
  {
    id: 'slider', apg: 'slider',
    sc: ['4.1.2', '2.1.1'], needs: ['vision-blind', 'motor-dexterity', 'motor-tremor'],
    brokenNote: 'A draggable div with no role, no value, and no keyboard alternative to dragging.',
    broken: `<div class="field"><div class="card" draggable="true">drag me</div></div>`,
    correctNote: 'Native range input: role, value, and arrow-key operation for free.',
    correct: `<label for="pr">Maximum price</label>
<input type="range" id="pr" min="0" max="1000" value="500" step="50">`,
  },
  {
    id: 'listbox', apg: 'listbox',
    sc: ['4.1.2', '2.1.1'], needs: ['vision-blind', 'motor-dexterity'],
    brokenNote: 'Selection indicated by background colour only, with no role or selected state.',
    broken: `<div><div class="card" onclick="void 0">Economy</div><div class="card" onclick="void 0">Business</div></div>`,
    correctNote: 'role=listbox with options, aria-selected, and a single tab stop.',
    correct: `<ul role="listbox" aria-label="Cabin class" tabindex="0">
  <li role="option" aria-selected="true">Economy</li>
  <li role="option" aria-selected="false">Business</li>
</ul>`,
  },
  {
    id: 'form-errors', apg: 'none',
    sc: ['3.3.1', '3.3.2', '4.1.2'], needs: ['vision-blind', 'cognitive-language', 'cognitive-executive'],
    brokenNote: 'Error shown as red text near the field: not associated, not announced, '
      + 'and colour is the only cue.',
    broken: `<form><label for="e1">Email</label><input id="e1" value="not-an-email">
<span style="color:#b00">Wrong</span><button type="button">Continue</button></form>`,
    correctNote: 'aria-invalid, aria-describedby to the message, text that says what to do.',
    correct: `<form><label for="e2">Email</label>
<input id="e2" value="not-an-email" aria-invalid="true" aria-describedby="e2err">
<p id="e2err">Enter an email address in the format name@example.com.</p>
<button type="submit">Continue</button></form>`,
  },
  {
    id: 'required-fields', apg: 'none',
    sc: ['3.3.2', '1.3.1'], needs: ['vision-blind', 'vision-color', 'cognitive-language'],
    brokenNote: 'Required marked with a red asterisk whose meaning is never stated in text.',
    broken: `<form><label for="r1">Name <span style="color:#b00">*</span></label><input id="r1"></form>`,
    correctNote: 'required attribute plus visible text, not colour or glyph alone.',
    correct: `<form><label for="r2">Name (required)</label><input id="r2" required aria-required="true"></form>`,
  },
  {
    id: 'media-captions', apg: 'none',
    sc: ['1.2.2', '1.2.3'], needs: ['hearing-deaf', 'hearing-hoh', 'situational'],
    brokenNote: 'Video with no caption track and no transcript. Automation can detect the ABSENCE '
      + 'of a track; it cannot judge caption quality or synchronisation — that is cannot-tell.',
    broken: `<video controls width="320"><source src="../pixel.png" type="video/mp4"></video>`,
    correctNote: 'A caption track is declared and a transcript is linked.',
    correct: `<video controls width="320"><source src="../pixel.png" type="video/mp4">
<track kind="captions" src="captions.vtt" srclang="en" label="English" default></video>
<p><a href="#transcript">Read the transcript</a></p>`,
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const cases = [];
for (const p of PATTERNS) {
  const apgLink = p.apg === 'none' ? '' : `\n  APG: https://www.w3.org/WAI/ARIA/apg/patterns/${p.apg}/`;
  for (const [kind, body, note] of [
    ['broken', p.broken, p.brokenNote],
    ['correct', p.correct, p.correctNote],
  ]) {
    const file = kind === 'broken' ? `${p.id}.html` : `safe_${p.id}.html`;
    const title = `${p.id} — ${kind === 'broken' ? 'broken' : 'APG-correct'}`;
    const header = `<!--\n  ${title}\n  WCAG: ${p.sc.join(', ')}\n  Expectation: ${
      kind === 'broken' ? 'a scanner SHOULD report' : 'a scanner MUST NOT report — negative control'
    }${apgLink}\n  ${note}\n-->\n`;
    fs.writeFileSync(path.join(DIR, file), header + page(title,
      `<p>${note}</p>\n<hr>\n${body}`));
    cases.push({
      id: `patterns-${kind === 'broken' ? p.id : 'safe_' + p.id}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `patterns/${file}`,
      pattern: p.id,
      apg: p.apg === 'none' ? null : `https://www.w3.org/WAI/ARIA/apg/patterns/${p.apg}/`,
      surface: 'web',
      journey: 'composite-widget',
      ui_state: 'default',
      method: ['runtime-dom', 'ax-tree', 'component'],
      input_at: ['keyboard', 'sr-nvda', 'sr-voiceover-safari'],
      user_needs: p.needs,
      min_criteria: kind === 'broken' ? Object.fromEntries(p.sc.map((s) => [s, 1])) : {},
      must_not_report: kind === 'broken' ? [] : p.sc,
      expected_outcome: kind === 'broken' ? 'fail' : 'pass',
      notes: note,
    });
  }
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('pattern fixtures',
  `<p>Component patterns as matched pairs. The <strong>safe_</strong> half of each pair
   follows the <a href="https://www.w3.org/WAI/ARIA/apg/patterns/">ARIA Authoring Practices
   Guide</a> and must not be reported; flagging it is a false positive.</p>
   <ul>${PATTERNS.map((p) => `<li><a href="${p.id}.html">${p.id} — broken</a> ·
     <a href="safe_${p.id}.html">APG-correct</a> — ${p.sc.join(', ')}</li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'patterns.json'), JSON.stringify({
  description: 'APG component patterns as correct/broken pairs. Custom widgets are where '
    + 'scanners are weakest and products actually break. The correct half is load-bearing: '
    + 'any scanner can flag everything, only an accurate one leaves APG-conformant markup alone.',
  source: 'https://www.w3.org/WAI/ARIA/apg/patterns/',
  generated: new Date().toISOString().slice(0, 10),
  counts: { patterns: PATTERNS.length, cases: cases.length,
    tp: cases.filter((c) => c.mode === 'tp').length, safe: cases.filter((c) => c.mode === 'safe').length },
  cases,
}, null, 2) + '\n');

console.log(`${PATTERNS.length} patterns → ${cases.length} cases (${cases.filter((c) => c.mode === 'tp').length} broken, ${cases.filter((c) => c.mode === 'safe').length} APG-correct)`);
const scs = [...new Set(PATTERNS.flatMap((p) => p.sc))].sort();
console.log(`criteria touched: ${scs.join(' ')}`);
const needs = [...new Set(PATTERNS.flatMap((p) => p.needs))].sort();
console.log(`user needs touched: ${needs.length} — ${needs.join(' ')}`);
