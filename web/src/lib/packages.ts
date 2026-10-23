import { isAddress } from 'ethers';
import {verifyNormalization,type NormalizationRecord} from './csv-import.ts';
import type { CheckResult } from './checker';
import { localEvidence, validateEvidence } from './evidence.ts';

export type ChainClaim = {
  chainId: number; contract: string; contractVersion: number; publisher: string;
  transactionHash: string; commitmentKey: string; operation?: string;
};
export type EvidencePackage = {
  format: 'gapwitness/evidence/v1'; source: string; csvFilename: string;
  originalCsvRequired: true; browserEvidenceCheck: 'matched'; evidence: CheckResult;
  chain: ChainClaim | null; chainVerification?: string; limits: string[];
  sourceDatasetId?:string;
  normalization?:NormalizationRecord;
};

export function checkPackage(raw: unknown, bytes: Uint8Array, originalBytes?:Uint8Array): EvidencePackage {
  const value = raw as EvidencePackage;
  if (!value || value.format !== 'gapwitness/evidence/v1' || !value.evidence) throw new Error('Choose a GapWitness evidence JSON and its original CSV.');
  if (![value.evidence.stationId,value.evidence.windowStart,value.evidence.windowEnd,value.evidence.seriesType].every(field=>typeof field==='string'))
    throw new Error('Evidence JSON must declare a station, UTC window, and inspection policy.');
  const local = localEvidence(bytes, value.evidence);
  validateEvidence(value.evidence, local);
  const normalization=value.normalization===undefined?undefined:verifyNormalization(value.normalization,originalBytes,bytes);
  let chain: ChainClaim | null = null;
  if (value.chain !== null && value.chain !== undefined) {
    const c = value.chain;
    if (c.chainId !== 11155111 || c.contractVersion !== 2 || !isAddress(c.contract) || !isAddress(c.publisher) ||
        !/^0x[0-9a-fA-F]{64}$/.test(c.transactionHash) || !/^0x[0-9a-fA-F]{64}$/.test(c.commitmentKey)) {
      throw new Error('Invalid Sepolia V2 chain metadata. No on-chain verification was performed.');
    }
    chain = {chainId:c.chainId,contract:c.contract,contractVersion:c.contractVersion,publisher:c.publisher,
      transactionHash:c.transactionHash,commitmentKey:c.commitmentKey,operation:c.operation};
  }
  return {format:'gapwitness/evidence/v1',source:typeof value.source==='string'?value.source.slice(0,100):'upload',
    csvFilename:typeof value.csvFilename==='string'?value.csvFilename.slice(0,255):'original.csv',
    originalCsvRequired:true,browserEvidenceCheck:'matched',evidence:local,chain,
    ...(normalization?{normalization}:{}),
    chainVerification:'not independently checked',
    limits:['A source label does not authenticate origin.','Station authority and measurement accuracy need separate review.']};
}

export function downloadFile(content: Blob, filename: string) {
  const url=URL.createObjectURL(content);const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
