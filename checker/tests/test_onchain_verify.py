from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts import verify_onchain


def test_bytes32_text_matches_chain_encoding():
    encoded = verify_onchain.bytes32_text("2178")

    assert len(encoded) == 32
    assert encoded[:4] == b"2178"
    assert encoded[4:] == b"\x00" * 28


def test_commitment_key_is_abi_compatible():
    key = verify_onchain.commitment_key(
        "2178",
        "2026-09-19T07:00:00Z",
        "2026-09-20T07:00:00Z",
    )

    assert key.startswith("0x")
    assert len(key) == 66


def test_read_commitment_decodes_public_mapping(monkeypatch):
    words = [
        "11" * 32,
        "22" * 32,
        "33" * 32,
        (1).to_bytes(32, "big").hex(),
        (123456).to_bytes(32, "big").hex(),
        (bytes.fromhex("12" * 20)).rjust(32, b"\x00").hex(),
    ]

    def fake_rpc(url, method, params):
        assert url == "https://example.invalid"
        assert method == "eth_call"
        assert params[1] == "latest"
        return "0x" + "".join(words)

    monkeypatch.setattr(verify_onchain, "rpc_call", fake_rpc)

    result = verify_onchain.read_commitment(
        "https://example.invalid",
        "0x" + "aa" * 20,
        "0x" + "bb" * 32,
    )

    assert result == {
        "seriesHash": "0x" + "11" * 32,
        "gapHash": "0x" + "22" * 32,
        "policyHash": "0x" + "33" * 32,
        "verdictCode": 1,
        "committedAt": 123456,
        "submitter": "0x" + "12" * 20,
        "exists": True,
    }


def test_read_commitment_recognizes_missing_commitment(monkeypatch):
    empty = "0x" + ("00" * 32 * 6)

    monkeypatch.setattr(
        verify_onchain,
        "rpc_call",
        lambda *_args, **_kwargs: empty,
    )

    result = verify_onchain.read_commitment(
        "https://example.invalid",
        "0x" + "aa" * 20,
        "0x" + "bb" * 32,
    )

    assert result["exists"] is False
    assert result["seriesHash"] == "0x" + "00" * 32
