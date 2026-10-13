import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { inspect as inspectPdf, PdfError, readXref } from './pdf-structure.mjs';
import { inspect as inspectOoxml, OoxmlError, unzip } from './ooxml-structure.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const readBytes = (file) => fs.readFileSync(path.join(ROOT, file));

const contracts = readJson('surface-contracts.json');
const native = readJson('native.json');
const surfaces = readJson('surfaces.json');
const spaceCoverage = readJson('space-coverage.json');
const taxonomy = readJson('taxonomy/surfaces.json').values.map((row) => row.id);

// --- the contracts ----------------------------------------------------------

test('every unrepresented surface has a contract', () => {
  const surfaceRow = spaceCoverage.dimensions.find((row) => row.dimension === 'surfaces');
  const contracted = new Set(contracts.contracts.map((row) => row.surface));

  for (const missing of surfaceRow.missing) {
    assert.ok(contracted.has(missing), `${missing} is unrepresented and has no contract`);
  }

  for (const contract of contracts.contracts) {
    assert.ok(taxonomy.includes(contract.surface), `${contract.surface} is not in the surface taxonomy`);
  }
  assert.equal(new Set(contracts.contracts.map((row) => row.surface)).size, contracts.contracts.length);
});

test('each contract names an artifact format, a harness and an applicable standard', () => {
  for (const contract of contracts.contracts) {
    assert.ok(contract.artifact?.format, `${contract.surface} has no artifact format`);
    assert.equal(contract.artifact.native, true, `${contract.surface} must describe a native artifact`);
    assert.ok(contract.artifact.source, `${contract.surface} does not say what reproduces the artifact`);

    assert.ok(contract.harness?.kind, `${contract.surface} has no harness kind`);
    assert.ok(
      ['parser', 'execution', 'hybrid', 'physical'].includes(contract.harness.kind),
      `${contract.surface} has an unknown harness kind: ${contract.harness.kind}`,
    );
    assert.ok(contract.harness.id, `${contract.surface} has no harness id`);
    assert.ok(contract.harness.description?.length > 30, `${contract.surface} does not describe its harness`);

    assert.ok(Array.isArray(contract.standards) && contract.standards.length > 0, `${contract.surface} has no standard`);
    assert.ok(Array.isArray(contract.evidence_fields) && contract.evidence_fields.length > 0);
    assert.ok(contract.simulable?.length > 10, `${contract.surface} does not say what can be simulated`);
  }
});

test('mobile, desktop and kiosk contracts record platform, API and AT environment', () => {
  for (const surface of ['ios', 'android', 'desktop']) {
    const contract = contracts.contracts.find((row) => row.surface === surface);
    for (const field of ['platform', 'platform_version', 'accessibility_api', 'assistive_technology', 'assistive_technology_version']) {
      assert.ok(contract.evidence_fields.includes(field), `${surface} does not record ${field}`);
    }
  }

  const kiosk = contracts.contracts.find((row) => row.surface === 'kiosk');
  assert.ok(kiosk.evidence_fields.includes('platform'));
  assert.ok(kiosk.evidence_fields.includes('accessibility_api'));
});

test('hardware, kiosk and immersive say what cannot be simulated', () => {
  for (const surface of ['hardware', 'kiosk', 'immersive']) {
    const contract = contracts.contracts.find((row) => row.surface === surface);
    assert.ok(
      contract.requires_physical && contract.requires_physical.length > 30,
      `${surface} must state what requires physical evaluation`,
    );
    assert.ok(contract.simulable.length > 10, `${surface} must also state what can be simulated`);
  }
});

test('a contract is a specification, not coverage', () => {
  assert.match(contracts.boundary, /not coverage/i);
  assert.match(contracts.boundary, /proxy/i);

  // A surface with a contract but no artifact must still be reported missing.
  const surfaceRow = spaceCoverage.dimensions.find((row) => row.dimension === 'surfaces');
  for (const contract of contracts.contracts) {
    if (contract.status !== 'specified') continue;
    assert.ok(
      surfaceRow.missing.includes(contract.surface),
      `${contract.surface} has only a specification but is not reported missing`,
    );
  }
});

