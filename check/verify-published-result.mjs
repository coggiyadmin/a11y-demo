// Disclosure and immutability check for a Published benchmark result issue.
//
//   node check/verify-published-result.mjs <issue-body-file>
//
// Listing a result confirms two things and no others: the disclosure is
// complete, and the bundle URL will still mean the same thing next year. This
// checks both mechanically so the answer does not depend on who read the issue.
//
// It is not a judgement about the product, the numbers, or the quality of the
// run. Nothing here could be, and the comment it produces says so.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REQUIRED_FIELDS = [
  'Publisher and relationship',
  'Immutable result bundle URL',
  'Corpus revision',
  'Corpus manifest digest',
  'Product and engine lineage',
  'Method and limitations',
];

const CLASSIFICATIONS = ['vendor', 'independent', 'academic', 'community', 'maintainer'];

/**
 * Split a GitHub issue-form body into its labelled sections.
 *
 * Issue forms render as `### Label` followed by the value, so the headings are
 * the field names from the template.
 */
export function parseIssueForm(body) {
  const fields = new Map();
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let current = null;
  let buffer = [];

  const flush = () => {
    if (current) fields.set(current, buffer.join('\n').trim());
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = heading[1];
    } else if (current) {
      buffer.push(line);
    }
  }
  flush();

  return fields;
}

/**
 * Is this URL still going to point at the same bytes later?
 *
 * A branch or a bare repository link is not a published result: it changes
 * under the reader, and a benchmark result that changes is not evidence.
 */
export function immutability(url) {
  if (!/^https:\/\//.test(url)) {
    return { immutable: false, kind: null, reason: 'not an https URL' };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { immutable: false, kind: null, reason: 'not a parseable URL' };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  // A DOI or a long-term archive is immutable by the archive's own policy.
  if (host === 'doi.org' || host.endsWith('.doi.org')) return { immutable: true, kind: 'doi' };
  if (host === 'zenodo.org' && /\/records?\/\d+/.test(path)) return { immutable: true, kind: 'zenodo-record' };
  if (host === 'archive.softwareheritage.org') return { immutable: true, kind: 'software-heritage' };
  if (host === 'w3id.org' || host === 'hdl.handle.net') return { immutable: true, kind: 'persistent-identifier' };

  const forge = host === 'github.com' || host === 'gitlab.com' || host === 'codeberg.org' || host === 'bitbucket.org';
  if (forge) {
    // A 40-character SHA anywhere in the path pins the tree.
    if (/\/[0-9a-f]{40}(\/|$)/.test(path)) return { immutable: true, kind: 'commit-pinned' };

    // A release asset or a tagged archive is immutable in practice; a tag can
    // be moved, so say so rather than pretending otherwise.
    if (/\/releases\/download\//.test(path)) return { immutable: true, kind: 'release-asset' };
    if (/\/(archive|releases\/tag)\//.test(path)) {
      return { immutable: true, kind: 'tagged-archive', caveat: 'a tag can be moved; a commit SHA cannot' };
    }

    if (/\/(tree|blob)\/(main|master|develop|trunk|HEAD)(\/|$)/.test(path)) {
      return { immutable: false, kind: 'branch', reason: 'links to a moving branch rather than a pinned revision' };
    }

    return {
      immutable: false,
      kind: 'forge',
      reason: 'no 40-character commit SHA, release asset or tag in the URL',
    };
  }

  return {
    immutable: false,
    kind: 'unknown-host',
    reason: 'not a recognised archive, DOI or commit-pinned forge URL',
  };
}

/** Full disclosure and immutability verdict for one issue body. */
export function verify(body) {
  const fields = parseIssueForm(body);
  const problems = [];
  const notes = [];

  for (const field of REQUIRED_FIELDS) {
    const value = fields.get(field);
    if (!value || /^_?no response_?$/i.test(value)) problems.push(`missing required field: **${field}**`);
  }

  const revision = (fields.get('Corpus revision') ?? '').trim();
  if (revision && !/^[0-9a-f]{40}$/.test(revision)) {
    problems.push(
      `**Corpus revision** must be a full 40-character commit SHA; got \`${revision.slice(0, 60)}\`. ` +
        'A tag or short SHA does not identify the corpus unambiguously.',
    );
  }

  const digest = (fields.get('Corpus manifest digest') ?? '').trim();
  if (digest && !/^sha256:[0-9a-f]{64}$/.test(digest)) {
    problems.push(`**Corpus manifest digest** must match \`sha256:\` plus 64 hex characters; got \`${digest.slice(0, 80)}\`.`);
  }

  const url = (fields.get('Immutable result bundle URL') ?? '').trim().split(/\s+/)[0];
  let bundle = null;
  if (url) {
    bundle = immutability(url);
    if (!bundle.immutable) {
      problems.push(`**Immutable result bundle URL** is not immutable: ${bundle.reason}.`);
    } else if (bundle.caveat) {
      notes.push(`bundle URL is a ${bundle.kind} — ${bundle.caveat}`);
    }
  }

  const publisher = (fields.get('Publisher and relationship') ?? '').toLowerCase();
  const classification = CLASSIFICATIONS.find((value) => publisher.includes(value)) ?? null;
  if (publisher && !classification) {
    problems.push(
      '**Publisher and relationship** must state whether the work is vendor-authored, independent, ' +
        'academic, community or maintainer-authored. The public index separates them.',
    );
  }

  const lineage = fields.get('Product and engine lineage') ?? '';
  if (/wrapper|derived[- ]configuration/i.test(lineage) && !/wrapper_of/i.test(lineage)) {
    problems.push(
      'the lineage describes a wrapper or derived configuration but does not name `wrapper_of`. ' +
        'Two interfaces over one engine are one detection vote, not two.',
    );
  }

  return { ok: problems.length === 0, problems, notes, classification, bundle, fields };
}

export function renderComment(verdict) {
  const lines = [];

  if (verdict.ok) {
    lines.push('Disclosure looks complete and the bundle URL is immutable.');
    lines.push('');
    if (verdict.classification) lines.push(`- classification: **${verdict.classification}**`);
    if (verdict.bundle) lines.push(`- bundle URL: ${verdict.bundle.kind}`);
    for (const note of verdict.notes) lines.push(`- note: ${note}`);
  } else {
    lines.push('This submission is not listable yet. The following need fixing:');
    lines.push('');
    for (const problem of verdict.problems) lines.push(`- ${problem}`);
    lines.push('');
    lines.push('Edit the issue and the check will run again.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    'This check confirms **format and disclosure only**. It is not certification, endorsement, ' +
      'a legal opinion, a judgement about the product or its numbers, or a claim about any ' +
      'production website. See [PUBLISHING_RESULTS.md](../blob/master/PUBLISHING_RESULTS.md).',
  );

  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node check/verify-published-result.mjs <issue-body-file>');
    process.exit(2);
  }
  const verdict = verify(fs.readFileSync(file, 'utf8'));
  console.log(renderComment(verdict));
  process.exit(verdict.ok ? 0 : 1);
}
