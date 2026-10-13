// The twenty WCAG AAA criteria that had no ground truth at all.
//
// They were reported as a single undifferentiated gap, which conflated two very
// different things: criteria nobody has built a fixture for yet, and criteria no
// fixture can ever decide. This generator separates them.
//
// Every criterion is classified into one evidence lane, with the public source
// that justifies the classification. Criteria whose evidence is machine-readable
// or reachable by driving the page get a narrowly matched broken/corrected pair
// here. Criteria that need a human judgement get a guided check in guided.mjs
// instead -- never a fabricated automated assertion.
//
// A matched pair isolates ONE criterion. The corrected page differs from the
// broken one only in what that criterion requires, so a control that flags the
// corrected page has produced a false positive rather than found a second defect.
//
// Nothing here is a conformance claim. Covering all twenty AAA criteria would
// still say nothing about whether any real site conforms at AAA: these are
// single-purpose fixtures, not a sampled site, and AAA conformance is a
// whole-site judgement made under WCAG-EM.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'aaa');

const UNDERSTANDING = (slug) => `https://www.w3.org/WAI/WCAG22/Understanding/${slug}.html`;

const page = (title, body, { style = '', script = '', lang = 'en' } = {}) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../fixture.css">${style ? `\n<style>\n${style}\n</style>` : ''}
</head>
<body>
${body}
<p><a href="../index.html">Back to the index</a></p>${script ? `\n<script>\n${script}\n</script>` : ''}
</body>
</html>`;

// --- the classification -----------------------------------------------------
//
// lanes:
//   automated-static      decidable from the delivered markup or computed style
//   stateful-interaction  decidable only by driving the page into a state
//   guided-manual         needs a human judgement about meaning or adequacy
//
// `applicability` records criteria whose correct answer is often `inapplicable`
// rather than pass or fail, so a run that reports neither is not thereby wrong.

const CLASSIFICATION = [
  {
    sc: '1.2.6', name: 'Sign Language (Prerecorded)', lane: 'guided-manual',
    slug: 'sign-language-prerecorded', guided: 'sign_language_equivalence',
    applicability: 'inapplicable when there is no prerecorded audio in synchronised media',
    rationale: 'Detecting that a sign-language track exists is mechanical. Deciding whether the '
      + 'signing conveys the same information as the audio, in a language the audience reads, is '
      + 'a human judgement about two languages.',
  },
  {
    sc: '1.2.7', name: 'Extended Audio Description (Prerecorded)', lane: 'guided-manual',
    slug: 'extended-audio-description-prerecorded', guided: 'extended_audio_description',
    applicability: 'inapplicable when foreground audio pauses already allow full description',
    rationale: 'Whether the existing pauses are long enough to describe what matters depends on '
      + 'what the video shows and what a viewer would otherwise lose. No parser can weigh that.',
  },
  {
    sc: '1.2.9', name: 'Audio-only (Live)', lane: 'guided-manual',
    slug: 'audio-only-live', guided: 'live_audio_alternative',
    applicability: 'inapplicable when no live audio-only content is presented',
    rationale: 'The equivalent must be produced live and track the broadcast. A corpus can hold '
      + 'the question but cannot hold a live stream, and adequacy is judged by a person listening.',
  },
  {
    sc: '1.3.6', name: 'Identify Purpose', lane: 'automated-static',
    slug: 'identify-purpose', pair: 'identify_purpose',
    rationale: 'The criterion asks for programmatically determinable purpose on inputs, icons and '
      + 'regions. Autocomplete tokens, landmark roles and accessible names are all readable from '
      + 'the delivered markup.',
  },
  {
    sc: '1.4.7', name: 'Low or No Background Audio', lane: 'guided-manual',
    slug: 'low-or-no-background-audio', guided: 'background_audio_level',
    applicability: 'inapplicable to audio that is a musical performance, or where spoken content is incidental',
    rationale: 'The 20 dB separation is measurable in principle, but only from the rendered audio, '
      + 'and deciding which passages are foreground narration is a listening judgement. A markup '
      + 'corpus cannot assert it.',
  },
  {
    sc: '1.4.8', name: 'Visual Presentation', lane: 'automated-static',
    slug: 'visual-presentation', pair: 'visual_presentation',
    rationale: 'Line length, line spacing, paragraph spacing and full justification are computable '
      + 'from the cascade. The user-selectable colour requirement is a mechanism check, exercised '
      + 'here by whether the page forces its own colours.',
  },
  {
    sc: '2.2.3', name: 'No Timing', lane: 'stateful-interaction',
    slug: 'no-timing', pair: 'no_timing',
    applicability: 'inapplicable to real-time events and to time limits that are essential',
    rationale: 'A time limit is observable only by letting it run. Static markup cannot show that '
      + 'a timer exists, which is exactly why this needs a driven state rather than a parse.',
  },
  {
    sc: '2.2.5', name: 'Re-authenticating', lane: 'stateful-interaction',
    slug: 're-authenticating', pair: 're_authenticating',
    applicability: 'inapplicable where no authenticated session can expire mid-task',
    rationale: 'Whether data survives re-authentication is only answerable by expiring a session '
      + 'and continuing. It is a journey assertion, not a document assertion.',
  },
  {
    sc: '2.4.8', name: 'Location', lane: 'automated-static',
    slug: 'location', pair: 'location',
    rationale: 'A breadcrumb trail, a site map, or a current-page indication in navigation are all '
      + 'present or absent in the markup.',
  },
  {
    sc: '2.4.10', name: 'Section Headings', lane: 'automated-static',
    slug: 'section-headings', pair: 'section_headings',
    applicability: 'inapplicable to content that is not organised into sections',
    rationale: 'Whether sections are delimited by headings rather than by styling alone is '
      + 'structural and readable from the document.',
  },
  {
    sc: '2.4.12', name: 'Focus Not Obscured (Enhanced)', lane: 'stateful-interaction',
    slug: 'focus-not-obscured-enhanced', pair: 'focus_not_obscured_enhanced',
    rationale: 'Requires focusing each control and comparing its box against sticky overlays. '
      + 'Nothing about the static DOM reveals the occlusion.',
  },
  {
    sc: '2.4.13', name: 'Focus Appearance', lane: 'stateful-interaction',
    slug: 'focus-appearance', pair: 'focus_appearance',
    rationale: 'The indicator exists only in the focused state, and the check is about its area and '
      + 'contrast against adjacent colours. Both need the focused rendering.',
  },
  {
    sc: '2.5.6', name: 'Concurrent Input Mechanisms', lane: 'stateful-interaction',
    slug: 'concurrent-input-mechanisms', pair: 'concurrent_input',
    applicability: 'inapplicable where the restriction is essential or required by the platform',
    rationale: 'A page that disables one input modality once another is used looks correct until '
      + 'both are tried. Only driving it with two modalities exposes the restriction.',
  },
  {
    sc: '3.1.3', name: 'Unusual Words', lane: 'guided-manual',
    slug: 'unusual-words', guided: 'unusual_words',
    rationale: 'Deciding that a word is used in an unusual or restricted way, idiomatically or as '
      + 'jargon, is a judgement about the audience. A dictionary lookup cannot make it.',
  },
  {
    sc: '3.1.4', name: 'Abbreviations', lane: 'automated-static',
    slug: 'abbreviations', pair: 'abbreviations',
    rationale: 'Whether a mechanism exists for identifying an expansion -- an abbr element, an '
      + 'expansion on first use, or a linked glossary -- is readable from the markup. Whether a '
      + 'string IS an abbreviation is not, so the pair asserts only on the mechanism.',
  },
  {
    sc: '3.1.5', name: 'Reading Level', lane: 'guided-manual',
    slug: 'reading-level', guided: 'plain_language',
    rationale: 'Readability formulas measure word and sentence length. A short sentence of jargon '
      + 'scores well and communicates nothing, so a formula cannot stand in for the judgement.',
  },
  {
    sc: '3.1.6', name: 'Pronunciation', lane: 'guided-manual',
    slug: 'pronunciation', guided: 'pronunciation_ambiguity',
    applicability: 'inapplicable where no word is ambiguous without its pronunciation',
    rationale: 'The criterion applies only where meaning is ambiguous without pronunciation. '
      + 'Deciding that a heteronym is genuinely ambiguous in context is a reading judgement.',
  },
  {
    sc: '3.3.5', name: 'Help', lane: 'automated-static',
    slug: 'help', pair: 'help',
    rationale: 'Context-sensitive help, a help link in a consistent place, and contact details are '
      + 'present or absent. Whether the help is GOOD is not asserted here.',
  },
  {
    sc: '3.3.6', name: 'Error Prevention (All)', lane: 'stateful-interaction',
    slug: 'error-prevention-all', pair: 'error_prevention_all',
    rationale: 'Reversibility, checking and confirmation are properties of the submission flow. '
      + 'They are observable only by running the flow to its end.',
  },
  {
    sc: '3.3.9', name: 'Accessible Authentication (Enhanced)', lane: 'automated-static',
    slug: 'accessible-authentication-enhanced', pair: 'accessible_auth_enhanced',
    rationale: 'A recall-or-transcription test with no alternative -- copying distorted characters, '
      + 'reproducing selected letters of a memorised word, solving a puzzle -- plus blocked paste '
      + 'and suppressed autocomplete, is visible in the delivered form markup.',
  },
];

// --- the matched pairs ------------------------------------------------------

const back = '<p><a href="index.html">Back to the AAA index</a></p>';

const PAIRS = [
  {
    id: 'identify_purpose', sc: '1.3.6', journey: 'form-lifecycle', ui_state: 'default',
    input_at: ['keyboard', 'sr-nvda', 'voice-control'], method: ['static-source', 'ax-tree'],
    needs: ['memory-support', 'alternative-input', 'low-effort-interaction', 'language-clarity'],
    defect: 'Input purposes are not programmatically determinable and the icon controls have no '
      + 'accessible name, so no personalisation layer can relabel or re-icon them.',
    broken: page('Contact preferences', `<header><p>Example service</p></header>
