// Reference measurement: drives a REAL browser over the served corpus and records,
// for each fixture, facts that are not matters of opinion.
//
// Why this exists. A scanner that reports "pass" having examined zero elements has
// not passed — it has not run. But you cannot call that a bug without an independent
// answer to "how many elements were there to examine?". This produces that answer
// with a pinned browser, so the claim is measured rather than asserted.
//
// Engine-agnostic: it judges no scanner. It emits ground truth about the pages.
//
// usage (inside the container):  node check/reference.mjs
//        BASE_URL=http://corpus:8080 node check/reference.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadFixtureCases } from '../fixture-families.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';

const ALL = loadFixtureCases(ROOT);

/**
 * Walk the real tab order by pressing Tab and seeing where focus lands.
 *
 * Identity is a unique per-element marker, NOT a content fingerprint. Two
 * <input> elements have no textContent and are otherwise identical, so a
 * content fingerprint makes the second one look like the first and trips
 * cycle detection after a single stop — which silently under-reports the
 * tab order on exactly the pages this corpus cares about.
 */
async function tabOrder(page, cap = 600) {
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((e, i) => e.setAttribute('data-a11yref', String(i)));
    document.body.focus();
  });
  const seen = [];
  for (let i = 0; i < cap; i++) {
    await page.keyboard.press('Tab');
    const ref = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      return a.getAttribute('data-a11yref');
    });
    if (ref === null) break;
    // a tab order that returns to its first stop has cycled
    if (seen.length && ref === seen[0]) break;
    seen.push(ref);
  }
  return seen.length;
}

/**
 * How much of the page exists only after script runs.
 *
 * Measured by loading the same URL twice — once with JavaScript disabled, once
 * enabled — and comparing what is actually in the DOM. Comparing raw bytes to
 * `page.content()` does NOT work: DOM serialisation normalises the markup, so
 * the diff is dominated by formatting and can come out negative on a page that
 * demonstrably injects content.
 */
async function clientRenderedShare(browser, url) {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  let noJs = null;
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    noJs = await p.evaluate(() => ({
      elements: document.querySelectorAll('*').length,
      focusable: document.querySelectorAll(
        'a[href],button,input,select,textarea,summary,[contenteditable=true]').length,
    }));
  } catch { /* leave null */ }
  await ctx.close();
  return noJs;
}

const results = [];
const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : {});

