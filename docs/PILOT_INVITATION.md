# Invite independent environmental-data reviewers

GapWitness needs genuine user evidence, not additional fabricated test cases.

**Pilot link:** https://gapwitness-web.vercel.app/pilot

## Copyable invitation

> I'm testing GapWitness, a tool for checking whether hourly environmental data files have missing observations. Could you spend about 10–15 minutes completing two short review tasks, one using your usual method (such as a schedule-aware spreadsheet) and one using GapWitness? The tool records task time and whether you found the exact missing timestamps. You can stop at any time. Your name is not required, and the app stores the observations only in your own browser. If you agree, please export your results CSV and send it back privately. Please don't include personal or confidential data.

The estimates in the invitation are for planning, **not** observed pilot duration.

## Reviewer instructions

1. Use a browser you control. Avoid a shared account or exposing personal/environmental datasets you don't have rights to share.
2. Read and consent to the local pilot. Use a random anonymous code that is not an email address, full name or public username.
3. Pick a retained source task and the normal review method you already use. Record the method honestly.
4. Follow the assigned order: alternate baseline-first and tool-first across participants. Use the SAME source and window for each paired run, and disclose that repeating the file can produce learning effects.
5. Start the timer when you receive the task. Identify *all* unavailable UTC hours and *all* negative-value policy flags. Submit the exact timestamps, then complete the other method.
6. After both phases, save the task. Export the local pilot CSV and send it to the project owner through an agreed private channel. No records are automatically sent to the project owner.
7. You can stop without saving at any stage. No payment, endorsement, or continuing involvement is implied.

## Owner's evidence checklist

- Recruit 3–5 independent consenting reviewers, not fake personas or code-generated examples.
- Record task identifiers, assignment order and chosen baseline methods, plus any incomplete trials.
- Import only CSVs the reviewers voluntarily share; check the exported structure and source hashes.
- Use `scripts/analyze_pilot.py` to calculate paired time and exact-answer outcomes, including unfavorable findings.
- Document sample size, differences, learning effects, hardware/network context and any missing cases.
- Share only aggregated anonymous results with explicit permission. Do not publish raw participant codes unless consent includes public release.
- Until completed, say **"Independent reviewer pilot not yet completed"**, not "users are 40% faster" or "used by X environmental organizations".

## Known limitation

The browser records its own local trial. It cannot independently authenticate that someone is external, ensure participants are unique, or collect records across devices. That evidence must come from real-world recruitment and consent.
