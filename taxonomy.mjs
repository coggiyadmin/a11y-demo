// The test space, as data.
//
//   surface × user need × journey × UI state × input/AT × platform × standard
//
// Encoding it explicitly matters because the honest answer to "what does this
// corpus cover?" is "a thin slice", and you cannot show a thin slice against a
// space you have not written down. Every dimension below is enumerated so a
// coverage report can divide by the real denominator instead of a flattering one.
//
// Automated tooling cannot decide every requirement. W3C is explicit about this:
// https://www.w3.org/WAI/test-evaluate/tools/selecting/
// So `methods` carries automatable:false entries, and the outcome vocabulary has
// `cannot-tell` and `not-tested` as first-class values rather than failure states.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'taxonomy');

const T = {};

// ─────────────────────────────────────────── user needs (functional, not medical)
// W3C recommends designing around functional need rather than diagnosis:
// https://www.w3.org/WAI/people-use-web/abilities-barriers/
T['user-needs'] = {
  note: 'Functional needs, not medical categories. A fixture names the needs its '
    + 'defect actually blocks, so coverage can be read per need rather than per criterion.',
  source: 'https://www.w3.org/WAI/people-use-web/abilities-barriers/',
  values: [
    { id: 'vision-blind', label: 'Blindness', at: ['screen-reader', 'braille'] },
    { id: 'vision-low', label: 'Low vision', at: ['magnifier', 'zoom', 'high-contrast'] },
    { id: 'vision-color', label: 'Colour-vision deficiency', at: [] },
    { id: 'vision-contrast', label: 'Contrast sensitivity', at: ['high-contrast', 'forced-colors'] },
    { id: 'hearing-deaf', label: 'Deafness', at: ['captions', 'transcript'] },
    { id: 'hearing-hoh', label: 'Hard of hearing', at: ['captions', 'volume-control'] },
    { id: 'motor-dexterity', label: 'Limited dexterity', at: ['keyboard', 'switch', 'speech'] },
    { id: 'motor-tremor', label: 'Tremor', at: ['large-targets', 'pointer-cancellation'] },
    { id: 'motor-paralysis', label: 'Paralysis', at: ['switch', 'speech', 'eye-tracking'] },
    { id: 'motor-fatigue', label: 'Fatigue', at: ['reduced-steps', 'save-progress'] },
    { id: 'speech-unable', label: 'Unable to use voice interfaces', at: [] },
    { id: 'cognitive-memory', label: 'Memory', at: ['redundant-entry-prevention', 'save-progress'] },
    { id: 'cognitive-attention', label: 'Attention', at: ['reduced-motion', 'pause-controls'] },
    { id: 'cognitive-dyslexia', label: 'Dyslexia', at: ['text-spacing', 'read-aloud'] },
    { id: 'cognitive-language', label: 'Language and literacy', at: ['plain-language'] },
    { id: 'cognitive-executive', label: 'Executive function', at: ['clear-steps', 'undo'] },
    { id: 'neuro-seizure', label: 'Seizure sensitivity', at: ['flash-thresholds'] },
    { id: 'neuro-vestibular', label: 'Vestibular and motion sensitivity', at: ['reduced-motion'] },
    { id: 'multiple', label: 'Multiple or intersecting disabilities', at: [] },
    { id: 'age-related', label: 'Age-related impairment', at: [] },
    { id: 'temporary', label: 'Temporary impairment', at: [] },
    { id: 'situational', label: 'Situational limitation', at: [] },
  ],
};

