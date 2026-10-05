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

The repository includes `scripts/fetch_openaq_day.py` to fetch one archive object and normalize only PM2.5 rows into the checker format. Pass a specific PM2.5 sensor ID when the source sensor is known so a demo window cannot silently mix readings from multiple sensors.

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

### Frozen demo source

The current demo is frozen from the OpenAQ archive object for location **2178 (Del Norte)** on **September 19, 2026**, using PM2.5 sensor **3920**. The checker window is **2026-09-19T07:00:00Z through 2026-09-20T07:00:00Z**.

The source provider is **AirNow** and the location license is **US Public Domain**. The archive object SHA-256, exact source URL, acquisition date, sensor ID, and fixture hashes are recorded in `data/source/openaq-demo.json`.

File A removes exactly seven UTC hours, **15:00Z through 21:00Z**, from the frozen source window. It is intentionally adversarial. It is not a claim that OpenAQ originally published a naturally gapped record.

### Reproducible demo fixtures

Do not hand-edit the OpenAQ demo CSVs.

The preferred source-selection flow is:

1. Download one OpenAQ archive day with `scripts/fetch_openaq_day.py` when the sensor is already known.
2. Otherwise run `scripts/discover_openaq_window.py`. It scans the day's PM2.5 rows by sensor and reports the earliest complete UTC window for each usable sensor.
3. Freeze the selected 24-hour window with `scripts/select_openaq_window.py`.
4. Derive the adversarial File A/File B pair with `scripts/derive_openaq_fixtures.py`.

The discovery and window selectors are deterministic. They reject malformed hourly timestamps and duplicate instants, preserve measurement strings, and use chronological ordering to choose the earliest complete window.

The derivation requires that complete UTC hourly window. File B contains the selected source rows. File A is created only by removing the explicitly listed hours. The derivation manifest records the normalized source SHA-256, window, removed timestamps, and output hashes.

This distinction matters: File A is an adversarial derivative of a real source window. It must not be described as a naturally gapped OpenAQ record unless the upstream archive itself actually contains that gap.

Example workflow:

```bash
python scripts/discover_openaq_window.py \
  --location-id <LOCATION_ID> \
  --date <YYYY-MM-DD> \
  --window-hours 24 \
  --manifest data/source/openaq-candidates.json

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

The discovery command chooses a candidate. The fetch/select/derive steps are still the point where the actual source bytes and generated hashes are frozen into the submission record.

## Web lab

The web client lives under `web/`. It is intentionally a single lab surface rather than a dashboard: station and window context on the left, one hourly observation strip, missing-hour bands, and a large deterministic verdict stamp.

Run locally:

```bash
cd web
npm install
npm run dev
```

The web client now sends the uploaded CSV and independently declared window to the checker API. Set `VITE_CHECKER_URL` in `web/.env` from `web/.env.example` before running locally. The UI renders the checker response, including missing timestamps, verdict, and chain-ready hashes. HTTP 422 validation failures, rate limits, and checker/network failures are surfaced without falling back to fake local verdicts. A checker outage explicitly disables commitment.

The commit flow now uses an injected EVM wallet through ethers v6. The wallet is requested only after a deterministic checker verdict exists. Commitment is restricted to Ethereum Sepolia, and the UI switches networks when the wallet exposes the standard EIP-1193 switch method. Configure `VITE_CONTRACT` with the real deployed contract address and optionally set `VITE_CONTRACT_DEPLOYMENT_BLOCK` so a `GapPaperedOver` conflict can surface the prior commitment transaction. No contract address is hardcoded or mocked.

## Sepolia deployment

The contract deployment is intentionally separated from normal CI. `contracts/script/DeployGapWitness.s.sol` reads the deployer key from `PRIVATE_KEY`, and the deployment workflow accepts `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, and `ETHERSCAN_API_KEY` only as GitHub environment secrets.

Dry-run first:

```bash
cd contracts
forge script script/DeployGapWitness.s.sol:DeployGapWitness --rpc-url "$SEPOLIA_RPC_URL"
```

Broadcast and verify only after the dry-run is clean:

```bash
forge script script/DeployGapWitness.s.sol:DeployGapWitness \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Foundry documents the same dry-run/broadcast separation for deployments. Never commit a populated `.env` or a private key. After a successful deployment, record the contract address, deployment transaction, block number, deployer, verification state, and deployment commit under `contracts/deployments/`.

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
