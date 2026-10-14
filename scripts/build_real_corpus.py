"""Freeze untouched source slices and evaluate predeclared hourly windows across providers."""
import argparse,csv,hashlib,io,json,math,sys,urllib.request
from datetime import datetime,timedelta,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'checker'))
from app.main import inspect_csv
SITES={'LECU':'Leicester University','HM':'High Muffles','YK11':'York Fishergate'}
START_DATES=['2025-01-01','2025-04-01','2025-07-01','2025-10-01']
sha=lambda value:hashlib.sha256(value).hexdigest()
stamp=lambda value:value.isoformat().replace('+00:00','Z')

def parse_uk_hour(date,hour):
    start=datetime.strptime(date,'%d-%m-%Y').replace(tzinfo=timezone.utc)
    h,m=map(int,hour.split(':'))
    if not 1<=h<=24 or m!=0:raise ValueError('Expected GMT hour-ending labels 01:00–24:00')
    return start+timedelta(hours=h)

def uk_slice(payload,start,end):
    lines=payload.decode('utf-8-sig').splitlines(keepends=True)
    header_index=next(i for i,line in enumerate(lines) if line.startswith('Date,time,'))
    fields=next(csv.reader([lines[header_index]]));column=next(i for i,name in enumerate(fields) if 'PM<sub>2.5' in name)
    raw=[];values=[];source_unavailable=[];seen=set();statuses={}
    for line in lines[header_index+1:]:
        row=next(csv.reader([line]))
        if len(row)<=column or not row[0].strip():continue
        time=parse_uk_hour(row[0],row[1])
        if not start<=time<end:continue
        if time in seen:raise ValueError('Duplicate source timestamp')
        seen.add(time);raw.append(line);value=row[column].strip();status=row[column+1].strip()
        statuses[status]=statuses.get(status,0)+1
        if not value:source_unavailable.append(stamp(time));continue
        if not math.isfinite(float(value)):raise ValueError('Non-finite source measurement requires explicit handling')
        values.append((stamp(time),value))
    stream=io.StringIO();writer=csv.writer(stream,lineterminator='\n');writer.writerow(['timestamp','value']);writer.writerows(values)
    expected={start+timedelta(hours=i) for i in range(int((end-start).total_seconds()/3600))}
    observed={datetime.fromisoformat(time.replace('Z','+00:00')) for time,value in values}
    return ''.join(lines[:header_index+1]+raw).encode(),stream.getvalue().encode(),sorted(stamp(t) for t in expected-observed),source_unavailable,statuses

