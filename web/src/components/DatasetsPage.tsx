import {useState} from 'react';
import {PageFrame} from './PageFrame';
import {REAL_CORPUS,corpusCsv} from '../lib/corpus';
import {downloadFile} from '../lib/packages';
export function DatasetsPage(){
  const [message,setMessage]=useState('');
  async function download(id:string){try{const {dataset,text}=await corpusCsv(id);downloadFile(new Blob([text],{type:'text/csv'}),dataset.csv);}catch(error){setMessage(error instanceof Error?error.message:'Dataset download failed.');}}
  return <PageFrame title="Real source datasets" description="Inspect retained observations from four stations and two providers, with source hashes and normalization documented.">
    <section className="page-card"><h2>13 windows, 4 stations, 2 providers</h2><p>Three retained windows contain source-unavailable readings. No numeric measurements were deliberately removed or edited. The PM2.5 policy also flags supplied negative values in some windows. A policy flag alone does not establish a source error or misconduct.</p>
      <p>UK-AIR dates are GMT hour ending. Blank source values are represented as unavailable observations. The experimental windows follow the published hourly format and have not been certified by station operators.</p>
      <a href="https://github.com/Tajudeeen/gapwitness/blob/main/data/corpus/manifest.json" target="_blank" rel="noreferrer">Full retained evidence and source manifest ↗</a><p role="status">{message}</p></section>
    <section className="record-grid">{REAL_CORPUS.datasets.map(item=><article className="page-card" key={item.id}>
      <span className="proof-label">Retained real source</span><h2>{item.stationName}</h2><p>{item.provider} · {item.country}</p>
      <p>{item.windowStart} to {item.windowEnd}</p><p>{item.observedHours}/{item.expectedHours} readings · {item.missingTimestamps.length} unavailable hours · {item.impossibleTimestamps.length} policy flags</p>
      <p>{item.attribution}</p><small>{item.license}</small><div className="page-actions"><a href={'/inspect?dataset='+encodeURIComponent(item.id)}>Open this dataset in Inspect</a><button onClick={()=>void download(item.id)}>Download retained CSV</button></div>
      <a href={item.sourceUrl} target="_blank" rel="noreferrer">Original upstream source ↗</a><p><code>SHA-256 {item.csvSha256}</code></p>
    </article>)}</section>
  </PageFrame>;
}
