"""Deploy V2 using the live RPC gas estimate rather than a fork-simulation estimate."""
import json
import os
import subprocess
import re
from pathlib import Path
from prove_fixture_onchain import cast
from verify_onchain import rpc_call
ROOT=Path(__file__).resolve().parents[1]

def main():
    rpc=os.environ.get('SEPOLIA_RPC_URL') or 'https://ethereum-sepolia-rpc.publicnode.com'
    key=os.environ['PRIVATE_KEY']
    if int(str(rpc_call(rpc,'eth_chainId',[])),16)!=11155111:raise RuntimeError('Expected Sepolia')
    existing_path=ROOT/'contracts/deployments/sepolia-v2.json'
    if existing_path.exists():
        existing=json.loads(existing_path.read_text())
        receipt=rpc_call(rpc,'eth_getTransactionReceipt',[existing['transactionHash']])
        version=rpc_call(rpc,'eth_call',[{'to':existing['address'],'data':'0x54fd4d50'},hex(existing['blockNumber'])])
        if not receipt or int(str(receipt['status']),0)!=1 or int(str(version),16)!=2:
            raise RuntimeError('Retained V2 deployment failed its independent chain checks')
        print(json.dumps({'existingDeployment':True,'address':existing['address'],'transaction':existing['transactionHash']}))
        return
    publisher=cast('wallet','address','--private-key',key)
    artifact=json.loads((ROOT/'contracts/out/GapWitnessV2.sol/GapWitnessV2.json').read_text())
    code=artifact['bytecode']['object']
    if not code.startswith('0x'):code='0x'+code
    estimate=int(str(rpc_call(rpc,'eth_estimateGas',[{'from':publisher,'data':code}])),16)
    gas_limit=(estimate*125+99)//100
    if gas_limit>10000000:raise RuntimeError('Deployment gas estimate exceeds the explicit 10 million gas cap')
    result=subprocess.run(['cast','send','--rpc-url',rpc,'--private-key',key,'--gas-limit',str(gas_limit),'--json','--create',code],capture_output=True,text=True)
    if result.returncode:
        error=result.stderr.replace(key,'[redacted]').replace(key.removeprefix('0x'),'[redacted]').replace(rpc,'[rpc]')
        error=re.sub(r'[0-9a-fA-F]{64,}', '[hex data]', error)
        raise RuntimeError('Deployment command failed: '+error[-2000:])
    receipt=json.loads(result.stdout)
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
