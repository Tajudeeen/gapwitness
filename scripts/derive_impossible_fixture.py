#!/usr/bin/env python3
"""Create the impossible demo fixture from a frozen real File B.

Only the selected value is changed, and the transformation is recorded in a
machine-readable manifest so the demo cannot be mistaken for source data.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def derive(source: Path, output: Path, timestamp: str, value: str, manifest: Path) -> dict:
    with source.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if set(reader.fieldnames or []) != {"timestamp", "value"}:
            raise ValueError("source CSV must contain exactly timestamp,value columns")
        rows = list(reader)

    matches = [row for row in rows if row["timestamp"] == timestamp]
    if len(matches) != 1:
        raise ValueError(f"expected exactly one target timestamp, found {len(matches)}")

    original_value = matches[0]["value"]
    matches[0]["value"] = value

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["timestamp", "value"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    result = {
        "schema": "gapwitness/impossible-fixture/v1",
        "source": {
            "path": str(source),
            "sha256": sha256_file(source),
        },
        "mutation": {
            "timestamp": timestamp,
            "originalValue": original_value,
            "replacementValue": value,
            "reason": "exercise PM2.5 negative-value hard rule",
        },
        "output": {
            "path": str(output),
            "sha256": sha256_file(output),
        },
        "integrityNote": (
            "This file is intentionally synthetic. It is derived from the frozen "
            "real File B by changing one selected value to an impossible negative PM2.5 value."
        ),
    }

    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--timestamp", required=True)
    parser.add_argument("--value", default="-1")
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()

    print(
        json.dumps(
            derive(
                source=args.source,
                output=args.output,
                timestamp=args.timestamp,
                value=args.value,
                manifest=args.manifest,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
