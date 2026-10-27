import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localEvidence} from '../src/lib/evidence.ts';
import {inferCsvSchema,analyzeOmissionPattern,generateAuditNarrative} from '../src/lib/ai-analysis.ts';
const input={stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25'};
const a=localEvidence(readFileSync('../checker/demo/file_a.csv'),input);
test('mapping suggestions remain explicit rules without fabricated certainty',()=>{
 const s=inferCsvSchema(['Date_Time_Local','PM25_Concentration (mg/m3)','Site_ID'],[['2026-09-19T08:00:00+01:00','0.015','2178']]);
 assert.equal(s.timestampColumn,'Date_Time_Local');assert.equal(s.units,'mg/m3');assert.equal(s.timezone,'embedded');
 assert.equal('confidence' in s,false);
 assert.equal(inferCsvSchema(['timestamp','value','other_mg/m3']).units,'ug/m3');
});
test('omission descriptions preserve run geometry and infer no mechanism from UTC hours',()=>{
 const desc=analyzeOmissionPattern(a);assert.equal(desc.longestRunHours,7);assert.equal(desc.runCount,1);
 assert.equal(desc.category,'MULTI_HOUR_MISSING_RUNS');
 for(const key of ['confidencePercent','suspicionLevel','peakHourFraction'])assert.equal(key in desc,false);
 const moved={...a,missingTimestamps:a.missingTimestamps.map(t=>new Date(Date.parse(t)+12*3600000).toISOString())};
 assert.deepEqual(analyzeOmissionPattern(moved),desc);
});
test('review brief reports unresolved arithmetic without invented readings or certification',()=>{
 const text=generateAuditNarrative(a,analyzeOmissionPattern(a));
 assert.match(text,/UNRESOLVED/);assert.match(text,/unbounded/);assert.doesNotMatch(text,/\bConfidence:|AI OMISSION|artificially lowered|EXECUTIVE COMPLIANCE/);
});
