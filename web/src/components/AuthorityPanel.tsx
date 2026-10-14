import {useEffect,useRef,useState} from 'react';
import {AUTHORITY_DOMAIN,AUTHORITY_TYPES,authorityMessage,verifyAuthority,type AuthorityClaim} from '../lib/authority';
import {downloadFile} from '../lib/packages';
export function AuthorityPanel({stationId,publisher}:{stationId:string;publisher:string}){
  const [issuer,setIssuer]=useState(''),[reference,setReference]=useState(''),[file,setFile]=useState<File|null>(null);
  const [result,setResult]=useState<ReturnType<typeof verifyAuthority>|null>(null),[error,setError]=useState('');
  const generation=useRef(0);useEffect(()=>()=>{generation.current+=1;},[]);
  function clear(){generation.current+=1;setResult(null);setError('');}
  function prepare(){clear();try{const from=Math.floor(Date.now()/1000);const claim:AuthorityClaim={format:'gapwitness/operator-delegation/v1',stationId,publisher,validFrom:from,validUntil:from+86400,referenceUrl:reference};
    const message=authorityMessage(claim);downloadFile(new Blob([JSON.stringify({claim,domain:AUTHORITY_DOMAIN,types:AUTHORITY_TYPES,message,
      instructions:'The authorized operator signs the typed message, then adds signature to claim. Do not share any private key.'},null,2)+'\n'],{type:'application/json'}),'gapwitness-unsigned-delegation.json');
  }catch(cause){setError((cause as Error).message);}}
  async function verify(){clear();const id=generation.current;try{if(!file||file.size>32000)throw new Error('Choose a signed delegation JSON of at most 32 KB.');
    const value=JSON.parse(await file.text());const checked=verifyAuthority(value.claim??value,{issuer:issuer.trim(),stationId,publisher});if(id===generation.current)setResult(checked);
  }catch(cause){if(id===generation.current)setError((cause as Error).message);}}
  return <section className="page-card" aria-label="Operator authority evidence"><h2>Operator authority evidence</h2>
    <p>A publisher wallet alone does not establish station ownership. This optional delegation checks a signature against an issuer key you obtained independently. No operator authorization is prefilled.</p>
    <p>Station {stationId} · publisher {publisher||'enter the publisher above'}</p>
    <div className="page-fields"><label>Independently obtained operator wallet<input value={issuer} onChange={e=>{clear();setIssuer(e.target.value);}}/></label>
      <label>Public operator reference URL<input value={reference} onChange={e=>{clear();setReference(e.target.value);}} placeholder="https://operator.example/authority"/></label></div>
    <button onClick={prepare}>Prepare unsigned operator request</button>
    <p>Send the request yourself to the authorized operator. Their signed response must remain tied to this station, publisher, reference, and validity period.</p>
    <label>Signed delegation JSON<input type="file" accept=".json,application/json" onChange={e=>{clear();setFile(e.target.files?.[0]??null);}}/></label>
    <button onClick={()=>void verify()}>Check delegation signature</button>{error&&<p role="alert">{error}</p>}
    {result&&<div role="status"><h3>Signature matches the supplied issuer key</h3><p>Valid until {new Date(result.validUntil*1000).toISOString()}.</p>
      <p>Station authority has not been independently established by this app. Retain your external operator-key evidence. This check does not prove historical authorization or non-revocation.</p>
      <button onClick={()=>downloadFile(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}),'gapwitness-delegation-check.json')}>Download signature check</button></div>}
  </section>;
}
