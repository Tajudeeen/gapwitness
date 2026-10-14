import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerHours,scoreAnswers,pilotRows,savePilot,pilotCsv} from '../src/lib/pilot.ts';
test('paired tasks score every missing and negative hour exactly',()=>{
  assert.equal(scoreAnswers('2025-01-01T01:00:00Z','',['2025-01-01T01:00:00Z'],[]),1);
  assert.equal(scoreAnswers('','',['2025-01-01T01:00:00Z'],[]),0);
  assert.throws(()=>answerHours('2025-01-01T01:00:00Z,2025-01-01T01:00:00Z'),/once/);
  assert.throws(()=>answerHours('2025-01-01T01:30:00Z'));
});
test('pilot begins empty, rejects repeated pairs, and exports safe CSV',()=>{
  const data=new Map();globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  assert.deepEqual(pilotRows(),[]);
  const row={participant:'reviewer_1',task:'york-april',order:'baseline-first',baseline_seconds:40,tool_seconds:60,baseline_correct:1,tool_correct:0,baseline_method:'=FORMULA()',source_csv_sha256:'abc',recorded_at:'2026-10-14T00:00:00Z',limitation:'same-file paired task'};
  savePilot(row);assert.equal(pilotRows().length,1);assert.throws(()=>savePilot(row),/already recorded/);
  assert.match(pilotCsv(pilotRows()),/"'=FORMULA\(\)"/);
  assert.throws(()=>savePilot({...row,participant:'personal email@example.com'}),/anonymous/);
});
