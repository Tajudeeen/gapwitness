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
  const row={participant:'reviewer_1',task:'york-april',order:'baseline-first',baseline_seconds:40,tool_seconds:60,baseline_correct:1,tool_correct:0,baseline_method:'=FORMULA()',source_csv_sha256:'a'.repeat(64),recorded_at:'2026-10-14T00:00:00Z',limitation:'same-file paired task'};
  savePilot(row);assert.equal(pilotRows().length,1);assert.throws(()=>savePilot(row),/already recorded/);
  assert.match(pilotCsv(pilotRows()),/"'=FORMULA\(\)"/);
  assert.throws(()=>savePilot({...row,participant:'personal email@example.com'}),/anonymous/);
});

import {summarizePilot,validatePilotRow} from '../src/lib/pilot.ts';
const valid={participant:'reviewer_1',task:'one',order:'baseline-first',baseline_seconds:40,tool_seconds:60,baseline_correct:1,tool_correct:0,
  baseline_method:'spreadsheet',source_csv_sha256:'a'.repeat(64),recorded_at:'2026-10-23T00:00:00Z',limitation:'same dataset repeated'};
test('pilot summary retains slower outcomes and incorrect answers with actual order counts',()=>{
  assert.equal(summarizePilot([]),null);
  const summary=summarizePilot([valid,{...valid,participant:'reviewer_2',order:'tool-first',baseline_seconds:100,tool_seconds:50,tool_correct:1}]);
  assert.equal(summary.faster,1);assert.equal(summary.slower,1);assert.equal(summary.equal,0);
  assert.equal(summary.medianSecondsSaved,15);assert.equal(summary.medianPercentReduction,0);
  assert.equal(summary.baselineCorrect,2);assert.equal(summary.toolCorrect,1);
  assert.equal(summary.baselineFirst,1);assert.equal(summary.toolFirst,1);
});
test('invalid or damaged pilot observations cannot be stored, summarized or exported as measured outcomes',()=>{
  for(const patch of [{tool_seconds:0},{baseline_seconds:Infinity},{tool_seconds:86401},{tool_correct:2},
    {order:'made-up'},{source_csv_sha256:'not-a-hash'},{baseline_method:''},{recorded_at:'invalid'}])
    assert.throws(()=>validatePilotRow({...valid,...patch}));
  const data=new Map([['gapwitness-pilot-v1',JSON.stringify([{...valid,tool_seconds:-4}])]]);
  globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  assert.throws(()=>pilotRows(),/positive observed/);
  assert.throws(()=>pilotCsv([{...valid,baseline_seconds:0}]),/positive observed/);
});
