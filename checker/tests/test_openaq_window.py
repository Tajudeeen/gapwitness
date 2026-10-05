from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.select_openaq_window import (
    find_first_complete_window,
    load_rows,
    select_window,
)


def write_source(path: Path, rows: list[str]) -> None:
    path.write_text("timestamp,value\n" + "".join(rows), encoding="utf-8")


def test_finds_earliest_complete_window(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    output = tmp_path / "window.csv"
    manifest = tmp_path / "manifest.json"
    rows = [
        f"2026-01-01T{hour:02d}:00:00Z,{hour + 1}\n"
        for hour in range(30)
        if hour != 6
    ]
    write_source(source, rows)

    result = select_window(
        source=source,
        output=output,
        manifest=manifest,
        location_id=2178,
        sensor_id=9001,
        window_hours=5,
    )

    assert result["window"]["start"] == "2026-01-01T00:00:00Z"
    assert result["window"]["end"] == "2026-01-01T05:00:00Z"
    assert result["selection"]["selectedRowCount"] == 5
    assert output.read_text(encoding="utf-8").splitlines()[1:] == [
        "2026-01-01T00:00:00Z,1",
        "2026-01-01T01:00:00Z,2",
        "2026-01-01T02:00:00Z,3",
        "2026-01-01T03:00:00Z,4",
        "2026-01-01T04:00:00Z,5",
    ]
    assert json.loads(manifest.read_text(encoding="utf-8")) == result


def test_skips_incomplete_candidate_and_selects_next_complete_window() -> None:
    rows = [
        (
            datetime(2026, 1, 1, hour, tzinfo=timezone.utc),
            f"2026-01-01T{hour:02d}:00:00Z",
            str(hour),
        )
        for hour in range(30)
        if hour != 2
    ]
    start, selected = find_first_complete_window(rows, 4)

    assert start.isoformat() == "2026-01-01T03:00:00+00:00"
    assert [row[1] for row in selected] == [
        "2026-01-01T03:00:00Z",
        "2026-01-01T04:00:00Z",
        "2026-01-01T05:00:00Z",
        "2026-01-01T06:00:00Z",
    ]


def test_rejects_non_hour_timestamps(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    write_source(source, ["2026-01-01T00:30:00Z,1\n"])

    with pytest.raises(ValueError, match="not on an exact UTC hour"):
        load_rows(source)


def test_rejects_duplicate_timestamps(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    write_source(
        source,
        [
            "2026-01-01T00:00:00Z,1\n",
            "2026-01-01T00:00:00+00:00,2\n",
        ],
    )

    with pytest.raises(ValueError, match="duplicate timestamps"):
        load_rows(source)


def test_rejects_missing_complete_window() -> None:
    rows = [
        (
            datetime(2026, 1, 1, hour, tzinfo=timezone.utc),
            f"2026-01-01T{hour:02d}:00:00Z",
            str(hour),
        )
        for hour in range(3)
    ]

    with pytest.raises(ValueError, match="no complete 4-hour UTC window found"):
        find_first_complete_window(rows, 4)
