from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.derive_impossible_fixture import derive


def test_derive_impossible_fixture_changes_only_target_value(tmp_path: Path) -> None:
    source = tmp_path / "file_b.csv"
    output = tmp_path / "file_c.csv"
    manifest = tmp_path / "file_c.json"

    source.write_text(
        "timestamp,value\n"
        "2026-01-01T00:00:00Z,12.4\n"
        "2026-01-01T01:00:00Z,13.1\n"
        "2026-01-01T02:00:00Z,12.8\n",
        encoding="utf-8",
    )

    result = derive(
        source=source,
        output=output,
        timestamp="2026-01-01T01:00:00Z",
        value="-1",
        manifest=manifest,
    )

    assert output.read_text(encoding="utf-8") == (
        "timestamp,value\n"
        "2026-01-01T00:00:00Z,12.4\n"
        "2026-01-01T01:00:00Z,-1\n"
        "2026-01-01T02:00:00Z,12.8\n"
    )
    assert result["mutation"]["originalValue"] == "13.1"
    assert result["mutation"]["replacementValue"] == "-1"
    assert json.loads(manifest.read_text(encoding="utf-8")) == result


def test_derive_rejects_unknown_timestamp(tmp_path: Path) -> None:
    source = tmp_path / "file_b.csv"
    source.write_text(
        "timestamp,value\n2026-01-01T00:00:00Z,12.4\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="exactly one target timestamp"):
        derive(
            source=source,
            output=tmp_path / "file_c.csv",
            timestamp="2026-01-01T01:00:00Z",
            value="-1",
            manifest=tmp_path / "file_c.json",
        )
