// Engine-neutral coverage: every WCAG 2.2 criterion × ACT test-case availability ×
// this corpus's own fixtures. Deliberately knows nothing about any scanner — a corpus
// that is shaped by one engine's control set can only ever confirm that engine.
//
// usage: node coverage.mjs [--act path/to/testcases.json]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };

const wcag = JSON.parse(fs.readFileSync(path.join(ROOT, 'wcag/criteria.json'), 'utf8')).criteria;
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));

// every local case family
const EXTRA = ['delivery.json', 'patterns.json']
  .map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f))
  .flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).cases);
catalog.cases = [...catalog.cases, ...EXTRA];

const actPath = arg('--act', path.join(ROOT, 'act/testcases.json'));
let act = [];
if (fs.existsSync(actPath)) act = JSON.parse(fs.readFileSync(actPath, 'utf8')).testcases;
else console.error(`note: ${actPath} not present — ACT columns will be empty. Fetch with:\n` +
  `  curl -sL https://www.w3.org/WAI/content-assets/wcag-act-rules/testcases.json -o ${actPath}`);

const bySC = {};
for (const t of act) {
  for (const k of Object.keys(t.ruleAccessibilityRequirements || {})) {
    const m = k.match(/wcag2\d:(.+)/);
    if (!m) continue;
    const s = (bySC[m[1]] ||= { rules: new Set(), passed: 0, failed: 0, inapplicable: 0 });
    s.rules.add(t.ruleId);
    if (t.expected in s) s[t.expected]++;
  }
}

const rows = wcag.filter((c) => c.in_2_2).map((c) => {
  const a = bySC[c.num];
  const fx = catalog.cases.filter((f) =>
    (f.mode === 'tp' ? Object.keys(f.min_criteria) : f.must_not_report).includes(c.num));
  const tp = fx.filter((f) => f.mode === 'tp');
  const safe = fx.filter((f) => f.mode === 'safe');
  return {
    sc: c.num, name: c.handle, level: c.level, since: c.versions.includes('2.0') ? '2.0'
      : c.versions.includes('2.1') ? '2.1' : '2.2',
    principle: c.principle, guideline: `${c.guideline_num} ${c.guideline}`,
    act_rules: a ? a.rules.size : 0,
    act_failed: a ? a.failed : 0,
    act_passed: a ? a.passed : 0,
    act_inapplicable: a ? a.inapplicable : 0,
    local_tp: tp.map((f) => f.path).join(' '),
    local_safe: safe.map((f) => f.path).join(' '),
    ground_truth: a ? (tp.length ? 'ACT + local' : 'ACT') : (tp.length ? 'local only' : 'NONE'),
  };
});

const csv = (t) => t.map((r) => r.map((c) => {
  const s = String(c ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\n') + '\n';

fs.writeFileSync(path.join(ROOT, 'coverage.csv'),
  csv([Object.keys(rows[0]), ...rows.map((r) => Object.values(r))]));
fs.writeFileSync(path.join(ROOT, 'coverage.json'), JSON.stringify(rows, null, 2) + '\n');

const t = rows.reduce((a, r) => { a[r.ground_truth] = (a[r.ground_truth] || 0) + 1; return a; }, {});
console.log(`WCAG 2.2: ${rows.length} live criteria`);
for (const [k, v] of Object.entries(t).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${v}`);
console.log(`\nACT cases available: ${rows.reduce((n, r) => n + r.act_failed + r.act_passed + r.act_inapplicable, 0)}`);
console.log(`local fixtures: ${catalog.cases.length} (${catalog.cases.filter((c) => c.mode === 'tp').length} tp, ${catalog.cases.filter((c) => c.mode === 'safe').length} negative controls)`);
