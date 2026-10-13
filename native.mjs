// Native artifacts for the surfaces that are not web content.
//
// These are real PDF and OOXML byte streams, not HTML pages wearing a costume.
// That is the whole point: a control that reads an HTML page describing a PDF
// has demonstrated nothing about whether it can parse a PDF.
//
// Both families ship the generator alongside the artifact, so the bytes are
// reproducible rather than a binary somebody once produced. Running this file
// twice produces identical output -- no timestamps, no random ids, stored
// (uncompressed) ZIP entries with a fixed DOS date.
//
// The assertions are deliberately narrow and structural: is the document
// tagged, does it declare a language, do its headings carry heading semantics,
// do its images carry alternatives. Whether a heading level reflects the
// outline, or an alternative serves the image, stays a human judgement and is
// not asserted here.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'native');

// --- PDF --------------------------------------------------------------------

/**
 * Assemble a PDF from numbered objects, computing the cross-reference offsets.
 *
 * Offsets are measured over the assembled bytes rather than guessed, which is
 * what makes the result resolvable by any reader that follows the trailer.
 */
function buildPdf({ objects, rootRef }) {
  const header = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  let body = '';
  const offsets = [];

  objects.forEach((object, index) => {
    offsets.push(header.length + body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = header.length + body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${rootRef} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, 'latin1');
}

const contentStream = (text) => {
  const stream = text;
  return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
};

/** An untagged PDF: no structure tree, no document language, not marked. */
function untaggedPdf() {
  const content = [
    'BT /F1 24 Tf 72 700 Td (Quarterly report) Tj ET',
    'BT /F1 12 Tf 72 660 Td (Revenue rose in every region.) Tj ET',
  ].join('\n');

  return buildPdf({
    rootRef: '1 0 R',
    objects: [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R '
        + '/Resources << /Font << /F1 5 0 R >> >> >>',
      contentStream(content),
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ],
  });
}

/**
 * The matched control: same visible content, now tagged.
 *
 * Carries a structure tree whose elements point at marked content in the page,
 * a document language, and a MarkInfo dictionary. It is not presented as
 * PDF/UA conformant -- that is a larger claim than these bytes support.
 */
function taggedPdf() {
  const content = [
    '/H1 <</MCID 0>> BDC',
    'BT /F1 24 Tf 72 700 Td (Quarterly report) Tj ET',
    'EMC',
    '/P <</MCID 1>> BDC',
    'BT /F1 12 Tf 72 660 Td (Revenue rose in every region.) Tj ET',
    'EMC',
  ].join('\n');

  return buildPdf({
    rootRef: '1 0 R',
    objects: [
      '<< /Type /Catalog /Pages 2 0 R /Lang (en-GB) /MarkInfo << /Marked true >> /StructTreeRoot 6 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R '
        + '/Resources << /Font << /F1 5 0 R >> >> /StructParents 0 >>',
      contentStream(content),
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /StructTreeRoot /K [7 0 R] /ParentTree 10 0 R /ParentTreeNextKey 1 >>',
      '<< /Type /StructElem /S /Document /P 6 0 R /K [8 0 R 9 0 R] >>',
      '<< /Type /StructElem /S /H1 /P 7 0 R /Pg 3 0 R /K 0 >>',
      '<< /Type /StructElem /S /P /P 7 0 R /Pg 3 0 R /K 1 >>',
      '<< /Nums [0 [8 0 R 9 0 R]] >>',
    ],
  });
}

// --- OOXML ------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

/**
 * A deterministic ZIP container.
 *
 * Entries are stored rather than deflated and the DOS timestamp is fixed, so
 * the same input always produces the same bytes. A fixture whose digest moves
 * on every regeneration cannot be pinned by a manifest.
 */
function buildZip(entries) {
  const DOS_TIME = 0x0000;
  const DOS_DATE = 0x2821; // 2000-01-01
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, text] of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(text, 'utf8');
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(0, 42);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBytes, end]);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/chart.png"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/></w:style>
</w:styles>`;

const docxDocument = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>
${body}
</w:body>
</w:document>`;

const drawing = (description) => `<w:p><w:r><w:drawing><wp:inline>
<wp:docPr id="1" name="Picture 1"${description === null ? '' : ` descr="${description}"`}/>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="chart.png"${description === null ? '' : ` descr="${description}"`}/>
<pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId2"/></pic:blipFill></pic:pic>
</a:graphicData></a:graphic>
</wp:inline></w:drawing></w:r></w:p>`;

// A paragraph made to LOOK like a heading, with no heading style: large bold
// text that carries no outline semantics.
const fakeHeading = (text) =>
  `<w:p><w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:pPr>`
  + `<w:r><w:rPr><w:b/><w:sz w:val="40"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;

const realHeading = (level, text) =>
  `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;

const paragraph = (text, { lang = null } = {}) =>
  `<w:p><w:r>${lang ? `<w:rPr><w:lang w:val="${lang}"/></w:rPr>` : ''}<w:t>${text}</w:t></w:r></w:p>`;

const PIXEL_PNG = fs.readFileSync(path.join(ROOT, 'pixel.png')).toString('latin1');

