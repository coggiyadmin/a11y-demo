// Delivery matrix.
//
// Accessibility defects live in the rendered DOM, not in the server language: PHP,
// ASP and a static file all emit HTML, and the same bad markup is equally bad from
// any of them. What actually varies for a SCANNER is how the content reaches the
// browser — whether it exists before script runs, whether it sits inside another
// document, what the URL looks like, what the server says about it.
//
// So every case here carries the SAME two defects and varies only the delivery:
//
//   2.1.1  a <div> styled as a button, no tabindex, no role, no key handler
//   1.1.1  an <img> with no alt, no aria-label, no decorative declaration
//
// Holding the defect constant is the point. A scanner that reports both on
// `server_html` and neither on `shadow_dom_closed` has not found a rule bug — it
// has a delivery blind spot, and the matrix says exactly which one.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'delivery');

/** The constant payload. Every delivery must end up with this in the built DOM. */
const DEFECT = `<div class="btn" onclick="void 0">Search flights</div>
<img src="../pixel.png">`;

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
    file: 'server_html.html', title: 'Server-rendered HTML',
    axis: 'baseline',
    note: 'The control case. The defect is in the served bytes. Any scanner that cannot '
      + 'report this one has a rule problem, not a delivery problem — every other row in '
      + 'this matrix is only meaningful relative to it.',
    body: DEFECT,
  },
  {
    file: 'client_js.html', title: 'Injected by script on DOMContentLoaded',
    axis: 'client-rendered',
    note: 'Served bytes contain a shell. The defect exists only after script runs.',
    body: `<div id="root"><p>Loading…</p></div>`,
    head: `\n<script>addEventListener('DOMContentLoaded',()=>{document.getElementById('root').innerHTML=${JSON.stringify(DEFECT)}});</script>`,
  },
  {
    file: 'client_js_delayed.html', title: 'Injected 600ms after load',
    axis: 'client-rendered',
    note: 'Same as client_js but after a timer, past most "network idle" heuristics. '
      + 'Separates "does it run script" from "does it wait long enough".',
    body: `<div id="root"><p>Loading…</p></div>`,
    head: `\n<script>addEventListener('load',()=>{setTimeout(()=>{document.getElementById('root').innerHTML=${JSON.stringify(DEFECT)}},600)});</script>`,
  },
  {
    file: 'iframe_same_origin.html', title: 'Defect inside a same-origin iframe',
    axis: 'embedded',
    note: 'The host page is clean. The defect is in a child document on the same origin, '
      + 'which a scanner may or may not descend into. WCAG applies to what the user meets, '
      + 'and the user meets the iframe content.',
    body: `<iframe src="./_payload.html" title="Booking widget"></iframe>`,
  },
  {
    file: 'iframe_srcdoc.html', title: 'Defect in an iframe srcdoc',
    axis: 'embedded',
    note: 'Same as above but the child document is inline in the attribute, so it has no '
      + 'URL of its own and cannot be crawled as a page.',
    body: `<iframe title="Booking widget" srcdoc="${
      DEFECT.replace(/"/g, '&quot;').replace(/\n/g, ' ')}"></iframe>`,
  },
  {
    file: 'iframe_sandboxed.html', title: 'Defect in a sandboxed iframe',
    axis: 'embedded',
    note: 'sandbox="allow-same-origin" — scripted access to the child may be restricted '
      + 'depending on how the scanner reaches it.',
    body: `<iframe src="./_payload.html" title="Booking widget" sandbox="allow-same-origin"></iframe>`,
  },
  {
    file: 'iframe_nested.html', title: 'Defect two iframes deep',
    axis: 'embedded',
    note: 'Host → intermediate iframe → payload iframe. Tests whether descent is recursive '
      + 'or single-level.',
    body: `<iframe src="./_mid.html" title="Outer"></iframe>`,
  },
  {
    file: 'shadow_dom_open.html', title: 'Defect in an open shadow root',
    axis: 'shadow',
    note: 'Not in the light DOM, not in the served HTML, but present in the accessibility '
      + 'tree and reachable via element.shadowRoot.',
    body: `<div id="host"></div>`,
    head: `\n<script>addEventListener('DOMContentLoaded',()=>{document.getElementById('host').attachShadow({mode:'open'}).innerHTML=${JSON.stringify(DEFECT)}});</script>`,
  },
  {
    file: 'shadow_dom_closed.html', title: 'Defect in a closed shadow root',
    axis: 'shadow',
    note: 'As above, but mode:"closed" — element.shadowRoot returns null, so a DOM-walking '
      + 'scanner cannot see it. It is still in the accessibility tree and still affects users. '
      + 'The hardest row in the matrix, and a fair one: real design systems ship closed roots.',
    body: `<div id="host"></div>`,
    head: `\n<script>addEventListener('DOMContentLoaded',()=>{document.getElementById('host').attachShadow({mode:'closed'}).innerHTML=${JSON.stringify(DEFECT)}});</script>`,
  },
  {
    file: 'web_component.html', title: 'Defect inside a custom element',
    axis: 'shadow',
    note: 'A registered custom element that renders the defect into its own open shadow root '
      + 'on connect — the common framework-agnostic component shape.',
    body: `<booking-widget></booking-widget>`,
    head: `\n<script>
customElements.define('booking-widget', class extends HTMLElement {
  connectedCallback(){ this.attachShadow({mode:'open'}).innerHTML = ${JSON.stringify(DEFECT)}; }
});
</script>`,
  },
  {
    file: 'progressive_enhancement.html', title: 'Server HTML replaced by script',
    axis: 'client-rendered',
    note: 'The served bytes contain a CORRECT control; script then replaces it with the '
      + 'broken one. A scanner reading served markup reports clean and is wrong — the '
      + 'inverse of client_js, and the reason "read the HTML" is not a safe shortcut.',
    body: `<div id="root"><button type="button">Search flights</button><img src="../pixel.png" alt="Airline logo"></div>`,
    head: `\n<script>addEventListener('DOMContentLoaded',()=>{document.getElementById('root').innerHTML=${JSON.stringify(DEFECT)}});</script>`,
  },
];

