"""Measure local checker performance. Results do not measure environmental impact."""
import argparse, json, platform, statistics, sys, time
from datetime import datetime, timedelta, timezone
from importlib.metadata import version
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'checker'))
from app.main import inspect_csv

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    cases=[]
    start=datetime(2026,1,1,tzinfo=timezone.utc)
    for hours in [24,168,744]:
        data=('timestamp,value\n'+'\n'.join(f'{(start+timedelta(hours=i)).isoformat()},{10+i%50}' for i in range(hours))+'\n').encode()
        window={'station_id':'synthetic-benchmark','window_start':start.isoformat(),'window_end':(start+timedelta(hours=hours)).isoformat()}
        inspect_csv(data,**window)
        samples=[]
        for _ in range(50):
            begin=time.perf_counter(); result=inspect_csv(data,**window); samples.append((time.perf_counter()-begin)*1000)
        assert result['observedHours']==hours and result['verdict']=='INTACT'
        cases.append({'source':'synthetic performance fixture','hours':hours,'bytes':len(data),'runs':50,
                      'medianMs':round(statistics.median(samples),3),'p95Ms':round(sorted(samples)[47],3)})
    output={'scope':'local deterministic checker only, no HTTP, wallet, or production load',
            'environment':{'python':platform.python_version(),'platform':platform.system(),'machine':platform.machine(),
                           'pandas':version('pandas'),'fastapi':version('fastapi')},'cases':cases,
            'notMeasured':['Environmental outcomes','User adoption','Manual review time savings','Distributed service capacity']}
    args.output.write_text(json.dumps(output,indent=2)+'\n'); print(json.dumps(output,indent=2))
if __name__=='__main__':main()
