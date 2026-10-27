import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localEvidence} from '../src/lib/evidence.ts';
import {makeSchedule,checkSchedule} from '../src/lib/schedule.ts';
import {makeReviewBundle,openReviewBundle} from '../src/lib/review-bundle.ts';
const bytes=readFileSync('../checker/demo/file_a.csv');
const e=localEvidence(bytes,{stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25'});
const source={issuer:'TEST SOURCE ONLY',sourceUrl:'https://example.org/schedule',reference:'Test-only source declaration. Not an authentic operator document.'};
const schedule=()=>makeSchedule(e,source,'test.txt',new TextEncoder().encode('hourly schedule test document'));
test('schedule evidence is retained and rechecked through portable bundles',()=>{
 const s=schedule();const p={format:'gapwitness/evidence/v1',source:'upload',csvFilename:'file.csv',originalCsvRequired:true,browserEvidenceCheck:'matched',evidence:e,chain:null,limits:[],schedule:s};
 const opened=openReviewBundle(JSON.parse(JSON.stringify(makeReviewBundle(p,bytes))));
 assert.deepEqual(opened.evidence.schedule,s);assert.equal(opened.evidence.schedule.attestation,'reviewer-confirmed');
 const copy=structuredClone(p);copy.schedule.issuer='substituted issuer';assert.throws(()=>makeReviewBundle(copy,bytes),/fingerprint/);
});
test('source documents, context, declarations and unsafe source URLs cannot be silently substituted',()=>{
 for(const patch of [{stationId:'other'},{windowEnd:'2026-09-20T08:00:00Z'},{cadenceMinutes:30},{issuer:'changed'},
   {documentBase64:Buffer.from('changed').toString('base64')},{reference:'changed'},{sourceUrl:'javascript:alert(1)'}])
   assert.throws(()=>checkSchedule({...schedule(),...patch},e));
 assert.throws(()=>makeSchedule(e,source,'large.txt',new Uint8Array(500001)),/500,000/);
 assert.throws(()=>makeSchedule(e,{...source,sourceUrl:'https://user:password@example.org'},'a',new Uint8Array([1])),/credentials/);
});
