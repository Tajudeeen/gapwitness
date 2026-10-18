import {test, expect} from '@playwright/test';

test('mobile publishing offers pairing, keeps inspection intact, and connects without signing', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => {
    const browser = window as typeof window & {ethereum: unknown; walletCalls: string[]};
    browser.walletCalls = [];
    browser.ethereum = {request: async ({method}: {method: string}) => {
      browser.walletCalls.push(method);
      if (method === 'eth_chainId') return '0xaa36a7';
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return ['0x1111111111111111111111111111111111111111'];
      throw new Error('Connecting must not sign or send: ' + method);
    }};
  });
  await page.goto('/inspect');
  await expect(page.getByText('checker ready', {exact:true})).toBeVisible();
  await page.getByRole('button', {name: 'load File A · 7 deliberate gaps', exact: true}).click();
  await expect(page.locator('.verdict')).toContainText('GAPPED');
  await page.getByRole('navigation', {name:'Workspace navigation'}).getByRole('link', {name:'Publish',exact:true}).click();
  await expect(page.getByRole('button', {name:'Pair MetaMask mobile / QR',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Connect browser wallet',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Wallet connected',exact:true})).toBeVisible();
  const calls = await page.evaluate(() => (window as typeof window & {walletCalls:string[]}).walletCalls);
  expect(calls.some(method => /sign|sendTransaction/i.test(method))).toBe(false);
  await page.getByRole('button', {name:'Disconnect wallet',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Choose how to connect',exact:true})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Station 2178 · GAPPED',exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('missing browser wallets show a useful recovery without losing the inspection', async ({page}) => {
  await page.goto('/publish');
  await page.getByRole('button', {name:'Connect browser wallet',exact:true}).click();
  await expect(page.locator('.page-message')).toContainText('Pair MetaMask mobile / QR');
  await expect(page.getByRole('button', {name:'Pair MetaMask mobile / QR',exact:true})).toBeEnabled();
});

test('the actual mobile SDK initializes crypto and session storage before opening its relay', async ({page}) => {
  let attempted = false;
  // Explicitly block the external relay. This tests real SDK module compatibility,
  // not a real phone approval, QR handshake, or completed wallet session.
  await page.routeWebSocket(/mm-sdk-relay/, socket => {attempted = true; socket.close();});
  await page.goto('/publish');
  await page.getByRole('button', {name:'Pair MetaMask mobile / QR',exact:true}).click();
  await expect.poll(() => attempted, {timeout: 15000}).toBe(true);
  await expect(page.locator('.page-message')).not.toContainText('constructor');
  await expect(page.locator('.page-message')).not.toContainText('undefined');
  await expect(page.getByRole('heading', {name:'Connect with Metamask',exact:true})).toBeVisible();
  await page.locator('mm-install-modal').getByRole('img').first().click();
  await expect(page.getByRole('button', {name:'Pair MetaMask mobile / QR',exact:true})).toBeVisible();
});