// ─────────────────────────────────────────── surfaces
// WCAG2ICT extends WCAG to non-web software, documents and closed ICT:
// https://www.w3.org/WAI/standards-guidelines/wcag/non-web-ict/
T.surfaces = {
  note: 'What is under test. This corpus is HTML-only; every other surface is '
    + 'enumerated so its absence is visible rather than implied.',
  values: [
    { id: 'web', label: 'Website / web application / PWA', standard: 'WCAG 2.2' },
    { id: 'ios', label: 'iOS / iPadOS native or hybrid', standard: 'WCAG2ICT + Apple HIG' },
    { id: 'android', label: 'Android native or hybrid', standard: 'WCAG2ICT + Android a11y' },
    { id: 'desktop', label: 'Windows / macOS / Linux desktop', standard: 'WCAG2ICT' },
    { id: 'pdf', label: 'PDF', standard: 'PDF/UA-1, PDF/UA-2' },
    { id: 'word-processing', label: 'Word-processing document', standard: 'WCAG2ICT' },
    { id: 'presentation', label: 'Presentation', standard: 'WCAG2ICT' },
    { id: 'spreadsheet', label: 'Spreadsheet', standard: 'WCAG2ICT' },
    { id: 'epub', label: 'EPUB / e-book', standard: 'EPUB Accessibility 1.1' },
    { id: 'media', label: 'Video, audio, podcast, live stream', standard: 'WCAG 2.2' },
    { id: 'email', label: 'Email and messaging content', standard: 'WCAG 2.2' },
    { id: 'kiosk', label: 'Kiosk, ATM, closed-function device', standard: 'Section 508, EN 301 549' },
    { id: 'hardware', label: 'Hardware controls and displays', standard: 'Section 508, EN 301 549' },
    { id: 'authoring', label: 'Authoring tool, CMS, LMS, site builder', standard: 'ATAG 2.0' },
    { id: 'voice', label: 'Voice interface, conversational AI, chatbot', standard: 'WCAG 2.2 + WCAG2ICT' },
    { id: 'dataviz', label: 'Maps, charts, dashboards, data visualisation', standard: 'WCAG 2.2' },
    { id: 'immersive', label: 'AR, VR, games, spatial interfaces', standard: 'XAUR (draft)' },
    { id: 'support', label: 'Support documentation and services', standard: 'Section 508, EN 301 549' },
  ],
};

// ─────────────────────────────────────────── journeys
T.journeys = {
  note: 'Complete tasks, not isolated screens. A component can pass in isolation and '
    + 'still break the task it belongs to — focus lost on a route change, for instance.',
  values: [
    { id: 'auth-signup', label: 'Sign-up, login, logout, account recovery' },
    { id: 'auth-challenge', label: 'Password, passkeys, MFA, CAPTCHA' },
    { id: 'consent', label: 'Cookie consent and privacy settings' },
    { id: 'navigate', label: 'Header nav, menus, search, breadcrumbs' },
    { id: 'form-lifecycle', label: 'Form: blank, valid, invalid, corrected, submitted' },
    { id: 'commerce', label: 'Search, filter, cart, checkout, payment, receipt' },
    { id: 'high-stakes', label: 'Booking, application, healthcare, financial transaction' },
    { id: 'overlay', label: 'Modal dialogs, popovers, tooltips, notifications' },
    { id: 'composite-widget', label: 'Tabs, accordions, carousels, trees, grids, comboboxes' },
    { id: 'transfer', label: 'Drag-and-drop, file upload, file download' },
    { id: 'edge-states', label: 'Loading, empty, error, offline, permission-denied' },
    { id: 'async', label: 'Toasts, async validation, background updates' },
    { id: 'paging', label: 'Infinite scroll, pagination, virtualised content' },
    { id: 'data', label: 'Data tables, charts, maps, dashboards' },
    { id: 'media-player', label: 'Video/audio controls and full-screen' },
    { id: 'realtime', label: 'Live meetings, chat, streaming captions' },
    { id: 'display-adapt', label: 'Zoom, large text, text spacing, display scaling' },
    { id: 'theming', label: 'Dark mode, forced colours, custom themes' },
    { id: 'orientation', label: 'Rotation and small-screen reflow' },
    { id: 'i18n', label: 'Localisation, RTL, mixed-language content' },
    { id: 'session', label: 'Timeout, interruption, resume' },
    { id: 'destructive', label: 'Destructive actions, review, confirmation, undo' },
    { id: 'help', label: 'Help, feedback, complaints, accessibility contact' },
    { id: 'sr-task', label: 'Screen-reader use from start to task completion' },
    { id: 'input-only', label: 'Keyboard-, switch-, touch- or speech-only completion' },
  ],
};

