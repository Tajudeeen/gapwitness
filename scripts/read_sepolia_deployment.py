from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deployment", required=True, type=Path)
    args = parser.parse_args()

    record = json.loads(args.deployment.read_text(encoding="utf-8"))
    address = record.get("address")
    if not isinstance(address, str) or not address:
        raise SystemExit("Deployment record has no contract address.")
    print(address)


if __name__ == "__main__":
    main()
