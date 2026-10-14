"""Inspect a local review manifest without uploading data or using a wallet."""
import argparse
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'checker'))
from app.main import inspect_csv, MAX_FILE_BYTES

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    entries = json.loads(args.manifest.read_text())
    if not isinstance(entries,list) or not 1 <= len(entries) <= 100:
        raise ValueError('Manifest must contain 1–100 review entries')
    reports = []
    for entry in entries:
        try:
            csv = args.manifest.parent / entry['csv']
            if csv.stat().st_size > MAX_FILE_BYTES: raise ValueError('FILE_TOO_LARGE')
            report = inspect_csv(csv.read_bytes(),station_id=entry['stationId'],window_start=entry['windowStart'],
                window_end=entry['windowEnd'],series_type=entry.get('seriesType','pm25'))
            reports.append({'csv':entry['csv'],'status':'inspected','evidence':report})
        except (ValueError,KeyError,OSError) as error:
            reports.append({'csv':entry.get('csv'),'status':'rejected','error':str(error)})
    args.output.write_text(json.dumps({'format':'gapwitness/batch/v1','reports':reports},indent=2)+'\n')
    print(json.dumps({'inspected':sum(r['status']=='inspected' for r in reports),'rejected':sum(r['status']=='rejected' for r in reports)}))
    return 1 if any(r['status']=='rejected' for r in reports) else 0
if __name__ == '__main__': raise SystemExit(main())
