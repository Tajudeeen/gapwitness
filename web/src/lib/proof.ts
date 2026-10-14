import {Interface,keccak256,isAddress,encodeBytes32String} from 'ethers';
import {DEFAULT_DEPLOYMENT} from './deployment.ts';
import {GAP_WITNESS_ABI,getCommitmentKey} from './wallet.ts';
import type {EvidencePackage} from './packages';

const iface=new Interface(GAP_WITNESS_ABI);
export const PROOF_RPC=(import.meta.env??{}).VITE_SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com';
type Rpc = (method:string,params:unknown[])=>Promise<unknown>;
export type ProofResult = {chainId:number;contract:string;publisher:string;commitmentKey:string;snapshotBlock:number;
  firstWitnessAt:string;runtimeMatched:true;fieldsMatched:true;transactionHash:string|null;transactionBlock:number|null;
  witnessEvent:boolean|null;checkedAt:string};

export function rpcReader(signal:AbortSignal):Rpc {
  return async(method,params)=>{
    const response=await fetch(PROOF_RPC,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal});
    if(!response.ok)throw new Error('Sepolia RPC is unavailable. Local evidence matching does not confirm an on-chain record.');
    const body=await response.json();
    if(body.error || body.result===undefined)throw new Error('Sepolia RPC could not complete this check. No fresh chain proof was established.');
    return body.result;
  };
}
const same=(a:unknown,b:unknown)=>String(a).toLowerCase()===String(b).toLowerCase();
const safeBlock=(value:unknown)=>{
  if(typeof value!=='string' || !/^0x[0-9a-f]+$/i.test(value))throw new Error('Invalid RPC block response.');
  const number=Number(BigInt(value));if(!Number.isSafeInteger(number))throw new Error('Invalid RPC block height.');return number;
};

// The caller first recomputes local evidence from original bytes. RPC checks are read-only and require no wallet.
export async function verifyChain(bundle:EvidencePackage,publisher:string,rpc:Rpc,transactionHash?:string):Promise<ProofResult> {
  if(!isAddress(publisher))throw new Error('Enter the publisher wallet address. It identifies a namespace, not station ownership.');
  if(bundle.chain && (!same(bundle.chain.contract,DEFAULT_DEPLOYMENT.address)||bundle.chain.contractVersion!==2||bundle.chain.chainId!==11155111))
    throw new Error('This verifier only supports the pinned Sepolia V2 deployment.');
  if(bundle.chain && !same(bundle.chain.publisher,publisher))throw new Error('Publisher differs from the evidence package chain claim.');
  const key=getCommitmentKey(bundle.evidence.chainCommitment,publisher);
  if(bundle.chain && !same(bundle.chain.commitmentKey,key))throw new Error('Package commitment key does not match its publisher and declared window.');
  if(await rpc('eth_chainId',[])!=='0xaa36a7')throw new Error('RPC is not Ethereum Sepolia.');
  const snapshot=await rpc('eth_blockNumber',[]);const snapshotBlock=safeBlock(snapshot);
  const address=DEFAULT_DEPLOYMENT.address;
  const [code,versionData,recordData]=await Promise.all([
    rpc('eth_getCode',[address,snapshot]),
    rpc('eth_call',[{to:address,data:iface.encodeFunctionData('version')},snapshot]),
    rpc('eth_call',[{to:address,data:iface.encodeFunctionData('commitments',[key])},snapshot]),
  ]);
  if(typeof code!=='string'||code==='0x'||keccak256(code)!==DEFAULT_DEPLOYMENT.runtimeHash)
    throw new Error('Contract runtime does not match the pinned compiled V2 source.');
  if(iface.decodeFunctionResult('version',String(versionData))[0]!==2n)throw new Error('Contract version is not V2.');
  const stored=iface.decodeFunctionResult('commitments',String(recordData));
  if(stored[4]===0n)throw new Error('No witness exists for this publisher, station, and exact window.');
  const c=bundle.evidence.chainCommitment;
  if(!same(stored[0],c.seriesHash)||!same(stored[1],c.gapHash)||!same(stored[2],c.policyHash)||stored[3]!==BigInt(c.verdict)||!same(stored[5],publisher))
    throw new Error('On-chain record differs from the independently recomputed evidence or publisher.');
  let transactionBlock:number|null=null,witnessEvent:boolean|null=null;
  const hash=transactionHash||bundle.chain?.transactionHash||null;
  if(hash){
    if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Invalid transaction hash.');
    const [receiptRaw,transactionRaw]=await Promise.all([rpc('eth_getTransactionReceipt',[hash]),rpc('eth_getTransactionByHash',[hash])]);
    const receipt=receiptRaw as {status:string;transactionHash:string;blockNumber:string;to:string;from:string;logs:{address:string;topics:string[];data:string}[]}|null;
    const transaction=transactionRaw as {hash:string;to:string;from:string;input:string;blockNumber:string}|null;
    if(!receipt||!transaction||receipt.status!=='0x1'||!same(receipt.transactionHash,hash)||!same(transaction.hash,hash)||
      !same(receipt.to,address)||!same(transaction.to,address)||!same(receipt.from,publisher)||!same(transaction.from,publisher)||
      receipt.blockNumber!==transaction.blockNumber)throw new Error('Transaction is unmined, failed, or unrelated to this publisher and contract.');
    transactionBlock=safeBlock(receipt.blockNumber);
    if(transactionBlock>snapshotBlock)throw new Error('Transaction is newer than the checked snapshot. Verify again after it is mined.');
    const call=iface.parseTransaction({data:transaction.input});
    if(!call||call.name!=='commit'||!same(call.args[0],encodeBytes32String(c.stationId))||call.args[1]!==BigInt(c.windowStart)||
      call.args[2]!==BigInt(c.windowEnd)||!same(call.args[3],c.seriesHash)||!same(call.args[4],c.gapHash)||
      !same(call.args[5],c.policyHash)||call.args[6]!==BigInt(c.verdict))throw new Error('Transaction calldata does not match the inspected evidence.');
    witnessEvent=receipt.logs.some(log=>{
      if(!same(log.address,address))return false;
      try {const event=iface.parseLog(log);return event?.name==='Committed'&&same(event.args[0],key)&&same(event.args[1],c.seriesHash)&&
        same(event.args[2],c.gapHash)&&same(event.args[3],c.policyHash)&&event.args[4]===BigInt(c.verdict)&&same(event.args[5],publisher);}catch{return false;}
    });
    if(!witnessEvent&&receipt.logs.some(log=>{
      if(!same(log.address,address))return false;
      try{return iface.parseLog(log)?.name==='Committed';}catch{return false;}
    }))throw new Error('Receipt witness event conflicts with the inspected evidence.');
  }
  return {chainId:11155111,contract:address,publisher,commitmentKey:key,snapshotBlock,
    firstWitnessAt:new Date(Number(stored[4])*1000).toISOString(),runtimeMatched:true,fieldsMatched:true,
    transactionHash:hash,transactionBlock,witnessEvent,checkedAt:new Date().toISOString()};
}
