import {useEffect,useRef,useState} from 'react';
import sourceA from '../../../checker/demo/file_a.csv?raw';
import publishedProof from '../../../contracts/deployments/fixture-proof-v2.json';
import {PageFrame} from './PageFrame';
import {checkPackage,downloadFile,type EvidencePackage} from '../lib/packages';
import {verifyChain,rpcReader,PROOF_RPC,type ProofResult} from '../lib/proof';
import {DEFAULT_DEPLOYMENT} from '../lib/deployment';
import sourceVerification from '../../../contracts/deployments/sourcify-v2.json';
import {AuthorityPanel} from './AuthorityPanel';

const PUBLISHED:EvidencePackage={format:'gapwitness/evidence/v1',source:'published source-backed File A derivative',csvFilename:'file_a.csv',
  originalCsvRequired:true,browserEvidenceCheck:'matched',evidence:publishedProof.localEvidence as EvidencePackage['evidence'],
  chain:{chainId:11155111,contract:publishedProof.contract,contractVersion:2,publisher:publishedProof.publisher,
    transactionHash:publishedProof.firstReceipt.transactionHash,commitmentKey:publishedProof.commitmentKey},
  chainVerification:'recorded proof, no fresh RPC check',limits:publishedProof.limits};

export function VerifyPage({current,csv}:{current:EvidencePackage|null;csv:File|null}) {
  const [mode,setMode]=useState<'import'|'current'|'published'>('published');
  const [jsonFile,setJsonFile]=useState<File|null>(null),[csvFile,setCsvFile]=useState<File|null>(null);
  const [publisher,setPublisher]=useState(PUBLISHED.chain!.publisher),[transaction,setTransaction]=useState(PUBLISHED.chain!.transactionHash);
  const [localMatch,setLocalMatch]=useState(false),[proof,setProof]=useState<ProofResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [verifiedStation,setVerifiedStation]=useState('');
  const pending=useRef<{generation:number;controller:AbortController|null}>({generation:0,controller:null});
  function clear(){pending.current.controller?.abort();pending.current.generation+=1;setLocalMatch(false);setProof(null);setVerifiedStation('');setError('');setBusy(false);}
  useEffect(()=>()=>{pending.current.controller?.abort();pending.current.generation+=1;},[]);
  useEffect(()=>{
    if(mode==='current') {clear();setPublisher(current?.chain?.publisher??'');setTransaction(current?.chain?.transactionHash??'');}
  },[mode,current?.evidence.seriesHash,current?.evidence.gapHash,current?.evidence.policyHash,
    current?.evidence.stationId,current?.evidence.windowStart,current?.evidence.windowEnd,
    current?.chain?.transactionHash,current?.chain?.publisher,csv]);
  function choose(next:typeof mode){clear();setMode(next);const bundle=next==='published'?PUBLISHED:next==='current'?current:null;
    setPublisher(bundle?.chain?.publisher??'');setTransaction(bundle?.chain?.transactionHash??'');}
  async function verify(){
    clear();const id=pending.current.generation;const controller=new AbortController();pending.current.controller=controller;setBusy(true);
    const isCurrent=()=>id===pending.current.generation&&!controller.signal.aborted;
    try {
      const file=mode==='published'?new File([sourceA],'file_a.csv',{type:'text/csv'}):mode==='current'?csv:csvFile;
      let raw:unknown=mode==='published'?PUBLISHED:mode==='current'?current:null;
      if(!file)throw new Error('Choose the original CSV or start an inspection.');
      if(file.size>1_000_000)throw new Error('CSV exceeds 1 MB.');
      if(mode==='import'){
        if(!jsonFile||jsonFile.size>2_000_000)throw new Error('Choose an evidence JSON of at most 2 MB.');
        raw=JSON.parse(await jsonFile.text());
      }
      const checked=checkPackage(raw,new Uint8Array(await file.arrayBuffer()));
      if(!isCurrent())return;setLocalMatch(true);setVerifiedStation(checked.evidence.stationId);
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(45000)]);
      const result=await verifyChain(checked,publisher.trim(),rpcReader(signal),transaction.trim()||undefined);
      if(isCurrent())setProof(result);
    }catch(cause){if(isCurrent())setError(cause instanceof Error?cause.message:'Verification failed. No fresh chain proof was established.');}
    finally{if(isCurrent())setBusy(false);}
  }
  return <PageFrame title="Verify the proof" description="Recompute from the original CSV, then read the pinned Sepolia contract without connecting a wallet.">
    <section className="page-card"><h2>Choose what to verify</h2><div className="page-actions">
      <button aria-pressed={mode==='published'} onClick={()=>choose('published')}>Published File A proof</button>
      <button aria-pressed={mode==='current'} disabled={!current||!csv} onClick={()=>choose('current')}>Current inspection</button>
      <button aria-pressed={mode==='import'} onClick={()=>choose('import')}>Import CSV and evidence JSON</button></div>
      {mode==='published'&&<p>This frozen OpenAQ derivative has seven deliberately removed hours. Its public record includes a mined File A transaction. The published File B rejection is an eth_call simulation, not a mined failed transaction.</p>}
      {mode==='current'&&<p>Your current inspection is checked again from its retained bytes. A package chain claim is not a fresh chain check.</p>}
      {mode==='import'&&<div className="page-fields"><label>Original CSV<input type="file" accept=".csv,text/csv" onChange={e=>{clear();setCsvFile(e.target.files?.[0]??null);}}/></label>
        <label>Evidence JSON<input type="file" accept=".json,application/json" onChange={e=>{clear();setJsonFile(e.target.files?.[0]??null);}}/></label></div>}
      <div className="page-fields"><label>Publisher wallet address<input value={publisher} onChange={e=>{clear();setPublisher(e.target.value);}} autoComplete="off"/></label>
        <label>Transaction hash, if available<input value={transaction} onChange={e=>{clear();setTransaction(e.target.value);}} autoComplete="off"/></label></div>
      <button disabled={busy} onClick={()=>void verify()}>{busy?'Checking original bytes and Sepolia…':'Verify original bytes and Sepolia'}</button>
      <p>These files stay in your browser. RPC calls contain hashes and publisher metadata, not the CSV. No wallet or transaction fee is needed.</p>
      {error&&<p role="alert">{error}</p>}
    </section>
    <section className="proof-status-grid" aria-label="Verification checks">
      <article className="page-card"><span className="proof-label">Original file</span><h2>{localMatch?'Independently matched':'Not checked'}</h2><p>Exact CSV bytes, expected hours, observations, policy, verdict, and every commitment input.</p></article>
      <article className="page-card"><span className="proof-label">Contract source</span><h2>{proof?'Pinned runtime matched':'Not freshly checked'}</h2><p>The deployed bytecode must match the compiled V2 runtime hash. Sourcify recorded exact creation and runtime source matches.</p><a href={sourceVerification.url} target="_blank" rel="noreferrer">Verified public source on Sourcify ↗</a></article>
      <article className="page-card"><span className="proof-label">On-chain evidence</span><h2>{proof?'RPC-confirmed on Sepolia':'No fresh confirmation'}</h2><p>File, gap and policy hashes, verdict, and publisher must match at one mined snapshot.</p></article>
    </section>
    <AuthorityPanel key={mode+publisher+verifiedStation} stationId={mode==='published'?PUBLISHED.evidence.stationId:mode==='current'?current?.evidence.stationId??'':verifiedStation} publisher={publisher.trim()}/>
    {proof&&<section className="page-card" aria-label="Verified Sepolia result"><h2>Matched at block {proof.snapshotBlock}</h2>
      <p>First witness time: {proof.firstWitnessAt}</p><p>Checked: {proof.checkedAt}</p><p>Publisher: <code>{proof.publisher}</code></p>
      <p>Commitment key: <code>{proof.commitmentKey}</code></p>
      {proof.transactionHash&&<p><a href={`https://sepolia.etherscan.io/tx/${proof.transactionHash}`} target="_blank" rel="noreferrer">Verified transaction ↗</a> · block {proof.transactionBlock}. {proof.witnessEvent?'A matching new-witness event is present.':'No new witness event in this receipt. The existing matching record is preserved.'}</p>}
      <button onClick={()=>downloadFile(new Blob([JSON.stringify({format:'gapwitness/verification/v1',...proof,rpc:PROOF_RPC,
        limits:['RPC responses are trusted; this is not an Ethereum light-client proof.','Station authority and measurement accuracy are not certified.']},null,2)+'\n'],{type:'application/json'}),'gapwitness-verification.json')}>Download verification result</button></section>}
    <section className="page-card" aria-label="Three evidence boundaries"><h2>Three questions, three different kinds of evidence</h2>
      <div className="proof-status-grid">
        <div><span className="proof-label">01 / COMPLETENESS</span><h3>Were expected hours present?</h3><p>GapWitness recomputes the declared schedule and exact missing timestamps from the original CSV. This check is reproducible.</p></div>
        <div><span className="proof-label">02 / PUBLICATION</span><h3>Does a published record match?</h3><p>A fresh Sepolia check confirms a specific publisher wallet, evidence hashes, and transaction. Wallet identity alone does not authenticate a station operator.</p></div>
        <div><span className="proof-label">03 / SCIENTIFIC TRUST</span><h3>Were the readings true?</h3><p>Sensor calibration, station authorization, data origin, and acceptable scientific interpretation require external evidence. They are outside this check.</p></div>
      </div>
    </section>
    <section className="page-card"><h2>Know exactly what this establishes</h2><p>Sepolia is a test network. A matching record timestamps a publisher's submitted evidence. It does not establish station ownership, source honesty, measurement calibration, regulatory acceptance, or environmental outcomes. This verifier trusts its RPC provider. A verification result records a point-in-time check.</p>
      <p>V2 contract: <a href={`https://sepolia.etherscan.io/address/${DEFAULT_DEPLOYMENT.address}`} target="_blank" rel="noreferrer">{DEFAULT_DEPLOYMENT.address}</a></p>
      <a href="https://github.com/Tajudeeen/gapwitness/blob/main/scripts/verify_onchain.py" target="_blank" rel="noreferrer">Use the independent Python verifier ↗</a></section>
  </PageFrame>;
}
