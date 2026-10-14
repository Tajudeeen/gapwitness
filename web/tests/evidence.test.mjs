import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localEvidence, validateEvidence, parseUtcHour} from '../src/lib/evidence.ts';
const input={stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25'};
const bytes=readFileSync('../checker/demo/file_a.csv');
test('frozen source independently matches the recorded mined witness',()=>{
 const local=localEvidence(bytes,input);
 const proof=JSON.parse(readFileSync('../contracts/deployments/fixture-proof.json','utf8'));
 assert.equal(local.seriesHash,proof.localEvidence.seriesHash);
 assert.equal(local.gapHash,proof.localEvidence.gapHash);
 assert.equal(local.policyHash,proof.localEvidence.policyHash);
 assert.equal(local.verdict,'GAPPED');assert.equal(local.missingTimestamps.length,7);
 assert.deepEqual(validateEvidence(local,local),local);
});
test('a hostile checker cannot change commitments, measurements, station, or verdict',()=>{
 const local=localEvidence(bytes,input);
 for (const mutate of [r=>r.chainCommitment.seriesHash='0x'+'00'.repeat(32),r=>r.verdict='INTACT',r=>r.stationId='another',r=>r.observations[0].value+=1,r=>r.missingTimestamps=[]]) {
  const remote=structuredClone(local); mutate(remote);
  assert.throws(()=>validateEvidence(remote,local),/mismatch/);
 }
 assert.throws(()=>validateEvidence(null,local));
});
test('ISO normalization handles offsets, naive UTC, and invalid calendar values',()=>{
 assert.equal(parseUtcHour('2026-01-01T01:00:00+01:00'),parseUtcHour('2026-01-01T00:00:00'));
 for(const value of ['2026-02-30T00:00:00Z','2026-01-01T00:00:00.000000001Z','2026-01-01T00:30:00Z','2026-01-01T25:00:00Z'])assert.throws(()=>parseUtcHour(value));
});
test('duplicate headers, oversized CSV, and inconsistent columns are rejected locally',()=>{
 for(const text of ['timestamp,value,value\n2026-09-19T07:00:00Z,1,2\n','timestamp,value\n2026-09-19T07:00:00Z,1,extra\n'])assert.throws(()=>localEvidence(new TextEncoder().encode(text),input));
 assert.throws(()=>localEvidence(new Uint8Array(1000001),input));
 assert.throws(()=>localEvidence(bytes,{...input,stationId:'a\0b'}));
});
