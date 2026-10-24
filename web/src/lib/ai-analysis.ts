import type { CheckResult } from './checker.ts';
import type { compareRevisions } from './review.ts';
import type { CsvMapping } from './csv-import.ts';

export type InferredSchema = {
  timestampColumn: string;
  valueColumn: string;
  timezone: string;
  units: 'ug/m3' | 'mg/m3';
  confidence: number;
  reasoning: string[];
};

export type AttributionCategory =
  | 'COMPLETE_RECORD'
  | 'ISOLATED_TELEMETRY_DROPOUT'
  | 'EXTENDED_STATION_OUTAGE'
  | 'SELECTIVE_PEAK_OMISSION'
  | 'IMPOSSIBLE_PHYSICAL_MEASUREMENT';

export type OmissionAttribution = {
  category: AttributionCategory;
  categoryLabel: string;
  confidencePercent: number;
  peakHourFraction: number;
  longestRunHours: number;
  runCount: number;
  suspicionLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
  rationale: string;
  epistemicNote: string;
};

export type CounterfactualEstimate = {
  observedMean: number;
  counterfactualMean: number;
  estimatedDistortionPercent: number;
  distortionDirection: 'suppressed' | 'elevated' | 'neutral';
  imputedHoursCount: number;
  bounds: { minEstimate: number; maxEstimate: number };
  epistemicBoundary: string;
};

/**
 * 1. Intelligent Schema Ingest:
 * Analyzes CSV column headers and sample observation rows to infer timestamp,
 * measurement column, timezone handling, and PM2.5 concentration units.
 */
export function inferCsvSchema(headers: string[], sampleRows: string[][] = []): InferredSchema {
  const reasoning: string[] = [];
  let confidence = 0.5;

  let timestampColumn = '';
  let valueColumn = '';
  let timezone = 'embedded';
  let units: 'ug/m3' | 'mg/m3' = 'ug/m3';

  // Find timestamp candidate
  const timeRegex = /^(timestamp|datetime|date_time|date|time|utc_time|recorded_at|instant)$/i;
  const timePartial = /(timestamp|datetime|date|time)/i;

  const exactTime = headers.find(h => timeRegex.test(h.trim()));
  const partialTime = headers.find(h => timePartial.test(h.trim()));

  if (exactTime) {
    timestampColumn = exactTime;
    reasoning.push(`Identified exact timestamp column "${exactTime}".`);
    confidence += 0.2;
  } else if (partialTime) {
    timestampColumn = partialTime;
    reasoning.push(`Identified probable timestamp column "${partialTime}".`);
    confidence += 0.1;
  } else if (headers.length > 0) {
    // Inspect first column if it looks like ISO / date
    if (sampleRows.length && !Number.isNaN(Date.parse(sampleRows[0][0] || ''))) {
      timestampColumn = headers[0];
      reasoning.push(`Column "${headers[0]}" contains parseable date strings.`);
      confidence += 0.15;
    }
  }

  // Find value candidate
  const valueRegex = /^(value|pm25|pm2\.5|pm_25|pm2_5|reading|concentration|conc|measurement)$/i;
  const valuePartial = /(pm25|pm2\.5|pm_25|pm|value|conc|reading)/i;

  const exactVal = headers.find(h => h !== timestampColumn && valueRegex.test(h.trim()));
  const partialVal = headers.find(h => h !== timestampColumn && valuePartial.test(h.trim()));

  if (exactVal) {
    valueColumn = exactVal;
    reasoning.push(`Identified exact measurement column "${exactVal}".`);
    confidence += 0.2;
  } else if (partialVal) {
    valueColumn = partialVal;
    reasoning.push(`Identified probable measurement column "${partialVal}".`);
    confidence += 0.1;
  } else {
    // Fallback: look for numeric column
    const timeIdx = headers.indexOf(timestampColumn);
    for (let i = 0; i < headers.length; i++) {
      if (i === timeIdx) continue;
      if (sampleRows.some(row => row[i] && !Number.isNaN(Number(row[i].trim())))) {
        valueColumn = headers[i];
        reasoning.push(`Selected numeric column "${headers[i]}" as measurement.`);
        confidence += 0.1;
        break;
      }
    }
  }

  // Infer timezone from samples
  const timeIdx = headers.indexOf(timestampColumn);
  if (timeIdx >= 0 && sampleRows.length > 0) {
    const sampleVals = sampleRows.map(r => (r[timeIdx] || '').trim()).filter(Boolean);
    const hasOffset = sampleVals.some(v => /(Z|[+-]\d{2}:?\d{2})$/.test(v));
    const allNaive = sampleVals.length > 0 && sampleVals.every(v => !/(Z|[+-]\d{2}:?\d{2})$/.test(v));

    if (hasOffset) {
      timezone = 'embedded';
      reasoning.push('Detected ISO offset or UTC indicator in timestamp samples.');
      confidence += 0.1;
    } else if (allNaive) {
      timezone = 'Z';
      reasoning.push('No timezone offset found in timestamps; defaulted to UTC interpretation.');
    }
  }

  // Infer units from headers
  const fullHeaderString = headers.join(' ').toLowerCase();
  if (fullHeaderString.includes('mg/m3') || fullHeaderString.includes('mg/m³') || fullHeaderString.includes('milligram')) {
    units = 'mg/m3';
    reasoning.push('Detected milligram units (mg/m³); conversion factor ×1000 required.');
    confidence += 0.1;
  } else {
    units = 'ug/m3';
    reasoning.push('Assumed standard ambient PM2.5 units (µg/m³).');
  }

  return {
    timestampColumn: timestampColumn || (headers[0] ?? ''),
    valueColumn: valueColumn || (headers[1] ?? ''),
    timezone,
    units,
    confidence: Math.min(1.0, Math.max(0.2, confidence)),
    reasoning,
  };
}

