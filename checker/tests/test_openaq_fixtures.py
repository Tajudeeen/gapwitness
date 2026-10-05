from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import pytest

from scripts.derive_openaq_fixtures import derive, parse_utc


def write_source(path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["timestamp", "value"])
        for hour in range(24):
            writer.writerow(
                [f"2026-02-01T{hour:02d}:00:00Z", f"{10 + hour / 10:.1f}"]
            )


def test_derives_complete_and_gapped_files_without_changing_values(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    complete = tmp_path / "file_b.csv"
    gapped = tmp_path / "file_a.csv"
    manifest = tmp_path / "manifest.json"
    write_source(source)

    result = derive(
        source=source,
        complete=complete,
        gapped=gapped,
        window_start=parse_utc("2026-02-01T00:00:00Z"),
        window_end=parse_utc("2026-02-02T00:00:00Z"),
        remove_start=parse_utc("2026-02-01T08:00:00Z"),
        remove_hours=7,
        manifest=manifest,
    )

    with complete.open(newline="", encoding="utf-8") as handle:
        complete_rows = list(csv.DictReader(handle))
    with gapped.open(newline="", encoding="utf-8") as handle:
        gapped_rows = list(csv.DictReader(handle))

    assert len(complete_rows) == 24
    assert len(gapped_rows) == 17
    assert complete_rows[8]["value"] == "10.8"
    assert gapped_rows[8]["timestamp"] == "2026-02-01T15:00:00Z"

    assert result["derivation"]["removeHours"] == 7
    assert result["source"]["sha256"]
    assert json.loads(manifest.read_text(encoding="utf-8")) == result


def test_rejects_incomplete_source_window(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    source.write_text(
        "timestamp,value\n"
        "2026-02-01T00:00:00Z,10\n"
        "2026-02-01T02:00:00Z,12\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="source window is incomplete"):
        derive(
            source=source,
            complete=tmp_path / "complete.csv",
            gapped=tmp_path / "gapped.csv",
            window_start=parse_utc("2026-02-01T00:00:00Z"),
            window_end=parse_utc("2026-02-01T03:00:00Z"),
            remove_start=parse_utc("2026-02-01T00:00:00Z"),
            remove_hours=1,
            manifest=tmp_path / "manifest.json",
        )


def test_rejects_removal_outside_window(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    write_source(source)

    with pytest.raises(ValueError, match="removal range"):
        derive(
            source=source,
            complete=tmp_path / "complete.csv",
            gapped=tmp_path / "gapped.csv",
            window_start=parse_utc("2026-02-01T00:00:00Z"),
            window_end=parse_utc("2026-02-02T00:00:00Z"),
            remove_start=parse_utc("2026-02-01T20:00:00Z"),
            remove_hours=5,
            manifest=tmp_path / "manifest.json",
        )
