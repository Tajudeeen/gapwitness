# Sepolia deployment record

Do not invent an address before a real broadcast.

After a successful Sepolia deployment, record the following in a reviewed JSON file:

- `chainId`: 11155111
- `contract`: `GapWitness`
- `address`: deployed contract address
- `deployer`: broadcaster address
- `transactionHash`: deployment transaction
- `blockNumber`: mined deployment block
- `verified`: whether source verification succeeded
- `deploymentCommit`: Git commit used for deployment

Keep private keys, RPC secrets, and explorer API keys outside the repository.
