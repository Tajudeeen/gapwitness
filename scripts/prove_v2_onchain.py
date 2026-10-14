"""Record publisher-scoped fixture proof and deploy-bytecode metadata on Sepolia."""
import json
import os
from pathlib import Path
from prove_fixture_onchain import cast, check_rejection, raw_call, validate_receipt, SIGNATURE
from prepare_chain_demo import build_demo_env
from verify_onchain import rpc_call, read_commitment, commitment_key, inspect_csv, keccak256
ROOT = Path(__file__).resolve().parents[1]

def main():
    rpc = os.environ.get('SEPOLIA_RPC_URL') or 'https://ethereum-sepolia-rpc.publicnode.com'
    private_key = os.environ['PRIVATE_KEY']
    record_path = ROOT / 'contracts/deployments/sepolia-v2.json'
    deployment = json.loads(record_path.read_text())
    address, publisher = deployment['address'], deployment['deployer']
    if int(str(rpc_call(rpc, 'eth_chainId', [])), 16) != 11155111:
        raise RuntimeError('Wrong chain')
    code = str(rpc_call(rpc, 'eth_getCode', [address, 'latest']))
    if code == '0x': raise RuntimeError('No deployed V2 code')
    version = rpc_call(rpc, 'eth_call', [{'to': address, 'data': '0x' + keccak256(b'version()')[:8]}, 'latest'])
    if int(str(version), 16) != 2: raise RuntimeError('Not a V2 contract')
    station, start, end = '2178', '2026-09-19T07:00:00Z', '2026-09-20T07:00:00Z'
    a = (ROOT / 'checker/demo/file_a.csv').read_bytes()
    b = (ROOT / 'checker/demo/file_b.csv').read_bytes()
    values = build_demo_env(contract=address, station_id=station, window_start=start, window_end=end, file_a=a, file_b=b)
    key = commitment_key(station, start, end, publisher)
    outsider = '0x1111111111111111111111111111111111111111'
    outsider_key = commitment_key(station, start, end, outsider)
    if key == outsider_key: raise RuntimeError('Publisher namespaces collided')
    # Confirm Solidity and the independent Python verifier derive the same keys.
    for owner, expected in [(publisher, key), (outsider, outsider_key)]:
        calldata = cast('calldata', 'commitmentKey(address,bytes32,uint64,uint64)', owner,
            values['STATION_ID'], values['WINDOW_START'], values['WINDOW_END'])
        actual = rpc_call(rpc, 'eth_call', [{'to': address, 'data': calldata}, 'latest'])
        if actual != expected: raise RuntimeError('Contract and independent publisher key differ')
    args_a = [values['STATION_ID'], values['WINDOW_START'], values['WINDOW_END'], values['FILE_A_SERIES_HASH'],
              values['FILE_A_GAP_HASH'], values['FILE_A_POLICY_HASH'], values['FILE_A_VERDICT']]
    receipt = json.loads(cast('send', address, SIGNATURE, *args_a, '--rpc-url', rpc, '--private-key', private_key, '--json'))
    evidence = inspect_csv(a, station_id=station, window_start=start, window_end=end)
    stored = read_commitment(rpc, address, key)
    comparison = {field: stored[field] == evidence[field] for field in ['seriesHash', 'gapHash', 'policyHash', 'verdictCode']}
    if not all(comparison.values()) or stored['submitter'].lower() != publisher.lower():
        raise RuntimeError('V2 fixture record did not match')
    validate_receipt(receipt, address, key, stored)
    args_b = [values['STATION_ID'], values['WINDOW_START'], values['WINDOW_END'], values['FILE_B_SERIES_HASH'],
              values['FILE_B_GAP_HASH'], values['FILE_B_POLICY_HASH'], values['FILE_B_VERDICT']]
    calldata_b = cast('calldata', SIGNATURE, *args_b)
    block = int(str(rpc_call(rpc, 'eth_blockNumber', [])), 16)
    rejection = check_rejection(raw_call(rpc, [{'to': address, 'from': publisher, 'data': calldata_b}, hex(block)]), values['FILE_A_GAP_HASH'], values['FILE_B_GAP_HASH'])
    outsider_call = raw_call(rpc, [{'to': address, 'from': outsider, 'data': calldata_b}, hex(block)])
    if outsider_call.get('result') != '0x': raise RuntimeError('Independent publisher could not use its own namespace')
    outsider_record = read_commitment(rpc, address, outsider_key)
    if outsider_record['exists']: raise RuntimeError('Read-only simulation unexpectedly persisted evidence')
    runtime_hash = '0x' + keccak256(bytes.fromhex(code[2:]))
    proof = {'chainId':11155111, 'contract':address, 'contractVersion':2, 'publisher':publisher,
        'stationId':station, 'windowStart':start, 'windowEnd':end, 'commitmentKey':key,
        'localEvidence':evidence, 'onChainCommitment':stored, 'comparison':comparison, 'matched':True,
        'firstReceipt':receipt, 'sourceManifest':'data/source/openaq-demo.json',
        'fileBRejection':{'method':'eth_call','blockNumber':block,'error':'GapPaperedOver','data':rejection},
        'publisherIsolation':{'publisherKey':key,'outsiderKey':outsider_key,'keysMatchContract':True,
            'outsiderSubmissionSimulation':'succeeded in its separate namespace', 'method':'eth_call',
            'note':'Simulation creates no record. Attacker state mutation is covered by local EVM tests.'},
        'limits':['Publisher wallet identity does not certify station authority.', 'No sensor truth or checker attestation is enforced by the contract.']}
    (ROOT/'contracts/deployments/fixture-proof-v2.json').write_text(json.dumps(proof,indent=2)+'\n')
    deployment['runtimeHash'] = runtime_hash
    record_path.write_text(json.dumps(deployment,indent=2)+'\n')
    manifest = {'version':2,'address':address,'blockNumber':deployment['blockNumber'],'runtimeHash':runtime_hash}
    (ROOT/'web/src/lib/deployment.ts').write_text('// Deployed and independently verified on Sepolia.\nexport const DEFAULT_DEPLOYMENT = '+json.dumps(manifest,indent=2)+';\n')
    print(json.dumps({'matched':True,'address':address,'publisher':publisher,'transaction':receipt['transactionHash'],'publisherKeysIsolated':True}))

if __name__ == '__main__': main()
