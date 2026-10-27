import {keccak256,toUtf8Bytes} from 'ethers';
import {parseUtcHour} from './evidence.ts';
import type {CheckResult} from './checker';

export type ScheduleSource={format:'gapwitness/schedule/v1';stationId:string;windowStart:string;windowEnd:string;
  cadenceMinutes:60;issuer:string;sourceUrl:string;reference:string;attachedAt:string;documentFilename:string;
  documentBase64:string;documentHash:string;bindingHash:string;attestation:'reviewer-confirmed'};
type Declaration=Pick<ScheduleSource,'issuer'|'sourceUrl'|'reference'>;
const fields=['format','stationId','windowStart','windowEnd','cadenceMinutes','issuer','sourceUrl','reference','attachedAt','documentFilename','documentHash','attestation'] as const;
function binding(s:ScheduleSource){return keccak256(toUtf8Bytes(JSON.stringify(fields.map(key=>[key,s[key]]))));}
function encode(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
export function makeSchedule(e:CheckResult,declaration:Declaration,filename:string,bytes:Uint8Array):ScheduleSource {
  if(!bytes.length||bytes.length>500000)throw new Error('Schedule document must contain 1–500,000 bytes.');
  const value={format:'gapwitness/schedule/v1' as const,stationId:e.stationId,windowStart:e.windowStart,windowEnd:e.windowEnd,
    cadenceMinutes:60 as const,...declaration,attachedAt:new Date().toISOString(),documentFilename:filename,
    documentBase64:encode(bytes),documentHash:keccak256(bytes),bindingHash:'',attestation:'reviewer-confirmed' as const};
  value.bindingHash=binding(value);return checkSchedule(value,e);
}
export function checkSchedule(raw:unknown,e:CheckResult):ScheduleSource {
  const s=raw as ScheduleSource;
  if(!s||s.format!=='gapwitness/schedule/v1'||s.cadenceMinutes!==60||s.attestation!=='reviewer-confirmed')throw new Error('Unsupported schedule declaration.');
  if(s.stationId!==e.stationId||parseUtcHour(s.windowStart)!==parseUtcHour(e.windowStart)||parseUtcHour(s.windowEnd)!==parseUtcHour(e.windowEnd))
    throw new Error('Schedule station and reporting window do not match this inspection.');
  for(const field of ['issuer','reference','documentFilename'] as const)
    if(typeof s[field]!=='string'||!s[field].trim()||s[field].length>500)throw new Error('Schedule issuer, source reference and filename are required.');
  let url:URL;try{url=new URL(s.sourceUrl);}catch{throw new Error('Use an HTTPS schedule source URL.');}
  if(url.protocol!=='https:'||url.username||url.password||s.sourceUrl.length>2000)throw new Error('Use an HTTPS schedule source URL without credentials.');
  if(typeof s.attachedAt!=='string'||!Number.isFinite(Date.parse(s.attachedAt)))throw new Error('Schedule attachment date is invalid.');
  if(typeof s.documentBase64!=='string'||!s.documentBase64.length||s.documentBase64.length>666668||s.documentBase64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(s.documentBase64))throw new Error('Schedule document must contain 1–500,000 bytes.');
  const bytes=Uint8Array.from(atob(s.documentBase64),c=>c.charCodeAt(0));
  if(!bytes.length||bytes.length>500000||encode(bytes)!==s.documentBase64||keccak256(bytes)!==s.documentHash||binding(s)!==s.bindingHash)
    throw new Error('Schedule document or declaration fingerprint does not match.');
  // A valid digest detects changes against retained evidence. It does not authenticate the issuer.
  return Object.fromEntries([...fields,'documentBase64','bindingHash'].map(key=>[key,s[key as keyof ScheduleSource]])) as ScheduleSource;
}
