from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_ROOT = REPO_ROOT / "checker"
if str(CHECKER_ROOT) not in sys.path:
    sys.path.insert(0, str(CHECKER_ROOT))

from app.main import inspect_csv, keccak256  # noqa: E402

SEPOLIA_CHAIN_ID = 11155111
COMMITMENTS_SELECTOR = bytes.fromhex(keccak256(b"commitments(bytes32)")[:8])
ZERO_WORD = "00" * 32


def bytes32_text(value: str) -> bytes:
    raw = value.encode("utf-8")
    if len(raw) > 31:
        raise ValueError("STATION_ID must be at most 31 UTF-8 bytes.")
    return raw.ljust(32, b"\x00")


def unix_seconds(value: str) -> int:
    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return int(timestamp.astimezone(timezone.utc).timestamp())


def commitment_key(station_id: str, window_start: str, window_end: str) -> str:
    encoded = (
        bytes32_text(station_id)
        + unix_seconds(window_start).to_bytes(32, "big")
        + unix_seconds(window_end).to_bytes(32, "big")
    )
    return "0x" + keccak256(encoded)


def rpc_call(rpc_url: str, method: str, params: list[object]) -> object:
    payload = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    ).encode("utf-8")
    request = urllib.request.Request(
        rpc_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"RPC request failed: {exc}") from exc

    if "error" in body:
        raise RuntimeError(f"RPC error: {body['error']}")
    return body.get("result")


def read_commitment(rpc_url: str, contract: str, key: str) -> dict[str, object]:
    calldata = "0x" + COMMITMENTS_SELECTOR.hex() + key[2:]
    result = rpc_call(
        rpc_url,
        "eth_call",
        [{"to": contract, "data": calldata}, "latest"],
    )

    if not isinstance(result, str) or not result.startswith("0x"):
        raise RuntimeError("eth_call returned an invalid result.")

    payload = result[2:]
    if len(payload) < 64 * 6:
        raise RuntimeError("commitments() returned an unexpectedly short payload.")

    words = [payload[i : i + 64] for i in range(0, 64 * 6, 64)]
    return {
        "seriesHash": "0x" + words[0],
        "gapHash": "0x" + words[1],
        "policyHash": "0x" + words[2],
        "verdictCode": int(words[3], 16),
        "committedAt": int(words[4], 16),
        "submitter": "0x" + words[5][-40:],
        "exists": words[0] != ZERO_WORD,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Independently verify a GapWitness commitment against an EVM RPC."
    )
    parser.add_argument("csv", type=Path)
    parser.add_argument("--station-id", required=True)
    parser.add_argument("--window-start", required=True)
    parser.add_argument("--window-end", required=True)
    parser.add_argument("--contract", required=True)
    parser.add_argument(
        "--rpc-url",
        default="https://ethereum-sepolia-rpc.publicnode.com",
        help="Ethereum JSON-RPC URL. Defaults to a public Sepolia endpoint.",
    )
    parser.add_argument("--series-type", default="pm25")
    args = parser.parse_args()

    chain_id = int(str(rpc_call(args.rpc_url, "eth_chainId", [])), 16)
    if chain_id != SEPOLIA_CHAIN_ID:
        raise RuntimeError(
            f"Expected Sepolia chain ID {SEPOLIA_CHAIN_ID}, received {chain_id}."
        )

    evidence = inspect_csv(
        args.csv.read_bytes(),
        station_id=args.station_id,
        window_start=args.window_start,
        window_end=args.window_end,
        series_type=args.series_type,
    )
    key = commitment_key(args.station_id, args.window_start, args.window_end)
    onchain = read_commitment(args.rpc_url, args.contract, key)

    comparison = {
        "seriesHash": onchain["seriesHash"] == evidence["seriesHash"],
        "gapHash": onchain["gapHash"] == evidence["gapHash"],
        "policyHash": onchain["policyHash"] == evidence["policyHash"],
        "verdictCode": onchain["verdictCode"] == evidence["verdictCode"],
    }
    matched = bool(onchain["exists"]) and all(comparison.values())

    output = {
        "chainId": chain_id,
        "contract": args.contract,
        "commitmentKey": key,
        "localEvidence": {
            "stationId": evidence["stationId"],
            "windowStart": evidence["windowStart"],
            "windowEnd": evidence["windowEnd"],
            "verdict": evidence["verdict"],
            "verdictCode": evidence["verdictCode"],
            "seriesHash": evidence["seriesHash"],
            "gapHash": evidence["gapHash"],
            "policyHash": evidence["policyHash"],
        },
        "onChainCommitment": onchain,
        "comparison": comparison,
        "matched": matched,
    }
    print(json.dumps(output, indent=2))

    return 0 if matched else 1


if __name__ == "__main__":
    raise SystemExit(main())
