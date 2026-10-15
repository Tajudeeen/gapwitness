# GapWitness submission release checklist

Target: IEEE ClimateChain Global Hackathon, Climate Data & Environmental Monitoring.

Official rules: https://ieee-climatechain-hack.devpost.com/rules

**Deadline:** October 25, 2026, 14:00 UTC / 15:00 WAT (17:00 MSK). Submit earlier in the allowed window. The rules page also contains inconsistent wording about when submissions open; confirm the active Devpost submission form and organizer updates before submitting.

## Required links

| Asset | Link | State |
| --- | --- | --- |
| Live application | https://gapwitness-web.vercel.app | Recheck in a normal browser before submission |
| Repository | https://github.com/Tajudeeen/gapwitness | Public |
| Source-backed Sepolia witness | https://sepolia.etherscan.io/tx/0xbca8fc950d106c7952ec78787bd8b57181d4ec4febb3882653318ea6dea7ad08 | Mined, retained proof |
| V2 contract | https://sepolia.etherscan.io/address/0x9988b2aa76e532b9093624ea8672543f368aca82 | Exact Sourcify match retained |
| 3-5 minute video | **ADD PUBLIC VIDEO URL** | Required, not yet linked here |
| Devpost submission | **ADD PROJECT URL** | Not yet recorded |

## Final gate checklist

- [ ] Send the [organizer clarification request](ORGANIZER_CLARIFICATION.md) and retain the reply. The Devpost overview and detailed rules conflict.
- [ ] Recruit real reviewers using the [pilot invitation](PILOT_INVITATION.md) if possible. Report observed results only after consent and analysis.
- [ ] Check the source-backed mean comparison reports approximately 3.2792 vs 2.9882 µg/m³ and -8.87%; ensure it is labeled a controlled omission.
- [ ] Film an updated 3–5 minute walkthrough from [DEMO_SCRIPT.md](DEMO_SCRIPT.md), or confirm the existing public video adequately shows the final product.
- [ ] Confirm Devpost account/team eligibility and that the submission form accepts the project. The rules include independent developers, while older overview copy may differ.
- [ ] Confirm the video is publicly viewable, 3 to 5 minutes long, with audio/captions and working playback.
- [ ] Open every user-facing route in a fresh private browser tab: Home, Inspect, Review, Evidence, Publish, Verify, Datasets, Pilot, Status.
- [ ] Load frozen File A and confirm 17/24 observations, seven missing hours, and GAPPED.
- [ ] Load File B and confirm 24/24 observations and INTACT.
- [ ] On Verify, choose the published File A example and perform **fresh** Sepolia verification. Check the runtime hash, publisher, chain record, mined transaction and event. Do not pass on cached metadata alone.
- [ ] Check mobile layout, smooth navigation, keyboard focus and reduced-motion behavior.
- [ ] Run the repository's checker, contract, web, and browser regression suites. Record final results and commit SHA; do not call unrun tests passed.
- [ ] Check public deployment after the latest frontend commit, and confirm the checker health and status endpoints from a real browser. A source commit alone does not prove Vercel has deployed it.
- [ ] Check there are no committed keys, .env files, unlicensed third-party images, private pilot records or generated build artifacts.
- [ ] Fill in the video URL and final project URL. Copy the concise, accurate product description from docs/SUBMISSION.md.

## Reviewer-safe narrative

GapWitness checks hourly environmental CSVs against an independently declared observation window, reveals missing observations, and keeps reproducible review evidence. An optional publisher-scoped Sepolia commitment makes later changes to an occupied station/window record detectable. The contract stores claims, rather than certifying the truth or calibration of the sensor.

The frozen File A fixture **deliberately removes** seven hours from a complete OpenAQ/AirNow window. The retained real-source corpus additionally includes naturally unavailable readings; do not conflate these examples or allege manipulation without evidence.

601 controlled test cases and local benchmark numbers are engineering evaluation, **not** independent pilot results, adoption, or measured environmental impact. The pilot currently has no independent participants.

## Preserve, don't delete

Keep `contracts/deployments/`, `data/source/`, `checker/demo/`, evaluation reports, regression tests and deployment manifests. These are necessary for independent proof and contest review. Historical V1 records are labeled historical; V2 is the current path.
