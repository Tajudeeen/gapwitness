# GapWitness

Temporal integrity for environmental time series.

> witness the hours that were missing.

GapWitness inspects an environmental CSV against an independently declared hourly observation window, identifies missing timestamps, and commits the resulting temporal evidence on-chain.

## Core demo

1. File A contains a real seven-hour gap.
2. GapWitness returns `GAPPED` and computes deterministic evidence.
3. File A is committed on Sepolia.
4. File B fills those seven hours.
5. A conflicting commitment for the same station and exact window reverts with `GapPaperedOver`.

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

## Status

Build started. Milestone 1 is the deterministic checker and contract core.