# GapWitness

Witness the hours that were missing.

GapWitness checks an hourly environmental CSV against a declared reporting window, reveals missing hours and invalid measurements, and preserves reproducible review evidence. Reviewers can optionally publish compact evidence on Ethereum Sepolia.

A file hash preserves the file it receives. When hours have already been removed, a reviewer also needs the expected schedule and the exact missing timestamps. GapWitness keeps those questions together.

[Open the app](https://gapwitness-web.vercel.app) · [Devpost entry](https://devpost.com/software/gapwitness) · [Public demo](https://www.youtube.com/watch?v=i8ZCdidA6RU) · [Verify the published example](https://gapwitness-web.vercel.app/verify) · [Real datasets](https://gapwitness-web.vercel.app/datasets) · [Service status](https://gapwitness-web.vercel.app/status) · [Documentation](docs/README.md)

[Report a vulnerability](SECURITY.md) · [Dependency maintenance and automated scans](docs/DEPENDENCIES.md) · [Report a bug](https://github.com/Tajudeeen/gapwitness/issues/new?template=bug_report.yml)

## Try the review flow

1. Open [Inspect](https://gapwitness-web.vercel.app/inspect), wait for `checker ready`, and load `File A · 7 deliberate gaps`. The declared 24-hour window contains 17 observations and seven missing hours.
2. Open Review to see missing timestamps, a suggested review action, a printable report, and a local comparison with a prior CSV.
3. Open Evidence to explicitly save the original bytes and evidence in this browser, download them, or reopen and recheck a saved record.
4. Open Publish if you want to submit a testnet witness through a browser wallet or MetaMask mobile/QR pairing. Publishing requires wallet approval and Sepolia test ETH.
5. Open Verify, select `Published File A proof`, and run a fresh check of the original CSV, pinned contract runtime, publisher-scoped record, and transaction.

Inspection and verification don't require a wallet. Use the app's navigation to retain the current inspection. Refreshing clears an unsaved inspection. Browser saves aren't cloud storage or cross-device sync.

The default URL opens the homepage. Current task routes are `/inspect`, `/review`, `/evidence`, `/publish`, `/verify`, `/datasets`, `/pilot`, and `/status`. The 2.6-second splash currently appears only through the legacy `?view=lab` entry. It doesn't run on the homepage or ordinary task navigation.

## What the evidence shows

| Result | Meaning |
| --- | --- |
| `INTACT` | Every expected hour is present and the configured hard rule passes |
| `GAPPED` | One or more expected hours are absent |
| `IMPOSSIBLE` | An in-window PM2.5 measurement violates the non-negative rule |

The checker validates the CSV, then the browser independently recomputes its evidence before enabling publication. The contract stores submitted hashes and a verdict. It doesn't parse the CSV or certify sensor accuracy, station ownership, or scientific truth. Fresh verification depends on the RPC provider and must actually complete before chain confirmation is claimed.

The frozen File A fixture deliberately removes seven hours from a complete AirNow/OpenAQ window. Its available-reading mean is 2.9882 µg/m³ versus 3.2792 µg/m³ for the complete file, an 8.87% reduction. This controlled comparison demonstrates an arithmetic effect of omission. It doesn't establish manipulation or an environmental outcome.

The separate [retained corpus](docs/REAL_CORPUS.md) contains 13 unedited normalized windows from four stations and two providers, including naturally unavailable readings. [Evaluation](docs/EVALUATION.md) covers 601 controlled cases. Independent reviewer time savings and adoption haven't been established. The [pilot](docs/PILOT.md) collects actual paired observations without prefilled results.

## Next-version reviewer workflow

The [reviewer workflow](docs/REVIEWER_WORKFLOW.md) adds an explicit CSV column/timezone/unit preview, portable review bundles that retain original source bytes and replay normalization, and pilot summaries that include slower and incorrect attempts. These additions do not establish independent adoption or change the submitted contract evidence.

## Run locally

Use Python 3.12, Node.js 22 or newer, and npm. Foundry is needed for contract work. Start from the repository root.

In the first terminal:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r checker/requirements.txt
python -m uvicorn app.main:app --app-dir checker --host 127.0.0.1 --port 8000
```

On Windows PowerShell, activate with `.\.venv\Scripts\Activate.ps1`.

In a second terminal:

```bash
cd web
npm ci
cp .env.example .env
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env`. Set `VITE_CHECKER_URL=http://127.0.0.1:8000` in `web/.env`, then open `http://localhost:5173`. Use that exact browser hostname to match the checker's allowed origin. Only `web/` owns the Node package manifest and lockfile.

For a checker container, run this from the repository root:

```bash
docker build -f checker/Dockerfile -t gapwitness-checker .
docker run --rm -p 8000:8000 gapwitness-checker
```

The root Docker ignore file limits the context to checker application code and its requirements. [Configuration and API details](docs/TECHNICAL_REFERENCE.md#configuration) cover origins, request bounds, public build-time variables, and verification commands. Shared Redis quotas are optional. The current fallback is per-process limiting, and the status page reports the active mode.

## Reproduce the checks

With the Python environment active:

```bash
PYTHONPATH=checker python -m pytest checker/tests scripts/test_*.py -q
python checker/demo/run_demo.py
python scripts/verify_real_corpus.py
```

For the frontend:

```bash
cd web
npm test
npm run build
```

[Contributing](CONTRIBUTING.md) includes browser and contract checks. [Release validation](docs/RELEASE_VALIDATION.md) retains the October 18 engineering results and explains which live checks depend on external services. Timestamped reports aren't continuous health guarantees.

## Current testnet proof

| Record | Link |
| --- | --- |
| V2 contract | [Sepolia contract](https://sepolia.etherscan.io/address/0x9988b2aa76e532b9093624ea8672543f368aca82) |
| Published File A witness | [Mined transaction](https://sepolia.etherscan.io/tx/0xbca8fc950d106c7952ec78787bd8b57181d4ec4febb3882653318ea6dea7ad08) |
| Exact source match | [Sourcify](https://repo.sourcify.dev/11155111/0x9988b2aa76e532b9093624ea8672543f368aca82) |
| Retained manifests and receipts | [Deployment records](contracts/deployments/README.md) |

V2 namespaces each station/window record by publisher address. Identical replays preserve the first witness. Conflicting evidence for an occupied key reverts. Historical V1 records remain available for reproducibility and aren't the app's default deployment. See the [technical reference](docs/TECHNICAL_REFERENCE.md#sepolia-deployment-and-live-proof).

## Repository map

| Path | Purpose |
| --- | --- |
| `web/` | React, TypeScript, Vite, wallet integration, and browser evidence checks |
| `checker/` | FastAPI checker, frozen demo fixtures, and Python tests |
| `contracts/` | Solidity contracts, Foundry tests, deployment manifests, and receipts |
| `data/` | Retained source slices, provenance, corpus, and empty pilot template |
| `scripts/` | Data preparation, evaluation, monitoring, and independent verification |
| `docs/` | Technical reference, review workflow, evaluation, operations, and submission evidence |
| `.github/workflows/` | Automated tests, builds, monitoring, and explicitly gated live operations |

## Submission and attribution

[Current submission status](docs/SUBMISSION_STATUS.md) was checked on October 24. The public Devpost page lists this project as submitted. The replacement YouTube demo is 3:53 and meets the stated 3–5 minute duration. Its original-file hash, source snapshot and historical/current proof boundaries are in [demo metadata](docs/recorded-submission-demo.json). Updating the video embed on Devpost remains a separate owner action. [Judge guide](docs/JUDGE_GUIDE.md) gives a short path through the working product and its evidence.

The submitted application uses deterministic checks and optional blockchain commitments. It contains no AI inference component. The rules list several example technologies rather than a separate mandatory AI implementation requirement; see the current status document for the remaining eligibility wording conflict.

Start with the [release checklist](docs/RELEASE_CHECKLIST.md), [submission brief](docs/SUBMISSION.md), and [demo script](docs/DEMO_SCRIPT.md). Public video and Devpost URLs belong in [submission-links.json](docs/submission-links.json). External evidence such as organizer clarification, real phone approval, and independent reviewer observations must be recorded separately from automated tests.

Built by [Deeen_Codes](https://github.com/Tajudeeen). Frozen source attribution belongs to the providers and licenses recorded in the manifests. Those references don't imply endorsement. Original project software and associated documentation are licensed under the [MIT License](LICENSE). See [licensing scope](docs/LICENSING.md) for third-party software and source data.
