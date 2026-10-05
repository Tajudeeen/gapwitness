# GapWitness

Temporal integrity for environmental time series.

> witness the hours that were missing.

GapWitness inspects an environmental CSV against an independently declared hourly observation window, identifies missing timestamps, and commits the resulting temporal evidence on-chain.

## Core demo

1. File A contains a seven-hour gap from 07:00Z through 13:00Z.
2. GapWitness returns `GAPPED` and computes deterministic evidence.
3. File A is the first candidate for an on-chain commitment.
4. File B contains the same 24-hour window with those hours present.
5. A conflicting commitment for the same station and exact window must revert with `GapPaperedOver`.
6. File C keeps the full window but contains a negative PM2.5 value, so the checker returns `IMPOSSIBLE`.

The current checked-in files are deterministic demo fixtures. They are not presented as OpenAQ measurements yet. The production demo will replace File A and File B with a documented real OpenAQ station slice before submission.

## Verdicts

- `INTACT` - every expected hourly timestamp is present and no hard physical rule is violated.
- `GAPPED` - one or more expected timestamps are absent.
- `IMPOSSIBLE` - a hard series-specific physical constraint is violated.

Insufficient data is an inspection error, not a verdict.

## Trust model

The checker is deterministic. AI is outside the trust boundary and may only turn checker-produced facts into a human-readable evidence sentence.

**Integrity is not truth.** GapWitness does not prove sensor calibration or that a measurement is physically truthful. It proves what the submitted file contained, which expected hours were absent, and whether a later submission attempts to rewrite that temporal evidence.

## Stack

- Checker: Python + FastAPI + pandas
- Contract: Solidity + Foundry
- Web: React + Vite + TypeScript + Observable Plot
- Chain: Ethereum Sepolia

## Scope freeze

One environmental series, one checker, one chart, one contract, one public testnet deployment, three demo files, one verification script, one clean demo video.

No sensor hardware, sensor network, token, IPFS layer, marketplace, KPI dashboard, chatbot, multi-chain deployment, or live ingestion infrastructure.

## Evidence hashes

The checker now uses Ethereum-compatible Keccak-256 for both proof values:

- `seriesHash` = Keccak-256 of the exact submitted CSV bytes.
- `gapHash` = Keccak-256 of the canonical sorted UTC gap list joined with newlines.

The hash outputs are prefixed with `0x` so they can be passed directly into Solidity bytes32 fields. The checker tests the same Keccak implementation used by the on-chain proof format.

## Evidence-to-chain boundary

The checker now emits a `chainCommitment` object containing the exact values required by `GapWitness.commit`: station ID, Unix-hour window boundaries, `seriesHash`, `gapHash`, `policyHash`, and numeric verdict.

The contract rejects unaligned hour boundaries and verdicts outside `INTACT=0`, `GAPPED=1`, and `IMPOSSIBLE=2`. This keeps the checker and contract using the same small proof vocabulary.

## Demo fixtures

The adversarial fixtures live in `checker/demo/`:

- `file_a.csv` has 17 observed hours and 7 missing hours.
- `file_b.csv` has all 24 expected hours.
- `file_c_impossible.csv` contains one negative PM2.5 value.

Run:

`python checker/demo/run_demo.py`

Reproduce a single proof payload with:

`python verify.py checker/demo/file_a.csv --station-id demo-station-pm25 --window-start 2026-01-01T00:00:00Z --window-end 2026-01-02T00:00:00Z`

## Status

Milestone 3 is on branch `feat/adversarial-demo-fixtures`: deterministic File A/File B/File C fixtures and a reproducible verification script.