// ─────────────────────────────────────────── UI states
T['ui-states'] = {
  note: 'Every important journey should be tested in each of these. Most corpora test '
    + 'only `default`, which is where the easy defects are and the hard ones are not.',
  values: ['default', 'loading', 'empty', 'invalid', 'corrected', 'submitted',
    'error', 'offline', 'permission-denied', 'timed-out', 'disabled', 'busy']
    .map((id) => ({ id, label: id })),
};

// ─────────────────────────────────────────── input modes and AT
T['input-at'] = {
  note: 'AT pairings are version- and platform-sensitive; a pass with one pairing does '
    + 'not transfer to another. Only `keyboard` and `pointer` are automatable here.',
  values: [
    { id: 'keyboard', label: 'Keyboard only', automatable: true },
    { id: 'pointer', label: 'Mouse / pointer', automatable: true },
    { id: 'touch', label: 'Touch', automatable: 'partial' },
    { id: 'switch', label: 'Switch access', automatable: false },
    { id: 'speech', label: 'Speech control (Voice Control, Dragon)', automatable: false },
    { id: 'sr-voiceover-safari', label: 'VoiceOver + Safari', automatable: false },
    { id: 'sr-talkback-chrome', label: 'TalkBack + Chrome', automatable: false },
    { id: 'sr-nvda', label: 'NVDA + Firefox/Chrome', automatable: false },
    { id: 'sr-jaws', label: 'JAWS + Chrome/Edge', automatable: false },
    { id: 'sr-narrator-edge', label: 'Narrator + Edge', automatable: false },
    { id: 'magnifier', label: 'Screen magnifier', automatable: false },
    { id: 'forced-colors', label: 'Platform high-contrast / forced colours', automatable: 'partial' },
  ],
};

// ─────────────────────────────────────────── methods
T.methods = {
  note: 'A corpus of static fixtures can host the automatable methods and the prompts for '
    + 'guided ones. It cannot host AT testing or user testing — those need people, and '
    + 'pretending otherwise is how a coverage number becomes a lie.',
  values: [
    { id: 'static-source', label: 'Static source analysis', automatable: true },
    { id: 'runtime-dom', label: 'Runtime DOM analysis', automatable: true },
    { id: 'ax-tree', label: 'Accessibility-tree inspection', automatable: true },
    { id: 'visual', label: 'Rendered visual analysis', automatable: true },
    { id: 'interaction', label: 'Interaction automation', automatable: true },
    { id: 'state-exploration', label: 'State exploration', automatable: 'partial' },
    { id: 'crawl', label: 'Site crawling', automatable: true },
    { id: 'component', label: 'Component testing', automatable: true },
    { id: 'document-parse', label: 'Document parsing', automatable: true },
    { id: 'media-analysis', label: 'Media analysis', automatable: 'partial' },
    { id: 'guided-manual', label: 'Guided manual review', automatable: false, needs: 'human' },
    { id: 'at-testing', label: 'Assistive-technology testing', automatable: false, needs: 'human + AT' },
    { id: 'user-testing', label: 'User task testing', automatable: false, needs: 'users with disabilities' },
    { id: 'regression', label: 'Regression monitoring', automatable: true },
    { id: 'ai-assisted', label: 'AI-assisted review', automatable: 'partial', needs: 'human verification' },
  ],
};

