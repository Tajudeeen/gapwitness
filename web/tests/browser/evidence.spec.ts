import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

async function openLab(page: import('@playwright/test').Page) {
  await page.goto('/?view=lab');
  await expect(page.getByText('checker ready', { exact: true })).toBeVisible();
  await expect(page.locator('.splash')).toHaveAttribute('aria-hidden', 'true');
}

async function sourceResponse(page: import('@playwright/test').Page, synthetic = false) {
  let buffer = readFileSync(resolve('../checker/demo/file_a.csv'));
  if (synthetic) {
    const rows = ['timestamp,value'];
    for (let hour=0; hour<24; hour++) {
      if (hour >= 8 && hour < 15) continue;
      rows.push(`${new Date(Date.parse('2026-09-19T07:00:00Z') + hour*3600000).toISOString()},${(12.5+hour*0.42).toFixed(2)}`);
    }
    buffer = Buffer.from(rows.join('\n')+'\n');
  }
  const response = await page.request.post('http://localhost:8000/inspect', {multipart:{
    stationId:'2178',windowStart:'2026-09-19T07:00:00Z',windowEnd:'2026-09-20T07:00:00Z',seriesType:'pm25',
    csv:{name:'file_a.csv',mimeType:'text/csv',buffer}}});
  expect(response.ok()).toBe(true);
  return response;
}

const commit = (page: import('@playwright/test').Page) => page.locator('#commit button');
const upload = (page: import('@playwright/test').Page) => page.locator('input[type=file]');

test('quoted CSV uses checker observations and input changes invalidate evidence', async ({ page }) => {
  await openLab(page);
  await page.getByLabel('Observation window start').fill('2026-01-01T00:00:00Z');
  await page.getByLabel('Observation window end').fill('2026-01-01T03:00:00Z');
  await upload(page).setInputFiles({ name: 'quoted.csv', mimeType: 'text/csv', buffer: Buffer.from('timestamp,value,note\n"2026-01-01T00:00:00","0","quoted, field"\n"2026-01-01T01:00:00","-2","negative"\n"2026-01-02T00:00:00","9999","outside"\n') });
  await expect(page.locator('.verdict')).toContainText('IMPOSSIBLE');
  await expect(page.locator('.timeline-grid button')).toHaveCount(3);
  await expect(page.locator('.timeline-grid button.missing')).toHaveCount(1);
  await expect(page.locator('.timeline-grid')).not.toContainText('undefined');
  await page.locator('.timeline-grid button.observed').first().click();
  await expect(page.locator('.timeline-grid button.selected')).toHaveCount(1);
  await expect(page.locator('.hash-list')).toBeVisible();
  await expect(page.locator('.rail')).toContainText('Uploaded CSV · source unverified');
  await expect(commit(page)).toBeEnabled();
  await page.getByLabel('station', { exact: true }).fill('another-station');
  await expect(page.locator('.hash-list')).toHaveCount(0);
  await expect(commit(page)).toBeDisabled();
  await page.getByRole('button', { name: 'inspect selected CSV again' }).click();
  await expect(page.locator('.panel-head h2')).toContainText('another-station');
  await expect(commit(page)).toBeEnabled();
});

test('source-backed fixtures and synthetic comparison are clearly distinguished', async ({ page }) => {
  await openLab(page);
  await upload(page).setInputFiles(resolve('../checker/demo/file_a.csv'));
  await expect(page.locator('.verdict')).toContainText('GAPPED');
  await expect(page.locator('.timeline-grid button.missing')).toHaveCount(7);
  await page.getByRole('button', { name: 'try the built-in demo' }).click();
  await expect(page.locator('.comparison')).toContainText('INTACT');
  await expect(page.locator('.comparison')).toContainText('no chain rejection tested');
  await expect(page.locator('.rail')).toContainText('Synthetic browser demo');
  await expect(page.locator('.comparison')).not.toContainText('GAP PAPERED OVER');
  await page.getByLabel('Observation window end').fill('2026-09-21T07:00:00Z');
  await expect(page.locator('.comparison')).toHaveCount(0);
  await expect(commit(page)).toBeDisabled();
});

test('an older request cannot restore evidence after inputs change', async ({ page }) => {
  await openLab(page);
  let release!: () => void;
  let started!: () => void;
  const arrived = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/inspect', async route => {
    const response = await sourceResponse(page);
    started();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await upload(page).setInputFiles(resolve('../checker/demo/file_a.csv'));
  await arrived;
  await page.getByLabel('station', { exact: true }).fill('new-context');
  release();
  await expect(page.locator('.message')).toContainText('Inputs changed');
  await expect(commit(page)).toBeDisabled();
  await expect(page.locator('.hash-list')).toHaveCount(0);
  await page.unroute('**/inspect');
  await page.getByRole('button', { name: 'inspect selected CSV again' }).click();
  await expect(page.locator('.verdict')).toContainText('GAPPED');
  await expect(page.locator('.panel-head h2')).toContainText('new-context');
});

