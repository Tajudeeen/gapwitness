# Demo publication record and handoff

The [published GapWitness demo](https://youtu.be/asl9kkF1EHo) is embedded on the [public Devpost entry](https://devpost.com/software/gapwitness). Public metadata checked October 24 reports 153 seconds, or 2:33. The [rules](https://ieee-climatechain-hack.devpost.com/rules) request a 3–5 minute demo, so the current upload does not meet the stated duration range.

The retained `GapWitness-Demo.mp4` export is a different asset. [recorded-walkthrough.json](recorded-walkthrough.json) records its 228.8-second duration, SHA-256 and historical chain check. Those values must not be assigned to the published 2:33 video.

## Complete the duration requirement

1. Recover the retained 3:49 export or record a new 3–5 minute walkthrough using [DEMO_SCRIPT.md](DEMO_SCRIPT.md). Check the actual file's duration, complete playback and claims before uploading. Historical recording metadata alone does not prove the file remains available.
2. Publish the checked asset to an accepted video host with public or unlisted playback. Check signed-out playback, audio or captions, and the measured duration.
3. Update the existing Devpost entry's video embed to that actual URL. Changing a repository URL does not change Devpost's embed or an existing YouTube upload.
4. Update `videoUrl`, `videoDurationSeconds`, `videoMetadata` and `videoPlaybackChecked` in [submission-links.json](submission-links.json). Keep the shorter upload identifiable as a separate video.
5. Run `python scripts/check_submission.py`. It checks recorded evidence and deliberately fails for the current short upload. The full deployed checker also uses this guard with `--require-submission`.

No new video upload or Devpost edit is performed by this repository cleanup. The public project's exact submission time, organizer acceptance and eligibility decision remain separate from URL discovery.

## Presentation for the longer asset

Suggested title: GapWitness Demo | Find Missing Hours in Climate Data

Open with a reviewer receiving an incomplete environmental export. Show the seven deliberately missing hours, the resulting 8.87% arithmetic-mean difference, a real-source unavailable-reading example, retained evidence, and the optional Sepolia witness. End with who uses the workflow and the current limits.

Describe the implementation as deterministic data checking and reproducible blockchain evidence. Do not claim an AI model, operator authorization, measured reviewer time savings or downstream environmental impact. Show a fresh RPC result only when it actually succeeds. The [judge guide](JUDGE_GUIDE.md) gives an inspection path through the submitted implementation.