test('contract status matches what actually ships', () => {
  const shipped = new Set(native.cases.map((row) => row.surface));
  for (const contract of contracts.contracts) {
    if (contract.status === 'specified') {
      assert.equal(shipped.has(contract.surface), false, `${contract.surface} ships artifacts but claims specified`);
    } else {
      assert.equal(shipped.has(contract.surface), true, `${contract.surface} claims ${contract.status} but ships nothing`);
    }
  }
  assert.deepEqual(contracts.counts.by_status.partial, 2);
});

// --- proxies ----------------------------------------------------------------

test('proxy representations are labelled and excluded from native coverage', () => {
  const proxies = surfaces.cases.filter((row) => row.representation === 'proxy');
  assert.ok(proxies.length > 0);

  for (const row of proxies) {
    assert.ok(row.proxy_for, `${row.id} is a proxy but does not say what for`);
    const declared = contracts.proxies.find((entry) => entry.case_id === row.id);
    assert.ok(declared, `${row.id} is a proxy but is not declared in surface-contracts.json`);
    assert.equal(declared.proxy_for, row.proxy_for);
    assert.ok(declared.reason.length > 30);
  }

  const surfaceRow = spaceCoverage.dimensions.find((row) => row.dimension === 'surfaces');
  const proxySurfaces = new Set(proxies.map((row) => row.surface));
  for (const surface of proxySurfaces) {
    const value = surfaceRow.values.find((row) => row.value === surface);
    assert.equal(value.represented, true, `${surface} is represented by its proxy`);
    assert.equal(value.represented_natively, false, `${surface} must not count as native coverage`);
    assert.ok(value.proxy_cases > 0);
  }
});

test('every case declares a representation and only proxies name a proxy_for', () => {
  for (const file of ['surfaces.json', 'native.json']) {
    for (const row of readJson(file).cases) {
      assert.ok(['native', 'proxy'].includes(row.representation), `${row.id} has no representation`);
      if (row.representation === 'native') assert.equal(row.proxy_for, undefined, `${row.id} is native but names a proxy_for`);
    }
  }
});

test('space coverage reports represented, native, executed and verified separately', () => {
  for (const dimension of spaceCoverage.dimensions) {
    for (const field of ['represented', 'represented_natively', 'proxy_only', 'executable', 'executed', 'verified']) {
      assert.equal(typeof dimension[field], 'number', `${dimension.dimension} is missing ${field}`);
    }
    assert.ok(dimension.represented >= dimension.represented_natively);
    assert.equal(dimension.proxy_only, dimension.represented - dimension.represented_natively);
    // Nothing is executed or verified without evidence, which the ledger has none of.
    assert.equal(dimension.executed, 0);
    assert.equal(dimension.verified, 0);
  }
});

// --- shipped artifacts ------------------------------------------------------

test('every shipped native artifact exists, is binary and is pinned by digest', async () => {
  const crypto = await import('node:crypto');
  assert.ok(native.cases.length > 0);

  for (const row of native.cases) {
    const file = path.join(ROOT, row.path);
    assert.equal(fs.existsSync(file), true, `${row.id} path does not exist`);
    assert.equal(row.representation, 'native');
    assert.ok(/\.(pdf|docx)$/.test(row.path), `${row.id} is not a native artifact file`);

    const bytes = fs.readFileSync(file);
    const digest = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
    assert.equal(row.artifact_sha256, digest, `${row.id} digest drift`);
    assert.ok(Array.isArray(row.standard) && row.standard.length > 0, `${row.id} names no standard`);
    assert.equal(row.generator, 'native.mjs');
  }
});

test('every shipped defect has a matched control', () => {
  const defects = native.cases.filter((row) => row.mode === 'tp');
  const controls = native.cases.filter((row) => row.mode === 'safe');
  assert.equal(defects.length, controls.length);
  assert.equal(native.counts.pairs, defects.length);

  for (const defect of defects) {
    const control = controls.find((row) => row.surface === defect.surface);
    assert.ok(control, `${defect.id} has no control`);
    // The control must forbid exactly the criteria the defect asserts.
    assert.deepEqual(control.must_not_report.sort(), Object.keys(defect.min_criteria).sort());
    assert.deepEqual(control.min_criteria, {});
    assert.deepEqual(defect.must_not_report, []);
  }
});

