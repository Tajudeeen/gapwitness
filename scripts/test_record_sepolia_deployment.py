from record_sepolia_deployment import build_record


def test_build_record_extracts_gapwitness_deployment() -> None:
    broadcast = {
        "transactions": [
            {
                "hash": "0xdeadbeef",
                "transactionType": "CREATE",
                "contractName": "GapWitness",
                "contractAddress": "0x1234567890123456789012345678901234567890",
                "from": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            }
        ],
        "receipts": [
            {
                "transactionHash": "0xdeadbeef",
                "blockNumber": "0x1234",
                "status": "0x1",
            }
        ],
    }

    record = build_record(
        broadcast,
        deployment_commit="abc123",
        verified=True,
    )

    assert record == {
        "chainId": 11155111,
        "contract": "GapWitness",
        "address": "0x1234567890123456789012345678901234567890",
        "deployer": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "transactionHash": "0xdeadbeef",
        "blockNumber": 4660,
        "verified": True,
        "deploymentCommit": "abc123",
    }


def test_build_record_rejects_multiple_gapwitness_creates() -> None:
    broadcast = {
        "transactions": [
            {
                "hash": "0xone",
                "transactionType": "CREATE",
                "contractName": "GapWitness",
                "contractAddress": "0x1111111111111111111111111111111111111111",
                "from": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
            {
                "hash": "0xtwo",
                "transactionType": "CREATE",
                "contractName": "GapWitness",
                "contractAddress": "0x2222222222222222222222222222222222222222",
                "from": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
        ],
        "receipts": [],
    }

    try:
        build_record(
            broadcast,
            deployment_commit="abc123",
            verified=False,
        )
    except ValueError as exc:
        assert "exactly one GapWitness CREATE" in str(exc)
    else:
        raise AssertionError("expected duplicate deployment detection")
