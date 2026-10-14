import { useEffect, useRef, useState } from 'react';
import type { CheckResult } from '../lib/checker';
import { localEvidence } from '../lib/evidence';
import { compareRevisions, reviewHtml, reviewSummary } from '../lib/review';

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReviewPanel({ evidence, filename, source }: { evidence: CheckResult; filename: string; source: string }) {
  const [comparison, setComparison] = useState<ReturnType<typeof compareRevisions> | null>(null);
  const [priorName, setPriorName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1; setComparison(null); setPriorName(''); setError(''); setLoading(false);
    return () => { generation.current += 1; };
  }, [evidence]);
  const summary = reviewSummary(evidence);

  async function compare(file: File | undefined) {
    const current = ++generation.current;
    setComparison(null); setPriorName(''); setError('');
    if (!file) { setLoading(false); return; }
    setLoading(true);
    try {
      if (file.size > 1_000_000) throw new Error('Prior CSV exceeds the 1 MB limit.');
      const prior = localEvidence(new Uint8Array(await file.arrayBuffer()), evidence);
      const checked = compareRevisions(prior, evidence);
      if (current !== generation.current) return;
      setComparison(checked); setPriorName(file.name);
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Prior CSV could not be inspected.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }

  return <section className="evidence review-panel" aria-label="Reviewer workspace">
    <span className="kicker">REVIEWER WORKSPACE</span>
    <h3>{summary.action}</h3>
    <p>{summary.reason}</p>
    <p>{summary.completenessPercent.toFixed(2)}% coverage · longest missing run {summary.longestGapHours} hours</p>
    <button type="button" onClick={() => download(reviewHtml(evidence, filename, source, comparison), 'gapwitness-review.html', 'text/html')}>download printable review</button>
    <p>Open the downloaded report and print it to PDF. Retain the CSV and evidence JSON with your independently declared schedule.</p>
    <label>Compare a prior CSV for this same station and window
      <input type="file" accept=".csv,text/csv" aria-label="Prior revision CSV" onChange={event => {
        void compare(event.target.files?.[0]); event.target.value = '';
      }} />
    </label>
    <p>The prior CSV is checked locally in your browser. It isn't uploaded. Use the same sampling convention and schedule for both versions.</p>
    {loading && <p role="status">Checking prior revision…</p>}
    {error && <p role="alert">{error}</p>}
    {comparison && <div className="revision-result" role="status">
      <p>Compared with {priorName}. Exact bytes {comparison.exactBytesChanged ? 'changed' : 'unchanged'}.</p>
      <p>{comparison.addedHours.length} hours added · {comparison.removedHours.length} hours removed · {comparison.changedMeasurements.length} measurements changed</p>
      <p>{comparison.note}</p>
      <button type="button" onClick={() => download(JSON.stringify({ format: 'gapwitness/revision/v1',
        stationId: evidence.stationId, windowStart: evidence.windowStart, windowEnd: evidence.windowEnd,
        policyHash: evidence.policyHash, priorFilename: priorName, currentFilename: filename,
        originalCsvsRequired: true, comparison }, null, 2) + '\n', 'gapwitness-revision.json', 'application/json')}>download revision comparison</button>
    </div>}
    <a href="https://github.com/Tajudeeen/gapwitness/blob/main/docs/PILOT.md" target="_blank" rel="noreferrer">Run a measured reviewer pilot ↗</a>
  </section>;
}
