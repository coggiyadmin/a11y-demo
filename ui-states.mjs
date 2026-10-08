// UI states.
//
// Most corpora test only the default state, which is where the easy defects are and
// the hard ones are not. A form that is perfectly labelled when blank can still lose
// focus on submit, announce nothing when validation fails, and leave a screen-reader
// user with no idea the page changed.
//
// So this family holds ONE journey constant — a seat-selection form — and varies only
// the state it is in. Any difference in what a scanner reports is attributable to the
// state, not to different content.
//
// These are also the states a crawler rarely reaches on a real site: you cannot get to
// `timed-out` or `permission-denied` by following links.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'ui-states');

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

const FIELD = (extra = '') => `<label for="seat">Seat preference</label>
<input id="seat" name="seat" ${extra}>`;

const STATES = [
  {
    id: 'loading', sc: ['4.1.3'],
    brokenNote: 'A spinner replaces the form with no busy state and no announcement, so a '
      + 'screen-reader user hears nothing and finds the controls simply gone.',
    broken: `<div><div class="card">Loading…</div></div>`,
    correctNote: 'aria-busy on the region and a polite status message, so the wait is announced.',
    correct: `<div aria-busy="true" aria-describedby="ld">
  <p id="ld" role="status" aria-live="polite">Loading seat options…</p>
</div>`,
  },
  {
    id: 'empty', sc: ['1.3.1', '3.3.2'],
    brokenNote: 'An empty result area with nothing in it at all. Visually it reads as blank; '
      + 'to a screen reader there is nothing to read, and no indication whether it is loading, '
      + 'broken, or genuinely empty.',
    broken: `<form>${FIELD()}<div id="results"></div></form>`,
    correctNote: 'The empty state says it is empty, says why, and says what to do next.',
    correct: `<form>${FIELD()}
<div id="results" role="status" aria-live="polite">
  <h2>No seats match</h2>
  <p>No window seats are available on this flight. Try removing the window filter.</p>
</div></form>`,
  },
  {
    id: 'invalid', sc: ['3.3.1', '4.1.2'],
    brokenNote: 'Validation failed, but the field is not marked invalid, the message is not '
      + 'associated with it, and nothing was announced. The only cue is red text nearby.',
    broken: `<form>${FIELD('value="14Q"')}
<span style="color:#b00">Invalid</span><button type="button">Continue</button></form>`,
    correctNote: 'aria-invalid, aria-describedby to a message that says what to do, and an '
      + 'assertive announcement.',
    correct: `<form>${FIELD('value="14Q" aria-invalid="true" aria-describedby="err"')}
<p id="err" role="alert">Seat 14Q does not exist on this aircraft. Enter a row from 1 to 32
and a letter from A to F.</p>
<button type="submit">Continue</button></form>`,
  },
  {
    id: 'corrected', sc: ['4.1.3'],
    brokenNote: 'The user fixed the error, but aria-invalid is still true and the stale error '
      + 'message is still associated with the field — so the field keeps announcing itself as '
      + 'invalid after it is valid.',
    broken: `<form>${FIELD('value="14A" aria-invalid="true" aria-describedby="err2"')}
<p id="err2">Seat 14Q does not exist on this aircraft.</p></form>`,
    correctNote: 'Invalid state cleared, stale message removed, and the correction confirmed.',
    correct: `<form>${FIELD('value="14A" aria-invalid="false"')}
<p role="status" aria-live="polite">Seat 14A is available.</p></form>`,
  },
  {
    id: 'submitted', sc: ['4.1.3', '2.4.3'],
    brokenNote: 'Submission succeeded and the confirmation was written into the page, but '
      + 'focus stayed on the now-removed button and nothing was announced. A screen-reader '
      + 'user has no way to know it worked.',
    broken: `<div><p>Seat 14A confirmed.</p></div>`,
    correctNote: 'Confirmation in a live region AND a focusable heading that receives focus, '
      + 'so both announcement and focus position are handled.',
    correct: `<div role="status" aria-live="polite">
  <h2 tabindex="-1" id="done">Seat 14A confirmed</h2>
  <p>Your boarding pass has been updated.</p>
</div>
<script>document.getElementById('done').focus();</script>`,
  },
  {
    id: 'error', sc: ['3.3.1', '2.4.3'],
    brokenNote: 'A page-level failure rendered as a styled box. Not a landmark, not announced, '
      + 'focus left wherever it was, and no route to recovery.',
    broken: `<div style="border:2px solid #b00;padding:1rem">Something went wrong.</div>`,
    correctNote: 'An alert that is announced, focusable, names the problem and offers a way out.',
    correct: `<div role="alert" tabindex="-1" id="e">
  <h2>We could not save your seat</h2>
  <p>The booking service did not respond. Your card has not been charged.</p>
  <p><a href="#retry">Try again</a> or <a href="#help">contact support</a>.</p>
</div>
<script>document.getElementById('e').focus();</script>`,
  },
  {
    id: 'offline', sc: ['4.1.3', '3.3.1'],
    brokenNote: 'Connectivity dropped and the UI greyed itself out. The disabled appearance is '
      + 'purely visual — the controls are not actually disabled and nothing was announced.',
    broken: `<form style="opacity:.4">${FIELD()}<button type="button">Continue</button></form>`,
    correctNote: 'Status announced, controls genuinely disabled, and the reason given in text.',
    correct: `<p role="status" aria-live="polite">You are offline. Seat changes will be saved when
the connection returns.</p>
<form>${FIELD('disabled')}<button type="button" disabled>Continue</button></form>`,
  },
  {
    id: 'permission-denied', sc: ['3.3.1', '1.3.1'],
    brokenNote: 'Access refused with a bare code and no explanation of what is needed or who '
      + 'to ask. Hostile to everyone, and impossible to act on.',
    broken: `<div><p>403</p></div>`,
    correctNote: 'Says what happened, why, and what to do, as an announced alert.',
    correct: `<div role="alert">
  <h2>You do not have access to seat selection</h2>
  <p>Seat selection opens 24 hours before departure for this fare. You can add it from
     Manage Booking after check-in opens.</p>
</div>`,
  },
  {
    id: 'timed-out', sc: ['2.2.1', '4.1.3'],
    brokenNote: 'The session expired silently and the form was cleared. No warning beforehand, '
      + 'no way to extend, and the work is gone — which penalises anyone who needs longer, '
      + 'whether for motor, cognitive or situational reasons.',
    // 2.2.1 is about a time limit SET BY THE CONTENT. The fixture previously only
    // described an expiry in prose, so it exercised nothing — a meta refresh makes the
    // limit real and machine-detectable, which is what the criterion is about.
    // 3600s, not 20s. A short refresh would reload the page DURING a scan, making the
    // fixture pathological for the tools under test. 2.2.1 is failed by a timed reload
    // the user cannot turn off, adjust or extend at any duration under 20 hours, so a
    // long delay is just as much a failure and does not disrupt measurement.
    broken: `<meta http-equiv="refresh" content="3600">
<form>${FIELD('value=""')}</form>
<p style="color:#999">Session expired. This page reloads on a timer with no way to turn
   that off, extend it, or be warned first.</p>`,
    correctNote: 'Warned before expiry, offered an extension, and the entered value preserved.',
    correct: `<div role="alert">
  <h2>Your session is about to expire</h2>
  <p>You have 2 minutes left. Your seat choice has been kept.</p>
  <button type="button">Give me more time</button>
  <button type="button">Turn off the time limit</button>
</div>
<form>${FIELD('value="14A"')}</form>
<p>No meta refresh: the limit can be extended, turned off, and warns before it expires.</p>`,
  },
  {
    id: 'busy', sc: ['4.1.3'],
    brokenNote: 'The form is mid-submit. The button label changed to "Saving…" but nothing is '
      + 'marked busy, the button is still activatable, and repeat presses submit again.',
    broken: `<form>${FIELD('value="14A"')}<button type="button">Saving…</button></form>`,
    correctNote: 'aria-busy on the region, the control disabled while in flight, and progress '
      + 'announced politely.',
    correct: `<form aria-busy="true">${FIELD('value="14A"')}
<button type="submit" disabled aria-describedby="sv">Saving…</button>
<p id="sv" role="status" aria-live="polite">Saving your seat choice.</p></form>`,
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const cases = [];
for (const st of STATES) {
  for (const [kind, body, note] of [['broken', st.broken, st.brokenNote], ['correct', st.correct, st.correctNote]]) {
    const file = kind === 'broken' ? `${st.id}.html` : `safe_${st.id}.html`;
    const header = `<!--\n  Seat selection — ${st.id} (${kind})\n  WCAG: ${st.sc.join(', ')}\n  ${note}\n-->\n`;
    fs.writeFileSync(path.join(DIR, file),
      header + page(`Seat selection — ${st.id} (${kind})`, `<p>${note}</p><hr>${body}`));
    cases.push({
      id: `state-${kind === 'broken' ? st.id : 'safe_' + st.id}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `ui-states/${file}`,
      surface: 'web',
      // offline / permission-denied / timed-out / empty / error are the edge-state
      // journey, not the ordinary form lifecycle. Tagging them all form-lifecycle
      // overstated that journey and hid edge-states entirely.
      journey: ['empty', 'error', 'offline', 'permission-denied', 'timed-out']
        .includes(st.id) ? 'edge-states' : 'form-lifecycle',
      ui_state: st.id,
      method: ['runtime-dom', 'ax-tree', 'state-exploration', 'interaction'],
      input_at: ['keyboard', 'sr-nvda', 'sr-voiceover-safari'],
      min_criteria: kind === 'broken' ? Object.fromEntries(st.sc.map((s) => [s, 1])) : {},
      must_not_report: kind === 'correct' ? st.sc : [],
      expected_outcome: kind === 'broken' ? 'fail' : 'pass',
      notes: note,
    });
  }
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('UI state fixtures',
  `<p>One journey — choosing a seat — held constant across the states where accessibility
   actually breaks. Any difference in what a scanner reports is attributable to the
   <strong>state</strong>, not to different content.</p>
   <p>Several of these are states a crawler cannot reach by following links:
   <code>timed-out</code>, <code>permission-denied</code> and <code>offline</code> have to
   be driven. A corpus that only tests reachable pages never tests them at all.</p>
   <ul>${STATES.map((s) => `<li><a href="${s.id}.html">${s.id}</a> ·
     <a href="safe_${s.id}.html">corrected</a> — ${s.sc.join(', ')}</li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'ui-states.json'), JSON.stringify({
  description: 'One journey across many UI states. Holding the journey constant makes any '
    + 'difference attributable to the state. Includes states a crawler cannot reach by '
    + 'following links — timed-out, permission-denied, offline.',
  journey: 'form-lifecycle',
  generated: new Date().toISOString().slice(0, 10),
  counts: { states: STATES.length, cases: cases.length },
  cases,
}, null, 2) + '\n');

console.log(`${STATES.length} states → ${cases.length} cases`);
console.log(`states: ${STATES.map((s) => s.id).join(', ')}`);
