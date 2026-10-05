from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts.prepare_chain_demo import bytes32_text, build_demo_env  # noqa: E402


def test_bytes32_text_matches_web_wallet_padding() -> None:
    encoded = bytes32_text("2178")
    assert encoded == "0x32313738" + "00" * 28


def test_build_demo_env_rejects_non_adversarial_pair() -> None:
    fixture_a = b"timestamp,value\n2026-09-19T07:00:00Z,1\n"
    fixture_b = fixture_a

    try:
        build_demo_env(
            contract="0x0000000000000000000000000000000000000000",
            station_id="2178",
            window_start="2026-09-19T07:00:00Z",
            window_end="2026-09-19T09:00:00Z",
            file_a=fixture_a,
            file_b=fixture_b,
        )
    except ValueError as exc:
        assert "expected GAPPED → INTACT state" in str(exc)
    else:
        raise AssertionError("expected demo state validation to fail")
