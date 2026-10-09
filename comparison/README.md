# Scanner comparison harness

This harness runs popular automated accessibility tools against the same local fixture pages and normalizes their results against the corpus ground truth.

It currently compares:

- Cognium, using a sanitized export from its all-pages proofgraph for the exact declared suite. The public harness imports normalized rule IDs, WCAG criteria and counts; it does not package or invoke the Cognium runtime.
- [axe-core](https://github.com/dequelabs/axe-core), using its WCAG A/AA rule tags directly in Playwright.
- [Pa11y](https://github.com/pa11y/pa11y), using only its HTML_CodeSniffer runner. Its optional axe runner is deliberately excluded because axe-core is already measured directly.
- [IBM Equal Access Accessibility Checker](https://github.com/IBMa/equal-access), using the versioned rule archive and `WCAG_2_2` policy.
- [Lighthouse](https://github.com/GoogleChrome/lighthouse), using only the accessibility category. Lighthouse includes axe-derived audits, so it is a product-configuration comparison rather than an independent rules engine.

Hosted scanning APIs are not part of the default benchmark. The corpus is public, but keeping the run on localhost avoids external submission, credentials and service-specific rate limits. The committed `.npmrc` disables package install scripts, including optional telemetry and browser downloads. IBM scan metrics are suppressed by the harness; its public versioned rule package is the only external resource it needs at runtime.

## Run it

The easiest reproducible route uses the repository's pinned Playwright container. It reruns the four directly packaged tools and combines them with the committed Cognium export:

```sh
docker compose run --rm comparison
```

For a local run with Node 22.19 or later and a compatible Playwright Chromium already installed:

```sh
cd comparison
npm ci
npm run compare
```

Useful variants:

```sh
npm run compare -- --tools axe,ibm
npm run compare -- --suite all --tools axe,pa11y-htmlcs,ibm,lighthouse
node run.mjs --render-only
```

To refresh Cognium, first run it against the exact suite and its required support resources, then import its report directory:

```sh
npm run import:cognium -- --source /path/to/cognium-report
```

The importer requires an error-free, complete, reproducible capture. It reads the all-pages proofgraph—not the sampled headline view—and writes only `cognium-results.json`. Review that sanitized file before committing it. Local paths, URLs, selectors, raw evidence, record identifiers and report prose are not retained.

The default `smoke` suite is declared in `suite.json`. It contains 38 pages: 23 known-defect fixtures and 15 corrected controls. The committed Cognium export covers that declared suite. `--suite all` can run every definite broken or corrected browser fixture for the four directly packaged tools; expanding Cognium requires a matching refreshed export.

Outputs:

- `results.json` is the normalized machine-readable snapshot, including rule IDs, criterion mappings, review counts and sanitized errors.
- `REPORT.md` is generated from that snapshot and is intended for review by people.

## Scoring

The comparison follows the corpus contract:

- A known defect is detected only when a tool finding maps to one of that fixture's `min_criteria` values.
- A corrected control is a false positive only when a finding maps to one of its `must_not_report` values.
- Findings mapped to other criteria are retained as out-of-scope observations, not credited as detections or counted as false positives.
- Review-needed output is recorded separately from automated violations.
- A page with no automated violation is not treated as conformant.

This makes the benchmark stricter than “did the tool print anything?” and avoids rewarding incidental findings.

## Privacy and reproducibility

- Targets are served from an ephemeral `127.0.0.1` port.
- Result files contain fixture-relative paths only, never local workspace paths.
- Raw page content, DOM snippets and screenshots are not saved.
- The Cognium snapshot contains normalized findings and version metadata only; its runtime and raw report remain outside this repository.
- Tool and browser versions are recorded in every snapshot.
- Dependencies are exact-version pinned in `package-lock.json`.
- Durations are diagnostic only; they are machine-dependent and are not used to rank tools.
