import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('review shows unresolved claim, retains schedule document, and rejects altered schedule evidence',async({page})=>{
 await page.goto('/inspect');await expect(page.getByText('checker ready',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'load File A · 7 deliberate gaps',exact:true}).click();
 await expect(page.locator('.verdict')).toContainText('GAPPED');
 await page.getByRole('button',{name:'Continue to review'}).click();
 const decision=page.getByRole('region',{name:'Reporting claim check'});
 await expect(decision).toContainText('Available rows alone would support');
 await expect(decision).toContainText('UNRESOLVED');
 await page.getByLabel('Schedule issuer',{exact:true}).fill('TEST SOURCE ONLY');
 await page.getByLabel('Schedule source URL').fill('https://example.org/schedule');
 await page.getByLabel('Page or section supporting').fill('Test source, hourly reporting. Not a real operator attestation.');
 await page.getByLabel('Schedule source document').setInputFiles({name:'test-schedule.txt',mimeType:'text/plain',buffer:Buffer.from('TEST ONLY: hourly station 2178 schedule')});
 await page.getByRole('checkbox',{name:/I independently checked/}).check();
 await page.getByRole('button',{name:'Attach schedule source',exact:true}).click();
 await expect(page.getByRole('region',{name:'Reporting schedule source'})).toContainText('Not independently authenticated');
 await page.getByRole('button',{name:'Keep this evidence'}).click();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download complete review bundle',exact:true}).click();
 const path=await (await downloading).path();const bundle=JSON.parse(readFileSync(path!,'utf8'));
 expect(bundle.evidence.schedule.attestation).toBe('reviewer-confirmed');
 await page.reload();await page.getByLabel('Open review bundle').setInputFiles(path!);
 await expect(page).toHaveURL(/\/review$/);await expect(page.getByRole('region',{name:'Reporting schedule source'})).toContainText('TEST SOURCE ONLY');
 await page.getByLabel('Claimed maximum arithmetic mean').fill('0');await expect(decision).toContainText('NOT_SUPPORTED');
 await page.getByRole('button',{name:'Keep this evidence'}).click();
 bundle.evidence.schedule.issuer='REPLACED';
 await page.getByLabel('Open review bundle').setInputFiles({name:'altered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
 await expect(page.getByRole('status')).toContainText('fingerprint does not match');
});

test('pilot retains abandoned and interrupted attempts across refresh',async({page})=>{
 await page.goto('/pilot');await page.getByLabel('Anonymous participant code').fill('TEST_ONLY');
 await page.getByLabel('Your normal review method').fill('spreadsheet');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Start normal method timer'}).click();
 await page.getByRole('button',{name:'Reset unfinished task'}).click();
 await expect(page.getByRole('region',{name:'Pilot attempt log'})).toContainText('1 abandoned');
 await page.getByRole('button',{name:'Start normal method timer'}).click();await page.reload();
 await expect(page.getByRole('region',{name:'Pilot attempt log'})).toContainText('1 started or interrupted');
 await expect(page.getByRole('region',{name:'Observed pilot summary'})).toHaveCount(0);
});