<div>
  <a href="#account">&#9733;</a>
  <a href="#alerts">&#9993;</a>
</div>
<div>
  <h1>Contact preferences</h1>
  <form action="#" method="get">
    <label for="n">Full name</label><input id="n" name="n" type="text">
    <label for="e">Email</label><input id="e" name="e" type="text">
    <label for="t">Telephone</label><input id="t" name="t" type="text">
    <button type="submit">Save</button>
  </form>
</div>` + back),
    corrected: page('Contact preferences', `<header><p>Example service</p></header>
<nav aria-label="Account shortcuts">
  <a href="#account" aria-label="Account"><span aria-hidden="true">&#9733;</span></a>
  <a href="#alerts" aria-label="Alerts"><span aria-hidden="true">&#9993;</span></a>
</nav>
<main>
  <h1>Contact preferences</h1>
  <form action="#" method="get">
    <label for="n">Full name</label><input id="n" name="n" type="text" autocomplete="name">
    <label for="e">Email</label><input id="e" name="e" type="email" autocomplete="email">
    <label for="t">Telephone</label><input id="t" name="t" type="tel" autocomplete="tel">
    <button type="submit">Save</button>
  </form>
</main>` + back),
  },
  {
    id: 'visual_presentation', sc: '1.4.8', journey: 'display-adapt', ui_state: 'default',
    input_at: ['keyboard', 'magnifier'], method: ['visual', 'runtime-dom'],
    needs: ['visual-clarity', 'reading-support', 'language-clarity', 'forgiving-interface'],
    defect: 'Text is fully justified, lines run well past 80 characters, line spacing is below '
      + '1.5 within paragraphs, paragraph spacing is below 1.5 times line spacing, and the page '
      + 'forces its own foreground and background colours.',
    broken: page('Release notes', `<main>
