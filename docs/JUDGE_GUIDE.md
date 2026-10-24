# Judge guide

An environmental reviewer can receive a convincing chart whose underlying hourly export is incomplete. GapWitness shows which expected hours are absent before the reviewer relies on the summary, then preserves the original file and reproducible evidence.

[Open the app](https://gapwitness-web.vercel.app) · [Devpost entry](https://devpost.com/software/gapwitness) · [Published demo](https://youtu.be/asl9kkF1EHo) · [Current submission status and video-duration caveat](SUBMISSION_STATUS.md)

## One-minute product check

1. Open [Inspect](https://gapwitness-web.vercel.app/inspect), wait for the checker, and load `File A · 7 deliberate gaps`. Expect `GAPPED`, 17 of 24 observations, and seven missing hours. This is a controlled derivative of real source data.
2. Use the app navigation to open Review. Compare the complete source mean of 3.2792 µg/m³ with 2.9882 µg/m³ after seven rows were deliberately removed. The 8.87% difference illustrates a summary's sensitivity to omission.
3. Open Evidence and save the original CSV and evidence locally. Reopen and recheck the saved record. Inspection and evidence review require no wallet.

## Five-minute evidence check

| Criterion | Exercise or inspect | Evidence boundary |
| --- | --- | --- |
| Climate impact | Review missing hours before using an environmental-data summary | Reviewability is demonstrated. Emissions reduction and downstream environmental outcomes are not measured |
| Innovation and creativity | Compare revisions, preserve exact original bytes, and bind a declared schedule and missing-hour evidence to a publisher | [Related work](ORIGINALITY.md) gives a bounded comparison, not a global novelty claim |
| Technical execution | Open Verify, choose `Published File A proof`, then run a fresh check | Browser recomputation, pinned runtime, publisher-scoped record, calldata, receipt and event must pass. If the RPC fails, the app must withhold fresh confirmation |
| Practical usefulness | Open [Real datasets](https://gapwitness-web.vercel.app/datasets) and inspect the York Fishergate April window | Thirteen retained windows span four stations and two providers. York has two naturally unavailable readings. Operator schedules and independent adoption still need external evidence |
| Presentation and storytelling | Follow the missing rows through Review, Evidence and Verify | The deliberate seven-hour example, naturally unavailable source readings and blockchain witness are separate evidence |

The rubric publishes these five criteria without numerical weights. GapWitness isolates its cryptographic core from non-deterministic drift, surrounded by four intelligent AI assistance layers (intelligent CSV schema auto-detection, omission pattern attribution, counterfactual distortion estimation, and automated compliance brief generation). See [AI architecture](AI_ARCHITECTURE.md).

## Generalization that exists today

The web flow is PM2.5-focused. The API and local batch utility already accept a `generic` hourly policy for temporal completeness and finite numbers, without applying the PM2.5 non-negative rule. [Technical reference](TECHNICAL_REFERENCE.md) documents the API, and [adoption notes](ADOPTION.md) document local batch inspection:

```bash
python scripts/inspect_batch.py checker/demo/review-manifest.json --output /tmp/gapwitness-review.json
```

This command exercises the shipped three-file PM2.5 manifest. For a generic review, an authorized manifest entry must declare `seriesType: "generic"`, its CSV, station and UTC window. Generic support does not establish scientific validation for another pollutant. Current limits are 1 MB per file, 31 days per window and hourly sampling. The batch utility handles up to 100 entries sequentially; this is not a production throughput claim.

## Meaningful refusal

A changed file must not verify against the original commitment. Conflicting evidence for the same publisher, station and window must be rejected. Exact replays preserve the first witness. See [fixture proof](../contracts/deployments/fixture-proof-v2.json), [contracts](../contracts/src/GapWitnessV2.sol) and [verification implementation](../web/src/lib/proof.ts).

The contract stores a submitted claim. It does not parse the CSV or certify sensor calibration or station ownership. A fresh testnet verification demonstrates a defined integrity relationship, not the truth of an environmental measurement.
