// Event-wiring matrix.
//
// `delivery.mjs` holds one defect constant and varies how the content reaches
// the browser. This does the same for how the behaviour is attached.
//
// Every case here carries the SAME defect:
//
//   2.1.1  a <div> acting as a button -- no tabindex, no role, no key handler
//   4.1.2  and therefore exposing no name, role or value to assistive software
//
// and varies only one thing: where the click handler lives. The div is really
// interactive in every case. A keyboard user is locked out of every case. The
// only difference is whether a scanner can SEE that it is interactive.
//
// This exists because a corpus that only ever writes `onclick="..."` is easier
// than the web. Measured against one product: the inline form was reported,
// and the same defect wired with addEventListener or through a delegated
// ancestor listener was reported by nothing. Every framework in common use
// attaches handlers the second way.
//
// The matched control for each case is a real <button> wired the same way, so
// a control that flags it has produced a false positive rather than found a
// second defect. Holding the wiring constant across the pair is the point: the
// pair isolates "div versus button", not "inline versus listener".
//
// What this cannot decide: whether an element is interactive at all. A <div>
// with no handler anywhere has no functionality, so 2.1.1 does not apply to it
// and reporting it would be a false positive. Only cases that really do
// something are shipped here.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'wiring');

const page = (title, body, script) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../fixture.css">
<style>
.control { display: inline-block; background: #0b4f8a; color: #fff;
  padding: 0.9em 1.6em; border-radius: 4px; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
${body}
<p id="state" role="status">Not yet activated.</p>
</main>
<p><a href="../index.html">Back to the index</a></p>
<script>
${script}
</script>
</body>
</html>`;

// The element under test, broken and corrected. Both are given the same
// wiring, so the pair varies only the element.
const BROKEN_ELEMENT = '<div class="control" id="target">Search flights</div>';
const CORRECT_ELEMENT = '<button class="control" type="button" id="target">Search flights</button>';

const activate = "function activate() { document.getElementById('state').textContent = 'Activated.'; }";

const WIRINGS = [
  {
    id: 'inline_attribute',
    title: 'handler in an inline attribute',
    note:
      'The handler is an HTML attribute, so it is visible to anything that reads the markup. '
      + 'This is the easy case, and the one a hand-written fixture usually reaches for.',
    // Rendered into the element rather than attached by script.
    attribute: ' onclick="activate()"',
    script: activate,
  },
  {
    id: 'element_listener',
    title: 'handler attached with addEventListener',
    note:
      'The same behaviour attached from script. Nothing in the markup says the element is '
      + 'interactive; a scanner must either read listeners from the browser or infer it.',
    script: `${activate}\ndocument.getElementById('target').addEventListener('click', activate);`,
  },
  {
    id: 'delegated_ancestor',
    title: 'handler delegated to an ancestor',
    note:
      'The listener sits on a container and dispatches on the event target. This is how every '
      + 'mainstream framework attaches behaviour, so it is the common case on the real web, and '
      + 'the element itself carries no listener at all.',
    marker: ' data-action="search"',
    script: `${activate}
document.getElementById('shell').addEventListener('click', function (event) {
  if (event.target.closest('[data-action="search"]')) activate();
});`,
    shell: true,
  },
  {
    id: 'pointer_only',
    title: 'handler bound to pointer events only',
    note:
      'Bound to pointerdown rather than click. A pointer user activates it; a keyboard user '
      + 'cannot, because no key press ever becomes a pointer event.',
    script: `${activate}\ndocument.getElementById('target').addEventListener('pointerdown', activate);`,
    // The one case where the wiring IS the defect rather than the way it is
    // attached, so the control cannot repeat it. A native button fires click
    // from Enter and Space and never fires pointerdown, so a button bound to
    // pointerdown is still keyboard-inoperable -- verified by driving it. The
    // control therefore binds click, and this pair varies the binding as well
    // as the element, which is the only honest correction available.
    controlScript: `${activate}\ndocument.getElementById('target').addEventListener('click', activate);`,
    controlNote:
      'Corrected by binding click rather than pointerdown, as well as using a real button. '
      + 'Unlike the other pairs this one varies the binding too, because a button bound only to '
      + 'pointerdown is still unreachable from the keyboard.',
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const cases = [];

for (const wiring of WIRINGS) {
  for (const kind of ['broken', 'correct']) {
    const element = kind === 'broken' ? BROKEN_ELEMENT : CORRECT_ELEMENT;
    const withExtras = element
      .replace('id="target"', `id="target"${wiring.marker ?? ''}`)
      .replace('>Search flights', `${wiring.attribute ?? ''}>Search flights`);
    const body = wiring.shell ? `<div id="shell">\n${withExtras}\n</div>` : withExtras;

    const file = kind === 'broken' ? `${wiring.id}.html` : `safe_${wiring.id}.html`;
    const header = `<!--\n  ${wiring.id} — ${kind}\n  constant defect: a div acting as a button, not keyboard operable\n`
      + `  varied: ${wiring.title}\n  ${wiring.note}\n-->\n`;

    fs.writeFileSync(
      path.join(DIR, file),
      header + page(
        `${wiring.title} — ${kind}`,
        `<p>${kind === 'correct' && wiring.controlNote ? wiring.controlNote : wiring.note}</p><hr>\n${body}`,
        kind === 'correct' && wiring.controlScript ? wiring.controlScript : wiring.script,
      ),
    );

    cases.push({
      id: `wiring-${kind === 'broken' ? wiring.id : `safe_${wiring.id}`}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `wiring/${file}`,
      surface: 'web',
      journey: 'form-lifecycle',
      ui_state: 'default',
      method: ['runtime-dom', 'ax-tree', 'interaction'],
      // The behaviour is attached by script in every case but the inline one,
      // and the inline one still ships a script that defines the function.
      state_dependency: 'script',
      input_at: ['keyboard', 'sr-nvda', 'switch'],
      user_needs: ['nonvisual-access', 'alternative-input', 'hands-free-switch', 'text-and-tactile'],
      min_criteria: kind === 'broken' ? { '2.1.1': 1, '4.1.2': 1 } : {},
      must_not_report: kind === 'correct' ? ['2.1.1', '4.1.2'] : [],
      expected_outcome: kind === 'broken' ? 'fail' : 'pass',
      wiring: wiring.id,
      notes: kind === 'broken'
        ? `A div acting as a button, ${wiring.title}. Keyboard users cannot reach or operate it.`
        : wiring.controlNote
          ? `Matched control. ${wiring.controlNote} A control that flags this is a false positive.`
          : `Matched control: a real button, ${wiring.title}. Same wiring as its defect, so the pair `
            + 'isolates the element and not the attachment. A control that flags this is a false positive.',
    });
  }
}

