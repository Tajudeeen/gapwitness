from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_ROOT = REPO_ROOT / "checker"
if str(CHECKER_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKER_ROOT))

from app.main import inspect_csv  # noqa: E402


def build_proof(
    *,
    station_id: str,
    window_start: str,
    window_end: str,
    file_a: bytes,
    file_b: bytes,
    file_c: bytes,
    contract: str | None = None,
    deployment_tx: str | None = None,
    deployment_block: int | None = None,
) -> dict:
    results = {
        "fileA": inspect_csv(
            file_a,
            station_id=station_id,
            window_start=window_start,
            window_end=window_end,
            series_type="pm25",
        ),
        "fileB": inspect_csv(
            file_b,
            station_id=station_id,
            window_start=window_start,
            window_end=window_end,
            series_type="pm25",
        ),
        "fileC": inspect_csv(
            file_c,
            station_id=station_id,
            window_start=window_start,
            window_end=window_end,
            series_type="pm25",
        ),
    }

    a, b, c = results["fileA"], results["fileB"], results["fileC"]

    if a["verdict"] != "GAPPED":
        raise ValueError("File A must be GAPPED.")
    if b["verdict"] != "INTACT":
        raise ValueError("File B must be INTACT.")
    if c["verdict"] != "IMPOSSIBLE":
        raise ValueError("File C must be IMPOSSIBLE.")
    if a["windowStart"] != b["windowStart"] or a["windowEnd"] != b["windowEnd"]:
        raise ValueError("File A and File B must use the exact same window.")
    if a["gapHash"] == b["gapHash"]:
        raise ValueError("File A and File B must produce different gap hashes.")
    if a["policyHash"] != b["policyHash"]:
        raise ValueError("File A and File B must use the same policy.")

    return {
        "schema": "gapwitness/demo-proof/v1",
        "chain": {
            "network": "sepolia",
            "chainId": 11155111,
            "contractRequired": True,
            "deploymentStatus": "recorded" if contract else "pending",
            "contract": contract,
            "deploymentTransaction": deployment_tx,
            "deploymentBlock": deployment_block,
        },
        "claim": {
            "stationId": station_id,
            "windowStart": a["windowStart"],
            "windowEnd": a["windowEnd"],
            "story": "GAPPED File A is committed first; complete File B for the same exact window must be rejected.",
        },
        "fileA": {
            "verdict": a["verdict"],
            "verdictCode": a["verdictCode"],
            "missingTimestamps": a["missingTimestamps"],
            "materialGap": a["materialGap"],
            "seriesHash": a["seriesHash"],
            "gapHash": a["gapHash"],
            "policyHash": a["policyHash"],
        },
        "fileB": {
            "verdict": b["verdict"],
            "verdictCode": b["verdictCode"],
            "missingTimestamps": b["missingTimestamps"],
            "seriesHash": b["seriesHash"],
            "gapHash": b["gapHash"],
            "policyHash": b["policyHash"],
            "expectedConflict": "GapPaperedOver",
        },
        "fileC": {
            "verdict": c["verdict"],
            "verdictCode": c["verdictCode"],
            "impossibleTimestamps": c["impossibleTimestamps"],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a deterministic local GapWitness demo proof.")
    parser.add_argument("--station-id", default="2178")
    parser.add_argument("--window-start", default="2026-09-19T07:00:00Z")
    parser.add_argument("--window-end", default="2026-09-20T07:00:00Z")
    parser.add_argument("--file-a", type=Path, default=REPO_ROOT / "checker/demo/file_a.csv")
    parser.add_argument("--file-b", type=Path, default=REPO_ROOT / "checker/demo/file_b.csv")
    parser.add_argument("--file-c", type=Path, default=REPO_ROOT / "checker/demo/file_c_impossible.csv")
    parser.add_argument("--contract")
    parser.add_argument("--deployment-tx")
    parser.add_argument("--deployment-block", type=int)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    if args.deployment_tx and not args.contract:
        parser.error("--deployment-tx requires --contract")
    if args.deployment_block is not None and not args.contract:
        parser.error("--deployment-block requires --contract")

    proof = build_proof(
        station_id=args.station_id,
        window_start=args.window_start,
        window_end=args.window_end,
        file_a=args.file_a.read_bytes(),
        file_b=args.file_b.read_bytes(),
        file_c=args.file_c.read_bytes(),
        contract=args.contract,
        deployment_tx=args.deployment_tx,
        deployment_block=args.deployment_block,
    )
    rendered = json.dumps(proof, indent=2) + "\n"

    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