/**
 * 2. Omission Pattern Attribution:
 * Classifies whether missing hours resemble random network drops,
 * full station outages, or selective omission during peak exposure hours.
 */
export function analyzeOmissionPattern(evidence: CheckResult): OmissionAttribution {
  const gaps = evidence.missingTimestamps;
  const epistemicNote =
    'Attribution is an empirical heuristic aid. It does not establish legal intent, equipment malfunction, or fraud.';

  if (evidence.impossibleTimestamps.length > 0) {
    return {
      category: 'IMPOSSIBLE_PHYSICAL_MEASUREMENT',
      categoryLabel: 'Physical Sanity Violation (Negative PM2.5)',
      confidencePercent: 99,
      peakHourFraction: 0,
      longestRunHours: 0,
      runCount: 0,
      suspicionLevel: 'HIGH',
      rationale: `${evidence.impossibleTimestamps.length} observations violate the physical non-negative PM2.5 rule. Indicates sensor zero-point drift, electrical fault, or data corruption.`,
      epistemicNote,
    };
  }

  if (gaps.length === 0) {
    return {
      category: 'COMPLETE_RECORD',
      categoryLabel: 'Temporal Completeness Passed',
      confidencePercent: 100,
      peakHourFraction: 0,
      longestRunHours: 0,
      runCount: 0,
      suspicionLevel: 'LOW',
      rationale: 'Every expected observation within the declared window is present and finite.',
      epistemicNote,
    };
  }

  // Group into contiguous runs
  const runs: { start: number; end: number; count: number; hours: number[] }[] = [];
  for (const ts of gaps) {
    const ms = Date.parse(ts);
    const hourOfDay = new Date(ms).getUTCHours();
    const last = runs.at(-1);
    if (last && ms === last.end + 3600000) {
      last.end = ms;
      last.count += 1;
      last.hours.push(hourOfDay);
    } else {
      runs.push({ start: ms, end: ms, count: 1, hours: [hourOfDay] });
    }
  }

  const longestRun = Math.max(...runs.map(r => r.count));
  const runCount = runs.length;

  // Diurnal analysis: Peak human exposure / ambient activity window: 07:00 to 21:00 UTC
  // (In daytime / active hours when air pollution and traffic typically peak)
  const allGapHours = runs.flatMap(r => r.hours);
  const peakGaps = allGapHours.filter(h => h >= 7 && h <= 21).length;
  const peakFraction = allGapHours.length > 0 ? peakGaps / allGapHours.length : 0;

  if (longestRun <= 2 && runCount <= 2) {
    return {
      category: 'ISOLATED_TELEMETRY_DROPOUT',
      categoryLabel: 'Isolated Telemetry Dropout',
      confidencePercent: 88,
      peakHourFraction: peakFraction,
      longestRunHours: longestRun,
      runCount,
      suspicionLevel: 'LOW',
      rationale: `${gaps.length} isolated missing hours across ${runCount} short runs (max ${longestRun}h). Pattern matches transient network packet loss or brief sensor reboot.`,
      epistemicNote,
    };
  }

  if (longestRun >= 12) {
    return {
      category: 'EXTENDED_STATION_OUTAGE',
      categoryLabel: 'Extended Station Outage',
      confidencePercent: 92,
      peakHourFraction: peakFraction,
      longestRunHours: longestRun,
      runCount,
      suspicionLevel: 'MODERATE',
      rationale: `Sustained omission of ${longestRun} continuous hours spanning day and night. Characteristic of prolonged power failure, station maintenance, or hardware replacement.`,
      epistemicNote,
    };
  }

  if (longestRun >= 3 && peakFraction >= 0.7) {
    return {
      category: 'SELECTIVE_PEAK_OMISSION',
      categoryLabel: 'Selective Peak-Period Omission',
      confidencePercent: 86,
      peakHourFraction: peakFraction,
      longestRunHours: longestRun,
      runCount,
      suspicionLevel: 'ELEVATED',
      rationale: `${gaps.length} missing hours clustered predominantly (${Math.round(peakFraction * 100)}%) during daytime peak exposure hours (longest run: ${longestRun}h). Selective omission during high-activity periods artificially deflates daily pollution averages.`,
      epistemicNote,
    };
  }

  return {
    category: 'ISOLATED_TELEMETRY_DROPOUT',
    categoryLabel: 'Multi-Hour Intermittent Omission',
    confidencePercent: 78,
    peakHourFraction: peakFraction,
    longestRunHours: longestRun,
    runCount,
    suspicionLevel: 'MODERATE',
    rationale: `${gaps.length} missing hours distributed across ${runCount} separate intervals. Review station maintenance log for scheduled calibration cycles.`,
    epistemicNote,
  };
}