// supporting documents for the iframe rows — not cases themselves
const SUPPORT = {
  '_payload.html': page('Payload', DEFECT),
  '_mid.html': page('Intermediate', `<iframe src="./_payload.html" title="Inner"></iframe>`),
};

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

for (const c of CASES) {
  const header = `<!--\n  ${c.title}\n  axis: ${c.axis}\n  Carries the constant defect: 2.1.1 (div as button) and 1.1.1 (img with no alt).\n  Expectation: a scanner SHOULD report both.\n  ${c.note}\n-->\n`;
  fs.writeFileSync(path.join(DIR, c.file), header + page(c.title, c.body, c.head || ''));
}
for (const [f, html] of Object.entries(SUPPORT)) fs.writeFileSync(path.join(DIR, f), html);

fs.writeFileSync(path.join(DIR, 'index.html'), page('delivery fixtures',
  `<p>Every page below carries the <strong>same two defects</strong> — a div acting as a
   button (2.1.1) and an image with no accessible name (1.1.1) — and differs only in how
   that content reaches the browser.</p>
   <ul>${CASES.map((c) => `<li><a href="${c.file}">${c.title}</a> — <em>${c.axis}</em></li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'delivery.json'), JSON.stringify({
  description: 'Delivery matrix: one constant defect pair, many delivery mechanisms. '
    + 'Differences in what a scanner reports across these rows are pipeline blind spots, '
    + 'not rule errors, because the defect does not change.',
  constant_defect: { '2.1.1': 'div styled as a button, not focusable', '1.1.1': 'img with no accessible name' },
  generated: new Date().toISOString().slice(0, 10),
  cases: CASES.map((c) => ({
    id: `delivery-${c.file.replace(/\.html$/, '')}`,
    mode: 'tp', path: `delivery/${c.file}`, axis: c.axis,
    min_criteria: { '2.1.1': 1, '1.1.1': 1 },
    notes: c.note,
  })),
}, null, 2) + '\n');

console.log(`${CASES.length} delivery cases + ${Object.keys(SUPPORT).length} support docs`);
for (const a of [...new Set(CASES.map((c) => c.axis))])
  console.log(`  ${a.padEnd(18)} ${CASES.filter((c) => c.axis === a).length}`);
