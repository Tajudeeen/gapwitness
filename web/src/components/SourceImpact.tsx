import sourceA from '../../../checker/demo/file_a.csv?raw';
import sourceB from '../../../checker/demo/file_b.csv?raw';
import type {CheckResult} from '../lib/checker';
import {localEvidence} from '../lib/evidence';
import {compareObservedMeans} from '../lib/impact';
import {navigateLink, type Navigate} from '../lib/navigation';

const input = {stationId: '2178', windowStart: '2026-09-19T07:00:00Z',
  windowEnd: '2026-09-20T07:00:00Z', seriesType: 'pm25'};
const bytes = (value: string) => new TextEncoder().encode(value);
const gapped = localEvidence(bytes(sourceA), input);
const complete = localEvidence(bytes(sourceB), input);
const impact = compareObservedMeans(complete, gapped);

export function SourceImpact({evidence, navigate, compact = false}:{
  evidence?: CheckResult; navigate?: Navigate; compact?: boolean;
}) {
  // Never show source-backed calculations on an unrelated CSV, station, or window.
  if (evidence && (evidence.stationId !== gapped.stationId ||
      evidence.windowStart !== gapped.windowStart || evidence.windowEnd !== gapped.windowEnd ||
      evidence.seriesHash !== gapped.seriesHash || evidence.policyHash !== gapped.policyHash)) return null;
  const Heading = compact ? 'h3' : 'h2';
  const full = impact.fullMean.toFixed(4);
  const submitted = impact.submittedMean.toFixed(4);
  const difference = Math.abs(impact.relativeChangePercent).toFixed(2);
  return <section className={compact ? 'impact-story impact-story-compact' : 'landing-section impact-story'}
    aria-labelledby={compact ? 'impact-review-heading' : 'impact-landing-heading'}>
    <p className={compact ? 'kicker' : 'landing-eyebrow'}>MEASURED EXAMPLE / FROZEN OPENAQ-AIRNOW WINDOW</p>
    <Heading id={compact ? 'impact-review-heading' : 'impact-landing-heading'}>How seven missing hours change the reported average</Heading>
    <p>In this controlled test, seven rows were deliberately removed from an otherwise complete
      24-hour PM2.5 record. The remaining 17 measured values are unchanged. The simple
      arithmetic mean of the available readings becomes lower.</p>
    <div className="impact-values" aria-label="Comparison of simple arithmetic means in micrograms per cubic metre">
      <div className="impact-measure"><span>Complete source / File B</span>
        <strong>{full} <small>µg/m³</small></strong><div className="impact-track"><i style={{width:'100%'}}/></div>
        <small>24 of 24 hourly readings</small></div>
      <div className="impact-measure"><span>Deliberately gapped / File A</span>
        <strong>{submitted} <small>µg/m³</small></strong>
        <div className="impact-track"><i style={{width:`${100 * impact.submittedMean / impact.fullMean}%`}}/></div>
        <small>{impact.retainedHours} of {impact.expectedHours} readings</small></div>
    </div>
    <p className="impact-result"><strong>{difference}% lower average</strong> in the edited example.
      GapWitness identifies the missing hours. It cannot reconstruct unknown measurements or determine
      whether a report is scientifically valid from an incomplete file alone.</p>
    <p className="impact-caveat">This example is a deliberate derivative, not a naturally occurring
      outage or evidence of misconduct. The source is air-quality monitoring, not a measured
      greenhouse-gas reduction or environmental outcome.</p>
    <div className="impact-links">
      <a href="https://github.com/Tajudeeen/gapwitness/blob/main/docs/EVALUATION.md"
        target="_blank" rel="noreferrer">Reproduce the numbers ↗</a>
      <a href="/datasets" onClick={event=>{if(navigate)navigateLink(event,navigate,'datasets');}}>
        See unedited real-source windows →</a>
    </div>
  </section>;
}