<h1>Release notes</h1>
<p>Every paragraph below is set in a block wider than eighty characters, justified to both
margins, with line spacing under 1.5 and almost no space between paragraphs. The colours are
fixed by the page rather than left to the reader.</p>
<p>Justification opens rivers of white space that run down the block, and tight leading makes
it easy to lose your place when returning to the start of the next line. Both effects are
worse for readers who track lines slowly.</p>
</main>` + back, {
      style: `main { max-width: none; }
main p {
  text-align: justify;
  line-height: 1.1;
  margin-block-end: 0.2em;
  width: 120ch;
  color: #222;
  background: #fff;
}`,
    }),
    corrected: page('Release notes', `<main>
<h1>Release notes</h1>
<p>Every paragraph below is set in a block wider than eighty characters, justified to both
margins, with line spacing under 1.5 and almost no space between paragraphs. The colours are
fixed by the page rather than left to the reader.</p>
<p>Justification opens rivers of white space that run down the block, and tight leading makes
it easy to lose your place when returning to the start of the next line. Both effects are
worse for readers who track lines slowly.</p>
</main>` + back, {
      style: `main p {
  text-align: start;
  line-height: 1.6;
  margin-block-end: 2.4em;
  max-width: 70ch;
}`,
    }),
  },
  {
    id: 'location', sc: '2.4.8', journey: 'navigate', ui_state: 'default',
    input_at: ['keyboard', 'sr-nvda'], method: ['static-source', 'crawl'],
    needs: ['memory-support', 'task-guidance', 'nonvisual-access', 'language-clarity'],
    defect: 'A page three levels deep gives no breadcrumb, no site map and no indication of which '
      + 'navigation entry is the current page.',
    broken: page('Refund timescales', `<nav>
  <a href="#help">Help</a>
  <a href="#billing">Billing</a>
  <a href="#refunds">Refunds</a>
</nav>
<main>
  <h1>Refund timescales</h1>
  <p>Refunds are returned to the original payment method.</p>
</main>` + back),
    corrected: page('Refund timescales', `<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="#home">Home</a></li>
    <li><a href="#help">Help</a></li>
    <li><a href="#billing">Billing</a></li>
    <li><a href="#refunds" aria-current="page">Refund timescales</a></li>
  </ol>
</nav>
<nav aria-label="Help sections">
  <a href="#help">Help</a>
  <a href="#billing">Billing</a>
  <a href="#refunds" aria-current="page">Refunds</a>
