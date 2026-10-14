import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Interface,encodeBytes32String} from 'ethers';
const artifact=JSON.parse(readFileSync(resolve('../contracts/deployments/fixture-proof-v2.json'),'utf8'));
const runtime=readFileSync(resolve('../contracts/deployments/runtime-v2.hex'),'utf8').trim();
const iface=new Interface([
  'function version() view returns(uint256)',
  'function commitments(bytes32) view returns(bytes32,bytes32,bytes32,uint8,uint64,address)',
  'function commit(bytes32,uint64,uint64,bytes32,bytes32,bytes32,uint8)',
]);
const source=readFileSync(resolve('../checker/demo/file_a.csv'));
const c=artifact.localEvidence.chainCommitment;
const calldata=iface.encodeFunctionData('commit',[encodeBytes32String(c.stationId),c.windowStart,c.windowEnd,c.seriesHash,c.gapHash,c.policyHash,c.verdict]);
const bundle={format:'gapwitness/evidence/v1',source:'openaq',csvFilename:'file_a.csv',evidence:artifact.localEvidence,
  chain:{chainId:11155111,contract:artifact.contract,contractVersion:2,publisher:artifact.publisher,
    transactionHash:artifact.firstReceipt.transactionHash,commitmentKey:artifact.commitmentKey}};
