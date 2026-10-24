# Submission status, checked October 24, 2026

GapWitness is publicly listed as submitted to IEEE ClimateChain. The repository's earlier "not yet submitted" and "no public video" statements were stale. This document updates those records while preserving the submitted application source and a reference to its dependency snapshot.

| Item | Observed evidence | Remaining action or limit |
| --- | --- | --- |
| Public entry | [Devpost project](https://devpost.com/software/gapwitness) lists IEEE ClimateChain under Submitted to and embeds the YouTube demo | Organizer acceptance, exact submission time, and prize eligibility are not inferred |
| Published video | [YouTube demo](https://youtu.be/asl9kkF1EHo), Deeen_Codes, published October 18; public metadata reports 153 seconds | This is 2:33, below the rules' 3-minute minimum. Signed-out playback was not established by the metadata lookup |
| Longer retained export | [Walkthrough metadata](recorded-walkthrough.json) records a separate 228.8-second captioned export | That record does not establish a public upload or a Devpost embed of the longer asset |
| Deadline | [Schedule](https://ieee-climatechain-hack.devpost.com/details/dates): October 25 at 14:00 UTC / 15:00 WAT | Absolute time replaces an aging hours-left estimate |
| Eligibility | [Detailed rules](https://ieee-climatechain-hack.devpost.com/rules) allow independent developers and individual submissions; [overview](https://ieee-climatechain-hack.devpost.com/) still says students only | No organizer reply resolving the conflict is recorded. Use the prepared [clarification](ORGANIZER_CLARIFICATION.md) |
| AI | Submitted code uses deterministic checks, browser recomputation and optional Sepolia commitments | No ML or inference is claimed. The technical rubric lists several example tools and does not separately require every project to implement AI |
| Source verification | [Sourcify retained exact match](../contracts/deployments/sourcify-v2.json), creation and runtime | Etherscan is separate. The source-only retry stopped because `ETHERSCAN_API_KEY` is not configured. Current Etherscan verification remains unconfirmed |
| Human benefit | [Pilot workflow](PILOT.md), timing and answer scoring, empty observation template | Independent reviewer time savings, adoption and environmental outcomes remain unmeasured |

The overview promotes AI and blockchain together. A project may still be judged on fit and innovation. The code and presentation should describe the actual deterministic workflow, without implying AI capability or declaring the organizer's eligibility decision.

## Release and open-work inventory

The live `/release.json` reported clean commit `2cc309b84b07624abbcb7251e420e8cc0f738d36` when checked on October 24. This reference is preserved at [`submission/reference-2026-10-24`](https://github.com/Tajudeeen/gapwitness/tree/submission/reference-2026-10-24). It is not an independently recovered submission receipt. The application source in `web/src`, `checker/app`, and `contracts/src` matches walkthrough implementation `7c6c37066bccd5fed872b54be4d3db89db1a3b45`. Dependency manifests and documentation differ. The later public 2:33 recording is a separate asset, so the older 3:49 recording's chain-check timestamp is not attributed to it.

| Open work | Assessment | Treatment |
| --- | --- | --- |
| [PR #61](https://github.com/Tajudeeen/gapwitness/pull/61), reviewer imports, evidence bundles and pilot improvements | Separate feature work on `improve/reviewer-workflow`, head `f3190bad93f4f58390dcfb67ec6e4964f8dc3485`; its recorded web, checker, contract, audit and CodeQL workflows passed | Keep separate from the submitted release. The separate Vite 7.3.7 security fix is now backported without merging these features |
| [PR #51](https://github.com/Tajudeeen/gapwitness/pull/51), FastAPI patch, and [PR #53](https://github.com/Tajudeeen/gapwitness/pull/53), grouped npm updates | Proposed maintenance; checked PR workflows passed | Review after preserving the release reference. Separate tests passing do not prove their combined result |
| [PRs #50, #52, #54–#60](https://github.com/Tajudeeen/gapwitness/pulls), runtime, crypto, compiler, bundler and Actions majors | Changes to compatibility or the build environment | Review individually with migration notes and required checks. An open update is not evidence of a missing product feature |
| [Issue #45](https://github.com/Tajudeeen/gapwitness/issues/45), corrected first-witness deployment | Closed as completed after checking that the retained replay record matches the corrected deployment, preserves all stored fields, has successful receipts and emits zero replay events | This is historical V1 regression evidence, separate from the current publisher-scoped V2 source-backed witness |

A fresh npm audit of Vite 7.3.6 reported one affected dependency with a high-severity advisory. The 7.3.7 patch and its registry integrity were backported from the reviewed branch; all other dependency entries remain unchanged. No PR #61 application features are merged by this cleanup. Historical receipts, CSV bytes, recordings and timestamped release reports are retained. This preserves a short path from the submitted behavior to its source while making later work visible.

## Focused dependency fix

The npm audit flagged Vite 7.3.6, including [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) and [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22). This cleanup pins 7.3.7 and preserves every other installed dependency record. These concern Vite development-server/editor behavior; they do not establish a compromise of the deployed static frontend. The previous application and dependency snapshot remains available on the submission reference branch.

## Etherscan retry

[verify-existing-source.yml](../.github/workflows/verify-existing-source.yml) isolates verification of the existing V2 address. It compiles the recorded deployment commit, prepares the standard JSON compiler input, and calls Etherscan using the existing protected `ETHERSCAN_API_KEY`. It has read-only repository permissions, receives no wallet key, and performs no deployment or transaction broadcast. A missing credential fails explicitly; source verification is recorded only after the provider command succeeds. The older combined final-evidence workflow also performs on-chain fixture operations and is not used for this retry.

[Actual retry run](https://github.com/Tajudeeen/gapwitness/actions/runs/40137945617) stopped at the credential guard: `ETHERSCAN_API_KEY` is not configured in the repository or protected `sepolia` environment. No source submission or transaction occurred. Configure that secret in GitHub, then rerun the source-only workflow. This is a current credential blocker, not evidence of another provider rate limit.

## Check the remaining recorded gaps

```bash
python scripts/check_submission.py --output /tmp/gapwitness-submission-check.json
```

The command checks the records without making network requests or importing the checker. With the current records, it correctly exits nonzero for the short video, unrecorded signed-out playback and unresolved organizer clarification. A publicly listed entry is recorded as submitted without implying acceptance.

After a compliant video is actually uploaded, update its URL, measured duration and metadata in [submission-links.json](submission-links.json). Set `videoPlaybackChecked` only after a real signed-out playback check. Retain an organizer reply before setting `organizerEligibilityConfirmed`. The full live checker uses the same guard when run with `--require-submission`.

Sources were read on October 24. YouTube duration came from a public vidIQ video lookup for `asl9kkF1EHo`; the Devpost entry embeds that same ID. These observations establish what was recorded at that check, not continuous availability.

## Cleanup validation

- 97 Python checker and tooling tests passed, including duration-boundary, draft-listing and unrecorded-playback rejection cases.
- 27 JavaScript evidence and wallet tests passed.
- TypeScript and the production build passed with Vite 7.3.7.
- The patched lockfile's npm audit reports zero known vulnerabilities across production and development dependencies at this check.
- The documented batch command inspected all three frozen fixtures successfully. Local Markdown links resolve.
- No application files in `web/src`, `checker/app` or `contracts/src` changed. The existing source CSVs and transaction receipts remain unchanged.
- The explicit submission check still fails for the 153-second public video, unrecorded signed-out playback and unrecorded organizer clarification. These are disclosed external gaps, not passing checks.
- The source-only Etherscan retry failed at the missing-credential guard before source submission.
