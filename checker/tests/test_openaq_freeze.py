from __future__ import annotations

import gzip
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.freeze_openaq_demo import freeze


def archive_for_24_hours() -> bytes:
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    lines = ["datetime,parameter,value,sensor_id\n"]
    for hour in range(24):
        stamp = base + timedelta(hours=hour)
        lines.append(
            f"{stamp.isoformat().replace('+00:00', 'Z')},pm25,{10 + hour},7001\n"
        )
    return gzip.compress("".join(lines).encode("utf-8"))


def test_freeze_creates_real_source_pair_from_one_archive(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    payload = archive_for_24_hours()

    class Response:
        def __enter__(self) -> "Response":
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

        def read(self) -> bytes:
            return payload

    monkeypatch.setattr("urllib.request.urlopen", lambda *args, **kwargs: Response())

    result = freeze(
        location_id=2178,
        date="2026-01-01",
        output_dir=tmp_path,
        remove_offset_hours=8,
        remove_hours=7,
    )

    file_b = tmp_path / "file_b.csv"
    file_a = tmp_path / "file_a.csv"

    assert result["source"]["sensorId"] == 7001
    assert result["window"]["start"] == "2026-01-01T00:00:00Z"
    assert result["window"]["end"] == "2026-01-02T00:00:00Z"
    assert result["adversarialGap"]["removedTimestamps"][0] == "2026-01-01T08:00:00Z"
    assert len(result["adversarialGap"]["removedTimestamps"]) == 7
    assert len(file_b.read_text(encoding="utf-8").splitlines()) == 25
    assert len(file_a.read_text(encoding="utf-8").splitlines()) == 18
    assert json.loads(
        (tmp_path / "openaq-demo.json").read_text(encoding="utf-8")
    ) == result
