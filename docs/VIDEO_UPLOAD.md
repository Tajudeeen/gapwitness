# Demo publishing handoff

Upload the refreshed `GapWitness-Demo.mp4` to the video host accepted by Devpost. Use public or unlisted playback, then check the link in a signed-out browser. Keep it between 3 and 5 minutes. Captions are burned into the delivered video. It contains a recording of the real deployed application, not a mock interface.

## Suggested title

GapWitness: Keep Missing Environmental Data Visible | ClimateChain Demo

## Suggested description

A report can look complete after important hourly readings disappear. GapWitness compares an environmental CSV with a declared observation window, identifies the exact missing hours, and preserves evidence that another reviewer can reproduce.

This walkthrough shows a controlled seven-hour omission from a frozen OpenAQ/AirNow PM2.5 window, its effect on the reported arithmetic mean, a retained unedited dataset with naturally unavailable readings, local evidence storage, optional Sepolia publishing, and a fresh public testnet verification.

Live app: https://gapwitness-web.vercel.app

Source code and reproducibility: https://github.com/Tajudeeen/gapwitness

Track: Climate Data & Environmental Monitoring, IEEE ClimateChain Global Hackathon 2026.

The Sepolia contract preserves submitted evidence and detects conflicts in the same publisher, station and observation window. It does not certify sensor accuracy, authenticate station ownership, or prove an environmental outcome. No independent pilot benefit is claimed. A new wallet transaction is not performed in this recording.

## Suggested tags

GapWitness, ClimateChain, environmental data, air quality, PM2.5, data integrity, OpenAQ, Ethereum Sepolia, blockchain, hackathon, Deeen Codes

## Complete the submission record

1. Put the actual playback URL in `docs/submission-links.json` as `videoUrl` and in RELEASE_CHECKLIST.md.
2. Put the actual Devpost project URL in `devpostProjectUrl`. Confirm the final form was submitted, rather than inferring submission from a draft URL.
3. Set `organizerEligibilityConfirmed` only after retaining an actual organizer reply resolving the conflicting eligibility wording.
4. Run `python scripts/check_release.py --require-submission --output /tmp/gapwitness-submission-check.json`. This checks explicit records, not video duration/playback or the organizer reply itself.

No video has been published to YouTube or Devpost by this repository. No organizer message has been sent by this release.
