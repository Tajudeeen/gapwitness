"""Summarize actual paired reviewer observations. Does not manufacture pilot records."""
import argparse
import csv
import json
import math
import re
import statistics
from pathlib import Path

FIELDS = ['participant','task','order','baseline_seconds','tool_seconds','baseline_correct','tool_correct']

def analyze(rows):
    if not rows: raise ValueError('No completed observations. Run the pilot before claiming reviewer benefits.')
    seen=set();times=[];baseline_correct=tool_correct=0;orders={'baseline-first':0,'tool-first':0}
    for row in rows:
        if any(field not in row for field in FIELDS): raise ValueError('Missing required pilot columns')
        if not all(re.fullmatch(r'[A-Za-z0-9_-]{1,40}',row[field]) for field in ['participant','task']):
            raise ValueError('Use anonymous participant and task codes, not personal details')
        key=(row['participant'],row['task'])
        if key in seen:raise ValueError('Duplicate participant/task pair')
        seen.add(key)
        if row['order'] not in orders:raise ValueError('Invalid task order')
        orders[row['order']]+=1
        baseline,tool=float(row['baseline_seconds']),float(row['tool_seconds'])
        if not all(math.isfinite(value) and 0 < value <= 86400 for value in [baseline,tool]):
            raise ValueError('Durations must be finite positive seconds, at most 24 hours')
        if row['baseline_correct'] not in ['0','1'] or row['tool_correct'] not in ['0','1']:
            raise ValueError('Correctness must be an observed 0 or 1')
        baseline_correct+=int(row['baseline_correct']);tool_correct+=int(row['tool_correct'])
        times.append((baseline,tool))
    return {'format':'gapwitness/pilot/v1','observationPairs':len(rows),'participantCodes':len({row['participant'] for row in rows}),
        'orderCounts':orders,'baselineCorrectTasks':baseline_correct,'toolCorrectTasks':tool_correct,
        'medianBaselineSeconds':statistics.median(a for a,b in times),'medianToolSeconds':statistics.median(b for a,b in times),
        'medianPairedSecondsSaved':statistics.median(a-b for a,b in times),
        'medianPairedPercentTimeReduction':statistics.median((a-b)/a*100 for a,b in times),
        'limits':['Provided observations are not independently authenticated by this script.',
            'Small samples, task order, learning, and dataset choice limit generalization.',
            'Time reduction is descriptive and can be negative. It does not measure environmental outcomes.']}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('csv',type=Path);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    with args.csv.open(newline='') as file: report=analyze(list(csv.DictReader(file)))
    args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
