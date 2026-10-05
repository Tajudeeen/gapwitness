#!/usr/bin/env python3
"""Fetch one OpenAQ archive day and emit a GapWitness-ready PM2.5 CSV."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import urllib.request
from pathlib import Path

ARCHIVE = "https://openaq-data-archive.s3.amazonaws.com/records/csv.gz"


def parse_archive(payload: bytes, sensor_id: int | None = None) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    with gzip.GzipFile(fileobj=io.BytesIO(payload), mode="rb") as stream:
        text = io.TextIOWrapper(stream, encoding="utf-8", newline="")
        reader = csv.DictReader(text)
        fields = set(reader.fieldnames or [])
        missing = {"datetime", "parameter", "value"} - fields
        if missing:
            raise ValueError(f"OpenAQ archive is missing columns: {sorted(missing)}")
        sensor_column = None
        if sensor_id is not None:
            sensor_column = "sensor_id" if "sensor_id" in fields else "sensors_id"
            if sensor_column not in fields:
                raise ValueError(
                    "OpenAQ archive is missing sensor ID column: expected sensor_id or sensors_id"
                )

        for row in reader:
            if row["parameter"].strip().lower() != "pm25":
                continue
            if sensor_id is not None and int(row[sensor_column]) != sensor_id:
                continue
            rows.append((row["datetime"], row["value"]))

    return sorted(rows, key=lambda item: item[0])


def fetch(
    location_id: int,
    date: str,
    output: Path,
    sensor_id: int | None = None,
    manifest: Path | None = None,
) -> int:
    year, month, day = date.split("-")
    url = (
        f"{ARCHIVE}/locationid={location_id}/year={year}/month={month}/"
        f"location-{location_id}-{year}{month}{day}.csv.gz"
    )

    request = urllib.request.Request(url, headers={"User-Agent": "GapWitness/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()

    rows = parse_archive(payload, sensor_id=sensor_id)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["timestamp", "value"])
        writer.writerows(rows)

    if manifest is not None:
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(
            json.dumps(
                {
                    "schema": "gapwitness/openaq-source/v1",
                    "sourceUrl": url,
                    "locationId": location_id,
                    "sensorId": sensor_id,
                    "date": date,
                    "parameter": "pm25",
                    "archiveSha256": hashlib.sha256(payload).hexdigest(),
                    "normalizedCsv": str(output),
                    "normalizedCsvSha256": hashlib.sha256(output.read_bytes()).hexdigest(),
                    "rowCount": len(rows),
                    "timestampConvention": "exclusive-time-ending",
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--location-id", type=int, required=True)
    parser.add_argument("--date", required=True, help="UTC date: YYYY-MM-DD")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sensor-id", type=int)
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()

    count = fetch(
        args.location_id,
        args.date,
        args.output,
        sensor_id=args.sensor_id,
        manifest=args.manifest,
    )
    print(f"wrote {count} PM2.5 rows to {args.output}")


if __name__ == "__main__":
    main()
