# Threat model and security evidence

## Protections implemented

| Threat | Protection | Evidence |
| --- | --- | --- |
| A different wallet occupies a publisher's station/window | V2 includes `msg.sender` in its immutable commitment key | Foundry attacker-isolation fuzz test and V2 RPC key comparison |
| Checker returns invented hashes, verdicts, or chart values | Browser independently parses the exact uploaded bytes and compares every evidence field, including chain inputs | Browser tampering regression and independent evidence tests |
| Oversized multipart body fills disk before endpoint checks | ASGI gate bounds the complete request before multipart parsing | Fixed and chunked request-body regressions |
| Ambiguous CSV chooses an unintended column | Duplicate headers and inconsistent row widths are rejected | API and browser evidence regressions |
| NUL padding creates a misleading station encoding | Station IDs require 1–31 UTF-8 bytes with no NUL character | API and local verifier checks |
| Inspection responses arrive out of order | Cancellation, request generation checks, and evidence invalidation | Browser upload/demo race regressions |
| Exact replay rewrites provenance | Replay leaves storage unchanged and emits no event | Legacy and V2 contract regressions |
| An altered deployment is used accidentally | V2 web manifest records the runtime bytecode hash and verifies it before committing | Deployment proof and wallet checks |
| A successful receipt is misreported as matching evidence | Wallet reads the stored record and checks every committed field after mining | Wallet receipt validation |

## Claims and residual trust

V2 authenticates the signing publisher wallet. It does not prove that the wallet belongs to a particular physical station or organization. A reviewer needs an independently approved mapping of organization/station to wallet before treating a record as authoritative.

The contract still permits arbitrary claims within the sender's own namespace. It stores commitments, not a signed checker attestation or proof of CSV execution. Use the retained exact CSV and independent verifier to evaluate those claims. A publisher may lie about values or choose an inappropriate window, so the reporting schedule must come from outside the submitted file.

The browser and server check the same policy independently, but their application code and delivery infrastructure are trusted. CSV bytes go to the configured HTTP checker. They are not posted on-chain. Local batch review avoids uploads. Sensor calibration and physical truth require domain validation outside GapWitness.

First-witness immutability rejects silent replacement. The revision comparison makes added/deleted hours and changed measurements explicit. Legitimate corrected reports still need documented review and acceptance. A conflict establishes differing evidence, not intent to deceive.

Browser-saved records are not trusted on reopen. Their exact CSV bytes and every evidence field are recomputed before entering the active workflow. Saved chain metadata cannot restore a witnessed receipt in the publication view. The separate verifier requires fresh RPC matching of the pinned runtime, stored fields, publisher key, and optional transaction. Its results trust the RPC provider and delivered browser code; they are not light-client proofs. IndexedDB is local browser storage rather than cloud backup or authenticated organizational retention.

The rate limiter is bounded but per process. It resets on restarts and does not establish distributed abuse prevention. Request-body assembly has a 15-second deadline and uses a bounded byte buffer even for fragmented chunks. Concurrent workload, upstream availability, and production capacity still need platform controls and load tests for institutional service levels.

Historical V1 records use a global station/window key and remain vulnerable to first-writer squatting. They are retained for reproducibility and are never represented as upgraded. Only a deployed, proved V2 address has publisher isolation.

## Verification

Run the Python, browser, and Foundry checks described in README. Verify a V2 CSV with the exact publisher:

```bash
python scripts/verify_onchain.py checker/demo/file_a.csv --station-id 2178 \
  --window-start 2026-09-19T07:00:00Z --window-end 2026-09-20T07:00:00Z \
  --contract <V2_ADDRESS> --publisher <PUBLISHER_ADDRESS>
```

Use `contracts/deployments/sepolia-v2.json` and `fixture-proof-v2.json` only after their deployment workflow succeeds. Explorer source verification requires the owner's Etherscan API credential and remains separate from RPC evidence.
