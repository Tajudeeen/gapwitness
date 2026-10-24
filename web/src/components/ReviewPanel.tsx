import { useEffect, useRef, useState } from 'react';
import type { CheckResult } from '../lib/checker';
import { localEvidence } from '../lib/evidence';
import { SourceImpact } from './SourceImpact';
import { compareRevisions, reviewHtml, reviewSummary } from '../lib/review';
import { analyzeOmissionPattern, estimateCounterfactual, generateAuditNarrative } from '../lib/ai-analysis.ts';

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
  const attribution = analyzeOmissionPattern(evidence);
  const counterfactual = estimateCounterfactual(evidence);

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
      <button type="button" onClick={() => download(reviewHtml(evidence, filename, source, comparison), 'gapwitness-review.html', 'text/html')}>download printable review</button>
      <button type="button" onClick={() => download(generateAuditNarrative(evidence, attribution, counterfactual, comparison), 'gapwitness-executive-brief.txt', 'text/plain')}>download AI compliance brief</button>
    </div>
    <p>Open the downloaded report and print it to PDF. Retain the CSV and evidence JSON with your independently declared schedule.</p>

    <div className="revision-result" style={{marginTop:'20px',background:'#faf7f2'}} aria-label="AI Omission Pattern Attribution">
      <span className="kicker">AI ANOMALY ATTRIBUTION</span>
      <h4 style={{margin:'6px 0'}}>{attribution.categoryLabel} <span style={{fontSize:'12px',padding:'2px 6px',borderRadius:'4px',background:attribution.suspicionLevel==='HIGH'?'#e8d2d2':attribution.suspicionLevel==='ELEVATED'?'#f2e4c9':'#d6e4d9',color:'#222'}}>{attribution.suspicionLevel} SUSPICION</span></h4>
      <p style={{fontSize:'13px'}}>{attribution.rationale}</p>
      <p style={{fontSize:'11px',color:'#6b655b'}}>{attribution.epistemicNote}</p>
      {counterfactual && <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px dashed #d8d0c2',fontSize:'13px'}}>
        <span className="kicker">COUNTERFACTUAL IMPACT</span>
        <p>Observed Available Mean: <strong>{counterfactual.observedMean} µg/m³</strong> · Estimated Complete Mean: <strong>{counterfactual.counterfactualMean} µg/m³</strong></p>
        <p>Summary Distortion: <strong>{counterfactual.estimatedDistortionPercent > 0 ? '+' : ''}{counterfactual.estimatedDistortionPercent}% ({counterfactual.distortionDirection})</strong></p>
        <p style={{fontSize:'11px',color:'#6b655b'}}>{counterfactual.epistemicBoundary}</p>
      </div>}
    </div>

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
