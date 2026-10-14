import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {localEvidence,validateEvidence} from '../src/lib/evidence.ts';
test('all thirteen unedited real-source windows match independent browser evidence and catalog hashes',()=>{
 const manifest=JSON.parse(readFileSync('../data/corpus/manifest.json','utf8'));
 const catalog=JSON.parse(readFileSync('../data/corpus/catalog.json','utf8'));
 assert.equal(manifest.datasets.length,13);assert.equal(catalog.datasets.length,13);
 for(const dataset of manifest.datasets){
  const bytes=readFileSync('../data/corpus/'+dataset.csv);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),dataset.csvSha256);
  const local=localEvidence(bytes,{stationId:dataset.stationId,windowStart:dataset.windowStart,windowEnd:dataset.windowEnd,seriesType:'pm25'});
  validateEvidence(dataset.evidence,local);
  const item=catalog.datasets.find(row=>row.id===dataset.id);
  assert.equal(item.csvSha256,dataset.csvSha256);
  for(const key of ['missingTimestamps','impossibleTimestamps','expectedHours','observedHours','verdict'])assert.deepEqual(item[key],local[key]);
 }
});
