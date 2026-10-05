import gzip
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.fetch_openaq_day import parse_archive


def archive(rows: str) -> bytes:
    return gzip.compress(rows.encode("utf-8"))


def test_parse_archive_filters_pm25_and_sorts():
    payload = archive(
        "datetime,parameter,value\n"
        "2026-01-01T02:00:00Z,pm10,90\n"
        "2026-01-01T01:00:00Z,pm25,11.2\n"
        "2026-01-01T00:00:00Z,pm25,10.1\n"
    )

    assert parse_archive(payload) == [
        ("2026-01-01T00:00:00Z", "10.1"),
        ("2026-01-01T01:00:00Z", "11.2"),
    ]


def test_parse_archive_rejects_missing_columns():
    payload = archive("datetime,parameter\n2026-01-01T00:00:00Z,pm25\n")

    try:
        parse_archive(payload)
    except ValueError as exc:
        assert "missing columns" in str(exc)
    else:
        raise AssertionError("expected missing-column validation")


def test_parse_archive_filters_to_requested_sensor():
    payload = archive(
        "datetime,parameter,value,sensor_id\n"
        "2026-01-01T00:00:00Z,pm25,10.1,100\n"
        "2026-01-01T01:00:00Z,pm25,11.2,101\n"
    )

    assert parse_archive(payload, sensor_id=101) == [
        ("2026-01-01T01:00:00Z", "11.2"),
    ]