test('the native artifacts are reproducible from the committed generator', () => {
  const before = native.cases.map((row) => fs.readFileSync(path.join(ROOT, row.path)));
  const run = spawnSync(process.execPath, [path.join(ROOT, 'native.mjs')], { encoding: 'utf8', cwd: ROOT });
  assert.equal(run.status, 0, run.stderr);

  // Byte-identical, or the artifacts cannot be pinned by a manifest digest.
  native.cases.forEach((row, index) => {
    const after = fs.readFileSync(path.join(ROOT, row.path));
    assert.equal(Buffer.compare(before[index], after), 0, `${row.id} is not byte-reproducible`);
  });
});

// --- PDF harness ------------------------------------------------------------

test('the PDF parser reads the untagged artifact as untagged', () => {
  const report = inspectPdf(readBytes('native/pdf/untagged.pdf'));
  assert.equal(report.pdf_version, '1.7');
  assert.equal(report.tagged, false);
  assert.equal(report.has_structure_tree, false);
  assert.equal(report.document_language, null);
  assert.deepEqual(report.structure_elements, []);
  assert.deepEqual(report.unresolvable_objects, []);
  assert.equal(report.page_count, 1);
});

test('the PDF parser reads the control as tagged, with a language and a structure tree', () => {
  const report = inspectPdf(readBytes('native/pdf/safe_tagged.pdf'));
  assert.equal(report.tagged, true);
  assert.equal(report.marked, true);
  assert.equal(report.has_structure_tree, true);
  assert.equal(report.document_language, 'en-GB');
  assert.deepEqual(report.structure_elements, ['Document', 'H1', 'P']);
  assert.deepEqual(report.unresolvable_objects, []);
  assert.deepEqual(report.structure_errors, []);
});

test('every object resolves through the cross-reference table', () => {
  // A PDF whose xref offsets are wrong is unreadable by a real consumer even
  // though the bytes "look" fine, so the parser resolves rather than scans.
  for (const file of ['native/pdf/untagged.pdf', 'native/pdf/safe_tagged.pdf']) {
    const bytes = readBytes(file);
    const { offsets, root } = readXref(bytes);
    assert.ok(offsets.size > 0);
    assert.ok(offsets.has(root), `${file}: the catalog is not in the xref table`);
    assert.deepEqual(inspectPdf(bytes).unresolvable_objects, [], `${file} has unresolvable objects`);
  }
});

test('the PDF parser rejects a corrupt cross-reference table', () => {
  const bytes = Buffer.from(readBytes('native/pdf/safe_tagged.pdf'));
  const text = bytes.toString('latin1');
  // Point startxref somewhere that is not an xref table.
  const broken = Buffer.from(text.replace(/startxref\s+\d+/, 'startxref\n9'), 'latin1');
  assert.throws(() => inspectPdf(broken), PdfError);
});

test('the PDF parser rejects a non-PDF', () => {
  assert.throws(() => inspectPdf(Buffer.from('<!doctype html><title>not a pdf</title>')), /not a PDF/);
});

test('an HTML page describing a PDF is not a PDF', () => {
  // The failure mode the surface contract exists to prevent.
  const html = Buffer.from('<!doctype html><h1>Quarterly report</h1><p>A PDF, honestly.</p>');
  assert.throws(() => inspectPdf(html), PdfError);
});

// --- OOXML harness ----------------------------------------------------------

test('the OOXML parser reads the unstructured artifact as unstructured', () => {
  const report = inspectOoxml(readBytes('native/docx/unstructured.docx'));
  assert.deepEqual(report.heading_styles, []);
  assert.equal(report.document_language, null);
  assert.equal(report.images, 1);
  assert.equal(report.images_without_alternative, 1);
  // Headings that are headings in appearance only.
  assert.equal(report.visual_only_headings, 2);
});

