// Coverage against the whole test space, not just the WCAG axis.
//
// The point is to be unflattering. A corpus that reports "11 of 86 criteria" sounds
// thin; the same corpus against surface x need x journey x state x input is thinner
// still, and that is the number that should drive what gets built next.
//
// Representation alone used to be the whole report, and that was still too
// flattering: naming a value in a manifest is not evidence anything ran. Every
// dimension now reports the four maturity states from maturity.mjs, and nothing
// is promoted past `executable` without a current record in the evidence ledger.
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE_FAMILY_FILES } from './fixture-families.mjs';
import { MATURITY_STATES, casesWithInheritedNeeds, loadMaturity } from './maturity.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const tax = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy', `${n}.json`), 'utf8'));

const cases = casesWithInheritedNeeds(ROOT);
const maturity = loadMaturity(ROOT);

console.log(`${cases.length} cases across ${FIXTURE_FAMILY_FILES.length} families\n`);
console.log('dimension       repr  exec'.padEnd(34) + 'run  verif / total   what is missing');
console.log('─'.repeat(110));

const rows = maturity.dimensions.map((dimension) => {
  const { represented, executable, executed, verified, total, missing } = dimension;
  console.log(
    `${dimension.dimension.padEnd(14)} ${String(represented).padStart(4)} ${String(executable).padStart(5)} ` +
      `${String(executed).padStart(4)} ${String(verified).padStart(6)} / ${String(total).padEnd(4)}   ` +
      `${missing.slice(0, 5).join(', ')}${missing.length > 5 ? `, +${missing.length - 5} more` : ''}`,
  );

  return {
    dimension: dimension.dimension,
    total,
    represented,
    executable,
    executed,
    verified,
    independently_verified: dimension.independently_verified,
    missing,
    awaiting_execution: dimension.awaiting_execution,
    not_executable: dimension.not_executable,
    values: dimension.values,
    note:
      'represented means a manifest names the value. executable means a route to evidence exists. '
      + 'executed and verified require a current record in evidence/ledger.json.',
  };
});

// the multiplicative truth
const productAxes = ['surfaces', 'journeys', 'ui-states', 'input-at'];
const space = productAxes.map((d) => tax(d).values.length);
const total = space.reduce((a, b) => a * b, 1);
const touched = new Set(cases.map((c) =>
  `${c.surface || '?'}|${c.journey || '?'}|${c.ui_state || '?'}`)).size;

console.log('\n' + '─'.repeat(110));
console.log(`applicability candidates (${productAxes.join(' x ')}) = ${space.join(' x ')} = ${total.toLocaleString()}`);
console.log(`distinct surface|journey|ui-state triples with at least one case: ${touched}`);

const methods = tax('methods');
console.log(`\nMethods that cannot be automated at all: ${
  methods.values.filter((m) => m.automatable === false).map((m) => m.id).join(', ')}`);
console.log('No fixture corpus can cover those. They need people, and a coverage figure');
console.log('that quietly omits them is not a coverage figure.');

const executedTotal = rows.reduce((sum, row) => sum + row.executed, 0);
const verifiedTotal = rows.reduce((sum, row) => sum + row.verified, 0);
console.log(`\nEvidence ledger: ${maturity.evidence_counts.current} current record(s), `
  + `${maturity.evidence_counts.stale} stale. ${executedTotal} value(s) executed, ${verifiedTotal} verified.`);
if (executedTotal === 0) {
  console.log('No execution evidence has been recorded yet, so every represented value stops at');
  console.log('`executable`. That is the honest state, and it is what this report exists to show.');
}

fs.writeFileSync(path.join(ROOT, 'space-coverage.json'), JSON.stringify({
  description: 'Maturity of the enumerated test space. A represented value is named by at least one '
    + 'fixture; executable means a route to evidence exists; executed and verified require a current '
    + 'record in the evidence ledger. The states are strictly nested and a value can never be counted '
    + 'in a state it has not reached.',
  generated: new Date().toISOString().slice(0, 10),
  cases: cases.length,
  maturity_states: MATURITY_STATES,
  corpus_content_digest: maturity.contentDigest,
  evidence: maturity.evidence_counts,
  stale_evidence: maturity.stale_evidence,
  dimensions: rows,
  combinations: {
    kind: 'applicability candidates, not a conformance denominator',
    axes: productAxes,
    formula: 'surface x journey x ui-state x input',
    total,
    triples_touched: touched,
    note: 'User needs and standards are mapped attributes, not independent Cartesian axes.',
  },
  not_automatable: methods.values.filter((m) => m.automatable === false).map((m) => m.id),
}, null, 2) + '\n');
