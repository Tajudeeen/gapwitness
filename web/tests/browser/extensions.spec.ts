import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {Wallet} from 'ethers';
import {AUTHORITY_DOMAIN,AUTHORITY_TYPES,authorityMessage} from '../../src/lib/authority';
const catalog=JSON.parse(readFileSync('../data/corpus/catalog.json','utf8'));
test('retained York source opens with independently matched evidence and no deliberate gaps',async({page})=>{
 await page.goto('/inspect?dataset=uk-air-yk11-2025-04-01');
 await expect(page.locator('.verdict')).toContainText('GAPPED');
 await expect(page.getByLabel('station',{exact:true})).toHaveValue('YK11');
 await expect(page.getByText('Retained real corpus · normalization documented',{exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name:'Review',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Station YK11 · GAPPED'})).toBeVisible();
});
test('pilot starts empty and exports measured paired times and exact scoring',async({page})=>{
 await page.goto('/pilot');await expect(page.getByRole('heading',{name:'0 paired tasks in this browser'})).toBeVisible();
 await page.getByLabel('Anonymous participant code').fill('SELF_CHECK');await page.getByLabel('Your normal review method').fill('Schedule-aware spreadsheet');
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Start normal method timer'}).click();
 const dataset=catalog.datasets.find((row:{id:string})=>row.id==='uk-air-yk11-2025-04-01');
 await page.getByLabel('Unavailable timestamps, one ISO UTC timestamp per line').fill(dataset.missingTimestamps.join('\n'));
 await page.getByRole('button',{name:'Submit answers and stop timer'}).click();await page.getByRole('button',{name:'Start GapWitness timer'}).click();
 await page.getByLabel('Unavailable timestamps, one ISO UTC timestamp per line').fill(dataset.missingTimestamps.join('\n'));
 await page.getByRole('button',{name:'Submit answers and stop timer'}).click();await page.getByRole('button',{name:'Save paired task locally'}).click();
 await expect(page.getByRole('heading',{name:'1 paired tasks in this browser'})).toBeVisible();
 const rows=await page.evaluate(()=>JSON.parse(localStorage.getItem('gapwitness-pilot-v1')!));
 expect(rows[0].baseline_seconds).toBeGreaterThan(0);expect(rows[0].tool_seconds).toBeGreaterThan(0);
 expect(rows[0].baseline_correct).toBe(1);expect(rows[0].tool_correct).toBe(1);expect(rows[0].source_csv_sha256).toBe(dataset.csvSha256);
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export observed pilot CSV'}).click();expect((await downloaded).suggestedFilename()).toBe('gapwitness-pilot-observations.csv');
});
test('a synthetic signature proves only the supplied issuer and is invalidated when it changes',async({page})=>{
 await page.goto('/verify');const operator=Wallet.createRandom();
 const publisher=await page.getByLabel('Publisher wallet address',{exact:true}).inputValue();const now=Math.floor(Date.now()/1000);
 const claim={format:'gapwitness/operator-delegation/v1',stationId:'2178',publisher,validFrom:now-60,validUntil:now+3600,referenceUrl:'https://operator.example/authority',signature:''};
 claim.signature=await operator.signTypedData(AUTHORITY_DOMAIN,AUTHORITY_TYPES,authorityMessage(claim));
 await page.getByLabel('Independently obtained operator wallet').fill(operator.address);
 await page.getByLabel('Signed delegation JSON').setInputFiles({name:'synthetic-unit-delegation.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(claim))});
 await page.getByRole('button',{name:'Check delegation signature'}).click();
 await expect(page.getByRole('heading',{name:'Signature matches the supplied issuer key'})).toBeVisible();
 await expect(page.getByText(/Station authority has not been independently established by this app/)).toBeVisible();
 await page.getByLabel('Independently obtained operator wallet').fill(Wallet.createRandom().address);
 await expect(page.getByRole('heading',{name:'Signature matches the supplied issuer key'})).toHaveCount(0);
 await page.getByRole('button',{name:'Check delegation signature'}).click();await expect(page.getByRole('alert')).toContainText('Signature');
});
test('new pages are navigable without horizontal overflow on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const [path,title] of [['/datasets','Real source datasets'],['/pilot','Run a reviewer pilot'],['/status','Service status']]){
  await page.goto(path);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }
 await expect(page.getByText('Shared quota not configured',{exact:true})).toBeVisible();
});
