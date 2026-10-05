#!/usr/bin/env python3
"""Fetch one OpenAQ archive day and emit a GapWitness-ready PM2.5 CSV.

The archive is public and does not require an OpenAQ API key. The caller must
provide the OpenAQ location ID and UTC date. The downloaded archive file is
filtered to PM2.5 and normalized to the two-column checker format.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import urllib.request
from pathlib import Path

ARCHIVE = "https://openaq-data-archive.s3.amazonaws.com/records/csv.gz"


def parse_archive(payload: bytes) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    with gzip.GzipFile(fileobj=io.BytesIO(payload), mode="rb") as stream:
        text = io.TextIOWrapper(stream, encoding="utf-8", newline="")
        reader = csv.DictReader(text)
        required = {"datetime", "parameter", "value"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"OpenAQ archive is missing columns: {sorted(missing)}")

        for row in reader:
            if row["parameter"].strip().lower() != "pm25":
                continue
            rows.append((row["datetime"], row["value"]))

    return sorted(rows, key=lambda item: item[0])


def fetch(location_id: int, date: str, output: Path) -> int:
    year, month, day = date.split("-")
    url = f"{ARCHIVE}/locationid={location_id}/year={year}/month={month}/location-{location_id}-{year}{month}{day}.csv.gz"

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "GapWitness/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()

    rows = parse_archive(payload)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["timestamp", "value"])
        writer.writerows(rows)

    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--location-id", type=int, required=True)
    parser.add_argument("--date", required=True, help="UTC date: YYYY-MM-DD")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    count = fetch(args.location_id, args.date, args.output)
    print(f"wrote {count} PM2.5 rows to {args.output}")


if __name__ == "__main__":
    main()
