import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localEvidence} from '../src/lib/evidence.ts';
import {compareObservedMeans} from '../src/lib/impact.ts';
const input={stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25'};
const a=localEvidence(readFileSync('../checker/demo/file_a.csv'),input);
const b=localEvidence(readFileSync('../checker/demo/file_b.csv'),input);
test('observed means are calculated from frozen source-backed fixtures',()=>{
  const result=compareObservedMeans(b,a);
  assert.equal(result.missingHours,7);
  assert.equal(result.retainedHours,17);
  assert.ok(Math.abs(result.fullMean-3.2792)<.0001);
  assert.ok(Math.abs(result.submittedMean-2.9882)<.0001);
  assert.ok(Math.abs(result.relativeChangePercent+8.87)<.02);
});
test('comparison cannot silently treat modified measurements, new windows or unrelated files as omissions',()=>{
  assert.throws(()=>compareObservedMeans(a,b),/complete and a gapped/);
  assert.throws(()=>compareObservedMeans(b,{...a,stationId:'other'}),/same declared window/);
  assert.throws(()=>compareObservedMeans(b,{...a,observations:a.observations.map((p,i)=>i? p:{...p,value:99})}),/pure omission/);
  assert.throws(()=>compareObservedMeans(b,{...a,missingTimestamps:[]}),/pure omission/);
});
