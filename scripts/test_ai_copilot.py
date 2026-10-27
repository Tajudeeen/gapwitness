from pathlib import Path
import pytest
from ai_copilot import analyze_result,analyze_copilot
from app.main import inspect_csv
ROOT=Path(__file__).resolve().parents[1]
INPUT=dict(station_id='2178',window_start='2026-09-19T07:00:00Z',window_end='2026-09-20T07:00:00Z')
def fixture(name):return inspect_csv((ROOT/'checker/demo'/name).read_bytes(),**INPUT)
def test_controlled_case_abstains_and_complete_source_rejects():
    a=analyze_result(fixture('file_a.csv'));b=analyze_result(fixture('file_b.csv'))
    assert a['decision']['status']=='UNRESOLVED'
    assert a['decision']['upperMean'] is None
    assert a['description']['longestRunHours']==7
    assert b['decision']['status']=='NOT_SUPPORTED'
    assert 'confidencePercent' not in a['description']
def test_invalid_measurements_and_invalid_threshold_abstain_or_reject():
    assert analyze_result(fixture('file_c_impossible.csv'),100)['decision']['status']=='UNRESOLVED'
    for threshold in [-1,float('inf'),float('nan')]:
        with pytest.raises(ValueError):analyze_result(fixture('file_a.csv'),threshold)
def test_cli_adapter_rejects_false_missing_list():
    e=fixture('file_a.csv')
    with pytest.raises(ValueError,match='Provided gaps'):
        analyze_copilot(e['observations'],[],e['stationId'],e['windowStart'],e['windowEnd'])
