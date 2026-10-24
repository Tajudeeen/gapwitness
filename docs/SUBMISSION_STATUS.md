# Submission status, checked October 24, 2026

GapWitness is publicly listed as submitted to IEEE ClimateChain. The repository's earlier "not yet submitted" and "no public video" statements were stale. This document updates those records without changing the submitted application.

| Item | Observed evidence | Remaining action or limit |
| --- | --- | --- |
| Public entry | [Devpost project](https://devpost.com/software/gapwitness) lists IEEE ClimateChain under Submitted to and embeds the YouTube demo | Organizer acceptance, exact submission time, and prize eligibility are not inferred |
| Published video | [YouTube demo](https://youtu.be/asl9kkF1EHo), Deeen_Codes, published October 18; public metadata reports 153 seconds | This is 2:33, below the rules' 3-minute minimum. Signed-out playback was not established by the metadata lookup |
| Longer retained export | [Walkthrough metadata](recorded-walkthrough.json) records a separate 228.8-second captioned export | That record does not establish a public upload or a Devpost embed of the longer asset |
| Deadline | [Schedule](https://ieee-climatechain-hack.devpost.com/details/dates): October 25 at 14:00 UTC / 15:00 WAT | Absolute time replaces an aging hours-left estimate |
| Eligibility | [Detailed rules](https://ieee-climatechain-hack.devpost.com/rules) allow independent developers and individual submissions; [overview](https://ieee-climatechain-hack.devpost.com/) still says students only | No organizer reply resolving the conflict is recorded. Use the prepared [clarification](ORGANIZER_CLARIFICATION.md) |
| AI | Submitted code uses deterministic checks, browser recomputation and optional Sepolia commitments | No ML or inference is claimed. The technical rubric lists several example tools and does not separately require every project to implement AI |
| Source verification | [Sourcify retained exact match](../contracts/deployments/sourcify-v2.json), creation and runtime | Etherscan is separate. October 24 read attempts returned an API-key error and explorer HTTP 403, so current Etherscan verification is unconfirmed |
| Human benefit | [Pilot workflow](PILOT.md), timing and answer scoring, empty observation template | Independent reviewer time savings, adoption and environmental outcomes remain unmeasured |

The overview promotes AI and blockchain together. A project may still be judged on fit and innovation. The code and presentation should describe the actual deterministic workflow, without implying AI capability or declaring the organizer's eligibility decision.

## Release and open-work inventory

The live `/release.json` reported clean commit `2cc309b84b07624abbcb7251e420e8cc0f738d36` when checked on October 24. This reference is preserved at [`submission/reference-2026-10-24`](https://github.com/Tajudeeen/gapwitness/tree/submission/reference-2026-10-24). It is not an independently recovered submission receipt. The application source in `web/src`, `checker/app`, and `contracts/src` matches walkthrough implementation `7c6c37066bccd5fed872b54be4d3db89db1a3b45`. Dependency manifests and documentation differ. The later public 2:33 recording is a separate asset, so the older 3:49 recording's chain-check timestamp is not attributed to it.

| Open work | Assessment | Treatment |
| --- | --- | --- |
| [PR #61](https://github.com/Tajudeeen/gapwitness/pull/61), reviewer imports, evidence bundles and pilot improvements | Separate feature work on `improve/reviewer-workflow`, head `f3190bad93f4f58390dcfb67ec6e4964f8dc3485`; its recorded web, checker, contract, audit and CodeQL workflows passed | Keep separate from the submitted release. Its Vite 7.3.7 patch is also on that branch, not the submitted main dependency tree |
| [PR #51](https://github.com/Tajudeeen/gapwitness/pull/51), FastAPI patch, and [PR #53](https://github.com/Tajudeeen/gapwitness/pull/53), grouped npm updates | Proposed maintenance; checked PR workflows passed | Review after preserving the release reference. Separate tests passing do not prove their combined result |
| [PRs #50, #52, #54–#60](https://github.com/Tajudeeen/gapwitness/pulls), runtime, crypto, compiler, bundler and Actions majors | Changes to compatibility or the build environment | Review individually with migration notes and required checks. An open update is not evidence of a missing product feature |
| [Issue #45](https://github.com/Tajudeeen/gapwitness/issues/45), corrected first-witness deployment | Closed as completed after checking that the retained replay record matches the corrected deployment, preserves all stored fields, has successful receipts and emits zero replay events | This is historical V1 regression evidence, separate from the current publisher-scoped V2 source-backed witness |

No dependency upgrades or PR #61 features are merged by this cleanup. Historical receipts, CSV bytes, recordings and timestamped release reports are retained. This preserves a short path from the submitted behavior to its source while making later work visible.

## Etherscan retry

[verify-existing-source.yml](../.github/workflows/verify-existing-source.yml) isolates verification of the existing V2 address. It compiles the recorded deployment commit, prepares the standard JSON compiler input, and calls Etherscan using the existing protected `ETHERSCAN_API_KEY`. It has read-only repository permissions, receives no wallet key, and performs no deployment or transaction broadcast. A missing credential fails explicitly; source verification is recorded only after the provider command succeeds. The older combined final-evidence workflow also performs on-chain fixture operations and is not used for this retry.

## Check the remaining recorded gaps

```bash
python scripts/check_submission.py --output /tmp/gapwitness-submission-check.json
```

The command checks the records without making network requests or importing the checker. With the current records, it correctly exits nonzero for the short video, unrecorded signed-out playback and unresolved organizer clarification. A publicly listed entry is recorded as submitted without implying acceptance.

After a compliant video is actually uploaded, update its URL, measured duration and metadata in [submission-links.json](submission-links.json). Set `videoPlaybackChecked` only after a real signed-out playback check. Retain an organizer reply before setting `organizerEligibilityConfirmed`. The full live checker uses the same guard when run with `--require-submission`.

Sources were read on October 24. YouTube duration came from a public vidIQ video lookup for `asl9kkF1EHo`; the Devpost entry embeds that same ID. These observations establish what was recorded at that check, not continuous availability.
