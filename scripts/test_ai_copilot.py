import pytest
from pathlib import Path
from ai_copilot import analyze_copilot

ROOT = Path(__file__).resolve().parents[1]

def test_ai_copilot_intact_window():
    # 24 observations, no missing hours
    obs = [{"timestamp": f"2026-09-19T{h:02d}:00:00Z", "value": 12.0} for h in range(24)]
    res = analyze_copilot(obs, [], "2178", "2026-09-19T00:00:00Z", "2026-09-20T00:00:00Z")
    assert res["attribution"]["category"] == "COMPLETE_RECORD"
    assert res["attribution"]["suspicionLevel"] == "LOW"
    assert res["counterfactual"] is None

def test_ai_copilot_selective_peak_omission():
    # Deliberate 7-hour missing run during peak hours (15:00 to 21:00)
    obs = [{"timestamp": f"2026-09-19T{h:02d}:00:00Z", "value": 15.0} for h in range(24) if not (15 <= h <= 21)]
    missing = [f"2026-09-19T{h:02d}:00:00Z" for h in range(15, 22)]
    res = analyze_copilot(obs, missing, "2178", "2026-09-19T00:00:00Z", "2026-09-20T00:00:00Z")
    assert res["attribution"]["category"] == "SELECTIVE_PEAK_OMISSION"
    assert res["attribution"]["suspicionLevel"] == "ELEVATED"
    assert res["attribution"]["longestRunHours"] == 7
    assert res["counterfactual"]["distortionDirection"] == "neutral" or "suppressed"

def test_ai_copilot_impossible_physical_violation():
    obs = [{"timestamp": "2026-09-19T01:00:00Z", "value": -5.0}]
    res = analyze_copilot(obs, [], "2178", "2026-09-19T00:00:00Z", "2026-09-20T00:00:00Z")
    assert res["attribution"]["category"] == "IMPOSSIBLE_PHYSICAL_MEASUREMENT"
    assert res["attribution"]["suspicionLevel"] == "HIGH"
