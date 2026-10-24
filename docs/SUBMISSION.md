# Submission brief

Track: Climate Data & Environmental Monitoring.

[Public entry](https://devpost.com/software/gapwitness) · [Public demo](https://youtu.be/asl9kkF1EHo) · [Live app](https://gapwitness-web.vercel.app)

The public Devpost page lists GapWitness as submitted to IEEE ClimateChain. Checked October 24, 2026. The public demo is 153 seconds, below the rules' 180-second minimum. Its duration and the separate retained 3:49 export must not be conflated. See [current submission status](SUBMISSION_STATUS.md) and the [judge guide](JUDGE_GUIDE.md).

GapWitness uses deterministic validation, browser recomputation, and blockchain commitments. No AI model or inference is implemented or claimed. The current technical-execution rubric names blockchain, smart contracts, AI, data platforms, and environmental integration as examples; it does not separately mandate an AI component. Eligibility wording still conflicts between the overview and detailed rules.

GapWitness helps environmental reviewers detect missing observations before accepting a report. It checks an hourly PM2.5 CSV against an independently declared UTC window, identifies missing timestamps and impossible negative measurements, and preserves independently reproducible evidence. The signing publisher can optionally commit compact evidence on Ethereum Sepolia.

Target users are research groups, community air-quality projects, environmental reviewers, and data publishers. Adoption begins with existing station CSV exports and their reporting schedules. Browser inspection requires no wallet. Evidence export and local batch inspection fit into existing review records without requiring every observation to be stored on-chain.

The distinctive design choice is to bind the declared observation window and missing-hour evidence with file, policy, verdict, and publisher, then provide a portable reviewer record and revision comparison. ORIGINALITY.md compares this workflow with OpenAQ, Great Expectations, Soda, and prior blockchain provenance research. It does not establish global novelty. The reference demonstration uses frozen OpenAQ data with accurately documented deliberate derivatives.

EVALUATION.md reports 553 controlled omission cases, 24 duplicate-timestamp substitutions, and 24 negative-measurement cases. GapWitness resolves all omission sets exactly and matches the strong schedule-aware baseline. It resolves 89 cases missed by an inferred-window shortcut. These are automated results, not real-world adoption or environmental outcomes. PILOT.md and the paired-observation analyzer make independent reviewer measurement ready to run.

REAL_CORPUS.md adds thirteen retained, unedited source windows from four stations and two providers. Three contain unavailable source readings, and all match the independent reference. Source normalization and source bytes are retained. Negative-value policy flags do not establish scientific source error or misconduct.

Scaling and measured results are documented in ADOPTION.md and benchmark-results.json. Present limits include hourly sampling, 31-day windows, 1 MB files, and a PM2.5-focused web experience. OPERATIONS.md documents atomic shared quotas, bounded instance concurrency, readiness, and scheduled monitoring. Production currently retains per-process quotas until an owned persistent store is configured. The generic hourly policy is available through the API and batch utility.

The Pilot page records actual paired timing and answer accuracy with no prefilled participants. The Verify page prepares and checks optional operator delegations against an independently supplied issuer key. Neither feature establishes independent adoption or station authority without external evidence.

## Demonstrable consequence of missing observations

In the frozen OpenAQ/AirNow complete 24-hour PM2.5 window, the available-reading mean is 3.2792 µg/m³. File A deliberately deletes seven rows without modifying the other values, leaving 17 observations and a mean of 2.9882 µg/m³ (8.87% lower). The live landing and source-backed Review view compute and display these values from the source fixtures. This illustrates distortion of a *summary statistic*, not a natural outage, alleged fraud, or a health or climate outcome. See EVALUATION.md and web/tests/impact.test.mjs.

The unedited real-source corpus independently demonstrates naturally unavailable readings and exact timestamp detection. It must not be conflated with the deliberately altered File A example.

The Verify page now separates the evidence for completeness, public testnet publication, and external scientific/source authority. Only the first two can be checked by GapWitness itself. Authorization and sensor calibration remain outside the current product.

Pilot instructions and a participant invitation are in PILOT_INVITATION.md. There are **no independent measurements yet**, and external reviewers must voluntarily share their local exports.

## Mobile publishing and release checks

The Publish page now supports injected browser wallets and on-demand MetaMask mobile/QR pairing. Connection and publication are separate controls, with disconnect, cancellation, Sepolia enforcement and retained evidence. Independent inspection and verification remain wallet-free. See MOBILE_WALLET.md for the real-phone acceptance check and verification limits.

RELEASE_VALIDATION.md records the October 18 regression, contract, build and fresh public RPC checks. Production shared quota activation is still pending protected environment access. scripts/check_release.py checks the actual deployment, all source fixture responses, source corpus and explicit external submission gaps.

## Current review and remaining evidence

- The public Devpost entry and YouTube URL are now recorded in [submission-links.json](submission-links.json). Devpost visibly associates the project with the event; this does not prove organizer acceptance or prize eligibility.
- The public upload is 2:33. The retained captioned 3:49 export is described in [recorded-walkthrough.json](recorded-walkthrough.json), but that metadata does not prove it was uploaded. See [video handoff](VIDEO_UPLOAD.md).
- The live application identified clean commit `2cc309b84b07624abbcb7251e420e8cc0f738d36` when checked on October 24. Its `web/src`, `checker/app`, and `contracts/src` trees match the October 18 walkthrough implementation commit `7c6c37066bccd5fed872b54be4d3db89db1a3b45`. Dependency and documentation changes exist, so these are not identical whole-repository releases.
- PR #61 contains newer reviewer-workflow improvements. It is unmerged and must not be presented as part of the submitted live release. The eleven Dependabot PRs are proposed maintenance, not eleven missing product features. [Current status](SUBMISSION_STATUS.md) records the review order.
- The detailed rules allow independent developers and individual submissions. The overview still says students only. An organizer clarification remains unrecorded. Submission itself does not resolve this conflict.
- The current schedule gives October 25, 2026 at 14:00 UTC / 15:00 WAT. Use the absolute date, not an aging countdown. The current rules no longer contain the previously noted opening-time sentence.
- Sourcify's exact V2 creation/runtime match is retained. Etherscan's old relay rate limit is historical. The October 24 source-only retry stopped before submission because `ETHERSCAN_API_KEY` is not configured in GitHub. The explorer page also returned HTTP 403. See the current status document for the retry run.
- Human time savings, adoption, operator authority, and environmental outcomes remain unestablished. The pilot and review tools are ready to collect evidence, rather than substitute for it.

Official sources checked October 24, 2026:

- https://devpost.com/software/gapwitness
- https://ieee-climatechain-hack.devpost.com/
- https://ieee-climatechain-hack.devpost.com/rules
- https://ieee-climatechain-hack.devpost.com/details/dates
