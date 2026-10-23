import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {keccak256} from 'ethers';
import {normalizeCsv,verifyNormalization,sourceCsv} from '../src/lib/csv-import.ts';
import {localEvidence} from '../src/lib/evidence.ts';
import {makeReviewBundle,openReviewBundle} from '../src/lib/review-bundle.ts';
const encoder=new TextEncoder();
const input={stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25'};
const mapping={timestampColumn:'local_time',valueColumn:'pm',timezone:'+01:00',units:'mg/m3'};
const source=encoder.encode('\ufefflocal_time,pm,other\r\n2026-09-19T08:00:00,0.012,kept in original\r\n2026-09-19T10:00:00,-0.001,also retained\r\n');
function evidence(bytes,normalization) {
  return {format:'gapwitness/evidence/v1',source:'upload',csvFilename:'inspected.csv',originalCsvRequired:true,browserEvidenceCheck:'matched',
    evidence:localEvidence(bytes,input),chain:null,limits:[],...(normalization?{normalization}:{})};
}
test('explicit mapping converts fixed offsets and units, preserves negative values and records both byte hashes',()=>{
  const {normalizedBytes,record}=normalizeCsv(source,'my-source.csv',mapping);
  assert.equal(new TextDecoder().decode(normalizedBytes),'timestamp,value\n2026-09-19T07:00:00Z,12\n2026-09-19T09:00:00Z,-1\n');
  assert.equal(record.originalHash,keccak256(source));assert.equal(record.normalizedHash,keccak256(normalizedBytes));
  assert.equal(record.rowCount,2);assert.deepEqual(record.excludedColumns,['other']);
  assert.deepEqual(verifyNormalization(record,source,normalizedBytes),record);
  const checked=localEvidence(normalizedBytes,input);assert.equal(checked.impossibleTimestamps.length,1);
  assert.equal(checked.missingTimestamps.length,22);
});
test('normalization rejects ambiguous timezones, duplicate UTC hours, missing measurements and unsupported units',()=>{
  for(const [csv,settings] of [
    ['local_time,pm\n2026-09-19T08:00:00,1\n',{...mapping,timezone:'embedded'}],
    ['local_time,pm\n2026-09-19T08:00:00Z,1\n',mapping],
    ['local_time,pm\n2026-09-19T08:00:00,1\n2026-09-19T08:00:00,2\n',mapping],
    ['local_time,pm\n2026-09-19T08:00:00,\n',mapping],
    ['local_time,pm\n2026-09-19T08:00:00,NaN\n',mapping],
    ['local_time,pm\n2026-09-19T08:00:00,1\n',{...mapping,timezone:'+14:30'}],
    ['local_time,pm\n2026-09-19T08:00:00,1\n',{...mapping,units:'unknown'}],
    ['local_time,pm\n2026-02-30T08:00:00,1\n',mapping],
  ])assert.throws(()=>normalizeCsv(encoder.encode(csv),'source.csv',settings));
  assert.throws(()=>sourceCsv(new Uint8Array(1_000_001)),/1,000,000/);
});
test('UTC and per-row offsets require a declared interpretation and reproduce canonical hours',()=>{
  const bytes=encoder.encode('when,reading\n2026-09-19T07:00:00,1\n');
  const a=normalizeCsv(bytes,'a.csv',{timestampColumn:'when',valueColumn:'reading',timezone:'Z',units:'ug/m3'});
  const b=normalizeCsv(encoder.encode('when,reading\n2026-09-19T08:00:00+01:00,1\n'),'b.csv',
    {timestampColumn:'when',valueColumn:'reading',timezone:'embedded',units:'ug/m3'});
  assert.deepEqual(a.normalizedBytes,b.normalizedBytes);
});
test('complete review bundles round-trip exact frozen CSV bytes without a wallet or checker',()=>{
  const bytes=readFileSync('../checker/demo/file_a.csv');
  const bundle=makeReviewBundle(evidence(bytes),bytes);
  const checked=openReviewBundle(JSON.parse(JSON.stringify(bundle)));
  assert.deepEqual(Buffer.from(checked.inspected.bytes),bytes);assert.equal(checked.evidence.evidence.verdict,'GAPPED');
  assert.equal(checked.evidence.chainVerification,'not independently checked');
  assert.equal(checked.original,undefined);
});
test('mapped bundles retain source BOM and replay normalization instead of trusting an attached mapping',()=>{
  const {normalizedBytes,record}=normalizeCsv(source,'source.csv',mapping);
  const bundle=makeReviewBundle(evidence(normalizedBytes,record),normalizedBytes,source);
  const opened=openReviewBundle(bundle);
  assert.deepEqual(opened.original.bytes,source);assert.equal(opened.original.bytes[0],0xef);
  assert.deepEqual(opened.inspected.bytes,normalizedBytes);
  assert.deepEqual(opened.evidence.normalization,record);
  assert.throws(()=>makeReviewBundle(evidence(normalizedBytes,record),normalizedBytes),/source CSV/);
});
test('bundle tampering cannot silently substitute inspected bytes, original bytes, evidence or normalization metadata',()=>{
  const {normalizedBytes,record}=normalizeCsv(source,'source.csv',mapping);
  const base=makeReviewBundle(evidence(normalizedBytes,record),normalizedBytes,source);
  for(const mutate of [
    b=>b.inspectedCsv.data=Buffer.from('timestamp,value\n2026-09-19T07:00:00Z,999\n').toString('base64'),
    b=>b.originalCsv.data=Buffer.from('local_time,pm\n2026-09-19T08:00:00,99\n').toString('base64'),
    b=>b.evidence.evidence.verdict='INTACT',
    b=>b.evidence.normalization.mapping.units='ug/m3',
    b=>b.evidence.normalization.excludedColumns=[],
    b=>delete b.originalCsv,
    b=>b.inspectedCsv.encoding='gzip',
    b=>b.inspectedCsv.filename='../source.csv',
    b=>b.inspectedCsv.data='A'.repeat(1_333_340),
  ]){const tampered=structuredClone(base);mutate(tampered);assert.throws(()=>openReviewBundle(tampered));}
});
