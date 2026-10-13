# Release process

Releases are immutable benchmark references. The default branch is development
state; published comparisons should pin a release tag or a full commit SHA.

## Prepare the release pull request

1. Start from the latest green `master` commit.
2. Update `VERSION`, the matching dated section in `CHANGELOG.md`,
   `CITATION.cff` and `releases/v<version>.md`.
3. Run every generator and commit the generated artifacts.
4. Install validation dependencies and run the complete contract, privacy and
   server-security suite:

   ```sh
   npm ci --prefix check --ignore-scripts
   node --test check/*.test.mjs
   ```

5. Generate the candidate assets into a new ephemeral directory and verify the
   checksums:

   ```sh
   output="$(mktemp -d)/a11y-benchmark-v$(tr -d '\n' < VERSION)"
   node release.mjs "$output"
   cd "$output"
   shasum -a 256 -c SHA256SUMS
   ```

6. Review the release metadata and notes. Counts and known gaps must describe
   the pinned corpus honestly; represented dimensions must not be described as
   executed or independently verified.
7. Merge only after CI and maintainer review pass.

## Publish after merge

From a clean checkout of the approved default branch, create an annotated tag:

```sh
git switch master
git pull --ff-only
version="$(tr -d '\n' < VERSION)"
git tag -a "v$version" -m "a11y-benchmark v$version"
git push origin "v$version"
```

The tag-triggered workflow verifies the annotated tag, reruns the complete test
and generation suite, scans every reachable Git object, builds deterministic
release assets and publishes the GitHub release. It refuses a tag that does not
match `VERSION`.

Verify the published release resolves to the approved commit and that
`SHA256SUMS` validates every attached asset. Never move, delete or reuse a
published version tag. Corrections require a new patch release and a link from
the superseded release.

## Privacy and claim boundary

Before tagging, review all reachable heads and tags—not only the current tree.
The automated gate rejects common credentials, private-key material, absolute
home paths, private-file names and non-example email addresses in historical
text blobs. If sensitive material is found, stop the release and coordinate
history remediation privately.

Release notes must state that the corpus and its results are not WCAG
certification, legal advice, a product endorsement or a guarantee about a
production target.
