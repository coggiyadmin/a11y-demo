## Scope

Describe the cases, contracts or documentation changed and why the change is
the smallest honest unit.

## Evidence

- Standard, platform contract or reviewed task:
- Broken fixture:
- Corrected control or reason one is not possible:
- Expected outcome, including `cannot-tell` boundaries:

## Affiliation and licence

- Product, employer, sponsor or other material relationship affected by this change (write `none` when not applicable):
- Origin and licence of any material not authored for this pull request:

- [ ] I have the right to submit this contribution under Apache-2.0, except for clearly identified third-party material whose compatible terms and notices are included.

## Compatibility

- [ ] Existing case IDs remain stable, or a breaking-change issue and migration are linked.
- [ ] Generated artifacts and `corpus-manifest.json` are committed.
- [ ] Engine lineage is declared for result-contract examples or adapters.
- [ ] Changelog and schema documentation are updated when applicable.

## Privacy and safety

- [ ] All data is invented and public synthetic.
- [ ] No credentials, personal information, production captures, private selectors, internal paths or identifying media are included.
- [ ] Motion, flash, media and destructive interactions remain explicitly gated.

## Validation

- [ ] `npm ci --prefix check --ignore-scripts`
- [ ] `node --test check/*.test.mjs`
- [ ] All generators run and `git diff -I '"generated":' --exit-code` is clean.
