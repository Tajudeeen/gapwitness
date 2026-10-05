#!/usr/bin/env python3
"""Freeze a real OpenAQ PM2.5 demo pair from one public archive day.

The command downloads one archive object, discovers the first sensor with a
complete 24-hour UTC window, freezes those source rows as File B, and creates
File A only by removing seven explicitly selected hours. Measurement values
are never invented or changed.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import urllib.request
from datetime import timedelta
from pathlib import Path

from scripts.discover_openaq_window import parse_archive_by_sensor, source_url
from scripts.select_openaq_window import find_first_complete_window


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_rows(path: Path, rows: list[tuple]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["timestamp", "value"])
        for _, timestamp, value in rows:
            writer.writerow([timestamp, value])


def freeze(
    location_id: int,
    date: str,
    output_dir: Path,
    remove_offset_hours: int = 8,
    remove_hours: int = 7,
    location_name: str | None = None,
    provider: str | None = None,
    license_name: str | None = None,
    timezone_name: str | None = None,
) -> dict:
    if remove_offset_hours < 0 or remove_hours <= 0:
        raise ValueError("gap offset must be non-negative and remove-hours positive")
    if remove_offset_hours + remove_hours > 24:
        raise ValueError("demo gap must fit inside the 24-hour window")

    url = source_url(location_id, date)
    request = urllib.request.Request(url, headers={"User-Agent": "GapWitness/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()

    grouped = parse_archive_by_sensor(payload)
    candidates = []

    for sensor_id in sorted(grouped):
        found = find_first_complete_window(grouped[sensor_id], 24)
        if found is None:
            continue
        start, selected = found
        candidates.append((start, sensor_id, selected))

    if not candidates:
        raise ValueError("no complete 24-hour PM2.5 sensor window found")

    candidates.sort(key=lambda item: (item[0], item[1]))
    window_start, sensor_id, complete_rows = candidates[0]
    window_end = window_start + timedelta(hours=24)

    gap_start = window_start + timedelta(hours=remove_offset_hours)
    removal = {gap_start + timedelta(hours=i) for i in range(remove_hours)}
    gapped_rows = [row for row in complete_rows if row[0] not in removal]

    output_dir.mkdir(parents=True, exist_ok=True)
    file_b = output_dir / "file_b.csv"
    file_a = output_dir / "file_a.csv"
    write_rows(file_b, complete_rows)
    write_rows(file_a, gapped_rows)

    manifest = {
        "schema": "gapwitness/openaq-demo/v1",
        "source": {
            "sourceUrl": url,
            "locationId": location_id,
            "locationName": location_name,
            "sensorId": sensor_id,
            "date": date,
            "provider": provider,
            "license": license_name,
            "timezone": timezone_name,
            "archiveSha256": hashlib.sha256(payload).hexdigest(),
            "acquisitionDateUtc": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).date().isoformat(),
        },
        "parameter": "pm25",
        "window": {
            "start": window_start.isoformat().replace("+00:00", "Z"),
            "end": window_end.isoformat().replace("+00:00", "Z"),
            "hours": 24,
            "timestampConvention": "exclusive-time-ending",
        },
        "selection": {
            "algorithm": "earliest-complete-sensor-window",
            "candidateCount": len(candidates),
            "sensorId": sensor_id,
        },
        "adversarialGap": {
            "operation": "remove_hourly_rows",
            "gapStart": gap_start.isoformat().replace("+00:00", "Z"),
            "removeHours": remove_hours,
            "removedTimestamps": [
                (gap_start + timedelta(hours=i)).isoformat().replace("+00:00", "Z")
                for i in range(remove_hours)
            ],
        },
        "outputs": {
            "fileB": str(file_b),
            "fileBSha256": sha256_file(file_b),
            "fileA": str(file_a),
            "fileASha256": sha256_file(file_a),
        },
        "integrityNote": (
            "File B contains the selected source-window rows without measurement changes. "
            "File A is derived only by removing the listed hourly rows."
        ),
    }

    manifest_path = output_dir / "openaq-demo.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--location-id", type=int, required=True)
    parser.add_argument("--date", required=True, help="UTC date: YYYY-MM-DD")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--remove-offset-hours", type=int, default=8)
    parser.add_argument("--remove-hours", type=int, default=7)
    parser.add_argument("--location-name")
    parser.add_argument("--provider")
    parser.add_argument("--license", dest="license_name")
    parser.add_argument("--timezone", dest="timezone_name")
    args = parser.parse_args()

    result = freeze(
        location_id=args.location_id,
        date=args.date,
        output_dir=args.output_dir,
        remove_offset_hours=args.remove_offset_hours,
        remove_hours=args.remove_hours,
        location_name=args.location_name,
        provider=args.provider,
        license_name=args.license_name,
        timezone_name=args.timezone_name,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
