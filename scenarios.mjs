// The remaining scenario types.
//
// Not everything is multi-page. `journeys/` covers tasks whose defect lives in the
// relationship between steps; this file covers the rest, each at its honest unit —
// a single rich page where the scenario IS a page property (theming, orientation,
// text spacing), a short flow where it is not.
//
// Naming note: sample content uses products, places and generic roles. It never
// labels groups of people, because these pages are public and most of them are
// deliberately broken.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'scenarios');

const page = (title, body, head = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../fixture.css">${head}
</head>
<body><main><h1>${title}</h1>
${body}
</main><p><a href="../index.html">Back to the index</a></p></body></html>`;

const S = [
  {
    // NOT 2.1.2. A keyboard trap is focus that cannot be moved AWAY from a component.
    // This page's defect is the opposite — focus never moves INTO the popover and the
    // background stays reachable behind it. That is focus management (2.4.3), and
    // claiming 2.1.2 made a correct pass look like a gap.
    id: 'overlay_focus_trap', journey: 'overlay', sc: ['2.4.3'],
    needsAt: ['keyboard'],
    brokenNote: 'A popover opens but focus stays behind it, and Tab cycles through the page '
      + 'underneath while the popover covers it. Nothing traps, nothing restores.',
    // Open at load. Previously hidden until clicked, which meant a scan that does not
    // interact found no focus cycle to observe and the fixture tested nothing.
    broken: `<button type="button" onclick="document.getElementById('po').hidden=false">Fare rules</button>
<div id="po" style="border:2px solid #30556e;padding:1rem">
  <p>Changes permitted for a fee.</p>
  <div class="btn" onclick="document.getElementById('po').hidden=true">Close</div>
</div>
<p><a href="#after">A link behind the popover</a></p>`,
    correctNote: 'Native dialog: focus moves in, the background is inert, Esc closes, and '
      + 'focus returns to the trigger.',
    correct: `<button type="button" onclick="document.getElementById('po2').showModal()">Fare rules</button>
<dialog id="po2" aria-labelledby="pt"><h2 id="pt">Fare rules</h2>
<p>Changes permitted for a fee.</p>
<form method="dialog"><button type="submit">Close</button></form></dialog>
<p><a href="#after">A link behind the dialog</a></p>`,
  },
  {
    id: 'async_validation', journey: 'async', sc: ['4.1.3', '3.3.1'],
    needsAt: ['keyboard', 'sr-nvda'],
    brokenNote: 'Validation runs after the field loses focus and writes the result into a '
      + 'plain div. Sighted users see it appear; nobody else learns it happened.',
    broken: `<label for="v1">Promo code</label><input id="v1" value="SUMMER">
<div id="r1">Checking…</div>`,
    correctNote: 'The result lands in a live region tied to the field.',
    correct: `<label for="v2">Promo code</label>
<input id="v2" value="SUMMER" aria-describedby="r2">
<p id="r2" role="status" aria-live="polite">Promo code SUMMER applied: GBP 10 off.</p>`,
  },
  {
    // 2.4.1 Bypass Blocks is about content repeated on MULTIPLE pages. A standalone
    // fixture has nothing to repeat, so the criterion does not apply here and the
    // control is right to abstain.
    id: 'infinite_scroll', journey: 'paging', sc: ['2.4.3', '4.1.3'],
    needsAt: ['keyboard', 'sr-nvda'],
    brokenNote: 'Results append on scroll with no announcement and no way to reach anything '
      + 'below the list — a keyboard user can never get past it to the footer.',
    broken: `<ul id="l1"><li>BA117</li><li>BA118</li></ul>
<div>Loading more as you scroll…</div>
<footer><a href="#terms">Terms</a></footer>`,
    correctNote: 'An explicit control to load more, the count announced, and the footer always '
      + 'reachable.',
    correct: `<ul id="l2"><li>BA117</li><li>BA118</li></ul>
<button type="button" aria-controls="l2">Show 10 more flights</button>
<p role="status" aria-live="polite">Showing 2 of 24 flights.</p>
<footer><a href="#terms">Terms</a></footer>`,
  },
  {
    id: 'data_dashboard', journey: 'data', sc: ['1.1.1', '1.3.1'],
    needsAt: ['keyboard', 'sr-nvda'], surface: 'dataviz',
    brokenNote: 'A chart as a bare SVG with no accessible name and no data equivalent. The '
      + 'numbers exist only as geometry.',
    broken: `<svg width="100%" viewBox="0 0 200 80"><rect x="10" y="30" width="30" height="50"/>
<rect x="50" y="10" width="30" height="70"/></svg>`,
    correctNote: 'Named, described, and backed by the same figures as a table.',
    correct: `<figure><figcaption id="cc">Seats sold by cabin</figcaption>
<svg width="100%" viewBox="0 0 200 80" role="img" aria-labelledby="cc" aria-describedby="ct">
<rect x="10" y="30" width="30" height="50"/><rect x="50" y="10" width="30" height="70"/></svg>
<table id="ct"><caption>Seats sold by cabin</caption>
<thead><tr><th scope="col">Cabin</th><th scope="col">Seats</th></tr></thead>
<tbody><tr><th scope="row">Economy</th><td>50</td></tr>
<tr><th scope="row">Business</th><td>70</td></tr></tbody></table></figure>`,
  },
  {
    id: 'meaningful_sequence', journey: 'navigate', sc: ['1.3.2'],
    needsAt: ['sr-nvda'],
    needs: ['nonvisual-access', 'text-and-tactile', 'memory-support', 'language-clarity'],
    brokenNote: 'CSS makes the itinerary look chronological, but the DOM is in a different '
      + 'order. A screen reader encounters boarding before check-in and security.',
    broken: `<style>.sequence{display:flex;flex-direction:column}.first{order:1}.second{order:2}.third{order:3}</style>
<ol class="sequence"><li class="third">3. Board at gate 14</li>
<li class="first">1. Check in online</li><li class="second">2. Pass security</li></ol>`,
    correctNote: 'The DOM and visual presentation use the same chronological sequence.',
    correct: `<ol><li>1. Check in online</li><li>2. Pass security</li>
<li>3. Board at gate 14</li></ol>`,
  },
  {
    id: 'live_chat', journey: 'realtime', sc: ['4.1.3', '1.3.1'],
    needsAt: ['sr-nvda', 'keyboard'],
    brokenNote: 'Incoming messages append to a div with no live region, so a screen-reader '
      + 'user never learns a reply arrived.',
    broken: `<div id="log1"><p>Agent: How can I help?</p></div>
<label for="m1">Message</label><input id="m1"><button type="button">Send</button>`,
    correctNote: 'role=log with polite announcement, and each message names its sender.',
    correct: `<div id="log2" role="log" aria-live="polite" aria-label="Conversation">
<p><strong>Agent:</strong> How can I help?</p></div>
<label for="m2">Message</label><input id="m2"><button type="submit">Send</button>`,
  },
  {
    // 1.4.4 Resize Text is about zoom and is not what this page breaks — the viewport
    // here is fine. The defect is 1.4.12 Text Spacing. Claiming both made the engine
    // look like it missed something it correctly passed.
    id: 'text_spacing', journey: 'display-adapt', sc: ['1.4.12'],
    needsAt: ['magnifier'], needs: ['reading-support', 'visual-clarity'],
    brokenNote: 'Fixed-height boxes with !important line-height. Applying the 1.4.12 text '
      + 'spacing overrides clips the content.',
    broken: `<style>.b{height:48px;overflow:hidden;line-height:1.1!important;letter-spacing:normal!important}</style>
<div class="b">Baggage allowance is one cabin bag plus one personal item per traveller.</div>`,
    correctNote: 'No fixed height, no !important on spacing, so user overrides reflow instead '
      + 'of clipping.',
    correct: `<style>.g{min-height:3rem}</style>
<div class="g">Baggage allowance is one cabin bag plus one personal item per traveller.</div>`,
  },
  {
    id: 'forced_colors', journey: 'theming', sc: ['1.4.1', '1.4.11'],
    needsAt: ['forced-colors'], needs: ['contrast-adaptation', 'visual-clarity'],
    brokenNote: 'State shown with a background image and a hard-coded colour, both discarded '
      + 'in forced-colors mode — so the selected item becomes indistinguishable.',
    broken: `<style>.sel{background:#30556e;color:#fff}
@media (forced-colors: active){.sel{background:#30556e}}</style>
<ul><li class="sel">Economy</li><li>Business</li></ul>`,
    correctNote: 'Uses system colours and a non-colour cue, so the state survives forced colours.',
    correct: `<style>.sel2{border:3px solid}
@media (forced-colors: active){.sel2{border-color:Highlight;forced-color-adjust:none;color:HighlightText;background:Highlight}}</style>
<ul><li class="sel2"><span aria-hidden="true">✓ </span>Economy <span class="sr">(selected)</span></li>
<li>Business</li></ul>`,
  },
  {
    id: 'orientation_lock', journey: 'orientation', sc: ['1.3.4', '1.4.10'],
    needsAt: ['touch'], needs: ['alternative-input', 'hands-free-switch'],
    brokenNote: 'Content locked to landscape. Someone whose device is fixed to a wheelchair '
      + 'mount in portrait cannot rotate it.',
    broken: `<style>@media (orientation: portrait){main{display:none}
body::after{content:"Please rotate your device"}}</style>
<p>Seat map.</p>`,
    correctNote: 'Works in both orientations and reflows to narrow widths.',
    correct: `<style>main{max-width:100%}</style>
<p>Seat map, usable in portrait and landscape.</p>`,
  },
  {
    // The page DOES declare lang="en", so 3.1.1 Language of Page is satisfied and the
    // engine is right to pass it. The defect is 3.1.2 Language of Parts: the Arabic
    // passage carries no lang of its own.
    id: 'rtl_mixed_language', journey: 'i18n', sc: ['3.1.2'],
    needsAt: ['sr-nvda'], needs: ['nonvisual-access', 'language-clarity'],
    brokenNote: 'A passage in another language with no lang attribute and no dir, so a screen '
      + 'reader pronounces it with the wrong voice and it renders in the wrong direction.',
    broken: `<p>Your gate is <span>البوابة ١٤</span> — please proceed.</p>`,
    correctNote: 'lang and dir on the passage, so pronunciation and direction are correct.',
    correct: `<p>Your gate is <span lang="ar" dir="rtl">البوابة ١٤</span> — please proceed.</p>`,
  },
  {
    id: 'label_in_name', journey: 'input-only', sc: ['2.5.3'],
    needsAt: ['voice-control'], needs: ['non-voice-alternative', 'alternative-input', 'nonvisual-access'],
    brokenNote: 'The visible label says "Search flights" but the accessible name is "Submit". '
      + 'A voice-control command such as "click Search flights" gets nothing — this is the '
      + 'defect voice control is uniquely blocked by.',
    broken: `<button type="button" aria-label="Submit">Search flights</button>`,
    correctNote: 'The accessible name contains the visible label.',
    correct: `<button type="button">Search flights</button>`,
  },
  {
    id: 'dragging_required', journey: 'transfer', sc: ['2.5.7', '2.5.1'],
    needsAt: ['keyboard', 'touch', 'switch'], needs: ['error-tolerant-pointer', 'hands-free-switch', 'constrained-use'],
    brokenNote: 'Reordering requires a drag. No single-pointer alternative, so it is impossible '
      + 'with a switch, difficult with reduced pointer precision, and difficult one-handed.',
    broken: `<ul><li draggable="true">Outbound</li><li draggable="true">Return</li></ul>
<p>Drag to reorder.</p>`,
    correctNote: 'Buttons provide the same reordering without any dragging.',
    correct: `<ul><li>Outbound <button type="button" aria-label="Move Outbound down">Down</button></li>
<li>Return <button type="button" aria-label="Move Return up">Up</button></li></ul>
<p>Drag to reorder, or use the buttons.</p>`,
  },
  {
    id: 'touch_targets', journey: 'input-only', sc: ['2.5.8', '2.5.5'],
    needsAt: ['touch', 'pointer'], needs: ['error-tolerant-pointer', 'forgiving-interface', 'constrained-use'],
    brokenNote: 'Icon controls 16px square and touching, well under the 24px minimum with no '
      + 'spacing exception.',
    // min-width/min-height MUST be reset here. fixture.css sets both to 24px so the
    // scaffolding never generates its own target-size defect — and min-* beats width,
    // so without this reset the fixture rendered at 24x24 and had no defect at all.
    // Measured: the engine was correctly passing it.
    broken: `<style>.ic{display:inline-block;width:16px;height:16px;min-width:0;min-height:0;padding:0;margin:0;background:#30556e}</style>
<a href="#a" class="ic" aria-label="Seat map"></a><a href="#b" class="ic" aria-label="Baggage"></a>`,
    correctNote: 'At least 24x24 with spacing between targets.',
    correct: `<style>.ic2{display:inline-block;width:24px;height:24px;margin:4px;background:#30556e}</style>
<a href="#a" class="ic2" aria-label="Seat map"></a><a href="#b" class="ic2" aria-label="Baggage"></a>`,
  },
  {
    id: 'pointer_cancellation', journey: 'destructive', sc: ['2.5.2'],
    needsAt: ['pointer', 'touch'],
    needs: ['error-tolerant-pointer', 'alternative-input', 'forgiving-interface', 'constrained-use'],
    brokenNote: 'The destructive action fires on pointer-down. Moving away before release '
      + 'cannot cancel an accidental press.',
    broken: `<p id="pointer-status">Booking BA117 is active.</p>
<button type="button" onpointerdown="document.getElementById('pointer-status').textContent='Booking BA117 cancelled.'">Cancel booking</button>`,
    correctNote: 'The action fires on click (after release on the same control), and an Undo '
      + 'control reverses an accidental activation.',
    correct: `<p id="pointer-status-safe">Booking BA117 is active.</p>
<button type="button" onclick="document.getElementById('pointer-status-safe').textContent='Booking BA117 cancelled.';document.getElementById('undo-cancel').hidden=false">Cancel booking</button>
<button id="undo-cancel" type="button" hidden onclick="document.getElementById('pointer-status-safe').textContent='Booking BA117 is active.';this.hidden=true">Undo cancellation</button>`,
  },
  {
    id: 'change_on_focus', journey: 'navigate', sc: ['3.2.1'],
    needsAt: ['keyboard', 'sr-nvda'],
    needs: ['focus-support', 'task-guidance', 'nonvisual-access', 'alternative-input'],
    brokenNote: 'Focusing the destination field immediately replaces the search panel with '
      + 'results. Keyboard and screen-reader users did not request the context change.',
    broken: `<section id="focus-search"><label for="focus-destination">Destination</label>
<input id="focus-destination" value="Paris" onfocus="document.getElementById('focus-search').hidden=true;document.getElementById('focus-results').hidden=false"></section>
<section id="focus-results" hidden><h2>Flights to Paris</h2><p>12 results</p></section>`,
    correctNote: 'Focus only enters the field; an explicit button applies the search and '
      + 'changes the context.',
    correct: `<label for="focus-destination-safe">Destination</label>
<input id="focus-destination-safe" value="Paris">
<button type="button" onclick="document.getElementById('focus-results-safe').hidden=false">Search flights</button>
<section id="focus-results-safe" hidden><h2>Flights to Paris</h2><p>12 results</p></section>`,
  },
  {
    id: 'change_on_input', journey: 'form-lifecycle', sc: ['3.2.2'],
    needsAt: ['keyboard', 'sr-nvda'],
    needs: ['focus-support', 'task-guidance', 'nonvisual-access', 'alternative-input'],
    brokenNote: 'Choosing a destination immediately replaces the form with the next step, '
      + 'without warning or an explicit commit action.',
    broken: `<section id="input-step-one"><label for="input-destination">Destination</label>
<select id="input-destination" onchange="document.getElementById('input-step-one').hidden=true;document.getElementById('input-step-two').hidden=false">
<option value="">Choose</option><option>Paris</option><option>Rome</option></select></section>
<section id="input-step-two" hidden><h2>Choose dates</h2></section>`,
    correctNote: 'Changing the value does not change context; an Apply button advances the '
      + 'form when the user is ready.',
    correct: `<label for="input-destination-safe">Destination</label>
<select id="input-destination-safe"><option value="">Choose</option><option>Paris</option><option>Rome</option></select>
<button type="button" onclick="document.getElementById('input-step-two-safe').hidden=false">Apply destination</button>
<section id="input-step-two-safe" hidden><h2>Choose dates</h2></section>`,
  },
  {
    id: 'error_suggestion', journey: 'form-lifecycle', uiState: 'invalid', sc: ['3.3.3'],
    needsAt: ['keyboard', 'sr-nvda'],
    needs: ['language-clarity', 'task-guidance', 'memory-support', 'nonvisual-access'],
    brokenNote: 'The error is identified and associated with the field, but gives no known '
      + 'correction format or example.',
    broken: `<label for="travel-date">Travel date</label>
<input id="travel-date" value="31-31-2026" aria-invalid="true" aria-describedby="travel-date-error">
<p id="travel-date-error" role="alert">Date is invalid.</p>`,
    correctNote: 'The associated error explains the required format and gives a valid example.',
    correct: `<label for="travel-date-safe">Travel date</label>
<input id="travel-date-safe" value="31-31-2026" aria-invalid="true" aria-describedby="travel-date-error-safe">
<p id="travel-date-error-safe" role="alert">Use DD/MM/YYYY, for example 31/12/2026.</p>`,
  },
  {
    id: 'disabled_state', journey: 'form-lifecycle', uiState: 'disabled', sc: ['4.1.2', '1.4.1'],
    needsAt: ['keyboard', 'sr-nvda'],
    brokenNote: 'A control that looks unavailable but is not marked disabled, so it is still '
      + 'focusable and activatable and its state is conveyed by colour alone.',
    broken: `<style>.off{background:#eee;color:#aaa}</style>
<button type="button" class="off" onclick="void 0">Select seat</button>`,
    correctNote: 'Genuinely disabled, with the reason available in text.',
    correct: `<button type="button" disabled aria-describedby="dz">Select seat</button>
<p id="dz">Seat selection opens 24 hours before departure.</p>`,
  },
  {
    id: 'motion_actuation', journey: 'input-only', sc: ['2.5.4'],
    needsAt: ['touch'], needs: ['error-tolerant-pointer', 'hands-free-switch', 'constrained-use', 'environmental-resilience'],
    brokenNote: 'Shake-to-undo with no alternative. Impossible on a mounted device and difficult '
      + 'when precise device movement is unavailable.',
    broken: `<p>Shake your device to undo the last change.</p>`,
    correctNote: 'A control does the same thing, and the motion shortcut can be disabled.',
    correct: `<button type="button">Undo last change</button>
<p>You can also shake your device, or turn that off in Settings.</p>`,
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const cases = [];
for (const s of S) {
  for (const [kind, body, note] of [['broken', s.broken, s.brokenNote], ['correct', s.correct, s.correctNote]]) {
    const file = kind === 'broken' ? `${s.id}.html` : `safe_${s.id}.html`;
    const header = `<!--\n  ${s.id} — ${kind}\n  WCAG: ${s.sc.join(', ')}\n  journey: ${s.journey}\n`
      + `  input/AT most affected: ${s.needsAt.join(', ')}\n  ${note}\n-->\n`;
    fs.writeFileSync(path.join(DIR, file), header + page(`${s.id} — ${kind}`, `<p>${note}</p><hr>${body}`));
    cases.push({
      id: `scenario-${kind === 'broken' ? s.id : 'safe_' + s.id}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `scenarios/${file}`,
      surface: s.surface || 'web',
      journey: s.journey,
      ui_state: s.uiState || 'default',
      method: ['runtime-dom', 'ax-tree', 'visual', 'interaction'],
      input_at: s.needsAt,
      user_needs: s.needs || [],
      min_criteria: kind === 'broken' ? Object.fromEntries(s.sc.map((x) => [x, 1])) : {},
      must_not_report: kind === 'correct' ? s.sc : [],
      expected_outcome: kind === 'broken' ? 'fail' : 'pass',
      notes: note,
    });
  }
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('scenario fixtures',
  `<p>Scenario types that are not multi-page tasks. Each is at its honest unit: a page
   where the scenario is a page property, a short flow where it is not.</p>
   <ul>${S.map((s) => `<li><a href="${s.id}.html">${s.id}</a> ·
     <a href="safe_${s.id}.html">corrected</a> — ${s.sc.join(', ')} — <em>${s.journey}</em>,
     affects ${s.needsAt.join('/')}</li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'scenarios.json'), JSON.stringify({
  description: 'Remaining scenario types at their honest unit. Several target an input mode '
    + 'rather than a criterion family: label_in_name is the defect voice control is uniquely '
    + 'blocked by, dragging_required the one switch access is.',
  generated: new Date().toISOString().slice(0, 10),
  counts: { scenarios: S.length, cases: cases.length },
  cases,
}, null, 2) + '\n');

console.log(`${S.length} scenarios → ${cases.length} cases`);
console.log(`journeys: ${[...new Set(S.map((s) => s.journey))].join(', ')}`);
console.log(`input/AT: ${[...new Set(S.flatMap((s) => s.needsAt))].join(', ')}`);
console.log(`criteria: ${[...new Set(S.flatMap((s) => s.sc))].sort().join(' ')}`);
