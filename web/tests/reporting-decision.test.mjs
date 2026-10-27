import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localEvidence} from '../src/lib/evidence.ts';
import {reportingDecision} from '../src/lib/reporting-decision.ts';
const input={stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25'};
const fixture=name=>localEvidence(readFileSync('../checker/demo/'+name),input);
test('controlled omission changes an available-row acceptance to unresolved, complete source rejects it',()=>{
 const incomplete=reportingDecision(fixture('file_a.csv'),3.1),complete=reportingDecision(fixture('file_b.csv'),3.1);
 assert.equal(incomplete.availableRowsOnly,'would support');assert.equal(incomplete.status,'UNRESOLVED');assert.equal(incomplete.upperMean,null);
 assert.equal(complete.status,'NOT_SUPPORTED');assert.ok(complete.lowerMean>3.1);
 assert.equal(reportingDecision(fixture('file_b.csv'),4).status,'SUPPORTED');
});
test('missing observations never establish an upper bound or a cause',()=>{
 const e=fixture('file_a.csv');assert.equal(reportingDecision(e,0).status,'NOT_SUPPORTED');
 assert.equal(reportingDecision(e,100000).status,'UNRESOLVED');
 assert.equal(reportingDecision(e,reportingDecision(e,4).lowerMean).status,'UNRESOLVED');
 assert.equal(reportingDecision(fixture('file_c_impossible.csv'),100).status,'UNRESOLVED');
 assert.equal(reportingDecision({...e,seriesType:'generic'},4).status,'UNRESOLVED');
 for(const threshold of [NaN,Infinity,-1])assert.throws(()=>reportingDecision(e,threshold));
});
test('decisions cannot contradict any completed non-negative version of an incomplete record',()=>{
 const b=fixture('file_b.csv');
 for(let removed=1;removed<24;removed++){
   const csv='timestamp,value\n'+b.observations.slice(removed).map(o=>`${o.timestamp},${o.value}`).join('\n')+'\n';
   const a=localEvidence(new TextEncoder().encode(csv),input);
   for(const limit of [0,1,3.1,4,10]){
     const result=reportingDecision(a,limit);assert.notEqual(result.status,'SUPPORTED');
     if(result.status==='NOT_SUPPORTED')assert.equal(reportingDecision(b,limit).status,'NOT_SUPPORTED');
   }
 }
});
