// Minimal Office Open XML structure reader.
//
//   node check/ooxml-structure.mjs <file.docx>
//
// Unzips the container and reports heading styles, document language and image
// alternative text from the main document part. This is the harness named by
// the `word-processing` surface contract.
//
// Scope: stored (uncompressed) and deflated entries in a classic ZIP, which
// covers what the corpus ships and what most producers emit. It is not a
// general-purpose OOXML library.

import fs from 'node:fs';
import zlib from 'node:zlib';

export class OoxmlError extends Error {}

const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_END = 0x06054b50;

/**
 * Read a ZIP container via its central directory.
 *
 * Reading the central directory rather than scanning for local headers is what
 * a real consumer does, so a container with an inconsistent directory is
 * reported as broken instead of being read anyway.
 */
export function unzip(bytes) {
  let end = bytes.length - 22;
  while (end >= 0 && bytes.readUInt32LE(end) !== SIGNATURE_END) end -= 1;
  if (end < 0) throw new OoxmlError('not a ZIP container: no end-of-central-directory record');

  const entryCount = bytes.readUInt16LE(end + 10);
  const directoryOffset = bytes.readUInt32LE(end + 16);

  const entries = new Map();
  let cursor = directoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(cursor) !== SIGNATURE_CENTRAL) {
      throw new OoxmlError(`central directory entry ${index} has a bad signature`);
    }

    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    // The local header's own name and extra lengths decide where data starts;
    // they may differ from the central directory's.
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) entries.set(name, raw);
    else if (method === 8) entries.set(name, zlib.inflateRawSync(raw));
    else throw new OoxmlError(`${name}: unsupported compression method ${method}`);

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

// Deliberately regex-based rather than a full XML parse: the questions asked
// here are about the presence of specific attributes, and a dependency-free
// reader keeps the corpus installable with no toolchain.
const attribute = (tag, name) => new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`, 'g');

export function inspect(bytes) {
  const parts = unzip(bytes);

  for (const required of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    if (!parts.has(required)) throw new OoxmlError(`not a word-processing package: missing ${required}`);
  }

  const document = parts.get('word/document.xml').toString('utf8');

  const headingStyles = [...document.matchAll(attribute('w:pStyle', 'w:val'))]
    .map((match) => match[1])
    .filter((style) => /^Heading\d$/.test(style));

  const languages = [...new Set([...document.matchAll(attribute('w:lang', 'w:val'))].map((match) => match[1]))];

  // Both the drawing wrapper and the picture properties can carry a
  // description; an image is only described if the wrapper has one.
  const drawings = [...document.matchAll(/<wp:docPr\b[^>]*>/g)].map((match) => match[0]);
  const imageAlternatives = drawings.map((tag) => {
    const description = tag.match(/\bdescr="([^"]*)"/);
    return description ? description[1] : null;
  });

  // A run styled large and bold that carries no heading style is a heading in
  // appearance only. Counting these is what makes the defect legible.
  const paragraphs = [...document.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => match[0]);
  const visualOnlyHeadings = paragraphs.filter(
    (paragraph) => /<w:b\s*\/>/.test(paragraph) && /<w:sz\b[^>]*w:val="(?:3[2-9]|[4-9]\d|\d{3,})"/.test(paragraph)
      && !/<w:pStyle\b[^>]*w:val="Heading/.test(paragraph),
  ).length;

  return {
    container_parts: [...parts.keys()].sort(),
    paragraphs: paragraphs.length,
    heading_styles: headingStyles,
    visual_only_headings: visualOnlyHeadings,
    document_language: languages.length > 0 ? languages : null,
    images: imageAlternatives.length,
    image_alternatives: imageAlternatives,
    images_without_alternative: imageAlternatives.filter((value) => value === null || value === '').length,
  };
}

export function inspectFile(file) {
  return inspect(fs.readFileSync(file));
}

if (process.argv[1] && process.argv[1].endsWith('ooxml-structure.mjs')) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node check/ooxml-structure.mjs <file.docx>');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(inspectFile(file), null, 2));
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exit(1);
  }
}
