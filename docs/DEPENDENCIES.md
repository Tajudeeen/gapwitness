# Dependency maintenance

## Reproducible frontend installs

Run `npm ci` from `web/`. The committed `package-lock.json` records the resolved dependency tree and integrity values. `npm ci` rejects a manifest/lock mismatch rather than silently rewriting the lockfile.

Direct frontend dependencies and development tools are exact-pinned to the versions already recorded in the lockfile. `web/.npmrc` keeps future direct additions exact by default. This policy does not replace the lockfile or independently pin every transitive package. The initial pinning change does not upgrade installed package versions.

Caret ranges in earlier manifests did not by themselves make `npm ci` nondeterministic. They allowed compatible version selection when intentionally resolving or updating a lockfile. SemVer compatibility is a declared contract, not a guarantee against upstream defects.

## Update cadence and review

Dependabot checks npm, pip, GitHub Actions, and the checker Docker base image weekly on Monday. Minor and patch version updates are grouped within supported ecosystems, while major versions remain separate proposals. There is no automatic merge or approval policy. Inspect security alerts promptly when available rather than waiting for the weekly version-update schedule.

For a frontend update, review the manifest and lock diff, run `npm ci`, `npm test`, `npm run build`, the browser suite, and the dependency audit. Wallet SDK changes also need the actual SDK initialization/QR regression. Keep the existing patched uuid override until its consumers and audit results establish that it is no longer needed.

For a checker update, review direct and resolved transitive versions, run checker/source-pipeline tests, corpus verification, API/browser integration, and the container build. `checker/requirements.txt` pins direct packages, but it is not a complete hash-locked transitive environment. Platform and resolver differences must not be described as fully locked Python reproducibility.

Contract source changes require Foundry tests, source/runtime review, and a separately authorized deployment if needed. An updated repository does not upgrade an immutable deployed contract.

## Automated scanning

- `dependency-audit` runs on pushes to main, pull requests, manual dispatch, and a weekly schedule. npm audits include production and development packages and fail at high severity or above. The complete JSON report is retained for review, including lower-severity findings.
- The Python audit resolves `checker/requirements.txt` with pip-audit and fails when known vulnerabilities are reported. It includes resolved transitive dependencies. No advisory suppression is configured.
- `codeql` analyzes Python and JavaScript/TypeScript with the security-extended query suite on pushes to main, pull requests, manual dispatch, and a weekly schedule. It does not analyze Solidity or prove sensor/scientific correctness.

Registry outages, resolution failures, or scanner errors are failed checks, not clean security results. A successful workflow also does not mean no alerts exist: inspect the audit output and GitHub code-scanning results. No scan constitutes a complete security audit.

GitHub-hosted Dependabot alerts, security-update settings, private reporting, and code-scanning availability are repository settings that must be verified separately. Committing a configuration alone does not prove every hosted feature is active. See the root [security policy](../SECURITY.md) and [threat model](SECURITY.md).

## Tool documentation

- [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/)
- [Dependabot configuration](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates)
- [CodeQL Action](https://github.com/github/codeql-action)
- [pip-audit action](https://github.com/pypa/gh-action-pip-audit)
