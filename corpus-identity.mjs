// Ground-truth identity, used to decide when recorded evidence has expired.
//
// The manifest's own byte digest is the wrong key for this: it moves whenever a
// generator stamps a new `generated` date, which would expire every evidence
// record on a no-op regeneration. Each family's `content_sha256` already
// excludes that date, so folding those together gives a digest that changes
// when, and only when, ground truth changes.

import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * A stable digest of what the corpus asserts.
 *
 * Sorted by family id so the value does not depend on manifest ordering.
 */
export function corpusContentDigest(manifest) {
  const canonical = manifest.families
    .map((family) => `${family.id}:${family.case_count}:${family.content_sha256}`)
    .sort()
    .join('\n');
  return `sha256:${sha256(canonical)}`;
}
