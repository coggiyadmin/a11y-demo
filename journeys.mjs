// Journeys: multi-page tasks.
//
// Some criteria cannot be tested on one page, by definition. 3.2.3 Consistent
// Navigation, 3.2.4 Consistent Identification, 3.2.6 Consistent Help and 3.3.7
// Redundant Entry are all statements about the relationship BETWEEN pages. A corpus
// of isolated pages cannot express them at all — not because the rule is hard, but
// because the unit of test is wrong.
//
// Each journey ships a broken and a correct variant of the SAME task, step for step,
// so a difference is attributable to the defect rather than to different content.
// Every step is individually clean apart from the journey-level defect: the point is
// that a page-by-page scan can report every page as fine while the task is unusable.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'journeys');

// Navigation block. `variant` lets the broken journey reorder it between steps,
// which is exactly what 3.2.3 prohibits.
const nav = (current, { reorder = false, renameHelp = false, helpLast = false } = {}) => {
  let items = [
    ['index.html', 'Home'], ['step1.html', 'Search'],
    ['step2.html', 'Details'], ['step3.html', 'Review'],
  ];
  if (reorder) items = [items[2], items[0], items[3], items[1]];
  const help = renameHelp ? 'Support' : 'Help';
  const links = items.map(([h, t]) =>
    h === current ? `<li><a href="${h}" aria-current="page">${t}</a></li>` : `<li><a href="${h}">${t}</a></li>`);
  const helpLink = `<li><a href="help.html">${help}</a></li>`;
  return `<nav aria-label="Steps"><ul>${helpLast ? links.join('') + helpLink : helpLink + links.join('')}</ul></nav>`;
};

