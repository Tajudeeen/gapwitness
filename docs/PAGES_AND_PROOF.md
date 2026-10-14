# Pages and proof workflow

GapWitness provides separately addressable pages in a React application. Each page has one job. Vercel rewrites route requests to the app entry point so direct links and refreshes work. The browser keeps the active inspection in memory across navigation. There is no account system or shared database.

| Page | Job | Evidence boundary |
| --- | --- | --- |
| `/` | Explain the use case, measured results, and limits | Illustrations remain labeled synthetic |
| `/inspect` | Declare a UTC schedule, upload a CSV, inspect observations and verdict | Browser independently recomputes all checker evidence |
| `/review` | Explain discrepancies, compare a prior CSV, export a printable report | Prior CSV stays in the browser; comparison does not establish misconduct |
| `/evidence` | Explicitly save, reopen, export, and delete review records | Original CSV and JSON stay in this browser; reopen verifies them again |
| `/publish` | Optionally connect a wallet and publish to Sepolia | Receipt and stored fields are checked; publisher namespace does not certify station ownership |
| `/verify` | Recompute the original CSV and independently read the pinned V2 contract | Fresh RPC matching is separate from saved metadata or historical artifacts |

The old `/?view=lab` URL remains a compatibility view for previous links. New product navigation uses the dedicated pages. Unknown paths show a useful page-not-found view rather than a blank screen.

## Follow the complete flow

1. Inspect your original CSV against a reporting schedule obtained separately. File A is a documented derivative with seven deliberately removed hours; File B preserves the complete frozen source window; File C tests the negative-value policy.
2. Open Review. Compare a prior export if one exists. Keep the printed report, exact source files, and evidence JSON. Corrections need explanation and acceptance by the reviewer.
3. Open Evidence and explicitly save in this browser. Refresh the page and reopen the saved record. Its bytes and all evidence fields are rechecked. Reopened chain metadata is a claim awaiting fresh verification.
4. Publish if you need a testnet witness. The wallet action is optional and requires Sepolia. Editing inputs remains locked during a wallet operation, even when navigating back to Inspect.
5. Open Verify. Select the current inspection, the published File A example, or an original CSV/evidence JSON pair. Supply the publisher and optional transaction hash. Imported files stay local.
6. Download the verification result after a successful fresh check. It records the snapshot block, first-witness time, publisher, key, selected transaction, and whether a matching new-witness event is present.

## Fresh verification checks

The read-only verifier checks:

- Exact CSV bytes, timestamps, measurements, missing hours, policy, verdict, and commitment inputs against the JSON.
- Ethereum Sepolia chain ID and one mined snapshot block.
- Deployed runtime hash against `web/src/lib/deployment.ts`, which pins the proven V2 deployment.
- Contract version 2 and the publisher-scoped commitment key.
- Stored series hash, gap hash, policy hash, verdict, first-witness time, and publisher.
- When a transaction is supplied, its successful mined receipt, destination, sender, block, commit calldata, and matching event. A no-event replay is distinguished from a new witness.

Altered files, mismatched evidence, wrong publishers, unknown deployments, missing records, failed/unrelated transactions, and RPC errors cannot produce a fresh confirmation. Editing verification inputs clears the prior result. The public RPC is configurable through `VITE_SEPOLIA_RPC_URL`; it must be a public browser-compatible URL with no secret credential.

`contracts/deployments/runtime-v2.hex` retains the compiled runtime used by the verifier's regression tests. Its Keccak hash must match the manifest. The exact deployment source revision is recorded in `sepolia-v2.json`. Sourcify confirmed exact creation and runtime matches; the actual response is retained in sourcify-v2.json. Etherscan source verification remains separate and unconfirmed.

These are RPC-confirmed checks, not Ethereum light-client or Merkle state proofs. The verifier trusts the provider's responses and the delivered browser code. It does not certify station authority, source honesty, sensor calibration, scientific acceptability, or environmental outcomes. Sepolia is a test network.

## Storage and privacy

Explicit saves use IndexedDB, bounded to 20 records and 10 MB of CSV bytes per browser. Each CSV remains capped at 1 MB. The saved record includes the CSV and cleaned evidence JSON. Browser quotas, private mode, site-data clearing, or device changes can remove or restrict storage, so download backups. There is no cloud sync or authentication claim.

Current inspection uploads go to the configured checker. Prior-revision comparison and file verification remain local. Read-only RPC requests contain contract addresses, hashes, transaction IDs, and publisher metadata. Publication puts compact evidence on Sepolia, never the CSV itself.

## Validation

The page tests cover navigation and browser history, refreshes, empty states, unknown paths, local persistence and deletion, tampered saved/imported evidence, source-backed revision reports, and proof success/failure using explicit RPC mocks. Live production verification separately checks the public pages and actual source-backed Sepolia witness. Mock tests are not described as mined transactions.

The additional Datasets, Pilot, and Status pages provide frozen real-source inspection, actual paired review collection, and scoped instance operations. Verify supports optional operator signatures while requiring external operator-to-key authentication. See REAL_CORPUS.md, PILOT.md, OPERATOR_AUTHORITY.md, and OPERATIONS.md.
