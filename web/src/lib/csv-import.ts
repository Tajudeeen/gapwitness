import Papa from 'papaparse';
import {keccak256} from 'ethers';
import {parseUtcHour} from './evidence.ts';

export type CsvMapping = {timestampColumn:string;valueColumn:string;timezone:string;units:'ug/m3'|'mg/m3'};
export type NormalizationRecord = {
  format:'gapwitness/csv-normalization/v1';originalFilename:string;originalHash:string;normalizedHash:string;
  mapping:CsvMapping;rowCount:number;excludedColumns:string[];
};
export type PreparedImport = {csv:File;original:File;record:NormalizationRecord};
const numeric=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const offset=/(Z|[+-]\d{2}:?\d{2})$/;
export function sourceCsv(bytes:Uint8Array) {
  if(!bytes.length||bytes.length>1_000_000)throw new Error('Source CSV must contain 1–1,000,000 bytes.');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const parsed=Papa.parse<string[]>(text,{skipEmptyLines:'greedy'});
  if(parsed.errors.length||parsed.data.length<2)throw new Error('Choose a UTF-8 CSV with a header and observations.');
  const [headers,...rows]=parsed.data;
  if(headers.length>128)throw new Error('Choose a CSV with at most 128 source columns.');
  if(headers.some(h=>!h.trim())||new Set(headers).size!==headers.length)throw new Error('Source CSV headers must be nonempty and unique.');
  if(rows.some(row=>row.length!==headers.length))throw new Error('A source row has a different number of columns from its header.');
  return {headers,rows};
}
export function normalizeCsv(bytes:Uint8Array,filename:string,mapping:CsvMapping) {
  const {headers,rows}=sourceCsv(bytes);
  if(!mapping||typeof mapping!=='object')throw new Error('Confirm a column, timezone and unit mapping.');
  const timestamp=headers.indexOf(mapping.timestampColumn),valueIndex=headers.indexOf(mapping.valueColumn);
  if(timestamp<0||valueIndex<0||timestamp===valueIndex)throw new Error('Choose two different source columns for timestamp and value.');
  if(mapping.units!=='ug/m3'&&mapping.units!=='mg/m3')throw new Error('Confirm the source concentration units.');
  if(mapping.timezone!=='embedded'&&mapping.timezone!=='Z') {
    if(typeof mapping.timezone!=='string'||!/^[-+]\d{2}:\d{2}$/.test(mapping.timezone))throw new Error('Use an explicit fixed offset such as +01:00.');
    const hours=Number(mapping.timezone.slice(1,3)),minutes=Number(mapping.timezone.slice(4));
    if(hours>14||minutes>59||(hours===14&&minutes!==0))throw new Error('Fixed offset must be between -14:00 and +14:00.');
  }
  const seen=new Set<number>();
  const lines=['timestamp,value'];
  for(const [i,row] of rows.entries()) {
    const timeText=row[timestamp].trim(),hasOffset=offset.test(timeText);
    let time:number;
    try {
      if(mapping.timezone==='embedded'&&!hasOffset)throw new Error('timestamp has no explicit offset. Choose UTC or a fixed offset.');
      if(mapping.timezone!=='embedded'&&hasOffset)throw new Error('timestamp already has an offset. Choose offsets from the file.');
      time=parseUtcHour(timeText+(mapping.timezone==='embedded'?'':mapping.timezone));
      if(seen.has(time))throw new Error('duplicate UTC timestamp. No observations were removed.');
    } catch(error) {throw new Error('Source row '+(i+2)+': '+(error as Error).message);}
    seen.add(time);
    const text=row[valueIndex].trim();
    if(!numeric.test(text))throw new Error('Source row '+(i+2)+': measurement must be a finite number. Missing values are not filled.');
    const sourceValue=Number(text);
    const value=mapping.units==='mg/m3'?sourceValue*1000:sourceValue;
    if(!Number.isFinite(value)||(sourceValue!==0&&value===0))throw new Error('Source row '+(i+2)+': unit conversion is outside the supported numeric range.');
    lines.push(new Date(time).toISOString().replace('.000Z','Z')+','+String(value));
  }
  const normalizedBytes=new TextEncoder().encode(lines.join('\n')+'\n');
  if(normalizedBytes.length>1_000_000)throw new Error('Normalized CSV exceeds the 1 MB inspection limit.');
  const originalFilename=filename.replace(/[\\/\u0000-\u001f]/g,'_').replace(/^\.+/,'').slice(0,255)||'source.csv';
  const record:NormalizationRecord={format:'gapwitness/csv-normalization/v1',originalFilename,
    originalHash:keccak256(bytes),normalizedHash:keccak256(normalizedBytes),
    mapping:{timestampColumn:mapping.timestampColumn,valueColumn:mapping.valueColumn,timezone:mapping.timezone,units:mapping.units},
    rowCount:rows.length,excludedColumns:headers.filter((_,i)=>i!==timestamp&&i!==valueIndex)};
  return {normalizedBytes,record};
}
export function verifyNormalization(raw:unknown,source:Uint8Array|undefined,normalized:Uint8Array):NormalizationRecord {
  if(!source)throw new Error('Mapped evidence needs its pre-normalization source CSV. Open the complete review bundle.');
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid normalization record.');
  const record=raw as NormalizationRecord;
  if(record.format!=='gapwitness/csv-normalization/v1'||typeof record.originalFilename!=='string')throw new Error('Unsupported normalization record.');
  const checked=normalizeCsv(source,record.originalFilename,record.mapping);
  for(const field of ['originalFilename','originalHash','normalizedHash','rowCount'] as const)
    if(checked.record[field]!==record[field])throw new Error('Normalization record mismatch: '+field);
  if(JSON.stringify(checked.record.excludedColumns)!==JSON.stringify(record.excludedColumns)||keccak256(normalized)!==checked.record.normalizedHash)
    throw new Error('Normalized CSV or omitted-column metadata mismatch.');
  return checked.record;
}
