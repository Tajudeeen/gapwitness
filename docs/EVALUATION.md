# Measured review benefits

The reproducible evaluation uses 601 controlled cases derived from a single frozen, real OpenAQ/AirNow PM2.5 window. It tests software behavior. It does not establish real-user adoption, natural outages, fraud, reviewer time savings, health effects, or environmental outcomes.

## What we measured

The source is `checker/demo/file_b.csv`, station 2178, sensor 3920, September 19, 2026. `data/source/openaq-demo.json` records the exact source URL, acquisition date, license, and hashes. The test declares a 24-hour schedule before generating derivatives. That schedule is an experimental reference, not a station-operator-certified reporting requirement.

The omission set includes the complete source, every non-empty contiguous removal of 1–23 hours, and every separated pair of removed hours. There are 553 cases. Ground truth comes from the removed row indices, independently of the inspector's output. Exact-case agreement requires the full missing-timestamp set to match, not merely a count or verdict.

| Method | Exact omission cases | Missing timestamp instances found | Missing timestamp instances missed | False missing timestamps |
| --- | ---: | ---: | ---: | ---: |
| GapWitness with the predeclared window | 553/553 | 3,082 | 0 | 0 |
| Infer expected window from first and last submitted rows | 464/553 | 2,486 | 596 | 0 |
| Strong reference: enumerate the predeclared schedule | 553/553 | 3,082 | 0 | 0 |

GapWitness correctly resolves 89 omission cases that the inferred-window shortcut misses. Boundary omissions can shrink that shortcut's expected window. The strong schedule-aware baseline matches GapWitness. No superiority over a correctly implemented schedule-aware method is claimed. Timestamp instances repeat across controlled cases and are not distinct real-world missing readings.

An additional 24 cases replace a removed timestamp with a duplicate, preserving 24 rows. GapWitness rejects all 24 as duplicate timestamps. A count-only check expecting 24 rows would pass them. Another 24 cases insert one negative PM2.5 value at each hour. All 24 exact negative timestamps are flagged.

The JavaScript test independently reconstructs every omission CSV, checks its SHA-256 against the generated case manifest, and recomputes its series, gap, and policy hashes. This guards agreement between browser and Python implementations rather than trusting a server response alone.

## Why missing observations matter to a report

The complete source-window arithmetic mean is 3.2792 µg/m³. File A's documented seven-hour removal produces 2.9882 µg/m³, an 8.87% decrease. This illustrates how omission can change a summary. It is not an AQI calculation, observed upstream manipulation, or a health effect. GapWitness identifies the removed hours. It does not reconstruct their measurements from the edited file or certify an aggregate as scientifically acceptable.

## Reproduce and inspect

```bash
pip install -r checker/requirements.txt
python scripts/evaluate_review.py --output docs/evaluation-results.json
cd web
npm ci
npm test
```

The committed JSON contains the source hash, all derivative hashes, removal indices, per-case agreement, summary counts, and local compute timings. Timings are one local computation per omission case, not reviewer time or network throughput. Values vary by machine. `benchmark-results.json` separately measures longer windows.

## Measure the next benefit

The reviewer workspace produces a printable review and a structured revision comparison. Its convenience and time savings need user measurement. Follow PILOT.md, collect actual paired observations, and run `scripts/analyze_pilot.py`. The shipped template is empty. No pilot metric is populated or claimed before a reviewer uses the workflow.
