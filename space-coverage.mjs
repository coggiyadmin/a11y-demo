// Coverage against the whole test space, not just the WCAG axis.
//
// The point is to be unflattering. A corpus that reports "11 of 86 criteria" sounds
// thin; the same corpus against surface x need x journey x state x input is thinner
// still, and that is the number that should drive what gets built next.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const tax = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy', `${n}.json`), 'utf8'));

const FAMILIES = ['catalog.json', 'delivery.json', 'patterns.json', 'color-vision.json', 'media.json', 'ui-states.json'];
// Needs are inherited from the criteria a case exercises, the same way needs-index.mjs
// does it. Without this the two reports disagree about the same corpus.
const critNeeds = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy/criterion-needs.json'), 'utf8'))
    .values.map((v) => [v.sc, v.needs]));

const cases = FAMILIES
  .map((f) => path.join(ROOT, f)).filter(fs.existsSync)
  .flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).cases)
  .map((c) => {
    const scs = [...Object.keys(c.min_criteria || {}), ...(c.must_not_report || [])];
    return { ...c, user_needs: [...new Set([...(c.user_needs || []),
      ...scs.flatMap((s) => critNeeds[s] || [])])] };
  });

const dims = {
  surfaces: { key: 'surface', data: tax('surfaces') },
  journeys: { key: 'journey', data: tax('journeys') },
  'ui-states': { key: 'ui_state', data: tax('ui-states') },
  'user-needs': { key: 'user_needs', data: tax('user-needs') },
  'input-at': { key: 'input_at', data: tax('input-at') },
  methods: { key: 'method', data: tax('methods') },
};

const rows = [];
console.log(`${cases.length} cases across ${FAMILIES.length} families\n`);
console.log('dimension      covered / total   what is missing');
console.log('─'.repeat(100));

for (const [name, { key, data }] of Object.entries(dims)) {
  const all = data.values.map((v) => v.id);
  const seen = new Set();
  for (const c of cases) {
    const v = c[key];
    if (Array.isArray(v)) v.forEach((x) => seen.add(x));
    else if (v) seen.add(v);
  }
  const hit = all.filter((a) => seen.has(a));
  const miss = all.filter((a) => !seen.has(a));
  rows.push({ dimension: name, covered: hit.length, total: all.length, missing: miss });
  console.log(`${name.padEnd(14)} ${String(hit.length).padStart(3)} / ${String(all.length).padEnd(3)}        ${
    miss.slice(0, 6).join(', ')}${miss.length > 6 ? `, +${miss.length - 6} more` : ''}`);
}

// the multiplicative truth
const space = ['surfaces', 'journeys', 'ui-states', 'input-at'].map((d) => dims[d].data.values.length);
const total = space.reduce((a, b) => a * b, 1);
const touched = new Set(cases.map((c) =>
  `${c.surface || '?'}|${c.journey || '?'}|${c.ui_state || '?'}`)).size;

console.log('\n' + '─'.repeat(100));
console.log(`surface x journey x ui-state x input = ${space.join(' x ')} = ${total.toLocaleString()} combinations`);
console.log(`distinct surface|journey|ui-state triples with at least one case: ${touched}`);
console.log(`\nMethods that cannot be automated at all: ${
  dims.methods.data.values.filter((m) => m.automatable === false).map((m) => m.id).join(', ')}`);
console.log('No fixture corpus can cover those. They need people, and a coverage figure');
console.log('that quietly omits them is not a coverage figure.');

fs.writeFileSync(path.join(ROOT, 'space-coverage.json'), JSON.stringify({
  description: 'Coverage of this corpus against the enumerated test space. Deliberately '
    + 'unflattering: the denominator is the real space, not the part that happens to be covered.',
  generated: new Date().toISOString().slice(0, 10),
  cases: cases.length,
  dimensions: rows,
  combinations: { formula: 'surface x journey x ui-state x input', total, triples_touched: touched },
  not_automatable: dims.methods.data.values.filter((m) => m.automatable === false).map((m) => m.id),
}, null, 2) + '\n');