fs.writeFileSync(
  path.join(DIR, 'index.html'),
  page(
    'event-wiring fixtures',
    `<p>One constant defect — a div acting as a button, not keyboard operable — with the click
     handler attached four different ways. A scanner that reports the inline case and not the
     delegated one has a wiring coverage gap, not a rule bug, and this matrix says which.</p>
     <ul>${WIRINGS.map((w) => `<li><a href="${w.id}.html">${w.title}</a> ·
       <a href="safe_${w.id}.html">corrected control</a></li>`).join('\n')}</ul>`,
    '',
  ),
);

fs.writeFileSync(
  path.join(ROOT, 'wiring.json'),
  `${JSON.stringify(
    {
      description:
        'One constant defect — a div acting as a button with no tabindex, role or key handler — '
        + 'with the click handler attached four different ways. Holding the defect constant means a '
        + 'scanner that reports one wiring and not another has a coverage gap in how it detects '
        + 'interactivity, not a rule error.',
      boundary:
        'Every case here is genuinely interactive. A div with no handler anywhere has no '
        + 'functionality, so 2.1.1 does not apply to it and reporting it would be a false positive; '
        + 'no such case is shipped. Each control repeats its defect’s wiring so the pair isolates '
        + 'the element rather than the attachment.',
      generated: new Date().toISOString().slice(0, 10),
      counts: { wirings: WIRINGS.length, cases: cases.length },
      cases,
    },
    null,
    2,
  )}\n`,
);

console.log(`${WIRINGS.length} wirings -> ${cases.length} cases`);
for (const wiring of WIRINGS) console.log(`  ${wiring.id}`);
