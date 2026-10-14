import {useEffect,useRef,useState} from 'react';
import {PageFrame} from './PageFrame';
import {checkPackage,downloadFile,type EvidencePackage} from '../lib/packages';
import {listRecords,saveRecord,deleteRecord,type SavedRecord} from '../lib/records';
import type {Navigate} from '../lib/navigation';

export function EvidencePage({current,csv,onOpen,navigate}:{current:EvidencePackage|null;csv:File|null;
  onOpen:(bundle:EvidencePackage,csv:File)=>void;navigate:Navigate}) {
  const [records,setRecords]=useState<SavedRecord[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{let active=true;void listRecords().then(items=>{if(active)setRecords(items);}).catch(error=>{if(active)setMessage(error.message);});
    return()=>{active=false;generation.current+=1;};},[]);
  async function act(operation:()=>Promise<void>) {
    const id=++generation.current;setBusy(true);setMessage('');
    try{await operation();const items=await listRecords();if(id===generation.current)setRecords(items);}
    catch(error){if(id===generation.current)setMessage(error instanceof Error?error.message:'Evidence storage failed.');}
    finally{if(id===generation.current)setBusy(false);}
  }
  async function open(record:SavedRecord) {
    await act(async()=>{
      const file=new File([record.csv],record.package.csvFilename,{type:'text/csv'});
      const checked=checkPackage(record.package,new Uint8Array(await file.arrayBuffer()));
      onOpen(checked,file);
    });
  }
  return <PageFrame title="Your evidence records" description="Save a complete review in this browser, then reopen it with a fresh check of the original CSV.">
    <section className="page-card"><h2>Keep the source with the evidence</h2>
      <p>Saving stores the original CSV and its evidence JSON only in this browser. Nothing is shared between devices. Browser data can be cleared, so download a backup.</p>
      <button disabled={!current||!csv||busy} onClick={()=>void act(async()=>{
        const checked=checkPackage(current,new Uint8Array(await csv!.arrayBuffer()));await saveRecord(checked,csv!);setMessage('Saved in this browser. Chain metadata still needs an independent RPC check.');
      })}>Save current inspection in this browser</button>
      {!current&&<p>Inspect a CSV first. <a href="/inspect" onClick={e=>{e.preventDefault();navigate('inspect');}}>Start an inspection</a></p>}
      {current&&csv&&<div className="page-actions">
        <button onClick={()=>downloadFile(csv,csv.name)}>Download current CSV</button>
        <button onClick={()=>downloadFile(new Blob([JSON.stringify(current,null,2)+'\n'],{type:'application/json'}),'gapwitness-evidence.json')}>Download current evidence JSON</button>
      </div>}
      <p role="status">{message}</p>
    </section>
    <section aria-label="Saved evidence records" className="record-grid">
      {records.length===0?<div className="page-card"><h2>No saved records yet</h2><p>Your current inspection survives page navigation. Refreshing clears it unless you explicitly save it here.</p></div>:
      records.map(record=><article key={record.id} className="page-card">
        <span className="proof-label">Recheck required on open</span><h2>{record.package.csvFilename}</h2>
        <p>Station {record.package.evidence.stationId} · {record.package.evidence.verdict}</p>
        <p>{record.package.evidence.windowStart} to {record.package.evidence.windowEnd}</p>
        <p>{record.package.evidence.missingTimestamps.length} missing hours · saved {new Date(record.savedAt).toLocaleString()}</p>
        <code>{record.package.evidence.seriesHash}</code>
        <div className="page-actions"><button disabled={busy} onClick={()=>void open(record)}>Open and recheck</button>
          <button disabled={busy} onClick={()=>downloadFile(record.csv,record.package.csvFilename)}>Download CSV</button>
          <button disabled={busy} onClick={()=>downloadFile(new Blob([JSON.stringify(record.package,null,2)+'\n'],{type:'application/json'}),'gapwitness-evidence.json')}>Download JSON</button>
          <button disabled={busy} onClick={()=>void act(()=>deleteRecord(record.id))}>Delete from this browser</button></div>
      </article>)}
    </section>
  </PageFrame>;
}