test('a newer upload wins over an in-flight synthetic comparison', async ({ page }) => {
  await openLab(page);
  let release!: () => void;
  let started!: () => void;
  const arrived = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/inspect', async route => {
    calls += 1;
    if (calls === 1) {
      const response = await sourceResponse(page, true);
      started();
      await gate;
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'try the built-in demo' }).click();
  await arrived;
  await upload(page).setInputFiles(resolve('../checker/demo/file_b.csv'));
  await expect(page.locator('.verdict')).toContainText('INTACT');
  release();
  await expect(page.locator('.comparison')).toHaveCount(0);
  await expect(page.locator('.rail')).toContainText('Uploaded CSV · source unverified');
  await expect(page.locator('.timeline-grid button.missing')).toHaveCount(0);
});

test('wallet conflict displays decoded hashes and locks evidence during submission', async ({ page }) => {
  const priorGap = '0x' + 'ab'.repeat(32);
  const nextGap = '0x' + 'cd'.repeat(32);
  // GapPaperedOver(bytes32,bytes32), encoded by the same ABI used on-chain.
  const { Interface } = await import('ethers');
  const revertData = new Interface(['error GapPaperedOver(bytes32 priorGap,bytes32 nextGap)']).encodeErrorResult('GapPaperedOver', [priorGap, nextGap]);
  await page.addInitScript(({ data }) => {
    const browser = window as typeof window & { ethereum: unknown; releaseWallet: () => void; estimateStarted: boolean };
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    browser.releaseWallet = release;
    browser.estimateStarted = false;
    browser.ethereum = { request: async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0xaa36a7';
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['0x1111111111111111111111111111111111111111'];
      if (method === 'eth_getCode') return '0x6000';
      if (method === 'eth_call') return '0x'+'00'.repeat(31)+'02';
      if (method === 'eth_blockNumber') return '0xc00000';
      if (method === 'eth_getLogs') return [];
      if (method === 'eth_estimateGas') {
        browser.estimateStarted = true;
        await gate;
        throw { code: 3, message: 'execution reverted', data };
      }
      throw new Error(`Unexpected wallet request: ${method}`);
    } };
  }, { data: revertData });
  await openLab(page);
  await upload(page).setInputFiles(resolve('../checker/demo/file_a.csv'));
  await expect(page.locator('.verdict')).toContainText('GAPPED');
  await commit(page).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { estimateStarted: boolean }).estimateStarted)).toBe(true);
  await expect(page.getByLabel('station', { exact: true })).toBeDisabled();
  await expect(upload(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'try the built-in demo' })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { releaseWallet: () => void }).releaseWallet());
  await expect(page.locator('.conflict')).toContainText('GapPaperedOver');
  await expect(page.locator('.conflict')).toContainText(priorGap);
  await expect(page.locator('.conflict')).toContainText(nextGap);
  await expect(page.getByLabel('station', { exact: true })).toBeEnabled();
});

test('a tampered checker response cannot become committable evidence', async ({page}) => {
  await openLab(page);
  await page.route('**/inspect',async route=>{
    const response=await sourceResponse(page);
    const body=await response.json();
    if (!body.chainCommitment) throw new Error(JSON.stringify(body));
    body.chainCommitment.policyHash='0x'+'00'.repeat(32);
    await route.fulfill({response,json:body});
  });
  await upload(page).setInputFiles(resolve('../checker/demo/file_a.csv'));
  await expect(page.locator('.message')).toContainText('Checker commitment mismatch: policyHash');
  await expect(commit(page)).toBeDisabled();
  await expect(page.locator('.hash-list')).toHaveCount(0);
});

test('source-backed fixture loading exports independently checked evidence',async({page})=>{
  await openLab(page);
  await page.getByRole('button',{name:'load File A · 7 deliberate gaps',exact:true}).click();
  await expect(page.locator('.verdict')).toContainText('GAPPED');
  await expect(page.locator('.rail')).toContainText('Frozen OpenAQ fixture');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'download evidence JSON',exact:true}).click();
  const download=await downloadPromise;
  const stream=await download.createReadStream();
  const parts:Buffer[]=[]; for await(const part of stream!)parts.push(Buffer.from(part));
  const proof=JSON.parse(Buffer.concat(parts).toString());
  expect(proof.browserEvidenceCheck).toBe('matched');
  expect(proof.evidence.missingTimestamps).toHaveLength(7);
  expect(proof.chain).toBeNull();
});

test('extreme finite measurements do not produce invalid chart coordinates',async({page})=>{
  await openLab(page);
  await page.getByLabel('Observation window start').fill('2026-01-01T00:00:00Z');
  await page.getByLabel('Observation window end').fill('2026-01-01T03:00:00Z');
  await upload(page).setInputFiles({name:'extreme.csv',mimeType:'text/csv',buffer:Buffer.from('timestamp,value\n2026-01-01T00:00:00Z,1e308\n2026-01-01T01:00:00Z,-1e308\n2026-01-01T02:00:00Z,0\n')});
  await expect(page.locator('.verdict')).toContainText('IMPOSSIBLE');
  expect(await page.locator('.chart-wrap svg').evaluate(node=>node.outerHTML.includes('NaN'))).toBe(false);
});
