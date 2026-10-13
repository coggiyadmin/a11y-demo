# Security and privacy policy

## Reporting a vulnerability

Report vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/cogniumhq/a11y-demo/security/advisories/new).
Do not open a public issue when a report contains an exploit, credential,
personal information, private target, unsafe flashing payload or another detail
that would increase harm.

Include the affected commit, file or endpoint, reproduction conditions, impact
and the least-sensitive evidence that demonstrates the problem. Maintainers aim
to acknowledge a report within three business days. Resolution and disclosure
timing depend on impact and whether a coordinated upstream fix is required.

## Supported versions

The latest tagged release and the default branch receive security and privacy
fixes. Older releases are immutable benchmark references and may be superseded
rather than patched.

## Public-corpus data policy

Only invented, public synthetic data belongs in this repository. Prohibited
content includes:

- credentials, tokens, cookies, session identifiers and private keys;
- customer, participant, employee or other personal information;
- production HTML, screenshots, recordings, selectors or network captures;
- internal hostnames, repository paths or local absolute paths;
- media with identifying metadata;
- unsafe motion or flashing content that runs without an explicit safety gate.

The privacy test scans tracked files and every commit author address. Before a
public release, maintainers also audit all reachable heads and tags because
removing a value from the default branch does not remove it from Git history.

If sensitive data is committed, stop distribution, rotate any affected secret,
and coordinate history remediation privately. Deleting the file in a later
commit is not sufficient.
