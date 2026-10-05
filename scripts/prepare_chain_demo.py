from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_ROOT = REPO_ROOT / "checker"
if str(CHECKER_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKER_ROOT))

from app.main import inspect_csv  # noqa: E402


def bytes32_text(value: str) -> str:
    raw = value.encode("utf-8")
    if len(raw) > 32:
        raise ValueError("STATION_ID must be at most 32 UTF-8 bytes.")
    return "0x" + raw.ljust(32, b"\x00").hex()


def unix_seconds(value: str) -> int:
    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return int(timestamp.astimezone(timezone.utc).timestamp())


def build_demo_env(
    *,
    contract: str,
    station_id: str,
    window_start: str,
    window_end: str,
    file_a: bytes,
    file_b: bytes,
) -> dict[str, str]:
    a = inspect_csv(
        file_a,
        station_id=station_id,
        window_start=window_start,
        window_end=window_end,
        series_type="pm25",
    )
    b = inspect_csv(
        file_b,
        station_id=station_id,
        window_start=window_start,
        window_end=window_end,
        series_type="pm25",
    )

    if a["verdict"] != "GAPPED" or b["verdict"] != "INTACT":
        raise ValueError("Demo fixtures are not in the expected GAPPED → INTACT state.")
    if a["windowStart"] != b["windowStart"] or a["windowEnd"] != b["windowEnd"]:
        raise ValueError("Demo fixtures must share the exact declared window.")
    if a["policyHash"] != b["policyHash"]:
        raise ValueError("Demo fixtures must use the same checker policy.")
    if a["gapHash"] == b["gapHash"]:
        raise ValueError("Demo fixtures must produce different gap hashes.")

    return {
        "GAPWITNESS_ADDRESS": contract,
        "STATION_ID": bytes32_text(station_id),
        "WINDOW_START": str(unix_seconds(window_start)),
        "WINDOW_END": str(unix_seconds(window_end)),
        "FILE_A_SERIES_HASH": a["seriesHash"],
        "FILE_A_GAP_HASH": a["gapHash"],
        "FILE_A_POLICY_HASH": a["policyHash"],
        "FILE_A_VERDICT": str(a["verdictCode"]),
        "FILE_B_SERIES_HASH": b["seriesHash"],
        "FILE_B_GAP_HASH": b["gapHash"],
        "FILE_B_POLICY_HASH": b["policyHash"],
        "FILE_B_VERDICT": str(b["verdictCode"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate exact env inputs for the GapWitness on-chain demo."
    )
    parser.add_argument("--contract", required=True, help="Deployed GapWitness Sepolia address.")
    parser.add_argument("--station-id", default="2178")
    parser.add_argument("--window-start", default="2026-09-19T07:00:00Z")
    parser.add_argument("--window-end", default="2026-09-20T07:00:00Z")
    parser.add_argument("--file-a", type=Path, default=REPO_ROOT / "checker" / "demo" / "file_a.csv")
    parser.add_argument("--file-b", type=Path, default=REPO_ROOT / "checker" / "demo" / "file_b.csv")
    parser.add_argument("--format", choices=("env", "json"), default="env")
    args = parser.parse_args()

    values = build_demo_env(
        contract=args.contract,
        station_id=args.station_id,
        window_start=args.window_start,
        window_end=args.window_end,
        file_a=args.file_a.read_bytes(),
        file_b=args.file_b.read_bytes(),
    )

    if args.format == "json":
        print(json.dumps(values, indent=2))
        return

    for key, value in values.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()
