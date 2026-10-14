from __future__ import annotations

import argparse
import json
from pathlib import Path


def build_record(
    broadcast: dict,
    *,
    deployment_commit: str,
    verified: bool,
    contract_name: str = "GapWitness",
) -> dict:
    transactions = broadcast.get("transactions", [])
    receipts = {
        item.get("transactionHash"): item
        for item in broadcast.get("receipts", [])
        if item.get("transactionHash")
    }

    candidates = [
        item
        for item in transactions
        if item.get("contractName") == contract_name
        and item.get("transactionType") == "CREATE"
        and item.get("contractAddress")
        and item.get("hash")
    ]
    if len(candidates) != 1:
        raise ValueError(
            "Expected exactly one GapWitness CREATE transaction in the broadcast artifact."
        )

    tx = candidates[0]
    transaction_hash = tx["hash"]
    receipt = receipts.get(transaction_hash, {})

    if receipt.get("status") not in ("0x1", 1):
        raise ValueError("GapWitness deployment transaction did not succeed.")

    block_number = receipt.get("blockNumber")
    if block_number is None:
        raise ValueError("Deployment receipt is missing blockNumber.")

    try:
        block_number = int(block_number, 0) if isinstance(block_number, str) else int(block_number)
    except (TypeError, ValueError) as exc:
        raise ValueError("Deployment blockNumber is not an integer.") from exc

    deployer = tx.get("from") or receipt.get("from")
    if not deployer:
        raise ValueError("Deployment artifact is missing the deployer address.")

    record = {
        "chainId": 11155111,
        "contract": contract_name,
        "address": tx["contractAddress"],
        "deployer": deployer,
        "transactionHash": transaction_hash,
        "blockNumber": block_number,
        "verified": verified,
        "deploymentCommit": deployment_commit,
    }
    if contract_name == "GapWitnessV2":
        record["contractVersion"] = 2
    return record


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--broadcast", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--deployment-commit", required=True)
    parser.add_argument("--verified", action="store_true")
    parser.add_argument("--contract-name", choices=["GapWitness", "GapWitnessV2"], default="GapWitness")
    args = parser.parse_args()

    broadcast = json.loads(args.broadcast.read_text(encoding="utf-8"))
    record = build_record(
        broadcast,
        deployment_commit=args.deployment_commit,
        verified=args.verified,
        contract_name=args.contract_name,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(record, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