function docx({ structured }) {
  const body = structured
    ? [
        realHeading(1, 'Quarterly report'),
        paragraph('Revenue rose in every region.', { lang: 'en-GB' }),
        realHeading(2, 'Regional detail'),
        paragraph('The northern region grew fastest.', { lang: 'en-GB' }),
        drawing('Bar chart: northern region grew 12 per cent, all others under 5 per cent.'),
      ].join('\n')
    : [
        fakeHeading('Quarterly report'),
        paragraph('Revenue rose in every region.'),
        fakeHeading('Regional detail'),
        paragraph('The northern region grew fastest.'),
        drawing(null),
      ].join('\n');

  const sectionEnd = structured
    ? '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>'
    : '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>';

  return buildZip([
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', ROOT_RELS],
    ['word/document.xml', docxDocument(`${body}\n${sectionEnd}`)],
    ['word/_rels/document.xml.rels', DOC_RELS],
    ['word/styles.xml', STYLES],
    ['word/media/chart.png', PIXEL_PNG],
  ]);
}

// --- generate ---------------------------------------------------------------

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(DIR, 'pdf'), { recursive: true });
fs.mkdirSync(path.join(DIR, 'docx'), { recursive: true });

const artifacts = [
  ['pdf/untagged.pdf', untaggedPdf()],
  ['pdf/safe_tagged.pdf', taggedPdf()],
  ['docx/unstructured.docx', docx({ structured: false })],
  ['docx/safe_structured.docx', docx({ structured: true })],
];

for (const [name, bytes] of artifacts) fs.writeFileSync(path.join(DIR, name), bytes);

const digest = (name) =>
  `sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, name))).digest('hex')}`;

const shared = (surface, method) => ({
  surface,
  journey: 'data',
  ui_state: 'default',
  input_at: ['keyboard', 'sr-nvda'],
  method,
  representation: 'native',
  generator: 'native.mjs',
});

const cases = [
  {
    ...shared('pdf', ['document-parse']),
    id: 'native-pdf_untagged',
    mode: 'tp',
    path: 'native/pdf/untagged.pdf',
    artifact_sha256: digest('pdf/untagged.pdf'),
    min_criteria: { '1.3.1': 1, '3.1.1': 1 },
    must_not_report: [],
    expected_outcome: 'fail',
    standard: ['PDF/UA-1 (ISO 14289-1)', 'WCAG 2.2 via WCAG2ICT'],
    user_needs: ['nonvisual-access', 'text-and-tactile', 'reading-support', 'language-clarity'],
    notes:
      'No structure tree, no MarkInfo and no document language. Visually a heading and a paragraph; '
      + 'structurally two undifferentiated runs of text.',
  },
  {
    ...shared('pdf', ['document-parse']),
    id: 'native-safe_pdf_tagged',
    mode: 'safe',
    path: 'native/pdf/safe_tagged.pdf',
    artifact_sha256: digest('pdf/safe_tagged.pdf'),
    min_criteria: {},
    must_not_report: ['1.3.1', '3.1.1'],
    expected_outcome: 'pass',
    standard: ['PDF/UA-1 (ISO 14289-1)', 'WCAG 2.2 via WCAG2ICT'],
    user_needs: ['nonvisual-access', 'text-and-tactile', 'reading-support', 'language-clarity'],
    notes:
      'Matched control: the same visible content with a structure tree, marked content and a document '
      + 'language. Not presented as PDF/UA conformant, which is a larger claim than these bytes support.',
  },
  {
    ...shared('word-processing', ['document-parse']),
    id: 'native-docx_unstructured',
    mode: 'tp',
    path: 'native/docx/unstructured.docx',
    artifact_sha256: digest('docx/unstructured.docx'),
    min_criteria: { '1.3.1': 1, '1.1.1': 1, '3.1.1': 1 },
    must_not_report: [],
    expected_outcome: 'fail',
    standard: ['WCAG 2.2 via WCAG2ICT', 'EN 301 549 clause 10'],
    user_needs: ['nonvisual-access', 'text-and-tactile', 'reading-support', 'language-clarity'],
    notes:
      'Headings are bold 20pt runs with no heading style, the inline image carries no description, '
      + 'and no run declares a language. Visually identical to the control.',
  },
  {
    ...shared('word-processing', ['document-parse']),
    id: 'native-safe_docx_structured',
    mode: 'safe',
    path: 'native/docx/safe_structured.docx',
    artifact_sha256: digest('docx/safe_structured.docx'),
    min_criteria: {},
    must_not_report: ['1.3.1', '1.1.1', '3.1.1'],
    expected_outcome: 'pass',
    standard: ['WCAG 2.2 via WCAG2ICT', 'EN 301 549 clause 10'],
    user_needs: ['nonvisual-access', 'text-and-tactile', 'reading-support', 'language-clarity'],
    notes:
      'Matched control: Heading 1 and Heading 2 styles, a described image, and a language on every run.',
  },
];

fs.writeFileSync(
  path.join(ROOT, 'native.json'),
  `${JSON.stringify(
    {
      description:
        'Native artifacts for non-web surfaces: real PDF and Office Open XML byte streams, not HTML '
        + 'pages describing them. Each defect ships with a matched control whose visible content is the '
        + 'same and whose structure differs only in what the criterion requires.',
      boundary:
        'Assertions are structural: tagging, document language, heading semantics and the presence of '
        + 'image alternatives. Whether a heading level reflects the outline, or an alternative serves '
        + 'the image, is a human judgement and is not asserted here.',
      reproducibility:
        'Generated by native.mjs, committed alongside the artifacts. Output is deterministic: no '
        + 'timestamps, no random identifiers, stored ZIP entries with a fixed DOS date. Each case '
        + 'records the artifact SHA-256.',
      generated: new Date().toISOString().slice(0, 10),
      counts: { pairs: cases.length / 2, cases: cases.length },
      cases,
    },
    null,
    2,
  )}\n`,
);

console.log(`${artifacts.length} native artifacts in ${path.relative(ROOT, DIR)}/`);
for (const [name] of artifacts) console.log(`  ${name.padEnd(28)} ${digest(name)}`);
