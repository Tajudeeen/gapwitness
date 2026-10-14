import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Interface,encodeBytes32String,keccak256} from 'ethers';
import {checkPackage} from '../src/lib/packages.ts';
import {verifyChain} from '../src/lib/proof.ts';
import {GAP_WITNESS_ABI} from '../src/lib/wallet.ts';
import {DEFAULT_DEPLOYMENT} from '../src/lib/deployment.ts';
const artifact=JSON.parse(readFileSync('../contracts/deployments/fixture-proof-v2.json','utf8'));
const bytes=readFileSync('../checker/demo/file_a.csv');
const bundle=checkPackage({format:'gapwitness/evidence/v1',evidence:artifact.localEvidence,source:'openaq',csvFilename:'file_a.csv',
  chain:{chainId:11155111,contract:artifact.contract,contractVersion:2,publisher:artifact.publisher,
    transactionHash:artifact.firstReceipt.transactionHash,commitmentKey:artifact.commitmentKey}},bytes);
const iface=new Interface(GAP_WITNESS_ABI);
const runtime=readFileSync('../contracts/deployments/runtime-v2.hex','utf8').trim();
const commitment=bundle.evidence.chainCommitment;
function rpc(overrides={}){
  const methods={eth_chainId:'0xaa36a7',eth_blockNumber:'0xb5d000',eth_getCode:runtime,
    eth_getTransactionReceipt:artifact.firstReceipt,
    eth_getTransactionByHash:{hash:bundle.chain.transactionHash,to:artifact.contract,from:artifact.publisher,
      blockNumber:artifact.firstReceipt.blockNumber,input:iface.encodeFunctionData('commit',[encodeBytes32String(commitment.stationId),
        commitment.windowStart,commitment.windowEnd,commitment.seriesHash,commitment.gapHash,commitment.policyHash,commitment.verdict])},...overrides};
  return async(method,params)=>{
    if(method==='eth_call'){
      if(overrides.eth_call)return overrides.eth_call(params);
      const fn=iface.parseTransaction({data:params[0].data});
      if(fn.name==='version')return iface.encodeFunctionResult('version',[2]);
      assert.equal(fn.args[0],artifact.commitmentKey);
      const stored=artifact.onChainCommitment;
      return iface.encodeFunctionResult('commitments',[stored.seriesHash,stored.gapHash,stored.policyHash,stored.verdictCode,stored.committedAt,stored.submitter]);
    }
    assert.ok(method in methods);return methods[method];
  };
}
test('read-only verifier matches pinned runtime, mined transaction, event, and every source-backed field',async()=>{
  assert.equal(keccak256(runtime),DEFAULT_DEPLOYMENT.runtimeHash);
  const result=await verifyChain(bundle,artifact.publisher,rpc());
  assert.equal(result.fieldsMatched,true);assert.equal(result.runtimeMatched,true);
  assert.equal(result.witnessEvent,true);assert.equal(result.transactionHash,artifact.firstReceipt.transactionHash);
});
test('altered source bytes or any evidence input cannot pass package verification',()=>{
  assert.throws(()=>checkPackage(bundle,Buffer.from(bytes.toString().replace('2.3','99'))),/mismatch/);
  for(const field of ['seriesHash','gapHash','policyHash','stationId','windowEnd','verdict']){
    const altered=structuredClone(bundle);altered.evidence[field]='altered';
    assert.throws(()=>checkPackage(altered,bytes));
  }
});
test('wrong chain, runtime, publisher namespace, key, or failed receipt cannot become proof',async()=>{
  await assert.rejects(verifyChain(bundle,artifact.publisher,rpc({eth_chainId:'0x1'})),/not Ethereum Sepolia/);
  await assert.rejects(verifyChain(bundle,artifact.publisher,rpc({eth_getCode:'0x6000'})),/runtime/);
  await assert.rejects(verifyChain(bundle,'0x1111111111111111111111111111111111111111',rpc()),/Publisher differs/);
  await assert.rejects(verifyChain({...bundle,chain:{...bundle.chain,commitmentKey:'0x'+'00'.repeat(32)}},artifact.publisher,rpc()),/commitment key/);
  await assert.rejects(verifyChain(bundle,artifact.publisher,rpc({eth_getTransactionReceipt:{...artifact.firstReceipt,status:'0x0'}})),/failed/);
  await assert.rejects(verifyChain(bundle,artifact.publisher,rpc({eth_getTransactionReceipt:null})),/unmined/);
});
test('same contract and publisher are insufficient when transaction calldata is unrelated',async()=>{
  const normal=rpc();const unrelated=await normal('eth_getTransactionByHash',[]);
  const changed={...unrelated,input:iface.encodeFunctionData('commit',[encodeBytes32String(commitment.stationId),
    commitment.windowStart,commitment.windowEnd,commitment.seriesHash,commitment.gapHash,commitment.policyHash,0])};
  await assert.rejects(verifyChain(bundle,artifact.publisher,rpc({eth_getTransactionByHash:changed})),/calldata/);
});
test('changed chain fields and missing records are rejected, while a matching replay creates no new witness event',async()=>{
  const s=artifact.onChainCommitment;
  const values=[s.seriesHash,s.gapHash,s.policyHash,s.verdictCode,s.committedAt,s.submitter];
  for(const [index,value] of [[0,'0x'+'00'.repeat(32)],[1,'0x'+'11'.repeat(32)],[2,'0x'+'22'.repeat(32)],
    [3,0],[4,0],[5,'0x1111111111111111111111111111111111111111']]){
    const changed=[...values];changed[index]=value;
    const response=rpc({eth_call:params=>iface.parseTransaction({data:params[0].data}).name==='version'?
      iface.encodeFunctionResult('version',[2]):iface.encodeFunctionResult('commitments',changed)});
    await assert.rejects(verifyChain(bundle,artifact.publisher,response),index===4?/No witness/:/differs/);
  }
  const replay=await verifyChain(bundle,artifact.publisher,rpc({eth_getTransactionReceipt:{...artifact.firstReceipt,logs:[]}}));
  assert.equal(replay.witnessEvent,false);
});
