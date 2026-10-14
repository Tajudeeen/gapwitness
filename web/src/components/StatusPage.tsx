import {useEffect,useRef,useState} from 'react';
import {PageFrame} from './PageFrame';
import {CHECKER_URL} from '../lib/checker';
type Status={ok:boolean;version:string;quotas:{mode:string;sharedConfigured:boolean;limit:number;windowSeconds:number;globalLimit:number|null;dependencyHealth:string};
  metrics:{scope:string;completedRequests:number;statusCounts:Record<string,number>;activeInspections:number;maxConcurrentInspections:number;meanRequestMilliseconds:number|null;uptimeSeconds:number}};
export function StatusPage(){
  const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[checked,setChecked]=useState('');
  const current=useRef<AbortController|null>(null);
  async function check(){current.current?.abort();const controller=new AbortController();current.current=controller;setBusy(true);setError('');setStatus(null);
    try{const response=await fetch(CHECKER_URL+'/status',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});if(!response.ok)throw new Error('Checker status is unavailable.');
      const value=await response.json();if(!value.quotas||!value.metrics)throw new Error('Checker status schema is unavailable.');
      if(!controller.signal.aborted){setStatus(value);setChecked(new Date().toISOString());}
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Status request failed.');}
    finally{if(!controller.signal.aborted)setBusy(false);}}
  useEffect(()=>{void check();return()=>current.current?.abort();},[]);
  return <PageFrame title="Service status" description="A live, limited view of the checker instance answering this request. This is not a global uptime or capacity guarantee.">
    <button disabled={busy} onClick={()=>void check()}>{busy?'Checking status…':'Refresh service status'}</button>{error&&<p role="alert">{error}</p>}
    {status&&<><section className="page-card"><h2>Checker {status.version} reachable</h2><p>Checked {checked}</p><p>Quota mode: {status.quotas.mode}</p><p>{status.quotas.limit} inspection requests per {status.quotas.windowSeconds} seconds.</p>
      <span className="proof-label">{status.quotas.sharedConfigured?'Shared quota configured':'Shared quota not configured'}</span><p>{status.quotas.dependencyHealth}</p></section>
      <section className="page-card"><h2>Instance measurements</h2><p>{status.metrics.scope}. Counters reset when the instance restarts.</p>
        <p>{status.metrics.completedRequests} completed requests · {status.metrics.activeInspections}/{status.metrics.maxConcurrentInspections} active slots · uptime {status.metrics.uptimeSeconds} seconds</p>
        <p>Mean request duration {status.metrics.meanRequestMilliseconds??'not measured'} ms. This includes upload and processing, not reviewer time.</p>
        <p>Status counts: {JSON.stringify(status.metrics.statusCounts)}</p></section></>}
    <section className="page-card"><h2>Monitoring and capacity</h2><p>The repository monitor checks checker health, status, and the retained corpus on a schedule. Reports remain timestamped artifacts. No global uptime percentage is invented from these instance counters.</p>
      <a href="https://github.com/Tajudeeen/gapwitness/actions/workflows/service-monitor.yml" target="_blank" rel="noreferrer">View recorded monitor runs ↗</a></section>
  </PageFrame>;
}
