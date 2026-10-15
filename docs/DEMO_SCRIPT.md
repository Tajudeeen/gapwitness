# GapWitness submission demo: 3 minutes 45 seconds

The official rules require **3–5 minutes**. This is a recording plan, not a claim that the revised video has been filmed or uploaded. Record the currently deployed app only after the latest frontend passes checks. Use the real, retained fixtures and a **fresh** Sepolia verification result.

## 00:00–00:25 | Home: the environmental problem
Open https://gapwitness-web.vercel.app

"A report can look complete after important environmental observations disappear. If a reviewer only hashes the final file, they don't know which hourly readings should have existed. GapWitness checks a declared schedule and preserves the evidence of every missing hour."

## 00:25–01:05 | Inspect: source-backed controlled omission
Open Inspect and load **File A**, station 2178, September 19 07:00Z through September 20 07:00Z.

"This example starts with a frozen OpenAQ/AirNow PM2.5 record. For our controlled test, we deliberately removed seven of 24 readings. GapWitness finds all seven missing timestamps, reports 17/24 coverage and checks the result independently in the browser. The source was not naturally missing these hours."

Point to the chart gaps and GAPPED verdict.

## 01:05–01:30 | Review: why gaps affect interpretation
Open Review. Point to the new **source-backed average comparison**, before and after, then compare File B as the prior complete source if time permits.

"The complete window's arithmetic mean is about 3.2792 micrograms per cubic metre. Removing those seven unchanged-source observations makes the available-reading mean 2.9882, around 8.87% lower. This shows why a data gap can change a summary; it does not establish a real-world manipulation or a health outcome."

## 01:30–01:55 | Datasets: unedited real-world gaps
Open Real Datasets, show York Fishergate April 2025. It has two source-unavailable readings. Click Open this dataset in Inspect if time allows.

"We also retained thirteen unedited windows across four stations and two providers. This York window contains two naturally unavailable readings. We preserve the upstream provenance rather than passing a generated test gap off as a source outage."

## 01:55–02:20 | Evidence: keep the original
Return to File A's inspection if necessary, then open Evidence and explicitly save the record. Point to the export and reopen-and-recheck path.

"The saved evidence contains the original CSV and reproducible hashes. Reopening recomputes it. Storage is local to this browser, so the reviewer can export both files. The chain never stores the raw CSV."

## 02:20–03:15 | Verify: public testnet witness
Open Verify. Select **Published File A proof** and click **Verify original bytes and Sepolia**. Wait for an actual RPC result. Show the pinned runtime hash result, publisher, transaction, commitment key, and mined block. Open https://sepolia.etherscan.io/tx/0xbca8fc950d106c7952ec78787bd8b57181d4ec4febb3882653318ea6dea7ad08 .

"This is a real Ethereum Sepolia V2 witness, not a mock transaction. Anyone can independently recompute the source evidence and compare it with the stored record. The contract protects consistency in the publisher's namespace for this exact station and window. It does not authenticate station ownership or sensor accuracy."

If the RPC check fails or is unavailable, say so. Show the retained receipt as historical evidence, not a fresh pass.

## 03:15–03:45 | Publish, real users, close
Briefly open Publish and Pilot. Do not send a new transaction unless necessary; don't present the uncompleted independent pilot as results.

"Publication is optional and requires test ETH. Reviewers can inspect without a wallet. Our controlled evaluation covers 601 cases and the source corpus includes naturally unavailable readings. A real reviewer pilot is prepared, with results still to be collected. GapWitness gives environmental teams a reproducible path from a report to the missing timestamps, a review decision, and a testnet witness."

## Recording safeguards
- Use a clean browser and stable screen size. Hide passwords, wallet keys and browser extensions containing secrets.
- Verify the source File A scenario matches the expected 17/24 hours before filming.
- Keep the public video 3–5 minutes, use a public playback URL, and check it in an incognito browser.
- Don't claim emissions reduction, fraud detection, source certification, or reviewer time savings.
- See docs/RECORDED_WALKTHROUGH.json only if you have a recorded artifact at that exact path. Existing delivery metadata is in docs/recorded-walkthrough.json; it describes a prior walkthrough, not this updated script.
