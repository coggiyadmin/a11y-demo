# Scanner comparison harness

This harness runs popular automated accessibility tools against the same local fixture pages and normalizes their results against the corpus ground truth.

It currently compares:

- [axe-core](https://github.com/dequelabs/axe-core), using its WCAG A/AA rule tags directly in Playwright.
- [Pa11y](https://github.com/pa11y/pa11y), using only its HTML_CodeSniffer runner. Its optional axe runner is deliberately excluded because axe-core is already measured directly.
- [IBM Equal Access Accessibility Checker](https://github.com/IBMa/equal-access), using the versioned rule archive and `WCAG_2_2` policy.
- [Lighthouse](https://github.com/GoogleChrome/lighthouse), using only the accessibility category. Lighthouse includes axe-derived audits, so it is a product-configuration comparison rather than an independent rules engine.

Hosted scanning APIs are not part of the default benchmark. The corpus is public, but keeping the run on localhost avoids external submission, credentials and service-specific rate limits. The committed `.npmrc` disables package install scripts, including optional telemetry and browser downloads. IBM scan metrics are suppressed by the harness; its public versioned rule package is the only external resource it needs at runtime.

## Run it

The easiest reproducible route uses the repository's pinned Playwright container:

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
npm run compare -- --suite all
node run.mjs --render-only
```

The default `smoke` suite is declared in `suite.json`. It contains 38 pages: 23 known-defect fixtures and 15 corrected controls. `--suite all` runs every definite broken or corrected browser fixture and omits guided checks and indeterminate outcomes.

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
- Tool and browser versions are recorded in every snapshot.
- Dependencies are exact-version pinned in `package-lock.json`.
- Durations are diagnostic only; they are machine-dependent and are not used to rank tools.

