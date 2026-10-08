// Flash and seizure thresholds — WCAG 2.3.1 (A), 2.3.2 (AAA), 2.3.3 (AAA).
//
// ─────────────────────────────────────────────────────────────────────────────
// SAFETY DESIGN. Read this before changing anything here.
//
// A fixture that genuinely violates 2.3.1 is a page that can trigger a seizure in
// someone who opens it. That is a real harm, not a theoretical one, and it makes
// this family different from every other in the corpus: everywhere else the worst
// case is a wrong measurement.
//
// So no fixture here flashes on load. Every one:
//   - carries a warning above the control, before any motion is possible
//   - starts only on an explicit button press
//   - stops itself after 3 seconds
//   - is disabled entirely under prefers-reduced-motion
//
// The defect is still DETECTABLE while dormant: the CSS keyframes and the timing
// are in the document whether or not they are playing, so a scanner reading styles
// or the animation API finds them. That is the design compromise — a scanner that
// only looks at rendered pixels will need to press the button, and the fixture says
// so rather than pretending otherwise.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE THRESHOLD ACTUALLY IS, and why some of this is cannot-tell.
//
// 2.3.1 is not simply "faster than 3Hz". Content passes if flashing is at or below
// three flashes per second, OR if it stays under BOTH the general flash threshold
// and the red flash threshold. The general threshold involves opposing luminance
// transitions over a proportion of the visual field — and the VISUAL FIELD depends
// on screen size and how far away the person is sitting, which a page cannot know.
//
// A tool can measure frequency and the fraction of the VIEWPORT. It cannot measure
// the fraction of the visual field. So area-dependent cases are honestly cannot-tell,
// and are marked as such rather than scored as fails.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'flash');

const WARNING = `<div role="alert" style="border:3px solid #a11;padding:1rem;margin:1rem 0">
  <h2 style="margin-top:0">Seizure warning</h2>
  <p><strong>This page can produce flashing light.</strong> Nothing flashes until you press
     the button below. It stops on its own after 3 seconds, and does not run at all if your
     system is set to reduce motion.</p>
  <p>If you have photosensitive epilepsy or are unsure, do not press it. The defect is in the
     page source either way — you do not need to see it to test for it.</p>
</div>`;

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

// Gated player: the animation class is applied only on click and removed after 3s.
const gate = (label) => `<button type="button" id="go">${label}</button>
<script>
document.getElementById('go').addEventListener('click', function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.getElementById('note').textContent =
      'Not started: your system is set to reduce motion.';
    return;
  }
  var el = document.getElementById('stage');
  el.classList.add('run');
  setTimeout(function () { el.classList.remove('run'); }, 3000);
});
</script>
<p id="note" role="status" aria-live="polite"></p>`;

