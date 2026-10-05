# Sepolia deployment record

Do not invent an address before a real broadcast.

The live deployment workflow is `.github/workflows/deploy-sepolia.yml`. It performs a dry-run, broadcasts the contract, records the broadcast into `contracts/deployments/sepolia.json`, optionally verifies the source on Etherscan, and uploads that JSON as the workflow artifact. The deployment record is never populated from guessed or placeholder values.

The recorder is deterministic:

```bash
python scripts/record_sepolia_deployment.py \
  --broadcast contracts/broadcast/DeployGapWitness.s.sol/11155111/run-latest.json \
  --output contracts/deployments/sepolia.json \
  --deployment-commit <GIT_COMMIT> \
  --verified
```

A valid record contains:

- `chainId`: 11155111
- `contract`: `GapWitness`
- `address`: deployed contract address
- `deployer`: broadcaster address
- `transactionHash`: deployment transaction
- `blockNumber`: mined deployment block
- `verified`: whether source verification succeeded
- `deploymentCommit`: Git commit used for deployment

Keep private keys, RPC secrets, and explorer API keys outside the repository.
