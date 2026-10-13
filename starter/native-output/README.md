# Native-output disclosure

Replace this file with the truth about your bundle. One of the following.

## If you can redistribute raw output

Commit it here, one file per case or per run, and say what it is. A reader who
re-runs the product should be able to diff their output against yours.

## If you cannot

Say why — product terms, size, or evidence that cannot be published — and
publish a digest instead. Every outcome in `result.json` carries a
`sha256:` digest of the native output used for that case, so a party holding
the corresponding artifact can verify its identity.

A digest does not reconstruct the omitted evidence and is not independent
reproduction. Say that too.

## What must never appear here

Credentials, licence keys, customer targets, production captures, private
selectors, personal information or internal paths. The corpus is public
synthetic input; a conforming run does not need private evidence.

## Corrections

Never replace a digest silently. A correction is a new immutable bundle that
links to the one it supersedes.
