import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Papa from 'papaparse';
import {localEvidence} from '../src/lib/evidence.ts';
test('browser independently reproduces all published omission evaluation cases and hashes',()=>{
  const report=JSON.parse(readFileSync('../docs/evaluation-results.json','utf8'));
  const source=readFileSync('../checker/demo/file_b.csv');
  assert.equal(createHash('sha256').update(source).digest('hex'),report.sourceCsvSha256);
  const rows=Papa.parse(source.toString(),{header:true,skipEmptyLines:true}).data;
  const input={stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25'};
  for(const sample of report.cases){
    const removed=new Set(sample.removedHourIndices);
    const csv='timestamp,value\n'+rows.filter((row,index)=>!removed.has(index)).map(row=>`${row.timestamp},${row.value}\n`).join('');
    const bytes=Buffer.from(csv);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sample.csvSha256,sample.case);
    const evidence=localEvidence(bytes,input);
    const expected=sample.removedHourIndices.map(index=>new Date(rows[index].timestamp).toISOString().replace('.000Z','Z'));
    assert.deepEqual(evidence.missingTimestamps,expected,sample.case);
    for(const field of ['gapHash','seriesHash','policyHash']) assert.equal(evidence[field],sample[field],`${sample.case}: ${field}`);
  }
  assert.equal(report.cases.length,553);
});
