import {checkPackage,type EvidencePackage} from './packages.ts';
export const MAX_BUNDLE_BYTES=5_000_000;
type EncodedCsv={filename:string;encoding:'base64';data:string};
export type ReviewBundle={format:'gapwitness/review-bundle/v1';evidence:EvidencePackage;inspectedCsv:EncodedCsv;originalCsv?:EncodedCsv;instructions:string[]};
function encode(bytes:Uint8Array):string {
  let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
}
function decode(raw:unknown):{filename:string;bytes:Uint8Array} {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Missing CSV in review bundle.');
  const csv=raw as EncodedCsv;
  if(csv.encoding!=='base64'||typeof csv.filename!=='string'||csv.filename.length<1||csv.filename.length>255||
    /[\\/\u0000-\u001f]/.test(csv.filename)||typeof csv.data!=='string'||csv.data.length>1_333_336||
    csv.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(csv.data))throw new Error('Invalid bounded CSV encoding in review bundle.');
  const text=atob(csv.data),bytes=Uint8Array.from(text,c=>c.charCodeAt(0));
  if(!bytes.length||bytes.length>1_000_000||encode(bytes)!==csv.data)throw new Error('Invalid CSV bytes in review bundle.');
  return {filename:csv.filename,bytes};
}
const instructions=[
  'Open this JSON on the GapWitness Evidence page using Open review bundle. No checker upload or wallet is required to recheck it.',
  'The inspected CSV is the exact file covered by the evidence and any chain commitment.',
  'For mapped imports, the original source CSV is separate. Reapply the recorded mapping to reproduce the inspected bytes. Both hashes must match.',
  'The station and reporting window are declared inputs. Confirm the reporting schedule independently of the uploaded rows.',
  'An attached schedule retains exact document bytes and reviewer-confirmed metadata. Its fingerprint is rechecked locally, not authenticated by an issuer or included in the historical chain commitment.',
  'To check a published witness, open Verify and select Current inspection. A fresh RPC check is separate from local byte verification.',
  'File hashes and reproducible normalization do not authenticate a data provider, station operator or measurement accuracy.'
];
export function makeReviewBundle(evidence:EvidencePackage,inspected:Uint8Array,original?:Uint8Array):ReviewBundle {
  const checked=checkPackage(evidence,inspected,original);
  if(original&&!checked.normalization)throw new Error('A separate source CSV requires a recorded normalization.');
  return {format:'gapwitness/review-bundle/v1',evidence:checked,
    inspectedCsv:{filename:'inspected.csv',encoding:'base64',data:encode(inspected)},
    ...(original?{originalCsv:{filename:'original-source.csv',encoding:'base64' as const,data:encode(original)}}:{}),instructions};
}
export function openReviewBundle(raw:unknown) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Choose a GapWitness review bundle.');
  const bundle=raw as ReviewBundle;
  if(bundle.format!=='gapwitness/review-bundle/v1')throw new Error('Unsupported review bundle format.');
  const inspected=decode(bundle.inspectedCsv),original=bundle.originalCsv===undefined?undefined:decode(bundle.originalCsv);
  const evidence=checkPackage(bundle.evidence,inspected.bytes,original?.bytes);
  if(original&&!evidence.normalization)throw new Error('Unbound original source CSV in review bundle.');
  return {evidence,inspected,original};
}
