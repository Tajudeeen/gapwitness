# From prototype to a reviewer workflow

GapWitness is an hourly environmental-record review tool. Its first use case is a research group, community air-quality project, or data publisher reviewing PM2.5 station exports before accepting a report.

## A practical adoption path

1. Obtain the station reporting schedule and expected UTC window independently of the CSV. Reviewers must not infer the window from the first and last submitted rows.
2. Open the lab and load the frozen examples to learn the three verdicts. File A has deliberately removed hours, File B preserves the complete source window, and File C is a policy test.
3. Upload a real station export. Review missing hours, negative measurements, and the independently recomputed evidence. A wallet is unnecessary for inspection.
4. Download the evidence JSON and printable review, then retain the exact CSV. These are needed for a later independent review. Compare a prior CSV in the reviewer workspace when a revision arrives. The comparison separates added hours, removed hours, measurement changes, and byte-only changes.
5. Optionally publish a witness on Sepolia. V2 binds records to the signing publisher's wallet, station, and exact window. Reviewers must separately decide whether that wallet represents an authorized station operator.
6. Include the CSV, declared schedule, evidence JSON, and any transaction in the organization's review record. Escalate discrepancies for explanation. A conflict alone does not establish fraud.

## Repeatable local review

```bash
python scripts/inspect_batch.py checker/demo/review-manifest.json --output batch-evidence.json
```

This processes up to 100 entries sequentially without sending data to the HTTP checker. Each entry declares its station, window, CSV path relative to the manifest, and `pm25` or `generic` policy. An unusable entry is recorded as rejected, and the command exits nonzero if any input is rejected. This is a batch review utility, not an automated certification service.

## Pilot measurement plan

| Measure | Collection method | Current evidence |
| --- | --- | --- |
| Known missing hours detected | Deliberately remove listed hours and compare exact timestamps | Frozen File A reports seven missing hours |
| False gap detections | Inspect a independently confirmed complete window | Frozen File B reports no gaps |
| Invalid measurements flagged | Inject a negative PM2.5 measurement | File C returns IMPOSSIBLE |
| Reviewer time | Time the same review task with and without the tool | Not measured |
| Adoption and usability | Observe 3–5 independent reviewers using their own exports | No completed pilot |
| Environmental outcomes | Follow decisions made after accepted or rejected reports | Not measured |

The automated [evaluation](EVALUATION.md) now measures 553 controlled omission cases, 24 duplicate substitutions, and 24 negative measurements using derivatives of frozen real source data. The schedule-aware reference baseline matches GapWitness. The [pilot protocol](PILOT.md) and empty observation template provide a way to measure actual reviewer time and accuracy. `scripts/analyze_pilot.py` reports observed paired differences without inventing participant records.

Do not translate these correctness checks into claims of emissions reduced, fraud detected in the upstream record, users served, or time saved.

## Scaling plan and present limits

`benchmark-results.json` records local checker timings for 24, 168, and 744 hourly observations, with 50 runs per case. It measures parsing and evidence computation only. It is not an HTTP load test or a production capacity guarantee.

Each file is capped at 1 MB, each request at 1.1 MB, and each window at 744 hours. Rate-limit memory is bounded per worker. The service's limiter is not distributed across serverless instances. Institutional adoption needs shared quotas or an API gateway, explicit service capacity tests, and an agreed upload/privacy policy. Local batch inspection is available when uploads are unsuitable.

Broader environmental measurements can use the generic hourly policy through the API or local batch command. Generic inspection checks temporal completeness and finite values; it does not impose PM2.5's non-negative rule. The web remains PM2.5-focused. New sampling frequencies or scientific rules require a new versioned policy, provenance fixtures, and independent cross-language regression tests.
