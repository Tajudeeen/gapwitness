import {parseUtcHour} from './evidence.ts';
export type PilotRow={participant:string;task:string;order:'baseline-first'|'tool-first';baseline_seconds:number;tool_seconds:number;
  baseline_correct:0|1;tool_correct:0|1;baseline_method:string;source_csv_sha256:string;recorded_at:string;
  limitation:string};
export function answerHours(value:string):string[]{
  const hours=value.split(/[,\n]/).map(text=>text.trim()).filter(Boolean).map(text=>new Date(parseUtcHour(text)).toISOString().replace('.000Z','Z'));
  if(new Set(hours).size!==hours.length)throw new Error('List each timestamp once.');return hours.sort();
}
export function scoreAnswers(missing:string,negative:string,expectedMissing:string[],expectedNegative:string[]):0|1 {
  return JSON.stringify(answerHours(missing))===JSON.stringify([...expectedMissing].sort())&&
    JSON.stringify(answerHours(negative))===JSON.stringify([...expectedNegative].sort())?1:0;
}
const KEY='gapwitness-pilot-v1';
export function pilotRows():PilotRow[]{
  const rows=JSON.parse(localStorage.getItem(KEY)??'[]');
  if(!Array.isArray(rows)||rows.length>200)throw new Error('Pilot storage is invalid. Export backups before clearing browser data.');
  const seen=new Set<string>();
  for(const row of rows) {
    validatePilotRow(row);
    const key=JSON.stringify([row.participant,row.task]);
    if(seen.has(key))throw new Error('Duplicate participant/task pair in pilot storage.');
    seen.add(key);
  }
  return rows;
}
export function savePilot(row:PilotRow){
  validatePilotRow(row);
  const rows=pilotRows();if(rows.some(old=>old.participant===row.participant&&old.task===row.task))throw new Error('This participant/task pair is already recorded. Choose another task.');
  if(rows.length>=200)throw new Error('Pilot storage is capped at 200 paired tasks. Export the existing records.');
  localStorage.setItem(KEY,JSON.stringify([...rows,row]));
}
const fields=['participant','task','order','baseline_seconds','tool_seconds','baseline_correct','tool_correct','baseline_method','source_csv_sha256','recorded_at','limitation'] as const;
export function pilotCsv(rows:PilotRow[]):string {
  rows.forEach(validatePilotRow);
  const cell=(value:unknown)=>{let text=String(value);if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  return fields.join(',')+'\n'+rows.map(row=>fields.map(field=>cell(row[field])).join(',')).join('\n')+(rows.length?'\n':'');
}

export function validatePilotRow(raw:unknown):asserts raw is PilotRow {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid pilot observation.');
  const row=raw as PilotRow;
  if(typeof row.participant!=='string'||typeof row.task!=='string'||![row.participant,row.task].every(code=>/^[A-Za-z0-9_-]{1,40}$/.test(code)))
    throw new Error('Use anonymous participant and task codes.');
  if(row.order!=='baseline-first'&&row.order!=='tool-first')throw new Error('Invalid pilot task order.');
  if(![row.baseline_seconds,row.tool_seconds].every(seconds=>typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>0&&seconds<=86400))
    throw new Error('Pilot times must be positive observed seconds, at most 24 hours.');
  if(![row.baseline_correct,row.tool_correct].every(score=>score===0||score===1))throw new Error('Pilot correctness must be an observed 0 or 1.');
  if(typeof row.baseline_method!=='string'||!row.baseline_method.trim()||row.baseline_method.length>100||
    typeof row.source_csv_sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.source_csv_sha256)||
    typeof row.recorded_at!=='string'||!Number.isFinite(Date.parse(row.recorded_at))||
    typeof row.limitation!=='string'||!row.limitation.trim()||row.limitation.length>1000)
    throw new Error('Pilot method, source hash, timestamp and limitations are required.');
}
export function summarizePilot(rows:PilotRow[]) {
  rows.forEach(validatePilotRow);
  if(!rows.length)return null;
  const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
  return {pairs:rows.length,participantCodes:new Set(rows.map(row=>row.participant)).size,
    baselineFirst:rows.filter(row=>row.order==='baseline-first').length,toolFirst:rows.filter(row=>row.order==='tool-first').length,
    faster:rows.filter(row=>row.tool_seconds<row.baseline_seconds).length,slower:rows.filter(row=>row.tool_seconds>row.baseline_seconds).length,
    equal:rows.filter(row=>row.tool_seconds===row.baseline_seconds).length,
    baselineCorrect:rows.reduce((sum,row)=>sum+row.baseline_correct,0),toolCorrect:rows.reduce((sum,row)=>sum+row.tool_correct,0),
    medianSecondsSaved:median(rows.map(row=>row.baseline_seconds-row.tool_seconds)),
    medianPercentReduction:median(rows.map(row=>(row.baseline_seconds-row.tool_seconds)/row.baseline_seconds*100))};
}