def build(source_dir):
    output=ROOT/'data/corpus';output.mkdir(exist_ok=True);reports=[]
    for site,name in SITES.items():
        url=f'https://uk-air.defra.gov.uk/datastore/data_files/site_data/{site}_2025.csv?v=1'
        full=(source_dir/f'{site.lower()}-2025.csv').read_bytes()
        for date in START_DATES:
            start=datetime.fromisoformat(date).replace(tzinfo=timezone.utc)+timedelta(hours=1);end=start+timedelta(days=7)
            raw,csv_bytes,missing,unavailable,statuses=uk_slice(full,start,end)
            key=f'uk-air-{site.lower()}-{date}'
            (output/f'{key}.source.csv').write_bytes(raw);(output/f'{key}.csv').write_bytes(csv_bytes)
            evidence=inspect_csv(csv_bytes,station_id=site,window_start=stamp(start),window_end=stamp(end))
            if evidence['missingTimestamps']!=missing:raise ValueError('Independent reference missing hours differ from checker')
            reports.append({'id':key,'stationId':site,'stationName':name,'country':'United Kingdom','provider':'UK-AIR / Defra',
                'license':'Open Government Licence v3.0','licenseUrl':'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
                'attribution':'Contains public sector information licensed under the Open Government Licence v3.0. Source: Defra, uk-air.defra.gov.uk.',
                'sourceUrl':url,'sourcePublishedContextUrl':f'https://uk-air.defra.gov.uk/data/flat_files?site_id={site}',
                'acquiredAt':datetime.now(timezone.utc).isoformat(),'annualSourceSha256':sha(full),'rawSlice':f'{key}.source.csv','rawSliceSha256':sha(raw),
                'csv':f'{key}.csv','csvSha256':sha(csv_bytes),'windowStart':stamp(start),'windowEnd':stamp(end),
                'timestampConvention':'GMT hour ending, label preserved as UTC; 24:00 is next-day 00:00',
                'normalization':'Select PM2.5 column, preserve numeric value text, normalize GMT labels to ISO UTC. Blank source values represent unavailable observations; no numeric readings are removed or edited.',
                'sourceUnavailableTimestamps':unavailable,'sourceStatuses':statuses,'referenceMissingTimestamps':missing,'evidence':evidence,'matched':True})
    source_manifest=json.loads((ROOT/'data/source/openaq-demo.json').read_text());source=(ROOT/'checker/demo/file_b.csv').read_bytes()
    if sha(source)!=source_manifest['outputs']['fileBSha256']:raise ValueError('Original AirNow source hash differs')
    (output/'airnow-del-norte.csv').write_bytes(source)
    evidence=inspect_csv(source,station_id='2178',window_start=source_manifest['window']['start'],window_end=source_manifest['window']['end'])
    reports.append({'id':'airnow-del-norte','stationId':'2178','stationName':'Del Norte','country':'United States','provider':'AirNow via OpenAQ',
        'license':'US Public Domain','attribution':'AirNow data accessed through OpenAQ. No endorsement implied.',
        'sourceUrl':source_manifest['source']['sourceUrl'],'provenanceManifest':'../source/openaq-demo.json','csv':'airnow-del-norte.csv',
        'csvSha256':sha(source),'windowStart':evidence['windowStart'],'windowEnd':evidence['windowEnd'],
        'timestampConvention':'OpenAQ exclusive time-ending labels, normalized to UTC','normalization':'Retained complete frozen File B. No adversarial edits.',
        'referenceMissingTimestamps':[],'evidence':evidence,'matched':not evidence['missingTimestamps']})
    report={'format':'gapwitness/real-corpus/v1','windowSelection':'Predeclared first seven reporting days of January, April, July and October 2025 for three UK sites, plus the retained complete AirNow source window.',
        'limits':['This is a bounded corpus, not a representative estimate of provider reliability.','Unavailable source readings are not evidence of fraud or operator misconduct.',
            'Published hourly file structure provides the experimental schedule; station operators have not certified our review windows.','No real-user adoption or time savings are claimed.'],
        'datasetCount':len(reports),'stations':len({r['stationId'] for r in reports}),'providers':len({r['provider'] for r in reports}),
        'sourceUnavailableWindows':sum(bool(r['referenceMissingTimestamps']) for r in reports),'allReferenceMatches':all(r['matched'] for r in reports),'datasets':reports}
    (output/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    catalog={key:value for key,value in report.items() if key!='datasets'}
    catalog['datasets']=[]
    for dataset in reports:
        item={key:value for key,value in dataset.items() if key not in ['evidence','referenceMissingTimestamps','sourceUnavailableTimestamps']}
        item.update({key:dataset['evidence'][key] for key in ['expectedHours','observedHours','missingTimestamps','impossibleTimestamps','verdict']})
        catalog['datasets'].append(item)
    (output/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='datasets'}));return report

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source-dir',type=Path,required=True);parser.add_argument('--acquire',action='store_true');args=parser.parse_args()
    if args.acquire:
        args.source_dir.mkdir(parents=True,exist_ok=True)
        for site in SITES:
            url=f'https://uk-air.defra.gov.uk/datastore/data_files/site_data/{site}_2025.csv?v=1'
            req=urllib.request.Request(url,headers={'User-Agent':'GapWitness/1.0'})
            with urllib.request.urlopen(req,timeout=30) as response:payload=response.read(10_000_001)
            if len(payload)>10_000_000:raise ValueError('Source file exceeds acquisition limit')
            (args.source_dir/f'{site.lower()}-2025.csv').write_bytes(payload)
    build(args.source_dir)
if __name__=='__main__':main()
