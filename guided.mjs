// Guided manual review.
//
// Three of the fifteen validation methods cannot be automated at all — guided manual
// review, assistive-technology testing and user task testing. A fixture corpus cannot
// perform them. What it CAN do is carry the question, the fixture to ask it against,
// and a slot for the evidence, so the requirement is visible and trackable instead of
// silently missing from a coverage number.
//
// Every case here has expected_outcome `cannot-tell`. That is not a hedge: it is the
// correct automated result. A tool that returns `pass` on any of these is overclaiming,
// and a tool that returns `fail` is guessing. Both are worse than saying "a person
// must look".
//
// This family also makes the criteria with no automated ground truth visible. They
// stop being absent and start being open questions with an owner.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'guided');

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../fixture.css">
</head>
<body><main><h1>${title}</h1>
${body}
</main><p><a href="../index.html">Back to the index</a></p></body></html>`;

const CHECKS = [
  {
    id: 'caption_quality', sc: ['1.2.2'], method: 'guided-manual',
    needs: ['text-for-audio', 'adjustable-audio'],
    question: 'Do the captions convey the same information as the audio?',
    why: 'A tool can confirm a caption track exists and parses. It cannot judge accuracy, '
      + 'synchronisation, or whether speakers are identified.',
    how: ['Play the media with sound off and captions on.',
      'Check every speaker is identified when more than one person speaks.',
      'Check meaningful sound effects are described, not just dialogue.',
      'Check captions stay in sync and are readable at playback speed.'],
    evidence: 'Recording of playback with captions on, plus the caption file.',
    fixture: '../media/captions_present_but_poor.html',
  },
  {
    id: 'alt_text_appropriateness', sc: ['1.1.1'], method: 'guided-manual',
    needs: ['nonvisual-access', 'visual-clarity', 'language-clarity'],
    question: 'Does each text alternative serve the same purpose as the image?',
    why: 'A tool can detect a missing or empty alt. It cannot tell whether "image1.jpg" or '
      + '"a photo" conveys what the image is there to convey — the commonest real failure is '
      + 'alt text that is present and useless.',
    how: ['Read the page with images replaced by their alt text.',
      'Ask whether the page still makes sense and nothing is lost.',
      'Check decorative images are empty-alt, not described.',
      'Check complex images have a long description or data equivalent.'],
    evidence: 'The page with images disabled, and the alt text listed.',
    fixture: '../static/img_no_alt.html',
  },
  {
    id: 'reading_order', sc: ['1.3.2'], method: 'guided-manual',
    needs: ['nonvisual-access', 'text-and-tactile', 'task-guidance'],
    question: 'Does the DOM order match the meaningful reading order?',
    why: 'CSS can reorder content visually while the DOM stays unchanged. A tool sees a valid '
      + 'DOM and a valid layout; only a person can say the two tell different stories.',
    how: ['Disable CSS and read the page top to bottom.',
      'Compare that order with the visual order.',
      'Check any difference does not change meaning.'],
    evidence: 'Screenshot with CSS on and the unstyled DOM order side by side.',
    fixture: '../patterns/table.html',
  },
  {
    id: 'sensory_characteristics', sc: ['1.3.3'], method: 'guided-manual',
    needs: ['nonvisual-access', 'visual-clarity', 'color-independent', 'language-clarity'],
    question: 'Do instructions rely on shape, size, position, sound or colour alone?',
    why: 'Detecting the phrase "the button on the right" is possible; deciding whether it is '
      + 'the ONLY way to identify the control requires understanding the page.',
    how: ['Find every instruction referring to position, shape, size, colour or sound.',
      'Ask whether the thing referred to is also identified by name or label.'],
    evidence: 'The instruction text quoted, with the control it refers to.',
    fixture: '../color-independent/status_color_only.html',
  },
  {
    id: 'plain_language', sc: ['3.1.5'], method: 'guided-manual',
    needs: ['language-clarity', 'reading-support', 'memory-support'],
    question: 'Is the content understandable without specialist knowledge?',
    why: 'Readability formulas measure sentence and word length, not comprehensibility. A '
      + 'short sentence of jargon scores well and communicates nothing.',
    how: ['Identify the task the reader must complete.',
      'Check terms of art are explained at first use.',
      'Check a summary exists for anything long or procedural.'],
    evidence: 'The passage, plus a note on who was asked and what they understood.',
    fixture: '../ui-states/permission-denied.html',
  },
  {
    id: 'focus_order_meaning', sc: ['2.4.3'], method: 'guided-manual',
    needs: ['nonvisual-access', 'alternative-input', 'focus-support'],
    question: 'Does the focus order preserve meaning and operability?',
    why: 'A tool can record the tab sequence. Whether that sequence makes SENSE for the task '
      + 'is a judgement about the task, not the DOM.',
    how: ['Tab through the page from the top without using a mouse.',
      'Check the order matches how the task is meant to proceed.',
      'Check nothing receives focus that should not, and nothing is skipped.'],
    evidence: 'Numbered screenshots of each focus stop.',
    fixture: '../journeys/booking/broken/step1.html',
  },
  {
    id: 'at_screen_reader_task', sc: ['2.1.1', '4.1.2'], method: 'at-testing',
    needs: ['nonvisual-access', 'text-and-tactile'],
    question: 'Can a screen-reader user complete the task from start to finish?',
    why: 'This is the only check that answers the question the others approximate. It needs a '
      + 'real screen reader and a person who uses one; results do not transfer between '
      + 'pairings, so a pass with one is not a pass with another.',
    how: ['Pick a pairing — NVDA+Firefox, JAWS+Chrome, VoiceOver+Safari, TalkBack+Chrome.',
      'Complete the whole task using only the screen reader.',
      'Record where progress stalls, not only where a rule is broken.',
      'Repeat on a second pairing before concluding anything.'],
    evidence: 'Screen and audio recording, naming AT and browser versions.',
    fixture: '../journeys/booking/broken/index.html',
  },
  {
    id: 'ai_suggested_alt_review', sc: ['1.1.1'], method: 'ai-assisted',
    needs: ['nonvisual-access', 'visual-clarity', 'language-clarity'],
    question: 'Is the AI-suggested text alternative correct for THIS context?',
    why: 'A model can describe what is in an image. It cannot know why the image is on the '
      + 'page, which is what the alternative has to convey — the same photo needs different '
      + 'alt text in a news story and a checkout page. Suggestions are a starting point and '
      + 'must be verified; shipping them unreviewed replaces a missing alt with a confidently '
      + 'wrong one, which is harder to find.',
    how: ['Read the suggestion against the surrounding content, not the image alone.',
      'Ask what the reader would lose if the image vanished, and check the text supplies it.',
      'Reject descriptions of appearance where purpose is what matters.',
      'Mark decorative images empty rather than accepting a description.'],
    evidence: 'The suggestion, the accepted text, and who approved it.',
    fixture: '../static/img_no_alt.html',
  },
  {
    id: 'user_task_completion', sc: [], method: 'user-testing',
    needs: ['combined-access'],
    question: 'Can people with disabilities actually complete this task?',
    why: 'Conformance is not usability. A page can meet every criterion and still be '
      + 'unusable, and the only way to find that out is to watch people try. No corpus, '
      + 'and no tool, substitutes for this.',
    how: ['Recruit participants who use the relevant assistive technology daily.',
      'Set a real task, not a tour of the interface.',
      'Measure completion and time, and record where people give up.',
      'Pay participants for their expertise.'],
    evidence: 'Session recordings with consent, completion rates, and quotes.',
    fixture: '../journeys/checkout/broken/index.html',
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const cases = [];
for (const c of CHECKS) {
  const file = `${c.id}.html`;
  const header = `<!--\n  Guided check: ${c.question}\n  method: ${c.method}\n`
    + `  WCAG: ${c.sc.join(', ') || 'beyond conformance'}\n`
    + `  expected automated outcome: cannot-tell — a tool returning pass here is overclaiming\n-->\n`;
  fs.writeFileSync(path.join(DIR, file), header + page(c.question, `
