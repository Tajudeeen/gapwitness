import type {CheckResult} from './checker';
import type {compareRevisions} from './review';
import {reportingDecision} from './reporting-decision.ts';
export type InferredSchema={timestampColumn:string;valueColumn:string;timezone:string;units:'ug/m3'|'mg/m3';reasoning:string[]};
export type OmissionAttribution={category:string;categoryLabel:string;longestRunHours:number;runCount:number;rationale:string;epistemicNote:string};
/**
 * 1. Rule-based schema suggestions:
 * Analyzes CSV column headers and sample observation rows to infer timestamp,
 * measurement column, timezone handling, and PM2.5 concentration units.
 */
export function inferCsvSchema(headers: string[], sampleRows: string[][] = []): InferredSchema {
  const reasoning: string[] = [];


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

  } else if (partialTime) {
    timestampColumn = partialTime;
    reasoning.push(`Identified probable timestamp column "${partialTime}".`);

  } else if (headers.length > 0) {
    // Inspect first column if it looks like ISO / date
    if (sampleRows.length && !Number.isNaN(Date.parse(sampleRows[0][0] || ''))) {
      timestampColumn = headers[0];
      reasoning.push(`Column "${headers[0]}" contains parseable date strings.`);

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

  } else if (partialVal) {
    valueColumn = partialVal;
    reasoning.push(`Identified probable measurement column "${partialVal}".`);

  } else {
    // Fallback: look for numeric column
    const timeIdx = headers.indexOf(timestampColumn);
    for (let i = 0; i < headers.length; i++) {
      if (i === timeIdx) continue;
      if (sampleRows.some(row => row[i] && !Number.isNaN(Number(row[i].trim())))) {
        valueColumn = headers[i];
        reasoning.push(`Selected numeric column "${headers[i]}" as measurement.`);

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

    } else if (allNaive) {
      timezone = 'Z';
      reasoning.push('No timezone offset found in timestamps; defaulted to UTC interpretation.');
    }
  }

  // Infer units from headers
  const fullHeaderString = valueColumn.toLowerCase();
  if (fullHeaderString.includes('mg/m3') || fullHeaderString.includes('mg/m³') || fullHeaderString.includes('milligram')) {
    units = 'mg/m3';
    reasoning.push('Detected milligram units (mg/m³); conversion factor ×1000 required.');

  } else {
    units = 'ug/m3';
    reasoning.push('Assumed standard ambient PM2.5 units (µg/m³).');
  }

  return {
    timestampColumn: timestampColumn || (headers[0] ?? ''),
    valueColumn: valueColumn || (headers[1] ?? ''),
    timezone,
    units,

    reasoning,
  };
}


/** Describe gap geometry. Timing alone cannot identify causes or intent. */
export function analyzeOmissionPattern(evidence:CheckResult):OmissionAttribution {
  const times=[...evidence.missingTimestamps].map(Date.parse).sort((a,b)=>a-b);
  let longest=0,run=0,count=0,previous=-Infinity;
  for(const time of times){if(time===previous+3600000)run++;else{run=1;count++;}longest=Math.max(longest,run);previous=time;}
  const category=evidence.impossibleTimestamps.length?'NEGATIVE_MEASUREMENTS':!times.length?'COMPLETE_RECORD':longest>=12?'LONG_MISSING_RUN':longest<=2?'SHORT_MISSING_RUNS':'MULTI_HOUR_MISSING_RUNS';
  return {category,categoryLabel:category.replaceAll('_',' ').toLowerCase(),longestRunHours:longest,runCount:count,
    rationale:evidence.impossibleTimestamps.length?`${evidence.impossibleTimestamps.length} negative measurements require source review. ${times.length} missing hours remain visible.`:
      `${times.length} missing hours in ${count} runs; longest run ${longest} hours.`,
    epistemicNote:'Descriptive rules only. No trained model, calibrated confidence, peak-hour assumption, inferred cause or finding of misconduct.'};
}
export function generateAuditNarrative(evidence:CheckResult,attribution:OmissionAttribution,comparison:ReturnType<typeof compareRevisions>|null=null,threshold=3.1):string {
  const decision=reportingDecision(evidence,threshold);
  return ['ENVIRONMENTAL REVIEW BRIEF',`Station: ${evidence.stationId}`,`Declared UTC window: ${evidence.windowStart} to ${evidence.windowEnd}`,
    `COMPLETENESS AUDIT: ${evidence.observedHours}/${evidence.expectedHours} hours present. Verdict: ${evidence.verdict}`,
    `MISSING-HOUR DESCRIPTION: ${attribution.rationale}`,attribution.epistemicNote,
    `ARITHMETIC CLAIM CHECK: full-window mean at most ${threshold} µg/m³. ${decision.status}.`,decision.reason,
    `Available-reading mean: ${decision.availableMean}. Full-window lower bound: ${decision.lowerMean??'not usable'}. Upper bound: ${decision.upperMean??'unbounded or not usable'}.`,
    decision.limits,...(comparison?[`REVISION COMPARISON: ${comparison.addedHours.length} added, ${comparison.removedHours.length} removed, ${comparison.changedMeasurements.length} changed.`,comparison.note]:[]),
    `CRYPTOGRAPHIC PROOF BOUNDARY: series ${evidence.seriesHash}; gaps ${evidence.gapHash}; policy ${evidence.policyHash}.`,
    'Hashes bind submitted evidence. They do not establish source authority, sensor accuracy or regulatory acceptance. No on-chain check is claimed by this brief.'
  ].join('\n');
}
