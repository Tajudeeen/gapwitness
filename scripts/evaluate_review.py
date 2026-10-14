"""Reproducible omission evaluation using controlled derivatives of frozen real source data."""
import argparse
import csv
import hashlib
import io
import json
import platform
import statistics
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'checker'))
from app.main import inspect_csv

START = '2026-09-19T07:00:00Z'
END = '2026-09-20T07:00:00Z'

def encode(rows):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=['timestamp', 'value'], lineterminator='\n')
    writer.writeheader(); writer.writerows(rows)
    return stream.getvalue().encode()

def utc(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)

def inferred_window_missing(rows):
    """A common shortcut: infer the schedule from the submitted file's first and last hours."""
    observed = {utc(row['timestamp']) for row in rows}
    first, last = min(observed), max(observed)
    expected = {first + timedelta(hours=i) for i in range(int((last-first).total_seconds()/3600)+1)}
    return {stamp.isoformat().replace('+00:00', 'Z') for stamp in expected-observed}

def declared_window_missing(rows):
    """Strong reference baseline: explicitly enumerate the independently declared schedule."""
    observed = {utc(row['timestamp']) for row in rows}
    expected = {utc(START) + timedelta(hours=i) for i in range(24)}
    return {stamp.isoformat().replace('+00:00', 'Z') for stamp in expected-observed}

def build_cases(rows):
    yield 'complete', set(), rows
    for length in range(1, 24):
        for first in range(25-length):
            removed = set(range(first, first+length))
            yield f'contiguous-{first}-{length}', removed, [row for i,row in enumerate(rows) if i not in removed]
    for first in range(24):
        for second in range(first+2,24):
            removed = {first,second}
            yield f'separated-{first}-{second}', removed, [row for i,row in enumerate(rows) if i not in removed]

def evaluate():
    source = ROOT/'checker/demo/file_b.csv'
    source_bytes = source.read_bytes()
    manifest = json.loads((ROOT/'data/source/openaq-demo.json').read_text())
    if hashlib.sha256(source_bytes).hexdigest() != manifest['outputs']['fileBSha256']:
        raise ValueError('Frozen source hash does not match provenance')
    rows = list(csv.DictReader(io.StringIO(source_bytes.decode())))
    timestamps = [utc(row['timestamp']).isoformat().replace('+00:00','Z') for row in rows]
    expected = [(utc(START)+timedelta(hours=i)).isoformat().replace('+00:00','Z') for i in range(24)]
    if timestamps != expected: raise ValueError('Source is not the independently declared complete window')
    cases = []
    totals = {name: {'exactCases':0,'trueMissingHours':0,'falseMissingHours':0,'missedHours':0} for name in ['gapwitness','inferredWindow','declaredWindow']}
    timings = []
    for name, removed, variant in build_cases(rows):
        truth = {timestamps[i] for i in removed}
        payload = encode(variant)
        began = time.perf_counter()
        evidence = inspect_csv(payload,station_id='2178',window_start=START,window_end=END)
        timings.append((time.perf_counter()-began)*1000)
        predictions = {'gapwitness':set(evidence['missingTimestamps']),
            'inferredWindow':inferred_window_missing(variant),'declaredWindow':declared_window_missing(variant)}
        for method, predicted in predictions.items():
            totals[method]['exactCases'] += int(predicted == truth)
            totals[method]['trueMissingHours'] += len(predicted & truth)
            totals[method]['falseMissingHours'] += len(predicted - truth)
            totals[method]['missedHours'] += len(truth - predicted)
        cases.append({'case':name,'csvSha256':hashlib.sha256(payload).hexdigest(),
            'removedHourIndices':sorted(removed),'expectedMissingHours':len(truth),
            'gapHash':evidence['gapHash'],'seriesHash':evidence['seriesHash'],'policyHash':evidence['policyHash'],
            'gapwitnessExact':predictions['gapwitness']==truth,'inferredWindowExact':predictions['inferredWindow']==truth,
            'declaredWindowExact':predictions['declaredWindow']==truth})
    # A row-count-only check can miss an absent timestamp replaced by a duplicate.
    duplicate_rejections = 0
    for missing in range(24):
        variant = [row for i,row in enumerate(rows) if i != missing] + [rows[(missing+1)%24]]
        try: inspect_csv(encode(variant),station_id='2178',window_start=START,window_end=END)
        except ValueError as error:
            if str(error) != 'DUPLICATE_TIMESTAMP': raise
            duplicate_rejections += 1
    negative_detections = 0
    for index in range(24):
        variant = [dict(row) for row in rows]; variant[index]['value'] = '-1'
        evidence = inspect_csv(encode(variant),station_id='2178',window_start=START,window_end=END)
        if evidence['impossibleTimestamps'] == [timestamps[index]]: negative_detections += 1
    complete_mean = statistics.mean(float(row['value']) for row in rows)
    a = list(csv.DictReader(io.StringIO((ROOT/'checker/demo/file_a.csv').read_text())))
    edited_mean = statistics.mean(float(row['value']) for row in a)
    return {'format':'gapwitness/evaluation/v1','sourceManifest':'data/source/openaq-demo.json',
        'sourceCsvSha256':hashlib.sha256(source_bytes).hexdigest(),'scope':'Controlled derivatives of one real 24-hour source window. The test schedule is predeclared, not independently certified by the station operator. No natural outage, fraud, adoption, or human time saving is claimed.',
        'environment':{'python':platform.python_version(),'platform':platform.platform()},
        'caseCount':len(cases),'metrics':totals,'duplicateTimestampCases':{'total':24,'rejected':duplicate_rejections,
            'rowCountOnlyWouldPass':24},'negativeMeasurementCases':{'total':24,'detected':negative_detections},
        'computeMilliseconds':{'median':statistics.median(timings),'p95':sorted(timings)[int(len(timings)*.95)],
            'scope':'One local computation per omission case, excluding network, browser, and reviewer time.'},
        'illustrativeMeanChange':{'completeSourceMean':complete_mean,'deliberatelyEditedMean':edited_mean,
            'percentChange':(edited_mean/complete_mean-1)*100,
            'note':'Arithmetic illustration from the documented seven-hour derivative. Not an AQI calculation or measured health effect.'},
        'cases':cases}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();report=evaluate();args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({key:report[key] for key in ['caseCount','metrics','duplicateTimestampCases','negativeMeasurementCases','illustrativeMeanChange']}))
    return 0 if report['metrics']['gapwitness']['exactCases']==report['caseCount'] and report['duplicateTimestampCases']['rejected']==24 and report['negativeMeasurementCases']['detected']==24 else 1
if __name__=='__main__':raise SystemExit(main())
