import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

import * as ibmChecker from 'accessibility-checker';
import axeCore from 'axe-core';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import pa11y from 'pa11y';
import { chromium } from 'playwright';
import puppeteer from 'puppeteer';

import { loadFixtureCases } from '../fixture-families.mjs';
import { startCorpusServer } from '../serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ALL_TOOL_IDS = ['cognium', 'axe', 'pa11y-htmlcs', 'ibm', 'lighthouse'];
const TOOL_LABELS = {
  cognium: 'Cognium',
  axe: 'axe-core',
  'pa11y-htmlcs': 'Pa11y / HTML_CodeSniffer',
  ibm: 'IBM Equal Access',
  lighthouse: 'Lighthouse accessibility',
};
const CHROME_ARGS = [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-sync',
  '--metrics-recording-only',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function packageVersion(name) {
  const packagePath = path.join(HERE, 'node_modules', ...name.split('/'), 'package.json');
  return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
}

function expectedCriteria(testCase) {
  return testCase.mode === 'tp'
    ? Object.keys(testCase.min_criteria || {})
    : [...(testCase.must_not_report || [])];
}

function criteriaFromAxeTags(tags = []) {
  return [...new Set(tags.flatMap((tag) => {
    const match = /^wcag(\d{3,4})$/.exec(tag);
    if (!match) return [];
    const digits = match[1];
    return digits.length === 3
      ? [`${digits[0]}.${digits[1]}.${digits[2]}`]
      : [`${digits[0]}.${digits[1]}.${digits.slice(2)}`];
  }))].sort();
}

function criteriaFromPa11yCode(code = '') {
  const match = /Guideline\d+_\d+\.(\d+)_(\d+)_(\d+)/.exec(code);
  return match ? [`${match[1]}.${match[2]}.${match[3]}`] : [];
}

function aggregateFindings(items, rule, count, criteria) {
  const grouped = new Map();
  for (const item of items) {
    const id = rule(item);
    const current = grouped.get(id) || { rule: id, count: 0, criteria: new Set() };
    current.count += count(item);
    for (const criterion of criteria(item)) current.criteria.add(criterion);
    grouped.set(id, current);
  }
  return [...grouped.values()]
    .map((item) => ({ ...item, criteria: [...item.criteria].sort() }))
    .sort((a, b) => a.rule.localeCompare(b.rule));
}

function rowFor(testCase, started, findings, manualCount = 0, extra = {}) {
  const foundCriteria = [...new Set(findings.flatMap((finding) => finding.criteria))].sort();
  const expected = expectedCriteria(testCase);
  const matchedExpected = expected.filter((criterion) => foundCriteria.includes(criterion));
  return {
    id: testCase.id,
    mode: testCase.mode,
    path: testCase.path,
    expected_criteria: expected,
    status: 'ok',
    automated_findings: findings.reduce((sum, finding) => sum + finding.count, 0),
    manual_review_items: manualCount,
    found_criteria: foundCriteria,
    matched_expected_criteria: matchedExpected,
    findings,
    duration_ms: Date.now() - started,
    ...extra,
  };
}

function errorRow(testCase, started, error) {
  const message = String(error?.message || error)
    .replaceAll(ROOT, '<repo>')
    .replace(/\/(?:Users|home)\/[^/\s]+/g, '<local-home>')
    .split('\n')[0];
  return {
    id: testCase.id,
    mode: testCase.mode,
    path: testCase.path,
    expected_criteria: expectedCriteria(testCase),
    status: 'error',
    automated_findings: 0,
    manual_review_items: 0,
    found_criteria: [],
    matched_expected_criteria: [],
    findings: [],
    duration_ms: Date.now() - started,
    error: message,
  };
}

function runCognium(cases) {
  const exported = JSON.parse(fs.readFileSync(path.join(HERE, 'cognium-results.json'), 'utf8'));
  assert.equal(exported.schema_version, 1);
  assert.equal(exported.capture?.capture_misses, 0, 'Cognium export has incomplete capture dependencies');
  assert.equal(exported.capture?.run_errors, 0, 'Cognium export has run errors');
  const rowById = new Map(exported.cases.map((row) => [row.id, row]));
  const rows = cases.map((testCase) => {
    const source = rowById.get(testCase.id);
    assert.ok(source, `Cognium export has no row for ${testCase.id}`);
    assert.equal(source.path, testCase.path, `Cognium path differs for ${testCase.id}`);
    const row = rowFor(testCase, Date.now(), source.findings, source.manual_review_items, {
      duration_ms: null,
      imported: true,
    });
    assert.deepEqual(row.found_criteria, source.found_criteria);
    return row;
  });
  return { rows, exported };
}

async function loadPage(page, url, testCase) {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  if (!response || response.status() !== 200) throw new Error(`HTTP ${response?.status() ?? 'none'}`);
  await page.waitForTimeout(testCase.id === 'delivery-client_js_delayed' ? 1000 : 150);
}

async function runAxe(cases, baseUrl, executablePath) {
  const browser = await chromium.launch({ executablePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const rows = [];
  for (const testCase of cases) {
    const started = Date.now();
    const page = await context.newPage();
    try {
      await loadPage(page, `${baseUrl}/${testCase.path}`, testCase);
      await page.addScriptTag({ content: axeCore.source });
      const result = await page.evaluate(async (tags) => window.axe.run(document, {
        runOnly: { type: 'tag', values: tags },
        resultTypes: ['violations', 'incomplete'],
      }), AXE_TAGS);
      const findings = result.violations.map((violation) => ({
        rule: violation.id,
        count: violation.nodes.length,
        criteria: criteriaFromAxeTags(violation.tags),
      })).sort((a, b) => a.rule.localeCompare(b.rule));
      const manual = result.incomplete.reduce((sum, item) => sum + item.nodes.length, 0);
      rows.push(rowFor(testCase, started, findings, manual));
    } catch (error) {
      rows.push(errorRow(testCase, started, error));
    } finally {
      await page.close();
    }
    process.stderr.write(`axe ${testCase.id}\n`);
  }
  await context.close();
  await browser.close();
  return rows;
}

async function runPa11y(cases, baseUrl, executablePath) {
  const browser = await puppeteer.launch({ executablePath, headless: true, args: CHROME_ARGS });
  const rows = [];
  try {
    for (const testCase of cases) {
      const started = Date.now();
      try {
        const result = await pa11y(`${baseUrl}/${testCase.path}`, {
          browser,
          runners: ['htmlcs'],
          standard: 'WCAG2AA',
          includeWarnings: true,
          includeNotices: false,
          timeout: 30000,
          wait: testCase.id === 'delivery-client_js_delayed' ? 1000 : 150,
          viewport: { width: 1280, height: 900 },
        });
        const automatic = result.issues.filter((issue) => issue.type === 'error');
        const findings = aggregateFindings(
          automatic,
          (issue) => issue.code,
          () => 1,
          (issue) => criteriaFromPa11yCode(issue.code),
        );
        const manual = result.issues.filter((issue) => issue.type !== 'error').length;
        rows.push(rowFor(testCase, started, findings, manual));
      } catch (error) {
        rows.push(errorRow(testCase, started, error));
      }
      process.stderr.write(`pa11y-htmlcs ${testCase.id}\n`);
    }
  } finally {
    await browser.close();
  }
  return rows;
}

function ibmCriteriaMap(rulesets) {
  const map = new Map();
  for (const ruleset of rulesets || []) {
    for (const checkpoint of ruleset.checkpoints || []) {
      const criterion = /\b\d+\.\d+\.\d+\b/.exec(String(checkpoint.num || checkpoint.id || ''))?.[0];
      for (const rule of checkpoint.rules || []) {
        const values = map.get(rule.id) || new Set();
        if (criterion) values.add(criterion);
        map.set(rule.id, values);
      }
    }
  }
  return new Map([...map].map(([key, values]) => [key, [...values].sort()]));
}

async function runIbm(cases, baseUrl, executablePath) {
  const cacheFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'a11y-demo-ibm-'));
  const browser = await chromium.launch({ executablePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const rows = [];
  try {
    await ibmChecker.setConfig({
      ruleArchive: 'versioned',
      policies: ['WCAG_2_2'],
      failLevels: ['violation'],
      reportLevels: ['violation', 'potentialviolation', 'manual', 'pass'],
      outputFormat: ['disable'],
      outputFilenameTimestamp: false,
      label: ['IBMa-Node-TeSt'],
      cacheFolder,
      outputFolder: path.join(cacheFolder, 'results'),
      baselineFolder: path.join(cacheFolder, 'baselines'),
    });
    const criteriaMap = ibmCriteriaMap(await ibmChecker.getRulesets());
    for (const testCase of cases) {
      const started = Date.now();
      const page = await context.newPage();
      try {
        await loadPage(page, `${baseUrl}/${testCase.path}`, testCase);
        const result = await ibmChecker.getCompliance(page, testCase.id);
        if (!result?.report?.results) throw new Error('IBM checker returned no result list');
        const automatic = result.report.results.filter((item) =>
          item.value?.[0] === 'VIOLATION' && item.value?.[1] === 'FAIL');
        const findings = aggregateFindings(
          automatic,
          (item) => item.ruleId,
          () => 1,
          (item) => criteriaMap.get(item.ruleId) || [],
        );
        const manual = result.report.results.filter((item) =>
          item.value?.[0] === 'VIOLATION'
          && ['POTENTIAL', 'MANUAL'].includes(item.value?.[1])).length;
        rows.push(rowFor(testCase, started, findings, manual, {
          rule_archive: result.report.summary?.ruleArchive || null,
        }));
      } catch (error) {
        rows.push(errorRow(testCase, started, error));
      } finally {
        await page.close();
      }
      process.stderr.write(`ibm ${testCase.id}\n`);
    }
  } finally {
    await context.close();
    await browser.close();
    await ibmChecker.close();
    fs.rmSync(cacheFolder, { recursive: true, force: true });
  }
  return rows;
}

async function runLighthouse(cases, baseUrl, executablePath) {
  const chrome = await chromeLauncher.launch({
    chromePath: executablePath,
    chromeFlags: CHROME_ARGS,
    logLevel: 'silent',
  });
  const axeRules = new Map(axeCore.getRules(AXE_TAGS).map((rule) => [rule.ruleId, criteriaFromAxeTags(rule.tags)]));
  const rows = [];
  try {
    for (const testCase of cases) {
      const started = Date.now();
      try {
        const result = await lighthouse(`${baseUrl}/${testCase.path}`, {
          port: chrome.port,
          onlyCategories: ['accessibility'],
          output: 'json',
          logLevel: 'silent',
          disableStorageReset: true,
          enableErrorReporting: false,
          maxWaitForLoad: 30000,
        });
        if (!result?.lhr?.audits) throw new Error('Lighthouse returned no audits');
        const failed = Object.values(result.lhr.audits).filter((audit) =>
          audit.scoreDisplayMode === 'binary' && audit.score === 0);
        const findings = failed.map((audit) => ({
          rule: audit.id,
          count: Math.max(1, audit.details?.items?.length || 0),
          criteria: axeRules.get(audit.id) || [],
        })).sort((a, b) => a.rule.localeCompare(b.rule));
        const manual = Object.values(result.lhr.audits)
          .filter((audit) => audit.scoreDisplayMode === 'manual').length;
        rows.push(rowFor(testCase, started, findings, manual, {
          accessibility_score: result.lhr.categories.accessibility?.score ?? null,
        }));
      } catch (error) {
        rows.push(errorRow(testCase, started, error));
      }
      process.stderr.write(`lighthouse ${testCase.id}\n`);
    }
  } finally {
    await chrome.kill();
  }
  return rows;
}

function summarize(rows) {
  const successful = rows.filter((row) => row.status === 'ok');
  const tp = successful.filter((row) => row.mode === 'tp');
  const safe = successful.filter((row) => row.mode === 'safe');
  const criteriaTotal = tp.reduce((sum, row) => sum + row.expected_criteria.length, 0);
  const criteriaMatched = tp.reduce((sum, row) => {
    const found = new Set(row.found_criteria);
    return sum + row.expected_criteria.filter((criterion) => found.has(criterion)).length;
  }, 0);
  return {
    cases: rows.length,
    errors: rows.filter((row) => row.status === 'error').length,
    tp_cases: tp.length,
    tp_pages_with_target_findings: tp.filter((row) => row.matched_expected_criteria.length > 0).length,
    tp_pages_with_other_findings_only: tp.filter((row) =>
      row.automated_findings > 0 && row.matched_expected_criteria.length === 0).length,
    safe_cases: safe.length,
    safe_pages_without_target_findings: safe.filter((row) => row.matched_expected_criteria.length === 0).length,
    safe_pages_with_target_findings: safe.filter((row) => row.matched_expected_criteria.length > 0).length,
    safe_pages_with_other_findings_only: safe.filter((row) =>
      row.automated_findings > 0 && row.matched_expected_criteria.length === 0).length,
    expected_criteria: criteriaTotal,
    expected_criteria_matched: criteriaMatched,
    manual_review_items: successful.reduce((sum, row) => sum + row.manual_review_items, 0),
    duration_ms: successful.reduce((sum, row) => sum + row.duration_ms, 0),
  };
}

function percent(numerator, denominator) {
  return denominator ? `${Math.round(numerator / denominator * 100)}%` : 'n/a';
}

function renderReport(snapshot) {
  const tpCaseIds = snapshot.cases.filter((testCase) => testCase.mode === 'tp').map((testCase) => testCase.id);
  const targetHits = (toolId) => new Set(snapshot.tools[toolId].cases
    .filter((row) => row.status === 'ok' && row.mode === 'tp' && row.matched_expected_criteria.length > 0)
    .map((row) => row.id));
  const hitsByTool = new Map(snapshot.tool_order.map((id) => [id, targetHits(id)]));
  const unionHits = tpCaseIds.filter((id) => snapshot.tool_order.some((toolId) => hitsByTool.get(toolId).has(id)));
  const commonMisses = tpCaseIds.filter((id) => !unionHits.includes(id));
  const uniqueHits = new Map(snapshot.tool_order.map((toolId) => [toolId, tpCaseIds.filter((id) => {
    const matchingTools = snapshot.tool_order.filter((candidate) => hitsByTool.get(candidate).has(id));
    return matchingTools.length === 1 && matchingTools[0] === toolId;
  })]));
  const leadingCount = Math.max(...snapshot.tool_order.map((id) => hitsByTool.get(id).size));
  const leaders = snapshot.tool_order.filter((id) => hitsByTool.get(id).size === leadingCount);
  const allSafeTargetClean = snapshot.tool_order.every((id) =>
    snapshot.tools[id].summary.safe_pages_with_target_findings === 0);
  const lines = [
    '# Accessibility scanner comparison',
    '',
    `Snapshot generated ${snapshot.generated} from the \`${snapshot.suite.name}\` suite (${snapshot.cases.length} pages).`,
    '',
    'This is a corpus result, not a universal ranking. “Target detected” means the tool emitted an automated finding mapped to at least one expected WCAG criterion on a known-defect page. “Target clean” means it did not report a criterion declared clean by that corrected control; it does not prove conformance.',
    '',
    '## Summary',
    '',
    '| Tool | Known-defect pages with target detected | Corrected controls target-clean | Expected criteria matched | Run errors |',
    '|---|---:|---:|---:|---:|',
  ];
  for (const id of snapshot.tool_order) {
    const tool = snapshot.tools[id];
    const s = tool.summary;
    lines.push(`| ${tool.label} ${tool.version} | ${s.tp_pages_with_target_findings}/${s.tp_cases} (${percent(s.tp_pages_with_target_findings, s.tp_cases)}) | ${s.safe_pages_without_target_findings}/${s.safe_cases} (${percent(s.safe_pages_without_target_findings, s.safe_cases)}) | ${s.expected_criteria_matched}/${s.expected_criteria} (${percent(s.expected_criteria_matched, s.expected_criteria)}) | ${s.errors} |`);
  }
  lines.push('', 'Expected-criterion matching is conservative: it only credits findings whose tool metadata maps to a WCAG success criterion. A tool can flag a page while still receiving no criterion credit when its public result does not expose that mapping.', '');
  if (snapshot.tools.cognium) {
    lines.push('Cognium uses the committed sanitized all-pages export for this exact fixture suite. The other tools are executed directly by this harness.', '');
  }

  lines.push('## What this snapshot shows', '');
  const comparedTools = snapshot.tool_order.length === 1 ? 'the selected tool' : `all ${snapshot.tool_order.length} tools`;
  lines.push(`- The union of ${comparedTools} detected a target criterion on ${unionHits.length}/${tpCaseIds.length} known-defect pages (${percent(unionHits.length, tpCaseIds.length)}). ${commonMisses.length} were missed by every tool in the default page-load configuration.`);
  lines.push(`- The largest target-page count was ${leadingCount}/${tpCaseIds.length}, from ${leaders.map((id) => snapshot.tools[id].label).join(' and ')}.`);
  for (const id of snapshot.tool_order) {
    const unique = uniqueHits.get(id);
    if (unique.length) lines.push(`- ${snapshot.tools[id].label} uniquely detected ${unique.map((caseId) => `\`${caseId}\``).join(', ')}.`);
  }
  if (allSafeTargetClean) lines.push(`- All tools left all ${snapshot.cases.filter((testCase) => testCase.mode === 'safe').length} corrected controls clean for their declared criteria.`);
  lines.push(`- Common misses: ${commonMisses.map((id) => `\`${id}\``).join(', ')}.`, '');

  lines.push('## Case matrix', '', 'Legend: `T` target criterion found, `o` automated finding outside this case’s declared criteria, `.` no automated finding, `E` scan error.', '');
  lines.push(`| Case | Expected | ${snapshot.tool_order.map((id) => snapshot.tools[id].label).join(' | ')} |`);
  lines.push(`|---|---|${snapshot.tool_order.map(() => '---:').join('|')}|`);
  for (const testCase of snapshot.cases) {
    const cells = snapshot.tool_order.map((id) => {
      const row = snapshot.tools[id].cases.find((item) => item.id === testCase.id);
      if (!row || row.status === 'error') return 'E';
      if (row.matched_expected_criteria.length > 0) return 'T';
      return row.automated_findings > 0 ? 'o' : '.';
    });
    lines.push(`| \`${testCase.id}\` | ${testCase.mode === 'tp' ? 'known defect' : 'corrected control'} | ${cells.join(' | ')} |`);
  }

  lines.push('', '## Gaps visible in this snapshot', '');
  for (const id of snapshot.tool_order) {
    const tool = snapshot.tools[id];
    const missed = tool.cases.filter((row) => row.status === 'ok' && row.mode === 'tp' && row.matched_expected_criteria.length === 0);
    const noisy = tool.cases.filter((row) => row.status === 'ok' && row.mode === 'safe' && row.matched_expected_criteria.length > 0);
    lines.push(`### ${tool.label}`, '');
    lines.push(`Known-defect pages with no target-criterion finding (${missed.length}): ${missed.length ? missed.map((row) => `\`${row.id}\``).join(', ') : 'none'}.`);
    lines.push('');
    lines.push(`Corrected controls with a declared-criterion finding (${noisy.length}): ${noisy.length ? noisy.map((row) => `\`${row.id}\``).join(', ') : 'none'}.`);
    lines.push('');
  }

  lines.push('## Interpretation limits', '',
    '- The suite is intentionally representative, not the full corpus. Use `--suite all --tools axe,pa11y-htmlcs,ibm,lighthouse` for all definite broken and corrected browser fixtures supported directly by this public harness.',
    '- Target-page detection is coarser than criterion-level recall. The JSON result retains rule IDs, mapped criteria and per-page counts for deeper analysis.',
    '- Dynamic states, complete journeys, display conditions, keyboard behavior, user tasks and assisted-technology behavior need drivers or people; a default page-load scan cannot settle them.',
    ...(snapshot.tools.cognium ? ['- The public harness consumes a sanitized Cognium export; it does not package or invoke the Cognium runtime.'] : []),
    '- Review-needed counts preserve tool-native unresolved output and are not directly comparable across tools.',
    '- Lighthouse uses axe-derived accessibility audits, so it is a product-level configuration comparison, not an independent rules engine.',
    '- Durations are retained for diagnostics only and are not a performance ranking.',
    '');
  return `${lines.join('\n')}\n`;
}

if (process.argv.includes('--render-only')) {
  const snapshot = JSON.parse(fs.readFileSync(path.join(HERE, 'results.json'), 'utf8'));
  fs.writeFileSync(path.join(HERE, 'REPORT.md'), renderReport(snapshot));
  console.log('Wrote comparison/REPORT.md from comparison/results.json');
  process.exit(0);
}

const suiteName = arg('suite', 'smoke');
const selectedToolIds = arg('tools', ALL_TOOL_IDS.join(','))
  .split(',').map((value) => value.trim()).filter(Boolean);
for (const id of selectedToolIds) assert.ok(ALL_TOOL_IDS.includes(id), `unknown tool: ${id}`);

const allCases = loadFixtureCases(ROOT);
const suiteFile = JSON.parse(fs.readFileSync(path.join(HERE, 'suite.json'), 'utf8'));
const selectedCases = suiteName === 'all'
  ? allCases.filter((testCase) => ['tp', 'safe'].includes(testCase.mode)
      && testCase.expected_outcome !== 'cannot-tell' && testCase.fixture_family !== 'guided')
  : suiteFile.case_ids.map((id) => {
      const testCase = allCases.find((item) => item.id === id);
      assert.ok(testCase, `suite references unknown case: ${id}`);
      return testCase;
    });

const server = startCorpusServer({ host: '127.0.0.1', port: 0 });
if (!server.listening) await once(server, 'listening');
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const executablePath = chromium.executablePath();

const runners = {
  cognium: runCognium,
  axe: runAxe,
  'pa11y-htmlcs': runPa11y,
  ibm: runIbm,
  lighthouse: runLighthouse,
};
const versionPackages = {
  axe: 'axe-core',
  'pa11y-htmlcs': 'pa11y',
  ibm: 'accessibility-checker',
  lighthouse: 'lighthouse',
};

const tools = {};
try {
  for (const id of selectedToolIds) {
    console.log(`\n${TOOL_LABELS[id]}: ${selectedCases.length} pages`);
    const result = await runners[id](selectedCases, baseUrl, executablePath);
    const rows = id === 'cognium' ? result.rows : result;
    tools[id] = {
      label: TOOL_LABELS[id],
      version: id === 'cognium' ? result.exported.version : packageVersion(versionPackages[id]),
      source: id === 'cognium' ? {
        kind: 'sanitized-import',
        generated: result.exported.generated,
        view: result.exported.source_view,
        capture: result.exported.capture,
        environment: result.exported.environment,
        versions: result.exported.versions,
      } : { kind: 'live-local-scan' },
      summary: summarize(rows),
      cases: rows,
    };
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const browser = await chromium.launch({ executablePath });
const browserVersion = browser.version();
await browser.close();

const snapshot = {
  schema_version: 1,
  generated: new Date().toISOString().slice(0, 10),
  suite: suiteName === 'all'
    ? { name: 'all', description: 'All definite broken and corrected browser fixtures.' }
    : { name: suiteFile.name, description: suiteFile.description },
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    browser: `Chromium ${browserVersion}`,
  },
  privacy: {
    target: 'ephemeral localhost server only',
    hosted_services: false,
    repository_content_uploaded: false,
    install_scripts_disabled_by_npmrc: true,
    ibm_scan_metrics_suppressed: true,
    cognium_export_contains_raw_evidence: false,
  },
  tool_order: selectedToolIds,
  cases: selectedCases.map((testCase) => ({
    id: testCase.id,
    mode: testCase.mode,
    path: testCase.path,
    expected_criteria: expectedCriteria(testCase),
  })),
  tools,
};

fs.writeFileSync(path.join(HERE, 'results.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
fs.writeFileSync(path.join(HERE, 'REPORT.md'), renderReport(snapshot));
console.log(`\nWrote comparison/results.json and comparison/REPORT.md`);
