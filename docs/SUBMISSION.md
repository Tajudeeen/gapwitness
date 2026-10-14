# Submission brief

Track: Climate Data & Environmental Monitoring.

GapWitness helps environmental reviewers detect missing observations before accepting a report. It checks an hourly PM2.5 CSV against an independently declared UTC window, identifies missing timestamps and impossible negative measurements, and preserves independently reproducible evidence. The signing publisher can optionally commit compact evidence on Ethereum Sepolia.

Target users are research groups, community air-quality projects, environmental reviewers, and data publishers. Adoption begins with existing station CSV exports and their reporting schedules. Browser inspection requires no wallet. Evidence export and local batch inspection fit into existing review records without requiring every observation to be stored on-chain.

The distinctive design choice is to bind the declared observation window and missing-hour evidence with file, policy, verdict, and publisher, then provide a portable reviewer record and revision comparison. ORIGINALITY.md compares this workflow with OpenAQ, Great Expectations, Soda, and prior blockchain provenance research. It does not establish global novelty. The reference demonstration uses frozen OpenAQ data with accurately documented deliberate derivatives.

EVALUATION.md reports 553 controlled omission cases, 24 duplicate-timestamp substitutions, and 24 negative-measurement cases. GapWitness resolves all omission sets exactly and matches the strong schedule-aware baseline. It resolves 89 cases missed by an inferred-window shortcut. These are automated results, not real-world adoption or environmental outcomes. PILOT.md and the paired-observation analyzer make independent reviewer measurement ready to run.

REAL_CORPUS.md adds thirteen retained, unedited source windows from four stations and two providers. Three contain unavailable source readings, and all match the independent reference. Source normalization and source bytes are retained. Negative-value policy flags do not establish scientific source error or misconduct.

Scaling and measured results are documented in ADOPTION.md and benchmark-results.json. Present limits include hourly sampling, 31-day windows, 1 MB files, and a PM2.5-focused web experience. OPERATIONS.md documents atomic shared quotas, bounded instance concurrency, readiness, and scheduled monitoring. Production currently retains per-process quotas until an owned persistent store is configured. The generic hourly policy is available through the API and batch utility.

The Pilot page records actual paired timing and answer accuracy with no prefilled participants. The Verify page prepares and checks optional operator delegations against an independently supplied issuer key. Neither feature establishes independent adoption or station authority without external evidence.

## Ready and remaining

- Public code, documentation, deployed lab, frozen fixtures, and independent verification are provided through README.
- The V2 publisher-scoped deployment and its source-backed proof are integrated. Its own namespace prevents another wallet from occupying the publisher’s station/window.
- Use DEMO_SCRIPT.md to record the required 3–5 minute video.
- Describe environmental impact as improved reviewability and transparency. No environmental outcome or adoption metric has been measured.
- Organizer eligibility wording conflicts between the students-only overview and the rules allowing independent developers. Obtain confirmation before assuming eligibility as a graduate.
- The official schedule and organizer update indicate submissions opened October 5 and close October 25 at 14:00 UTC, or 15:00 in Nigeria. An older rule sentence gives a contradictory opening time.
- Sourcify verified an exact creation and runtime bytecode match for V2 on October 14. The retained result is contracts/deployments/sourcify-v2.json. Etherscan verification remains separate; its automatic relay hit the provider's daily submission limit.

Official pages checked October 14, 2026:

- https://ieee-climatechain-hack.devpost.com/
- https://ieee-climatechain-hack.devpost.com/rules
- https://ieee-climatechain-hack.devpost.com/details/dates
- https://ieee-climatechain-hack.devpost.com/updates
