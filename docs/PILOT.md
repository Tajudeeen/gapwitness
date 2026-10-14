# Run a real reviewer pilot

Current status: no independent-user pilot has been completed. The observation template contains headers only. Automated correctness results are available in EVALUATION.md and are not adoption evidence.

## First practical use case

An air-quality research assistant reviews an hourly station export before including it in a report. They obtain the station's reporting schedule separately, inspect the export, request an explanation for missing hours or negative PM2.5 readings, and retain the review record. Later, a revised export arrives. They compare both versions to see whether records were restored, deleted, or corrected.

This is a review step, not a regulatory acceptance rule. The organization decides what completeness is acceptable. Neither a zero-gap result nor a publisher wallet authenticates sensor measurements.

## Run the workflow now

1. Open the [live lab](https://gapwitness-web.vercel.app/?view=lab). Load File A to review the documented seven-hour derivative. Load File B for the complete source window. These are demonstrations, not natural outages or evidence of misconduct.
2. Under Reviewer Workspace, download the printable review. Keep the original CSV and evidence JSON alongside it. Open the HTML report and print it to PDF if your review system needs one.
3. Load File B as the current inspection, then select File A as the prior revision. The comparison should report seven hours added, zero removed, and zero changed measurements. Reverse the files to inspect deletion.
4. For an actual project, replace the examples with an authorized export. Independently declare the station, UTC window, hourly frequency, timestamp convention, units, and policy. A changed window or policy is a new review, not a like-for-like revision.
5. Record the discrepancy, explanation, reviewer decision, and retained filenames in the organization's existing review system. Ask the source operator before treating a missing reading as an unexplained omission.

The prior CSV stays in the browser. The current inspection CSV is uploaded to the configured checker. Local batch review is available when uploads are unsuitable. Avoid sending personal data or restricted records to the public demo.

## Measure benefits without inventing them

Recruit 3–5 consenting reviewers through your own contacts. No outreach has been sent by this project. Ask each reviewer to perform matched tasks using their normal method and GapWitness. Their normal method can be a competent schedule-aware spreadsheet or script, not a deliberately ineffective baseline.

Tasks should ask for the exact missing timestamps, negative readings, and an explanation of what changed between revisions. Score answers against retained ground truth. Include a complete file, an interior gap, a boundary omission, a changed reading, and a valid correction. Use an independent schedule for every task.

Use comparable datasets with the same duration and issue difficulty. If repeating the same dataset, counterbalance task order across reviewers and disclose the learning effect. Record `baseline-first` or `tool-first`. Start the stopwatch when the reviewer receives the task and stop when they submit their answer. Include any setup required by each method. Do not substitute server milliseconds for reviewer seconds.

Record only anonymous participant codes, task codes, observed durations, and correctness. Keep permission and feedback records privately in your own system. Each row in `data/pilot/observations-template.csv` represents one paired task. Correctness is `1` only when the submitted answer matches the ground truth, otherwise `0`. Leave unfinished tasks out and document attrition separately.

```bash
python scripts/analyze_pilot.py your-observations.csv --output your-pilot-results.json
```

The analyzer rejects empty records, duplicate pairs, invalid durations, and malformed scores. It reports paired differences, including slower outcomes, plus accuracy and task-order counts. It cannot authenticate participants or establish causal effects. Report the sample size, task definitions, baseline, order, unsuccessful outcomes, and measurement method with any public number.

## Feedback and adoption evidence

Ask what part of the task was difficult, whether the exported record fits their workflow, which explanations were unclear, and whether they would use it again. Keep actual feedback rather than rewriting it as praise. Claim an independent trial only after one occurred, active adoption only when the tool is used in real work, and environmental benefit only when a downstream outcome has been observed and supported.
# In-app collection

Open https://gapwitness-web.vercel.app/pilot. The browser records actual stopwatch duration and exact timestamp accuracy for paired baseline and tool phases. It starts with zero participants and saves locally only after both phases. Use anonymous codes, record the normal method, obtain consent, counterbalance order, and retain the source CSV hash. Export CSV for scripts/analyze_pilot.py. Synthetic browser-test trials are regression checks and must not be counted as real participants. A participant code is not independent identity authentication.
