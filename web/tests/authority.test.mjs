import {test} from 'node:test';import assert from 'node:assert/strict';
import {Wallet} from 'ethers';
import {AUTHORITY_DOMAIN,AUTHORITY_TYPES,authorityMessage,verifyAuthority} from '../src/lib/authority.ts';
test('operator signatures are bound to the reviewer-supplied issuer, station, publisher, and validity',async()=>{
  const operator=Wallet.createRandom(),publisher=Wallet.createRandom().address;const now=Math.floor(Date.now()/1000);
  const claim={format:'gapwitness/operator-delegation/v1',stationId:'HM',publisher,validFrom:now-60,validUntil:now+3600,referenceUrl:'https://operator.example/public-key'};
  claim.signature=await operator.signTypedData(AUTHORITY_DOMAIN,AUTHORITY_TYPES,authorityMessage(claim));
  const expected={issuer:operator.address,stationId:'HM',publisher};
  const result=verifyAuthority(claim,expected,now);assert.equal(result.signatureMatched,true);assert.equal(result.stationAuthorityIndependentlyEstablished,false);
  assert.throws(()=>verifyAuthority(claim,{...expected,issuer:Wallet.createRandom().address},now),/Signature/);
  assert.throws(()=>verifyAuthority(claim,{...expected,stationId:'LECU'},now),/does not cover/);
  assert.throws(()=>verifyAuthority({...claim,referenceUrl:'https://different.example'},expected,now),/Signature/);
  assert.throws(()=>verifyAuthority(claim,expected,now+7200),/not currently valid/);
});
test('unsigned, oversized-validity, and unsafe URL delegations are rejected',()=>{
  const now=Math.floor(Date.now()/1000),publisher=Wallet.createRandom().address;
  const claim={format:'gapwitness/operator-delegation/v1',stationId:'HM',publisher,validFrom:now,validUntil:now+3600,referenceUrl:'https://operator.example'};
  assert.throws(()=>verifyAuthority(claim,{issuer:publisher,stationId:'HM',publisher},now),/must sign/);
  assert.throws(()=>authorityMessage({...claim,validUntil:now+31*86400}),/30 days/);
  assert.throws(()=>authorityMessage({...claim,referenceUrl:'javascript:alert(1)'}),/HTTPS/);
});
