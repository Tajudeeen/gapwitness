# A defensible position among existing tools

Research checked October 14, 2026. This is a bounded comparison of published documentation, not a patent search or proof of worldwide novelty.

Missing-data detection and blockchain provenance already exist. GapWitness should not claim to have invented either.

| Existing work | What its primary source establishes | GapWitness's narrower role |
| --- | --- | --- |
| [OpenAQ sensor coverage](https://docs.openaq.org/resources/sensors) | Expected and observed measurement counts and time coverage are already exposed. | Review a retained CSV against a separately declared schedule, preserve the exact missing timestamps, and optionally publish a witness for a particular publisher. OpenAQ supplies data and useful metadata, rather than being a competitor to replace. |
| [Great Expectations missingness](https://docs.greatexpectations.io/docs/reference/learn/data_quality_use_cases/missingness/) and [freshness](https://docs.greatexpectations.io/docs/reference/learn/data_quality_use_cases/freshness/) | Configurable checks cover null values, completeness, and timestamp ranges. Custom rules can implement schedule completeness. | A small environmental-review workflow with browser recomputation, exported review records, revision comparison, and a publisher-scoped Sepolia commitment. These are product choices, not a superior missing-hour algorithm. |
| [Soda freshness checks](https://docs.soda.io/soda-documentation/soda-v3/sodacl-reference/freshness) | Freshness measures timestamp age and supports configurable quality checks. | A missing hour inside a declared historical window is a separate question from how recently the last observation arrived. Soda can be extended with other checks, so do not claim it cannot detect omissions. |
| [Ramachandran and Kantarcioglu, 2017](https://arxiv.org/abs/1709.10000) | Smart contracts and immutable scientific-data provenance predate this project. | GapWitness's schema explicitly binds expected window, missing-hour hash, policy, file hash, verdict, and publisher. The blockchain itself is established infrastructure. |

## The claim we can support

GapWitness packages schedule-aware environmental CSV review into a reproducible record. A reviewer can identify missing hours, compare revisions, keep the exact source files and a printable report, independently recompute the evidence, and optionally preserve a publisher-scoped witness on Sepolia.

Its distinct value is the combined workflow and explicit evidence schema. Our documentation review did not establish whether another product offers the identical combination. Do not describe it as the first, the only, patented, globally unique, or scientifically superior.

## Why a file hash alone is insufficient

A file hash distinguishes bytes. It does not say whether the submitted file contains every expected hour, whether a change is line endings or deleted observations, or whether a reviewer supplied the right reporting schedule. GapWitness retains these distinctions explicitly. A schedule-aware spreadsheet or Python script can compute the same missing hours. The measured evaluation shows that strong baseline matching GapWitness's detection, which is expected.

## Product boundaries

The current product does not authenticate station ownership, certify measurements, evaluate legal compliance, infer fraud, or establish environmental outcomes. V2 prevents a different wallet from occupying a publisher's record. It does not prevent arbitrary claims inside that wallet's own namespace. Corrected datasets should be retained and explained as revisions, rather than automatically treated as misconduct.
