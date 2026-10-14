# GapWitness demo, approximately 3–4 minutes

## 0:00–0:30, landing page

An environmental report can look complete after some observations have been left out. If we hash that file afterward, the hash preserves the edited file, but it cannot tell us which hours should have been there.

I built GapWitness for the Climate Data & Environmental Monitoring track. It helps reviewers check hourly environmental records against an independently declared reporting window and preserve evidence for later review.

## 0:30–1:15, lab, load File A

This example comes from a frozen OpenAQ PM2.5 source window. File A is a deliberate test derivative. I removed seven known hours so we can check whether the tool detects them. I am not claiming those hours were missing from the upstream source.

The window is 24 hours. GapWitness finds 17 observations and lists the seven absent hours. The hatched slots keep missing observations separate from actual measurements. You can select each hour to inspect it.

The Python checker calculates the result, and the browser independently checks the original CSV bytes, timestamps, hashes, and verdict before allowing a commitment. An altered checker response is rejected.

## 1:15–1:50, download evidence, load File B and File C

I can export this evidence as JSON and retain the exact CSV. Inspection does not require a wallet, and organizations can run the same checks locally in a batch without uploading their files.

File B preserves the complete source window. It returns INTACT. File C contains a deliberately impossible negative PM2.5 value, so it returns IMPOSSIBLE. An intact record establishes temporal completeness under this policy. It does not prove sensor accuracy.

## 1:50–2:40, V2 proof file and explorer

The publisher-scoped Sepolia contract stores compact hashes and the verdict. The CSV remains off-chain. Each signing wallet has its own namespace for a station and window, so another wallet cannot occupy that publisher's record first.

This public proof contains the mined File A receipt and matching series, gap, policy, and verdict fields. The changed File B was rejected through an RPC execution check against mined state. That rejection is not a mined failed transaction.

An exact replay keeps the original witness and timestamp. A changed submission for the same publisher and window conflicts with the first record. This makes differing evidence visible without claiming that every correction is fraudulent.

## 2:40–3:25, adoption and limits

The first users are environmental reviewers, researchers, and data publishers checking station exports before accepting a report. They can inspect a CSV, retain the evidence, and optionally publish a witness for later independent verification.

The measured results today are correctness checks and local computation benchmarks. I have not measured emissions reduced, real-world adoption, or reviewer time saved. A practical pilot would measure review time and usability with independent reviewers and their own files.

Wallet identity also does not establish station authority. Reviewers must confirm the publisher independently. GapWitness keeps the missing hours visible and gives reviewers evidence they can reproduce.

## Recording checklist

- Use the frozen fixture buttons for the source-backed demonstration.
- Open the V2 deployment and fixture-proof files after they have been integrated.
- Show the transaction explorer and the independent verifier's matching result.
- Keep source-backed examples and the synthetic browser comparison clearly distinguished.
- Show no wallet keys, populated environment files, or unrelated private data.
