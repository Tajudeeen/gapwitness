"""Broadcast an exact replay on Sepolia and prove the original record is unchanged."""
import json
import os
import subprocess
from pathlib import Path

def cast(*args):
    return subprocess.check_output(["cast", *args], text=True).strip()

def main():
    rpc = os.environ["SEPOLIA_RPC_URL"]
    key = os.environ["PRIVATE_KEY"]
    deployment = json.loads(Path("deployments/sepolia.json").read_text())
    address = deployment["address"]
    station = cast("keccak", "gapwitness-replay-proof-" + os.environ["GITHUB_RUN_ID"])
    start, end = "1767225600", "1767312000"
    series = cast("keccak", "replay-proof-series")
    gap = cast("keccak", "replay-proof-gap")
    policy = cast("keccak", "gapwitness/pm25/hourly/v1")
    commitment_key = cast("keccak", cast("abi-encode", "f(bytes32,uint64,uint64)", station, start, end))
    signature = "commit(bytes32,uint64,uint64,bytes32,bytes32,bytes32,uint8)"
    getter = "commitments(bytes32)(bytes32,bytes32,bytes32,uint8,uint64,address)"

    def read():
        return json.loads(cast("call", address, getter, commitment_key, "--rpc-url", rpc, "--json"))

    def send():
        # Only receipts are returned. Never print the command or private key.
        result = subprocess.run(["cast", "send", address, signature, station, start, end,
                                 series, gap, policy, "1", "--rpc-url", rpc,
                                 "--private-key", key, "--json"], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError("Sepolia proof transaction failed")
        receipt = json.loads(result.stdout)
        if int(str(receipt["status"]), 0) != 1:
            raise RuntimeError("Sepolia proof transaction reverted")
        return receipt

    first = send()
    before = read()
    replay = send()
    after = read()
    own_logs = [log for log in replay["logs"] if log["address"].lower() == address.lower()]
    if before != after or own_logs:
        raise RuntimeError("Replay changed the first witness or emitted new evidence")
    proof = {"chainId": 11155111, "contract": address, "commitmentKey": commitment_key,
             "stationHash": station, "windowStart": int(start), "windowEnd": int(end),
             "before": before, "after": after, "firstReceipt": first, "replayReceipt": replay,
             "unchanged": True, "replayEventCount": 0,
             "note": "Synthetic replay regression evidence, not environmental source data."}
    Path("deployments/replay-proof.json").write_text(json.dumps(proof, indent=2) + "\n")
    print(json.dumps({"unchanged": True, "firstTransaction": first["transactionHash"],
                      "replayTransaction": replay["transactionHash"]}))

if __name__ == "__main__":
    main()
