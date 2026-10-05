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

### Production web/checker configuration

Production web uses `VITE_CHECKER_URL=https://gapwitness-checker.vercel.app`. Production checker uses `WEB_ORIGIN=https://gapwitness-web.vercel.app` for browser CORS. Both services are intentionally public because the web client calls the checker directly; Vercel SSO/password protection must remain disabled for these production endpoints.

The commit flow now uses an injected EVM wallet through ethers v6. The wallet is requested only after a deterministic checker verdict exists. Commitment is restricted to Ethereum Sepolia, and the UI switches networks when the wallet exposes the standard EIP-1193 switch method. Configure `VITE_CONTRACT` with the real deployed contract address and optionally set `VITE_CONTRACT_DEPLOYMENT_BLOCK` so a `GapPaperedOver` conflict can surface the prior commitment transaction. No contract address is hardcoded or mocked.

## Sepolia deployment

The contract deployment is intentionally separated from normal CI. `contracts/script/DeployGapWitness.s.sol` reads the deployer key from `PRIVATE_KEY`, and the deployment workflow accepts `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, and `ETHERSCAN_API_KEY` only as GitHub environment secrets.

Dry-run first:

```bash
cd contracts
forge script script/DeployGapWitness.s.sol:DeployGapWitness --rpc-url "$SEPOLIA_RPC_URL"
```

The recommended live path is the `deploy-sepolia` GitHub Actions workflow. It uses the `sepolia` environment secrets, runs the dry-run first, broadcasts without verification, records the exact deployed address/transaction/block, and then optionally verifies the source on Etherscan. The final deployment JSON is uploaded as a workflow artifact so it can be reviewed before the address is wired into the web app.

For a local broadcast, run:

```bash
forge script script/DeployGapWitness.s.sol:DeployGapWitness \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Then create the reviewed deployment record from Foundry's broadcast artifact:

```bash
python scripts/record_sepolia_deployment.py \
  --broadcast contracts/broadcast/DeployGapWitness.s.sol/11155111/run-latest.json \
  --output contracts/deployments/sepolia.json \
  --deployment-commit <GIT_COMMIT>
```

Never commit a populated `.env` or a private key. The contract address must come from the real broadcast artifact, never from a placeholder.

For a remote deployment, the repository also includes an owner-only `issue_comment` trigger. On the default branch, the repository owner can comment `/deploy-sepolia` on a normal issue. The workflow uses the existing encrypted `PRIVATE_KEY` secret, falls back to the public Sepolia RPC when `SEPOLIA_RPC_URL` is empty, writes the reviewed deployment record to a separate branch, and comments the resulting address, transaction, and block back onto the issue. The private key is never passed through the issue comment.

## Live Sepolia deployment

The current deployed GapWitness contract is:

- chain: Sepolia (`11155111`)
- address: `0xa7ab2d2e60a08a089f3749ac3e98b41449b23211`
- deployment transaction: `0xf0ab1c67eb1cdd68171268879e24b447210d53697ce65b56054dca9f55e6eb9e`
- block: `11847390`
- deployment record: `contracts/deployments/sepolia.json`

The address above is the result of the real Sepolia broadcast. It is not a placeholder. Source verification remains a separate step.

## Reproducible chain demo

After the real Sepolia contract is deployed, generate the exact on-chain inputs from the frozen File A/File B fixtures:

```bash
python scripts/prepare_chain_demo.py \
  --contract <DEPLOYED_SEPOLIA_ADDRESS> \
  > /tmp/gapwitness-demo.env
source /tmp/gapwitness-demo.env
export PRIVATE_KEY=<DEPLOYER_PRIVATE_KEY>
export SEPOLIA_RPC_URL=<SEPOLIA_RPC_URL>
```

The generated values contain no private key. They bind the committed bytes, gap hashes, policy hash, exact UTC window, and station ID to the same values used by the web wallet client. Do not commit the generated file.

Load those values together with `PRIVATE_KEY` and `SEPOLIA_RPC_URL`, then rehearse the adversarial chain flow:

```bash
cd contracts
forge script script/DemoGapPaperOver.s.sol:DemoGapPaperOver \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

The script commits File A first, then submits File B for the same station and exact window. The second submission is expected to revert with `GapPaperedOver`. A successful run therefore produces the concrete demo story on-chain rather than relying on a mocked revert.

## Demo proof artifact

`scripts/build_demo_proof.py` produces a deterministic JSON proof from the three frozen fixtures. It records the exact window, File A gap evidence, File B conflict expectation, File C impossible case, and the Sepolia target chain. When a live contract is supplied, it records the real deployment metadata; without one, it deliberately records deployment status as `pending`, so the repository never manufactures an on-chain claim.

Generate it locally without adding secrets:

```bash
python scripts/build_demo_proof.py \
  --contract 0xa7ab2d2e60a08a089f3749ac3e98b41449b23211 \
  --deployment-tx 0xf0ab1c67eb1cdd68171268879e24b447210d53697ce65b56054dca9f55e6eb9e \
  --deployment-block 11847390 \
  --output /tmp/gapwitness-demo-proof.json
```

The proof artifact is suitable for attaching to a demo review or using as the checklist for the live chain rehearsal. The live submission command above records the public deployment transaction; it contains no wallet key.

## On-chain commitment rule

A commitment is immutable for an exact station and UTC observation window. Re-submitting the identical series hash, gap hash, policy hash, and verdict is a no-op in the corrected contract source. It preserves the original submitter and commitment timestamp and emits no additional `Committed` event. The earlier deployed contract does not have this protection; a fresh deployment is required before claiming it on-chain. Changing any of those fields for an already committed window is rejected. A different gap specifically reverts with `GapPaperedOver` so the demo can expose a later attempt to paper over missing hours.

## Verdicts

- `INTACT` - every expected hourly timestamp is present and no hard physical rule is violated.
- `GAPPED` - one or more expected timestamps are absent.
- `IMPOSSIBLE` - a hard series-specific physical constraint is violated.

Insufficient data is an inspection error, not a verdict. A file with no observations inside the declared window is rejected with `NO_OBSERVATIONS_IN_WINDOW`. Measurements must be finite numbers and timestamps must align exactly to UTC hours, including subsecond precision. Observation windows must start at or after the Unix epoch and span no more than 744 hours; the size limit is checked before allocating the expected timestamp range. Valid fixture hashes and policy identifiers remain unchanged.

## Trust model

The checker is deterministic. AI is outside the trust boundary and may only turn checker-produced facts into a human-readable evidence sentence.

**Integrity is not truth.** GapWitness does not prove sensor calibration or that a measurement is physically truthful. It proves what the submitted file contained, which expected hours were absent, and whether a later submission attempts to rewrite that temporal evidence.

## Independent on-chain verification

`scripts/verify_onchain.py` is the final reproducibility check. It re-runs the deterministic checker against a CSV, recomputes the exact station/window commitment key, reads `commitments(bytes32)` from the supplied EVM RPC, and compares `seriesHash`, `gapHash`, `policyHash`, and `verdictCode` with the chain record. It exits `0` only when an existing commitment matches every checked field.

Example:

```bash
python scripts/verify_onchain.py \\
  checker/demo/file_a.csv \\
  --station-id 2178 \\
  --window-start 2026-09-19T07:00:00Z \\
  --window-end 2026-09-20T07:00:00Z \\
  --contract <DEPLOYED_SEPOLIA_ADDRESS> \\
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

This verification path does not trust the web client. A missing commitment, chain mismatch, hash mismatch, policy mismatch, or verdict mismatch produces a non-zero exit code and a machine-readable JSON report.

## Evidence hashes

- `seriesHash` = Keccak-256 of the exact submitted CSV bytes.
- `gapHash` = Keccak-256 of the canonical sorted UTC gap list joined with newlines.
- `policyHash` = hash of the versioned checker policy.

## Scope freeze

One environmental series, one checker, one chart, one contract, one public testnet deployment, three demo files, one verification script, one clean demo video.

No sensor hardware, sensor network, token, IPFS layer, marketplace, KPI dashboard, chatbot, multi-chain deployment, or live ingestion infrastructure.
