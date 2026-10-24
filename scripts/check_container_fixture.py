"""Check the built checker image against the complete retained File A evidence."""
import json
import sys
from pathlib import Path
from app.main import inspect_csv

csv_path, proof_path = map(Path, sys.argv[1:])
expected = json.loads(proof_path.read_text())['localEvidence']
actual = inspect_csv(csv_path.read_bytes(), station_id=expected['stationId'],
                     window_start=expected['windowStart'], window_end=expected['windowEnd'],
                     series_type=expected['seriesType'])
assert actual == expected, 'Built container output differs from the retained File A witness'
print(json.dumps({'containerFixtureMatched': True, 'verdict': actual['verdict'],
                  'observedHours': actual['observedHours'], 'expectedHours': actual['expectedHours']}))