/**
 * 3. Counterfactual Imputation Estimation:
 * Reconstructs a bounded statistical expectation of what missing hours
 * would have measured, calculating the aggregate mean distortion.
 */
export function estimateCounterfactual(evidence: CheckResult): CounterfactualEstimate | null {
  const gaps = evidence.missingTimestamps;
  if (!gaps.length || !evidence.observations.length) return null;

  const obs = evidence.observations;
  const values = obs.map(o => o.value);
  const observedMean = values.reduce((sum, v) => sum + v, 0) / values.length;

  const obsMap = new Map<number, number>(obs.map(o => [Date.parse(o.timestamp), o.value]));

  // Boundary interpolation: for each missing timestamp, check pre- and post- observation
  let imputedSum = 0;
  let minEstimateSum = 0;
  let maxEstimateSum = 0;

  for (const gapIso of gaps) {
    const gapMs = Date.parse(gapIso);
    // Find closest preceding and succeeding observations
    let prevVal: number | null = null;
    let nextVal: number | null = null;

    for (let step = 1; step <= 24; step++) {
      if (prevVal === null && obsMap.has(gapMs - step * 3600000)) {
        prevVal = obsMap.get(gapMs - step * 3600000)!;
      }
      if (nextVal === null && obsMap.has(gapMs + step * 3600000)) {
        nextVal = obsMap.get(gapMs + step * 3600000)!;
      }
      if (prevVal !== null && nextVal !== null) break;
    }

    let estimatedVal: number;
    if (prevVal !== null && nextVal !== null) {
      estimatedVal = (prevVal + nextVal) / 2;
    } else if (prevVal !== null) {
      estimatedVal = prevVal;
    } else if (nextVal !== null) {
      estimatedVal = nextVal;
    } else {
      estimatedVal = observedMean;
    }

    imputedSum += estimatedVal;
    // Bounded uncertainty range: ±15% or observed std dev
    minEstimateSum += estimatedVal * 0.85;
    maxEstimateSum += estimatedVal * 1.15;
  }

  const totalObservedSum = values.reduce((sum, v) => sum + v, 0);
  const totalExpectedHours = evidence.expectedHours;

  const counterfactualMean = (totalObservedSum + imputedSum) / totalExpectedHours;
  const minMean = (totalObservedSum + minEstimateSum) / totalExpectedHours;
  const maxMean = (totalObservedSum + maxEstimateSum) / totalExpectedHours;

  const delta = observedMean - counterfactualMean;
  const distortionPercent = counterfactualMean > 0 ? (delta / counterfactualMean) * 100 : 0;

  const direction: CounterfactualEstimate['distortionDirection'] =
    Math.abs(distortionPercent) < 0.5 ? 'neutral' : distortionPercent < 0 ? 'suppressed' : 'elevated';

  return {
    observedMean: Number(observedMean.toFixed(4)),
    counterfactualMean: Number(counterfactualMean.toFixed(4)),
    estimatedDistortionPercent: Number(distortionPercent.toFixed(2)),
    distortionDirection: direction,
    imputedHoursCount: gaps.length,
    bounds: {
      minEstimate: Number(minMean.toFixed(4)),
      maxEstimate: Number(maxMean.toFixed(4)),
    },
    epistemicBoundary:
      'Counterfactual estimation is a statistical model for audit impact comparison. It is non-deterministic, unobserved, and NOT committed on-chain.',
  };
}

