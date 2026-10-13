// Needs-first index: for each functional need, which fixtures exercise it.
//
// This is the inverse of the usual criterion-first view, and it is the one that
// matters for product decisions. A keyboard-access rule supports non-visual operation,
// alternative input, switch access and voice-control workflows at once — indexing only
// by success criterion hides that a single fix improves several functional needs.
import fs from 'node:fs';
import path from 'node:path';
import { loadFixtureCases } from './fixture-families.mjs';
import { loadMaturity } from './maturity.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);

// The needs report uses the same four-state vocabulary as every other coverage
// report, so "this need is covered" cannot mean one thing here and another in
// space-coverage.json.
const maturity = loadMaturity(ROOT);
const needMaturity = new Map(
  (maturity.dimensions.find((dimension) => dimension.dimension === 'user-needs')?.values ?? [])
    .map((row) => [row.value, row]),
);
const needs = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy/user-needs.json'), 'utf8')).values;
const critNeeds = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy/criterion-needs.json'), 'utf8'))
    .values.map((v) => [v.sc, v.needs]));

const cases = loadFixtureCases(ROOT)
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
  const state = needMaturity.get(n.id);
  return {
    id: n.id, label: n.label, group: n.group,
    scenarios: n.scenarios.length,
    cases: mine.length,
    tp: mine.filter((c) => c.mode === 'tp').length,
    safe: mine.filter((c) => c.mode === 'safe').length,
    maturity: state?.state ?? 'missing',
    represented: state?.represented ?? false,
    executable: state?.executable ?? false,
    executed: state?.executed ?? false,
    verified: state?.verified ?? false,
    independently_verified: state?.independently_verified ?? false,
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
    + 'those are the highest-leverage fixes, and a criterion-first report cannot show them. '
    + 'Each need also carries its evidence maturity: represented, executable, executed or '
    + 'verified, on the same vocabulary as space-coverage.json.',
  generated: new Date().toISOString().slice(0, 10),
  maturity_states: ['represented', 'executable', 'executed', 'verified'],
  needs: index,
  shared_benefit: shared,
}, null, 2) + '\n');

console.log('need                            grp          cases  tp/safe  maturity     criteria');
console.log('─'.repeat(100));
for (const n of index) {
  const flag = n.cases === 0 ? '  ← NO COVERAGE' : '';
  console.log(`${n.id.padEnd(24)} ${(n.group || '').padEnd(12)} ${String(n.cases).padStart(5)}  ${
    (n.tp + '/' + n.safe).padEnd(7)} ${n.maturity.padEnd(12)} ${n.criteria.join(' ').slice(0, 24)}${flag}`);
}
console.log(`\nneeds with execution evidence: ${index.filter((n) => n.executed).length} of ${index.length}`);
console.log(`needs independently verified:  ${index.filter((n) => n.independently_verified).length} of ${index.length}`);
console.log('\nCriteria serving MORE THAN ONE functional need (highest-leverage fixes):');
for (const s of shared.slice(0, 8)) console.log(`  ${s.sc.padEnd(8)} ${s.needs.length} needs — ${s.needs.join(', ')}`);
console.log(`\nneeds with no coverage: ${index.filter((n) => !n.cases).length} of ${index.length}`);
