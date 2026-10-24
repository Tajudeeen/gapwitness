import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localEvidence } from '../src/lib/evidence.ts';
import {
  inferCsvSchema,
  analyzeOmissionPattern,
  estimateCounterfactual,
  generateAuditNarrative,
} from '../src/lib/ai-analysis.ts';

const input = {
  stationId: '2178',
  windowStart: '2026-09-19T07:00:00Z',
  windowEnd: '2026-09-20T07:00:00Z',
  seriesType: 'pm25',
};

const fileA = localEvidence(readFileSync('../checker/demo/file_a.csv'), input);
const fileB = localEvidence(readFileSync('../checker/demo/file_b.csv'), input);
const fileC = localEvidence(readFileSync('../checker/demo/file_c_impossible.csv'), input);

test('AI schema inference auto-detects columns, timezones, and units', () => {
  const headers = ['Date_Time_Local', 'PM25_Concentration (mg/m3)', 'Site_ID'];
  const samples = [
    ['2026-09-19 07:00:00+01:00', '0.015', '2178'],
    ['2026-09-19 08:00:00+01:00', '0.018', '2178'],
  ];

  const inferred = inferCsvSchema(headers, samples);
  assert.equal(inferred.timestampColumn, 'Date_Time_Local');
  assert.equal(inferred.valueColumn, 'PM25_Concentration (mg/m3)');
  assert.equal(inferred.timezone, 'embedded');
  assert.equal(inferred.units, 'mg/m3');
  assert.ok(inferred.confidence >= 0.8);
  assert.ok(inferred.reasoning.length >= 3);
});

test('AI schema inference handles naive timestamps and standard ug/m3 units', () => {
  const headers = ['time', 'value'];
  const samples = [
    ['2026-09-19T07:00:00', '14.2'],
    ['2026-09-19T08:00:00', '15.6'],
  ];

  const inferred = inferCsvSchema(headers, samples);
  assert.equal(inferred.timestampColumn, 'time');
  assert.equal(inferred.valueColumn, 'value');
  assert.equal(inferred.timezone, 'Z');
  assert.equal(inferred.units, 'ug/m3');
});

test('omission pattern attribution correctly classifies intact, peak omission, and physical violations', () => {
  // File B is intact
  const intactAttribution = analyzeOmissionPattern(fileB);
  assert.equal(intactAttribution.category, 'COMPLETE_RECORD');
  assert.equal(intactAttribution.suspicionLevel, 'LOW');
  assert.equal(intactAttribution.confidencePercent, 100);

  // File A deliberately removed 7 peak hours (15:00Z to 21:00Z)
  const gappedAttribution = analyzeOmissionPattern(fileA);
  assert.equal(gappedAttribution.category, 'SELECTIVE_PEAK_OMISSION');
  assert.equal(gappedAttribution.suspicionLevel, 'ELEVATED');
  assert.equal(gappedAttribution.longestRunHours, 7);
  assert.ok(gappedAttribution.peakHourFraction >= 0.7);

  // File C has impossible negative values
  const impossibleAttribution = analyzeOmissionPattern(fileC);
  assert.equal(impossibleAttribution.category, 'IMPOSSIBLE_PHYSICAL_MEASUREMENT');
  assert.equal(impossibleAttribution.suspicionLevel, 'HIGH');
});

test('omission pattern attribution recognizes isolated single-hour dropouts as low suspicion', () => {
  const singleDropEvidence = {
    ...fileB,
    missingTimestamps: ['2026-09-19T03:00:00Z'],
    observedHours: 23,
  };
  const attr = analyzeOmissionPattern(singleDropEvidence);
  assert.equal(attr.category, 'ISOLATED_TELEMETRY_DROPOUT');
  assert.equal(attr.suspicionLevel, 'LOW');
  assert.equal(attr.longestRunHours, 1);
});

test('counterfactual estimation computes bounded distortion on gapped File A', () => {
  const cf = estimateCounterfactual(fileA);
  assert.ok(cf !== null);
  assert.equal(cf.imputedHoursCount, 7);
  assert.ok(cf.observedMean > 0);
  assert.ok(cf.counterfactualMean > 0);
  // In File A, mean dropped from ~3.28 to ~2.99
  assert.equal(cf.distortionDirection, 'suppressed');
  assert.ok(cf.estimatedDistortionPercent < 0);
  assert.ok(cf.bounds.minEstimate <= cf.counterfactualMean);
  assert.ok(cf.bounds.maxEstimate >= cf.counterfactualMean);
  assert.ok(cf.epistemicBoundary.includes('NOT committed on-chain'));

  // File B has no gaps, returns null
  assert.equal(estimateCounterfactual(fileB), null);
});

test('executive auditor copilot generates structured compliance brief', () => {
  const attr = analyzeOmissionPattern(fileA);
  const cf = estimateCounterfactual(fileA);
  const narrative = generateAuditNarrative(fileA, attr, cf);

  assert.ok(narrative.includes('EXECUTIVE COMPLIANCE BRIEF'));
  assert.ok(narrative.includes('COMPLETENESS AUDIT'));
  assert.ok(narrative.includes('AI OMISSION PATTERN ATTRIBUTION'));
  assert.ok(narrative.includes('COUNTERFACTUAL IMPACT ASSESSMENT'));
  assert.ok(narrative.includes('CRYPTOGRAPHIC PROOF BOUNDARY'));
  assert.ok(narrative.includes('SELECTIVE_PEAK_OMISSION') || narrative.includes('Selective Peak-Period Omission'));
});
