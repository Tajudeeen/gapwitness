import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { GAP_WITNESS_ABI, extractRevertData, watchWalletEvents } from '../src/lib/wallet.ts';

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
