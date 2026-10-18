import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { GAP_WITNESS_ABI, extractRevertData, watchWalletEvents, connectWallet, disconnectWallet, commitEvidence } from '../src/lib/wallet.ts';

test('ABI decodes both actual conflict errors with their original fields', () => {
  const iface = new Interface(GAP_WITNESS_ABI);
  const prior = '0x' + 'ab'.repeat(32);
  const next = '0x' + 'cd'.repeat(32);
  const gap = iface.parseError(iface.encodeErrorResult('GapPaperedOver', [prior, next]));
  assert.equal(gap.name, 'GapPaperedOver');
  assert.equal(gap.args[0], prior);
  assert.equal(gap.args[1], next);
  const changed = iface.parseError(iface.encodeErrorResult('CommitmentChanged', [prior, next, prior, next, 1, 0]));
  assert.equal(changed.name, 'CommitmentChanged');
  assert.equal(changed.args[4], 1n);
});

test('extracts provider and ethers nested revert data without looping', () => {
  const data = new Interface(GAP_WITNESS_ABI).encodeErrorResult('GapPaperedOver', ['0x' + 'ab'.repeat(32), '0x' + 'cd'.repeat(32)]);
  assert.equal(extractRevertData({ info: { error: { data } } }), data);
  assert.equal(extractRevertData({ data: { data } }), data);
  const cyclic = {}; cyclic.error = cyclic;
  assert.equal(extractRevertData(cyclic), null);
});

test('wallet disconnect is reported and listeners are removed', () => {
  const listeners = new Map();
  globalThis.window = { ethereum: {
    on: (name, listener) => listeners.set(name, listener),
    removeListener: (name) => listeners.delete(name),
  } };
  const changes = [];
  const stop = watchWalletEvents(state => changes.push(state));
  listeners.get('accountsChanged')(['0x123']);
  listeners.get('accountsChanged')([]);
  assert.deepEqual(changes.at(-1), { address: null, chainId: null });
  stop();
  assert.equal(listeners.size, 0);
});

test('connecting switches to Sepolia without requesting a signature or transaction', async () => {
  const calls = []; let chain = '0x1';
  const address = '0x1111111111111111111111111111111111111111';
  globalThis.window = {ethereum: {request: async ({method}) => {
    calls.push(method);
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [address];
    if (method === 'wallet_switchEthereumChain') {chain = '0xaa36a7';return null;}
    throw new Error('Unexpected method: ' + method);
  }}};
  assert.deepEqual(await connectWallet('browser'), {address, chainId: 11155111n});
  assert.ok(calls.includes('wallet_switchEthereumChain'));
  assert.ok(!calls.some(method => /sign|sendTransaction/i.test(method)));
  await disconnectWallet();
});

test('a wallet that ignores Sepolia switching cannot reach transaction submission', async () => {
  const calls = [];
  globalThis.window = {ethereum: {request: async ({method}) => {
    calls.push(method);
    if (method === 'eth_chainId') return '0x1';
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['0x1111111111111111111111111111111111111111'];
    if (method === 'wallet_switchEthereumChain') return null;
    throw new Error('Must not reach signing: ' + method);
  }}};
  await assert.rejects(connectWallet('browser'), /Select Ethereum Sepolia/);
  await assert.rejects(commitEvidence({}), /Select Ethereum Sepolia/);
  assert.ok(!calls.includes('eth_sendTransaction'));
  await disconnectWallet();
});

test('late browser discovery binds listeners and malformed network events clear the connection', async () => {
  delete globalThis.window.ethereum;
  const changes = [], listeners = new Map();
  const stop = watchWalletEvents(change => changes.push(change));
  globalThis.window.ethereum = {on: (name, fn) => listeners.set(name, fn), removeListener: name => listeners.delete(name),
    request: async ({method}) => method === 'eth_chainId' ? '0xaa36a7' : ['0x1111111111111111111111111111111111111111']};
  await connectWallet('browser');
  listeners.get('chainChanged')('malformed');
  assert.deepEqual(changes.at(-1), {address: null, chainId: 0n});
  await disconnectWallet();
  assert.equal(listeners.size, 0);
  stop();
});

test('cancelling a pending connection prevents a later approval from switching networks', async () => {
  let release; const approval = new Promise(resolve => {release = resolve;});
  let requested; const began = new Promise(resolve => {requested = resolve;});
  const calls = [];
  globalThis.window = {ethereum: {request: async ({method}) => {
    calls.push(method);
    if (method === 'eth_chainId') return '0x1';
    if (method === 'eth_requestAccounts') {requested();return approval;}
    throw new Error('Cancelled connection reached ' + method);
  }}};
  const connecting = connectWallet('browser');
  await began; await disconnectWallet();
  release(['0x1111111111111111111111111111111111111111']);
  await assert.rejects(connecting, /cancelled/);
  assert.ok(!calls.includes('wallet_switchEthereumChain'));
});
