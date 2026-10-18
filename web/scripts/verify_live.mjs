// Run the same independent checks as the browser against actual Sepolia RPC data.
// Read-only. No wallet, signing key, cached RPC result, or request mock is used.
import {readFileSync, writeFileSync} from 'node:fs';
import {checkPackage} from '../src/lib/packages.ts';
import {rpcReader, verifyChain} from '../src/lib/proof.ts';

const artifact = JSON.parse(readFileSync(new URL('../../contracts/deployments/fixture-proof-v2.json', import.meta.url), 'utf8'));
const bytes = readFileSync(new URL('../../checker/demo/file_a.csv', import.meta.url));
const bundle = checkPackage({format: 'gapwitness/evidence/v1', evidence: artifact.localEvidence,
  source: 'openaq', csvFilename: 'file_a.csv', chain: {chainId: 11155111, contract: artifact.contract,
    contractVersion: 2, publisher: artifact.publisher, transactionHash: artifact.firstReceipt.transactionHash,
    commitmentKey: artifact.commitmentKey}}, bytes);
const result = await verifyChain(bundle, artifact.publisher, rpcReader(AbortSignal.timeout(60000)));
if (result.witnessEvent !== true) throw new Error('The published first-witness transaction must include a matching Committed event.');
const report = {format: 'gapwitness/live-verification/v1', requestMocks: false, originalCsvRecomputed: true, ...result};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
