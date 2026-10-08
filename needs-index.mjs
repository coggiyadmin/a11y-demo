// Needs-first index: for each functional need, which fixtures exercise it.
//
// This is the inverse of the usual criterion-first view, and it is the one that
// matters for product decisions. A keyboard-access rule serves blind users, people
// with limited dexterity, switch users and many speech-input users at once —
// indexing only by success criterion hides that a single fix moves four groups.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const needs = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy/user-needs.json'), 'utf8')).values;
const critNeeds = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy/criterion-needs.json'), 'utf8'))
    .values.map((v) => [v.sc, v.needs]));

const cases = ['catalog.json', 'delivery.json', 'patterns.json', 'color-vision.json', 'media.json', 'ui-states.json', 'journeys.json', 'scenarios.json', 'surfaces.json', 'guided.json', 'flash.json']
  .map((f) => path.join(ROOT, f)).filter(fs.existsSync)
  .flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).cases)
  // A case inherits needs from the criteria it exercises. Hand-annotating every
  // fixture would drift; the rule-level mapping is the single source of truth.
  .map((c) => {
    const scs = [...Object.keys(c.min_criteria || {}), ...(c.must_not_report || [])];
    const inherited = [...new Set(scs.flatMap((s) => critNeeds[s] || []))];
    return { ...c, user_needs: [...new Set([...(c.user_needs || []), ...inherited])] };
  });

const index = needs.map((n) => {
  const mine = cases.filter((c) => (c.user_needs || []).includes(n.id));
  const crit = new Set();
  for (const c of mine) {
    Object.keys(c.min_criteria || {}).forEach((s) => crit.add(s));
    (c.must_not_report || []).forEach((s) => crit.add(s));
  }
  return {
    id: n.id, label: n.label, group: n.group,
    scenarios: n.scenarios.length,
    cases: mine.length,
    tp: mine.filter((c) => c.mode === 'tp').length,
    safe: mine.filter((c) => c.mode === 'safe').length,
    criteria: [...crit].sort(),
    fixtures: mine.map((c) => c.path),
  };
});

// which criteria serve more than one need — the shared-benefit view
const byCriterion = {};
for (const c of cases) {
  const scs = [...Object.keys(c.min_criteria || {}), ...(c.must_not_report || [])];
  for (const s of scs) (byCriterion[s] ||= new Set());
  for (const s of scs) (c.user_needs || []).forEach((n) => byCriterion[s].add(n));
}
const shared = Object.entries(byCriterion)
  .map(([sc, set]) => ({ sc, needs: [...set].sort() }))
  .filter((x) => x.needs.length > 1)
  .sort((a, b) => b.needs.length - a.needs.length);

fs.writeFileSync(path.join(ROOT, 'needs-index.json'), JSON.stringify({
  description: 'Functional-need index. For each need: the fixtures that exercise it and the '
    + 'criteria they touch. `shared_benefit` lists criteria serving more than one need — '
    + 'those are the highest-leverage fixes, and a criterion-first report cannot show them.',
  generated: new Date().toISOString().slice(0, 10),
  needs: index,
  shared_benefit: shared,
}, null, 2) + '\n');

console.log('need                            grp          cases  tp/safe  criteria');
console.log('─'.repeat(88));
for (const n of index) {
  const flag = n.cases === 0 ? '  ← NO COVERAGE' : '';
  console.log(`${n.id.padEnd(24)} ${(n.group || '').padEnd(12)} ${String(n.cases).padStart(5)}  ${
    (n.tp + '/' + n.safe).padEnd(7)} ${n.criteria.join(' ').slice(0, 30)}${flag}`);
}
console.log('\nCriteria serving MORE THAN ONE functional need (highest-leverage fixes):');
for (const s of shared.slice(0, 8)) console.log(`  ${s.sc.padEnd(8)} ${s.needs.length} needs — ${s.needs.join(', ')}`);
console.log(`\nneeds with no coverage: ${index.filter((n) => !n.cases).length} of ${index.length}`);
