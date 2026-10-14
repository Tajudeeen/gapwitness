"""Verify the existing public V2 source on Sourcify without an explorer API key."""
import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='https://sourcify.dev/server/v2'

def request(path,body=None):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type':'application/json','User-Agent':'GapWitness/1.0'})
    with urllib.request.urlopen(req,timeout=30) as response:return json.load(response)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--submit',action='store_true');args=parser.parse_args()
    deployment=json.loads((ROOT/'contracts/deployments/sepolia-v2.json').read_text())
    path=ROOT/'contracts/deployments/sourcify-v2.json'
    retained=json.loads(path.read_text()) if path.exists() else {}
    if retained.get('verificationId'):
        result=request('/verify/'+retained['verificationId'])
    elif args.submit:
        artifact=json.loads((ROOT/'contracts/out/GapWitnessV2.sol/GapWitnessV2.json').read_text())
        metadata=artifact['metadata'];settings=dict(metadata['settings']);target=settings.pop('compilationTarget')
        sources={name:{'content':(ROOT/'contracts'/name).read_text()} for name in metadata['sources']}
        contract_path,contract_name=next(iter(target.items()))
        result=request(f"/verify/11155111/{deployment['address']}",{'stdJsonInput':{'language':'Solidity','sources':sources,'settings':settings},
            'compilerVersion':metadata['compiler']['version'],'contractIdentifier':contract_path+':'+contract_name,
            'creationTransactionHash':deployment['transactionHash']})
    else:
        result=request(f"/contract/11155111/{deployment['address']}?fields=all")
    report={'format':'gapwitness/source-verification/v1','provider':'Sourcify','chainId':11155111,'address':deployment['address'],
        'deploymentCommit':deployment['deploymentCommit'],'url':f"https://repo.sourcify.dev/11155111/{deployment['address']}",
        **retained,'response':result}
    if result.get('verificationId'):report['verificationId']=result['verificationId']
    contract=result.get('contract',{})
    report['verified']=contract.get('creationMatch')=='exact_match' and contract.get('runtimeMatch')=='exact_match' and str(contract.get('chainId'))=='11155111' and str(contract.get('address','')).lower()==deployment['address'].lower()
    if report['verified']:
        deployment['sourceVerification']={'provider':'Sourcify','creationMatch':'exact_match','runtimeMatch':'exact_match',
            'verifiedAt':contract['verifiedAt'],'url':report['url']}
        (ROOT/'contracts/deployments/sepolia-v2.json').write_text(json.dumps(deployment,indent=2)+'\n')
    path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':main()
