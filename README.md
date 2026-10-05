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

The repository includes `scripts/fetch_openaq_day.py` to fetch one archive object and normalize only PM2.5 rows into the checker format. Pass a specific PM2.5 sensor ID so a demo window cannot silently mix readings from multiple sensors.

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

Do not hand-edit the OpenAQ demo CSVs. First fetch a PM2.5 source day with `scripts/fetch_openaq_day.py`, then select a complete 24-hour window with `scripts/select_openaq_window.py`, then derive the adversarial pair with `scripts/derive_openaq_fixtures.py`.

The window selector is deterministic: it rejects non-hour timestamps and duplicates, scans in chronological order, and picks the earliest complete UTC hourly window. Its manifest records the source hash, selected station/sensor identifiers, exact window, row counts, and frozen output hash.

The derivation requires that complete UTC hourly window. File B contains the selected source rows. File A is created only by removing the explicitly listed hours. The derivation manifest records the normalized source SHA-256, window, removed timestamps, and output hashes.

This distinction matters: File A is an adversarial derivative of a real source window. It must not be described as a naturally gapped OpenAQ record unless the upstream archive itself actually contains that gap.

Example workflow:

```bash
python scripts/fetch_openaq_day.py \
  --location-id <LOCATION_ID> \
  --sensor-id <PM25_SENSOR_ID> \
  --date <YYYY-MM-DD> \
  --output data/source/openaq-day.csv \
  --manifest data/source/openaq-day.json

python scripts/select_openaq_window.py \
  --location-id <LOCATION_ID> \
  --sensor-id <PM25_SENSOR_ID> \
  --source data/source/openaq-day.csv \
  --output data/source/openaq-window.csv \
  --manifest data/source/openaq-window.json \
  --window-hours 24

python scripts/derive_openaq_fixtures.py \
  --source data/source/openaq-window.csv \
  --complete checker/demo/file_b.csv \
  --gapped checker/demo/file_a.csv \
  --window-start <WINDOW_START> \
  --window-end <WINDOW_END> \
  --remove-start <GAP_START> \
  --remove-hours 7 \
  --manifest data/source/openaq-derived.json
```

Real source bytes and generated hashes must be preserved in the provenance record before the demo data is frozen.

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