async function nav(page:Page,name:string){await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name,exact:true}).click();}
async function inspect(page:Page){await page.goto('/inspect');await expect(page.getByText('checker ready',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'load File A · 7 deliberate gaps',exact:true}).click();await expect(page.locator('.verdict')).toContainText('GAPPED');}
async function mockRpc(page:Page,wrongGap=false){
  await page.route('https://ethereum-sepolia-rpc.publicnode.com/',async route=>{
    const body=route.request().postDataJSON();let result:unknown;
    if(body.method==='eth_chainId')result='0xaa36a7';else if(body.method==='eth_blockNumber')result='0xb5d000';
    else if(body.method==='eth_getCode')result=runtime;
    else if(body.method==='eth_getTransactionReceipt')result=artifact.firstReceipt;
    else if(body.method==='eth_getTransactionByHash')result={hash:bundle.chain.transactionHash,to:artifact.contract,from:artifact.publisher,blockNumber:artifact.firstReceipt.blockNumber,input:calldata};
    else if(body.method==='eth_call'){
      const fn=iface.parseTransaction({data:body.params[0].data});
      if(fn!.name==='version')result=iface.encodeFunctionResult('version',[2]);
      else {const s=artifact.onChainCommitment;result=iface.encodeFunctionResult('commitments',[s.seriesHash,wrongGap?'0x'+'11'.repeat(32):s.gapHash,s.policyHash,s.verdictCode,s.committedAt,s.submitter]);}
    }else throw new Error(`Unexpected RPC method ${body.method}`);
    await route.fulfill({json:{jsonrpc:'2.0',id:body.id,result}});
  });
}
test('inspection travels across pages, saves explicitly, and rechecks after refresh',async({page})=>{
  await inspect(page);await expect(page.locator('.commit-row')).toHaveCount(0);
  await nav(page,'Review');await expect(page.getByRole('heading',{name:'Review the inspection'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Reviewer workspace'})).toContainText('longest missing run 7 hours');
  await nav(page,'Evidence');await page.getByRole('button',{name:'Save current inspection in this browser',exact:true}).click();
  await expect(page.getByRole('region',{name:'Saved evidence records'})).toContainText('file_a.csv');
  await page.reload();await expect(page.getByRole('button',{name:'Save current inspection in this browser',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Open and recheck',exact:true}).click();await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole('heading',{name:'Station 2178 · GAPPED'})).toBeVisible();
  await nav(page,'Publish');await expect(page.locator('#commit button')).toBeEnabled();
  await page.goBack();await expect(page.getByRole('heading',{name:'Review the inspection'})).toBeVisible();
  await nav(page,'Inspect');await expect(page.locator('.verdict')).toContainText('GAPPED');
  await page.getByLabel('station',{exact:true}).fill('changed');await nav(page,'Review');
  await expect(page.getByRole('heading',{name:'Start with an inspection'})).toBeVisible();
  await nav(page,'Evidence');await page.getByRole('button',{name:'Delete from this browser',exact:true}).click();
  await expect(page.getByRole('heading',{name:'No saved records yet'})).toBeVisible();
});
test('altering browser-stored evidence cannot restore a trusted inspection',async({page})=>{
  await inspect(page);await nav(page,'Evidence');await page.getByRole('button',{name:'Save current inspection in this browser',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open and recheck',exact:true})).toBeVisible();
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('gapwitness-evidence-v1',1);request.onsuccess=()=>{
      const db=request.result;const tx=db.transaction('records','readwrite');const store=tx.objectStore('records');const all=store.getAll();
      all.onsuccess=()=>{const record=all.result[0];record.package.evidence.chainCommitment.seriesHash='0x'+'00'.repeat(32);store.put(record);};
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject();
    };
  }));
  await page.reload();await page.getByRole('button',{name:'Open and recheck',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('mismatch');await expect(page).toHaveURL(/\/evidence$/);
});
test('proof page independently checks the published file and a mocked mined receipt, then invalidates edited inputs',async({page})=>{
  await mockRpc(page);await page.goto('/verify');await expect(page.getByRole('heading',{name:'No fresh confirmation'})).toBeVisible();
  await page.getByRole('button',{name:'Verify original bytes and Sepolia',exact:true}).click();
  await expect(page.getByRole('heading',{name:'RPC-confirmed on Sepolia'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Verified Sepolia result'})).toContainText('A matching new-witness event is present.');
  await page.getByLabel('Publisher wallet address',{exact:true}).fill('0x1111111111111111111111111111111111111111');
  await expect(page.getByRole('heading',{name:'No fresh confirmation'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Verified Sepolia result'})).toHaveCount(0);
});
test('imported files stay local and a tampered original cannot reach chain verification',async({page})=>{
  let calls=0;await page.route('https://ethereum-sepolia-rpc.publicnode.com/',async route=>{calls+=1;await route.abort();});
  await page.goto('/verify');await page.getByRole('button',{name:'Import CSV and evidence JSON',exact:true}).click();
  await page.getByLabel('Original CSV',{exact:true}).setInputFiles({name:'altered.csv',mimeType:'text/csv',buffer:Buffer.from(source.toString().replace('2.3','99'))});
  await page.getByLabel('Evidence JSON',{exact:true}).setInputFiles({name:'evidence.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
  await page.getByLabel('Publisher wallet address',{exact:true}).fill(artifact.publisher);
  await page.getByRole('button',{name:'Verify original bytes and Sepolia',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('mismatch');expect(calls).toBe(0);
});
test('a mismatched on-chain gap cannot be shown as fresh proof',async({page})=>{
  await mockRpc(page,true);await page.goto('/verify');await page.getByRole('button',{name:'Verify original bytes and Sepolia',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('On-chain record differs');
  await expect(page.getByRole('heading',{name:'Independently matched'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No fresh confirmation'})).toBeVisible();
});

test('RPC failure leaves local evidence matched without inventing a chain confirmation',async({page})=>{
  await page.route('https://ethereum-sepolia-rpc.publicnode.com/',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.goto('/verify');await page.getByRole('button',{name:'Verify original bytes and Sepolia',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('RPC is unavailable');
  await expect(page.getByRole('heading',{name:'Independently matched'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No fresh confirmation'})).toBeVisible();
});
test('direct links, empty states, and unknown routes are usable on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const [path,title] of [['/inspect','Inspect an hourly CSV.'],['/review','Review the inspection'],['/evidence','Your evidence records'],['/publish','Publish a testnet witness'],['/verify','Verify the proof'],['/missing-page','Page not found']]){
    await page.goto(path);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.reload();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  }
});

test('a pending wallet operation keeps the inspection locked across page navigation',async({page})=>{
  const revertData=new Interface(['error GapPaperedOver(bytes32 priorGap,bytes32 nextGap)']).encodeErrorResult('GapPaperedOver',[artifact.localEvidence.gapHash,'0x'+'22'.repeat(32)]);
  await page.addInitScript(({data})=>{
    const browser=window as typeof window&{ethereum:unknown;releaseWallet:()=>void;estimateStarted:boolean};
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});browser.releaseWallet=release;browser.estimateStarted=false;
    browser.ethereum={request:async({method}:{method:string})=>{
      if(method==='eth_chainId')return '0xaa36a7';
      if(method==='eth_requestAccounts'||method==='eth_accounts')return ['0x1111111111111111111111111111111111111111'];
      if(method==='eth_getCode')return '0x6000';if(method==='eth_call')return '0x'+'00'.repeat(31)+'02';
      if(method==='eth_blockNumber')return '0xc00000';if(method==='eth_getLogs')return [];
      if(method==='eth_estimateGas'){browser.estimateStarted=true;await gate;throw {code:3,message:'execution reverted',data};}
      throw new Error(`Unexpected wallet method ${method}`);
    }};
  },{data:revertData});
  await inspect(page);await nav(page,'Publish');await page.locator('#commit button').click();
  await expect.poll(()=>page.evaluate(()=>(window as typeof window&{estimateStarted:boolean}).estimateStarted)).toBe(true);
  await nav(page,'Inspect');await expect(page.getByLabel('station',{exact:true})).toBeDisabled();
  await expect(page.locator('.upload input')).toBeDisabled();
  await nav(page,'Publish');await page.evaluate(()=>(window as typeof window&{releaseWallet:()=>void}).releaseWallet());
  await expect(page.locator('.conflict')).toContainText('GapPaperedOver');
  await nav(page,'Inspect');await expect(page.getByLabel('station',{exact:true})).toBeEnabled();
});