<p><strong>Method:</strong> ${c.method} ·
   <strong>Criteria:</strong> ${c.sc.join(', ') || 'beyond conformance'} ·
   <strong>Automated outcome:</strong> <code>cannot-tell</code></p>

<h2>Why automation cannot decide this</h2>
<p>${c.why}</p>

<h2>How to check it</h2>
<ol>${c.how.map((h) => `<li>${h}</li>`).join('\n')}</ol>

<h2>Evidence to capture</h2>
<p>${c.evidence}</p>

<h2>Fixture to check against</h2>
<p><a href="${c.fixture}">${c.fixture.replace('../', '')}</a></p>

<h2>Result</h2>
<form>
  <fieldset><legend>Outcome</legend>
    <label><input type="radio" name="o" value="pass"> Pass</label>
    <label><input type="radio" name="o" value="fail"> Fail</label>
    <label><input type="radio" name="o" value="inapplicable"> Inapplicable</label>
    <label><input type="radio" name="o" value="cannot-tell"> Cannot tell</label>
  </fieldset>
  <label for="who">Checked by</label><input id="who">
  <label for="at">AT and browser versions, if applicable</label><input id="at">
  <label for="ev">Evidence location</label><input id="ev">
  <label for="nt">Notes</label><textarea id="nt" rows="4"></textarea>
