# Submission release validation, October 18, 2026

Historical engineering snapshot. For the public entry, video duration and current unresolved evidence, use [October 24 submission status](SUBMISSION_STATUS.md). The public entry is now listed as submitted; the public 2:33 video is a different asset from the 3:49 export below.

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

## Verified public deployment

Release `7c6c37066bccd5fed872b54be4d3db89db1a3b45` is served by the public frontend with `dirty: false` in release.json. Both existing Vercel projects reported successful deployments. All seven GitHub jobs passed: build, browser, checker, contract, deployment-record, proof, and monitor.

The actual production MetaMask SDK also opened and closed its QR dialog successfully with its external relay deliberately blocked. This checks deployed bundle compatibility, not a real phone session.

The post-deployment release checker passed all 17 requested checks, including nine route shells, health/status/readiness, the exact frontend commit, three complete source-fixture evidence responses, and all thirteen retained source windows. The timestamped output is `docs/deployed-release-2026-10-18.json`. Its default pass does not waive the explicitly listed external gaps.

## Refreshed demonstration

The delivered GapWitness-Demo.mp4 is 228.8 seconds (3:49), H.264, 1440 × 1080, with burned-in English captions. The full file decoded successfully. It records the actual public implementation release with no request mocks and independently confirms the retained Sepolia witness at block 11,940,673. The retained metadata and SHA-256 are in recorded-walkthrough.json. It contains no new wallet transaction or independent pilot result. It still needs publication on an accepted public video host.

## External items still pending

- Optional production shared quota activation. The Vercel API returned HTTP 403 for the existing team during this release. No persistent credentials were installed. The checker supports per-process limiting without Redis. See OPERATIONS.md for protected shared-quota settings and the verification command if multi-instance quota coordination is needed.
- An actual phone owner approving the new MetaMask relay flow. The app exposes and builds the integration, but automated injected-wallet tests are not a real phone trial.
- Written organizer confirmation resolving the students-only overview versus the detailed rules allowing independent developers.
- Independent pilot observations. The pilot collection and analyzer are ready, but no independent participant or time-saving number is claimed.
- A genuine station operator signature, only if authorized station publication is claimed. The submission can accurately disclose that station authority is outside the current proof.
- Public updated demo playback URL and final Devpost project/submission confirmation.

The old release had no frontend `release.json`. Run `scripts/check_release.py --expect-commit <full-sha>` after deployment to establish which clean commit is actually served. HTTP route checks establish shell reachability. They do not establish browser interaction or wallet approval.

This document records engineering checks. It does not claim that the hackathon entry has been submitted or accepted.
