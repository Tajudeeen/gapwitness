# GapWitness

Temporal integrity for environmental time series.

> witness the hours that were missing.

GapWitness inspects an environmental CSV against an independently declared hourly observation window, identifies missing timestamps, and commits the resulting temporal evidence on-chain.

## Core demo

1. File A contains a seven-hour gap.
2. GapWitness returns `GAPPED` and computes deterministic evidence.
3. File A is the first candidate for an on-chain commitment.
4. File B contains the same 24-hour window with those hours restored.
5. A conflicting commitment for the same station and exact window must revert with `GapPaperedOver`.
6. File C contains an impossible negative PM2.5 value and returns `IMPOSSIBLE`.

## OpenAQ source

The production demo source is OpenAQ's public AWS archive. OpenAQ publishes daily gzipped CSV files by location, year, and month, and the archive is publicly readable without AWS credentials.

The repository includes `scripts/fetch_openaq_day.py` to fetch one archive object and normalize only PM2.5 rows into the checker format.

Before a source file is promoted into the demo, record:

- exact archive object URL
- OpenAQ location ID
- PM2.5 sensor ID
- UTC demo window
- download/acquisition date
- upstream provider
- applicable provider license
- OpenAQ timestamp convention

See `data/source/openaq.md` for the source record template.

### Reproducible demo fixtures

Do not hand-edit the OpenAQ demo CSVs. First fetch a complete PM2.5 source day with `scripts/fetch_openaq_day.py`, then derive the adversarial pair with `scripts/derive_openaq_fixtures.py`.

The derivation requires a complete UTC hourly window. File B contains the selected source rows. File A is created only by removing the explicitly listed hours. The manifest records the normalized source SHA-256, window, removed timestamps, and output hashes.

This distinction matters: File A is an adversarial derivative of a real source window. It must not be described as a naturally gapped OpenAQ record unless the upstream archive itself actually contains that gap.

## On-chain commitment rule

A commitment is immutable for an exact station and UTC observation window. Re-submitting the identical series hash, gap hash, policy hash, and verdict is allowed. Changing any of those fields for an already committed window is rejected. A different gap specifically reverts with `GapPaperedOver` so the demo can expose a later attempt to paper over missing hours.

## Verdicts

- `INTACT` - every expected hourly timestamp is present and no hard physical rule is violated.
- `GAPPED` - one or more expected timestamps are absent.
- `IMPOSSIBLE` - a hard series-specific physical constraint is violated.

Insufficient data is an inspection error, not a verdict.

## Trust model

The checker is deterministic. AI is outside the trust boundary and may only turn checker-produced facts into a human-readable evidence sentence.

**Integrity is not truth.** GapWitness does not prove sensor calibration or that a measurement is physically truthful. It proves what the submitted file contained, which expected hours were absent, and whether a later submission attempts to rewrite that temporal evidence.

## Evidence hashes

- `seriesHash` = Keccak-256 of the exact submitted CSV bytes.
- `gapHash` = Keccak-256 of the canonical sorted UTC gap list joined with newlines.
- `policyHash` = hash of the versioned checker policy.

## Scope freeze

One environmental series, one checker, one chart, one contract, one public testnet deployment, three demo files, one verification script, one clean demo video.

No sensor hardware, sensor network, token, IPFS layer, marketplace, KPI dashboard, chatbot, multi-chain deployment, or live ingestion infrastructure.