</form>`));
  cases.push({
    id: `guided-${c.id}`,
    mode: 'guided',
    path: `guided/${file}`,
    surface: 'web',
    journey: 'sr-task',
    ui_state: 'default',
    method: [c.method],
    input_at: c.method === 'at-testing'
      ? ['sr-nvda', 'sr-jaws', 'sr-voiceover-safari', 'sr-talkback-chrome', 'sr-narrator-edge']
      : ['keyboard'],
    user_needs: c.needs,
    min_criteria: {},
    must_not_report: [],
    // the honest automated result; NOT a failure to record
    expected_outcome: 'cannot-tell',
    confidence: 'possible',
    requires_human: true,
    question: c.question,
    notes: c.why,
  });
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('guided checks',
  `<p>Questions a tool cannot answer, each with the fixture to ask it against and a slot
   for the evidence.</p>
   <p>Every one of these has an expected automated outcome of <code>cannot-tell</code>.
   That is the correct result, not a hedge: a tool returning <code>pass</code> here is
   overclaiming, and one returning <code>fail</code> is guessing.</p>
   <ul>${CHECKS.map((c) => `<li><a href="${c.id}.html">${c.question}</a> —
     <em>${c.method}</em>${c.sc.length ? `, ${c.sc.join(', ')}` : ', beyond conformance'}</li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'guided.json'), JSON.stringify({
  description: 'Guided manual, AT and user-testing checks. A corpus cannot perform these; it '
    + 'carries the question, the fixture and an evidence slot so the requirement is visible '
    + 'and trackable rather than silently missing from a coverage figure.',
  note: 'All cases expect cannot-tell. A scanner reporting pass on these is overclaiming.',
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    checks: CHECKS.length,
    by_method: CHECKS.reduce((a, c) => { a[c.method] = (a[c.method] || 0) + 1; return a; }, {}),
  },
  cases,
}, null, 2) + '\n');

console.log(`${CHECKS.length} guided checks`);
for (const [m, n] of Object.entries(CHECKS.reduce((a, c) => { a[c.method] = (a[c.method] || 0) + 1; return a; }, {})))
  console.log(`  ${m.padEnd(16)} ${n}`);
