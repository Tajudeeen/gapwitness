import {useEffect,useRef,useState} from 'react';
import {PageFrame} from './PageFrame';
import {REAL_CORPUS,corpusCsv} from '../lib/corpus';
import {pilotRows,pilotCsv,savePilot,scoreAnswers,type PilotRow} from '../lib/pilot';
import {downloadFile} from '../lib/packages';
type Result={seconds:number;correct:0|1};
export function PilotPage(){
  const [participant,setParticipant]=useState(''),[method,setMethod]=useState(''),[consent,setConsent]=useState(false);
  const [datasetId,setDatasetId]=useState('uk-air-yk11-2025-04-01'),[order,setOrder]=useState<'baseline-first'|'tool-first'>('baseline-first');
  const [phase,setPhase]=useState<'baseline'|'tool'|null>(null),[baseline,setBaseline]=useState<Result|null>(null),[tool,setTool]=useState<Result|null>(null);
  const [missing,setMissing]=useState(''),[negative,setNegative]=useState(''),[message,setMessage]=useState(''),[rows,setRows]=useState<PilotRow[]>([]);
  const began=useRef<number|null>(null);const dataset=REAL_CORPUS.datasets.find(item=>item.id===datasetId)!;
  useEffect(()=>{try{setRows(pilotRows());}catch(error){setMessage((error as Error).message);}},[]);
  const first=order==='baseline-first'?'baseline':'tool';const next=baseline&&!tool?'tool':tool&&!baseline?'baseline':first;
  function reset(){setBaseline(null);setTool(null);setPhase(null);began.current=null;setMissing('');setNegative('');setMessage('');}
  function start(){
    if(!/^[A-Za-z0-9_-]{1,40}$/.test(participant)||!method.trim()||!consent){setMessage('Provide an anonymous code, your normal method, and consent before starting.');return;}
    setMissing('');setNegative('');setPhase(next);began.current=performance.now();setMessage('Timer running. Submit the exact timestamps when you finish reviewing.');
  }
  function finish(){
    if(!phase||began.current===null)return;
    try{const result={seconds:Math.max(.001,(performance.now()-began.current)/1000),correct:scoreAnswers(missing,negative,dataset.missingTimestamps,dataset.impossibleTimestamps)};
      if(phase==='baseline')setBaseline(result);else setTool(result);
      setPhase(null);began.current=null;setMessage('Phase recorded. Complete the other method before saving the paired task.');
    }catch(error){setMessage((error as Error).message);}
  }
  function save(){
    if(!baseline||!tool)return;
    try{savePilot({participant,task:dataset.id,order,baseline_seconds:baseline.seconds,tool_seconds:tool.seconds,
      baseline_correct:baseline.correct,tool_correct:tool.correct,baseline_method:method.trim().slice(0,100),source_csv_sha256:dataset.csvSha256,
      recorded_at:new Date().toISOString(),limitation:'Same dataset repeated; task-order and learning effects apply. Participant identity is not independently authenticated.'});
      setRows(pilotRows());setMessage('Paired task saved locally. This is not independently authenticated adoption evidence.');
    }catch(error){setMessage((error as Error).message);}
  }
  async function csv(){try{const source=await corpusCsv(dataset.id);downloadFile(new Blob([source.text],{type:'text/csv'}),source.dataset.csv);}catch(error){setMessage((error as Error).message);}}
  return <PageFrame title="Run a reviewer pilot" description="Record actual review time and answer accuracy against your normal method. No participant records are prefilled.">
    <section className="page-card"><h2>Consent and task</h2><p>The same file is reviewed twice. Counterbalance method order across reviewers and disclose learning effects. These local measurements are descriptive, not proof of causal benefit or independent adoption.</p>
      <div className="page-fields"><label>Anonymous participant code<input disabled={!!phase||!!baseline||!!tool} value={participant} onChange={e=>setParticipant(e.target.value)} maxLength={40}/></label>
        <label>Your normal review method<input disabled={!!phase||!!baseline||!!tool} value={method} onChange={e=>setMethod(e.target.value)} maxLength={100} placeholder="For example, a schedule-aware spreadsheet"/></label>
        <label>Dataset<select disabled={!!phase||!!baseline||!!tool} value={datasetId} onChange={e=>{reset();setDatasetId(e.target.value);}}>{REAL_CORPUS.datasets.map(item=><option key={item.id} value={item.id}>{item.stationName} · {item.windowStart.slice(0,10)}</option>)}</select></label>
        <label>Method order<select disabled={!!phase||!!baseline||!!tool} value={order} onChange={e=>{reset();setOrder(e.target.value as typeof order);}}><option value="baseline-first">Normal method first</option><option value="tool-first">GapWitness first</option></select></label></div>
      <label className="pilot-consent"><input type="checkbox" checked={consent} disabled={!!phase||!!baseline||!!tool} onChange={e=>setConsent(e.target.checked)}/> I agree to store anonymous trial records in this browser.</label>
      <p>Station {dataset.stationId}. Declared UTC window {dataset.windowStart} to {dataset.windowEnd}, end excluded. Identify all unavailable hours and all readings that violate the non-negative PM2.5 policy.</p>
      <div className="page-actions"><button onClick={()=>void csv()}>Download task CSV</button><a href={'/inspect?dataset='+dataset.id} target="_blank" rel="noreferrer">Open task in GapWitness in another tab ↗</a></div>
      <p>Keep this pilot tab open while using your normal method or the inspection tab. Unfinished phases are not saved. Leaving this page resets an unfinished timer.</p></section>
    <section className="page-card"><h2>{phase?`Running ${phase==='baseline'?'normal method':'GapWitness'} review`:'Record a paired review'}</h2>
      {!phase&&!(baseline&&tool)&&<button onClick={start}>Start {next==='baseline'?'normal method':'GapWitness'} timer</button>}
      {phase&&<><div className="page-fields"><label>Unavailable timestamps, one ISO UTC timestamp per line<textarea value={missing} onChange={e=>setMissing(e.target.value)} rows={5}/></label>
        <label>Negative-value timestamps, one ISO UTC timestamp per line<textarea value={negative} onChange={e=>setNegative(e.target.value)} rows={5}/></label></div><p>Leave a list empty if none were found.</p><button onClick={finish}>Submit answers and stop timer</button></>}
      {baseline&&tool&&<><p>Normal method {baseline.seconds.toFixed(2)} seconds, exact answer {baseline.correct?'matched':'did not match'}. GapWitness {tool.seconds.toFixed(2)} seconds, exact answer {tool.correct?'matched':'did not match'}.</p>
        <button onClick={save}>Save paired task locally</button></>}
      <p role="status">{message}</p><button onClick={reset}>Reset unfinished task</button></section>
    <section className="page-card"><h2>Make this a real independent review</h2>
      <p>Recruit three to five consenting environmental-data reviewers. Ask each to complete both methods, with alternating task order, and to share their exported CSV privately. The app does not transmit or combine records from their browsers.</p>
      <p>Use an existing competent method as the baseline. Repeating a dataset can make the second attempt easier even without this tool, so report both the successes and unfavorable results.</p>
      <p><a href="https://github.com/Tajudeeen/gapwitness/blob/main/docs/PILOT_INVITATION.md" target="_blank" rel="noreferrer">Open invitation and reviewer instructions ↗</a></p>
      <p>No independent reviewer time saving, adoption, or environmental outcome is established until real results are collected and examined.</p>
    </section>
    <section className="page-card"><h2>{rows.length} paired tasks in this browser</h2><p>Export recorded observations for the paired analyzer. No result from this browser is automatically published as adoption or environmental impact.</p>
      <button disabled={!rows.length} onClick={()=>downloadFile(new Blob([pilotCsv(rows)],{type:'text/csv'}),'gapwitness-pilot-observations.csv')}>Export observed pilot CSV</button>
      <p>Run scripts/analyze_pilot.py on the exported CSV. Report order, sample size, task definitions, accuracy, and limitations with any public time-saving claim.</p></section>
  </PageFrame>;
}
