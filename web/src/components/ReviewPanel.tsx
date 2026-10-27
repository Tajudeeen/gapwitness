import { useEffect, useRef, useState } from 'react';
import type { CheckResult } from '../lib/checker';
import { localEvidence } from '../lib/evidence';
import {reportingDecision} from '../lib/reporting-decision';
import {SchedulePanel} from './SchedulePanel';
import type {ScheduleSource} from '../lib/schedule';
import { SourceImpact } from './SourceImpact';
import { compareRevisions, reviewHtml, reviewSummary } from '../lib/review';
import { analyzeOmissionPattern, generateAuditNarrative } from '../lib/ai-analysis.ts';

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReviewPanel({ evidence, filename, source, schedule, onSchedule }: { evidence: CheckResult; filename: string; source: string; schedule:ScheduleSource|null; onSchedule:(s:ScheduleSource|null)=>void }) {
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
  const attribution = analyzeOmissionPattern(evidence);
  const [thresholdText,setThreshold]=useState('3.1');
  const threshold=thresholdText.trim()?Number(thresholdText):NaN;
  const decision=Number.isFinite(threshold)&&threshold>=0?reportingDecision(evidence,threshold):null;

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
    <div style={{display:'flex',gap:'10px',flexWrap:'wrap',margin:'12px 0'}}>
      <button type="button" disabled={!decision} onClick={() => download(reviewHtml(evidence, filename, source, comparison, decision?.threshold, schedule), 'gapwitness-review.html', 'text/html')}>download printable review</button>
      <button type="button" disabled={!decision} onClick={() => download(generateAuditNarrative(evidence, attribution, comparison, decision?.threshold), 'gapwitness-executive-brief.txt', 'text/plain')}>download review brief</button>
    </div>
    <p>Open the downloaded report and print it to PDF. Retain the CSV and evidence JSON with your independently declared schedule.</p>

    <SchedulePanel key={evidence.seriesHash+evidence.windowStart} evidence={evidence} value={schedule} onChange={onSchedule}/>
    <section className="revision-result" aria-label="Reporting claim check">
      <h4>Can this file support a full-window mean claim?</h4>
      <label>Claimed maximum arithmetic mean, µg/m³<input type="number" min="0" step="any" value={thresholdText} onChange={e=>setThreshold(e.target.value)}/></label>
      <p>This is your comparison threshold, not a regulatory standard. The default 3.1 is an illustrative choice for the controlled File A example.</p>
      {decision?<><p>Claim: full-window arithmetic mean at most {decision.threshold} µg/m³.</p>
        <p>Available rows alone {decision.availableRowsOnly} this claim, with mean {decision.availableMean.toFixed(4)}.</p>
        <p role="status">Full-window decision: {decision.status}. {decision.reason}</p>
        <p>Lower bound {decision.lowerMean?.toFixed(4)??'unavailable'} · upper bound {decision.upperMean?.toFixed(4)??'unbounded or unavailable'}.</p>
        <p>{decision.limits}</p><button type="button" onClick={()=>download(JSON.stringify({decision,schedule},null,2),'gapwitness-reporting-decision.json','application/json')}>Download claim decision</button></>:
        <p role="alert">Enter a finite non-negative threshold.</p>}
    </section>
    <section className="revision-result" aria-label="Missing-hour description"><h4>{attribution.categoryLabel}</h4><p>{attribution.rationale}</p><p>{attribution.epistemicNote}</p></section>

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
    <SourceImpact compact evidence={evidence} />
    <a href="https://github.com/Tajudeeen/gapwitness/blob/main/docs/PILOT.md" target="_blank" rel="noreferrer">Run a measured reviewer pilot ↗</a>
  </section>;
}
