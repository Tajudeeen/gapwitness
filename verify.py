from __future__ import annotations

import argparse
import json
from pathlib import Path

from checker.app.main import inspect_csv


def main() -> None:
    parser = argparse.ArgumentParser(description="Reproduce GapWitness evidence from a CSV file.")
    parser.add_argument("csv", type=Path)
    parser.add_argument("--station-id", required=True)
    parser.add_argument("--window-start", required=True)
    parser.add_argument("--window-end", required=True)
    parser.add_argument("--series-type", default="pm25")
    args = parser.parse_args()

    evidence = inspect_csv(
        args.csv.read_bytes(),
        station_id=args.station_id,
        window_start=args.window_start,
        window_end=args.window_end,
        series_type=args.series_type,
    )

    print(json.dumps({
        "stationId": evidence["stationId"],
        "windowStart": evidence["windowStart"],
        "windowEnd": evidence["windowEnd"],
        "verdict": evidence["verdict"],
        "verdictCode": evidence["verdictCode"],
        "missingTimestamps": evidence["missingTimestamps"],
        "impossibleTimestamps": evidence["impossibleTimestamps"],
        "seriesHash": evidence["seriesHash"],
        "gapHash": evidence["gapHash"],
        "policyHash": evidence["policyHash"],
        "chainCommitment": evidence["chainCommitment"],
    }, indent=2))


if __name__ == "__main__":
    main()
