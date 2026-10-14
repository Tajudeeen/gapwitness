// Run on the authorized operator's own machine. Never send the private key to GapWitness.
import {readFileSync,writeFileSync} from 'node:fs';
import {Wallet} from 'ethers';
import {AUTHORITY_DOMAIN,AUTHORITY_TYPES,authorityMessage} from '../src/lib/authority.ts';
const [requestPath,outputPath]=process.argv.slice(2);
if(!requestPath||!outputPath||!process.env.AUTHORITY_PRIVATE_KEY)throw new Error('Provide request JSON, output JSON, and AUTHORITY_PRIVATE_KEY in your own environment.');
const request=JSON.parse(readFileSync(requestPath,'utf8'));const claim=request.claim??request;
const message=authorityMessage(claim);const operator=new Wallet(process.env.AUTHORITY_PRIVATE_KEY);
const signature=await operator.signTypedData(AUTHORITY_DOMAIN,AUTHORITY_TYPES,message);
writeFileSync(outputPath,JSON.stringify({...claim,signature},null,2)+'\n');
console.log(JSON.stringify({signed:true,operator:operator.address,stationId:claim.stationId,publisher:claim.publisher,validUntil:claim.validUntil}));
