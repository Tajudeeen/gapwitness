# GapWitness demo, approximately 3–4 minutes

Open https://gapwitness-web.vercel.app before recording. Download File A and File B from `checker/demo/` if you want to demonstrate revision comparison. Use the dedicated pages in the top navigation. The full video must remain within the contest's 3–5 minute requirement.

## 0:00–0:30, Home

An environmental report can look complete after some observations have been left out. A file hash preserves whatever was submitted, but it does not tell a reviewer which expected hours are missing.

I built GapWitness for environmental reviewers who need to inspect hourly records against a separately declared schedule and keep evidence they can reproduce later.

## 0:30–1:10, Inspect

Click Inspect your data, then load File A. Point to the station and UTC window, the chart gaps, and the GAPPED verdict.

This example uses a frozen OpenAQ PM2.5 source window. File A is a deliberate test derivative with seven removed hours. I am not claiming those hours were missing from the upstream source.

The declared window has 24 hours. GapWitness finds 17 observations and identifies the seven missing timestamps. The server computes the result, and the browser independently checks the original bytes, measurements, policy, verdict, and every commitment input before accepting it.

## 1:10–1:45, Review

Click Continue to review. Point to the recommended action and longest missing run. If using comparison, choose the downloaded File B as the prior revision.

The review page explains what needs attention. Comparing this edited file with the complete source shows seven removed hours and no measurement changes among the shared observations. A legitimate correction should be explained rather than automatically treated as fraud. I can export a printable review and keep it with the source files and evidence JSON.

## 1:45–2:10, Evidence

Click Keep this evidence, then Save current inspection in this browser. Point to the saved record and download controls. You can briefly refresh and click Open and recheck if time allows.

The evidence page stores the original CSV and JSON in this browser only when I choose to save them. Reopening checks the evidence again. It is a practical review record, not a cloud backup. I can download both files for independent review.

## 2:10–3:05, Verify

Click Verify. Keep Published File A proof selected and click Verify original bytes and Sepolia. Wait for the actual RPC result. Point to the local file match, pinned runtime match, snapshot block, publisher, transaction, and matching event. Open the transaction in a separate prepared tab if needed.

This is a real source-backed witness on Ethereum Sepolia. The verifier recomputes the original CSV, checks the deployed contract bytecode against the pinned V2 runtime, reads the publisher's record, and checks the mined transaction and its calldata. No wallet is needed to verify it.

If the RPC is unavailable, say exactly that and show the recorded transaction and independent CLI proof instead. Never describe an unavailable fresh check as passed. The published File B rejection is an eth_call check against mined state, not a mined failed transaction.

## 3:05–3:35, Publish and close

Click Publish. Point to the current station/window, checked evidence, and optional wallet button. A live commitment is optional for the video. Do not promise a new transaction unless one has actually been confirmed.

V2 gives each publisher a separate namespace, so another wallet cannot occupy its station and window. Publication preserves the submitted evidence. It does not certify station ownership, sensor calibration, or environmental truth.

Our controlled evaluation covers 601 cases derived from frozen real source data. GapWitness matched all 553 omission cases and matched a strong schedule-aware baseline. Independent reviewer time savings still need a real pilot.

GapWitness gives a reviewer a clear path from original file to explained discrepancy, retained review, and independently checkable testnet witness.
