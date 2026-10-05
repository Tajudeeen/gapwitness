#!/usr/bin/env python3
"""Discover complete hourly PM2.5 windows across sensors in an OpenAQ archive day.

The command downloads one public OpenAQ archive object, filters PM2.5 rows,
groups them by sensor, and reports the earliest complete UTC window for every
sensor that has one. No measurement values are modified.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


ARCHIVE = "https://openaq-data-archive.s3.amazonaws.com/records/csv.gz"


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamps must include a timezone")
    parsed = parsed.astimezone(timezone.utc)
    if parsed.minute or parsed.second or parsed.microsecond:
        raise ValueError(f"timestamp is not on an exact UTC hour: {value}")
    return parsed


def parse_archive_by_sensor(payload: bytes) -> dict[int, list[tuple[datetime, str, str]]]:
    grouped: dict[int, list[tuple[datetime, str, str]]] = {}

    with gzip.GzipFile(fileobj=io.BytesIO(payload), mode="rb") as stream:
        text = io.TextIOWrapper(stream, encoding="utf-8", newline="")
        reader = csv.DictReader(text)
        fields = set(reader.fieldnames or [])
        missing = {"datetime", "parameter", "value"} - fields
        if missing:
            raise ValueError(f"OpenAQ archive is missing columns: {sorted(missing)}")
        sensor_column = "sensor_id" if "sensor_id" in fields else "sensors_id"
        if sensor_column not in fields:
            raise ValueError(
                "OpenAQ archive is missing sensor ID column: expected sensor_id or sensors_id"
            )

        for row in reader:
            if row["parameter"].strip().lower() != "pm25":
                continue

            sensor_id = int(row[sensor_column])
            timestamp = parse_utc(row["datetime"])
            grouped.setdefault(sensor_id, []).append(
                (timestamp, row["datetime"], row["value"])
            )

    for sensor_id, rows in grouped.items():
        rows.sort(key=lambda item: item[0])
        timestamps = [row[0] for row in rows]
        if len(set(timestamps)) != len(timestamps):
            raise ValueError(
                f"sensor {sensor_id} contains duplicate PM2.5 hourly timestamps"
            )

    return grouped


def find_first_complete_window(
    rows: list[tuple[datetime, str, str]], window_hours: int
) -> tuple[datetime, list[tuple[datetime, str, str]]] | None:
    if window_hours <= 0:
        raise ValueError("window-hours must be positive")
    if not rows:
        return None

    indexed = {row[0]: row for row in rows}
    for start, _, _ in rows:
        expected = [start + timedelta(hours=i) for i in range(window_hours)]
        if all(hour in indexed for hour in expected):
            return start, [indexed[hour] for hour in expected]

    return None


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def source_url(location_id: int, date: str) -> str:
    year, month, day = date.split("-")
    return (
        f"{ARCHIVE}/locationid={location_id}/year={year}/month={month}/"
        f"location-{location_id}-{year}{month}{day}.csv.gz"
    )


def discover(
    location_id: int,
    date: str,
    window_hours: int = 24,
    manifest: Path | None = None,
) -> dict:
    url = source_url(location_id, date)
    request = urllib.request.Request(url, headers={"User-Agent": "GapWitness/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()

    grouped = parse_archive_by_sensor(payload)
    candidates: list[dict] = []

    for sensor_id in sorted(grouped):
        found = find_first_complete_window(grouped[sensor_id], window_hours)
        if found is None:
            continue

        start, selected = found
        end = start + timedelta(hours=window_hours)
        candidates.append(
            {
                "sensorId": sensor_id,
                "windowStart": start.isoformat().replace("+00:00", "Z"),
                "windowEnd": end.isoformat().replace("+00:00", "Z"),
                "hours": window_hours,
                "rowCount": len(selected),
            }
        )

    candidates.sort(key=lambda item: (item["windowStart"], item["sensorId"]))

    result = {
        "schema": "gapwitness/openaq-candidates/v1",
        "source": {
            "sourceUrl": url,
            "locationId": location_id,
            "date": date,
            "archiveSha256": sha256_bytes(payload),
        },
        "parameter": "pm25",
        "timestampConvention": "exclusive-time-ending",
        "windowHours": window_hours,
        "pm25SensorCount": len(grouped),
        "completeWindowCandidates": candidates,
        "selection": (
            candidates[0] if candidates else None
        ),
    }

    if manifest is not None:
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(
            json.dumps(result, indent=2) + "\n",
            encoding="utf-8",
        )

    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--location-id", type=int, required=True)
    parser.add_argument("--date", required=True, help="UTC date: YYYY-MM-DD")
    parser.add_argument("--window-hours", type=int, default=24)
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()

    result = discover(
        location_id=args.location_id,
        date=args.date,
        window_hours=args.window_hours,
        manifest=args.manifest,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