</nav>
<main>
  <h1>Refund timescales</h1>
  <p>Refunds are returned to the original payment method.</p>
</main>` + back),
  },
  {
    id: 'section_headings', sc: '2.4.10', journey: 'navigate', ui_state: 'default',
    input_at: ['keyboard', 'sr-nvda'], method: ['static-source', 'ax-tree'],
    needs: ['nonvisual-access', 'memory-support', 'task-guidance', 'reading-support'],
    defect: 'Sections are delimited by bold styled text rather than headings, so no heading '
      + 'navigation reaches them.',
    broken: page('Tenancy guide', `<main>
<h1>Tenancy guide</h1>
<p class="fake-heading"><b>Before you move in</b></p>
<p>Check the inventory and photograph anything already damaged.</p>
<p class="fake-heading"><b>During the tenancy</b></p>
<p>Report repairs in writing and keep a copy.</p>
<p class="fake-heading"><b>Ending the tenancy</b></p>
<p>Give notice in the form your agreement requires.</p>
</main>` + back, { style: '.fake-heading { font-size: 1.3em; margin-block-start: 1.4em; }' }),
    corrected: page('Tenancy guide', `<main>
<h1>Tenancy guide</h1>
<section>
  <h2>Before you move in</h2>
  <p>Check the inventory and photograph anything already damaged.</p>
</section>
<section>
  <h2>During the tenancy</h2>
  <p>Report repairs in writing and keep a copy.</p>
</section>
<section>
  <h2>Ending the tenancy</h2>
  <p>Give notice in the form your agreement requires.</p>
</section>
</main>` + back),
  },
  {
    id: 'abbreviations', sc: '3.1.4', journey: 'navigate', ui_state: 'default',
    input_at: ['keyboard', 'sr-nvda'], method: ['static-source'],
    needs: ['language-clarity', 'reading-support', 'memory-support', 'nonvisual-access'],
    defect: 'Abbreviations are used throughout with no expansion on first use, no abbr element '
      + 'and no glossary, so no mechanism identifies the expanded form.',
    broken: page('Conformance summary', `<main>
<h1>Conformance summary</h1>
<p>The audit covered WCAG 2.2 at AA, checked ARIA usage against the APG, and recorded one
failure per SC. The PR is open against the WG repository.</p>
</main>` + back),
    corrected: page('Conformance summary', `<main>
<h1>Conformance summary</h1>
<p>The audit covered <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> 2.2 at AA,
checked <abbr title="Accessible Rich Internet Applications">ARIA</abbr> usage against the
<abbr title="ARIA Authoring Practices Guide">APG</abbr>, and recorded one failure per
<abbr title="Success Criterion">SC</abbr>. The
<abbr title="Pull Request">PR</abbr> is open against the
<abbr title="Working Group">WG</abbr> repository.</p>
<h2>Abbreviations used on this page</h2>
<dl>
  <dt>WCAG</dt><dd>Web Content Accessibility Guidelines</dd>
  <dt>ARIA</dt><dd>Accessible Rich Internet Applications</dd>
  <dt>APG</dt><dd>ARIA Authoring Practices Guide</dd>
  <dt>SC</dt><dd>Success Criterion</dd>
  <dt>PR</dt><dd>Pull Request</dd>
  <dt>WG</dt><dd>Working Group</dd>
</dl>
</main>` + back),
  },
  {
    id: 'help', sc: '3.3.5', journey: 'help', ui_state: 'default',
    input_at: ['keyboard', 'sr-nvda'], method: ['static-source'],
    needs: ['task-guidance', 'memory-support', 'language-clarity', 'forgiving-interface'],
    defect: 'A form asking for an unfamiliar reference number offers no context-sensitive help, '
      + 'no help link and no way to reach a person.',
    broken: page('Claim a refund', `<main>
<h1>Claim a refund</h1>
<form action="#" method="get">
  <label for="ref">Scheme reference</label>
  <input id="ref" name="ref" type="text">
  <button type="submit">Continue</button>
</form>
</main>` + back),
    corrected: page('Claim a refund', `<header>
  <nav aria-label="Support"><a href="#help">Help</a></nav>
</header>
<main>
<h1>Claim a refund</h1>
<form action="#" method="get">
  <label for="ref">Scheme reference</label>
  <input id="ref" name="ref" type="text" aria-describedby="ref-help">
  <p id="ref-help">Nine characters, printed at the top right of your statement, for example
  <samp>AB1234567</samp>. <a href="#ref-example">See an annotated statement</a>.</p>
  <button type="submit">Continue</button>