const page = (title, body, { head = '', focusScript = '' } = {}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../../../fixture.css">${head}
</head>
<body>
${body}
</body>${focusScript ? `\n<script>${focusScript}</script>` : ''}
</html>`;

const shell = (title, navHtml, main) =>
  page(title, `<header>${navHtml}</header>\n<main id="main">\n<h1 tabindex="-1" id="h">${title}</h1>\n${main}\n</main>`);

// A step that moves focus to its heading after navigation — the correct behaviour
// when a route change replaces the main content.
const shellFocused = (title, navHtml, main) =>
  page(title, `<header>${navHtml}</header>\n<main id="main">\n<h1 tabindex="-1" id="h">${title}</h1>\n${main}\n</main>`,
    { focusScript: "document.getElementById('h').focus();" });

const JOURNEYS = [
  {
    id: 'booking',
    label: 'Book a seat',
    journey: 'high-stakes',
    sc: ['3.2.3', '3.3.4', '3.3.7', '2.4.3'],
    defect: 'Navigation order changes between steps, the email already given in step 1 is '
      + 'asked for again in step 2, there is no review before the booking is committed, and '
      + 'focus is never moved when the step changes.',
    fixed: 'Navigation keeps a consistent order, previously entered data is carried forward, '
      + 'a review step precedes submission, and focus moves to the step heading.',
    steps: {
      broken: [
        ['index.html', 'Book a seat', nav('index.html'),
          `<p>Choose a flight and seat.</p><p><a href="step1.html">Start</a></p>`],
        ['step1.html', 'Search', nav('step1.html', { reorder: true }),
          `<form action="step2.html"><label for="em">Email</label><input id="em" type="email" value="traveller@example.com">
<label for="fl">Flight</label><input id="fl" value="BA117">
<button type="submit">Continue</button></form>`],
        // 3.3.7: asks again for information already provided
        ['step2.html', 'Details', nav('step2.html'),
          `<form action="step3.html"><label for="em2">Email</label><input id="em2" type="email" placeholder="Enter your email again">
<label for="st">Seat</label><input id="st" value="14A">
<button type="submit">Continue</button></form>`],
        // 3.3.4: commits without review or confirmation
        ['step3.html', 'Review', nav('step3.html', { reorder: true }),
          `<p>Press Book to charge your card.</p><button type="button">Book</button>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
      correct: [
        ['index.html', 'Book a seat', nav('index.html'),
          `<p>Choose a flight and seat.</p><p><a href="step1.html">Start</a></p>`],
        ['step1.html', 'Search', nav('step1.html'),
          `<p>Step 1 of 3</p><form action="step2.html"><label for="em">Email</label><input id="em" type="email" value="traveller@example.com">
<label for="fl">Flight</label><input id="fl" value="BA117">
<button type="submit">Continue</button></form>`],
        ['step2.html', 'Details', nav('step2.html'),
          `<p>Step 2 of 3</p><form action="step3.html">
<p>Booking for <strong>traveller@example.com</strong>. <a href="step1.html">Change</a></p>
<label for="st">Seat</label><input id="st" value="14A">
<button type="submit">Continue</button></form>`],
        ['step3.html', 'Review', nav('step3.html'),
          `<p>Step 3 of 3</p><h2>Check your booking</h2>
<dl><dt>Flight</dt><dd>BA117</dd><dt>Seat</dt><dd>14A</dd><dt>Total</dt><dd>GBP 42.00</dd></dl>
<p><a href="step2.html">Change details</a></p>
<form action="done.html"><button type="submit">Confirm and pay GBP 42.00</button></form>`],
        ['done.html', 'Booked', nav('index.html'),
          `<div role="status"><p>Seat 14A confirmed on BA117.</p></div>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
    },
  },
  {
    id: 'signin',
    label: 'Sign in',
    journey: 'auth-challenge',
    sc: ['3.3.8', '3.3.1', '2.1.1'],
    defect: 'Authentication depends on a cognitive function test — transcribing distorted '
      + 'characters — and the password field blocks paste, which breaks password managers. '
      + 'Both are 3.3.8 failures and both hit memory, dyslexia and motor needs hardest.',
    fixed: 'No transcription puzzle, paste permitted, autocomplete tokens present so a '
      + 'password manager can fill the form, and an alternative sign-in route offered.',
    steps: {
      broken: [
        ['index.html', 'Sign in', nav('index.html'),
          `<form action="step1.html"><label for="u">Email</label><input id="u" type="email">
<label for="p">Password</label>
<input id="p" type="password" onpaste="return false" oncopy="return false">
<p>Type the characters you see: <span style="letter-spacing:.4em;font-style:italic">x7Qv2b</span></p>
<label for="c">Characters</label><input id="c">
<button type="submit">Sign in</button></form>`],
        ['step1.html', 'Verify', nav('step1.html'),
          `<p>Enter the 6-digit code from memory within 30 seconds.</p>
<label for="o">Code</label><input id="o" onpaste="return false">
<button type="button">Verify</button>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
      correct: [
        ['index.html', 'Sign in', nav('index.html'),
          `<form action="step1.html"><label for="u">Email</label>
<input id="u" type="email" autocomplete="username">
<label for="p">Password</label>
<input id="p" type="password" autocomplete="current-password">
<button type="submit">Sign in</button>
<p><a href="step1.html">Email me a sign-in link instead</a></p></form>`],
        ['step1.html', 'Verify', nav('step1.html'),
          `<form action="done.html"><label for="o">Verification code</label>
<input id="o" autocomplete="one-time-code" inputmode="numeric">
<p>The code stays valid for 10 minutes. You can paste it.</p>
<button type="submit">Verify</button></form>`],
        ['done.html', 'Signed in', nav('index.html'),
          `<div role="status"><p>You are signed in.</p></div>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
    },
  },
  {
    id: 'consistent-help',
    label: 'Consistent help',
    journey: 'help',
    sc: ['3.2.6', '3.2.3', '3.2.4'],
    defect: 'The help link is in a different position on every step and is labelled "Help" on '
      + 'one page and "Support" on another. Both are single-page-invisible: each page in '
      + 'isolation is fine, and the journey is still a 3.2.6 and 3.2.4 failure.',
    fixed: 'Help appears in the same relative order on every page, with the same label.',
    steps: {
      broken: [
        ['index.html', 'Start', nav('index.html'), `<p><a href="step1.html">Continue</a></p>`],
        ['step1.html', 'Search', nav('step1.html', { helpLast: true }), `<p><a href="step2.html">Continue</a></p>`],
        ['step2.html', 'Details', nav('step2.html', { renameHelp: true }), `<p><a href="step3.html">Continue</a></p>`],
        ['step3.html', 'Review', nav('step3.html', { helpLast: true, renameHelp: true }), `<p>Done.</p>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
      correct: [
        ['index.html', 'Start', nav('index.html'), `<p><a href="step1.html">Continue</a></p>`],
        ['step1.html', 'Search', nav('step1.html'), `<p><a href="step2.html">Continue</a></p>`],
        ['step2.html', 'Details', nav('step2.html'), `<p><a href="step3.html">Continue</a></p>`],
        ['step3.html', 'Review', nav('step3.html'), `<p>Done.</p>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
    },
  },
  {
    id: 'destructive',
    label: 'Cancel a booking',
    journey: 'destructive',
    sc: ['3.3.4', '4.1.3', '2.4.3'],
    defect: 'A cancel control that acts immediately, with no confirmation, no review of what '
      + 'is about to be lost, no announcement afterwards and no undo.',
    fixed: 'Confirmation step naming the consequence, announced result, and a reversal window.',
    steps: {
      broken: [
        ['index.html', 'Your bookings', nav('index.html'),
          `<p>BA117 — seat 14A</p><button type="button">Cancel booking</button>`],
        ['step1.html', 'Cancelled', nav('step1.html'), `<p>Cancelled.</p>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
      correct: [
        ['index.html', 'Your bookings', nav('index.html'),
          `<p>BA117 — seat 14A</p><p><a href="step1.html">Cancel booking</a></p>`],
        ['step1.html', 'Confirm cancellation', nav('step1.html'),
          `<h2>Cancel BA117?</h2>
<p>Your seat 14A will be released and GBP 42.00 refunded in 5 working days. This cannot be
   undone after 24 hours.</p>
<form action="step2.html"><button type="submit">Yes, cancel BA117</button></form>
<p><a href="index.html">Keep my booking</a></p>`],
        ['step2.html', 'Cancelled', nav('step2.html'),
          `<div role="status"><h2>BA117 cancelled</h2>
<p>GBP 42.00 will be refunded. <a href="index.html">Undo this cancellation</a> within 24 hours.</p></div>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
    },
  },
  {
    id: 'consent',
    label: 'Cookie consent',
    journey: 'consent',
    sc: ['2.1.1', '2.4.3', '1.3.1'],
    defect: 'A consent banner that covers the page, is not reachable by keyboard, does not '
      + 'receive focus, and whose "reject" option is a styled div while "accept" is a button.',
    fixed: 'A dialog that takes focus, offers reject and accept as equal native controls, and '
      + 'returns focus to the page when dismissed.',
    steps: {
      broken: [
        ['index.html', 'Start', nav('index.html'),
          `<div style="position:fixed;bottom:0;left:0;right:0;background:#1a1a1a;color:#fff;padding:1rem">
  <p>We use cookies.</p>
  <button type="button">Accept all</button>
  <div class="btn" onclick="void 0">Reject</div>
</div>
<p><a href="step1.html">Continue</a></p>`],
        ['step1.html', 'Search', nav('step1.html'), `<p>Results.</p>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
      correct: [
        ['index.html', 'Start', nav('index.html'),
          `<dialog id="c" aria-labelledby="ct" open>
  <h2 id="ct">Cookies</h2>
  <p>We use optional cookies to measure usage.</p>
  <form method="dialog">
    <button type="submit" value="reject">Reject optional cookies</button>
    <button type="submit" value="accept">Accept optional cookies</button>
  </form>
</dialog>
<p><a href="step1.html">Continue</a></p>`],
        ['step1.html', 'Search', nav('step1.html'), `<p>Results.</p>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
    },
  },
  {
    id: 'navigate',
    label: 'Find a page',
    journey: 'navigate',
    sc: ['2.4.5', '3.2.4', '2.4.1'],
    defect: 'Only one route to any page — no search, no sitemap, no breadcrumb — and the same '
      + 'destination is labelled differently in different places. No skip link, so every page '
      + 'starts with the full navigation.',
    fixed: 'Multiple ways to reach a page, consistent labelling for the same destination, and '
      + 'a skip link.',
    steps: {
      broken: [
        ['index.html', 'Start', nav('index.html'), `<p><a href="step1.html">Flights</a></p>`],
        ['step1.html', 'Search', nav('step1.html'), `<p><a href="step2.html">Air travel</a></p>`],
        ['step2.html', 'Details', nav('step2.html'), `<p><a href="step1.html">Journeys</a></p>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
      correct: [
        ['index.html', 'Start', nav('index.html'),
          `<p><a href="#main" class="skip">Skip to content</a></p>
<form role="search" action="step1.html"><label for="q">Search</label><input id="q" type="search">
<button type="submit">Search</button></form>
<nav aria-label="Breadcrumb"><ol><li><a href="index.html" aria-current="page">Home</a></li></ol></nav>
<p><a href="step1.html">Flights</a> · <a href="sitemap.html">Site map</a></p>`],
        ['step1.html', 'Search', nav('step1.html'),
          `<nav aria-label="Breadcrumb"><ol><li><a href="index.html">Home</a></li>
<li><a href="step1.html" aria-current="page">Flights</a></li></ol></nav>
<p><a href="step2.html">Flight details</a></p>`],
        ['step2.html', 'Details', nav('step2.html'),
          `<nav aria-label="Breadcrumb"><ol><li><a href="index.html">Home</a></li>
<li><a href="step1.html">Flights</a></li><li><a href="step2.html" aria-current="page">Details</a></li></ol></nav>
<p><a href="step1.html">Flights</a></p>`],
        ['sitemap.html', 'Site map', nav('index.html'),
          `<ul><li><a href="index.html">Home</a></li><li><a href="step1.html">Flights</a></li>
<li><a href="step2.html">Details</a></li><li><a href="help.html">Help</a></li></ul>`],
        ['help.html', 'Help', nav('help.html'), `<p>Contact support.</p>`],
      ],
    },
  },
];

fs.rmSync(DIR, { recursive: true, force: true });

const cases = [];
for (const j of JOURNEYS) {
  for (const variant of ['broken', 'correct']) {
    const dir = path.join(DIR, j.id, variant);
    fs.mkdirSync(dir, { recursive: true });
    const note = variant === 'broken' ? j.defect : j.fixed;
    for (const [file, title, navHtml, main] of j.steps[variant]) {
      const header = `<!--\n  ${j.label} — ${variant} — ${title}\n  WCAG: ${j.sc.join(', ')}\n`
        + `  JOURNEY-LEVEL: this page in isolation may be clean. The defect is in the\n`
        + `  relationship between steps.\n  ${note}\n-->\n`;
      const render = variant === 'correct' ? shellFocused : shell;
      fs.writeFileSync(path.join(dir, file), header + render(title, navHtml, main));
    }
    cases.push({
      id: `journey-${j.id}-${variant}`,
      mode: variant === 'broken' ? 'tp' : 'safe',
      path: `journeys/${j.id}/${variant}/index.html`,
      // a journey is a SET of pages; a scanner must follow it, not grade one page
      entry: `journeys/${j.id}/${variant}/index.html`,
      steps: j.steps[variant].map(([f]) => `journeys/${j.id}/${variant}/${f}`),
      surface: 'web',
      journey: j.journey,
      ui_state: 'default',
      method: ['crawl', 'interaction', 'state-exploration', 'runtime-dom'],
      input_at: ['keyboard', 'sr-nvda'],
      min_criteria: variant === 'broken' ? Object.fromEntries(j.sc.map((s) => [s, 1])) : {},
      must_not_report: variant === 'correct' ? j.sc : [],
      expected_outcome: variant === 'broken' ? 'fail' : 'pass',
      scope: 'multi-page',
      notes: note,
    });
  }
}

fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>journey fixtures</title><link rel="stylesheet" href="../fixture.css"></head>
<body><main><h1>journey fixtures</h1>
<p>Multi-page tasks. <strong>Some criteria here cannot be tested on a single page by
definition</strong> — 3.2.3 Consistent Navigation, 3.2.4 Consistent Identification,
3.2.6 Consistent Help and 3.3.7 Redundant Entry are all statements about the
relationship between pages.</p>
<p>Each step is individually clean apart from the journey-level defect. A page-by-page
scan can report every page as fine while the task is unusable.</p>
<ul>${JOURNEYS.map((j) => `<li><strong>${j.label}</strong> — ${j.sc.join(', ')}<br>
  <a href="${j.id}/broken/index.html">broken</a> ·
  <a href="${j.id}/correct/index.html">correct</a></li>`).join('\n')}</ul>
</main><p><a href="../index.html">Back to the index</a></p></body></html>`);

fs.writeFileSync(path.join(ROOT, 'journeys.json'), JSON.stringify({
  description: 'Multi-page task fixtures. Carries criteria that cannot be expressed on a '
    + 'single page: 3.2.3, 3.2.4, 3.2.6 and 3.3.7 are about the relationship between pages. '
    + 'Each case is a SET of pages with an entry point, not one page.',
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    journeys: JOURNEYS.length, cases: cases.length,
    pages: cases.reduce((n, c) => n + c.steps.length, 0),
  },
  cases,
}, null, 2) + '\n');

const scs = [...new Set(JOURNEYS.flatMap((j) => j.sc))].sort();
console.log(`${JOURNEYS.length} journeys → ${cases.length} cases, ${cases.reduce((n, c) => n + c.steps.length, 0)} pages`);
console.log(`journey types: ${[...new Set(JOURNEYS.map((j) => j.journey))].join(', ')}`);
console.log(`criteria: ${scs.join(' ')}`);
console.log(`of which single-page-impossible: 3.2.3, 3.2.4, 3.2.6, 3.3.7`);
