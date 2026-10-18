# Documentation

Start with the [project README](../README.md). Commands in these documents run from the repository root unless stated otherwise. Timestamped reports describe their recorded checks, not continuous service health.

| Task | Read |
| --- | --- |
| Run locally, inspect the API, understand hashes and contract rules | [Technical reference](TECHNICAL_REFERENCE.md) |
| Follow the app's task pages and verification flow | [Pages and proof](PAGES_AND_PROOF.md) |
| Connect a browser or mobile wallet | [Mobile wallet](MOBILE_WALLET.md) |
| Understand source attribution and retained real windows | [Real corpus](REAL_CORPUS.md), [OpenAQ source notes](../data/source/openaq.md) |
| Assess correctness, measured arithmetic effects, and local performance | [Evaluation](EVALUATION.md), [evaluation results](evaluation-results.json), [benchmark results](benchmark-results.json) |
| Understand security and scientific trust boundaries | [Security model](SECURITY.md), [operator authority](OPERATOR_AUTHORITY.md) |
| Report vulnerabilities or maintain dependencies | [Security reporting policy](../SECURITY.md), [dependency maintenance and scanning](DEPENDENCIES.md) |
| Configure quotas, monitor the checker, and assess scaling | [Operations](OPERATIONS.md), [adoption plan](ADOPTION.md) |
| Collect actual reviewer observations | [Pilot](PILOT.md), [invitation](PILOT_INVITATION.md), [empty observation template](../data/pilot/observations-template.csv) |
| Assess differentiation | [Related work](ORIGINALITY.md) |
| Prepare a submission and video | [Submission brief](SUBMISSION.md), [release checklist](RELEASE_CHECKLIST.md), [demo script](DEMO_SCRIPT.md), [video handoff](VIDEO_UPLOAD.md), [external link record](submission-links.json) |
| Review open external evidence | [Proof requests](EXTERNAL_PROOF_REQUESTS.md), [organizer clarification](ORGANIZER_CLARIFICATION.md) |
| Contribute changes | [Contributing](../CONTRIBUTING.md) |
| Check software and source-data licensing | [MIT license and scope](LICENSING.md) |

## Retained release evidence

- [October 18 release validation](RELEASE_VALIDATION.md) explains the test results, deployment checks, and remaining external items.
- [Deployed-release check](deployed-release-2026-10-18.json) and [live Sepolia verification](live-verification-2026-10-18.json) retain point-in-time machine-readable results.
- [Recorded walkthrough](recorded-walkthrough.json) records the captioned 3:49 export and its hash. Its raw-capture timing is separate from the delivered duration.
- [Operations snapshot](live-operations-check.json) and [shared-quota integration](shared-quota-integration.json) record their specific environments. They don't establish a global uptime or production shared-quota claim.
- [Public contract deployments and receipts](../contracts/deployments/README.md) retain V1 history and the current V2 proof.
- [October 14 evidence ledger](READINESS.md) and [earlier walkthrough](recorded-walkthrough-2026-10-14.json) are historical records. Use the newer validation document for the later engineering results.

The evidence files remain at their existing paths so code imports, scripts, and public review links keep working. No independent pilot outcome, authenticated station ownership, or measured environmental benefit is established by these automated checks.
