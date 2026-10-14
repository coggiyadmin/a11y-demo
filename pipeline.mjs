// Pipeline-integrity fixtures exercise whether a runner honestly reports what it
// reached and examined. They do not introduce accessibility defects. Each broken
// case carries synthetic execution facts that a conforming runner must reject or
// classify as unsupported, paired with a valid control over the same shape.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'pipeline');

const writePage = (relativePath, title, body) => {
  const directoryDepth = path.dirname(path.posix.join('pipeline', relativePath)).split('/').length;
  const stylesheet = `${'../'.repeat(directoryDepth)}fixture.css`;
  const document = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="${stylesheet}">
</head>
<body>
<main>
<h1>${title}</h1>
${body}
</main>
</body>
</html>`;
  const destination = path.join(DIR, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, document);
};

const deepBroken = [
  'pipeline/deep-site/broken/index.html',
  'pipeline/deep-site/broken/category.html',
  'pipeline/deep-site/broken/results.html',
  'pipeline/deep-site/broken/detail.html',
];
const deepControl = deepBroken.map((page) => page.replace('/broken/', '/control/'));
const entryBroken = [
  'pipeline/entry-sampling/broken/index.html',
  'pipeline/entry-sampling/broken/results.html',
];
const entryControl = entryBroken.map((page) => page.replace('/broken/', '/control/'));
const flowControl = [
  'pipeline/flow/control/index.html',
  'pipeline/flow/control/confirm.html',
];

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

for (const variant of ['broken', 'control']) {
  writePage(`deep-site/${variant}/index.html`, 'Deep-site entry',
    '<p><a href="category.html">Browse the synthetic catalog</a></p>');
  writePage(`deep-site/${variant}/category.html`, 'Deep-site category',
    '<p><a href="results.html">Open the results page</a></p>');
  writePage(`deep-site/${variant}/results.html`, 'Deep-site results',
    '<p><a href="detail.html">Open the final detail page</a></p>');
  writePage(`deep-site/${variant}/detail.html`, 'Deep-site detail',
    '<p>The final sampled page is public synthetic content.</p>');

  writePage(`entry-sampling/${variant}/index.html`, 'Requested entry page',
    '<p><a href="results.html">Open results</a></p>');
  writePage(`entry-sampling/${variant}/results.html`, 'Entry-sampling results',
    '<p>This page links back to the <a href="index.html">requested entry</a>.</p>');
}

writePage('vacuous/zero-examined.html', 'Zero-examined synthetic run',
  '<p>This clean page exposes three native controls. Synthetic evidence reports pass after examining zero.</p><button>One</button> <button>Two</button> <button>Three</button>');
writePage('vacuous/observed-control.html', 'Observed-pass control',
  '<p>This matched control records all three native controls as examined.</p><button>One</button> <button>Two</button> <button>Three</button>');

writePage('flow/no-declaration.html', 'No declared flow',
  '<p>This page has no declared task steps. Flow-anchored criteria must remain un-run or unsupported.</p>');
writePage('flow/control/index.html', 'Declared-flow entry',
  '<p><a href="confirm.html">Continue to confirmation</a></p>');
writePage('flow/control/confirm.html', 'Declared-flow confirmation',
  '<p>The declared two-step task is complete.</p>');

const expectation = ({
  status,
  declaredState,
  stateReached,
  observability,
  examined,
  errorRequired,
  errorCode = null,
  forbidPass = false,
}) => ({
  status,
  declared_state: declaredState,
  state_reached: stateReached,
  target_observability: observability,
  examined_count: examined,
  error: { required: errorRequired, code: errorCode },
  forbidden_verdicts: forbidPass ? ['pass'] : [],
});

const base = {
  surface: 'web',
  ui_state: 'default',
  input_at: ['keyboard'],
  min_criteria: {},
  must_not_report: [],
};

const cases = [
  {
    ...base,
    id: 'pipeline-deep_site-mismatch',
    pair: 'deep_site',
    mode: 'tp',
    path: deepBroken[0],
    entry: deepBroken[0],
    steps: deepBroken,
    scope: 'multi-page',
    journey: 'navigate',
    method: ['crawl', 'regression'],
    assertion: {
      kind: 'sample-capture-consistency',
      inputs: {
        sampled_pages: deepBroken,
        captured_pages: deepBroken.slice(0, 3),
        evaluated_pages: deepBroken.slice(0, 3),
      },
      expected_execution: expectation({
        status: 'error', declaredState: 'complete-site-sample', stateReached: false,
        observability: 'not-observed', examined: { operator: 'unavailable' },
        errorRequired: true, errorCode: 'sample-capture-mismatch', forbidPass: true,
      }),
    },
    notes: 'The sampler selects the detail page, but capture and evaluation omit it. The run must fail closed.',
  },
  {
    ...base,
    id: 'pipeline-deep_site-control',
    pair: 'deep_site',
    mode: 'safe',
    path: deepControl[0],
    entry: deepControl[0],
    steps: deepControl,
    scope: 'multi-page',
    journey: 'navigate',
    method: ['crawl', 'regression'],
    assertion: {
      kind: 'sample-capture-consistency',
      inputs: {
        sampled_pages: deepControl,
        captured_pages: deepControl,
        evaluated_pages: deepControl,
      },
      expected_execution: expectation({
        status: 'completed', declaredState: 'complete-site-sample', stateReached: true,
        observability: 'observed', examined: { operator: 'at-least', value: 1 },
        errorRequired: false,
      }),
    },
    notes: 'Every sampled page exists in both the captured and evaluated sets.',
  },
  {
    ...base,
    id: 'pipeline-entry_not_sampled',
    pair: 'entry_not_sampled',
    mode: 'tp',
    path: entryBroken[0],
    entry: entryBroken[0],
    steps: entryBroken,
    scope: 'multi-page',
    journey: 'navigate',
    method: ['crawl', 'regression'],
    assertion: {
      kind: 'entry-evaluated',
      inputs: { requested_entry: entryBroken[0], evaluated_pages: [entryBroken[1]] },
      expected_execution: expectation({
        status: 'error', declaredState: 'entry-evaluated', stateReached: false,
        observability: 'not-observed', examined: { operator: 'unavailable' },
        errorRequired: true, errorCode: 'entry-not-evaluated', forbidPass: true,
      }),
    },
    notes: 'The requested entry exists but is absent from the evaluated set. A site-level pass is invalid.',
  },
  {
    ...base,
    id: 'pipeline-entry_sampled-control',
    pair: 'entry_not_sampled',
    mode: 'safe',
    path: entryControl[0],
    entry: entryControl[0],
    steps: entryControl,
    scope: 'multi-page',
    journey: 'navigate',
    method: ['crawl', 'regression'],
    assertion: {
      kind: 'entry-evaluated',
      inputs: { requested_entry: entryControl[0], evaluated_pages: entryControl },
      expected_execution: expectation({
        status: 'completed', declaredState: 'entry-evaluated', stateReached: true,
        observability: 'observed', examined: { operator: 'at-least', value: 1 },
        errorRequired: false,
      }),
    },
    notes: 'The requested entry is explicitly present in the evaluated set.',
  },
  {
    ...base,
    id: 'pipeline-vacuous_pass',
    pair: 'vacuous_pass',
    mode: 'tp',
    path: 'pipeline/vacuous/zero-examined.html',
    scope: 'single-page',
    journey: 'input-only',
    method: ['runtime-dom', 'regression'],
    assertion: {
      kind: 'non-vacuous-pass',
      inputs: { reported_verdict: 'pass', reported_examined_count: 0 },
      expected_execution: expectation({
        status: 'error', declaredState: 'rule-execution', stateReached: true,
        observability: 'observed', examined: { operator: 'equals', value: 0 },
        errorRequired: true, errorCode: 'zero-examined', forbidPass: true,
      }),
    },
    notes: 'A reported pass with examined_count 0 must be rejected rather than credited.',
  },
  {
    ...base,
    id: 'pipeline-observed_pass-control',
    pair: 'vacuous_pass',
    mode: 'safe',
    path: 'pipeline/vacuous/observed-control.html',
    scope: 'single-page',
    journey: 'input-only',
    method: ['runtime-dom', 'regression'],
    assertion: {
      kind: 'non-vacuous-pass',
      inputs: { reported_verdict: 'pass', reported_examined_count: 3 },
      expected_execution: expectation({
        status: 'completed', declaredState: 'rule-execution', stateReached: true,
        observability: 'observed', examined: { operator: 'at-least', value: 1 },
        errorRequired: false,
      }),
    },
    notes: 'The matched control distinguishes a real pass after three controls were examined.',
  },
  {
    ...base,
    id: 'pipeline-no_declared_flow',
    pair: 'no_declared_flow',
    mode: 'tp',
    path: 'pipeline/flow/no-declaration.html',
    scope: 'single-page',
    journey: 'navigate',
    method: ['state-exploration', 'regression'],
    // The assertion is about what the runner does when no flow was declared,
    // not about anything in the page.
    state_dependency: 'runner-behaviour',
    assertion: {
      kind: 'declared-flow-required',
      inputs: { flow_declared: false, flow_criteria: ['3.2.3'], declared_steps: [] },
      expected_execution: expectation({
        status: 'unsupported', declaredState: 'declared-flow', stateReached: false,
        observability: 'unknown', examined: { operator: 'unavailable' },
        errorRequired: false, forbidPass: true,
      }),
    },
    notes: 'Without a declared flow, flow-anchored criteria remain unsupported or un-run, never passed.',
  },
  {
    ...base,
    id: 'pipeline-declared_flow-control',
    pair: 'no_declared_flow',
    mode: 'safe',
    path: flowControl[0],
    entry: flowControl[0],
    steps: flowControl,
    scope: 'multi-page',
    journey: 'navigate',
    method: ['state-exploration', 'regression'],
    assertion: {
      kind: 'declared-flow-required',
      inputs: { flow_declared: true, flow_criteria: ['3.2.3'], declared_steps: flowControl },
      expected_execution: expectation({
        status: 'completed', declaredState: 'declared-flow', stateReached: true,
        observability: 'observed', examined: { operator: 'at-least', value: 2 },
        errorRequired: false,
      }),
    },
    notes: 'The matched control declares its entry and both task steps before evaluating the flow criterion.',
  },
];

const indexPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pipeline-integrity fixtures</title>
<link rel="stylesheet" href="../fixture.css">
</head>
<body>
<main>
<h1>Pipeline-integrity fixtures</h1>
<p>These public synthetic cases test capture, sampling, observation and execution accounting rather than rule logic.</p>
<ul>${cases.map((testCase) => `<li><a href="../${testCase.path}">${testCase.id}</a> — ${testCase.mode === 'tp' ? 'must fail closed' : 'matched control'}</li>`).join('\n')}</ul>
</main>
</body>
</html>`;
fs.writeFileSync(path.join(DIR, 'index.html'), indexPage);

fs.writeFileSync(path.join(ROOT, 'pipeline.json'), `${JSON.stringify({
  format: 'cognium-a11y-pipeline-cases',
  format_version: '1.0.0',
  description: 'Public synthetic pipeline-integrity cases. Expected execution fields are assertions about honest runner accounting, not WCAG conformance claims.',
  generated: new Date().toISOString().slice(0, 10),
  cases,
}, null, 2)}\n`);

console.log(`${cases.length} pipeline-integrity cases across ${new Set(cases.map(({ pair }) => pair)).size} matched pairs`);
