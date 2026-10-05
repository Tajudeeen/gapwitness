from __future__ import annotations

import json
from pathlib import Path
import sys

CHECKER_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CHECKER_ROOT.parent
if str(CHECKER_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKER_ROOT))

from app.main import inspect_csv  # noqa: E402


def load_demo_manifest() -> dict:
    manifest_path = REPO_ROOT / "data" / "source" / "openaq-demo.json"
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def inspect_fixture(
    path: Path,
    station_id: str,
    window_start: str,
    window_end: str,
) -> dict:
    return inspect_csv(
        path.read_bytes(),
        station_id=station_id,
        window_start=window_start,
        window_end=window_end,
        series_type="pm25",
    )


def main() -> None:
    manifest = load_demo_manifest()
    station_id = str(manifest["source"]["locationId"])
    window_start = manifest["window"]["start"]
    window_end = manifest["window"]["end"]

    base = Path(__file__).resolve().parent
    results = {
        "fileA": inspect_fixture(
            base / "file_a.csv", station_id, window_start, window_end
        ),
        "fileB": inspect_fixture(
            base / "file_b.csv", station_id, window_start, window_end
        ),
        "fileC": inspect_fixture(
            base / "file_c_impossible.csv", station_id, window_start, window_end
        ),
    }

    expected_gap = manifest["adversarialGap"]["removedTimestamps"]
    assert results["fileA"]["verdict"] == "GAPPED"
    assert results["fileA"]["missingTimestamps"] == expected_gap
    assert results["fileA"]["materialGap"] is True

    assert results["fileB"]["verdict"] == "INTACT"
    assert results["fileB"]["missingTimestamps"] == []

    assert results["fileC"]["verdict"] == "IMPOSSIBLE"

    print(
        json.dumps(
            {
                "stationId": station_id,
                "windowStart": window_start,
                "windowEnd": window_end,
                "source": {
                    "sourceUrl": manifest["source"]["sourceUrl"],
                    "sensorId": manifest["source"]["sensorId"],
                    "archiveSha256": manifest["source"]["archiveSha256"],
                },
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
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