</form>
<h2 id="help">If you are stuck</h2>
<p>Email <a href="mailto:support@example.com">support@example.com</a> or call 0000 000 0000,
Monday to Friday.</p>
</main>` + back),
  },
  {
    id: 'accessible_auth_enhanced', sc: '3.3.9', journey: 'auth-challenge', ui_state: 'default',
    input_at: ['keyboard', 'sr-nvda', 'voice-control'], method: ['static-source'],
    needs: ['memory-support', 'task-guidance', 'alternative-input', 'non-voice-alternative'],
    defect: 'Sign-in requires transcribing distorted text and recalling selected characters of a '
      + 'memorised word. Both are recall-or-transcription tests, paste is blocked and autocomplete is '
      + 'suppressed, and no alternative is offered.',
    broken: page('Sign in', `<main>
<h1>Sign in</h1>
<form action="#" method="get">
  <label for="u">Username</label>
  <input id="u" name="u" type="text" autocomplete="off">

  <label for="p">Password</label>
  <input id="p" name="p" type="password" autocomplete="off" onpaste="return false">

  <label for="m">Enter the 2nd, 5th and 7th characters of your memorable word</label>
  <input id="m" name="m" type="text" autocomplete="off" onpaste="return false">

  <p>Type the characters shown in the image below.</p>
  <p><img src="../pixel.png" alt="Distorted characters"></p>
  <label for="c">Characters from the image</label>
  <input id="c" name="c" type="text" autocomplete="off">

  <button type="submit">Sign in</button>
</form>
</main>` + back),
    corrected: page('Sign in', `<main>
<h1>Sign in</h1>
<form action="#" method="get">
  <label for="u">Username</label>
  <input id="u" name="u" type="text" autocomplete="username">

  <label for="p">Password</label>
  <input id="p" name="p" type="password" autocomplete="current-password">

  <button type="submit">Sign in</button>
</form>
<h2>Other ways to sign in</h2>
<p>You can <a href="#email-link">have a sign-in link emailed to you</a> instead. Password
managers work on this form, and pasting is allowed.</p>
</main>` + back),
  },
  {
    id: 'no_timing', sc: '2.2.3', journey: 'session', ui_state: 'timed-out',
    input_at: ['keyboard', 'switch'], method: ['interaction', 'state-exploration'],
    needs: ['memory-support', 'low-effort-interaction', 'task-guidance', 'forgiving-interface'],
    defect: 'The form expires after a fixed interval and discards what was typed. The content is '
      + 'not a real-time event and the limit is not essential, so timing is not required at all.',
    broken: page('Report a problem', `<main>
<h1>Report a problem</h1>
<p id="clock" role="status">This form expires in 30 seconds.</p>
<form id="f" action="#" method="get">
  <label for="d">What went wrong?</label>
  <textarea id="d" name="d" rows="6"></textarea>
  <button type="submit">Send</button>
</form>
</main>` + back, {
      script: `// A time limit on content that is neither real-time nor essential.
var left = 30;
var clock = document.getElementById('clock');
var timer = setInterval(function () {
  left -= 1;
  clock.textContent = left > 0
    ? 'This form expires in ' + left + ' seconds.'
    : 'This form has expired. Your text was discarded.';
  if (left <= 0) {
    clearInterval(timer);
    document.getElementById('d').value = '';
    document.getElementById('f').querySelector('button').disabled = true;
  }
}, 1000);`,
    }),
    corrected: page('Report a problem', `<main>
<h1>Report a problem</h1>
<p role="status">There is no time limit on this form.</p>
<form id="f" action="#" method="get">
  <label for="d">What went wrong?</label>
  <textarea id="d" name="d" rows="6"></textarea>
  <button type="submit">Send</button>
</form>
</main>` + back),
  },
  {
    id: 're_authenticating', sc: '2.2.5', journey: 'session', ui_state: 'timed-out',
    input_at: ['keyboard', 'sr-nvda'], method: ['interaction', 'state-exploration'],
    needs: ['memory-support', 'task-guidance', 'low-effort-interaction', 'forgiving-interface'],
    defect: 'When the session expires mid-task, re-authenticating returns an empty form and the '
      + 'entered data is gone.',
    broken: page('Application, step 2 of 3', `<main>
<h1>Application, step 2 of 3</h1>
<form id="f" action="#" method="get">
  <label for="a">Previous address</label><input id="a" name="a" type="text">
  <label for="y">Years at that address</label><input id="y" name="y" type="text">
  <button type="button" id="expire">Simulate session expiry</button>
  <button type="submit">Continue</button>
</form>
<p id="state" role="status"></p>
</main>` + back, {
      script: `// Re-authentication discards the work in progress.
document.getElementById('expire').addEventListener('click', function () {
  document.getElementById('a').value = '';
  document.getElementById('y').value = '';
  document.getElementById('state').textContent =
    'Session expired. You have been signed back in. Please enter your details again.';
});`,
    }),
    corrected: page('Application, step 2 of 3', `<main>
