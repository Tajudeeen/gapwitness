# Review assistance and evidence boundaries

The historical filename is retained for existing links. No trained model or generative NLP system runs in this workflow. Earlier descriptions of time-series ML, zero-shot inference, calibrated confidence, legal admissibility and non-deterministic imputation overstated the implementation and have been removed.

## Implemented behavior

- CSV mapping suggestions use header matching, sample timestamps and measurement units. A human confirms every mapping, timezone and unit. No probability of correctness is assigned.
- Gap descriptions count contiguous missing runs. They infer no sensor failure, selective deletion, cause or intent. Fixed global peak hours and hardcoded confidence scores are removed.
- The full-window mean check uses the non-negative PM2.5 policy: sum(observed)/expectedHours is a lower bound. A gap leaves the upper bound unbounded. If the lower bound exceeds the user's threshold the claim is not supported; otherwise a gap remains unresolved. Complete valid data can support the claim. Generic or negative measurements abstain. No missing readings are imputed.
- Plain-text and printable review briefs report the deterministic evidence and decision, with explicit limits.
- The CLI `python scripts/ai_copilot.py checker/demo/file_a.csv --threshold 3.1` retains its historical entry point but now uses the canonical checker and the same bounds.

## Source and trust

Reviewers can retain a schedule document, issuer label, HTTPS source, source section and attachment time. The app binds these to the exact station/window and checks hashes when importing evidence. The source document is stored locally and exported inside the evidence bundle, never executed. A digest does not authenticate an issuer, establish what a document means, or prevent an adversary from replacing an entire self-consistent package. Obtain the document or expected digest through an independently trusted channel. The schedule attachment and claim decision are not covered by the historical on-chain commitment.

## Evaluation

The known seven-row omission is controlled and is labeled accordingly. No natural misconduct, recovered unknown measurements, real-user time savings, legal acceptance or environmental outcome is claimed. The pilot starts empty and retains interrupted attempts. Independently observed pilot results and authoritative schedule evidence must be supplied by real people.