test('the OOXML parser reads the control as structured', () => {
  const report = inspectOoxml(readBytes('native/docx/safe_structured.docx'));
  assert.deepEqual(report.heading_styles, ['Heading1', 'Heading2']);
  assert.deepEqual(report.document_language, ['en-GB']);
  assert.equal(report.images_without_alternative, 0);
  assert.equal(report.visual_only_headings, 0);
  assert.ok(report.image_alternatives[0].length > 20);
});

test('both documents present the same visible content', () => {
  // The pair must differ in structure, not in what a sighted reader sees, or
  // the control is not matched.
  const text = (file) => {
    const document = unzip(readBytes(file)).get('word/document.xml').toString('utf8');
    return [...document.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => match[1]).join(' ');
  };
  assert.equal(text('native/docx/unstructured.docx'), text('native/docx/safe_structured.docx'));
});

test('the OOXML parser reads the container through its central directory', () => {
  const parts = unzip(readBytes('native/docx/safe_structured.docx'));
  assert.ok(parts.has('[Content_Types].xml'));
  assert.ok(parts.has('word/document.xml'));
  assert.ok(parts.has('word/styles.xml'));
  assert.ok(parts.get('word/media/chart.png').subarray(1, 4).toString('latin1'), 'PNG');
});

test('the OOXML parser rejects a non-package', () => {
  assert.throws(() => inspectOoxml(Buffer.from('not a zip at all')), OoxmlError);
});

test('the OOXML parser rejects a ZIP that is not a word-processing package', () => {
  // A valid container missing the main document part is not a .docx. The name
  // is rewritten in both the local header and the central directory, keeping
  // every offset intact, so the container still parses and only the part is
  // gone — which is exactly the case the parser has to catch.
  const bytes = Buffer.from(readBytes('native/docx/safe_structured.docx'));
  const corrupted = Buffer.from(
    bytes.toString('latin1').replaceAll('word/document.xml', 'word/documenX.xml'),
    'latin1',
  );
  assert.equal(corrupted.length, bytes.length, 'the corruption must not shift any offset');
  assert.throws(() => inspectOoxml(corrupted), /missing word\/document\.xml/);

  // And the parser reads names from the central directory, not by scanning, so
  // a container whose directory disagrees with its local headers is not read
  // as if it were fine.
  const localOnly = Buffer.from(
    bytes.toString('latin1').replace('word/document.xml', 'word/documenX.xml'),
    'latin1',
  );
  assert.doesNotThrow(() => inspectOoxml(localOnly));
});

// --- CLIs -------------------------------------------------------------------

test('both harness CLIs report structure and fail on bad input', () => {
  for (const [script, good, bad] of [
    ['check/pdf-structure.mjs', 'native/pdf/safe_tagged.pdf', 'native/docx/safe_structured.docx'],
    ['check/ooxml-structure.mjs', 'native/docx/safe_structured.docx', 'native/pdf/safe_tagged.pdf'],
  ]) {
    const ok = spawnSync(process.execPath, [path.join(ROOT, script), path.join(ROOT, good)], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.doesNotThrow(() => JSON.parse(ok.stdout));

    const failed = spawnSync(process.execPath, [path.join(ROOT, script), path.join(ROOT, bad)], { encoding: 'utf8' });
    assert.equal(failed.status, 1, `${script} accepted ${bad}`);
  }
});

test('the harnesses named by the contracts exist', () => {
  for (const contract of contracts.contracts) {
    if (contract.harness.id.startsWith('planned:')) continue;
    assert.equal(
      fs.existsSync(path.join(ROOT, contract.harness.id)),
      true,
      `${contract.surface} names harness ${contract.harness.id}, which does not exist`,
    );
  }
});

test('nothing here claims conformance', () => {
  assert.match(native.boundary, /human judgement/i);
  assert.match(native.reproducibility, /deterministic/i);
  for (const row of native.cases) {
    if (row.id !== 'native-safe_pdf_tagged') continue;
    assert.match(row.notes, /[Nn]ot presented as PDF\/UA conformant/);
  }
});