<h1>Application, step 2 of 3</h1>
<form id="f" action="#" method="get">
  <label for="a">Previous address</label><input id="a" name="a" type="text">
  <label for="y">Years at that address</label><input id="y" name="y" type="text">
  <button type="button" id="expire">Simulate session expiry</button>
  <button type="submit">Continue</button>
</form>
<p id="state" role="status"></p>
</main>` + back, {
      script: `// Re-authentication preserves and restores the work in progress.
document.getElementById('expire').addEventListener('click', function () {
  var kept = {
    a: document.getElementById('a').value,
    y: document.getElementById('y').value
  };
  document.getElementById('a').value = kept.a;
  document.getElementById('y').value = kept.y;
  document.getElementById('state').textContent =
    'Session expired. You have been signed back in and your answers were kept.';
});`,
    }),
  },
  {
    id: 'focus_not_obscured_enhanced', sc: '2.4.12', journey: 'navigate', ui_state: 'default',
    input_at: ['keyboard', 'switch', 'magnifier'], method: ['interaction', 'visual'],
    needs: ['focus-support', 'visual-clarity', 'alternative-input', 'hands-free-switch'],
    defect: 'A sticky footer covers part of each control as it receives focus, so no part of the '
      + 'focused component is guaranteed visible.',
    broken: page('Settings', `<main>
<h1>Settings</h1>
${Array.from({ length: 12 }, (_, i) => `<p><button type="button">Option ${i + 1}</button></p>`).join('\n')}
</main>
<div class="sticky-footer">Sticky footer that overlaps the focused control</div>` + back, {
      style: `.sticky-footer {
  position: fixed;
  inset-block-end: 0;
  inset-inline: 0;
  padding: 1.4em;
  background: #1d3f72;
  color: #fff;
}
/* Nothing reserves room for the footer, so the focused control sits under it. */
main { padding-block-end: 0; }`,
    }),
    corrected: page('Settings', `<main>
<h1>Settings</h1>
${Array.from({ length: 12 }, (_, i) => `<p><button type="button">Option ${i + 1}</button></p>`).join('\n')}
</main>
<div class="sticky-footer">Sticky footer that never overlaps the focused control</div>` + back, {
      style: `.sticky-footer {
  position: fixed;
  inset-block-end: 0;
  inset-inline: 0;
  padding: 1.4em;
  background: #1d3f72;
  color: #fff;
}
/* Reserve the footer's height, and keep the scrolled-to control clear of it. */
main { padding-block-end: 6em; }
main button { scroll-margin-block-end: 7em; }`,
    }),
  },
  {
    id: 'focus_appearance', sc: '2.4.13', journey: 'navigate', ui_state: 'default',
    input_at: ['keyboard', 'switch', 'magnifier'], method: ['interaction', 'visual'],
    needs: ['focus-support', 'visual-clarity', 'contrast-adaptation', 'alternative-input'],
    defect: 'The focus indicator is a one-pixel dotted outline in a colour close to the page '
      + 'background, so it covers too little area and has too little contrast against the '
      + 'unfocused state.',
    broken: page('Newsletter', `<main>
<h1>Newsletter</h1>
<p><a href="#weekly">Weekly digest</a></p>
<p><button type="button">Subscribe</button></p>
<p><a href="#archive">Read the archive</a></p>
</main>` + back, {
      style: `a:focus, button:focus {
  outline: 1px dotted #c9cdd2;
  outline-offset: 0;
}`,
    }),
    corrected: page('Newsletter', `<main>
<h1>Newsletter</h1>
<p><a href="#weekly">Weekly digest</a></p>
<p><button type="button">Subscribe</button></p>
<p><a href="#archive">Read the archive</a></p>
</main>` + back, {
      style: `a:focus-visible, button:focus-visible {
  outline: 3px solid #0b4f8a;
  outline-offset: 2px;
}`,
    }),
  },
  {
    id: 'concurrent_input', sc: '2.5.6', journey: 'composite-widget', ui_state: 'default',
    input_at: ['keyboard', 'pointer', 'touch', 'switch'], method: ['interaction', 'state-exploration'],
    needs: ['alternative-input', 'hands-free-switch', 'error-tolerant-pointer', 'forgiving-interface'],
    defect: 'Once the control is used with a pointer the page switches to a pointer-only mode and '
      + 'removes the keyboard handler, so a person alternating between input mechanisms is locked '
      + 'out of one of them.',
    broken: page('Quantity', `<main>
<h1>Quantity</h1>
<p>Use the stepper with either a pointer or the keyboard.</p>
<p>
  <button type="button" id="dec">Decrease</button>
  <output id="n">1</output>
  <button type="button" id="inc">Increase</button>
</p>
<p id="mode" role="status">Input mode: any</p>
</main>` + back, {
      script: `// Using a pointer disables the keyboard path. The restriction is not essential.
var value = 1;
var out = document.getElementById('n');
var mode = document.getElementById('mode');
var pointerOnly = false;

