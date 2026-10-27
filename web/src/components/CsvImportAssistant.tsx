import {useEffect,useRef,useState} from 'react';
import {normalizeCsv,sourceCsv,type CsvMapping,type PreparedImport} from '../lib/csv-import';
import {inferCsvSchema,type InferredSchema} from '../lib/ai-analysis.ts';
type Preview=ReturnType<typeof normalizeCsv>;
export function CsvImportAssistant({disabled,onPrepared}:{disabled:boolean;onPrepared:(prepared:PreparedImport)=>void}) {
  const [file,setFile]=useState<File|null>(null),[bytes,setBytes]=useState<Uint8Array|null>(null),[headers,setHeaders]=useState<string[]>([]);
  const [sampleRows,setSampleRows]=useState<string[][]>([]);
  const [timestampColumn,setTimestampColumn]=useState(''),[valueColumn,setValueColumn]=useState('');
  const [timezone,setTimezone]=useState('embedded'),[fixedOffset,setFixedOffset]=useState('+01:00'),[units,setUnits]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [aiInference,setAiInference]=useState<InferredSchema|null>(null);
  const generation=useRef(0);
  useEffect(()=>()=>{generation.current+=1;},[]);
  function invalidate(){setPreview(null);setConfirmed(false);setError('');}
  async function select(next:File|null) {
    const id=++generation.current;setFile(next);setBytes(null);setHeaders([]);setSampleRows([]);setAiInference(null);invalidate();setLoading(false);
    if(!next)return;
    setLoading(true);
    try {
      if(next.size>1_000_000)throw new Error('Source CSV exceeds the 1 MB limit.');
      const data=new Uint8Array(await next.arrayBuffer()),parsed=sourceCsv(data);
      if(id!==generation.current)return;
      setBytes(data);setHeaders(parsed.headers);setSampleRows(parsed.rows.slice(0, 10));
      setTimestampColumn(parsed.headers.includes('timestamp')?'timestamp':'');
      setValueColumn(parsed.headers.includes('value')?'value':'');
    } catch(cause) {if(id===generation.current)setError((cause as Error).message);}
    finally {if(id===generation.current)setLoading(false);}
  }
  function autoDetect() {
    if(!headers.length)return;
    invalidate();
    const inferred=inferCsvSchema(headers,sampleRows);
    setTimestampColumn(inferred.timestampColumn);
    setValueColumn(inferred.valueColumn);
    setTimezone(inferred.timezone==='embedded'?'embedded':'Z');
    setUnits(inferred.units);
    setAiInference(inferred);
  }
  function buildPreview() {
    if(!bytes||!file)return;
    invalidate();
    try {
      const mapping:CsvMapping={timestampColumn,valueColumn,timezone:timezone==='fixed'?fixedOffset:timezone,units:units as CsvMapping['units']};
      setPreview(normalizeCsv(bytes,file.name,mapping));
    } catch(cause) {setError((cause as Error).message);}
  }
  return <section className="csv-import" aria-label="CSV import assistant">
    <h3>Map your source CSV</h3>
    <p>Preview the conversion locally. Only the normalized timestamp/value file is sent for inspection. The original stays available for your evidence bundle.</p>
    <label>Source CSV to map<input disabled={disabled||loading} type="file" accept=".csv,text/csv" onChange={e=>void select(e.target.files?.[0]??null)}/></label>
    {bytes&&<fieldset disabled={disabled||loading}><legend>Confirm the source format</legend>
      <button type="button" style={{margin:'8px 0 14px',padding:'8px 12px',cursor:'pointer'}} onClick={autoDetect}>Suggest mapping from headers</button>
      {aiInference&&<div style={{padding:'8px 12px',marginBottom:'12px',background:'#e4ede6',borderRadius:'6px',fontSize:'12px'}}>
        <strong>Rule-based suggestions. Confirm timezone, columns and units before inspection.</strong>
        <ul style={{margin:'4px 0 0 16px',padding:0}}>{aiInference.reasoning.map((r,i)=><li key={i}>{r}</li>)}</ul>
      </div>}
      <label>Timestamp column<select aria-label="Timestamp column" value={timestampColumn} onChange={e=>{invalidate();setTimestampColumn(e.target.value);}}>
        <option value="">Choose column</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>
      <label>Measurement column<select aria-label="Measurement column" value={valueColumn} onChange={e=>{invalidate();setValueColumn(e.target.value);}}>
        <option value="">Choose column</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>
      <label>Source timestamp timezone<select value={timezone} onChange={e=>{invalidate();setTimezone(e.target.value);}}>
        <option value="embedded">Use explicit offsets from the file</option><option value="Z">No offsets in file, interpret as UTC</option>
        <option value="fixed">No offsets in file, use a fixed offset</option></select></label>
      {timezone==='fixed'&&<label>Fixed UTC offset<input value={fixedOffset} maxLength={6} placeholder="+01:00" onChange={e=>{invalidate();setFixedOffset(e.target.value);}}/></label>}
      <label>Source PM2.5 units<select value={units} onChange={e=>{invalidate();setUnits(e.target.value);}}>
        <option value="">Confirm units</option><option value="ug/m3">Micrograms per cubic metre, µg/m³</option><option value="mg/m3">Milligrams per cubic metre, mg/m³</option></select></label>
      <p>Fixed offsets do not infer daylight-saving rules. Duplicate hours, invalid numbers and missing values are rejected. No rows are filled or silently removed.</p>
      <button type="button" onClick={buildPreview}>Preview normalized CSV</button>
    </fieldset>}
    {preview&&<div aria-label="Normalized CSV preview">
      <p>{preview.record.rowCount} observations retained. Output uses UTC timestamps and µg/m³.</p>
      <p>Other columns excluded from inspection: {preview.record.excludedColumns.join(', ')||'none'}. They remain in the original file.</p>
      <pre>{new TextDecoder().decode(preview.normalizedBytes).split('\n').slice(0,6).join('\n')}</pre>
      <p>Original file hash <code>{preview.record.originalHash}</code></p>
      <p>Normalized file hash <code>{preview.record.normalizedHash}</code></p>
      <label className="pilot-consent"><input disabled={disabled} type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
        I checked the mapping, timezone and units. My reporting window comes from an independent schedule.</label>
      <button type="button" disabled={!confirmed||disabled} onClick={()=>{
        if(!file||!preview)return;
        const csv=new File([Uint8Array.from(preview.normalizedBytes).buffer],'normalized.csv',{type:'text/csv'});
        onPrepared({csv,original:file,record:preview.record});
      }}>Inspect this normalized CSV</button>
    </div>}
    {loading&&<p role="status">Reading source locally…</p>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
