"""Deploy V2 using the live RPC gas estimate rather than a fork-simulation estimate."""
import json
import os
from pathlib import Path
from prove_fixture_onchain import cast
from verify_onchain import rpc_call
ROOT=Path(__file__).resolve().parents[1]

def main():
    rpc=os.environ.get('SEPOLIA_RPC_URL') or 'https://ethereum-sepolia-rpc.publicnode.com'
    key=os.environ['PRIVATE_KEY']
    if int(str(rpc_call(rpc,'eth_chainId',[])),16)!=11155111:raise RuntimeError('Expected Sepolia')
    publisher=cast('wallet','address','--private-key',key)
    artifact=json.loads((ROOT/'contracts/out/GapWitnessV2.sol/GapWitnessV2.json').read_text())
    code=artifact['bytecode']['object']
    if not code.startswith('0x'):code='0x'+code
    estimate=int(str(rpc_call(rpc,'eth_estimateGas',[{'from':publisher,'data':code}])),16)
    gas_limit=(estimate*125+99)//100
    if gas_limit>10000000:raise RuntimeError('Deployment gas estimate exceeds the explicit 10 million gas cap')
    receipt=json.loads(cast('send','--create',code,'--rpc-url',rpc,'--private-key',key,'--gas-limit',str(gas_limit),'--json'))
    if int(str(receipt.get('status','0x0')),0)!=1 or not receipt.get('contractAddress'):
        raise RuntimeError('V2 deployment did not succeed')
    record={'chainId':11155111,'contract':'GapWitnessV2','contractVersion':2,
            'address':receipt['contractAddress'],'deployer':publisher,
            'transactionHash':receipt['transactionHash'],'blockNumber':int(str(receipt['blockNumber']),0),
            'verified':False,'deploymentCommit':os.environ['GITHUB_SHA'],
            'rpcGasEstimate':estimate,'gasLimit':gas_limit,'deploymentReceipt':receipt}
    (ROOT/'contracts/deployments/sepolia-v2.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps({'address':record['address'],'transaction':record['transactionHash'],'rpcGasEstimate':estimate,'gasLimit':gas_limit}))
if __name__=='__main__':main()
