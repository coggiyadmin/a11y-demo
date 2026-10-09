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
  note: 'Functional needs, not medical categories. This is the PRIMARY index: every rule '
    + 'and every fixture names the needs it serves, because one requirement usually serves '
    + 'several forms of access at once. A keyboard-access rule supports non-visual operation, '
    + 'alternative input, switch access and voice-control workflows — indexing by criterion alone hides that.',
  source: 'https://www.w3.org/WAI/people-use-web/abilities-barriers/',
  values: [
    { id: 'nonvisual-access', label: 'Non-visual operation', group: 'visual-presentation',
      at: ['screen-reader', 'braille'],
      scenarios: ['screen-reader output', 'keyboard navigation', 'alt text', 'headings',
        'landmarks', 'form labels', 'focus order', 'live announcements',
        'accessible name/role/state', 'audio description'] },
    { id: 'visual-clarity', label: 'Visual clarity and scaling', group: 'visual-presentation',
      at: ['magnifier', 'zoom', 'high-contrast'],
      scenarios: ['zoom', '200-400% reflow', 'text resize', 'contrast', 'text spacing',
        'focus visibility', 'screen magnification', 'content clipping'] },
    { id: 'color-independent', label: 'Colour-independent information', group: 'visual-presentation',
      at: [],
      scenarios: ['information not conveyed by colour alone', 'distinguishable chart series',
        'form errors with text or icons', 'link identification',
        'foreground/background contrast'] },
    { id: 'contrast-adaptation', label: 'Contrast and display adaptation', group: 'visual-presentation',
      at: ['high-contrast', 'forced-colors'],
      scenarios: ['text and non-text contrast', 'forced-colors mode', 'placeholder contrast',
        'disabled-state contrast'] },
    { id: 'text-for-audio', label: 'Text alternatives for audio', group: 'audio-and-alternatives',
      at: ['captions', 'transcript'],
      scenarios: ['captions', 'transcripts', 'speaker identification',
        'meaningful sound descriptions', 'visual alerts',
        'text alternatives for audio instructions'] },
    { id: 'adjustable-audio', label: 'Adjustable and clear audio', group: 'audio-and-alternatives',
      at: ['captions', 'volume-control'],
      scenarios: ['captions', 'background-audio control', 'volume control', 'visual alerts'] },
    // Text and tactile access cannot rely on either an audio-only or visual-only fallback.
    { id: 'text-and-tactile', label: 'Text and tactile access', group: 'combined-access',
      at: ['braille', 'screen-reader'],
      scenarios: ['refreshable-Braille compatibility', 'screen-reader compatibility',
        'keyboard access', 'text alternatives',
        'no audio-only instructions', 'no vision-only instructions'] },
    { id: 'alternative-input', label: 'Alternative input access', group: 'input-and-control',
      at: ['keyboard', 'switch', 'voice-control'],
      scenarios: ['keyboard-only use', 'switch access', 'voice control', 'large targets',
        'target spacing', 'no required dragging', 'no complex gestures', 'generous time limits'] },
    { id: 'error-tolerant-pointer', label: 'Error-tolerant pointer input', group: 'input-and-control',
      at: ['large-targets', 'pointer-cancellation'],
      scenarios: ['target size', 'target spacing', 'pointer cancellation', 'no path gestures'] },
    { id: 'hands-free-switch', label: 'Hands-free and switch operation', group: 'input-and-control',
      at: ['switch', 'voice-control', 'eye-tracking'],
      scenarios: ['switch access', 'voice control', 'full keyboard equivalence'] },
    { id: 'low-effort-interaction', label: 'Low-effort interaction', group: 'input-and-control',
      at: ['reduced-steps', 'save-progress'],
      scenarios: ['reduced interaction cost', 'save progress', 'redundant-entry prevention',
        'extendable time limits'] },
    { id: 'non-voice-alternative', label: 'Non-voice alternatives', group: 'voice-alternatives',
      at: [],
      scenarios: ['alternatives to voice input', 'alternatives to voice authentication',
        'alternatives to telephone-only support'] },
    { id: 'memory-support', label: 'Memory support', group: 'comprehension-and-task',
      at: ['redundant-entry-prevention', 'save-progress'],
      scenarios: ['reduced memory demand', 'redundant-entry prevention',
        'accessible authentication', 'no memory puzzles'] },
    { id: 'focus-support', label: 'Focus and attention support', group: 'comprehension-and-task',
      at: ['reduced-motion', 'pause-controls'],
      scenarios: ['distraction controls', 'pause/stop/hide', 'no unexpected context change'] },
    { id: 'reading-support', label: 'Reading support', group: 'comprehension-and-task',
      at: ['text-spacing', 'read-aloud'],
      scenarios: ['readable typography', 'text spacing overrides', 'uncluttered layout',
        'read-aloud compatibility', 'no images of text'] },
    { id: 'language-clarity', label: 'Language clarity', group: 'comprehension-and-task',
      at: ['plain-language'],
      scenarios: ['clear language', 'understandable errors', 'abbreviations explained',
        'plain-language summaries'] },
    { id: 'task-guidance', label: 'Task guidance and recovery', group: 'comprehension-and-task',
      at: ['clear-steps', 'undo'],
      scenarios: ['consistent navigation', 'clear steps', 'review and confirm',
        'undo', 'sufficient time'] },
    { id: 'flash-safety', label: 'Flash safety', group: 'motion-and-flash',
      at: ['flash-thresholds'],
      scenarios: ['flash thresholds', 'animation controls',
        'avoidance of dangerous visual patterns'] },
    { id: 'motion-safety', label: 'Motion safety', group: 'motion-and-flash',
      at: ['reduced-motion'],
      scenarios: ['prefers-reduced-motion', 'disable parallax', 'disable auto-zoom',
        'no unexpected animation'] },
    { id: 'combined-access', label: 'Combined access requirements', group: 'combined-access',
      at: [],
      scenarios: ['combined testing, e.g. keyboard + screen reader + high contrast'] },
    { id: 'forgiving-interface', label: 'Forgiving interaction', group: 'combined-access',
      at: [],
      scenarios: ['larger text and targets', 'clear instructions', 'good contrast',
        'forgiving input', 'straightforward navigation'] },
    { id: 'constrained-use', label: 'Constrained-use support', group: 'context-and-environment',
      at: [],
      scenarios: ['limited reach', 'reduced input precision', 'interrupted use',
        'slower task completion'] },
    { id: 'environmental-resilience', label: 'Environmental resilience', group: 'context-and-environment',
      at: [],
      scenarios: ['bright sunlight', 'noisy room', 'one-handed use', 'muted audio',
        'slow connectivity'] },
  ],
};

