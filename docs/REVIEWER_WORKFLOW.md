# Reviewer workflow improvements

This follow-up changes the current reviewer workflow. Historical submission artifacts, contracts and existing on-chain evidence remain separate.

## Map a source CSV explicitly

On Inspect, choose **Map a different CSV format**. Select the timestamp and measurement columns, declare whether timestamps contain their own offsets or use a specified UTC/fixed offset, and confirm PM2.5 units.

The local preview shows the normalized UTC observations, excluded columns, original-file hash and inspected-file hash. Confirm the mapping before inspection. Negative readings remain negative. Missing measurements, duplicate UTC timestamps, inconsistent rows and invalid values are rejected. No measurements are imputed or silently discarded. Fixed offsets do not infer daylight-saving transitions.

The reporting window still comes from an independently obtained schedule. The assistant does not derive expected coverage from the first and last uploaded rows. Canonical timestamp/value uploads continue to work.

Mapping reads the original file locally. The checker receives only the normalized timestamp/value file. The original source, including additional columns, remains in memory until explicitly saved in this browser or downloaded in a review bundle. Source files are limited to 1 MB and 128 columns; normalized files retain the 1 MB checker limit.

## Download and reopen a complete review

Evidence offers **Download complete review bundle**. The bounded JSON file contains:

- Exact inspected CSV bytes, evidence, declared station/window and policy.
- Original source bytes and the full normalization record for mapped imports.
- Static instructions for local rechecking and a separate fresh chain check.

Use **Open review bundle** on Evidence to reopen it without uploading to the checker or connecting a wallet. The app recomputes the inspected evidence, replays any mapping from the original bytes, and compares both hashes. Changed source bytes, measurements, mapping records or evidence are rejected. Browser saves also retain the pre-normalization source. Legacy saved records and evidence JSON remain supported.

The format is gapwitness/review-bundle/v1, with base64 CSV fields and a 5 MB file limit. It uses no compression or executable content. A bundled chain claim remains unverified until Verify completes an actual RPC check. Individual CSV/JSON downloads remain available. Mapped evidence JSON needs both CSV files when verifying separately.

A bundle can contain all original columns. Handle it according to the source owner's data rules.

## Record a pilot without selecting only favorable results

Start each method timer before downloading its task. The GapWitness task link is shown only during its timed phase, reducing accidental baseline contamination. This UI does not independently enforce participant behavior.

The pilot validates stored durations, scores, source hashes and metadata. It summarizes faster, slower and equal attempts, exact-answer totals, method order and median paired differences. Negative savings remain visible. Zero observations produce no summary or invented benefit.

The same dataset is still repeated. Counterbalance order and disclose learning effects, sample size, unfinished attempts and the baseline method. Anonymous codes do not authenticate independent reviewers. Automated browser trials are tests, not pilot observations.

## External verification remains separate

No independent reviewers, phone-wallet approvals, station signatures or production shared-quota credentials are created by these changes. Follow PILOT.md, MOBILE_WALLET.md and OPERATIONS.md for those checks. The user's confirmed submission is distinct from repository fields whose public receipt/video URLs have not yet been recorded.

## Dependency maintenance

The existing npm audit identified the pinned Vite 7.3.6 as affected. This branch pins Vite 7.3.7 and its registry integrity in the lockfile, with no dependency-graph or major-version change. CI still audits both development and production dependencies. Audit failures now print the affected package, advisory links and available fix instead of requiring a separate artifact download.

## Schedule-backed review and claim decisions

Attach the independent schedule document from Review with its issuer, HTTPS reference and supporting section. The reviewer must check the source meaning. The exact document and declaration are fingerprinted, bound to this station/window and retained in the evidence bundle. Import verifies both fingerprints and the matching context. The attachment is reviewer-attested, not independently authenticated, and is not part of the existing Sepolia commitment. Legacy bundles without an attachment remain readable and explicitly lack source backing. Obtain an expected document fingerprint independently if adversarial package replacement is in scope.

Enter a maximum arithmetic mean on Review. Available-row arithmetic and the full-window decision appear separately. Missing values are never reconstructed: under the non-negative PM2.5 policy the lower bound is known and the upper bound is unbounded. A threshold that could be crossed by unknown observations stays unresolved. The printable report and downloaded decision retain the threshold, bounds, input hash and limits.

The pilot now retains all starts, completed phases and explicit abandonments. Closing the tab leaves an interrupted start, not a guessed completion. Export all attempts alongside paired results, including incomplete pairs. No independent identity or user benefit is authenticated by local storage.
