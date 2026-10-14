# Submission brief

Track: Climate Data & Environmental Monitoring.

GapWitness helps environmental reviewers detect missing observations before accepting a report. It checks an hourly PM2.5 CSV against an independently declared UTC window, identifies missing timestamps and impossible negative measurements, and preserves independently reproducible evidence. The signing publisher can optionally commit compact evidence on Ethereum Sepolia.

Target users are research groups, community air-quality projects, environmental reviewers, and data publishers. Adoption begins with existing station CSV exports and their reporting schedules. Browser inspection requires no wallet. Evidence export and local batch inspection fit into existing review records without requiring every observation to be stored on-chain.

The distinctive design choice is to commit the declared observation window and missing-hour evidence rather than only a file hash. This is a technical distinction, not a verified claim that no other project takes a similar approach. The reference demonstration uses frozen OpenAQ data with accurately documented deliberate derivatives.

Scaling and measured results are documented in ADOPTION.md and benchmark-results.json. Present limits include hourly sampling, 31-day windows, 1 MB files, a PM2.5-focused web experience, per-process quotas, and unauthenticated station authority. The generic hourly policy is available through the API and batch utility.

## Ready and remaining

- Public code, documentation, deployed lab, frozen fixtures, and independent verification are provided through README.
- The V2 publisher-scoped deployment and its proof must be integrated before claiming publisher isolation is live.
- Use DEMO_SCRIPT.md to record the required 3–5 minute video.
- Describe environmental impact as improved reviewability and transparency. No environmental outcome or adoption metric has been measured.
- Organizer eligibility wording conflicts between the students-only overview and the rules allowing independent developers. Obtain confirmation before assuming eligibility as a graduate.
- The official schedule and organizer update indicate submissions opened October 5 and close October 25 at 14:00 UTC, or 15:00 in Nigeria. An older rule sentence gives a contradictory opening time.
- Etherscan verification is a reviewability improvement. It is not listed as a submission requirement and needs the owner's ETHERSCAN_API_KEY.

Official pages checked October 14, 2026:

- https://ieee-climatechain-hack.devpost.com/
- https://ieee-climatechain-hack.devpost.com/rules
- https://ieee-climatechain-hack.devpost.com/details/dates
- https://ieee-climatechain-hack.devpost.com/updates
