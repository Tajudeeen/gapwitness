# Contributing to GapWitness

Start with the [README](README.md) and [technical reference](docs/TECHNICAL_REFERENCE.md). Run commands from the repository root unless a command changes directories.

## Report a problem

For vulnerabilities, follow the root [security policy](SECURITY.md). Use public issues for non-sensitive bugs only. Dependency update cadence, lockfile expectations, and audit scope are documented in [dependency maintenance](docs/DEPENDENCIES.md).

Include the affected page or command, steps to reproduce, the declared station and UTC window, and the expected and actual results. Use a small public or synthetic CSV. Include a public transaction hash when relevant. Don't post private datasets, participant records, wallet keys, or populated environment files.

## Make a change

Use a focused branch and explain the behavior being changed. Keep the frozen fixture and corpus bytes intact. Regenerate source-derived files through the documented scripts and retain their manifests. Never edit a recorded receipt or test result to make a check appear successful.

Source-data licenses apply to their recorded datasets. This repository currently has no repository-wide software license. Don't assume a dataset license also licenses the application code.

## Validate the affected layers

Install the checker dependencies in a Python virtual environment, then run:

```bash
PYTHONPATH=checker python -m pytest checker/tests scripts/test_*.py -q
python scripts/test_prepare_chain_demo.py
python scripts/test_record_sepolia_deployment.py
python checker/demo/run_demo.py
python scripts/verify_real_corpus.py
```

For the web app:

```bash
cd web
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Playwright starts the local checker and Vite server. Activate the Python environment first, or set `GAPWITNESS_PYTHON` to its Python executable. The browser suite uses test wallet providers for transaction scenarios. Those results aren't real wallet approvals or live chain proof.

For contract changes:

```bash
cd contracts
forge install https://github.com/foundry-rs/forge-std --no-git
forge build
forge test -vv
```

Don't broadcast deployments or transactions as part of an ordinary test run. Live verification is separate, read-only, and depends on a working RPC provider. See [release validation](docs/RELEASE_VALIDATION.md) for the retained release results and their limits.

## Keep the repository clean

- Install Node dependencies in `web/`, which owns the package manifest and lockfile.
- Keep build outputs, captures, local reports, credentials, and browser caches out of commits.
- Preserve deployment records, retained source data, provenance, and evaluation evidence.
- Update relevant docs when commands, public routes, or evidence boundaries change.
- Describe controlled fixture omissions separately from unavailable readings in the unedited corpus. Report actual pilot observations only.
