# Submission status, checked October 24, 2026

GapWitness is publicly listed as submitted to IEEE ClimateChain. The repository's earlier "not yet submitted" and "no public video" statements were stale. This document updates those records while preserving the submitted application source and a reference to its dependency snapshot.

| Item | Observed evidence | Remaining action or limit |
| --- | --- | --- |
| Public entry | [Devpost project](https://devpost.com/software/gapwitness) lists IEEE ClimateChain under Submitted to and embeds the YouTube demo | Organizer acceptance, exact submission time, and prize eligibility are not inferred |
| Published replacement | [New YouTube demo](https://www.youtube.com/watch?v=i8ZCdidA6RU), Deeen_Codes, published October 24; metadata confirms 3:53 | Duration requirement is met. The owner will update the Devpost embed; signed-out player playback remains unrecorded |
| Longer retained export | [Walkthrough metadata](recorded-walkthrough.json) records a separate 228.8-second captioned export | That record does not establish a public upload or a Devpost embed of the longer asset |
| Deadline | [Schedule](https://ieee-climatechain-hack.devpost.com/details/dates): October 25 at 14:00 UTC / 15:00 WAT | Absolute time replaces an aging hours-left estimate |
| Eligibility | [Detailed rules](https://ieee-climatechain-hack.devpost.com/rules) allow independent developers and individual submissions; [overview](https://ieee-climatechain-hack.devpost.com/) still says students only | No organizer reply resolving the conflict is recorded. Use the prepared [clarification](ORGANIZER_CLARIFICATION.md) |
| AI | Submitted code uses deterministic checks, browser recomputation and optional Sepolia commitments | No ML or inference is claimed. The technical rubric lists several example tools and does not separately require every project to implement AI |
| Source verification | [Sourcify retained exact match](../contracts/deployments/sourcify-v2.json), creation and runtime | Etherscan is separate. The source-only retry stopped because `ETHERSCAN_API_KEY` is not configured. Current Etherscan verification remains unconfirmed |
| Human benefit | [Pilot workflow](PILOT.md), timing and answer scoring, empty observation template | Independent reviewer time savings, adoption and environmental outcomes remain unmeasured |

The overview promotes AI and blockchain together. A project may still be judged on fit and innovation. The code and presentation should describe the actual deterministic workflow, without implying AI capability or declaring the organizer's eligibility decision.

## Release and open-work inventory

The live `/release.json` reported clean commit `2cc309b84b07624abbcb7251e420e8cc0f738d36` when checked on October 24. This reference is preserved at [`submission/reference-2026-10-24`](https://github.com/Tajudeeen/gapwitness/tree/submission/reference-2026-10-24). It is not an independently recovered submission receipt. The application source in `web/src`, `checker/app`, and `contracts/src` matches walkthrough implementation `7c6c37066bccd5fed872b54be4d3db89db1a3b45`. Dependency manifests and documentation differ. The later 2:33 public recording is separate from that export. A new narrated 3:53 replacement is now published, with its source reference and proof boundaries in [recorded-submission-demo.json](recorded-submission-demo.json). It uses new core-workflow footage from the `2069bdb` reference and an explicitly dated excerpt of the older successful check.

| Open work | Assessment | Treatment |
| --- | --- | --- |
| [PR #61](https://github.com/Tajudeeen/gapwitness/pull/61), reviewer imports, evidence bundles and pilot improvements | Merged after the video recording at `85139da`; its recorded web, checker, contract, audit and CodeQL workflows passed | See [reviewer workflow](REVIEWER_WORKFLOW.md). The video demonstrates the earlier core flow, not every subsequent addition |
| [PR #51](https://github.com/Tajudeeen/gapwitness/pull/51), FastAPI patch, and [PR #53](https://github.com/Tajudeeen/gapwitness/pull/53), grouped npm updates | Maintenance proposals with passing checked PR workflows | Follow current merge states on GitHub. Separate checks do not prove a combined result |
| [PRs #50, #52, #54–#60](https://github.com/Tajudeeen/gapwitness/pulls), runtime, crypto, compiler, bundler and Actions majors | Changes to compatibility or the build environment | Review migration notes and combined checks. Some have since merged, including #50, #59 and #60. Current state is visible on GitHub |
| [Issue #45](https://github.com/Tajudeeen/gapwitness/issues/45), corrected first-witness deployment | Closed as completed after checking that the retained replay record matches the corrected deployment, preserves all stored fields, has successful receipts and emits zero replay events | This is historical V1 regression evidence, separate from the current publisher-scoped V2 source-backed witness |

A fresh npm audit of Vite 7.3.6 reported one affected dependency with a high-severity advisory. The 7.3.7 patch and its registry integrity were backported from the reviewed branch; all other dependency entries remain unchanged. The initial cleanup did not merge PR #61; it has since been merged by the owner along with several dependency updates. Those later changes are preserved by this publication-record update. Historical receipts, CSV bytes, recordings and timestamped release reports are retained. This preserves a short path from the submitted behavior to its source while making later work visible.

## Focused dependency fix

The npm audit flagged Vite 7.3.6, including [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) and [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22). This cleanup pins 7.3.7 and preserves every other installed dependency record. These concern Vite development-server/editor behavior; they do not establish a compromise of the deployed static frontend. The previous application and dependency snapshot remains available on the submission reference branch.

## Etherscan retry

[verify-existing-source.yml](../.github/workflows/verify-existing-source.yml) isolates verification of the existing V2 address. It compiles the recorded deployment commit, prepares the standard JSON compiler input, and calls Etherscan using the existing protected `ETHERSCAN_API_KEY`. It has read-only repository permissions, receives no wallet key, and performs no deployment or transaction broadcast. A missing credential fails explicitly; source verification is recorded only after the provider command succeeds. The older combined final-evidence workflow also performs on-chain fixture operations and is not used for this retry.

[Actual retry run](https://github.com/Tajudeeen/gapwitness/actions/runs/40137945617) stopped at the credential guard: `ETHERSCAN_API_KEY` is not configured in the repository or protected `sepolia` environment. No source submission or transaction occurred. Configure that secret in GitHub, then rerun the source-only workflow. This is a current credential blocker, not evidence of another provider rate limit.

## Check the remaining recorded gaps

```bash
python scripts/check_submission.py --output /tmp/gapwitness-submission-check.json
```

The command checks the records without making network requests or importing the checker. With the current records, it correctly exits nonzero for the unconfirmed Devpost embed replacement, unrecorded signed-out playback and unresolved organizer clarification. A publicly listed entry is recorded as submitted without implying acceptance.

After a compliant video is actually uploaded, update its URL, measured duration and metadata in [submission-links.json](submission-links.json). Set `videoPlaybackChecked` only after a real signed-out playback check. Retain an organizer reply before setting `organizerEligibilityConfirmed`. The full live checker uses the same guard when run with `--require-submission`.

Sources were read on October 24. The replacement duration and channel were confirmed through Metricool publication status and a public vidIQ lookup for `i8ZCdidA6RU`. The last observed Devpost embed still referenced `asl9kkF1EHo`; updating that embed is a separate owner action. These observations establish what was recorded at that check, not continuous availability.

## Cleanup validation

- 97 Python checker and tooling tests passed, including duration-boundary, draft-listing and unrecorded-playback rejection cases.
- 27 JavaScript evidence and wallet tests passed.
- TypeScript and the production build passed with Vite 7.3.7.
- The patched lockfile's npm audit reports zero known vulnerabilities across production and development dependencies at this check.
- The documented batch command inspected all three frozen fixtures successfully. Local Markdown links resolve.
- No application files in `web/src`, `checker/app` or `contracts/src` changed. The existing source CSVs and transaction receipts remain unchanged.
- The replacement is 3:53 and its full-file decode passed. The latest 19 focused submission-guard tests passed. The recorded submission check still flags the pending Devpost embed replacement, unrecorded signed-out playback and unrecorded organizer clarification.
- The source-only Etherscan retry failed at the missing-credential guard before source submission.
