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
  return rows;
}
export function savePilot(row:PilotRow){
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(row.participant))throw new Error('Use an anonymous participant code.');
  const rows=pilotRows();if(rows.some(old=>old.participant===row.participant&&old.task===row.task))throw new Error('This participant/task pair is already recorded. Choose another task.');
  if(rows.length>=200)throw new Error('Pilot storage is capped at 200 paired tasks. Export the existing records.');
  localStorage.setItem(KEY,JSON.stringify([...rows,row]));
}
const fields=['participant','task','order','baseline_seconds','tool_seconds','baseline_correct','tool_correct','baseline_method','source_csv_sha256','recorded_at','limitation'] as const;
export function pilotCsv(rows:PilotRow[]):string {
  const cell=(value:unknown)=>{let text=String(value);if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  return fields.join(',')+'\n'+rows.map(row=>fields.map(field=>cell(row[field])).join(',')).join('\n')+(rows.length?'\n':'');
}
