# Security policy

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/Tajudeeen/gapwitness/security/advisories/new) when the repository offers **Report a vulnerability**. This route depends on the repository owner's GitHub settings; the presence of this policy does not establish that private reporting is enabled.

If the private reporting form is unavailable, [open a minimal issue](https://github.com/Tajudeeen/gapwitness/issues/new) asking the maintainer to establish a private contact channel. Include only that you have a security report and the affected component. Keep exploit details, restricted CSVs, participant records, wallet keys, tokens, and seed phrases out of public issues. Wait for a private channel before sharing sensitive reproduction material.

For ordinary bugs, use the [bug report form](https://github.com/Tajudeeen/gapwitness/issues/new?template=bug_report.yml). The maintainer is [Tajudeeen / Deeen_Codes](https://github.com/Tajudeeen). Responses are best effort; no response-time guarantee or bounty program is offered.

## Scope and supported code

Security fixes target the current `main` branch, its checker and web application, and the pinned publisher-scoped V2 workflow. Include the exact commit, affected component, impact, minimal reproduction, and expected versus actual behavior in a private report. Use public or synthetic inputs when possible.

Relevant areas include CSV parsing, request admission, evidence recomputation, browser persistence, RPC verification, wallet connection and publication, and the V2 contract's invariants. Historical V1 deployments and recorded proofs are retained for reproducibility. Immutable deployed contracts are not upgraded by changing repository code.

Test locally or against your own test deployment and wallet. Don't exhaust the shared public demo, access another person's data, or send transactions from a wallet you don't control.

## Security evidence and limits

The [threat model](docs/SECURITY.md) documents protections and residual trust. The browser independently recomputes evidence from the original CSV. The contract stores submitted claims rather than executing the checker. Fresh chain verification still trusts its RPC provider and delivered browser code.

[CodeQL](.github/workflows/codeql.yml) analyzes Python and JavaScript/TypeScript. [Dependency audits](.github/workflows/dependency-audit.yml) check npm and Python packages for known advisories. [Dependabot](.github/dependabot.yml) proposes version updates. These checks do not replace contract review, domain validation, or responsible investigation of a report.

See [dependency maintenance](docs/DEPENDENCIES.md) for update cadence, review requirements, and scanning scope. Hosting-side security settings and private reporting availability must be checked separately in GitHub.