// Colour-independent information needs its own checklist: the failures are specific, recurring, and
// mostly invisible to a contrast-ratio check, because the problem is not contrast —
// it is that colour is carrying information on its own.
T['color-independent-checks'] = {
  note: 'Specific checks for information conveyed through colour. A contrast-ratio test does not '
    + 'catch any of these: two colours can have ample contrast against the background '
    + 'and still be indistinguishable from each other.',
  values: [
    { id: 'error-color-only', label: 'Error, status or selection indicated by colour alone', automatable: 'partial' },
    { id: 'red-green', label: 'Red/green or blue/purple pairs that are hard to distinguish', automatable: 'partial' },
    { id: 'chart-series', label: 'Chart series differing only by colour', automatable: false },
    { id: 'link-color-only', label: 'Links distinguished from body text only by colour', automatable: true },
    { id: 'placeholder-contrast', label: 'Placeholder and disabled-state contrast', automatable: true },
    { id: 'interactive-states', label: 'Hover, focus, selected and active states', automatable: 'partial' },
    { id: 'simulation', label: 'Rendered colour-perception transformations', automatable: true },
    { id: 'without-color', label: 'Patterns, labels, shapes or icons remain understandable without colour', automatable: false },
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
    { id: 'input-only', label: 'Keyboard-, switch-, touch- or voice-control-only completion' },
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
    { id: 'voice-control', label: 'Voice control (Voice Control, Dragon)', automatable: false },
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
    + 'to hide: conflating either with `pass` is how an incomplete scanner looks healthy.',
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

// ─────────────────────────────────────────── display conditions
//
// A scan fixes one condition and reports as if the answer generalised. It does not:
// several criteria are DEFINED against a condition a single config cannot create.
// 1.4.10 Reflow is specified at 320px. 1.3.4 Orientation needs portrait. 2.5.8 is
// about touch. And a driver that runs with prefers-reduced-motion forced on cannot
// observe 2.2.2 or 2.3.x at all, because the motion that is the defect never plays.
T['display-conditions'] = {
  note: 'The display condition is a test axis, not a detail. Measured with '
    + 'check/configs.mjs, which reports only what CHANGES between conditions — a '
    + 'fixture that reads the same everywhere is condition-independent; one that '
    + 'flips is undetectable at every condition except where it flips.',
  values: [
    { id: 'default-desktop', viewport: '1280x900', scale: 1, scheme: 'light',
      motion: 'no-preference', note: 'what a typical scan uses' },
    { id: 'reduced-motion', viewport: '1280x900', scale: 1, scheme: 'light',
      motion: 'reduce',
      note: 'MEASURED: with motion reduced, an unguarded infinite animation reports '
        + '0 running animations — identical to a correctly guarded one. 2.2.2 and '
        + '2.3.x become unobservable.' },
    { id: 'mobile-portrait', viewport: '375x667', scale: 2, scheme: 'light',
      motion: 'no-preference', touch: true,
      note: 'MEASURED: orientation-locked content drops from 9 visible elements to 4' },
    { id: 'reflow-320', viewport: '320x900', scale: 1, scheme: 'light',
      motion: 'no-preference', note: '1.4.10 Reflow is specified at this width' },
    { id: 'dark', viewport: '1280x900', scale: 1, scheme: 'dark', motion: 'no-preference' },
    { id: 'forced-colors', viewport: '1280x900', scale: 1, scheme: 'light',
      motion: 'no-preference', forcedColors: 'active',
      note: 'Windows high contrast; author colours are discarded' },
  ],
  criteria_that_need_a_specific_condition: {
    '1.4.10': 'reflow-320', '1.3.4': 'mobile-portrait', '2.5.8': 'mobile-portrait',
    '1.4.1': 'forced-colors', '1.4.11': 'forced-colors',
    '2.2.2': 'any condition with motion NOT reduced',
    '2.3.1': 'any condition with motion NOT reduced',
    '2.3.2': 'any condition with motion NOT reduced',
    '2.3.3': 'any condition with motion NOT reduced',
  },
};

// ─────────────────────────────────────────── criterion -> functional needs
//
// THE primary mapping. Attach every rule to the needs it serves, because one
// requirement usually serves several forms of access: keyboard access (2.1.1) supports
// non-visual operation, alternative input, switch access and voice-control workflows.
// A criterion-first report cannot show that one fix improves several functional needs.
//
// Derived from the WCAG "who benefits" guidance per criterion, not invented here.
T['criterion-needs'] = {
  note: 'Which functional needs each success criterion serves. A fixture inherits needs '
    + 'from the criteria it exercises unless it names its own, so coverage by need stays '
    + 'correct without hand-annotating every case.',
  values: Object.entries({
    '1.1.1': ['nonvisual-access', 'visual-clarity', 'text-and-tactile', 'language-clarity', 'environmental-resilience'],
    '1.2.1': ['text-for-audio', 'adjustable-audio', 'nonvisual-access', 'text-and-tactile', 'environmental-resilience'],
    '1.2.2': ['text-for-audio', 'adjustable-audio', 'text-and-tactile', 'language-clarity', 'environmental-resilience'],
    '1.2.3': ['nonvisual-access', 'visual-clarity', 'text-and-tactile', 'focus-support'],
    '1.2.5': ['nonvisual-access', 'visual-clarity', 'text-and-tactile'],
    '1.3.1': ['nonvisual-access', 'visual-clarity', 'text-and-tactile', 'memory-support', 'language-clarity', 'task-guidance'],
    '1.3.2': ['nonvisual-access', 'text-and-tactile', 'memory-support', 'language-clarity'],
    '1.3.4': ['alternative-input', 'hands-free-switch', 'visual-clarity', 'environmental-resilience'],
    '1.3.5': ['memory-support', 'alternative-input', 'low-effort-interaction', 'language-clarity'],
    '1.4.1': ['color-independent', 'nonvisual-access', 'visual-clarity', 'contrast-adaptation', 'language-clarity', 'task-guidance'],
    '1.4.2': ['adjustable-audio', 'nonvisual-access', 'focus-support', 'environmental-resilience'],
    '1.4.3': ['visual-clarity', 'contrast-adaptation', 'color-independent', 'forgiving-interface', 'environmental-resilience'],
    '1.4.4': ['visual-clarity', 'forgiving-interface', 'reading-support'],
    '1.4.10': ['visual-clarity', 'forgiving-interface', 'alternative-input', 'environmental-resilience'],
    '1.4.11': ['visual-clarity', 'contrast-adaptation', 'color-independent', 'forgiving-interface'],
    '1.4.12': ['visual-clarity', 'reading-support', 'language-clarity', 'forgiving-interface'],
    '1.4.13': ['visual-clarity', 'error-tolerant-pointer', 'alternative-input', 'nonvisual-access', 'focus-support'],
    '2.1.1': ['nonvisual-access', 'text-and-tactile', 'alternative-input', 'hands-free-switch', 'error-tolerant-pointer', 'non-voice-alternative'],
    '2.1.2': ['nonvisual-access', 'text-and-tactile', 'alternative-input', 'hands-free-switch'],
    '2.2.1': ['memory-support', 'task-guidance', 'alternative-input', 'low-effort-interaction', 'forgiving-interface'],
    '2.2.2': ['focus-support', 'motion-safety', 'flash-safety', 'visual-clarity', 'reading-support'],
    '2.3.1': ['flash-safety'],
    '2.3.3': ['motion-safety', 'focus-support'],
    '2.4.1': ['nonvisual-access', 'alternative-input', 'low-effort-interaction', 'text-and-tactile'],
    '2.4.2': ['nonvisual-access', 'memory-support', 'task-guidance'],
    '2.4.3': ['nonvisual-access', 'text-and-tactile', 'alternative-input', 'focus-support'],
    '2.4.4': ['nonvisual-access', 'visual-clarity', 'language-clarity', 'task-guidance'],
    '2.4.6': ['nonvisual-access', 'language-clarity', 'task-guidance'],
    '2.4.7': ['visual-clarity', 'alternative-input', 'hands-free-switch', 'focus-support', 'forgiving-interface'],
    '2.4.11': ['visual-clarity', 'alternative-input', 'focus-support'],
    '2.5.2': ['error-tolerant-pointer', 'alternative-input', 'forgiving-interface', 'constrained-use'],
    '2.5.3': ['non-voice-alternative', 'alternative-input', 'nonvisual-access'],
    '2.5.4': ['alternative-input', 'error-tolerant-pointer', 'hands-free-switch', 'environmental-resilience'],
    '2.5.7': ['alternative-input', 'error-tolerant-pointer', 'hands-free-switch', 'forgiving-interface'],
    '2.5.8': ['error-tolerant-pointer', 'alternative-input', 'forgiving-interface', 'visual-clarity', 'environmental-resilience'],
    '3.1.1': ['nonvisual-access', 'text-and-tactile', 'language-clarity', 'reading-support'],
    '3.1.2': ['nonvisual-access', 'language-clarity', 'reading-support'],
    '3.2.1': ['focus-support', 'task-guidance', 'nonvisual-access', 'alternative-input'],
    '3.2.2': ['focus-support', 'task-guidance', 'nonvisual-access', 'alternative-input'],
    '3.3.1': ['language-clarity', 'task-guidance', 'nonvisual-access', 'color-independent'],
    '3.3.2': ['language-clarity', 'memory-support', 'nonvisual-access', 'color-independent'],
    '3.3.3': ['language-clarity', 'memory-support', 'task-guidance', 'nonvisual-access'],
    '3.3.7': ['memory-support', 'low-effort-interaction', 'alternative-input', 'task-guidance'],
    '3.3.8': ['memory-support', 'task-guidance', 'alternative-input', 'non-voice-alternative'],
    '4.1.2': ['nonvisual-access', 'text-and-tactile', 'alternative-input', 'non-voice-alternative', 'task-guidance'],
    '4.1.3': ['nonvisual-access', 'text-and-tactile', 'focus-support', 'visual-clarity'],
  }).map(([sc, needs]) => ({ sc, needs })),
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
