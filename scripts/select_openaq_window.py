#!/usr/bin/env python3
"""Select and freeze a complete UTC hourly OpenAQ window.

Input must be a single-sensor normalized CSV:
    timestamp,value

The selector never changes measurement values. It only chooses the earliest
complete hourly window of the requested size and writes those source rows
verbatim in canonical CSV form.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamps must include a timezone")
    parsed = parsed.astimezone(timezone.utc)
    if parsed.minute or parsed.second or parsed.microsecond:
        raise ValueError(f"timestamp is not on an exact UTC hour: {value}")
    return parsed


def load_rows(path: Path) -> list[tuple[datetime, str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if set(reader.fieldnames or []) != {"timestamp", "value"}:
            raise ValueError("source CSV must contain exactly timestamp,value columns")
        rows = [
            (parse_utc(row["timestamp"]), row["timestamp"], row["value"])
            for row in reader
        ]

    if not rows:
        raise ValueError("source CSV is empty")

    rows.sort(key=lambda item: item[0])
    timestamps = [item[0] for item in rows]
    if len(set(timestamps)) != len(timestamps):
        raise ValueError("source CSV contains duplicate timestamps")

    return rows


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_first_complete_window(
    rows: list[tuple[datetime, str, str]], window_hours: int
) -> tuple[datetime, list[tuple[datetime, str, str]]]:
    if window_hours <= 0:
        raise ValueError("window-hours must be positive")

    indexed = {parsed: row for row in rows}
    timestamps = [row[0] for row in rows]

    for start in timestamps:
        expected = [start + timedelta(hours=i) for i in range(window_hours)]
        if all(hour in indexed for hour in expected):
            return start, [indexed[hour] for hour in expected]

    raise ValueError(f"no complete {window_hours}-hour UTC window found")


def write_window(path: Path, rows: list[tuple[datetime, str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["timestamp", "value"])
        for parsed, original_timestamp, value in rows:
            del parsed
            writer.writerow([original_timestamp, value])


def select_window(
    source: Path,
    output: Path,
    manifest: Path,
    location_id: int,
    sensor_id: int,
    window_hours: int = 24,
) -> dict:
    rows = load_rows(source)
    window_start, selected = find_first_complete_window(rows, window_hours)
    window_end = window_start + timedelta(hours=window_hours)

    write_window(output, selected)

    result = {
        "schema": "gapwitness/openaq-window/v1",
        "source": {
            "path": str(source),
            "sha256": sha256_file(source),
        },
        "locationId": location_id,
        "sensorId": sensor_id,
        "parameter": "pm25",
        "window": {
            "start": window_start.isoformat().replace("+00:00", "Z"),
            "end": window_end.isoformat().replace("+00:00", "Z"),
            "hours": window_hours,
        },
        "selection": {
            "algorithm": "earliest-complete-utc-hour-window",
            "inputRowCount": len(rows),
            "selectedRowCount": len(selected),
        },
        "output": {
            "path": str(output),
            "sha256": sha256_file(output),
        },
        "timestampConvention": "exclusive-time-ending",
    }

    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--location-id", type=int, required=True)
    parser.add_argument("--sensor-id", type=int, required=True)
    parser.add_argument("--window-hours", type=int, default=24)
    args = parser.parse_args()

    result = select_window(
        source=args.source,
        output=args.output,
        manifest=args.manifest,
        location_id=args.location_id,
        sensor_id=args.sensor_id,
        window_hours=args.window_hours,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
