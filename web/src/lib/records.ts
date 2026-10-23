import type { EvidencePackage } from './packages';

export type SavedRecord = { id: string; savedAt: string; package: EvidencePackage; csv: Blob; originalCsv?:Blob };
const DB_NAME='gapwitness-evidence-v1';
const MAX_RECORDS=20, MAX_BYTES=10_000_000;
function database():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if (!globalThis.indexedDB) { reject(new Error('Browser storage is unavailable. Download the CSV and evidence JSON instead.'));return; }
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(new Error('Could not open browser evidence storage.'));
    request.onblocked=()=>reject(new Error('Close other GapWitness tabs before opening this evidence store.'));
  });
}
export async function listRecords():Promise<SavedRecord[]> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readonly');const request=tx.objectStore('records').getAll();
    tx.oncomplete=()=>{db.close();
      const records=request.result as SavedRecord[];
      if(!records.every(record=>typeof record.id==='string'&&typeof record.savedAt==='string'&&record.csv instanceof Blob&&(record.originalCsv===undefined||record.originalCsv instanceof Blob)&&
        record.package&&typeof record.package.csvFilename==='string'&&record.package.evidence&&
        typeof record.package.evidence.stationId==='string'&&Array.isArray(record.package.evidence.missingTimestamps))) {
        reject(new Error('Saved record metadata is damaged. No record has been opened as trusted evidence.'));return;
      }
      resolve(records.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));
    };
    tx.onerror=()=>{db.close();reject(new Error('Could not read browser evidence records.'));};
  });
}
export async function saveRecord(bundle:EvidencePackage,csv:Blob,originalCsv?:Blob):Promise<void> {
  if(csv.size>1_000_000||(originalCsv?.size??0)>1_000_000)throw new Error('CSV exceeds the 1 MB limit.');
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite');const store=tx.objectStore('records');const request=store.getAll();
    let failure='Could not save this record. Browser storage may be full.';
    request.onsuccess=()=>{
      const records=request.result as SavedRecord[];
      const id=JSON.stringify([bundle.evidence.stationId,bundle.evidence.windowStart,bundle.evidence.windowEnd,
        bundle.evidence.seriesHash,bundle.evidence.policyHash,bundle.chain?.publisher??null,bundle.normalization?.originalHash??null]);
      const remaining=records.filter(record=>record.id!==id);
      if(remaining.length>=MAX_RECORDS || remaining.reduce((total,record)=>total+record.csv.size+(record.originalCsv?.size??0),0)+csv.size+(originalCsv?.size??0)>MAX_BYTES) {
        failure='This browser library is limited to 20 records and 10 MB of CSVs. Delete an earlier record or download this evidence instead.';tx.abort();return;
      }
      store.put({id,savedAt:new Date().toISOString(),package:bundle,csv,...(originalCsv?{originalCsv}:{})});
    };
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onabort=()=>{db.close();reject(new Error(failure));};
  });
}
export async function deleteRecord(id:string):Promise<void> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite');tx.objectStore('records').delete(id);
    tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(new Error('Could not delete this browser record.'));};
  });
}
