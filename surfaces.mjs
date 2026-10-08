// Surfaces beyond a plain web page.
//
// Only the ones that are HONESTLY expressible as web content are here. PDF, native
// iOS/Android, desktop, office documents, kiosk, hardware and immersive surfaces are
// NOT: they need different artefact formats and different parsers, and a .html file
// pretending to be a PDF measures nothing. Those stay enumerated as gaps in
// taxonomy/surfaces.json rather than faked.
//
// What IS expressible:
//   email      HTML email — a real constraint set: no script, inline CSS, table layout
//   epub       EPUB content documents are XHTML; the package metadata is the a11y part
//   authoring  ATAG 2.0 — the tool's own UI AND the markup it generates
//   voice      conversational UI rendered as a transcript people read and operate
//   dataviz    covered in scenarios/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'surfaces');

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

const CASES = [
  {
    id: 'email_table_layout', surface: 'email', standard: 'WCAG 2.2',
    sc: ['1.3.1', '1.1.1'], needs: ['vision-blind', 'cognitive-language'],
    brokenNote: 'HTML email built on layout tables with no role="presentation", a spacer GIF '
      + 'with no alt, and the only call to action as an image with no text. Email clients '
      + 'strip CSS and block images by default, so an image-only CTA can be literally invisible.',
    broken: `<table border="0" cellpadding="0"><tr><td>
<img src="../pixel.png" width="1" height="1">
<img src="../pixel.png" alt="" width="120" height="30">
</td></tr></table>`,
    correctNote: 'Layout tables marked presentational, spacers declared decorative, and the '
      + 'call to action as real text that survives image blocking.',
    correct: `<table role="presentation" border="0" cellpadding="0"><tr><td>
<img src="../pixel.png" alt="" role="presentation" width="1" height="1">
<p><a href="#book">Confirm your seat</a></p>
</td></tr></table>`,
  },
  {
    id: 'email_contrast_darkmode', surface: 'email', standard: 'WCAG 2.2',
    sc: ['1.4.3', '1.4.1'], needs: ['vision-low', 'vision-contrast'],
    brokenNote: 'Text colour set but no background colour. In a client that applies a dark '
      + 'background the dark text becomes unreadable — a contrast failure that only exists '
      + 'in combination with the reading environment.',
    broken: `<div style="color:#333"><p>Your flight leaves at 08:40.</p></div>`,
    correctNote: 'Foreground and background both set, so the pair is under the author’s control.',
    correct: `<div style="color:#1a1a1a;background:#ffffff"><p>Your flight leaves at 08:40.</p></div>`,
  },
  {
    id: 'epub_no_metadata', surface: 'epub', standard: 'EPUB Accessibility 1.1',
    sc: ['1.3.1'], needs: ['vision-blind', 'cognitive-language'],
    brokenNote: 'An EPUB content document with no accessibility metadata in its package. '
      + 'Discoverability IS the requirement in EPUB Accessibility 1.1 — a reader cannot tell '
      + 'whether the book is usable before buying it. The package fragment is shown as text '
      + 'because that is where the defect lives.',
    broken: `<h2>package.opf</h2>
<pre><code>&lt;metadata&gt;
  &lt;dc:title&gt;Travel Guide&lt;/dc:title&gt;
&lt;/metadata&gt;</code></pre>
<h2>Content document</h2>
<p>Chapter 1</p><img src="../pixel.png">`,
    correctNote: 'schema.org accessibility metadata declared, and the content document carries '
      + 'real structure and alternatives.',
    correct: `<h2>package.opf</h2>
<pre><code>&lt;metadata&gt;
  &lt;dc:title&gt;Travel Guide&lt;/dc:title&gt;
  &lt;meta property="schema:accessMode"&gt;textual&lt;/meta&gt;
  &lt;meta property="schema:accessMode"&gt;visual&lt;/meta&gt;
  &lt;meta property="schema:accessibilityFeature"&gt;alternativeText&lt;/meta&gt;
  &lt;meta property="schema:accessibilityFeature"&gt;structuralNavigation&lt;/meta&gt;
  &lt;meta property="schema:accessibilitySummary"&gt;All images described; full navigation.&lt;/meta&gt;
&lt;/metadata&gt;</code></pre>
<h2>Content document</h2>
<h3>Chapter 1</h3><img src="../pixel.png" alt="Map of the old town, with the station marked.">`,
  },
  {
    id: 'authoring_generates_bad_markup', surface: 'authoring', standard: 'ATAG 2.0',
    sc: ['1.1.1', '1.3.1'], needs: ['vision-blind', 'cognitive-language'],
    brokenNote: 'An editor whose own toolbar is unreachable by keyboard AND whose output uses '
      + 'a styled div as a heading with an unlabelled image. ATAG 2.0 covers BOTH halves: the '
      + 'tool must be accessible (Part A) and must produce accessible content (Part B). Most '
      + 'checkers test only the rendered page and so never see Part B at all.',
    broken: `<div class="field"><div class="btn" onclick="void 0">B</div>
<div class="btn" onclick="void 0">Insert image</div></div>
<h2>Generated output</h2>
<pre><code>&lt;div style="font-size:24px;font-weight:bold"&gt;Baggage&lt;/div&gt;
&lt;img src="bag.png"&gt;</code></pre>`,
    correctNote: 'Keyboard-operable toolbar, and output that uses real headings and prompts '
      + 'the author for a text alternative at insert time.',
    correct: `<div role="toolbar" aria-label="Formatting">
<button type="button" aria-pressed="false">Bold</button>
<button type="button">Insert image</button></div>
<h2>Generated output</h2>
<pre><code>&lt;h2&gt;Baggage&lt;/h2&gt;
&lt;img src="bag.png" alt="A cabin bag in a size gauge"&gt;</code></pre>
<p>The editor requires a text alternative before an image can be inserted.</p>`,
  },
  {
    id: 'chatbot_transcript', surface: 'voice', standard: 'WCAG 2.2',
    sc: ['4.1.3', '1.3.1', '2.1.1'],
    needs: ['vision-blind', 'cognitive-memory', 'speech-unable'],
    brokenNote: 'A conversational interface where replies append silently, the quick-reply '
      + 'chips are divs, and there is no written record to scroll back through — so anything '
      + 'missed is simply gone. Voice-only interfaces fail people who cannot speak, so a text '
      + 'route is not an optional extra.',
    broken: `<div id="c1"><p>Bot: Where are you flying from?</p></div>
<div><div class="btn" onclick="void 0">London</div><div class="btn" onclick="void 0">Manchester</div></div>
<p>Say your answer or tap a chip.</p>`,
    correctNote: 'A log region announcing replies, native buttons for quick replies, a text '
      + 'input as an alternative to speech, and a persistent transcript.',
    correct: `<div id="c2" role="log" aria-live="polite" aria-label="Conversation">
<p><strong>Assistant:</strong> Where are you flying from?</p></div>
<button type="button">London</button> <button type="button">Manchester</button>
<form><label for="say">Or type your answer</label><input id="say">
<button type="submit">Send</button></form>
<p><a href="#transcript">Full transcript</a></p>`,
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const cases = [];
for (const c of CASES) {
  for (const [kind, body, note] of [['broken', c.broken, c.brokenNote], ['correct', c.correct, c.correctNote]]) {
    const file = kind === 'broken' ? `${c.id}.html` : `safe_${c.id}.html`;
    const header = `<!--\n  ${c.id} — ${kind}\n  surface: ${c.surface}\n  standard: ${c.standard}\n  WCAG: ${c.sc.join(', ')}\n  ${note}\n-->\n`;
    fs.writeFileSync(path.join(DIR, file), header + page(`${c.id} — ${kind}`, `<p>${note}</p><hr>${body}`));
    cases.push({
      id: `surface-${kind === 'broken' ? c.id : 'safe_' + c.id}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `surfaces/${file}`,
      surface: c.surface,
      standard: c.standard,
      journey: 'navigate',
      ui_state: 'default',
      method: ['static-source', 'runtime-dom', 'document-parse'],
      input_at: ['keyboard', 'sr-nvda'],
      user_needs: c.needs,
      min_criteria: kind === 'broken' ? Object.fromEntries(c.sc.map((s) => [s, 1])) : {},
      must_not_report: kind === 'correct' ? c.sc : [],
      expected_outcome: kind === 'broken' ? 'fail' : 'pass',
      notes: note,
    });
  }
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('surface fixtures',
  `<p>Surfaces beyond a plain web page, limited to the ones honestly expressible as web
   content: HTML email, EPUB package metadata, an authoring tool and its output
   (ATAG 2.0), and a conversational interface.</p>
   <p><strong>Not here, deliberately:</strong> PDF, native iOS/Android, desktop, office
   documents, kiosk, hardware and immersive surfaces. Those need different artefact
   formats and different parsers; an HTML file pretending to be a PDF measures nothing.
   They stay enumerated as gaps in <code>taxonomy/surfaces.json</code>.</p>
   <ul>${CASES.map((c) => `<li><a href="${c.id}.html">${c.id}</a> ·
     <a href="safe_${c.id}.html">corrected</a> — <em>${c.surface}</em>, ${c.standard}</li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'surfaces.json'), JSON.stringify({
  description: 'Non-plain-web surfaces that are honestly expressible as web content. PDF, '
    + 'native, desktop, office documents, kiosk, hardware and immersive are deliberately '
    + 'absent rather than faked.',
  surfaces_covered: [...new Set(CASES.map((c) => c.surface))],
  surfaces_not_expressible: ['pdf', 'ios', 'android', 'desktop', 'word-processing',
    'presentation', 'spreadsheet', 'kiosk', 'hardware', 'immersive', 'support'],
  generated: new Date().toISOString().slice(0, 10),
  counts: { pairs: CASES.length, cases: cases.length },
  cases,
}, null, 2) + '\n');

console.log(`${CASES.length} pairs → ${cases.length} cases`);
console.log(`surfaces covered: ${[...new Set(CASES.map((c) => c.surface))].join(', ')}`);
console.log(`standards: ${[...new Set(CASES.map((c) => c.standard))].join(' · ')}`);