/**
 * 4. Executive Auditor Copilot:
 * Generates an executive compliance brief synthesized from the evidence,
 * anomaly attribution, and counterfactual analysis.
 */
export function generateAuditNarrative(
  evidence: CheckResult,
  attribution: OmissionAttribution,
  counterfactual: CounterfactualEstimate | null,
  comparison?: ReturnType<typeof compareRevisions> | null,
): string {
  const lines: string[] = [];

  lines.push(`EXECUTIVE COMPLIANCE BRIEF · STATION ${evidence.stationId}`);
  lines.push(`Declared Window: ${evidence.windowStart} to ${evidence.windowEnd} (UTC)`);
  lines.push(`Policy: ${evidence.seriesType} · Final Verdict: ${evidence.verdict}`);
  lines.push('');

  lines.push(`1. COMPLETENESS AUDIT`);
  lines.push(
    `Out of ${evidence.expectedHours} expected hourly observations, ${evidence.observedHours} were verified present (${((evidence.observedHours / evidence.expectedHours) * 100).toFixed(1)}% temporal coverage).`,
  );
  if (evidence.missingTimestamps.length > 0) {
    lines.push(
      `Detected ${evidence.missingTimestamps.length} missing hours across ${attribution.runCount} gap intervals. Longest continuous omission: ${attribution.longestRunHours} hours.`,
    );
  } else {
    lines.push('Full temporal completeness confirmed across all declared hourly boundaries.');
  }
  lines.push('');

  lines.push(`2. AI OMISSION PATTERN ATTRIBUTION`);
  lines.push(`Assessment: ${attribution.categoryLabel} [Suspicion Level: ${attribution.suspicionLevel}]`);
  lines.push(`Confidence: ${attribution.confidencePercent}%`);
  lines.push(`Finding: ${attribution.rationale}`);
  lines.push('');

  if (counterfactual) {
    lines.push(`3. COUNTERFACTUAL IMPACT ASSESSMENT`);
    lines.push(`Reported Available Mean: ${counterfactual.observedMean} µg/m³`);
    lines.push(
      `Estimated Counterfactual Mean: ${counterfactual.counterfactualMean} µg/m³ (Range: ${counterfactual.bounds.minEstimate} – ${counterfactual.bounds.maxEstimate} µg/m³)`,
    );
    lines.push(
      `Summary Distortion: ${counterfactual.estimatedDistortionPercent > 0 ? '+' : ''}${counterfactual.estimatedDistortionPercent}% (${counterfactual.distortionDirection.toUpperCase()})`,
    );
    lines.push(
      `Audit Impact: Dropping ${counterfactual.imputedHoursCount} hours ${counterfactual.distortionDirection === 'suppressed' ? 'artificially lowered' : 'altered'} the aggregate window mean.`,
    );
    lines.push('');
  }

  if (comparison) {
    lines.push(`4. REVISION COMPARISON`);
    lines.push(
      `Compared to prior revision: ${comparison.exactBytesChanged ? 'Exact file bytes changed' : 'Identical file bytes'}.`,
    );
    lines.push(
      `Deltas: +${comparison.addedHours.length} hours added, -${comparison.removedHours.length} hours removed, ${comparison.changedMeasurements.length} measurements altered.`,
    );
    lines.push('');
  }

  lines.push(`5. CRYPTOGRAPHIC PROOF BOUNDARY`);
  lines.push(`Series Hash: ${evidence.seriesHash}`);
  lines.push(`Gap Hash:    ${evidence.gapHash}`);
  lines.push(`Policy Hash: ${evidence.policyHash}`);
  lines.push(
    `Notice: Cryptographic commitment proves data immutability and declared completeness. It does not certify physical sensor calibration or external regulatory truth.`,
  );

  return lines.join('\n');
}
