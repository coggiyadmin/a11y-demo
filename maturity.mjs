// Evidence maturity.
//
// The old coverage reports counted a dimension value as covered the moment a
// manifest named it. That is an optimistic count: naming `ios` in a fixture
// does not mean anything was ever run on iOS, and it certainly does not mean
// somebody else reproduced it.
//
// Four states, strictly nested, each one earned rather than assumed:
//
//   represented  a fixture names the value
//   executable   something exists that could produce evidence for it --
//                an automatable method, or a versioned human protocol
//   executed     the evidence ledger holds a current record saying it ran
//   verified     a reviewer or an independent reproduction confirmed that run
//
// Only the first two are derivable from the corpus. The last two require the
// ledger, and a value with no ledger record stays at `executable` no matter how
// many fixtures name it. That asymmetry is the whole point.

import fs from 'node:fs';
import path from 'node:path';

import { corpusContentDigest } from './corpus-identity.mjs';
import { loadFixtureCases } from './fixture-families.mjs';

export const MATURITY_STATES = Object.freeze(['represented', 'executable', 'executed', 'verified']);

// Reproduction classes that count as somebody other than the people who built
// or sell the thing being measured.
const INDEPENDENT_CLASSES = new Set(['independent', 'academic']);

export const DIMENSIONS = Object.freeze({
  surfaces: { key: 'surface', taxonomy: 'surfaces' },
  journeys: { key: 'journey', taxonomy: 'journeys' },
  'ui-states': { key: 'ui_state', taxonomy: 'ui-states' },
  'user-needs': { key: 'user_needs', taxonomy: 'user-needs' },
  'input-at': { key: 'input_at', taxonomy: 'input-at' },
  methods: { key: 'method', taxonomy: 'methods' },
});

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * Split the ledger into records that still describe the current corpus and
 * records that no longer do.
 *
 * Ground-truth change expires a record automatically: if the corpus content
 * digest has moved, whatever was measured was measured against different
 * assertions. A harness or environment change cannot be detected from here, so
 * those are retired explicitly with `superseded_by`.
 */
export function partitionLedger(ledger, contentDigest) {
  const current = [];
  const stale = [];

  for (const record of ledger.records ?? []) {
    if (record.superseded_by) {
      stale.push({ ...record, stale_reason: `superseded by ${record.superseded_by}` });
    } else if (record.captured_against.corpus_content_digest !== contentDigest) {
      stale.push({ ...record, stale_reason: 'captured against different ground truth' });
    } else {
      current.push(record);
    }
  }

  return { current, stale };
}

/** Which dimension values a method taxonomy says can be executed automatically. */
function executableMethods(methodsTaxonomy) {
  return new Set(
    methodsTaxonomy.values.filter((method) => method.automatable !== false).map((method) => method.id),
  );
}

// The three methods no harness can run are exactly the three the versioned
// human protocols exist to cover. A protocol lane is a route to evidence, so a
// method it covers is executable by a person even though it is not automatable.
const PROTOCOL_LANE_METHODS = Object.freeze({
  'human-guided': 'guided-manual',
  'at-interoperability': 'at-testing',
  'user-task': 'user-testing',
});

/**
 * Compute the maturity of every value of every dimension.
 *
 * `cases` must already carry inherited user needs, so this agrees with
 * needs-index.mjs rather than describing a slightly different corpus.
 */
