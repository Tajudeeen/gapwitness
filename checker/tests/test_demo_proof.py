from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.build_demo_proof import build_proof


def fixture(name: str) -> bytes:
    return (ROOT / "checker" / "demo" / name).read_bytes()


def test_build_demo_proof_is_deterministic():
    kwargs = {
        "station_id": "2178",
        "window_start": "2026-09-19T07:00:00Z",
        "window_end": "2026-09-20T07:00:00Z",
        "file_a": fixture("file_a.csv"),
        "file_b": fixture("file_b.csv"),
        "file_c": fixture("file_c_impossible.csv"),
    }

    first = build_proof(**kwargs)
    second = build_proof(**kwargs)

    assert first == second
    assert first["schema"] == "gapwitness/demo-proof/v1"
    assert first["chain"]["chainId"] == 11155111
    assert first["chain"]["deploymentStatus"] == "pending"

    assert first["fileA"]["verdict"] == "GAPPED"
    assert len(first["fileA"]["missingTimestamps"]) == 7
    assert first["fileB"]["verdict"] == "INTACT"
    assert first["fileB"]["expectedConflict"] == "GapPaperedOver"
    assert first["fileA"]["gapHash"] != first["fileB"]["gapHash"]
    assert first["fileA"]["policyHash"] == first["fileB"]["policyHash"]
    assert first["fileC"]["verdict"] == "IMPOSSIBLE"


def test_proof_is_json_serializable():
    proof = build_proof(
        station_id="2178",
        window_start="2026-09-19T07:00:00Z",
        window_end="2026-09-20T07:00:00Z",
        file_a=fixture("file_a.csv"),
        file_b=fixture("file_b.csv"),
        file_c=fixture("file_c_impossible.csv"),
    )

    assert json.loads(json.dumps(proof)) == proof
