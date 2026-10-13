// Minimal PDF structure reader.
//
//   node check/pdf-structure.mjs <file.pdf>
//
// Reports whether a PDF is tagged, what language it declares and what its
// structure tree contains, without rendering it. This is the harness named by
// the `pdf` surface contract.
//
// It resolves objects through the cross-reference table rather than scanning
// for them, so a PDF with wrong xref offsets is reported as broken instead of
// being read anyway. A reader that cannot find an object is exactly what a real
// consumer would hit.
//
// Scope: uncompressed classic PDFs with a single xref table, which is what the
// corpus ships. It is not a general-purpose PDF library and does not attempt
// cross-reference streams, object streams or encryption.

import fs from 'node:fs';

export class PdfError extends Error {}

const latin1 = (buffer) => buffer.toString('latin1');

/** Parse the trailer and the xref table into an offset per object number. */
export function readXref(bytes) {
  const text = latin1(bytes);

  const startxref = text.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
  if (!startxref) throw new PdfError('no startxref before %%EOF');

  const offset = Number(startxref[1]);
  if (text.slice(offset, offset + 4) !== 'xref') {
    throw new PdfError(`startxref ${offset} does not point at an xref table`);
  }

  const header = text.slice(offset).match(/^xref\s+(\d+)\s+(\d+)\s+/);
  if (!header) throw new PdfError('malformed xref header');

  const first = Number(header[1]);
  const count = Number(header[2]);
  const body = text.slice(offset + header[0].length);

  const offsets = new Map();
  for (let index = 0; index < count; index += 1) {
    const entry = body.slice(index * 20, index * 20 + 20);
    const parsed = entry.match(/^(\d{10}) (\d{5}) ([nf])/);
    if (!parsed) throw new PdfError(`malformed xref entry ${first + index}`);
    if (parsed[3] === 'n') offsets.set(first + index, Number(parsed[1]));
  }

  const root = text.match(/\/Root\s+(\d+)\s+0\s+R/);
  if (!root) throw new PdfError('trailer names no /Root');

  return { offsets, root: Number(root[1]), count };
}

/** Read one object's body, verifying the xref offset actually lands on it. */
export function readObject(bytes, offsets, number) {
  const offset = offsets.get(number);
  if (offset === undefined) throw new PdfError(`object ${number} is not in the xref table`);

  const text = latin1(bytes);
  const expected = `${number} 0 obj`;
  if (text.slice(offset, offset + expected.length) !== expected) {
    throw new PdfError(`object ${number}: xref offset ${offset} does not point at "${expected}"`);
  }

  const end = text.indexOf('endobj', offset);
  if (end === -1) throw new PdfError(`object ${number} has no endobj`);
  return text.slice(offset + expected.length, end).trim();
}

/**
 * Walk the structure tree, following /K references.
 *
 * Returns the structure types in document order. A missing child is reported
 * rather than skipped, because a broken tree is a finding.
 */
function walkStructure(bytes, offsets, number, seen = new Set()) {
  if (seen.has(number)) return [];
  seen.add(number);

  let body;
  try {
    body = readObject(bytes, offsets, number);
  } catch (error) {
    return [{ error: error.message }];
  }

  const type = body.match(/\/S\s*\/(\w+)/);
  const elements = type ? [{ type: type[1] }] : [];

  const kids = body.match(/\/K\s*\[([^\]]*)\]/);
  const references = (kids ? kids[1] : '').matchAll(/(\d+)\s+0\s+R/g);
  for (const reference of references) {
    elements.push(...walkStructure(bytes, offsets, Number(reference[1]), seen));
  }

  return elements;
}

export function inspect(bytes) {
  const text = latin1(bytes);

  const version = text.match(/^%PDF-(\d\.\d)/);
  if (!version) throw new PdfError('not a PDF: no %PDF header');

  const { offsets, root, count } = readXref(bytes);

  // Resolve every object the xref claims, so bad offsets surface here.
  const unresolvable = [];
  for (const number of offsets.keys()) {
    try {
      readObject(bytes, offsets, number);
    } catch (error) {
      unresolvable.push(error.message);
    }
  }

  const catalog = readObject(bytes, offsets, root);
  const language = catalog.match(/\/Lang\s*\(([^)]*)\)/);
  const marked = /\/MarkInfo\s*<<[^>]*\/Marked\s+true/.test(catalog);
  const structRoot = catalog.match(/\/StructTreeRoot\s+(\d+)\s+0\s+R/);
  const pages = text.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);

  const structure = structRoot ? walkStructure(bytes, offsets, Number(structRoot[1])) : [];

  return {
    pdf_version: version[1],
    objects: offsets.size,
    xref_entries: count,
    unresolvable_objects: unresolvable,
    // Tagged means all three: a structure tree, marked content, and the catalog
    // saying so. Any one alone is not a tagged PDF.
    tagged: Boolean(structRoot) && marked,
    marked: marked,
    has_structure_tree: Boolean(structRoot),
    document_language: language ? language[1] : null,
    page_count: pages ? Number(pages[1]) : null,
    structure_elements: structure.filter((row) => row.type).map((row) => row.type),
    structure_errors: structure.filter((row) => row.error).map((row) => row.error),
  };
}

export function inspectFile(file) {
  return inspect(fs.readFileSync(file));
}

if (process.argv[1] && process.argv[1].endsWith('pdf-structure.mjs')) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node check/pdf-structure.mjs <file.pdf>');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(inspectFile(file), null, 2));
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exit(1);
  }
}