const CASES = [
  {
    id: 'flash_10hz_large_area',
    sc: ['2.3.1', '2.3.2'], outcome: 'fail', confidence: 'probable',
    needs: ['neuro-photosensitive'],
    brokenNote: 'A full-width panel alternating black and white ten times a second. That is '
      + 'well above three flashes per second, with a luminance change far over 10%, across '
      + 'most of the viewport. The frequency alone is machine-detectable from the keyframes '
      + 'and the animation duration.',
    brokenHead: `
<style>
@keyframes f10 { 0%,49% { background:#000 } 50%,100% { background:#fff } }
/* 0.1s cycle = 10 flashes per second. 2.3.1 allows at most 3. */
#stage.run { animation: f10 0.1s steps(1) infinite; }
#stage { height: 40vh; background:#444; border:1px solid #767676; }
@media (prefers-reduced-motion: reduce) { #stage.run { animation: none } }
</style>`,
    broken: `${WARNING}<div id="stage"></div>${gate('Start 10Hz flash for 3 seconds')}`,
    correctNote: 'The same panel at two flashes per second — at or below the three-per-second '
      + 'limit, so it passes 2.3.1 regardless of area.',
    correctHead: `
<style>
@keyframes f2 { 0%,49% { background:#000 } 50%,100% { background:#fff } }
/* 0.5s cycle = 2 flashes per second, under the 2.3.1 limit. */
#stage.run { animation: f2 0.5s steps(1) infinite; }
#stage { height: 40vh; background:#444; border:1px solid #767676; }
@media (prefers-reduced-motion: reduce) { #stage.run { animation: none } }
</style>`,
    correct: `${WARNING}<div id="stage"></div>${gate('Start 2Hz flash for 3 seconds')}`,
  },
  {
    id: 'red_flash',
    sc: ['2.3.1'], outcome: 'fail', confidence: 'probable',
    needs: ['neuro-photosensitive'],
    brokenNote: 'Saturated red alternating with black at 6Hz. The red flash threshold is '
      + 'separate from, and stricter than, the general one: transitions to and from saturated '
      + 'red are treated differently because they carry additional risk.',
    brokenHead: `
<style>
@keyframes fr { 0%,49% { background:#000 } 50%,100% { background:#f00 } }
/* saturated red, 6 flashes per second */
#stage.run { animation: fr 0.1666s steps(1) infinite; }
#stage { height: 30vh; background:#444; border:1px solid #767676; }
@media (prefers-reduced-motion: reduce) { #stage.run { animation: none } }
</style>`,
    broken: `${WARNING}<div id="stage"></div>${gate('Start red flash for 3 seconds')}`,
    correctNote: 'A slow fade between unsaturated colours — no opposing transition at speed, '
      + 'and no saturated red.',
    correctHead: `
<style>
@keyframes fs { 0% { background:#30556e } 100% { background:#486d88 } }
#stage.run { animation: fs 2s ease-in-out infinite alternate; }
#stage { height: 30vh; background:#30556e; border:1px solid #767676; }
@media (prefers-reduced-motion: reduce) { #stage.run { animation: none } }
</style>`,
    correct: `${WARNING}<div id="stage"></div>${gate('Start slow fade for 3 seconds')}`,
  },
  {
    id: 'flash_small_area',
    sc: ['2.3.1'], outcome: 'cannot-tell', confidence: 'possible',
    needs: ['neuro-photosensitive'],
    brokenNote: 'A SMALL element flashing at 8Hz. This is the case a tool cannot decide. '
      + 'Frequency is over the limit, but 2.3.1 also permits content under the general flash '
      + 'threshold, which is defined over a proportion of the VISUAL FIELD — and that depends '
      + 'on screen size and viewing distance, which the page cannot know. A tool can measure '
      + 'the fraction of the viewport; it cannot measure the fraction of the visual field. '
      + 'The honest outcome is cannot-tell, not pass and not fail.',
    brokenHead: `
<style>
@keyframes f8 { 0%,49% { background:#000 } 50%,100% { background:#fff } }
/* 8 flashes per second over a small area — area-dependent, so not machine-decidable */
#stage.run { animation: f8 0.125s steps(1) infinite; }
#stage { width:64px; height:64px; background:#444; border:1px solid #767676; }
@media (prefers-reduced-motion: reduce) { #stage.run { animation: none } }
</style>`,
    broken: `${WARNING}<div id="stage"></div>${gate('Start small-area 8Hz flash for 3 seconds')}
<p>A tool should report <code>cannot-tell</code> here and route it to a person, not guess.</p>`,
    correctNote: 'The same small element, not flashing at all.',
    correctHead: `
<style>
#stage { width:64px; height:64px; background:#30556e; border:1px solid #767676; }
</style>`,
    correct: `<div id="stage"></div><p>Static. Nothing flashes.</p>`,
  },
  {
    id: 'three_flashes_exactly',
    sc: ['2.3.2'], outcome: 'fail', confidence: 'probable',
    needs: ['neuro-photosensitive'],
    brokenNote: 'Three high-contrast flashes in one second. This passes 2.3.1, which allows '
      + 'up to three per second — and fails 2.3.2 (AAA), which allows no more than three '
      + 'flashes in any one-second period with no threshold exemption at all. A corpus that '
      + 'only tests Level A never distinguishes the two.',
    brokenHead: `
<style>
@keyframes f3 { 0%,16% { background:#000 } 17%,33% { background:#fff }
                34%,50% { background:#000 } 51%,66% { background:#fff }
                67%,83% { background:#000 } 84%,100% { background:#fff } }
/* three opposing transitions inside one second */
#stage.run { animation: f3 1s steps(1) 3; }
#stage { height:30vh; background:#444; border:1px solid #767676; }
@media (prefers-reduced-motion: reduce) { #stage.run { animation: none } }
</style>`,
    broken: `${WARNING}<div id="stage"></div>${gate('Start 3-flash sequence')}
<p>Passes 2.3.1 (Level A). Fails 2.3.2 (Level AAA).</p>`,
    correctNote: 'A single transition, which is below any flash threshold at any level.',
    correctHead: `
<style>
@keyframes f1 { 0% { background:#444 } 100% { background:#30556e } }
#stage.run { animation: f1 1s ease-in-out 1 forwards; }
#stage { height:30vh; background:#444; border:1px solid #767676; }
@media (prefers-reduced-motion: reduce) { #stage.run { animation: none } }
</style>`,
    correct: `${WARNING}<div id="stage"></div>${gate('Start single transition')}`,
  },
  {
    id: 'animation_from_interaction',
    sc: ['2.3.3'], outcome: 'fail', confidence: 'definite',
    needs: ['neuro-vestibular', 'cognitive-attention'],
    brokenNote: 'A large parallax translation triggered by interaction, with no '
      + 'prefers-reduced-motion guard. 2.3.3 is about motion sickness rather than seizures, '
      + 'and the absence of the guard is machine-detectable — no judgement needed.',
    brokenHead: `
<style>
@keyframes slide { from { transform: translateX(-60vw) scale(1.4) } to { transform:none } }
#stage.run { animation: slide 0.6s ease-out; }
#stage { height:30vh; background:#30556e; color:#fff; padding:1rem }
/* no prefers-reduced-motion rule: that IS the defect */
</style>`,
    broken: `<div id="stage">Seat map</div>${gate('Trigger parallax')}`,
    correctNote: 'The same interaction, with motion removed under prefers-reduced-motion.',
    correctHead: `
<style>
@keyframes slide2 { from { transform: translateX(-60vw) scale(1.4) } to { transform:none } }
#stage.run { animation: slide2 0.6s ease-out; }
#stage { height:30vh; background:#30556e; color:#fff; padding:1rem }
@media (prefers-reduced-motion: reduce) {
  #stage.run { animation: none }
}
</style>`,
    correct: `<div id="stage">Seat map</div>${gate('Trigger parallax')}`,
  },
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const cases = [];
for (const c of CASES) {
  for (const [kind, body, head, note] of [
    ['broken', c.broken, c.brokenHead || '', c.brokenNote],
    ['correct', c.correct, c.correctHead || '', c.correctNote],
  ]) {
    const file = kind === 'broken' ? `${c.id}.html` : `safe_${c.id}.html`;
    const outcome = kind === 'broken' ? c.outcome : 'pass';
    const header = `<!--\n  ${c.id} — ${kind}\n  WCAG: ${c.sc.join(', ')}\n`
      + `  expected outcome: ${outcome}\n`
      + `  SAFETY: nothing flashes on load. Motion starts only on a button press, stops after\n`
      + `  3 seconds, and is disabled under prefers-reduced-motion. The keyframes are in the\n`
      + `  document while dormant, so the defect is detectable without playing it.\n  ${note}\n-->\n`;
    fs.writeFileSync(path.join(DIR, file), header + page(`${c.id} — ${kind}`,
      `<p>${note}</p><hr>${body}`, head));
    cases.push({
      id: `flash-${kind === 'broken' ? c.id : 'safe_' + c.id}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `flash/${file}`,
      surface: 'web', journey: 'display-adapt', ui_state: 'default',
      method: ['static-source', 'visual', c.outcome === 'cannot-tell' ? 'guided-manual' : 'runtime-dom'],
      input_at: ['pointer', 'keyboard'],
      user_needs: c.needs,
      // a cannot-tell case is not a recall miss: the engine cannot be expected to decide it
      min_criteria: kind === 'broken' && c.outcome === 'fail'
        ? Object.fromEntries(c.sc.map((s) => [s, 1])) : {},
      must_not_report: kind === 'correct' ? c.sc : [],
      expected_outcome: outcome,
      confidence: kind === 'broken' ? c.confidence : 'definite',
      safety: 'gated — no motion on load, stops after 3s, honours prefers-reduced-motion',
      notes: note,
    });
  }
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('flash and seizure fixtures', `
<div role="alert" style="border:3px solid #a11;padding:1rem">
  <h2 style="margin-top:0">Seizure warning</h2>
  <p>Pages linked below can produce flashing light. <strong>Nothing flashes on load.</strong>
     Each one needs a button press, stops after 3 seconds, and does nothing at all if your
     system is set to reduce motion.</p>
  <p>If you have photosensitive epilepsy or are unsure, you can still test these: the
     keyframes and timings are in the page source whether or not they are playing.</p>
</div>
<p>WCAG 2.3.1 is not simply "faster than 3Hz". Content passes if it flashes at or below three
   times per second, <em>or</em> stays under both the general and red flash thresholds. The
   general threshold is defined over a proportion of the <strong>visual field</strong>, which
   depends on screen size and viewing distance — something a page cannot know. A tool can
   measure frequency and the fraction of the viewport; it cannot measure the visual field.
   <code>flash_small_area</code> exists to make that limit explicit, and expects
   <code>cannot-tell</code>.</p>
<ul>${CASES.map((c) => `<li><a href="${c.id}.html">${c.id}</a> ·
  <a href="safe_${c.id}.html">corrected</a> — ${c.sc.join(', ')} —
  <em>${c.outcome}</em></li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'flash.json'), JSON.stringify({
  description: 'Flash and seizure thresholds. Every fixture is gated: no motion on load, stops '
    + 'after 3 seconds, disabled under prefers-reduced-motion. The keyframes remain in the '
    + 'document while dormant so the defect is detectable without playing it.',
  safety: 'A fixture that genuinely violates 2.3.1 can trigger a seizure. Nothing here '
    + 'autoplays. Do not remove the gating.',
  threshold_note: '2.3.1 permits content at or below 3 flashes per second, OR under both the '
    + 'general and red flash thresholds. The general threshold is defined over the visual '
    + 'field, which depends on screen size and viewing distance — not knowable from the page. '
    + 'Area-dependent cases are therefore cannot-tell.',
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    pairs: CASES.length, cases: cases.length,
    machine_decidable: CASES.filter((c) => c.outcome === 'fail').length,
    cannot_tell: CASES.filter((c) => c.outcome === 'cannot-tell').length,
  },
  cases,
}, null, 2) + '\n');

console.log(`${CASES.length} pairs → ${cases.length} cases`);
console.log(`  machine-decidable fail: ${CASES.filter((c) => c.outcome === 'fail').length}`);
console.log(`  cannot-tell (area depends on visual field): ${CASES.filter((c) => c.outcome === 'cannot-tell').length}`);
console.log(`  criteria: ${[...new Set(CASES.flatMap((c) => c.sc))].sort().join(' ')}`);
console.log(`  ALL gated: no motion on load, 3s cap, prefers-reduced-motion honoured`);
