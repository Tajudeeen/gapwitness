#!/usr/bin/env python3
"""Derive an adversarial GapWitness fixture from a complete hourly source file.

The source file must already be normalized to:
    timestamp,value

This tool never invents measurements. It copies the complete source window
verbatim and creates File A by removing explicitly selected hourly timestamps.
A JSON manifest records the exact source bytes hash and the derived removal
operation so the demo can be reproduced from the original OpenAQ object.
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
    return parsed.astimezone(timezone.utc)


def load_rows(path: Path) -> list[tuple[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if set(reader.fieldnames or []) != {"timestamp", "value"}:
            raise ValueError("source CSV must contain exactly timestamp,value columns")
        rows = [(row["timestamp"], row["value"]) for row in reader]

    if not rows:
        raise ValueError("source CSV is empty")

    parsed = [(parse_utc(ts), ts, value) for ts, value in rows]
    parsed.sort(key=lambda item: item[0])

    timestamps = [item[0] for item in parsed]
    if len(set(timestamps)) != len(timestamps):
        raise ValueError("source CSV contains duplicate timestamps")

    return [(ts, value) for _, ts, value in parsed]


def expected_hours(start: datetime, end: datetime) -> list[datetime]:
    if end <= start:
        raise ValueError("window end must be after window start")
    hours = int((end - start).total_seconds() // 3600)
    if hours <= 0 or (end - start) != timedelta(hours=hours):
        raise ValueError("window must be aligned to whole UTC hours")
    return [start + timedelta(hours=i) for i in range(hours)]


def write_rows(path: Path, rows: list[tuple[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["timestamp", "value"])
        writer.writerows(rows)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def derive(
    source: Path,
    complete: Path,
    gapped: Path,
    window_start: datetime,
    window_end: datetime,
    remove_start: datetime,
    remove_hours: int,
    manifest: Path,
) -> dict:
    rows = load_rows(source)
    indexed = {parse_utc(ts): (ts, value) for ts, value in rows}
    window = expected_hours(window_start, window_end)

    missing_source = [hour for hour in window if hour not in indexed]
    if missing_source:
        raise ValueError(
            "source window is incomplete: "
            + ", ".join(hour.isoformat().replace("+00:00", "Z") for hour in missing_source)
        )

    removal = [remove_start + timedelta(hours=i) for i in range(remove_hours)]
    if not removal:
        raise ValueError("remove-hours must be positive")
    if any(hour not in set(window) for hour in removal):
        raise ValueError("removal range must be inside the declared source window")

    selected = [indexed[hour] for hour in window]
    gapped_rows = [
        row for hour, row in zip(window, selected) if hour not in set(removal)
    ]

    write_rows(complete, selected)
    write_rows(gapped, gapped_rows)

    manifest_data = {
        "schema": "gapwitness/openaq-derived-fixture/v1",
        "source": {
            "path": str(source),
            "sha256": sha256_file(source),
        },
        "window": {
            "start": window_start.isoformat().replace("+00:00", "Z"),
            "end": window_end.isoformat().replace("+00:00", "Z"),
            "hours": len(window),
        },
        "derivation": {
            "operation": "remove_hourly_rows",
            "removeStart": removal[0].isoformat().replace("+00:00", "Z"),
            "removeHours": remove_hours,
            "removedTimestamps": [
                hour.isoformat().replace("+00:00", "Z") for hour in removal
            ],
        },
        "outputs": {
            "complete": str(complete),
            "completeSha256": sha256_file(complete),
            "gapped": str(gapped),
            "gappedSha256": sha256_file(gapped),
        },
        "integrity_note": (
            "The complete file is copied from the selected source window. "
            "The gapped file is an adversarial derivative created only by "
            "removing the explicitly listed timestamps. No measurement values "
            "are invented or changed."
        ),
    }

    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(manifest_data, indent=2) + "\n", encoding="utf-8")
    return manifest_data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--complete", type=Path, required=True)
    parser.add_argument("--gapped", type=Path, required=True)
    parser.add_argument("--window-start", required=True)
    parser.add_argument("--window-end", required=True)
    parser.add_argument("--remove-start", required=True)
    parser.add_argument("--remove-hours", type=int, default=7)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()

    data = derive(
        source=args.source,
        complete=args.complete,
        gapped=args.gapped,
        window_start=parse_utc(args.window_start),
        window_end=parse_utc(args.window_end),
        remove_start=parse_utc(args.remove_start),
        remove_hours=args.remove_hours,
        manifest=args.manifest,
    )
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
