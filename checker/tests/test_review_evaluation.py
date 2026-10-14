import sys
import json
from pathlib import Path
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from analyze_pilot import analyze
from evaluate_review import build_cases, declared_window_missing, inferred_window_missing, evaluate

def test_boundary_omissions_are_hidden_by_inferred_window_but_not_declared_schedule():
    rows=[{'timestamp':f'2026-09-19T{hour:02}:00:00Z','value':'1'} for hour in range(8,24)]
    assert not inferred_window_missing(rows)
    assert '2026-09-19T07:00:00Z' in declared_window_missing(rows)

def test_evaluation_includes_complete_boundary_and_separated_cases():
    rows=[{'timestamp':str(index),'value':'1'} for index in range(24)]
    cases=list(build_cases(rows))
    assert len(cases)==553
    assert any(removed=={0} for name,removed,data in cases)
    assert any(removed=={23} for name,removed,data in cases)
    assert any(removed=={0,23} for name,removed,data in cases)
    assert all(data for name,removed,data in cases)

def test_pilot_refuses_empty_duplicate_and_nonfinite_measurements():
    row={'participant':'P1','task':'T1','order':'baseline-first','baseline_seconds':'120',
        'tool_seconds':'60','baseline_correct':'1','tool_correct':'1'}
    with pytest.raises(ValueError):analyze([])
    with pytest.raises(ValueError):analyze([row,row])
    with pytest.raises(ValueError):analyze([{**row,'tool_seconds':'nan'}])
    result=analyze([row])
    assert result['medianPairedSecondsSaved']==60
    slower=analyze([{**row,'tool_seconds':'180'}])
    assert slower['medianPairedSecondsSaved']==-60

def test_published_evaluation_is_reproducible_from_retained_source():
    published=json.loads((Path(__file__).resolve().parents[2]/'docs/evaluation-results.json').read_text())
    actual=evaluate()
    for field in ['sourceCsvSha256','caseCount','metrics','duplicateTimestampCases',
                  'negativeMeasurementCases','illustrativeMeanChange','cases']:
        assert actual[field]==published[field],field
