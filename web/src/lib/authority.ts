import {encodeBytes32String,isAddress,keccak256,toUtf8Bytes,verifyTypedData} from 'ethers';
import {DEFAULT_DEPLOYMENT} from './deployment.ts';
export const AUTHORITY_DOMAIN={name:'GapWitness Operator Delegation',version:'1',chainId:11155111,verifyingContract:DEFAULT_DEPLOYMENT.address};
export const AUTHORITY_TYPES={Delegation:[{name:'stationId',type:'bytes32'},{name:'publisher',type:'address'},
  {name:'validFrom',type:'uint64'},{name:'validUntil',type:'uint64'},{name:'referenceHash',type:'bytes32'}]};
export type AuthorityClaim={format:'gapwitness/operator-delegation/v1';stationId:string;publisher:string;validFrom:number;validUntil:number;referenceUrl:string;signature?:string};
export function authorityMessage(claim:AuthorityClaim){
  if(!claim||claim.format!=='gapwitness/operator-delegation/v1'||!isAddress(claim.publisher)||typeof claim.stationId!=='string'||!claim.stationId||claim.stationId.includes('\0'))throw new Error('Invalid operator delegation package.');
  const url=new URL(claim.referenceUrl);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use a public HTTPS operator reference URL.');
  if(!Number.isSafeInteger(claim.validFrom)||!Number.isSafeInteger(claim.validUntil)||claim.validFrom<0||claim.validUntil<=claim.validFrom||claim.validUntil-claim.validFrom>30*86400)
    throw new Error('Delegation validity must be at most 30 days with valid Unix timestamps.');
  return {stationId:encodeBytes32String(claim.stationId),publisher:claim.publisher,validFrom:claim.validFrom,validUntil:claim.validUntil,
    referenceHash:keccak256(toUtf8Bytes(claim.referenceUrl))};
}
export function verifyAuthority(claim:AuthorityClaim,expected:{issuer:string;stationId:string;publisher:string},now=Math.floor(Date.now()/1000)){
  const message=authorityMessage(claim);
  if(!isAddress(expected.issuer)||!isAddress(expected.publisher))throw new Error('Provide independently obtained issuer and publisher addresses.');
  if(claim.stationId!==expected.stationId||claim.publisher.toLowerCase()!==expected.publisher.toLowerCase())throw new Error('Delegation does not cover this station and publisher.');
  if(now<claim.validFrom||now>=claim.validUntil)throw new Error('Delegation is not currently valid.');
  if(!claim.signature)throw new Error('The operator must sign this delegation.');
  const issuer=verifyTypedData(AUTHORITY_DOMAIN,AUTHORITY_TYPES,message,claim.signature);
  if(issuer.toLowerCase()!==expected.issuer.toLowerCase())throw new Error('Signature does not match the independently supplied issuer key.');
  return {issuer,stationId:claim.stationId,publisher:claim.publisher,validUntil:claim.validUntil,referenceUrl:claim.referenceUrl,
    signatureMatched:true,stationAuthorityIndependentlyEstablished:false,
    limits:['The reviewer must independently establish that this issuer represents the station operator.',
      'The reference URL is signed context, not an authenticated ownership record.',
      'Offline verification has no revocation registry and does not prove authorization at a past witness time.']};
}
