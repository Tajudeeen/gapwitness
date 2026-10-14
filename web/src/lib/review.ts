import type { CheckResult } from './checker';

export function reviewSummary(evidence: CheckResult) {
  const gaps = evidence.missingTimestamps;
  const runs: { start: string; end: string; hours: number }[] = [];
  for (const timestamp of gaps) {
    const last = runs.at(-1);
    if (last && Date.parse(timestamp) === Date.parse(last.end) + 3600000) {
      last.end = timestamp; last.hours += 1;
    } else runs.push({ start: timestamp, end: timestamp, hours: 1 });
  }
  return {
    completenessPercent: evidence.observedHours / evidence.expectedHours * 100,
    longestGapHours: Math.max(0, ...runs.map(run => run.hours)),
    gapRuns: runs,
    action: evidence.impossibleTimestamps.length ? 'Request measurement validation' :
      gaps.length ? 'Request an explanation for missing hours' : 'Temporal check passed',
    reason: evidence.impossibleTimestamps.length ? 'Negative PM2.5 readings need source review. Missing hours, if present, also remain unresolved.' :
      gaps.length ? 'Keep the declared schedule and request the missing records or a documented explanation before accepting completeness.' :
        'Every declared hour is present. Source authority and measurement accuracy still need separate review.',
  };
}

export function compareRevisions(prior: CheckResult, current: CheckResult) {
  if (prior.stationId !== current.stationId || prior.windowStart !== current.windowStart ||
      prior.windowEnd !== current.windowEnd || prior.policyHash !== current.policyHash) {
    throw new Error('Revision comparison requires the same station, UTC window, and policy.');
  }
  const before = new Map(prior.observations.map(row => [row.timestamp, row.value]));
  const after = new Map(current.observations.map(row => [row.timestamp, row.value]));
  return {
    priorSeriesHash: prior.seriesHash, currentSeriesHash: current.seriesHash,
    exactBytesChanged: prior.seriesHash !== current.seriesHash,
    addedHours: [...after.keys()].filter(hour => !before.has(hour)),
    removedHours: [...before.keys()].filter(hour => !after.has(hour)),
    changedMeasurements: [...after].filter(([hour, value]) => before.has(hour) && before.get(hour) !== value)
      .map(([timestamp, value]) => ({ timestamp, before: before.get(timestamp)!, after: value })),
    note: 'A revision can be a legitimate correction. This comparison does not establish fraud or source authority.',
  };
}

const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function reviewHtml(evidence: CheckResult, filename: string, source: string,
  comparison: ReturnType<typeof compareRevisions> | null = null) {
  const summary = reviewSummary(evidence);
  const list = (values: string[]) => values.length ? `<ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>` : '<p>None.</p>';
  const row = (label: string, value: unknown) => `<tr><th>${label}</th><td>${escapeHtml(value)}</td></tr>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>GapWitness review report</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:24px;color:#18352a}h1,h2{line-height:1.2}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #ccd8d0;overflow-wrap:anywhere}th{width:30%}code{overflow-wrap:anywhere}section{margin:30px 0}small{color:#42594d}@media print{body{margin:0;padding:0}h2{break-after:avoid}tr{break-inside:avoid}}</style>
<h1>Environmental CSV review</h1><p>${escapeHtml(summary.action)}</p><p>${escapeHtml(summary.reason)}</p>
<table>${row('File', filename)}${row('Source label', source)}${row('Station', evidence.stationId)}${row('Declared UTC window', `${evidence.windowStart} to ${evidence.windowEnd}, end excluded`)}${row('Policy', evidence.seriesType)}${row('Verdict', evidence.verdict)}${row('Coverage', `${evidence.observedHours}/${evidence.expectedHours} hours (${summary.completenessPercent.toFixed(2)}%)`)}${row('Longest gap', `${summary.longestGapHours} hours`)}</table>
<section><h2>Missing timestamps</h2>${list(evidence.missingTimestamps)}</section>
<section><h2>Negative measurement timestamps</h2>${list(evidence.impossibleTimestamps)}</section>
${comparison ? `<section><h2>Revision comparison</h2><p>Exact bytes ${comparison.exactBytesChanged ? 'changed' : 'unchanged'}. ${comparison.addedHours.length} hours added, ${comparison.removedHours.length} removed, ${comparison.changedMeasurements.length} measurements changed.</p><h3>Added hours</h3>${list(comparison.addedHours)}<h3>Removed hours</h3>${list(comparison.removedHours)}<h3>Changed measurements</h3>${list(comparison.changedMeasurements.map(item => `${item.timestamp}: ${item.before} to ${item.after}`))}<p>Prior file hash: <code>${escapeHtml(comparison.priorSeriesHash)}</code></p><p>${escapeHtml(comparison.note)}</p></section>` : ''}
<section><h2>Reproduce this review</h2><p>Retain the original CSV, the evidence JSON, the independent reporting schedule, and this report. Browser evidence was independently recomputed before this report was generated. Print this page to save a PDF.</p>
<table>${row('Series hash', evidence.seriesHash)}${row('Gap hash', evidence.gapHash)}${row('Policy hash', evidence.policyHash)}</table></section>
<small>This report is a temporal review aid, not an environmental compliance certificate. The window is supplied by the reviewer. It does not establish sensor calibration, station authority, regulatory acceptability, fraud, or health outcomes. A source label is context, not authentication. No blockchain transaction is claimed by this report.</small></html>`;
}
