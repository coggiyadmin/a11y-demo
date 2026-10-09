// Does the display condition change what is observable?
//
// A scan fixes one condition — viewport, colour scheme, scale, motion preference —
// and reports as if the answer generalised. Several WCAG criteria are defined
// against conditions a single config cannot create:
//
//   1.4.10 Reflow            320px wide
//   1.3.4  Orientation       portrait
//   2.5.8  Target Size       touch, not a 1280px desktop pointer
//   1.4.1  Use of Colour     forced-colors mode
//   2.2.2 / 2.3.x            motion actually running
//
// This measures the same pages under several conditions and reports only what
// CHANGES. A fixture that reads the same everywhere is config-independent; one that
// flips is undetectable at every config except the ones where it flips.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';

const CONFIGS = [
  { id: 'default-desktop', viewport: { width: 1280, height: 900 }, colorScheme: 'light',
    reducedMotion: 'no-preference', deviceScaleFactor: 1,
    note: 'what a typical scan uses' },
  { id: 'reduced-motion', viewport: { width: 1280, height: 900 }, colorScheme: 'light',
    reducedMotion: 'reduce', deviceScaleFactor: 1,
    note: 'what the conformis walk driver hard-codes (walk-core.mjs:30)' },
  { id: 'mobile-portrait', viewport: { width: 375, height: 667 }, colorScheme: 'light',
    reducedMotion: 'no-preference', deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    note: 'phone, portrait, touch' },
  { id: 'reflow-320', viewport: { width: 320, height: 900 }, colorScheme: 'light',
    reducedMotion: 'no-preference', deviceScaleFactor: 1,
    note: '1.4.10 Reflow is defined at this width' },
  { id: 'dark', viewport: { width: 1280, height: 900 }, colorScheme: 'dark',
    reducedMotion: 'no-preference', deviceScaleFactor: 1,
    note: 'dark mode' },
  { id: 'forced-colors', viewport: { width: 1280, height: 900 }, colorScheme: 'light',
    reducedMotion: 'no-preference', deviceScaleFactor: 1, forcedColors: 'active',
    note: 'Windows high contrast / forced colours' },
];

const families = ['catalog.json', 'scenarios.json', 'color-vision.json', 'surfaces.json', 'flash.json'];
const cases = families
  .map((f) => path.join(ROOT, f)).filter(fs.existsSync)
  .flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).cases);

/** Observable facts that a display condition can plausibly change. */
const probe = () => {
  const collect = (root, acc = []) => {
    for (const e of root.querySelectorAll('*')) { acc.push(e); if (e.shadowRoot) collect(e.shadowRoot, acc); }
    return acc;
  };
  const all = collect(document);
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const interactive = 'a[href],button,input,select,textarea,summary,[role=button],[onclick]';
  const targets = all.filter((e) => e.matches(interactive) && vis(e));
  return {
    // 1.4.10: content must reflow without a horizontal scrollbar
    h_scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    overflow_px: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    // 1.3.4 / general: is anything hidden at this size?
    visible_elements: all.filter(vis).length,
    // 2.5.8: targets under the 24x24 minimum
    targets_under_24: targets.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width < 24 || r.height < 24;
    }).length,
    // 2.2.2 / 2.3.x: is anything actually animating right now?
    running_animations: document.getAnimations
      ? document.getAnimations().filter((a) => a.playState === 'running').length : null,
    // CSS that would animate indefinitely, whether or not it is playing
    infinite_rules: [...document.styleSheets].reduce((n, s) => {
      try { return n + [...s.cssRules].filter((r) => /infinite/.test(r.cssText || '')).length; }
      catch { return n; }
    }, 0),
  };
};

const browser = await chromium.launch();
const results = {};
for (const cfg of CONFIGS) {
  const { id, note, ...ctxOpts } = cfg;
  const ctx = await browser.newContext(ctxOpts);
  results[id] = {};
  for (const c of cases) {
    const p = await ctx.newPage();
    try {
      try {
        await p.goto(`${BASE}/${c.path}`, { waitUntil: 'networkidle', timeout: 20000 });
      } catch {
        await new Promise((r) => setTimeout(r, 1000));   // one retry: transient DNS/connection
        await p.goto(`${BASE}/${c.path}`, { waitUntil: 'networkidle', timeout: 20000 });
      }
      await p.waitForTimeout(400);
      results[id][c.path] = await p.evaluate(probe);
    } catch (e) { results[id][c.path] = { error: String(e.message).split('\n')[0] }; }
    await p.close();
  }
  await ctx.close();
  const errs = Object.values(results[id]).filter((r) => r.error).length;
  process.stderr.write(`· ${id.padEnd(16)} ${cases.length} pages, ${errs} errors\n`);
  // Silence is not success. A config that could not load its pages produces no
  // differences, which reads identically to "this condition changes nothing" —
  // the failure mode that made an earlier run report three dead configs as clean.
  if (errs > cases.length * 0.1) {
    throw new Error(`config "${id}" failed on ${errs}/${cases.length} pages ` +
      `(first: ${Object.values(results[id]).find((r) => r.error).error}). ` +
      'Refusing to report a comparison from it.');
  }
}
await browser.close();

// ── report only what CHANGES across configs
const base = 'default-desktop';
const fields = ['h_scroll', 'targets_under_24', 'running_animations', 'visible_elements'];
const changed = [];
for (const c of cases) {
  for (const cfg of CONFIGS.map((x) => x.id).filter((x) => x !== base)) {
    const a = results[base][c.path], b = results[cfg][c.path];
    if (!a || !b || a.error || b.error) continue;
    for (const f of fields) {
      if (JSON.stringify(a[f]) !== JSON.stringify(b[f]))
        changed.push({ path: c.path, cfg, field: f, from: a[f], to: b[f] });
    }
  }
}

fs.writeFileSync(path.join(HERE, 'configs.json'), JSON.stringify({
  description: 'The same pages under several display conditions. A fixture whose observable '
    + 'facts change with the condition cannot be assessed from a single config — and a scan '
    + 'that fixes one condition reports as if the answer generalised.',
  configs: CONFIGS, generated: new Date().toISOString(),
  results, changes: changed,
}, null, 2) + '\n');

console.log(`\n${changed.length} observation(s) change with the display condition\n`);
const byCfg = {};
for (const c of changed) (byCfg[c.cfg] ||= []).push(c);
for (const [cfg, rows] of Object.entries(byCfg)) {
  const n = CONFIGS.find((x) => x.id === cfg);
  console.log(`${cfg}  — ${n.note}`);
  for (const r of rows.slice(0, 6)) console.log(`   ${r.path.padEnd(42)} ${r.field}: ${r.from} → ${r.to}`);
  if (rows.length > 6) console.log(`   …+${rows.length - 6} more`);
  console.log();
}
