"""Record actual health/status and source-corpus checks. Never fabricates uptime percentages."""
import argparse,json,time,urllib.request
from datetime import datetime,timezone
from pathlib import Path
from verify_real_corpus import verify

def probe(url):
    began=time.perf_counter()
    try:
        request=urllib.request.Request(url,headers={'User-Agent':'GapWitnessMonitor/1.0'})
        with urllib.request.urlopen(request,timeout=15) as response:
            body=json.load(response);code=response.status
        return {'url':url,'ok':code==200 and body.get('ok') is True,'httpStatus':code,'elapsedMilliseconds':round((time.perf_counter()-began)*1000,2),'response':body}
    except Exception as error:return {'url':url,'ok':False,'errorType':type(error).__name__,'elapsedMilliseconds':round((time.perf_counter()-began)*1000,2)}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--base-url',default='https://gapwitness-checker.vercel.app');parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    checks=[probe(args.base_url.rstrip('/')+path) for path in ['/health','/status','/ready']]
    corpus=verify();report={'format':'gapwitness/monitor/v1','checkedAt':datetime.now(timezone.utc).isoformat(),'checks':checks,
        'corpusMatches':all(row['matched'] for row in corpus),'corpusWindows':len(corpus),
        'limits':['Point-in-time checks, not a global uptime percentage.','Status metrics cover only the responding process.','Shared quota configuration is reported separately from dependency health.']}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'healthy':all(row['ok'] for row in checks),'corpusMatches':report['corpusMatches']}))
    return 0 if all(row['ok'] for row in checks) else 1
if __name__=='__main__':raise SystemExit(main())
