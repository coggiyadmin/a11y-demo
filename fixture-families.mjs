// The fixture manifests are a public interchange boundary. Keep the list in one
// place so coverage reports, needs indexes and browser measurements cannot drift
// into describing different corpora.
import fs from 'node:fs';
import path from 'node:path';

export const FIXTURE_FAMILY_FILES = Object.freeze([
  'catalog.json',
  'delivery.json',
  'patterns.json',
  'color-vision.json',
  'media.json',
  'ui-states.json',
  'journeys.json',
  'scenarios.json',
  'surfaces.json',
  'guided.json',
  'flash.json',
]);

export function loadFixtureFamilies(root) {
  return FIXTURE_FAMILY_FILES
    .map((file) => ({ file, path: path.join(root, file) }))
    .filter(({ path: filePath }) => fs.existsSync(filePath))
    .map(({ file, path: filePath }) => {
      const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(manifest.cases)) {
        throw new TypeError(`${file} must contain a cases array`);
      }
      return { file, manifest };
    });
}

export function loadFixtureCases(root) {
  return loadFixtureFamilies(root)
    .flatMap(({ file, manifest }) => manifest.cases.map((testCase) => ({
      ...testCase,
      fixture_family: file.replace(/\.json$/, ''),
    })));
}

