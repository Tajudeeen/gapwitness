import {useEffect,useRef,useState} from 'react';
import type {CheckResult} from '../lib/checker';
import {downloadFile} from '../lib/packages';
import {makeSchedule,type ScheduleSource} from '../lib/schedule';

export function SchedulePanel({evidence,value,onChange}:{evidence:CheckResult;value:ScheduleSource|null;onChange:(value:ScheduleSource|null)=>void}) {
  const [issuer,setIssuer]=useState(''),[sourceUrl,setUrl]=useState(''),[reference,setReference]=useState('');
  const [file,setFile]=useState<File|null>(null),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef(0);
  useEffect(()=>()=>{request.current++;},[]);
  async function attach(){
    const id=++request.current;setError('');
    if(!file||!confirmed){setError('Choose the source document and confirm that you checked its schedule.');return;}
    if(file.size>500000){setError('Schedule document exceeds 500 KB.');return;}
    setBusy(true);
    try{const bytes=new Uint8Array(await file.arrayBuffer());if(id!==request.current)return;
      onChange(makeSchedule(evidence,{issuer,sourceUrl,reference},file.name,bytes));
    }catch(cause){if(id===request.current)setError((cause as Error).message);}
    finally{if(id===request.current)setBusy(false);}
  }
  return <section className="page-card" aria-label="Reporting schedule source"><h3>Where did the expected hours come from?</h3>
    <p>Retain the operator's schedule document or source metadata separately from the observation CSV. The app binds its exact bytes to this station and window. A reviewer must check that the document actually supports hourly reporting.</p>
    {value?<><p>Reviewer-confirmed source: {value.issuer}. <a href={value.sourceUrl} target="_blank" rel="noreferrer">Open source reference</a></p>
      <p>{value.reference}</p><p>Hourly, {value.windowStart} to {value.windowEnd}, end excluded.</p>
      <p>Document fingerprint <code>{value.documentHash}</code></p><p>Not independently authenticated. This attachment is retained in the evidence bundle and is not included in the Sepolia commitment.</p>
      <button type="button" onClick={()=>downloadFile(new Blob([Uint8Array.from(atob(value.documentBase64),c=>c.charCodeAt(0))]),value.documentFilename)}>Download attached schedule document</button>
      <button type="button" onClick={()=>onChange(null)}>Remove schedule attachment</button></>:
      <fieldset disabled={busy}><legend>Attach independent schedule evidence</legend>
        <label>Schedule issuer<input value={issuer} maxLength={500} onChange={e=>setIssuer(e.target.value)}/></label>
        <label>Schedule source URL<input type="url" value={sourceUrl} maxLength={2000} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label>
        <label>Page or section supporting this station, hourly cadence and window<input value={reference} maxLength={500} onChange={e=>setReference(e.target.value)}/></label>
        <label>Schedule source document<input type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
        <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I independently checked that this document supports this station's hourly schedule for the declared window.</label>
        <button type="button" onClick={()=>void attach()}>Attach schedule source</button>
        <p>No schedule source is attached yet. Completeness remains conditional on your declared window.</p>
      </fieldset>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
