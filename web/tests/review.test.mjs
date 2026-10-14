import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localEvidence} from '../src/lib/evidence.ts';
import {compareRevisions, reviewHtml, reviewSummary} from '../src/lib/review.ts';
const input={stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25'};
const a=localEvidence(readFileSync('../checker/demo/file_a.csv'),input);
const b=localEvidence(readFileSync('../checker/demo/file_b.csv'),input);
test('reviewer can distinguish restored hours, deleted hours, and changed measurements',()=>{
  assert.equal(compareRevisions(a,b).addedHours.length,7);
  assert.equal(compareRevisions(b,a).removedHours.length,7);
  const edited=structuredClone(b);edited.observations[0].value+=1;
  assert.equal(compareRevisions(b,edited).changedMeasurements.length,1);
  assert.equal(reviewSummary(a).longestGapHours,7);
  assert.equal(reviewSummary(b).action,'Temporal check passed');
});
test('comparison rejects a different schedule or policy and distinguishes byte-only edits',()=>{
  for(const field of ['stationId','windowStart','windowEnd','policyHash']) {
    assert.throws(()=>compareRevisions(a,{...a,[field]:'different'}),/same station/);
  }
  const changed=localEvidence(Buffer.from(readFileSync('../checker/demo/file_b.csv','utf8').replaceAll('\n','\r\n')),input);
  const compared=compareRevisions(b,changed);
  assert.equal(compared.exactBytesChanged,true);
  assert.equal(compared.changedMeasurements.length,0);
  assert.equal(compared.addedHours.length,0);
});
test('downloaded report treats user text as text and blocks external resources',()=>{
  const html=reviewHtml({...a,stationId:'<script>alert(1)</script>'},'<img src=x onerror=alert(1)>','upload');
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes('No blockchain transaction is claimed'));
});
