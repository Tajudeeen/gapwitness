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
