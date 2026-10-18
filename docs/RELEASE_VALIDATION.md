# Submission release validation, October 18, 2026

The release adds on-demand MetaMask mobile/QR pairing, explicit connection and disconnect controls, cancellation protection, Sepolia-only transaction requests, a required-shared-quota startup guard, an exact-source frontend release manifest, and a read-only live-release checker.

## Completed checks

| Check | Actual result |
| --- | --- |
| Python checker and release tooling | 80 tests passed |
| Browser-independent JavaScript evidence and wallet checks | 27 tests passed |
| Chromium browser regression | All 24 tests passed, including the actual SDK crypto/session/QR-dialog regression with its external relay explicitly blocked |
| Solidity contracts | 14 tests passed, including 256 runs for each of two fuzz tests |
| Production frontend build | Passed |
| Production npm dependencies | 0 reported vulnerabilities after pinning the SDK's uuid consumers to patched 11.1.1 |
| Live checker fixtures | All three exact evidence responses matched retained CSV recomputation |
| Retained source corpus | All 13 windows reproduced from retained source data |
| Fresh public Sepolia verification | Pinned runtime, V2 version, publisher, stored evidence, transaction calldata, successful receipt and matching event checked at block 11,940,625 |

The fresh chain check was read-only. No new transaction was sent and no private wallet key was accessed. `web/scripts/verify_live.mjs` reproduces the independent chain verification against actual RPC data. The retained timestamped report is `docs/live-verification-2026-10-18.json`.

The browser suite manages both Vite and the real local Python checker. Its quota allowance is raised only in the test service, so repeated tests cannot exhaust the production-default 30-request limit. Injected wallet and transaction-conflict cases use explicit browser test providers, not real wallet approvals.

## External items still pending

- Production shared quota activation. The Vercel API returned HTTP 403 for the existing team. No persistent credentials were installed. See OPERATIONS.md for exact protected settings and the verification command.
- An actual phone owner approving the new MetaMask relay flow. The app exposes and builds the integration, but automated injected-wallet tests are not a real phone trial.
- Written organizer confirmation resolving the students-only overview versus the detailed rules allowing independent developers.
- Independent pilot observations. The pilot collection and analyzer are ready, but no independent participant or time-saving number is claimed.
- A genuine station operator signature, only if authorized station publication is claimed. The submission can accurately disclose that station authority is outside the current proof.
- Public updated demo playback URL and final Devpost project/submission confirmation.

The old release had no frontend `release.json`. Run `scripts/check_release.py --expect-commit <full-sha>` after deployment to establish which clean commit is actually served. HTTP route checks establish shell reachability. They do not establish browser interaction or wallet approval.

This document records engineering checks. It does not claim that the hackathon entry has been submitted or accepted.