function step(by) { value = Math.max(1, value + by); out.textContent = String(value); }

function onKey(event) {
  if (pointerOnly) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    step(event.target.id === 'inc' ? 1 : -1);
  }
}

['inc', 'dec'].forEach(function (id) {
  var el = document.getElementById(id);
  el.addEventListener('keydown', onKey);
  el.addEventListener('pointerdown', function () {
    pointerOnly = true;
    mode.textContent = 'Input mode: pointer only';
    step(id === 'inc' ? 1 : -1);
  });
});`,
    }),
    corrected: page('Quantity', `<main>
<h1>Quantity</h1>
<p>Use the stepper with either a pointer or the keyboard.</p>
<p>
  <button type="button" id="dec">Decrease</button>
  <output id="n">1</output>
  <button type="button" id="inc">Increase</button>
</p>
<p id="mode" role="status">Input mode: any</p>
</main>` + back, {
      script: `// Both mechanisms stay active at all times; neither disables the other.
var value = 1;
var out = document.getElementById('n');

function step(by) { value = Math.max(1, value + by); out.textContent = String(value); }

['inc', 'dec'].forEach(function (id) {
  // A native button already fires click for pointer, touch, keyboard and voice.
  document.getElementById(id).addEventListener('click', function () {
    step(id === 'inc' ? 1 : -1);
  });
});`,
    }),
  },
  {
    id: 'error_prevention_all', sc: '3.3.6', journey: 'high-stakes', ui_state: 'submitted',
    input_at: ['keyboard', 'sr-nvda'], method: ['interaction', 'state-exploration'],
    needs: ['memory-support', 'task-guidance', 'forgiving-interface', 'low-effort-interaction'],
    defect: 'The submission is final on the first press. It cannot be reversed, nothing is checked '
      + 'for errors, and there is no chance to review and confirm.',
    broken: page('Send payment', `<main>
<h1>Send payment</h1>
<form id="f" action="#" method="get">
  <label for="to">Pay to</label><input id="to" name="to" type="text">
  <label for="amt">Amount</label><input id="amt" name="amt" type="text">
  <button type="submit" id="send">Send now</button>
</form>
<p id="state" role="status"></p>
</main>` + back, {
      script: `// Final on first press: no review, no confirmation, no reversal.
document.getElementById('f').addEventListener('submit', function (event) {
  event.preventDefault();
  document.getElementById('state').textContent = 'Payment sent. This cannot be undone.';
  document.getElementById('send').disabled = true;
});`,
    }),
    corrected: page('Send payment', `<main>
<h1>Send payment</h1>
<form id="f" action="#" method="get">
  <label for="to">Pay to</label><input id="to" name="to" type="text">
  <label for="amt">Amount</label><input id="amt" name="amt" type="text">
  <button type="submit" id="send">Review payment</button>
</form>

<section id="review" hidden>
  <h2>Check your payment</h2>
  <p id="summary"></p>
  <button type="button" id="confirm">Confirm and send</button>
  <button type="button" id="back">Change details</button>
</section>

<p id="state" role="status"></p>
<p id="undo" hidden><button type="button" id="reverse">Cancel this payment</button></p>
</main>` + back, {
      script: `// Checked, then reviewed and confirmed, then reversible.
var form = document.getElementById('f');
var review = document.getElementById('review');
var state = document.getElementById('state');

form.addEventListener('submit', function (event) {
  event.preventDefault();
  var to = document.getElementById('to').value.trim();
  var amount = document.getElementById('amt').value.trim();

  if (!to || !/^[0-9]+(\\.[0-9]{2})?$/.test(amount)) {
    state.textContent = 'Check the payee and enter an amount such as 12.00.';
    return;
  }

  document.getElementById('summary').textContent = 'Pay ' + amount + ' to ' + to + '.';
  review.hidden = false;
  document.getElementById('confirm').focus();
});

document.getElementById('back').addEventListener('click', function () {
  review.hidden = true;
  document.getElementById('to').focus();
});

document.getElementById('confirm').addEventListener('click', function () {
  review.hidden = true;
  state.textContent = 'Payment sent. You can cancel it for the next 30 minutes.';
  document.getElementById('undo').hidden = false;
});