export function computeMaturity({ root, cases, ledger, contentDigest }) {
  const tax = (name) => readJson(path.join(root, 'taxonomy', `${name}.json`));
  const methodsTaxonomy = tax('methods');
  const automatable = executableMethods(methodsTaxonomy);

  const protocolsFile = path.join(root, 'protocols/protocols.json');
  const protocols = fs.existsSync(protocolsFile) ? readJson(protocolsFile).protocols : [];
  // A fixture named by a versioned human protocol is executable even when no
  // automated method applies to it; that is what the protocols exist for.
  const protocolFixtures = new Set(protocols.flatMap((protocol) => protocol.fixture_ids ?? []));
  const protocolMethods = new Set(
    protocols.map((protocol) => PROTOCOL_LANE_METHODS[protocol.lane]).filter(Boolean),
  );

  const { current, stale } = partitionLedger(ledger, contentDigest);

  const byDimension = new Map();
  for (const record of current) {
    const key = `${record.dimension}|${record.value}`;
    if (!byDimension.has(key)) byDimension.set(key, []);
    byDimension.get(key).push(record);
  }

  const scored = cases.filter((testCase) => testCase.expected_outcome !== 'not-tested');

  const dimensions = [];
  for (const [name, { key, taxonomy }] of Object.entries(DIMENSIONS)) {
    const values = tax(taxonomy).values.map((value) => value.id);

    const casesByValue = new Map(values.map((value) => [value, []]));
    for (const testCase of scored) {
      const raw = testCase[key];
      const held = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const value of held) {
        if (casesByValue.has(value)) casesByValue.get(value).push(testCase);
      }
    }

    const rows = values.map((value) => {
      const supporting = casesByValue.get(value);
      const represented = supporting.length > 0;

      // Executable means some route to evidence exists, not that it was taken.
      const executable =
        represented &&
        (name === 'methods'
          ? automatable.has(value) || protocolMethods.has(value)
          : supporting.some(
              (testCase) =>
                (testCase.method ?? []).some((method) => automatable.has(method)) ||
                protocolFixtures.has(testCase.id),
            ));

      const records = byDimension.get(`${name}|${value}`) ?? [];
      const executed = records.length > 0;
      const verifiedRecords = records.filter((record) => record.state === 'verified');
      const independentRecords = verifiedRecords.filter((record) =>
        INDEPENDENT_CLASSES.has(record.reproduction_class),
      );

      let state = 'missing';
      if (verifiedRecords.length > 0) state = 'verified';
      else if (executed) state = 'executed';
      else if (executable) state = 'executable';
      else if (represented) state = 'represented';

      // A proxy represents the surface in the manifest but is not native
      // coverage of it. Both numbers are published; neither stands in for the
      // other.
      const nativeCases = supporting.filter((testCase) => testCase.representation !== 'proxy');
      const proxyCases = supporting.filter((testCase) => testCase.representation === 'proxy');

      return {
        value,
        state,
        represented,
        represented_natively: nativeCases.length > 0,
        native_cases: nativeCases.length,
        proxy_cases: proxyCases.length,
        executable,
        executed,
        verified: verifiedRecords.length > 0,
        independently_verified: independentRecords.length > 0,
        cases: supporting.length,
        evidence: records.map((record) => ({
          id: record.id,
          state: record.state,
          runner: `${record.runner.id} ${record.runner.version}`,
          reproduction_class: record.reproduction_class,
          artifact: record.artifact.sha256,
        })),
      };
    });

    const tally = (predicate) => rows.filter(predicate).length;
    dimensions.push({
      dimension: name,
      total: values.length,
      // Each state counts only values that actually reached it, so a
      // represented-only value can never appear in the executed or verified
      // figure.
      represented: tally((row) => row.represented),
      represented_natively: tally((row) => row.represented_natively),
      proxy_only: tally((row) => row.represented && !row.represented_natively),
      executable: tally((row) => row.executable),
      executed: tally((row) => row.executed),
      verified: tally((row) => row.verified),
      independently_verified: tally((row) => row.independently_verified),
      missing: rows.filter((row) => !row.represented).map((row) => row.value),
      awaiting_execution: rows.filter((row) => row.executable && !row.executed).map((row) => row.value),
      not_executable: rows.filter((row) => row.represented && !row.executable).map((row) => row.value),
      values: rows,
    });
  }

  return {
    dimensions,
    stale_evidence: stale.map((record) => ({
      id: record.id,
      dimension: record.dimension,
      value: record.value,
      state: record.state,
      stale_reason: record.stale_reason,
      recorded_on: record.recorded_on,
    })),
    evidence_counts: {
      records: (ledger.records ?? []).length,
      current: current.length,
      stale: stale.length,
      by_reproduction_class: current.reduce((totals, record) => {
        totals[record.reproduction_class] = (totals[record.reproduction_class] ?? 0) + 1;
        return totals;
      }, {}),
      vendor_evidence: current.filter((record) => record.reproduction_class === 'vendor').length,
      independent_reproduction: current.filter((record) => INDEPENDENT_CLASSES.has(record.reproduction_class)).length,
    },
  };
}

/** Cases with functional needs inherited from the criteria they exercise. */
export function casesWithInheritedNeeds(root) {
  const criterionNeeds = Object.fromEntries(
    readJson(path.join(root, 'taxonomy/criterion-needs.json')).values.map((value) => [value.sc, value.needs]),
  );

  return loadFixtureCases(root).map((testCase) => {
    const criteria = [...Object.keys(testCase.min_criteria ?? {}), ...(testCase.must_not_report ?? [])];
    const inherited = criteria.flatMap((criterion) => criterionNeeds[criterion] ?? []);
    return { ...testCase, user_needs: [...new Set([...(testCase.user_needs ?? []), ...inherited])] };
  });
}

export function loadLedger(root) {
  const file = path.join(root, 'evidence/ledger.json');
  if (!fs.existsSync(file)) return { records: [] };
  return readJson(file);
}

export function loadMaturity(root) {
  const manifest = readJson(path.join(root, 'corpus-manifest.json'));
  const contentDigest = corpusContentDigest(manifest);
  return {
    contentDigest,
    ...computeMaturity({
      root,
      cases: casesWithInheritedNeeds(root),
      ledger: loadLedger(root),
      contentDigest,
    }),
  };
}