// ─────────────────────────────────────────── outcomes
T.outcomes = {
  note: 'Five outcomes, not two. `cannot-tell` and `not-tested` are results, not failures '
    + 'to hide: conflating either with `pass` is how a blind scanner looks healthy.',
  values: [
    { id: 'pass', label: 'Requirement met' },
    { id: 'fail', label: 'Requirement not met' },
    { id: 'inapplicable', label: 'Requirement does not apply to this content' },
    { id: 'cannot-tell', label: 'Examined, but the outcome needs human judgement' },
    { id: 'not-tested', label: 'Not examined — no rule ran, or the content was never reached' },
  ],
  separate_axes: {
    conformance: 'met / not met / not applicable, per criterion and level',
    severity: 'user impact if unresolved — blocker, serious, moderate, minor',
    confidence: 'how certain the result is — definite, probable, possible',
    coverage: 'how much of the space was actually examined',
  },
  warning: 'Keep these four apart. A high automated conformance score over low coverage '
    + 'says almost nothing, and averaging them into one number destroys the information.',
};

// ─────────────────────────────────────────── standards
T.standards = {
  note: 'Versioned, selectable rule packs. Laws are jurisdictional profiles over these, '
    + 'never a "legal pass" badge — conformance evidence is not a legal opinion.',
  values: [
    { id: 'wcag22', label: 'WCAG 2.2 A/AA/AAA', status: 'recommendation', use: 'production baseline' },
    { id: 'act', label: 'ACT Rules', status: 'maintained', use: 'rule definitions and test cases' },
    { id: 'aria12', label: 'WAI-ARIA 1.2 + APG', status: 'recommendation', use: 'custom widgets' },
    { id: 'wcag2ict', label: 'WCAG2ICT', status: 'note', use: 'non-web software, documents, closed ICT' },
    { id: 'atag20', label: 'ATAG 2.0', status: 'recommendation', use: 'authoring tools and generated content' },
    { id: 'uaag', label: 'UAAG', status: 'note', use: 'browsers, media players, user agents' },
    { id: 'section508', label: 'Revised Section 508', status: 'regulation', jurisdiction: 'US federal' },
    { id: 'en301549', label: 'EN 301 549', status: 'standard', jurisdiction: 'EU' },
    { id: 'pdfua', label: 'PDF/UA-1, PDF/UA-2', status: 'standard', use: 'accessible PDF' },
    { id: 'epub-a11y', label: 'EPUB Accessibility 1.1', status: 'standard', use: 'publications' },
    { id: 'platform', label: 'Apple / Android / Windows platform guidance', status: 'vendor' },
    { id: 'house', label: 'Organisation design-system and policy rules', status: 'local' },
    { id: 'wcag3', label: 'WCAG 3', status: 'working draft', use: 'EXPERIMENTAL ONLY — incomplete' },
  ],
  jurisdiction_note: 'The European Accessibility Act has applied to covered EU products and '
    + 'services since 2025-06-28. Represent the EAA and ADA as profiles selecting criteria '
    + 'and surfaces, not as a single pass/fail badge.',
};

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
for (const [name, body] of Object.entries(T)) {
  fs.writeFileSync(path.join(DIR, `${name}.json`), JSON.stringify(body, null, 2) + '\n');
}

const space = ['surfaces', 'user-needs', 'journeys', 'ui-states', 'input-at'].map((k) => T[k].values.length);
fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({
  description: 'The accessibility test space, enumerated. surface x user need x journey x '
    + 'UI state x input/AT x standard. Written down so coverage can be divided by a real '
    + 'denominator rather than a flattering one.',
  dimensions: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.values.length])),
  generated: new Date().toISOString().slice(0, 10),
}, null, 2) + '\n');

console.log('taxonomy written:');
for (const [k, v] of Object.entries(T)) console.log(`  ${k.padEnd(12)} ${String(v.values.length).padStart(3)} values`);
console.log(`\nsurface x need x journey x state x input = ${space.join(' x ')} = ${space.reduce((a, b) => a * b, 1).toLocaleString()} cells`);
console.log(`methods that CANNOT be automated: ${T.methods.values.filter((m) => m.automatable === false).length} of ${T.methods.values.length}`);