document.getElementById('reverse').addEventListener('click', function () {
  state.textContent = 'Payment cancelled. Nothing left your account.';
  document.getElementById('undo').hidden = true;
});`,
    }),
  },
];

// --- generate ---------------------------------------------------------------

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const byLane = CLASSIFICATION.reduce((totals, row) => {
  totals[row.lane] = (totals[row.lane] ?? 0) + 1;
  return totals;
}, {});

const classified = new Map(CLASSIFICATION.map((row) => [row.pair, row]));
const cases = [];

for (const pair of PAIRS) {
  const row = classified.get(pair.id);
  if (!row) throw new Error(`pair ${pair.id} has no classification entry`);

  const shared = {
    surface: 'web',
    journey: pair.journey,
    ui_state: pair.ui_state,
    input_at: pair.input_at,
    method: pair.method,
    user_needs: pair.needs,
    standard: ['wcag22'],
  };

  const header = (kind) => `<!--\n  WCAG ${row.sc} ${row.name} (AAA)\n  lane: ${row.lane}\n`
    + `  source: ${UNDERSTANDING(row.slug)}\n  this page: ${kind}\n`
    + (kind === 'broken' ? `  defect: ${pair.defect}\n` : '  differs from the broken page only in what this criterion requires\n')
    + '-->\n';

  fs.writeFileSync(path.join(DIR, `${pair.id}.html`), header('broken') + pair.broken);
  fs.writeFileSync(path.join(DIR, `safe_${pair.id}.html`), header('corrected control') + pair.corrected);

  cases.push({
    ...shared,
    id: `aaa-${pair.id}`,
    mode: 'tp',
    path: `aaa/${pair.id}.html`,
    min_criteria: { [row.sc]: 1 },
    must_not_report: [],
    expected_outcome: 'fail',
    lane: row.lane,
    notes: pair.defect,
  });

  cases.push({
    ...shared,
    id: `aaa-safe_${pair.id}`,
    mode: 'safe',
    path: `aaa/safe_${pair.id}.html`,
    min_criteria: {},
    must_not_report: [row.sc],
    expected_outcome: 'pass',
    lane: row.lane,
    notes: `Corrected control for ${pair.id}.html. A control that reports ${row.sc} here has `
      + 'produced a false positive.',
  });
}

const index = page('WCAG AAA fixtures', `<main>
<h1>WCAG AAA fixtures</h1>
<p>Matched broken and corrected pairs for the AAA criteria whose evidence is machine-readable
or reachable by driving the page. Criteria needing a human judgement are in
<a href="../guided/index.html">guided checks</a> instead.</p>
<p><strong>These are single-purpose fixtures, not a sampled site.</strong> Covering every AAA
criterion here would still say nothing about whether any real site conforms at AAA.</p>
<ul>
${PAIRS.map((pair) => {
  const row = classified.get(pair.id);
  return `  <li><a href="${pair.id}.html">${row.sc} ${row.name}</a> —
    <a href="safe_${pair.id}.html">corrected control</a> <em>(${row.lane})</em></li>`;
}).join('\n')}
</ul>
</main>`);
fs.writeFileSync(path.join(DIR, 'index.html'), index);

fs.writeFileSync(path.join(ROOT, 'aaa.json'), `${JSON.stringify({
  description: 'Matched broken/corrected pairs for the WCAG AAA criteria whose evidence is '
    + 'machine-readable or reachable by driving the page. Criteria requiring human judgement are '
    + 'carried as guided checks instead of fabricated automated assertions.',
  boundary: 'Single-purpose fixtures, not a sampled site. AAA coverage here is not an AAA '
    + 'conformance claim about any website; whole-site conformance is judged under WCAG-EM.',
  generated: new Date().toISOString().slice(0, 10),
  counts: { pairs: PAIRS.length, cases: cases.length },
  cases,
}, null, 2)}\n`);

fs.writeFileSync(path.join(ROOT, 'wcag/aaa-classification.json'), `${JSON.stringify({
  description: 'Reviewed evidence-lane classification for the twenty WCAG 2.2 AAA criteria that '
    + 'had no ground truth. Each entry records the lane, the public source for the requirement, '
    + 'and why the lane was chosen.',
  boundary: 'Classification and fixture coverage are not conformance. No count here supports a '
    + 'claim that a site conforms at AAA.',
  generated: new Date().toISOString().slice(0, 10),
  lanes: {
    'automated-static': 'decidable from the delivered markup or computed style',
    'stateful-interaction': 'decidable only by driving the page into a declared state',
    'guided-manual': 'needs a human judgement about meaning, equivalence or adequacy',
  },
  counts: { criteria: CLASSIFICATION.length, by_lane: byLane },
  criteria: CLASSIFICATION.map((row) => ({
    sc: row.sc,
    name: row.name,
    level: 'AAA',
    lane: row.lane,
    source: UNDERSTANDING(row.slug),
    evidence: row.pair ? `aaa/${row.pair}.html` : `guided/${row.guided}.html`,
    control: row.pair ? `aaa/safe_${row.pair}.html` : null,
    applicability: row.applicability ?? null,
    rationale: row.rationale,
  })),
}, null, 2)}\n`);

console.log(`${CLASSIFICATION.length} AAA criteria classified`);
for (const [lane, count] of Object.entries(byLane)) console.log(`  ${lane.padEnd(22)} ${count}`);
console.log(`${PAIRS.length} matched pairs -> ${cases.length} cases in aaa.json`);