for (const c of ALL) {
  const url = `${BASE}/${c.path}`;
  const page = await browser.newPage();
  const row = { id: c.id, mode: c.mode, path: c.path, fixture_family: c.fixture_family };
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    row.http = resp ? resp.status() : null;

    // What a scanner sees if it stops at networkidle, BEFORE the explicit settle.
    // delivery/client_js_delayed.html mounts on a 600ms timer, which networkidle
    // does not wait for — so this column is where a too-eager settle shows up.
    // Uses the SAME shadow-aware walk as the settled count, so the only variable
    // between the two numbers is time. An earlier version used a plain
    // querySelectorAll here, which made every shadow-root fixture look
    // settle-sensitive when it was really just shadow descent.
    row.interactive_at_networkidle = await page.evaluate(() => {
      const collect = (root, acc = []) => {
        for (const e of root.querySelectorAll('*')) { acc.push(e); if (e.shadowRoot) collect(e.shadowRoot, acc); }
        return acc;
      };
      return collect(document).filter((e) =>
        (e.hasAttribute('onclick') || e.getAttribute('role') === 'button')
        && !e.matches('a[href],button,input,select,textarea,summary')
        && e.getAttribute('tabindex') === null).length;
    });

    // Only one fixture intentionally mounts after a timer. Avoid adding a 1.5s tax
    // to every static, manual and journey case now that every family is measured.
    await page.waitForTimeout(c.id === 'delivery-client_js_delayed' ? 1500 : 100);

    // Counted in the built DOM, which is the page a visitor actually meets.
    //
    // Walks OPEN shadow roots as well as the light DOM. A closed root is invisible
    // to script by design, so a 0 here on shadow_dom_closed is the honest answer and
    // the fixture's whole point. Same-origin frames are counted separately below.
    Object.assign(row, await page.evaluate(() => {
      const collect = (root, acc = []) => {
        for (const e of root.querySelectorAll('*')) {
          acc.push(e);
          if (e.shadowRoot) collect(e.shadowRoot, acc);
        }
        return acc;
      };
      const all = collect(document);
      const natively = 'a[href],button,input,select,textarea,summary,[contenteditable=true]';
      const clickableNonFocusable = all.filter((e) =>
        (e.hasAttribute('onclick') || e.getAttribute('role') === 'button')
        && !e.matches(natively)
        && e.getAttribute('tabindex') === null);
      return {
        elements: all.length,
        natively_focusable: all.filter((e) => e.matches(natively)).length,
        tabindex_zero: document.querySelectorAll('[tabindex="0"]').length,
        tabindex_negative: document.querySelectorAll('[tabindex="-1"]').length,
        aria_roles: document.querySelectorAll('[role]').length,
        images: all.filter((e) => e.tagName === 'IMG').length,
        images_unnamed: all.filter((e) => e.tagName === 'IMG'
          && !e.getAttribute('alt') && !e.getAttribute('aria-label')
          && e.getAttribute('role') !== 'presentation').length,
        shadow_hosts: all.filter((e) => e.shadowRoot).length,
        // the shape the keyboard fixtures are about
        pointer_operable_not_focusable: clickableNonFocusable.length,
      };
    }));

    // what lives in child documents, which a scanner must descend into to see
    const frames = page.frames().filter((f) => f !== page.mainFrame());
    row.frames = frames.length;
    if (frames.length) {
      let fImgUnnamed = 0, fNonFocusClick = 0;
      for (const f of frames) {
        try {
          const r = await f.evaluate(() => ({
            imgUnnamed: [...document.querySelectorAll('img')].filter((i) =>
              !i.getAttribute('alt') && !i.getAttribute('aria-label')
              && i.getAttribute('role') !== 'presentation').length,
            nonFocusClick: [...document.querySelectorAll('*')].filter((e) =>
              (e.hasAttribute('onclick') || e.getAttribute('role') === 'button')
              && !e.matches('a[href],button,input,select,textarea,summary')
              && e.getAttribute('tabindex') === null).length,
          }));
          fImgUnnamed += r.imgUnnamed; fNonFocusClick += r.nonFocusClick;
        } catch { /* cross-origin or sandboxed: not reachable, which is the finding */ }
      }
      row.frame_images_unnamed = fImgUnnamed;
      row.frame_pointer_operable_not_focusable = fNonFocusClick;
    }

    row.tab_stops = await tabOrder(page);

    const noJs = await clientRenderedShare(browser, url);
    if (noJs) {
      row.elements_no_js = noJs.elements;
      row.focusable_no_js = noJs.focusable;
      // what a scanner sees if it reads served markup instead of the built page
      row.elements_client_rendered = row.elements - noJs.elements;
      row.focusable_client_rendered = row.natively_focusable - noJs.focusable;
    }
  } catch (e) {
    row.error = String(e.message).split('\n')[0];
  }
  await page.close();
  results.push(row);
  process.stderr.write(`· ${row.id.padEnd(32)} tab=${String(row.tab_stops ?? '-').padStart(4)}` +
    ` focusable=${String(row.natively_focusable ?? '-').padStart(4)}` +
    ` nonfocus_click=${String(row.pointer_operable_not_focusable ?? '-').padStart(2)}` +
    ` img_unnamed=${String((row.images_unnamed ?? 0) + (row.frame_images_unnamed ?? 0)).padStart(2)}` +
    ` nonfocus_in_frame=${String(row.frame_pointer_operable_not_focusable ?? 0).padStart(2)}` +
    ` shadow=${String(row.shadow_hosts ?? 0).padStart(2)}` +
    `${row.error ? '  ERROR ' + row.error : ''}\n`);
}
await browser.close();

const out = {
  description: 'Reference measurements of the fixture corpus, taken with a real browser. '
    + 'These are facts about the pages, not judgements about any scanner. A scanner that '
    + 'reports fewer examined elements than tab_stops here has not examined the page.',
  browser: 'chromium via playwright (see docker-compose.yml for the pinned image)',
  generated: new Date().toISOString(),
  cases: results,
};
fs.writeFileSync(path.join(HERE, 'reference.json'), JSON.stringify(out, null, 2) + '\n');

const errs = results.filter((r) => r.error);
console.log(`\n${results.length} fixtures measured, ${errs.length} errors → check/reference.json`);
if (errs.length) for (const e of errs) console.log(`  ERROR ${e.id}: ${e.error}`);
