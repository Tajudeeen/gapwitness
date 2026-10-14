"""Commit frozen File A, independently verify storage, and prove File B rejection.

Only File A is broadcast. File B is an eth_call against mined state, so its
expected rejection spends no gas and is never described as a mined transaction.
Run from the repository root. Secrets are read from the environment, never logged.
"""
from __future__ import annotations

import json
import os
import subprocess
import urllib.request
from pathlib import Path

from prepare_chain_demo import build_demo_env
from verify_onchain import commitment_key, inspect_csv, keccak256, read_commitment, rpc_call

ROOT = Path(__file__).resolve().parents[1]
SIGNATURE = "commit(bytes32,uint64,uint64,bytes32,bytes32,bytes32,uint8)"
EVENT_TOPIC = "0x" + keccak256(b"Committed(bytes32,bytes32,bytes32,bytes32,uint8,address)")


def cast(*args: str) -> str:
    result = subprocess.run(["cast", *args], capture_output=True, text=True)
    if result.returncode:
        # Commands may contain the signing key or a credential-bearing RPC URL.
        raise RuntimeError("cast operation failed; credentials and raw stderr withheld")
    return result.stdout.strip()


def find_revert_data(value: object) -> str | None:
    if isinstance(value, str) and value.startswith("0x"):
        return value
    if isinstance(value, dict):
        for key in ("data", "error", "originalError"):
            found = find_revert_data(value.get(key))
            if found:
                return found
    return None


def check_rejection(body: dict, prior_gap: str, next_gap: str) -> str:
    if "error" not in body:
        raise RuntimeError("Changed File B unexpectedly succeeded")
    data = find_revert_data(body["error"])
    expected = "0x" + keccak256(b"GapPaperedOver(bytes32,bytes32)")[:8] + prior_gap[2:] + next_gap[2:]
    if not data or data.lower() != expected.lower():
        raise RuntimeError("File B did not return the exact expected GapPaperedOver payload")
    return data


def raw_call(rpc: str, params: list) -> dict:
    request = urllib.request.Request(rpc, data=json.dumps({"jsonrpc": "2.0", "id": 1,
        "method": "eth_call", "params": params}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main() -> None:
    rpc = os.environ.get("SEPOLIA_RPC_URL") or "https://ethereum-sepolia-rpc.publicnode.com"
    deployment = json.loads((ROOT / "contracts/deployments/sepolia.json").read_text())
    address = deployment["address"]
    chain = int(str(rpc_call(rpc, "eth_chainId", [])), 16)
    if chain != 11155111 or rpc_call(rpc, "eth_getCode", [address, "latest"]) == "0x":
        raise RuntimeError("Expected a deployed GapWitness contract on Sepolia")
    station, start, end = "2178", "2026-09-19T07:00:00Z", "2026-09-20T07:00:00Z"
    a_bytes = (ROOT / "checker/demo/file_a.csv").read_bytes()
    b_bytes = (ROOT / "checker/demo/file_b.csv").read_bytes()
    values = build_demo_env(contract=address, station_id=station, window_start=start,
        window_end=end, file_a=a_bytes, file_b=b_bytes)
    evidence = inspect_csv(a_bytes, station_id=station, window_start=start, window_end=end)
    key = commitment_key(station, start, end)
    before = read_commitment(rpc, address, key)
    receipt = None
    if not before["exists"]:
        private_key = os.environ.get("PRIVATE_KEY")
        if not private_key:
            raise RuntimeError("PRIVATE_KEY is required to commit the source fixture")
        args = [values["STATION_ID"], values["WINDOW_START"], values["WINDOW_END"],
            values["FILE_A_SERIES_HASH"], values["FILE_A_GAP_HASH"],
            values["FILE_A_POLICY_HASH"], values["FILE_A_VERDICT"]]
        receipt = json.loads(cast("send", address, SIGNATURE, *args, "--rpc-url", rpc,
            "--private-key", private_key, "--json"))
        if int(str(receipt["status"]), 0) != 1:
            raise RuntimeError("File A commitment reverted")
    stored = read_commitment(rpc, address, key)
    comparison = {field: stored[field] == evidence[field]
        for field in ("seriesHash", "gapHash", "policyHash", "verdictCode")}
    if not stored["exists"] or not all(comparison.values()):
        raise RuntimeError("Stored evidence does not match the frozen source fixture")
    block = int(str(rpc_call(rpc, "eth_blockNumber", [])), 16)
    # Reuse an existing mined witness without claiming a replay created a new one.
    if receipt is None:
        for first in range(int(deployment["blockNumber"]), block + 1, 5000):
            logs = rpc_call(rpc, "eth_getLogs", [{"address": address,
                "fromBlock": hex(first), "toBlock": hex(min(first + 4999, block)),
                "topics": [EVENT_TOPIC, key]}])
            if logs:
                receipt = rpc_call(rpc, "eth_getTransactionReceipt", [logs[0]["transactionHash"]])
                break
    if not receipt or int(str(receipt["status"]), 0) != 1:
        raise RuntimeError("The original mined commitment receipt could not be located")
    if str(receipt["to"]).lower() != address.lower():
        raise RuntimeError("Commitment receipt targets another contract")
    args_b = [values["STATION_ID"], values["WINDOW_START"], values["WINDOW_END"],
        values["FILE_B_SERIES_HASH"], values["FILE_B_GAP_HASH"],
        values["FILE_B_POLICY_HASH"], values["FILE_B_VERDICT"]]
    calldata = cast("calldata", SIGNATURE, *args_b)
    rejection = check_rejection(raw_call(rpc, [{"to": address, "from": stored["submitter"],
        "data": calldata}, hex(block)]), values["FILE_A_GAP_HASH"], values["FILE_B_GAP_HASH"])
    proof = {"chainId": chain, "contract": address, "commitmentKey": key,
        "stationId": station, "windowStart": start, "windowEnd": end,
        "sourceManifest": "data/source/openaq-demo.json",
        "fileA": "checker/demo/file_a.csv", "fileB": "checker/demo/file_b.csv",
        "localEvidence": evidence, "onChainCommitment": stored, "comparison": comparison,
        "matched": True, "firstReceipt": receipt,
        "fileBRejection": {"method": "eth_call", "blockNumber": block,
            "error": "GapPaperedOver", "data": rejection, "calldata": calldata,
            "note": "Rejection against mined state, not a mined File B transaction."},
        "note": "File A has seven deliberately removed hours. File B preserves the frozen complete source window."}
    output = ROOT / "contracts/deployments/fixture-proof.json"
    output.write_text(json.dumps(proof, indent=2) + "\n")
    print(json.dumps({"matched": True, "fileATransaction": receipt["transactionHash"],
        "fileBRejection": "GapPaperedOver", "rejectionMethod": "eth_call"}))


if __name__ == "__main__":
    main()
