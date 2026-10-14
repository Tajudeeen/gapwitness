"""Reproduce the retained real-data corpus from raw source slices without network access."""
import csv,hashlib,io,json,sys
from datetime import datetime
from pathlib import Path
from build_real_corpus import uk_slice
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'checker'))
from app.main import inspect_csv

def verify():
    folder=ROOT/'data/corpus';manifest=json.loads((folder/'manifest.json').read_text());reports=[]
    for item in manifest['datasets']:
        payload=(folder/item['csv']).read_bytes()
        if hashlib.sha256(payload).hexdigest()!=item['csvSha256']:raise ValueError('Corpus CSV hash differs: '+item['id'])
        if item.get('rawSlice'):
            raw=(folder/item['rawSlice']).read_bytes()
            if hashlib.sha256(raw).hexdigest()!=item['rawSliceSha256']:raise ValueError('Raw source slice hash differs')
            _,normalized,missing,unavailable,statuses=uk_slice(raw,datetime.fromisoformat(item['windowStart'].replace('Z','+00:00')),
                datetime.fromisoformat(item['windowEnd'].replace('Z','+00:00')))
            if normalized!=payload or missing!=item['referenceMissingTimestamps'] or unavailable!=item['sourceUnavailableTimestamps']:raise ValueError('Normalization differs from retained source')
        evidence=inspect_csv(payload,station_id=item['stationId'],window_start=item['windowStart'],window_end=item['windowEnd'])
        if evidence!=item['evidence'] or evidence['missingTimestamps']!=item['referenceMissingTimestamps']:raise ValueError('Corpus evidence differs: '+item['id'])
        reports.append({'id':item['id'],'matched':True,'missing':len(evidence['missingTimestamps']),'policyFlags':len(evidence['impossibleTimestamps'])})
    return reports
if __name__=='__main__':print(json.dumps({'matched':True,'datasets':verify()},indent=2))
