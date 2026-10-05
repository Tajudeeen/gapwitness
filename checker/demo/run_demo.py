from __future__ import annotations
import json
from pathlib import Path
import sys

CHECKER_ROOT = Path(__file__).resolve().parents[1]
if str(CHECKER_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKER_ROOT))

from app.main import inspect_csv  # noqa: E402

STATION_ID = "demo-station-pm25"
WINDOW_START = "2026-01-01T00:00:00Z"
WINDOW_END = "2026-01-02T00:00:00Z"

def inspect_fixture(path: Path) -> dict:
    return inspect_csv(
        path.read_bytes(),
        station_id=STATION_ID,
        window_start=WINDOW_START,
        window_end=WINDOW_END,
        series_type="pm25",
    )

def main() -> None:
    base = Path(__file__).resolve().parent
    results = {
        "fileA": inspect_fixture(base / "file_a.csv"),
        "fileB": inspect_fixture(base / "file_b.csv"),
        "fileC": inspect_fixture(base / "file_c_impossible.csv"),
    }

    assert results["fileA"]["verdict"] == "GAPPED"
    assert len(results["fileA"]["missingTimestamps"]) == 7
    assert results["fileA"]["materialGap"] is True
    assert results["fileB"]["verdict"] == "INTACT"
    assert results["fileB"]["missingTimestamps"] == []
    assert results["fileC"]["verdict"] == "IMPOSSIBLE"

    print(json.dumps({
        "stationId": STATION_ID,
        "windowStart": WINDOW_START,
        "windowEnd": WINDOW_END,
        "fileA": {
            "verdict": results["fileA"]["verdict"],
            "missingTimestamps": results["fileA"]["missingTimestamps"],
            "seriesHash": results["fileA"]["seriesHash"],
            "gapHash": results["fileA"]["gapHash"],
            "policyHash": results["fileA"]["policyHash"],
        },
        "fileB": {
            "verdict": results["fileB"]["verdict"],
            "missingTimestamps": results["fileB"]["missingTimestamps"],
            "seriesHash": results["fileB"]["seriesHash"],
            "gapHash": results["fileB"]["gapHash"],
            "policyHash": results["fileB"]["policyHash"],
        },
        "fileC": {
            "verdict": results["fileC"]["verdict"],
            "impossibleTimestamps": results["fileC"]["impossibleTimestamps"],
        },
    }, indent=2))

if __name__ == "__main__":
    main()
