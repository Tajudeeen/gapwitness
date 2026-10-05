from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.discover_openaq_window import (
    discover,
    find_first_complete_window,
    parse_archive_by_sensor,
)


def archive(rows: str) -> bytes:
    return gzip.compress(rows.encode("utf-8"))


def test_parse_archive_groups_pm25_by_sensor() -> None:
    payload = archive(
        "datetime,parameter,value,sensor_id\n"
        "2026-01-01T02:00:00Z,pm10,90,100\n"
        "2026-01-01T01:00:00Z,pm25,11.2,100\n"
        "2026-01-01T00:00:00Z,pm25,10.1,100\n"
        "2026-01-01T00:00:00Z,pm25,20.1,101\n"
    )

    grouped = parse_archive_by_sensor(payload)

    assert list(grouped) == [100, 101]
    assert [row[1] for row in grouped[100]] == [
        "2026-01-01T00:00:00Z",
        "2026-01-01T01:00:00Z",
    ]
    assert [row[2] for row in grouped[100]] == ["10.1", "11.2"]


def test_find_first_complete_window_returns_none_for_gap() -> None:
    rows = []
    from datetime import datetime, timedelta, timezone

    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for hour in range(6):
        if hour != 2:
            stamp = base + timedelta(hours=hour)
            rows.append((stamp, stamp.isoformat().replace("+00:00", "Z"), str(hour)))

    assert find_first_complete_window(rows, 6) is None


def test_discovery_picks_earliest_sensor_window(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    payload = archive(
        "datetime,parameter,value,sensor_id\n"
        "2026-01-01T00:00:00Z,pm25,10,101\n"
        "2026-01-01T01:00:00Z,pm25,11,101\n"
        "2026-01-01T02:00:00Z,pm25,12,101\n"
        "2026-01-01T03:00:00Z,pm25,13,101\n"
        "2026-01-01T04:00:00Z,pm25,14,101\n"
        "2026-01-01T05:00:00Z,pm25,15,101\n"
        "2026-01-01T01:00:00Z,pm25,20,100\n"
        "2026-01-01T02:00:00Z,pm25,21,100\n"
        "2026-01-01T03:00:00Z,pm25,22,100\n"
        "2026-01-01T04:00:00Z,pm25,23,100\n"
    )

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self) -> bytes:
            return payload

    monkeypatch.setattr("urllib.request.urlopen", lambda *args, **kwargs: Response())

    manifest = tmp_path / "candidates.json"
    result = discover(2178, "2026-01-01", window_hours=6, manifest=manifest)

    assert result["source"]["locationId"] == 2178
    assert result["source"]["archiveSha256"]
    assert result["selection"]["sensorId"] == 101
    assert result["selection"]["windowStart"] == "2026-01-01T00:00:00Z"
    assert json.loads(manifest.read_text(encoding="utf-8")) == result


def test_parse_archive_accepts_sensors_id_alias() -> None:
    payload = archive(
        "datetime,parameter,value,sensors_id\n"
        "2026-01-01T00:00:00Z,pm25,10,100\n"
        "2026-01-01T01:00:00Z,pm25,11,100\n"
    )

    grouped = parse_archive_by_sensor(payload)

    assert list(grouped) == [100]
    assert [row[2] for row in grouped[100]] == ["10", "11"]


def test_parse_archive_rejects_missing_sensor_column() -> None:
    payload = archive(
        "datetime,parameter,value\n"
        "2026-01-01T00:00:00Z,pm25,10\n"
    )

    with pytest.raises(ValueError, match="sensor ID column"):
        parse_archive_by_sensor(payload)
